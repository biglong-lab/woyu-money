/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 14，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"
import { calcStreak } from "./helpers"

const router = Router()

/**
 * GET /api/family/kids/:kidId/jar-balance-history?days=30
 * 三罐每日金流（in/out）+ 當前餘額快照、前端畫累計餘額趨勢
 */
router.get(
  "/api/family/kids/:kidId/jar-balance-history",
  asyncHandler(async (req, res) => {
    const kidId = Number(req.params.kidId)
    if (isNaN(kidId)) {
      res.status(400).json({ error: "kidId 必須為數字" })
      return
    }
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90)

    const kidRow = await db.execute(sql`
      SELECT id, display_name, spend_ratio, save_ratio, give_ratio
      FROM kids_accounts WHERE id = ${kidId}
    `)
    const kidR = (
      kidRow as unknown as {
        rows: Array<{
          id: number
          display_name: string
          spend_ratio: number
          save_ratio: number
          give_ratio: number
        }>
      }
    ).rows
    if (kidR.length === 0) {
      res.status(404).json({ error: "找不到小孩" })
      return
    }
    const kid = kidR[0]

    const jarRow = await db.execute(sql`
      SELECT spend_balance, save_balance, give_balance
      FROM kids_jars WHERE kid_id = ${kidId}
    `)
    const jr = (
      jarRow as unknown as {
        rows: Array<{
          spend_balance: string
          save_balance: string
          give_balance: string
        }>
      }
    ).rows
    const currentBalance = {
      spend: jr.length > 0 ? Number(jr[0].spend_balance) : 0,
      save: jr.length > 0 ? Number(jr[0].save_balance) : 0,
      give: jr.length > 0 ? Number(jr[0].give_balance) : 0,
    }

    const flow = await db.execute(sql`
      WITH days AS (
        SELECT generate_series(
          CURRENT_DATE - (${days - 1} || ' days')::interval,
          CURRENT_DATE,
          '1 day'::interval
        )::date AS day
      ),
      income AS (
        SELECT DATE(approved_at) AS day, SUM(reward_amount)::numeric AS total
        FROM kids_tasks
        WHERE kid_id = ${kidId} AND status = 'approved'
          AND DATE(approved_at) >= CURRENT_DATE - (${days - 1} || ' days')::interval
        GROUP BY DATE(approved_at)
      ),
      outflow AS (
        SELECT spend_date AS day,
          SUM(CASE WHEN jar = 'spend' THEN amount ELSE 0 END)::numeric AS spend_out,
          SUM(CASE WHEN jar = 'save' THEN amount ELSE 0 END)::numeric AS save_out,
          SUM(CASE WHEN jar = 'give' THEN amount ELSE 0 END)::numeric AS give_out
        FROM kids_spendings
        WHERE kid_id = ${kidId}
          AND spend_date >= CURRENT_DATE - (${days - 1} || ' days')::interval
        GROUP BY spend_date
      )
      SELECT d.day,
        COALESCE(i.total, 0)::numeric AS day_income,
        COALESCE(o.spend_out, 0)::numeric AS spend_out,
        COALESCE(o.save_out, 0)::numeric AS save_out,
        COALESCE(o.give_out, 0)::numeric AS give_out
      FROM days d
      LEFT JOIN income i ON i.day = d.day
      LEFT JOIN outflow o ON o.day = d.day
      ORDER BY d.day
    `)

    const flowRows = (
      flow as unknown as {
        rows: Array<{
          day: string
          day_income: string
          spend_out: string
          save_out: string
          give_out: string
        }>
      }
    ).rows

    const spendRatio = kid.spend_ratio / 100
    const saveRatio = kid.save_ratio / 100
    const giveRatio = kid.give_ratio / 100

    const daily = flowRows.map((r) => {
      const income = Number(r.day_income)
      return {
        day: r.day,
        spendIn: Math.round(income * spendRatio * 100) / 100,
        saveIn: Math.round(income * saveRatio * 100) / 100,
        giveIn: Math.round(income * giveRatio * 100) / 100,
        spendOut: Number(r.spend_out),
        saveOut: Number(r.save_out),
        giveOut: Number(r.give_out),
      }
    })

    const totalEarned = daily.reduce((s, d) => s + d.spendIn + d.saveIn + d.giveIn, 0)
    const totalSpent = daily.reduce((s, d) => s + d.spendOut + d.saveOut + d.giveOut, 0)

    let message: string
    if (totalEarned === 0 && totalSpent === 0) {
      message = `${kid.display_name} 最近 ${days} 天還沒有金流活動`
    } else {
      message = `📊 最近 ${days} 天賺 $${Math.round(totalEarned)}、花 $${Math.round(totalSpent)}`
    }

    res.json({
      kidId,
      kidName: kid.display_name,
      days,
      ratio: {
        spend: kid.spend_ratio,
        save: kid.save_ratio,
        give: kid.give_ratio,
      },
      daily,
      currentBalance,
      totalEarned: Math.round(totalEarned * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      message,
    })
  })
)

