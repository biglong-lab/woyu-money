/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 22，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"

const router = Router()

/**
 * GET /api/family/monthly-improvement-rank
 * 家庭月度進步榜：每個 active kid 本月 vs 上月 task 完成數
 * improvement = (this - last) / max(last, 1) 比例
 */
router.get(
  "/api/family/monthly-improvement-rank",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        (SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ka.id
            AND status = 'approved'
            AND completed_at >= DATE_TRUNC('month', CURRENT_DATE)
            AND completed_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        ) AS this_month,
        (SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ka.id
            AND status = 'approved'
            AND completed_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
            AND completed_at < DATE_TRUNC('month', CURRENT_DATE)
        ) AS last_month
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
          this_month: number
          last_month: number
        }>
      }
    ).rows.map((r) => {
      const thisMonth = r.this_month
      const lastMonth = r.last_month
      const diff = thisMonth - lastMonth
      const improvement =
        lastMonth > 0 ? Math.round((diff / lastMonth) * 100) : thisMonth > 0 ? 100 : 0
      let status: "improving" | "steady" | "declining" | "stagnated"
      if (thisMonth === 0 && lastMonth === 0) status = "stagnated"
      else if (improvement >= 20) status = "improving"
      else if (improvement <= -20) status = "declining"
      else status = "steady"
      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        thisMonth,
        lastMonth,
        diff,
        improvement,
        status,
      }
    })

    const sorted = [...kids].sort((a, b) => b.improvement - a.improvement)
    const topImprover = sorted.length > 0 && sorted[0].improvement > 0 ? sorted[0] : null
    const stagnatedKids = kids.filter((k) => k.status === "stagnated")

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩、加入第一個吧"
    } else if (topImprover) {
      message = `🚀 ${topImprover.avatar} ${topImprover.kidName} 本月進步 ${topImprover.improvement}%（${topImprover.lastMonth} → ${topImprover.thisMonth}）`
    } else if (stagnatedKids.length === kids.length) {
      message = "全家本月還沒任務完成、該動起來了！"
    } else {
      message = "全家本月進度持平、繼續保持"
    }

    res.json({
      kids: sorted,
      topImprover: topImprover
        ? {
            kidName: topImprover.kidName,
            avatar: topImprover.avatar,
            improvement: topImprover.improvement,
          }
        : null,
      stagnatedCount: stagnatedKids.length,
      message,
    })
  })
)

/**
 * GET /api/family/deadline-hit-rate?days=90
 * 任務 deadline 準時達成率：approved_at <= due_date 算準時
 * level: excellent(>=80%) / good(>=60%) / fair(>=30%) / poor / no_data
 */
