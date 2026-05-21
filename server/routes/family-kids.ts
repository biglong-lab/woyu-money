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
import multer from "multer"
import path from "path"
import fs from "fs"
import {
  kidsAccounts,
  kidsJars,
  kidsTasks,
  kidsGoals,
  kidsBadges,
  kidsSpendings,
  kidsDailyMessages,
  familyTaskTemplates,
  familyRecipients,
  familyPots,
  familyPotContributions,
  kidsWishes,
  kidsTaskComments,
  kidsCheckins,
  insertKidsAccountSchema,
  insertKidsTaskSchema,
  insertKidsGoalSchema,
  insertKidsSpendingSchema,
  paymentItems,
  paymentRecords,
} from "@shared/schema"

const router = Router()

// ============================================================
// 小孩任務照片上傳 multer 設定（uploads/kids-proofs/）
// ============================================================
const proofDir = path.resolve(process.cwd(), "uploads/kids-proofs")
if (!fs.existsSync(proofDir)) {
  fs.mkdirSync(proofDir, { recursive: true })
}
const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, proofDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || ".jpg"
    const ts = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    cb(null, `proof_${ts}_${rand}${ext}`)
  },
})
const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp|heic)$/.test(file.mimetype)
    if (!ok) return cb(new Error("僅接受圖片（jpeg/png/gif/webp/heic）"))
    cb(null, true)
  },
})

// ============================================================
// helpers
// ============================================================
/**
 * Lazy 補發每月零用金
 * 流程：每次 dashboard 查時呼叫、若 kid.monthlyAllowance > 0 且 lastAllowanceMonth != currentMonth
 *   → 自動入帳 monthlyAllowance 並按三罐分配
 *   → 更新 lastAllowanceMonth = currentMonth
 *   → 寫一筆 payment_items / payment_records（主系統可看見）
 * 回傳：補發金額（0 = 沒發、>0 = 發了多少）
 */
async function ensureMonthlyAllowance(kidId: number): Promise<number> {
  const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, kidId)).limit(1)
  if (!kid) return 0
  const amount = parseFloat(kid.monthlyAllowance)
  if (!(amount > 0)) return 0
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  if (kid.lastAllowanceMonth === currentMonth) return 0

  // 入帳 + 三罐分配（複用 approve 邏輯）
  const spendAdd = Math.round((amount * kid.spendRatio) / 100)
  const saveAdd = Math.round((amount * kid.saveRatio) / 100)
  const giveAdd = amount - spendAdd - saveAdd
  await ensureJarsRow(kidId)
  await db.execute(sql`
    UPDATE kids_jars SET
      spend_balance = spend_balance + ${spendAdd.toFixed(2)}::numeric,
      save_balance = save_balance + ${saveAdd.toFixed(2)}::numeric,
      give_balance = give_balance + ${giveAdd.toFixed(2)}::numeric,
      total_received = total_received + ${amount.toFixed(2)}::numeric,
      updated_at = NOW()
    WHERE kid_id = ${kidId}
  `)
  await db
    .update(kidsAccounts)
    .set({ lastAllowanceMonth: currentMonth, updatedAt: new Date() })
    .where(eq(kidsAccounts.id, kidId))

  // 寫進主系統（複用既有 tags=kids,allowance 規範）
  try {
    const today = now.toISOString().slice(0, 10)
    const [pi] = await db
      .insert(paymentItems)
      .values({
        itemName: `📅 ${kid.displayName} ${currentMonth} 月零用金（自動入帳）`,
        totalAmount: amount.toFixed(2),
        paidAmount: amount.toFixed(2),
        itemType: "home",
        paymentType: "single",
        status: "paid",
        startDate: today,
        source: "manual",
        notes:
          `家庭記帳「每月零用金」自動入帳\n小孩：${kid.displayName}（id=${kid.id}）\n月份：${currentMonth}\n` +
          `三罐分配：花用 $${spendAdd} / 儲蓄 $${saveAdd} / 捐獻 $${giveAdd}`,
        tags: "kids,allowance,monthly",
      })
      .returning({ id: paymentItems.id })
    await db.insert(paymentRecords).values({
      itemId: pi.id,
      amountPaid: amount.toFixed(2),
      paymentDate: today,
      paymentMethod: "現金",
      notes: `家庭記帳：${kid.displayName} ${currentMonth} 月自動零用金`,
    })
  } catch (err) {
    console.warn("[family-kids] 自動零用金寫入 payment_items 失敗：", err)
  }

  return amount
}

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
  if (streak >= 365 && (await awardBadgeIfNew(kidId, "streak_365", "連續打卡 1 年", "🐉")))
    awarded.push("streak_365")
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
  if (n >= 100 && (await awardBadgeIfNew(kidId, "tasks_100", "完成 100 個任務", "🚀")))
    awarded.push("tasks_100")
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
    // 驚喜獎勵：15% 機率觸發隨機 bonus + emoji（小孩有期待感）
    // FAMILY_KIDS_NO_BONUS=1 可關閉
    // 5 種倍率（機率依稀有度遞減）、對應不同 emoji 與標題
    const BONUS_TIERS: Array<{
      multiplier: number
      emoji: string
      label: string
      weight: number
    }> = [
      { multiplier: 0.2, emoji: "🎁", label: "小驚喜", weight: 40 }, // +20%
      { multiplier: 0.5, emoji: "🎉", label: "驚喜獎勵", weight: 30 }, // +50%
      { multiplier: 1.0, emoji: "🌟", label: "閃亮獎勵", weight: 15 }, // +100%
      { multiplier: 1.5, emoji: "💥", label: "超級獎勵", weight: 10 }, // +150%
      { multiplier: 2.0, emoji: "🌈", label: "彩虹大禮", weight: 5 }, // +200%
    ]
    const bonusEnabled = process.env.FAMILY_KIDS_NO_BONUS !== "1"
    const surpriseTriggered = bonusEnabled && Math.random() < 0.15
    let bonusAmount = 0
    let bonusEmoji = ""
    let bonusLabel = ""
    if (surpriseTriggered) {
      // 加權隨機抽 tier
      const totalWeight = BONUS_TIERS.reduce((s, t) => s + t.weight, 0)
      let pick = Math.random() * totalWeight
      let chosen = BONUS_TIERS[0]
      for (const t of BONUS_TIERS) {
        pick -= t.weight
        if (pick <= 0) {
          chosen = t
          break
        }
      }
      bonusAmount = Math.round(baseReward * chosen.multiplier)
      bonusEmoji = chosen.emoji
      bonusLabel = chosen.label
    }
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
        emoji: bonusEmoji,
        label: bonusLabel,
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
      if (n >= 10 && (await awardBadgeIfNew(goal.kidId, "goals_10", "完成 10 個目標", "🏰")))
        awarded.push("goals_10")
    }

    // 儲蓄累積徽章（看 goal current_amount 累積）
    const saveSum = await db.execute(sql`
      SELECT COALESCE(SUM(current_amount::numeric), 0)::numeric AS s
      FROM kids_goals WHERE kid_id = ${goal.kidId}
    `)
    const saved = parseFloat(
      String((saveSum as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? "0")
    )
    if (saved >= 500 && (await awardBadgeIfNew(goal.kidId, "save_500", "存錢達 $500", "🪙")))
      awarded.push("save_500")
    if (saved >= 2000 && (await awardBadgeIfNew(goal.kidId, "save_2000", "存錢達 $2000", "💎")))
      awarded.push("save_2000")

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
    // Lazy 補發每月零用金（若 monthlyAllowance > 0 且本月未發）
    const allowanceJustGiven = await ensureMonthlyAllowance(kid.id)
    const [jar] = await db.select().from(kidsJars).where(eq(kidsJars.kidId, kid.id)).limit(1)
    const tasksRaw = await db
      .select()
      .from(kidsTasks)
      .where(eq(kidsTasks.kidId, kid.id))
      .orderBy(desc(kidsTasks.createdAt))
      .limit(20)
    // 加 isOverdue / isDueSoon / overdueDays（小孩端視覺警示用）
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const tasks = tasksRaw.map((r) => {
      const isPending = r.status === "pending" || r.status === "submitted"
      const isOverdue = !!(r.dueDate && r.dueDate < today && isPending)
      const isDueSoon = !!(
        r.dueDate &&
        (r.dueDate === today || r.dueDate === tomorrow) &&
        isPending &&
        !isOverdue
      )
      const overdueDays =
        isOverdue && r.dueDate
          ? Math.floor((new Date(today).getTime() - new Date(r.dueDate).getTime()) / 86400000)
          : 0
      return { ...r, isOverdue, isDueSoon, overdueDays }
    })
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
    res.json({ scope: "kid", kid, jar, tasks, goals, badges, streak, allowanceJustGiven })
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
      if (totalGiven >= 1000 && (await awardBadgeIfNew(data.kidId, "give_1000", "捐 $1000", "🕊️")))
        newBadges.push("give_1000")
      if (totalGiven >= 5000 && (await awardBadgeIfNew(data.kidId, "give_5000", "捐 $5000", "👼")))
        newBadges.push("give_5000")
    }
    res.status(201).json({ ...created, newBadges })
  })
)

/**
 * POST /api/family/jars/internal-transfer
 * 小孩自己在三罐之間移錢（不影響 totalReceived/totalSpent）
 * Body: { kidId, fromJar, toJar, amount }
 * 培養理財調整能力（多存錢、多花錢都可調整）
 */
router.post(
  "/api/family/jars/internal-transfer",
  asyncHandler(async (req, res) => {
    const kidIdN = Number(req.body?.kidId)
    const fromJar = String(req.body?.fromJar ?? "")
    const toJar = String(req.body?.toJar ?? "")
    const amount = Number(req.body?.amount ?? 0)
    if (!kidIdN) throw new AppError(400, "kidId 必填")
    if (!["spend", "save", "give"].includes(fromJar))
      throw new AppError(400, "fromJar 須為 spend / save / give")
    if (!["spend", "save", "give"].includes(toJar))
      throw new AppError(400, "toJar 須為 spend / save / give")
    if (fromJar === toJar) throw new AppError(400, "來源與目標罐相同")
    if (!(amount > 0)) throw new AppError(400, "金額需為正數")

    await ensureJarsRow(kidIdN)
    const [jar] = await db.select().from(kidsJars).where(eq(kidsJars.kidId, kidIdN)).limit(1)
    if (!jar) throw new AppError(404, "小孩罐子不存在")
    const balMap = {
      spend: parseFloat(jar.spendBalance),
      save: parseFloat(jar.saveBalance),
      give: parseFloat(jar.giveBalance),
    }
    if (balMap[fromJar as keyof typeof balMap] < amount) {
      throw new AppError(
        400,
        `${fromJar} 罐餘額 $${balMap[fromJar as keyof typeof balMap]} 不足 $${amount}`
      )
    }

    const fromCol = `${fromJar}_balance`
    const toCol = `${toJar}_balance`
    await db.execute(sql`
      UPDATE kids_jars
      SET ${sql.raw(fromCol)} = ${sql.raw(fromCol)} - ${amount.toFixed(2)}::numeric,
          ${sql.raw(toCol)} = ${sql.raw(toCol)} + ${amount.toFixed(2)}::numeric,
          updated_at = NOW()
      WHERE kid_id = ${kidIdN}
    `)
    res.json({ ok: true, kidId: kidIdN, fromJar, toJar, amount })
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
 * GET /api/family/leaderboard?month=YYYY-MM&mode=score
 * 本月排行榜、4 種 mode：
 *   - score（預設）：weightedScore + approvedSum + approvedCount
 *   - tasks：approvedCount
 *   - giving：本月 give 罐 sum
 *   - streak：當前 streak（不限本月、看當下）
 */
router.get(
  "/api/family/leaderboard",
  asyncHandler(async (req, res) => {
    const monthStr = (req.query.month as string | undefined) ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(monthStr)) throw new AppError(400, "month 格式 YYYY-MM")
    const mode = String(req.query.mode ?? "score")
    if (!["score", "tasks", "giving", "streak"].includes(mode)) {
      throw new AppError(400, "mode 須為 score / tasks / giving / streak")
    }
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
        COALESCE(b.badge_count, 0)::int AS "badgeCount",
        COALESCE(s.give_sum, 0)::numeric AS "giveSum"
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
      LEFT JOIN (
        SELECT kid_id, SUM(amount::numeric) AS give_sum
        FROM kids_spendings
        WHERE jar = 'give'
          AND spend_date >= ${monthStart}::date
          AND spend_date < ${nextMonth}::date
        GROUP BY kid_id
      ) s ON s.kid_id = k.id
      WHERE k.is_active = true
    `)
    const baseList = (
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
          giveSum: string | number
        }[]
      }
    ).rows.map((r) => ({
      ...r,
      approvedSum: parseFloat(String(r.approvedSum)),
      giveSum: parseFloat(String(r.giveSum)),
    }))

    // 補 streak（per kid 算）
    const withStreak = await Promise.all(
      baseList.map(async (k) => ({ ...k, streak: await calcStreak(k.kidId) }))
    )

    // 按 mode 排序
    const sorted = [...withStreak].sort((a, b) => {
      if (mode === "tasks")
        return b.approvedCount - a.approvedCount || b.approvedSum - a.approvedSum
      if (mode === "giving") return b.giveSum - a.giveSum || b.approvedSum - a.approvedSum
      if (mode === "streak") return b.streak - a.streak || b.approvedCount - a.approvedCount
      // score（預設）
      return (
        b.weightedScore - a.weightedScore ||
        b.approvedSum - a.approvedSum ||
        b.approvedCount - a.approvedCount
      )
    })

    const list = sorted.map((r, i) => ({
      ...r,
      rank: i + 1,
      medal: i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "",
    }))
    res.json({ month: monthStr, mode, leaderboard: list })
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
 * GET /api/family/year-summary?year=YYYY
 * 家庭年度回顧、年底儀式感、家長愛看
 * 統計：總任務 / 總給付 / 各小孩戰績 / 達成目標 / 徽章 / 最長 streak / 捐贈
 */
router.get(
  "/api/family/year-summary",
  asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear())
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      throw new AppError(400, "year 不合法")
    }
    const yearStart = `${year}-01-01`
    const nextYear = `${year + 1}-01-01`

    // 1) 各小孩戰績
    const kidStats = await db.execute(sql`
      SELECT
        k.id AS "kidId",
        k.display_name AS "displayName",
        k.avatar,
        k.color,
        COUNT(t.id) FILTER (WHERE t.status = 'approved')::int AS "approvedCount",
        COALESCE(SUM(t.reward_amount::numeric) FILTER (WHERE t.status = 'approved'), 0)::numeric AS "approvedSum",
        COUNT(*) FILTER (WHERE t.status = 'approved' AND t.difficulty = 'hard')::int AS "hardCount"
      FROM kids_accounts k
      LEFT JOIN kids_tasks t ON t.kid_id = k.id
        AND t.approved_at >= ${yearStart}::timestamp
        AND t.approved_at < ${nextYear}::timestamp
      WHERE k.is_active = true
      GROUP BY k.id, k.display_name, k.avatar, k.color
      ORDER BY "approvedSum" DESC, "approvedCount" DESC
    `)

    // 2) 達成目標
    const goalRows = await db.execute(sql`
      SELECT g.name, g.emoji, g.target_amount::numeric AS target,
             g.completed_at, k.display_name AS kid_name, k.avatar
      FROM kids_goals g
      LEFT JOIN kids_accounts k ON k.id = g.kid_id
      WHERE g.status = 'completed'
        AND g.completed_at >= ${yearStart}::timestamp
        AND g.completed_at < ${nextYear}::timestamp
      ORDER BY g.completed_at DESC
    `)

    // 3) 徽章
    const badgeRows = await db.execute(sql`
      SELECT b.badge_type, b.title, b.emoji, b.earned_at,
             k.display_name AS kid_name, k.avatar
      FROM kids_badges b
      LEFT JOIN kids_accounts k ON k.id = b.kid_id
      WHERE b.earned_at >= ${yearStart}::timestamp
        AND b.earned_at < ${nextYear}::timestamp
      ORDER BY b.earned_at DESC
    `)

    // 4) 捐贈紀錄
    const giveRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(s.amount::numeric), 0)::numeric AS total_given,
        COUNT(DISTINCT s.recipient) FILTER (WHERE s.recipient IS NOT NULL)::int AS recipient_count,
        COUNT(*)::int AS donation_count
      FROM kids_spendings s
      WHERE s.jar = 'give'
        AND s.spend_date >= ${yearStart}::date
        AND s.spend_date < ${nextYear}::date
    `)
    const giveStats = (
      giveRows as unknown as {
        rows: Array<{
          total_given: string | number
          recipient_count: number
          donation_count: number
        }>
      }
    ).rows[0]

    // 5) 月度給付分布（12 月一字排開）
    const monthRows = await db.execute(sql`
      SELECT
        EXTRACT(MONTH FROM approved_at)::int AS month,
        COALESCE(SUM(reward_amount::numeric), 0)::numeric AS total
      FROM kids_tasks
      WHERE status = 'approved'
        AND approved_at >= ${yearStart}::timestamp
        AND approved_at < ${nextYear}::timestamp
      GROUP BY EXTRACT(MONTH FROM approved_at)
      ORDER BY month
    `)
    const monthlyMap: Record<number, number> = {}
    ;(monthRows as unknown as { rows: { month: number; total: string | number }[] }).rows.forEach(
      (r) => {
        monthlyMap[r.month] = parseFloat(String(r.total))
      }
    )
    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      total: monthlyMap[i + 1] ?? 0,
    }))

    const kids = (
      kidStats as unknown as {
        rows: Array<{
          kidId: number
          displayName: string
          avatar: string
          color: string
          approvedCount: number
          approvedSum: string | number
          hardCount: number
        }>
      }
    ).rows.map((r) => ({
      ...r,
      approvedSum: parseFloat(String(r.approvedSum)),
    }))

    const grandTotal = {
      tasks: kids.reduce((s, k) => s + k.approvedCount, 0),
      reward: kids.reduce((s, k) => s + k.approvedSum, 0),
      hardCount: kids.reduce((s, k) => s + k.hardCount, 0),
      goalsCompleted: (goalRows as unknown as { rows: unknown[] }).rows.length,
      badgesEarned: (badgeRows as unknown as { rows: unknown[] }).rows.length,
      totalGiven: parseFloat(String(giveStats?.total_given ?? 0)),
      donationCount: giveStats?.donation_count ?? 0,
      recipientCount: giveStats?.recipient_count ?? 0,
    }

    res.json({
      year,
      kids,
      goals: (
        goalRows as unknown as {
          rows: Array<{
            name: string
            emoji: string | null
            target: string | number
            completed_at: string
            kid_name: string
            avatar: string
          }>
        }
      ).rows.map((r) => ({
        name: r.name,
        emoji: r.emoji,
        target: parseFloat(String(r.target)),
        completedAt: r.completed_at,
        kidName: r.kid_name,
        avatar: r.avatar,
      })),
      badges: (
        badgeRows as unknown as {
          rows: Array<{
            badge_type: string
            title: string
            emoji: string
            earned_at: string
            kid_name: string
            avatar: string
          }>
        }
      ).rows.map((r) => ({
        badgeType: r.badge_type,
        title: r.title,
        emoji: r.emoji,
        earnedAt: r.earned_at,
        kidName: r.kid_name,
        avatar: r.avatar,
      })),
      monthly,
      grandTotal,
    })
  })
)

/**
 * GET /api/family/category-stats?days=30
 * 各 active 小孩近 N 天 5 大 category approved 任務數 + 全家總計
 * 家長看小孩偏好 / 缺什麼類別任務
 */
router.get(
  "/api/family/category-stats",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10), 7), 365)
    const sinceIso = new Date(Date.now() - days * 86400000).toISOString()

    const rows = await db.execute(sql`
      SELECT
        k.id AS "kidId",
        k.display_name AS "displayName",
        k.avatar,
        k.color,
        t.category,
        COUNT(*)::int AS count,
        SUM(t.reward_amount::numeric)::numeric AS reward_sum
      FROM kids_accounts k
      LEFT JOIN kids_tasks t ON t.kid_id = k.id
        AND t.status = 'approved'
        AND t.approved_at >= ${sinceIso}::timestamp
      WHERE k.is_active = true
      GROUP BY k.id, k.display_name, k.avatar, k.color, t.category
    `)

    type Row = {
      kidId: number
      displayName: string
      avatar: string
      color: string
      category: string | null
      count: number
      reward_sum: string | number | null
    }
    const data = (rows as unknown as { rows: Row[] }).rows

    const CATEGORIES = ["housework", "study", "self_care", "kindness", "other"] as const
    const byKid = new Map<
      number,
      {
        kidId: number
        displayName: string
        avatar: string
        color: string
        categories: Record<string, { count: number; rewardSum: number }>
        total: number
      }
    >()
    data.forEach((r) => {
      if (!byKid.has(r.kidId)) {
        byKid.set(r.kidId, {
          kidId: r.kidId,
          displayName: r.displayName,
          avatar: r.avatar,
          color: r.color,
          categories: {},
          total: 0,
        })
      }
      if (r.category) {
        const k = byKid.get(r.kidId)!
        k.categories[r.category] = {
          count: r.count,
          rewardSum: parseFloat(String(r.reward_sum ?? 0)),
        }
        k.total += r.count
      }
    })

    const kids = Array.from(byKid.values()).map((k) => ({
      ...k,
      categories: CATEGORIES.reduce(
        (acc, c) => {
          acc[c] = k.categories[c] ?? { count: 0, rewardSum: 0 }
          return acc
        },
        {} as Record<string, { count: number; rewardSum: number }>
      ),
    }))

    // grand total
    const grandTotal = CATEGORIES.reduce(
      (acc, c) => {
        acc[c] = { count: 0, rewardSum: 0 }
        return acc
      },
      {} as Record<string, { count: number; rewardSum: number }>
    )
    kids.forEach((k) => {
      CATEGORIES.forEach((c) => {
        grandTotal[c].count += k.categories[c].count
        grandTotal[c].rewardSum += k.categories[c].rewardSum
      })
    })

    res.json({ days, kids, grandTotal })
  })
)

