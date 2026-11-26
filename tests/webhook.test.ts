import { describe, expect, it, vi } from "vitest";
import { DATASET_KV_KEY, loadDataset, normalizeDataset, type RawDataset } from "../src/data/repository";
import { classifyResetTweet } from "../src/webhook/ai-classifier";
import { handleXWebhook } from "../src/webhook/x-webhook";
import type { WorkerEnv } from "../src/api/handlers";

function createMockKv() {
  const store = new Map<string, string>();
  return {
    store,
    kv: {
      async get(key: string, type?: string) {
        const val = store.get(key) ?? null;
        if (val === null) return null;
        return type === "json" ? JSON.parse(val) : val;
      },
      async put(key: string, value: string) {
        store.set(key, value);
      }
    } as unknown as KVNamespace
  };
}

function createEnv(kv: KVNamespace): WorkerEnv {
  return {
    ASSETS: { fetch: async () => new Response("Not Found", { status: 404 }) } as unknown as Fetcher,
    ANTIGRAVITY_KV: kv,
    WEBHOOK_SECRET: "test-secret-123",
    APIMART_API_KEY: "sk-test-dummy",
    APIMART_BASE_URL: "https://api.apimart.ai/v1",
    APIMART_MODEL: "gpt-6-luna",
    ALLOWED_X_AUTHORS: "_mohansolo"
  };
}

function mockAiResponse(result: {
  is_reset: boolean;
  confidence: number;
  reason: string;
  models: string[];
  translations?: Record<string, string>;
}) {
  return vi.fn<typeof fetch>(async () => {
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                is_reset: result.is_reset,
                confidence: result.confidence,
                reason: result.reason,
                models: result.models,
                translations: result.translations ?? {}
              })
            }
          }
        ]
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });
}

