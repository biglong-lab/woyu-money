/**
 * 帳單到期看板 API
 * GET /api/bills/upcoming?days=45
 * 通盤本月/近期應繳：
 *  - payment_items（未付、排除已強執分流）：以 法定付款日(legal_due_date) 優先、否則 start_date
 *  - 強執分期（active）：每月 dayOfMonth 的應付，投影本月＋下月
 * 回傳依到期日排序、標逾期/即將到期，附帳單來的時間，避免遲繳。
 */
import { Router } from "express"
import { asyncHandler } from "../middleware/error-handler"
import { db } from "../db"
import { sql } from "drizzle-orm"
import { localDateTPE } from "@shared/date-utils"
import { intWithDefault } from "./request-params"
import {
  type BillRow,
  type InstallmentPaidMap,
  projectInstallmentDues,
  classifyBills,
  summarizeBills,
} from "../services/bills.service"

const router = Router()

router.get(
  "/api/bills/upcoming",
  asyncHandler(async (req, res) => {
    // NaN 防護：無效值回預設 45（原 parseInt 直通會讓 NaN 進 SQL interval）
    const days = intWithDefault(req.query.days, 45, 7, 120)
    const today = localDateTPE()

    // 1. 未付 payment_items（排除已強執分流），以法定付款日優先
    const itemRows = await db.execute(sql`
      SELECT pi.id AS "refId", pi.item_name AS "name",
             (pi.total_amount::numeric - COALESCE(pi.paid_amount,0)::numeric) AS "amount",
             pi.bill_issued_date AS "billIssuedDate",
             COALESCE(pi.legal_due_date, pi.start_date) AS "dueDate",
             pi.final_due_date AS "finalDueDate",
             pi.penalty_note AS "penaltyNote",
             pi.status
      FROM payment_items pi
      WHERE NOT pi.is_deleted
        AND pi.enforcement_case_id IS NULL
        AND pi.status <> 'paid'
        AND COALESCE(pi.final_due_date, pi.legal_due_date, pi.start_date) <= (CURRENT_DATE + ${days} * INTERVAL '1 day')
        AND (pi.total_amount::numeric - COALESCE(pi.paid_amount,0)::numeric) > 0
      ORDER BY "dueDate"
    `)
    const items: BillRow[] = (
      itemRows as unknown as { rows: Array<Record<string, unknown>> }
    ).rows.map((r) => ({
      source: "payment_item",
      refId: Number(r.refId),
      name: String(r.name),
      amount: Number(r.amount),
      billIssuedDate: r.billIssuedDate ? String(r.billIssuedDate) : null,
      dueDate: r.dueDate ? String(r.dueDate) : null,
      finalDueDate: r.finalDueDate ? String(r.finalDueDate) : null,
      penaltyNote: r.penaltyNote ? String(r.penaltyNote) : null,
      status: String(r.status),
    }))

    // 2. 強執分期 active → 投影本月與下月應付（日期邏輯在 bills.service，可單元測試）
    const instRows = await db.execute(sql`
      SELECT id AS "refId", COALESCE(plan_name, '強執分期') AS "name",
             monthly_amount::numeric AS "amount", day_of_month AS "dayOfMonth"
      FROM enforcement_installments WHERE status = 'active'
    `)

    // 2b. 本月與下月已繳合計（已繳足的月份不再投影 → 立即處理後帳單消失）
    const paidRows = await db.execute(sql`
      SELECT installment_id AS "installmentId",
             TO_CHAR(payment_date, 'YYYY-MM') AS "month",
             SUM(amount::numeric) AS "paid"
      FROM enforcement_installment_payments
      WHERE payment_date >= date_trunc('month', CURRENT_DATE)
        AND payment_date < date_trunc('month', CURRENT_DATE) + INTERVAL '2 months'
      GROUP BY 1, 2
    `)
    const paidByMonth: InstallmentPaidMap = new Map()
    for (const r of (paidRows as unknown as { rows: Array<Record<string, unknown>> }).rows) {
      const instId = Number(r.installmentId)
      if (!paidByMonth.has(instId)) paidByMonth.set(instId, new Map())
      paidByMonth.get(instId)!.set(String(r.month), Number(r.paid))
    }

    const installments = projectInstallmentDues(
      (instRows as unknown as { rows: Array<Record<string, unknown>> }).rows.map((r) => ({
        refId: Number(r.refId),
        name: String(r.name),
        amount: Number(r.amount),
        dayOfMonth: Number(r.dayOfMonth) || 10,
      })),
      today,
      days,
      paidByMonth
    )

    const all = classifyBills([...items, ...installments], today)
    const summary = summarizeBills(all)

    res.json({
      today,
      days,
      ...summary,
      bills: all,
    })
  })
)

export default router
