/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 19，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"

const router = Router()

/**
 * GET /api/family/kid-favorite-emoji?days=90
 * 每個 active kid 過去 N 天 task emoji 使用最多者
 */
router.get(
  "/api/family/kid-favorite-emoji",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365)

    const rows = await db.execute(sql`
      WITH emoji_counts AS (
        SELECT
          ka.id AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar,
          t.emoji,
          COUNT(*)::int AS cnt
        FROM kids_accounts ka
        JOIN kids_tasks t ON
          t.kid_id = ka.id
          AND t.status = 'approved'
          AND t.completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
          AND t.emoji IS NOT NULL
        WHERE ka.is_active = true
        GROUP BY ka.id, ka.display_name, ka.avatar, t.emoji
      ),
      top_emojis AS (
        SELECT DISTINCT ON (kid_id) kid_id, kid_name, avatar, emoji, cnt
        FROM emoji_counts
        ORDER BY kid_id, cnt DESC, emoji ASC
      ),
      all_kids AS (
        SELECT id::int AS kid_id, display_name AS kid_name, avatar FROM kids_accounts WHERE is_active = true
      )
      SELECT
        ak.kid_id,
        ak.kid_name,
        ak.avatar,
        te.emoji,
        te.cnt
      FROM all_kids ak
      LEFT JOIN top_emojis te ON te.kid_id = ak.kid_id
      ORDER BY ak.kid_id ASC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          emoji: string | null
          cnt: number | null
        }>
      }
    ).rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      favoriteEmoji: r.emoji,
      count: r.cnt ?? 0,
    }))

    const withEmoji = kids.filter((k) => k.favoriteEmoji)
    let message: string
    if (withEmoji.length === 0) {
      message = `過去 ${days} 天還沒任務、無 emoji 偏好`
    } else {
      const personalities = withEmoji.map((k) => `${k.kidName} 愛 ${k.favoriteEmoji}`).join("、")
      message = `🎨 ${personalities}`
    }

    res.json({
      days,
      kids,
      message,
    })
  })
)

/**
 * GET /api/family/kid-peak-hour?days=30
 * 每個 active kid 過去 N 天最活躍小時（0-23）+ 全家 peak hour
 */
router.get(
  "/api/family/kid-peak-hour",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)

    const rows = await db.execute(sql`
      WITH kid_hours AS (
        SELECT
          ka.id AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar,
          EXTRACT(HOUR FROM t.completed_at AT TIME ZONE 'Asia/Taipei')::int AS hour,
          COUNT(*)::int AS count
        FROM kids_accounts ka
        JOIN kids_tasks t ON
          t.kid_id = ka.id
          AND t.status = 'approved'
          AND t.completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
        WHERE ka.is_active = true
        GROUP BY ka.id, ka.display_name, ka.avatar, EXTRACT(HOUR FROM t.completed_at AT TIME ZONE 'Asia/Taipei')
      ),
      kid_peaks AS (
        SELECT DISTINCT ON (kid_id) kid_id, kid_name, avatar, hour, count
        FROM kid_hours
        ORDER BY kid_id, count DESC, hour ASC
      ),
      all_kids AS (
        SELECT id::int AS kid_id, display_name AS kid_name, avatar FROM kids_accounts WHERE is_active = true
      )
      SELECT
        ak.kid_id,
        ak.kid_name,
        ak.avatar,
        kp.hour,
        kp.count
      FROM all_kids ak
      LEFT JOIN kid_peaks kp ON kp.kid_id = ak.kid_id
      ORDER BY ak.kid_id ASC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          hour: number | null
          count: number | null
        }>
      }
    ).rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      peakHour: r.hour,
      peakCount: r.count ?? 0,
      peakLabel: r.hour !== null ? `${String(r.hour).padStart(2, "0")}:00` : null,
    }))

    // 全家 peak hour
    const familyHours = await db.execute(sql`
      SELECT
        EXTRACT(HOUR FROM t.completed_at AT TIME ZONE 'Asia/Taipei')::int AS hour,
        COUNT(*)::int AS count
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.status = 'approved'
        AND ka.is_active = true
        AND t.completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      GROUP BY hour
      ORDER BY count DESC
      LIMIT 1
    `)
    const familyPeakRow = (
      familyHours as unknown as { rows: Array<{ hour: number; count: number }> }
    ).rows[0]
    const familyPeak = familyPeakRow
      ? { hour: familyPeakRow.hour, count: familyPeakRow.count }
      : null

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩"
    } else if (!familyPeak) {
      message = `過去 ${days} 天還沒完成任務`
    } else {
      message = `🕐 全家最常在 ${String(familyPeak.hour).padStart(2, "0")}:00 完成任務（${familyPeak.count} 個）`
    }

    res.json({
      days,
      kids,
      familyPeak,
      message,
    })
  })
)