router.get(
  "/api/family/deadline-hit-rate",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365)

    const rows = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE DATE(approved_at) <= due_date)::int AS on_time,
        COUNT(*) FILTER (WHERE DATE(approved_at) > due_date)::int AS late
      FROM kids_tasks
      WHERE status = 'approved'
        AND due_date IS NOT NULL
        AND approved_at IS NOT NULL
        AND approved_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
    `)
    const row = (
      rows as unknown as { rows: Array<{ total: number; on_time: number; late: number }> }
    ).rows[0]

    const total = row?.total ?? 0
    const onTime = row?.on_time ?? 0
    const late = row?.late ?? 0
    const hitRate = total > 0 ? Math.round((onTime / total) * 100) : 0

    let level: "excellent" | "good" | "fair" | "poor" | "no_data"
    let message: string
    if (total === 0) {
      level = "no_data"
      message = `過去 ${days} 天沒有設定 deadline 的任務、可以試試在派任務時設定 due date`
    } else if (hitRate >= 80) {
      level = "excellent"
      message = `🏆 ${hitRate}% 任務準時完成、家裡守時功夫一流！`
    } else if (hitRate >= 60) {
      level = "good"
      message = `💪 ${hitRate}% 準時、不錯（${late} 個遲了）`
    } else if (hitRate >= 30) {
      level = "fair"
      message = `⏰ ${hitRate}% 準時、${late} 個過期才做、提醒小孩注意時間`
    } else {
      level = "poor"
      message = `🐢 ${hitRate}% 準時、deadline 沒在管、需要時間管理練習`
    }

    res.json({
      days,
      stats: { total, onTime, late },
      hitRate,
      level,
      message,
    })
  })
)

/**
 * GET /api/family/today-tip
 * 家庭今日智能提示（根據多 source 動態給家長 actionable advice）
 * tipType: pending_overflow / no_recent_activity / save_too_low / goal_stalled / encourage_checkin / positive
 */
router.get(
  "/api/family/today-tip",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM kids_tasks WHERE status = 'submitted') AS pending_count,
        (SELECT COUNT(*)::int FROM kids_tasks
          WHERE status = 'approved' AND DATE(completed_at) >= CURRENT_DATE - INTERVAL '3 days'
        ) AS recent_tasks,
        (SELECT COUNT(*)::int FROM kids_checkins WHERE checkin_date = CURRENT_DATE) AS today_checkins,
        (SELECT COUNT(*)::int FROM kids_accounts WHERE is_active = true) AS active_kids,
        (SELECT COUNT(*)::int FROM kids_goals WHERE status = 'active') AS active_goals,
        (SELECT COUNT(*)::int FROM kids_tasks
          WHERE status = 'approved' AND DATE(completed_at) = CURRENT_DATE
        ) AS today_tasks,
        COALESCE((SELECT SUM(save_balance::numeric)::numeric FROM kids_jars j
          JOIN kids_accounts ka ON ka.id = j.kid_id WHERE ka.is_active = true), 0) AS total_save,
        COALESCE((SELECT SUM(spend_balance::numeric)::numeric FROM kids_jars j
          JOIN kids_accounts ka ON ka.id = j.kid_id WHERE ka.is_active = true), 0) AS total_spend,
        COALESCE((SELECT SUM(give_balance::numeric)::numeric FROM kids_jars j
          JOIN kids_accounts ka ON ka.id = j.kid_id WHERE ka.is_active = true), 0) AS total_give
    `)

    const row = (
      rows as unknown as {
        rows: Array<{
          pending_count: number
          recent_tasks: number
          today_checkins: number
          active_kids: number
          active_goals: number
          today_tasks: number
          total_save: string | number
          total_spend: string | number
          total_give: string | number
        }>
      }
    ).rows[0]

    const pending = row?.pending_count ?? 0
    const recentTasks = row?.recent_tasks ?? 0
    const todayCheckins = row?.today_checkins ?? 0
    const activeKids = row?.active_kids ?? 0
    const activeGoals = row?.active_goals ?? 0
    const todayTasks = row?.today_tasks ?? 0
    const save = Number(row?.total_save ?? 0)
    const spend = Number(row?.total_spend ?? 0)
    const give = Number(row?.total_give ?? 0)
    const totalJar = save + spend + give

    // 按優先序判斷
    let tipType:
      | "pending_overflow"
      | "no_recent_activity"
      | "save_too_low"
      | "goal_stalled"
      | "encourage_checkin"
      | "positive"
      | "no_data"
    let message: string
    let action: string | null

    if (activeKids === 0) {
      tipType = "no_data"
      message = "還沒加入小孩、先建立第一個帳戶"
      action = "/family/kids"
    } else if (pending >= 5) {
      tipType = "pending_overflow"
      message = `📋 有 ${pending} 個任務等批准、家長可以一鍵批量批准節省時間`
      action = "/family"
    } else if (recentTasks === 0) {
      tipType = "no_recent_activity"
      message = `💤 過去 3 天家裡都沒任務通過、可以派幾個簡單任務啟動`
      action = "/family"
    } else if (totalJar > 0 && save / totalJar < 0.15) {
      tipType = "save_too_low"
      message = `💸 儲蓄罐占比低於 15%、可以調整三罐分配多存一點`
      action = "/family/kids"
    } else if (activeGoals > 0 && todayTasks === 0) {
      tipType = "goal_stalled"
      message = `🎯 有 ${activeGoals} 個進行中目標但今天沒任務、鼓勵小孩做任務存錢買目標`
      action = "/family"
    } else if (todayCheckins < activeKids) {
      const needCheckin = activeKids - todayCheckins
      tipType = "encourage_checkin"
      message = `📅 今天還有 ${needCheckin} 個小孩沒打卡、提醒一下吧`
      action = "/family"
    } else {
      tipType = "positive"
      message = `🌟 家裡運轉順暢、家長 ${activeKids} 個小孩都活躍中、繼續保持！`
      action = null
    }

    res.json({
      tipType,
      message,
      action,
      stats: { pending, recentTasks, todayCheckins, activeKids, activeGoals, todayTasks },
    })
  })
)