/**
 * GET /api/family/difficulty-insights
 * 看每個 active 小孩過去 90 天 hard/medium/easy 任務的 approved/rejected 比例
 * 自動建議升降難度（讓家長知道任務太簡單或太難）
 */
router.get(
  "/api/family/difficulty-insights",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        k.id AS "kidId",
        k.display_name AS "displayName",
        k.avatar,
        t.difficulty,
        COUNT(*) FILTER (WHERE t.status = 'approved')::int AS approved_count,
        COUNT(*) FILTER (WHERE t.status = 'rejected')::int AS rejected_count,
        COUNT(*)::int AS total_count
      FROM kids_accounts k
      LEFT JOIN kids_tasks t ON t.kid_id = k.id
        AND t.created_at >= (NOW() - INTERVAL '90 days')
        AND t.status IN ('approved', 'rejected')
      WHERE k.is_active = true
      GROUP BY k.id, k.display_name, k.avatar, t.difficulty
    `)

    type Row = {
      kidId: number
      displayName: string
      avatar: string
      difficulty: string | null
      approved_count: number
      rejected_count: number
      total_count: number
    }
    const data = (rows as unknown as { rows: Row[] }).rows

    const byKid = new Map<
      number,
      {
        kidId: number
        displayName: string
        avatar: string
        breakdown: Record<string, { approved: number; rejected: number; rate: number }>
      }
    >()
    data.forEach((r) => {
      if (!r.difficulty) return
      if (!byKid.has(r.kidId)) {
        byKid.set(r.kidId, {
          kidId: r.kidId,
          displayName: r.displayName,
          avatar: r.avatar,
          breakdown: {},
        })
      }
      const total = r.total_count || 1
      byKid.get(r.kidId)!.breakdown[r.difficulty] = {
        approved: r.approved_count,
        rejected: r.rejected_count,
        rate: Math.round((r.approved_count / total) * 100),
      }
    })

    const insights = Array.from(byKid.values()).map((k) => {
      const easy = k.breakdown.easy
      const medium = k.breakdown.medium
      const hard = k.breakdown.hard
      const suggestions: string[] = []

      if (easy && easy.approved + easy.rejected >= 5 && easy.rate >= 90) {
        suggestions.push("簡單任務通過率高、可挑戰更多 ⭐⭐ 普通難度")
      }
      if (medium && medium.approved + medium.rejected >= 5 && medium.rate >= 90) {
        suggestions.push("普通任務輕鬆完成、可派 ⭐⭐⭐ 挑戰任務")
      }
      if (hard && hard.approved + hard.rejected >= 3 && hard.rate < 50) {
        suggestions.push("挑戰任務通過率低、考慮先給 ⭐⭐ 普通讓他建立信心")
      }
      if (!hard && medium && medium.rate >= 80) {
        suggestions.push("可嘗試派第一個 ⭐⭐⭐ 挑戰任務")
      }

      return { ...k, suggestions }
    })

    res.json({ insights: insights.filter((i) => i.suggestions.length > 0) })
  })
)

/**
 * POST /api/family/ai-suggest-tasks
 * Body: { ageRange?: string, learningGoal: string, count?: number }
 * 用 Gemini 生成適齡家事任務 + 建議獎勵金額
 * 失敗或無 API key 回 503、UI 自行 fallback
 */
router.post(
  "/api/family/ai-suggest-tasks",
  asyncHandler(async (req, res) => {
    const ageRange = String(req.body?.ageRange ?? "6-12 歲").slice(0, 30)
    const learningGoal = String(req.body?.learningGoal ?? "").trim()
    const count = Math.min(Math.max(Number(req.body?.count ?? 5), 1), 10)
    if (!learningGoal) throw new AppError(400, "learningGoal 必填")
    if (learningGoal.length > 200) throw new AppError(400, "learningGoal 過長")

    if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
      throw new AppError(503, "AI 服務未設定、請聯絡管理員設定 GEMINI_API_KEY")
    }

    const { GoogleGenAI, Type } = await import("@google/genai")
    const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
    const customBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL
    const ai = new GoogleGenAI({
      apiKey,
      ...(customBaseUrl ? { httpOptions: { apiVersion: "", baseUrl: customBaseUrl } } : {}),
    })

    const prompt = `你是家庭教育專家、幫家長為 ${ageRange} 小孩設計家事任務。
家長學習目標：${learningGoal}

請生成 ${count} 個具體任務、每個含：
- title：簡短中文（不超過 15 字）、動詞開頭
- emoji：1 個適合的 emoji
- rewardAmount：建議獎勵新台幣（5-100、由小到大、考慮任務難度）
- difficulty：easy / medium / hard

要求：
- 任務貼近實際家事 / 自我照顧 / 學習 / 同理心
- 動詞用 6-12 歲小孩能懂的詞
- 獎勵 reasonable 不浮誇
- 不重複`

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  emoji: { type: Type.STRING },
                  rewardAmount: { type: Type.NUMBER },
                  difficulty: {
                    type: Type.STRING,
                    enum: ["easy", "medium", "hard"],
                  },
                },
                required: ["title", "emoji", "rewardAmount", "difficulty"],
              },
            },
          },
          required: ["tasks"],
        },
      },
    })

    let parsed: { tasks?: Array<unknown> }
    try {
      parsed = JSON.parse(response.text || "{}")
    } catch {
      throw new AppError(502, "AI 回應格式錯誤、請稍後再試")
    }
    if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      throw new AppError(502, "AI 未生成任務、請改用更明確的目標")
    }
    res.json({
      ageRange,
      learningGoal,
      tasks: parsed.tasks,
    })
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
 * GET /api/family/kid-level?kidId=
 * 用累積 weighted score（任務難度加權）算等級 + 頭銜
 * 培養長期動力（小孩越做越強）
 *
 * 等級表（指數成長、後期難升）：
 *   Lv1 菜鳥小幫手     0
 *   Lv2 家事新手     20
 *   Lv3 家事學徒     50
 *   Lv4 家事達人     100
 *   Lv5 家事高手     200
 *   Lv6 家事專家     400
 *   Lv7 家事大師     800
 *   Lv8 家事傳奇    1500
 *   Lv9 家事神話    3000
 *   Lv10 家事之神   5000
 */
router.get(
  "/api/family/kid-level",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT COALESCE(SUM(CASE difficulty
        WHEN 'hard' THEN 3
        WHEN 'medium' THEN 2
        ELSE 1
      END), 0)::int AS total_score
      FROM kids_tasks
      WHERE kid_id = ${kidIdQ} AND status = 'approved'
    `)
    const totalScore =
      (result as unknown as { rows: { total_score: number }[] }).rows[0]?.total_score ?? 0

    const LEVELS = [
      { level: 1, title: "菜鳥小幫手", emoji: "🌱", threshold: 0 },
      { level: 2, title: "家事新手", emoji: "🌿", threshold: 20 },
      { level: 3, title: "家事學徒", emoji: "🌳", threshold: 50 },
      { level: 4, title: "家事達人", emoji: "💪", threshold: 100 },
      { level: 5, title: "家事高手", emoji: "⭐", threshold: 200 },
      { level: 6, title: "家事專家", emoji: "🎯", threshold: 400 },
      { level: 7, title: "家事大師", emoji: "🏆", threshold: 800 },
      { level: 8, title: "家事傳奇", emoji: "👑", threshold: 1500 },
      { level: 9, title: "家事神話", emoji: "🌟", threshold: 3000 },
      { level: 10, title: "家事之神", emoji: "🐉", threshold: 5000 },
    ]

    let current = LEVELS[0]
    let next: (typeof LEVELS)[0] | null = LEVELS[1] ?? null
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (totalScore >= LEVELS[i].threshold) {
        current = LEVELS[i]
        next = LEVELS[i + 1] ?? null
        break
      }
    }
    const progress = next
      ? Math.round(((totalScore - current.threshold) / (next.threshold - current.threshold)) * 100)
      : 100
    const scoreToNext = next ? next.threshold - totalScore : 0

    res.json({
      kidId: kidIdQ,
      totalScore,
      current,
      next,
      progress: Math.min(100, Math.max(0, progress)),
      scoreToNext,
    })
  })
)

/**
 * GET /api/family/kid-strengths?kidId=
 * 小孩能力強項統計（按任務 category 分群）
 * 視覺化「天賦」：知道自己擅長什麼類別、培養自我認識
 *
 * 5 大類別：clean（清潔）/ cook（烹飪）/ study（學習）/ home（家事）/ other（其他）
 * 每類：count + percentage + level（S 30+ / A 15+ / B 5+ / C 1+ / D 0）
 * topCategory：count 最多的那類（含 emoji + 文案）
 */
router.get(
  "/api/family/kid-strengths",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT category, COUNT(*)::int AS n
      FROM kids_tasks
      WHERE kid_id = ${kidIdQ} AND status = 'approved'
      GROUP BY category
    `)
    const rows = (result as unknown as { rows: { category: string; n: number }[] }).rows

    const CATEGORY_META: Record<string, { name: string; emoji: string; praise: string }> = {
      clean: { name: "清潔", emoji: "🧹", praise: "你超會打掃！" },
      cook: { name: "烹飪", emoji: "🍳", praise: "你是小廚神！" },
      study: { name: "學習", emoji: "📚", praise: "你愛學習！" },
      home: { name: "家事", emoji: "🏠", praise: "你超顧家！" },
      other: { name: "其他", emoji: "✨", praise: "你樣樣通！" },
    }

    const total = rows.reduce((s, r) => s + r.n, 0)
    const byCategory = new Map(rows.map((r) => [r.category, r.n]))

    const categories = (["clean", "cook", "study", "home", "other"] as const).map((key) => {
      const count = byCategory.get(key) ?? 0
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0
      const level =
        count >= 30 ? "S" : count >= 15 ? "A" : count >= 5 ? "B" : count >= 1 ? "C" : "D"
      return {
        category: key,
        name: CATEGORY_META[key].name,
        emoji: CATEGORY_META[key].emoji,
        count,
        percentage,
        level,
      }
    })

    // topCategory（count 最多）
    let topCategory: (typeof categories)[0] & { praise: string } = {
      ...categories[0],
      praise: "",
    }
    let topCount = -1
    for (const c of categories) {
      if (c.count > topCount) {
        topCount = c.count
        topCategory = { ...c, praise: CATEGORY_META[c.category].praise }
      }
    }

    res.json({
      kidId: kidIdQ,
      totalTasks: total,
      categories,
      topCategory: total > 0 ? topCategory : null,
    })
  })
)

/**
 * GET /api/family/lifetime-stats
 * 家庭累計總成就（家庭一路走來）
 */
router.get(
  "/api/family/lifetime-stats",
  asyncHandler(async (_req, res) => {
    const result = await db.execute(sql`
      SELECT
        COALESCE((SELECT COUNT(*)::int FROM kids_tasks WHERE status = 'approved'), 0) AS tasks_approved,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks WHERE status = 'approved'
        ), 0) AS total_reward,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings WHERE jar = 'spend'
        ), 0) AS total_spent,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings WHERE jar = 'give'
        ), 0) AS total_given,
        COALESCE((
          SELECT SUM(save_balance::numeric)::numeric FROM kids_jars
        ), 0) AS total_saved,
        COALESCE((
          SELECT COUNT(DISTINCT checkin_date)::int FROM kids_checkins
        ), 0) AS checkin_days,
        COALESCE((
          SELECT COUNT(DISTINCT category)::int FROM kids_tasks WHERE status = 'approved'
        ), 0) AS unique_categories,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_wishes WHERE status = 'promoted'
        ), 0) AS wishes_promoted,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_goals WHERE status = 'completed'
        ), 0) AS goals_completed,
        (SELECT MIN(completed_at) FROM kids_tasks WHERE status = 'approved') AS first_task_at,
        (SELECT MAX(completed_at) FROM kids_tasks WHERE status = 'approved') AS last_task_at
    `)
    const row = (
      result as unknown as {
        rows: {
          tasks_approved: number
          total_reward: string | number
          total_spent: string | number
          total_given: string | number
          total_saved: string | number
          checkin_days: number
          unique_categories: number
          wishes_promoted: number
          goals_completed: number
          first_task_at: Date | null
          last_task_at: Date | null
        }[]
      }
    ).rows[0]!

    const stats = {
      tasksApproved: row.tasks_approved,
      totalReward: Number(row.total_reward ?? 0),
      totalSpent: Number(row.total_spent ?? 0),
      totalGiven: Number(row.total_given ?? 0),
      totalSaved: Number(row.total_saved ?? 0),
      checkinDays: row.checkin_days,
      uniqueCategories: row.unique_categories,
      wishesPromoted: row.wishes_promoted,
      goalsCompleted: row.goals_completed,
    }

    let familyDays: number | null = null
    if (row.first_task_at) {
      const start = new Date(row.first_task_at)
      const now = new Date()
      familyDays = Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1
    }

    let level: "newborn" | "growing" | "established" | "legendary"
    let message: string
    if (stats.tasksApproved === 0) {
      level = "newborn"
      message = "🌱 家庭剛起步、來建立第一個任務吧"
    } else if (stats.tasksApproved < 50) {
      level = "growing"
      message = `🌟 家庭累積 ${stats.tasksApproved} 個任務、好的開始！`
    } else if (stats.tasksApproved < 500) {
      level = "established"
      message = `🏆 家庭已完成 ${stats.tasksApproved} 個任務、超棒紀錄！`
    } else {
      level = "legendary"
      message = `🐉 家庭已完成 ${stats.tasksApproved}+ 任務、傳奇等級！`
    }

    res.json({
      stats,
      familyDays,
      firstTaskAt: row.first_task_at,
      lastTaskAt: row.last_task_at,
      level,
      message,
    })
  })
)

/**
 * GET /api/family/peak-week?weeks=12
 * 家庭高潮週：找近 N 週活動最多那週 + 明細
 *
 * 對每週統計：tasks + spendings + checkins
 * 回 weeks[] + bestWeek（最高 total）+ bestWeekKids（該週各 kid 數據）
 */
router.get(
  "/api/family/peak-week",
  asyncHandler(async (req, res) => {
    const weeks = Math.min(Math.max(Number(req.query.weeks) || 12, 1), 52)

    const result = await db.execute(sql`
      WITH week_series AS (
        SELECT generate_series(
          DATE_TRUNC('week', CURRENT_DATE - (${weeks - 1}::int || ' weeks')::interval),
          DATE_TRUNC('week', CURRENT_DATE),
          INTERVAL '1 week'
        )::date AS w
      )
      SELECT
        ws.w AS week_start,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE status = 'approved'
            AND DATE_TRUNC('week', completed_at)::date = ws.w
        ), 0) AS tasks,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_spendings
          WHERE DATE_TRUNC('week', spend_date)::date = ws.w
        ), 0) AS spendings,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_checkins
          WHERE DATE_TRUNC('week', checkin_date)::date = ws.w
        ), 0) AS checkins
      FROM week_series ws
      ORDER BY ws.w ASC
    `)
    const rows = (
      result as unknown as {
        rows: { week_start: Date | string; tasks: number; spendings: number; checkins: number }[]
      }
    ).rows

    const weekList = rows.map((r) => {
      const dateStr =
        typeof r.week_start === "string"
          ? r.week_start.slice(0, 10)
          : new Date(r.week_start).toISOString().slice(0, 10)
      return {
        weekStart: dateStr,
        tasks: r.tasks,
        spendings: r.spendings,
        checkins: r.checkins,
        total: r.tasks + r.spendings + r.checkins,
      }
    })

    let bestWeek: (typeof weekList)[0] | null = null
    for (const w of weekList) {
      if (!bestWeek || w.total > bestWeek.total) bestWeek = w
    }
    if (bestWeek && bestWeek.total === 0) bestWeek = null

    // bestWeekKids：該週各 kid 的 task count
    let bestWeekKids: Array<{ kidId: number; kidName: string; avatar: string; tasks: number }> = []
    if (bestWeek) {
      const kidResult = await db.execute(sql`
        SELECT
          ka.id::int AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar,
          COUNT(*)::int AS tasks
        FROM kids_tasks kt
        JOIN kids_accounts ka ON ka.id = kt.kid_id
        WHERE kt.status = 'approved'
          AND DATE_TRUNC('week', kt.completed_at)::date = ${bestWeek.weekStart}::date
        GROUP BY ka.id, ka.display_name, ka.avatar
        ORDER BY tasks DESC
      `)
      bestWeekKids = (
        kidResult as unknown as {
          rows: { kid_id: number; kid_name: string; avatar: string; tasks: number }[]
        }
      ).rows.map((r) => ({
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        tasks: r.tasks,
      }))
    }

    const totalActivity = weekList.reduce((s, w) => s + w.total, 0)
    const avgPerWeek = weekList.length > 0 ? Math.round(totalActivity / weekList.length) : 0

    res.json({
      weeks,
      totalActivity,
      avgPerWeek,
      bestWeek,
      bestWeekKids,
      weekList,
    })
  })
)

/**
 * GET /api/family/multi-rank?days=30
 * 家庭多維排行榜：5 維度各別 top 3
 *   - tasks（任務完成數）
 *   - earned（總獎勵）
 *   - saved（save 罐當前餘額）
 *   - given（總捐贈）
 *   - checkin（打卡天數）
 */
router.get(
  "/api/family/multi-rank",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)

    const result = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= NOW() - (${days}::int || ' days')::interval
        ), 0) AS tasks,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= NOW() - (${days}::int || ' days')::interval
        ), 0) AS earned,
        COALESCE((
          SELECT save_balance::numeric FROM kids_jars WHERE kid_id = ka.id
        ), 0) AS saved,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ka.id AND jar = 'give'
            AND spend_date >= CURRENT_DATE - (${days}::int || ' days')::interval
        ), 0) AS given,
        COALESCE((
          SELECT COUNT(DISTINCT checkin_date)::int FROM kids_checkins
          WHERE kid_id = ka.id
            AND checkin_date >= CURRENT_DATE - (${days}::int || ' days')::interval
        ), 0) AS checkin
      FROM kids_accounts ka
      WHERE ka.is_active = true
    `)
    const rows = (
      result as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          tasks: number
          earned: string | number
          saved: string | number
          given: string | number
          checkin: number
        }[]
      }
    ).rows

    type Kid = {
      kidId: number
      kidName: string
      avatar: string
      tasks: number
      earned: number
      saved: number
      given: number
      checkin: number
    }
    const kids: Kid[] = rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      tasks: r.tasks ?? 0,
      earned: Number(r.earned ?? 0),
      saved: Number(r.saved ?? 0),
      given: Number(r.given ?? 0),
      checkin: r.checkin ?? 0,
    }))

    function makeRank(metric: keyof Omit<Kid, "kidId" | "kidName" | "avatar">) {
      return [...kids]
        .sort((a, b) => b[metric] - a[metric])
        .filter((k) => k[metric] > 0)
        .slice(0, 3)
        .map((k) => ({
          kidId: k.kidId,
          kidName: k.kidName,
          avatar: k.avatar,
          value: k[metric],
        }))
    }

    res.json({
      days,
      ranks: [
        { metric: "tasks", name: "任務數", emoji: "📋", top: makeRank("tasks") },
        { metric: "earned", name: "賺最多", emoji: "💰", top: makeRank("earned") },
        { metric: "saved", name: "存最多", emoji: "🐷", top: makeRank("saved") },
        { metric: "given", name: "最大愛心", emoji: "❤️", top: makeRank("given") },
        { metric: "checkin", name: "最規律", emoji: "📅", top: makeRank("checkin") },
      ],
    })
  })
)

/**
 * GET /api/family/calendar-month?month=YYYY-MM
 * 家庭日曆熱度（每月每天活動數）
 *
 * 對指定月份每天統計：tasks + spendings + checkins
 * 預設當月、範圍 2000-2100
 */
router.get(
  "/api/family/calendar-month",
  asyncHandler(async (req, res) => {
    const monthQ = String(req.query.month ?? "").trim()
    const monthRegex = /^\d{4}-\d{2}$/
    const month = monthRegex.test(monthQ) ? monthQ : new Date().toISOString().slice(0, 7)

    const [y, m] = month.split("-").map(Number)
    if (y < 2000 || y > 2100) throw new AppError(400, "month 超出範圍")

    const result = await db.execute(sql`
      WITH date_series AS (
        SELECT generate_series(
          MAKE_DATE(${y}, ${m}, 1),
          (MAKE_DATE(${y}, ${m}, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date,
          INTERVAL '1 day'
        )::date AS d
      )
      SELECT
        ds.d AS date,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE status = 'approved' AND DATE(completed_at) = ds.d
        ), 0) AS tasks,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_spendings
          WHERE spend_date = ds.d
        ), 0) AS spendings,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_checkins
          WHERE checkin_date = ds.d
        ), 0) AS checkins
      FROM date_series ds
      ORDER BY ds.d ASC
    `)
    const rows = (
      result as unknown as {
        rows: { date: Date | string; tasks: number; spendings: number; checkins: number }[]
      }
    ).rows

    const days = rows.map((r) => {
      const dateStr =
        typeof r.date === "string"
          ? r.date.slice(0, 10)
          : new Date(r.date).toISOString().slice(0, 10)
      return {
        date: dateStr,
        tasks: r.tasks,
        spendings: r.spendings,
        checkins: r.checkins,
        total: r.tasks + r.spendings + r.checkins,
      }
    })

    const peak = days.reduce((m, d) => Math.max(m, d.total), 0)
    const activeDays = days.filter((d) => d.total > 0).length
    const totalActivity = days.reduce((s, d) => s + d.total, 0)

    res.json({
      month,
      peak,
      activeDays,
      totalActivity,
      days,
    })
  })
)

/**
 * GET /api/family/emoji-cloud?limit=20
 * 全家 task emoji 雲（家長端、整體家庭視角）
 */
