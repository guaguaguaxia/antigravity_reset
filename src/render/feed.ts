import type { ResetPayload } from "../data/repository";
import { escapeHtml } from "./html";

export function renderRssFeed(payload: ResetPayload): string {
  const items = payload.events
    .map((ev) => {
      const models = ev.models.length > 0 ? ev.models.join(", ") : "All Models";
      const title = `Antigravity Reset (${models}) — ${ev.announced_at.slice(0, 10)}`;
      const pubDate = new Date(Date.parse(ev.announced_at)).toUTCString();
      return `    <item>
      <title>${escapeHtml(title)}</title>
      <link>${escapeHtml(ev.source_url)}</link>
      <guid isPermaLink="true">${escapeHtml(ev.source_url)}</guid>
      <pubDate>${escapeHtml(pubDate)}</pubDate>
      <description>${escapeHtml(ev.text)}</description>
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
    <link>https://antigravityreset.app/</link>
    <atom:link href="https://antigravityreset.app/feed.xml" rel="self" type="application/rss+xml" />
    <description>Track the latest Antigravity quota resets from @_mohansolo.</description>
    <language>en</language>
    <lastBuildDate>${escapeHtml(lastBuild)}</lastBuildDate>
${items}
  </channel>
</rss>`;
}