/**
 * GET /api/family/difficulty-by-kid?days=90
 * 每個 active kid 過去 N 天 easy/medium/hard 任務數
 * challengeLevel: bold(hard>=30%) / balanced / safe / no_data
 */
router.get(
  "/api/family/difficulty-by-kid",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365)

    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COUNT(*) FILTER (WHERE t.difficulty = 'easy')::int AS easy,
        COUNT(*) FILTER (WHERE t.difficulty = 'medium')::int AS medium,
        COUNT(*) FILTER (WHERE t.difficulty = 'hard')::int AS hard,
        COUNT(t.id)::int AS total
      FROM kids_accounts ka
      LEFT JOIN kids_tasks t ON
        t.kid_id = ka.id
        AND t.status = 'approved'
        AND t.completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      WHERE ka.is_active = true
      GROUP BY ka.id, ka.display_name, ka.avatar
      ORDER BY ka.id ASC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          easy: number
          medium: number
          hard: number
          total: number
        }>
      }
    ).rows.map((r) => {
      const hardRatio = r.total > 0 ? Math.round((r.hard / r.total) * 100) : 0
      let challengeLevel: "bold" | "balanced" | "safe" | "no_data"
      if (r.total === 0) challengeLevel = "no_data"
      else if (hardRatio >= 30) challengeLevel = "bold"
      else if (hardRatio >= 10) challengeLevel = "balanced"
      else challengeLevel = "safe"
      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        easy: r.easy,
        medium: r.medium,
        hard: r.hard,
        total: r.total,
        hardRatio,
        challengeLevel,
      }
    })

    const boldCount = kids.filter((k) => k.challengeLevel === "bold").length

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩"
    } else if (boldCount > 0) {
      message = `🚀 ${boldCount} 個小孩勇敢挑戰困難任務（hard>=30%）`
    } else {
      const withTasks = kids.filter((k) => k.total > 0).length
      if (withTasks === 0) {
        message = "過去都沒任務、開始累積"
      } else {
        message = "可以鼓勵小孩試試更困難的任務"
      }
    }

    res.json({
      days,
      kids,
      boldCount,
      message,
    })
  })
)

/**
 * GET /api/family/task-speed-mvp?days=30&limit=5
 * 過去 N 天 submitted→approved 最快的 top N 任務
 */