router.get(
  "/api/family/emoji-cloud",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)

    const result = await db.execute(sql`
      SELECT
        emoji,
        COUNT(*)::int AS count,
        COUNT(DISTINCT kid_id)::int AS unique_kids
      FROM kids_tasks
      WHERE status = 'approved' AND emoji IS NOT NULL AND emoji != ''
      GROUP BY emoji
      ORDER BY count DESC
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: { emoji: string; count: number; unique_kids: number }[]
      }
    ).rows

    const total = rows.reduce((s, r) => s + r.count, 0)
    const peak = rows[0]?.count ?? 0

    const emojis = rows.map((r) => {
      const ratio = peak > 0 ? r.count / peak : 0
      return {
        emoji: r.emoji,
        count: r.count,
        uniqueKids: r.unique_kids,
        sizeRem: Math.round((0.7 + ratio * 2.0) * 100) / 100,
        percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
      }
    })

    res.json({
      total,
      uniqueEmojis: rows.length,
      mostUsed: emojis[0] ?? null,
      emojis,
    })
  })
)

/**
 * GET /api/family/kid-strengths-list?kidId=
 * 小孩優點清單：從數據偵測個人化優點
 */
router.get(
  "/api/family/kid-strengths-list",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT
        COALESCE((SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'), 0) AS total_tasks,
        COALESCE((SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved' AND difficulty = 'hard'), 0) AS hard_tasks,
        COALESCE((SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ${kidIdQ} AND jar = 'give'), 0) AS total_given,
        COALESCE((SELECT COUNT(*)::int FROM kids_goals
          WHERE kid_id = ${kidIdQ} AND status = 'completed'), 0) AS goals_completed,
        COALESCE((SELECT COUNT(DISTINCT checkin_date)::int FROM kids_checkins
          WHERE kid_id = ${kidIdQ}), 0) AS checkin_days,
        COALESCE((SELECT save_balance::numeric FROM kids_jars WHERE kid_id = ${kidIdQ}), 0) AS save_balance,
        COALESCE((SELECT COUNT(DISTINCT category)::int FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'), 0) AS unique_categories,
        COALESCE((SELECT COUNT(*)::int FROM kids_wishes
          WHERE kid_id = ${kidIdQ} AND status = 'promoted'), 0) AS promoted_wishes
    `)
    const row = (
      result as unknown as {
        rows: {
          total_tasks: number
          hard_tasks: number
          total_given: string | number
          goals_completed: number
          checkin_days: number
          save_balance: string | number
          unique_categories: number
          promoted_wishes: number
        }[]
      }
    ).rows[0]!

    const stats = {
      totalTasks: row.total_tasks,
      hardTasks: row.hard_tasks,
      totalGiven: Number(row.total_given ?? 0),
      goalsCompleted: row.goals_completed,
      checkinDays: row.checkin_days,
      saveBalance: Number(row.save_balance ?? 0),
      uniqueCategories: row.unique_categories,
      promotedWishes: row.promoted_wishes,
    }

    const strengths: Array<{ key: string; emoji: string; title: string; detail: string }> = []

    if (stats.totalTasks >= 50)
      strengths.push({
        key: "diligent",
        emoji: "💪",
        title: "勤勞之星",
        detail: `已完成 ${stats.totalTasks} 個任務、超有耐心`,
      })
    else if (stats.totalTasks >= 20)
      strengths.push({
        key: "active",
        emoji: "🌟",
        title: "積極小幫手",
        detail: `已完成 ${stats.totalTasks} 個任務`,
      })

    if (stats.hardTasks >= 10)
      strengths.push({
        key: "brave",
        emoji: "🦁",
        title: "勇於挑戰",
        detail: `完成 ${stats.hardTasks} 個困難任務`,
      })
    else if (stats.hardTasks >= 3)
      strengths.push({
        key: "growing",
        emoji: "🌱",
        title: "願意嘗試",
        detail: `做過 ${stats.hardTasks} 個困難任務`,
      })

    if (stats.totalGiven >= 500)
      strengths.push({
        key: "generous",
        emoji: "❤️",
        title: "充滿愛心",
        detail: `累積捐贈 $${stats.totalGiven}`,
      })
    else if (stats.totalGiven >= 100)
      strengths.push({
        key: "kind",
        emoji: "🤗",
        title: "懂得分享",
        detail: `已捐贈 $${stats.totalGiven}`,
      })

    if (stats.goalsCompleted >= 5)
      strengths.push({
        key: "achiever",
        emoji: "🏆",
        title: "達成目標王",
        detail: `已達成 ${stats.goalsCompleted} 個目標`,
      })
    else if (stats.goalsCompleted >= 1)
      strengths.push({
        key: "saver",
        emoji: "🐷",
        title: "存錢有方",
        detail: `達成 ${stats.goalsCompleted} 個目標`,
      })

    if (stats.checkinDays >= 30)
      strengths.push({
        key: "consistent",
        emoji: "📅",
        title: "規律小達人",
        detail: `打卡 ${stats.checkinDays} 天`,
      })
    else if (stats.checkinDays >= 7)
      strengths.push({
        key: "routine",
        emoji: "✨",
        title: "養成習慣",
        detail: `打卡 ${stats.checkinDays} 天`,
      })

    if (stats.saveBalance >= 1000)
      strengths.push({
        key: "wealthy",
        emoji: "💎",
        title: "小富翁",
        detail: `存款 $${stats.saveBalance}`,
      })

    if (stats.uniqueCategories >= 4)
      strengths.push({
        key: "versatile",
        emoji: "🎨",
        title: "多才多藝",
        detail: `做過 ${stats.uniqueCategories} 種類別`,
      })

    if (stats.promotedWishes >= 1)
      strengths.push({
        key: "decisive",
        emoji: "🎯",
        title: "懂得決策",
        detail: `${stats.promotedWishes} 個願望升級成目標`,
      })

    if (strengths.length === 0) {
      strengths.push({
        key: "newcomer",
        emoji: "🥚",
        title: "剛起步",
        detail: "完成第一個任務、就會解鎖優點！",
      })
    }

    res.json({
      kidId: kidIdQ,
      stats,
      strengthCount: strengths.length,
      strengths,
    })
  })
)

/**
 * GET /api/family/health-dashboard
 * 家庭整體健康儀表板（3 維度合成總分）
 *
 * 3 維度（each 0-100）：
 *   - mood: 近 7 天平均 mood score × 20（5×20=100）
 *   - activity: 近 7 天 approved tasks 數 / (kids × 7 × 0.5) × 100（每 kid 平均一週 3.5 個 = 100）
 *   - fairness: 100 - (max - min taskPercentage)（越接近平均越高）
 *
 * 總分 = 三項平均
 */
router.get(
  "/api/family/health-dashboard",
  asyncHandler(async (_req, res) => {
    const [moodRows, taskRows, kidsCount] = await Promise.all([
      db.execute(sql`
        SELECT AVG(
          CASE mood
            WHEN '😄 開心' THEN 5
            WHEN '🙂 還好' THEN 4
            WHEN '😐 普通' THEN 3
            WHEN '😢 難過' THEN 2
            WHEN '😡 生氣' THEN 1
            ELSE 3
          END
        )::numeric AS avg_score
        FROM kids_checkins
        WHERE checkin_date >= CURRENT_DATE - INTERVAL '7 days'
      `),
      db.execute(sql`
        SELECT
          kid_id::int,
          COUNT(*)::int AS tasks
        FROM kids_tasks
        WHERE status = 'approved'
          AND completed_at >= NOW() - INTERVAL '7 days'
        GROUP BY kid_id
      `),
      db.execute(sql`SELECT COUNT(*)::int AS n FROM kids_accounts WHERE is_active = true`),
    ])

    const avgMoodScore = Number(
      (moodRows as unknown as { rows: { avg_score: string | number | null }[] }).rows[0]
        ?.avg_score ?? 0
    )
    const taskByKid = (taskRows as unknown as { rows: { kid_id: number; tasks: number }[] }).rows
    const totalKids = (kidsCount as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0

    const totalTasks = taskByKid.reduce((s, r) => s + r.tasks, 0)

    // mood score 0-100
    const moodScore = avgMoodScore > 0 ? Math.min(100, Math.round(avgMoodScore * 20)) : 0

    // activity score：每 kid 平均一週 3.5 個 task = 滿分
    const expectedWeeklyTasks = totalKids * 3.5
    const activityScore =
      expectedWeeklyTasks > 0
        ? Math.min(100, Math.round((totalTasks / expectedWeeklyTasks) * 100))
        : 0

    // fairness：max - min percentage（差異越小越公平）
    let fairnessScore = 100
    if (totalKids >= 2 && totalTasks > 0) {
      const percentages = taskByKid.map((r) => (r.tasks / totalTasks) * 100)
      const padded = [...percentages]
      // 補上 0 task 的 kid
      while (padded.length < totalKids) padded.push(0)
      const maxP = Math.max(...padded)
      const minP = Math.min(...padded)
      fairnessScore = Math.max(0, Math.round(100 - (maxP - minP)))
    } else if (totalKids < 2) {
      fairnessScore = 100 // 一個小孩、不能評估
    }

    const overallScore = Math.round((moodScore + activityScore + fairnessScore) / 3)

    let healthLevel: "excellent" | "good" | "moderate" | "needs_attention"
    let message: string
    if (overallScore >= 80) {
      healthLevel = "excellent"
      message = "🌟 全家狀況非常好！"
    } else if (overallScore >= 60) {
      healthLevel = "good"
      message = "👍 家庭狀況不錯、有些可以加強"
    } else if (overallScore >= 40) {
      healthLevel = "moderate"
      message = "💪 一般水準、考慮多互動"
    } else {
      healthLevel = "needs_attention"
      message = "⚠️ 需要多關心、看看哪裡可改善"
    }

    res.json({
      overallScore,
      healthLevel,
      message,
      dimensions: [
        {
          key: "mood",
          name: "心情",
          score: moodScore,
          detail: `平均 ${avgMoodScore.toFixed(1)}/5`,
        },
        {
          key: "activity",
          name: "活躍度",
          score: activityScore,
          detail: `近 7 天 ${totalTasks} 個任務`,
        },
        {
          key: "fairness",
          name: "公平度",
          score: fairnessScore,
          detail: totalKids < 2 ? "至少需要 2 個小孩" : "任務分配差異",
        },
      ],
    })
  })
)

/**
 * GET /api/family/kid-mood-trend?kidId=&days=30
 * 小孩心情走勢：近 N 天 mood 分析
 */
router.get(
  "/api/family/kid-mood-trend",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90)

    const result = await db.execute(sql`
      SELECT checkin_date, mood, note
      FROM kids_checkins
      WHERE kid_id = ${kidIdQ}
        AND checkin_date >= CURRENT_DATE - (${days}::int || ' days')::interval
      ORDER BY checkin_date DESC
    `)
    const rows = (
      result as unknown as {
        rows: { checkin_date: Date | string; mood: string; note: string | null }[]
      }
    ).rows

    const MOOD_SCORE: Record<string, number> = {
      "😄 開心": 5,
      "🙂 還好": 4,
      "😐 普通": 3,
      "😢 難過": 2,
      "😡 生氣": 1,
    }

    const checkins = rows.map((r) => ({
      date:
        typeof r.checkin_date === "string"
          ? r.checkin_date.slice(0, 10)
          : new Date(r.checkin_date).toISOString().slice(0, 10),
      mood: r.mood,
      note: r.note,
      score: MOOD_SCORE[r.mood] ?? 3,
    }))

    const totalDays = checkins.length
    const avgScore =
      totalDays > 0
        ? Math.round((checkins.reduce((s, c) => s + c.score, 0) / totalDays) * 100) / 100
        : 0

    const happyDays = checkins.filter((c) => c.score >= 4).length
    const sadDays = checkins.filter((c) => c.score <= 2).length

    let bestDay: (typeof checkins)[0] | null = null
    let worstDay: (typeof checkins)[0] | null = null
    for (const c of checkins) {
      if (!bestDay || c.score > bestDay.score) bestDay = c
      if (!worstDay || c.score < worstDay.score) worstDay = c
    }
    if (bestDay && worstDay && bestDay === worstDay && totalDays === 1) worstDay = null

    let trend: string
    if (totalDays === 0) trend = "🌫️ 還沒打卡過"
    else if (avgScore >= 4.5) trend = "🌞 整體超開心"
    else if (avgScore >= 3.5) trend = "😊 大部分時間不錯"
    else if (avgScore >= 2.5) trend = "🌤️ 起伏正常"
    else trend = "🌧️ 心情比較低、需要關心"

    res.json({
      kidId: kidIdQ,
      days,
      totalDays,
      avgScore,
      happyDays,
      sadDays,
      bestDay,
      worstDay,
      trend,
      checkins,
    })
  })
)

/**
 * GET /api/family/kid-wishlist-summary?kidId=
 * 小孩願望清單分析（多久能買 / 可買幾個）
 */
router.get(
  "/api/family/kid-wishlist-summary",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const [wishes, jars, recentReward] = await Promise.all([
      db.execute(sql`
        SELECT
          id::int AS id,
          title,
          emoji,
          estimated_price::numeric AS price,
          priority,
          status,
          created_at
        FROM kids_wishes
        WHERE kid_id = ${kidIdQ}
          AND status = 'wished'
          AND estimated_price IS NOT NULL
        ORDER BY priority DESC, estimated_price ASC
      `),
      db.execute(sql`
        SELECT
          COALESCE(spend_balance::numeric, 0) + COALESCE(save_balance::numeric, 0) AS available
        FROM kids_jars WHERE kid_id = ${kidIdQ}
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric AS s
        FROM kids_tasks
        WHERE kid_id = ${kidIdQ} AND status = 'approved'
          AND completed_at >= NOW() - INTERVAL '30 days'
      `),
    ])

    const wishList = (
      wishes as unknown as {
        rows: {
          id: number
          title: string
          emoji: string | null
          price: string | number
          priority: number
          status: string
          created_at: Date
        }[]
      }
    ).rows.map((r) => ({
      id: r.id,
      title: r.title,
      emoji: r.emoji ?? "✨",
      price: Number(r.price ?? 0),
      priority: r.priority,
    }))

    const available = Number(
      String(
        (jars as unknown as { rows: { available: string | number }[] }).rows[0]?.available ?? 0
      )
    )
    const monthlyReward = Number(
      String((recentReward as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
    )
    const dailyEarning = monthlyReward / 30

    const totalEstimated = wishList.reduce((s, w) => s + w.price, 0)

    const enriched = wishList.map((w) => {
      let status: "affordable" | "soon" | "saving"
      let etaDays: number | null
      if (w.price <= available) {
        status = "affordable"
        etaDays = 0
      } else {
        const remaining = w.price - available
        if (dailyEarning <= 0) {
          status = "saving"
          etaDays = null
        } else {
          etaDays = Math.ceil(remaining / dailyEarning)
          status = etaDays <= 30 ? "soon" : "saving"
        }
      }
      return { ...w, status, etaDays }
    })

    const affordableCount = enriched.filter((w) => w.status === "affordable").length

    res.json({
      kidId: kidIdQ,
      totalWishes: wishList.length,
      totalEstimated,
      available,
      dailyEarning: Math.round(dailyEarning * 100) / 100,
      affordableCount,
      wishes: enriched,
    })
  })
)

/**
 * GET /api/family/kids-attention
 * 家長關心雷達：找出最近無 task / 無 checkin 的 kid
 */
router.get(
  "/api/family/kids-attention",
  asyncHandler(async (_req, res) => {
    const result = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        (
          SELECT MAX(DATE(completed_at)) FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
        ) AS last_task_date,
        (
          SELECT MAX(checkin_date) FROM kids_checkins
          WHERE kid_id = ka.id
        ) AS last_checkin_date
      FROM kids_accounts ka
      WHERE ka.is_active = true
      ORDER BY ka.id ASC
    `)
    const rows = (
      result as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          last_task_date: Date | null
          last_checkin_date: Date | null
        }[]
      }
    ).rows

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    function daysSince(d: Date | null | string): number {
      if (!d) return 9999
      const date = typeof d === "string" ? new Date(d) : new Date(d)
      date.setHours(0, 0, 0, 0)
      return Math.floor((today.getTime() - date.getTime()) / 86_400_000)
    }

    const kids = rows.map((r) => {
      const daysSinceTask = daysSince(r.last_task_date)
      const daysSinceCheckin = daysSince(r.last_checkin_date)
      const daysQuiet = Math.min(daysSinceTask, daysSinceCheckin)
      const needsAttention = daysQuiet >= 7

      let message: string | null = null
      if (daysQuiet === 9999) message = `${r.kid_name} 完全沒活動過、想想要不要派任務？`
      else if (daysQuiet >= 14) message = `${r.kid_name} 已經 ${daysQuiet} 天沒活動了、該關心！`
      else if (daysQuiet >= 7) message = `${r.kid_name} 已經 ${daysQuiet} 天沒活動、聊聊吧`

      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        lastTaskDate: r.last_task_date,
        lastCheckinDate: r.last_checkin_date,
        daysSinceTask: daysSinceTask === 9999 ? null : daysSinceTask,
        daysSinceCheckin: daysSinceCheckin === 9999 ? null : daysSinceCheckin,
        daysQuiet: daysQuiet === 9999 ? null : daysQuiet,
        needsAttention,
        message,
      }
    })

    const attentionCount = kids.filter((k) => k.needsAttention).length

    res.json({
      totalKids: kids.length,
      attentionCount,
      kids,
    })
  })
)

/**
 * GET /api/family/kid-net-worth?kidId=
 * 小孩總財產：3 罐 balance + 各目標 + lifetime 收入
 */
router.get(
  "/api/family/kid-net-worth",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT
        COALESCE((SELECT spend_balance::numeric FROM kids_jars WHERE kid_id = ${kidIdQ}), 0) AS spend,
        COALESCE((SELECT save_balance::numeric FROM kids_jars WHERE kid_id = ${kidIdQ}), 0) AS save,
        COALESCE((SELECT give_balance::numeric FROM kids_jars WHERE kid_id = ${kidIdQ}), 0) AS give,
        COALESCE((
          SELECT SUM(current_amount::numeric)::numeric FROM kids_goals
          WHERE kid_id = ${kidIdQ} AND status = 'active'
        ), 0) AS goals_saved,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
        ), 0) AS lifetime_earned
    `)
    const row = (
      result as unknown as {
        rows: {
          spend: string | number
          save: string | number
          give: string | number
          goals_saved: string | number
          lifetime_earned: string | number
        }[]
      }
    ).rows[0]!

    const jars = {
      spend: Number(row.spend ?? 0),
      save: Number(row.save ?? 0),
      give: Number(row.give ?? 0),
    }
    const goalsSaved = Number(row.goals_saved ?? 0)
    const lifetimeEarned = Number(row.lifetime_earned ?? 0)
    const totalNetWorth = jars.spend + jars.save + jars.give + goalsSaved

    let levelLabel: string
    if (totalNetWorth >= 5000) levelLabel = "👑 小富翁"
    else if (totalNetWorth >= 1000) levelLabel = "💎 小財主"
    else if (totalNetWorth >= 500) levelLabel = "🌟 存錢小達人"
    else if (totalNetWorth >= 100) levelLabel = "🌱 開始累積"
    else levelLabel = "🥚 剛起步"

    res.json({
      kidId: kidIdQ,
      jars,
      goalsSaved,
      totalNetWorth,
      lifetimeEarned,
      levelLabel,
    })
  })
)

/**
 * GET /api/family/fairness?days=30
 * 家事公平度分析：看任務分配是否公平
 * 算每個 active kid 近 N 天 approved 任務佔比
 * 若一人 > 60% → 警示
 */
router.get(
  "/api/family/fairness",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)

    const result = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= NOW() - (${days}::int || ' days')::interval
        ), 0) AS tasks,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= NOW() - (${days}::int || ' days')::interval
        ), 0) AS reward
      FROM kids_accounts ka
      WHERE ka.is_active = true
      ORDER BY tasks DESC
    `)
    const rows = (
      result as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          tasks: number
          reward: string | number
        }[]
      }
    ).rows

    const totalTasks = rows.reduce((s, r) => s + r.tasks, 0)
    const totalReward = rows.reduce((s, r) => s + Number(r.reward ?? 0), 0)

    const kids = rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      tasks: r.tasks,
      reward: Number(r.reward ?? 0),
      taskPercentage: totalTasks > 0 ? Math.round((r.tasks / totalTasks) * 100) : 0,
      rewardPercentage:
        totalReward > 0 ? Math.round((Number(r.reward ?? 0) / totalReward) * 100) : 0,
    }))

    // 公平度評分：standard deviation 越小越公平
    // 但更直觀：看最大佔比 - 理論平均
    const expectedPerKid = kids.length > 0 ? Math.round(100 / kids.length) : 0
    const maxKid = kids[0] ?? null
    const minKid = kids.length > 0 ? kids[kids.length - 1] : null

    let fairnessLevel: "fair" | "ok" | "unbalanced" | "biased" | "n/a"
    let message: string
    if (totalTasks === 0 || kids.length < 2) {
      fairnessLevel = "n/a"
      message = kids.length < 2 ? "至少 2 個小孩才能比較" : "近期沒有任務、做幾個再看"
    } else if (maxKid && maxKid.taskPercentage <= expectedPerKid + 10) {
      fairnessLevel = "fair"
      message = `🌈 任務分配很公平、每個小孩約 ${expectedPerKid}%`
    } else if (maxKid && maxKid.taskPercentage <= expectedPerKid + 25) {
      fairnessLevel = "ok"
      message = `👍 大致平均、${maxKid.kidName} 略多一些`
    } else if (maxKid && maxKid.taskPercentage <= expectedPerKid + 40) {
      fairnessLevel = "unbalanced"
      message = `⚖️ ${maxKid.kidName} 做太多了（${maxKid.taskPercentage}%）、可以分一些給其他人`
    } else {
      fairnessLevel = "biased"
      message = `❗ ${maxKid?.kidName} 做了 ${maxKid?.taskPercentage}%！分配不平均`
    }

    res.json({
      days,
      totalTasks,
      totalReward,
      expectedPerKid,
      fairnessLevel,
      message,
      maxKid,
      minKid,
      kids,
    })
  })
)

/**
 * GET /api/family/goal-achievers
 * 小孩達成目標排行（看誰最會存錢、家長端）
 */
router.get(
  "/api/family/goal-achievers",
  asyncHandler(async (_req, res) => {
    const result = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COALESCE(COUNT(kg.id)::int, 0) AS goals_completed,
        COALESCE(SUM(kg.target_amount::numeric)::numeric, 0) AS total_target,
        COALESCE(
          AVG(DATE(kg.completed_at) - DATE(kg.created_at))::int,
          0
        ) AS avg_days
      FROM kids_accounts ka
      LEFT JOIN kids_goals kg ON kg.kid_id = ka.id AND kg.status = 'completed'
      WHERE ka.is_active = true
      GROUP BY ka.id, ka.display_name, ka.avatar
      ORDER BY goals_completed DESC, total_target DESC
    `)
    const rows = (
      result as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          goals_completed: number
          total_target: string | number
          avg_days: number
        }[]
      }
    ).rows

    const achievers = rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      goalsCompleted: r.goals_completed,
      totalTarget: Number(r.total_target ?? 0),
      avgDays: r.avg_days ?? 0,
    }))

    const totalGoals = achievers.reduce((s, a) => s + a.goalsCompleted, 0)
    const champion = achievers.find((a) => a.goalsCompleted > 0) ?? null

    res.json({
      totalGoals,
      champion,
      achievers,
    })
  })
)

