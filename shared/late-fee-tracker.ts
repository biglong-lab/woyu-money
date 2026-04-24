/**
 * 勞健保滯納金追蹤（前後端共用）
 *
 * 解決使用者實際痛點：
 *   「勞健保費用 30~40 萬中有 40% 以上是滯納金」
 *
 * 核心能力：
 *   - 識別勞健保項目（共用 payment-priority 的分類邏輯）
 *   - 計算未付項目持續累積的滯納金（到今日）
 *   - 計算已付項目的歷史滯納金（付款日晚於到期日的損失）
 *   - 年度損失儀表（讓使用者看到痛處）
 *   - 依日期判斷提醒等級（20/25/28 三層）
 *
 * 提醒排程（勞健保每月 25 日截止 → 提前 5 天開始提醒）：
 *   20 日 → early   （首次提醒，距截止 5 天）
 *   21~24 → early
 *   25 日 → warning（截止日，尚未付款警告）
 *   26~27 → warning
 *   28 日 → final  （已逾期 3 天，最後警告）
 *   29~31 → final
 */

import { CATEGORY_RULES, classifyItem } from "./payment-priority"

// ─────────────────────────────────────────────
// 常數
// ─────────────────────────────────────────────

export const LABOR_INSURANCE_LATE_FEE_RATE = CATEGORY_RULES.labor_insurance.lateFeeRate

// 每月勞健保截止日（台灣勞保局 / 健保署實務）
export const LABOR_INSURANCE_DUE_DAY = 25

export type ReminderLevel = "none" | "early" | "warning" | "final"
export type LateFeeStatus = "unpaid" | "paid_late" | "paid_on_time"

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────

export interface LateFeeItem {
  id: number
  itemName: string
  totalAmount: number
  paidAmount: number
  dueDate: string // ISO
  categoryName?: string | null
  lateFeeRate?: number // 每日滯納金率，預設使用 labor_insurance
}

export interface PaymentHistory {
  itemId: number
  itemName: string
  totalAmount: number
  amountPaid: number
  dueDate: string // ISO
  paymentDate: string // ISO
  categoryName?: string | null
  lateFeeRate?: number
}

export interface AnnualLossItem {
  itemId: number
  itemName: string
  dueDate: string
  paymentDate?: string
  daysOverdue: number
  amount: number
  lateFee: number
  status: LateFeeStatus
}

export interface AnnualLossReport {
  year: number
  itemCount: number
  totalPrincipal: number
  totalLateFee: number
  lossPercentage: number
  items: AnnualLossItem[]
  generatedAt: Date
}

// ─────────────────────────────────────────────
// 輔助
// ─────────────────────────────────────────────

function toStartOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function daysBetween(from: Date, to: Date): number {
  const ms = 86_400_000
  return Math.round((toStartOfDay(to).getTime() - toStartOfDay(from).getTime()) / ms)
}

function getYearFromDueDate(dueDate: string): number {
  return new Date(dueDate).getFullYear()
}

function effectiveRate(override?: number): number {
  return override ?? LABOR_INSURANCE_LATE_FEE_RATE
}

// ─────────────────────────────────────────────
// 分類辨識
// ─────────────────────────────────────────────

export function isLaborInsurance(itemName: string, categoryName?: string | null): boolean {
  if (!itemName && !categoryName) return false
  const category = classifyItem({
    id: 0,
    itemName: itemName ?? "",
    totalAmount: 0,
    paidAmount: 0,
    dueDate: new Date().toISOString().slice(0, 10),
    debtCategoryName: categoryName,
    fixedCategoryName: categoryName,
  })
  return category === "labor_insurance"
}

// ─────────────────────────────────────────────
// 單筆滯納金計算
// ─────────────────────────────────────────────

export function calculateUnpaidLateFee(item: LateFeeItem, asOf: Date = new Date()): number {
  const unpaid = Math.max(0, item.totalAmount - item.paidAmount)
  if (unpaid <= 0) return 0

  const dueDate = new Date(item.dueDate)
  const daysOverdue = Math.max(0, daysBetween(dueDate, asOf))
  if (daysOverdue <= 0) return 0

  return unpaid * effectiveRate(item.lateFeeRate) * daysOverdue
}

export function calculatePaidLateFee(history: PaymentHistory): number {
  const dueDate = new Date(history.dueDate)
  const paymentDate = new Date(history.paymentDate)
  const daysOverdue = daysBetween(dueDate, paymentDate)
  if (daysOverdue <= 0) return 0

  return history.amountPaid * effectiveRate(history.lateFeeRate) * daysOverdue
}

// ─────────────────────────────────────────────
// 年度損失報告
// ─────────────────────────────────────────────

function unpaidToAnnualItem(item: LateFeeItem, asOf: Date): AnnualLossItem {
  const dueDate = new Date(item.dueDate)
  const daysOverdue = Math.max(0, daysBetween(dueDate, asOf))
  const unpaid = Math.max(0, item.totalAmount - item.paidAmount)
  return {
    itemId: item.id,
    itemName: item.itemName,
    dueDate: item.dueDate,
    daysOverdue,
    amount: unpaid,
    lateFee: calculateUnpaidLateFee(item, asOf),
    status: "unpaid",
  }
}

function paidToAnnualItem(history: PaymentHistory): AnnualLossItem {
  const dueDate = new Date(history.dueDate)
  const paymentDate = new Date(history.paymentDate)
  const daysOverdue = Math.max(0, daysBetween(dueDate, paymentDate))
  const lateFee = calculatePaidLateFee(history)
  const status: LateFeeStatus = daysOverdue > 0 ? "paid_late" : "paid_on_time"
  return {
    itemId: history.itemId,
    itemName: history.itemName,
    dueDate: history.dueDate,
    paymentDate: history.paymentDate,
    daysOverdue,
    amount: history.amountPaid,
    lateFee,
    status,
  }
}

export function aggregateAnnualLoss(
  unpaidItems: LateFeeItem[],
  paidHistory: PaymentHistory[],
  year: number,
  asOf: Date = new Date()
): AnnualLossReport {
  const filteredUnpaid = unpaidItems.filter((i) => getYearFromDueDate(i.dueDate) === year)
  const filteredPaid = paidHistory.filter((h) => getYearFromDueDate(h.dueDate) === year)

  const items: AnnualLossItem[] = [
    ...filteredUnpaid.map((i) => unpaidToAnnualItem(i, asOf)),
    ...filteredPaid.map(paidToAnnualItem),
  ]

  const totalPrincipal = items.reduce((sum, r) => sum + r.amount, 0)
  const totalLateFee = items.reduce((sum, r) => sum + r.lateFee, 0)
  const lossPercentage = totalPrincipal > 0 ? (totalLateFee / totalPrincipal) * 100 : 0

  return {
    year,
    itemCount: items.length,
    totalPrincipal: Math.round(totalPrincipal * 100) / 100,
    totalLateFee: Math.round(totalLateFee * 100) / 100,
    lossPercentage: Math.round(lossPercentage * 100) / 100,
    items: items.sort((a, b) => b.lateFee - a.lateFee),
    generatedAt: asOf,
  }
}

// ─────────────────────────────────────────────
// 提醒等級判斷
// ─────────────────────────────────────────────

export function getReminderLevel(today: Date = new Date()): ReminderLevel {
  const day = today.getDate()
  if (day < 20) return "none"
  if (day >= 20 && day <= 24) return "early"
  if (day >= 25 && day <= 27) return "warning"
  // 28~31
  return "final"
}

export function shouldRemindToday(today: Date = new Date()): boolean {
  return getReminderLevel(today) !== "none"
}
