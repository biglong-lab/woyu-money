/**
 * 共用日期工具（前端後端都可用）
 *
 * 解決：`new Date().toISOString().split("T")[0]` 是 UTC 日期，
 * 在 TPE (UTC+8) 時區會在 00:00-08:00 期間誤認為前一天。
 *
 * 例如 TPE 2026-04-15 早上 6:00 = UTC 2026-04-14 22:00：
 * - `new Date().toISOString()` → "2026-04-14T22:00:00.000Z"
 * - 取前 10 字元 → "2026-04-14" ❌（正確應為 "2026-04-15"）
 */

const DEFAULT_TZ = "Asia/Taipei"

/**
 * 取得 TPE 時區的 YYYY-MM-DD 日期字串
 *
 * @param offsetDays 0 = 今天、-1 = 昨天、+1 = 明天
 * @param timeZone IANA 時區，預設 Asia/Taipei
 */
export function localDateTPE(offsetDays = 0, timeZone: string = DEFAULT_TZ): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  // en-CA locale 給 YYYY-MM-DD 格式
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return formatter.format(d)
}

/**
 * 取得 TPE 時區的 YYYY-MM 月份字串
 */
export function localMonthTPE(offsetMonths = 0, timeZone: string = DEFAULT_TZ): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMonths)
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  })
  return formatter.format(d) // "2026-04"
}