/**
 * GET /api/family/completed-goals-history?limit=20
 * 家庭目標達成歷史（家長端、看過去達成的目標）
 *
 * 從 kids_goals WHERE status='completed' 取近期達成
 * 算每個 goal：建立到完成的天數
 * 統計：平均達成天數、最快達成、總達成數
 */
router.get(
  "/api/family/completed-goals-history",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)

    const result = await db.execute(sql`
      SELECT
        kg.id::int AS id,
        kg.name,
        kg.emoji,
        kg.target_amount::numeric AS target,
        kg.current_amount::numeric AS current,
        kg.created_at,
        kg.completed_at,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        (DATE(kg.completed_at) - DATE(kg.created_at))::int AS days_taken,
        kg.reflection
      FROM kids_goals kg
      JOIN kids_accounts ka ON ka.id = kg.kid_id
      WHERE kg.status = 'completed'
      ORDER BY kg.completed_at DESC NULLS LAST
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          id: number
          name: string
          emoji: string | null
          target: string | number
          current: string | number
          created_at: Date
          completed_at: Date | null
          kid_id: number
          kid_name: string
          avatar: string
          days_taken: number | null
          reflection: string | null
        }[]
      }
    ).rows

    const goals = rows.map((r) => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji ?? "🎯",
      targetAmount: Number(r.target ?? 0),
      currentAmount: Number(r.current ?? 0),
      createdAt: r.created_at,
      completedAt: r.completed_at,
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      daysTaken: r.days_taken ?? 0,
      reflection: r.reflection,
    }))

    const total = goals.length
    const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
    const avgDaysTaken =
      total > 0 ? Math.round(goals.reduce((s, g) => s + g.daysTaken, 0) / total) : 0
    let fastestGoal: (typeof goals)[0] | null = null
    let largestGoal: (typeof goals)[0] | null = null
    for (const g of goals) {
      if (!fastestGoal || g.daysTaken < fastestGoal.daysTaken) fastestGoal = g
      if (!largestGoal || g.targetAmount > largestGoal.targetAmount) largestGoal = g
    }

    res.json({
      total,
      totalTarget,
      avgDaysTaken,
      fastestGoal,
      largestGoal,
      goals,
    })
  })
)

/**
 * GET /api/family/pot-top-contributors?potId=&limit=10
 * 家庭 pot 貢獻者排行（看誰捐最多）
 * 不指定 potId 則跨所有 active pots 統計
 */
router.get(
  "/api/family/pot-top-contributors",
  asyncHandler(async (req, res) => {
    const potIdQ = req.query.potId ? Number(req.query.potId) : null
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30)
    if (potIdQ !== null && (!Number.isInteger(potIdQ) || potIdQ < 1)) {
      throw new AppError(400, "potId 無效")
    }

    const result = potIdQ
      ? await db.execute(sql`
          SELECT
            fpc.kid_id::int AS kid_id,
            ka.display_name AS kid_name,
            ka.avatar,
            SUM(fpc.amount::numeric)::numeric AS total_amount,
            COUNT(*)::int AS contribution_count,
            MAX(fpc.created_at) AS last_at
          FROM family_pot_contributions fpc
          JOIN kids_accounts ka ON ka.id = fpc.kid_id
          WHERE fpc.pot_id = ${potIdQ}
          GROUP BY fpc.kid_id, ka.display_name, ka.avatar
          ORDER BY total_amount DESC
          LIMIT ${limit}
        `)
      : await db.execute(sql`
          SELECT
            fpc.kid_id::int AS kid_id,
            ka.display_name AS kid_name,
            ka.avatar,
            SUM(fpc.amount::numeric)::numeric AS total_amount,
            COUNT(*)::int AS contribution_count,
            MAX(fpc.created_at) AS last_at
          FROM family_pot_contributions fpc
          JOIN kids_accounts ka ON ka.id = fpc.kid_id
          GROUP BY fpc.kid_id, ka.display_name, ka.avatar
          ORDER BY total_amount DESC
          LIMIT ${limit}
        `)
    const rows = (
      result as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          total_amount: string | number
          contribution_count: number
          last_at: Date | null
        }[]
      }
    ).rows

    const contributors = rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      totalAmount: Number(r.total_amount ?? 0),
      contributionCount: r.contribution_count,
      lastAt: r.last_at,
    }))

    const totalAmount = contributors.reduce((s, c) => s + c.totalAmount, 0)
    const topContributor = contributors[0] ?? null

    res.json({
      potId: potIdQ,
      total: contributors.length,
      totalAmount,
      topContributor,
      contributors,
    })
  })
)

/**
 * GET /api/family/kid-emoji-cloud?kidId=&limit=15
 * 小孩任務 emoji 雲：統計做最多的 task emoji
 * 視覺化「我做過什麼」、培養回顧感
 */
router.get(
  "/api/family/kid-emoji-cloud",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const limit = Math.min(Math.max(Number(req.query.limit) || 15, 1), 30)

    const result = await db.execute(sql`
      SELECT
        emoji,
        COUNT(*)::int AS count,
        MAX(title) AS sample_title
      FROM kids_tasks
      WHERE kid_id = ${kidIdQ}
        AND status = 'approved'
        AND emoji IS NOT NULL
        AND emoji != ''
      GROUP BY emoji
      ORDER BY count DESC
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: { emoji: string; count: number; sample_title: string }[]
      }
    ).rows

    const total = rows.reduce((s, r) => s + r.count, 0)
    const peak = rows[0]?.count ?? 0

    // 算每個 emoji 的相對大小（用 0.6x ~ 2.4x）
    const emojis = rows.map((r) => {
      const ratio = peak > 0 ? r.count / peak : 0
      const sizeRem = 0.6 + ratio * 1.8 // 0.6 ~ 2.4 rem
      return {
        emoji: r.emoji,
        count: r.count,
        sampleTitle: r.sample_title,
        sizeRem: Math.round(sizeRem * 100) / 100,
        percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
      }
    })

    res.json({
      kidId: kidIdQ,
      total,
      uniqueEmojis: rows.length,
      mostUsed: emojis[0] ?? null,
      emojis,
    })
  })
)

/**
 * GET /api/family/family-mood-today
 * 家庭今日氛圍：今日所有打卡的 mood 平均
 *
 * mood 對應分數（基於既有 VALID_MOODS）：
 *   😄 開心 = 5 / 🙂 還好 = 4 / 😐 普通 = 3 / 😢 難過 = 2 / 😡 生氣 = 1
 * 平均算家庭整體氛圍
 */
router.get(
  "/api/family/family-mood-today",
  asyncHandler(async (_req, res) => {
    const result = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        kc.mood,
        kc.note
      FROM kids_accounts ka
      LEFT JOIN kids_checkins kc ON kc.kid_id = ka.id AND kc.checkin_date = CURRENT_DATE
      WHERE ka.is_active = true
      ORDER BY ka.id ASC
    `)
    const rows = (
      result as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          mood: string | null
          note: string | null
        }[]
      }
    ).rows

    const MOOD_SCORE: Record<string, number> = {
      "😄 開心": 5,
      "🙂 還好": 4,
      "😐 普通": 3,
      "😢 難過": 2,
      "😡 生氣": 1,
    }

    const kids = rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      mood: r.mood,
      note: r.note,
      score: r.mood ? (MOOD_SCORE[r.mood] ?? 3) : null,
      checkedIn: !!r.mood,
    }))

    const moodScores = kids.filter((k) => k.score !== null).map((k) => k.score as number)
    const checkinCount = moodScores.length
    const totalKids = kids.length
    const avgScore =
      moodScores.length > 0
        ? Math.round((moodScores.reduce((s, v) => s + v, 0) / moodScores.length) * 100) / 100
        : 0

    let atmosphere: string
    let atmosphereEmoji: string
    if (checkinCount === 0) {
      atmosphere = "還沒人打卡"
      atmosphereEmoji = "🌫️"
    } else if (avgScore >= 4.5) {
      atmosphere = "全家超開心！"
      atmosphereEmoji = "🌞"
    } else if (avgScore >= 3.5) {
      atmosphere = "家裡氣氛不錯"
      atmosphereEmoji = "😊"
    } else if (avgScore >= 2.5) {
      atmosphere = "家裡平穩"
      atmosphereEmoji = "🌤️"
    } else if (avgScore >= 1.5) {
      atmosphere = "有人需要關心"
      atmosphereEmoji = "🌧️"
    } else {
      atmosphere = "今天情緒比較重、來個家庭聚會吧"
      atmosphereEmoji = "⛈️"
    }

    res.json({
      date: new Date().toISOString().slice(0, 10),
      totalKids,
      checkinCount,
      avgScore,
      atmosphere,
      atmosphereEmoji,
      kids,
    })
  })
)

/**
 * GET /api/family/weekly-heatmap?weeks=12
 * 家庭週曆熱度：按星期幾統計 approved task 數
 */
router.get(
  "/api/family/weekly-heatmap",
  asyncHandler(async (req, res) => {
    const weeks = Math.min(Math.max(Number(req.query.weeks) || 12, 1), 52)

    const result = await db.execute(sql`
      SELECT
        EXTRACT(DOW FROM completed_at)::int AS dow,
        COUNT(*)::int AS n,
        COALESCE(SUM(reward_amount::numeric), 0)::numeric AS total_reward
      FROM kids_tasks
      WHERE status = 'approved'
        AND completed_at >= NOW() - (${weeks * 7}::int || ' days')::interval
      GROUP BY dow
      ORDER BY dow ASC
    `)
    const rows = (
      result as unknown as { rows: { dow: number; n: number; total_reward: string | number }[] }
    ).rows

    const DAY_META = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"]
    const DAY_EMOJI = ["☀️", "💼", "📚", "🎯", "📖", "🎉", "🌟"]
    const byDow = new Map(rows.map((r) => [r.dow, r]))

    const days = Array.from({ length: 7 }, (_, i) => {
      const r = byDow.get(i)
      const count = r?.n ?? 0
      const total = Number(r?.total_reward ?? 0)
      return {
        dow: i,
        name: DAY_META[i],
        emoji: DAY_EMOJI[i],
        count,
        totalReward: total,
      }
    })

    const totalTasks = days.reduce((s, d) => s + d.count, 0)
    const peak = days.reduce((m, d) => Math.max(m, d.count), 0)

    let busiestDay: (typeof days)[0] | null = null
    let quietestDay: (typeof days)[0] | null = null
    for (const d of days) {
      if (!busiestDay || d.count > busiestDay.count) busiestDay = d
      if (!quietestDay || d.count < quietestDay.count) quietestDay = d
    }

    let insight: string
    if (totalTasks === 0) {
      insight = "📊 還沒夠資料、做幾個任務後再看吧"
    } else if (busiestDay && peak > 0) {
      const weekendCount = (days[0]?.count ?? 0) + (days[6]?.count ?? 0)
      const weekdayCount = totalTasks - weekendCount
      if (weekendCount > weekdayCount) {
        insight = `🎉 週末家事比較多（${busiestDay.name} 最忙）`
      } else if (weekdayCount > weekendCount * 2) {
        insight = `💼 平日做得多（${busiestDay.name} 最忙）`
      } else {
        insight = `📊 整週分散、${busiestDay.name} 最忙`
      }
    } else {
      insight = "📊 全週分散"
    }

    res.json({
      weeks,
      totalTasks,
      peak,
      busiestDay,
      quietestDay,
      days,
      insight,
    })
  })
)

/**
 * GET /api/family/kid-education-report?kidId=
 * 小孩教育成果報告（家長端、評估 4 大金融素養面向）
 *
 * 4 維度（each 0-100 分）：
 *   - initiative（主動性）：自己提任務佔總任務的比例
 *   - savings（儲蓄能力）：完成 goal 數 + 存款累積
 *   - empathy（同理心）：捐贈次數 + 不同 recipient 數
 *   - consistency（規律性）：打卡天數 / 註冊以來天數
 *
 * overallScore = 4 個平均
 * 給每個面向評語
 */
router.get(
  "/api/family/kid-education-report",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, kidIdQ)).limit(1)
    if (!kid) throw new AppError(404, "小孩不存在")

    const result = await db.execute(sql`
      SELECT
        -- 主動性：notes 含 '小孩提議' 或 created_by_kid 的任務佔比
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
        ), 0) AS total_approved,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
            AND (notes LIKE '%小孩%' OR notes LIKE '%我要%' OR notes LIKE '%主動%')
        ), 0) AS self_proposed,
        -- 儲蓄能力
        COALESCE((
          SELECT COUNT(*)::int FROM kids_goals
          WHERE kid_id = ${kidIdQ} AND status = 'completed'
        ), 0) AS goals_completed,
        COALESCE((
          SELECT save_balance::numeric FROM kids_jars WHERE kid_id = ${kidIdQ}
        ), 0) AS save_balance,
        -- 同理心
        COALESCE((
          SELECT COUNT(*)::int FROM kids_spendings
          WHERE kid_id = ${kidIdQ} AND jar = 'give'
        ), 0) AS give_count,
        COALESCE((
          SELECT COUNT(DISTINCT recipient)::int FROM kids_spendings
          WHERE kid_id = ${kidIdQ} AND jar = 'give'
            AND recipient IS NOT NULL AND TRIM(recipient) != ''
        ), 0) AS unique_recipients,
        -- 規律性
        COALESCE((
          SELECT COUNT(DISTINCT checkin_date)::int FROM kids_checkins
          WHERE kid_id = ${kidIdQ}
        ), 0) AS total_checkin_days,
        GREATEST((CURRENT_DATE - DATE(${kid.createdAt}))::int, 1) AS account_age_days
    `)
    const row = (
      result as unknown as {
        rows: {
          total_approved: number
          self_proposed: number
          goals_completed: number
          save_balance: string | number
          give_count: number
          unique_recipients: number
          total_checkin_days: number
          account_age_days: number
        }[]
      }
    ).rows[0]!

    // 4 分數計算（各 0-100）
    // 主動性：self_proposed / total（上限 50%、× 200）；無任務則 0
    const initiativeScore =
      row.total_approved > 0
        ? Math.min(100, Math.round((row.self_proposed / row.total_approved) * 200))
        : 0

    // 儲蓄：goals_completed × 20（上限 60）+ save_balance / 50（上限 40）
    const savingsBase = Math.min(60, row.goals_completed * 20)
    const savingsBonus = Math.min(40, Math.round(Number(row.save_balance) / 50))
    const savingsScore = savingsBase + savingsBonus

    // 同理心：give_count × 5（上限 60）+ unique_recipients × 10（上限 40）
    const empathyBase = Math.min(60, row.give_count * 5)
    const empathyBonus = Math.min(40, row.unique_recipients * 10)
    const empathyScore = empathyBase + empathyBonus

    // 規律性：checkin_days / account_age_days × 100
    const consistencyScore = Math.min(
      100,
      Math.round((row.total_checkin_days / row.account_age_days) * 100)
    )

    const overallScore = Math.round(
      (initiativeScore + savingsScore + empathyScore + consistencyScore) / 4
    )

    function comment(score: number): string {
      if (score >= 80) return "🌟 表現傑出！"
      if (score >= 60) return "👍 表現良好"
      if (score >= 40) return "💪 進步中、繼續加油"
      if (score >= 20) return "🌱 剛起步、可培養更多"
      return "🆕 還未開始發展這項"
    }

    const dimensions = [
      {
        key: "initiative",
        name: "主動性",
        emoji: "🚀",
        score: initiativeScore,
        comment: comment(initiativeScore),
        detail: `${row.self_proposed} / ${row.total_approved} 任務自己提議`,
      },
      {
        key: "savings",
        name: "儲蓄能力",
        emoji: "🐷",
        score: savingsScore,
        comment: comment(savingsScore),
        detail: `${row.goals_completed} 個目標達成、存款 $${row.save_balance}`,
      },
      {
        key: "empathy",
        name: "同理心",
        emoji: "❤️",
        score: empathyScore,
        comment: comment(empathyScore),
        detail: `${row.give_count} 次捐贈、幫助 ${row.unique_recipients} 位`,
      },
      {
        key: "consistency",
        name: "規律性",
        emoji: "📅",
        score: consistencyScore,
        comment: comment(consistencyScore),
        detail: `${row.total_checkin_days} 天打卡 / ${row.account_age_days} 天帳號`,
      },
    ]

    res.json({
      kidId: kidIdQ,
      overallScore,
      overallComment: comment(overallScore),
      dimensions,
    })
  })
)

/**
 * GET /api/family/kid-timecapsule?kidId=
 * 小孩時光膠囊：1 年 / 半年 / 1 個月前的同一天紀錄
 *
 * 對每個時間點找：
 *   - approved tasks
 *   - spendings
 *   - mood checkin
 * 回 3 個 capsules（year / halfYear / month）
 */
router.get(
  "/api/family/kid-timecapsule",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    type Capsule = {
      key: "year" | "halfYear" | "month"
      label: string
      date: string
      tasks: Array<{ title: string; emoji: string; reward: number }>
      spendings: Array<{ description: string; emoji: string; amount: number; jar: string }>
      mood: string | null
    }

    async function fetchCapsule(
      key: Capsule["key"],
      label: string,
      daysBack: number
    ): Promise<Capsule | null> {
      const result = await db.execute(sql`
        SELECT
          CURRENT_DATE - (${daysBack}::int) AS d,
          (
            SELECT json_agg(json_build_object(
              'title', title,
              'emoji', emoji,
              'reward', reward_amount::numeric
            ))
            FROM kids_tasks
            WHERE kid_id = ${kidIdQ} AND status = 'approved'
              AND DATE(completed_at) = CURRENT_DATE - (${daysBack}::int)
          ) AS tasks,
          (
            SELECT json_agg(json_build_object(
              'description', description,
              'emoji', emoji,
              'amount', amount::numeric,
              'jar', jar
            ))
            FROM kids_spendings
            WHERE kid_id = ${kidIdQ}
              AND spend_date = CURRENT_DATE - (${daysBack}::int)
          ) AS spendings,
          (
            SELECT mood FROM kids_checkins
            WHERE kid_id = ${kidIdQ}
              AND checkin_date = CURRENT_DATE - (${daysBack}::int)
            LIMIT 1
          ) AS mood
      `)
      const row = (
        result as unknown as {
          rows: {
            d: Date
            tasks: Array<{ title: string; emoji: string; reward: number }> | null
            spendings: Array<{
              description: string
              emoji: string
              amount: number
              jar: string
            }> | null
            mood: string | null
          }[]
        }
      ).rows[0]
      if (!row) return null

      const tasks = (row.tasks ?? []).map((t) => ({
        title: t.title,
        emoji: t.emoji ?? "📋",
        reward: Number(t.reward ?? 0),
      }))
      const spendings = (row.spendings ?? []).map((s) => ({
        description: s.description,
        emoji: s.emoji ?? "💰",
        amount: Number(s.amount ?? 0),
        jar: s.jar,
      }))

      // 沒任何紀錄不回 capsule
      if (tasks.length === 0 && spendings.length === 0 && !row.mood) return null

      return {
        key,
        label,
        date: new Date(row.d).toISOString().slice(0, 10),
        tasks,
        spendings,
        mood: row.mood,
      }
    }

    const [year, halfYear, month] = await Promise.all([
      fetchCapsule("year", "一年前", 365),
      fetchCapsule("halfYear", "半年前", 182),
      fetchCapsule("month", "一個月前", 30),
    ])

    const capsules = [year, halfYear, month].filter((c): c is Capsule => c !== null)

    res.json({
      kidId: kidIdQ,
      total: capsules.length,
      capsules,
    })
  })
)

/**
 * GET /api/family/kid-goals-deadlines?kidId=
 * 小孩端：有 deadline 的 active goals 倒數 + 緊迫度
 */
router.get(
  "/api/family/kid-goals-deadlines",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT
        id::int AS id,
        name,
        emoji,
        current_amount::numeric AS current,
        target_amount::numeric AS target,
        deadline,
        (deadline - CURRENT_DATE)::int AS days_left
      FROM kids_goals
      WHERE kid_id = ${kidIdQ}
        AND status = 'active'
        AND deadline IS NOT NULL
      ORDER BY deadline ASC
    `)
    const rows = (
      result as unknown as {
        rows: {
          id: number
          name: string
          emoji: string | null
          current: string | number
          target: string | number
          deadline: Date
          days_left: number
        }[]
      }
    ).rows

    const goals = rows.map((r) => {
      const current = Number(r.current ?? 0)
      const target = Number(r.target ?? 0)
      const remaining = Math.max(0, target - current)
      const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
      const days = r.days_left

      let urgency: "passed" | "urgent" | "soon" | "ok"
      let message: string
      if (days < 0) {
        urgency = "passed"
        message = `⏰ 已過期 ${Math.abs(days)} 天、調整目標或日期`
      } else if (days <= 7) {
        urgency = "urgent"
        if (remaining === 0) message = `🎉 達標！可以買了！還 ${days} 天到期`
        else message = `🔥 還剩 ${days} 天、需要再存 $${remaining}`
      } else if (days <= 30) {
        urgency = "soon"
        message = `💪 ${days} 天到期、平均每天存 $${Math.ceil(remaining / days)}`
      } else {
        urgency = "ok"
        message = `🌱 ${days} 天到期、放心慢慢存`
      }

      return {
        id: r.id,
        name: r.name,
        emoji: r.emoji ?? "🎯",
        current,
        target,
        remaining,
        progress,
        deadline: r.deadline,
        daysLeft: days,
        urgency,
        message,
      }
    })

    const passedCount = goals.filter((g) => g.urgency === "passed").length
    const urgentCount = goals.filter((g) => g.urgency === "urgent").length

    res.json({
      kidId: kidIdQ,
      total: goals.length,
      passedCount,
      urgentCount,
      goals,
    })
  })
)