/**
 * GET /api/family/peak-moment?days=30
 * 過去 N 天 top 3 活動最高的日子（task + checkin + spending count 加總）
 */
router.get(
  "/api/family/peak-moment",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)

    const rows = await db.execute(sql`
      WITH days_set AS (
        SELECT generate_series(
          CURRENT_DATE - (${days - 1}::int * INTERVAL '1 day'),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS d
      )
      SELECT
        TO_CHAR(d.d, 'YYYY-MM-DD') AS date,
        TO_CHAR(d.d, 'Dy') AS weekday,
        (SELECT COUNT(*)::int FROM kids_tasks
          WHERE status = 'approved' AND DATE(completed_at) = d.d) AS tasks,
        (SELECT COUNT(*)::int FROM kids_checkins WHERE checkin_date = d.d) AS checkins,
        (SELECT COUNT(*)::int FROM kids_spendings WHERE spend_date = d.d) AS spendings
      FROM days_set d
      ORDER BY d.d ASC
    `)

    const daily = (
      rows as unknown as {
        rows: Array<{
          date: string
          weekday: string
          tasks: number
          checkins: number
          spendings: number
        }>
      }
    ).rows.map((r) => ({
      date: r.date,
      weekday: r.weekday,
      tasks: r.tasks,
      checkins: r.checkins,
      spendings: r.spendings,
      score: r.tasks + r.checkins + r.spendings,
    }))

    const sortedByScore = [...daily].sort((a, b) => b.score - a.score)
    const top3 = sortedByScore.slice(0, 3).filter((d) => d.score > 0)
    const totalScore = daily.reduce((s, d) => s + d.score, 0)
    const avgScore = totalScore / days

    let message: string
    if (totalScore === 0) {
      message = `過去 ${days} 天家裡都沒活動、開始累積吧 🌱`
    } else if (top3.length > 0) {
      const peak = top3[0]
      message = `🔥 高峰日：${peak.date}（${peak.weekday}）共 ${peak.score} 個活動（${peak.tasks} 任務 + ${peak.checkins} 打卡 + ${peak.spendings} 花用）`
    } else {
      message = "過去活動量低、繼續累積！"
    }

    res.json({
      days,
      top3,
      avgScore: Math.round(avgScore * 10) / 10,
      totalScore,
      message,
    })
  })
)

/**
 * GET /api/family/goals-progress-rank?limit=10
 * 家庭 active goals 按 progress% 排名（誰快達標）
 * stage: near_complete(>=80%) / midway(50-80%) / starting(<50%)
 */
