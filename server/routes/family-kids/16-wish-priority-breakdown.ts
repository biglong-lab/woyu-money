/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 16，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"

const router = Router()

/**
 * GET /api/family/wish-priority-breakdown
 * 家庭 wished 狀態願望按 priority（1=低/2=中/3=高）分組
 */
router.get(
  "/api/family/wish-priority-breakdown",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        w.priority,
        COUNT(*)::int AS wish_count,
        COALESCE(SUM(w.estimated_price), 0)::numeric AS total_value,
        COUNT(DISTINCT w.kid_id)::int AS unique_kids
      FROM kids_wishes w
      JOIN kids_accounts ka ON ka.id = w.kid_id
      WHERE w.status = 'wished'
        AND ka.is_active = true
      GROUP BY w.priority
      ORDER BY w.priority DESC
    `)

    const data = (
      rows as unknown as {
        rows: Array<{
          priority: number
          wish_count: number
          total_value: string
          unique_kids: number
        }>
      }
    ).rows

    const PRIORITY_META: Record<number, { label: string; emoji: string; color: string }> = {
      1: { label: "低", emoji: "💭", color: "gray" },
      2: { label: "中", emoji: "✨", color: "blue" },
      3: { label: "高", emoji: "🔥", color: "red" },
    }

    const priorities = [3, 2, 1].map((p) => {
      const r = data.find((d) => d.priority === p)
      const meta = PRIORITY_META[p]
      return {
        priority: p,
        label: meta.label,
        emoji: meta.emoji,
        color: meta.color,
        wishCount: r?.wish_count ?? 0,
        totalValue: Number(r?.total_value ?? 0),
        uniqueKids: r?.unique_kids ?? 0,
      }
    })

    const totalWishes = priorities.reduce((s, p) => s + p.wishCount, 0)
    const totalValue = priorities.reduce((s, p) => s + p.totalValue, 0)
    const highPriorityCount = priorities.find((p) => p.priority === 3)?.wishCount ?? 0

    let message: string
    if (totalWishes === 0) {
      message = "家裡 wished 願望清單為空、小孩可以新增第一個願望 ✨"
    } else if (highPriorityCount > 0) {
      message = `🔥 家裡有 ${highPriorityCount} 個「高優先」願望、共 ${totalWishes} 個 wished、總值 $${Math.round(totalValue)}`
    } else {
      message = `✨ 家裡 ${totalWishes} 個 wished 願望、總值 $${Math.round(totalValue)}`
    }

    res.json({
      priorities,
      totalWishes,
      totalValue: Math.round(totalValue * 100) / 100,
      highPriorityCount,
      message,
    })
  })
)

/**
 * GET /api/family/monthly-goals-trend?months=6
 * 過去 N 個月家庭完成 goal 趨勢
 */
router.get(
  "/api/family/monthly-goals-trend",
  asyncHandler(async (req, res) => {
    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24)

    const rows = await db.execute(sql`
      WITH month_series AS (
        SELECT date_trunc('month', NOW() - (n || ' months')::interval)::date AS month_start
        FROM generate_series(0, ${months - 1}) AS n
      ),
      monthly_goals AS (
        SELECT
          date_trunc('month', g.completed_at)::date AS month_start,
          COUNT(*)::int AS goal_count,
          SUM(g.target_amount)::numeric AS total_saved
        FROM kids_goals g
        JOIN kids_accounts ka ON ka.id = g.kid_id
        WHERE g.status = 'completed'
          AND g.completed_at IS NOT NULL
          AND g.completed_at >= date_trunc('month', NOW() - ((${months - 1}) || ' months')::interval)
          AND ka.is_active = true
        GROUP BY date_trunc('month', g.completed_at)
      )
      SELECT
        TO_CHAR(ms.month_start, 'YYYY-MM') AS month,
        COALESCE(mg.goal_count, 0) AS goal_count,
        COALESCE(mg.total_saved, 0)::numeric AS total_saved
      FROM month_series ms
      LEFT JOIN monthly_goals mg ON mg.month_start = ms.month_start
      ORDER BY ms.month_start
    `)

    const monthsList = (
      rows as unknown as {
        rows: Array<{ month: string; goal_count: number; total_saved: string }>
      }
    ).rows.map((r) => ({
      month: r.month,
      goalCount: r.goal_count,
      totalSaved: Number(r.total_saved),
    }))

    const totalGoals = monthsList.reduce((s, m) => s + m.goalCount, 0)
    const totalSaved = monthsList.reduce((s, m) => s + m.totalSaved, 0)
    const bestMonth =
      totalGoals > 0 ? monthsList.reduce((a, b) => (a.goalCount > b.goalCount ? a : b)) : null
    const activeMonths = monthsList.filter((m) => m.goalCount > 0).length

    let trend: "growing" | "stable" | "declining" | "no_data"
    let message: string
    if (totalGoals === 0) {
      trend = "no_data"
      message = `過去 ${months} 個月家裡還沒有達成的目標`
    } else if (monthsList.length >= 3) {
      const recentHalf = monthsList
        .slice(-Math.ceil(months / 2))
        .reduce((s, m) => s + m.goalCount, 0)
      const earlierHalf = monthsList
        .slice(0, Math.floor(months / 2))
        .reduce((s, m) => s + m.goalCount, 0)
      if (recentHalf > earlierHalf * 1.5) {
        trend = "growing"
        message = `🚀 ${months} 個月達成 ${totalGoals} 個目標、近期加速儲蓄`
      } else if (recentHalf < earlierHalf * 0.6 && earlierHalf > 0) {
        trend = "declining"
        message = `⚠️ ${months} 個月達成 ${totalGoals} 個目標、近期儲蓄放緩`
      } else {
        trend = "stable"
        message = `📊 ${months} 個月達成 ${totalGoals} 個目標 (約每月 ${Math.round(totalGoals / activeMonths)})`
      }
    } else {
      trend = "stable"
      message = `${months} 個月達成 ${totalGoals} 個目標`
    }

    res.json({
      months,
      data: monthsList,
      totalGoals,
      totalSaved: Math.round(totalSaved * 100) / 100,
      activeMonths,
      bestMonth,
      trend,
      message,
    })
  })
)

/**
 * GET /api/family/family-rejection-rate?days=30
 * 家庭整體任務 reject 率（家長標準鬆緊指標）
 */
router.get(
  "/api/family/family-rejection-rate",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)

    const rows = await db.execute(sql`
      SELECT
        t.status,
        COUNT(*)::int AS task_count
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.created_at >= NOW() - (${days} || ' days')::interval
        AND ka.is_active = true
        AND t.status IN ('approved', 'rejected', 'submitted', 'pending')
      GROUP BY t.status
    `)

    const stats = (rows as unknown as { rows: Array<{ status: string; task_count: number }> }).rows

    const approved = stats.find((s) => s.status === "approved")?.task_count ?? 0
    const rejected = stats.find((s) => s.status === "rejected")?.task_count ?? 0
    const submitted = stats.find((s) => s.status === "submitted")?.task_count ?? 0
    const pending = stats.find((s) => s.status === "pending")?.task_count ?? 0

    const decidedTotal = approved + rejected
    const totalCreated = approved + rejected + submitted + pending

    const rejectionRate = decidedTotal > 0 ? Math.round((rejected / decidedTotal) * 100) : 0
    const approvalRate = decidedTotal > 0 ? Math.round((approved / decidedTotal) * 100) : 0

    let standardLevel: "ok" | "too_strict" | "too_loose" | "no_data"
    let message: string
    if (decidedTotal === 0) {
      standardLevel = "no_data"
      message = `過去 ${days} 天還沒有已批准/駁回的任務`
    } else if (rejectionRate >= 30) {
      standardLevel = "too_strict"
      message = `⚠️ ${days} 天家長駁回率 ${rejectionRate}%、可能太嚴格？跟小孩討論標準`
    } else if (rejectionRate <= 2 && decidedTotal >= 10) {
      standardLevel = "too_loose"
      message = `⚠️ ${days} 天駁回率僅 ${rejectionRate}%、可能標準太鬆？偶爾要求重做更好`
    } else {
      standardLevel = "ok"
      message = `✅ ${days} 天家長標準健康：批准 ${approvalRate}% / 駁回 ${rejectionRate}%`
    }

    res.json({
      days,
      approved,
      rejected,
      submitted,
      pending,
      decidedTotal,
      totalCreated,
      approvalRate,
      rejectionRate,
      standardLevel,
      message,
    })
  })
)

/**
 * GET /api/family/comment-interaction?days=30
 * 家長 vs 小孩過去 N 天評論統計（互動文化指標）
 */
router.get(
  "/api/family/comment-interaction",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)

    const rows = await db.execute(sql`
      SELECT
        c.author,
        COUNT(*)::int AS comment_count,
        COUNT(DISTINCT c.task_id)::int AS unique_tasks
      FROM kids_task_comments c
      JOIN kids_tasks t ON t.id = c.task_id
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE c.created_at >= NOW() - (${days} || ' days')::interval
        AND ka.is_active = true
      GROUP BY c.author
    `)

    const stats = (
      rows as unknown as {
        rows: Array<{ author: string; comment_count: number; unique_tasks: number }>
      }
    ).rows

    const parentRow = stats.find((s) => s.author === "parent")
    const kidRow = stats.find((s) => s.author === "kid")

    const parentCount = parentRow?.comment_count ?? 0
    const kidCount = kidRow?.comment_count ?? 0
    const totalCount = parentCount + kidCount
    const parentTasks = parentRow?.unique_tasks ?? 0
    const kidTasks = kidRow?.unique_tasks ?? 0

    const parentPct = totalCount > 0 ? Math.round((parentCount / totalCount) * 100) : 0
    const kidPct = totalCount > 0 ? Math.round((kidCount / totalCount) * 100) : 0

    let interaction: "balanced" | "parent_heavy" | "kid_heavy" | "low" | "none"
    let message: string
    if (totalCount === 0) {
      interaction = "none"
      message = `過去 ${days} 天家裡還沒有任何評論互動、開始討論吧 💬`
    } else if (totalCount < 5) {
      interaction = "low"
      message = `⏳ 互動少（${totalCount} 則）、可以多在任務下面留言交流`
    } else if (parentPct >= 70) {
      interaction = "parent_heavy"
      message = `👨‍👩‍👧 家長主導討論（${parentPct}%）、可以鼓勵小孩多回應`
    } else if (kidPct >= 70) {
      interaction = "kid_heavy"
      message = `🧒 小孩主動分享多（${kidPct}%）、家長也可以多給回饋`
    } else {
      interaction = "balanced"
      message = `💬 雙向互動健康！家長 ${parentPct}% vs 小孩 ${kidPct}%`
    }

    res.json({
      days,
      totalCount,
      parent: { count: parentCount, percentage: parentPct, uniqueTasks: parentTasks },
      kid: { count: kidCount, percentage: kidPct, uniqueTasks: kidTasks },
      interaction,
      message,
    })
  })
)

/**
 * GET /api/family/savings-summary
 * 家庭所有 active 目標整體進度聚合（多少存到了 / 還差多少）
 */
router.get(
  "/api/family/savings-summary",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        COUNT(*)::int AS goal_count,
        COALESCE(SUM(g.target_amount), 0)::numeric AS total_target,
        COALESCE(SUM(g.current_amount), 0)::numeric AS total_current,
        COUNT(DISTINCT g.kid_id)::int AS unique_kids,
        COUNT(*) FILTER (WHERE g.current_amount >= g.target_amount * 0.8)::int AS near_complete,
        COUNT(*) FILTER (WHERE g.current_amount < g.target_amount * 0.3)::int AS starting
      FROM kids_goals g
      JOIN kids_accounts ka ON ka.id = g.kid_id
      WHERE g.status = 'active' AND ka.is_active = true
    `)

    const r = (
      rows as unknown as {
        rows: Array<{
          goal_count: number
          total_target: string
          total_current: string
          unique_kids: number
          near_complete: number
          starting: number
        }>
      }
    ).rows[0]

    const goalCount = r?.goal_count ?? 0
    const totalTarget = Number(r?.total_target ?? 0)
    const totalCurrent = Number(r?.total_current ?? 0)
    const uniqueKids = r?.unique_kids ?? 0
    const nearComplete = r?.near_complete ?? 0
    const starting = r?.starting ?? 0
    const overallProgress = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0
    const amountToGo = Math.max(0, totalTarget - totalCurrent)

    let message: string
    if (goalCount === 0) {
      message = "家裡還沒有進行中的存錢目標、建立第一個吧 🎯"
    } else if (overallProgress >= 80) {
      message = `🎉 家裡 ${goalCount} 個目標整體已存 ${overallProgress}%、即將達成全部！`
    } else if (overallProgress >= 50) {
      message = `🚀 家裡 ${goalCount} 個目標進度 ${overallProgress}%、過半了！`
    } else {
      message = `🌱 家裡 ${goalCount} 個目標起步中（整體 ${overallProgress}%）、繼續加油`
    }

    res.json({
      goalCount,
      uniqueKids,
      totalTarget: Math.round(totalTarget * 100) / 100,
      totalCurrent: Math.round(totalCurrent * 100) / 100,
      amountToGo: Math.round(amountToGo * 100) / 100,
      overallProgress,
      nearComplete,
      starting,
      message,
    })
  })
)

