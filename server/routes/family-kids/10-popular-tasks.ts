/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 10，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql, eq } from "drizzle-orm"
import { kidsBadges } from "@shared/schema"
import { calcStreak } from "./helpers"
import { localDateTPE } from "@shared/date-utils"

const router = Router()

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

    const today = localDateTPE()
    const yesterday = localDateTPE(-1)

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

export default router
