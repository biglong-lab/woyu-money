/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 15，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"

const router = Router()

/**
 * GET /api/family/monthly-spending-trend?months=6
 * 過去 N 個月家庭 spending 走勢（花費習慣）
 */
router.get(
  "/api/family/monthly-spending-trend",
  asyncHandler(async (req, res) => {
    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24)

    const rows = await db.execute(sql`
      WITH month_series AS (
        SELECT date_trunc('month', NOW() - (n || ' months')::interval)::date AS month_start
        FROM generate_series(0, ${months - 1}) AS n
      ),
      monthly_spend AS (
        SELECT
          date_trunc('month', s.spend_date)::date AS month_start,
          COUNT(*)::int AS spend_count,
          SUM(s.amount)::numeric AS total_spent,
          COUNT(DISTINCT s.kid_id)::int AS unique_kids
        FROM kids_spendings s
        JOIN kids_accounts ka ON ka.id = s.kid_id
        WHERE s.spend_date >= date_trunc('month', NOW() - ((${months - 1}) || ' months')::interval)
          AND ka.is_active = true
        GROUP BY date_trunc('month', s.spend_date)
      )
      SELECT
        TO_CHAR(ms.month_start, 'YYYY-MM') AS month,
        COALESCE(msp.spend_count, 0) AS spend_count,
        COALESCE(msp.total_spent, 0)::numeric AS total_spent,
        COALESCE(msp.unique_kids, 0) AS unique_kids
      FROM month_series ms
      LEFT JOIN monthly_spend msp ON msp.month_start = ms.month_start
      ORDER BY ms.month_start
    `)

    const data = (
      rows as unknown as {
        rows: Array<{
          month: string
          spend_count: number
          total_spent: string
          unique_kids: number
        }>
      }
    ).rows.map((r) => ({
      month: r.month,
      spendCount: r.spend_count,
      totalSpent: Number(r.total_spent),
      uniqueKids: r.unique_kids,
    }))

    const totalSpent = data.reduce((s, m) => s + m.totalSpent, 0)
    const totalCount = data.reduce((s, m) => s + m.spendCount, 0)
    const activeMonths = data.filter((m) => m.spendCount > 0).length
    const peakMonth =
      totalCount > 0 ? data.reduce((a, b) => (a.totalSpent > b.totalSpent ? a : b)) : null

    let trend: "growing" | "stable" | "shrinking" | "no_data"
    let message: string
    if (totalCount === 0) {
      trend = "no_data"
      message = `過去 ${months} 個月家裡還沒有花費紀錄`
    } else if (data.length >= 3) {
      const recentHalf = data.slice(-Math.ceil(months / 2)).reduce((s, m) => s + m.totalSpent, 0)
      const earlierHalf = data
        .slice(0, Math.floor(months / 2))
        .reduce((s, m) => s + m.totalSpent, 0)
      if (recentHalf > earlierHalf * 1.5) {
        trend = "growing"
        message = `📈 ${months} 個月共花 $${Math.round(totalSpent)}、近期花費上升`
      } else if (earlierHalf > 0 && recentHalf < earlierHalf * 0.6) {
        trend = "shrinking"
        message = `📉 ${months} 個月共花 $${Math.round(totalSpent)}、近期花費下降（更省了）`
      } else {
        trend = "stable"
        message = `📊 ${months} 個月共花 $${Math.round(totalSpent)}（活躍 ${activeMonths} 個月）`
      }
    } else {
      trend = "stable"
      message = `${months} 個月共花 $${Math.round(totalSpent)}`
    }

    res.json({
      months,
      data,
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalCount,
      activeMonths,
      peakMonth,
      trend,
      message,
    })
  })
)

/**
 * GET /api/family/wishes-aging
 * wished 狀態願望放置天數分桶（看小孩決策延遲傾向）
 */
