/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 23，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"

const router = Router()

/**
 * GET /api/family/reward-stats?days=90
 * 家庭任務獎勵金額統計：avg/median/min/max + 分桶
 * 5 桶：(0,10] / (10,50] / (50,100] / (100,500] / (500+]
 */
router.get(
  "/api/family/reward-stats",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365)

    const rows = await db.execute(sql`
      WITH r AS (
        SELECT reward_amount::numeric AS amount
        FROM kids_tasks
        WHERE status = 'approved'
          AND completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      )
      SELECT
        COUNT(*)::int AS total,
        COALESCE(MIN(amount), 0)::numeric AS min_amount,
        COALESCE(MAX(amount), 0)::numeric AS max_amount,
        COALESCE(AVG(amount), 0)::numeric AS avg_amount,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount), 0)::numeric AS median_amount,
        COUNT(*) FILTER (WHERE amount > 0 AND amount <= 10)::int AS bucket_tiny,
        COUNT(*) FILTER (WHERE amount > 10 AND amount <= 50)::int AS bucket_small,
        COUNT(*) FILTER (WHERE amount > 50 AND amount <= 100)::int AS bucket_medium,
        COUNT(*) FILTER (WHERE amount > 100 AND amount <= 500)::int AS bucket_large,
        COUNT(*) FILTER (WHERE amount > 500)::int AS bucket_huge
      FROM r
    `)

    const row = (
      rows as unknown as {
        rows: Array<{
          total: number
          min_amount: string | number
          max_amount: string | number
          avg_amount: string | number
          median_amount: string | number
          bucket_tiny: number
          bucket_small: number
          bucket_medium: number
          bucket_large: number
          bucket_huge: number
        }>
      }
    ).rows[0]

    const total = row?.total ?? 0
    const buckets = [
      { label: "$1-10", range: "tiny", count: row?.bucket_tiny ?? 0 },
      { label: "$11-50", range: "small", count: row?.bucket_small ?? 0 },
      { label: "$51-100", range: "medium", count: row?.bucket_medium ?? 0 },
      { label: "$101-500", range: "large", count: row?.bucket_large ?? 0 },
      { label: "$501+", range: "huge", count: row?.bucket_huge ?? 0 },
    ]

    const dominantBucket = buckets.reduce(
      (best, b) => (b.count > best.count ? b : best),
      buckets[0]
    )

    let pattern: "diverse" | "concentrated" | "high_value" | "low_value" | "no_data"
    let message: string
    if (total === 0) {
      pattern = "no_data"
      message = `過去 ${days} 天還沒任務、開始派任務累積獎勵紀錄吧 🌱`
    } else {
      const nonEmpty = buckets.filter((b) => b.count > 0).length
      if (nonEmpty >= 4) {
        pattern = "diverse"
        message = `🎨 獎勵金額多元（${nonEmpty} 個區間有任務）、不同難度都有`
      } else if (dominantBucket.range === "huge" || dominantBucket.range === "large") {
        pattern = "high_value"
        message = `💰 多數任務獎勵偏高（${dominantBucket.label} 占 ${dominantBucket.count} 個）`
      } else if (dominantBucket.range === "tiny" || dominantBucket.range === "small") {
        pattern = "low_value"
        message = `💸 多數任務獎勵較小（${dominantBucket.label} 占 ${dominantBucket.count} 個）`
      } else {
        pattern = "concentrated"
        message = `📊 多數任務集中在 ${dominantBucket.label}（${dominantBucket.count} 個）`
      }
    }

    res.json({
      days,
      stats: {
        total,
        min: Math.round(Number(row?.min_amount ?? 0)),
        max: Math.round(Number(row?.max_amount ?? 0)),
        avg: Math.round(Number(row?.avg_amount ?? 0)),
        median: Math.round(Number(row?.median_amount ?? 0)),
      },
      buckets,
      dominantBucket: dominantBucket.label,
      pattern,
      message,
    })
  })
)

/**
 * GET /api/family/initiative-rate?days=90
 * 家庭主動性比例：小孩自提任務（proposedByKid=true）vs 家長派的比例
 * + topProposer（最主動的小孩）
 */