/**
 * GET /api/family/streak-ranking
 * 每位 active kid 連續打卡天數排行
 */
router.get(
  "/api/family/streak-ranking",
  asyncHandler(async (_req, res) => {
    const kidRows = await db.execute(sql`
      SELECT id::int AS id, display_name, avatar
      FROM kids_accounts
      WHERE is_active = true
      ORDER BY id ASC
    `)
    const kids = (
      kidRows as unknown as {
        rows: Array<{ id: number; display_name: string; avatar: string }>
      }
    ).rows

    const ranking = await Promise.all(
      kids.map(async (k) => ({
        kidId: k.id,
        kidName: k.display_name,
        avatar: k.avatar,
        streak: await calcStreak(k.id),
      }))
    )

    ranking.sort((a, b) => b.streak - a.streak)

    const totalKids = ranking.length
    const champion = ranking.length > 0 && ranking[0].streak > 0 ? ranking[0] : null
    const activeStreakers = ranking.filter((r) => r.streak > 0).length
    const maxStreak = champion?.streak ?? 0

    let message: string
    if (totalKids === 0) {
      message = "家裡還沒有 active 小孩"
    } else if (champion) {
      message = `🏆 ${champion.avatar} ${champion.kidName} 連續 ${champion.streak} 天打卡、家裡 ${activeStreakers}/${totalKids} 位有 streak`
    } else {
      message = `🌱 家裡 ${totalKids} 位小孩都還沒開始 streak、今天衝第一天`
    }

    res.json({
      totalKids,
      activeStreakers,
      maxStreak,
      champion,
      ranking,
      message,
    })
  })
)

/**
 * GET /api/family/approval-lead-time?days=30
 * 小孩 submit 到家長 approve 的平均等待時間（家長回應速度）
 */