router.get(
  "/api/family/wishes-aging",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        w.id::int AS wish_id,
        w.title,
        w.emoji,
        w.priority,
        w.estimated_price::numeric AS price,
        w.created_at,
        EXTRACT(DAY FROM (NOW() - w.created_at))::int AS age_days,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar
      FROM kids_wishes w
      JOIN kids_accounts ka ON ka.id = w.kid_id
      WHERE w.status = 'wished'
        AND ka.is_active = true
      ORDER BY w.created_at ASC
    `)

    const wishes = (
      rows as unknown as {
        rows: Array<{
          wish_id: number
          title: string
          emoji: string
          priority: number
          price: string | null
          created_at: string
          age_days: number
          kid_id: number
          kid_name: string
          avatar: string
        }>
      }
    ).rows.map((r) => ({
      wishId: r.wish_id,
      title: r.title,
      emoji: r.emoji,
      priority: r.priority,
      price: r.price ? Number(r.price) : null,
      createdAt: r.created_at,
      ageDays: r.age_days,
      kidId: r.kid_id,
      kidName: r.kid_name,
      kidAvatar: r.avatar,
    }))

    const BUCKETS = [
      { key: "fresh", label: "新願望", maxDays: 7, emoji: "🆕" },
      { key: "thinking", label: "考慮中", maxDays: 30, emoji: "💭" },
      { key: "stale", label: "放置久", maxDays: 90, emoji: "⏳" },
      { key: "ancient", label: "陳舊", maxDays: Infinity, emoji: "🦴" },
    ] as const

    const buckets = BUCKETS.map((b) => {
      const inBucket = wishes.filter((w) => {
        const idx = BUCKETS.findIndex((bk) => bk.key === b.key)
        const minDays = idx === 0 ? 0 : BUCKETS[idx - 1].maxDays
        return w.ageDays >= minDays && w.ageDays < b.maxDays
      })
      return {
        key: b.key,
        label: b.label,
        emoji: b.emoji,
        wishCount: inBucket.length,
        totalValue: inBucket.reduce((s, w) => s + (w.price ?? 0), 0),
      }
    })

    const totalWishes = wishes.length
    const oldest = wishes.length > 0 ? wishes[0] : null
    const averageAge =
      totalWishes > 0 ? Math.round(wishes.reduce((s, w) => s + w.ageDays, 0) / totalWishes) : 0
    const ancientCount = buckets.find((b) => b.key === "ancient")?.wishCount ?? 0

    let message: string
    if (totalWishes === 0) {
      message = "家裡 wished 願望清單為空 ✨"
    } else if (ancientCount > 0) {
      message = `🦴 有 ${ancientCount} 個願望放超過 90 天、可以鼓勵小孩決定升級或放棄`
    } else if (oldest && oldest.ageDays > 60) {
      message = `⏳ 最老願望放了 ${oldest.ageDays} 天（${oldest.kidName}「${oldest.title}」)`
    } else {
      message = `✨ 家裡 ${totalWishes} 個 wished 願望、平均放置 ${averageAge} 天`
    }

    res.json({
      totalWishes,
      buckets,
      oldest,
      averageAge,
      ancientCount,
      message,
    })
  })
)

/**
 * GET /api/family/top-task-emojis?days=90&limit=10
 * 家庭 N 天 task emoji 使用排行（家庭文化）
 */
router.get(
  "/api/family/top-task-emojis",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 1), 365)
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30)

    const rows = await db.execute(sql`
      SELECT
        t.emoji,
        COUNT(*)::int AS use_count,
        COUNT(DISTINCT t.kid_id)::int AS unique_kids
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.created_at >= NOW() - (${days} || ' days')::interval
        AND ka.is_active = true
        AND t.emoji IS NOT NULL
        AND length(trim(t.emoji)) > 0
      GROUP BY t.emoji
      ORDER BY use_count DESC
      LIMIT ${limit}
    `)

    const emojis = (
      rows as unknown as {
        rows: Array<{ emoji: string; use_count: number; unique_kids: number }>
      }
    ).rows.map((r) => ({
      emoji: r.emoji,
      useCount: r.use_count,
      uniqueKids: r.unique_kids,
    }))

    const totalCount = emojis.reduce((s, e) => s + e.useCount, 0)
    const topEmoji = emojis.length > 0 ? emojis[0] : null
    const emojisWithPct = emojis.map((e) => ({
      ...e,
      percentage: totalCount > 0 ? Math.round((e.useCount / totalCount) * 100) : 0,
    }))

    let message: string
    if (emojis.length === 0) {
      message = `過去 ${days} 天家裡還沒有 emoji 任務紀錄`
    } else if (topEmoji) {
      message = `${topEmoji.emoji} 家裡 ${days} 天最愛用「${topEmoji.emoji}」(${topEmoji.useCount} 次)`
    } else {
      message = `共 ${emojis.length} 種 emoji、${totalCount} 次使用`
    }

    res.json({
      days,
      emojis: emojisWithPct,
      emojiCount: emojis.length,
      totalCount,
      topEmoji,
      message,
    })
  })
)

/**
 * GET /api/family/kids-needing-attention?days=7
 * 過去 N 天家長沒任何 approve activity 的 active kids（提醒關注）
 */
router.get(
  "/api/family/kids-needing-attention",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 60)

    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        MAX(t.approved_at) AS last_approve,
        (EXTRACT(EPOCH FROM (NOW() - COALESCE(MAX(t.approved_at), ka.created_at)))/86400)::int AS days_since
      FROM kids_accounts ka
      LEFT JOIN kids_tasks t ON t.kid_id = ka.id AND t.status = 'approved'
      WHERE ka.is_active = true
      GROUP BY ka.id, ka.display_name, ka.avatar, ka.created_at
      HAVING MAX(t.approved_at) IS NULL
         OR MAX(t.approved_at) < NOW() - (${days} || ' days')::interval
      ORDER BY days_since DESC NULLS LAST
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          last_approve: string | null
          days_since: number
        }>
      }
    ).rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      lastApprove: r.last_approve,
      daysSinceLastApprove: r.days_since,
    }))

    const maxDays = kids.length > 0 ? Math.max(...kids.map((k) => k.daysSinceLastApprove)) : 0

    let level: "ok" | "warn" | "alert"
    let message: string
    if (kids.length === 0) {
      level = "ok"
      message = `✅ 過去 ${days} 天每位小孩都被家長 approve 過、互動健康`
    } else if (maxDays >= 14) {
      level = "alert"
      message = `🚨 有 ${kids.length} 位小孩超過 ${maxDays} 天沒被家長 approve、快去看看`
    } else {
      level = "warn"
      message = `⏳ 有 ${kids.length} 位小孩 ${days}+ 天沒互動、家長可以鼓勵一下`
    }

    res.json({
      days,
      kids,
      kidCount: kids.length,
      maxDaysSince: maxDays,
      level,
      message,
    })
  })
)

/**
 * GET /api/family/family-weekend-vs-weekday?days=30
 * 家庭 N 天 approved task 週末 vs 工作日分布 + 7 日分布
 */
router.get(
  "/api/family/family-weekend-vs-weekday",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)

    const rows = await db.execute(sql`
      SELECT
        EXTRACT(DOW FROM t.approved_at)::int AS dow,
        COUNT(*)::int AS task_count
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.status = 'approved'
        AND t.approved_at IS NOT NULL
        AND t.approved_at >= NOW() - (${days} || ' days')::interval
        AND ka.is_active = true
      GROUP BY EXTRACT(DOW FROM t.approved_at)
    `)

    const flow = (rows as unknown as { rows: Array<{ dow: number; task_count: number }> }).rows

    const dowMap = new Map(flow.map((r) => [r.dow, r.task_count]))
    const DAY_LABELS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"]

    const byDay = Array.from({ length: 7 }, (_, i) => ({
      dow: i,
      label: DAY_LABELS[i],
      taskCount: dowMap.get(i) ?? 0,
      isWeekend: i === 0 || i === 6,
    }))

    const weekendCount = byDay.filter((d) => d.isWeekend).reduce((s, d) => s + d.taskCount, 0)
    const weekdayCount = byDay.filter((d) => !d.isWeekend).reduce((s, d) => s + d.taskCount, 0)
    const totalCount = weekendCount + weekdayCount

    const weekendPct = totalCount > 0 ? Math.round((weekendCount / totalCount) * 100) : 0
    const weekdayPct = totalCount > 0 ? Math.round((weekdayCount / totalCount) * 100) : 0

    // 每日「平均」更公平：weekend 2 天 vs weekday 5 天
    const weekendAvg = weekendCount / 2
    const weekdayAvg = weekdayCount / 5
    const peakDay =
      totalCount > 0 ? byDay.reduce((a, b) => (a.taskCount > b.taskCount ? a : b)) : null

    let pattern: "no_data" | "weekend_focused" | "weekday_focused" | "balanced"
    let message: string
    if (totalCount === 0) {
      pattern = "no_data"
      message = `過去 ${days} 天家裡還沒有 approved 任務`
    } else if (weekendAvg > weekdayAvg * 1.5) {
      pattern = "weekend_focused"
      message = `🏖️ 家裡偏「週末派」(週末日均 ${weekendAvg.toFixed(1)} vs 平日 ${weekdayAvg.toFixed(1)})`
    } else if (weekdayAvg > weekendAvg * 1.5) {
      pattern = "weekday_focused"
      message = `📚 家裡偏「平日派」(平日日均 ${weekdayAvg.toFixed(1)} vs 週末 ${weekendAvg.toFixed(1)})`
    } else {
      pattern = "balanced"
      message = `⚖️ 家裡作息均衡（週末 ${weekendPct}% / 平日 ${weekdayPct}%）`
    }

    res.json({
      days,
      totalCount,
      weekendCount,
      weekdayCount,
      weekendPct,
      weekdayPct,
      byDay,
      peakDay,
      pattern,
      message,
    })
  })
)

/**
 * GET /api/family/wish-promotion-rate?days=90
 * 家庭 N 天 wish 升級為 goal 的比例（小孩判斷成熟度）
 */
router.get(
  "/api/family/wish-promotion-rate",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 1), 365)

    const rows = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total_wishes,
        COUNT(*) FILTER (WHERE w.status = 'promoted_to_goal')::int AS promoted,
        COUNT(*) FILTER (WHERE w.status = 'wished')::int AS still_wished,
        COUNT(*) FILTER (WHERE w.status = 'abandoned')::int AS abandoned,
        COUNT(DISTINCT w.kid_id)::int AS unique_kids
      FROM kids_wishes w
      JOIN kids_accounts ka ON ka.id = w.kid_id
      WHERE w.created_at >= NOW() - (${days} || ' days')::interval
        AND ka.is_active = true
    `)

    const r = (
      rows as unknown as {
        rows: Array<{
          total_wishes: number
          promoted: number
          still_wished: number
          abandoned: number
          unique_kids: number
        }>
      }
    ).rows[0]

    const total = r?.total_wishes ?? 0
    const promoted = r?.promoted ?? 0
    const stillWished = r?.still_wished ?? 0
    const abandoned = r?.abandoned ?? 0
    const uniqueKids = r?.unique_kids ?? 0

    const decided = promoted + abandoned
    const promotionRate = total > 0 ? Math.round((promoted / total) * 100) : 0
    const abandonmentRate = total > 0 ? Math.round((abandoned / total) * 100) : 0
    const decisionRate = total > 0 ? Math.round((decided / total) * 100) : 0

    let maturityLevel: "no_data" | "starting" | "thinking" | "deciding" | "mature"
    let message: string
    if (total === 0) {
      maturityLevel = "no_data"
      message = `過去 ${days} 天家裡還沒有願望紀錄`
    } else if (decisionRate < 20) {
      maturityLevel = "starting"
      message = `🌱 ${days} 天有 ${total} 個願望、大多還在觀望（${decisionRate}% 決策率）`
    } else if (decisionRate < 50) {
      maturityLevel = "thinking"
      message = `💭 ${days} 天 ${total} 個願望中 ${decisionRate}% 已決策（${promoted} 升級 / ${abandoned} 放棄）`
    } else if (promotionRate >= 50) {
      maturityLevel = "mature"
      message = `🎯 ${days} 天 ${promotionRate}% 願望升級為目標、判斷成熟`
    } else {
      maturityLevel = "deciding"
      message = `⚖️ ${days} 天 ${total} 個願望、${decisionRate}% 已決策（${promoted} 升級 / ${abandoned} 放棄）`
    }

    res.json({
      days,
      total,
      promoted,
      stillWished,
      abandoned,
      uniqueKids,
      promotionRate,
      abandonmentRate,
      decisionRate,
      maturityLevel,
      message,
    })
  })
)

