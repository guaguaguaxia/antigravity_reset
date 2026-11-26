import type { WorkerEnv } from "../api/handlers";
import { loadDataset, normalizeDataset, type NormalizedResetEvent, type ResetPayload } from "../data/repository";
import { LOCALES, normalizeLocale, type Locale } from "../i18n";
import { renderMarkdown } from "../render/markdown";

const BASE_URL = "https://antigravityreset.app";
const SERVER_NAME = "app.antigravityreset/antigravity-reset";
const SERVER_TITLE = "Antigravity Reset";
const SERVER_VERSION = "1.0.0";
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";

const MCP_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "MCP-Protocol-Version, Mcp-Session-Id"
};

interface JsonRpcRequest {
  jsonrpc?: unknown;
  id?: string | number | null;
  method?: unknown;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};

const MCP_TOOLS = [
  {
    name: "get_latest_reset",
    title: "Get Latest Antigravity Reset",
    description:
      "Get the most recent official Google Antigravity quota reset announcement from @_mohansolo, elapsed time since reset, and overall statistics.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        locale: {
          type: "string",
          enum: [...LOCALES],
          description: "Output locale for localized text (default: en)."
        }
      }
    },
    annotations: READ_ONLY_ANNOTATIONS
  },
  {
    name: "list_resets",
    title: "List Antigravity Resets",
    description:
      "List Google Antigravity quota reset announcements with optional filtering by model name, reset_type (regular or all), locale, and limit.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        locale: {
          type: "string",
          enum: [...LOCALES],
          description: "Output locale for localized text (default: en)."
        },
        model: {
          type: "string",
          description: "Filter by model name (e.g. Gemini, Argon) or 'all' for all-model resets."
        },
        reset_type: {
          type: "string",
          enum: ["regular", "all"],
          description: "Filter by reset scope: 'regular' (single model) or 'all' (multi-model / all models)."
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          description: "Maximum number of events to return (1-50, default: 20)."
        }
      }
    },
    annotations: READ_ONLY_ANNOTATIONS
  },
  {
    name: "search_resets",
    title: "Search Antigravity Reset Announcements",
    description:
      "Search verified Antigravity quota reset announcements by keyword across English text, localized text, and model names.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          minLength: 1,
          description: "Keyword to search for (e.g. Thanksgiving, Argon, Neon, caching)."
        },
        locale: {
          type: "string",
          enum: [...LOCALES],
          description: "Output locale for localized text (default: en)."
        }
      }
    },
    annotations: READ_ONLY_ANNOTATIONS
  },
  {
    name: "get_reset_stats",
    title: "Get Antigravity Reset Statistics",
    description:
      "Get aggregate statistics on Google Antigravity quota resets: total count, average interval days, longest wait days, breakdown by model/scope, and monitor status.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    },
    annotations: READ_ONLY_ANNOTATIONS
  }
] as const;

const MCP_RESOURCES = [
  {
    uri: "antigravity://resets/latest.json",
    name: "latest-resets-json",
    title: "Latest Antigravity Resets (JSON)",
    description: "Normalized JSON dataset of all verified Google Antigravity quota resets and statistics.",
    mimeType: "application/json"
  },
  {
    uri: "antigravity://resets/summary.md",
    name: "resets-summary-en",
    title: "Antigravity Resets Summary (English Markdown)",
    description: "Human- and agent-readable Markdown summary of all Antigravity quota reset announcements.",
    mimeType: "text/markdown"
  },
  {
    uri: "antigravity://resets/summary.zh-CN.md",
    name: "resets-summary-zh-cn",
    title: "Antigravity Resets Summary (Simplified Chinese Markdown)",
    description: "Simplified Chinese Markdown summary of all Antigravity quota reset announcements.",
    mimeType: "text/markdown"
  }
] as const;

function mcpJsonResponse(body: unknown, status = 200, protocolVersion = DEFAULT_PROTOCOL_VERSION): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "MCP-Protocol-Version": protocolVersion,
      ...MCP_CORS_HEADERS
    }
  });
}

function negotiateProtocolVersion(clientVersion: unknown): string {
  if (typeof clientVersion === "string") {
    const match = (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).find((v) => v === clientVersion.trim());
    if (match) return match;
  }
  return DEFAULT_PROTOCOL_VERSION;
}

function resolveLocaleArg(args: Record<string, unknown>): Locale {
  return typeof args.locale === "string" ? (normalizeLocale(args.locale) ?? "en") : "en";
}

function matchesModel(ev: NormalizedResetEvent, modelFilter: string): boolean {
  const needle = modelFilter.trim().toLowerCase();
  if (!needle) return true;
  if (needle === "all") return ev.reset_type === "all";
  return ev.models.some((m) => m.toLowerCase().includes(needle));
}

function buildToolResponse(data: unknown) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ],
    structuredContent: data,
    isError: false
  };
}

