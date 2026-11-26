import {
  LOCALES,
  LOCALE_NAMES,
  OG_LOCALES,
  createTranslator,
  getClientI18nBundle,
  getFaqItems,
  localePath,
  type Locale
} from "../i18n";
import type { NormalizedResetEvent, ResetPayload } from "../data/repository";

const DAY_MS = 86_400_000;
const MIN_HEATMAP_WEEKS = 28;
const BASE_URL = "https://antigravityreset.app";

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60]
];

export function formatRelative(
  targetMs: number,
  nowMs: number,
  locale: Locale,
  options: { skipWeeks?: boolean } = {}
): string {
  const t = createTranslator(locale);
  if (!Number.isFinite(targetMs) || !Number.isFinite(nowMs)) return "—";
  const diffSec = Math.round((targetMs - nowMs) / 1000);
  const absSec = Math.abs(diffSec);
  if (absSec < 45) return t("just now");

  const rtf =
    typeof Intl !== "undefined" && Intl.RelativeTimeFormat
      ? new Intl.RelativeTimeFormat(locale, { numeric: "always" })
      : null;

  for (const [unit, unitSec] of RELATIVE_UNITS) {
    if (options.skipWeeks && unit === "week") continue;
    if (absSec >= unitSec || unit === "minute") {
      const value = Math.round(diffSec / unitSec);
      if (rtf) return rtf.format(value, unit);
      const label = Math.abs(value) === 1 ? unit : `${unit}s`;
      return diffSec < 0 ? `${Math.abs(value)} ${label} ago` : `in ${Math.abs(value)} ${label}`;
    }
  }
  return t("just now");
}

export function formatUtcTime(iso: string, locale: Locale): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return createTranslator(locale)("Date unavailable");
  return `${new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(ms)} UTC`;
}

function formatNumber(value: number | null, locale: Locale): string {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale).format(value);
}

function formatDays(value: number | null, locale: Locale): string {
  if (value === null || Number.isNaN(value)) return "—";
  return createTranslator(locale)("{days}d", { days: value.toFixed(1) });
}

function renderDigitSpans(value: number | null, locale: Locale): string {
  const text = value === null ? "—" : new Intl.NumberFormat(locale).format(value);
  return Array.from(text, (ch) => `<span class="t-digit">${escapeHtml(ch)}</span>`).join("");
}

function renderLanguageLinks(current: Locale, persistPreference: boolean, autofocusCurrent = false): string {
  return LOCALES.map((loc) => {
    const isCurrent = loc === current;
    const base = localePath(loc);
    const href = persistPreference ? `${base}?lang=${loc}` : base;
    const rel = href.includes("?") ? ' rel="nofollow"' : "";
    const aria = isCurrent ? ' aria-current="page"' : "";
    const auto = isCurrent && autofocusCurrent ? " autofocus" : "";
    return `<a href="${href}" lang="${loc}" hreflang="${loc}"${rel}${aria}${auto}>${LOCALE_NAMES[loc]}</a>`;
  }).join("");
}

interface HeatmapCell {
  date: string;
  ms: number;
  events: NormalizedResetEvent[];
  isFuture: boolean;
}

function utcMidnight(ms: number): Date {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function buildHeatmapWeeks(events: NormalizedResetEvent[], nowMs: number): HeatmapCell[][] {
  const today = utcMidnight(nowMs);
  const minStartMs = today.getTime() - (MIN_HEATMAP_WEEKS - 1) * 7 * DAY_MS;
  let earliestMs = minStartMs;
  const byDate = new Map<string, NormalizedResetEvent[]>();

  for (const ev of events) {
    const parsed = Date.parse(ev.announced_at);
    if (!Number.isFinite(parsed)) continue;
    const dayStart = utcMidnight(parsed).getTime();
    if (dayStart < earliestMs) earliestMs = dayStart;
    const dateKey = new Date(dayStart).toISOString().slice(0, 10);
    const list = byDate.get(dateKey);
    if (list) list.push(ev);
    else byDate.set(dateKey, [ev]);
  }

  const startDate = utcMidnight(earliestMs);
  const sundayStart = new Date(startDate.getTime() - startDate.getUTCDay() * DAY_MS);
  const weeks: HeatmapCell[][] = [];

  for (let cursor = sundayStart.getTime(); cursor <= today.getTime(); cursor += 7 * DAY_MS) {
    const week: HeatmapCell[] = [];
    for (let dow = 0; dow < 7; dow += 1) {
      const cellDate = new Date(cursor + dow * DAY_MS);
      const dateStr = cellDate.toISOString().slice(0, 10);
      week.push({
        date: dateStr,
        ms: cellDate.getTime(),
        events: byDate.get(dateStr) ?? [],
        isFuture: cellDate.getTime() > today.getTime()
      });
    }
    weeks.push(week);
  }
  return weeks;
}

function formatMonthLabel(monthIndex: number, locale: Locale): string {
  const parts = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).formatToParts(
    new Date(Date.UTC(2026, monthIndex, 1))
  );
  const idx = parts.findIndex((p) => p.type === "month");
  if (idx === -1) return String(monthIndex + 1);
  let label = parts[idx].value;
  const next = parts[idx + 1];
  if (next?.type === "literal" && /^[月월]\s*$/.test(next.value)) {
    label += next.value;
  }
  return label;
}