router.get(
  "/api/family/goals-progress-rank",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50)

    const rows = await db.execute(sql`
      SELECT
        g.id::int AS goal_id,
        g.name AS goal_name,
        g.emoji AS goal_emoji,
        g.target_amount::numeric AS target_amount,
        g.current_amount::numeric AS current_amount,
        g.deadline,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar AS kid_avatar,
        CASE
          WHEN g.deadline IS NOT NULL THEN
            (g.deadline - CURRENT_DATE)::int
          ELSE NULL
        END AS days_until_deadline
      FROM kids_goals g
      JOIN kids_accounts ka ON ka.id = g.kid_id
      WHERE g.status = 'active'
        AND ka.is_active = true
      ORDER BY (g.current_amount::numeric / NULLIF(g.target_amount::numeric, 0)) DESC NULLS LAST
      LIMIT ${limit}
    `)

    const goals = (
      rows as unknown as {
        rows: Array<{
          goal_id: number
          goal_name: string
          goal_emoji: string
          target_amount: string | number
          current_amount: string | number
          deadline: string | null
          kid_id: number
          kid_name: string
          kid_avatar: string
          days_until_deadline: number | null
        }>
      }
    ).rows.map((r) => {
      const target = Number(r.target_amount)
      const current = Number(r.current_amount)
      const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
      let stage: "near_complete" | "midway" | "starting"
      if (progress >= 80) stage = "near_complete"
      else if (progress >= 50) stage = "midway"
      else stage = "starting"
      return {
        goalId: r.goal_id,
        goalName: r.goal_name,
        goalEmoji: r.goal_emoji,
        target,
        current,
        progress,
        deadline: r.deadline,
        daysUntilDeadline: r.days_until_deadline,
        kidId: r.kid_id,
        kidName: r.kid_name,
        kidAvatar: r.kid_avatar,
        stage,
      }
    })

    const nearCompleteCount = goals.filter((g) => g.stage === "near_complete").length
    let message: string
    if (goals.length === 0) {
      message = "還沒進行中的目標、建立第一個吧 🎯"
    } else if (nearCompleteCount > 0) {
      message = `🔥 有 ${nearCompleteCount} 個目標即將達成（>=80%）、加油衝刺！`
    } else {
      message = `🌱 共 ${goals.length} 個進行中目標、繼續累積`
    }

    res.json({
      goals,
      total: goals.length,
      nearCompleteCount,
      message,
    })
  })
)

/**
 * GET /api/family/goals-vs-wishes
 * 家庭自律度：goals 數 vs wishes 數 + promotion rate
 * 高 promotion rate = 小孩會把願望變成有計畫的目標
 */
