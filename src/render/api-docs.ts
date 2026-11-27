import { LOCALES, OG_LOCALES, apiDocsPath, type Locale } from "../i18n";
import { escapeHtml, renderFooter, renderMasthead, renderThemeHeadScript } from "./html";

const BASE_URL = "https://antigravityreset.app";

interface DocsCopy {
  title: string;
  description: string;
  attributionStrong: string;
  attributionLead: string;
  attributionMid: string;
  h1: string;
  intro: string;
  sec1: string;
  localesNote: string;
  sec2: string;
  sec3: string;
  sec4: string;
  sec5: string;
  ingestNote: string;
  sec6: string;
  mcpIntro: string;
  mcpTools: string;
  sec7: string;
  badgesIntro: string;
  badgePreviewLabel: string;
}

const DOCS_COPY: Record<Locale, DocsCopy> = {
  en: {
    title: "API Docs — Antigravity Reset Public API",
    description:
      "Free public JSON API, OpenAPI 3.1 spec, RSS feed, Markdown endpoints, dynamic SVG badge, and zero-auth remote MCP server for Google Antigravity quota reset history.",
    attributionStrong: "Free to use — please link back.",
    attributionLead: "This API is free to use and needs no key. In return, please credit ",
    attributionMid: " with a link wherever you display this data, e.g. ",
    h1: "Antigravity Reset Public API",
    intro:
      "Free, CORS-enabled, no API key required. Designed for status dashboards, bots, IDE plugins, and AI agents.",
    sec1: "1. Reset History & Single-Event API",
    localesNote: "Supported <code>locale</code> values: <code>en</code>, <code>zh-CN</code>, <code>zh-TW</code>, <code>ja</code>, <code>ko</code>.",
    sec2: "2. OpenAPI 3.1 Specification",
    sec3: "3. RSS Feed, Markdown, Agent Skill & llms.txt",
    sec4: "4. Reactions Counter",
    sec5: "5. Crawler / Sync Ingestion Endpoint",
    ingestNote:
      "Events pushed here are validated and merged into Cloudflare KV (<code>ANTIGRAVITY_KV</code>) without needing a redeploy.",
    sec6: "6. Model Context Protocol (MCP) Server",
    mcpIntro:
      "Zero-auth remote Streamable HTTP MCP endpoint for Claude, Cursor, Windsurf, VS Code, and Antigravity clients:",
    mcpTools:
      "Available read-only tools: <code>get_latest_reset</code>, <code>list_resets</code>, <code>search_resets</code>, <code>get_reset_stats</code>.",
    sec7: "7. Attribution & Live Status Badges",
    badgesIntro:
      "Using our free API, RSS feed, or MCP server in your tracker, blog, or README? Embed the live SVG status badge or copy an attribution link below:",
    badgePreviewLabel: "Live SVG badge preview:"
  },
  "zh-CN": {
    title: "公开 API 与集成文档 — Antigravity Reset",
    description:
      "免费免 Key 的 Google Antigravity 额度重置公开 JSON API、OpenAPI 3.1 文档、RSS 订阅、Markdown 摘要、动态 SVG 徽章与零鉴权远程 MCP 服务。",
    attributionStrong: "免费开源使用 — 欢迎保留署名回链。",
    attributionLead: "所有读取接口均免费开放且无需 API Key。若你在工具站、看板或文章中展示本数据，请在页面中回链 ",
    attributionMid: "，例如：",
    h1: "Antigravity Reset 公开 API 文档",
    intro: "完全免费、已开启 CORS、无需 API Key，方便状态监控站、机器人、编辑器插件与 AI Agent 直接接入。",
    sec1: "1. 重置历史与单条事件详情接口",
    localesNote: "支持的 <code>locale</code> 参数：<code>en</code>、<code>zh-CN</code>、<code>zh-TW</code>、<code>ja</code>、<code>ko</code>。",
    sec2: "2. OpenAPI 3.1 规范",
    sec3: "3. RSS 订阅、Markdown、Agent Skill 与 llms.txt",
    sec4: "4. 互动计数器",
    sec5: "5. 同步写入接口（需管理员密钥）",
    ingestNote: "推送到此接口的数据会经过校验并实时写入 Cloudflare KV（<code>ANTIGRAVITY_KV</code>），无需重新部署。",
    sec6: "6. 免鉴权远程 MCP 服务（Model Context Protocol）",
    mcpIntro: "支持 Claude、Cursor、Windsurf、VS Code 与 Antigravity 客户端直接连接远程 Streamable HTTP MCP：",
    mcpTools:
      "内置只读工具：<code>get_latest_reset</code>、<code>list_resets</code>、<code>search_resets</code>、<code>get_reset_stats</code>。",
    sec7: "7. 署名回链与实时 SVG 状态徽章",
    badgesIntro: "如果你在项目 README、博客或导航站接入了本站 API、RSS 或 MCP，欢迎直接嵌入实时状态徽章或添加署名链接：",
    badgePreviewLabel: "实时状态徽章预览："
  },
  "zh-TW": {
    title: "公開 API 與整合文件 — Antigravity Reset",
    description:
      "免費免金鑰的 Google Antigravity 額度重置公開 JSON API、OpenAPI 3.1 規範、RSS 訂閱、Markdown 摘要、動態 SVG 徽章與零驗證遠端 MCP 服務。",
    attributionStrong: "免費開源使用 — 歡迎保留署名回連。",
    attributionLead: "所有讀取端點皆免費開放且無需 API Key。若你在看板或文章中引用本資料，請加上連結指向 ",
    attributionMid: "，例如：",
    h1: "Antigravity Reset 公開 API 文件",
    intro: "完全免費、已開啟 CORS、無需 API Key，適合監控面板、機器人、編輯器擴充與 AI Agent 串接。",
    sec1: "1. 重置歷史與單筆事件詳情 API",
    localesNote: "支援的 <code>locale</code> 參數：<code>en</code>、<code>zh-CN</code>、<code>zh-TW</code>、<code>ja</code>、<code>ko</code>。",
    sec2: "2. OpenAPI 3.1 規範",
    sec3: "3. RSS 訂閱、Markdown、Agent Skill 與 llms.txt",
    sec4: "4. 互動計數器",
    sec5: "5. 同步寫入端點（需管理員權杖）",
    ingestNote: "推送至此端點的資料會經驗證並即時合併至 Cloudflare KV（<code>ANTIGRAVITY_KV</code>）。",
    sec6: "6. 免驗證遠端 MCP 服務（Model Context Protocol）",
    mcpIntro: "支援 Claude、Cursor、Windsurf、VS Code 與 Antigravity 客戶端直接連線 Streamable HTTP MCP：",
    mcpTools:
      "提供唯讀工具：<code>get_latest_reset</code>、<code>list_resets</code>、<code>search_resets</code>、<code>get_reset_stats</code>。",
    sec7: "7. 署名回連與即時 SVG 狀態徽章",
    badgesIntro: "若你在專案 README、部落格或工具站使用本站資料，歡迎嵌入即時 SVG 狀態徽章或加上署名連結：",
    badgePreviewLabel: "即時狀態徽章預覽："
  },
  ja: {
    title: "公開 API ドキュメント — Antigravity Reset",
    description:
      "認証不要・無料の Google Antigravity クォータリセット公開 JSON API、OpenAPI 3.1、RSS、Markdown、動的 SVG バッジ、リモート MCP サーバーのドキュメント。",
    attributionStrong: "無料で利用可能 — クレジットリンクにご協力ください。",
    attributionLead: "この API は認証キー不要・無料で利用できます。データを表示する場合は ",
    attributionMid: " へのリンクを記載してください：",
    h1: "Antigravity Reset 公開 API",
    intro: "CORS 対応・認証キー不要の無料公開エンドポイントです。ダッシュボードや Bot、AI エージェントからそのまま利用できます。",
    sec1: "1. リセット履歴・個別イベント API",
    localesNote: "対応 <code>locale</code>: <code>en</code>, <code>zh-CN</code>, <code>zh-TW</code>, <code>ja</code>, <code>ko</code>。",
    sec2: "2. OpenAPI 3.1 仕様",
    sec3: "3. RSS フィード・Markdown・Agent Skill・llms.txt",
    sec4: "4. リアクションカウンター",
    sec5: "5. クローラー同期エンドポイント",
    ingestNote: "送信されたイベントは検証後、再デプロイなしで Cloudflare KV（<code>ANTIGRAVITY_KV</code>）に保存されます。",
    sec6: "6. 認証不要リモート MCP サーバー",
    mcpIntro: "Claude、Cursor、Windsurf、VS Code、Antigravity から Streamable HTTP で直接接続できます：",
    mcpTools:
      "読み取り専用ツール: <code>get_latest_reset</code>, <code>list_resets</code>, <code>search_resets</code>, <code>get_reset_stats</code>。",
    sec7: "7. クレジット表記とライブ SVG ステータスバッジ",
    badgesIntro: "README や記事、ダッシュボードに最新のクォータリセット状況を埋め込めます：",
    badgePreviewLabel: "ライブバッジのプレビュー："
  },
  ko: {
    title: "공개 API 문서 — Antigravity Reset",
    description:
      "무료·무인증 Google Antigravity 쿼터 리셋 공개 JSON API, OpenAPI 3.1, RSS 피드, Markdown 요약, 실시간 SVG 배지 및 원격 MCP 서버 안내.",
    attributionStrong: "무료로 사용 가능 — 출처 링크를 남겨주세요.",
    attributionLead: "이 API는 별도 키 없이 무료로 사용할 수 있습니다. 데이터를 표시할 때 ",
    attributionMid: " 링크를 함께 표시해 주세요:",
    h1: "Antigravity Reset 공개 API",
    intro: "CORS 지원 및 인증 키 없이 바로 호출할 수 있는 무료 엔드포인트입니다. 대시보드, 봇, AI 에이전트 연동에 적합합니다.",
    sec1: "1. 리셋 기록 및 단일 이벤트 API",
    localesNote: "지원 <code>locale</code>: <code>en</code>, <code>zh-CN</code>, <code>zh-TW</code>, <code>ja</code>, <code>ko</code>.",
    sec2: "2. OpenAPI 3.1 명세",
    sec3: "3. RSS 피드 · Markdown · Agent Skill · llms.txt",
    sec4: "4. 반응 카운터",
    sec5: "5. 크롤러 / 동기화 수집 엔드포인트",
    ingestNote: "전송된 데이터는 검증 후 재배포 없이 Cloudflare KV(<code>ANTIGRAVITY_KV</code>)에 즉시 반영됩니다.",
    sec6: "6. 무인증 원격 MCP 서버",
    mcpIntro: "Claude, Cursor, Windsurf, VS Code, Antigravity에서 Streamable HTTP로 바로 연결할 수 있습니다:",
    mcpTools:
      "읽기 전용 도구: <code>get_latest_reset</code>, <code>list_resets</code>, <code>search_resets</code>, <code>get_reset_stats</code>.",
    sec7: "7. 출처 표기 및 실시간 SVG 상태 배지",
    badgesIntro: "README, 블로그, 대시보드에 실시간 상태 배지 또는 출처 링크를 손쉽게 추가해 보세요:",
    badgePreviewLabel: "실시간 SVG 배지 미리보기:"
  }
};