function renderContributionGraph(events: NormalizedResetEvent[], locale: Locale, nowMs: number): string {
  const t = createTranslator(locale);
  const weeks = buildHeatmapWeeks(events, nowMs);

  const weekdayLabels = Object.fromEntries(
    [1, 3, 5].map((dayIndex) => [
      dayIndex,
      new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
        new Date(Date.UTC(2026, 0, 4 + dayIndex))
      )
    ])
  );

  const weekdaysHtml = Array.from({ length: 7 }, (_, i) => {
    const label = weekdayLabels[i] ?? "";
    return `<span class="cg-weekday" style="grid-row:${i + 2}">${escapeHtml(label)}</span>`;
  }).join("");

  const monthSpans: Array<{ wi: number; month: number }> = [];
  let prevMonth = -1;
  weeks.forEach((week, wi) => {
    const month = new Date(week[0].ms).getUTCMonth();
    if (month !== prevMonth) {
      monthSpans.push({ wi, month });
      prevMonth = month;
    }
  });

  const monthsHtml = monthSpans
    .map((entry, idx) => {
      const next = monthSpans[idx + 1];
      const span = (next ? next.wi : weeks.length) - entry.wi;
      return `<span class="cg-month" style="grid-column:${entry.wi + 1} / span ${span};grid-row:1">${escapeHtml(
        formatMonthLabel(entry.month, locale)
      )}</span>`;
    })
    .join("");

  const cellsHtml = weeks
    .map((week, wi) =>
      week
        .map((cell, di) => {
          if (cell.isFuture) {
            return `<span class="cg-cell cg-cell--future" style="grid-column:${wi + 1};grid-row:${di + 2}" aria-hidden="true"></span>`;
          }
          const count = cell.events.length;
          const level = count > 0 ? 1 : 0;
          const first = cell.events[0] ?? null;
          const resetType = cell.events.some((e) => e.reset_type === "all") ? "all" : "regular";
          const modelsAttr = first
            ? escapeHtml(first.models.length > 0 ? first.models.join(", ") : t("All Models"))
            : "";
          const snippet = first ? escapeHtml(first.display_text.replace(/\s+/g, " ").trim().slice(0, 120)) : "";
          const label =
            count === 0
              ? t("No reset")
              : t(count > 1 ? "{count} {type} resets" : "{count} {type} reset", {
                  count,
                  type: t(resetType)
                });
          const aria = escapeHtml(t("{label} on {date} (UTC)", { label, date: cell.date }));
          const attrs = `class="cg-cell" data-level="${level}"${
            first ? ` data-reset-type="${resetType}" data-models="${modelsAttr}"` : ""
          } data-date="${cell.date}" data-count="${count}" data-snippet="${snippet}" style="grid-column:${
            wi + 1
          };grid-row:${di + 2}" aria-label="${aria}"`;

          return first?.source_url
            ? `<a ${attrs} href="${escapeHtml(first.source_url)}" target="_blank" rel="noopener noreferrer"></a>`
            : `<button type="button" ${attrs}></button>`;
        })
        .join("")
    )
    .join("");

  return `
<section class="graph-section" aria-labelledby="graph-heading">
  <div class="section-head">
    <h2 id="graph-heading">${escapeHtml(t("Antigravity reset history"))}</h2>
    <p class="section-sub graph-legend">
      <span class="legend-item"><span class="legend-chip legend-chip--regular"></span> ${escapeHtml(t("regular"))}</span>
      <span class="legend-item"><span class="legend-chip legend-chip--all"></span> ${escapeHtml(t("all"))}</span>
      <span class="legend-item"><span class="legend-chip"></span> ${escapeHtml(t("no reset"))}</span>
    </p>
  </div>
  <div class="graph-card">
    <div class="cg-container">
      <div class="cg-weekdays" style="grid-template-rows:20px repeat(7,var(--cell-size))">${weekdaysHtml}</div>
      <div class="cg-scroll">
        <div class="cg-grid" style="grid-template-columns:repeat(${weeks.length},var(--cell-size));grid-template-rows:20px repeat(7,var(--cell-size))">
          ${monthsHtml}
          ${cellsHtml}
        </div>
      </div>
      <div class="cg-tooltip" id="cg-tooltip" role="tooltip" hidden></div>
    </div>
  </div>
</section>`;
}

