/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 18，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"

const router = Router()

/**
 * GET /api/family/first-task-timeline
 * 每 active kid 加入後到第一個 approved task 的天數
 * 看小孩接受系統的速度
 */
router.get(
  "/api/family/first-task-timeline",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        ka.created_at,
        EXTRACT(DAY FROM (NOW() - ka.created_at))::int AS account_age_days,
        (SELECT MIN(completed_at) FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
        ) AS first_task_at
      FROM kids_accounts ka
      WHERE ka.is_active = true
      ORDER BY ka.id ASC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          created_at: string
          account_age_days: number
          first_task_at: string | null
        }>
      }
    ).rows.map((r) => {
      let daysToFirst: number | null = null
      let speed: "instant" | "fast" | "normal" | "slow" | "never"
      if (r.first_task_at) {
        const created = new Date(r.created_at).getTime()
        const first = new Date(r.first_task_at).getTime()
        daysToFirst = Math.max(0, Math.floor((first - created) / 86400000))
        if (daysToFirst < 1) speed = "instant"
        else if (daysToFirst < 7) speed = "fast"
        else if (daysToFirst < 30) speed = "normal"
        else speed = "slow"
      } else {
        speed = "never"
      }
      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        accountAgeDays: r.account_age_days,
        firstTaskAt: r.first_task_at,
        daysToFirstTask: daysToFirst,
        speed,
      }
    })

    const withFirstTask = kids.filter((k) => k.daysToFirstTask !== null)
    const fastest =
      withFirstTask.length > 0
        ? [...withFirstTask].sort((a, b) => (a.daysToFirstTask ?? 0) - (b.daysToFirstTask ?? 0))[0]
        : null
    const neverCount = kids.filter((k) => k.speed === "never").length

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩"
    } else if (!fastest) {
      message = `${kids.length} 個小孩、還沒人完成第一個任務`
    } else {
      message = `🌱 最快上手：${fastest.avatar} ${fastest.kidName}（${fastest.daysToFirstTask} 天內就完成第一個任務）`
    }

    res.json({
      kids,
      fastestStart: fastest
        ? {
            kidName: fastest.kidName,
            avatar: fastest.avatar,
            daysToFirstTask: fastest.daysToFirstTask,
          }
        : null,
      neverCount,
      message,
    })
  })
)

/**
 * GET /api/family/kid-weekend-vs-weekday?days=60
 * 每個 active kid 過去 N 天週末 vs 平日 task 完成數對比
 * type: weekend_warrior(週末日均>1.5x平日) / weekday_focused(<0.67x) / balanced
 */
router.get(
  "/api/family/kid-weekend-vs-weekday",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 60, 14), 180)

    const rows = await db.execute(sql`
      WITH days_set AS (
        SELECT generate_series(
          CURRENT_DATE - (${days - 1}::int * INTERVAL '1 day'),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS d, EXTRACT(DOW FROM
          generate_series(CURRENT_DATE - (${days - 1}::int * INTERVAL '1 day'),
            CURRENT_DATE, INTERVAL '1 day')::date)::int AS dow
      )
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COUNT(*) FILTER (WHERE EXTRACT(DOW FROM t.completed_at) IN (0, 6))::int AS weekend_tasks,
        COUNT(*) FILTER (WHERE EXTRACT(DOW FROM t.completed_at) NOT IN (0, 6))::int AS weekday_tasks
      FROM kids_accounts ka
      LEFT JOIN kids_tasks t ON
        t.kid_id = ka.id AND t.status = 'approved'
        AND t.completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      WHERE ka.is_active = true
      GROUP BY ka.id, ka.display_name, ka.avatar
      ORDER BY ka.id ASC
    `)

    // 計算 weekend / weekday days 數
    const weekendDays = Math.floor(days / 7) * 2 + Math.min(days % 7, 2)
    const weekdayDays = days - weekendDays

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          weekend_tasks: number
          weekday_tasks: number
        }>
      }
    ).rows.map((r) => {
      const weekendAvg = weekendDays > 0 ? r.weekend_tasks / weekendDays : 0
      const weekdayAvg = weekdayDays > 0 ? r.weekday_tasks / weekdayDays : 0
      const total = r.weekend_tasks + r.weekday_tasks
      let type: "weekend_warrior" | "weekday_focused" | "balanced" | "no_data"
      if (total === 0) type = "no_data"
      else if (weekendAvg > weekdayAvg * 1.5) type = "weekend_warrior"
      else if (weekdayAvg > weekendAvg * 1.5 && weekendAvg < weekdayAvg) type = "weekday_focused"
      else type = "balanced"
      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        weekendTasks: r.weekend_tasks,
        weekdayTasks: r.weekday_tasks,
        weekendAvg: Math.round(weekendAvg * 10) / 10,
        weekdayAvg: Math.round(weekdayAvg * 10) / 10,
        type,
      }
    })

    const counts = {
      weekend_warrior: kids.filter((k) => k.type === "weekend_warrior").length,
      weekday_focused: kids.filter((k) => k.type === "weekday_focused").length,
      balanced: kids.filter((k) => k.type === "balanced").length,
    }

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩"
    } else if (counts.weekend_warrior > 0) {
      message = `🏖️ ${counts.weekend_warrior} 個小孩是週末戰士`
    } else if (counts.weekday_focused > 0) {
      message = `💼 ${counts.weekday_focused} 個小孩平日專注`
    } else {
      message = "全家做事都很均衡"
    }

    res.json({
      days,
      kids,
      typeCounts: counts,
      message,
    })
  })
)

