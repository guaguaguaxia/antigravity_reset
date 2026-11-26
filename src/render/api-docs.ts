import type { Locale } from "../i18n";
import { renderFooter, renderMasthead, renderThemeHeadScript } from "./html";

const BASE_URL = "https://antigravityreset.app";

export function renderApiDocsPage(locale: Locale = "en"): string {
  const title = "API Docs — Antigravity Reset Public API";
  const description =
    "Free public JSON API, RSS feed, and Markdown endpoints for Google Antigravity quota reset history and statistics. No API key required.";

  return `<!doctype html>
<html lang="${locale}" data-theme-scope="site">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#fff4dd" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="index,follow" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Antigravity Reset" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${BASE_URL}/api/docs" />
  <meta property="og:image" content="${BASE_URL}/og-image.png?v=2" />
  <meta property="og:image:type" content="image/png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${BASE_URL}/og-image.png?v=2" />
  <link rel="canonical" href="${BASE_URL}/api/docs" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" href="/favicon.ico?v=2" sizes="32x32" />
  <link rel="icon" href="/mohan-avatar.png?v=1" type="image/png" sizes="256x256" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
  <link rel="preload" as="font" type="font/woff2" href="/fonts/baloo2-latin.woff2" crossorigin />
  <link rel="stylesheet" href="/styles.css?v=3" />
  ${renderThemeHeadScript()}
  <script defer src="https://www.pvuv.ai/f.js" data-site="kKrRBmM4" data-api="https://in.pvuv.ai"></script>
</head>
<body>
  <div class="page">
    ${renderMasthead(locale, false)}
    <main>
      <div class="docs-attribution" role="note">
        <strong>Free to use — please link back.</strong>
        This API is free to use and needs no key. In return, please credit
        <a href="${BASE_URL}/">antigravityreset.app</a> with a link wherever you display this data, e.g.
        <code>Data from &lt;a href="${BASE_URL}/"&gt;Antigravity Reset&lt;/a&gt;</code>
      </div>

      <section class="docs-card">
        <h1>Antigravity Reset Public API</h1>
        <p>Free, no API key required. Designed for dashboards, bots, and future crawler integrations.</p>

        <h2>1. Fetch Reset History &amp; Stats</h2>
        <pre class="docs-endpoint">GET /api/resets?locale=zh-CN</pre>
        <p>Supported <code>locale</code> values: <code>en</code>, <code>zh-CN</code>, <code>zh-TW</code>, <code>ja</code>, <code>ko</code>.</p>

        <h2>2. RSS Feed &amp; Markdown</h2>
        <pre class="docs-endpoint">GET /feed.xml
GET /zh-CN.md</pre>

        <h2>3. Reactions Counter</h2>
        <pre class="docs-endpoint">GET /api/reset-requests
POST /api/reset-requests  {"n": 1}</pre>

        <h2>4. Crawler / Sync Ingestion Endpoint</h2>
        <pre class="docs-endpoint">POST /api/admin/resets
Authorization: Bearer &lt;ADMIN_TOKEN&gt;
Content-Type: application/json

{
  "events": [ ... ],
  "monitor": { "state": "live", "lastCheckAt": "...", "lastSuccessAt": "...", "intervalSeconds": 240 }
}</pre>
        <p>Events pushed here are validated and merged into Cloudflare KV (<code>ANTIGRAVITY_KV</code>) without needing a redeploy.</p>

        <h2 id="mcp">5. Model Context Protocol (MCP) Server</h2>
        <p>Zero-auth remote Streamable HTTP MCP endpoint for Claude, Cursor, Windsurf, VS Code, and Antigravity clients:</p>
        <pre class="docs-endpoint">POST https://antigravityreset.app/mcp</pre>
        <p>Available read-only tools: <code>get_latest_reset</code>, <code>list_resets</code>, <code>search_resets</code>, <code>get_reset_stats</code>.</p>
        <pre class="docs-endpoint">{
  "mcpServers": {
    "antigravity-reset": {
      "type": "streamable-http",
      "url": "https://antigravityreset.app/mcp"
    }
  }
}</pre>
      </section>
    </main>
    ${renderFooter(locale)}
  </div>
  <script defer src="/site-shell.js?v=2"></script>
</body>
</html>`;
}