function computeModelBreakdown(payload: ResetPayload) {
  const byModel: Record<string, number> = {};
  let regularCount = 0;
  let allScopeCount = 0;

  for (const ev of payload.events) {
    if (ev.reset_type === "all") {
      allScopeCount += 1;
    } else {
      regularCount += 1;
    }
    if (ev.models.length === 0) {
      byModel["All Models"] = (byModel["All Models"] ?? 0) + 1;
    } else {
      for (const m of ev.models) {
        byModel[m] = (byModel[m] ?? 0) + 1;
      }
    }
  }

  return {
    by_reset_type: { regular: regularCount, all: allScopeCount },
    by_model: byModel
  };
}

async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  env: WorkerEnv
): Promise<{ ok: true; payload: unknown } | { ok: false; code: number; message: string }> {
  const dataset = await loadDataset(env);

  if (name === "get_latest_reset") {
    const locale = resolveLocaleArg(args);
    const payload = normalizeDataset(dataset, locale);
    const latest = payload.events[0] ?? null;
    const elapsedMs = latest ? Date.now() - Date.parse(latest.announced_at) : NaN;
    return {
      ok: true,
      payload: {
        websiteUrl: BASE_URL,
        locale,
        latest_event: latest,
        elapsed_hours: Number.isFinite(elapsedMs) ? Number((elapsedMs / 3_600_000).toFixed(2)) : null,
        elapsed_days: Number.isFinite(elapsedMs) ? Number((elapsedMs / 86_400_000).toFixed(2)) : null,
        stats: payload.stats,
        monitor: payload.monitor
      }
    };
  }

  if (name === "list_resets") {
    const locale = resolveLocaleArg(args);
    const payload = normalizeDataset(dataset, locale);
    const modelFilter = typeof args.model === "string" ? args.model.trim() : "";
    const resetTypeFilter = args.reset_type === "regular" || args.reset_type === "all" ? args.reset_type : null;
    const rawLimit = typeof args.limit === "number" && Number.isFinite(args.limit) ? Math.round(args.limit) : 20;
    const limit = Math.max(1, Math.min(50, rawLimit));

    const filtered = payload.events
      .filter((ev) => (modelFilter ? matchesModel(ev, modelFilter) : true))
      .filter((ev) => (resetTypeFilter ? ev.reset_type === resetTypeFilter : true));

    return {
      ok: true,
      payload: {
        websiteUrl: BASE_URL,
        locale,
        total_matching: filtered.length,
        returned: Math.min(limit, filtered.length),
        events: filtered.slice(0, limit),
        stats: payload.stats
      }
    };
  }

  if (name === "search_resets") {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (!query) {
      return { ok: false, code: -32602, message: "Invalid params: 'query' must be a non-empty string." };
    }
    const locale = resolveLocaleArg(args);
    const payload = normalizeDataset(dataset, locale);
    const needle = query.toLowerCase();
    const matches = payload.events.filter(
      (ev) =>
        ev.text.toLowerCase().includes(needle) ||
        ev.display_text.toLowerCase().includes(needle) ||
        ev.models.some((m) => m.toLowerCase().includes(needle)) ||
        (needle === "all" && ev.reset_type === "all")
    );

    return {
      ok: true,
      payload: {
        websiteUrl: BASE_URL,
        locale,
        query,
        total_matches: matches.length,
        events: matches
      }
    };
  }

  if (name === "get_reset_stats") {
    const payload = normalizeDataset(dataset, "en");
    return {
      ok: true,
      payload: {
        websiteUrl: BASE_URL,
        stats: payload.stats,
        breakdown: computeModelBreakdown(payload),
        monitor: payload.monitor,
        api_endpoints: {
          json: `${BASE_URL}/api/resets`,
          rss: `${BASE_URL}/feed.xml`,
          markdown: `${BASE_URL}/en.md`,
          docs: `${BASE_URL}/api/docs`
        }
      }
    };
  }

  return { ok: false, code: -32602, message: `Unknown tool: ${name}` };
}

