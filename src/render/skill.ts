import type { ResetPayload } from "../data/repository";

export const SKILL_MARKDOWN = `---
name: antigravity-reset
description: Check the latest Google Antigravity quota reset status, announcement history, average reset intervals, and localized summaries via the zero-auth Antigravity Reset MCP server, OpenAPI, JSON API, RSS feed, or Markdown endpoints.
---

# Antigravity Reset Skill

Use this skill when a user asks whether **Google Antigravity** recently reset user quotas (Gemini, Argon, Carbon, Hydrogen, or all models), wants historical reset intervals, or needs a machine-readable feed of \`@_mohansolo\` reset announcements.

- **Homepage**: https://antigravityreset.app
- **Official MCP Registry**: \`app.antigravityreset/antigravity-reset\`
- **API Docs**: https://antigravityreset.app/api/docs
- **OpenAPI 3.1**: https://antigravityreset.app/openapi.json
- **Hosted Skill**: https://antigravityreset.app/SKILL.md
- **llms.txt**: https://antigravityreset.app/llms.txt

## Option 1: Remote Streamable HTTP MCP (No Auth Required)

Connect directly to \`https://antigravityreset.app/mcp\`:

\`\`\`json
{
  "mcpServers": {
    "antigravity-reset": {
      "type": "streamable-http",
      "url": "https://antigravityreset.app/mcp"
    }
  }
}
\`\`\`

Available read-only MCP tools:
- \`get_latest_reset\` (\`locale?\`: \`en\` | \`zh-CN\` | \`zh-TW\` | \`ja\` | \`ko\`)
- \`list_resets\` (\`locale?\`, \`model?\`, \`reset_type?\`: \`regular\` | \`all\`, \`limit?\`)
- \`search_resets\` (\`query\`, \`locale?\`)
- \`get_reset_stats\`

## Option 2: Direct HTTP Endpoints (No API Key Required)

- **Latest JSON + stats**: \`GET https://antigravityreset.app/api/resets?locale=en\` (replace \`locale\` with \`zh-CN\`, \`zh-TW\`, \`ja\`, or \`ko\`)
- **Single reset event + interval**: \`GET https://antigravityreset.app/api/resets/{id}?locale=en\`
- **Permanent event page**: \`https://antigravityreset.app/resets/{id}\`
- **OpenAPI 3.1 spec**: \`GET https://antigravityreset.app/openapi.json\`
- **Markdown summary**: \`GET https://antigravityreset.app/en.md\` or \`GET https://antigravityreset.app/zh-CN.md\`
- **RSS 2.0 feed**: \`GET https://antigravityreset.app/feed.xml\`
- **Live SVG status badge**: \`GET https://antigravityreset.app/badge.svg\`
`;

export function renderLlmsTxt(payload: ResetPayload): string {
  const lines: string[] = [
    "# Antigravity Reset",
    "",
    "> Live Google Antigravity quota reset tracker, 28-week heatmap, interval analytics, free public JSON API, OpenAPI 3.1 spec, RSS 2.0 feed, Markdown summaries, dynamic SVG badge, and zero-auth remote MCP server tracking @_mohansolo on X.",
    "",
    `- Tracked resets: ${payload.stats.total}`,
    `- Latest reset (UTC): ${payload.stats.last_reset_at ?? "none"}`,
    `- Average interval: ${payload.stats.avg_interval_days !== null ? `${payload.stats.avg_interval_days} days` : "n/a"}`,
    `- Longest wait: ${payload.stats.longest_wait_days !== null ? `${payload.stats.longest_wait_days} days` : "n/a"}`,
    "",
    "## Machine-Readable Endpoints & Docs",
    "",
    "- [Public API & MCP Docs](https://antigravityreset.app/api/docs): Human-readable API, attribution, and MCP integration guide",
    "- [OpenAPI 3.1 Spec](https://antigravityreset.app/openapi.json): Full machine-readable API specification",
    "- [All Resets JSON](https://antigravityreset.app/api/resets?locale=en): Normalized reset history and statistics",
    "- [Remote MCP Endpoint](https://antigravityreset.app/mcp): Zero-auth Streamable HTTP MCP server (app.antigravityreset/antigravity-reset)",
    "- [Agent Skill](https://antigravityreset.app/SKILL.md): Portable SKILL.md for coding agents",
    "- [RSS 2.0 Feed](https://antigravityreset.app/feed.xml): Verified quota reset announcements feed",
    "- [Markdown Summary (EN)](https://antigravityreset.app/en.md): Full English Markdown export",
    "- [Markdown Summary (ZH-CN)](https://antigravityreset.app/zh-CN.md): Full Simplified Chinese Markdown export",
    "- [Live Status Badge](https://antigravityreset.app/badge.svg): Embeddable dynamic SVG badge",
    "",
    "## Tracked Reset Events",
    ""
  ];

  for (const ev of payload.events) {
    const models = ev.models.length > 0 ? ev.models.join(", ") : "All Models";
    const snippet = ev.text.replace(/\s+/g, " ").trim().slice(0, 120);
    lines.push(`- [${ev.announced_at.slice(0, 10)} (${models})](${ev.permalink}): ${snippet}`);
  }

  return `${lines.join("\n")}\n`;
}
