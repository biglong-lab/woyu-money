/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 20，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"

const router = Router()

/**
 * GET /api/family/kid-earnings-trend?months=6
 * 每個 active kid 過去 N 月每月 task reward sum + topEarner
 */
router.get(
  "/api/family/kid-earnings-trend",
  asyncHandler(async (req, res) => {
    const months = Math.min(Math.max(Number(req.query.months) || 6, 2), 24)

    const rows = await db.execute(sql`
      WITH months AS (
        SELECT generate_series(
          DATE_TRUNC('month', CURRENT_DATE) - ((${months}::int - 1) * INTERVAL '1 month'),
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        )::date AS m_start
      ),
      kid_months AS (
        SELECT
          ka.id AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar,
          TO_CHAR(m.m_start, 'YYYY-MM') AS month,
          m.m_start
        FROM kids_accounts ka
        CROSS JOIN months m
        WHERE ka.is_active = true
      )
      SELECT
        km.kid_id::int AS kid_id,
        km.kid_name,
        km.avatar,
        km.month,
        COALESCE((SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = km.kid_id
            AND status = 'approved'
            AND completed_at >= km.m_start
            AND completed_at < km.m_start + INTERVAL '1 month'
        ), 0) AS earnings
      FROM kid_months km
      ORDER BY km.kid_id ASC, km.m_start ASC
    `)

    const rowsArr = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          month: string
          earnings: string | number
        }>
      }
    ).rows

    const kidMap = new Map<
      number,
      {
        kidId: number
        kidName: string
        avatar: string
        months: Array<{ month: string; earnings: number }>
        total: number
      }
    >()
    for (const r of rowsArr) {
      const earnings = Number(r.earnings)
      let kid = kidMap.get(r.kid_id)
      if (!kid) {
        kid = { kidId: r.kid_id, kidName: r.kid_name, avatar: r.avatar, months: [], total: 0 }
        kidMap.set(r.kid_id, kid)
      }
      kid.months.push({ month: r.month, earnings })
      kid.total += earnings
    }
    const kids = Array.from(kidMap.values()).sort((a, b) => b.total - a.total)
    const topEarner = kids.length > 0 && kids[0].total > 0 ? kids[0] : null
    const familyTotal = kids.reduce((s, k) => s + k.total, 0)

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩"
    } else if (!topEarner) {
      message = `過去 ${months} 月還沒有入帳、開始做任務吧`
    } else {
      message = `💰 ${months} 月最賺：${topEarner.avatar} ${topEarner.kidName}（$${topEarner.total}）`
    }

    res.json({
      months,
      kids,
      topEarner: topEarner
        ? { kidName: topEarner.kidName, avatar: topEarner.avatar, total: topEarner.total }
        : null,
      familyTotal,
      message,
    })
  })
)

/**
 * GET /api/family/goals-monthly-completion?months=6
 * 過去 N 月 completed goals 數 + 達成總額時序
 */