router.get(
  "/api/family/approval-lead-time",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)

    const rows = await db.execute(sql`
      SELECT
        EXTRACT(EPOCH FROM (t.approved_at - t.completed_at))::float AS lead_seconds
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.status = 'approved'
        AND t.completed_at IS NOT NULL
        AND t.approved_at IS NOT NULL
        AND t.approved_at >= t.completed_at
        AND t.approved_at >= NOW() - (${days} || ' days')::interval
        AND ka.is_active = true
    `)

    const seconds = (rows as unknown as { rows: Array<{ lead_seconds: number }> }).rows.map(
      (r) => r.lead_seconds
    )

    const taskCount = seconds.length
    const avgSec = taskCount > 0 ? seconds.reduce((s, x) => s + x, 0) / taskCount : 0
    const sorted = [...seconds].sort((a, b) => a - b)
    const minSec = sorted[0] ?? 0
    const maxSec = sorted[sorted.length - 1] ?? 0
    const medianSec = taskCount > 0 ? sorted[Math.floor(taskCount / 2)] : 0

    // Bucket：< 1h / 1-6h / 6-24h / 1-3d / 3d+
    const buckets = [
      { key: "instant", label: "< 1 小時", maxSec: 3600 },
      { key: "fast", label: "1-6 小時", maxSec: 6 * 3600 },
      { key: "day", label: "6-24 小時", maxSec: 24 * 3600 },
      { key: "slow", label: "1-3 天", maxSec: 3 * 86400 },
      { key: "stale", label: "3 天以上", maxSec: Infinity },
    ].map((b) => {
      const idx = ["instant", "fast", "day", "slow", "stale"].indexOf(b.key)
      const minSec = idx === 0 ? 0 : [3600, 6 * 3600, 24 * 3600, 3 * 86400][idx - 1]
      const count = seconds.filter((s) => s >= minSec && s < b.maxSec).length
      return {
        key: b.key,
        label: b.label,
        count,
        percentage: taskCount > 0 ? Math.round((count / taskCount) * 100) : 0,
      }
    })

    const avgHours = Math.round((avgSec / 3600) * 100) / 100
    const medianHours = Math.round((medianSec / 3600) * 100) / 100

    let speedLevel: "no_data" | "instant" | "fast" | "slow" | "very_slow"
    let message: string
    if (taskCount === 0) {
      speedLevel = "no_data"
      message = `過去 ${days} 天還沒有 submit→approve 完整紀錄`
    } else if (avgHours < 1) {
      speedLevel = "instant"
      message = `⚡ 家長平均 ${Math.round(avgSec / 60)} 分鐘內批准、即時回應`
    } else if (avgHours < 6) {
      speedLevel = "fast"
      message = `🚀 家長平均 ${avgHours} 小時內批准、回應快速`
    } else if (avgHours < 24) {
      speedLevel = "slow"
      message = `⏳ 家長平均等 ${avgHours} 小時才批准、可以更快一點`
    } else {
      speedLevel = "very_slow"
      message = `⚠️ 家長平均等 ${Math.round(avgHours / 24)} 天才批准、小孩會等到忘記`
    }

    res.json({
      days,
      taskCount,
      avgHours,
      medianHours,
      minHours: Math.round((minSec / 3600) * 100) / 100,
      maxHours: Math.round((maxSec / 3600) * 100) / 100,
      buckets,
      speedLevel,
      message,
    })
  })
)

/**
 * GET /api/family/monthly-task-creation-trend?months=6
 * 過去 N 個月家長派任務量走勢
 */
router.get(
  "/api/family/monthly-task-creation-trend",
  asyncHandler(async (req, res) => {
    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24)

    const rows = await db.execute(sql`
      WITH month_series AS (
        SELECT date_trunc('month', NOW() - (n || ' months')::interval)::date AS month_start
        FROM generate_series(0, ${months - 1}) AS n
      ),
      monthly_tasks AS (
        SELECT
          date_trunc('month', t.created_at)::date AS month_start,
          COUNT(*)::int AS task_count,
          SUM(t.reward_amount)::numeric AS total_reward
        FROM kids_tasks t
        JOIN kids_accounts ka ON ka.id = t.kid_id
        WHERE t.created_at >= date_trunc('month', NOW() - ((${months - 1}) || ' months')::interval)
          AND ka.is_active = true
        GROUP BY date_trunc('month', t.created_at)
      )
      SELECT
        TO_CHAR(ms.month_start, 'YYYY-MM') AS month,
        COALESCE(mt.task_count, 0) AS task_count,
        COALESCE(mt.total_reward, 0)::numeric AS total_reward
      FROM month_series ms
      LEFT JOIN monthly_tasks mt ON mt.month_start = ms.month_start
      ORDER BY ms.month_start
    `)

    const data = (
      rows as unknown as {
        rows: Array<{ month: string; task_count: number; total_reward: string }>
      }
    ).rows.map((r) => ({
      month: r.month,
      taskCount: r.task_count,
      totalReward: Number(r.total_reward),
    }))

    const totalTasks = data.reduce((s, m) => s + m.taskCount, 0)
    const totalReward = data.reduce((s, m) => s + m.totalReward, 0)
    const activeMonths = data.filter((m) => m.taskCount > 0).length
    const peakMonth =
      totalTasks > 0 ? data.reduce((a, b) => (a.taskCount > b.taskCount ? a : b)) : null

    let trend: "growing" | "stable" | "shrinking" | "no_data"
    let message: string
    if (totalTasks === 0) {
      trend = "no_data"
      message = `過去 ${months} 個月家裡還沒有派任務紀錄`
    } else if (data.length >= 3) {
      const recentHalf = data.slice(-Math.ceil(months / 2)).reduce((s, m) => s + m.taskCount, 0)
      const earlierHalf = data.slice(0, Math.floor(months / 2)).reduce((s, m) => s + m.taskCount, 0)
      if (recentHalf > earlierHalf * 1.5) {
        trend = "growing"
        message = `📈 ${months} 個月共派 ${totalTasks} 個任務、家長越來越積極`
      } else if (earlierHalf > 0 && recentHalf < earlierHalf * 0.6) {
        trend = "shrinking"
        message = `📉 ${months} 個月共派 ${totalTasks} 個任務、近期派發減少`
      } else {
        trend = "stable"
        message = `📊 ${months} 個月共派 ${totalTasks} 個任務（活躍 ${activeMonths} 個月）`
      }
    } else {
      trend = "stable"
      message = `${months} 個月共派 ${totalTasks} 個任務`
    }

    res.json({
      months,
      data,
      totalTasks,
      totalReward: Math.round(totalReward * 100) / 100,
      activeMonths,
      peakMonth,
      trend,
      message,
    })
  })
)

