import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: string | number): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(numAmount)) return "$0"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numAmount)
}

/**
 * 台幣金額格式化：`NT$ 12,345`
 *
 * 與 formatCurrency（USD）區分：本專案多數場景應使用 NT$
 * 整數化（網銀不接受小數點）、含千分位
 *
 * @param n 數字或可解析為數字的字串
 * @returns 形如 "NT$ 12,345"，無效輸入回傳 "NT$ 0"
 */
export function formatNT(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? parseFloat(n) : Number(n)
  if (!Number.isFinite(num)) return "NT$ 0"
  return `NT$ ${Math.round(num).toLocaleString()}`
}

/**
 * 本地時區的 YYYY-MM-DD（避免 UTC 跨日 bug）
 *
 * 問題：`new Date().toISOString().slice(0, 10)` 回傳 UTC 日期。
 * TPE (UTC+8) 的 00:00-08:00 期間，UTC 還是前一天，會導致：
 * - paymentDate 被送錯日期到後端
 * - 早起用戶的 streak 計算錯誤
 *
 * @param offsetDays 0 = 今天、-1 = 昨天、+1 = 明天
 */
export function localDateISO(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * API 錯誤訊息友善化
 *
 * 避免暴露技術錯誤給使用者：
 * - 離線時直接告訴使用者離線
 * - 空訊息給通用 fallback
 *
 * @param error API 拋出的 Error 物件
 * @returns 適合直接顯示在 toast description 的中文訊息
 */
export function friendlyApiError(error: Error | null | undefined): string {
  if (!navigator.onLine) {
    return "目前離線中，請等網路恢復後重試"
  }
  return error?.message?.trim() || "請稍後再試"
}
