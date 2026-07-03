/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 21，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"

const router = Router()

/**
 * GET /api/family/kid-task-completion-rate?days=90
 * 每個 active kid 過去 N 天 approved / (approved + rejected) 批准率
 * 看任務做得好不好（被駁回多 → 比例低）
 */
router.get(
  "/api/family/kid-task-completion-rate",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365)

    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COUNT(t.id) FILTER (WHERE t.status = 'approved')::int AS approved,
        COUNT(t.id) FILTER (WHERE t.status = 'rejected')::int AS rejected
      FROM kids_accounts ka
      LEFT JOIN kids_tasks t ON
        t.kid_id = ka.id
        AND t.status IN ('approved', 'rejected')
        AND t.updated_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
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
          approved: number
          rejected: number
        }>
      }
    ).rows.map((r) => {
      const total = r.approved + r.rejected
      const rate = total > 0 ? Math.round((r.approved / total) * 100) : 0
      let level: "perfect" | "great" | "good" | "needs_practice" | "no_data"
      if (total === 0) level = "no_data"
      else if (rate >= 95) level = "perfect"
      else if (rate >= 80) level = "great"
      else if (rate >= 60) level = "good"
      else level = "needs_practice"
      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        approved: r.approved,
        rejected: r.rejected,
        rate,
        level,
      }
    })

    const withData = kids.filter((k) => k.approved + k.rejected > 0)
    const sorted = [...withData].sort((a, b) => b.rate - a.rate)
    const familyAvg =
      withData.length > 0
        ? Math.round(withData.reduce((s, k) => s + k.rate, 0) / withData.length)
        : 0

    let message: string
    if (withData.length === 0) {
      message = `過去 ${days} 天還沒任務 approve/reject、批准率無法計算`
    } else if (familyAvg >= 95) {
      message = `🏆 全家平均批准率 ${familyAvg}%、小孩任務做得超棒！`
    } else if (familyAvg >= 80) {
      message = `💪 全家平均 ${familyAvg}%、小孩任務品質不錯`
    } else if (familyAvg >= 60) {
      message = `📋 全家平均 ${familyAvg}%、可以再加強任務品質`
    } else {
      message = `🌱 全家平均 ${familyAvg}%、被駁回較多、家長可以更明確說明任務標準`
    }

    res.json({
      days,
      kids: sorted.length > 0 ? sorted : kids,
      familyAvg,
      message,
    })
  })
)

/**
 * GET /api/family/jar-allocation-by-kid
 * 家庭兒童 jar 分配對比：每個 kid 的 spend/save/give ratio + 類型判斷
 * type: saver_type(save 最高) / spender_type(spend 最高) / giver_type(give 最高) / balanced
 */
