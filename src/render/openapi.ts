import { LOCALES } from "../i18n";

export function renderOpenApiSpec(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Antigravity Reset Public API",
      version: "1.0.0",
      description:
        "Free, zero-auth public API, RSS feed, Markdown summaries, SVG status badge, and Streamable HTTP MCP server tracking official Google Antigravity quota resets from @_mohansolo.",
      contact: {
        name: "Antigravity Reset",
        url: "https://antigravityreset.app/api/docs"
      },
      license: {
        name: "MIT",
        url: "https://github.com/guaguaguaxia/antigravity_reset/blob/main/LICENSE"
      }
    },
    servers: [
      {
        url: "https://antigravityreset.app",
        description: "Production Cloudflare Workers edge API"
      }
    ],
    externalDocs: {
      description: "Public API, Attribution & Remote MCP Documentation",
      url: "https://antigravityreset.app/api/docs"
    },
    paths: {
      "/api/resets": {
        get: {
          operationId: "listResets",
          summary: "List all verified Antigravity quota resets and interval stats",
          parameters: [
            {
              name: "locale",
              in: "query",
              required: false,
              schema: { type: "string", enum: [...LOCALES], default: "en" },
              description: "Locale for display_text"
            }
          ],
          responses: {
            "200": {
              description: "Normalized reset dataset, aggregate statistics, and monitor status",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ResetPayload" }
                }
              }
            }
          }
        }
      },
      "/api/resets/{id}": {
        get: {
          operationId: "getResetById",
          summary: "Get a single Antigravity quota reset event with interval and adjacent links",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Unique reset announcement ID"
            },
            {
              name: "locale",
              in: "query",
              required: false,
              schema: { type: "string", enum: [...LOCALES], default: "en" }
            }
          ],
          responses: {
            "200": {
              description: "Single reset event with interval since previous reset",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SingleResetResponse" }
                }
              }
            },
            "404": {
              description: "Reset event not found"
            }
          }
        }
      },
      "/api/reset-requests": {
        get: {
          operationId: "getReactions",
          summary: "Get community reaction count since the latest reset",
          responses: {
            "200": {
              description: "Current cycle ID and reaction count",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      cycle_id: { type: "string" },
                      since: { type: ["string", "null"] },
                      count: { type: "integer" }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          operationId: "incrementReactions",
          summary: "Increment community reaction counter for the current cycle",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    n: { type: "integer", minimum: 1, maximum: 10, default: 1 }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Updated reaction count" }
          }
        }
      },
      "/feed.xml": {
        get: {
          operationId: "getRssFeed",
          summary: "Subscribe to verified reset announcements via RSS 2.0",
          parameters: [
            {
              name: "locale",
              in: "query",
              required: false,
              schema: { type: "string", enum: [...LOCALES], default: "en" }
            }
          ],
          responses: {
            "200": {
              description: "RSS 2.0 XML document",
              content: { "application/rss+xml": { schema: { type: "string" } } }
            }
          }
        }
      },
      "/{locale}.md": {
        get: {
          operationId: "getMarkdownSummary",
          summary: "Fetch agent-friendly localized Markdown reset summary",
          parameters: [
            {
              name: "locale",
              in: "path",
              required: true,
              schema: { type: "string", enum: [...LOCALES] }
            }
          ],
          responses: {
            "200": {
              description: "Markdown summary",
              content: { "text/markdown": { schema: { type: "string" } } }
            }
          }
        }
      },
      "/badge.svg": {
        get: {
          operationId: "getStatusBadgeSvg",
          summary: "Dynamic live SVG status badge for README and blog embeds",
          parameters: [
            {
              name: "label",
              in: "query",
              required: false,
              schema: { type: "string", maxLength: 32, default: "Antigravity Reset" }
            }
          ],
          responses: {
            "200": {
              description: "SVG status badge",
              content: { "image/svg+xml": { schema: { type: "string" } } }
            }
          }
        }
      },
      "/SKILL.md": {
        get: {
          operationId: "getAgentSkill",
          summary: "Portable Agent Skill definition for Antigravity Reset",
          responses: {
            "200": {
              description: "SKILL.md markdown file",
              content: { "text/markdown": { schema: { type: "string" } } }
            }
          }
        }
      },
      "/llms.txt": {
        get: {
          operationId: "getLlmsTxt",
          summary: "llmstxt.org index for AI agents and crawlers",
          responses: {
            "200": {
              description: "Plain text site and dataset index",
              content: { "text/plain": { schema: { type: "string" } } }
            }
          }
        }
      },
      "/mcp": {
        post: {
          operationId: "callMcpServer",
          summary: "Zero-auth remote Streamable HTTP MCP JSON-RPC 2.0 endpoint",
          responses: {
            "200": {
              description: "MCP JSON-RPC 2.0 response",
              content: { "application/json": { schema: { type: "object" } } }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        NormalizedResetEvent: {
          type: "object",
          properties: {
            id: { type: "string" },
            announced_at: { type: "string", format: "date-time" },
            source_url: { type: "string", format: "uri" },
            permalink: { type: "string", format: "uri" },
            text: { type: "string" },
            display_text: { type: "string" },
            product: { type: "string" },
            author: { type: "string" },
            models: { type: "array", items: { type: "string" } },
            verified: { type: "boolean" },
            reset_type: { type: "string", enum: ["regular", "all"] }
          }
        },
        ResetStats: {
          type: "object",
          properties: {
            total: { type: "integer" },
            last_reset_at: { type: ["string", "null"], format: "date-time" },
            avg_interval_days: { type: ["number", "null"] },
            longest_wait_days: { type: ["number", "null"] }
          }
        },
        ResetPayload: {
          type: "object",
          properties: {
            events: {
              type: "array",
              items: { $ref: "#/components/schemas/NormalizedResetEvent" }
            },
            stats: { $ref: "#/components/schemas/ResetStats" },
            monitor: {
              type: "object",
              properties: {
                state: { type: "string" },
                lastCheckAt: { type: "string", format: "date-time" },
                lastSuccessAt: { type: "string", format: "date-time" },
                intervalSeconds: { type: "integer" }
              }
            },
            updated_at: { type: "string", format: "date-time" }
          }
        },
        SingleResetResponse: {
          type: "object",
          properties: {
            event: { $ref: "#/components/schemas/NormalizedResetEvent" },
            interval_since_previous_days: { type: ["number", "null"] },
            previous_id: { type: ["string", "null"] },
            next_id: { type: ["string", "null"] },
            stats: { $ref: "#/components/schemas/ResetStats" },
            updated_at: { type: "string", format: "date-time" }
          }
        }
      }
    }
  };
}