function renderEventItems(events: NormalizedResetEvent[], locale: Locale, nowMs: number): string {
  const t = createTranslator(locale);
  return events
    .map((ev) => {
      const models = ev.models.length > 0 ? ev.models : [t("All Models")];
      const tagsHtml = models
        .map(
          (model) =>
            `<span class="log-model-tag${ev.models.length === 0 ? " log-model-tag--all" : ""}">${escapeHtml(
              model
            )}</span>`
        )
        .join("");

      return `
    <li class="log-item" data-event-id="${escapeHtml(ev.id)}">
      <img class="log-avatar" src="/antigravity-avatar.svg" alt="" aria-hidden="true" loading="lazy" width="44" height="44" />
      <div class="log-bubble">
        <div class="log-item-meta">
          <time class="log-item-time" datetime="${escapeHtml(ev.announced_at)}" data-role="relative-time" data-datetime="${escapeHtml(ev.announced_at)}">${escapeHtml(
            formatRelative(Date.parse(ev.announced_at), nowMs, locale)
          )}</time>
          <time class="log-item-abs" datetime="${escapeHtml(ev.announced_at)}" data-role="absolute-time" data-datetime="${escapeHtml(
            ev.announced_at
          )}">${escapeHtml(formatUtcTime(ev.announced_at, locale))}</time>
          <span class="log-model-tags">${tagsHtml}</span>
        </div>
        <p class="log-item-text" data-role="tweet-display-text">${escapeHtml(ev.display_text)}</p>
        <a class="log-item-link" href="${escapeHtml(ev.source_url)}" target="_blank" rel="noopener noreferrer">${t(
          "View on X &rarr;"
        )}</a>
      </div>
    </li>`;
    })
    .join("");
}

function renderEventLog(events: NormalizedResetEvent[], locale: Locale, nowMs: number): string {
  const t = createTranslator(locale);
  if (events.length === 0) {
    return `
<section class="log-section" aria-labelledby="log-heading">
  <div class="section-head">
    <h2 id="log-heading">${escapeHtml(t("Antigravity reset announcements"))}</h2>
  </div>
  <p class="log-empty">${escapeHtml(t("Nothing yet. The timeline is quiet. Too quiet."))}</p>
</section>`;
  }

  const headItems = renderEventItems(events.slice(0, 3), locale, nowMs);
  const restItems = events.slice(3);
  const moreSection =
    restItems.length > 0
      ? `
  <details class="log-more">
    <summary class="log-more-toggle">
      <span class="log-more-label-closed">${escapeHtml(
        t("Show all {count} resets", { count: events.length })
      )}</span>
      <span class="log-more-label-open">${escapeHtml(t("Show fewer"))}</span>
      <span class="log-more-arrow" aria-hidden="true">&darr;</span>
    </summary>
    <ol class="log-list log-list--more" start="4">${renderEventItems(restItems, locale, nowMs)}</ol>
  </details>`
      : "";

  return `
<section class="log-section" aria-labelledby="log-heading">
  <div class="section-head">
    <h2 id="log-heading">${escapeHtml(t("Antigravity reset announcements"))}</h2>
    <p class="section-sub">${escapeHtml(t("Every announcement, preserved for history"))}</p>
  </div>
  <ol class="log-list">${headItems}</ol>${moreSection}
</section>`;
}

