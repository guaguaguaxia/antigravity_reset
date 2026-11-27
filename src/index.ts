import { loadDataset, normalizeDataset } from "./data/repository";
import { LOCALES, localeFromPath, localePath, matchAcceptLanguage, normalizeLocale, type Locale } from "./i18n";
import { getReactionCount, handleApiRequest, type WorkerEnv } from "./api/handlers";
import { handleMcpRequest } from "./mcp/server";
import { renderApiDocsPage } from "./render/api-docs";
import { renderRssFeed } from "./render/feed";
import { renderHomePage } from "./render/html";
import { renderMarkdown } from "./render/markdown";

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

export function renderSitemap(lastModifiedIso: string | null = null): string {
  const parsedMs = lastModifiedIso ? Date.parse(lastModifiedIso) : NaN;
  const lastmod = Number.isFinite(parsedMs)
    ? new Date(parsedMs).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const hreflangs = [
    ...LOCALES.map(
      (loc) => `    <xhtml:link rel="alternate" hreflang="${loc}" href="${BASE_URL}${localePath(loc)}" />`
    ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/" />`
  ].join("\n");

  const urls = LOCALES.map((loc) => {
    const priority = loc === "en" ? "1.0" : "0.9";
    return `  <url>
    <loc>${BASE_URL}${localePath(loc)}</loc>
${hreflangs}
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
  <url>
    <loc>${BASE_URL}/api/docs</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

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
    if (url.pathname.length > 1 && url.pathname.endsWith("/") && (request.method === "GET" || request.method === "HEAD")) {
      const target = new URL(url.toString());
      target.pathname = url.pathname.replace(/\/+$/, "");
      return Response.redirect(target.toString(), 301);
    }

    // Explicit ?lang= switch sets cookie and redirects to clean locale path
    const queryLang = normalizeLocale(url.searchParams.get("lang"));
    if (queryLang && (request.method === "GET" || request.method === "HEAD")) {
      const target = new URL(localePath(queryLang), url.origin);
      const headers = new Headers({
        Location: target.toString(),
        "Set-Cookie": `${LANG_COOKIE}=${queryLang}; Max-Age=31536000; Path=/; Secure; SameSite=Lax`,
        "Cache-Control": "private, no-store"
      });
      return new Response(null, { status: 302, headers });
    }

    // API endpoints
    if (url.pathname === "/api/docs") {
      return new Response(renderApiDocsPage("en"), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300, s-maxage=3600"
        }
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env, url);
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
      return new Response(renderSitemap(payload.stats.last_reset_at), {
        headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" }
      });
    }

    if (url.pathname === "/feed.xml") {
      const dataset = await loadDataset(env);
      const payload = normalizeDataset(dataset, "en");
      return new Response(renderRssFeed(payload), {
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

    // Localized SSR HTML routes
    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
    const isLocalizedRoute =
      normalizedPath === "/" ||
      LOCALES.some((loc) => loc !== "en" && localePath(loc) === normalizedPath);

    if (isLocalizedRoute && (request.method === "GET" || request.method === "HEAD")) {
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