/**
 * GET /api/family/recent-badges?days=30&limit=20
 * 過去 N 天家庭徽章獲得 timeline
 */
router.get(
  "/api/family/recent-badges",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)

    const rows = await db.execute(sql`
      SELECT
        b.id::int AS badge_id,
        b.badge_type,
        b.title,
        b.emoji,
        b.earned_at,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar
      FROM kids_badges b
      JOIN kids_accounts ka ON ka.id = b.kid_id
      WHERE b.earned_at >= NOW() - (${days} || ' days')::interval
        AND ka.is_active = true
      ORDER BY b.earned_at DESC
      LIMIT ${limit}
    `)

    const badges = (
      rows as unknown as {
        rows: Array<{
          badge_id: number
          badge_type: string
          title: string
          emoji: string
          earned_at: string
          kid_id: number
          kid_name: string
          avatar: string
        }>
      }
    ).rows.map((r) => ({
      badgeId: r.badge_id,
      badgeType: r.badge_type,
      title: r.title,
      emoji: r.emoji,
      earnedAt: r.earned_at,
      kidId: r.kid_id,
      kidName: r.kid_name,
      kidAvatar: r.avatar,
    }))

    const uniqueKids = new Set(badges.map((b) => b.kidId)).size
    const uniqueTypes = new Set(badges.map((b) => b.badgeType)).size

    let message: string
    if (badges.length === 0) {
      message = `過去 ${days} 天家裡還沒有人獲得新徽章`
    } else {
      message = `🏅 過去 ${days} 天家裡 ${uniqueKids} 位小孩拿到 ${badges.length} 個徽章 (${uniqueTypes} 種類型)`
    }

    res.json({
      days,
      badges,
      badgeCount: badges.length,
      uniqueKids,
      uniqueTypes,
      message,
    })
  })
)

