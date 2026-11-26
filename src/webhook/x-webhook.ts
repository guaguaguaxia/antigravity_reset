import {
  CORS_HEADERS,
  constantTimeEqual,
  jsonResponse,
  type WorkerEnv
} from "../api/handlers";
import {
  DATASET_KV_KEY,
  loadDataset,
  type RawDataset,
  type RawResetEvent
} from "../data/repository";
import { classifyResetTweet, type AiClassificationResult } from "./ai-classifier";

const DEFAULT_ALLOWED_AUTHORS = "_mohansolo";
const MIN_RESET_CONFIDENCE = 0.7;
const LAST_DELIVERY_KV_KEY = "webhook:last_delivery";
const LAST_DELIVERY_TTL_SECONDS = 604_800; // 7 days

export interface IncomingTweet {
  id: string;
  text: string;
  author: string;
  announcedAt: string;
  sourceUrl: string;
  isRetweet: boolean;
  inReplyToUsername: string | null;
}

export interface WebhookTweetOutcome {
  id: string;
  author: string;
  status: "added" | "would_add" | "rejected_ai" | "skipped";
  reason: string;
  classification?: AiClassificationResult;
}

export interface WebhookDependencies {
  fetchFn?: typeof fetch;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickFirstString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) {
      return c.trim();
    }
  }
  return "";
}

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

