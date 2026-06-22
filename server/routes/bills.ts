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

const router = Router()

interface BillRow {
  source: string
  refId: number
  name: string
  amount: number
  billIssuedDate: string | null
  dueDate: string | null
  status: string
}

router.get(
  "/api/bills/upcoming",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(parseInt((req.query.days as string) ?? "45"), 7), 120)
    const today = localDateTPE()

    // 1. 未付 payment_items（排除已強執分流），以法定付款日優先
    const itemRows = await db.execute(sql`
      SELECT pi.id AS "refId", pi.item_name AS "name",
             (pi.total_amount::numeric - COALESCE(pi.paid_amount,0)::numeric) AS "amount",
             pi.bill_issued_date AS "billIssuedDate",
             COALESCE(pi.legal_due_date, pi.start_date) AS "dueDate",
             pi.status
      FROM payment_items pi
      WHERE NOT pi.is_deleted
        AND pi.enforcement_case_id IS NULL
        AND pi.status <> 'paid'
        AND COALESCE(pi.legal_due_date, pi.start_date) <= (CURRENT_DATE + ${days} * INTERVAL '1 day')
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
      status: String(r.status),
    }))

    // 2. 強執分期 active → 投影本月與下月應付（dayOfMonth）
    const instRows = await db.execute(sql`
      SELECT id AS "refId", COALESCE(plan_name, '強執分期') AS "name",
             monthly_amount::numeric AS "amount", day_of_month AS "dayOfMonth"
      FROM enforcement_installments WHERE status = 'active'
    `)
    const installments: BillRow[] = []
    const now = new Date(today + "T00:00:00")
    for (const r of (instRows as unknown as { rows: Array<Record<string, unknown>> }).rows) {
      const day = Math.min(28, Math.max(1, Number(r.dayOfMonth) || 10))
      for (let offset = 0; offset <= 1; offset++) {
        const d = new Date(now.getFullYear(), now.getMonth() + offset, day)
        const due = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000)
        if (diffDays >= -45 && diffDays <= days) {
          installments.push({
            source: "enforcement_installment",
            refId: Number(r.refId),
            name: `${r.name}（強執分期）`,
            amount: Number(r.amount),
            billIssuedDate: null,
            dueDate: due,
            status: "pending",
          })
        }
      }
    }

    const all = [...items, ...installments]
      .map((b) => {
        const diff = b.dueDate
          ? Math.round((new Date(b.dueDate + "T00:00:00").getTime() - now.getTime()) / 86400000)
          : 999
        return {
          ...b,
          daysUntil: diff,
          overdue: diff < 0,
          urgency: diff < 0 ? "overdue" : diff <= 7 ? "soon" : "upcoming",
        }
      })
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))

    const totalDue = all.reduce((s, b) => s + b.amount, 0)
    const overdueTotal = all.filter((b) => b.overdue).reduce((s, b) => s + b.amount, 0)

    res.json({
      today,
      days,
      count: all.length,
      totalDue,
      overdueTotal,
      bills: all,
    })
  })
)

export default router