function renderFaqSection(
  locale: Locale,
  faqItems: ReadonlyArray<{ question: string; answer: string }>
): string {
  const t = createTranslator(locale);
  const itemsHtml = faqItems
    .map(
      (item) => `
    <details class="faq-item">
      <summary class="faq-question">${escapeHtml(item.question)}</summary>
      <p class="faq-answer">${escapeHtml(item.answer)}</p>
    </details>`
    )
    .join("");

  return `
<section class="faq-section" aria-labelledby="faq-heading">
  <div class="section-head">
    <h2 id="faq-heading">${escapeHtml(t("Frequently asked questions"))}</h2>
    <p class="section-sub">${escapeHtml(t("Everything about Antigravity quota resets"))}</p>
  </div>
  <div class="faq-list">${itemsHtml}
  </div>
</section>`;
}

export function renderThemeHeadScript(): string {
  return `<script>(() => {
  const STORAGE_KEY = "antigravity-reset-theme";
  const LIGHT = "light";
  const DARK = "dark";
  const THEME_COLORS = { light: "#fff4dd", dark: "#17130f" };
  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = null;

  function readPreference() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return value === LIGHT || value === DARK ? value : null;
    } catch {
      return null;
    }
  }

  function writePreference(theme) {
    preference = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }

  function systemPreference() {
    return systemTheme.matches ? DARK : LIGHT;
  }

  function syncControls(scope = document) {
    const theme = root.dataset.theme === DARK ? DARK : LIGHT;
    const nextTheme = theme === DARK ? LIGHT : DARK;
    const language = root.lang;
    const label = language === "zh-CN"
      ? \`切换到\${nextTheme === LIGHT ? "浅色" : "深色"}模式\`
      : language === "zh-TW"
        ? \`切換至\${nextTheme === LIGHT ? "淺色" : "深色"}模式\`
        : language === "ja"
          ? \`\${nextTheme === LIGHT ? "ライト" : "ダーク"}モードに切り替える\`
          : language === "ko"
            ? \`\${nextTheme === LIGHT ? "밝은" : "어두운"} 테마로 전환\`
            : \`Switch to \${nextTheme} mode\`;
    scope.querySelectorAll('[data-role="theme-toggle"]').forEach((button) => {
      button.setAttribute("aria-pressed", theme === DARK ? "true" : "false");
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
    });
  }

  function applyTheme(theme) {
    const normalized = theme === DARK ? DARK : LIGHT;
    root.dataset.theme = normalized;
    root.style.colorScheme = normalized;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute("content", THEME_COLORS[normalized]);
    });
    syncControls();
  }

  function toggleTheme() {
    const nextTheme = root.dataset.theme === DARK ? LIGHT : DARK;
    writePreference(nextTheme);
    applyTheme(nextTheme);
  }

  preference = readPreference();
  applyTheme(preference ?? systemPreference());
  root.classList.add("theme-controls-enabled");

  systemTheme.addEventListener?.("change", () => {
    if (!preference) applyTheme(systemPreference());
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-role="theme-toggle"]')) toggleTheme();
  });

  document.addEventListener("DOMContentLoaded", () => syncControls());
  window.antigravityTheme = { sync: syncControls };
})();</script>`;
}

