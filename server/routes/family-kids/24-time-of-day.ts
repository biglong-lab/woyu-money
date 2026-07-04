/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 24，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"
import { localDateTPE } from "@shared/date-utils"

const router = Router()

/**
 * GET /api/family/time-of-day?days=30
 * 全家任務過去 N 天的 4 時段分佈（morning/afternoon/evening/late）
 */
router.get(
  "/api/family/time-of-day",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90)

    const rows = await db.execute(sql`
      WITH t AS (
        SELECT completed_at AT TIME ZONE 'Asia/Taipei' AS ts
        FROM kids_tasks
        WHERE status = 'approved'
          AND completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      )
      SELECT
        SUM(CASE WHEN EXTRACT(HOUR FROM ts) >= 6 AND EXTRACT(HOUR FROM ts) < 12 THEN 1 ELSE 0 END)::int AS morning,
        SUM(CASE WHEN EXTRACT(HOUR FROM ts) >= 12 AND EXTRACT(HOUR FROM ts) < 18 THEN 1 ELSE 0 END)::int AS afternoon,
        SUM(CASE WHEN EXTRACT(HOUR FROM ts) >= 18 AND EXTRACT(HOUR FROM ts) < 22 THEN 1 ELSE 0 END)::int AS evening,
        SUM(CASE WHEN EXTRACT(HOUR FROM ts) >= 22 OR EXTRACT(HOUR FROM ts) < 6 THEN 1 ELSE 0 END)::int AS late,
        COUNT(*)::int AS total
      FROM t
    `)
    const row = (
      rows as unknown as {
        rows: Array<{
          morning: number
          afternoon: number
          evening: number
          late: number
          total: number
        }>
      }
    ).rows[0]

    const slots = {
      morning: row?.morning ?? 0,
      afternoon: row?.afternoon ?? 0,
      evening: row?.evening ?? 0,
      late: row?.late ?? 0,
    }
    const total = row?.total ?? 0

    const SLOT_LABELS: Record<string, string> = {
      morning: "🌅 早晨 6-12",
      afternoon: "☀️ 下午 12-18",
      evening: "🌆 晚上 18-22",
      late: "🌙 深夜 22-6",
    }

    let dominantSlot: "morning" | "afternoon" | "evening" | "late" | null = null
    let dominantCount = -1
    for (const key of Object.keys(slots) as Array<keyof typeof slots>) {
      if (slots[key] > dominantCount) {
        dominantCount = slots[key]
        dominantSlot = key
      }
    }

    let message: string
    if (total === 0) {
      message = `過去 ${days} 天還沒任務完成、開始第一個吧！`
      dominantSlot = null
    } else if (dominantSlot === "morning") {
      message = `🌅 家裡是早鳥型！${dominantCount} 個任務在早晨完成`
    } else if (dominantSlot === "afternoon") {
      message = `☀️ 家裡下午最活躍（${dominantCount} 個任務）`
    } else if (dominantSlot === "evening") {
      message = `🌆 家裡晚上是黃金時段（${dominantCount} 個任務）`
    } else {
      message = `🌙 家裡深夜還在做任務（${dominantCount} 個）、注意休息`
    }

    res.json({
      days,
      slots,
      slotsLabeled: {
        morning: { label: SLOT_LABELS.morning, count: slots.morning },
        afternoon: { label: SLOT_LABELS.afternoon, count: slots.afternoon },
        evening: { label: SLOT_LABELS.evening, count: slots.evening },
        late: { label: SLOT_LABELS.late, count: slots.late },
      },
      total,
      dominantSlot,
      message,
    })
  })
)

/**
 * GET /api/family/kid-growth-stage?kidId=
 * 個別小孩成長階段（綜合資歷 / 任務 / 打卡 / 目標完成）
 * stage: newbie / learner / regular / veteran / legend
 */