/**
 * GET /api/family/today-spending-feed?limit=20
 * 今日所有 spending 動態時間線（家長即時看小孩花錢）
 */
router.get(
  "/api/family/today-spending-feed",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)

    const rows = await db.execute(sql`
      SELECT
        s.id::int AS spending_id,
        s.amount::numeric AS amount,
        s.description,
        s.emoji,
        s.jar,
        s.recipient,
        s.created_at,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar
      FROM kids_spendings s
      JOIN kids_accounts ka ON ka.id = s.kid_id
      WHERE s.spend_date = CURRENT_DATE
        AND ka.is_active = true
      ORDER BY s.created_at DESC
      LIMIT ${limit}
    `)

    const items = (
      rows as unknown as {
        rows: Array<{
          spending_id: number
          amount: string
          description: string
          emoji: string
          jar: string
          recipient: string | null
          created_at: string
          kid_id: number
          kid_name: string
          avatar: string
        }>
      }
    ).rows.map((r) => ({
      spendingId: r.spending_id,
      amount: Number(r.amount),
      description: r.description,
      emoji: r.emoji,
      jar: r.jar,
      recipient: r.recipient,
      createdAt: r.created_at,
      kidId: r.kid_id,
      kidName: r.kid_name,
      kidAvatar: r.avatar,
    }))

    const totalAmount = items.reduce((s, i) => s + i.amount, 0)
    const uniqueKids = new Set(items.map((i) => i.kidId)).size

    let message: string
    if (items.length === 0) {
      message = "今天家裡還沒有花費紀錄"
    } else {
      message = `📋 今天家裡 ${uniqueKids} 位小孩共 ${items.length} 筆花費、累計 $${Math.round(totalAmount)}`
    }

    res.json({
      items,
      totalCount: items.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      uniqueKids,
      message,
    })
  })
)

/**
 * GET /api/family/avg-reward-by-category?days=90
 * 家庭各 category 平均 reward + 比較（家長給獎金公平度）
 */
