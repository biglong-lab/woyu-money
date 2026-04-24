/**
 * 勞健保滯納金 Service 層
 *
 * 使命：針對使用者 40% 損失專項，把「拖延成本」可視化。
 *
 * 設計：
 * - 純函式 buildAnnualLossReport：對 DB 資料套用 shared/late-fee-tracker 邏輯
 * - 依賴注入 getAnnualLossReportWith：允許單元測試注入假 fetcher
 * - 公開 API getAnnualLossReport / getTodayReminderStatus：使用預設 DB fetcher
 */

import {
  aggregateAnnualLoss,
  getReminderLevel,
  isLaborInsurance,
  shouldRemindToday,
  type AnnualLossReport,
  type LateFeeItem,
  type PaymentHistory,
  type ReminderLevel,
} from "@shared/late-fee-tracker"

// ─────────────────────────────────────────────
// DB 原始資料型別
// ─────────────────────────────────────────────

export interface UnpaidRow {
  id: number
  itemName: string
  totalAmount: string | number
  paidAmount: string | number
  dueDate: string
  fixedCategoryName: string | null
  debtCategoryName: string | null
}

export interface PaidRow {
  itemId: number
  itemName: string
  totalAmount: string | number
  amountPaid: string | number
  dueDate: string
  paymentDate: string
  fixedCategoryName: string | null
  debtCategoryName: string | null
}

export type UnpaidFetcher = () => Promise<UnpaidRow[]>
export type PaidFetcher = (year: number) => Promise<PaidRow[]>

export interface ReminderStatus {
  today: string
  level: ReminderLevel
  shouldRemind: boolean
  pendingCount: number
  pendingTotalAmount: number
  pendingTotalLateFee: number
  items: Array<{
    id: number
    itemName: string
    dueDate: string
    daysOverdue: number
    unpaidAmount: number
    lateFee: number
  }>
}

// ─────────────────────────────────────────────
// 純函式：過濾勞健保 + 組裝報告
// ─────────────────────────────────────────────

function toLateFeeItem(row: UnpaidRow): LateFeeItem {
  return {
    id: row.id,
    itemName: row.itemName,
    totalAmount: Number(row.totalAmount),
    paidAmount: Number(row.paidAmount),
    dueDate: row.dueDate,
    categoryName: row.fixedCategoryName ?? row.debtCategoryName ?? null,
  }
}

function toPaymentHistory(row: PaidRow): PaymentHistory {
  return {
    itemId: row.itemId,
    itemName: row.itemName,
    totalAmount: Number(row.totalAmount),
    amountPaid: Number(row.amountPaid),
    dueDate: row.dueDate,
    paymentDate: row.paymentDate,
    categoryName: row.fixedCategoryName ?? row.debtCategoryName ?? null,
  }
}

function filterLaborInsuranceUnpaid(rows: UnpaidRow[]): LateFeeItem[] {
  return rows
    .filter((r) => isLaborInsurance(r.itemName, r.fixedCategoryName ?? r.debtCategoryName))
    .map(toLateFeeItem)
}

function filterLaborInsurancePaid(rows: PaidRow[]): PaymentHistory[] {
  return rows
    .filter((r) => isLaborInsurance(r.itemName, r.fixedCategoryName ?? r.debtCategoryName))
    .map(toPaymentHistory)
}

export function buildAnnualLossReport(
  unpaidRows: UnpaidRow[],
  paidRows: PaidRow[],
  year: number,
  asOf: Date = new Date()
): AnnualLossReport {
  const unpaidItems = filterLaborInsuranceUnpaid(unpaidRows)
  const paidHistory = filterLaborInsurancePaid(paidRows)
  return aggregateAnnualLoss(unpaidItems, paidHistory, year, asOf)
}

// ─────────────────────────────────────────────
// 依賴注入版本（單元測試友善）
// ─────────────────────────────────────────────

export async function getAnnualLossReportWith(
  unpaidFetcher: UnpaidFetcher,
  paidFetcher: PaidFetcher,
  year: number = new Date().getFullYear(),
  asOf: Date = new Date()
): Promise<AnnualLossReport> {
  const [unpaidRows, paidRows] = await Promise.all([unpaidFetcher(), paidFetcher(year)])
  return buildAnnualLossReport(unpaidRows, paidRows, year, asOf)
}