export function renderMasthead(locale: Locale, isHome: boolean): string {
  const t = createTranslator(locale);
  const titleEl = isHome
    ? `<h1 class="masthead-title">Antigravity Reset</h1>`
    : `<a class="masthead-title masthead-home-link" href="${localePath(locale)}">Antigravity Reset</a>`;

  return `  <header class="masthead">
    <div class="masthead-brand">
      <span class="masthead-avatar-wrap">
        <img class="masthead-avatar" src="/antigravity-avatar.svg" alt="" aria-hidden="true" width="48" height="48" />
        <span class="masthead-sticker" data-role="mohan-sticker" aria-hidden="true"></span>
        <span class="masthead-sticker-tip" data-role="mohan-sticker-tip" aria-hidden="true"></span>
      </span>
      <div class="masthead-copy">
        <div class="masthead-title-row">
          ${titleEl}
        </div>
        <p class="masthead-presence" data-role="online-count" data-state="connecting" role="group"
          data-presence-locale="${escapeHtml(locale)}"
          data-presence-live="${escapeHtml(t("{count} here now"))}"
          data-presence-connecting="${escapeHtml(t("Connecting to live visitor count"))}"
          data-presence-unavailable="${escapeHtml(t("Live visitor count unavailable"))}"
          aria-label="${escapeHtml(t("Connecting to live visitor count"))}" title="${escapeHtml(
            t("Connecting to live visitor count")
          )}">
          <span class="masthead-presence-dot" aria-hidden="true"></span>
          <span aria-hidden="true">${t("{count} here now", {
            count: `<strong class="masthead-presence-count">—</strong>`
          })}</span>
        </p>
      </div>
    </div>
    <div class="masthead-side">
      <button class="language-toggle" type="button" popovertarget="language-menu" aria-label="${escapeHtml(
        t("Language")
      )}" title="${escapeHtml(t("Language"))}" aria-expanded="false" aria-controls="language-menu">
        <svg class="language-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z" />
        </svg>
      </button>
      <nav class="language-menu" id="language-menu" popover="auto" aria-label="${escapeHtml(t("Language"))}">
        ${renderLanguageLinks(locale, true, true)}
      </nav>
      <a class="x-link" data-role="x-link" href="https://x.com/_mohansolo" target="_blank" rel="noopener noreferrer" title="${escapeHtml(
        t("Follow @_mohansolo on X")
      )}" aria-label="${escapeHtml(t("Follow @_mohansolo on X"))}">
        <svg class="x-link-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.23 10.16 22.1 1h-1.87l-6.84 7.96L8.04 1H1.5l8.26 12.03L1.5 23h1.87l7.22-8.4L15.96 23H22.5l-8.27-12.84Zm-2.56 2.97-.83-1.19L4.04 2.43h2.86l5.34 7.64.84 1.19 6.94 9.93h-2.86l-5.49-7.06Z" />
        </svg>
      </a>
      <button class="theme-toggle" type="button" data-role="theme-toggle" aria-label="${escapeHtml(
        t("Toggle color theme")
      )}" title="${escapeHtml(t("Toggle color theme"))}">
        <span class="theme-toggle-icons" aria-hidden="true">
          <svg class="theme-toggle-icon theme-toggle-icon--moon" viewBox="0 0 24 24">
            <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />
          </svg>
          <svg class="theme-toggle-icon theme-toggle-icon--sun" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </span>
      </button>
    </div>
  </header>`;
}

export function renderFooter(locale: Locale, monitorLastSuccessAt?: string): string {
  const t = createTranslator(locale);
  const mdPath = locale === "en" ? "/en.md" : `${localePath(locale)}.md`;
  return `  <footer class="site-footer">
    <nav class="site-footer-langs" aria-label="${escapeHtml(t("Language"))}">
      ${renderLanguageLinks(locale, false, false)}
    </nav>
    <p>${escapeHtml(
      t("Data from @_mohansolo's posts on X, tracked for Antigravity Reset. Not affiliated with Google.")
    )}</p>
    <p>${escapeHtml(t("Mohan, if you're reading this: no pressure."))}</p>
    <p>${t("Want the data? There's free public {api}, {rss}, and {md}.", {
      api: `<a href="/api/docs">API</a>`,
      rss: `<a href="/feed.xml">RSS</a>`,
      md: `<a href="${mdPath}">Markdown</a>`
    })}</p>
    ${
      monitorLastSuccessAt
        ? `<p>${t("Last synced: {time}", {
            time: `<time datetime="${escapeHtml(monitorLastSuccessAt)}" data-role="absolute-time" data-datetime="${escapeHtml(
              monitorLastSuccessAt
            )}">${escapeHtml(formatUtcTime(monitorLastSuccessAt, locale))}</time>`
          })}</p>`
        : ""
    }
  </footer>`;
}

export interface RenderOptions {
  locale: Locale;
  payload: ResetPayload;
  reactionCount: number | null;
  nowMs?: number;
}

