/**
 * 統一現金流匯總層 — 資料查詢（2026-07-08）
 *
 * 供 財報現金流量表 / 儀表板 YTD / 現金流預測 取得
 * 強執繳款、歷史欠款還款、卡請款到帳 的彙總數字。
 * 純唯讀聚合，不落表、不動原模組。
 */
import { db } from "../db"
import { sql } from "drizzle-orm"
import type {
  MonthlyAmount,
  ActiveInstallmentProjection,
} from "../services/unified-cashflow.service"

type SumRow = { amount: string | null }
type MonthlyRow = { year: number; month: number; amount: string; count: number }

function firstRow<T>(result: unknown): T | undefined {
  return (result as { rows: T[] }).rows[0]
}

function allRows<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows
}

function toMonthly(rows: MonthlyRow[]): MonthlyAmount[] {
  return rows.map((r) => ({
    year: Number(r.year),
    month: Number(r.month),
    amount: Number(r.amount),
    count: Number(r.count),
  }))
}

/** 期間內強執分期實繳合計 */
export async function getEnforcementPaidBetween(
  startDate: string,
  endDate: string
): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(amount::numeric), 0) AS amount
    FROM enforcement_installment_payments
    WHERE payment_date >= ${startDate} AND payment_date < ${endDate}
  `)
  return Number(firstRow<SumRow>(result)?.amount ?? 0)
}

/** 期間內歷史欠款實還合計 */
export async function getLegacyDebtPaidBetween(
  startDate: string,
  endDate: string
): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(amount::numeric), 0) AS amount
    FROM legacy_debt_payments
    WHERE pay_date >= ${startDate} AND pay_date < ${endDate}
  `)
  return Number(firstRow<SumRow>(result)?.amount ?? 0)
}

/** 期間內信用卡請款實際到帳合計（參考用、防與 PM 收入雙算，不併入總計） */
export async function getCardClaimSettledBetween(
  startDate: string,
  endDate: string
): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(COALESCE(settled_amount, amount)::numeric), 0) AS amount
    FROM card_claims
    WHERE status = 'settled'
      AND settled_date IS NOT NULL
      AND settled_date >= ${startDate} AND settled_date < ${endDate}
  `)
  return Number(firstRow<SumRow>(result)?.amount ?? 0)
}

/** 強執分期實繳 — 月度彙總 */
export async function getEnforcementPaidMonthly(
  startDate: string,
  endDate: string
): Promise<MonthlyAmount[]> {
  const result = await db.execute(sql`
    SELECT EXTRACT(YEAR FROM payment_date)::int AS year,
           EXTRACT(MONTH FROM payment_date)::int AS month,
           SUM(amount::numeric) AS amount,
           COUNT(*)::int AS count
    FROM enforcement_installment_payments
    WHERE payment_date >= ${startDate} AND payment_date < ${endDate}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `)
  return toMonthly(allRows<MonthlyRow>(result))
}

/** 歷史欠款實還 — 月度彙總 */
export async function getLegacyDebtPaidMonthly(
  startDate: string,
  endDate: string
): Promise<MonthlyAmount[]> {
  const result = await db.execute(sql`
    SELECT EXTRACT(YEAR FROM pay_date)::int AS year,
           EXTRACT(MONTH FROM pay_date)::int AS month,
           SUM(amount::numeric) AS amount,
           COUNT(*)::int AS count
    FROM legacy_debt_payments
    WHERE pay_date >= ${startDate} AND pay_date < ${endDate}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `)
  return toMonthly(allRows<MonthlyRow>(result))
}

/** active 強執分期（含已繳期數）— 給未來月投影 */
export async function getActiveInstallmentsForProjection(): Promise<ActiveInstallmentProjection[]> {
  const result = await db.execute(sql`
    SELECT ei.monthly_amount::numeric AS "monthlyAmount",
           ei.periods,
           ei.start_date AS "startDate",
           COALESCE(p.paid_months, 0)::int AS "paidCount"
    FROM enforcement_installments ei
    LEFT JOIN (
      SELECT installment_id,
             COUNT(DISTINCT TO_CHAR(payment_date, 'YYYY-MM')) AS paid_months
      FROM enforcement_installment_payments
      GROUP BY installment_id
    ) p ON p.installment_id = ei.id
    WHERE ei.status = 'active'
  `)
  return allRows<{
    monthlyAmount: string
    periods: number | null
    startDate: string | null
    paidCount: number
  }>(result).map((r) => ({
    monthlyAmount: Number(r.monthlyAmount),
    periods: r.periods === null ? null : Number(r.periods),
    paidCount: Number(r.paidCount),
    startDate: r.startDate ? String(r.startDate) : null,
  }))
}
