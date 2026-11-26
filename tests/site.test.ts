import { describe, expect, it } from "vitest";
import rawSeed from "../src/data/resets.json";
import { computeStats, normalizeDataset, validateIngestPayload } from "../src/data/repository";
import { LOCALES } from "../src/i18n";
import { renderRssFeed } from "../src/render/feed";
import { renderHomePage } from "../src/render/html";
import { renderMarkdown } from "../src/render/markdown";
import { renderSitemap } from "../src/index";

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

describe("SSR multi-language rendering", () => {
  it("renders all 5 locales with Antigravity Reset branding and zero Codex leftovers", () => {
    const nowMs = Date.parse("2026-11-26T10:15:00.000Z");

    for (const locale of LOCALES) {
      const payload = normalizeDataset(rawSeed, locale);
      const html = renderHomePage({ locale, payload, reactionCount: 42, nowMs });

      expect(html).toContain(`<html lang="${locale}"`);
      expect(html).toContain("Antigravity Reset");
      expect(html).toContain(`hreflang="x-default" href="https://antigravityreset.app/"`);
      expect(html).toContain('data-date="2026-11-26"');
      expect(html).toContain('data-date="2026-10-16"');
      expect(html).toContain('<details class="log-more">');
      expect(html.toLowerCase()).not.toContain("codex");
      expect(html.toLowerCase()).not.toContain("thsottiaux");
    }
  });

  it("renders valid RSS feed and markdown summaries", () => {
    const payload = normalizeDataset(rawSeed, "zh-CN");
    const rss = renderRssFeed(payload);
    expect(rss).toContain("<rss version=\"2.0\"");
    expect(rss).toContain("https://x.com/_mohansolo/status/2125851902009311306");

    const md = renderMarkdown(payload, "zh-CN");
    expect(md).toContain("Antigravity Reset");
    expect(md).toContain("2026-11-26T07:19:24.000Z");
  });

  it("renders valid sitemap.xml with all 5 locales, hreflang, and dataset lastmod", () => {
    const payload = normalizeDataset(rawSeed, "en");
    const xml = renderSitemap(payload.stats.last_reset_at);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain("<loc>https://antigravityreset.app/</loc>");
    expect(xml).toContain("<loc>https://antigravityreset.app/zh-CN</loc>");
    expect(xml).toContain("<loc>https://antigravityreset.app/zh-TW</loc>");
    expect(xml).toContain("<loc>https://antigravityreset.app/ja</loc>");
    expect(xml).toContain("<loc>https://antigravityreset.app/ko</loc>");
    expect(xml).toContain('hreflang="x-default" href="https://antigravityreset.app/"');
    expect(xml).toContain("<lastmod>2026-11-26</lastmod>");
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
