/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 01，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { eq, and, desc } from "drizzle-orm"
import {
  kidsAccounts,
  kidsTasks,
  insertKidsAccountSchema,
  insertKidsTaskSchema,
} from "@shared/schema"
import { ensureJarsRow } from "./helpers"

const router = Router()

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
      .select()
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

/**
 * PUT /api/family/tasks/:id
 * 編輯既有任務（限 pending 狀態）
 */
router.put(
  "/api/family/tasks/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const [task] = await db.select().from(kidsTasks).where(eq(kidsTasks.id, id)).limit(1)
    if (!task) throw new AppError(404, "任務不存在")
    if (task.status !== "pending") {
      throw new AppError(400, "只可編輯尚未開始的任務（pending 狀態）")
    }

    const body: Record<string, unknown> = {}
    if (req.body?.title !== undefined) {
      const t = String(req.body.title).trim()
      if (!t) throw new AppError(400, "title 不可空")
      if (t.length > 100) throw new AppError(400, "title 過長")
      body.title = t
    }
    if (req.body?.emoji !== undefined) body.emoji = String(req.body.emoji).slice(0, 8)
    if (req.body?.rewardAmount !== undefined) {
      const r = Number(req.body.rewardAmount)
      if (!(r > 0)) throw new AppError(400, "rewardAmount 需為正數")
      body.rewardAmount = r.toFixed(2)
    }
    if (req.body?.dueDate !== undefined) {
      body.dueDate = req.body.dueDate || null
    }
    if (req.body?.difficulty !== undefined) {
      const d = String(req.body.difficulty)
      if (!["easy", "medium", "hard"].includes(d)) throw new AppError(400, "difficulty 不合法")
      body.difficulty = d
    }
    if (req.body?.category !== undefined) {
      const c = String(req.body.category)
      if (!["housework", "study", "self_care", "kindness", "other"].includes(c))
        throw new AppError(400, "category 不合法")
      body.category = c
    }
    if (req.body?.notes !== undefined) {
      body.notes = req.body.notes ? String(req.body.notes).slice(0, 500) : null
    }
    if (req.body?.kidId !== undefined) {
      body.kidId = req.body.kidId === null ? null : Number(req.body.kidId)
    }
    if (Object.keys(body).length === 0) throw new AppError(400, "至少需提供一個欄位")
    body.updatedAt = new Date()
    const [updated] = await db.update(kidsTasks).set(body).where(eq(kidsTasks.id, id)).returning()
    res.json(updated)
  })
)

/**
 * POST /api/family/tasks/broadcast
 * 對所有 active 小孩各建一份相同任務（家長一鍵派全家）
 */
router.post(
  "/api/family/tasks/broadcast",
  asyncHandler(async (req, res) => {
    const activeKids = await db
      .select({ id: kidsAccounts.id })
      .from(kidsAccounts)
      .where(eq(kidsAccounts.isActive, true))
    if (activeKids.length === 0) throw new AppError(400, "目前沒有任何 active 小孩")

    const baseFields: Record<string, unknown> = {
      ...req.body,
      status: "pending",
    }
    delete baseFields.kidId

    const created = []
    for (const k of activeKids) {
      const parsed = insertKidsTaskSchema.safeParse({ ...baseFields, kidId: k.id })
      if (!parsed.success) {
        throw new AppError(
          400,
          "資料格式錯誤：" + parsed.error.errors.map((e) => e.message).join(", ")
        )
      }
      const [t] = await db.insert(kidsTasks).values(parsed.data).returning()
      created.push(t)
    }
    res.status(201).json({ count: created.length, tasks: created })
  })
)

/**
 * POST /api/family/tasks/:id/claim
 * 小孩搶無主任務（kidId IS NULL 且 status='pending'）
 * 培養主動性：家長派公開任務、誰先做誰拿
 */
router.post(
  "/api/family/tasks/:id/claim",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const kidIdN = Number(req.body?.kidId)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 taskId")
    if (!kidIdN) throw new AppError(400, "kidId 必填")
    const [task] = await db.select().from(kidsTasks).where(eq(kidsTasks.id, id)).limit(1)
    if (!task) throw new AppError(404, "任務不存在")
    if (task.kidId !== null) throw new AppError(400, "任務已被認領")
    if (task.status !== "pending") throw new AppError(400, "任務狀態不可認領")
    const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, kidIdN)).limit(1)
    if (!kid) throw new AppError(404, "小孩不存在")
    const [updated] = await db
      .update(kidsTasks)
      .set({ kidId: kidIdN, updatedAt: new Date() })
      .where(eq(kidsTasks.id, id))
      .returning()
    res.json({ ok: true, task: updated })
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

export default router
