import { loadDataset, normalizeDataset } from "./data/repository";
import { LOCALES, localeFromPath, localePath, normalizeLocale, type Locale } from "./i18n";
import { getReactionCount, handleApiRequest, type WorkerEnv } from "./api/handlers";
import { renderApiDocsPage } from "./render/api-docs";
import { renderRssFeed } from "./render/feed";
import { renderHomePage } from "./render/html";
import { renderMarkdown } from "./render/markdown";

const LANG_COOKIE = "antigravity-reset-language";
const BASE_URL = "https://antigravityreset.app";

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

    // Explicit ?lang= switch sets cookie and redirects to clean locale path
    const queryLang = normalizeLocale(url.searchParams.get("lang"));
    if (queryLang && (request.method === "GET" || request.method === "HEAD")) {
      const target = new URL(localePath(queryLang), url.origin);
      const headers = new Headers({
        Location: target.toString(),
        "Set-Cookie": `${LANG_COOKIE}=${queryLang}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`
      });
      return new Response(null, { status: 302, headers });
    }

    // API endpoints
    if (url.pathname === "/api/docs") {
      const cookieLocale = parseLangCookie(request.headers.get("Cookie")) ?? "en";
      return new Response(renderApiDocsPage(cookieLocale), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
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

      return new Response(request.method === "HEAD" ? null : html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Language": locale,
          "Cache-Control": "private, no-store",
          Vary: "Cookie"
        }
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
