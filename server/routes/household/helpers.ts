/**
 * family-kids 共用 helpers（自 family-kids.ts 機械拆分，2026-07-03）
 * multer 圖片上傳、月零用金補發、三罐、徽章、連續打卡、批量批准
 */
import { localMonthTPE } from "@shared/date-utils"

export function parseYearMonth(monthStr: string | undefined): { year: number; month: number } {
  const ym = monthStr && /^\d{4}-\d{2}$/.test(monthStr) ? monthStr : localMonthTPE()
  const [y, m] = ym.split("-").map(Number)
  return { year: y, month: m }
}

/**
 * 「總預算」用 categoryId = 0 作為哨兵值（schema categoryId NOT NULL、又不想做 migration）
 * 之後階段 2 要做分類預算時、categoryId > 0 即為分類預算、與總預算共存
 */
export const TOTAL_BUDGET_CATEGORY_ID = 0

export function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
