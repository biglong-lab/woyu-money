/**
 * 家庭記帳「小孩模式」API
 *
 * 核心 endpoints：
 *   GET    /api/family/kids                列出小孩
 *   POST   /api/family/kids                新增小孩（auto create jars row）
 *   PUT    /api/family/kids/:id            更新小孩（含三罐比例）
 *   DELETE /api/family/kids/:id            刪除（cascade jars/tasks/goals/badges）
 *   POST   /api/family/kids/pin-login      PIN 登入（回該小孩資訊）
 *
 *   GET    /api/family/tasks               列出任務（可篩 kidId、status）
 *   POST   /api/family/tasks               家長派任務
 *   POST   /api/family/tasks/:id/submit    小孩標完成
 *   POST   /api/family/tasks/:id/approve   家長 approve → 入帳 + 自動三罐分配 + 觸發徽章
 *   POST   /api/family/tasks/:id/reject    家長駁回
 *   DELETE /api/family/tasks/:id           刪除任務
 *
 *   GET    /api/family/goals               列存錢目標
 *   POST   /api/family/goals               新增目標
 *   POST   /api/family/goals/:id/save      把錢從 save 罐撥到目標、達成自動觸發徽章
 *   PUT    /api/family/goals/:id           更新
 *
 *   GET    /api/family/dashboard?kidId=    小孩 dashboard 聚合（jars + active tasks + goals + badges）
 *   GET    /api/family/badges?kidId=       徽章列表
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { db } from "../db"
import { sql, eq, and, desc } from "drizzle-orm"
import {
  kidsAccounts,
  kidsJars,
  kidsTasks,
  kidsGoals,
  kidsBadges,
  kidsSpendings,
  kidsDailyMessages,
  familyTaskTemplates,
  kidsWishes,
  kidsTaskComments,
  insertKidsAccountSchema,
  insertKidsTaskSchema,
  insertKidsGoalSchema,
  insertKidsSpendingSchema,
  paymentItems,
  paymentRecords,
} from "@shared/schema"

const router = Router()

// ============================================================
// helpers
// ============================================================
async function ensureJarsRow(kidId: number) {
  const existing = await db.select().from(kidsJars).where(eq(kidsJars.kidId, kidId)).limit(1)
  if (existing.length === 0) {
    await db.insert(kidsJars).values({ kidId })
  }
}

async function awardBadgeIfNew(
  kidId: number,
  badgeType: string,
  title: string,
  emoji: string,
  metadata?: Record<string, unknown>
) {
  const existing = await db
    .select()
    .from(kidsBadges)
    .where(and(eq(kidsBadges.kidId, kidId), eq(kidsBadges.badgeType, badgeType)))
    .limit(1)
  if (existing.length === 0) {
    await db.insert(kidsBadges).values({
      kidId,
      badgeType,
      title,
      emoji,
      metadata: metadata ?? null,
    })
    return true
  }
  return false
}

/**
 * 計算小孩「連續打卡天數」streak
 * 定義：往回算、每天都至少有 1 個 approved 任務（approved_at 那天）
 * 從今天往回找連續日：今天 / 昨天 / ... 中斷則停
 * 若今天還沒 approved 任務、從昨天開始算（給寬限）
 */
async function calcStreak(kidId: number): Promise<number> {
  const rows = await db.execute(sql`
    SELECT DISTINCT DATE(approved_at)::text AS d
    FROM kids_tasks
    WHERE kid_id = ${kidId} AND status = 'approved' AND approved_at IS NOT NULL
    ORDER BY d DESC
    LIMIT 365
  `)
  const dates = (rows as unknown as { rows: { d: string }[] }).rows.map((r) => r.d)
  if (dates.length === 0) return 0

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  // 寬限：今天 / 昨天有資料才算開始
  let cursor: string
  if (dates[0] === today) cursor = today
  else if (dates[0] === yesterday) cursor = yesterday
  else return 0

  let streak = 0
  const set = new Set(dates)
  while (set.has(cursor)) {
    streak += 1
    cursor = new Date(new Date(cursor).getTime() - 86400000).toISOString().slice(0, 10)
  }
  return streak
}

async function checkStreakBadges(kidId: number, streak: number) {
  const awarded: string[] = []
  if (streak >= 7 && (await awardBadgeIfNew(kidId, "streak_7", "連續打卡 7 天", "🔥")))
    awarded.push("streak_7")
  if (streak >= 30 && (await awardBadgeIfNew(kidId, "streak_30", "連續打卡 30 天", "🌟")))
    awarded.push("streak_30")
  if (streak >= 100 && (await awardBadgeIfNew(kidId, "streak_100", "連續打卡 100 天", "👑")))
    awarded.push("streak_100")
  return awarded
}

