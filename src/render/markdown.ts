import { createTranslator, type Locale } from "../i18n";
import type { ResetPayload } from "../data/repository";

export function renderMarkdown(payload: ResetPayload, locale: Locale): string {
  const t = createTranslator(locale);
  const latestDate = payload.stats.last_reset_at ? payload.stats.last_reset_at.slice(0, 10) : "—";
  const lines: string[] = [
    `# ${t("Antigravity Reset — Live Quota Reset Tracker & History")}`,
    "",
    t(
      "Track {count} verified Google Antigravity quota resets (latest: {date}). Browse Gemini, Argon & all-model reset history and get live alerts.",
      { count: payload.stats.total, date: latestDate }
    ),
    "",
    `- ${t("Resets")}: ${payload.stats.total}`,
    `- ${t("Avg. reset interval")}: ${
      payload.stats.avg_interval_days !== null ? `${payload.stats.avg_interval_days}d` : "—"
    }`,
    `- ${t("Longest wait")}: ${
      payload.stats.longest_wait_days !== null ? `${payload.stats.longest_wait_days}d` : "—"
    }`,
    `- Latest Reset (UTC): ${payload.stats.last_reset_at ?? "—"}`,
    "",
    `## ${t("Antigravity reset announcements")}`,
    ""
  ];

  for (const ev of payload.events) {
    const models = ev.models.length > 0 ? ev.models.join(", ") : t("All Models");
    lines.push(`### ${ev.announced_at} (${models})`);
    lines.push("");
    lines.push(ev.display_text);
    lines.push("");
    lines.push(`Details: ${ev.permalink}`);
    lines.push(`Source: ${ev.source_url}`);
    lines.push("");
  }

  return lines.join("\n");
}