function normalizeSourceUrl(rawUrl: string, author: string, id: string): string {
  const cleanAuthor = author || "_mohansolo";
  if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
    return rawUrl
      .replace(/^http:\/\//i, "https://")
      .replace(/^https:\/\/(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\//i, "https://x.com/");
  }
  return `https://x.com/${cleanAuthor}/status/${id}`;
}

function normalizeTimestamp(raw: unknown): string {
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  } else if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

function extractSingleTweet(rawItem: unknown): IncomingTweet | null {
  const obj = asRecord(rawItem);
  if (!obj) return null;

  // Prefer id_str (SocialData / Twitter v1.1) before numeric id to avoid JS precision loss.
  const id =
    typeof obj.id_str === "string" && obj.id_str.trim()
      ? obj.id_str.trim()
      : typeof obj.id === "string" && obj.id.trim()
        ? obj.id.trim()
        : typeof obj.id === "number" && Number.isSafeInteger(obj.id)
          ? String(obj.id)
          : "";
  if (!id) return null;

  const noteTweet = asRecord(obj.note_tweet);
  const text = pickFirstString(noteTweet?.text, obj.full_text, obj.text);

  const authorObj = asRecord(obj.author) ?? asRecord(obj.user);
  const rawAuthor = pickFirstString(
    authorObj?.userName,
    authorObj?.username,
    authorObj?.screen_name,
    typeof obj.author === "string" ? obj.author : "",
    obj.username,
    obj.user_screen_name
  );
  const author = normalizeHandle(rawAuthor);

  const announcedAt = normalizeTimestamp(obj.createdAt ?? obj.created_at ?? obj.announcedAt ?? obj.announced_at);
  const rawUrl = pickFirstString(obj.url, obj.sourceUrl, obj.source_url);
  const sourceUrl = normalizeSourceUrl(rawUrl, author, id);

  const inReplyTo = pickFirstString(obj.inReplyToUsername, obj.in_reply_to_screen_name);
  const isRetweet =
    obj.isRetweet === true ||
    Boolean(obj.retweeted_tweet) ||
    Boolean(obj.retweeted_status) ||
    /^RT\s+@/i.test(text);

  return {
    id,
    text,
    author,
    announcedAt,
    sourceUrl,
    isRetweet,
    inReplyToUsername: inReplyTo ? normalizeHandle(inReplyTo) : null
  };
}

/** Check whether the webhook payload is a connectivity ping / test event. */
export function isWebhookTestPayload(body: unknown): { isTest: boolean; eventType: string } {
  const obj = asRecord(body);
  if (!obj) return { isTest: false, eventType: "" };

  const eventType = pickFirstString(obj.event_type, obj.event, obj.type).toLowerCase();
  if (
    obj.test === true ||
    eventType === "test_webhook_url" ||
    eventType === "webhook_test" ||
    eventType === "ping" ||
    eventType === "test"
  ) {
    return { isTest: true, eventType: eventType || "test" };
  }

  return { isTest: false, eventType };
}

/** Normalize tweet lists from TwitterAPI.io, SocialData.tools, and generic webhook payloads. */
export function extractIncomingTweets(body: unknown): IncomingTweet[] {
  const obj = asRecord(body);
  if (!obj) return [];

  const candidates: unknown[] = [];
  if (Array.isArray(obj.tweets)) {
    candidates.push(...obj.tweets);
  }
  if (obj.tweet) {
    candidates.push(obj.tweet);
  }
  if (Array.isArray(obj.data)) {
    candidates.push(...obj.data);
  } else if (asRecord(obj.data)) {
    const dataObj = asRecord(obj.data)!;
    if (Array.isArray(dataObj.tweets)) {
      candidates.push(...dataObj.tweets);
    } else if (dataObj.tweet) {
      candidates.push(dataObj.tweet);
    } else {
      candidates.push(dataObj);
    }
  }
  if (candidates.length === 0 && (obj.id !== undefined || obj.id_str !== undefined)) {
    candidates.push(obj);
  }

  const tweets: IncomingTweet[] = [];
  for (const item of candidates) {
    const parsed = extractSingleTweet(item);
    if (parsed) tweets.push(parsed);
  }
  return tweets;
}

function extractWebhookToken(request: Request, url: URL): string {
  const pathPrefix = "/api/webhook/x/";
  if (url.pathname.startsWith(pathPrefix)) {
    const rawSegment = url.pathname.slice(pathPrefix.length).split("/")[0] ?? "";
    if (rawSegment) {
      try {
        return decodeURIComponent(rawSegment).trim();
      } catch {
        return rawSegment.trim();
      }
    }
  }

  const queryToken = url.searchParams.get("token") ?? url.searchParams.get("secret");
  if (queryToken && queryToken.trim()) {
    return queryToken.trim();
  }

  const headerSecret = request.headers.get("X-Webhook-Secret");
  if (headerSecret && headerSecret.trim()) {
    return headerSecret.trim();
  }

  const auth = request.headers.get("Authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }

  return "";
}

function parseAllowedAuthors(raw?: string): Set<string> {
  const source = raw && raw.trim() ? raw : DEFAULT_ALLOWED_AUTHORS;
  return new Set(
    source
      .split(",")
      .map((item) => normalizeHandle(item))
      .filter(Boolean)
  );
}

/** Handle real-time X webhook deliveries, pre-filter tweets, classify with AI, and update KV. */
export async function handleXWebhook(
  request: Request,
  env: WorkerEnv,
  url: URL,
  deps: WebhookDependencies = {}
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = env.WEBHOOK_SECRET?.trim();
  if (!expectedSecret) {
    return jsonResponse({ error: "WEBHOOK_SECRET is not configured." }, 503);
  }

  const providedSecret = extractWebhookToken(request, url);
  if (!providedSecret || !(await constantTimeEqual(providedSecret, expectedSecret))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const testCheck = isWebhookTestPayload(body);
  if (testCheck.isTest) {
    return jsonResponse({
      ok: true,
      status: "pong",
      event_type: testCheck.eventType
    });
  }

  const dryRunParam = url.searchParams.get("dryRun")?.toLowerCase();
  const dryRun = dryRunParam === "1" || dryRunParam === "true";

  const incomingTweets = extractIncomingTweets(body);
  if (incomingTweets.length === 0) {
    return jsonResponse({
      ok: true,
      dry_run: dryRun,
      received: 0,
      added: 0,
      skipped: 0,
      results: []
    });
  }

  const dataset = await loadDataset(env);
  const existingIds = new Set(dataset.events.map((ev) => ev.id));
  const allowedAuthors = parseAllowedAuthors(env.ALLOWED_X_AUTHORS);

  const addedEvents: RawResetEvent[] = [];
  const results: WebhookTweetOutcome[] = [];
  let skipped = 0;

  for (const tweet of incomingTweets) {
    if (!tweet.author || !allowedAuthors.has(tweet.author)) {
      skipped += 1;
      results.push({
        id: tweet.id,
        author: tweet.author,
        status: "skipped",
        reason: "Author is not in allowed X watchlist."
      });
      continue;
    }

    if (tweet.isRetweet) {
      skipped += 1;
      results.push({
        id: tweet.id,
        author: tweet.author,
        status: "skipped",
        reason: "Retweets are ignored."
      });
      continue;
    }

    if (tweet.inReplyToUsername && tweet.inReplyToUsername !== tweet.author) {
      skipped += 1;
      results.push({
        id: tweet.id,
        author: tweet.author,
        status: "skipped",
        reason: `Replies to other users (@${tweet.inReplyToUsername}) are ignored.`
      });
      continue;
    }

    if (!tweet.text) {
      skipped += 1;
      results.push({
        id: tweet.id,
        author: tweet.author,
        status: "skipped",
        reason: "Empty tweet text."
      });
      continue;
    }

    if (existingIds.has(tweet.id)) {
      skipped += 1;
      results.push({
        id: tweet.id,
        author: tweet.author,
        status: "skipped",
        reason: "Duplicate event ID already stored."
      });
      continue;
    }

    const apiKey = env.APIMART_API_KEY?.trim();
    if (!apiKey) {
      return jsonResponse({ error: "APIMART_API_KEY is not configured." }, 503);
    }

    let classification: AiClassificationResult;
    try {
      classification = await classifyResetTweet(
        {
          text: tweet.text,
          author: tweet.author,
          announcedAt: tweet.announcedAt,
          sourceUrl: tweet.sourceUrl
        },
        {
          apiKey,
          baseUrl: env.APIMART_BASE_URL,
          model: env.APIMART_MODEL,
          fetchFn: deps.fetchFn
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI classification error";
      return jsonResponse({ error: `AI classification failed: ${message}` }, 502);
    }

    if (!classification.is_reset || classification.confidence < MIN_RESET_CONFIDENCE) {
      skipped += 1;
      results.push({
        id: tweet.id,
        author: tweet.author,
        status: "rejected_ai",
        reason: classification.reason || "Post is not an official Antigravity quota reset.",
        classification
      });
      continue;
    }

    existingIds.add(tweet.id);
    const newEvent: RawResetEvent = {
      id: tweet.id,
      announcedAt: tweet.announcedAt,
      sourceUrl: tweet.sourceUrl,
      text: tweet.text,
      product: "Antigravity",
      author: tweet.author,
      models: classification.models,
      verified: true,
      ...(Object.keys(classification.translations).length > 0
        ? { translations: classification.translations }
        : {})
    };
    addedEvents.push(newEvent);

    results.push({
      id: tweet.id,
      author: tweet.author,
      status: dryRun ? "would_add" : "added",
      reason: classification.reason || "Verified quota reset announcement.",
      classification
    });
  }

  const nowIso = new Date().toISOString();
  const mergedEvents = [...addedEvents, ...dataset.events].sort(
    (a, b) => Date.parse(b.announcedAt) - Date.parse(a.announcedAt)
  );

  if (!dryRun && env.ANTIGRAVITY_KV) {
    const nextDataset: RawDataset = {
      events: mergedEvents,
      monitor: {
        state: "live",
        lastCheckAt: nowIso,
        lastSuccessAt: nowIso,
        intervalSeconds: 30
      }
    };
    await env.ANTIGRAVITY_KV.put(DATASET_KV_KEY, JSON.stringify(nextDataset));
    await env.ANTIGRAVITY_KV.put(
      LAST_DELIVERY_KV_KEY,
      JSON.stringify({
        delivered_at: nowIso,
        received: incomingTweets.length,
        added: addedEvents.length,
        skipped,
        ids: incomingTweets.map((t) => t.id)
      }),
      { expirationTtl: LAST_DELIVERY_TTL_SECONDS }
    );
  }

  return jsonResponse({
    ok: true,
    dry_run: dryRun,
    received: incomingTweets.length,
    added: addedEvents.length,
    skipped,
    total_events: mergedEvents.length,
    results
  });
}
