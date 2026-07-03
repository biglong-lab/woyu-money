/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 12，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql, eq, and, desc } from "drizzle-orm"
import {
  kidsAccounts,
  kidsTasks,
  kidsGoals,
  kidsBadges,
  kidsSpendings,
  kidsWishes,
  kidsTaskComments,
} from "@shared/schema"
import { calcStreak } from "./helpers"

const router = Router()

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

export default router
