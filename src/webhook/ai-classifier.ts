import type { EventTranslations } from "../data/translations";

export interface AiClassificationInput {
  text: string;
  author: string;
  announcedAt: string;
  sourceUrl: string;
}

export interface AiClassifierConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetchFn?: typeof fetch;
}

export interface AiClassificationResult {
  is_reset: boolean;
  confidence: number;
  reason: string;
  models: string[];
  translations: EventTranslations;
}

const DEFAULT_BASE_URL = "https://api.apimart.ai/v1";
const DEFAULT_MODEL = "gpt-6-luna";
const AI_TIMEOUT_MS = 20_000;
const TARGET_TRANSLATION_LOCALES = ["zh-CN", "zh-TW", "ja", "ko"] as const;

const SYSTEM_PROMPT = `You are a precise classifier and translator for Antigravity Reset (antigravityreset.app), tracking official Google Antigravity quota reset announcements from @_mohansolo on X.

Given a single post from X, decide whether it is an authentic, active or completed quota reset announcement for Google Antigravity users.
- Return is_reset: true ONLY when the post clearly states that user quotas/limits on Antigravity (or Gemini/Argon/etc. on Antigravity) are being reset, have been reset, or were just reset.
- Return is_reset: false for jokes, memes, unrelated product updates, feature launches without a quota reset, questions, user complaints, or vague speculation about future resets.
- Extract models as an array of canonical model family names explicitly reset (e.g. ["Gemini"], ["Gemini", "Argon"]). Return [] (empty array) when the announcement explicitly resets all models / across all models without limiting to specific model families.
- If is_reset is true, produce natural, accurate translations in "zh-CN", "zh-TW", "ja", and "ko". Keep product/model/tier names ("Antigravity", "Gemini", "Argon", "Carbon", "Hydrogen", "Neon", "Pro", "swarms", "swarm") in English, and preserve paragraph breaks and emojis. If is_reset is false, "translations" may be {}.

Respond with a single strict JSON object matching:
{
  "is_reset": boolean,
  "confidence": number, // 0.0 to 1.0
  "reason": string,     // short explanation in English
  "models": string[],   // e.g. ["Gemini"] or [] for all-model reset
  "translations": {
    "zh-CN": string,
    "zh-TW": string,
    "ja": string,
    "ko": string
  }
}`;

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

function extractMessageContent(rawBody: string): string {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    throw new Error("APIMart returned an empty response body.");
  }

  // Defensive SSE fallback in case an upstream proxy forces streaming chunks.
  if (trimmed.startsWith("data:")) {
    let assembled = "";
    for (const line of trimmed.split(/\r?\n/)) {
      const clean = line.trim();
      if (!clean.startsWith("data:")) continue;
      const payload = clean.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
        };
        const part = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content;
        if (typeof part === "string") assembled += part;
      } catch {
        // Ignore non-JSON control frames in SSE stream.
      }
    }
    if (!assembled.trim()) {
      throw new Error("APIMart SSE stream contained no assistant content.");
    }
    return stripCodeFences(assembled);
  }

  const parsed = JSON.parse(trimmed) as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    error?: { message?: string };
  };

  if (parsed.error?.message) {
    throw new Error(`APIMart API error: ${parsed.error.message}`);
  }

  const content = parsed.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return stripCodeFences(content);
  }
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("");
    if (joined.trim()) {
      return stripCodeFences(joined);
    }
  }

  throw new Error("APIMart response did not include choices[0].message.content.");
}

function sanitizeClassification(raw: unknown): AiClassificationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("AI classification JSON must be an object.");
  }
  const obj = raw as Record<string, unknown>;

  const isReset = Boolean(obj.is_reset);
  const rawConfidence = typeof obj.confidence === "number" && Number.isFinite(obj.confidence) ? obj.confidence : 0;
  const confidence = Math.max(0, Math.min(1, rawConfidence));
  const reason = typeof obj.reason === "string" ? obj.reason.trim() : "";

  const seenModels = new Set<string>();
  const models: string[] = [];
  if (Array.isArray(obj.models)) {
    for (const item of obj.models) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed || /^all(\s+models?)?$/i.test(trimmed)) continue;
      const key = trimmed.toLowerCase();
      if (!seenModels.has(key)) {
        seenModels.add(key);
        models.push(trimmed);
      }
    }
  }

  const translations: EventTranslations = {};
  if (obj.translations && typeof obj.translations === "object" && !Array.isArray(obj.translations)) {
    const rawTranslations = obj.translations as Record<string, unknown>;
    for (const locale of TARGET_TRANSLATION_LOCALES) {
      const value = rawTranslations[locale];
      if (typeof value === "string" && value.trim().length > 0) {
        translations[locale] = value.trim();
      }
    }
  }

  return {
    is_reset: isReset,
    confidence,
    reason,
    models,
    translations
  };
}

/** Classify an incoming X post and generate localized reset translations using APIMart Chat Completions. */
export async function classifyResetTweet(
  input: AiClassificationInput,
  config: AiClassifierConfig
): Promise<AiClassificationResult> {
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = config.model || DEFAULT_MODEL;
  const fetchImpl = config.fetchFn ?? fetch;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        stream: false,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              author: input.author,
              announcedAt: input.announcedAt,
              sourceUrl: input.sourceUrl,
              text: input.text
            })
          }
        ]
      }),
      signal: controller.signal
    });

    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(`APIMart HTTP ${response.status}: ${rawBody.slice(0, 300)}`);
    }

    const content = extractMessageContent(rawBody);
    const parsedJson = JSON.parse(content) as unknown;
    return sanitizeClassification(parsedJson);
  } finally {
    clearTimeout(timeoutId);
  }
}