export function renderApiDocsPage(locale: Locale = "en"): string {
  const copy = DOCS_COPY[locale] ?? DOCS_COPY.en;
  const canonicalUrl = `${BASE_URL}${apiDocsPath(locale)}`;
  const mdPath = locale === "en" ? "/en.md" : `/${locale}.md`;

  const hreflangLinks = [
    ...LOCALES.map(
      (loc) => `<link rel="alternate" hreflang="${loc}" href="${BASE_URL}${apiDocsPath(loc)}" />`
    ),
    `<link rel="alternate" hreflang="x-default" href="${BASE_URL}/api/docs" />`
  ].join("\n  ");

  const ogAlternates = LOCALES.filter((loc) => loc !== locale)
    .map((loc) => `<meta property="og:locale:alternate" content="${OG_LOCALES[loc]}" />`)
    .join("\n  ");

  return `<!doctype html>
<html lang="${escapeHtml(locale)}" data-theme-scope="site">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#fff4dd" />
  <title>${escapeHtml(copy.title)}</title>
  <meta name="description" content="${escapeHtml(copy.description)}" />
  <meta name="robots" content="index,follow" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Antigravity Reset" />
  <meta property="og:title" content="${escapeHtml(copy.title)}" />
  <meta property="og:description" content="${escapeHtml(copy.description)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:image" content="${BASE_URL}/og-image.png?v=2" />
  <meta property="og:image:type" content="image/png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(copy.title)}" />
  <meta name="twitter:description" content="${escapeHtml(copy.description)}" />
  <meta name="twitter:image" content="${BASE_URL}/og-image.png?v=2" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  ${hreflangLinks}
  <meta property="og:locale" content="${OG_LOCALES[locale]}" />
  ${ogAlternates}
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" href="/favicon.ico?v=2" sizes="32x32" />
  <link rel="icon" href="/mohan-avatar.png?v=1" type="image/png" sizes="256x256" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
  <link rel="preload" as="font" type="font/woff2" href="/fonts/baloo2-latin.woff2" crossorigin />
  <link rel="stylesheet" href="/styles.css?v=4" />
  ${renderThemeHeadScript()}
  <script defer src="https://www.pvuv.ai/f.js" data-site="kKrRBmM4" data-api="https://in.pvuv.ai"></script>
</head>
<body>
  <div class="page">
    ${renderMasthead(locale, false, apiDocsPath)}
    <main>
      <div class="docs-attribution" role="note">
        <strong>${escapeHtml(copy.attributionStrong)}</strong>
        ${escapeHtml(copy.attributionLead)}<a href="${BASE_URL}/">antigravityreset.app</a>${escapeHtml(
          copy.attributionMid
        )}<code>Data from &lt;a href="${BASE_URL}/"&gt;Antigravity Reset&lt;/a&gt;</code>
      </div>

      <section class="docs-card">
        <h1>${escapeHtml(copy.h1)}</h1>
        <p>${escapeHtml(copy.intro)}</p>

        <h2>${escapeHtml(copy.sec1)}</h2>
        <pre class="docs-endpoint">GET /api/resets?locale=${escapeHtml(locale)}
GET /api/resets/2125851902009311306?locale=${escapeHtml(locale)}</pre>
        <p>${copy.localesNote}</p>

        <h2>${escapeHtml(copy.sec2)}</h2>
        <pre class="docs-endpoint">GET /openapi.json
GET /openapi/v1/openapi.json</pre>

        <h2>${escapeHtml(copy.sec3)}</h2>
        <pre class="docs-endpoint">GET /feed.xml
GET /feed.xml?locale=${escapeHtml(locale)}
GET ${escapeHtml(mdPath)}
GET /SKILL.md
GET /llms.txt</pre>

        <h2>${escapeHtml(copy.sec4)}</h2>
        <pre class="docs-endpoint">GET /api/reset-requests
POST /api/reset-requests  {"n": 1}</pre>

        <h2>${escapeHtml(copy.sec5)}</h2>
        <pre class="docs-endpoint">POST /api/admin/resets
Authorization: Bearer &lt;ADMIN_TOKEN&gt;
Content-Type: application/json

{
  "events": [ ... ],
  "monitor": { "state": "live", "lastCheckAt": "...", "lastSuccessAt": "...", "intervalSeconds": 240 }
}</pre>
        <p>${copy.ingestNote}</p>

        <h2 id="mcp">${escapeHtml(copy.sec6)}</h2>
        <p>${escapeHtml(copy.mcpIntro)}</p>
        <pre class="docs-endpoint">POST https://antigravityreset.app/mcp</pre>
        <p>${copy.mcpTools}</p>
        <pre class="docs-endpoint">{
  "mcpServers": {
    "antigravity-reset": {
      "type": "streamable-http",
      "url": "https://antigravityreset.app/mcp"
    }
  }
}</pre>

        <h2 id="badges">${escapeHtml(copy.sec7)}</h2>
        <p>${escapeHtml(copy.badgesIntro)}</p>
        <div class="badge-preview">
          <span>${escapeHtml(copy.badgePreviewLabel)}</span>
          <a href="${BASE_URL}/"><img src="/badge.svg" alt="Antigravity Reset Live Status" height="22" /></a>
        </div>
        <pre class="docs-endpoint">[![Antigravity Reset](https://antigravityreset.app/badge.svg)](https://antigravityreset.app/)</pre>
        <pre class="docs-endpoint">&lt;a href="https://antigravityreset.app/"&gt;&lt;img src="https://antigravityreset.app/badge.svg" alt="Antigravity Reset"&gt;&lt;/a&gt;</pre>
        <pre class="docs-endpoint">Data from &lt;a href="https://antigravityreset.app/"&gt;Antigravity Reset&lt;/a&gt;</pre>
      </section>
    </main>
    ${renderFooter(locale, undefined, apiDocsPath)}
  </div>
  <script defer src="/site-shell.js?v=3"></script>
</body>
</html>`;
}