router.get(
  "/api/family/kid-growth-stage",
  asyncHandler(async (req, res) => {
    const kidId = Number(req.query.kidId)
    if (!Number.isInteger(kidId) || kidId < 1) throw new AppError(400, "需傳 kidId")

    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        ka.created_at AS account_created_at,
        EXTRACT(DAY FROM (NOW() - ka.created_at))::int AS account_age_days,
        (SELECT COUNT(*)::int FROM kids_tasks WHERE kid_id = ka.id AND status = 'approved') AS tasks_approved,
        (SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric FROM kids_tasks WHERE kid_id = ka.id AND status = 'approved') AS lifetime_earned,
        (SELECT COUNT(DISTINCT checkin_date)::int FROM kids_checkins WHERE kid_id = ka.id) AS checkin_days,
        (SELECT COUNT(*)::int FROM kids_goals WHERE kid_id = ka.id AND status = 'completed') AS goals_completed,
        (SELECT COUNT(*)::int FROM kids_badges WHERE kid_id = ka.id) AS badges_earned
      FROM kids_accounts ka
      WHERE ka.id = ${kidId} AND ka.is_active = true
    `)
    const row = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          account_age_days: number
          tasks_approved: number
          lifetime_earned: string | number
          checkin_days: number
          goals_completed: number
          badges_earned: number
        }>
      }
    ).rows[0]
    if (!row) throw new AppError(404, "小孩不存在")

    const age = row.account_age_days ?? 0
    const tasks = row.tasks_approved ?? 0
    const earned = Number(row.lifetime_earned)
    const checkins = row.checkin_days ?? 0
    const goals = row.goals_completed ?? 0
    const badges = row.badges_earned ?? 0

    const score = tasks * 2 + goals * 5 + checkins * 0.5 + badges * 3 + Math.floor(earned / 100)

    let stage: "newbie" | "learner" | "regular" | "veteran" | "legend"
    let stageLabel: string
    let nextThreshold: number
    let currentThreshold: number

    if (age < 7 || score < 10) {
      stage = "newbie"
      stageLabel = "🌱 新手起步"
      currentThreshold = 0
      nextThreshold = 10
    } else if (score < 50) {
      stage = "learner"
      stageLabel = "📚 成長學習中"
      currentThreshold = 10
      nextThreshold = 50
    } else if (score < 150) {
      stage = "regular"
      stageLabel = "🎯 穩定階段"
      currentThreshold = 50
      nextThreshold = 150
    } else if (score < 400) {
      stage = "veteran"
      stageLabel = "⭐ 資深玩家"
      currentThreshold = 150
      nextThreshold = 400
    } else {
      stage = "legend"
      stageLabel = "🏆 家庭傳奇"
      currentThreshold = 400
      nextThreshold = 400
    }

    const progressInStage =
      nextThreshold > currentThreshold
        ? Math.min(
            100,
            Math.round(((score - currentThreshold) / (nextThreshold - currentThreshold)) * 100)
          )
        : 100

    let nextMilestone: string
    if (stage === "legend") {
      nextMilestone = "🏆 已達最高階段、繼續維持！"
    } else {
      const needed = Math.ceil(nextThreshold - score)
      nextMilestone = `還差 ${needed} 分到下個階段（多做任務 / 打卡 / 完成目標）`
    }

    res.json({
      kidId: row.kid_id,
      kidName: row.kid_name,
      avatar: row.avatar,
      metrics: {
        accountAgeDays: age,
        tasksApproved: tasks,
        lifetimeEarned: earned,
        checkinDays: checkins,
        goalsCompleted: goals,
        badgesEarned: badges,
      },
      score: Math.round(score),
      stage,
      stageLabel,
      progressInStage,
      nextMilestone,
    })
  })
)

/**
 * GET /api/family/activity-streak?lookback=90
 * 全家整體 streak（至少有 1 任務通過 或 打卡 或 spending 算當天活躍）
 * 計算：當前 streak（從今天倒推連續活躍天數）+ 歷史最長 + 過去 N 天活躍率
 */
router.get(
  "/api/family/activity-streak",
  asyncHandler(async (req, res) => {
    const lookback = Math.min(Math.max(Number(req.query.lookback) || 90, 7), 365)

    const rows = await db.execute(sql`
      WITH days AS (
        SELECT generate_series(
          CURRENT_DATE - (${lookback - 1}::int * INTERVAL '1 day'),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS d
      )
      SELECT
        d.d::text AS date,
        (
          EXISTS (SELECT 1 FROM kids_tasks WHERE status = 'approved' AND DATE(completed_at) = d.d)
          OR EXISTS (SELECT 1 FROM kids_checkins WHERE checkin_date = d.d)
          OR EXISTS (SELECT 1 FROM kids_spendings WHERE spend_date = d.d)
        ) AS active
      FROM days d
      ORDER BY d.d ASC
    `)

    const daysArr = (rows as unknown as { rows: Array<{ date: string; active: boolean }> }).rows

    // 算當前 streak（從最後一天往前數連續 true）
    let currentStreak = 0
    for (let i = daysArr.length - 1; i >= 0; i--) {
      if (daysArr[i].active) currentStreak++
      else break
    }

    // 歷史最長
    let longestStreak = 0
    let temp = 0
    for (const d of daysArr) {
      if (d.active) {
        temp++
        if (temp > longestStreak) longestStreak = temp
      } else {
        temp = 0
      }
    }

    const activeDaysCount = daysArr.filter((d) => d.active).length
    const activeRatio = Math.round((activeDaysCount / lookback) * 100)

    let level: "legendary" | "great" | "good" | "starting" | "inactive"
    let message: string
    if (currentStreak >= 30) {
      level = "legendary"
      message = `🏆 連續活躍 ${currentStreak} 天、家庭傳奇！`
    } else if (currentStreak >= 14) {
      level = "great"
      message = `🔥 連續 ${currentStreak} 天、超棒！`
    } else if (currentStreak >= 3) {
      level = "good"
      message = `🌱 連續 ${currentStreak} 天活躍、保持住！`
    } else if (currentStreak >= 1) {
      level = "starting"
      message = `✨ 今天有活動、開始累積 streak！`
    } else {
      level = "inactive"
      message = "今天還沒人活動、誰要打破沉默？"
    }

    res.json({
      currentStreak,
      longestStreak,
      activeDaysCount,
      lookback,
      activeRatio,
      level,
      message,
    })
  })
)

/**
 * GET /api/family/kid-task-variety?kidId=&days=30
 * 個別小孩過去 N 天任務多樣性：嘗試過幾個不同 title / category / difficulty
 * diversity: high(>=5 categories) / medium(3-4) / low(1-2) / none
 */
router.get(
  "/api/family/kid-task-variety",
  asyncHandler(async (req, res) => {
    const kidId = Number(req.query.kidId)
    if (!Number.isInteger(kidId) || kidId < 1) throw new AppError(400, "需傳 kidId")
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)

    const rows = await db.execute(sql`
      WITH approved AS (
        SELECT title, category, difficulty
        FROM kids_tasks
        WHERE kid_id = ${kidId}
          AND status = 'approved'
          AND completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      )
      SELECT
        (SELECT COUNT(*)::int FROM approved) AS total_tasks,
        (SELECT COUNT(DISTINCT title)::int FROM approved) AS unique_titles,
        (SELECT COUNT(DISTINCT category)::int FROM approved) AS unique_categories,
        (SELECT COUNT(DISTINCT difficulty)::int FROM approved) AS unique_difficulties
    `)

    const row = (
      rows as unknown as {
        rows: Array<{
          total_tasks: number
          unique_titles: number
          unique_categories: number
          unique_difficulties: number
        }>
      }
    ).rows[0]

    const catRows = await db.execute(sql`
      SELECT category, COUNT(*)::int AS n
      FROM kids_tasks
      WHERE kid_id = ${kidId}
        AND status = 'approved'
        AND completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      GROUP BY category
      ORDER BY n DESC
    `)
    const byCategory = (catRows as unknown as { rows: Array<{ category: string; n: number }> }).rows

    const totalTasks = row?.total_tasks ?? 0
    const uniqueTitles = row?.unique_titles ?? 0
    const uniqueCategories = row?.unique_categories ?? 0
    const uniqueDifficulties = row?.unique_difficulties ?? 0

    const CAT_LABELS: Record<string, string> = {
      housework: "🧹 家事",
      study: "📚 學習",
      self_care: "🧴 自我照顧",
      kindness: "💝 善行",
      other: "📋 其他",
    }

    let diversity: "high" | "medium" | "low" | "none"
    let message: string
    if (totalTasks === 0) {
      diversity = "none"
      message = `過去 ${days} 天還沒完成任務、開始第一個吧！`
    } else if (uniqueCategories >= 5) {
      diversity = "high"
      message = `🌈 嘗試了全部 ${uniqueCategories} 個類別、超全方位！`
    } else if (uniqueCategories >= 3) {
      diversity = "medium"
      message = `🎨 嘗試過 ${uniqueCategories} 個類別、多元發展`
    } else if (uniqueCategories >= 1) {
      diversity = "low"
      message = `🌱 主要做了 ${uniqueCategories} 個類別、試試新類型吧`
    } else {
      diversity = "none"
      message = "尚未分類、加油完成任務"
    }

    res.json({
      kidId,
      summary: {
        totalTasks,
        uniqueTitles,
        uniqueCategories,
        uniqueDifficulties,
        days,
      },
      byCategory: byCategory.map((c) => ({
        category: c.category,
        label: CAT_LABELS[c.category] ?? c.category,
        count: c.n,
      })),
      diversity,
      message,
    })
  })
)

/**
 * GET /api/family/task-creation-cadence?days=30
 * 家長派任務 cadence 分析：每天派幾個 + 星期分佈 + 連續沒派警告
 * 含所有 status 的 task（按 created_at）
 */
router.get(
  "/api/family/task-creation-cadence",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90)

    // 每天派任務數
    const daily = await db.execute(sql`
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
        (SELECT COUNT(*)::int FROM kids_tasks WHERE DATE(created_at) = d.d) AS created
      FROM days d
      ORDER BY d.d ASC
    `)

    const dailyArr = (
      daily as unknown as { rows: Array<{ date: string; weekday: string; created: number }> }
    ).rows

    // 星期幾分佈（0=Sun ... 6=Sat → 用 ISO Mon-Sun）
    const byWeekday: Record<string, number> = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    }
    for (const d of dailyArr) {
      const wd = d.weekday.slice(0, 3)
      if (wd in byWeekday) byWeekday[wd] += d.created
    }

    const totalCreated = dailyArr.reduce((s, d) => s + d.created, 0)
    const avgPerDay = totalCreated / days
    const busiest = dailyArr.reduce((best, d) => (d.created > best.created ? d : best), dailyArr[0])

    // 連續沒派天數（從今天往回算）
    let consecutiveDryDays = 0
    for (let i = dailyArr.length - 1; i >= 0; i--) {
      if (dailyArr[i].created === 0) {
        consecutiveDryDays++
      } else {
        break
      }
    }

    // 找最愛派的星期
    const sortedWeekdays = Object.entries(byWeekday).sort((a, b) => b[1] - a[1])
    const favWeekday = sortedWeekdays[0][1] > 0 ? sortedWeekdays[0][0] : null

    let cadenceLevel: "very_active" | "active" | "occasional" | "rare" | "none"
    let message: string
    if (totalCreated === 0) {
      cadenceLevel = "none"
      message = `過去 ${days} 天都沒派任務、開始第一個吧！`
    } else if (avgPerDay >= 2) {
      cadenceLevel = "very_active"
      message = `🚀 平均每天派 ${avgPerDay.toFixed(1)} 個、超積極家長！`
    } else if (avgPerDay >= 1) {
      cadenceLevel = "active"
      message = `💪 平均每天派 ${avgPerDay.toFixed(1)} 個、節奏穩定`
    } else if (avgPerDay >= 0.3) {
      cadenceLevel = "occasional"
      message = `📋 平均每 ${Math.round(1 / avgPerDay)} 天派 1 個、可以更密集一點`
    } else {
      cadenceLevel = "rare"
      message = `⏰ 派任務頻率較低（總共 ${totalCreated} 個）、試試多派一些任務`
    }

    if (consecutiveDryDays >= 7) {
      message += ` ⚠️ 已 ${consecutiveDryDays} 天沒派任務、該動起來了`
    }

    res.json({
      daily: dailyArr,
      byWeekday,
      summary: {
        totalCreated,
        avgPerDay: Math.round(avgPerDay * 10) / 10,
        busiestDate: busiest?.created > 0 ? busiest.date : null,
        busiestCount: busiest?.created ?? 0,
        consecutiveDryDays,
        favWeekday,
      },
      cadenceLevel,
      message,
    })
  })
)

/**
 * GET /api/family/kids-last-activity
 * 每個 active 小孩最後一次活動（task / checkin / spending）+ 距今天數
 * attentionLevel: ok(<=2 天) / watch(3-6 天) / alert(>=7 天) / never
 */
router.get(
  "/api/family/kids-last-activity",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        (SELECT MAX(completed_at) FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved') AS last_task_at,
        (SELECT title FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
          ORDER BY completed_at DESC NULLS LAST LIMIT 1) AS last_task_title,
        (SELECT MAX(checkin_date) FROM kids_checkins WHERE kid_id = ka.id) AS last_checkin_date,
        (SELECT MAX(spend_date) FROM kids_spendings WHERE kid_id = ka.id) AS last_spending_date
      FROM kids_accounts ka
      WHERE ka.is_active = true
      ORDER BY ka.id ASC
    `)

    const todayStr = localDateTPE()

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          last_task_at: string | null
          last_task_title: string | null
          last_checkin_date: string | null
          last_spending_date: string | null
        }>
      }
    ).rows.map((r) => {
      const dates: Array<{ type: string; at: string | null }> = [
        { type: "task", at: r.last_task_at },
        { type: "checkin", at: r.last_checkin_date },
        { type: "spending", at: r.last_spending_date },
      ]
      let latestType: "task" | "checkin" | "spending" | null = null
      let latestAt: string | null = null
      let latestMs = -1
      for (const d of dates) {
        if (!d.at) continue
        const ms = new Date(d.at).getTime()
        if (ms > latestMs) {
          latestMs = ms
          latestAt = d.at
          latestType = d.type as "task" | "checkin" | "spending"
        }
      }

      let daysSince: number | null = null
      let attentionLevel: "ok" | "watch" | "alert" | "never"
      let summary: string

      if (latestAt) {
        daysSince = Math.floor((Date.parse(todayStr) - new Date(latestAt).getTime()) / 86400000)
        if (daysSince < 0) daysSince = 0
        if (daysSince <= 2) {
          attentionLevel = "ok"
          summary = `最近 ${daysSince === 0 ? "今天" : `${daysSince} 天前`}活動過 ✅`
        } else if (daysSince <= 6) {
          attentionLevel = "watch"
          summary = `${daysSince} 天沒新活動、注意一下 ⚠️`
        } else {
          attentionLevel = "alert"
          summary = `${daysSince} 天沒任何活動、該關心一下 🚨`
        }
      } else {
        attentionLevel = "never"
        summary = "從沒活動紀錄、新加入的小孩？"
      }

      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        lastTaskAt: r.last_task_at,
        lastTaskTitle: r.last_task_title,
        lastCheckinDate: r.last_checkin_date,
        lastSpendingDate: r.last_spending_date,
        latestType,
        latestAt,
        daysSince,
        attentionLevel,
        summary,
      }
    })

    const alertCount = kids.filter((k) => k.attentionLevel === "alert").length
    const watchCount = kids.filter((k) => k.attentionLevel === "watch").length
    const message =
      alertCount > 0
        ? `⚠️ ${alertCount} 個小孩超過 7 天沒活動、請主動關心`
        : watchCount > 0
          ? `${watchCount} 個小孩 3-6 天沒新活動`
          : kids.length > 0
            ? "全家近期都有活動 👍"
            : "尚未加入小孩"

    res.json({
      kids,
      summary: {
        totalKids: kids.length,
        alertCount,
        watchCount,
        okCount: kids.filter((k) => k.attentionLevel === "ok").length,
      },
      message,
    })
  })
)

export default router
