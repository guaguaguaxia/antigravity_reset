import { loadDataset, normalizeDataset } from "./data/repository";
import {
  LOCALES,
  apiDocsPath,
  localeFromPath,
  localePath,
  matchAcceptLanguage,
  normalizeLocale,
  resetDetailPath,
  type Locale
} from "./i18n";
import { CORS_HEADERS, getReactionCount, handleApiRequest, type WorkerEnv } from "./api/handlers";
import { handleMcpRequest } from "./mcp/server";
import { renderApiDocsPage } from "./render/api-docs";
import { renderStatusBadgeSvg } from "./render/badge";
import { renderRssFeed } from "./render/feed";
import { renderHomePage } from "./render/html";
import { renderMarkdown } from "./render/markdown";
import { renderOpenApiSpec } from "./render/openapi";
import { renderResetDetailPage } from "./render/reset-detail";
import { SKILL_MARKDOWN, renderLlmsTxt } from "./render/skill";

const LANG_COOKIE = "antigravity-reset-language";
const BASE_URL = "https://antigravityreset.app";
const MCP_REGISTRY_AUTH_RECORD = "v=MCPv1; k=ed25519; p=pZGLQ3Lw6ug0u3JGSo12efJmNi3bWnoJt7AbNSNspbQ=";
const CRAWLER_UA_RE =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|twitterbot|linkedinbot|discordbot|slackbot|telegrambot|whatsapp|applebot|duckduckbot|yandex|baiduspider|bytespider|gptbot|claudebot|perplexitybot|google-inspectiontool|lighthouse|pagespeed/i;

function parseLangCookie(cookieHeader: string | null): Locale | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === LANG_COOKIE) {
      return normalizeLocale(decodeURIComponent(rest.join("=")));
    }
  }
  return null;
}

function isLikelyCrawler(userAgent: string | null): boolean {
  return Boolean(userAgent && CRAWLER_UA_RE.test(userAgent));
}

function hasLocalizedSameOriginReferer(request: Request, origin: string): boolean {
  const referer = request.headers.get("Referer");
  if (!referer) return false;
  try {
    const refUrl = new URL(referer);
    if (refUrl.origin !== origin) return false;
    const cleanRefPath = refUrl.pathname.replace(/\/+$/, "") || "/";
    return LOCALES.some((loc) => loc !== "en" && localePath(loc) === cleanRefPath);
  } catch {
    return false;
  }
}

