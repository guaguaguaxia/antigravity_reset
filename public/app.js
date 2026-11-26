(() => {
  const I18N = window.__ANTIGRAVITY_I18N__ || {};
  const LOCALE = window.__ANTIGRAVITY_LOCALE__ || document.documentElement.lang || "en";
  const TIME_MODE_KEY = "antigravity-reset-time-mode";
  const PUSH_OPT_IN_KEY = "antigravity-reset-browser-notify";
  const MOHAN_TIMEZONE = "America/Los_Angeles";
  const DAY_MS = 86_400_000;

  function t(key, params = {}) {
    const template = I18N[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, token) =>
      token in params ? String(params[token]) : `{${token}}`
    );
  }

  function formatRelative(targetMs, nowMs, skipWeeks = false) {
    if (!Number.isFinite(targetMs) || !Number.isFinite(nowMs)) return "—";
    const diffSec = Math.round((targetMs - nowMs) / 1000);
    const absSec = Math.abs(diffSec);
    if (absSec < 45) return t("just now");

    const rtf =
      typeof Intl !== "undefined" && Intl.RelativeTimeFormat
        ? new Intl.RelativeTimeFormat(LOCALE, { numeric: "always" })
        : null;

    const units = [
      ["year", 31_536_000],
      ["month", 2_592_000],
      ["week", 604_800],
      ["day", 86_400],
      ["hour", 3_600],
      ["minute", 60]
    ];

    for (const [unit, unitSec] of units) {
      if (skipWeeks && unit === "week") continue;
      if (absSec >= unitSec || unit === "minute") {
        const value = Math.round(diffSec / unitSec);
        if (rtf) return rtf.format(value, unit);
        const label = Math.abs(value) === 1 ? unit : `${unit}s`;
        return diffSec < 0 ? `${Math.abs(value)} ${label} ago` : `in ${Math.abs(value)} ${label}`;
      }
    }
    return t("just now");
  }

  function formatUtcTitle(ms) {
    if (!Number.isFinite(ms)) return t("Date unavailable");
    return `${new Intl.DateTimeFormat(LOCALE, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC"
    }).format(ms)} UTC`;
  }

  function createTimeFormatter(mode) {
    const timeZone = mode === "mohan" ? MOHAN_TIMEZONE : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fmt = new Intl.DateTimeFormat(LOCALE, {
      timeZone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    const fmtWeekday = new Intl.DateTimeFormat(LOCALE, {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    return {
      absolute(ms, weekday = false) {
        const formatter = weekday ? fmtWeekday : fmt;
        if (LOCALE !== "en") return formatter.format(ms);
        const parts = formatter.formatToParts(ms);
        const part = (type) => parts.find((p) => p.type === type)?.value ?? "";
        const hourIdx = parts.findIndex((p) => p.type === "hour");
        const timePart = parts.slice(hourIdx).map((p) => p.value).join("");
        return `${weekday ? `${part("weekday")}, ` : ""}${part("month")} ${part("day")}, ${timePart}`;
      }
    };
  }

  const STICKER_SVGS = {
    sleep: `<path d="M4 8h5l-5 6h5M13 5h4l-4 4.5h4M15 14.5h4l-4 4.5h4" />`,
    coffee: `<path d="M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-4ZM16 11.5h1.5a2.5 2.5 0 0 1 0 5H16M9 3.5c-1 1.2 1 2 0 3.5M13 3.5c-1 1.2 1 2 0 3.5" />`,
    work: `<path d="M5 6h14v9H5zM3 18.5h18M10.5 8.5 8.5 10.5l2 2M13.5 8.5l2 2-2 2" />`,
    lunch: `<path d="M3 17.5a9 9 0 0 1 18 0ZM6 11.5c1 1 2-.6 3 .2s2-.8 3 0 2-.8 3 0 2-.6 3 .2" />`,
    sunset: `<path d="M3 16.5h18M7 16.5a5 5 0 0 1 10 0M12 6.5v2.5M5.5 9.8l1.6 1.6M18.5 9.8l-1.6 1.6M8 20h8" />`,
    late: `<path d="M18.5 14.5A7.5 7.5 0 0 1 9.5 5.5a7.5 7.5 0 1 0 9 9Z" /><path class="masthead-sticker-fill" d="M18 3.5l.7 1.8 1.8.7-1.8.7L18 8.5l-.7-1.8-1.8-.7 1.8-.7Z" />`,
    weekend: `<path d="M2.5 10.5h19" /><path class="masthead-sticker-fill" d="M4 10.5h6.5v2a3 3 0 0 1-3 3h-.5a3 3 0 0 1-3-3v-2ZM13.5 10.5H20v2a3 3 0 0 1-3 3h-.5a3 3 0 0 1-3-3v-2Z" />`
  };

  const STICKER_COPY = {
    sleep: "Mohan is probably asleep. Let him dream of quota resets.",
    coffee: "Coffee first. Resets later.",
    work: "Mohan is probably shipping Antigravity right now.",
    lunch: "Lunch break. The quotas can wait.",
    sunset: "Golden hour in California.",
    late: "Late night. Just one more deploy…",
    weekend: "It's the weekend. Even Mohan touches grass."
  };

  const mohanHourFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: MOHAN_TIMEZONE,
    hour: "numeric",
    hourCycle: "h23",
    weekday: "short"
  });
  const mohanClockFmt = new Intl.DateTimeFormat(LOCALE, {
    timeZone: MOHAN_TIMEZONE,
    hour: "numeric",
    minute: "2-digit"
  });

  function getMohanSlot(nowMs) {
    const parts = Object.fromEntries(mohanHourFmt.formatToParts(nowMs).map((p) => [p.type, p.value]));
    const hour = Number(parts.hour) % 24;
    if (hour < 6) return "sleep";
    if (hour >= 22) return "late";
    if ((parts.weekday === "Sat" || parts.weekday === "Sun") && hour >= 9) return "weekend";
    if (hour < 9) return "coffee";
    if (hour === 12) return "lunch";
    if (hour < 18) return "work";
    return "sunset";
  }

  let stickerTimer;
  function updateMohanSticker(scope, mode, animate = false) {
    const sticker = scope.querySelector('[data-role="mohan-sticker"]');
    const tip = scope.querySelector('[data-role="mohan-sticker-tip"]');
    window.clearTimeout(stickerTimer);
    if (!sticker || !tip) return;

    if (!sticker.dataset.wired) {
      sticker.dataset.wired = "1";
      const touchQuery = window.matchMedia?.("(hover: none)");
      sticker.addEventListener("click", () => {
        if (touchQuery?.matches) sticker.classList.toggle("is-open");
      });
      document.addEventListener("click", (e) => {
        if (e.target !== sticker && !sticker.contains(e.target)) {
          sticker.classList.remove("is-open");
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") sticker.classList.remove("is-open");
      });
    }

    sticker.dataset.motion = animate ? "animated" : "instant";
    if (mode !== "mohan") {
      sticker.dataset.state = "off";
      sticker.classList.remove("is-open");
      sticker.removeAttribute("tabindex");
      sticker.removeAttribute("role");
      sticker.removeAttribute("aria-label");
      sticker.setAttribute("aria-hidden", "true");
      return;
    }

    function refreshSticker() {
      if (!sticker.isConnected) return;
      const now = Date.now();
      const slot = getMohanSlot(now);
      if (sticker.dataset.slot !== slot) {
        sticker.dataset.slot = slot;
        sticker.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${STICKER_SVGS[slot]}</svg>`;
      }
      const timeLine = t("{time} for Mohan", { time: mohanClockFmt.format(now) });
      const msgLine = t(STICKER_COPY[slot]);
      tip.innerHTML = "<strong></strong><span></span>";
      tip.firstElementChild.textContent = timeLine;
      tip.lastElementChild.textContent = msgLine;
      sticker.setAttribute("aria-label", `${timeLine}. ${msgLine}`);
      stickerTimer = window.setTimeout(refreshSticker, 60_000 - (now % 60_000));
    }

    refreshSticker();
    sticker.dataset.state = "on";
    sticker.tabIndex = 0;
    sticker.setAttribute("role", "img");
    sticker.removeAttribute("aria-hidden");
  }

  function enhanceTimeSetting(scope) {
    const bar = scope.querySelector('[data-role="time-setting"]');
    if (!bar) return;

    let mode = "local";
    try {
      if (window.localStorage.getItem(TIME_MODE_KEY) === "mohan") {
        mode = "mohan";
      }
    } catch {}

    const formatters = {
      mohan: createTimeFormatter("mohan"),
      local: createTimeFormatter("local")
    };
    const buttons = bar.querySelectorAll("[data-time-mode]");
    const mobileSwitch = bar.querySelector('[data-role="time-switch"]');
    const mobileLabel = bar.querySelector('[data-role="time-switch-label"]');
    let tickTimer;

    function updateDisplayedTimes() {
      const now = Date.now();
      const activeFmt = formatters[mode];
      scope.querySelectorAll('[data-role="relative-time"]').forEach((el) => {
        const dt = el.getAttribute("data-datetime");
        if (!dt) return;
        const ms = Date.parse(dt);
        if (!Number.isFinite(ms)) return;
        const text = formatRelative(ms, now, el.hasAttribute("data-skip-weeks"));
        if (el.textContent !== text) el.textContent = text;
        el.title = formatUtcTitle(ms);
      });

      scope.querySelectorAll('[data-role="absolute-time"]').forEach((el) => {
        const dt = el.getAttribute("data-datetime");
        if (!dt) return;
        const ms = Date.parse(dt);
        if (!Number.isFinite(ms)) return;
        el.textContent = activeFmt.absolute(ms, false);
        el.title = formatUtcTitle(ms);
      });
    }

    function refreshTitles() {
      window.clearTimeout(tickTimer);
      if (!bar.isConnected) return;
      const now = Date.now();
      buttons.forEach((btn) => {
        btn.title = formatters[btn.dataset.timeMode].absolute(now, true);
      });
      updateDisplayedTimes();
      if (!document.hidden) {
        tickTimer = window.setTimeout(refreshTitles, 60_000 - (now % 60_000));
      }
    }

    function applyMode(nextMode, animate = false) {
      mode = nextMode;
      updateMohanSticker(scope, mode, animate);
      buttons.forEach((btn) => {
        btn.setAttribute("aria-pressed", String(btn.dataset.timeMode === mode));
      });
      const currentLabel = t(mode === "local" ? "Local time" : "Mohan time");
      const switchLabel = t(mode === "local" ? "Switch to Mohan time" : "Switch to local time");
      if (mobileLabel) mobileLabel.textContent = currentLabel;
      if (mobileSwitch) {
        mobileSwitch.setAttribute("aria-label", `${currentLabel}. ${switchLabel}`);
        mobileSwitch.title = switchLabel;
      }
      refreshTitles();
    }

    function setMode(nextMode) {
      if ((nextMode !== "local" && nextMode !== "mohan") || nextMode === mode) return;
      try {
        window.localStorage.setItem(TIME_MODE_KEY, nextMode);
      } catch {}
      applyMode(nextMode, true);
    }

    bar.addEventListener("pointerenter", refreshTitles);
    bar.addEventListener("focusin", refreshTitles);
    document.addEventListener("visibilitychange", refreshTitles);
    bar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-time-mode]");
      if (!btn) return;
      bar.dataset.timeMotion = e.detail === 0 ? "instant" : "animated";
      setMode(btn.dataset.timeMode);
    });
    mobileSwitch?.addEventListener("click", () => {
      setMode(mode === "local" ? "mohan" : "local");
    });

    applyMode(mode, false);
    bar.hidden = false;
  }

  function enhanceTermHints(scope) {
    const hints = scope.querySelectorAll(".term-hint");
    const touchQuery = window.matchMedia?.("(hover: none)");

    function positionTooltip(hint) {
      const tip = hint.querySelector(".term-tooltip");
      if (!tip || !tip.textContent?.trim()) return;
      tip.style.removeProperty("--term-tooltip-shift-x");
      tip.style.removeProperty("--term-tooltip-arrow-left");
      const rect = tip.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      let shift = 0;
      if (rect.left < 12) shift = 12 - rect.left;
      else if (rect.right > vw - 12) shift = vw - 12 - rect.right;
      if (shift === 0) return;
      const arrowLeft = Math.max(12, Math.min(42 - shift, tip.offsetWidth - 12));
      tip.style.setProperty("--term-tooltip-shift-x", `${shift}px`);
      tip.style.setProperty("--term-tooltip-arrow-left", `${arrowLeft}px`);
    }

    hints.forEach((hint) => {
      hint.addEventListener("mouseenter", () => positionTooltip(hint));
      hint.addEventListener("focus", () => positionTooltip(hint));
      hint.addEventListener("pointerdown", () => positionTooltip(hint));
      hint.addEventListener("click", () => {
        if (!touchQuery?.matches) return;
        const willOpen = !hint.classList.contains("is-open");
        hints.forEach((item) => item.classList.remove("is-open"));
        if (willOpen) {
          hint.classList.add("is-open");
          positionTooltip(hint);
        }
      });
    });

    document.addEventListener("click", (e) => {
      if (e.target instanceof Element && !e.target.closest(".term-hint")) {
        hints.forEach((item) => item.classList.remove("is-open"));
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hints.forEach((item) => item.classList.remove("is-open"));
    });
  }

  function enhanceHeatmap(scope) {
    const tooltip = scope.querySelector("#cg-tooltip");
    const container = scope.querySelector(".cg-container");
    if (!tooltip || !container) return;

    const noResetMessages = [
      t("No reset. We persevered."),
      t("No reset. He was busy."),
      t("No reset. The feed was quiet."),
      t("No reset. We refreshed anyway."),
      t("No reset. Character-building day.")
    ];

    function pickNoResetCopy(dateStr) {
      let hash = 0;
      for (let i = 0; i < dateStr.length; i += 1) {
        hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
      }
      return noResetMessages[Math.abs(hash) % noResetMessages.length];
    }

    function formatUtcDate(dateStr) {
      const date = new Date(`${dateStr}T00:00:00Z`);
      return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeZone: "UTC" }).format(date);
    }

    function escapeInline(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function showTooltip(cell) {
      const count = Number(cell.getAttribute("data-count") || "0");
      const dateStr = cell.getAttribute("data-date") || "";
      const snippet = cell.getAttribute("data-snippet") || "";
      const resetType = cell.getAttribute("data-reset-type");
      const models = cell.getAttribute("data-models") || "";

      const typeLabel =
        resetType === "all"
          ? t("All-model / multi-model reset")
          : resetType === "regular"
            ? t("Gemini quota reset")
            : "";
      const subLine =
        count === 0
          ? pickNoResetCopy(dateStr)
          : count > 1
            ? t("{count} resets in one day. Feast.", { count })
            : "";

      tooltip.innerHTML =
        `<strong>${escapeInline(formatUtcDate(dateStr))}</strong> (UTC)` +
        (typeLabel ? `<br>${escapeInline(typeLabel)}` : "") +
        (models ? ` · ${escapeInline(models)}` : "") +
        (subLine ? `<br>${escapeInline(subLine)}` : "") +
        (snippet
          ? `<br><span class="cg-tooltip-snippet">${escapeInline(snippet)}${
              snippet.length >= 120 ? "…" : ""
            }</span>`
          : "");
      tooltip.hidden = false;

      const cellRect = cell.getBoundingClientRect();
      const boxRect = container.getBoundingClientRect();
      const tipWidth = tooltip.offsetWidth;
      const half = tipWidth / 2;
      const centerX = cellRect.left - boxRect.left + cellRect.width / 2;
      const left = Math.max(half, Math.min(centerX, boxRect.width - half));
      const arrowLeft = Math.max(8, Math.min(half + centerX - left, tipWidth - 8));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${cellRect.top - boxRect.top}px`;
      tooltip.style.setProperty("--cg-tooltip-arrow-left", `${arrowLeft}px`);
    }

    function hideTooltip() {
      tooltip.hidden = true;
    }

    scope.querySelectorAll(".cg-cell[data-date]").forEach((cell) => {
      cell.addEventListener("mouseenter", () => showTooltip(cell));
      cell.addEventListener("focus", () => showTooltip(cell));
      cell.addEventListener("mouseleave", hideTooltip);
      cell.addEventListener("blur", hideTooltip);
    });
  }

  function enhanceReactions(scope) {
    const root = scope.querySelector('[data-role="reset-plea"]');
    const button = scope.querySelector('[data-role="reset-plea-button"]');
    const labelEl = scope.querySelector('[data-role="reset-plea-label"]');
    const countEl = scope.querySelector('[data-role="reset-plea-count"]');
    const burstsEl = scope.querySelector('[data-role="reset-plea-bursts"]');
    if (!root || !button || !labelEl || !countEl || !burstsEl) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const numFormat = new Intl.NumberFormat(LOCALE);
    let currentCount = /^\d+$/.test(root.dataset.count || "") ? Number(root.dataset.count) : null;
    let pendingClicks = 0;
    let flushTimer;
    let pressTimer;
    let modeTimer;

    function syncMode() {
      window.clearTimeout(modeTimer);
      const resetAt = Date.parse(root.dataset.resetAt || "");
      const remaining = Number.isFinite(resetAt) && resetAt <= Date.now() ? resetAt + DAY_MS - Date.now() : 0;
      const mode = remaining > 0 ? "thanks" : "beg";
      root.dataset.mode = mode;
      labelEl.textContent = t(mode);
      const title = t(mode === "thanks" ? "Say thanks for the reset" : "Beg for a reset");
      button.setAttribute("aria-label", title);
      button.title = title;
      if (remaining > 0) {
        modeTimer = window.setTimeout(syncMode, Math.min(remaining + 50, 2_147_483_647));
      }
    }

    function renderCount(nextCount, animate = true) {
      const width = Number.parseFloat(getComputedStyle(countEl).width);
      if (width > 0) countEl.style.minWidth = `${width}px`;
      const formatted = nextCount === null ? "—" : numFormat.format(nextCount);
      const chars = Array.from(formatted);
      const existing = Array.from(countEl.children);
      const shouldAnimate = animate && !reducedMotion?.matches;

      function makeSpan(ch, pop) {
        const span = document.createElement("span");
        span.className = "t-digit";
        span.textContent = ch;
        if (pop && shouldAnimate) span.classList.add("is-changing");
        return span;
      }

      if (existing.length === chars.length) {
        chars.forEach((ch, idx) => {
          if (existing[idx]?.textContent !== ch) {
            existing[idx].replaceWith(makeSpan(ch, true));
          }
        });
      } else {
        countEl.replaceChildren(...chars.map((ch) => makeSpan(ch, true)));
      }
      countEl.setAttribute(
        "aria-label",
        nextCount === null
          ? t("Reset reaction count unavailable")
          : t("{count} reactions since last reset", { count: nextCount })
      );
    }

    function applyState(payload, animate = true) {
      if (!payload || !Number.isSafeInteger(payload.count) || payload.count < 0) return;
      if (currentCount !== payload.count) {
        currentCount = payload.count;
        root.dataset.count = String(payload.count);
        renderCount(payload.count, animate);
      }
    }

    function spawnBurst() {
      if (reducedMotion?.matches) return;
      const choices =
        root.dataset.mode === "thanks"
          ? ["+1", "🙏", t("thx"), "🧡", "avatar", "avatar"]
          : ["+1", "🙏", t("pls"), "🔄", "avatar", "avatar"];
      const pick = choices[Math.floor(Math.random() * choices.length)];
      const el = document.createElement("span");
      const isAvatar = pick === "avatar";
      el.className = "reset-plea-burst";
      if (isAvatar) {
        el.classList.add("reset-plea-burst--avatar");
        const img = document.createElement("img");
        img.className = "reset-plea-burst-avatar";
        img.src = "/antigravity-avatar.svg";
        img.alt = "";
        img.decoding = "async";
        img.draggable = false;
        el.appendChild(img);
      } else {
        el.textContent = pick;
      }
      el.style.setProperty("--burst-x", `${Math.round(Math.random() * 64 - 48)}px`);
      el.style.setProperty("--burst-y", `${-58 - Math.round(Math.random() * 42)}px`);
      el.style.setProperty("--burst-rotate", `${Math.round(Math.random() * 28 - 14)}deg`);
      el.style.setProperty(
        "--burst-size",
        `${isAvatar ? 38 + Math.round(Math.random() * 4) : 18 + Math.round(Math.random() * 6)}px`
      );
      burstsEl.appendChild(el);
      while (burstsEl.childElementCount > 12) {
        burstsEl.firstElementChild?.remove();
      }
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }

    async function fetchReactions() {
      try {
        const res = await fetch("/api/reset-requests", {
          headers: { Accept: "application/json" },
          cache: "no-store"
        });
        if (!res.ok) return;
        applyState(await res.json(), true);
      } catch {}
    }

    async function flushClicks() {
      flushTimer = undefined;
      const n = pendingClicks;
      pendingClicks = 0;
      if (n < 1) return;
      try {
        const res = await fetch("/api/reset-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ n })
        });
        if (!res.ok) return;
        applyState(await res.json(), true);
      } catch {}
    }

    button.addEventListener("click", () => {
      try {
        navigator.vibrate?.(14);
      } catch {}
      window.clearTimeout(pressTimer);
      button.classList.remove("is-pleading");
      void button.offsetHeight;
      button.classList.add("is-pleading");
      pressTimer = window.setTimeout(() => button.classList.remove("is-pleading"), 280);
      spawnBurst();

      if (currentCount !== null) {
        applyState({ count: currentCount + 1 }, true);
      }
      pendingClicks += 1;
      if (pendingClicks >= 10) {
        window.clearTimeout(flushTimer);
        void flushClicks();
        return;
      }
      if (!flushTimer) {
        flushTimer = window.setTimeout(() => {
          void flushClicks();
        }, 120);
      }
    });

    syncMode();
    if (currentCount !== null) renderCount(currentCount, false);
    void fetchReactions();
    window.setInterval(() => {
      if (!document.hidden) void fetchReactions();
    }, 20_000);
  }

  function enhanceBrowserNotifications(scope) {
    const control = scope.querySelector('[data-role="push-control"]');
    const button = scope.querySelector('[data-role="push-toggle"]');
    const label = scope.querySelector('[data-role="push-label"]');
    const hint = scope.querySelector('[data-role="push-hint"]');
    if (!control || !button || !label || !hint || !("Notification" in window)) return;

    control.hidden = false;
    let enabled = false;
    try {
      enabled =
        Notification.permission === "granted" &&
        window.localStorage.getItem(PUSH_OPT_IN_KEY) === "1";
    } catch {}

    let hintTimer;
    function setHint(text, timeoutMs = 5000) {
      window.clearTimeout(hintTimer);
      hint.textContent = text;
      if (text) {
        hintTimer = window.setTimeout(() => {
          hint.textContent = "";
        }, timeoutMs);
      }
    }

    function syncButton() {
      button.setAttribute("aria-pressed", String(enabled));
      label.textContent = t(enabled ? "browser on" : "browser");
      button.title = t(
        enabled
          ? "Stop browser notifications for Antigravity resets"
          : "Get browser notifications when Antigravity resets"
      );
    }

    let lastKnownAt =
      scope.querySelector('[data-role="reset-plea"]')?.dataset.resetAt || "";

    async function checkForNewReset() {
      if (!enabled || Notification.permission !== "granted") return;
      try {
        const res = await fetch(`/api/resets?locale=${encodeURIComponent(LOCALE)}`, {
          cache: "no-store"
        });
        if (!res.ok) return;
        const data = await res.json();
        const latest = data?.events?.[0];
        if (latest && latest.announced_at && latest.announced_at !== lastKnownAt) {
          lastKnownAt = latest.announced_at;
          new Notification("Antigravity Reset", {
            body: latest.display_text || latest.text,
            icon: "/antigravity-avatar.svg"
          });
        }
      } catch {}
    }

    button.addEventListener("click", async () => {
      button.disabled = true;
      setHint("");
      try {
        if (enabled) {
          enabled = false;
          try {
            window.localStorage.removeItem(PUSH_OPT_IN_KEY);
          } catch {}
          syncButton();
          setHint(t("Okay. You'll find out like everyone else."));
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setHint(t("No ping for you: notifications are blocked here."));
          return;
        }
        enabled = true;
        try {
          window.localStorage.setItem(PUSH_OPT_IN_KEY, "1");
        } catch {}
        syncButton();
        setHint(t("Deal. The next reset pings you first."), 3500);
      } catch {
        setHint(t("That didn't take. Please try again."));
      } finally {
        button.disabled = false;
      }
    });

    syncButton();
    window.setInterval(() => {
      if (!document.hidden) void checkForNewReset();
    }, 60_000);
  }

  function enhanceEmailSubscription(scope) {
    const toggle = scope.querySelector('[data-role="email-toggle"]');
    const form = scope.querySelector('[data-role="email-form"]');
    const input = scope.querySelector('[data-role="email-input"]');
    const submit = scope.querySelector('[data-role="email-submit"]');
    const label = scope.querySelector('[data-role="email-label"]');
    const hint = scope.querySelector('[data-role="email-hint"]');
    if (!toggle || !form || !input || !submit || !label || !hint) return;

    function setOpen(open) {
      form.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      if (open && !hint.textContent) input.focus();
    }

    function setHint(text, state = "info") {
      hint.textContent = text;
      hint.hidden = !text;
      hint.dataset.state = state;
    }

    toggle.addEventListener("click", () => {
      if (toggle.dataset.state === "confirmed") return;
      setOpen(form.hidden);
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;

      input.disabled = true;
      submit.disabled = true;
      const originalText = submit.textContent;
      submit.textContent = t("sending…");
      setHint("");

      try {
        const res = await fetch("/api/email/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email: input.value })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        input.value = "";
        setOpen(false);
        toggle.dataset.state = "confirmed";
        toggle.disabled = true;
        label.textContent = t("email on");
        setHint(
          t("You're on the list. We'll notify you when new Antigravity resets land."),
          "success"
        );
      } catch (err) {
        const msg =
          err instanceof Error && err.message === "Enter a valid email address"
            ? t("Enter a valid email address")
            : t("That didn't send. Please try again.");
        setHint(msg, "error");
      } finally {
        input.disabled = false;
        submit.disabled = false;
        submit.textContent = originalText;
      }
    });
  }

  function boot() {
    const scope = document.getElementById("app") || document;
    window.antigravityTheme?.sync(scope);
    window.antigravityShell?.enhance(scope);
    enhanceTimeSetting(scope);
    enhanceTermHints(scope);
    enhanceHeatmap(scope);
    enhanceReactions(scope);
    enhanceBrowserNotifications(scope);
    enhanceEmailSubscription(scope);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