/**
 * GET /api/family/parent-todo
 * 家長端待辦清單：今日該做什麼 actionable items
 *
 * 4 種項目：
 *   - approve_task: 待審核任務（status='submitted'）
 *   - kid_no_checkin: 今日缺打卡的小孩
 *   - goal_deadline_soon: 7 天內到期目標
 *   - stale_wish: > 14 天未升級的願望
 *
 * 每項有 priority（urgent / high / medium / low）+ action 描述
 */
router.get(
  "/api/family/parent-todo",
  asyncHandler(async (_req, res) => {
    const [pendingTasks, kidsNoCheckin, goalsSoon, staleWishes] = await Promise.all([
      db.execute(sql`
        SELECT kt.id::int AS id, kt.title, ka.display_name AS kid_name, ka.avatar
        FROM kids_tasks kt
        JOIN kids_accounts ka ON ka.id = kt.kid_id
        WHERE kt.status = 'submitted'
        ORDER BY kt.updated_at DESC
        LIMIT 20
      `),
      db.execute(sql`
        SELECT ka.id::int AS kid_id, ka.display_name AS kid_name, ka.avatar
        FROM kids_accounts ka
        WHERE ka.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM kids_checkins
            WHERE kid_id = ka.id AND checkin_date = CURRENT_DATE
          )
      `),
      db.execute(sql`
        SELECT
          kg.id::int AS id,
          kg.name AS name,
          ka.display_name AS kid_name,
          ka.avatar,
          kg.deadline,
          (kg.deadline - CURRENT_DATE)::int AS days_left,
          kg.current_amount::numeric AS current,
          kg.target_amount::numeric AS target
        FROM kids_goals kg
        JOIN kids_accounts ka ON ka.id = kg.kid_id
        WHERE kg.status = 'active'
          AND kg.deadline IS NOT NULL
          AND kg.deadline <= CURRENT_DATE + INTERVAL '7 days'
          AND kg.deadline >= CURRENT_DATE
        ORDER BY kg.deadline ASC
      `),
      db.execute(sql`
        SELECT
          kw.id::int AS id,
          kw.title,
          ka.display_name AS kid_name,
          ka.avatar,
          (CURRENT_DATE - DATE(kw.created_at))::int AS days_old
        FROM kids_wishes kw
        JOIN kids_accounts ka ON ka.id = kw.kid_id
        WHERE kw.status = 'wished'
          AND kw.created_at < NOW() - INTERVAL '14 days'
        ORDER BY kw.created_at ASC
        LIMIT 10
      `),
    ])

    const todos: Array<{
      type: string
      priority: "urgent" | "high" | "medium" | "low"
      icon: string
      action: string
      detail?: string
      relatedId?: number
      kidName?: string
      avatar?: string
    }> = []

    for (const r of (
      pendingTasks as unknown as {
        rows: { id: number; title: string; kid_name: string; avatar: string }[]
      }
    ).rows) {
      todos.push({
        type: "approve_task",
        priority: "urgent",
        icon: "⏳",
        action: `審核「${r.title}」`,
        detail: `${r.kid_name} 已完成、等家長確認`,
        relatedId: r.id,
        kidName: r.kid_name,
        avatar: r.avatar,
      })
    }

    for (const r of (
      kidsNoCheckin as unknown as {
        rows: { kid_id: number; kid_name: string; avatar: string }[]
      }
    ).rows) {
      todos.push({
        type: "kid_no_checkin",
        priority: "low",
        icon: "📅",
        action: `提醒 ${r.kid_name} 打卡`,
        detail: "今天還沒寫心情",
        relatedId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
      })
    }

    for (const r of (
      goalsSoon as unknown as {
        rows: {
          id: number
          name: string
          kid_name: string
          avatar: string
          deadline: Date
          days_left: number
          current: string | number
          target: string | number
        }[]
      }
    ).rows) {
      const cur = Number(r.current)
      const tgt = Number(r.target)
      const remaining = tgt - cur
      todos.push({
        type: "goal_deadline_soon",
        priority: r.days_left <= 3 ? "urgent" : "high",
        icon: "🎯",
        action: `關注「${r.name}」目標`,
        detail: `${r.kid_name}、還差 $${remaining} / ${r.days_left} 天到期`,
        relatedId: r.id,
        kidName: r.kid_name,
        avatar: r.avatar,
      })
    }

    for (const r of (
      staleWishes as unknown as {
        rows: {
          id: number
          title: string
          kid_name: string
          avatar: string
          days_old: number
        }[]
      }
    ).rows) {
      todos.push({
        type: "stale_wish",
        priority: "medium",
        icon: "✨",
        action: `跟 ${r.kid_name} 聊「${r.title}」`,
        detail: `願望放著 ${r.days_old} 天了、值得升級成目標？`,
        relatedId: r.id,
        kidName: r.kid_name,
        avatar: r.avatar,
      })
    }

    // 按 priority 排序
    const order = { urgent: 0, high: 1, medium: 2, low: 3 }
    todos.sort((a, b) => order[a.priority] - order[b.priority])

    res.json({
      total: todos.length,
      urgentCount: todos.filter((t) => t.priority === "urgent").length,
      todos,
    })
  })
)

/**
 * GET /api/family/kid-weekly-report?kidId=
 * 小孩本週成績單：本週 vs 上週、4 維度 + 趨勢
 */
router.get(
  "/api/family/kid-weekly-report",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
            AND completed_at >= NOW() - INTERVAL '7 days'
        ), 0) AS this_tasks,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
            AND completed_at >= NOW() - INTERVAL '7 days'
        ), 0) AS this_earned,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ${kidIdQ} AND jar = 'spend'
            AND spend_date >= CURRENT_DATE - INTERVAL '7 days'
        ), 0) AS this_spent,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_checkins
          WHERE kid_id = ${kidIdQ}
            AND checkin_date >= CURRENT_DATE - INTERVAL '7 days'
        ), 0) AS this_checkins,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
            AND completed_at >= NOW() - INTERVAL '14 days'
            AND completed_at < NOW() - INTERVAL '7 days'
        ), 0) AS prev_tasks,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
            AND completed_at >= NOW() - INTERVAL '14 days'
            AND completed_at < NOW() - INTERVAL '7 days'
        ), 0) AS prev_earned,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ${kidIdQ} AND jar = 'spend'
            AND spend_date >= CURRENT_DATE - INTERVAL '14 days'
            AND spend_date < CURRENT_DATE - INTERVAL '7 days'
        ), 0) AS prev_spent,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_checkins
          WHERE kid_id = ${kidIdQ}
            AND checkin_date >= CURRENT_DATE - INTERVAL '14 days'
            AND checkin_date < CURRENT_DATE - INTERVAL '7 days'
        ), 0) AS prev_checkins
    `)
    const row = (
      result as unknown as {
        rows: {
          this_tasks: number
          this_earned: string | number
          this_spent: string | number
          this_checkins: number
          prev_tasks: number
          prev_earned: string | number
          prev_spent: string | number
          prev_checkins: number
        }[]
      }
    ).rows[0]!

    const thisWeek = {
      tasks: row.this_tasks,
      earned: Number(row.this_earned ?? 0),
      spent: Number(row.this_spent ?? 0),
      checkins: row.this_checkins,
    }
    const prevWeek = {
      tasks: row.prev_tasks,
      earned: Number(row.prev_earned ?? 0),
      spent: Number(row.prev_spent ?? 0),
      checkins: row.prev_checkins,
    }

    type Metric = {
      key: string
      name: string
      this: number
      prev: number
      trend: "up" | "down" | "flat"
      trendEmoji: string
      delta: number
    }
    function buildMetric(key: string, name: string, thisV: number, prevV: number): Metric {
      const delta = thisV - prevV
      let trend: "up" | "down" | "flat" = "flat"
      let trendEmoji = "➡️"
      if (delta > 0) {
        trend = "up"
        trendEmoji = "📈"
      } else if (delta < 0) {
        trend = "down"
        trendEmoji = "📉"
      }
      return { key, name, this: thisV, prev: prevV, trend, trendEmoji, delta }
    }
    const metrics = [
      buildMetric("tasks", "完成任務", thisWeek.tasks, prevWeek.tasks),
      buildMetric("earned", "賺到的錢", thisWeek.earned, prevWeek.earned),
      buildMetric("spent", "花掉的錢", thisWeek.spent, prevWeek.spent),
      buildMetric("checkins", "打卡天數", thisWeek.checkins, prevWeek.checkins),
    ]

    const positiveCount = [
      metrics[0].delta > 0,
      metrics[1].delta > 0,
      metrics[2].delta < 0, // 花得少是好事
      metrics[3].delta > 0,
    ].filter(Boolean).length

    let overall: string
    if (thisWeek.tasks === 0 && prevWeek.tasks === 0) {
      overall = "🌱 還沒開始這週的任務、加油！"
    } else if (positiveCount >= 3) {
      overall = "🌟 本週超棒！持續進步中"
    } else if (positiveCount >= 2) {
      overall = "👍 本週有進步、繼續加油"
    } else if (thisWeek.tasks > 0) {
      overall = "💪 本週有完成任務、不錯哦"
    } else {
      overall = "🔄 本週稍慢、下週可以做更多"
    }

    res.json({
      kidId: kidIdQ,
      thisWeek,
      prevWeek,
      metrics,
      overall,
    })
  })
)

/**
 * GET /api/family/today-summary
 * 家庭今日重點（家長端、一頁看今日全家動態）
 * 今日全家：完成任務數 / 收入 / 花費 / 待審核 / 打卡數 / 各小孩活動
 */
router.get(
  "/api/family/today-summary",
  asyncHandler(async (_req, res) => {
    const [
      approvedToday,
      rewardToday,
      spentToday,
      givenToday,
      pendingTasks,
      checkinsToday,
      newWishes,
      perKid,
    ] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*)::int AS n FROM kids_tasks
        WHERE status = 'approved' AND DATE(completed_at) = CURRENT_DATE
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric AS s
        FROM kids_tasks
        WHERE status = 'approved' AND DATE(completed_at) = CURRENT_DATE
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s
        FROM kids_spendings WHERE jar = 'spend' AND spend_date = CURRENT_DATE
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s
        FROM kids_spendings WHERE jar = 'give' AND spend_date = CURRENT_DATE
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS n FROM kids_tasks WHERE status = 'submitted'
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT kid_id)::int AS n FROM kids_checkins
        WHERE checkin_date = CURRENT_DATE
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS n FROM kids_wishes
        WHERE DATE(created_at) = CURRENT_DATE
      `),
      db.execute(sql`
        SELECT
          ka.id::int AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar,
          COALESCE((
            SELECT COUNT(*)::int FROM kids_tasks
            WHERE kid_id = ka.id AND status = 'approved'
              AND DATE(completed_at) = CURRENT_DATE
          ), 0) AS tasks,
          COALESCE((
            SELECT SUM(amount::numeric)::numeric FROM kids_spendings
            WHERE kid_id = ka.id AND spend_date = CURRENT_DATE
          ), 0) AS spent,
          CASE WHEN EXISTS (
            SELECT 1 FROM kids_checkins
            WHERE kid_id = ka.id AND checkin_date = CURRENT_DATE
          ) THEN true ELSE false END AS checked_in
        FROM kids_accounts ka
        WHERE ka.is_active = true
        ORDER BY tasks DESC, ka.id ASC
      `),
    ])

    const stats = {
      approvedToday: (approvedToday as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
      rewardToday: Number(
        String((rewardToday as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
      ),
      spentToday: Number(
        String((spentToday as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
      ),
      givenToday: Number(
        String((givenToday as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
      ),
      pendingTasks: (pendingTasks as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
      checkinsToday: (checkinsToday as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
      newWishes: (newWishes as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
    }

    const kids = (
      perKid as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          tasks: number
          spent: string | number
          checked_in: boolean
        }[]
      }
    ).rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      tasks: r.tasks ?? 0,
      spent: Number(r.spent ?? 0),
      checkedIn: r.checked_in ?? false,
    }))

    // 「今日亮點」自動偵測（給家長 quick scan）
    const highlights: string[] = []
    if (stats.pendingTasks > 0) highlights.push(`⏳ 有 ${stats.pendingTasks} 個任務待您審核`)
    if (stats.approvedToday >= 5)
      highlights.push(`🌟 今天家裡好忙！${stats.approvedToday} 個任務完成`)
    if (stats.givenToday > 0) highlights.push(`❤️ 今日家庭捐贈 $${stats.givenToday}`)
    if (stats.checkinsToday === kids.length && kids.length > 0) highlights.push("📅 全家都打卡了！")
    if (stats.newWishes > 0) highlights.push(`✨ 新增 ${stats.newWishes} 個願望`)

    // 生成可分享文字（一句總結、適合貼 LINE）
    const today = new Date().toISOString().slice(0, 10)
    const lines: string[] = [`📊 ${today} 全家成就：`]
    if (stats.approvedToday > 0)
      lines.push(`✅ 完成 ${stats.approvedToday} 個任務（獎勵 $${stats.rewardToday}）`)
    if (stats.spentToday > 0) lines.push(`💸 花費 $${stats.spentToday}`)
    if (stats.givenToday > 0) lines.push(`❤️ 捐贈 $${stats.givenToday}`)
    if (stats.checkinsToday > 0) lines.push(`📅 打卡 ${stats.checkinsToday} 人`)
    if (stats.pendingTasks > 0) lines.push(`⏳ 待審核 ${stats.pendingTasks} 個`)
    if (kids.length > 0) {
      const top = kids[0]
      if (top.tasks > 0)
        lines.push(`🏆 今日最積極：${top.avatar} ${top.kidName}（${top.tasks} 任務）`)
    }
    const shareableText =
      lines.length > 1 ? lines.join("\n") : `📊 ${today} 還沒有家庭活動、來開始吧！`

    res.json({
      date: today,
      stats,
      kids,
      highlights,
      shareableText,
    })
  })
)

/**
 * GET /api/family/kid-donation-recipients?kidId=
 * 小孩捐贈受贈方統計（看給誰最多、培養同理心）
 * 從 kids_spendings WHERE jar='give' AND recipient IS NOT NULL GROUP BY
 */
router.get(
  "/api/family/kid-donation-recipients",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT
        recipient,
        COUNT(*)::int AS times,
        SUM(amount::numeric)::numeric AS total,
        MAX(spend_date) AS last_at
      FROM kids_spendings
      WHERE kid_id = ${kidIdQ}
        AND jar = 'give'
        AND recipient IS NOT NULL
        AND TRIM(recipient) != ''
      GROUP BY recipient
      ORDER BY total DESC, times DESC
    `)
    const rows = (
      result as unknown as {
        rows: {
          recipient: string
          times: number
          total: string | number
          last_at: Date | null
        }[]
      }
    ).rows

    const recipients = rows.map((r) => ({
      recipient: r.recipient,
      times: r.times,
      total: Number(r.total ?? 0),
      lastAt: r.last_at,
    }))

    const totalGiven = recipients.reduce((s, r) => s + r.total, 0)
    const totalRecipients = recipients.length

    res.json({
      kidId: kidIdQ,
      totalGiven,
      totalRecipients,
      mostHelped: recipients[0] ?? null,
      recipients,
    })
  })
)

/**
 * GET /api/family/kid-spending-keywords?kidId=&limit=10
 * 小孩消費分類分析：按 description 分群、看錢花在哪
 *
 * 回：
 *   totalSpent / totalCount
 *   keywords: [{ description, count, totalAmount, lastSpentAt }]
 *   topKeyword: 花最多錢那個
 */
router.get(
  "/api/family/kid-spending-keywords",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30)

    const result = await db.execute(sql`
      SELECT
        description,
        MAX(emoji) AS emoji,
        MAX(jar) AS jar,
        COUNT(*)::int AS count,
        SUM(amount::numeric)::numeric AS total_amount,
        MAX(spend_date) AS last_spent_at
      FROM kids_spendings
      WHERE kid_id = ${kidIdQ}
      GROUP BY description
      ORDER BY total_amount DESC, count DESC
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          description: string
          emoji: string | null
          jar: string
          count: number
          total_amount: string | number
          last_spent_at: Date | null
        }[]
      }
    ).rows

    const keywords = rows.map((r) => ({
      description: r.description,
      emoji: r.emoji ?? "💰",
      jar: r.jar,
      count: r.count,
      totalAmount: Number(r.total_amount ?? 0),
      lastSpentAt: r.last_spent_at,
    }))

    const totalSpent = keywords.reduce((s, k) => s + k.totalAmount, 0)
    const totalCount = keywords.reduce((s, k) => s + k.count, 0)
    const topKeyword = keywords[0] ?? null

    res.json({
      kidId: kidIdQ,
      totalSpent,
      totalCount,
      keywords,
      topKeyword,
    })
  })
)

/**
 * GET /api/family/sibling-comparison
 * 兄弟姊妹比較（家長端、看公平性）
 * 每個 active kid 相對家庭平均的 ratio（任務數/獎勵/儲蓄/花費/捐贈）
 *
 * ratio = kidValue / familyAvg
 *   1.0 = 跟平均一樣
 *   > 1 = 比平均多
 *   < 1 = 比平均少
 */
router.get(
  "/api/family/sibling-comparison",
  asyncHandler(async (_req, res) => {
    const result = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar AS avatar,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= NOW() - INTERVAL '30 days'
        ), 0) AS tasks,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= NOW() - INTERVAL '30 days'
        ), 0) AS reward,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ka.id AND jar = 'spend'
            AND spend_date >= CURRENT_DATE - INTERVAL '30 days'
        ), 0) AS spent,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ka.id AND jar = 'give'
            AND spend_date >= CURRENT_DATE - INTERVAL '30 days'
        ), 0) AS given
      FROM kids_accounts ka
      WHERE ka.is_active = true
      ORDER BY ka.id ASC
    `)
    const rows = (
      result as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          tasks: number
          reward: string | number
          spent: string | number
          given: string | number
        }[]
      }
    ).rows

    if (rows.length < 2) {
      return res.json({
        kidCount: rows.length,
        message: "需要至少 2 個小孩才能比較",
        kids: [],
      })
    }

    const kidsData = rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      tasks: r.tasks ?? 0,
      reward: Number(r.reward ?? 0),
      spent: Number(r.spent ?? 0),
      given: Number(r.given ?? 0),
    }))

    const familyAvg = {
      tasks: kidsData.reduce((s, k) => s + k.tasks, 0) / kidsData.length,
      reward: kidsData.reduce((s, k) => s + k.reward, 0) / kidsData.length,
      spent: kidsData.reduce((s, k) => s + k.spent, 0) / kidsData.length,
      given: kidsData.reduce((s, k) => s + k.given, 0) / kidsData.length,
    }

    function ratio(v: number, avg: number) {
      if (avg === 0) return v > 0 ? 2.0 : 1.0
      return Math.round((v / avg) * 100) / 100
    }

    // 標記每個 kid 的「特長」 + 「需要注意」
    const kids = kidsData.map((k) => {
      const ratios = {
        tasks: ratio(k.tasks, familyAvg.tasks),
        reward: ratio(k.reward, familyAvg.reward),
        spent: ratio(k.spent, familyAvg.spent),
        given: ratio(k.given, familyAvg.given),
      }
      const highlights: string[] = []
      if (ratios.tasks >= 1.5) highlights.push("🏆 任務超積極")
      if (ratios.given >= 1.5) highlights.push("❤️ 最有愛心")
      if (ratios.spent <= 0.5 && k.reward > 0) highlights.push("🐷 最會存錢")
      if (ratios.spent >= 2.0) highlights.push("💸 花最多")

      return {
        ...k,
        ratios,
        highlights,
      }
    })

    res.json({
      period: "近 30 天",
      kidCount: kids.length,
      familyAvg: {
        tasks: Math.round(familyAvg.tasks * 10) / 10,
        reward: Math.round(familyAvg.reward),
        spent: Math.round(familyAvg.spent),
        given: Math.round(familyAvg.given),
      },
      kids,
    })
  })
)

/**
 * GET /api/family/kid-suggestions?kidId=&limit=5
 * 推薦小孩可挑戰的任務（別的小孩做過、這個小孩沒做過的）
 */
router.get(
  "/api/family/kid-suggestions",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 10)

    const result = await db.execute(sql`
      WITH family_recent AS (
        SELECT
          title,
          MAX(emoji) AS emoji,
          COUNT(*)::int AS times,
          ROUND(AVG(reward_amount::numeric))::int AS avg_reward,
          MAX(category) AS category
        FROM kids_tasks
        WHERE status = 'approved'
          AND completed_at >= NOW() - INTERVAL '60 days'
        GROUP BY title
      ),
      kid_recent AS (
        SELECT DISTINCT title FROM kids_tasks
        WHERE kid_id = ${kidIdQ}
          AND completed_at >= NOW() - INTERVAL '30 days'
      )
      SELECT fr.title, fr.emoji, fr.times, fr.avg_reward, fr.category
      FROM family_recent fr
      LEFT JOIN kid_recent kr ON kr.title = fr.title
      WHERE kr.title IS NULL
      ORDER BY fr.times DESC, fr.avg_reward DESC
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          title: string
          emoji: string | null
          times: number
          avg_reward: number
          category: string
        }[]
      }
    ).rows

    res.json({
      kidId: kidIdQ,
      total: rows.length,
      suggestions: rows.map((r) => ({
        title: r.title,
        emoji: r.emoji ?? "📋",
        familyTimes: r.times,
        suggestedReward: r.avg_reward,
        category: r.category ?? "other",
      })),
    })
  })
)