router.get(
  "/api/family/task-speed-mvp",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 365)
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20)

    const rows = await db.execute(sql`
      SELECT
        t.id::int AS task_id,
        t.title,
        t.emoji,
        t.reward_amount::numeric AS reward,
        EXTRACT(EPOCH FROM (t.approved_at - t.completed_at))::numeric AS seconds,
        t.completed_at,
        ka.display_name AS kid_name,
        ka.avatar
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.status = 'approved'
        AND t.approved_at IS NOT NULL
        AND t.completed_at IS NOT NULL
        AND ka.is_active = true
        AND t.approved_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
        AND EXTRACT(EPOCH FROM (t.approved_at - t.completed_at)) >= 0
      ORDER BY (t.approved_at - t.completed_at) ASC
      LIMIT ${limit}
    `)

    const tasks = (
      rows as unknown as {
        rows: Array<{
          task_id: number
          title: string
          emoji: string
          reward: string | number
          seconds: string | number
          completed_at: string
          kid_name: string
          avatar: string
        }>
      }
    ).rows.map((r) => {
      const secs = Number(r.seconds)
      let display: string
      if (secs < 60) display = `${Math.round(secs)} 秒`
      else if (secs < 3600) display = `${Math.round(secs / 60)} 分鐘`
      else if (secs < 86400) display = `${(secs / 3600).toFixed(1)} 小時`
      else display = `${(secs / 86400).toFixed(1)} 天`
      return {
        taskId: r.task_id,
        title: r.title,
        emoji: r.emoji,
        reward: Number(r.reward),
        seconds: secs,
        durationDisplay: display,
        completedAt: r.completed_at,
        kidName: r.kid_name,
        kidAvatar: r.avatar,
      }
    })

    let message: string
    if (tasks.length === 0) {
      message = `過去 ${days} 天還沒任務批准、速度榜空了`
    } else {
      const fastest = tasks[0]
      message = `⚡ 最快：${fastest.emoji} ${fastest.title}（${fastest.kidName} ${fastest.durationDisplay}）`
    }

    res.json({
      days,
      tasks,
      message,
    })
  })
)

/**
 * GET /api/family/kid-daily-avg-tasks?days=30
 * 每個 active kid 過去 N 天平均每天完成 task 數
 * pace: power(>=2/day) / steady(>=0.5) / occasional(>=0.1) / idle
 */
router.get(
  "/api/family/kid-daily-avg-tasks",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)

    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COUNT(t.id)::int AS task_count
      FROM kids_accounts ka
      LEFT JOIN kids_tasks t ON
        t.kid_id = ka.id
        AND t.status = 'approved'
        AND t.completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      WHERE ka.is_active = true
      GROUP BY ka.id, ka.display_name, ka.avatar
      ORDER BY task_count DESC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{ kid_id: number; kid_name: string; avatar: string; task_count: number }>
      }
    ).rows.map((r) => {
      const avgPerDay = Math.round((r.task_count / days) * 10) / 10
      let pace: "power" | "steady" | "occasional" | "idle"
      if (avgPerDay >= 2) pace = "power"
      else if (avgPerDay >= 0.5) pace = "steady"
      else if (avgPerDay >= 0.1) pace = "occasional"
      else pace = "idle"
      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        taskCount: r.task_count,
        avgPerDay,
        pace,
      }
    })

    const topAchiever = kids.length > 0 && kids[0].taskCount > 0 ? kids[0] : null
    const familyAvg =
      kids.length > 0
        ? Math.round((kids.reduce((s, k) => s + k.taskCount, 0) / kids.length / days) * 10) / 10
        : 0

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩"
    } else if (!topAchiever) {
      message = `過去 ${days} 天還沒任務、開始累積吧 🌱`
    } else {
      message = `🏃 最積極：${topAchiever.avatar} ${topAchiever.kidName}（每天 ${topAchiever.avgPerDay} 個）`
    }

    res.json({
      days,
      kids,
      topAchiever: topAchiever
        ? {
            kidName: topAchiever.kidName,
            avatar: topAchiever.avatar,
            avgPerDay: topAchiever.avgPerDay,
          }
        : null,
      familyAvgPerDay: familyAvg,
      message,
    })
  })
)

/**
 * GET /api/family/task-category-by-kid?days=90
 * 每個 active kid 過去 N 天 5 category 任務數 + topCategory
 */