/**
 * GET /api/family/all-goals-eta
 * 全家 active goals 批量 ETA 預估（基於過去 30 天 save 速度）
 * sort by etaDays ASC（最快達成的在前）
 */
router.get(
  "/api/family/all-goals-eta",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      WITH kid_velocity AS (
        SELECT
          ka.id AS kid_id,
          ka.save_ratio,
          COALESCE((
            SELECT SUM(reward_amount::numeric)::numeric / 30.0 * (ka.save_ratio / 100.0)
            FROM kids_tasks
            WHERE kid_id = ka.id AND status = 'approved'
              AND completed_at >= CURRENT_DATE - INTERVAL '30 days'
          ), 0) AS daily_save_velocity
        FROM kids_accounts ka
        WHERE ka.is_active = true
      )
      SELECT
        g.id::int AS goal_id,
        g.name AS goal_name,
        g.emoji AS goal_emoji,
        g.target_amount::numeric AS target,
        g.current_amount::numeric AS current,
        g.deadline,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        kv.daily_save_velocity::numeric AS velocity
      FROM kids_goals g
      JOIN kids_accounts ka ON ka.id = g.kid_id
      LEFT JOIN kid_velocity kv ON kv.kid_id = g.kid_id
      WHERE g.status = 'active' AND ka.is_active = true
      ORDER BY ka.id ASC, g.created_at ASC
    `)

    const goals = (
      rows as unknown as {
        rows: Array<{
          goal_id: number
          goal_name: string
          goal_emoji: string
          target: string | number
          current: string | number
          deadline: string | null
          kid_id: number
          kid_name: string
          avatar: string
          velocity: string | number
        }>
      }
    ).rows.map((r) => {
      const target = Number(r.target)
      const current = Number(r.current)
      const velocity = Number(r.velocity)
      const remaining = Math.max(0, target - current)
      let etaDays: number | null = null
      let etaDate: string | null = null
      let predictable = false
      if (current >= target) {
        etaDays = 0
        etaDate = new Date().toISOString().slice(0, 10)
        predictable = true
      } else if (velocity > 0) {
        etaDays = Math.ceil(remaining / velocity)
        const eta = new Date(Date.now() + etaDays * 86400000)
        etaDate = eta.toISOString().slice(0, 10)
        predictable = true
      }
      return {
        goalId: r.goal_id,
        goalName: r.goal_name,
        goalEmoji: r.goal_emoji,
        target,
        current,
        remaining,
        deadline: r.deadline,
        kidName: r.kid_name,
        kidAvatar: r.avatar,
        velocity: Math.round(velocity * 10) / 10,
        etaDays,
        etaDate,
        predictable,
      }
    })

    const sorted = [...goals].sort((a, b) => {
      if (a.etaDays === null && b.etaDays === null) return 0
      if (a.etaDays === null) return 1
      if (b.etaDays === null) return -1
      return a.etaDays - b.etaDays
    })

    const predictableCount = goals.filter((g) => g.predictable).length

    let message: string
    if (goals.length === 0) {
      message = "沒有進行中目標"
    } else if (predictableCount === 0) {
      message = `${goals.length} 個目標、但小孩還沒存錢、無法預估完成時間`
    } else {
      const fastest = sorted[0]
      message = `⏱️ 最快達成：${fastest.goalEmoji} ${fastest.goalName}（${fastest.etaDays} 天）`
    }

    res.json({
      goals: sorted,
      predictableCount,
      message,
    })
  })
)

/**
 * GET /api/family/today-leaderboard
 * 今日每 active kid task / reward / checkin 排名
 */
router.get(
  "/api/family/today-leaderboard",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        (SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved' AND DATE(completed_at) = CURRENT_DATE
        ) AS today_tasks,
        COALESCE((SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved' AND DATE(completed_at) = CURRENT_DATE
        ), 0) AS today_reward,
        (SELECT COUNT(*)::int FROM kids_checkins
          WHERE kid_id = ka.id AND checkin_date = CURRENT_DATE
        ) AS today_checkin,
        COALESCE((SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ka.id AND spend_date = CURRENT_DATE
        ), 0) AS today_spent
      FROM kids_accounts ka
      WHERE ka.is_active = true
      ORDER BY today_tasks DESC, today_reward DESC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          today_tasks: number
          today_reward: string | number
          today_checkin: number
          today_spent: string | number
        }>
      }
    ).rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      tasks: r.today_tasks,
      reward: Math.round(Number(r.today_reward)),
      checkin: r.today_checkin,
      spent: Math.round(Number(r.today_spent)),
    }))

    const topToday = kids.length > 0 && kids[0].tasks > 0 ? kids[0] : null
    const totalTasks = kids.reduce((s, k) => s + k.tasks, 0)
    const totalReward = kids.reduce((s, k) => s + k.reward, 0)

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩"
    } else if (!topToday) {
      message = "🌅 今天家裡還沒任務、誰先衝？"
    } else {
      message = `🌟 今日冠軍：${topToday.avatar} ${topToday.kidName}（${topToday.tasks} 個任務）`
    }

    res.json({
      kids,
      topToday: topToday
        ? { kidName: topToday.kidName, avatar: topToday.avatar, tasks: topToday.tasks }
        : null,
      totalTasks,
      totalReward,
      message,
    })
  })
)

/**
 * GET /api/family/today-vs-yesterday
 * 今日 vs 昨日 5 metric 對比：tasks / reward / spent / given / checkins
 */
router.get(
  "/api/family/today-vs-yesterday",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM kids_tasks
          WHERE status = 'approved' AND DATE(completed_at) = CURRENT_DATE) AS today_tasks,
        (SELECT COUNT(*)::int FROM kids_tasks
          WHERE status = 'approved' AND DATE(completed_at) = CURRENT_DATE - INTERVAL '1 day') AS yesterday_tasks,
        COALESCE((SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE status = 'approved' AND DATE(completed_at) = CURRENT_DATE), 0) AS today_reward,
        COALESCE((SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE status = 'approved' AND DATE(completed_at) = CURRENT_DATE - INTERVAL '1 day'), 0) AS yesterday_reward,
        COALESCE((SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE jar = 'spend' AND spend_date = CURRENT_DATE), 0) AS today_spent,
        COALESCE((SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE jar = 'spend' AND spend_date = CURRENT_DATE - INTERVAL '1 day'), 0) AS yesterday_spent,
        COALESCE((SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE jar = 'give' AND spend_date = CURRENT_DATE), 0) AS today_given,
        COALESCE((SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE jar = 'give' AND spend_date = CURRENT_DATE - INTERVAL '1 day'), 0) AS yesterday_given,
        (SELECT COUNT(*)::int FROM kids_checkins WHERE checkin_date = CURRENT_DATE) AS today_checkins,
        (SELECT COUNT(*)::int FROM kids_checkins WHERE checkin_date = CURRENT_DATE - INTERVAL '1 day') AS yesterday_checkins
    `)

    const row = (
      rows as unknown as {
        rows: Array<{
          today_tasks: number
          yesterday_tasks: number
          today_reward: string | number
          yesterday_reward: string | number
          today_spent: string | number
          yesterday_spent: string | number
          today_given: string | number
          yesterday_given: string | number
          today_checkins: number
          yesterday_checkins: number
        }>
      }
    ).rows[0]

    const toNum = (v: string | number): number => Number(v ?? 0)
    const today = {
      tasks: row?.today_tasks ?? 0,
      reward: toNum(row?.today_reward ?? 0),
      spent: toNum(row?.today_spent ?? 0),
      given: toNum(row?.today_given ?? 0),
      checkins: row?.today_checkins ?? 0,
    }
    const yesterday = {
      tasks: row?.yesterday_tasks ?? 0,
      reward: toNum(row?.yesterday_reward ?? 0),
      spent: toNum(row?.yesterday_spent ?? 0),
      given: toNum(row?.yesterday_given ?? 0),
      checkins: row?.yesterday_checkins ?? 0,
    }

    const deltas: Record<string, { abs: number; arrow: "↑" | "↓" | "→" }> = {}
    for (const key of Object.keys(today) as Array<keyof typeof today>) {
      const t = today[key]
      const y = yesterday[key]
      const abs = Math.round((t - y) * 10) / 10
      deltas[key as string] = {
        abs,
        arrow: abs > 0 ? "↑" : abs < 0 ? "↓" : "→",
      }
    }

    let message: string
    if (today.tasks === 0 && yesterday.tasks === 0) {
      message = "兩天都沒任務、加油吧 🌱"
    } else if (today.tasks > yesterday.tasks) {
      message = `🚀 今天比昨天多做 ${today.tasks - yesterday.tasks} 個任務、進步中！`
    } else if (today.tasks < yesterday.tasks) {
      message = `📋 今天比昨天少 ${yesterday.tasks - today.tasks} 個任務、加油追上`
    } else {
      message = `📊 跟昨天一樣完成 ${today.tasks} 個任務`
    }

    res.json({
      today,
      yesterday,
      deltas,
      message,
    })
  })
)