describe("X webhook & APIMart AI classification", () => {
  it("enforces authentication and accepts path, query, and header tokens", async () => {
    const { kv } = createMockKv();
    const env = createEnv(kv);

    const unauth = await handleXWebhook(
      new Request("https://antigravityreset.app/api/webhook/x", {
        method: "POST",
        body: JSON.stringify({ event_type: "test_webhook_url" })
      }),
      env,
      new URL("https://antigravityreset.app/api/webhook/x")
    );
    expect(unauth.status).toBe(401);

    const badToken = await handleXWebhook(
      new Request("https://antigravityreset.app/api/webhook/x?token=wrong", {
        method: "POST",
        body: JSON.stringify({ event_type: "test_webhook_url" })
      }),
      env,
      new URL("https://antigravityreset.app/api/webhook/x?token=wrong")
    );
    expect(badToken.status).toBe(401);

    const viaQuery = await handleXWebhook(
      new Request("https://antigravityreset.app/api/webhook/x?token=test-secret-123", {
        method: "POST",
        body: JSON.stringify({ event_type: "test_webhook_url" })
      }),
      env,
      new URL("https://antigravityreset.app/api/webhook/x?token=test-secret-123")
    );
    expect(viaQuery.status).toBe(200);
    expect(await viaQuery.json()).toEqual({ ok: true, status: "pong", event_type: "test_webhook_url" });

    const viaPath = await handleXWebhook(
      new Request("https://antigravityreset.app/api/webhook/x/test-secret-123", {
        method: "POST",
        body: JSON.stringify({ event_type: "ping" })
      }),
      env,
      new URL("https://antigravityreset.app/api/webhook/x/test-secret-123")
    );
    expect(viaPath.status).toBe(200);

    const viaHeader = await handleXWebhook(
      new Request("https://antigravityreset.app/api/webhook/x", {
        method: "POST",
        headers: { "X-Webhook-Secret": "test-secret-123" },
        body: JSON.stringify({ test: true })
      }),
      env,
      new URL("https://antigravityreset.app/api/webhook/x")
    );
    expect(viaHeader.status).toBe(200);
  });

  it("classifies TwitterAPI.io reset tweets with gpt-6-luna, saves inline translations to KV, and sets monitor live", async () => {
    const { kv, store } = createMockKv();
    const env = createEnv(kv);
    const fetchMock = mockAiResponse({
      is_reset: true,
      confidence: 0.98,
      reason: "Official Gemini quota reset post",
      models: ["Gemini"],
      translations: {
        "zh-CN": "已为所有 Antigravity 用户重置 Gemini 额度！",
        "zh-TW": "已為所有 Antigravity 使用者重置 Gemini 額度！",
        ja: "すべての Antigravity ユーザーの Gemini クォータをリセットしました！",
        ko: "모든 Antigravity 사용자의 Gemini 쿼터를 리셋했습니다!"
      }
    });

    const url = new URL("https://antigravityreset.app/api/webhook/x?token=test-secret-123");
    const res = await handleXWebhook(
      new Request(url.toString(), {
        method: "POST",
        body: JSON.stringify({
          event_type: "tweet",
          tweets: [
            {
              id: "999000111222333444",
              url: "https://twitter.com/_mohansolo/status/999000111222333444",
              text: "Resetting Gemini quota for everyone on Antigravity right now!",
              createdAt: "2026-11-26T12:15:00.000Z",
              author: { userName: "_mohansolo" }
            }
          ]
        })
      }),
      env,
      url,
      { fetchFn: fetchMock }
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { added: number; total_events: number; results: Array<{ status: string }> };
    expect(body.added).toBe(1);
    expect(body.total_events).toBe(8);
    expect(body.results[0].status).toBe("added");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    const aiPayload = JSON.parse(String(requestInit.body)) as { model: string; stream: boolean };
    expect(aiPayload.model).toBe("gpt-6-luna");
    expect(aiPayload.stream).toBe(false);

    const stored = JSON.parse(store.get(DATASET_KV_KEY)!) as RawDataset;
    expect(stored.monitor.state).toBe("live");

    const loaded = await loadDataset(env);
    const zhPayload = normalizeDataset(loaded, "zh-CN");
    expect(zhPayload.events[0].id).toBe("999000111222333444");
    expect(zhPayload.events[0].source_url).toBe("https://x.com/_mohansolo/status/999000111222333444");
    expect(zhPayload.events[0].display_text).toBe("已为所有 Antigravity 用户重置 Gemini 额度！");
  });

  it("supports SocialData.tools payload format (id_str & full_text) and all-model resets", async () => {
    const { kv } = createMockKv();
    const env = createEnv(kv);
    const fetchMock = mockAiResponse({
      is_reset: true,
      confidence: 0.94,
      reason: "All-model reset announcement",
      models: [],
      translations: { "zh-CN": "全模型重置测试" }
    });

    const url = new URL("https://antigravityreset.app/api/webhook/x?token=test-secret-123");
    const res = await handleXWebhook(
      new Request(url.toString(), {
        method: "POST",
        body: JSON.stringify({
          event: "new_tweet",
          monitored_username: "_mohansolo",
          data: {
            tweet_created_at: "2026-11-26T12:20:00.000000Z",
            id: 999000111222333999,
            id_str: "999000111222333991",
            full_text: "Resetting quotas across all models on Antigravity!",
            user: { screen_name: "_mohansolo" }
          }
        })
      }),
      env,
      url,
      { fetchFn: fetchMock }
    );

    expect(res.status).toBe(200);
    const loaded = await loadDataset(env);
    const payload = normalizeDataset(loaded, "en");
    expect(payload.events[0].id).toBe("999000111222333991");
    expect(payload.events[0].announced_at).toBe("2026-11-26T12:20:00.000Z");
    expect(payload.events[0].reset_type).toBe("all");
  });

  it("exposes authenticated GET /api/webhook/x/status with monitor and last delivery summary", async () => {
    const { kv } = createMockKv();
    const env = createEnv(kv);

    const unauth = await handleXWebhook(
      new Request("https://antigravityreset.app/api/webhook/x/status", { method: "GET" }),
      env,
      new URL("https://antigravityreset.app/api/webhook/x/status")
    );
    expect(unauth.status).toBe(401);

    const postUrl = new URL("https://antigravityreset.app/api/webhook/x?token=test-secret-123");
    await handleXWebhook(
      new Request(postUrl.toString(), {
        method: "POST",
        body: JSON.stringify({
          event: "new_tweet",
          data: {
            id_str: "999000111222333888",
            full_text: "Hello from unrelated author",
            tweet_created_at: "2026-11-26T12:25:00.000000Z",
            user: { screen_name: "other_user" }
          }
        })
      }),
      env,
      postUrl
    );

    const statusUrl = new URL("https://antigravityreset.app/api/webhook/x/status?token=test-secret-123");
    const statusRes = await handleXWebhook(
      new Request(statusUrl.toString(), { method: "GET" }),
      env,
      statusUrl
    );
    expect(statusRes.status).toBe(200);
    const body = (await statusRes.json()) as {
      ok: boolean;
      total_events: number;
      last_delivery: { received: number; added: number; skipped: number; results: Array<{ id: string; status: string }> };
    };
    expect(body.ok).toBe(true);
    expect(body.total_events).toBe(7);
    expect(body.last_delivery.received).toBe(1);
    expect(body.last_delivery.skipped).toBe(1);
    expect(body.last_delivery.results[0]).toMatchObject({ id: "999000111222333888", status: "skipped" });
  });

  it("rejects non-reset tweets via AI and pre-filters retweets, replies to others, unknown authors, and duplicates", async () => {
    const { kv, store } = createMockKv();
    const env = createEnv(kv);
    const fetchMock = mockAiResponse({
      is_reset: false,
      confidence: 0.92,
      reason: "General product celebration without quota reset",
      models: []
    });

    const url = new URL("https://antigravityreset.app/api/webhook/x?token=test-secret-123");
    const res = await handleXWebhook(
      new Request(url.toString(), {
        method: "POST",
        body: JSON.stringify({
          event_type: "tweet",
          tweets: [
            { id: "1", text: "Hello", author: { userName: "random_user" } },
            { id: "2", text: "RT @_mohansolo: Resetting...", isRetweet: true, author: { userName: "_mohansolo" } },
            {
              id: "3",
              text: "@alice happy birthday!",
              inReplyToUsername: "alice",
              author: { userName: "_mohansolo" }
            },
            { id: "2125851902009311306", text: "Duplicate seed", author: { userName: "_mohansolo" } },
            {
              id: "999000111222333555",
              text: "Loving how fast Neon feels today!",
              inReplyToUsername: "_mohansolo", // self-reply allowed to reach AI
              author: { userName: "_mohansolo" }
            }
          ]
        })
      }),
      env,
      url,
      { fetchFn: fetchMock }
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      added: number;
      skipped: number;
      results: Array<{ id: string; status: string }>;
    };
    expect(body.added).toBe(0);
    expect(body.skipped).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body.results.find((r) => r.id === "999000111222333555")?.status).toBe("rejected_ai");

    const stored = JSON.parse(store.get(DATASET_KV_KEY)!) as RawDataset;
    expect(stored.events).toHaveLength(7);
  });

  it("supports dryRun=1 without mutating KV and parses SSE fallback responses", async () => {
    const { kv, store } = createMockKv();
    const env = createEnv(kv);
    const sseBody = [
      'data: {"choices":[{"delta":{"content":"{\\"is_reset\\":true,"}}]}',
      'data: {"choices":[{"delta":{"content":"\\"confidence\\":0.9,\\"reason\\":\\"ok\\",\\"models\\":[\\"Gemini\\"],\\"translations\\":{\\"zh-CN\\":\\"测试\\"}}"}}]}',
      "data: [DONE]"
    ].join("\n\n");

    const sseFetch = vi.fn<typeof fetch>(async () => new Response(sseBody, { status: 200 }));

    const url = new URL("https://antigravityreset.app/api/webhook/x?token=test-secret-123&dryRun=1");
    const res = await handleXWebhook(
      new Request(url.toString(), {
        method: "POST",
        body: JSON.stringify({
          id: "999000111222333777",
          author: "_mohansolo",
          text: "Resetting Gemini quota for everyone!"
        })
      }),
      env,
      url,
      { fetchFn: sseFetch }
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { dry_run: boolean; results: Array<{ status: string }> };
    expect(body.dry_run).toBe(true);
    expect(body.results[0].status).toBe("would_add");
    expect(store.has(DATASET_KV_KEY)).toBe(false);

    const directAi = await classifyResetTweet(
      {
        text: "Resetting Gemini quota!",
        author: "_mohansolo",
        announcedAt: "2026-11-26T12:00:00.000Z",
        sourceUrl: "https://x.com/_mohansolo/status/1"
      },
      { apiKey: "sk-test", fetchFn: sseFetch }
    );
    expect(directAi.is_reset).toBe(true);
    expect(directAi.translations["zh-CN"]).toBe("测试");
  });
});