export async function getTodayReminderStatusWith(
  unpaidFetcher: UnpaidFetcher,
  today: Date = new Date()
): Promise<ReminderStatus> {
  const level = getReminderLevel(today)
  const rows = await unpaidFetcher()
  const items = filterLaborInsuranceUnpaid(rows)

  const detailed = items.map((item) => {
    const dueDate = new Date(item.dueDate)
    const daysOverdue = Math.max(0, Math.round((today.getTime() - dueDate.getTime()) / 86_400_000))
    const unpaid = Math.max(0, item.totalAmount - item.paidAmount)
    const lateFee = unpaid * (item.lateFeeRate ?? 0.003) * daysOverdue
    return {
      id: item.id,
      itemName: item.itemName,
      dueDate: item.dueDate,
      daysOverdue,
      unpaidAmount: unpaid,
      lateFee: Math.round(lateFee * 100) / 100,
    }
  })

  const pendingTotalAmount = detailed.reduce((sum, it) => sum + it.unpaidAmount, 0)
  const pendingTotalLateFee = detailed.reduce((sum, it) => sum + it.lateFee, 0)

  return {
    today: today.toISOString().slice(0, 10),
    level,
    shouldRemind: shouldRemindToday(today),
    pendingCount: detailed.length,
    pendingTotalAmount,
    pendingTotalLateFee: Math.round(pendingTotalLateFee * 100) / 100,
    items: detailed.sort((a, b) => b.daysOverdue - a.daysOverdue),
  }
}

// ─────────────────────────────────────────────
// DB 查詢（預設 fetcher，延遲載入 db）
// ─────────────────────────────────────────────

const UNPAID_SQL = `
  SELECT
    pi.id,
    pi.item_name AS "itemName",
    pi.total_amount AS "totalAmount",
    COALESCE(pi.paid_amount, 0) AS "paidAmount",
    COALESCE(
      (
        SELECT ps.scheduled_date::text
        FROM payment_schedules ps
        WHERE ps.payment_item_id = pi.id
          AND ps.status != 'completed'
        ORDER BY ps.scheduled_date ASC
        LIMIT 1
      ),
      pi.end_date::text,
      pi.start_date::text
    ) AS "dueDate",
    fc.category_name AS "fixedCategoryName",
    dc.category_name AS "debtCategoryName"
  FROM payment_items pi
  LEFT JOIN fixed_categories fc ON pi.fixed_category_id = fc.id
  LEFT JOIN debt_categories dc ON pi.category_id = dc.id
  WHERE pi.is_deleted = false
    AND COALESCE(pi.status, 'pending') != 'paid'
    AND (pi.total_amount::numeric - COALESCE(pi.paid_amount, 0)::numeric) > 0
`

const PAID_SQL = `
  SELECT
    pr.payment_item_id AS "itemId",
    pi.item_name AS "itemName",
    pi.total_amount AS "totalAmount",
    pr.amount_paid AS "amountPaid",
    COALESCE(pi.end_date::text, pi.start_date::text) AS "dueDate",
    pr.payment_date::text AS "paymentDate",
    fc.category_name AS "fixedCategoryName",
    dc.category_name AS "debtCategoryName"
  FROM payment_records pr
  INNER JOIN payment_items pi ON pi.id = pr.payment_item_id
  LEFT JOIN fixed_categories fc ON pi.fixed_category_id = fc.id
  LEFT JOIN debt_categories dc ON pi.category_id = dc.id
  WHERE pi.is_deleted = false
    AND EXTRACT(YEAR FROM COALESCE(pi.end_date, pi.start_date)) = $1
`

export async function fetchUnpaidFromDb(): Promise<UnpaidRow[]> {
  const { pool } = await import("../db")
  const result = await pool.query<UnpaidRow>(UNPAID_SQL)
  return result.rows
}

export async function fetchPaidFromDb(year: number): Promise<PaidRow[]> {
  const { pool } = await import("../db")
  const result = await pool.query<PaidRow>(PAID_SQL, [year])
  return result.rows
}

// ─────────────────────────────────────────────
// 公開 API
// ─────────────────────────────────────────────

export async function getAnnualLossReport(
  year: number = new Date().getFullYear(),
  asOf: Date = new Date()
): Promise<AnnualLossReport> {
  return getAnnualLossReportWith(fetchUnpaidFromDb, fetchPaidFromDb, year, asOf)
}

export async function getTodayReminderStatus(today: Date = new Date()): Promise<ReminderStatus> {
  return getTodayReminderStatusWith(fetchUnpaidFromDb, today)
}
