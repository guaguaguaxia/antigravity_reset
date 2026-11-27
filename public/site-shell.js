(() => {
  function enhanceLanguageMenu(scope) {
    const button = scope.querySelector(".language-toggle");
    const menu = scope.querySelector("#language-menu");
    if (!button || !menu || menu.dataset.enhanced) return;
    menu.dataset.enhanced = "1";

    function positionMenu() {
      const rect = button.getBoundingClientRect();
      const width = Math.min(180, window.innerWidth - 32);
      const left = Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16));
      menu.style.setProperty("--language-menu-left", `${left}px`);
      menu.style.setProperty("--language-menu-top", `${rect.bottom + 8}px`);
    }

    menu.addEventListener("beforetoggle", (event) => {
      if (event.newState === "open") positionMenu();
      button.setAttribute("aria-expanded", String(event.newState === "open"));
    });

    window.addEventListener("resize", () => {
      if (menu.matches(":popover-open")) positionMenu();
    });

    window.addEventListener(
      "scroll",
      () => {
        if (menu.matches(":popover-open")) menu.hidePopover();
      },
      { passive: true }
    );
  }

  const VISITOR_STORAGE_KEY = "antigravity-reset:visitor-id";
  const UUID_RE = /^[0-9a-f-]{16,64}$/i;

  function getVisitorId() {
    try {
      const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
      if (existing && UUID_RE.test(existing)) return existing.toLowerCase();
      const fresh =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random()
              .toString(16)
              .slice(2)}`;
      window.localStorage.setItem(VISITOR_STORAGE_KEY, fresh);
      return fresh;
    } catch {
      return `anon-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
    }
  }

  function enhancePresence(scope) {
    const el = scope.querySelector('[data-role="online-count"]');
    if (!el || el.dataset.enhanced) return;
    el.dataset.enhanced = "1";

    const locale = el.dataset.presenceLocale || "en";
    const formatter = new Intl.NumberFormat(locale);
    const visitorId = getVisitorId();
    let timer;

    function render(state, count) {
      const formatted = typeof count === "number" ? formatter.format(count) : "—";
      const label =
        state === "live"
          ? el.dataset.presenceLive.replace("{count}", formatted)
          : state === "connecting"
            ? el.dataset.presenceConnecting
            : el.dataset.presenceUnavailable;

      el.dataset.state = state;
      el.dataset.ready = "true";
      const countEl = el.querySelector(".masthead-presence-count");
      if (countEl) countEl.textContent = formatted;
      el.setAttribute("aria-label", label);
      el.title = label;
    }

    async function heartbeat() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ visitor: visitorId }),
          cache: "no-store"
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Number.isSafeInteger(data?.count) && data.count >= 1) {
          render("live", data.count);
        }
      } catch {
        render("unavailable", null);
      }
    }

    void heartbeat();
    timer = window.setInterval(() => {
      void heartbeat();
    }, 30_000);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void heartbeat();
      }
    });

    window.addEventListener("pagehide", () => {
      window.clearInterval(timer);
    });
  }

  function enhanceLanguagePersistence(scope) {
    scope.querySelectorAll(".site-footer-langs a[lang], .language-menu a[lang]").forEach((link) => {
      if (link.dataset.langEnhanced) return;
      link.dataset.langEnhanced = "1";
      link.addEventListener("click", () => {
        const lang = link.getAttribute("lang");
        if (!lang) return;
        const secure = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `antigravity-reset-language=${encodeURIComponent(lang)}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
      });
    });
  }

  function enhance(scope = document) {
    enhanceLanguageMenu(scope);
    enhanceLanguagePersistence(scope);
    enhancePresence(scope);
  }

  window.antigravityShell = { enhance };
  enhance(document);
})();