export function renderHomePage({ locale, payload, reactionCount, nowMs = Date.now() }: RenderOptions): string {
  const t = createTranslator(locale);
  const { events, stats, monitor } = payload;
  const latestEvent = events[0] ?? null;
  const lastResetAt = stats.last_reset_at;
  const lastResetMs = lastResetAt ? Date.parse(lastResetAt) : NaN;
  const elapsed = nowMs - lastResetMs;
  const isThanksMode = Number.isFinite(elapsed) && elapsed >= 0 && elapsed < DAY_MS;
  const mode = isThanksMode ? "thanks" : "beg";
  const reactionTitle = t(isThanksMode ? "Say thanks for the reset" : "Beg for a reset");
  const cycleId = latestEvent?.id ?? "none";

  const isAllScope = latestEvent?.reset_type === "all";
  const scopeTitle = isAllScope ? t("All-model / multi-model reset") : t("Gemini quota reset");
  const scopeTooltip = isAllScope
    ? t("Covers all models or multiple model families (such as Gemini & Argon) across Antigravity.")
    : t("Covers the Gemini model quota across Antigravity tiers for the announcement listed below.");

  const heroFigure = lastResetAt
    ? `<time class="hero-figure" datetime="${escapeHtml(lastResetAt)}" data-role="relative-time" data-skip-weeks data-datetime="${escapeHtml(
        lastResetAt
      )}">${escapeHtml(formatRelative(lastResetMs, nowMs, locale, { skipWeeks: true }))}</time>`
    : `<span class="hero-figure hero-figure--muted">${escapeHtml(t("No resets tracked yet"))}</span>`;

  const heroSub = lastResetAt
    ? `<p class="hero-sub hero-sub--scope">
        <span class="hero-reset-type-meta"><span class="term-hint" tabindex="0" aria-describedby="scope-reset-tip"><strong>${escapeHtml(
          scopeTitle
        )}</strong><span class="term-tooltip" id="scope-reset-tip" role="tooltip">${escapeHtml(
          scopeTooltip
        )}</span></span><span aria-hidden="true">·</span></span>
        <time datetime="${escapeHtml(lastResetAt)}" data-role="absolute-time" data-datetime="${escapeHtml(lastResetAt)}">${escapeHtml(
          formatUtcTime(lastResetAt, locale)
        )}</time>
      </p>`
    : `<p class="hero-sub">${escapeHtml(t("Once @_mohansolo announces one, it'll show up here within minutes."))}</p>`;

  const canonicalUrl = `${BASE_URL}${localePath(locale)}`;
  const mdUrl = locale === "en" ? `${BASE_URL}/en.md` : `${BASE_URL}${localePath(locale)}.md`;
  const latestDateShort = lastResetAt ? lastResetAt.slice(0, 10) : new Date(nowMs).toISOString().slice(0, 10);
  const pageTitle = t("Antigravity Reset — Live Quota Reset Tracker & History");
  const pageDescription = t(
    "Track {count} verified Google Antigravity quota resets (latest: {date}). Browse Gemini, Argon & all-model reset history and get live alerts.",
    { count: stats.total, date: latestDateShort }
  );

  const faqItems = getFaqItems(locale, {
    total: stats.total,
    avgIntervalDays: stats.avg_interval_days !== null ? stats.avg_interval_days.toFixed(1) : "—",
    longestWaitDays: stats.longest_wait_days !== null ? stats.longest_wait_days.toFixed(1) : "—"
  });

  const monitorMs = Date.parse(monitor.lastSuccessAt);
  const effectiveSyncAt =
    Number.isFinite(lastResetMs) && (!Number.isFinite(monitorMs) || lastResetMs > monitorMs)
      ? lastResetAt!
      : monitor.lastSuccessAt;

  const hreflangLinks = [
    ...LOCALES.map(
      (loc) => `<link rel="alternate" hreflang="${loc}" href="${BASE_URL}${localePath(loc)}" />`
    ),
    `<link rel="alternate" hreflang="x-default" href="${BASE_URL}/" />`
  ].join("\n  ");

  const ogAlternates = LOCALES.filter((loc) => loc !== locale)
    .map((loc) => `<meta property="og:locale:alternate" content="${OG_LOCALES[loc]}" />`)
    .join("\n  ");

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${BASE_URL}/#website`,
        url: `${BASE_URL}/`,
        name: "Antigravity Reset",
        description: pageDescription,
        inLanguage: locale
      },
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: pageTitle,
        description: pageDescription,
        inLanguage: locale,
        isPartOf: { "@id": `${BASE_URL}/#website` },
        ...(lastResetAt ? { dateModified: lastResetAt } : {}),
        about: {
          "@type": "SoftwareApplication",
          name: "Google Antigravity",
          applicationCategory: "DeveloperApplication"
        }
      },
      {
        "@type": "Dataset",
        "@id": `${canonicalUrl}#dataset`,
        name: "Google Antigravity Quota Reset History",
        description: pageDescription,
        url: canonicalUrl,
        inLanguage: locale,
        isAccessibleForFree: true,
        ...(lastResetAt ? { dateModified: lastResetAt } : {}),
        distribution: [
          {
            "@type": "DataDownload",
            encodingFormat: "application/json",
            contentUrl: `${BASE_URL}/api/resets?locale=${encodeURIComponent(locale)}`
          },
          {
            "@type": "DataDownload",
            encodingFormat: "application/rss+xml",
            contentUrl: `${BASE_URL}/feed.xml`
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": `${canonicalUrl}#faq`,
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer
          }
        }))
      }
    ]
  });

  const clientI18n = JSON.stringify(getClientI18nBundle(locale)).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="${escapeHtml(locale)}" data-theme-scope="site">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#fff4dd" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(pageDescription)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Antigravity Reset" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(pageDescription)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:image" content="${BASE_URL}/og-image.png?v=1" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content="${escapeHtml(t("Antigravity Reset quota tracker"))}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
  <meta name="twitter:image" content="${BASE_URL}/og-image.png?v=1" />
  <meta name="twitter:image:alt" content="${escapeHtml(t("Antigravity Reset quota tracker"))}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="icon" href="/antigravity-avatar.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preload" as="font" type="font/woff2" href="/fonts/baloo2-latin.woff2" crossorigin />
  <link rel="stylesheet" href="/styles.css?v=2" />
  ${hreflangLinks}
  <link rel="alternate" type="text/markdown" title="Markdown" href="${escapeHtml(mdUrl)}" />
  <link rel="alternate" type="application/rss+xml" title="Antigravity Reset RSS" href="${BASE_URL}/feed.xml" />
  <meta property="og:locale" content="${OG_LOCALES[locale]}" />
  ${ogAlternates}
  <script type="application/ld+json">${jsonLd}</script>
  ${renderThemeHeadScript()}
