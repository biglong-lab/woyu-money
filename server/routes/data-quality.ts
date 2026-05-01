/**
 * 資料品質報告 API（PR-10）
 *
 * 偵測常見資料問題：
 *   - missingDueDate: 缺到期日
 *   - zeroAmount: 金額為 0 或負數
 *   - zombieItems: 殭屍項目（建立 >1 年、status=pending、無付款記錄）
 *   - duplicatesGroups: 同 project + 同月 + 同金額的組
 */

import { Router } from "express"
import { sql } from "drizzle-orm"
import { db } from "../db"
import { requireAuth } from "../auth"
import { asyncHandler } from "../middleware/error-handler"

const router = Router()

interface PaymentItemBrief extends Record<string, unknown> {
  id: number
  item_name: string | null
  project_name: string | null
  total_amount: string | null
  start_date: string | null
  status: string | null
  created_at: Date | null
}

router.get(
  "/api/admin/data-quality",
  requireAuth,
  asyncHandler(async (_req, res) => {
    // 1. 缺到期日（start_date IS NULL）
    const missingDue = await db.execute<PaymentItemBrief>(sql`
      SELECT pi.id, pi.item_name, pp.project_name,
             pi.total_amount::text AS total_amount,
             pi.start_date::text AS start_date,
             pi.status, pi.created_at
      FROM payment_items pi
      LEFT JOIN payment_projects pp ON pp.id = pi.project_id
      WHERE COALESCE(pi.is_deleted, false) = false
        AND pi.start_date IS NULL
      ORDER BY pi.created_at DESC
      LIMIT 50
    `)

    // 2. 金額為 0 或負數
    const zeroAmount = await db.execute<PaymentItemBrief>(sql`
      SELECT pi.id, pi.item_name, pp.project_name,
             pi.total_amount::text AS total_amount,
             pi.start_date::text AS start_date,
             pi.status, pi.created_at
      FROM payment_items pi
      LEFT JOIN payment_projects pp ON pp.id = pi.project_id
      WHERE COALESCE(pi.is_deleted, false) = false
        AND pi.total_amount::numeric <= 0
        AND pi.status != 'paid'
      ORDER BY pi.created_at DESC
      LIMIT 50
    `)

    // 3. 殭屍項目（建立 > 1 年、status pending、無付款記錄）
    const zombies = await db.execute<PaymentItemBrief>(sql`
      SELECT pi.id, pi.item_name, pp.project_name,
             pi.total_amount::text AS total_amount,
             pi.start_date::text AS start_date,
             pi.status, pi.created_at
      FROM payment_items pi
      LEFT JOIN payment_projects pp ON pp.id = pi.project_id
      WHERE COALESCE(pi.is_deleted, false) = false
        AND pi.status IN ('pending', 'unpaid')
        AND pi.created_at < NOW() - INTERVAL '1 year'
        AND NOT EXISTS (
          SELECT 1 FROM payment_records pr
          WHERE pr.payment_item_id = pi.id
        )
      ORDER BY pi.created_at ASC
      LIMIT 50
    `)

    // 4. 重複組（同 project + 同月 + 同金額）
    const dupResult = await db.execute<{
      project_name: string | null
      year_month: string
      total_amount: string
      count: number
      ids: string
      names: string
    }>(sql`
      SELECT pp.project_name,
             TO_CHAR(pi.start_date, 'YYYY-MM') AS year_month,
             pi.total_amount::text AS total_amount,
             COUNT(*)::int AS count,
             STRING_AGG(pi.id::text, ',' ORDER BY pi.id) AS ids,
             STRING_AGG(pi.item_name, ' / ' ORDER BY pi.id) AS names
      FROM payment_items pi
      LEFT JOIN payment_projects pp ON pp.id = pi.project_id
      WHERE COALESCE(pi.is_deleted, false) = false
        AND pi.status != 'paid'
        AND pi.project_id IS NOT NULL
      GROUP BY pp.project_name, TO_CHAR(pi.start_date, 'YYYY-MM'), pi.total_amount
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, pp.project_name
      LIMIT 50
    `)

    const formatBrief = (r: PaymentItemBrief) => ({
      id: r.id,
      itemName: r.item_name,
      projectName: r.project_name,
      totalAmount: Number(r.total_amount ?? 0),
      startDate: r.start_date,
      status: r.status,
      createdAt: r.created_at,
    })

    res.json({
      generatedAt: new Date().toISOString(),
      missingDueDate: {
        count: missingDue.rows.length,
        items: missingDue.rows.map(formatBrief),
      },
      zeroAmount: {
        count: zeroAmount.rows.length,
        items: zeroAmount.rows.map(formatBrief),
      },
      zombies: {
        count: zombies.rows.length,
        items: zombies.rows.map(formatBrief),
      },
      duplicates: {
        count: dupResult.rows.length,
        groups: dupResult.rows.map((r) => ({
          projectName: r.project_name,
          yearMonth: r.year_month,
          totalAmount: Number(r.total_amount),
          count: r.count,
          ids: r.ids.split(",").map((s) => parseInt(s, 10)),
          names: r.names,
        })),
      },
    })
  })
)

export default router