router.get(
  "/api/family/jar-allocation-by-kid",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        id::int AS kid_id,
        display_name AS kid_name,
        avatar,
        spend_ratio::int AS spend_ratio,
        save_ratio::int AS save_ratio,
        give_ratio::int AS give_ratio
      FROM kids_accounts
      WHERE is_active = true
      ORDER BY id ASC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          spend_ratio: number
          save_ratio: number
          give_ratio: number
        }>
      }
    ).rows.map((r) => {
      const spend = r.spend_ratio
      const save = r.save_ratio
      const give = r.give_ratio
      const max = Math.max(spend, save, give)
      let type: "saver" | "spender" | "giver" | "balanced"
      if (max - Math.min(spend, save, give) <= 10) {
        type = "balanced"
      } else if (save === max) {
        type = "saver"
      } else if (give === max) {
        type = "giver"
      } else {
        type = "spender"
      }
      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        spendRatio: spend,
        saveRatio: save,
        giveRatio: give,
        type,
      }
    })

    // 家庭平均
    const familyAvg =
      kids.length > 0
        ? {
            spend: Math.round(kids.reduce((s, k) => s + k.spendRatio, 0) / kids.length),
            save: Math.round(kids.reduce((s, k) => s + k.saveRatio, 0) / kids.length),
            give: Math.round(kids.reduce((s, k) => s + k.giveRatio, 0) / kids.length),
          }
        : { spend: 0, save: 0, give: 0 }

    const counts = {
      saver: kids.filter((k) => k.type === "saver").length,
      spender: kids.filter((k) => k.type === "spender").length,
      giver: kids.filter((k) => k.type === "giver").length,
      balanced: kids.filter((k) => k.type === "balanced").length,
    }

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩"
    } else if (counts.balanced === kids.length) {
      message = `⚖️ 全家三罐分配平衡（${familyAvg.spend}/${familyAvg.save}/${familyAvg.give}）`
    } else if (counts.saver > counts.spender) {
      message = `💎 家庭偏向存錢（${counts.saver} 個儲蓄型）、平均存 ${familyAvg.save}%`
    } else if (counts.giver > 0) {
      message = `💝 有 ${counts.giver} 個小孩重視捐贈、家庭有愛心`
    } else if (counts.spender > 0) {
      message = `🛒 有 ${counts.spender} 個花用型小孩、可以鼓勵調整 ratio 多存點`
    } else {
      message = "家庭分配組合多元、各有特色"
    }

    res.json({
      kids,
      familyAvg,
      typeCounts: counts,
      message,
    })
  })
)

/**
 * GET /api/family/savings-velocity-rank?months=3
 * 家庭兒童儲蓄速度排名
 * 速度 = 過去 N 月 task reward * saveRatio / N（月均 save 增量）
 */
router.get(
  "/api/family/savings-velocity-rank",
  asyncHandler(async (req, res) => {
    const months = Math.min(Math.max(Number(req.query.months) || 3, 1), 12)

    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        ka.save_ratio::int AS save_ratio,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ka.id
            AND status = 'approved'
            AND completed_at >= CURRENT_DATE - (${months}::int * INTERVAL '1 month')
        ), 0) AS total_reward,
        COALESCE((SELECT save_balance::numeric FROM kids_jars WHERE kid_id = ka.id), 0) AS current_save
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
          save_ratio: number
          total_reward: string | number
          current_save: string | number
        }>
      }
    ).rows.map((r) => {
      const totalReward = Number(r.total_reward)
      const saveEarned = (totalReward * r.save_ratio) / 100
      const monthlyVelocity = Math.round((saveEarned / months) * 10) / 10
      const currentSave = Number(r.current_save)
      // 預估到 $1000 還差幾個月
      const monthsTo1000 =
        monthlyVelocity > 0 && currentSave < 1000
          ? Math.ceil((1000 - currentSave) / monthlyVelocity)
          : currentSave >= 1000
            ? 0
            : null
      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        saveRatio: r.save_ratio,
        totalReward,
        saveEarned: Math.round(saveEarned),
        monthlyVelocity,
        currentSave: Math.round(currentSave),
        monthsTo1000,
      }
    })

    const sorted = [...kids].sort((a, b) => b.monthlyVelocity - a.monthlyVelocity)
    const topSaver = sorted.length > 0 && sorted[0].monthlyVelocity > 0 ? sorted[0] : null

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩"
    } else if (!topSaver) {
      message = `過去 ${months} 個月還沒人存錢、開始累積吧 🌱`
    } else {
      message = `💎 儲蓄王：${topSaver.avatar} ${topSaver.kidName}（每月 +$${topSaver.monthlyVelocity}）`
    }

    res.json({
      months,
      kids: sorted,
      topSaver: topSaver
        ? {
            kidName: topSaver.kidName,
            avatar: topSaver.avatar,
            monthlyVelocity: topSaver.monthlyVelocity,
            monthsTo1000: topSaver.monthsTo1000,
          }
        : null,
      message,
    })
  })
)

/**
 * GET /api/family/task-monthly-growth?months=6
 * 過去 N 個月 task 完成數 + 環比成長率
 */