/**
 * GET /api/family/kid-avg-reward?days=90
 * 每個 active kid 過去 N 天 task reward 平均/最低/最高
 */
router.get(
  "/api/family/kid-avg-reward",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365)

    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COUNT(t.id)::int AS task_count,
        COALESCE(AVG(t.reward_amount::numeric), 0)::numeric AS avg_reward,
        COALESCE(MIN(t.reward_amount::numeric), 0)::numeric AS min_reward,
        COALESCE(MAX(t.reward_amount::numeric), 0)::numeric AS max_reward,
        COALESCE(SUM(t.reward_amount::numeric), 0)::numeric AS total_reward
      FROM kids_accounts ka
      LEFT JOIN kids_tasks t ON
        t.kid_id = ka.id
        AND t.status = 'approved'
        AND t.completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      WHERE ka.is_active = true
      GROUP BY ka.id, ka.display_name, ka.avatar
      ORDER BY avg_reward DESC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          task_count: number
          avg_reward: string | number
          min_reward: string | number
          max_reward: string | number
          total_reward: string | number
        }>
      }
    ).rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      taskCount: r.task_count,
      avgReward: Math.round(Number(r.avg_reward)),
      minReward: Math.round(Number(r.min_reward)),
      maxReward: Math.round(Number(r.max_reward)),
      totalReward: Math.round(Number(r.total_reward)),
    }))

    const withTasks = kids.filter((k) => k.taskCount > 0)
    const topByAvg = withTasks[0] ?? null

    let message: string
    if (withTasks.length === 0) {
      message = `過去 ${days} 天還沒任務`
    } else if (topByAvg) {
      message = `💎 最高平均：${topByAvg.avatar} ${topByAvg.kidName}（平均 $${topByAvg.avgReward}）`
    } else {
      message = ""
    }

    res.json({
      days,
      kids,
      topByAvg: topByAvg
        ? { kidName: topByAvg.kidName, avatar: topByAvg.avatar, avgReward: topByAvg.avgReward }
        : null,
      message,
    })
  })
)