async function checkTaskBadges(kidId: number) {
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM kids_tasks
    WHERE kid_id = ${kidId} AND status = 'approved'
  `)
  const n = (result as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0
  const awarded: string[] = []
  if (n >= 1 && (await awardBadgeIfNew(kidId, "first_task", "完成第一個任務", "🌟")))
    awarded.push("first_task")
  if (n >= 10 && (await awardBadgeIfNew(kidId, "tasks_10", "完成 10 個任務", "💪")))
    awarded.push("tasks_10")
  if (n >= 50 && (await awardBadgeIfNew(kidId, "tasks_50", "完成 50 個任務", "🏆")))
    awarded.push("tasks_50")
  return awarded
}

// ============================================================
// 1. 小孩帳戶
// ============================================================
router.get(
  "/api/family/kids",
  asyncHandler(async (_req, res) => {
    const kids = await db
      .select({
        id: kidsAccounts.id,
        familyId: kidsAccounts.familyId,
        displayName: kidsAccounts.displayName,
        avatar: kidsAccounts.avatar,
        color: kidsAccounts.color,
        birthday: kidsAccounts.birthday,
        spendRatio: kidsAccounts.spendRatio,
        saveRatio: kidsAccounts.saveRatio,
        giveRatio: kidsAccounts.giveRatio,
        isActive: kidsAccounts.isActive,
      })
      .from(kidsAccounts)
      .where(eq(kidsAccounts.isActive, true))
      .orderBy(kidsAccounts.id)
    res.json(kids)
  })
)

router.post(
  "/api/family/kids",
  asyncHandler(async (req, res) => {
    const ratios = {
      spendRatio: Number(req.body?.spendRatio ?? 70),
      saveRatio: Number(req.body?.saveRatio ?? 20),
      giveRatio: Number(req.body?.giveRatio ?? 10),
    }
    if (ratios.spendRatio + ratios.saveRatio + ratios.giveRatio !== 100) {
      throw new AppError(400, "三罐比例總和必須為 100")
    }
    const parsed = insertKidsAccountSchema.safeParse({ ...req.body, ...ratios })
    if (!parsed.success) {
      throw new AppError(
        400,
        "資料格式錯誤：" + parsed.error.errors.map((e) => e.message).join(", ")
      )
    }
    const [created] = await db.insert(kidsAccounts).values(parsed.data).returning()
    await ensureJarsRow(created.id)
    res.status(201).json(created)
  })
)

router.put(
  "/api/family/kids/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")

    const body: Record<string, unknown> = { ...req.body }
    if (
      body.spendRatio !== undefined ||
      body.saveRatio !== undefined ||
      body.giveRatio !== undefined
    ) {
      const s = Number(body.spendRatio ?? 0)
      const sv = Number(body.saveRatio ?? 0)
      const g = Number(body.giveRatio ?? 0)
      if (s + sv + g !== 100) throw new AppError(400, "三罐比例總和必須為 100")
    }
    body.updatedAt = new Date()
    const [updated] = await db
      .update(kidsAccounts)
      .set(body)
      .where(eq(kidsAccounts.id, id))
      .returning()
    if (!updated) throw new AppError(404, "小孩帳戶不存在")
    res.json(updated)
  })
)

router.delete(
  "/api/family/kids/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    // 軟刪除：isActive=false（cascade 留資料、避免 jars/tasks/goals/badges 一起刪）
    await db
      .update(kidsAccounts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(kidsAccounts.id, id))
    res.json({ ok: true })
  })
)

/**
 * PIN 登入：用 4 位數 PIN 查小孩、回小孩資訊（不查密碼、低安全 home use）
 */
router.post(
  "/api/family/kids/pin-login",
  asyncHandler(async (req, res) => {
    const pin = String(req.body?.pin ?? "")
    if (!/^\d{4}$/.test(pin)) throw new AppError(400, "PIN 需為 4 位數字")
    const [kid] = await db
      .select()
      .from(kidsAccounts)
      .where(and(eq(kidsAccounts.pin, pin), eq(kidsAccounts.isActive, true)))
      .limit(1)
    if (!kid) throw new AppError(404, "PIN 不正確")
    res.json({
      id: kid.id,
      displayName: kid.displayName,
      avatar: kid.avatar,
      color: kid.color,
      spendRatio: kid.spendRatio,
      saveRatio: kid.saveRatio,
      giveRatio: kid.giveRatio,
    })
  })
)

/**
 * 家長 PIN 驗證
 * env FAMILY_PARENT_PIN 設定家長 PIN（4-8 位）、未設 = 關閉功能 (enabled=false)
 * 驗證成功小孩端 sessionStorage 記住 30 分鐘
 */
router.get(
  "/api/family/parent-pin/status",
  asyncHandler(async (_req, res) => {
    const pin = process.env.FAMILY_PARENT_PIN ?? ""
    res.json({ enabled: pin.length >= 4 })
  })
)

router.post(
  "/api/family/parent-pin/verify",
  asyncHandler(async (req, res) => {
    const expected = process.env.FAMILY_PARENT_PIN ?? ""
    if (expected.length < 4) {
      // 未設定 PIN → 視為通過（向後相容、不阻斷既有流程）
      res.json({ ok: true, enabled: false })
      return
    }
    const pin = String(req.body?.pin ?? "")
    if (pin === expected) {
      res.json({ ok: true, enabled: true })
    } else {
      throw new AppError(401, "家長 PIN 不正確")
    }
  })
)

// ============================================================
// 任務範本（內建、不存 DB）
// ============================================================
const TASK_TEMPLATES = [
  { title: "洗碗", emoji: "🍽️", rewardAmount: 50 },
  { title: "倒垃圾", emoji: "🗑️", rewardAmount: 30 },
  { title: "整理房間", emoji: "🛏️", rewardAmount: 100 },
  { title: "完成作業", emoji: "📚", rewardAmount: 50 },
  { title: "幫忙做家務", emoji: "🧹", rewardAmount: 30 },
  { title: "餵寵物", emoji: "🐕", rewardAmount: 20 },
  { title: "曬衣服 / 摺衣服", emoji: "👕", rewardAmount: 40 },
  { title: "練琴 / 練樂器", emoji: "🎵", rewardAmount: 50 },
  { title: "閱讀 30 分鐘", emoji: "📖", rewardAmount: 30 },
  { title: "幫忙買東西", emoji: "🛒", rewardAmount: 50 },
]

router.get(
  "/api/family/task-templates",
  asyncHandler(async (_req, res) => {
    res.json(TASK_TEMPLATES)
  })
)

// ============================================================
// 節慶任務範本（按月份顯示對應節慶）
// ============================================================
interface SeasonalTask {
  title: string
  emoji: string
  rewardAmount: number
}
const SEASONAL_TASKS: Record<number, { festival: string; emoji: string; tasks: SeasonalTask[] }> = {
  1: {
    festival: "新年 / 春節",
    emoji: "🧧",
    tasks: [
      { title: "幫忙大掃除", emoji: "🧹", rewardAmount: 200 },
      { title: "寫春聯 / 福字", emoji: "🖌️", rewardAmount: 100 },
      { title: "幫忙包紅包袋", emoji: "🧧", rewardAmount: 50 },
      { title: "向長輩拜年", emoji: "🙇", rewardAmount: 100 },
    ],
  },
  2: {
    festival: "元宵 / 情人節",
    emoji: "🏮",
    tasks: [
      { title: "搓元宵 / 包湯圓", emoji: "🍡", rewardAmount: 80 },
      { title: "做花燈", emoji: "🏮", rewardAmount: 100 },
      { title: "幫家人寫祝福卡", emoji: "💝", rewardAmount: 50 },
    ],
  },
  3: {
    festival: "婦女節 / 春耕",
    emoji: "🌸",
    tasks: [
      { title: "幫媽媽做家事", emoji: "🌷", rewardAmount: 100 },
      { title: "種小盆栽", emoji: "🌱", rewardAmount: 80 },
    ],
  },
  4: {
    festival: "兒童節 / 清明",
    emoji: "🌿",
    tasks: [
      { title: "清明掃墓幫忙", emoji: "🌿", rewardAmount: 200 },
      { title: "做潤餅", emoji: "🥬", rewardAmount: 80 },
    ],
  },
  5: {
    festival: "母親節",
    emoji: "💐",
    tasks: [
      { title: "幫媽媽做早餐", emoji: "🍳", rewardAmount: 100 },
      { title: "寫感謝卡給媽媽", emoji: "💌", rewardAmount: 80 },
      { title: "做家事讓媽媽休息", emoji: "🛋️", rewardAmount: 150 },
      { title: "畫媽媽肖像", emoji: "🎨", rewardAmount: 80 },
    ],
  },
  6: {
    festival: "端午節",
    emoji: "🐉",
    tasks: [
      { title: "幫忙包粽子", emoji: "🍡", rewardAmount: 100 },
      { title: "做香包", emoji: "👜", rewardAmount: 80 },
      { title: "立蛋競賽（成功才有獎）", emoji: "🥚", rewardAmount: 50 },
    ],
  },
  7: {
    festival: "暑假開始",
    emoji: "☀️",
    tasks: [
      { title: "每天閱讀 30 分鐘", emoji: "📖", rewardAmount: 30 },
      { title: "幫忙曬棉被", emoji: "☀️", rewardAmount: 50 },
      { title: "整理玩具箱", emoji: "🧸", rewardAmount: 100 },
    ],
  },
  8: {
    festival: "七夕 / 父親節",
    emoji: "👔",
    tasks: [
      { title: "做卡片給爸爸", emoji: "💌", rewardAmount: 80 },
      { title: "幫爸爸按摩 10 分鐘", emoji: "💆", rewardAmount: 50 },
      { title: "幫爸爸擦皮鞋", emoji: "👞", rewardAmount: 80 },
    ],
  },
  9: {
    festival: "中秋節",
    emoji: "🌕",
    tasks: [
      { title: "幫忙烤肉準備", emoji: "🍖", rewardAmount: 100 },
      { title: "幫家人切月餅 / 柚子", emoji: "🥮", rewardAmount: 50 },
      { title: "教爺爺奶奶用手機賞月", emoji: "📱", rewardAmount: 100 },
    ],
  },
  10: {
    festival: "雙十國慶 / 萬聖節",
    emoji: "🎃",
    tasks: [
      { title: "做萬聖節裝飾", emoji: "👻", rewardAmount: 80 },
      { title: "雕南瓜燈", emoji: "🎃", rewardAmount: 150 },
      { title: "做變裝服裝", emoji: "🧙", rewardAmount: 100 },
    ],
  },
  11: {
    festival: "感恩節",
    emoji: "🦃",
    tasks: [
      { title: "寫感恩日記一週", emoji: "📓", rewardAmount: 100 },
      { title: "幫家人按摩感謝", emoji: "💆", rewardAmount: 50 },
    ],
  },
  12: {
    festival: "聖誕節 / 跨年",
    emoji: "🎄",
    tasks: [
      { title: "佈置聖誕樹", emoji: "🎄", rewardAmount: 150 },
      { title: "做聖誕卡給朋友", emoji: "🎁", rewardAmount: 80 },
      { title: "幫忙包聖誕禮物", emoji: "🎀", rewardAmount: 80 },
      { title: "年末大掃除", emoji: "🧹", rewardAmount: 200 },
    ],
  },
}

router.get(
  "/api/family/task-templates/seasonal",
  asyncHandler(async (req, res) => {
    const monthQ = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1
    if (!Number.isInteger(monthQ) || monthQ < 1 || monthQ > 12) {
      throw new AppError(400, "month 需為 1-12")
    }
    const data = SEASONAL_TASKS[monthQ]
    res.json({ month: monthQ, ...data })
  })
)

/**
 * POST /api/family/tasks/batch
 * Body: { kidIds: number[], tasks: Array<{ title, emoji, rewardAmount }> }
 * 批量派任務給多個小孩（家長最常用）
 */
router.post(
  "/api/family/tasks/batch",
  asyncHandler(async (req, res) => {
    const kidIds = (req.body?.kidIds ?? []) as number[]
    const tasks = (req.body?.tasks ?? []) as Array<{
      title: string
      emoji?: string
      rewardAmount: number | string
    }>
    if (!Array.isArray(kidIds) || kidIds.length === 0) throw new AppError(400, "kidIds 必填")
    if (!Array.isArray(tasks) || tasks.length === 0) throw new AppError(400, "tasks 必填")

    const created: number[] = []
    for (const kid of kidIds) {
      for (const t of tasks) {
        const [row] = await db
          .insert(kidsTasks)
          .values({
            kidId: kid,
            title: t.title,
            emoji: t.emoji ?? "📋",
            rewardAmount: String(t.rewardAmount),
            status: "pending",
          })
          .returning({ id: kidsTasks.id })
        created.push(row.id)
      }
    }
    res.status(201).json({ count: created.length, taskIds: created })
  })
)

// ============================================================
// 2. 任務
// ============================================================
router.get(
  "/api/family/tasks",
  asyncHandler(async (req, res) => {
    const kidIdQ = req.query.kidId ? Number(req.query.kidId) : undefined
    const statusQ = (req.query.status as string | undefined) ?? undefined

    const conds = []
    if (kidIdQ) conds.push(eq(kidsTasks.kidId, kidIdQ))
    if (statusQ) conds.push(eq(kidsTasks.status, statusQ))

    const rows = await db
      .select({
        id: kidsTasks.id,
        kidId: kidsTasks.kidId,
        title: kidsTasks.title,
        emoji: kidsTasks.emoji,
        rewardAmount: kidsTasks.rewardAmount,
        status: kidsTasks.status,
        notes: kidsTasks.notes,
        dueDate: kidsTasks.dueDate,
        completedAt: kidsTasks.completedAt,
        approvedAt: kidsTasks.approvedAt,
        paymentRecordId: kidsTasks.paymentRecordId,
        proofImageUrl: kidsTasks.proofImageUrl,
        proposedByKid: kidsTasks.proposedByKid,
        createdAt: kidsTasks.createdAt,
      })
      .from(kidsTasks)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(kidsTasks.createdAt))

    // 計算逾期狀態（dueDate 已過 + 仍 pending/submitted 算逾期）
    const today = new Date().toISOString().slice(0, 10)
    const enhanced = rows.map((r) => {
      const isPending = r.status === "pending" || r.status === "submitted"
      const isOverdue = !!(r.dueDate && r.dueDate < today && isPending)
      const overdueDays =
        isOverdue && r.dueDate
          ? Math.floor((new Date(today).getTime() - new Date(r.dueDate).getTime()) / 86400000)
          : 0
      return { ...r, isOverdue, overdueDays }
    })
    // 逾期排前面、再按 createdAt 倒序
    enhanced.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
      return (
        new Date(b.createdAt as unknown as string).getTime() -
        new Date(a.createdAt as unknown as string).getTime()
      )
    })
    res.json(enhanced)
  })
)

router.post(
  "/api/family/tasks",
  asyncHandler(async (req, res) => {
    const parsed = insertKidsTaskSchema.safeParse({
      ...req.body,
      status: "pending",
    })
    if (!parsed.success) {
      throw new AppError(
        400,
        "資料格式錯誤：" + parsed.error.errors.map((e) => e.message).join(", ")
      )
    }
    const [created] = await db.insert(kidsTasks).values(parsed.data).returning()
    res.status(201).json(created)
  })
)

/**
 * POST /api/family/tasks/propose
 * 小孩自提任務（家長 approve 才入帳）
 * Body: { kidId, title, emoji?, rewardAmount, notes? }
 * 設 proposedByKid=true、status=pending
 */
router.post(
  "/api/family/tasks/propose",
  asyncHandler(async (req, res) => {
    const parsed = insertKidsTaskSchema.safeParse({
      ...req.body,
      status: "pending",
      proposedByKid: true,
    })
    if (!parsed.success) {
      throw new AppError(
        400,
        "資料格式錯誤：" + parsed.error.errors.map((e) => e.message).join(", ")
      )
    }
    if (!parsed.data.kidId) throw new AppError(400, "需指定 kidId")
    const [created] = await db.insert(kidsTasks).values(parsed.data).returning()
    res.status(201).json(created)
  })
)

router.post(
  "/api/family/tasks/:id/submit",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const [task] = await db.select().from(kidsTasks).where(eq(kidsTasks.id, id)).limit(1)
    if (!task) throw new AppError(404, "任務不存在")
    if (task.status !== "pending") throw new AppError(400, "任務狀態不可標完成")
    // 可選：proofImageUrl（小孩附照片證明）
    const proofImageUrl = req.body?.proofImageUrl
      ? String(req.body.proofImageUrl).slice(0, 500)
      : null
    // 可選：submissionNote（小孩描述「我做了什麼」）
    const submissionNote = req.body?.submissionNote
      ? String(req.body.submissionNote).slice(0, 500)
      : null
    const [updated] = await db
      .update(kidsTasks)
      .set({
        status: "submitted",
        completedAt: new Date(),
        updatedAt: new Date(),
        ...(proofImageUrl ? { proofImageUrl } : {}),
        ...(submissionNote ? { submissionNote } : {}),
      })
      .where(eq(kidsTasks.id, id))
      .returning()
    res.json(updated)
  })
)

router.post(
  "/api/family/tasks/:id/reject",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const [task] = await db.select().from(kidsTasks).where(eq(kidsTasks.id, id)).limit(1)
    if (!task) throw new AppError(404, "任務不存在")
    if (task.status !== "submitted") throw new AppError(400, "只可駁回已標完成的任務")
    const parentFeedback = req.body?.parentFeedback
      ? String(req.body.parentFeedback).slice(0, 500)
      : null
    const [updated] = await db
      .update(kidsTasks)
      .set({
        status: "rejected",
        updatedAt: new Date(),
        notes: req.body?.notes ?? task.notes,
        ...(parentFeedback ? { parentFeedback } : {}),
      })
      .where(eq(kidsTasks.id, id))
      .returning()
    res.json(updated)
  })
)

/**
 * 家長 approve 任務：
 *  1. 更新任務 status=approved
 *  2. 按三罐比例分配 rewardAmount 進 kids_jars
 *  3. 更新 totalReceived
 *  4. 觸發任務徽章（first_task / tasks_10 / tasks_50）
 */
router.post(
  "/api/family/tasks/:id/approve",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const [task] = await db.select().from(kidsTasks).where(eq(kidsTasks.id, id)).limit(1)
    if (!task) throw new AppError(404, "任務不存在")
    if (task.status !== "submitted" && task.status !== "pending") {
      throw new AppError(400, "只可 approve 待處理/已完成任務")
    }
    if (!task.kidId) throw new AppError(400, "任務未指定小孩")

    const [kid] = await db
      .select()
      .from(kidsAccounts)
      .where(eq(kidsAccounts.id, task.kidId))
      .limit(1)
    if (!kid) throw new AppError(404, "小孩帳戶不存在")
    await ensureJarsRow(kid.id)

    const baseReward = parseFloat(task.rewardAmount)
    // 驚喜獎勵：15% 機率觸發 +50% bonus（小孩有期待感、培養正向回饋）
    // 環境變數 FAMILY_KIDS_NO_BONUS=1 可關閉（測試 / 不想要的人）
    const bonusEnabled = process.env.FAMILY_KIDS_NO_BONUS !== "1"
    const surpriseTriggered = bonusEnabled && Math.random() < 0.15
    const bonusAmount = surpriseTriggered ? Math.round(baseReward * 0.5) : 0
    const reward = baseReward + bonusAmount
    const spendAdd = (reward * kid.spendRatio) / 100
    const saveAdd = (reward * kid.saveRatio) / 100
    const giveAdd = (reward * kid.giveRatio) / 100

    // 更新 jars
    await db.execute(sql`
      UPDATE kids_jars
      SET spend_balance = spend_balance + ${spendAdd.toFixed(2)}::numeric,
          save_balance  = save_balance + ${saveAdd.toFixed(2)}::numeric,
          give_balance  = give_balance + ${giveAdd.toFixed(2)}::numeric,
          total_received = total_received + ${reward.toFixed(2)}::numeric,
          updated_at = NOW()
      WHERE kid_id = ${kid.id}
    `)

    // 串入主系統：寫一筆 payment_item + payment_record 進主系統
    // → 在 /cost-overview「一般單項」會看到、/financial-dashboard 也會算進總支出
    let mainPaymentItemId: number | null = null
    let mainPaymentRecordId: number | null = null
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [pi] = await db
        .insert(paymentItems)
        .values({
          itemName: surpriseTriggered
            ? `🎁✨ ${kid.displayName} 零用金（含驚喜）：${task.title}`
            : `🎁 ${kid.displayName} 零用金：${task.title}`,
          totalAmount: reward.toFixed(2),
          paidAmount: reward.toFixed(2),
          itemType: "home",
          paymentType: "single",
          status: "paid",
          startDate: today,
          source: "manual",
          notes:
            `家庭記帳「小孩模式」自動入帳\n小孩：${kid.displayName}（id=${kid.id}）\n任務：${task.title}\n` +
            (surpriseTriggered
              ? `基本 $${baseReward} + 驚喜 +$${bonusAmount} = $${reward}\n`
              : "") +
            `三罐分配：花用 $${spendAdd} / 儲蓄 $${saveAdd} / 捐獻 $${giveAdd}`,
          tags: "kids,allowance",
        })
        .returning({ id: paymentItems.id })
      mainPaymentItemId = pi.id

      const [pr] = await db
        .insert(paymentRecords)
        .values({
          itemId: pi.id,
          amountPaid: reward.toFixed(2),
          paymentDate: today,
          paymentMethod: "現金",
          notes: `家庭記帳：${kid.displayName} 完成「${task.title}」`,
        })
        .returning({ id: paymentRecords.id })
      mainPaymentRecordId = pr.id
    } catch (err) {
      // 串接主系統失敗不阻斷任務 approve（雙保險）
      console.warn("[family-kids] 寫入 payment_records 失敗：", err)
    }

    // 更新 task（含主系統 record id + 可選家長回饋）
    const parentFeedback = req.body?.parentFeedback
      ? String(req.body.parentFeedback).slice(0, 500)
      : null
    const [updated] = await db
      .update(kidsTasks)
      .set({
        status: "approved",
        approvedAt: new Date(),
        paymentRecordId: mainPaymentRecordId,
        updatedAt: new Date(),
        ...(parentFeedback ? { parentFeedback } : {}),
      })
      .where(eq(kidsTasks.id, id))
      .returning()

    // 觸發徽章（任務數 + streak）
    const awarded = await checkTaskBadges(kid.id)
    const streak = await calcStreak(kid.id)
    const streakBadges = await checkStreakBadges(kid.id, streak)
    awarded.push(...streakBadges)

    // Recurring：若任務設定週期重複、自動產生下一筆相同任務
    let nextRecurringTaskId: number | null = null
    if (task.recurringInterval === "weekly" || task.recurringInterval === "monthly") {
      const intervalDays = task.recurringInterval === "weekly" ? 7 : 30
      // 計算下次到期日（從原本 dueDate 算起、無則從今天算）
      const baseDate = task.dueDate ? new Date(task.dueDate) : new Date()
      const nextDue = new Date(baseDate.getTime() + intervalDays * 86400000)
      const nextDueStr = nextDue.toISOString().slice(0, 10)
      try {
        const [next] = await db
          .insert(kidsTasks)
          .values({
            familyId: task.familyId,
            kidId: task.kidId,
            title: task.title,
            emoji: task.emoji,
            rewardAmount: task.rewardAmount,
            status: "pending",
            notes: task.notes,
            dueDate: nextDueStr,
            recurringInterval: task.recurringInterval,
            // 同 chain 的 parentId 沿用、不存在則自己當 root
            recurringParentId: task.recurringParentId ?? task.id,
          })
          .returning({ id: kidsTasks.id })
        nextRecurringTaskId = next?.id ?? null
      } catch (err) {
        console.warn("[family-kids] 產生 recurring 下一筆失敗：", err)
      }
    }

    res.json({
      task: updated,
      jars: { spendAdd, saveAdd, giveAdd, total: reward },
      newBadges: awarded,
      bonus: {
        triggered: surpriseTriggered,
        baseAmount: baseReward,
        bonusAmount,
        totalAmount: reward,
      },
      mainSystem: {
        paymentItemId: mainPaymentItemId,
        paymentRecordId: mainPaymentRecordId,
        synced: mainPaymentItemId !== null,
      },
      recurring: {
        interval: task.recurringInterval,
        nextTaskId: nextRecurringTaskId,
      },
    })
  })
)

router.delete(
  "/api/family/tasks/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const [del] = await db.delete(kidsTasks).where(eq(kidsTasks.id, id)).returning()
    if (!del) throw new AppError(404, "任務不存在")
    res.json({ ok: true })
  })
)

// ============================================================
// 3. 存錢目標
// ============================================================
router.get(
  "/api/family/goals",
  asyncHandler(async (req, res) => {
    const kidIdQ = req.query.kidId ? Number(req.query.kidId) : undefined
    const conds = kidIdQ ? [eq(kidsGoals.kidId, kidIdQ)] : []
    const rows = await db
      .select()
      .from(kidsGoals)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(kidsGoals.createdAt))
    res.json(rows)
  })
)

router.post(
  "/api/family/goals",
  asyncHandler(async (req, res) => {
    const parsed = insertKidsGoalSchema.safeParse({ ...req.body, status: "active" })
    if (!parsed.success) {
      throw new AppError(
        400,
        "資料格式錯誤：" + parsed.error.errors.map((e) => e.message).join(", ")
      )
    }
    const [created] = await db.insert(kidsGoals).values(parsed.data).returning()
    res.status(201).json(created)
  })
)

/**
 * 從 save 罐撥錢到目標：
 *  1. 檢查 save_balance 足夠
 *  2. save_balance -= amount、goal.currentAmount += amount
 *  3. 若達標 → status=completed、觸發徽章
 */
router.post(
  "/api/family/goals/:id/save",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const amount = Number(req.body?.amount ?? 0)
    if (!(amount > 0)) throw new AppError(400, "amount 需為正數")

    const [goal] = await db.select().from(kidsGoals).where(eq(kidsGoals.id, id)).limit(1)
    if (!goal) throw new AppError(404, "目標不存在")
    if (goal.status !== "active") throw new AppError(400, "目標非進行中")

    const [jar] = await db.select().from(kidsJars).where(eq(kidsJars.kidId, goal.kidId)).limit(1)
    if (!jar) throw new AppError(404, "小孩罐子不存在")
    const saveBal = parseFloat(jar.saveBalance)
    if (saveBal < amount) throw new AppError(400, `存錢罐餘額 $${saveBal} 不足 $${amount}`)

    const newCurrent = parseFloat(goal.currentAmount) + amount
    const targetAmount = parseFloat(goal.targetAmount)
    const reached = newCurrent >= targetAmount

    await db.execute(sql`
      UPDATE kids_jars SET save_balance = save_balance - ${amount.toFixed(2)}::numeric,
                            updated_at = NOW()
      WHERE kid_id = ${goal.kidId}
    `)
    // 達成時可附「達成感言」（completedReflection）
    const completedReflection = req.body?.completedReflection
      ? String(req.body.completedReflection).slice(0, 500)
      : null
    const [updated] = await db
      .update(kidsGoals)
      .set({
        currentAmount: newCurrent.toFixed(2),
        status: reached ? "completed" : "active",
        completedAt: reached ? new Date() : null,
        updatedAt: new Date(),
        ...(reached && completedReflection ? { completedReflection } : {}),
      })
      .where(eq(kidsGoals.id, id))
      .returning()

    const awarded: string[] = []
    if (reached) {
      if (
        await awardBadgeIfNew(goal.kidId, "first_goal", "完成第一個存錢目標", "🎯", { goalId: id })
      ) {
        awarded.push("first_goal")
      }
      // 也檢查「目標 5 個 / 10 個」徽章
      const r = await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM kids_goals WHERE kid_id = ${goal.kidId} AND status = 'completed'
      `)
      const n = (r as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0
      if (n >= 5 && (await awardBadgeIfNew(goal.kidId, "goals_5", "完成 5 個目標", "🌈")))
        awarded.push("goals_5")
    }

    res.json({ goal: updated, newBadges: awarded, reached })
  })
)

