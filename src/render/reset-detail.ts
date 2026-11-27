import {
  LOCALES,
  OG_LOCALES,
  apiDocsPath,
  createTranslator,
  localePath,
  resetDetailPath,
  type Locale
} from "../i18n";
import type { ResetPayload } from "../data/repository";
import {
  escapeHtml,
  formatRelative,
  formatUtcTime,
  renderFooter,
  renderMasthead,
  renderThemeHeadScript
} from "./html";

const BASE_URL = "https://antigravityreset.app";
const DAY_MS = 86_400_000;

export interface ResetDetailRenderOptions {
  locale: Locale;
  payload: ResetPayload;
  eventIndex: number;
  nowMs?: number;
}

export function renderResetDetailPage({
  locale,
  payload,
  eventIndex,
  nowMs = Date.now()
}: ResetDetailRenderOptions): string {
  const t = createTranslator(locale);
  const event = payload.events[eventIndex];
  if (!event) {
    throw new Error(`Invalid eventIndex ${eventIndex}`);
  }

  const previousEvent = payload.events[eventIndex + 1] ?? null;
  const nextEvent = eventIndex > 0 ? payload.events[eventIndex - 1] ?? null : null;
  const langPathBuilder = (loc: Locale) => resetDetailPath(event.id, loc);

  const isAllScope = event.reset_type === "all";
  const scopeTitle = isAllScope ? t("All-model / multi-model reset") : t("Gemini quota reset");
  const dateShort = event.announced_at.slice(0, 10);
  const canonicalPath = resetDetailPath(event.id, locale);
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const homeUrl = `${BASE_URL}${localePath(locale)}`;
  const mdUrl = locale === "en" ? `${BASE_URL}/en.md` : `${BASE_URL}${localePath(locale)}.md`;

  let intervalText = t("First tracked reset");
  if (previousEvent) {
    const diffMs = Date.parse(event.announced_at) - Date.parse(previousEvent.announced_at);
    if (Number.isFinite(diffMs) && diffMs >= 0) {
      intervalText = t("{days}d", { days: (diffMs / DAY_MS).toFixed(1) });
    }
  }

  const pageTitle = t("Antigravity Reset — {scope} ({date})", {
    scope: scopeTitle,
    date: dateShort
  });
  const pageDescription = t(
    "Verified Google Antigravity {scope} announced on {date} by @_mohansolo. View full announcement, interval stats, and open API data.",
    { scope: scopeTitle, date: dateShort }
  );

  const hreflangLinks = [
    ...LOCALES.map(
      (loc) => `<link rel="alternate" hreflang="${loc}" href="${BASE_URL}${resetDetailPath(event.id, loc)}" />`
    ),
    `<link rel="alternate" hreflang="x-default" href="${BASE_URL}${resetDetailPath(event.id, "en")}" />`
  ].join("\n  ");

  const ogAlternates = LOCALES.filter((loc) => loc !== locale)
    .map((loc) => `<meta property="og:locale:alternate" content="${OG_LOCALES[loc]}" />`)
    .join("\n  ");

  const models = event.models.length > 0 ? event.models : [t("All Models")];
  const modelsHtml = models
    .map(
      (model) =>
        `<span class="log-model-tag${event.models.length === 0 ? " log-model-tag--all" : ""}">${escapeHtml(
          model
        )}</span>`
    )
    .join("");

  const showOriginalBlock = locale !== "en" && event.display_text.trim() !== event.text.trim();
  const relativeText = formatRelative(Date.parse(event.announced_at), nowMs, locale);
  const utcText = formatUtcTime(event.announced_at, locale);

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: t("Home"),
            item: homeUrl
          },
          {
            "@type": "ListItem",
            position: 2,
            name: `${scopeTitle} (${dateShort})`,
            item: canonicalUrl
          }
        ]
      },
      {
        "@type": "Article",
        headline: pageTitle,
        description: pageDescription,
        datePublished: event.announced_at,
        dateModified: event.announced_at,
        inLanguage: locale,
        mainEntityOfPage: canonicalUrl,
        isBasedOn: event.source_url,
        author: {
          "@type": "Person",
          name: `@${event.author}`,
          url: `https://x.com/${encodeURIComponent(event.author)}`
        },
        publisher: {
          "@type": "Organization",
          name: "Antigravity Reset",
          url: `${BASE_URL}/`
        }
      }
    ]
  });

  const pagerHtml =
    previousEvent || nextEvent
      ? `
      <nav class="detail-pager" aria-label="${escapeHtml(t("Reset details"))}">
        ${
          previousEvent
            ? `<a class="detail-pager-card" href="${escapeHtml(resetDetailPath(previousEvent.id, locale))}">
                <span class="detail-pager-dir">&larr; ${escapeHtml(t("Previous reset"))}</span>
                <strong class="detail-pager-date">${escapeHtml(previousEvent.announced_at.slice(0, 10))}</strong>
                <span class="detail-pager-snippet">${escapeHtml(previousEvent.display_text.slice(0, 72))}${
                  previousEvent.display_text.length > 72 ? "…" : ""
                }</span>
              </a>`
            : `<span class="detail-pager-spacer" aria-hidden="true"></span>`
        }
        ${
          nextEvent
            ? `<a class="detail-pager-card detail-pager-card--next" href="${escapeHtml(
                resetDetailPath(nextEvent.id, locale)
              )}">
                <span class="detail-pager-dir">${escapeHtml(t("Next reset"))} &rarr;</span>
                <strong class="detail-pager-date">${escapeHtml(nextEvent.announced_at.slice(0, 10))}</strong>
                <span class="detail-pager-snippet">${escapeHtml(nextEvent.display_text.slice(0, 72))}${
                  nextEvent.display_text.length > 72 ? "…" : ""
                }</span>
              </a>`
            : `<span class="detail-pager-spacer" aria-hidden="true"></span>`
        }
      </nav>`
      : "";

  return `<!doctype html>
<html lang="${escapeHtml(locale)}" data-theme-scope="site">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#fff4dd" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(pageDescription)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta property="og:type" content="article" />
  <meta property="article:published_time" content="${escapeHtml(event.announced_at)}" />
  <meta property="og:site_name" content="Antigravity Reset" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(pageDescription)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:image" content="${BASE_URL}/og-image.png?v=2" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content="${escapeHtml(t("Antigravity Reset quota tracker"))}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
  <meta name="twitter:image" content="${BASE_URL}/og-image.png?v=2" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" href="/favicon.ico?v=2" sizes="32x32" />
  <link rel="icon" href="/mohan-avatar.png?v=1" type="image/png" sizes="256x256" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
  <link rel="preload" as="font" type="font/woff2" href="/fonts/baloo2-latin.woff2" crossorigin />
  <link rel="stylesheet" href="/styles.css?v=4" />
  ${hreflangLinks}
  <link rel="alternate" type="text/markdown" title="Markdown" href="${escapeHtml(mdUrl)}" />
  <link rel="alternate" type="application/rss+xml" title="Antigravity Reset RSS" href="${BASE_URL}/feed.xml" />
  <meta property="og:locale" content="${OG_LOCALES[locale]}" />
  ${ogAlternates}
  <script type="application/ld+json">${jsonLd}</script>
  ${renderThemeHeadScript()}
  <script defer src="https://www.pvuv.ai/f.js" data-site="kKrRBmM4" data-api="https://in.pvuv.ai"></script>
</head>
<body>
  <div class="page">
    ${renderMasthead(locale, false, langPathBuilder)}
    <main>
      <nav class="detail-breadcrumb" aria-label="Breadcrumb">
        <a href="${escapeHtml(localePath(locale))}">${escapeHtml(t("Home"))}</a>
        <span aria-hidden="true">/</span>
        <span>${escapeHtml(t("Reset #{id}", { id: dateShort }))}</span>
      </nav>

      <article class="detail-card">
        <div class="detail-head">
          <div class="detail-badges">
            <span class="log-item-time">${escapeHtml(relativeText)}</span>
            <span class="log-model-tag${isAllScope ? " log-model-tag--all" : ""}">${escapeHtml(scopeTitle)}</span>
            ${
              event.verified
                ? `<span class="detail-verified-badge">${escapeHtml(t("Verified"))}</span>`
                : ""
            }
          </div>
          <h1>${escapeHtml(scopeTitle)} · ${escapeHtml(dateShort)}</h1>
        </div>

        <dl class="detail-meta-grid">
          <div class="detail-meta-cell">
            <dt>${escapeHtml(t("Announced (UTC)"))}</dt>
            <dd class="mono"><time datetime="${escapeHtml(event.announced_at)}">${escapeHtml(utcText)}</time></dd>
          </div>
          <div class="detail-meta-cell">
            <dt>${escapeHtml(t("Affected models"))}</dt>
            <dd><span class="detail-meta-tags">${modelsHtml}</span></dd>
          </div>
          <div class="detail-meta-cell">
            <dt>${escapeHtml(t("Interval since previous reset"))}</dt>
            <dd class="mono">${escapeHtml(intervalText)}</dd>
          </div>
          <div class="detail-meta-cell">
            <dt>${escapeHtml(t("Source post"))}</dt>
            <dd class="mono"><a href="${escapeHtml(event.source_url)}" target="_blank" rel="noopener noreferrer">@${escapeHtml(
              event.author
            )} (X)</a></dd>
          </div>
        </dl>

        <section aria-label="${escapeHtml(t("Official announcement"))}">
          <h2 class="detail-section-label">${escapeHtml(t("Official announcement"))}</h2>
          <blockquote class="detail-quote">${escapeHtml(event.display_text)}</blockquote>
        </section>

        ${
          showOriginalBlock
            ? `<section class="detail-original" aria-label="${escapeHtml(t("Original English announcement"))}">
                <h2 class="detail-section-label">${escapeHtml(t("Original English announcement"))}</h2>
                <p class="detail-original-text">${escapeHtml(event.text)}</p>
              </section>`
            : ""
        }

        <div class="detail-actions">
          <a class="subscription-action detail-action-primary" href="${escapeHtml(localePath(locale))}">&larr; ${escapeHtml(
            t("Back to all resets")
          )}</a>
          <a class="subscription-action" href="${escapeHtml(
            event.source_url
          )}" target="_blank" rel="noopener noreferrer">${t("View on X &rarr;")}</a>
          <a class="subscription-action" href="/api/resets/${encodeURIComponent(event.id)}?locale=${encodeURIComponent(
            locale
          )}">JSON API</a>
          <a class="subscription-action" href="${escapeHtml(apiDocsPath(locale))}#badges">${escapeHtml(
            t("API & Embed")
          )}</a>
        </div>
      </article>

      ${pagerHtml}
    </main>
    ${renderFooter(locale, undefined, langPathBuilder)}
  </div>
  <script defer src="/site-shell.js?v=3"></script>
</body>
</html>`;
}