router.get(
  "/api/family/goals-monthly-completion",
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
        COALESCE(COUNT(g.id), 0)::int AS goals_count,
        COALESCE(SUM(g.target_amount::numeric), 0)::numeric AS total_amount
      FROM months m
      LEFT JOIN kids_goals g ON
        g.status = 'completed'
        AND g.completed_at >= m.m_start
        AND g.completed_at < m.m_start + INTERVAL '1 month'
      GROUP BY m.m_start
      ORDER BY m.m_start ASC
    `)

    const monthsArr = (
      rows as unknown as {
        rows: Array<{
          month: string
          goals_count: number
          total_amount: string | number
        }>
      }
    ).rows.map((r) => ({
      month: r.month,
      goalsCount: r.goals_count,
      totalAmount: Number(r.total_amount),
    }))

    const grandTotalGoals = monthsArr.reduce((s, m) => s + m.goalsCount, 0)
    const grandTotalAmount = monthsArr.reduce((s, m) => s + m.totalAmount, 0)
    const biggestMonth = monthsArr.reduce(
      (best, m) => (m.totalAmount > best.totalAmount ? m : best),
      monthsArr[0]
    )

    let message: string
    if (grandTotalGoals === 0) {
      message = `過去 ${months} 個月還沒目標達成、加油 🎯`
    } else if (biggestMonth && biggestMonth.totalAmount > 0) {
      message = `🏆 ${biggestMonth.month} 達成最多（${biggestMonth.goalsCount} 個目標、$${biggestMonth.totalAmount}）`
    } else {
      message = `達成 ${grandTotalGoals} 個目標、累計 $${grandTotalAmount}`
    }

    res.json({
      months: monthsArr,
      grandTotalGoals,
      grandTotalAmount,
      biggestMonth:
        biggestMonth && biggestMonth.totalAmount > 0
          ? {
              month: biggestMonth.month,
              goalsCount: biggestMonth.goalsCount,
              totalAmount: biggestMonth.totalAmount,
            }
          : null,
      message,
    })
  })
)

/**
 * GET /api/family/category-heat-trend?months=6
 * 過去 N 月各 task category 月度變化
 * 5 category: housework / study / self_care / kindness / other
 */
router.get(
  "/api/family/category-heat-trend",
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
        COALESCE(SUM(CASE WHEN t.category = 'housework' THEN 1 ELSE 0 END), 0)::int AS housework,
        COALESCE(SUM(CASE WHEN t.category = 'study' THEN 1 ELSE 0 END), 0)::int AS study,
        COALESCE(SUM(CASE WHEN t.category = 'self_care' THEN 1 ELSE 0 END), 0)::int AS self_care,
        COALESCE(SUM(CASE WHEN t.category = 'kindness' THEN 1 ELSE 0 END), 0)::int AS kindness,
        COALESCE(SUM(CASE WHEN t.category = 'other' THEN 1 ELSE 0 END), 0)::int AS other
      FROM months m
      LEFT JOIN kids_tasks t ON
        t.status = 'approved'
        AND t.completed_at >= m.m_start
        AND t.completed_at < m.m_start + INTERVAL '1 month'
      GROUP BY m.m_start
      ORDER BY m.m_start ASC
    `)

    const monthsArr = (
      rows as unknown as {
        rows: Array<{
          month: string
          housework: number
          study: number
          self_care: number
          kindness: number
          other: number
        }>
      }
    ).rows

    // 加總每 category
    const totals: Record<string, number> = {
      housework: 0,
      study: 0,
      self_care: 0,
      kindness: 0,
      other: 0,
    }
    for (const m of monthsArr) {
      totals.housework += m.housework
      totals.study += m.study
      totals.self_care += m.self_care
      totals.kindness += m.kindness
      totals.other += m.other
    }

    const grandTotal = Object.values(totals).reduce((s, n) => s + n, 0)

    // 找最熱 category
    const sortedCats = Object.entries(totals).sort((a, b) => b[1] - a[1])
    const topCategory = sortedCats[0][1] > 0 ? sortedCats[0][0] : null

    const CAT_LABEL: Record<string, string> = {
      housework: "🧹 家事",
      study: "📚 學習",
      self_care: "🧴 自我照顧",
      kindness: "💝 善行",
      other: "📋 其他",
    }

    let message: string
    if (grandTotal === 0) {
      message = `過去 ${months} 個月還沒任務、開始累積吧 🌱`
    } else if (topCategory) {
      const pct = Math.round((totals[topCategory] / grandTotal) * 100)
      message = `🔥 最熱類別：${CAT_LABEL[topCategory]}（${totals[topCategory]} 個、占 ${pct}%）`
    } else {
      message = "全家任務分類多元"
    }

    res.json({
      months: monthsArr,
      totals,
      topCategory,
      topCategoryLabel: topCategory ? CAT_LABEL[topCategory] : null,
      grandTotal,
      message,
    })
  })
)

/**
 * GET /api/family/badge-leaderboard
 * 各 active kid 累計徽章數 ranked + 最新徽章
 */