router.put(
  "/api/family/goals/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const body = { ...req.body, updatedAt: new Date() }
    const [updated] = await db.update(kidsGoals).set(body).where(eq(kidsGoals.id, id)).returning()
    if (!updated) throw new AppError(404, "目標不存在")
    res.json(updated)
  })
)

// ============================================================
// 4. Dashboard 聚合
// ============================================================
router.get(
  "/api/family/dashboard",
  asyncHandler(async (req, res) => {
    const kidIdQ = req.query.kidId ? Number(req.query.kidId) : null
    if (!kidIdQ) {
      // 全家：所有小孩 + jars 加總
      const kids = await db.select().from(kidsAccounts).where(eq(kidsAccounts.isActive, true))
      const jars = await db.select().from(kidsJars)
      const totalReceived = jars.reduce((s, j) => s + parseFloat(j.totalReceived), 0)
      const totalSaved = jars.reduce((s, j) => s + parseFloat(j.saveBalance), 0)
      const pendingTasks = await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM kids_tasks WHERE status IN ('pending', 'submitted')
      `)
      const submittedTasks = await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM kids_tasks WHERE status = 'submitted'
      `)
      res.json({
        scope: "family",
        kids,
        totalReceived,
        totalSaved,
        pendingTaskCount: (pendingTasks as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
        toApproveCount: (submittedTasks as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
      })
      return
    }

    // 個別小孩
    const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, kidIdQ)).limit(1)
    if (!kid) throw new AppError(404, "小孩不存在")
    await ensureJarsRow(kid.id)
    const [jar] = await db.select().from(kidsJars).where(eq(kidsJars.kidId, kid.id)).limit(1)
    const tasks = await db
      .select()
      .from(kidsTasks)
      .where(eq(kidsTasks.kidId, kid.id))
      .orderBy(desc(kidsTasks.createdAt))
      .limit(20)
    const goals = await db
      .select()
      .from(kidsGoals)
      .where(eq(kidsGoals.kidId, kid.id))
      .orderBy(desc(kidsGoals.createdAt))
    const badges = await db
      .select()
      .from(kidsBadges)
      .where(eq(kidsBadges.kidId, kid.id))
      .orderBy(desc(kidsBadges.earnedAt))

    const streak = await calcStreak(kid.id)
    res.json({ scope: "kid", kid, jar, tasks, goals, badges, streak })
  })
)

