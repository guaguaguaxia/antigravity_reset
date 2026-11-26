import type { Locale } from "../i18n";
import { renderFooter, renderMasthead, renderThemeHeadScript } from "./html";

export function renderApiDocsPage(locale: Locale = "en"): string {
  return `<!doctype html>
<html lang="${locale}" data-theme-scope="site">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#fff4dd" />
  <title>API Docs | Antigravity Reset</title>
  <link rel="icon" href="/antigravity-avatar.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=M+PLUS+Rounded+1c:wght@700;800&display=swap" />
  <link rel="stylesheet" href="/styles.css" />
  ${renderThemeHeadScript()}
</head>
<body>
  <div class="page">
    ${renderMasthead(locale, false)}
    <main>
      <section class="docs-card">
        <h2>Antigravity Reset Public API</h2>
        <p>Free, no API key required. Designed for dashboards, bots, and future crawler integrations.</p>

        <h3>1. Fetch Reset History &amp; Stats</h3>
        <pre class="docs-endpoint">GET /api/resets?locale=zh-CN</pre>
        <p>Supported <code>locale</code> values: <code>en</code>, <code>zh-CN</code>, <code>zh-TW</code>, <code>ja</code>, <code>ko</code>.</p>

        <h3>2. RSS Feed &amp; Markdown</h3>
        <pre class="docs-endpoint">GET /feed.xml
GET /zh-CN.md</pre>

        <h3>3. Reactions Counter</h3>
        <pre class="docs-endpoint">GET /api/reset-requests
POST /api/reset-requests  {"n": 1}</pre>

        <h3>4. Crawler / Sync Ingestion Endpoint</h3>
        <pre class="docs-endpoint">POST /api/admin/resets
Authorization: Bearer &lt;ADMIN_TOKEN&gt;
Content-Type: application/json

{
  "events": [ ... ],
  "monitor": { "state": "live", "lastCheckAt": "...", "lastSuccessAt": "...", "intervalSeconds": 240 }
}</pre>
        <p>Events pushed here are validated and merged into Cloudflare KV (<code>ANTIGRAVITY_KV</code>) without needing a redeploy.</p>
      </section>
    </main>
    ${renderFooter(locale)}
  </div>
  <script src="/site-shell.js"></script>
</body>
</html>`;
}