router.get(
  "/api/family/badge-leaderboard",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COUNT(b.id)::int AS badge_count,
        (
          SELECT json_build_object('title', title, 'emoji', emoji, 'earnedAt', earned_at)
          FROM kids_badges
          WHERE kid_id = ka.id
          ORDER BY earned_at DESC LIMIT 1
        ) AS latest_badge
      FROM kids_accounts ka
      LEFT JOIN kids_badges b ON b.kid_id = ka.id
      WHERE ka.is_active = true
      GROUP BY ka.id, ka.display_name, ka.avatar
      ORDER BY badge_count DESC, ka.id ASC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          badge_count: number
          latest_badge: { title: string; emoji: string; earnedAt: string } | null
        }>
      }
    ).rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      badgeCount: r.badge_count,
      latestBadge: r.latest_badge,
    }))

    const totalBadges = kids.reduce((s, k) => s + k.badgeCount, 0)
    const topAchiever = kids.length > 0 && kids[0].badgeCount > 0 ? kids[0] : null

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩"
    } else if (!topAchiever) {
      message = "全家還沒解鎖徽章、完成任務就會自動獲得 🏅"
    } else if (totalBadges >= 20) {
      message = `🎖️ 全家累計 ${totalBadges} 個徽章、收藏家！${topAchiever.kidName} 領先`
    } else {
      message = `🏆 徽章王：${topAchiever.avatar} ${topAchiever.kidName}（${topAchiever.badgeCount} 個）`
    }

    res.json({
      kids,
      totalBadges,
      topAchiever: topAchiever
        ? {
            kidName: topAchiever.kidName,
            avatar: topAchiever.avatar,
            badgeCount: topAchiever.badgeCount,
          }
        : null,
      message,
    })
  })
)

/**
 * GET /api/family/kid-spending-habits?days=30
 * 每個 active kid 過去 N 天 spend vs give 對比
 * habit: generous / spender / saver / balanced / no_data
 */
router.get(
  "/api/family/kid-spending-habits",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 365)

    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COALESCE((SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ka.id AND jar = 'spend'
            AND spend_date >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
        ), 0) AS spent,
        COALESCE((SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ka.id AND jar = 'give'
            AND spend_date >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
        ), 0) AS given,
        COALESCE((SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
        ), 0) AS earned
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
          spent: string | number
          given: string | number
          earned: string | number
        }>
      }
    ).rows.map((r) => {
      const spent = Number(r.spent)
      const given = Number(r.given)
      const earned = Number(r.earned)
      const totalOut = spent + given
      const giveRatio = totalOut > 0 ? Math.round((given / totalOut) * 100) : 0

      let habit: "generous" | "spender" | "saver" | "balanced" | "no_data"
      if (earned === 0 && totalOut === 0) {
        habit = "no_data"
      } else if (totalOut === 0) {
        habit = "saver"
      } else if (giveRatio >= 30) {
        habit = "generous"
      } else if (totalOut < earned * 0.3) {
        habit = "saver"
      } else if (giveRatio < 10) {
        habit = "spender"
      } else {
        habit = "balanced"
      }

      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        spent: Math.round(spent),
        given: Math.round(given),
        earned: Math.round(earned),
        giveRatio,
        habit,
      }
    })

    const counts = {
      generous: kids.filter((k) => k.habit === "generous").length,
      spender: kids.filter((k) => k.habit === "spender").length,
      saver: kids.filter((k) => k.habit === "saver").length,
      balanced: kids.filter((k) => k.habit === "balanced").length,
    }

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩"
    } else if (counts.generous > 0) {
      message = `💝 有 ${counts.generous} 個慷慨的小孩、家庭有愛心`
    } else if (counts.saver === kids.length) {
      message = "全家都偏儲蓄、紀律十足"
    } else if (counts.spender > counts.balanced + counts.saver) {
      message = `🛒 ${counts.spender} 個偏花用、可以鼓勵多存或捐`
    } else {
      message = "家庭花用習慣多元、各有特色"
    }

    res.json({
      days,
      kids,
      habitCounts: counts,
      message,
    })
  })
)