/**
 * GET /api/family/task-hour-distribution?days=30
 * approve task 的時段分布（24 hour + 4 segment）
 */
router.get(
  "/api/family/task-hour-distribution",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)

    const rows = await db.execute(sql`
      SELECT
        EXTRACT(HOUR FROM t.approved_at)::int AS hour,
        COUNT(*)::int AS task_count
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.status = 'approved'
        AND t.approved_at IS NOT NULL
        AND t.approved_at >= NOW() - (${days} || ' days')::interval
        AND ka.is_active = true
      GROUP BY hour
      ORDER BY hour
    `)

    const flow = (rows as unknown as { rows: Array<{ hour: number; task_count: number }> }).rows

    const hourMap = new Map<number, number>()
    for (const r of flow) hourMap.set(r.hour, r.task_count)

    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      taskCount: hourMap.get(h) ?? 0,
    }))

    const SEGMENTS = [
      { key: "dawn", label: "清晨 0-6", emoji: "🌙", range: [0, 6] },
      { key: "morning", label: "上午 6-12", emoji: "☀️", range: [6, 12] },
      { key: "afternoon", label: "下午 12-18", emoji: "🌤️", range: [12, 18] },
      { key: "evening", label: "晚上 18-24", emoji: "🌆", range: [18, 24] },
    ] as const

    const segments = SEGMENTS.map((s) => ({
      key: s.key,
      label: s.label,
      emoji: s.emoji,
      taskCount: hours
        .filter((h) => h.hour >= s.range[0] && h.hour < s.range[1])
        .reduce((sum, h) => sum + h.taskCount, 0),
    }))

    const totalCount = hours.reduce((s, h) => s + h.taskCount, 0)
    const segmentsWithPct = segments.map((s) => ({
      ...s,
      percentage: totalCount > 0 ? Math.round((s.taskCount / totalCount) * 100) : 0,
    }))

    const peakHour =
      totalCount > 0 ? hours.reduce((a, b) => (a.taskCount > b.taskCount ? a : b)) : null
    const peakSegment =
      totalCount > 0 ? segmentsWithPct.reduce((a, b) => (a.taskCount > b.taskCount ? a : b)) : null

    let message: string
    if (totalCount === 0) {
      message = `過去 ${days} 天家裡還沒有 approved 任務`
    } else if (peakSegment) {
      message = `${peakSegment.emoji} 家裡 ${days} 天最常在「${peakSegment.label}」完成任務 (${peakSegment.percentage}%)`
    } else {
      message = `共 ${totalCount} 個任務分佈`
    }

    res.json({
      days,
      hours,
      segments: segmentsWithPct,
      totalCount,
      peakHour,
      peakSegment,
      message,
    })
  })
)

