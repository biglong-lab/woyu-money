/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 05，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"

const router = Router()

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

export default router
