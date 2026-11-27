import { describe, expect, it } from "vitest";
import rawSeed from "../src/data/resets.json";
import { computeStats, normalizeDataset, validateIngestPayload } from "../src/data/repository";
import { LOCALES, matchAcceptLanguage } from "../src/i18n";
import { renderRssFeed } from "../src/render/feed";
import { renderHomePage } from "../src/render/html";
import { renderMarkdown } from "../src/render/markdown";
import { renderApiDocsPage } from "../src/render/api-docs";
import worker, { renderSitemap } from "../src/index";

describe("Antigravity Reset repository and stats", () => {
  it("computes accurate stats from the 7 real @_mohansolo events", () => {
    const payload = normalizeDataset(rawSeed, "en");
    expect(payload.stats.total).toBe(7);
    expect(payload.stats.last_reset_at).toBe("2026-11-26T07:19:24.000Z");
    expect(payload.stats.avg_interval_days).toBe(6.7);
    expect(payload.stats.longest_wait_days).toBe(21.1);
    expect(payload.events[0].id).toBe("2125851902009311306");
    expect(payload.events[0].reset_type).toBe("regular");
    expect(payload.events.find((e) => e.id === "2122836883877347836")?.reset_type).toBe("all");
  });

  it("provides localized display_text for zh-CN while keeping product/model names intact", () => {
    const payload = normalizeDataset(rawSeed, "zh-CN");
    expect(payload.events[0].display_text).toContain("Antigravity");
    expect(payload.events[0].display_text).toContain("Gemini");
    expect(payload.events[0].display_text).toContain("感恩节");
  });

  it("validates crawler ingestion payloads", () => {
    expect(validateIngestPayload(rawSeed).ok).toBe(true);
    expect(validateIngestPayload({ events: [] }).ok).toBe(false);
    expect(validateIngestPayload({ events: [{ id: "bad" }] }).ok).toBe(false);
  });
});