router.get(
  "/api/family/initiative-rate",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365)

    const stats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE proposed_by_kid = true)::int AS proposed,
        COUNT(*) FILTER (WHERE proposed_by_kid = false)::int AS assigned,
        COUNT(*)::int AS total
      FROM kids_tasks
      WHERE status = 'approved'
        AND completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
    `)
    const s = (
      stats as unknown as {
        rows: Array<{ proposed: number; assigned: number; total: number }>
      }
    ).rows[0]

    const proposed = s?.proposed ?? 0
    const assigned = s?.assigned ?? 0
    const total = s?.total ?? 0
    const initiativeRate = total > 0 ? Math.round((proposed / total) * 100) : 0

    // top proposer
    const topRows = await db.execute(sql`
      SELECT ka.display_name AS kid_name, ka.avatar, COUNT(*)::int AS n
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.status = 'approved'
        AND t.proposed_by_kid = true
        AND t.completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      GROUP BY ka.id, ka.display_name, ka.avatar
      ORDER BY n DESC
      LIMIT 1
    `)
    const topProposer =
      (topRows as unknown as { rows: Array<{ kid_name: string; avatar: string; n: number }> })
        .rows[0] ?? null

    let level: "high_initiative" | "good_initiative" | "moderate" | "low" | "no_data"
    let message: string
    if (total === 0) {
      level = "no_data"
      message = `過去 ${days} 天還沒任務完成、開始活動吧 🌱`
    } else if (initiativeRate >= 50) {
      level = "high_initiative"
      message = `🚀 ${initiativeRate}% 自提任務、超主動！家長省心`
    } else if (initiativeRate >= 25) {
      level = "good_initiative"
      message = `💪 ${initiativeRate}% 自提、不錯的主動性`
    } else if (initiativeRate >= 10) {
      level = "moderate"
      message = `🌱 ${initiativeRate}% 自提、可以鼓勵更多自主`
    } else {
      level = "low"
      message = `📋 ${initiativeRate}% 自提、多家長派、可以鼓勵小孩自己提想做的`
    }

    res.json({
      days,
      stats: { proposed, assigned, total },
      initiativeRate,
      topProposer: topProposer
        ? { kidName: topProposer.kid_name, avatar: topProposer.avatar, count: topProposer.n }
        : null,
      level,
      message,
    })
  })
)

/**
 * GET /api/family/weekend-vs-weekday?days=60
 * 全家過去 N 天「週末」vs「工作日」task 完成 + spending 對比
 * 用 EXTRACT(DOW)：0=Sun 1=Mon ... 6=Sat、週末 = 0/6
 */
router.get(
  "/api/family/weekend-vs-weekday",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 60, 14), 180)

    const rows = await db.execute(sql`
      WITH days_set AS (
        SELECT generate_series(
          CURRENT_DATE - (${days - 1}::int * INTERVAL '1 day'),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS d
      ),
      counts AS (
        SELECT
          d.d,
          EXTRACT(DOW FROM d.d)::int AS dow,
          (SELECT COUNT(*)::int FROM kids_tasks
            WHERE status = 'approved' AND DATE(completed_at) = d.d) AS tasks,
          COALESCE((SELECT SUM(amount::numeric)::numeric FROM kids_spendings
            WHERE jar IN ('spend', 'give') AND spend_date = d.d), 0) AS spent
        FROM days_set d
      )
      SELECT
        SUM(CASE WHEN dow IN (0, 6) THEN tasks ELSE 0 END)::int AS weekend_tasks,
        SUM(CASE WHEN dow NOT IN (0, 6) THEN tasks ELSE 0 END)::int AS weekday_tasks,
        SUM(CASE WHEN dow IN (0, 6) THEN spent ELSE 0 END)::numeric AS weekend_spent,
        SUM(CASE WHEN dow NOT IN (0, 6) THEN spent ELSE 0 END)::numeric AS weekday_spent,
        COUNT(*) FILTER (WHERE dow IN (0, 6))::int AS weekend_days,
        COUNT(*) FILTER (WHERE dow NOT IN (0, 6))::int AS weekday_days
      FROM counts
    `)
    const row = (
      rows as unknown as {
        rows: Array<{
          weekend_tasks: number
          weekday_tasks: number
          weekend_spent: string | number
          weekday_spent: string | number
          weekend_days: number
          weekday_days: number
        }>
      }
    ).rows[0]

    const weekendTasks = row?.weekend_tasks ?? 0
    const weekdayTasks = row?.weekday_tasks ?? 0
    const weekendSpent = Number(row?.weekend_spent ?? 0)
    const weekdaySpent = Number(row?.weekday_spent ?? 0)
    const weekendDays = row?.weekend_days ?? 0
    const weekdayDays = row?.weekday_days ?? 0

    const weekendTasksPerDay = weekendDays > 0 ? weekendTasks / weekendDays : 0
    const weekdayTasksPerDay = weekdayDays > 0 ? weekdayTasks / weekdayDays : 0

    const total = weekendTasks + weekdayTasks
    let pattern: "weekend_warriors" | "weekday_grinders" | "balanced" | "no_data"
    let message: string
    if (total === 0) {
      pattern = "no_data"
      message = `過去 ${days} 天還沒任務完成、開始活躍吧 🌱`
    } else if (weekendTasksPerDay > weekdayTasksPerDay * 1.5) {
      pattern = "weekend_warriors"
      message = `🏆 家裡是週末戰士型（週末日均 ${weekendTasksPerDay.toFixed(1)} vs 平日 ${weekdayTasksPerDay.toFixed(1)}）`
    } else if (weekdayTasksPerDay > weekendTasksPerDay * 1.5) {
      pattern = "weekday_grinders"
      message = `💪 家裡平日比較拼（平日日均 ${weekdayTasksPerDay.toFixed(1)} vs 週末 ${weekendTasksPerDay.toFixed(1)}）`
    } else {
      pattern = "balanced"
      message = `⚖️ 家裡天天都活躍（平日 ${weekdayTasksPerDay.toFixed(1)} / 週末 ${weekendTasksPerDay.toFixed(1)}）`
    }

    res.json({
      days,
      weekend: {
        tasks: weekendTasks,
        tasksPerDay: Math.round(weekendTasksPerDay * 10) / 10,
        spent: weekendSpent,
        days: weekendDays,
      },
      weekday: {
        tasks: weekdayTasks,
        tasksPerDay: Math.round(weekdayTasksPerDay * 10) / 10,
        spent: weekdaySpent,
        days: weekdayDays,
      },
      pattern,
      message,
    })
  })
)

/**
 * GET /api/family/income-vs-spending?days=30
 * 全家過去 N 天收入（task reward）vs 花用（spend + give）對比
 * 含 balance / ratio / 評等 / 動態 message
 */
router.get(
  "/api/family/income-vs-spending",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)

    const rows = await db.execute(sql`
      SELECT
        COALESCE((SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE status = 'approved'
            AND completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
        ), 0) AS income,
        COALESCE((SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE jar = 'spend'
            AND spend_date >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
        ), 0) AS spent,
        COALESCE((SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE jar = 'give'
            AND spend_date >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
        ), 0) AS given
    `)
    const row = (
      rows as unknown as {
        rows: Array<{ income: string | number; spent: string | number; given: string | number }>
      }
    ).rows[0]

    const income = Number(row?.income ?? 0)
    const spent = Number(row?.spent ?? 0)
    const given = Number(row?.given ?? 0)
    const totalOut = spent + given
    const balance = income - totalOut
    const ratio = income > 0 ? Math.round((totalOut / income) * 100) : 0

    let level: "saver" | "balanced" | "spender" | "overspending" | "no_data"
    let message: string
    if (income === 0 && totalOut === 0) {
      level = "no_data"
      message = `過去 ${days} 天還沒收入或花用、開始活動吧 🌱`
    } else if (income === 0 && totalOut > 0) {
      level = "overspending"
      message = `⚠️ 過去 ${days} 天無收入但花用 $${totalOut}、要先賺再花`
    } else if (ratio <= 30) {
      level = "saver"
      message = `💎 收入 $${income} / 只花 $${totalOut}（${ratio}%）、超會存！`
    } else if (ratio <= 60) {
      level = "balanced"
      message = `💰 收入 $${income} / 花 $${totalOut}（${ratio}%）、平衡良好`
    } else if (ratio <= 100) {
      level = "spender"
      message = `🛒 收入 $${income} / 花 $${totalOut}（${ratio}%）、花用偏高`
    } else {
      level = "overspending"
      message = `🚨 花了 $${totalOut} > 收入 $${income}（${ratio}%）、入不敷出！`
    }

    res.json({
      days,
      income,
      spent,
      given,
      totalOut,
      balance,
      ratio,
      level,
      message,
    })
  })
)

/**
 * GET /api/family/jars-current-balance
 * 全家三罐當前餘額總和 + 比例 + 每罐 topKid
 * 健康度：save 占比 ≥ 25% = healthy / 15-25% = ok / <15% = unhealthy
 */
router.get(
  "/api/family/jars-current-balance",
  asyncHandler(async (_req, res) => {
    const totals = await db.execute(sql`
      SELECT
        COALESCE(SUM(j.spend_balance::numeric), 0)::numeric AS spend_total,
        COALESCE(SUM(j.save_balance::numeric), 0)::numeric AS save_total,
        COALESCE(SUM(j.give_balance::numeric), 0)::numeric AS give_total
      FROM kids_jars j
      JOIN kids_accounts ka ON ka.id = j.kid_id
      WHERE ka.is_active = true
    `)
    const t = (
      totals as unknown as {
        rows: Array<{
          spend_total: string | number
          save_total: string | number
          give_total: string | number
        }>
      }
    ).rows[0]

    const spend = Number(t?.spend_total ?? 0)
    const save = Number(t?.save_total ?? 0)
    const give = Number(t?.give_total ?? 0)
    const total = spend + save + give

    const topPerJar = await db.execute(sql`
      SELECT
        (
          SELECT json_build_object('kidName', ka.display_name, 'balance', j.spend_balance::numeric, 'avatar', ka.avatar)
          FROM kids_jars j JOIN kids_accounts ka ON ka.id = j.kid_id
          WHERE ka.is_active = true
          ORDER BY j.spend_balance::numeric DESC LIMIT 1
        ) AS top_spend,
        (
          SELECT json_build_object('kidName', ka.display_name, 'balance', j.save_balance::numeric, 'avatar', ka.avatar)
          FROM kids_jars j JOIN kids_accounts ka ON ka.id = j.kid_id
          WHERE ka.is_active = true
          ORDER BY j.save_balance::numeric DESC LIMIT 1
        ) AS top_save,
        (
          SELECT json_build_object('kidName', ka.display_name, 'balance', j.give_balance::numeric, 'avatar', ka.avatar)
          FROM kids_jars j JOIN kids_accounts ka ON ka.id = j.kid_id
          WHERE ka.is_active = true
          ORDER BY j.give_balance::numeric DESC LIMIT 1
        ) AS top_give
    `)
    const topRow = (
      topPerJar as unknown as {
        rows: Array<{
          top_spend: { kidName: string; balance: number; avatar: string } | null
          top_save: { kidName: string; balance: number; avatar: string } | null
          top_give: { kidName: string; balance: number; avatar: string } | null
        }>
      }
    ).rows[0]

    const ratio = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

    const saveRatio = ratio(save)
    let health: "healthy" | "ok" | "unhealthy" | "no_data"
    let message: string

    if (total === 0) {
      health = "no_data"
      message = "全家還沒收入、開始完成任務累積吧 🌱"
    } else if (saveRatio >= 25) {
      health = "healthy"
      message = `💎 全家儲蓄健康（save 占 ${saveRatio}%）`
    } else if (saveRatio >= 15) {
      health = "ok"
      message = `💰 全家平衡（save 占 ${saveRatio}%）、可以多存一點`
    } else {
      health = "unhealthy"
      message = `⚠️ 全家偏花用（save 只占 ${saveRatio}%）、建議多存錢`
    }

    res.json({
      jars: {
        spend: { total: spend, ratio: ratio(spend), topKid: topRow?.top_spend ?? null },
        save: { total: save, ratio: saveRatio, topKid: topRow?.top_save ?? null },
        give: { total: give, ratio: ratio(give), topKid: topRow?.top_give ?? null },
      },
      total,
      health,
      message,
    })
  })
)

/**
 * GET /api/family/goals-completion-rate
 * 家庭目標達成率分析：active / completed / abandoned 統計 + 平均達成天數
 */
router.get(
  "/api/family/goals-completion-rate",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'abandoned')::int AS abandoned,
        COUNT(*)::int AS total,
        COALESCE(AVG(EXTRACT(DAY FROM (completed_at - created_at))) FILTER (WHERE status = 'completed'), 0)::numeric AS avg_completion_days,
        COALESCE(AVG(target_amount::numeric) FILTER (WHERE status = 'completed'), 0)::numeric AS avg_completed_amount,
        COALESCE(AVG(target_amount::numeric) FILTER (WHERE status = 'active'), 0)::numeric AS avg_active_amount
      FROM kids_goals
    `)

    const row = (
      rows as unknown as {
        rows: Array<{
          active: number
          completed: number
          abandoned: number
          total: number
          avg_completion_days: string | number
          avg_completed_amount: string | number
          avg_active_amount: string | number
        }>
      }
    ).rows[0]

    const active = row?.active ?? 0
    const completed = row?.completed ?? 0
    const abandoned = row?.abandoned ?? 0
    const total = row?.total ?? 0
    const avgCompletionDays = Math.round(Number(row?.avg_completion_days ?? 0))
    const avgCompletedAmount = Math.round(Number(row?.avg_completed_amount ?? 0))
    const avgActiveAmount = Math.round(Number(row?.avg_active_amount ?? 0))

    const denom = active + completed
    const completionRate = denom > 0 ? Math.round((completed / denom) * 100) : 0

    let level: "excellent" | "good" | "fair" | "needs_work" | "no_data"
    let message: string
    if (total === 0) {
      level = "no_data"
      message = "還沒有目標、建立第一個吧 🎯"
    } else if (completionRate >= 70) {
      level = "excellent"
      message = `🏆 達成率 ${completionRate}%、超會完成目標！平均 ${avgCompletionDays} 天達成`
    } else if (completionRate >= 50) {
      level = "good"
      message = `💎 達成率 ${completionRate}%、不錯！平均 ${avgCompletionDays} 天達成`
    } else if (completionRate >= 25) {
      level = "fair"
      message = `🌱 達成率 ${completionRate}%、再加把勁`
    } else {
      level = "needs_work"
      message = `📋 達成率 ${completionRate}%、目標難度設定可能太高、試試小目標累積成就`
    }

    res.json({
      stats: { active, completed, abandoned, total },
      completionRate,
      avgCompletionDays,
      avgCompletedAmount,
      avgActiveAmount,
      level,
      message,
    })
  })
)

