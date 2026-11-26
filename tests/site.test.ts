import { describe, expect, it } from "vitest";
import rawSeed from "../src/data/resets.json";
import { computeStats, normalizeDataset, validateIngestPayload } from "../src/data/repository";
import { LOCALES } from "../src/i18n";
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
      expect(html).toContain('<script defer src="/site-shell.js?v=2"></script>');
      expect(html).toContain('<script defer src="/app.js?v=3"></script>');
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

  it("handles empty event list safely in computeStats", () => {
    expect(computeStats([])).toEqual({
      total: 0,
      last_reset_at: null,
      avg_interval_days: null,
      longest_wait_days: null
    });
  });
});