/**
 * GET /api/family/spending-summary?days=30
 * 家庭 N 天三罐花費分布（spend/save/give outflow）
 */
router.get(
  "/api/family/spending-summary",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)

    const rows = await db.execute(sql`
      SELECT
        s.jar,
        COUNT(*)::int AS spend_count,
        COALESCE(SUM(s.amount), 0)::numeric AS total_amount,
        COUNT(DISTINCT s.kid_id)::int AS unique_kids
      FROM kids_spendings s
      JOIN kids_accounts ka ON ka.id = s.kid_id
      WHERE s.spend_date >= CURRENT_DATE - (${days} || ' days')::interval
        AND ka.is_active = true
      GROUP BY s.jar
    `)

    const data = (
      rows as unknown as {
        rows: Array<{
          jar: string
          spend_count: number
          total_amount: string
          unique_kids: number
        }>
      }
    ).rows

    const JAR_META: Record<string, { label: string; emoji: string; color: string }> = {
      spend: { label: "花用", emoji: "💸", color: "rose" },
      save: { label: "存錢", emoji: "🐷", color: "emerald" },
      give: { label: "給予", emoji: "❤️", color: "pink" },
    }

    const jars = ["spend", "save", "give"].map((j) => {
      const r = data.find((d) => d.jar === j)
      const meta = JAR_META[j]
      return {
        jar: j,
        label: meta.label,
        emoji: meta.emoji,
        color: meta.color,
        spendCount: r?.spend_count ?? 0,
        totalAmount: Number(r?.total_amount ?? 0),
        uniqueKids: r?.unique_kids ?? 0,
      }
    })

    const totalAmount = jars.reduce((s, j) => s + j.totalAmount, 0)
    const totalCount = jars.reduce((s, j) => s + j.spendCount, 0)
    const jarsWithPct = jars.map((j) => ({
      ...j,
      percentage: totalAmount > 0 ? Math.round((j.totalAmount / totalAmount) * 100) : 0,
    }))

    const topJar =
      totalAmount > 0 ? jarsWithPct.reduce((a, b) => (a.totalAmount > b.totalAmount ? a : b)) : null

    let message: string
    if (totalCount === 0) {
      message = `過去 ${days} 天家裡還沒有花費紀錄`
    } else if (topJar) {
      message = `${topJar.emoji} 過去 ${days} 天主要花在「${topJar.label}」($${Math.round(topJar.totalAmount)}、${topJar.percentage}%)`
    } else {
      message = `共 ${totalCount} 筆花費、總計 $${Math.round(totalAmount)}`
    }

    res.json({
      days,
      jars: jarsWithPct,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalCount,
      topJar,
      message,
    })
  })
)