/**
 * GET /api/family/kid-active-days?days=30
 * 每個 active kid 過去 N 天有活動（task/checkin/spending）的天數比例
 * 排名 + topPerformer
 */
router.get(
  "/api/family/kid-active-days",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)

    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        (
          SELECT COUNT(DISTINCT day)::int FROM (
            SELECT DATE(completed_at) AS day FROM kids_tasks
              WHERE kid_id = ka.id AND status = 'approved'
                AND completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
            UNION
            SELECT checkin_date AS day FROM kids_checkins
              WHERE kid_id = ka.id
                AND checkin_date >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
            UNION
            SELECT spend_date AS day FROM kids_spendings
              WHERE kid_id = ka.id
                AND spend_date >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
          ) all_days
        ) AS active_days
      FROM kids_accounts ka
      WHERE ka.is_active = true
      ORDER BY ka.id ASC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{ kid_id: number; kid_name: string; avatar: string; active_days: number }>
      }
    ).rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      activeDays: r.active_days,
      ratio: Math.round((r.active_days / days) * 100),
    }))

    const sorted = [...kids].sort((a, b) => b.activeDays - a.activeDays)
    const topPerformer = sorted.length > 0 && sorted[0].activeDays > 0 ? sorted[0] : null
    const familyAvgRatio =
      kids.length > 0 ? Math.round(kids.reduce((s, k) => s + k.ratio, 0) / kids.length) : 0

    let message: string
    if (kids.length === 0) {
      message = "還沒有小孩"
    } else if (!topPerformer) {
      message = `過去 ${days} 天都沒人活動、開始累積活躍天數吧 🌱`
    } else if (familyAvgRatio >= 70) {
      message = `🔥 全家平均活躍率 ${familyAvgRatio}%、超棒！`
    } else if (familyAvgRatio >= 40) {
      message = `💪 全家平均活躍率 ${familyAvgRatio}%、不錯`
    } else {
      message = `🌱 全家平均活躍率 ${familyAvgRatio}%、可以更積極`
    }

    res.json({
      days,
      kids: sorted,
      topPerformer: topPerformer
        ? {
            kidName: topPerformer.kidName,
            avatar: topPerformer.avatar,
            activeDays: topPerformer.activeDays,
            ratio: topPerformer.ratio,
          }
        : null,
      familyAvgRatio,
      message,
    })
  })
)

/**
 * GET /api/family/task-mvp?days=30&limit=5
 * 家庭最大 reward task：過去 N 天 top N 高獎勵 approved task
 */
router.get(
  "/api/family/task-mvp",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 365)
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20)

    const rows = await db.execute(sql`
      SELECT
        t.id::int AS task_id,
        t.title,
        t.emoji,
        t.reward_amount::numeric AS reward,
        t.difficulty,
        t.category,
        t.completed_at,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.status = 'approved'
        AND ka.is_active = true
        AND t.completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      ORDER BY t.reward_amount::numeric DESC, t.completed_at DESC
      LIMIT ${limit}
    `)

    const tasks = (
      rows as unknown as {
        rows: Array<{
          task_id: number
          title: string
          emoji: string
          reward: string | number
          difficulty: string
          category: string
          completed_at: string
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
      completedAt: r.completed_at,
      kidName: r.kid_name,
      kidAvatar: r.avatar,
    }))

    let message: string
    if (tasks.length === 0) {
      message = `過去 ${days} 天還沒有 approved task、開始累積 MVP 榜吧！`
    } else {
      const mvp = tasks[0]
      message = `🏆 MVP：${mvp.emoji} ${mvp.title}（${mvp.kidAvatar} ${mvp.kidName} 賺 $${mvp.reward}）`
    }

    res.json({
      days,
      tasks,
      message,
    })
  })
)

export default router