</head>
<body>
  <div id="app" data-locale="${escapeHtml(locale)}">
    <div class="page">
      ${renderMasthead(locale, true)}
      <main>
        <section class="hero" aria-label="${escapeHtml(t("Current status"))}">
          <p class="hero-explainer">
            ${t("We watch {account} for Antigravity reset announcements, so you don't have to.", {
              account: `<a href="https://x.com/_mohansolo" target="_blank" rel="noopener noreferrer">@_mohansolo</a>`
            })}
          </p>

          <div class="hero-toolbar">
            <div class="subscription-actions" role="group" aria-label="${escapeHtml(t("Reset notifications"))}">
              <div class="push-control" data-role="push-control" hidden>
                <button class="subscription-action push-toggle" type="button" data-role="push-toggle" aria-pressed="false" aria-describedby="push-hint" title="${escapeHtml(
                  t("Get browser notifications when Antigravity resets")
                )}">
                  <svg class="push-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                  </svg>
                  <span data-role="push-label">${escapeHtml(t("browser"))}</span>
                </button>
                <span class="push-hint" id="push-hint" data-role="push-hint" aria-live="polite"></span>
              </div>
              <a class="subscription-action rss-link" data-role="rss-link" href="/feed.xml" target="_blank" rel="noopener noreferrer" title="${escapeHtml(
                t("Subscribe via RSS feed")
              )}">
                <svg class="rss-link-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
                  <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
                </svg>
                <span>RSS</span>
              </a>
              <button class="subscription-action email-toggle" type="button" data-role="email-toggle" aria-expanded="false" aria-controls="email-subscribe-form" aria-describedby="email-hint" title="${escapeHtml(
                t("Get reset alerts by email")
              )}">
                <svg class="email-toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 5h18v14H3zM3 6l9 7 9-7" />
                </svg>
                <span data-role="email-label">${escapeHtml(t("email"))}</span>
              </button>
            </div>
            <div class="time-setting" data-role="time-setting" role="group" aria-label="${escapeHtml(
              t("Time display")
            )}" hidden>
              <button class="time-toggle" type="button" data-time-mode="mohan" aria-pressed="false">${escapeHtml(
                t("Mohan time")
              )}</button>
              <button class="time-toggle" type="button" data-time-mode="local" aria-pressed="true">${escapeHtml(
                t("Local time")
              )}</button>
              <div class="time-setting-active" aria-hidden="true">
                <span class="time-toggle-copy">${escapeHtml(t("Mohan time"))}</span>
                <span class="time-toggle-copy">${escapeHtml(t("Local time"))}</span>
              </div>
              <button class="time-switch" type="button" data-role="time-switch" aria-label="${escapeHtml(
                `${t("Local time")}. ${t("Switch to Mohan time")}`
              )}">
                <span data-role="time-switch-label">${escapeHtml(t("Local time"))}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4" /></svg>
              </button>
            </div>
            <form class="email-subscribe-form" id="email-subscribe-form" data-role="email-form" hidden>
              <label class="visually-hidden" for="reset-email">${escapeHtml(t("Email address"))}</label>
              <input class="email-input" id="reset-email" data-role="email-input" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="you@example.com" aria-describedby="email-hint" required />
              <button class="subscription-action email-submit" data-role="email-submit" type="submit">${escapeHtml(
                t("send link")
              )}</button>
            </form>
            <p class="email-hint" id="email-hint" data-role="email-hint" aria-live="polite" hidden></p>
          </div>

          <div class="hero-card">
            <span class="hero-label">${escapeHtml(t("Latest Antigravity reset"))}</span>
            ${heroFigure}
            <div class="hero-footer">
              ${heroSub}
              <section class="reset-plea" data-role="reset-plea" data-mode="${mode}" data-reset-at="${escapeHtml(
                lastResetAt ?? ""
              )}" data-cycle-id="${escapeHtml(cycleId)}" data-since="${escapeHtml(
                lastResetAt ?? ""
              )}" data-count="${reactionCount === null ? "" : String(reactionCount)}" aria-label="${escapeHtml(
                t("Reset reactions")
              )}">
                <div class="reset-plea-action">
                  <button class="reset-plea-button" type="button" data-role="reset-plea-button" aria-label="${escapeHtml(
                    reactionTitle
                  )}" title="${escapeHtml(reactionTitle)}">
                    <span class="reset-plea-button-emoji" aria-hidden="true">🙏</span>
                    <span class="reset-plea-button-label" data-role="reset-plea-label">${escapeHtml(
                      t(mode)
                    )}</span>
                    <span class="reset-plea-count-slot">
                      <span class="reset-plea-count reset-plea-count-sizer t-digit-group" aria-hidden="true">${renderDigitSpans(
                        reactionCount ?? 128,
                        locale
                      )}</span>
                      <span class="reset-plea-count t-digit-group" data-role="reset-plea-count" role="status" aria-live="polite" aria-atomic="true" aria-label="${escapeHtml(
                        reactionCount === null
                          ? t("Reset reaction count unavailable")
                          : t("{count} reactions since last reset", { count: reactionCount })
                      )}">${renderDigitSpans(reactionCount, locale)}</span>
                    </span>
                  </button>
                  <span class="reset-plea-bursts" data-role="reset-plea-bursts" aria-hidden="true"></span>
                </div>
              </section>
            </div>
          </div>

          <dl class="stat-row">
            <div class="stat-tile stat-tile--sun">
              <dt><span class="stat-label-full">${escapeHtml(t("Resets"))}</span><span class="stat-label-short">${escapeHtml(
                t("Resets")
              )}</span></dt>
              <dd class="mono">${escapeHtml(formatNumber(stats.total, locale))}</dd>
            </div>
            <div class="stat-tile stat-tile--rose">
              <dt><span class="stat-label-full">${escapeHtml(
                t("Avg. reset interval")
              )}</span><span class="stat-label-short">${escapeHtml(t("Avg. wait"))}</span></dt>
              <dd class="mono">${escapeHtml(formatDays(stats.avg_interval_days, locale))}</dd>
            </div>
            <div class="stat-tile stat-tile--sky">
              <dt><span class="stat-label-full">${escapeHtml(
                t("Longest wait")
              )}</span><span class="stat-label-short">${escapeHtml(t("Longest wait"))}</span></dt>
              <dd class="mono">${escapeHtml(formatDays(stats.longest_wait_days, locale))}</dd>
            </div>
          </dl>
        </section>

        ${renderContributionGraph(events, locale, nowMs)}
        ${renderEventLog(events, locale, nowMs)}
        ${renderFaqSection(locale, faqItems)}
      </main>
      ${renderFooter(locale, effectiveSyncAt)}
    </div>
  </div>
  <script>window.__ANTIGRAVITY_I18N__=${clientI18n};window.__ANTIGRAVITY_LOCALE__=${JSON.stringify(
    locale
  )};</script>
  <script defer src="/site-shell.js?v=2"></script>
  <script defer src="/app.js?v=2"></script>
</body>
</html>`;
}
