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
