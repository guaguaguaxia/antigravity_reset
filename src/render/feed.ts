import type { ResetPayload } from "../data/repository";
import type { Locale } from "../i18n";
import { escapeHtml } from "./html";

const BASE_URL = "https://antigravityreset.app";

export function renderRssFeed(payload: ResetPayload, locale: Locale = "en"): string {
  const selfUrl = locale === "en" ? `${BASE_URL}/feed.xml` : `${BASE_URL}/feed.xml?locale=${encodeURIComponent(locale)}`;
  const items = payload.events
    .map((ev) => {
      const models = ev.models.length > 0 ? ev.models.join(", ") : "All Models";
      const title = `Antigravity Reset (${models}) — ${ev.announced_at.slice(0, 10)}`;
      const pubDate = new Date(Date.parse(ev.announced_at)).toUTCString();
      const description = `${ev.display_text}\n\nOriginal post on X: ${ev.source_url}`;
      return `    <item>
      <title>${escapeHtml(title)}</title>
      <link>${escapeHtml(ev.permalink)}</link>
      <guid isPermaLink="true">${escapeHtml(ev.permalink)}</guid>
      <pubDate>${escapeHtml(pubDate)}</pubDate>
      <description>${escapeHtml(description)}</description>
    </item>`;
    })
    .join("\n");

  const lastBuild = payload.stats.last_reset_at
    ? new Date(Date.parse(payload.stats.last_reset_at)).toUTCString()
    : new Date().toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Antigravity Reset</title>
    <link>${BASE_URL}/</link>
    <atom:link href="${escapeHtml(selfUrl)}" rel="self" type="application/rss+xml" />
    <description>Track the latest Antigravity quota resets from @_mohansolo.</description>
    <language>${escapeHtml(locale)}</language>
    <lastBuildDate>${escapeHtml(lastBuild)}</lastBuildDate>
${items}
  </channel>
</rss>`;
}