/**
 * GET /api/family/biggest-wins?days=30&limit=10
 * 過去 N 天最大筆獎勵任務 ranking（慶祝大勝利）
 */
router.get(
  "/api/family/biggest-wins",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50)

    const rows = await db.execute(sql`
      SELECT
        t.id::int AS task_id,
        t.title,
        t.emoji,
        t.reward_amount::numeric AS reward,
        t.difficulty,
        t.category,
        t.approved_at,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.status = 'approved'
        AND t.approved_at >= NOW() - (${days} || ' days')::interval
        AND ka.is_active = true
      ORDER BY t.reward_amount DESC, t.approved_at DESC
      LIMIT ${limit}
    `)

    const wins = (
      rows as unknown as {
        rows: Array<{
          task_id: number
          title: string
          emoji: string
          reward: string
          difficulty: string
          category: string
          approved_at: string
          kid_id: number
          kid_name: string
          avatar: string
        }>
      }
    ).rows.map((r) => ({
      taskId: r.task_id,
      title: r.title,
      emoji: r.emoji,
      reward: Number(r.reward),
      difficulty: r.difficulty,
      category: r.category,
      approvedAt: r.approved_at,
      kidId: r.kid_id,
      kidName: r.kid_name,
      kidAvatar: r.avatar,
    }))

    const topWin = wins.length > 0 ? wins[0] : null
    const grandTotal = wins.reduce((s, w) => s + w.reward, 0)

    let message: string
    if (wins.length === 0) {
      message = `過去 ${days} 天家裡還沒有 approved 任務`
    } else if (topWin) {
      message = `🏆 過去 ${days} 天最大筆是 ${topWin.kidAvatar} ${topWin.kidName} 的「${topWin.title}」($${topWin.reward})`
    } else {
      message = `共 ${wins.length} 筆大獎、累計 $${Math.round(grandTotal)}`
    }

    res.json({
      days,
      wins,
      winCount: wins.length,
      topWin,
      grandTotal: Math.round(grandTotal * 100) / 100,
      message,
    })
  })
)

export default router