// ============================================================
// 5. 花錢紀錄（小孩自己記）
// ============================================================
router.get(
  "/api/family/spendings",
  asyncHandler(async (req, res) => {
    const kidIdQ = req.query.kidId ? Number(req.query.kidId) : undefined
    if (!kidIdQ) throw new AppError(400, "需傳 kidId")
    const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200)
    const rows = await db
      .select()
      .from(kidsSpendings)
      .where(eq(kidsSpendings.kidId, kidIdQ))
      .orderBy(desc(kidsSpendings.spendDate), desc(kidsSpendings.id))
      .limit(limit)
    res.json(rows)
  })
)

/**
 * POST /api/family/spendings
 * Body: { kidId, jar('spend'|'save'|'give'), amount, description, emoji?, spendDate? }
 * 小孩花錢：從對應罐扣餘額、寫紀錄
 */
router.post(
  "/api/family/spendings",
  asyncHandler(async (req, res) => {
    const data = {
      kidId: Number(req.body?.kidId),
      jar: String(req.body?.jar ?? ""),
      amount: req.body?.amount,
      description: String(req.body?.description ?? "").trim(),
      emoji: req.body?.emoji ?? "💰",
      spendDate: req.body?.spendDate ?? new Date().toISOString().slice(0, 10),
      // give 罐特殊欄位（可選）
      recipient: req.body?.recipient ? String(req.body.recipient).slice(0, 100) : null,
      reflection: req.body?.reflection ? String(req.body.reflection).slice(0, 1000) : null,
    }

    if (!data.description) throw new AppError(400, "請填寫項目名稱")
    const parsed = insertKidsSpendingSchema.safeParse(data)
    if (!parsed.success) {
      throw new AppError(
        400,
        "資料格式錯誤：" + parsed.error.errors.map((e) => e.message).join(", ")
      )
    }
    const amt = parseFloat(parsed.data.amount)
    if (!(amt > 0)) throw new AppError(400, "金額需為正數")

    // 檢查餘額
    const [jar] = await db.select().from(kidsJars).where(eq(kidsJars.kidId, data.kidId)).limit(1)
    if (!jar) throw new AppError(404, "小孩罐子不存在")
    const balanceMap = {
      spend: parseFloat(jar.spendBalance),
      save: parseFloat(jar.saveBalance),
      give: parseFloat(jar.giveBalance),
    } as const
    const current = balanceMap[parsed.data.jar as keyof typeof balanceMap]
    if (current < amt) {
      throw new AppError(400, `${parsed.data.jar} 罐餘額 $${current} 不足 $${amt}`)
    }

    // 扣餘額（用 SQL 避免 race）
    const col = `${parsed.data.jar}_balance`
    await db.execute(sql`
      UPDATE kids_jars
      SET ${sql.raw(col)} = ${sql.raw(col)} - ${amt.toFixed(2)}::numeric,
          total_spent = total_spent + ${amt.toFixed(2)}::numeric,
          updated_at = NOW()
      WHERE kid_id = ${data.kidId}
    `)

    const [created] = await db.insert(kidsSpendings).values(parsed.data).returning()

    // 給罐子（捐獻）→ 檢查累計徽章
    const newBadges: string[] = []
    if (parsed.data.jar === "give") {
      const totalRow = await db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s FROM kids_spendings
        WHERE kid_id = ${data.kidId} AND jar = 'give'
      `)
      const totalGiven = parseFloat(
        String((totalRow as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? "0")
      )
      if (totalGiven >= 100 && (await awardBadgeIfNew(data.kidId, "give_100", "捐 $100", "❤️")))
        newBadges.push("give_100")
      if (totalGiven >= 500 && (await awardBadgeIfNew(data.kidId, "give_500", "捐 $500", "💝")))
        newBadges.push("give_500")
    }
    res.status(201).json({ ...created, newBadges })
  })
)

/**
 * POST /api/family/jars/transfer
 * 兄弟姊妹互贈零用金
 * Body: { fromKidId, toKidId, amount, jar?, message? }
 *
 * 流程：
 *  1. 從 fromKid 對應 jar 扣（預設 spend 罐）
 *  2. 加到 toKid 的 spend 罐 + totalReceived
 *  3. 兩邊各建一筆 kids_spendings 紀錄（培養同理心 + 受贈紀錄）
 *
 * 培養同理心、家庭互助
 */
router.post(
  "/api/family/jars/transfer",
  asyncHandler(async (req, res) => {
    const fromKidId = Number(req.body?.fromKidId)
    const toKidId = Number(req.body?.toKidId)
    const amount = Number(req.body?.amount)
    const fromJar = String(req.body?.jar ?? "spend") as "spend" | "save" | "give"
    const message = req.body?.message ? String(req.body.message).slice(0, 200) : null

    if (!fromKidId || !toKidId) throw new AppError(400, "fromKidId / toKidId 必填")
    if (fromKidId === toKidId) throw new AppError(400, "不能送禮給自己")
    if (!(amount > 0)) throw new AppError(400, "金額需為正數")
    if (!["spend", "save", "give"].includes(fromJar)) {
      throw new AppError(400, "jar 須為 spend / save / give")
    }

    const [fromKid] = await db
      .select()
      .from(kidsAccounts)
      .where(eq(kidsAccounts.id, fromKidId))
      .limit(1)
    const [toKid] = await db
      .select()
      .from(kidsAccounts)
      .where(eq(kidsAccounts.id, toKidId))
      .limit(1)
    if (!fromKid || !toKid) throw new AppError(404, "找不到指定小孩")

    await ensureJarsRow(fromKidId)
    await ensureJarsRow(toKidId)
    const [fromJarRow] = await db
      .select()
      .from(kidsJars)
      .where(eq(kidsJars.kidId, fromKidId))
      .limit(1)
    const balMap = {
      spend: parseFloat(fromJarRow.spendBalance),
      save: parseFloat(fromJarRow.saveBalance),
      give: parseFloat(fromJarRow.giveBalance),
    }
    if (balMap[fromJar] < amount) {
      throw new AppError(400, `${fromJar} 罐餘額 $${balMap[fromJar]} 不足 $${amount}`)
    }

    // 扣 from 罐
    const fromCol = `${fromJar}_balance`
    await db.execute(sql`
      UPDATE kids_jars
      SET ${sql.raw(fromCol)} = ${sql.raw(fromCol)} - ${amount.toFixed(2)}::numeric,
          total_spent = total_spent + ${amount.toFixed(2)}::numeric,
          updated_at = NOW()
      WHERE kid_id = ${fromKidId}
    `)
    // 加到 to 的 spend 罐（受贈方可自由運用）+ totalReceived
    await db.execute(sql`
      UPDATE kids_jars
      SET spend_balance = spend_balance + ${amount.toFixed(2)}::numeric,
          total_received = total_received + ${amount.toFixed(2)}::numeric,
          updated_at = NOW()
      WHERE kid_id = ${toKidId}
    `)

    const today = new Date().toISOString().slice(0, 10)
    // from 紀錄（jar=give、recipient=toKid 名字）
    // to 方靠 jars.total_received 累計、不另建負值紀錄
    await db.insert(kidsSpendings).values({
      kidId: fromKidId,
      jar: "give",
      amount: amount.toFixed(2),
      description: `送禮給 ${toKid.displayName}`,
      emoji: "💝",
      spendDate: today,
      recipient: toKid.displayName,
      reflection: message,
    })

    res.json({
      ok: true,
      from: fromKid.displayName,
      to: toKid.displayName,
      amount,
      fromJar,
      message,
    })
  })
)

router.delete(
  "/api/family/spendings/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const [sp] = await db.select().from(kidsSpendings).where(eq(kidsSpendings.id, id)).limit(1)
    if (!sp) throw new AppError(404, "紀錄不存在")
    const amt = parseFloat(sp.amount)
    const col = `${sp.jar}_balance`
    // 退回餘額
    await db.execute(sql`
      UPDATE kids_jars
      SET ${sql.raw(col)} = ${sql.raw(col)} + ${amt.toFixed(2)}::numeric,
          total_spent = GREATEST(0, total_spent - ${amt.toFixed(2)}::numeric),
          updated_at = NOW()
      WHERE kid_id = ${sp.kidId}
    `)
    await db.delete(kidsSpendings).where(eq(kidsSpendings.id, id))
    res.json({ ok: true })
  })
)

router.get(
  "/api/family/badges",
  asyncHandler(async (req, res) => {
    const kidIdQ = req.query.kidId ? Number(req.query.kidId) : null
    if (!kidIdQ) throw new AppError(400, "需傳 kidId")
    const rows = await db
      .select()
      .from(kidsBadges)
      .where(eq(kidsBadges.kidId, kidIdQ))
      .orderBy(desc(kidsBadges.earnedAt))
    res.json(rows)
  })
)

/**
 * GET /api/family/jars-trend?kidId=&days=30
 * 過去 N 天每天的三罐餘額趨勢（累積收 - 累積花）
 * 給小孩看自己存錢進步、培養儲蓄成就感
 */
router.get(
  "/api/family/jars-trend",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10), 7), 90)

    // 取小孩比例
    const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, kidIdQ)).limit(1)
    if (!kid) throw new AppError(404, "小孩不存在")

    // 對每一天計算「累積至當天」的三罐餘額
    // 收入面：approved tasks WHERE approved_at <= day（按比例分配）
    // 支出面：spendings WHERE spend_date <= day（按 jar 扣）
    const rows = await db.execute(sql`
      WITH RECURSIVE day_series AS (
        SELECT (CURRENT_DATE - INTERVAL '${sql.raw(String(days - 1))} days')::date AS d
        UNION ALL
        SELECT (d + INTERVAL '1 day')::date FROM day_series WHERE d < CURRENT_DATE
      ),
      received AS (
        SELECT
          ds.d,
          COALESCE(SUM(t.reward_amount::numeric), 0)::numeric AS total
        FROM day_series ds
        LEFT JOIN kids_tasks t ON t.kid_id = ${kidIdQ}
          AND t.status = 'approved'
          AND t.approved_at::date <= ds.d
        GROUP BY ds.d
      ),
      spent AS (
        SELECT
          ds.d,
          COALESCE(SUM(s.amount::numeric) FILTER (WHERE s.jar = 'spend'), 0)::numeric AS spend_out,
          COALESCE(SUM(s.amount::numeric) FILTER (WHERE s.jar = 'save'), 0)::numeric AS save_out,
          COALESCE(SUM(s.amount::numeric) FILTER (WHERE s.jar = 'give'), 0)::numeric AS give_out
        FROM day_series ds
        LEFT JOIN kids_spendings s ON s.kid_id = ${kidIdQ} AND s.spend_date <= ds.d
        GROUP BY ds.d
      )
      SELECT
        to_char(r.d, 'YYYY-MM-DD') AS date,
        ROUND(r.total * ${kid.spendRatio} / 100 - sp.spend_out, 2)::numeric AS "spendBalance",
        ROUND(r.total * ${kid.saveRatio}  / 100 - sp.save_out,  2)::numeric AS "saveBalance",
        ROUND(r.total * ${kid.giveRatio}  / 100 - sp.give_out,  2)::numeric AS "giveBalance"
      FROM received r
      JOIN spent sp ON sp.d = r.d
      ORDER BY r.d
    `)
    const trend = (
      rows as unknown as {
        rows: {
          date: string
          spendBalance: string
          saveBalance: string
          giveBalance: string
        }[]
      }
    ).rows.map((r) => ({
      date: r.date,
      spend: parseFloat(r.spendBalance),
      save: parseFloat(r.saveBalance),
      give: parseFloat(r.giveBalance),
    }))
    res.json({ kidId: kidIdQ, days, trend })
  })
)

/**
 * GET /api/family/jars-trend-multi?days=30
 * 全家所有 active 小孩的「總餘額」每日趨勢（spend+save+give）
 * 給家長一目了然看誰存錢進步、誰花得多
 * Response: { days, dates: string[], series: [{ kidId, displayName, avatar, color, values: number[] }] }
 */
router.get(
  "/api/family/jars-trend-multi",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10), 7), 90)
    const kids = await db.select().from(kidsAccounts).where(eq(kidsAccounts.isActive, true))
    if (kids.length === 0) {
      res.json({ days, dates: [], series: [] })
      return
    }

    // 一次 query：對每個 kid 算每天的「總餘額」
    // total = received - all spendings（不分罐、簡化視圖）
    const rows = await db.execute(sql`
      WITH RECURSIVE day_series AS (
        SELECT (CURRENT_DATE - INTERVAL '${sql.raw(String(days - 1))} days')::date AS d
        UNION ALL
        SELECT (d + INTERVAL '1 day')::date FROM day_series WHERE d < CURRENT_DATE
      ),
      kid_day AS (
        SELECT k.id AS kid_id, ds.d
        FROM kids_accounts k
        CROSS JOIN day_series ds
        WHERE k.is_active = true
      ),
      received AS (
        SELECT
          kd.kid_id, kd.d,
          COALESCE(SUM(t.reward_amount::numeric), 0)::numeric AS total_received
        FROM kid_day kd
        LEFT JOIN kids_tasks t ON t.kid_id = kd.kid_id
          AND t.status = 'approved'
          AND t.approved_at::date <= kd.d
        GROUP BY kd.kid_id, kd.d
      ),
      spent AS (
        SELECT
          kd.kid_id, kd.d,
          COALESCE(SUM(s.amount::numeric), 0)::numeric AS total_spent
        FROM kid_day kd
        LEFT JOIN kids_spendings s ON s.kid_id = kd.kid_id AND s.spend_date <= kd.d
        GROUP BY kd.kid_id, kd.d
      )
      SELECT
        r.kid_id AS "kidId",
        to_char(r.d, 'YYYY-MM-DD') AS date,
        ROUND(r.total_received - sp.total_spent, 2)::numeric AS balance
      FROM received r
      JOIN spent sp ON sp.kid_id = r.kid_id AND sp.d = r.d
      ORDER BY r.d, r.kid_id
    `)
    const rs = (
      rows as unknown as {
        rows: { kidId: number; date: string; balance: string | number }[]
      }
    ).rows

    // 組 dates 陣列 + 每個 kid 的 values 陣列（按 dates 對齊）
    const datesSet = new Set<string>()
    rs.forEach((r) => datesSet.add(r.date))
    const dates = Array.from(datesSet).sort()
    const byKid = new Map<number, Record<string, number>>()
    rs.forEach((r) => {
      if (!byKid.has(r.kidId)) byKid.set(r.kidId, {})
      byKid.get(r.kidId)![r.date] = parseFloat(String(r.balance))
    })

    const series = kids.map((k) => ({
      kidId: k.id,
      displayName: k.displayName,
      avatar: k.avatar,
      color: k.color,
      values: dates.map((d) => byKid.get(k.id)?.[d] ?? 0),
    }))

    res.json({ days, dates, series })
  })
)

/**
 * GET /api/family/monthly-report?kidId=&month=YYYY-MM
 * 個別小孩本月戰績：任務 / 入帳 / 三罐增量 / 花錢 / 目標 / 徽章
 */
router.get(
  "/api/family/monthly-report",
  asyncHandler(async (req, res) => {
    const kidId = Number(req.query.kidId)
    if (!Number.isInteger(kidId) || kidId < 1) throw new AppError(400, "需傳 kidId")
    const monthStr = (req.query.month as string | undefined) ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(monthStr)) throw new AppError(400, "month 格式 YYYY-MM")
    const [year, month] = monthStr.split("-").map(Number)
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
    const endY = month === 12 ? year + 1 : year
    const endM = month === 12 ? 1 : month + 1
    const nextMonth = `${endY}-${String(endM).padStart(2, "0")}-01`

    // 任務統計
    const taskAgg = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_count,
        COALESCE(SUM(reward_amount::numeric) FILTER (WHERE status = 'approved'), 0)::numeric AS approved_sum,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_count,
        COUNT(*) FILTER (WHERE status IN ('pending', 'submitted'))::int AS pending_count
      FROM kids_tasks
      WHERE kid_id = ${kidId}
        AND (approved_at >= ${monthStart}::timestamp AND approved_at < ${nextMonth}::timestamp
             OR created_at >= ${monthStart}::timestamp AND created_at < ${nextMonth}::timestamp)
    `)
    const taskStats = (
      taskAgg as unknown as {
        rows: {
          approved_count: number
          approved_sum: string
          rejected_count: number
          pending_count: number
        }[]
      }
    ).rows[0] ?? { approved_count: 0, approved_sum: "0", rejected_count: 0, pending_count: 0 }

    // 花錢列表
    const spendingsRows = await db.execute(sql`
      SELECT id, jar, amount::numeric AS amount, description, emoji, spend_date AS "spendDate"
      FROM kids_spendings
      WHERE kid_id = ${kidId}
        AND spend_date >= ${monthStart}::date AND spend_date < ${nextMonth}::date
      ORDER BY spend_date DESC, id DESC
    `)
    const spendings = (
      spendingsRows as unknown as {
        rows: {
          id: number
          jar: string
          amount: string
          description: string
          emoji: string | null
          spendDate: string
        }[]
      }
    ).rows.map((s) => ({ ...s, amount: parseFloat(s.amount) }))
    const totalSpent = spendings.reduce((sum, s) => sum + s.amount, 0)

    // 完成目標
    const goalsRows = await db.execute(sql`
      SELECT id, name, emoji, target_amount::numeric AS "targetAmount", completed_at AS "completedAt"
      FROM kids_goals
      WHERE kid_id = ${kidId} AND status = 'completed'
        AND completed_at >= ${monthStart}::timestamp AND completed_at < ${nextMonth}::timestamp
      ORDER BY completed_at DESC
    `)
    const completedGoals = (
      goalsRows as unknown as {
        rows: {
          id: number
          name: string
          emoji: string | null
          targetAmount: string
          completedAt: string
        }[]
      }
    ).rows.map((g) => ({ ...g, targetAmount: parseFloat(g.targetAmount) }))

    // 解鎖徽章
    const badgesRows = await db.execute(sql`
      SELECT id, badge_type AS "badgeType", title, emoji, earned_at AS "earnedAt"
      FROM kids_badges
      WHERE kid_id = ${kidId}
        AND earned_at >= ${monthStart}::timestamp AND earned_at < ${nextMonth}::timestamp
      ORDER BY earned_at DESC
    `)
    const badges = (
      badgesRows as unknown as {
        rows: {
          id: number
          badgeType: string
          title: string
          emoji: string
          earnedAt: string
        }[]
      }
    ).rows

    const approvedSum = parseFloat(taskStats.approved_sum)

    res.json({
      kidId,
      month: monthStr,
      tasks: {
        approvedCount: taskStats.approved_count,
        approvedSum,
        rejectedCount: taskStats.rejected_count,
        pendingCount: taskStats.pending_count,
        avgReward:
          taskStats.approved_count > 0 ? Math.round(approvedSum / taskStats.approved_count) : 0,
      },
      spendings: {
        count: spendings.length,
        totalSpent,
        items: spendings,
      },
      completedGoals,
      badges,
      netGain: approvedSum - totalSpent,
    })
  })
)