/**
 * GET /api/family/spending-daily?days=30
 * 全家過去 N 天每日花用線（spend + give 罐）+ 趨勢分析
 * alert: 最近 7 天平均 > 過去 N 天平均 1.5 倍
 */
router.get(
  "/api/family/spending-daily",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)

    const rows = await db.execute(sql`
      WITH days AS (
        SELECT generate_series(
          CURRENT_DATE - (${days - 1}::int * INTERVAL '1 day'),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS d
      )
      SELECT
        TO_CHAR(d.d, 'YYYY-MM-DD') AS date,
        TO_CHAR(d.d, 'Dy') AS weekday,
        COALESCE((SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE jar = 'spend' AND spend_date = d.d), 0) AS spent,
        COALESCE((SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE jar = 'give' AND spend_date = d.d), 0) AS given
      FROM days d
      ORDER BY d.d ASC
    `)

    const daily = (
      rows as unknown as {
        rows: Array<{
          date: string
          weekday: string
          spent: string | number
          given: string | number
        }>
      }
    ).rows.map((r) => ({
      date: r.date,
      weekday: r.weekday,
      spent: Number(r.spent),
      given: Number(r.given),
      total: Number(r.spent) + Number(r.given),
    }))

    const totalSpent = daily.reduce((s, d) => s + d.spent, 0)
    const totalGiven = daily.reduce((s, d) => s + d.given, 0)
    const totalAll = totalSpent + totalGiven
    const avgPerDay = totalAll / days

    // 最近 7 天 vs 整體平均
    const recent7 = daily.slice(-7)
    const recent7Avg = recent7.reduce((s, d) => s + d.total, 0) / 7

    let trend: "spiking" | "rising" | "stable" | "declining" | "no_data"
    let message: string
    let alert = false

    if (totalAll === 0) {
      trend = "no_data"
      message = `過去 ${days} 天家裡沒花用紀錄、很節省！`
    } else if (avgPerDay > 0 && recent7Avg >= avgPerDay * 1.5) {
      trend = "spiking"
      alert = true
      message = `🚨 最近 7 天平均 $${recent7Avg.toFixed(0)}/天、超過整體平均 1.5 倍以上`
    } else if (avgPerDay > 0 && recent7Avg >= avgPerDay * 1.1) {
      trend = "rising"
      message = `📈 最近 7 天花用上升中（$${recent7Avg.toFixed(0)}/天 vs 平均 $${avgPerDay.toFixed(0)}）`
    } else if (avgPerDay > 0 && recent7Avg <= avgPerDay * 0.7) {
      trend = "declining"
      message = `📉 最近花用減少（$${recent7Avg.toFixed(0)}/天 vs 平均 $${avgPerDay.toFixed(0)}）省了！`
    } else {
      trend = "stable"
      message = `💰 平均每天 $${avgPerDay.toFixed(0)}、花用穩定`
    }

    res.json({
      daily,
      summary: {
        days,
        totalSpent,
        totalGiven,
        totalAll,
        avgPerDay: Math.round(avgPerDay * 10) / 10,
        recent7Avg: Math.round(recent7Avg * 10) / 10,
      },
      trend,
      alert,
      message,
    })
  })
)

export default router