function buildHreflangs(pathForLocale: (loc: Locale) => string): string {
  return [
    ...LOCALES.map(
      (loc) => `    <xhtml:link rel="alternate" hreflang="${loc}" href="${BASE_URL}${pathForLocale(loc)}" />`
    ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${pathForLocale("en")}" />`
  ].join("\n");
}

export function renderSitemap(
  lastModifiedIso: string | null = null,
  events: ReadonlyArray<{ id: string; announced_at: string }> = []
): string {
  const parsedMs = lastModifiedIso ? Date.parse(lastModifiedIso) : NaN;
  const lastmod = Number.isFinite(parsedMs)
    ? new Date(parsedMs).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const homeHreflangs = buildHreflangs(localePath);
  const homeUrls = LOCALES.map((loc) => {
    const priority = loc === "en" ? "1.0" : "0.9";
    return `  <url>
    <loc>${BASE_URL}${localePath(loc)}</loc>
${homeHreflangs}
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  const docsHreflangs = buildHreflangs(apiDocsPath);
  const docsUrls = LOCALES.map((loc) => {
    const priority = loc === "en" ? "0.6" : "0.5";
    return `  <url>
    <loc>${BASE_URL}${apiDocsPath(loc)}</loc>
${docsHreflangs}
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  const eventUrls = events.flatMap((ev) => {
    const evLastmod = ev.announced_at ? ev.announced_at.slice(0, 10) : lastmod;
    const evHreflangs = buildHreflangs((loc) => resetDetailPath(ev.id, loc));
    return LOCALES.map((loc) => {
      const priority = loc === "en" ? "0.8" : "0.7";
      return `  <url>
    <loc>${BASE_URL}${resetDetailPath(ev.id, loc)}</loc>
${evHreflangs}
    <lastmod>${evLastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>`;
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...homeUrls, ...docsUrls, ...eventUrls].join("\n")}
</urlset>`;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const isReadMethod = request.method === "GET" || request.method === "HEAD";

    // Canonical host redirect
    if (url.hostname === "www.antigravityreset.app") {
      url.hostname = "antigravityreset.app";
      return Response.redirect(url.toString(), 301);
    }

    // Official MCP Registry HTTP domain ownership verification (must return 200 with zero redirects)
    if (url.pathname === "/.well-known/mcp-registry-auth") {
      return new Response(MCP_REGISTRY_AUTH_RECORD, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=300"
        }
      });
    }

    // Remote Streamable HTTP MCP server endpoint
    if (url.pathname === "/mcp") {
      return handleMcpRequest(request, env);
    }

    // Canonicalize trailing slashes on non-root GET/HEAD paths
    if (url.pathname.length > 1 && url.pathname.endsWith("/") && isReadMethod) {
      const target = new URL(url.toString());
      target.pathname = url.pathname.replace(/\/+$/, "");
      return Response.redirect(target.toString(), 301);
    }

    // Explicit ?lang= switch sets cookie and redirects to clean locale path
    const queryLang = normalizeLocale(url.searchParams.get("lang"));
    if (queryLang && isReadMethod) {
      const target = new URL(localePath(queryLang), url.origin);
      const headers = new Headers({
        Location: target.toString(),
        "Set-Cookie": `${LANG_COOKIE}=${queryLang}; Max-Age=31536000; Path=/; Secure; SameSite=Lax`,
        "Cache-Control": "private, no-store"
      });
      return new Response(null, { status: 302, headers });
    }

    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";

    // Localized API docs (/api/docs and /:locale/api/docs)
    const apiDocsMatch = /^(?:\/(zh-CN|zh-TW|ja|ko))?\/api\/docs$/.exec(normalizedPath);
    if (apiDocsMatch && isReadMethod) {
      const docLocale = apiDocsMatch[1] ? (normalizeLocale(apiDocsMatch[1]) ?? "en") : "en";
      const html = renderApiDocsPage(docLocale);
      return new Response(request.method === "HEAD" ? null : html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Language": docLocale,
          "Cache-Control": "public, max-age=300, s-maxage=3600"
        }
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env, url);
    }

    // Machine-readable discovery, OpenAPI 3.1, Agent Skill, llms.txt, and live SVG badge
    if ((url.pathname === "/openapi.json" || url.pathname === "/openapi/v1/openapi.json") && isReadMethod) {
      const body = JSON.stringify(renderOpenApiSpec(), null, 2);
      return new Response(request.method === "HEAD" ? null : body, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...CORS_HEADERS,
          "Cache-Control": "public, max-age=3600"
        }
      });
    }

    if (
      (url.pathname === "/SKILL.md" ||
        url.pathname === "/skill.md" ||
        url.pathname === "/skills/antigravity-reset/SKILL.md") &&
      isReadMethod
    ) {
      return new Response(request.method === "HEAD" ? null : SKILL_MARKDOWN, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          ...CORS_HEADERS,
          "Cache-Control": "public, max-age=3600"
        }
      });
    }

    if (url.pathname === "/llms.txt" && isReadMethod) {
      const dataset = await loadDataset(env);
      const payload = normalizeDataset(dataset, "en");
      return new Response(request.method === "HEAD" ? null : renderLlmsTxt(payload), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          ...CORS_HEADERS,
          "Cache-Control": "public, max-age=3600"
        }
      });
    }

    if (url.pathname === "/badge.svg" && isReadMethod) {
      const dataset = await loadDataset(env);
      const payload = normalizeDataset(dataset, "en");
      const svg = renderStatusBadgeSvg(payload, { label: url.searchParams.get("label") });
      return new Response(request.method === "HEAD" ? null : svg, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          ...CORS_HEADERS,
          "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600"
        }
      });
    }

    // Machine-readable & SEO endpoints
    if (url.pathname === "/robots.txt") {
      return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${BASE_URL}/sitemap.xml\n`, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" }
      });
    }

    if (url.pathname === "/sitemap.xml") {
      const dataset = await loadDataset(env);
      const payload = normalizeDataset(dataset, "en");
      return new Response(renderSitemap(payload.stats.last_reset_at, payload.events), {
        headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" }
      });
    }

    if (url.pathname === "/feed.xml" && isReadMethod) {
      const feedLocale = normalizeLocale(url.searchParams.get("locale")) ?? "en";
      const dataset = await loadDataset(env);
      const payload = normalizeDataset(dataset, feedLocale);
      return new Response(request.method === "HEAD" ? null : renderRssFeed(payload, feedLocale), {
        headers: {
          "Content-Type": "application/rss+xml; charset=utf-8",
          "Cache-Control": "public, max-age=300"
        }
      });
    }

    // Markdown alternates: /.md, /en.md, /zh-CN.md, /zh-TW.md, /ja.md, /ko.md
    if (url.pathname === "/.md" || /^\/(en|zh-CN|zh-TW|ja|ko)\.md$/.test(url.pathname)) {
      const locale = url.pathname === "/.md" ? "en" : localeFromPath(url.pathname);
      const dataset = await loadDataset(env);
      const payload = normalizeDataset(dataset, locale);
      return new Response(renderMarkdown(payload, locale), {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "public, max-age=60"
        }
      });
    }

    // Permanent per-event detail pages (/resets/:id and /:locale/resets/:id)
    const detailMatch = /^(?:\/(zh-CN|zh-TW|ja|ko))?\/resets\/([^/]+)$/.exec(normalizedPath);
    if (detailMatch && isReadMethod) {
      let id = "";
      try {
        id = decodeURIComponent(detailMatch[2]).trim();
      } catch {
        return new Response("Bad Request", { status: 400 });
      }
      const detailLocale = detailMatch[1] ? (normalizeLocale(detailMatch[1]) ?? "en") : "en";
      const dataset = await loadDataset(env);
      const payload = normalizeDataset(dataset, detailLocale);
      const eventIndex = payload.events.findIndex((ev) => ev.id === id);
      if (eventIndex === -1) {
        return new Response("Not Found", { status: 404 });
      }

      const html = renderResetDetailPage({
        locale: detailLocale,
        payload,
        eventIndex
      });

      return new Response(request.method === "HEAD" ? null : html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Language": detailLocale,
          "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
        }
      });
    }

    // Localized SSR HTML routes
    const isLocalizedRoute =
      normalizedPath === "/" ||
      LOCALES.some((loc) => loc !== "en" && localePath(loc) === normalizedPath);

    if (isLocalizedRoute && isReadMethod) {
      // Auto-detect visitor language on root path "/" (cookie preference > Accept-Language), skipping crawlers.
      if (normalizedPath === "/" && !isLikelyCrawler(request.headers.get("User-Agent"))) {
        const cookieLang = parseLangCookie(request.headers.get("Cookie"));
        let redirectLocale: Locale | null = null;

        if (cookieLang && cookieLang !== "en") {
          redirectLocale = cookieLang;
        } else if (!cookieLang && !hasLocalizedSameOriginReferer(request, url.origin)) {
          const detected = matchAcceptLanguage(request.headers.get("Accept-Language"));
          if (detected && detected !== "en") {
            redirectLocale = detected;
          }
        }

        if (redirectLocale) {
          const target = new URL(`${localePath(redirectLocale)}${url.search}`, url.origin);
          return new Response(null, {
            status: 302,
            headers: {
              Location: target.toString(),
              "Cache-Control": "private, no-store",
              Vary: "Accept-Language, Cookie"
            }
          });
        }
      }

      const locale = localeFromPath(normalizedPath);
      const dataset = await loadDataset(env);
      const payload = normalizeDataset(dataset, locale);
      const latestId = payload.events[0]?.id ?? "none";
      const reactionCount = await getReactionCount(env, latestId);

      const html = renderHomePage({
        locale,
        payload,
        reactionCount
      });

      const responseHeaders: Record<string, string> = {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Language": locale,
        "Cache-Control":
          normalizedPath === "/"
            ? "private, no-cache"
            : "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
      };
      if (normalizedPath === "/") {
        responseHeaders.Vary = "Accept-Language, Cookie";
      }

      return new Response(request.method === "HEAD" ? null : html, {
        status: 200,
        headers: responseHeaders
      });
    }

    // Static assets fallback
    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
