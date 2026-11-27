import { describe, expect, it } from "vitest";
import worker from "../src/index";
import serverManifest from "../server.json";

const DUMMY_ENV = {
  ASSETS: { fetch: async () => new Response("Not Found", { status: 404 }) } as unknown as Fetcher
};

async function postMcp(body: unknown, headers: Record<string, string> = {}) {
  return worker.fetch(
    new Request("https://antigravityreset.app/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(body)
    }),
    DUMMY_ENV
  );
}

describe("Streamable HTTP MCP server & Official Registry manifest", () => {
  it("validates server.json schema constraints and websiteUrl", () => {
    expect(serverManifest.name).toBe("app.antigravityreset/antigravity-reset");
    expect(serverManifest.websiteUrl).toBe("https://antigravityreset.app");
    expect(serverManifest.description.length).toBeGreaterThan(0);
    expect(serverManifest.description.length).toBeLessThanOrEqual(100);
    expect(serverManifest.remotes[0]).toEqual({
      type: "streamable-http",
      url: "https://antigravityreset.app/mcp"
    });
  });

  it("serves /.well-known/mcp-registry-auth with 200 and Ed25519 record", async () => {
    const res = await worker.fetch(
      new Request("https://antigravityreset.app/.well-known/mcp-registry-auth"),
      DUMMY_ENV
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/^v=MCPv1; k=ed25519; p=[A-Za-z0-9+/=]+$/);
  });

  it("handles GET /mcp content negotiation and initialize/notifications lifecycle", async () => {
    const sseGet = await worker.fetch(
      new Request("https://antigravityreset.app/mcp", {
        method: "GET",
        headers: { Accept: "text/event-stream" }
      }),
      DUMMY_ENV
    );
    expect(sseGet.status).toBe(405);

    const browserGet = await worker.fetch(
      new Request("https://antigravityreset.app/mcp", {
        method: "GET",
        headers: { Accept: "text/html,application/xhtml+xml" }
      }),
      DUMMY_ENV
    );
    expect(browserGet.status).toBe(302);
    expect(browserGet.headers.get("Location")).toBe("https://antigravityreset.app/api/docs#mcp");

    const initRes = await postMcp({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0.0" }
      }
    });
    expect(initRes.status).toBe(200);
    expect(initRes.headers.get("MCP-Protocol-Version")).toBe("2025-11-25");
    const initJson = (await initRes.json()) as {
      result: {
        protocolVersion: string;
        capabilities: { tools: unknown; resources: unknown };
        serverInfo: { name: string; websiteUrl: string };
      };
    };
    expect(initJson.result.protocolVersion).toBe("2025-11-25");
    expect(initJson.result.serverInfo.name).toBe("app.antigravityreset/antigravity-reset");
    expect(initJson.result.serverInfo.websiteUrl).toBe("https://antigravityreset.app");
    expect(initJson.result.capabilities.tools).toBeTruthy();
    expect(initJson.result.capabilities.resources).toBeTruthy();

    const notifRes = await postMcp({
      jsonrpc: "2.0",
      method: "notifications/initialized"
    });
    expect(notifRes.status).toBe(202);
  });

  it("lists and executes all 4 MCP tools cleanly", async () => {
    const listRes = await postMcp({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { result: { tools: Array<{ name: string }> } };
    expect(listJson.result.tools.map((t) => t.name)).toEqual([
      "get_latest_reset",
      "list_resets",
      "search_resets",
      "get_reset_stats"
    ]);

    const latestRes = await postMcp({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_latest_reset", arguments: { locale: "zh-CN" } }
    });
    const latestJson = (await latestRes.json()) as {
      result: { structuredContent: { latest_event: { id: string; display_text: string }; stats: { total: number } } };
    };
    expect(latestJson.result.structuredContent.latest_event.id).toBe("2125851902009311306");
    expect(latestJson.result.structuredContent.latest_event.display_text).toContain("感恩节");
    expect(latestJson.result.structuredContent.stats.total).toBe(7);

    const filteredRes = await postMcp({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "list_resets", arguments: { model: "Argon", reset_type: "all" } }
    });
    const filteredJson = (await filteredRes.json()) as {
      result: { structuredContent: { total_matching: number; events: Array<{ models: string[] }> } };
    };
    expect(filteredJson.result.structuredContent.total_matching).toBe(2);

    const searchRes = await postMcp({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "search_resets", arguments: { query: "Thanksgiving" } }
    });
    const searchJson = (await searchRes.json()) as {
      result: { structuredContent: { total_matches: number; events: Array<{ id: string }> } };
    };
    expect(searchJson.result.structuredContent.total_matches).toBe(1);
    expect(searchJson.result.structuredContent.events[0].id).toBe("2125851902009311306");

    const statsRes = await postMcp({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "get_reset_stats", arguments: {} }
    });
    const statsJson = (await statsRes.json()) as {
      result: {
        structuredContent: {
          stats: { total: number; avg_interval_days: number };
          breakdown: { by_reset_type: { regular: number; all: number } };
          api_endpoints: { openapi: string; skill: string; llms: string; badge: string };
        };
      };
    };
    expect(statsJson.result.structuredContent.stats.total).toBe(7);
    expect(statsJson.result.structuredContent.breakdown.by_reset_type).toEqual({ regular: 4, all: 3 });
    expect(statsJson.result.structuredContent.api_endpoints.openapi).toBe("https://antigravityreset.app/openapi.json");
    expect(statsJson.result.structuredContent.api_endpoints.skill).toBe("https://antigravityreset.app/SKILL.md");
    expect(statsJson.result.structuredContent.api_endpoints.llms).toBe("https://antigravityreset.app/llms.txt");
    expect(statsJson.result.structuredContent.api_endpoints.badge).toBe("https://antigravityreset.app/badge.svg");
  });

  it("lists and reads MCP resources", async () => {
    const listRes = await postMcp({ jsonrpc: "2.0", id: 7, method: "resources/list" });
    const listJson = (await listRes.json()) as { result: { resources: Array<{ uri: string }> } };
    expect(listJson.result.resources.map((r) => r.uri)).toEqual([
      "antigravity://resets/latest.json",
      "antigravity://resets/summary.md",
      "antigravity://resets/summary.zh-CN.md"
    ]);

    const readJsonRes = await postMcp({
      jsonrpc: "2.0",
      id: 8,
      method: "resources/read",
      params: { uri: "antigravity://resets/latest.json" }
    });
    const readJson = (await readJsonRes.json()) as {
      result: { contents: Array<{ mimeType: string; text: string }> };
    };
    expect(readJson.result.contents[0].mimeType).toBe("application/json");
    expect(JSON.parse(readJson.result.contents[0].text).stats.total).toBe(7);

    const readMdRes = await postMcp({
      jsonrpc: "2.0",
      id: 9,
      method: "resources/read",
      params: { uri: "antigravity://resets/summary.zh-CN.md" }
    });
    const readMd = (await readMdRes.json()) as {
      result: { contents: Array<{ mimeType: string; text: string }> };
    };
    expect(readMd.result.contents[0].mimeType).toBe("text/markdown");
    expect(readMd.result.contents[0].text).toContain("Antigravity Reset");
  });
});
