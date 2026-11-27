---
name: antigravity-reset
description: Check the latest Google Antigravity quota reset status, announcement history, average reset intervals, and localized summaries via the zero-auth Antigravity Reset MCP server, OpenAPI, JSON API, RSS feed, or Markdown endpoints.
---

# Antigravity Reset Skill

Use this skill when a user asks whether **Google Antigravity** recently reset user quotas (Gemini, Argon, Carbon, Hydrogen, or all models), wants historical reset intervals, or needs a machine-readable feed of `@_mohansolo` reset announcements.

- **Homepage**: https://antigravityreset.app
- **Official MCP Registry**: `app.antigravityreset/antigravity-reset`
- **API Docs**: https://antigravityreset.app/api/docs
- **OpenAPI 3.1**: https://antigravityreset.app/openapi.json
- **Hosted Skill**: https://antigravityreset.app/SKILL.md
- **llms.txt**: https://antigravityreset.app/llms.txt

## Option 1: Remote Streamable HTTP MCP (No Auth Required)

Connect directly to `https://antigravityreset.app/mcp`:

```json
{
  "mcpServers": {
    "antigravity-reset": {
      "type": "streamable-http",
      "url": "https://antigravityreset.app/mcp"
    }
  }
}
```

Available read-only MCP tools:
- `get_latest_reset` (`locale?`: `en` | `zh-CN` | `zh-TW` | `ja` | `ko`)
- `list_resets` (`locale?`, `model?`, `reset_type?`: `regular` | `all`, `limit?`)
- `search_resets` (`query`, `locale?`)
- `get_reset_stats`

## Option 2: Direct HTTP Endpoints (No API Key Required)

- **Latest JSON + stats**: `GET https://antigravityreset.app/api/resets?locale=en` (replace `locale` with `zh-CN`, `zh-TW`, `ja`, or `ko`)
- **Single reset event + interval**: `GET https://antigravityreset.app/api/resets/{id}?locale=en`
- **Permanent event page**: `https://antigravityreset.app/resets/{id}`
- **OpenAPI 3.1 spec**: `GET https://antigravityreset.app/openapi.json`
- **Markdown summary**: `GET https://antigravityreset.app/en.md` or `GET https://antigravityreset.app/zh-CN.md`
- **RSS 2.0 feed**: `GET https://antigravityreset.app/feed.xml`
- **Live SVG status badge**: `GET https://antigravityreset.app/badge.svg`