async function handleJsonRpcItem(
  item: JsonRpcRequest,
  env: WorkerEnv,
  headerProtocolVersion: string | null
): Promise<{ response: JsonRpcResponse | null; protocolVersion: string }> {
  const id = item.id !== undefined ? item.id : null;
  const isNotification = item.id === undefined || item.id === null;
  const method = typeof item.method === "string" ? item.method : "";
  const params =
    item.params && typeof item.params === "object" && !Array.isArray(item.params) ? item.params : {};

  if (!method) {
    return {
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      response: isNotification
        ? null
        : { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid Request: missing method" } }
    };
  }

  if (method === "initialize") {
    const negotiated = negotiateProtocolVersion(params.protocolVersion ?? headerProtocolVersion);
    return {
      protocolVersion: negotiated,
      response: {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: negotiated,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false }
          },
          serverInfo: {
            name: SERVER_NAME,
            title: SERVER_TITLE,
            version: SERVER_VERSION,
            websiteUrl: BASE_URL,
            icons: [
              {
                src: `${BASE_URL}/mohan-avatar.png`,
                mimeType: "image/png",
                sizes: ["256x256"]
              }
            ]
          },
          instructions:
            "Use these read-only tools to check the latest Google Antigravity quota reset, filter resets by model or locale, search announcements, or inspect historical reset interval stats."
        }
      }
    };
  }

  const effectiveVersion = negotiateProtocolVersion(headerProtocolVersion);

  // Notifications have no id and require no JSON-RPC result payload.
  if (isNotification || method.startsWith("notifications/")) {
    return { protocolVersion: effectiveVersion, response: null };
  }

  if (method === "ping") {
    return { protocolVersion: effectiveVersion, response: { jsonrpc: "2.0", id, result: {} } };
  }

  if (method === "tools/list") {
    return {
      protocolVersion: effectiveVersion,
      response: { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } }
    };
  }

  if (method === "tools/call") {
    const toolName = typeof params.name === "string" ? params.name : "";
    const toolArgs =
      params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
        ? (params.arguments as Record<string, unknown>)
        : {};
    const outcome = await executeToolCall(toolName, toolArgs, env);
    if (!outcome.ok) {
      return {
        protocolVersion: effectiveVersion,
        response: { jsonrpc: "2.0", id, error: { code: outcome.code, message: outcome.message } }
      };
    }
    return {
      protocolVersion: effectiveVersion,
      response: { jsonrpc: "2.0", id, result: buildToolResponse(outcome.payload) }
    };
  }

  if (method === "resources/list") {
    return {
      protocolVersion: effectiveVersion,
      response: { jsonrpc: "2.0", id, result: { resources: MCP_RESOURCES } }
    };
  }

  if (method === "resources/read") {
    const uri = typeof params.uri === "string" ? params.uri.trim() : "";
    const dataset = await loadDataset(env);

    if (uri === "antigravity://resets/latest.json") {
      const payload = normalizeDataset(dataset, "en");
      return {
        protocolVersion: effectiveVersion,
        response: {
          jsonrpc: "2.0",
          id,
          result: {
            contents: [{ uri, mimeType: "application/json", text: JSON.stringify(payload, null, 2) }]
          }
        }
      };
    }

    if (uri === "antigravity://resets/summary.md" || uri === "antigravity://resets/summary.zh-CN.md") {
      const locale: Locale = uri.endsWith(".zh-CN.md") ? "zh-CN" : "en";
      const payload = normalizeDataset(dataset, locale);
      return {
        protocolVersion: effectiveVersion,
        response: {
          jsonrpc: "2.0",
          id,
          result: {
            contents: [{ uri, mimeType: "text/markdown", text: renderMarkdown(payload, locale) }]
          }
        }
      };
    }

    return {
      protocolVersion: effectiveVersion,
      response: { jsonrpc: "2.0", id, error: { code: -32002, message: `Resource not found: ${uri}` } }
    };
  }

  return {
    protocolVersion: effectiveVersion,
    response: { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } }
  };
}

/** Handle zero-auth Streamable HTTP MCP requests at `/mcp`. */
export async function handleMcpRequest(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method === "OPTIONS" || request.method === "DELETE") {
    return new Response(null, { status: 204, headers: MCP_CORS_HEADERS });
  }

  if (request.method === "GET") {
    const accept = (request.headers.get("Accept") ?? "").toLowerCase();
    if (accept.includes("text/html") && !accept.includes("text/event-stream")) {
      return Response.redirect(`${BASE_URL}/api/docs#mcp`, 302);
    }
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "POST, OPTIONS",
        ...MCP_CORS_HEADERS
      }
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "POST, GET, DELETE, OPTIONS",
        ...MCP_CORS_HEADERS
      }
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return mcpJsonResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error: invalid JSON" } },
      400
    );
  }

  const headerProtocol = request.headers.get("MCP-Protocol-Version");

  if (Array.isArray(body)) {
    if (body.length === 0) {
      return mcpJsonResponse(
        { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request: empty batch" } },
        400
      );
    }
    const responses: JsonRpcResponse[] = [];
    let protocolVersion = negotiateProtocolVersion(headerProtocol);
    for (const entry of body) {
      const item = entry && typeof entry === "object" ? (entry as JsonRpcRequest) : {};
      const out = await handleJsonRpcItem(item, env, headerProtocol);
      protocolVersion = out.protocolVersion;
      if (out.response) responses.push(out.response);
    }
    if (responses.length === 0) {
      return new Response(null, { status: 202, headers: MCP_CORS_HEADERS });
    }
    return mcpJsonResponse(responses, 200, protocolVersion);
  }

  if (!body || typeof body !== "object") {
    return mcpJsonResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } },
      400
    );
  }

  const out = await handleJsonRpcItem(body as JsonRpcRequest, env, headerProtocol);
  if (!out.response) {
    return new Response(null, { status: 202, headers: MCP_CORS_HEADERS });
  }
  return mcpJsonResponse(out.response, 200, out.protocolVersion);
}