/**
 * GET /api/family/leaderboard?month=YYYY-MM
 * 本月排行榜：每個小孩的任務完成數 / 入帳金額 / 徽章數 / 達成目標數
 * 排序：approved sum DESC（賺最多的優先）
 */
router.get(
  "/api/family/leaderboard",
  asyncHandler(async (req, res) => {
    const monthStr = (req.query.month as string | undefined) ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(monthStr)) throw new AppError(400, "month 格式 YYYY-MM")
    const [year, month] = monthStr.split("-").map(Number)
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
    const endY = month === 12 ? year + 1 : year
    const endM = month === 12 ? 1 : month + 1
    const nextMonth = `${endY}-${String(endM).padStart(2, "0")}-01`

    const rows = await db.execute(sql`
      SELECT
        k.id AS "kidId",
        k.display_name AS "displayName",
        k.avatar,
        k.color,
        COALESCE(t.approved_count, 0)::int AS "approvedCount",
        COALESCE(t.approved_sum, 0)::numeric AS "approvedSum",
        COALESCE(t.weighted_score, 0)::int AS "weightedScore",
        COALESCE(t.hard_count, 0)::int AS "hardCount",
        COALESCE(g.completed_count, 0)::int AS "completedGoalsCount",
        COALESCE(b.badge_count, 0)::int AS "badgeCount"
      FROM kids_accounts k
      LEFT JOIN (
        SELECT kid_id,
               COUNT(*) AS approved_count,
               SUM(reward_amount::numeric) AS approved_sum,
               SUM(CASE difficulty
                     WHEN 'hard' THEN 3
                     WHEN 'medium' THEN 2
                     ELSE 1
                   END) AS weighted_score,
               COUNT(*) FILTER (WHERE difficulty = 'hard')::int AS hard_count
        FROM kids_tasks
        WHERE status = 'approved'
          AND approved_at >= ${monthStart}::timestamp
          AND approved_at < ${nextMonth}::timestamp
        GROUP BY kid_id
      ) t ON t.kid_id = k.id
      LEFT JOIN (
        SELECT kid_id, COUNT(*) AS completed_count
        FROM kids_goals
        WHERE status = 'completed'
          AND completed_at >= ${monthStart}::timestamp
          AND completed_at < ${nextMonth}::timestamp
        GROUP BY kid_id
      ) g ON g.kid_id = k.id
      LEFT JOIN (
        SELECT kid_id, COUNT(*) AS badge_count
        FROM kids_badges
        WHERE earned_at >= ${monthStart}::timestamp
          AND earned_at < ${nextMonth}::timestamp
        GROUP BY kid_id
      ) b ON b.kid_id = k.id
      WHERE k.is_active = true
      ORDER BY weighted_score DESC NULLS LAST, approved_sum DESC NULLS LAST, approved_count DESC NULLS LAST, k.id
    `)
    const list = (
      rows as unknown as {
        rows: {
          kidId: number
          displayName: string
          avatar: string
          color: string
          approvedCount: number
          approvedSum: string | number
          weightedScore: number
          hardCount: number
          completedGoalsCount: number
          badgeCount: number
        }[]
      }
    ).rows.map((r, i) => ({
      ...r,
      approvedSum: parseFloat(String(r.approvedSum)),
      rank: i + 1,
      medal: i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "",
    }))
    res.json({ month: monthStr, leaderboard: list })
  })
)

