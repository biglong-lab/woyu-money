/**
 * LINE Bot utils（前後端共用純函式）
 *
 * 第 6 步核心：讓使用者在 LINE 直接收到每日應付清單，回覆「1」即可標記已付。
 *
 * 兩大純函式：
 * - buildDailyDigestMessage：產生 LINE 訊息 payload
 * - parseReplyCommand：解析使用者回覆「1」「1 延 3」「help」等
 *
 * webhook route 等 LINE_BOT_CHANNEL_ACCESS_TOKEN 到位後補上（server/routes/line-webhook.ts）。
 */

export interface DailyItem {
  id: number
  itemName: string
  unpaidAmount: number
  daysOverdue: number
  urgency: "critical" | "high" | "medium" | "low"
  projectName?: string
  dailyLateFee?: number
}

export interface LineTextMessage {
  type: "text"
  text: string
}

export type LineMessage = LineTextMessage

// ─────────────────────────────────────────────
// 訊息建構
// ─────────────────────────────────────────────

function formatCurrency(n: number): string {
  return Math.round(n).toLocaleString()
}

function formatMonthDay(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const URGENCY_ICON: Record<DailyItem["urgency"], string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
}

function renderItemLine(item: DailyItem, index: number): string {
  const icon = URGENCY_ICON[item.urgency]
  const suffix = item.daysOverdue > 0 ? `（逾期 ${item.daysOverdue} 天）` : ""
  const extra =
    item.dailyLateFee && item.dailyLateFee > 0
      ? `\n   每拖一天 +$${formatCurrency(item.dailyLateFee)}`
      : ""
  return `${index}. ${icon} ${item.itemName}\n   NT$ ${formatCurrency(item.unpaidAmount)}${suffix}${extra}`
}

export function buildDailyDigestMessage(items: DailyItem[], today: Date = new Date()): LineMessage {
  const date = formatMonthDay(today)

  if (items.length === 0) {
    return {
      type: "text",
      text: `📅 ${date} 早安！\n\n✅ 今天沒有待處理項目，可以放鬆一下。`,
    }
  }

  const total = items.reduce((sum, it) => sum + it.unpaidAmount, 0)
  const lines = items.map((item, idx) => renderItemLine(item, idx + 1))
  const body = lines.join("\n\n")

  return {
    type: "text",
    text:
      `📅 ${date} 早安！今天 ${items.length} 件事：\n\n` +
      `${body}\n\n` +
      `💰 合計：NT$ ${formatCurrency(total)}\n\n` +
      `━━━━━━━━━━\n` +
      `回覆：\n` +
      `「1」= 第 1 筆已付款\n` +
      `「1 延 3」= 第 1 筆延後 3 天\n` +
      `「help」= 說明`,
  }
}

// ─────────────────────────────────────────────
// 回覆解析
// ─────────────────────────────────────────────

export type ParsedCommand =
  | { type: "mark_paid"; index: number }
  | { type: "defer"; index: number; deferDays: number }
  | { type: "help" }
  | { type: "unknown"; raw: string }

const MAX_INDEX = 99
const MAX_DEFER_DAYS = 30

function isValidIndex(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_INDEX
}

function isValidDeferDays(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_DEFER_DAYS
}

export function parseReplyCommand(raw: string): ParsedCommand {
  const text = (raw ?? "").trim()
  if (!text) return { type: "unknown", raw }

  const lower = text.toLowerCase()
  if (lower === "help" || text === "？" || text === "?") {
    return { type: "help" }
  }

  // "1 延 3" 或 "1 延3"
  const deferMatch = text.match(/^(\d+)\s*延\s*(\d+)$/)
  if (deferMatch) {
    const index = Number(deferMatch[1])
    const days = Number(deferMatch[2])
    if (isValidIndex(index) && isValidDeferDays(days)) {
      return { type: "defer", index, deferDays: days }
    }
    return { type: "unknown", raw }
  }

  // 純數字 "1"
  const numMatch = text.match(/^\d+$/)
  if (numMatch) {
    const index = Number(text)
    if (isValidIndex(index)) {
      return { type: "mark_paid", index }
    }
    return { type: "unknown", raw }
  }

  return { type: "unknown", raw }
}
