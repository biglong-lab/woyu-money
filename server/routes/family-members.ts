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

export default router
