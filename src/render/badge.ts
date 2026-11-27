import type { ResetPayload } from "../data/repository";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return ch;
    }
  });
}

function estimateTextWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    width += ch.charCodeAt(0) > 127 ? 11.5 : 6.7;
  }
  return Math.ceil(width);
}

function formatCompactElapsed(elapsedMs: number): string {
  if (!Number.isFinite(elapsedMs) || elapsedMs < MINUTE_MS) {
    return "just now";
  }
  if (elapsedMs < HOUR_MS) {
    return `${Math.max(1, Math.floor(elapsedMs / MINUTE_MS))}m ago`;
  }
  if (elapsedMs < DAY_MS) {
    return `${Math.max(1, Math.floor(elapsedMs / HOUR_MS))}h ago`;
  }
  return `${Math.max(1, Math.floor(elapsedMs / DAY_MS))}d ago`;
}

export interface BadgeOptions {
  label?: string | null;
  nowMs?: number;
}

export function renderStatusBadgeSvg(payload: ResetPayload, options: BadgeOptions = {}): string {
  const nowMs = options.nowMs ?? Date.now();
  const rawLabel = options.label?.trim().slice(0, 32);
  const leftText = rawLabel || "Antigravity Reset";

  const lastIso = payload.stats.last_reset_at;
  const lastMs = lastIso ? Date.parse(lastIso) : NaN;

  let rightText = "No resets";
  let rightBg = "#a5dcff";
  let rightFg = "#26201a";

  if (Number.isFinite(lastMs)) {
    const dateLabel = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    }).format(lastMs);
    const elapsedMs = Math.max(0, nowMs - lastMs);
    rightText = `${dateLabel} · ${formatCompactElapsed(elapsedMs)}`;

    if (elapsedMs < DAY_MS) {
      rightBg = "#ff5c2b";
      rightFg = "#fffdf7";
    } else if (elapsedMs <= 7 * DAY_MS) {
      rightBg = "#ffd84d";
      rightFg = "#26201a";
    } else {
      rightBg = "#a5dcff";
      rightFg = "#26201a";
    }
  }

  const leftWidth = estimateTextWidth(leftText) + 18;
  const rightWidth = estimateTextWidth(rightText) + 18;
  const totalWidth = leftWidth + rightWidth;
  const height = 22;

  const escapedLeft = escapeXml(leftText);
  const escapedRight = escapeXml(rightText);
  const ariaLabel = escapeXml(`${leftText}: ${rightText}`);
  const leftCenter = (leftWidth / 2).toFixed(1);
  const rightCenter = (leftWidth + rightWidth / 2).toFixed(1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" role="img" aria-label="${ariaLabel}">
  <title>${ariaLabel}</title>
  <clipPath id="r">
    <rect width="${totalWidth}" height="${height}" rx="4" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="${height}" fill="#26201a"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="${rightBg}"/>
  </g>
  <g text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11" font-weight="700">
    <text x="${leftCenter}" y="15" fill="#fffdf7">${escapedLeft}</text>
    <text x="${rightCenter}" y="15" fill="${rightFg}">${escapedRight}</text>
  </g>
</svg>`;
}