router.get(
  "/api/family/avg-reward-by-category",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 1), 365)

    const rows = await db.execute(sql`
      SELECT
        t.category,
        COUNT(*)::int AS task_count,
        ROUND(AVG(t.reward_amount), 2)::numeric AS avg_reward,
        MIN(t.reward_amount)::numeric AS min_reward,
        MAX(t.reward_amount)::numeric AS max_reward,
        SUM(t.reward_amount)::numeric AS total_reward
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.status = 'approved'
        AND t.approved_at >= NOW() - (${days} || ' days')::interval
        AND ka.is_active = true
      GROUP BY t.category
      ORDER BY avg_reward DESC
    `)

    const data = (
      rows as unknown as {
        rows: Array<{
          category: string
          task_count: number
          avg_reward: string
          min_reward: string
          max_reward: string
          total_reward: string
        }>
      }
    ).rows

    const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
      housework: { label: "家事", emoji: "🧹" },
      study: { label: "學習", emoji: "📚" },
      self_care: { label: "自我照顧", emoji: "🪥" },
      kindness: { label: "善行", emoji: "❤️" },
      other: { label: "其他", emoji: "✨" },
    }

    const categories = data.map((r) => {
      const meta = CATEGORY_META[r.category] ?? { label: r.category, emoji: "📋" }
      return {
        category: r.category,
        label: meta.label,
        emoji: meta.emoji,
        taskCount: r.task_count,
        avgReward: Number(r.avg_reward),
        minReward: Number(r.min_reward),
        maxReward: Number(r.max_reward),
        totalReward: Number(r.total_reward),
      }
    })

    const totalCount = categories.reduce((s, c) => s + c.taskCount, 0)
    const totalReward = categories.reduce((s, c) => s + c.totalReward, 0)
    const overallAvg = totalCount > 0 ? Math.round((totalReward / totalCount) * 100) / 100 : 0
    const topCategory = categories.length > 0 ? categories[0] : null
    const lowCategory = categories.length > 1 ? categories[categories.length - 1] : null

    let message: string
    if (categories.length === 0) {
      message = `過去 ${days} 天家裡還沒有 approved 任務`
    } else if (topCategory && lowCategory && topCategory.avgReward > lowCategory.avgReward * 1.5) {
      message = `⚠️ ${topCategory.emoji} ${topCategory.label} 平均 $${topCategory.avgReward} vs ${lowCategory.emoji} ${lowCategory.label} 平均 $${lowCategory.avgReward}、差距明顯`
    } else if (topCategory) {
      message = `${topCategory.emoji} 各類別獎金均衡、平均 $${overallAvg}`
    } else {
      message = `共 ${totalCount} 筆 approved 任務`
    }

    res.json({
      days,
      categories,
      totalCount,
      totalReward: Math.round(totalReward * 100) / 100,
      overallAvg,
      topCategory,
      lowCategory,
      message,
    })
  })
)

/**
 * GET /api/family/biggest-spendings?days=30&limit=10
 * 家庭 N 天最大單筆花費 ranking
 */
router.get(
  "/api/family/biggest-spendings",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50)

    const rows = await db.execute(sql`
      SELECT
        s.id::int AS spending_id,
        s.amount::numeric AS amount,
        s.description,
        s.emoji,
        s.jar,
        s.recipient,
        s.spend_date,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar
      FROM kids_spendings s
      JOIN kids_accounts ka ON ka.id = s.kid_id
      WHERE s.spend_date >= CURRENT_DATE - (${days} || ' days')::interval
        AND ka.is_active = true
      ORDER BY s.amount DESC, s.spend_date DESC
      LIMIT ${limit}
    `)

    const spendings = (
      rows as unknown as {
        rows: Array<{
          spending_id: number
          amount: string
          description: string
          emoji: string
          jar: string
          recipient: string | null
          spend_date: string
          kid_id: number
          kid_name: string
          avatar: string
        }>
      }
    ).rows.map((r) => ({
      spendingId: r.spending_id,
      amount: Number(r.amount),
      description: r.description,
      emoji: r.emoji,
      jar: r.jar,
      recipient: r.recipient,
      spendDate: r.spend_date,
      kidId: r.kid_id,
      kidName: r.kid_name,
      kidAvatar: r.avatar,
    }))

    const topSpending = spendings.length > 0 ? spendings[0] : null
    const grandTotal = spendings.reduce((s, x) => s + x.amount, 0)

    let message: string
    if (spendings.length === 0) {
      message = `過去 ${days} 天家裡還沒有花費紀錄`
    } else if (topSpending) {
      message = `💸 過去 ${days} 天最大單筆是 ${topSpending.kidAvatar} ${topSpending.kidName} 的「${topSpending.description}」($${topSpending.amount})`
    } else {
      message = `共 ${spendings.length} 筆、累計 $${Math.round(grandTotal)}`
    }

    res.json({
      days,
      spendings,
      spendingCount: spendings.length,
      topSpending,
      grandTotal: Math.round(grandTotal * 100) / 100,
      message,
    })
  })
)

export default router
