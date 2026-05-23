/**
 * 家庭成員邀請與管理 — 階段 4.1 多人協作基底
 *
 * Endpoints：
 *   GET    /api/family/members          列出本家庭所有成員（含 pending）
 *   POST   /api/family/members/invite   邀請新成員（email + role）
 *   POST   /api/family/members/:id/cancel  取消邀請
 *
 * 設計：
 *  - 此階段先做骨架、所有成員仍走原 users 系統登入
 *  - inviteToken 先產 UUID 存著、未來實作 /accept-invite 用
 *  - 不發 email（避免 Resend 設定依賴）、回傳邀請連結讓使用者手動轉發
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { requireAuth } from "../auth"
import { db } from "../db"
import { sql } from "drizzle-orm"
import { randomBytes } from "crypto"
import {
  familyMembers,
  inviteFamilyMemberSchema,
  type InviteFamilyMemberInput,
} from "@shared/schema/family-members"

const router = Router()

const DEFAULT_FAMILY_ID = 1

function generateInviteToken(): string {
  return randomBytes(24).toString("hex")
}

/** GET /api/family/members — 列出本家庭所有成員 */
router.get(
  "/api/family/members",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        fm.id,
        fm.family_id    AS "familyId",
        fm.user_id      AS "userId",
        fm.email,
        fm.display_name AS "displayName",
        fm.role,
        fm.status,
        fm.invite_note  AS "inviteNote",
        fm.invited_at   AS "invitedAt",
        fm.joined_at    AS "joinedAt",
        u.username,
        u.full_name     AS "userFullName"
      FROM family_members fm
      LEFT JOIN users u ON u.id = fm.user_id
      WHERE fm.family_id = ${DEFAULT_FAMILY_ID}
      ORDER BY
        CASE fm.status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
        fm.invited_at DESC
    `)
    res.json((rows as unknown as { rows: unknown[] }).rows)
  })
)

/**
 * POST /api/family/members/invite
 * Body: { email, displayName?, role?, inviteNote? }
 */
router.post(
  "/api/family/members/invite",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = inviteFamilyMemberSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(
        400,
        "邀請資料無效：" + parsed.error.errors.map((e) => e.message).join(", ")
      )
    }
    const input: InviteFamilyMemberInput = parsed.data
    const invitedByUserId = (req as { user?: { id: number } }).user?.id ?? null

    // 檢查是否已有同 email 的 active / pending
    const exist = await db.execute(sql`
      SELECT id, status FROM family_members
      WHERE family_id = ${DEFAULT_FAMILY_ID}
        AND LOWER(email) = LOWER(${input.email})
        AND status IN ('active', 'pending')
      LIMIT 1
    `)
    const row = (exist as unknown as { rows: { id: number; status: string }[] }).rows[0]
    if (row) {
      throw new AppError(
        409,
        `此 email 已${row.status === "active" ? "是家庭成員" : "邀請過、待接受"}`
      )
    }

    const token = generateInviteToken()
    const insertRes = await db.execute(sql`
      INSERT INTO family_members (
        family_id, email, display_name, role, status, invite_token,
        invited_by_user_id, invite_note, invited_at, created_at, updated_at
      )
      VALUES (
        ${DEFAULT_FAMILY_ID}, ${input.email}, ${input.displayName ?? null}, ${input.role},
        'pending', ${token}, ${invitedByUserId}, ${input.inviteNote ?? null},
        NOW(), NOW(), NOW()
      )
      RETURNING id, family_id AS "familyId", email, display_name AS "displayName",
                role, status, invite_token AS "inviteToken",
                invited_at AS "invitedAt"
    `)
    const created = (insertRes as unknown as { rows: { id: number; inviteToken: string }[] })
      .rows[0]

    const baseUrl = process.env.PUBLIC_BASE_URL || "https://money.homi.cc"
    const inviteLink = `${baseUrl}/family/accept-invite?token=${created.inviteToken}`

    res.status(201).json({
      ...created,
      inviteLink,
      message: "邀請已建立、請複製連結傳給對方接受",
    })
  })
)

/** POST /api/family/members/:id/cancel — 取消尚未接受的邀請 */
router.post(
  "/api/family/members/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) throw new AppError(400, "無效的成員 ID")

    const result = await db.execute(sql`
      UPDATE family_members
      SET status = 'inactive', updated_at = NOW()
      WHERE id = ${id} AND family_id = ${DEFAULT_FAMILY_ID} AND status = 'pending'
      RETURNING id, status
    `)
    const updated = (result as unknown as { rows: { id: number }[] }).rows[0]
    if (!updated) throw new AppError(404, "找不到該 pending 邀請")
    res.json({ success: true, id: updated.id })
  })
)

/**
 * GET /api/family/cross-domain-overview?month=YYYY-MM
 * 階段 4.3 跨領域整合視圖：聚合家用 / 小孩任務 / PM 收入 / PMS 收入 / 待批准
 *
 * 設計：
 *  - 每個來源獨立 query、其中一個失敗（表不存在 / FK 對不上）不應拖垮整體
 *  - 所有金額一律 ::numeric → text 回傳、前端 parseFloat
 */
router.get(
  "/api/family/cross-domain-overview",
  requireAuth,
  asyncHandler(async (req, res) => {
    const monthRaw = (req.query.month as string | undefined) || ""
    const ym = /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : new Date().toISOString().slice(0, 7)
    const [y, m] = ym.split("-").map(Number)
    const startDate = `${ym}-01`
    const endY = m === 12 ? y + 1 : y
    const endM = m === 12 ? 1 : m + 1
    const endDate = `${endY}-${String(endM).padStart(2, "0")}-01`

    async function safeSum(label: string, query: () => Promise<unknown>): Promise<number> {
      try {
        const result = (await query()) as { rows: { sum: string | null }[] }
        return parseFloat(result.rows[0]?.sum ?? "0") || 0
      } catch (e) {
        process.stdout.write(`[cross-domain] ${label} failed: ${(e as Error).message}\n`)
        return 0
      }
    }

    const householdExpense = await safeSum("household", () =>
      db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::text AS sum
        FROM household_expenses
        WHERE date >= ${startDate}::date AND date < ${endDate}::date
      `)
    )

    const kidsApproved = await safeSum("kids_tasks", () =>
      db.execute(sql`
        SELECT COALESCE(SUM(reward_amount::numeric), 0)::text AS sum
        FROM kids_tasks
        WHERE status = 'approved'
          AND approved_at >= ${startDate}::timestamp
          AND approved_at <  ${endDate}::timestamp
      `)
    )

    // PM 確認收入（source_key='pm-bridge' && status='confirmed'）
    const pmConfirmed = await safeSum("pm_confirmed", () =>
      db.execute(sql`
        SELECT COALESCE(SUM(COALESCE(w.parsed_amount_twd, w.parsed_amount, '0')::numeric), 0)::text AS sum
        FROM income_webhooks w
        JOIN income_sources s ON s.id = w.source_id
        WHERE s.source_key = 'pm-bridge'
          AND w.status = 'confirmed'
          AND COALESCE(w.parsed_paid_at, w.processed_at, w.reviewed_at) >= ${startDate}::timestamp
          AND COALESCE(w.parsed_paid_at, w.processed_at, w.reviewed_at) <  ${endDate}::timestamp
      `)
    )

    // PMS 完成收入（source_key 含 'pms'、status='confirmed'）
    const pmsConfirmed = await safeSum("pms_confirmed", () =>
      db.execute(sql`
        SELECT COALESCE(SUM(COALESCE(w.parsed_amount_twd, w.parsed_amount, '0')::numeric), 0)::text AS sum
        FROM income_webhooks w
        JOIN income_sources s ON s.id = w.source_id
        WHERE s.source_key LIKE '%pms%'
          AND w.status = 'confirmed'
          AND COALESCE(w.parsed_paid_at, w.processed_at, w.reviewed_at) >= ${startDate}::timestamp
          AND COALESCE(w.parsed_paid_at, w.processed_at, w.reviewed_at) <  ${endDate}::timestamp
      `)
    )

    // 待批准（全來源、不限 source_key）— 用 created_at 落在本月
    const pendingAmt = await safeSum("pending", () =>
      db.execute(sql`
        SELECT COALESCE(SUM(COALESCE(parsed_amount_twd, parsed_amount, '0')::numeric), 0)::text AS sum
        FROM income_webhooks
        WHERE status = 'pending'
      `)
    )

    let pendingCount = 0
    try {
      const cnt = (await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM income_webhooks WHERE status = 'pending'
      `)) as unknown as { rows: { n: number }[] }
      pendingCount = cnt.rows[0]?.n ?? 0
    } catch (e) {
      process.stdout.write(`[cross-domain] pending count failed: ${(e as Error).message}\n`)
    }

    const totalIncome = pmConfirmed + pmsConfirmed
    const totalExpense = householdExpense + kidsApproved
    const netDiff = totalIncome - totalExpense

    res.json({
      month: ym,
      kpis: {
        householdExpense: Math.round(householdExpense),
        kidsApproved: Math.round(kidsApproved),
        pmConfirmed: Math.round(pmConfirmed),
        pmsConfirmed: Math.round(pmsConfirmed),
        pendingAmount: Math.round(pendingAmt),
        pendingCount,
      },
      totals: {
        totalIncome: Math.round(totalIncome),
        totalExpense: Math.round(totalExpense),
        netDiff: Math.round(netDiff),
      },
    })
  })
)

export default router