router.get(
  "/api/family/task-monthly-growth",
  asyncHandler(async (req, res) => {
    const months = Math.min(Math.max(Number(req.query.months) || 6, 2), 24)

    const rows = await db.execute(sql`
      WITH months AS (
        SELECT generate_series(
          DATE_TRUNC('month', CURRENT_DATE) - ((${months}::int - 1) * INTERVAL '1 month'),
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        )::date AS m_start
      )
      SELECT
        TO_CHAR(m.m_start, 'YYYY-MM') AS month,
        (SELECT COUNT(*)::int FROM kids_tasks
          WHERE status = 'approved'
            AND completed_at >= m.m_start
            AND completed_at < m.m_start + INTERVAL '1 month'
        ) AS tasks
      FROM months m
      ORDER BY m.m_start ASC
    `)

    const monthsArr = (rows as unknown as { rows: Array<{ month: string; tasks: number }> }).rows

    const withGrowth = monthsArr.map((m, i) => {
      if (i === 0) {
        return { month: m.month, tasks: m.tasks, growth: null as number | null }
      }
      const prev = monthsArr[i - 1].tasks
      const growth = prev > 0 ? Math.round(((m.tasks - prev) / prev) * 100) : m.tasks > 0 ? 100 : 0
      return { month: m.month, tasks: m.tasks, growth }
    })

    const totalTasks = withGrowth.reduce((s, m) => s + m.tasks, 0)
    const growths = withGrowth.filter((m) => m.growth !== null).map((m) => m.growth!)
    const avgGrowth =
      growths.length > 0 ? Math.round(growths.reduce((s, g) => s + g, 0) / growths.length) : 0

    let trend: "rising" | "steady" | "declining" | "no_data"
    let message: string
    if (totalTasks === 0) {
      trend = "no_data"
      message = `過去 ${months} 個月還沒任務、開始第一個吧 🌱`
    } else if (avgGrowth >= 20) {
      trend = "rising"
      message = `📈 平均月成長 ${avgGrowth}%、家裡越來越活躍！`
    } else if (avgGrowth <= -20) {
      trend = "declining"
      message = `📉 平均月衰退 ${Math.abs(avgGrowth)}%、近期較少任務`
    } else {
      trend = "steady"
      message = `📊 平均月成長 ${avgGrowth}%、穩定中`
    }

    res.json({
      months: withGrowth,
      totalTasks,
      avgGrowth,
      trend,
      message,
    })
  })
)

/**
 * GET /api/family/goal-amount-histogram
 * 家庭目標金額分佈（active + completed）
 * 5 桶：$1-100 / $101-500 / $501-1000 / $1001-5000 / $5000+
 */