router.get(
  "/api/family/goals-vs-wishes",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM kids_goals) AS total_goals,
        (SELECT COUNT(*)::int FROM kids_goals WHERE status = 'active') AS active_goals,
        (SELECT COUNT(*)::int FROM kids_goals WHERE status = 'completed') AS completed_goals,
        (SELECT COUNT(*)::int FROM kids_wishes) AS total_wishes,
        (SELECT COUNT(*)::int FROM kids_wishes WHERE status = 'wished') AS wished,
        (SELECT COUNT(*)::int FROM kids_wishes WHERE status = 'promoted') AS promoted,
        (SELECT COUNT(*)::int FROM kids_wishes WHERE status = 'abandoned') AS abandoned_wishes
    `)
    const row = (
      rows as unknown as {
        rows: Array<{
          total_goals: number
          active_goals: number
          completed_goals: number
          total_wishes: number
          wished: number
          promoted: number
          abandoned_wishes: number
        }>
      }
    ).rows[0]

    const totalGoals = row?.total_goals ?? 0
    const activeGoals = row?.active_goals ?? 0
    const completedGoals = row?.completed_goals ?? 0
    const totalWishes = row?.total_wishes ?? 0
    const wished = row?.wished ?? 0
    const promoted = row?.promoted ?? 0
    const abandoned = row?.abandoned_wishes ?? 0

    const promotionRate = totalWishes > 0 ? Math.round((promoted / totalWishes) * 100) : 0
    const goalToWishRatio = totalWishes > 0 ? Math.round((totalGoals / totalWishes) * 100) / 100 : 0

    let discipline: "highly_disciplined" | "balanced" | "wishful" | "no_goals" | "no_data"
    let message: string
    if (totalGoals === 0 && totalWishes === 0) {
      discipline = "no_data"
      message = "還沒目標或願望、開始建立第一個吧 🎯"
    } else if (totalGoals > 0 && promotionRate >= 40) {
      discipline = "highly_disciplined"
      message = `🎯 自律度高：${promotionRate}% 願望升級成目標、${completedGoals} 個已達成`
    } else if (totalGoals > 0 && promotionRate >= 15) {
      discipline = "balanced"
      message = `⚖️ 平衡發展：${promotionRate}% 願望變目標、${activeGoals} 個進行中`
    } else if (totalGoals > 0) {
      discipline = "wishful"
      message = `✨ 願望多於計畫：${wished} 個願望未升級、可以鼓勵小孩把想要的存錢買`
    } else {
      discipline = "no_goals"
      message = `📋 ${totalWishes} 個願望但沒目標、引導小孩設定具體儲蓄計畫`
    }

    res.json({
      goals: { total: totalGoals, active: activeGoals, completed: completedGoals },
      wishes: { total: totalWishes, wished, promoted, abandoned },
      promotionRate,
      goalToWishRatio,
      discipline,
      message,
    })
  })
)

/**
 * GET /api/family/approve-latency?days=60
 * 家長批准延遲：submitted（completed_at）→ approved 平均小時
 * 分桶：<1h / 1-6h / 6-24h / 1-3 天 / >3 天
 */
router.get(
  "/api/family/approve-latency",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 60, 7), 365)

    const rows = await db.execute(sql`
      WITH a AS (
        SELECT
          EXTRACT(EPOCH FROM (approved_at - completed_at)) / 3600.0 AS hours
        FROM kids_tasks
        WHERE status = 'approved'
          AND approved_at IS NOT NULL
          AND completed_at IS NOT NULL
          AND approved_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      )
      SELECT
        COUNT(*)::int AS total,
        COALESCE(AVG(hours), 0)::numeric AS avg_hours,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours), 0)::numeric AS median_hours,
        COUNT(*) FILTER (WHERE hours < 1)::int AS bucket_under_1h,
        COUNT(*) FILTER (WHERE hours >= 1 AND hours < 6)::int AS bucket_1_6h,
        COUNT(*) FILTER (WHERE hours >= 6 AND hours < 24)::int AS bucket_6_24h,
        COUNT(*) FILTER (WHERE hours >= 24 AND hours < 72)::int AS bucket_1_3d,
        COUNT(*) FILTER (WHERE hours >= 72)::int AS bucket_over_3d
      FROM a
    `)

    const row = (
      rows as unknown as {
        rows: Array<{
          total: number
          avg_hours: string | number
          median_hours: string | number
          bucket_under_1h: number
          bucket_1_6h: number
          bucket_6_24h: number
          bucket_1_3d: number
          bucket_over_3d: number
        }>
      }
    ).rows[0]

    const total = row?.total ?? 0
    const avgHours = Number(row?.avg_hours ?? 0)
    const medianHours = Number(row?.median_hours ?? 0)

    const buckets = [
      { label: "<1 小時", range: "instant", count: row?.bucket_under_1h ?? 0 },
      { label: "1-6 小時", range: "fast", count: row?.bucket_1_6h ?? 0 },
      { label: "6-24 小時", range: "normal", count: row?.bucket_6_24h ?? 0 },
      { label: "1-3 天", range: "slow", count: row?.bucket_1_3d ?? 0 },
      { label: ">3 天", range: "delayed", count: row?.bucket_over_3d ?? 0 },
    ]

    let level: "instant" | "fast" | "good" | "slow" | "sluggish" | "no_data"
    let message: string
    if (total === 0) {
      level = "no_data"
      message = `過去 ${days} 天沒有批准紀錄、家長要記得及時批准！`
    } else if (medianHours < 1) {
      level = "instant"
      message = `⚡ 家長超快響應（中位 ${medianHours.toFixed(1)} 小時）、小孩成就感滿滿！`
    } else if (medianHours < 6) {
      level = "fast"
      message = `🚀 家長很快（中位 ${medianHours.toFixed(1)} 小時）、不錯`
    } else if (medianHours < 24) {
      level = "good"
      message = `👍 家長半天內批准（中位 ${medianHours.toFixed(1)} 小時）、可接受`
    } else if (medianHours < 72) {
      level = "slow"
      message = `⏰ 批准偏慢（中位 ${(medianHours / 24).toFixed(1)} 天）、小孩等久了會失望`
    } else {
      level = "sluggish"
      message = `🐢 批准太慢（中位 ${(medianHours / 24).toFixed(1)} 天）、影響小孩動力`
    }

    res.json({
      days,
      stats: {
        total,
        avgHours: Math.round(avgHours * 10) / 10,
        medianHours: Math.round(medianHours * 10) / 10,
      },
      buckets,
      level,
      message,
    })
  })
)

/**
 * GET /api/family/feedback-rate?days=90
 * 家庭親子互動深度：approve 任務中 parentFeedback 帶率 + submissionNote 帶率
 * 鼓勵更多 feedback 與描述
 */
router.get(
  "/api/family/feedback-rate",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365)

    const rows = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total_approved,
        COUNT(*) FILTER (WHERE parent_feedback IS NOT NULL AND TRIM(parent_feedback) != '')::int AS with_parent_feedback,
        COUNT(*) FILTER (WHERE submission_note IS NOT NULL AND TRIM(submission_note) != '')::int AS with_submission_note
      FROM kids_tasks
      WHERE status = 'approved'
        AND completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
    `)

    const row = (
      rows as unknown as {
        rows: Array<{
          total_approved: number
          with_parent_feedback: number
          with_submission_note: number
        }>
      }
    ).rows[0]

    const total = row?.total_approved ?? 0
    const withParentFb = row?.with_parent_feedback ?? 0
    const withSubmissionNote = row?.with_submission_note ?? 0

    const parentRate = total > 0 ? Math.round((withParentFb / total) * 100) : 0
    const kidRate = total > 0 ? Math.round((withSubmissionNote / total) * 100) : 0
    const interactionScore = Math.round((parentRate + kidRate) / 2)

    let level: "highly_engaged" | "engaged" | "moderate" | "passive" | "no_data"
    let message: string
    if (total === 0) {
      level = "no_data"
      message = `過去 ${days} 天還沒任務、開始活動累積互動吧`
    } else if (interactionScore >= 70) {
      level = "highly_engaged"
      message = `🤝 親子互動深度很棒！家長 ${parentRate}% 給 feedback、小孩 ${kidRate}% 寫描述`
    } else if (interactionScore >= 40) {
      level = "engaged"
      message = `💬 親子有在交流（家長 ${parentRate}% / 小孩 ${kidRate}%）、再多一點更好`
    } else if (interactionScore >= 15) {
      level = "moderate"
      message = `📝 互動偏少（家長 ${parentRate}% / 小孩 ${kidRate}%）、試試 approve 時誇獎 + 小孩 submit 寫做了什麼`
    } else {
      level = "passive"
      message = `⚠️ 缺乏互動（家長 ${parentRate}% / 小孩 ${kidRate}%）、家庭記帳不只是入帳、更是親子對話的機會`
    }

    res.json({
      days,
      totalApproved: total,
      withParentFeedback: withParentFb,
      withSubmissionNote,
      parentFeedbackRate: parentRate,
      kidSubmissionNoteRate: kidRate,
      interactionScore,
      level,
      message,
    })
  })
)

export default router
