import seedData from "./resets.json";
import { getLocalizedEventText, type EventTranslations } from "./translations";
import { resetDetailPath, type Locale } from "../i18n";

const BASE_URL = "https://antigravityreset.app";

export interface RawResetEvent {
  id: string;
  announcedAt: string;
  sourceUrl: string;
  text: string;
  product: string;
  author: string;
  models: string[];
  verified: boolean;
  translations?: EventTranslations;
}

export interface RawMonitorState {
  state: string;
  lastCheckAt: string;
  lastSuccessAt: string;
  intervalSeconds: number;
}

export interface RawDataset {
  events: RawResetEvent[];
  monitor: RawMonitorState;
}

export type ResetKind = "regular" | "all";

export interface NormalizedResetEvent {
  id: string;
  announced_at: string;
  source_url: string;
  permalink: string;
  text: string;
  display_text: string;
  product: string;
  author: string;
  models: string[];
  verified: boolean;
  reset_type: ResetKind;
}

export interface ResetStats {
  total: number;
  last_reset_at: string | null;
  avg_interval_days: number | null;
  longest_wait_days: number | null;
}

export interface ResetPayload {
  events: NormalizedResetEvent[];
  stats: ResetStats;
  monitor: RawMonitorState;
  updated_at: string;
}

export interface RepositoryEnv {
  ANTIGRAVITY_KV?: KVNamespace;
}

const DAY_MS = 86_400_000;
export const DATASET_KV_KEY = "resets:dataset";

/** Classify single-model resets as "regular" and multi-model / all-model resets as "all". */
export function classifyResetType(models: string[]): ResetKind {
  return models.length === 0 || models.length > 1 ? "all" : "regular";
}

export function computeStats(events: ReadonlyArray<{ announced_at: string }>): ResetStats {
  if (events.length === 0) {
    return {
      total: 0,
      last_reset_at: null,
      avg_interval_days: null,
      longest_wait_days: null
    };
  }

  const timestamps = events
    .map((event) => Date.parse(event.announced_at))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);

  const newestMs = timestamps[timestamps.length - 1];
  let totalDiff = 0;
  let maxDiff = 0;
  for (let i = 1; i < timestamps.length; i += 1) {
    const diff = timestamps[i] - timestamps[i - 1];
    totalDiff += diff;
    if (diff > maxDiff) maxDiff = diff;
  }

  const intervalCount = Math.max(0, timestamps.length - 1);
  return {
    total: events.length,
    last_reset_at: Number.isFinite(newestMs) ? new Date(newestMs).toISOString() : null,
    avg_interval_days: intervalCount > 0 ? Number((totalDiff / intervalCount / DAY_MS).toFixed(1)) : null,
    longest_wait_days: intervalCount > 0 ? Number((maxDiff / DAY_MS).toFixed(1)) : null
  };
}

function isValidIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isValidTranslations(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

function isValidEvent(item: unknown): item is RawResetEvent {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.trim().length > 0 &&
    isValidIsoTimestamp(candidate.announcedAt) &&
    typeof candidate.sourceUrl === "string" &&
    candidate.sourceUrl.startsWith("https://") &&
    typeof candidate.text === "string" &&
    typeof candidate.product === "string" &&
    typeof candidate.author === "string" &&
    Array.isArray(candidate.models) &&
    candidate.models.every((m) => typeof m === "string") &&
    typeof candidate.verified === "boolean" &&
    isValidTranslations(candidate.translations)
  );
}

export function validateIngestPayload(body: unknown): { ok: true; data: RawDataset } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const obj = body as Record<string, unknown>;
  if (!Array.isArray(obj.events) || obj.events.length === 0) {
    return { ok: false, error: "Field 'events' must be a non-empty array." };
  }
  for (let i = 0; i < obj.events.length; i += 1) {
    if (!isValidEvent(obj.events[i])) {
      return { ok: false, error: `Invalid event object at index ${i}.` };
    }
  }

  const rawMonitor = obj.monitor as Record<string, unknown> | undefined;
  const monitor: RawMonitorState =
    rawMonitor &&
    typeof rawMonitor === "object" &&
    typeof rawMonitor.state === "string" &&
    isValidIsoTimestamp(rawMonitor.lastCheckAt) &&
    isValidIsoTimestamp(rawMonitor.lastSuccessAt) &&
    typeof rawMonitor.intervalSeconds === "number"
      ? {
          state: rawMonitor.state,
          lastCheckAt: rawMonitor.lastCheckAt,
          lastSuccessAt: rawMonitor.lastSuccessAt,
          intervalSeconds: rawMonitor.intervalSeconds
        }
      : {
          state: "live",
          lastCheckAt: new Date().toISOString(),
          lastSuccessAt: new Date().toISOString(),
          intervalSeconds: (seedData as RawDataset).monitor.intervalSeconds
        };

  return {
    ok: true,
    data: {
      events: obj.events as RawResetEvent[],
      monitor
    }
  };
}

export function normalizeDataset(dataset: RawDataset, locale: Locale): ResetPayload {
  const deduped = new Map<string, RawResetEvent>();
  for (const ev of dataset.events) {
    if (isValidEvent(ev)) {
      deduped.set(ev.id, ev);
    }
  }

  const sorted = Array.from(deduped.values()).sort(
    (a, b) => Date.parse(b.announcedAt) - Date.parse(a.announcedAt)
  );

  const normalized: NormalizedResetEvent[] = sorted.map((ev) => ({
    id: ev.id,
    announced_at: new Date(Date.parse(ev.announcedAt)).toISOString(),
    source_url: ev.sourceUrl,
    permalink: `${BASE_URL}${resetDetailPath(ev.id, locale)}`,
    text: ev.text,
    display_text: getLocalizedEventText(ev.id, ev.text, locale, ev.translations),
    product: ev.product,
    author: ev.author,
    models: ev.models,
    verified: ev.verified,
    reset_type: classifyResetType(ev.models)
  }));

  return {
    events: normalized,
    stats: computeStats(normalized),
    monitor: dataset.monitor,
    updated_at: new Date().toISOString()
  };
}

/** Merge seed events with KV overrides so historical records are never lost when updating via KV. */
export async function loadDataset(env?: RepositoryEnv): Promise<RawDataset> {
  const base = seedData as RawDataset;
  if (!env?.ANTIGRAVITY_KV) {
    return base;
  }

  try {
    const kvData = await env.ANTIGRAVITY_KV.get<RawDataset>(DATASET_KV_KEY, "json");
    if (!kvData || !Array.isArray(kvData.events)) {
      return base;
    }

    const merged = new Map<string, RawResetEvent>();
    for (const ev of base.events) {
      merged.set(ev.id, ev);
    }
    for (const ev of kvData.events) {
      if (isValidEvent(ev)) {
        merged.set(ev.id, ev);
      }
    }

    return {
      events: Array.from(merged.values()),
      monitor: kvData.monitor ?? base.monitor
    };
  } catch {
    return base;
  }
}
