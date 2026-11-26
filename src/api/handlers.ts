import {
  DATASET_KV_KEY,
  loadDataset,
  normalizeDataset,
  validateIngestPayload
} from "../data/repository";
import { normalizeLocale } from "../i18n";

export interface WorkerEnv {
  ASSETS: Fetcher;
  ANTIGRAVITY_KV?: KVNamespace;
  ADMIN_TOKEN?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extraHeaders
    }
  });
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b))
  ]);
  const viewA = new Uint8Array(hashA);
  const viewB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < viewA.length; i += 1) {
    diff |= viewA[i] ^ viewB[i];
  }
  return diff === 0;
}

export async function getReactionCount(env: WorkerEnv, cycleId: string): Promise<number> {
  if (!env.ANTIGRAVITY_KV) return 0;
  try {
    const raw = await env.ANTIGRAVITY_KV.get(`reactions:${cycleId}`);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export async function handleApiRequest(request: Request, env: WorkerEnv, url: URL): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const path = url.pathname;

  if (path === "/api/resets" && request.method === "GET") {
    const locale = normalizeLocale(url.searchParams.get("locale")) ?? "en";
    const dataset = await loadDataset(env);
    const payload = normalizeDataset(dataset, locale);
    return jsonResponse(payload, 200, {
      "Cache-Control": "public, max-age=60"
    });
  }

  if (path === "/api/reset-requests") {
    const dataset = await loadDataset(env);
    const normalized = normalizeDataset(dataset, "en");
    const cycleId = normalized.events[0]?.id ?? "none";
    const since = normalized.stats.last_reset_at;

    if (request.method === "GET") {
      const count = await getReactionCount(env, cycleId);
      return jsonResponse({ cycle_id: cycleId, since, count }, 200, {
        "Cache-Control": "no-store"
      });
    }

    if (request.method === "POST") {
      let increment = 1;
      try {
        const body = (await request.json()) as { n?: unknown };
        if (typeof body?.n === "number" && Number.isFinite(body.n)) {
          increment = Math.max(1, Math.min(10, Math.round(body.n)));
        }
      } catch {
        increment = 1;
      }

      const current = await getReactionCount(env, cycleId);
      const next = current + increment;
      if (env.ANTIGRAVITY_KV) {
        await env.ANTIGRAVITY_KV.put(`reactions:${cycleId}`, String(next));
      }
      return jsonResponse({ cycle_id: cycleId, since, count: next }, 200, {
        "Cache-Control": "no-store"
      });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (path === "/api/presence") {
    const WINDOW_SECONDS = 300;
    if (request.method === "POST") {
      let visitorId = "";
      try {
        const body = (await request.json()) as { visitor?: unknown };
        if (typeof body?.visitor === "string" && /^[0-9a-f-]{16,64}$/i.test(body.visitor)) {
          visitorId = body.visitor.toLowerCase();
        }
      } catch {
        visitorId = "";
      }

      if (!env.ANTIGRAVITY_KV) {
        return jsonResponse({ count: 1, windowSeconds: WINDOW_SECONDS }, 200, {
          "Cache-Control": "no-store"
        });
      }

      if (visitorId) {
        await env.ANTIGRAVITY_KV.put(`presence:${visitorId}`, "1", {
          expirationTtl: WINDOW_SECONDS
        });
      }

      const cached = await env.ANTIGRAVITY_KV.get("presence:summary");
      let count = cached ? Number.parseInt(cached, 10) : NaN;
      if (!Number.isSafeInteger(count) || count < 1) {
        const list = await env.ANTIGRAVITY_KV.list({ prefix: "presence:", limit: 1000 });
        count = Math.max(1, list.keys.filter((k) => k.name !== "presence:summary").length);
        await env.ANTIGRAVITY_KV.put("presence:summary", String(count), { expirationTtl: 15 });
      }
      return jsonResponse({ count, windowSeconds: WINDOW_SECONDS }, 200, {
        "Cache-Control": "no-store"
      });
    }

    if (request.method === "GET") {
      if (!env.ANTIGRAVITY_KV) {
        return jsonResponse({ count: 1, windowSeconds: WINDOW_SECONDS });
      }
      const list = await env.ANTIGRAVITY_KV.list({ prefix: "presence:", limit: 1000 });
      const count = Math.max(1, list.keys.filter((k) => k.name !== "presence:summary").length);
      return jsonResponse({ count, windowSeconds: WINDOW_SECONDS }, 200, {
        "Cache-Control": "no-store"
      });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (path === "/api/email/subscribe" && request.method === "POST") {
    let email = "";
    try {
      const body = (await request.json()) as { email?: unknown };
      email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    } catch {
      return jsonResponse({ error: "Enter a valid email address" }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return jsonResponse({ error: "Enter a valid email address" }, 400);
    }

    if (env.ANTIGRAVITY_KV) {
      await env.ANTIGRAVITY_KV.put(
        `email:${email}`,
        JSON.stringify({ email, subscribed_at: new Date().toISOString() })
      );
    }
    return jsonResponse({ ok: true, status: "subscribed" });
  }

  if (path === "/api/admin/resets" && request.method === "POST") {
    const token = env.ADMIN_TOKEN;
    if (!token) {
      return jsonResponse({ error: "ADMIN_TOKEN secret is not configured." }, 503);
    }

    const auth = request.headers.get("Authorization") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!provided || !(await constantTimeEqual(provided, token))) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const validation = validateIngestPayload(body);
    if (!validation.ok) {
      return jsonResponse({ error: validation.error }, 400);
    }

    if (!env.ANTIGRAVITY_KV) {
      return jsonResponse({ error: "ANTIGRAVITY_KV binding is unavailable." }, 500);
    }

    await env.ANTIGRAVITY_KV.put(DATASET_KV_KEY, JSON.stringify(validation.data));
    return jsonResponse({ ok: true, count: validation.data.events.length });
  }

  return jsonResponse({ error: "Not found" }, 404);
}
