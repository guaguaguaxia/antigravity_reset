import type { WorkerEnv } from "../api/handlers";
import type { RawResetEvent } from "../data/repository";
import { resetDetailPath } from "../i18n";
import { escapeHtml } from "../render/html";

const BASE_URL = "https://antigravityreset.app";

export interface TelegramBroadcastResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

export async function broadcastResetToTelegram(
  event: RawResetEvent,
  env: WorkerEnv,
  fetchFn: typeof fetch = fetch
): Promise<TelegramBroadcastResult> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    return { sent: false, skipped: true };
  }

  const scope = event.models.length > 0 ? event.models.join(", ") : "All Models";
  const detailUrl = `${BASE_URL}${resetDetailPath(event.id, "en")}`;
  const messageHtml = [
    `<b>Antigravity Reset (${escapeHtml(scope)})</b>`,
    "",
    escapeHtml(event.text),
    "",
    `<a href="${escapeHtml(detailUrl)}">Details &amp; Stats</a> · <a href="${escapeHtml(event.sourceUrl)}">View on X</a>`
  ].join("\n");

  try {
    const res = await fetchFn(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageHtml,
        parse_mode: "HTML",
        disable_web_page_preview: false
      })
    });
    if (!res.ok) {
      return { sent: false, error: `Telegram API HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Telegram error";
    return { sent: false, error: message };
  }
}