/**
 * GET /api/family/family-checkin-streak
 * 家庭整體打卡連續天數（至少一位小孩當日有 checkin 才算連續）
 */
router.get(
  "/api/family/family-checkin-streak",
  asyncHandler(async (_req, res) => {
    // 抓過去 60 天有 checkin 的日期 set
    const rows = await db.execute(sql`
      SELECT c.checkin_date::text AS day
      FROM kids_checkins c
      JOIN kids_accounts ka ON ka.id = c.kid_id
      WHERE c.checkin_date >= CURRENT_DATE - INTERVAL '60 days'
        AND ka.is_active = true
      GROUP BY c.checkin_date
    `)

    const daysSet = new Set(
      (rows as unknown as { rows: Array<{ day: string }> }).rows.map((r) => r.day)
    )

    // 用 local date format（PG 的 date::text 也是 local YYYY-MM-DD、不含 timezone）
    const fmt = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const dd = String(d.getDate()).padStart(2, "0")
      return `${y}-${m}-${dd}`
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = fmt(today)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = fmt(yesterday)

    let startDate: Date | null = null
    if (daysSet.has(todayStr)) startDate = today
    else if (daysSet.has(yesterdayStr)) startDate = yesterday

    let streak = 0
    let lastCheckinDate: string | null = null

    if (startDate) {
      const cursor = new Date(startDate)
      while (daysSet.has(fmt(cursor))) {
        if (!lastCheckinDate) lastCheckinDate = fmt(cursor)
        streak++
        cursor.setDate(cursor.getDate() - 1)
      }
    }

    let level: "none" | "starting" | "good" | "great" | "legend"
    let message: string
    if (streak === 0) {
      level = "none"
      message = "家裡今天還沒有人簽到、開始連續打卡之旅 🌱"
    } else if (streak < 3) {
      level = "starting"
      message = `🌱 家裡連續 ${streak} 天打卡、繼續加油`
    } else if (streak < 7) {
      level = "good"
      message = `🔥 家裡連續 ${streak} 天打卡、養成習慣中`
    } else if (streak < 30) {
      level = "great"
      message = `🚀 家裡連續 ${streak} 天打卡、太棒了！`
    } else {
      level = "legend"
      message = `🏆 家裡連續 ${streak} 天打卡、傳奇家庭！`
    }

    res.json({
      streak,
      lastCheckinDate,
      level,
      message,
    })
  })
)

export default router