/**
 * GET /api/family/kid-wallet-health?kidId=
 * 小孩錢包健康分析：實際支出 vs preset 比較
 *
 * 邏輯：
 *   - 近 30 天 jar=spend 總額（實際花掉）
 *   - 近 30 天 task reward × preset 各比（理論收入）
 *   - actualSpendRatio = spentAmount / totalReward × 100
 *   - presetSpendRatio = kid.spendRatio
 *   - delta = actualSpendRatio - presetSpendRatio
 *   - healthScore：偏離 preset 越多扣越多分
 */
router.get(
  "/api/family/kid-wallet-health",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, kidIdQ)).limit(1)
    if (!kid) throw new AppError(404, "小孩不存在")

    const [rewardRows, spentRows, savedRows, givenRows] = await Promise.all([
      db.execute(sql`
        SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric AS s
        FROM kids_tasks
        WHERE kid_id = ${kidIdQ} AND status = 'approved'
          AND completed_at >= NOW() - INTERVAL '30 days'
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s
        FROM kids_spendings
        WHERE kid_id = ${kidIdQ} AND jar = 'spend'
          AND spend_date >= CURRENT_DATE - INTERVAL '30 days'
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s
        FROM kids_spendings
        WHERE kid_id = ${kidIdQ} AND jar = 'save'
          AND spend_date >= CURRENT_DATE - INTERVAL '30 days'
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s
        FROM kids_spendings
        WHERE kid_id = ${kidIdQ} AND jar = 'give'
          AND spend_date >= CURRENT_DATE - INTERVAL '30 days'
      `),
    ])

    const totalReward = Number(
      String((rewardRows as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
    )
    const spent = Number(
      String((spentRows as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
    )
    const saved = Number(
      String((savedRows as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
    )
    const given = Number(
      String((givenRows as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
    )

    if (totalReward === 0) {
      return res.json({
        kidId: kidIdQ,
        period: "近 30 天",
        totalReward: 0,
        breakdown: null,
        healthScore: null,
        suggestion: "近 30 天還沒收入、先做任務累積看看吧！",
      })
    }

    // 實際比例（佔 totalReward 的百分比）
    const actualSpend = Math.round((spent / totalReward) * 100)
    const actualSave = Math.round((saved / totalReward) * 100)
    const actualGive = Math.round((given / totalReward) * 100)

    const preset = {
      spend: kid.spendRatio,
      save: kid.saveRatio,
      give: kid.giveRatio,
    }
    const actual = { spend: actualSpend, save: actualSave, give: actualGive }
    const delta = {
      spend: actualSpend - preset.spend,
      save: actualSave - preset.save,
      give: actualGive - preset.give,
    }

    // 健康分數：每個 ratio 偏離超過 preset 的 abs 累加扣分
    // 100 - sum(|delta|) / 3
    const totalDeviation = Math.abs(delta.spend) + Math.abs(delta.save) + Math.abs(delta.give)
    const healthScore = Math.max(0, Math.min(100, 100 - Math.round(totalDeviation / 3)))

    let suggestion: string
    if (healthScore >= 85) {
      suggestion = "🌟 完美！實際支出跟預設比例幾乎一致！"
    } else if (healthScore >= 70) {
      suggestion = "👍 不錯！偶爾偏一點點正常"
    } else if (delta.spend > 15) {
      suggestion = `⚠️ 花用花太多了（多花 ${delta.spend}%）、試試把錢移到存錢罐`
    } else if (delta.save < -15) {
      suggestion = `🐷 存得比預設少（少存 ${Math.abs(delta.save)}%）、加油存！`
    } else if (delta.give < -10) {
      suggestion = `❤️ 捐贈比預設少（少捐 ${Math.abs(delta.give)}%）、可以多幫助別人`
    } else {
      suggestion = "📊 比例偏離一些、調整看看 spend/save/give 比"
    }

    res.json({
      kidId: kidIdQ,
      period: "近 30 天",
      totalReward,
      breakdown: {
        spent,
        saved,
        given,
        preset,
        actual,
        delta,
      },
      healthScore,
      suggestion,
    })
  })
)

/**
 * GET /api/family/milestones
 * 家庭里程碑紀錄（全家共同達成）
 * 5 大 tracks × 3 階里程碑、看達成/剩多少
 */
router.get(
  "/api/family/milestones",
  asyncHandler(async (_req, res) => {
    const [taskStats, rewardStats, giveStats, saveStats, checkinStats] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS n FROM kids_tasks WHERE status = 'approved'`),
      db.execute(sql`
        SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric AS s
        FROM kids_tasks WHERE status = 'approved'
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s
        FROM kids_spendings WHERE jar = 'give'
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(current_amount::numeric), 0)::numeric AS s
        FROM kids_goals
      `),
      db.execute(sql`SELECT COUNT(DISTINCT checkin_date)::int AS n FROM kids_checkins`),
    ])

    const totals = {
      tasks: (taskStats as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
      reward: Number(
        String((rewardStats as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
      ),
      given: Number(
        String((giveStats as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
      ),
      saved: Number(
        String((saveStats as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
      ),
      checkins: (checkinStats as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
    }

    type Tier = { value: number; emoji: string; label: string }
    type Track = { key: string; name: string; total: number; tiers: Tier[]; unit: string }
    const tracks: Track[] = [
      {
        key: "tasks",
        name: "全家任務",
        total: totals.tasks,
        unit: "個",
        tiers: [
          { value: 100, emoji: "🌟", label: "百任務達人" },
          { value: 500, emoji: "🏆", label: "五百任務勇者" },
          { value: 1000, emoji: "🐉", label: "千任務傳奇" },
        ],
      },
      {
        key: "reward",
        name: "總獎勵",
        total: totals.reward,
        unit: "元",
        tiers: [
          { value: 5000, emoji: "💰", label: "五千賺手" },
          { value: 20000, emoji: "💎", label: "兩萬大戶" },
          { value: 50000, emoji: "👑", label: "五萬王者" },
        ],
      },
      {
        key: "given",
        name: "全家捐贈",
        total: totals.given,
        unit: "元",
        tiers: [
          { value: 1000, emoji: "❤️", label: "千元愛心" },
          { value: 5000, emoji: "🌈", label: "五千慈善" },
          { value: 10000, emoji: "👼", label: "萬元天使" },
        ],
      },
      {
        key: "saved",
        name: "家庭存款",
        total: totals.saved,
        unit: "元",
        tiers: [
          { value: 5000, emoji: "🐷", label: "五千小金豬" },
          { value: 20000, emoji: "🪙", label: "兩萬金庫" },
          { value: 50000, emoji: "🏰", label: "五萬城堡" },
        ],
      },
      {
        key: "checkins",
        name: "全家打卡",
        total: totals.checkins,
        unit: "天",
        tiers: [
          { value: 30, emoji: "📅", label: "30 天打卡" },
          { value: 100, emoji: "🔥", label: "百日打卡" },
          { value: 365, emoji: "⚡", label: "一年連續" },
        ],
      },
    ]

    const milestones = tracks.map((tr) => {
      const reached = tr.tiers.filter((t) => tr.total >= t.value)
      const next = tr.tiers.find((t) => tr.total < t.value)
      return {
        key: tr.key,
        name: tr.name,
        unit: tr.unit,
        total: tr.total,
        reached,
        next: next
          ? {
              ...next,
              remaining: next.value - tr.total,
              progress: Math.round((tr.total / next.value) * 100),
            }
          : null,
        complete: !next,
      }
    })

    const totalReached = milestones.reduce((s, m) => s + m.reached.length, 0)
    const totalPossible = tracks.reduce((s, t) => s + t.tiers.length, 0)

    res.json({
      totals,
      milestones,
      summary: { totalReached, totalPossible },
    })
  })
)

/**
 * GET /api/family/wealth-trend?months=6
 * 家庭近 N 月財富趨勢：每月 reward / spent / given / net
 */
router.get(
  "/api/family/wealth-trend",
  asyncHandler(async (req, res) => {
    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24)

    const result = await db.execute(sql`
      WITH month_series AS (
        SELECT generate_series(
          DATE_TRUNC('month', CURRENT_DATE - (${months - 1}::int || ' months')::interval),
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        )::date AS m
      )
      SELECT
        TO_CHAR(ms.m, 'YYYY-MM') AS month,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE status = 'approved'
            AND DATE_TRUNC('month', completed_at) = ms.m
        ), 0) AS reward,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE jar = 'spend'
            AND DATE_TRUNC('month', spend_date) = ms.m
        ), 0) AS spent,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE jar = 'give'
            AND DATE_TRUNC('month', spend_date) = ms.m
        ), 0) AS given
      FROM month_series ms
      ORDER BY ms.m ASC
    `)
    const rows = (
      result as unknown as {
        rows: {
          month: string
          reward: string | number
          spent: string | number
          given: string | number
        }[]
      }
    ).rows

    const trend = rows.map((r) => ({
      month: r.month,
      reward: Number(r.reward ?? 0),
      spent: Number(r.spent ?? 0),
      given: Number(r.given ?? 0),
      net: Number(r.reward ?? 0) - Number(r.spent ?? 0) - Number(r.given ?? 0),
    }))

    const summary = {
      totalReward: trend.reduce((s, t) => s + t.reward, 0),
      totalSpent: trend.reduce((s, t) => s + t.spent, 0),
      totalGiven: trend.reduce((s, t) => s + t.given, 0),
      totalNet: trend.reduce((s, t) => s + t.net, 0),
    }

    res.json({ months, summary, trend })
  })
)

/**
 * GET /api/family/kid-time-of-day?kidId=
 * 小孩任務完成時段分析（看是早起型/午後型/夜貓型）
 *
 * 4 時段：
 *   morning（06-11）/ afternoon（12-17）/ evening（18-21）/ night（22-05）
 * 回 totalTasks + slots + dominantSlot
 */
router.get(
  "/api/family/kid-time-of-day",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT EXTRACT(HOUR FROM completed_at)::int AS h, COUNT(*)::int AS n
      FROM kids_tasks
      WHERE kid_id = ${kidIdQ}
        AND status = 'approved'
        AND completed_at IS NOT NULL
      GROUP BY h
    `)
    const rows = (result as unknown as { rows: { h: number; n: number }[] }).rows

    const counts = { morning: 0, afternoon: 0, evening: 0, night: 0 }
    for (const r of rows) {
      const h = r.h
      if (h >= 6 && h < 12) counts.morning += r.n
      else if (h >= 12 && h < 18) counts.afternoon += r.n
      else if (h >= 18 && h < 22) counts.evening += r.n
      else counts.night += r.n
    }

    const total = counts.morning + counts.afternoon + counts.evening + counts.night

    const SLOT_META: Record<
      string,
      { name: string; emoji: string; range: string; personality: string }
    > = {
      morning: {
        name: "早晨",
        emoji: "🌅",
        range: "06-11",
        personality: "早起型 — 一日之計在於晨！",
      },
      afternoon: {
        name: "下午",
        emoji: "☀️",
        range: "12-17",
        personality: "午後型 — 下午精力旺盛！",
      },
      evening: {
        name: "傍晚",
        emoji: "🌆",
        range: "18-21",
        personality: "傍晚型 — 晚餐前的家事達人！",
      },
      night: { name: "深夜", emoji: "🌙", range: "22-05", personality: "夜貓型 — 夜晚的勞動者！" },
    }

    const slots = (["morning", "afternoon", "evening", "night"] as const).map((key) => {
      const count = counts[key]
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0
      return {
        slot: key,
        name: SLOT_META[key].name,
        emoji: SLOT_META[key].emoji,
        range: SLOT_META[key].range,
        count,
        percentage,
      }
    })

    let dominantSlot: (typeof slots)[0] & { personality: string } = {
      ...slots[0],
      personality: "",
    }
    let topCount = -1
    for (const s of slots) {
      if (s.count > topCount) {
        topCount = s.count
        dominantSlot = { ...s, personality: SLOT_META[s.slot].personality }
      }
    }

    res.json({
      kidId: kidIdQ,
      totalTasks: total,
      slots,
      dominantSlot: total > 0 ? dominantSlot : null,
    })
  })
)

/**
 * GET /api/family/popular-tasks?limit=5
 * 家庭最常做的任務 TOP N（按 title 分組統計）
 * 看哪些任務最熱門、totalReward 多少、最近一次完成日
 */
router.get(
  "/api/family/popular-tasks",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20)

    const result = await db.execute(sql`
      SELECT
        title,
        MAX(emoji) AS emoji,
        COUNT(*)::int AS times,
        SUM(reward_amount::numeric)::numeric AS total_reward,
        COUNT(DISTINCT kid_id)::int AS unique_kids,
        MAX(completed_at) AS last_at
      FROM kids_tasks
      WHERE status = 'approved' AND completed_at IS NOT NULL
      GROUP BY title
      ORDER BY times DESC, total_reward DESC
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          title: string
          emoji: string | null
          times: number
          total_reward: string | number
          unique_kids: number
          last_at: Date | null
        }[]
      }
    ).rows

    res.json({
      total: rows.length,
      tasks: rows.map((r) => ({
        title: r.title,
        emoji: r.emoji ?? "📋",
        times: r.times,
        totalReward: Number(r.total_reward ?? 0),
        uniqueKids: r.unique_kids,
        lastAt: r.last_at,
      })),
    })
  })
)

/**
 * GET /api/family/kid-praises?kidId=&limit=10
 * 小孩端：家長誇獎回顧
 * 從 kids_tasks.parent_feedback 拉非空的、按時間倒序
 */
router.get(
  "/api/family/kid-praises",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50)

    const result = await db.execute(sql`
      SELECT
        id::int AS id,
        title,
        emoji,
        reward_amount::numeric AS reward,
        parent_feedback,
        approved_at
      FROM kids_tasks
      WHERE kid_id = ${kidIdQ}
        AND status = 'approved'
        AND parent_feedback IS NOT NULL
        AND TRIM(parent_feedback) != ''
      ORDER BY approved_at DESC NULLS LAST
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          id: number
          title: string
          emoji: string | null
          reward: string | number
          parent_feedback: string
          approved_at: Date | null
        }[]
      }
    ).rows

    res.json({
      kidId: kidIdQ,
      total: rows.length,
      praises: rows.map((r) => ({
        id: r.id,
        title: r.title,
        emoji: r.emoji ?? "📋",
        reward: Number(r.reward ?? 0),
        message: r.parent_feedback,
        at: r.approved_at,
      })),
    })
  })
)

/**
 * GET /api/family/kid-activity-heatmap?kidId=&weeks=12
 * 小孩活動 heatmap（近 N 週每天 task count + spending count）
 * GitHub 風小方塊視覺化、培養日常感
 *
 * 回：
 *   days: [{ date: 'YYYY-MM-DD', taskCount, spendingCount, total }]
 *   peak：最大值（給前端計算 intensity 0-4 級）
 */
router.get(
  "/api/family/kid-activity-heatmap",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const weeks = Math.min(Math.max(Number(req.query.weeks) || 12, 1), 52)
    const days = weeks * 7

    const result = await db.execute(sql`
      WITH RECURSIVE date_series AS (
        SELECT CURRENT_DATE - (${days - 1}::int) AS d
        UNION ALL
        SELECT d + 1 FROM date_series WHERE d < CURRENT_DATE
      )
      SELECT
        ds.d AS date,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
            AND DATE(completed_at) = ds.d
        ), 0) AS task_count,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_spendings
          WHERE kid_id = ${kidIdQ} AND spend_date = ds.d
        ), 0) AS spending_count
      FROM date_series ds
      ORDER BY ds.d ASC
    `)
    const rows = (
      result as unknown as {
        rows: { date: Date | string; task_count: number; spending_count: number }[]
      }
    ).rows

    const daysOut = rows.map((r) => {
      const dateStr =
        typeof r.date === "string"
          ? r.date.slice(0, 10)
          : new Date(r.date).toISOString().slice(0, 10)
      const total = (r.task_count ?? 0) + (r.spending_count ?? 0)
      return {
        date: dateStr,
        taskCount: r.task_count ?? 0,
        spendingCount: r.spending_count ?? 0,
        total,
      }
    })
    const peak = daysOut.reduce((m, d) => Math.max(m, d.total), 0)
    const activeDays = daysOut.filter((d) => d.total > 0).length

    res.json({
      kidId: kidIdQ,
      weeks,
      peak,
      activeDays,
      days: daysOut,
    })
  })
)

/**
 * GET /api/family/all-goals-summary
 * 家長端：所有 active 目標一覽（按進度降序）
 */
router.get(
  "/api/family/all-goals-summary",
  asyncHandler(async (_req, res) => {
    const result = await db.execute(sql`
      SELECT
        kg.id::int AS id,
        kg.kid_id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar AS kid_avatar,
        kg.name AS name,
        kg.emoji AS emoji,
        kg.current_amount::numeric AS current_amount,
        kg.target_amount::numeric AS target_amount,
        kg.status::text AS status,
        kg.deadline AS deadline
      FROM kids_goals kg
      JOIN kids_accounts ka ON ka.id = kg.kid_id
      WHERE kg.status = 'active' AND ka.is_active = true
    `)
    const rows = (
      result as unknown as {
        rows: {
          id: number
          kid_id: number
          kid_name: string
          kid_avatar: string
          name: string
          emoji: string | null
          current_amount: string | number
          target_amount: string | number
          status: string
          deadline: Date | null
        }[]
      }
    ).rows

    const goals = rows
      .map((r) => {
        const current = Number(r.current_amount ?? 0)
        const target = Number(r.target_amount ?? 0)
        const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
        return {
          id: r.id,
          kidId: r.kid_id,
          kidName: r.kid_name,
          kidAvatar: r.kid_avatar,
          name: r.name,
          emoji: r.emoji ?? "🎯",
          currentAmount: current,
          targetAmount: target,
          remaining: Math.max(0, target - current),
          progress,
          deadline: r.deadline,
        }
      })
      .sort((a, b) => b.progress - a.progress)

    const nearComplete = goals.filter((g) => g.progress >= 80).length
    const completedReady = goals.filter((g) => g.progress >= 100).length

    res.json({
      total: goals.length,
      nearComplete,
      completedReady,
      goals,
    })
  })
)

/**
 * GET /api/family/kid-next-badge?kidId=
 * 找小孩最接近解鎖的徽章（unlocked=false 且 remaining 最小）
 * 激勵感極強：大字顯示「再 N 個任務就解鎖 XXX 徽章！」
 */