/**
 * 家長每日鼓勵卡
 *   POST /api/family/daily-message  → 寫鼓勵卡（每天每個小孩最多 1 則、覆蓋舊的）
 *   GET  /api/family/daily-message?kidId=&date= → 查當日鼓勵（沒寫回 null）
 */
router.post(
  "/api/family/daily-message",
  asyncHandler(async (req, res) => {
    const kidIdN = Number(req.body?.kidId)
    const message = String(req.body?.message ?? "").trim()
    const mood = String(req.body?.mood ?? "❤️").slice(0, 8)
    if (!kidIdN) throw new AppError(400, "kidId 必填")
    if (!message) throw new AppError(400, "message 必填")
    if (message.length > 500) throw new AppError(400, "訊息過長（500 字以內）")

    const today = new Date().toISOString().slice(0, 10)
    // Upsert by (kidId, messageDate)
    const existing = await db.execute(sql`
      SELECT id FROM kids_daily_messages
      WHERE kid_id = ${kidIdN} AND message_date = ${today}
      LIMIT 1
    `)
    const existingId = (existing as unknown as { rows: { id: number }[] }).rows[0]?.id

    if (existingId) {
      await db.execute(sql`
        UPDATE kids_daily_messages
        SET message = ${message}, mood = ${mood}
        WHERE id = ${existingId}
      `)
      const [updated] = await db
        .select()
        .from(kidsDailyMessages)
        .where(eq(kidsDailyMessages.id, existingId))
        .limit(1)
      res.json({ ok: true, message: updated, updated: true })
    } else {
      const [created] = await db
        .insert(kidsDailyMessages)
        .values({ kidId: kidIdN, message, mood, messageDate: today })
        .returning()
      res.status(201).json({ ok: true, message: created, updated: false })
    }
  })
)

router.get(
  "/api/family/daily-message",
  asyncHandler(async (req, res) => {
    const kidIdN = Number(req.query?.kidId)
    if (!kidIdN) throw new AppError(400, "kidId 必填")
    const date = (req.query?.date as string) ?? new Date().toISOString().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError(400, "date 格式 YYYY-MM-DD")
    const [row] = await db
      .select()
      .from(kidsDailyMessages)
      .where(and(eq(kidsDailyMessages.kidId, kidIdN), eq(kidsDailyMessages.messageDate, date)))
      .limit(1)
    res.json({ kidId: kidIdN, date, message: row ?? null })
  })
)

/**
 * GET /api/family/family-monthly-summary?month=YYYY-MM
 * 全家本月匯總：每個 active 小孩 + grand totals
 * 家長一頁看完全家本月戰績
 */
router.get(
  "/api/family/family-monthly-summary",
  asyncHandler(async (req, res) => {
    const monthStr = (req.query.month as string | undefined) ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(monthStr)) throw new AppError(400, "month 格式 YYYY-MM")
    const [year, month] = monthStr.split("-").map(Number)
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
    const endY = month === 12 ? year + 1 : year
    const endM = month === 12 ? 1 : month + 1
    const nextMonth = `${endY}-${String(endM).padStart(2, "0")}-01`

    const rows = await db.execute(sql`
      SELECT
        k.id AS "kidId",
        k.display_name AS "displayName",
        k.avatar,
        k.color,
        COALESCE(t.approved_count, 0)::int AS "approvedCount",
        COALESCE(t.approved_sum, 0)::numeric AS "approvedSum",
        COALESCE(t.rejected_count, 0)::int AS "rejectedCount",
        COALESCE(t.hard_count, 0)::int AS "hardCount",
        COALESCE(t.weighted_score, 0)::int AS "weightedScore",
        COALESCE(s.total_spent, 0)::numeric AS "totalSpent",
        COALESCE(s.spend_jar, 0)::numeric AS "spendJarOut",
        COALESCE(s.save_jar, 0)::numeric AS "saveJarOut",
        COALESCE(s.give_jar, 0)::numeric AS "giveJarOut",
        COALESCE(g.completed_count, 0)::int AS "goalCompletedCount",
        COALESCE(b.badge_count, 0)::int AS "badgeCount"
      FROM kids_accounts k
      LEFT JOIN (
        SELECT kid_id,
               COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
               SUM(reward_amount::numeric) FILTER (WHERE status = 'approved') AS approved_sum,
               COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
               COUNT(*) FILTER (WHERE status = 'approved' AND difficulty = 'hard') AS hard_count,
               SUM(CASE WHEN status = 'approved'
                        THEN CASE difficulty
                               WHEN 'hard' THEN 3 WHEN 'medium' THEN 2 ELSE 1
                             END
                        ELSE 0 END) AS weighted_score
        FROM kids_tasks
        WHERE (approved_at >= ${monthStart}::timestamp AND approved_at < ${nextMonth}::timestamp)
           OR (status = 'rejected' AND updated_at >= ${monthStart}::timestamp AND updated_at < ${nextMonth}::timestamp)
        GROUP BY kid_id
      ) t ON t.kid_id = k.id
      LEFT JOIN (
        SELECT kid_id,
               SUM(amount::numeric) AS total_spent,
               SUM(amount::numeric) FILTER (WHERE jar = 'spend') AS spend_jar,
               SUM(amount::numeric) FILTER (WHERE jar = 'save') AS save_jar,
               SUM(amount::numeric) FILTER (WHERE jar = 'give') AS give_jar
        FROM kids_spendings
        WHERE spend_date >= ${monthStart}::date AND spend_date < ${nextMonth}::date
        GROUP BY kid_id
      ) s ON s.kid_id = k.id
      LEFT JOIN (
        SELECT kid_id, COUNT(*) AS completed_count
        FROM kids_goals
        WHERE status = 'completed'
          AND completed_at >= ${monthStart}::timestamp
          AND completed_at < ${nextMonth}::timestamp
        GROUP BY kid_id
      ) g ON g.kid_id = k.id
      LEFT JOIN (
        SELECT kid_id, COUNT(*) AS badge_count
        FROM kids_badges
        WHERE earned_at >= ${monthStart}::timestamp AND earned_at < ${nextMonth}::timestamp
        GROUP BY kid_id
      ) b ON b.kid_id = k.id
      WHERE k.is_active = true
      ORDER BY "weightedScore" DESC, "approvedSum" DESC, k.id
    `)

    const kidsList = (
      rows as unknown as {
        rows: Array<{
          kidId: number
          displayName: string
          avatar: string
          color: string
          approvedCount: number
          approvedSum: string | number
          rejectedCount: number
          hardCount: number
          weightedScore: number
          totalSpent: string | number
          spendJarOut: string | number
          saveJarOut: string | number
          giveJarOut: string | number
          goalCompletedCount: number
          badgeCount: number
        }>
      }
    ).rows.map((r) => ({
      ...r,
      approvedSum: parseFloat(String(r.approvedSum)),
      totalSpent: parseFloat(String(r.totalSpent)),
      spendJarOut: parseFloat(String(r.spendJarOut)),
      saveJarOut: parseFloat(String(r.saveJarOut)),
      giveJarOut: parseFloat(String(r.giveJarOut)),
    }))

    const grandTotal = kidsList.reduce(
      (s, k) => ({
        approvedCount: s.approvedCount + k.approvedCount,
        approvedSum: s.approvedSum + k.approvedSum,
        rejectedCount: s.rejectedCount + k.rejectedCount,
        hardCount: s.hardCount + k.hardCount,
        weightedScore: s.weightedScore + k.weightedScore,
        totalSpent: s.totalSpent + k.totalSpent,
        giveJarOut: s.giveJarOut + k.giveJarOut,
        goalCompletedCount: s.goalCompletedCount + k.goalCompletedCount,
        badgeCount: s.badgeCount + k.badgeCount,
      }),
      {
        approvedCount: 0,
        approvedSum: 0,
        rejectedCount: 0,
        hardCount: 0,
        weightedScore: 0,
        totalSpent: 0,
        giveJarOut: 0,
        goalCompletedCount: 0,
        badgeCount: 0,
      }
    )

    res.json({ month: monthStr, kids: kidsList, grandTotal })
  })
)

/**
 * GET /api/family/parent-reminders
 * 家長提醒中心：一頁聚合該關注的事
 *   - 待審任務（submitted 等家長 approve）
 *   - 逾期任務（dueDate 已過 + still pending/submitted）
 *   - 接近達成的目標（≥80%）
 *   - 7 天無活動的 active 小孩
 */
router.get(
  "/api/family/parent-reminders",
  asyncHandler(async (_req, res) => {
    const submittedRows = await db.execute(sql`
      SELECT t.id, t.title, t.emoji, t.reward_amount::numeric AS reward,
             k.display_name AS kid_name, k.avatar
      FROM kids_tasks t
      LEFT JOIN kids_accounts k ON k.id = t.kid_id
      WHERE t.status = 'submitted'
      ORDER BY t.completed_at DESC
      LIMIT 20
    `)

    const overdueRows = await db.execute(sql`
      SELECT t.id, t.title, t.emoji, t.due_date,
             (CURRENT_DATE - t.due_date)::int AS days_overdue,
             k.display_name AS kid_name, k.avatar
      FROM kids_tasks t
      LEFT JOIN kids_accounts k ON k.id = t.kid_id
      WHERE t.status IN ('pending', 'submitted')
        AND t.due_date IS NOT NULL
        AND t.due_date < CURRENT_DATE
      ORDER BY t.due_date ASC
      LIMIT 20
    `)

    const nearGoalRows = await db.execute(sql`
      SELECT g.id, g.name, g.emoji,
             g.target_amount::numeric AS target,
             g.current_amount::numeric AS current,
             ROUND(g.current_amount::numeric / g.target_amount::numeric * 100, 0)::int AS progress,
             k.display_name AS kid_name, k.avatar
      FROM kids_goals g
      LEFT JOIN kids_accounts k ON k.id = g.kid_id
      WHERE g.status = 'active'
        AND g.target_amount::numeric > 0
        AND g.current_amount::numeric / g.target_amount::numeric >= 0.8
      ORDER BY progress DESC
      LIMIT 10
    `)

    const inactiveRows = await db.execute(sql`
      SELECT k.id, k.display_name, k.avatar,
             COALESCE(MAX(GREATEST(
               COALESCE(t.approved_at, '1970-01-01'::timestamp),
               COALESCE(s.created_at, '1970-01-01'::timestamp)
             )), '1970-01-01'::timestamp) AS last_activity
      FROM kids_accounts k
      LEFT JOIN kids_tasks t ON t.kid_id = k.id AND t.status = 'approved'
      LEFT JOIN kids_spendings s ON s.kid_id = k.id
      WHERE k.is_active = true
      GROUP BY k.id, k.display_name, k.avatar
      HAVING COALESCE(MAX(GREATEST(
        COALESCE(t.approved_at, '1970-01-01'::timestamp),
        COALESCE(s.created_at, '1970-01-01'::timestamp)
      )), '1970-01-01'::timestamp) < (NOW() - INTERVAL '7 days')
    `)

    res.json({
      submitted: (
        submittedRows as unknown as {
          rows: Array<{
            id: number
            title: string
            emoji: string | null
            reward: string | number
            kid_name: string
            avatar: string
          }>
        }
      ).rows.map((r) => ({
        id: r.id,
        title: r.title,
        emoji: r.emoji,
        reward: parseFloat(String(r.reward)),
        kidName: r.kid_name,
        avatar: r.avatar,
      })),
      overdue: (
        overdueRows as unknown as {
          rows: Array<{
            id: number
            title: string
            emoji: string | null
            due_date: string
            days_overdue: number
            kid_name: string
            avatar: string
          }>
        }
      ).rows.map((r) => ({
        id: r.id,
        title: r.title,
        emoji: r.emoji,
        dueDate: r.due_date,
        daysOverdue: r.days_overdue,
        kidName: r.kid_name,
        avatar: r.avatar,
      })),
      nearGoal: (
        nearGoalRows as unknown as {
          rows: Array<{
            id: number
            name: string
            emoji: string | null
            target: string | number
            current: string | number
            progress: number
            kid_name: string
            avatar: string
          }>
        }
      ).rows.map((r) => ({
        id: r.id,
        name: r.name,
        emoji: r.emoji,
        target: parseFloat(String(r.target)),
        current: parseFloat(String(r.current)),
        progress: r.progress,
        kidName: r.kid_name,
        avatar: r.avatar,
      })),
      inactiveKids: (
        inactiveRows as unknown as {
          rows: Array<{
            id: number
            display_name: string
            avatar: string
            last_activity: string
          }>
        }
      ).rows.map((r) => ({
        id: r.id,
        displayName: r.display_name,
        avatar: r.avatar,
        lastActivity: r.last_activity,
      })),
    })
  })
)

