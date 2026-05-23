/**
 * 家庭共同存錢目標 API — 階段 4.4
 *
 *   GET   /api/family/savings-goals             列出（active 優先）
 *   POST  /api/family/savings-goals             建立
 *   POST  /api/family/savings-goals/:id/contribute  加錢（自動標 achieved）
 *   POST  /api/family/savings-goals/:id/archive 歸檔
 *   GET   /api/family/savings-goals/:id/contributions  該目標的明細
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { requireAuth } from "../auth"
import { db } from "../db"
import { sql } from "drizzle-orm"
import { createSavingsGoalSchema, contributeSchema } from "@shared/schema/family-savings-goals"

const router = Router()
const DEFAULT_FAMILY_ID = 1

/** GET /api/family/savings-goals */
router.get(
  "/api/family/savings-goals",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        id,
        family_id        AS "familyId",
        title,
        emoji,
        target_amount::text  AS "targetAmount",
        current_amount::text AS "currentAmount",
        target_date::text   AS "targetDate",
        status,
        notes,
        created_by_user_id AS "createdByUserId",
        achieved_at      AS "achievedAt",
        created_at       AS "createdAt"
      FROM family_savings_goals
      WHERE family_id = ${DEFAULT_FAMILY_ID}
      ORDER BY
        CASE status WHEN 'active' THEN 0 WHEN 'achieved' THEN 1 ELSE 2 END,
        created_at DESC
    `)
    res.json((rows as unknown as { rows: unknown[] }).rows)
  })
)

/** POST /api/family/savings-goals */
router.post(
  "/api/family/savings-goals",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = createSavingsGoalSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, "建立失敗：" + parsed.error.errors.map((e) => e.message).join(", "))
    }
    const input = parsed.data
    if (input.targetAmount <= 0) throw new AppError(400, "目標金額需大於 0")

    const userId = (req as { user?: { id: number } }).user?.id ?? null
    const inserted = await db.execute(sql`
      INSERT INTO family_savings_goals
        (family_id, title, emoji, target_amount, current_amount, target_date,
         status, notes, created_by_user_id, created_at, updated_at)
      VALUES
        (${DEFAULT_FAMILY_ID}, ${input.title}, ${input.emoji ?? "💰"},
         ${input.targetAmount}, '0',
         ${input.targetDate ?? null},
         'active', ${input.notes ?? null}, ${userId},
         NOW(), NOW())
      RETURNING id, title, emoji, target_amount::text AS "targetAmount",
                current_amount::text AS "currentAmount", status, created_at AS "createdAt"
    `)
    res.status(201).json((inserted as unknown as { rows: unknown[] }).rows[0])
  })
)

/** POST /api/family/savings-goals/:id/contribute */
router.post(
  "/api/family/savings-goals/:id/contribute",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) throw new AppError(400, "無效的目標 ID")

    const parsed = contributeSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(400, parsed.error.errors.map((e) => e.message).join(", "))
    }
    const amount = parsed.data.amount
    if (amount <= 0) throw new AppError(400, "金額需大於 0")

    // 取目前狀態
    const goalRows = await db.execute(sql`
      SELECT id, target_amount::text AS "targetAmount",
             current_amount::text AS "currentAmount", status
      FROM family_savings_goals
      WHERE id = ${id} AND family_id = ${DEFAULT_FAMILY_ID}
      LIMIT 1
    `)
    const goal = (
      goalRows as unknown as {
        rows: { targetAmount: string; currentAmount: string; status: string }[]
      }
    ).rows[0]
    if (!goal) throw new AppError(404, "找不到目標")
    if (goal.status === "archived") throw new AppError(400, "已歸檔的目標無法加錢")

    const user = (req as { user?: { id: number; fullName?: string; username?: string } }).user
    const newCurrent = parseFloat(goal.currentAmount) + amount
    const target = parseFloat(goal.targetAmount)
    const achieved = newCurrent >= target

    await db.execute(sql`
      UPDATE family_savings_goals
      SET current_amount = ${newCurrent},
          status = ${achieved ? "achieved" : "active"},
          achieved_at = ${achieved ? sql`NOW()` : sql`achieved_at`},
          updated_at = NOW()
      WHERE id = ${id}
    `)

    await db.execute(sql`
      INSERT INTO family_savings_contributions
        (goal_id, amount, contributed_by_user_id, contributed_by_name, note, created_at)
      VALUES
        (${id}, ${amount}, ${user?.id ?? null},
         ${user?.fullName ?? user?.username ?? null},
         ${parsed.data.note ?? null}, NOW())
    `)

    res.json({
      success: true,
      currentAmount: newCurrent,
      targetAmount: target,
      achieved,
      progressPct: Math.min(100, Math.round((newCurrent / target) * 100)),
    })
  })
)

/** POST /api/family/savings-goals/:id/archive */
router.post(
  "/api/family/savings-goals/:id/archive",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) throw new AppError(400, "無效的目標 ID")
    const result = await db.execute(sql`
      UPDATE family_savings_goals
      SET status = 'archived', updated_at = NOW()
      WHERE id = ${id} AND family_id = ${DEFAULT_FAMILY_ID}
      RETURNING id
    `)
    const row = (result as unknown as { rows: { id: number }[] }).rows[0]
    if (!row) throw new AppError(404, "找不到目標")
    res.json({ success: true, id: row.id })
  })
)

/** GET /api/family/savings-goals/:id/contributions */
router.get(
  "/api/family/savings-goals/:id/contributions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) throw new AppError(400, "無效的目標 ID")
    const rows = await db.execute(sql`
      SELECT c.id,
             c.amount::text AS amount,
             c.contributed_by_user_id AS "contributedByUserId",
             c.contributed_by_name    AS "contributedByName",
             c.note,
             c.created_at             AS "createdAt",
             u.username,
             u.full_name              AS "userFullName"
      FROM family_savings_contributions c
      LEFT JOIN users u ON u.id = c.contributed_by_user_id
      WHERE c.goal_id = ${id}
      ORDER BY c.created_at DESC
      LIMIT 50
    `)
    res.json((rows as unknown as { rows: unknown[] }).rows)
  })
)

export default router