describe("SSR multi-language rendering & SEO", () => {
  it("renders all 5 locales with Antigravity Reset branding, FAQ, JSON-LD @graph, and self-hosted assets", () => {
    const nowMs = Date.parse("2026-11-26T10:15:00.000Z");

    for (const locale of LOCALES) {
      const payload = normalizeDataset(rawSeed, locale);
      const html = renderHomePage({ locale, payload, reactionCount: 42, nowMs });

      expect(html).toContain(`<html lang="${locale}"`);
      expect(html).toContain("Antigravity Reset");
      expect(html).toContain(`hreflang="x-default" href="https://antigravityreset.app/"`);
      expect(html).toContain('property="og:image" content="https://antigravityreset.app/og-image.png?v=2"');
      expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />');
      expect(html).toContain('<link rel="icon" href="/favicon.ico?v=2" sizes="32x32" />');
      expect(html).toContain('<link rel="icon" href="/mohan-avatar.png?v=1" type="image/png" sizes="256x256" />');
      expect(html).not.toContain("antigravity-avatar.svg");
      expect(html).toContain('<link rel="preload" as="font" type="font/woff2" href="/fonts/baloo2-latin.woff2" crossorigin />');
      expect(html).not.toContain("fonts.googleapis.com");
      expect(html).toContain('<script defer src="/site-shell.js?v=3"></script>');
      expect(html).toContain('<script defer src="/app.js?v=3"></script>');
      expect(html).toContain(
        '<script defer src="https://www.pvuv.ai/f.js" data-site="kKrRBmM4" data-api="https://in.pvuv.ai"></script>'
      );
      const footerMatch = html.match(/<nav class="site-footer-langs"[\s\S]*?<\/nav>/);
      expect(footerMatch).toBeTruthy();
      expect(footerMatch![0]).toContain('<a href="/" lang="en" hreflang="en"');
      expect(footerMatch![0]).not.toContain("?lang=en");
      expect(footerMatch![0]).not.toContain('rel="nofollow"');
      expect(html).toContain('<time class="hero-figure" datetime="2026-11-26T07:19:24.000Z"');
      expect(html).toContain('class="faq-section"');
      expect(html).toContain('data-date="2026-11-26"');
      expect(html).toContain('data-date="2026-10-16"');
      expect(html).toContain('<details class="log-more">');
      expect(html.toLowerCase()).not.toContain("codex");
      expect(html.toLowerCase()).not.toContain("thsottiaux");

      const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(ldMatch).toBeTruthy();
      const ld = JSON.parse(ldMatch![1]) as { "@graph": Array<{ "@type": string; sameAs?: unknown }> };
      const types = ld["@graph"].map((node) => node["@type"]);
      expect(types).toEqual(["WebSite", "WebPage", "Dataset", "FAQPage"]);
      expect(ld["@graph"][0].sameAs).toBeUndefined();
    }
  });

  it("renders valid RSS feed, markdown summaries, and SEO-complete API docs", () => {
    const payload = normalizeDataset(rawSeed, "zh-CN");
    const rss = renderRssFeed(payload);
    expect(rss).toContain('<rss version="2.0"');
    expect(rss).toContain("https://x.com/_mohansolo/status/2125851902009311306");

    const md = renderMarkdown(payload, "zh-CN");
    expect(md).toContain("Antigravity Reset");
    expect(md).toContain("2026-11-26T07:19:24.000Z");

    const docsHtml = renderApiDocsPage("en");
    expect(docsHtml).toContain("<h1>Antigravity Reset Public API</h1>");
    expect(docsHtml).toContain('<link rel="canonical" href="https://antigravityreset.app/api/docs" />');
    expect(docsHtml).toContain('<meta name="description"');
    expect(docsHtml).toContain('id="mcp"');
    expect(docsHtml).toContain('id="badges"');
    expect(docsHtml).toContain(
      '<script defer src="https://www.pvuv.ai/f.js" data-site="kKrRBmM4" data-api="https://in.pvuv.ai"></script>'
    );
  });

  it("renders valid sitemap.xml with all 5 locales, /api/docs, hreflang, and dataset lastmod", () => {
    const payload = normalizeDataset(rawSeed, "en");
    const xml = renderSitemap(payload.stats.last_reset_at);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain("<loc>https://antigravityreset.app/</loc>");
    expect(xml).toContain("<loc>https://antigravityreset.app/zh-CN</loc>");
    expect(xml).toContain("<loc>https://antigravityreset.app/zh-TW</loc>");
    expect(xml).toContain("<loc>https://antigravityreset.app/ja</loc>");
    expect(xml).toContain("<loc>https://antigravityreset.app/ko</loc>");
    expect(xml).toContain("<loc>https://antigravityreset.app/api/docs</loc>");
    expect(xml).toContain('hreflang="x-default" href="https://antigravityreset.app/"');
    expect(xml).toContain("<lastmod>2026-11-26</lastmod>");
  });

  it("redirects trailing slash paths and sets public edge Cache-Control on HTML", async () => {
    const dummyEnv = { ASSETS: { fetch: async () => new Response("Not Found", { status: 404 }) } as unknown as Fetcher };

    const slashRes = await worker.fetch(new Request("https://antigravityreset.app/zh-CN/"), dummyEnv);
    expect(slashRes.status).toBe(301);
    expect(slashRes.headers.get("Location")).toBe("https://antigravityreset.app/zh-CN");

    const pageRes = await worker.fetch(new Request("https://antigravityreset.app/zh-CN"), dummyEnv);
    expect(pageRes.status).toBe(200);
    expect(pageRes.headers.get("Cache-Control")).toBe(
      "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
    );
    expect(pageRes.headers.get("Vary")).toBeNull();
  });

  it("matches Accept-Language headers accurately with q weights", () => {
    expect(matchAcceptLanguage("zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh-CN");
    expect(matchAcceptLanguage("zh-HK,zh;q=0.9")).toBe("zh-TW");
    expect(matchAcceptLanguage("zh-Hant,zh;q=0.9")).toBe("zh-TW");
    expect(matchAcceptLanguage("ja-JP,ja;q=0.9,en-US;q=0.8")).toBe("ja");
    expect(matchAcceptLanguage("ko-KR,ko;q=0.9")).toBe("ko");
    expect(matchAcceptLanguage("en-US,en;q=0.9,zh-CN;q=0.8")).toBe("en");
    expect(matchAcceptLanguage("fr-FR,fr;q=0.9,de;q=0.8")).toBeNull();
  });

  it("auto-redirects visitors on / by Accept-Language while respecting cookie, referer, crawlers, and explicit locale routes", async () => {
    const dummyEnv = { ASSETS: { fetch: async () => new Response("Not Found", { status: 404 }) } as unknown as Fetcher };

    const zhRedirect = await worker.fetch(
      new Request("https://antigravityreset.app/", { headers: { "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" } }),
      dummyEnv
    );
    expect(zhRedirect.status).toBe(302);
    expect(zhRedirect.headers.get("Location")).toBe("https://antigravityreset.app/zh-CN");
    expect(zhRedirect.headers.get("Cache-Control")).toBe("private, no-store");
    expect(zhRedirect.headers.get("Vary")).toBe("Accept-Language, Cookie");

    for (const [header, target] of [
      ["ja-JP,ja;q=0.9", "https://antigravityreset.app/ja"],
      ["zh-TW,zh;q=0.9", "https://antigravityreset.app/zh-TW"],
      ["ko-KR,ko;q=0.9", "https://antigravityreset.app/ko"]
    ] as const) {
      const res = await worker.fetch(
        new Request("https://antigravityreset.app/", { headers: { "Accept-Language": header } }),
        dummyEnv
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe(target);
    }

    const cookieEn = await worker.fetch(
      new Request("https://antigravityreset.app/", {
        headers: {
          "Accept-Language": "zh-CN,zh;q=0.9",
          Cookie: "antigravity-reset-language=en"
        }
      }),
      dummyEnv
    );
    expect(cookieEn.status).toBe(200);
    expect(cookieEn.headers.get("Content-Language")).toBe("en");
    expect(cookieEn.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(cookieEn.headers.get("Vary")).toBe("Accept-Language, Cookie");

    const botRes = await worker.fetch(
      new Request("https://antigravityreset.app/", {
        headers: {
          "Accept-Language": "zh-CN,zh;q=0.9",
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
        }
      }),
      dummyEnv
    );
    expect(botRes.status).toBe(200);
    expect(botRes.headers.get("Content-Language")).toBe("en");

    const refererRes = await worker.fetch(
      new Request("https://antigravityreset.app/", {
        headers: {
          "Accept-Language": "zh-CN,zh;q=0.9",
          Referer: "https://antigravityreset.app/zh-CN"
        }
      }),
      dummyEnv
    );
    expect(refererRes.status).toBe(200);
    expect(refererRes.headers.get("Content-Language")).toBe("en");

    const explicitLocale = await worker.fetch(
      new Request("https://antigravityreset.app/zh-CN", {
        headers: { "Accept-Language": "ja-JP,ja;q=0.9" }
      }),
      dummyEnv
    );
    expect(explicitLocale.status).toBe(200);
    expect(explicitLocale.headers.get("Content-Language")).toBe("zh-CN");
  });

  it("handles empty event list safely in computeStats", () => {
    expect(computeStats([])).toEqual({
      total: 0,
      last_reset_at: null,
      avg_interval_days: null,
      longest_wait_days: null
    });
  });

  it("renders permanent per-event detail pages across all 5 locales and returns 404 for unknown IDs", async () => {
    const dummyEnv = { ASSETS: { fetch: async () => new Response("Not Found", { status: 404 }) } as unknown as Fetcher };
    const latestId = "2125851902009311306";
    const previousId = "2124960419429458207";

    for (const locale of LOCALES) {
      const path = locale === "en" ? `/resets/${latestId}` : `/${locale}/resets/${latestId}`;
      const res = await worker.fetch(new Request(`https://antigravityreset.app${path}`), dummyEnv);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Language")).toBe(locale);
      const html = await res.text();
      expect(html).toContain(`<link rel="canonical" href="https://antigravityreset.app${path}" />`);
      expect(html).toContain(`hreflang="x-default" href="https://antigravityreset.app/resets/${latestId}"`);
      expect(html).toContain("2.5");
      expect(html).toContain(previousId);
      expect(html).toContain("https://x.com/_mohansolo/status/2125851902009311306");
      if (locale !== "en") {
        expect(html).toContain("Resetting Gemini quota for all Antigravity users for Thanksgiving!");
      }

      const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(ldMatch).toBeTruthy();
      const ld = JSON.parse(ldMatch![1]) as { "@graph": Array<{ "@type": string }> };
      expect(ld["@graph"].map((n) => n["@type"])).toEqual(["BreadcrumbList", "Article"]);
    }

    const notFoundRes = await worker.fetch(
      new Request("https://antigravityreset.app/resets/does-not-exist"),
      dummyEnv
    );
    expect(notFoundRes.status).toBe(404);
  });

  it("links homepage heatmap/timeline to internal detail pages and routes RSS links on-site", async () => {
    const dummyEnv = { ASSETS: { fetch: async () => new Response("Not Found", { status: 404 }) } as unknown as Fetcher };
    const zhHome = renderHomePage({
      locale: "zh-CN",
      payload: normalizeDataset(rawSeed, "zh-CN"),
      reactionCount: 12,
      nowMs: Date.parse("2026-11-26T10:15:00.000Z")
    });
    expect(zhHome).toContain('href="/zh-CN/resets/2125851902009311306"');

    const rssRes = await worker.fetch(new Request("https://antigravityreset.app/feed.xml?locale=zh-CN"), dummyEnv);
    expect(rssRes.status).toBe(200);
    const rssXml = await rssRes.text();
    expect(rssXml).toContain("<link>https://antigravityreset.app/zh-CN/resets/2125851902009311306</link>");
    expect(rssXml).toContain('<guid isPermaLink="true">https://antigravityreset.app/zh-CN/resets/2125851902009311306</guid>');
    expect(rssXml).toContain("https://x.com/_mohansolo/status/2125851902009311306");
    expect(rssXml).toContain("感恩节");

    const enPayload = normalizeDataset(rawSeed, "en");
    const sitemapXml = renderSitemap(enPayload.stats.last_reset_at, enPayload.events);
    expect(sitemapXml).toContain("<loc>https://antigravityreset.app/resets/2125851902009311306</loc>");
    expect(sitemapXml).toContain("<loc>https://antigravityreset.app/zh-CN/resets/2125851902009311306</loc>");
    expect(sitemapXml).toContain("<loc>https://antigravityreset.app/zh-CN/api/docs</loc>");
  });

  it("serves OpenAPI 3.1, single-event JSON API, hosted SKILL.md, llms.txt, SVG badge, and localized API docs", async () => {
    const dummyEnv = { ASSETS: { fetch: async () => new Response("Not Found", { status: 404 }) } as unknown as Fetcher };

    const singleRes = await worker.fetch(
      new Request("https://antigravityreset.app/api/resets/2125851902009311306?locale=zh-CN"),
      dummyEnv
    );
    expect(singleRes.status).toBe(200);
    const singleJson = (await singleRes.json()) as {
      event: { id: string; permalink: string; display_text: string };
      interval_since_previous_days: number;
      previous_id: string;
      next_id: string | null;
    };
    expect(singleJson.event.id).toBe("2125851902009311306");
    expect(singleJson.event.permalink).toBe("https://antigravityreset.app/zh-CN/resets/2125851902009311306");
    expect(singleJson.event.display_text).toContain("感恩节");
    expect(singleJson.interval_since_previous_days).toBe(2.5);
    expect(singleJson.previous_id).toBe("2124960419429458207");
    expect(singleJson.next_id).toBeNull();

    const missingApiRes = await worker.fetch(
      new Request("https://antigravityreset.app/api/resets/nonexistent"),
      dummyEnv
    );
    expect(missingApiRes.status).toBe(404);

    for (const openApiPath of ["/openapi.json", "/openapi/v1/openapi.json"]) {
      const openApiRes = await worker.fetch(new Request(`https://antigravityreset.app${openApiPath}`), dummyEnv);
      expect(openApiRes.status).toBe(200);
      expect(openApiRes.headers.get("Access-Control-Allow-Origin")).toBe("*");
      const spec = (await openApiRes.json()) as { openapi: string; paths: Record<string, unknown> };
      expect(spec.openapi).toBe("3.1.0");
      expect(spec.paths["/api/resets/{id}"]).toBeTruthy();
      expect(spec.paths["/badge.svg"]).toBeTruthy();
    }

    for (const skillPath of ["/SKILL.md", "/skills/antigravity-reset/SKILL.md"]) {
      const skillRes = await worker.fetch(new Request(`https://antigravityreset.app${skillPath}`), dummyEnv);
      expect(skillRes.status).toBe(200);
      expect(skillRes.headers.get("Content-Type")).toContain("text/markdown");
      const text = await skillRes.text();
      expect(text).toContain("name: antigravity-reset");
      expect(text).toContain("https://antigravityreset.app/openapi.json");
    }

    const llmsRes = await worker.fetch(new Request("https://antigravityreset.app/llms.txt"), dummyEnv);
    expect(llmsRes.status).toBe(200);
    const llmsTxt = await llmsRes.text();
    expect(llmsTxt).toContain("# Antigravity Reset");
    expect(llmsTxt).toContain("https://antigravityreset.app/resets/2125851902009311306");

    const badgeRes = await worker.fetch(
      new Request("https://antigravityreset.app/badge.svg?label=Reset%3CStatus%3E"),
      dummyEnv
    );
    expect(badgeRes.status).toBe(200);
    expect(badgeRes.headers.get("Content-Type")).toContain("image/svg+xml");
    const svg = await badgeRes.text();
    expect(svg).toContain("<svg ");
    expect(svg).toContain("Reset&lt;Status&gt;");
    expect(svg).toContain("Nov 26");

    const zhDocsRes = await worker.fetch(new Request("https://antigravityreset.app/zh-CN/api/docs"), dummyEnv);
    expect(zhDocsRes.status).toBe(200);
    expect(zhDocsRes.headers.get("Content-Language")).toBe("zh-CN");
    const zhDocsHtml = await zhDocsRes.text();
    expect(zhDocsHtml).toContain("Antigravity Reset 公开 API 文档");
    expect(zhDocsHtml).toContain('<link rel="canonical" href="https://antigravityreset.app/zh-CN/api/docs" />');
    expect(zhDocsHtml).toContain('hreflang="ja" href="https://antigravityreset.app/ja/api/docs"');
  });
});