/**
 * GET /api/family/badges-catalog?kidId=
 * 所有可達徽章的目錄 + 該小孩進度（含未解鎖）
 * 培養目標感：「再做 N 個就解鎖」激勵
 */
router.get(
  "/api/family/badges-catalog",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    // 該小孩統計
    const taskStats = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM kids_tasks
      WHERE kid_id = ${kidIdQ} AND status = 'approved'
    `)
    const totalApproved = (taskStats as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0

    const goalStats = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM kids_goals
      WHERE kid_id = ${kidIdQ} AND status = 'completed'
    `)
    const totalGoals = (goalStats as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0

    const giveStats = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s FROM kids_spendings
      WHERE kid_id = ${kidIdQ} AND jar = 'give'
    `)
    const totalGiven = parseFloat(
      String((giveStats as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? "0")
    )

    const streak = await calcStreak(kidIdQ)

    const earned = await db
      .select({ badgeType: kidsBadges.badgeType, earnedAt: kidsBadges.earnedAt })
      .from(kidsBadges)
      .where(eq(kidsBadges.kidId, kidIdQ))
    const earnedMap = new Map(earned.map((b) => [b.badgeType, b.earnedAt]))

    // 徽章目錄定義（中央化）
    const CATALOG = [
      {
        type: "first_task",
        title: "完成第一個任務",
        emoji: "🌟",
        target: 1,
        current: totalApproved,
        unit: "tasks",
      },
      {
        type: "tasks_10",
        title: "完成 10 個任務",
        emoji: "💪",
        target: 10,
        current: totalApproved,
        unit: "tasks",
      },
      {
        type: "tasks_50",
        title: "完成 50 個任務",
        emoji: "🏆",
        target: 50,
        current: totalApproved,
        unit: "tasks",
      },
      {
        type: "first_goal",
        title: "完成第一個存錢目標",
        emoji: "🎯",
        target: 1,
        current: totalGoals,
        unit: "goals",
      },
      {
        type: "goals_5",
        title: "完成 5 個目標",
        emoji: "🌈",
        target: 5,
        current: totalGoals,
        unit: "goals",
      },
      {
        type: "streak_7",
        title: "連續打卡 7 天",
        emoji: "🔥",
        target: 7,
        current: streak,
        unit: "days",
      },
      {
        type: "streak_30",
        title: "連續打卡 30 天",
        emoji: "🌟",
        target: 30,
        current: streak,
        unit: "days",
      },
      {
        type: "streak_100",
        title: "連續打卡 100 天",
        emoji: "👑",
        target: 100,
        current: streak,
        unit: "days",
      },
      {
        type: "give_100",
        title: "捐 $100",
        emoji: "❤️",
        target: 100,
        current: totalGiven,
        unit: "dollars",
      },
      {
        type: "give_500",
        title: "捐 $500",
        emoji: "💝",
        target: 500,
        current: totalGiven,
        unit: "dollars",
      },
    ]

    const list = CATALOG.map((b) => {
      const earnedAt = earnedMap.get(b.type)
      const progress = Math.min(100, Math.round((b.current / b.target) * 100))
      return {
        badgeType: b.type,
        title: b.title,
        emoji: b.emoji,
        target: b.target,
        current: Math.min(b.current, b.target),
        unit: b.unit,
        progress,
        earned: !!earnedAt,
        earnedAt: earnedAt ?? null,
      }
    })

    const totalEarned = list.filter((b) => b.earned).length
    res.json({
      kidId: kidIdQ,
      totalEarned,
      totalCatalog: CATALOG.length,
      badges: list,
    })
  })
)

/**
 * 小孩自訂頭像 / 顏色（不需家長 PIN）
 * PUT /api/family/kids/:id/personalize
 * 限定欄位：avatar, color（不能改 pin / ratios / displayName）
 */
router.put(
  "/api/family/kids/:id/personalize",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, id)).limit(1)
    if (!kid) throw new AppError(404, "小孩不存在")

    const body: Record<string, unknown> = {}
    if (req.body?.avatar) {
      const a = String(req.body.avatar).slice(0, 32)
      if (!a) throw new AppError(400, "avatar 不可空")
      body.avatar = a
    }
    if (req.body?.color) {
      const c = String(req.body.color)
      const allowed = ["blue", "pink", "green", "amber", "purple", "cyan"]
      if (!allowed.includes(c)) throw new AppError(400, "color 不合法")
      body.color = c
    }
    if (Object.keys(body).length === 0) {
      throw new AppError(400, "至少需提供 avatar 或 color")
    }
    body.updatedAt = new Date()
    const [updated] = await db
      .update(kidsAccounts)
      .set(body)
      .where(eq(kidsAccounts.id, id))
      .returning()
    res.json(updated)
  })
)

/**
 * 任務評論串
 *   GET  /api/family/tasks/:id/comments      列出該任務所有評論
 *   POST /api/family/tasks/:id/comments      新增（author: 'parent' / 'kid'、message）
 */
router.get(
  "/api/family/tasks/:id/comments",
  asyncHandler(async (req, res) => {
    const taskId = Number(req.params.id)
    if (!Number.isInteger(taskId) || taskId < 1) throw new AppError(400, "無效的 taskId")
    const rows = await db
      .select()
      .from(kidsTaskComments)
      .where(eq(kidsTaskComments.taskId, taskId))
      .orderBy(kidsTaskComments.createdAt, kidsTaskComments.id)
    res.json(rows)
  })
)

router.post(
  "/api/family/tasks/:id/comments",
  asyncHandler(async (req, res) => {
    const taskId = Number(req.params.id)
    if (!Number.isInteger(taskId) || taskId < 1) throw new AppError(400, "無效的 taskId")
    const author = String(req.body?.author ?? "").trim()
    if (!["parent", "kid"].includes(author)) {
      throw new AppError(400, "author 須為 parent 或 kid")
    }
    const message = String(req.body?.message ?? "").trim()
    if (!message) throw new AppError(400, "message 必填")
    if (message.length > 500) throw new AppError(400, "message 過長（500 字以內）")
    const emoji = String(req.body?.emoji ?? "💬").slice(0, 8)

    // 驗證 task 存在
    const [task] = await db.select().from(kidsTasks).where(eq(kidsTasks.id, taskId)).limit(1)
    if (!task) throw new AppError(404, "任務不存在")

    const [created] = await db
      .insert(kidsTaskComments)
      .values({ taskId, author, message, emoji })
      .returning()
    res.status(201).json(created)
  })
)

/**
 * 捐贈追蹤
 * GET /api/family/donations?kidId=
 * 聚合 give 罐 spendings、按 recipient 分組 + 總計 + 6 月趨勢
 * 培養同理心、視覺呈現「自己幫了多少人」
 */
router.get(
  "/api/family/donations",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const items = await db
      .select()
      .from(kidsSpendings)
      .where(and(eq(kidsSpendings.kidId, kidIdQ), eq(kidsSpendings.jar, "give")))
      .orderBy(desc(kidsSpendings.spendDate), desc(kidsSpendings.id))

    const total = items.reduce((s, x) => s + parseFloat(x.amount), 0)

    const byRecipient: Record<string, { count: number; total: number }> = {}
    items.forEach((x) => {
      const key = x.recipient ?? "未分類"
      if (!byRecipient[key]) byRecipient[key] = { count: 0, total: 0 }
      byRecipient[key].count += 1
      byRecipient[key].total += parseFloat(x.amount)
    })
    const recipients = Object.entries(byRecipient)
      .map(([recipient, v]) => ({ recipient, count: v.count, total: v.total }))
      .sort((a, b) => b.total - a.total)

    const monthMap: Record<string, number> = {}
    items.forEach((x) => {
      const m = String(x.spendDate).slice(0, 7)
      monthMap[m] = (monthMap[m] ?? 0) + parseFloat(x.amount)
    })
    const now = new Date()
    const monthlyTrend: { month: string; total: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      monthlyTrend.push({ month: m, total: monthMap[m] ?? 0 })
    }

    res.json({
      kidId: kidIdQ,
      total,
      count: items.length,
      recipients,
      monthlyTrend,
      items: items.slice(0, 50).map((x) => ({
        id: x.id,
        amount: parseFloat(x.amount),
        description: x.description,
        emoji: x.emoji,
        recipient: x.recipient,
        reflection: x.reflection,
        spendDate: x.spendDate,
      })),
    })
  })
)

/**
 * 小孩願望清單
 *   GET    /api/family/wishes?kidId=          列出（按 priority desc 然後 createdAt desc）
 *   POST   /api/family/wishes                 新增（kidId + title 必填）
 *   PUT    /api/family/wishes/:id             更新（status / priority / title 等）
 *   DELETE /api/family/wishes/:id             刪除
 *   POST   /api/family/wishes/:id/promote     升級成存錢目標（建 kids_goals + status=promoted_to_goal）
 */
router.get(
  "/api/family/wishes",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const rows = await db
      .select()
      .from(kidsWishes)
      .where(eq(kidsWishes.kidId, kidIdQ))
      .orderBy(desc(kidsWishes.priority), desc(kidsWishes.id))
    res.json(rows)
  })
)

router.post(
  "/api/family/wishes",
  asyncHandler(async (req, res) => {
    const kidIdN = Number(req.body?.kidId)
    const title = String(req.body?.title ?? "").trim()
    if (!kidIdN) throw new AppError(400, "kidId 必填")
    if (!title) throw new AppError(400, "title 必填")
    if (title.length > 100) throw new AppError(400, "title 過長")
    const emoji = String(req.body?.emoji ?? "✨").slice(0, 8)
    const priority = Math.max(1, Math.min(3, Number(req.body?.priority ?? 2)))
    const estimatedPrice =
      req.body?.estimatedPrice != null && Number(req.body.estimatedPrice) > 0
        ? Number(req.body.estimatedPrice).toFixed(2)
        : null

    const [created] = await db
      .insert(kidsWishes)
      .values({
        kidId: kidIdN,
        title,
        emoji,
        priority,
        estimatedPrice,
      })
      .returning()
    res.status(201).json(created)
  })
)

router.put(
  "/api/family/wishes/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const body: Record<string, unknown> = {}
    if (req.body?.title) body.title = String(req.body.title).slice(0, 100)
    if (req.body?.emoji) body.emoji = String(req.body.emoji).slice(0, 8)
    if (req.body?.priority != null) {
      body.priority = Math.max(1, Math.min(3, Number(req.body.priority)))
    }
    if (req.body?.status) {
      const s = String(req.body.status)
      if (!["wished", "promoted_to_goal", "abandoned"].includes(s)) {
        throw new AppError(400, "status 不合法")
      }
      body.status = s
    }
    if (req.body?.estimatedPrice != null) {
      const v = Number(req.body.estimatedPrice)
      body.estimatedPrice = v > 0 ? v.toFixed(2) : null
    }
    body.updatedAt = new Date()
    const [updated] = await db.update(kidsWishes).set(body).where(eq(kidsWishes.id, id)).returning()
    if (!updated) throw new AppError(404, "願望不存在")
    res.json(updated)
  })
)

router.delete(
  "/api/family/wishes/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const deleted = await db
      .delete(kidsWishes)
      .where(eq(kidsWishes.id, id))
      .returning({ id: kidsWishes.id })
    if (deleted.length === 0) throw new AppError(404, "願望不存在")
    res.json({ ok: true, id })
  })
)

router.post(
  "/api/family/wishes/:id/promote",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const [wish] = await db.select().from(kidsWishes).where(eq(kidsWishes.id, id)).limit(1)
    if (!wish) throw new AppError(404, "願望不存在")
    if (wish.status !== "wished") throw new AppError(400, "願望非可升級狀態")

    // 允許 body 覆寫 targetAmount（如果 wish 沒寫 estimatedPrice）
    const targetAmount =
      req.body?.targetAmount != null
        ? Number(req.body.targetAmount)
        : wish.estimatedPrice
          ? parseFloat(wish.estimatedPrice)
          : 0
    if (!(targetAmount > 0)) throw new AppError(400, "需提供 targetAmount 或 wish.estimatedPrice")

    // 建 goal
    const [goal] = await db
      .insert(kidsGoals)
      .values({
        kidId: wish.kidId,
        name: wish.title,
        emoji: wish.emoji,
        targetAmount: targetAmount.toFixed(2),
        reflection: `從願望清單升級（想要程度：${"⭐".repeat(wish.priority)}）`,
      })
      .returning()

    // 更新 wish status + 連結
    const [updatedWish] = await db
      .update(kidsWishes)
      .set({
        status: "promoted_to_goal",
        promotedGoalId: goal.id,
        updatedAt: new Date(),
      })
      .where(eq(kidsWishes.id, id))
      .returning()

    res.json({ ok: true, wish: updatedWish, goal })
  })
)

/**
 * 家長自訂任務範本收藏
 *   GET    /api/family/custom-templates       列出
 *   POST   /api/family/custom-templates       新增（title, emoji?, defaultReward, defaultDifficulty?）
 *   DELETE /api/family/custom-templates/:id   刪除
 */
router.get(
  "/api/family/custom-templates",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(familyTaskTemplates)
      .orderBy(familyTaskTemplates.sortOrder, familyTaskTemplates.id)
    res.json(rows)
  })
)

router.post(
  "/api/family/custom-templates",
  asyncHandler(async (req, res) => {
    const title = String(req.body?.title ?? "").trim()
    if (!title) throw new AppError(400, "title 必填")
    if (title.length > 100) throw new AppError(400, "title 過長")
    const emoji = String(req.body?.emoji ?? "📋").slice(0, 8)
    const defaultReward = Number(req.body?.defaultReward ?? 0)
    if (!(defaultReward > 0)) throw new AppError(400, "defaultReward 需為正數")
    const defaultDifficulty = String(req.body?.defaultDifficulty ?? "medium")
    if (!["easy", "medium", "hard"].includes(defaultDifficulty)) {
      throw new AppError(400, "難度需為 easy / medium / hard")
    }
    const sortOrder = Number.isInteger(req.body?.sortOrder) ? Number(req.body.sortOrder) : 0

    const [created] = await db
      .insert(familyTaskTemplates)
      .values({
        title,
        emoji,
        defaultReward: defaultReward.toFixed(2),
        defaultDifficulty,
        sortOrder,
      })
      .returning()
    res.status(201).json(created)
  })
)

router.delete(
  "/api/family/custom-templates/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const deleted = await db
      .delete(familyTaskTemplates)
      .where(eq(familyTaskTemplates.id, id))
      .returning({ id: familyTaskTemplates.id })
    if (deleted.length === 0) throw new AppError(404, "範本不存在")
    res.json({ ok: true, id })
  })
)

/**
 * GET /api/family/activity-feed?days=30
 * 全家活動 Timeline：過去 N 天的所有事件
 *   - tasks（approved / rejected）
 *   - spendings
 *   - goals（completed）
 *   - badges
 * 按時間倒序、家長首頁一頁看完
 */
router.get(
  "/api/family/activity-feed",
  asyncHandler(async (req, res) => {
    const days = Math.max(1, Math.min(365, Number(req.query.days ?? 30)))
    const sinceIso = new Date(Date.now() - days * 86400000).toISOString()

    const rows = await db.execute(sql`
      SELECT * FROM (
        SELECT
          'task_approved' AS event_type,
          t.id AS ref_id,
          t.kid_id,
          k.display_name AS kid_name,
          k.avatar AS kid_avatar,
          t.title AS detail,
          t.emoji AS emoji,
          t.reward_amount::numeric AS amount,
          t.approved_at AS ts
        FROM kids_tasks t
        JOIN kids_accounts k ON k.id = t.kid_id
        WHERE t.status = 'approved'
          AND t.approved_at IS NOT NULL
          AND t.approved_at >= ${sinceIso}::timestamp

        UNION ALL
        SELECT
          'task_rejected' AS event_type,
          t.id AS ref_id,
          t.kid_id,
          k.display_name AS kid_name,
          k.avatar AS kid_avatar,
          t.title AS detail,
          t.emoji AS emoji,
          NULL::numeric AS amount,
          t.updated_at AS ts
        FROM kids_tasks t
        JOIN kids_accounts k ON k.id = t.kid_id
        WHERE t.status = 'rejected'
          AND t.updated_at >= ${sinceIso}::timestamp

        UNION ALL
        SELECT
          'spending' AS event_type,
          s.id AS ref_id,
          s.kid_id,
          k.display_name AS kid_name,
          k.avatar AS kid_avatar,
          s.description AS detail,
          s.emoji AS emoji,
          s.amount::numeric AS amount,
          s.created_at AS ts
        FROM kids_spendings s
        JOIN kids_accounts k ON k.id = s.kid_id
        WHERE s.created_at >= ${sinceIso}::timestamp

        UNION ALL
        SELECT
          'goal_completed' AS event_type,
          g.id AS ref_id,
          g.kid_id,
          k.display_name AS kid_name,
          k.avatar AS kid_avatar,
          g.name AS detail,
          g.emoji AS emoji,
          g.target_amount::numeric AS amount,
          g.completed_at AS ts
        FROM kids_goals g
        JOIN kids_accounts k ON k.id = g.kid_id
        WHERE g.status = 'completed'
          AND g.completed_at IS NOT NULL
          AND g.completed_at >= ${sinceIso}::timestamp

        UNION ALL
        SELECT
          'badge_earned' AS event_type,
          b.id AS ref_id,
          b.kid_id,
          k.display_name AS kid_name,
          k.avatar AS kid_avatar,
          b.title AS detail,
          b.emoji AS emoji,
          NULL::numeric AS amount,
          b.earned_at AS ts
        FROM kids_badges b
        JOIN kids_accounts k ON k.id = b.kid_id
        WHERE b.earned_at >= ${sinceIso}::timestamp
      ) feed
      ORDER BY ts DESC
      LIMIT 100
    `)

    const items = (
      rows as unknown as {
        rows: {
          event_type: string
          ref_id: number
          kid_id: number
          kid_name: string
          kid_avatar: string
          detail: string
          emoji: string | null
          amount: string | number | null
          ts: string
        }[]
      }
    ).rows.map((r) => ({
      eventType: r.event_type,
      refId: r.ref_id,
      kidId: r.kid_id,
      kidName: r.kid_name,
      kidAvatar: r.kid_avatar,
      detail: r.detail,
      emoji: r.emoji,
      amount: r.amount === null ? null : parseFloat(String(r.amount)),
      ts: r.ts,
    }))

    res.json({ days, items })
  })
)

/**
 * GET /api/family/tasks.ics
 * 匯出未完成 + 有 dueDate 的任務為 ICS 行事曆檔
 * 家長可下載匯入 Google Calendar / Apple Calendar / Outlook
 *
 * 規格參考 RFC 5545、最小可用：BEGIN:VCALENDAR ... VEVENT
 * UID 用 task ID + domain、DTSTART/DTEND 用 dueDate 整天事件
 */
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
}

function formatIcsDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

function formatIcsTimestamp(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  const h = String(d.getUTCHours()).padStart(2, "0")
  const mi = String(d.getUTCMinutes()).padStart(2, "0")
  const s = String(d.getUTCSeconds()).padStart(2, "0")
  return `${y}${m}${day}T${h}${mi}${s}Z`
}

router.get(
  "/api/family/tasks.ics",
  asyncHandler(async (req, res) => {
    // 只匯出未完成（pending/submitted）且有 dueDate 的
    const tasks = await db.execute(sql`
      SELECT t.id, t.title, t.emoji, t.reward_amount, t.due_date, t.status, t.difficulty,
             t.notes, k.display_name AS kid_name
      FROM kids_tasks t
      LEFT JOIN kids_accounts k ON k.id = t.kid_id
      WHERE t.due_date IS NOT NULL
        AND t.status IN ('pending', 'submitted')
      ORDER BY t.due_date ASC
    `)
    const rows = (
      tasks as unknown as {
        rows: {
          id: number
          title: string
          emoji: string | null
          reward_amount: string
          due_date: string
          status: string
          difficulty: string
          notes: string | null
          kid_name: string | null
        }[]
      }
    ).rows

    const now = new Date()
    const dtstamp = formatIcsTimestamp(now)

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//homi.cc//Money Family Tasks//ZH-TW",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:家庭任務",
      "X-WR-TIMEZONE:Asia/Taipei",
    ]
    for (const row of rows) {
      const due = new Date(row.due_date)
      const dueStart = formatIcsDate(due)
      // 整天事件 DTEND 是隔天
      const dayAfter = new Date(due.getTime() + 24 * 60 * 60 * 1000)
      const dueEnd = formatIcsDate(dayAfter)
      const stars = row.difficulty === "easy" ? "⭐" : row.difficulty === "hard" ? "⭐⭐⭐" : "⭐⭐"
      const summary = `${row.emoji ?? "📋"} ${row.title} ${stars} ($${row.reward_amount})`
      const desc = [
        `指派給：${row.kid_name ?? "—"}`,
        `獎勵：$${row.reward_amount}`,
        `難度：${stars}`,
        `狀態：${row.status}`,
        row.notes ? `備註：${row.notes}` : "",
      ]
        .filter(Boolean)
        .join("\\n")
      lines.push(
        "BEGIN:VEVENT",
        `UID:family-task-${row.id}@homi.cc`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dueStart}`,
        `DTEND;VALUE=DATE:${dueEnd}`,
        `SUMMARY:${escapeIcs(summary)}`,
        `DESCRIPTION:${escapeIcs(desc)}`,
        "CATEGORIES:家庭任務",
        "STATUS:CONFIRMED",
        "TRANSP:TRANSPARENT",
        "END:VEVENT"
      )
    }
    lines.push("END:VCALENDAR")

    const body = lines.join("\r\n") + "\r\n"
    res.setHeader("Content-Type", "text/calendar; charset=utf-8")
    res.setHeader("Content-Disposition", 'attachment; filename="family-tasks.ics"')
    res.send(body)
  })
)

export default router