router.get(
  "/api/family/goal-amount-histogram",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      WITH g AS (
        SELECT target_amount::numeric AS amount, status
        FROM kids_goals
        WHERE status IN ('active', 'completed')
      )
      SELECT
        COUNT(*) FILTER (WHERE amount <= 100)::int AS small,
        COUNT(*) FILTER (WHERE amount > 100 AND amount <= 500)::int AS medium,
        COUNT(*) FILTER (WHERE amount > 500 AND amount <= 1000)::int AS large,
        COUNT(*) FILTER (WHERE amount > 1000 AND amount <= 5000)::int AS xlarge,
        COUNT(*) FILTER (WHERE amount > 5000)::int AS huge,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_count,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count,
        COUNT(*)::int AS total,
        COALESCE(AVG(amount), 0)::numeric AS avg_amount,
        COALESCE(MAX(amount), 0)::numeric AS max_amount
      FROM g
    `)

    const row = (
      rows as unknown as {
        rows: Array<{
          small: number
          medium: number
          large: number
          xlarge: number
          huge: number
          active_count: number
          completed_count: number
          total: number
          avg_amount: string | number
          max_amount: string | number
        }>
      }
    ).rows[0]

    const total = row?.total ?? 0
    const buckets = [
      { label: "$1-100", range: "small", count: row?.small ?? 0 },
      { label: "$101-500", range: "medium", count: row?.medium ?? 0 },
      { label: "$501-1000", range: "large", count: row?.large ?? 0 },
      { label: "$1001-5000", range: "xlarge", count: row?.xlarge ?? 0 },
      { label: "$5000+", range: "huge", count: row?.huge ?? 0 },
    ]

    const dominant = buckets.reduce((best, b) => (b.count > best.count ? b : best), buckets[0])
    const avgAmount = Math.round(Number(row?.avg_amount ?? 0))
    const maxAmount = Math.round(Number(row?.max_amount ?? 0))

    let pattern: "modest" | "balanced" | "ambitious" | "no_data"
    let message: string
    if (total === 0) {
      pattern = "no_data"
      message = "還沒設定目標、開始第一個吧 🎯"
    } else if (dominant.range === "small" || dominant.range === "medium") {
      pattern = "modest"
      message = `🌱 家庭目標偏小（平均 $${avgAmount}）、適合小孩練習達成感`
    } else if (dominant.range === "large") {
      pattern = "balanced"
      message = `⚖️ 家庭目標適中（平均 $${avgAmount}）、有挑戰也有可達成性`
    } else {
      pattern = "ambitious"
      message = `🚀 家庭有大目標（平均 $${avgAmount}、最高 $${maxAmount}）、野心十足`
    }

    res.json({
      buckets,
      stats: {
        total,
        active: row?.active_count ?? 0,
        completed: row?.completed_count ?? 0,
        avg: avgAmount,
        max: maxAmount,
      },
      dominantBucket: dominant.label,
      pattern,
      message,
    })
  })
)

/**
 * GET /api/family/task-duration?days=60
 * 每個 active kid 過去 N 天 approved task 從 created_at 到 approved_at 平均天數
 * 看處理速度：fastest vs slowest
 */
router.get(
  "/api/family/task-duration",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 60, 7), 365)

    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COUNT(t.id)::int AS task_count,
        COALESCE(AVG(EXTRACT(DAY FROM (t.approved_at - t.created_at))), 0)::numeric AS avg_days
      FROM kids_accounts ka
      LEFT JOIN kids_tasks t ON
        t.kid_id = ka.id
        AND t.status = 'approved'
        AND t.approved_at IS NOT NULL
        AND t.created_at IS NOT NULL
        AND t.approved_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
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
          task_count: number
          avg_days: string | number
        }>
      }
    ).rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      taskCount: r.task_count,
      avgDays: Math.round(Number(r.avg_days) * 10) / 10,
    }))

    const withTasks = kids.filter((k) => k.taskCount > 0)
    const sorted = [...withTasks].sort((a, b) => a.avgDays - b.avgDays)
    const fastest = sorted[0] ?? null
    const slowest = sorted[sorted.length - 1] ?? null
    const familyAvg =
      withTasks.length > 0
        ? Math.round((withTasks.reduce((s, k) => s + k.avgDays, 0) / withTasks.length) * 10) / 10
        : 0

    let message: string
    if (kids.length === 0) {
      message = "還沒小孩、加入第一個"
    } else if (withTasks.length === 0) {
      message = `過去 ${days} 天沒任務通過、無法計算處理速度`
    } else if (familyAvg < 1) {
      message = `⚡ 全家平均 ${familyAvg} 天搞定、超快！`
    } else if (familyAvg < 3) {
      message = `🚀 全家平均 ${familyAvg} 天處理一個任務、節奏不錯`
    } else if (familyAvg < 7) {
      message = `👍 全家平均 ${familyAvg} 天、可接受範圍`
    } else {
      message = `⏰ 全家平均 ${familyAvg} 天、任務拖得久、可以鼓勵更快動手`
    }

    res.json({
      days,
      kids,
      fastest: fastest ? { kidName: fastest.kidName, avgDays: fastest.avgDays } : null,
      slowest:
        slowest && slowest !== fastest
          ? { kidName: slowest.kidName, avgDays: slowest.avgDays }
          : null,
      familyAvg,
      message,
    })
  })
)

/**
 * GET /api/family/spending-top-items?days=90&limit=10
 * 家庭花用 top N description（spend 罐）
 */
router.get(
  "/api/family/spending-top-items",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365)
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30)

    const rows = await db.execute(sql`
      SELECT
        COALESCE(NULLIF(TRIM(description), ''), '(無描述)') AS description,
        COUNT(*)::int AS count,
        SUM(amount::numeric)::numeric AS total
      FROM kids_spendings
      WHERE jar = 'spend'
        AND spend_date >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      GROUP BY COALESCE(NULLIF(TRIM(description), ''), '(無描述)')
      ORDER BY total DESC, count DESC
      LIMIT ${limit}
    `)

    const items = (
      rows as unknown as {
        rows: Array<{ description: string; count: number; total: string | number }>
      }
    ).rows.map((r) => ({
      description: r.description,
      count: r.count,
      total: Number(r.total),
    }))

    const totalRow = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric)::numeric, 0) AS grand_total
      FROM kids_spendings
      WHERE jar = 'spend'
        AND spend_date >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
    `)
    const grandTotal = Number(
      (totalRow as unknown as { rows: Array<{ grand_total: string | number }> }).rows[0]
        ?.grand_total ?? 0
    )

    const withPercentage = items.map((it) => ({
      ...it,
      percentage: grandTotal > 0 ? Math.round((it.total / grandTotal) * 100) : 0,
    }))

    let message: string
    if (items.length === 0) {
      message = `過去 ${days} 天家裡沒花用紀錄、超節省 🌱`
    } else {
      const top = withPercentage[0]
      message = `🛒 過去 ${days} 天最常花在「${top.description}」（$${top.total}、占 ${top.percentage}%）`
    }

    res.json({
      days,
      items: withPercentage,
      grandTotal,
      message,
    })
  })
)