router.get(
  "/api/family/kid-next-badge",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    // 統計 + 已解鎖徽章（與 badges-catalog 同邏輯）
    const [tStats, gStats, gvStats, savStats, earned, streak] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS n FROM kids_tasks
        WHERE kid_id = ${kidIdQ} AND status = 'approved'`),
      db.execute(sql`SELECT COUNT(*)::int AS n FROM kids_goals
        WHERE kid_id = ${kidIdQ} AND status = 'completed'`),
      db.execute(sql`SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s FROM kids_spendings
        WHERE kid_id = ${kidIdQ} AND jar = 'give'`),
      db.execute(sql`SELECT COALESCE(SUM(current_amount::numeric), 0)::numeric AS s
        FROM kids_goals WHERE kid_id = ${kidIdQ}`),
      db
        .select({ badgeType: kidsBadges.badgeType })
        .from(kidsBadges)
        .where(eq(kidsBadges.kidId, kidIdQ)),
      calcStreak(kidIdQ),
    ])

    const totalApproved = (tStats as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0
    const totalGoals = (gStats as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0
    const totalGiven = parseFloat(
      String((gvStats as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? "0")
    )
    const totalSaved = parseFloat(
      String((savStats as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? "0")
    )
    const earnedSet = new Set(earned.map((b) => b.badgeType))

    type BadgeDef = {
      type: string
      title: string
      emoji: string
      target: number
      current: number
      unit: string
    }
    const candidates: BadgeDef[] = [
      {
        type: "first_task",
        title: "完成第一個任務",
        emoji: "🌟",
        target: 1,
        current: totalApproved,
        unit: "個任務",
      },
      {
        type: "tasks_10",
        title: "完成 10 個任務",
        emoji: "💪",
        target: 10,
        current: totalApproved,
        unit: "個任務",
      },
      {
        type: "tasks_50",
        title: "完成 50 個任務",
        emoji: "🏆",
        target: 50,
        current: totalApproved,
        unit: "個任務",
      },
      {
        type: "tasks_100",
        title: "完成 100 個任務",
        emoji: "🚀",
        target: 100,
        current: totalApproved,
        unit: "個任務",
      },
      {
        type: "first_goal",
        title: "完成第一個存錢目標",
        emoji: "🎯",
        target: 1,
        current: totalGoals,
        unit: "個目標",
      },
      {
        type: "goals_5",
        title: "完成 5 個目標",
        emoji: "🎖️",
        target: 5,
        current: totalGoals,
        unit: "個目標",
      },
      {
        type: "goals_10",
        title: "完成 10 個目標",
        emoji: "🏅",
        target: 10,
        current: totalGoals,
        unit: "個目標",
      },
      {
        type: "first_give",
        title: "第一次捐贈",
        emoji: "❤️",
        target: 1,
        current: totalGiven > 0 ? 1 : 0,
        unit: "次捐贈",
      },
      {
        type: "give_100",
        title: "累積捐贈 100 元",
        emoji: "🤝",
        target: 100,
        current: totalGiven,
        unit: "元",
      },
      {
        type: "give_500",
        title: "累積捐贈 500 元",
        emoji: "💝",
        target: 500,
        current: totalGiven,
        unit: "元",
      },
      {
        type: "give_1000",
        title: "累積捐贈 1000 元",
        emoji: "🌈",
        target: 1000,
        current: totalGiven,
        unit: "元",
      },
      {
        type: "save_100",
        title: "存款達 100 元",
        emoji: "🐷",
        target: 100,
        current: totalSaved,
        unit: "元",
      },
      {
        type: "save_500",
        title: "存款達 500 元",
        emoji: "💰",
        target: 500,
        current: totalSaved,
        unit: "元",
      },
      {
        type: "streak_7",
        title: "連續 7 天打卡",
        emoji: "🔥",
        target: 7,
        current: streak,
        unit: "天連續",
      },
      {
        type: "streak_30",
        title: "連續 30 天打卡",
        emoji: "⚡",
        target: 30,
        current: streak,
        unit: "天連續",
      },
    ]

    const locked = candidates
      .filter((b) => !earnedSet.has(b.type) && b.current < b.target && b.current >= 0)
      .map((b) => ({ ...b, remaining: b.target - b.current }))
      .sort((a, b) => a.remaining - b.remaining)

    if (locked.length === 0) {
      return res.json({
        kidId: kidIdQ,
        next: null,
        message: "🎊 已解鎖目錄內所有徽章、傳奇等級！",
      })
    }

    const next = locked[0]
    const progress = next.target > 0 ? Math.round((next.current / next.target) * 100) : 0

    res.json({
      kidId: kidIdQ,
      next: {
        type: next.type,
        title: next.title,
        emoji: next.emoji,
        target: next.target,
        current: next.current,
        remaining: next.remaining,
        unit: next.unit,
        progress,
      },
      message: `再 ${next.remaining} ${next.unit}就解鎖「${next.title}」！`,
    })
  })
)

/**
 * GET /api/family/kid-task-streak?kidId=
 * 任務 streak：連續做任務的天數（培養日常習慣）
 *
 * currentStreak：今天/昨天起連續、用 completed_at 的不同日期算
 * longestStreak：歷史最長連續天數
 * lastTaskDate：最近一次 approved 任務的日期
 */
router.get(
  "/api/family/kid-task-streak",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT DISTINCT DATE(completed_at) AS d
      FROM kids_tasks
      WHERE kid_id = ${kidIdQ} AND status = 'approved' AND completed_at IS NOT NULL
      ORDER BY d DESC
      LIMIT 365
    `)
    const dates = (result as unknown as { rows: { d: Date | string }[] }).rows.map((r) =>
      typeof r.d === "string" ? r.d.slice(0, 10) : new Date(r.d).toISOString().slice(0, 10)
    )

    if (dates.length === 0) {
      return res.json({
        kidId: kidIdQ,
        currentStreak: 0,
        longestStreak: 0,
        lastTaskDate: null,
        message: "還沒做任務、開始第一個！",
      })
    }

    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

    // currentStreak：從今天/昨天起連續
    let currentStreak = 0
    if (dates[0] === today || dates[0] === yesterday) {
      currentStreak = 1
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1])
        const cur = new Date(dates[i])
        const diff = Math.round((prev.getTime() - cur.getTime()) / 86_400_000)
        if (diff === 1) currentStreak++
        else break
      }
    }

    // longestStreak：掃描全 365 天找最長連續
    let longestStreak = 1
    let tempStreak = 1
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1])
      const cur = new Date(dates[i])
      const diff = Math.round((prev.getTime() - cur.getTime()) / 86_400_000)
      if (diff === 1) {
        tempStreak++
        if (tempStreak > longestStreak) longestStreak = tempStreak
      } else {
        tempStreak = 1
      }
    }

    const message =
      currentStreak === 0
        ? "🌱 來做任務、開啟新 streak！"
        : currentStreak < 3
          ? `🔥 連續 ${currentStreak} 天、繼續加油！`
          : currentStreak < 7
            ? `🌟 已經 ${currentStreak} 天了！別斷了！`
            : currentStreak < 30
              ? `🏆 ${currentStreak} 天連續、超強！`
              : `🐉 ${currentStreak} 天連續、傳奇等級！`

    res.json({
      kidId: kidIdQ,
      currentStreak,
      longestStreak,
      lastTaskDate: dates[0],
      message,
    })
  })
)

/**
 * GET /api/family/monthly-stats?month=YYYY-MM
 * 全家月度統計（家長端、不指定 kidId）
 * 一頁看全家本月表現、含每個小孩的細項
 *
 * 回：
 *   month, family: { tasksApproved, totalReward, totalSpent, totalSaved, totalGiven, checkinDays }
 *   perKid: [{ kidId, kidName, avatar, tasksApproved, totalReward, totalSpent, totalSaved, totalGiven }]
 */
router.get(
  "/api/family/monthly-stats",
  asyncHandler(async (req, res) => {
    const monthQ = String(req.query.month ?? "").trim()
    const monthRegex = /^\d{4}-\d{2}$/
    const month = monthRegex.test(monthQ) ? monthQ : new Date().toISOString().slice(0, 7)
    const startDate = `${month}-01`
    // 下個月 1 號
    const [y, m] = month.split("-").map(Number)
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`

    const perKid = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar AS avatar,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= ${startDate}::date AND completed_at < ${nextMonth}::date
        ), 0) AS tasks_approved,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= ${startDate}::date AND completed_at < ${nextMonth}::date
        ), 0) AS total_reward,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ka.id AND jar = 'spend'
            AND spend_date >= ${startDate}::date AND spend_date < ${nextMonth}::date
        ), 0) AS total_spent,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ka.id AND jar = 'save'
            AND spend_date >= ${startDate}::date AND spend_date < ${nextMonth}::date
        ), 0) AS total_save_used,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ka.id AND jar = 'give'
            AND spend_date >= ${startDate}::date AND spend_date < ${nextMonth}::date
        ), 0) AS total_given,
        COALESCE((
          SELECT COUNT(DISTINCT checkin_date)::int FROM kids_checkins
          WHERE kid_id = ka.id
            AND checkin_date >= ${startDate}::date AND checkin_date < ${nextMonth}::date
        ), 0) AS checkin_days
      FROM kids_accounts ka
      WHERE ka.is_active = true
      ORDER BY ka.id ASC
    `)
    const rows = (
      perKid as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          tasks_approved: number
          total_reward: string | number
          total_spent: string | number
          total_save_used: string | number
          total_given: string | number
          checkin_days: number
        }[]
      }
    ).rows

    const family = {
      tasksApproved: 0,
      totalReward: 0,
      totalSpent: 0,
      totalSaveUsed: 0,
      totalGiven: 0,
      checkinDays: 0,
    }
    const perKidOut = rows.map((r) => {
      const reward = Number(r.total_reward ?? 0)
      const spent = Number(r.total_spent ?? 0)
      const saveUsed = Number(r.total_save_used ?? 0)
      const given = Number(r.total_given ?? 0)
      family.tasksApproved += r.tasks_approved ?? 0
      family.totalReward += reward
      family.totalSpent += spent
      family.totalSaveUsed += saveUsed
      family.totalGiven += given
      family.checkinDays += r.checkin_days ?? 0
      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        tasksApproved: r.tasks_approved ?? 0,
        totalReward: reward,
        totalSpent: spent,
        totalSaveUsed: saveUsed,
        totalGiven: given,
        checkinDays: r.checkin_days ?? 0,
      }
    })

    res.json({
      month,
      family,
      perKid: perKidOut,
    })
  })
)

/**
 * GET /api/family/kid-difficulty-stats?kidId=
 * 小孩任務難度分佈統計
 * 看小孩有沒有挑戰更難的任務、鼓勵成長
 *
 * 回：
 *   difficulties: [easy/medium/hard 三筆]，含 count + percentage + emoji
 *   totalTasks
 *   averageScore：1.0–3.0（easy=1, medium=2, hard=3）
 *   challengeLevel：beginner / growing / balanced / advanced
 *   suggestion：依分佈給建議
 */
router.get(
  "/api/family/kid-difficulty-stats",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT difficulty, COUNT(*)::int AS n
      FROM kids_tasks
      WHERE kid_id = ${kidIdQ} AND status = 'approved'
      GROUP BY difficulty
    `)
    const byDiff = new Map(
      (result as unknown as { rows: { difficulty: string; n: number }[] }).rows.map((r) => [
        r.difficulty,
        r.n,
      ])
    )

    const easyN = byDiff.get("easy") ?? 0
    const mediumN = byDiff.get("medium") ?? 0
    const hardN = byDiff.get("hard") ?? 0
    const total = easyN + mediumN + hardN

    const DIFF_META = {
      easy: { emoji: "🟢", name: "簡單", score: 1 },
      medium: { emoji: "🟡", name: "中等", score: 2 },
      hard: { emoji: "🔴", name: "困難", score: 3 },
    } as const

    const difficulties = (["easy", "medium", "hard"] as const).map((key) => {
      const count = byDiff.get(key) ?? 0
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0
      return {
        difficulty: key,
        name: DIFF_META[key].name,
        emoji: DIFF_META[key].emoji,
        count,
        percentage,
      }
    })

    const totalScore = easyN * 1 + mediumN * 2 + hardN * 3
    const averageScore = total > 0 ? Math.round((totalScore / total) * 100) / 100 : 0

    let challengeLevel: "none" | "beginner" | "growing" | "balanced" | "advanced"
    let suggestion: string
    if (total === 0) {
      challengeLevel = "none"
      suggestion = "還沒做過任務、開始第一個試試吧！"
    } else if (averageScore < 1.3) {
      challengeLevel = "beginner"
      suggestion = "幾乎都是簡單任務、可以嘗試中等難度挑戰看看！"
    } else if (averageScore < 1.8) {
      challengeLevel = "growing"
      suggestion = "進步中、再多挑戰幾個中等任務"
    } else if (averageScore < 2.3) {
      challengeLevel = "balanced"
      suggestion = "難度搭配得不錯！偶爾試試困難任務獎勵更高"
    } else {
      challengeLevel = "advanced"
      suggestion = "勇於挑戰困難任務、超強的！👏"
    }

    res.json({
      kidId: kidIdQ,
      totalTasks: total,
      difficulties,
      averageScore,
      challengeLevel,
      suggestion,
    })
  })
)

/**
 * GET /api/family/goals/:id/eta
 * 目標達成 ETA 預測（按近 30 天 save 罐淨流入推估）
 *
 * 收入 = 近 30 天 task reward × saveRatio
 * 支出 = 近 30 天 save 罐 spending
 * dailyNetSave = (收入 - 支出) / 30
 * etaDays = ceil(remaining / dailyNetSave)
 */
router.get(
  "/api/family/goals/:id/eta",
  asyncHandler(async (req, res) => {
    const goalId = Number(req.params.id)
    if (!Number.isInteger(goalId) || goalId < 1) throw new AppError(400, "ID 無效")

    const [goal] = await db.select().from(kidsGoals).where(eq(kidsGoals.id, goalId)).limit(1)
    if (!goal) throw new AppError(404, "目標不存在")

    const target = parseFloat(goal.targetAmount)
    const current = parseFloat(goal.currentAmount)
    const remaining = target - current

    if (remaining <= 0) {
      return res.json({
        goalId,
        status: "reached",
        dailyNetSave: 0,
        etaDays: 0,
        etaDate: null,
        remaining: 0,
        suggestion: "🎉 已達成！可以買了！",
      })
    }

    const [kid] = await db
      .select()
      .from(kidsAccounts)
      .where(eq(kidsAccounts.id, goal.kidId))
      .limit(1)
    if (!kid) throw new AppError(404, "小孩不存在")
    const saveRatio = kid.saveRatio / 100

    const earnedRows = await db.execute(sql`
      SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric AS total
      FROM kids_tasks
      WHERE kid_id = ${goal.kidId}
        AND status = 'approved'
        AND completed_at >= NOW() - INTERVAL '30 days'
    `)
    const totalEarned = Number(
      (earnedRows as unknown as { rows: { total: string | number }[] }).rows[0]?.total ?? 0
    )
    const saveEarned = totalEarned * saveRatio

    const spentRows = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS total
      FROM kids_spendings
      WHERE kid_id = ${goal.kidId}
        AND jar = 'save'
        AND spend_date >= CURRENT_DATE - INTERVAL '30 days'
    `)
    const saveSpent = Number(
      (spentRows as unknown as { rows: { total: string | number }[] }).rows[0]?.total ?? 0
    )

    const netSave30 = saveEarned - saveSpent
    const dailyNetSave = netSave30 / 30

    if (dailyNetSave <= 0) {
      return res.json({
        goalId,
        status: "no_savings",
        dailyNetSave: 0,
        etaDays: null,
        etaDate: null,
        remaining,
        suggestion: "近期沒在存錢，多做任務或調整 save 比例試試",
      })
    }

    const etaDays = Math.ceil(remaining / dailyNetSave)
    const etaDate = new Date()
    etaDate.setDate(etaDate.getDate() + etaDays)

    const suggestion =
      etaDays <= 7
        ? `🔥 再 ${etaDays} 天就能買！繼續加油！`
        : etaDays <= 30
          ? `💪 大約 ${etaDays} 天達成、每天存 ${Math.round(dailyNetSave)} 元`
          : etaDays <= 90
            ? `🌱 還要 ${etaDays} 天、試試提高 save 比例會更快`
            : `🎯 ${etaDays} 天有點久、考慮分階段或調整目標`

    res.json({
      goalId,
      status: "predictable",
      dailyNetSave: Math.round(dailyNetSave * 100) / 100,
      etaDays,
      etaDate: etaDate.toISOString().slice(0, 10),
      remaining,
      suggestion,
    })
  })
)

/**
 * GET /api/family/activity?limit=30
 * 全家活動 feed（家長端、不指定 kidId）
 * 一次看全家最近動態：task / spending / checkin / wish
 * 每筆含 kidName + kidAvatar
 */
router.get(
  "/api/family/activity",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 30, 100)

    const result = await db.execute(sql`
      SELECT * FROM (
        SELECT
          'task'::text AS kind,
          kt.id::int AS id,
          kt.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar AS kid_avatar,
          kt.title AS label,
          (kt.reward_amount::text || ' 元') AS amount,
          kt.emoji AS emoji,
          kt.completed_at AS at
        FROM kids_tasks kt
        JOIN kids_accounts ka ON ka.id = kt.kid_id
        WHERE kt.status = 'approved' AND kt.completed_at IS NOT NULL

        UNION ALL

        SELECT
          'spending'::text AS kind,
          ks.id::int AS id,
          ks.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar AS kid_avatar,
          ks.description AS label,
          ('-' || ks.amount::text || ' (' || ks.jar || ')') AS amount,
          ks.emoji AS emoji,
          ks.created_at AS at
        FROM kids_spendings ks
        JOIN kids_accounts ka ON ka.id = ks.kid_id

        UNION ALL

        SELECT
          'checkin'::text AS kind,
          kc.id::int AS id,
          kc.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar AS kid_avatar,
          COALESCE(kc.note, '今日打卡') AS label,
          kc.mood::text AS amount,
          NULL::varchar AS emoji,
          kc.created_at AS at
        FROM kids_checkins kc
        JOIN kids_accounts ka ON ka.id = kc.kid_id

        UNION ALL

        SELECT
          'wish'::text AS kind,
          kw.id::int AS id,
          kw.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar AS kid_avatar,
          kw.title AS label,
          (COALESCE(kw.estimated_price::text, '?') || ' 元・' || kw.status::text) AS amount,
          kw.emoji AS emoji,
          kw.created_at AS at
        FROM kids_wishes kw
        JOIN kids_accounts ka ON ka.id = kw.kid_id
      ) u
      ORDER BY at DESC NULLS LAST
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          kind: string
          id: number
          kid_id: number
          kid_name: string
          kid_avatar: string
          label: string
          amount: string | null
          emoji: string | null
          at: Date | null
        }[]
      }
    ).rows
    res.json({
      activities: rows.map((r) => ({
        kind: r.kind,
        id: r.id,
        kidId: r.kid_id,
        kidName: r.kid_name,
        kidAvatar: r.kid_avatar,
        label: r.label,
        amount: r.amount,
        emoji: r.emoji,
        at: r.at,
      })),
    })
  })
)

/**
 * GET /api/family/kid-bests?kidId=
 * 小孩終生統計 + 個人最佳紀錄
 * 培養長期成就感（看見一路走來的軌跡）
 *
 * 回傳：
 *   lifetime: { totalTasks, totalSaved, totalSpent, totalGiven, totalDays }
 *   bests: { biggestReward, biggestSpend, biggestGive, longestStreak }
 *   firsts: { firstTaskDate, firstSpendDate, firstWishDate }
 */
router.get(
  "/api/family/kid-bests",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const lifetime = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM kids_tasks WHERE kid_id = ${kidIdQ} AND status = 'approved') AS total_tasks,
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM kids_spendings WHERE kid_id = ${kidIdQ} AND jar = 'save') AS total_save_spent,
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM kids_spendings WHERE kid_id = ${kidIdQ} AND jar = 'spend') AS total_spent,
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM kids_spendings WHERE kid_id = ${kidIdQ} AND jar = 'give') AS total_given,
        (SELECT COUNT(DISTINCT checkin_date)::int FROM kids_checkins WHERE kid_id = ${kidIdQ}) AS total_checkin_days,
        (SELECT save_balance::numeric FROM kids_jars WHERE kid_id = ${kidIdQ}) AS save_balance
    `)
    const lt = (
      lifetime as unknown as {
        rows: {
          total_tasks: number
          total_save_spent: string | number
          total_spent: string | number
          total_given: string | number
          total_checkin_days: number
          save_balance: string | number | null
        }[]
      }
    ).rows[0] ?? {
      total_tasks: 0,
      total_save_spent: 0,
      total_spent: 0,
      total_given: 0,
      total_checkin_days: 0,
      save_balance: 0,
    }

    const bests = await db.execute(sql`
      SELECT
        (SELECT COALESCE(MAX(reward_amount::numeric), 0)::numeric FROM kids_tasks WHERE kid_id = ${kidIdQ} AND status = 'approved') AS biggest_reward,
        (SELECT COALESCE(MAX(amount::numeric), 0)::numeric FROM kids_spendings WHERE kid_id = ${kidIdQ} AND jar = 'spend') AS biggest_spend,
        (SELECT COALESCE(MAX(amount::numeric), 0)::numeric FROM kids_spendings WHERE kid_id = ${kidIdQ} AND jar = 'give') AS biggest_give
    `)
    const bt = (
      bests as unknown as {
        rows: {
          biggest_reward: string | number
          biggest_spend: string | number
          biggest_give: string | number
        }[]
      }
    ).rows[0] ?? { biggest_reward: 0, biggest_spend: 0, biggest_give: 0 }

    const firsts = await db.execute(sql`
      SELECT
        (SELECT MIN(completed_at) FROM kids_tasks WHERE kid_id = ${kidIdQ} AND status = 'approved') AS first_task_at,
        (SELECT MIN(spend_date) FROM kids_spendings WHERE kid_id = ${kidIdQ}) AS first_spend_date,
        (SELECT MIN(created_at) FROM kids_wishes WHERE kid_id = ${kidIdQ}) AS first_wish_at
    `)
    const fr = (
      firsts as unknown as {
        rows: {
          first_task_at: Date | null
          first_spend_date: Date | null
          first_wish_at: Date | null
        }[]
      }
    ).rows[0] ?? { first_task_at: null, first_spend_date: null, first_wish_at: null }

    // 連續打卡（latest streak、不必歷史最長、用今日往回算）
    const streakRows = await db.execute(sql`
      SELECT DISTINCT checkin_date FROM kids_checkins
      WHERE kid_id = ${kidIdQ}
      ORDER BY checkin_date DESC
      LIMIT 365
    `)
    const dates = (streakRows as unknown as { rows: { checkin_date: Date }[] }).rows.map((r) =>
      new Date(r.checkin_date).toISOString().slice(0, 10)
    )
    let streak = 0
    if (dates.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
      if (dates[0] === today || dates[0] === yesterday) {
        streak = 1
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i - 1])
          const cur = new Date(dates[i])
          const diff = Math.round((prev.getTime() - cur.getTime()) / 86_400_000)
          if (diff === 1) streak++
          else break
        }
      }
    }

    res.json({
      kidId: kidIdQ,
      lifetime: {
        totalTasks: lt.total_tasks ?? 0,
        totalSaved: Number(lt.save_balance ?? 0),
        totalSpent: Number(lt.total_spent ?? 0),
        totalGiven: Number(lt.total_given ?? 0),
        totalCheckinDays: lt.total_checkin_days ?? 0,
      },
      bests: {
        biggestReward: Number(bt.biggest_reward ?? 0),
        biggestSpend: Number(bt.biggest_spend ?? 0),
        biggestGive: Number(bt.biggest_give ?? 0),
        longestStreak: streak,
      },
      firsts: {
        firstTaskAt: fr.first_task_at,
        firstSpendDate: fr.first_spend_date,
        firstWishAt: fr.first_wish_at,
      },
    })
  })
)

/**
 * GET /api/family/kid-activity?kidId=&limit=20
 * 小孩個人活動時間軸：tasks（approved）/ spendings / checkins / wishes
 * 提升黏著度（看自己最近做了什麼）
 */