router.get(
  "/api/family/task-category-by-kid",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365)

    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COUNT(*) FILTER (WHERE t.category = 'housework')::int AS housework,
        COUNT(*) FILTER (WHERE t.category = 'study')::int AS study,
        COUNT(*) FILTER (WHERE t.category = 'self_care')::int AS self_care,
        COUNT(*) FILTER (WHERE t.category = 'kindness')::int AS kindness,
        COUNT(*) FILTER (WHERE t.category = 'other')::int AS other,
        COUNT(t.id)::int AS total
      FROM kids_accounts ka
      LEFT JOIN kids_tasks t ON
        t.kid_id = ka.id
        AND t.status = 'approved'
        AND t.completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      WHERE ka.is_active = true
      GROUP BY ka.id, ka.display_name, ka.avatar
      ORDER BY ka.id ASC
    `)

    const CAT_LABEL: Record<string, string> = {
      housework: "🧹 家事",
      study: "📚 學習",
      self_care: "🧴 自理",
      kindness: "💝 善行",
      other: "📋 其他",
    }

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          housework: number
          study: number
          self_care: number
          kindness: number
          other: number
          total: number
        }>
      }
    ).rows.map((r) => {
      const categories = {
        housework: r.housework,
        study: r.study,
        self_care: r.self_care,
        kindness: r.kindness,
        other: r.other,
      }
      const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1])
      const topCategory = sorted[0][1] > 0 ? sorted[0][0] : null
      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        categories,
        topCategory,
        topCategoryLabel: topCategory ? CAT_LABEL[topCategory] : null,
        total: r.total,
      }
    })

    let message: string
    const withTasks = kids.filter((k) => k.total > 0)
    if (withTasks.length === 0) {
      message = `過去 ${days} 天還沒任務、無偏好可分析`
    } else {
      const personalities = withTasks
        .filter((k) => k.topCategory)
        .map((k) => `${k.kidName}愛${k.topCategoryLabel?.slice(0, 4)}`)
        .join("、")
      message = `🎨 個性分析：${personalities}`
    }

    res.json({
      days,
      kids,
      message,
    })
  })
)

/**
 * GET /api/family/goal-urgency-rank?limit=10
 * 有 deadline 的 active goals 按距離截止日 ASC 排序
 * urgency: overdue / critical(<7d) / warning(<30d) / safe
 */
router.get(
  "/api/family/goal-urgency-rank",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50)

    const rows = await db.execute(sql`
      SELECT
        g.id::int AS goal_id,
        g.name AS goal_name,
        g.emoji AS goal_emoji,
        g.target_amount::numeric AS target,
        g.current_amount::numeric AS current,
        g.deadline,
        (g.deadline - CURRENT_DATE)::int AS days_until,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar
      FROM kids_goals g
      JOIN kids_accounts ka ON ka.id = g.kid_id
      WHERE g.status = 'active'
        AND g.deadline IS NOT NULL
        AND ka.is_active = true
      ORDER BY (g.deadline - CURRENT_DATE) ASC
      LIMIT ${limit}
    `)

    const goals = (
      rows as unknown as {
        rows: Array<{
          goal_id: number
          goal_name: string
          goal_emoji: string
          target: string | number
          current: string | number
          deadline: string
          days_until: number
          kid_id: number
          kid_name: string
          avatar: string
        }>
      }
    ).rows.map((r) => {
      const target = Number(r.target)
      const current = Number(r.current)
      const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
      const daysUntil = r.days_until
      let urgency: "overdue" | "critical" | "warning" | "safe"
      if (daysUntil < 0) urgency = "overdue"
      else if (daysUntil < 7) urgency = "critical"
      else if (daysUntil < 30) urgency = "warning"
      else urgency = "safe"
      return {
        goalId: r.goal_id,
        goalName: r.goal_name,
        goalEmoji: r.goal_emoji,
        target,
        current,
        progress,
        deadline: r.deadline,
        daysUntil,
        kidName: r.kid_name,
        kidAvatar: r.avatar,
        urgency,
      }
    })

    const overdueCount = goals.filter((g) => g.urgency === "overdue").length
    const criticalCount = goals.filter((g) => g.urgency === "critical").length

    let message: string
    if (goals.length === 0) {
      message = "沒有設 deadline 的進行中目標"
    } else if (overdueCount > 0) {
      message = `🚨 ${overdueCount} 個目標已過期、立即關注`
    } else if (criticalCount > 0) {
      message = `⏰ ${criticalCount} 個目標即將到期（<7 天）`
    } else {
      message = `✅ 進行中 deadline 目標都還有時間`
    }

    res.json({
      goals,
      total: goals.length,
      overdueCount,
      criticalCount,
      message,
    })
  })
)

export default router
