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
  finalDueDate: string | null
  penaltyNote: string | null
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
            finalDueDate: null,
            penaltyNote: null,
            status: "pending",
          })
        }
      }
    }

    const dayDiff = (d: string | null) =>
      d ? Math.round((new Date(d + "T00:00:00").getTime() - now.getTime()) / 86400000) : null

    const all = [...items, ...installments]
      .map((b) => {
        const diff = dayDiff(b.dueDate) ?? 999
        const finalDiff = dayDiff(b.finalDueDate)
        // 罰款風險：已過最終必繳日 → penalty（最嚴重）
        // 過法定但未過最終 → grace（緩衝期、再不繳要罰）
        let urgency: "penalty" | "overdue" | "grace" | "soon" | "upcoming"
        if (finalDiff !== null && finalDiff < 0) urgency = "penalty"
        else if (diff < 0) urgency = b.finalDueDate ? "grace" : "overdue"
        else if (diff <= 7) urgency = "soon"
        else urgency = "upcoming"
        return {
          ...b,
          daysUntil: diff,
          finalDaysUntil: finalDiff,
          overdue: diff < 0,
          penaltyRisk: urgency === "penalty",
          urgency,
        }
      })
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))

    const totalDue = all.reduce((s, b) => s + b.amount, 0)
    const overdueTotal = all.filter((b) => b.overdue).reduce((s, b) => s + b.amount, 0)
    const penaltyRiskTotal = all.filter((b) => b.penaltyRisk).reduce((s, b) => s + b.amount, 0)

    res.json({
      today,
      days,
      count: all.length,
      totalDue,
      overdueTotal,
      penaltyRiskTotal,
      bills: all,
    })
  })
)

export default router