/**
 * GET /api/family/captain?days=30
 * 家庭隊長：過去 N 天綜合活躍度最高的小孩
 * score = tasks * 2 + checkins * 1 + goalsCompleted * 5
 */
router.get(
  "/api/family/captain",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 365)

    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        (SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ka.id
            AND status = 'approved'
            AND completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
        ) AS tasks,
        (SELECT COUNT(*)::int FROM kids_checkins
          WHERE kid_id = ka.id
            AND checkin_date >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
        ) AS checkins,
        (SELECT COUNT(*)::int FROM kids_goals
          WHERE kid_id = ka.id
            AND status = 'completed'
            AND completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
        ) AS goals_completed
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
          tasks: number
          checkins: number
          goals_completed: number
        }>
      }
    ).rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      tasks: r.tasks,
      checkins: r.checkins,
      goalsCompleted: r.goals_completed,
      score: r.tasks * 2 + r.checkins * 1 + r.goals_completed * 5,
    }))

    const sorted = [...kids].sort((a, b) => b.score - a.score)
    const captain = sorted.length > 0 && sorted[0].score > 0 ? sorted[0] : null

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩、加入第一個吧"
    } else if (!captain) {
      message = `過去 ${days} 天家裡沒活動、待選出新隊長！`
    } else {
      const tied = sorted.filter((k) => k.score === captain.score).length
      if (tied > 1) {
        message = `🤝 ${tied} 個小孩並列第一（${captain.score} 分）、家裡氣氛超棒`
      } else {
        message = `🎖️ 本月家庭隊長：${captain.avatar} ${captain.kidName}（${captain.score} 分）`
      }
    }

    res.json({
      days,
      kids: sorted,
      captain: captain
        ? {
            kidId: captain.kidId,
            kidName: captain.kidName,
            avatar: captain.avatar,
            score: captain.score,
          }
        : null,
      message,
    })
  })
)

export default router