/**
 * GET /api/family/kid-learning-curve
 * 每 active kid 第一個月 vs 最近 30 天 task 對比
 * improvement: rising / steady / declining / new / no_data
 */
router.get(
  "/api/family/kid-learning-curve",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        ka.created_at,
        EXTRACT(DAY FROM (NOW() - ka.created_at))::int AS account_age_days,
        (SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= ka.created_at
            AND completed_at < ka.created_at + INTERVAL '30 days'
        ) AS first_month,
        (SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= CURRENT_DATE - INTERVAL '30 days'
        ) AS recent_month
      FROM kids_accounts ka
      WHERE ka.is_active = true
      ORDER BY ka.id ASC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          created_at: string
          account_age_days: number
          first_month: number
          recent_month: number
        }>
      }
    ).rows.map((r) => {
      const age = r.account_age_days
      const first = r.first_month
      const recent = r.recent_month
      let improvement: "rising" | "steady" | "declining" | "new" | "no_data"
      let diff = recent - first
      if (age < 60) {
        improvement = "new"
        diff = 0
      } else if (first === 0 && recent === 0) {
        improvement = "no_data"
      } else if (recent > first * 1.3) {
        improvement = "rising"
      } else if (recent < first * 0.7) {
        improvement = "declining"
      } else {
        improvement = "steady"
      }
      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        accountAgeDays: age,
        firstMonthTasks: first,
        recentMonthTasks: recent,
        diff,
        improvement,
      }
    })

    const risingKids = kids.filter((k) => k.improvement === "rising").length
    const newKids = kids.filter((k) => k.improvement === "new").length

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩"
    } else if (newKids === kids.length) {
      message = `🌱 全家還在 60 天內、學習曲線尚未成形`
    } else if (risingKids > 0) {
      message = `📈 ${risingKids} 個小孩越做越多、學習曲線上升`
    } else {
      message = "穩定發揮中"
    }

    res.json({
      kids,
      risingCount: risingKids,
      newCount: newKids,
      message,
    })
  })
)

export default router