router.get(
  "/api/family/kid-activity",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const limit = Math.min(Number(req.query.limit) || 20, 50)

    const result = await db.execute(sql`
      SELECT * FROM (
        SELECT
          'task'::text AS kind,
          kt.id::int AS id,
          kt.title AS label,
          (kt.reward_amount::text || ' 元') AS amount,
          kt.emoji AS emoji,
          kt.completed_at AS at
        FROM kids_tasks kt
        WHERE kt.kid_id = ${kidIdQ} AND kt.status = 'approved' AND kt.completed_at IS NOT NULL

        UNION ALL

        SELECT
          'spending'::text AS kind,
          ks.id::int AS id,
          ks.description AS label,
          ('-' || ks.amount::text || ' (' || ks.jar || ')') AS amount,
          ks.emoji AS emoji,
          ks.created_at AS at
        FROM kids_spendings ks
        WHERE ks.kid_id = ${kidIdQ}

        UNION ALL

        SELECT
          'checkin'::text AS kind,
          kc.id::int AS id,
          COALESCE(kc.note, '今日打卡') AS label,
          kc.mood::text AS amount,
          NULL::varchar AS emoji,
          kc.created_at AS at
        FROM kids_checkins kc
        WHERE kc.kid_id = ${kidIdQ}

        UNION ALL

        SELECT
          'wish'::text AS kind,
          kw.id::int AS id,
          kw.title AS label,
          (COALESCE(kw.estimated_price::text, '?') || ' 元・' || kw.status::text) AS amount,
          kw.emoji AS emoji,
          kw.created_at AS at
        FROM kids_wishes kw
        WHERE kw.kid_id = ${kidIdQ}
      ) u
      ORDER BY at DESC NULLS LAST
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          kind: string
          id: number
          label: string
          amount: string | null
          emoji: string | null
          at: Date | null
        }[]
      }
    ).rows
    res.json({
      kidId: kidIdQ,
      activities: rows.map((r) => ({
        kind: r.kind,
        id: r.id,
        label: r.label,
        amount: r.amount,
        emoji: r.emoji,
        at: r.at,
      })),
    })
  })
)

/**
 * GET /api/family/search?q=&limit=20
 * 跨域搜尋：tasks（title）/ goals（title）/ comments（body）/ wishes（title）
 * 家長一次找全部、ILIKE 不分大小寫
 */
router.get(
  "/api/family/search",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim()
    if (!q) return res.json({ q: "", results: [] })
    if (q.length > 100) throw new AppError(400, "q 過長")
    const limit = Math.min(Number(req.query.limit) || 20, 50)
    const pattern = `%${q}%`

    const result = await db.execute(sql`
      SELECT * FROM (
        SELECT
          'task'::text AS kind,
          kt.id::int AS id,
          kt.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          kt.title AS label,
          kt.status::text AS sub,
          kt.created_at AS at
        FROM kids_tasks kt
        JOIN kids_accounts ka ON ka.id = kt.kid_id
        WHERE kt.title ILIKE ${pattern}

        UNION ALL

        SELECT
          'goal'::text AS kind,
          kg.id::int AS id,
          kg.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          kg.name AS label,
          (kg.current_amount::text || '/' || kg.target_amount::text) AS sub,
          kg.created_at AS at
        FROM kids_goals kg
        JOIN kids_accounts ka ON ka.id = kg.kid_id
        WHERE kg.name ILIKE ${pattern}

        UNION ALL

        SELECT
          'comment'::text AS kind,
          ktc.id::int AS id,
          kt.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          ktc.message AS label,
          ktc.author::text AS sub,
          ktc.created_at AS at
        FROM kids_task_comments ktc
        JOIN kids_tasks kt ON kt.id = ktc.task_id
        JOIN kids_accounts ka ON ka.id = kt.kid_id
        WHERE ktc.message ILIKE ${pattern}

        UNION ALL

        SELECT
          'wish'::text AS kind,
          kw.id::int AS id,
          kw.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          kw.title AS label,
          kw.status::text AS sub,
          kw.created_at AS at
        FROM kids_wishes kw
        JOIN kids_accounts ka ON ka.id = kw.kid_id
        WHERE kw.title ILIKE ${pattern}
      ) u
      ORDER BY at DESC NULLS LAST
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          kind: string
          id: number
          kid_id: number
          kid_name: string
          label: string
          sub: string
          at: Date | null
        }[]
      }
    ).rows
    res.json({
      q,
      results: rows.map((r) => ({
        kind: r.kind,
        id: r.id,
        kidId: r.kid_id,
        kidName: r.kid_name,
        label: r.label,
        sub: r.sub,
        at: r.at,
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

    // 儲蓄累積（看 goal current_amount sum）
    const saveStats = await db.execute(sql`
      SELECT COALESCE(SUM(current_amount::numeric), 0)::numeric AS s
      FROM kids_goals WHERE kid_id = ${kidIdQ}
    `)
    const totalSaved = parseFloat(
      String((saveStats as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? "0")
    )

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
      {
        type: "tasks_100",
        title: "完成 100 個任務",
        emoji: "🚀",
        target: 100,
        current: totalApproved,
        unit: "tasks",
      },
      {
        type: "streak_365",
        title: "連續打卡 1 年",
        emoji: "🐉",
        target: 365,
        current: streak,
        unit: "days",
      },
      {
        type: "goals_10",
        title: "完成 10 個目標",
        emoji: "🏰",
        target: 10,
        current: totalGoals,
        unit: "goals",
      },
      {
        type: "give_1000",
        title: "捐 $1000",
        emoji: "🕊️",
        target: 1000,
        current: totalGiven,
        unit: "dollars",
      },
      {
        type: "give_5000",
        title: "捐 $5000",
        emoji: "👼",
        target: 5000,
        current: totalGiven,
        unit: "dollars",
      },
      {
        type: "save_500",
        title: "存錢達 $500",
        emoji: "🪙",
        target: 500,
        current: totalSaved,
        unit: "dollars",
      },
      {
        type: "save_2000",
        title: "存錢達 $2000",
        emoji: "💎",
        target: 2000,
        current: totalSaved,
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
 * 小孩自己改 PIN
 * POST /api/family/kids/:id/change-pin
 * Body: { oldPin, newPin }
 * 必須驗證舊 PIN、newPin 規格 4 位數字、不可同舊
 */
router.post(
  "/api/family/kids/:id/change-pin",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const oldPin = String(req.body?.oldPin ?? "").trim()
    const newPin = String(req.body?.newPin ?? "").trim()
    if (!/^\d{4}$/.test(newPin)) throw new AppError(400, "新 PIN 需為 4 位數字")
    if (oldPin === newPin) throw new AppError(400, "新 PIN 不可與舊 PIN 相同")
    const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, id)).limit(1)
    if (!kid) throw new AppError(404, "小孩不存在")
    if (kid.pin !== oldPin) throw new AppError(401, "舊 PIN 不正確")
    // 檢查同家其他小孩 PIN 不撞
    const conflict = await db
      .select({ id: kidsAccounts.id })
      .from(kidsAccounts)
      .where(and(eq(kidsAccounts.pin, newPin), eq(kidsAccounts.isActive, true)))
      .limit(1)
    if (conflict.length > 0 && conflict[0].id !== id) {
      throw new AppError(400, "新 PIN 已被其他小孩使用、請換一個")
    }
    await db
      .update(kidsAccounts)
      .set({ pin: newPin, updatedAt: new Date() })
      .where(eq(kidsAccounts.id, id))
    res.json({ ok: true })
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
 * GET /api/family/mood-trends?days=30
 * 全家所有 active 小孩近 N 天心情軌跡、家長看每個孩子情緒
 * Response: { days, series: [{ kidId, displayName, avatar, checkins: [{ date, mood }] }] }
 */
router.get(
  "/api/family/mood-trends",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10), 7), 90)
    const sinceDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

    const kids = await db.select().from(kidsAccounts).where(eq(kidsAccounts.isActive, true))
    if (kids.length === 0) {
      res.json({ days, series: [] })
      return
    }

    const rows = await db.execute(sql`
      SELECT kid_id, mood, checkin_date::text AS checkin_date
      FROM kids_checkins
      WHERE checkin_date >= ${sinceDate}
      ORDER BY checkin_date ASC
    `)
    const data = (
      rows as unknown as { rows: Array<{ kid_id: number; mood: string; checkin_date: string }> }
    ).rows
    const byKid = new Map<number, Array<{ date: string; mood: string }>>()
    data.forEach((r) => {
      if (!byKid.has(r.kid_id)) byKid.set(r.kid_id, [])
      byKid.get(r.kid_id)!.push({ date: r.checkin_date, mood: r.mood })
    })

    // mood 分數對應（給趨勢圖 numeric）
    const MOOD_SCORE: Record<string, number> = {
      "😄 開心": 5,
      "🙂 還好": 4,
      "😐 普通": 3,
      "😢 難過": 2,
      "😡 生氣": 1,
    }

    const series = kids.map((k) => {
      const checkins = byKid.get(k.id) ?? []
      const totalScore = checkins.reduce((s, c) => s + (MOOD_SCORE[c.mood] ?? 3), 0)
      const avgScore = checkins.length > 0 ? totalScore / checkins.length : 0
      return {
        kidId: k.id,
        displayName: k.displayName,
        avatar: k.avatar,
        color: k.color,
        checkins,
        avgScore: Math.round(avgScore * 10) / 10,
        count: checkins.length,
      }
    })
    res.json({ days, series })
  })
)

/**
 * 小孩每日心情簽到
 *   POST /api/family/checkins                  寫今日心情（同日 upsert）
 *   GET  /api/family/checkins?kidId=&days=30   查近 N 天心情軌跡
 */
const VALID_MOODS = ["😄 開心", "🙂 還好", "😐 普通", "😢 難過", "😡 生氣"]

router.post(
  "/api/family/checkins",
  asyncHandler(async (req, res) => {
    const kidIdN = Number(req.body?.kidId)
    const mood = String(req.body?.mood ?? "").trim()
    const note = req.body?.note ? String(req.body.note).slice(0, 500) : null
    if (!kidIdN) throw new AppError(400, "kidId 必填")
    if (!VALID_MOODS.includes(mood)) throw new AppError(400, "mood 不合法")

    const today = new Date().toISOString().slice(0, 10)
    const existing = await db.execute(sql`
      SELECT id FROM kids_checkins
      WHERE kid_id = ${kidIdN} AND checkin_date = ${today}
      LIMIT 1
    `)
    const existingId = (existing as unknown as { rows: { id: number }[] }).rows[0]?.id

    if (existingId) {
      await db.execute(sql`
        UPDATE kids_checkins SET mood = ${mood}, note = ${note}
        WHERE id = ${existingId}
      `)
      const [updated] = await db
        .select()
        .from(kidsCheckins)
        .where(eq(kidsCheckins.id, existingId))
        .limit(1)
      res.json({ ok: true, checkin: updated, updated: true })
    } else {
      const [created] = await db
        .insert(kidsCheckins)
        .values({ kidId: kidIdN, mood, note, checkinDate: today })
        .returning()
      res.status(201).json({ ok: true, checkin: created, updated: false })
    }
  })
)

router.get(
  "/api/family/checkins",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10), 1), 90)
    const sinceDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const rows = await db.execute(sql`
      SELECT * FROM kids_checkins
      WHERE kid_id = ${kidIdQ} AND checkin_date >= ${sinceDate}
      ORDER BY checkin_date DESC
    `)
    const today = new Date().toISOString().slice(0, 10)
    const items = (rows as unknown as { rows: Array<{ checkin_date: string }> }).rows
    const todayCheckin = items.find((x) => x.checkin_date === today) ?? null
    res.json({ kidId: kidIdQ, days, items, today: todayCheckin })
  })
)

/**
 * 家庭共同存錢罐
 *   GET    /api/family/pots                     列出（active + 最近 5 個 completed）
 *   POST   /api/family/pots                     新增（name + targetAmount 必填）
 *   POST   /api/family/pots/:id/contribute      小孩貢獻（從 save 罐扣）
 *   POST   /api/family/pots/:id/complete        家長宣告完成
 *   DELETE /api/family/pots/:id                 刪除（abandoned 或誤建）
 */
router.get(
  "/api/family/pots",
  asyncHandler(async (_req, res) => {
    const pots = await db
      .select()
      .from(familyPots)
      .orderBy(desc(familyPots.status), desc(familyPots.id))
      .limit(50)

    // 補貢獻明細
    const result = await Promise.all(
      pots.map(async (p) => {
        const contributions = await db
          .select()
          .from(familyPotContributions)
          .where(eq(familyPotContributions.potId, p.id))
          .orderBy(desc(familyPotContributions.createdAt))
        return { ...p, contributions }
      })
    )
    res.json(result)
  })
)

router.post(
  "/api/family/pots",
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? "").trim()
    if (!name) throw new AppError(400, "name 必填")
    const targetAmount = Number(req.body?.targetAmount ?? 0)
    if (!(targetAmount > 0)) throw new AppError(400, "targetAmount 需為正數")
    const emoji = String(req.body?.emoji ?? "🏆").slice(0, 8)
    const description = req.body?.description ? String(req.body.description).slice(0, 500) : null
    const [created] = await db
      .insert(familyPots)
      .values({
        name,
        emoji,
        targetAmount: targetAmount.toFixed(2),
        description,
      })
      .returning()
    res.status(201).json(created)
  })
)

router.post(
  "/api/family/pots/:id/contribute",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const kidIdN = Number(req.body?.kidId)
    const amount = Number(req.body?.amount)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效 potId")
    if (!kidIdN) throw new AppError(400, "kidId 必填")
    if (!(amount > 0)) throw new AppError(400, "amount 需為正數")

    const [pot] = await db.select().from(familyPots).where(eq(familyPots.id, id)).limit(1)
    if (!pot) throw new AppError(404, "罐子不存在")
    if (pot.status !== "active") throw new AppError(400, "罐子非進行中")

    const [jar] = await db.select().from(kidsJars).where(eq(kidsJars.kidId, kidIdN)).limit(1)
    if (!jar) throw new AppError(404, "小孩罐子不存在")
    const saveBal = parseFloat(jar.saveBalance)
    if (saveBal < amount) throw new AppError(400, `存錢罐餘額 $${saveBal} 不足 $${amount}`)

    // 扣 save 罐
    await db.execute(sql`
      UPDATE kids_jars SET save_balance = save_balance - ${amount.toFixed(2)}::numeric,
                            updated_at = NOW()
      WHERE kid_id = ${kidIdN}
    `)
    // 加到 pot
    const newCurrent = parseFloat(pot.currentAmount) + amount
    const reached = newCurrent >= parseFloat(pot.targetAmount)
    const [updatedPot] = await db
      .update(familyPots)
      .set({
        currentAmount: newCurrent.toFixed(2),
        status: reached ? "completed" : "active",
        completedAt: reached ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(familyPots.id, id))
      .returning()
    // 記貢獻
    await db
      .insert(familyPotContributions)
      .values({ potId: id, kidId: kidIdN, amount: amount.toFixed(2) })

    res.json({ ok: true, pot: updatedPot, reached })
  })
)

router.post(
  "/api/family/pots/:id/complete",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效 potId")
    const [pot] = await db.select().from(familyPots).where(eq(familyPots.id, id)).limit(1)
    if (!pot) throw new AppError(404, "罐子不存在")
    if (pot.status === "completed") throw new AppError(400, "已完成")
    const [updated] = await db
      .update(familyPots)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(familyPots.id, id))
      .returning()
    res.json({ ok: true, pot: updated })
  })
)

router.delete(
  "/api/family/pots/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效 potId")
    const deleted = await db
      .delete(familyPots)
      .where(eq(familyPots.id, id))
      .returning({ id: familyPots.id })
    if (deleted.length === 0) throw new AppError(404, "罐子不存在")
    res.json({ ok: true })
  })
)

/**
 * 捐贈對象目錄
 *   GET    /api/family/recipients         列出（按 sortOrder 然後 id）
 *   POST   /api/family/recipients         新增
 *   DELETE /api/family/recipients/:id     刪除
 */
router.get(
  "/api/family/recipients",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(familyRecipients)
      .orderBy(familyRecipients.sortOrder, familyRecipients.id)
    res.json(rows)
  })
)

router.post(
  "/api/family/recipients",
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? "").trim()
    if (!name) throw new AppError(400, "name 必填")
    if (name.length > 100) throw new AppError(400, "name 過長")
    const emoji = String(req.body?.emoji ?? "❤️").slice(0, 8)
    const description = req.body?.description ? String(req.body.description).slice(0, 500) : null
    const sortOrder = Number.isInteger(req.body?.sortOrder) ? Number(req.body.sortOrder) : 0
    const [created] = await db
      .insert(familyRecipients)
      .values({ name, emoji, description, sortOrder })
      .returning()
    res.status(201).json(created)
  })
)

router.delete(
  "/api/family/recipients/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const deleted = await db
      .delete(familyRecipients)
      .where(eq(familyRecipients.id, id))
      .returning({ id: familyRecipients.id })
    if (deleted.length === 0) throw new AppError(404, "對象不存在")
    res.json({ ok: true, id })
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
        // VALARM：事件前 15 小時提醒（整天事件 DTSTART 是 00:00、-PT15H = 前一天 09:00）
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeIcs(`明天截止：${row.title}（獎勵 $${row.reward_amount}）`)}`,
        "TRIGGER:-PT15H",
        "END:VALARM",
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

/**
 * POST /api/family/upload-proof
 * 小孩任務照片上傳（multipart/form-data, field=image）
 * 回傳：{ url }（相對路徑、前端用 src 直接渲染）
 */
router.post(
  "/api/family/upload-proof",
  (req, res, next) => {
    proofUpload.single("image")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "檔案過大（上限 5MB）" })
        }
        return res.status(400).json({ error: err.message || "上傳失敗" })
      }
      if (err) return res.status(400).json({ error: err.message || "上傳失敗" })
      next()
    })
  },
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, "需附帶圖片（field: image）")
    const url = `/uploads/kids-proofs/${req.file.filename}`
    res.json({ url, filename: req.file.filename, size: req.file.size })
  })
)

/**
 * POST /api/family/tasks/bulk-approve
 * 家長一鍵批量批准 submitted/pending 任務
 * body: { ids: number[], parentFeedback?: string }
 * 簡化版邏輯（跳過驚喜獎勵 + recurring + 徽章、純入帳 + 三罐分配 + 串主系統）
 * 個別任務失敗不影響其他（部分成功允許）
 */
async function bulkApproveOne(
  taskId: number,
  parentFeedback: string | null
): Promise<{
  taskId: number
  kidName: string
  reward: number
  spendAdd: number
  saveAdd: number
  giveAdd: number
}> {
  const [task] = await db.select().from(kidsTasks).where(eq(kidsTasks.id, taskId)).limit(1)
  if (!task) throw new AppError(404, `任務 ${taskId} 不存在`)
  if (task.status !== "submitted" && task.status !== "pending") {
    throw new AppError(400, `任務 ${taskId} 狀態無法批准（${task.status}）`)
  }
  if (!task.kidId) throw new AppError(400, `任務 ${taskId} 未指定小孩`)

  const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, task.kidId)).limit(1)
  if (!kid) throw new AppError(404, `小孩 ${task.kidId} 不存在`)
  await ensureJarsRow(kid.id)

  const reward = parseFloat(task.rewardAmount)
  const spendAdd = (reward * kid.spendRatio) / 100
  const saveAdd = (reward * kid.saveRatio) / 100
  const giveAdd = (reward * kid.giveRatio) / 100

  await db.execute(sql`
    UPDATE kids_jars SET
      spend_balance = spend_balance + ${spendAdd.toFixed(2)}::numeric,
      save_balance  = save_balance  + ${saveAdd.toFixed(2)}::numeric,
      give_balance  = give_balance  + ${giveAdd.toFixed(2)}::numeric,
      total_received = total_received + ${reward.toFixed(2)}::numeric,
      updated_at = NOW()
    WHERE kid_id = ${kid.id}
  `)

  let paymentRecordId: number | null = null
  try {
    const today = new Date().toISOString().slice(0, 10)
    const [pi] = await db
      .insert(paymentItems)
      .values({
        itemName: `🎁 ${kid.displayName} 零用金：${task.title}`,
        totalAmount: reward.toFixed(2),
        paidAmount: reward.toFixed(2),
        itemType: "home",
        paymentType: "single",
        status: "paid",
        startDate: today,
        source: "manual",
        notes: `家庭記帳「小孩模式」批量批准\n小孩：${kid.displayName}\n任務：${task.title}\n三罐：花$${spendAdd} / 存$${saveAdd} / 捐$${giveAdd}`,
        tags: "kids,allowance,bulk",
      })
      .returning({ id: paymentItems.id })

    const [pr] = await db
      .insert(paymentRecords)
      .values({
        itemId: pi.id,
        amountPaid: reward.toFixed(2),
        paymentDate: today,
        paymentMethod: "現金",
        notes: `家庭記帳（批量）：${kid.displayName} 完成「${task.title}」`,
      })
      .returning({ id: paymentRecords.id })
    paymentRecordId = pr.id
  } catch (err) {
    console.warn("[family-kids bulk-approve] payment 寫入失敗：", err)
  }

  await db
    .update(kidsTasks)
    .set({
      status: "approved",
      approvedAt: new Date(),
      paymentRecordId,
      updatedAt: new Date(),
      ...(parentFeedback ? { parentFeedback } : {}),
    })
    .where(eq(kidsTasks.id, taskId))

  return { taskId, kidName: kid.displayName, reward, spendAdd, saveAdd, giveAdd }
}

router.post(
  "/api/family/tasks/bulk-approve",
  asyncHandler(async (req, res) => {
    const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : []
    const ids = rawIds.filter((x: unknown) => Number.isInteger(x) && (x as number) >= 1) as number[]
    if (ids.length === 0) throw new AppError(400, "需傳 ids: number[]（至少 1 個）")
    if (ids.length > 50) throw new AppError(400, "一次最多 50 個")
    const parentFeedback = req.body?.parentFeedback
      ? String(req.body.parentFeedback).slice(0, 500)
      : null

    const successes: Array<{
      taskId: number
      kidName: string
      reward: number
      spendAdd: number
      saveAdd: number
      giveAdd: number
    }> = []
    const failures: Array<{ id: number; error: string }> = []
    for (const id of ids) {
      try {
        const r = await bulkApproveOne(id, parentFeedback)
        successes.push(r)
      } catch (err) {
        failures.push({
          id,
          error: err instanceof AppError ? err.message : "處理失敗",
        })
      }
    }

    res.json({
      approved: successes.length,
      failed: failures.length,
      totalReward: successes.reduce((s, x) => s + x.reward, 0),
      successes,
      failures,
    })
  })
)

export default router
