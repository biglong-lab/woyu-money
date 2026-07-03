/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 06，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"

const router = Router()

/**
 * GET /api/family/health-dashboard
 * 家庭整體健康儀表板（3 維度合成總分）
 *
 * 3 維度（each 0-100）：
 *   - mood: 近 7 天平均 mood score × 20（5×20=100）
 *   - activity: 近 7 天 approved tasks 數 / (kids × 7 × 0.5) × 100（每 kid 平均一週 3.5 個 = 100）
 *   - fairness: 100 - (max - min taskPercentage)（越接近平均越高）
 *
 * 總分 = 三項平均
 */
router.get(
  "/api/family/health-dashboard",
  asyncHandler(async (_req, res) => {
    const [moodRows, taskRows, kidsCount] = await Promise.all([
      db.execute(sql`
        SELECT AVG(
          CASE mood
            WHEN '😄 開心' THEN 5
            WHEN '🙂 還好' THEN 4
            WHEN '😐 普通' THEN 3
            WHEN '😢 難過' THEN 2
            WHEN '😡 生氣' THEN 1
            ELSE 3
          END
        )::numeric AS avg_score
        FROM kids_checkins
        WHERE checkin_date >= CURRENT_DATE - INTERVAL '7 days'
      `),
      db.execute(sql`
        SELECT
          kid_id::int,
          COUNT(*)::int AS tasks
        FROM kids_tasks
        WHERE status = 'approved'
          AND completed_at >= NOW() - INTERVAL '7 days'
        GROUP BY kid_id
      `),
      db.execute(sql`SELECT COUNT(*)::int AS n FROM kids_accounts WHERE is_active = true`),
    ])

    const avgMoodScore = Number(
      (moodRows as unknown as { rows: { avg_score: string | number | null }[] }).rows[0]
        ?.avg_score ?? 0
    )
    const taskByKid = (taskRows as unknown as { rows: { kid_id: number; tasks: number }[] }).rows
    const totalKids = (kidsCount as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0

    const totalTasks = taskByKid.reduce((s, r) => s + r.tasks, 0)

    // mood score 0-100
    const moodScore = avgMoodScore > 0 ? Math.min(100, Math.round(avgMoodScore * 20)) : 0

    // activity score：每 kid 平均一週 3.5 個 task = 滿分
    const expectedWeeklyTasks = totalKids * 3.5
    const activityScore =
      expectedWeeklyTasks > 0
        ? Math.min(100, Math.round((totalTasks / expectedWeeklyTasks) * 100))
        : 0

    // fairness：max - min percentage（差異越小越公平）
    let fairnessScore = 100
    if (totalKids >= 2 && totalTasks > 0) {
      const percentages = taskByKid.map((r) => (r.tasks / totalTasks) * 100)
      const padded = [...percentages]
      // 補上 0 task 的 kid
      while (padded.length < totalKids) padded.push(0)
      const maxP = Math.max(...padded)
      const minP = Math.min(...padded)
      fairnessScore = Math.max(0, Math.round(100 - (maxP - minP)))
    } else if (totalKids < 2) {
      fairnessScore = 100 // 一個小孩、不能評估
    }

    const overallScore = Math.round((moodScore + activityScore + fairnessScore) / 3)

    let healthLevel: "excellent" | "good" | "moderate" | "needs_attention"
    let message: string
    if (overallScore >= 80) {
      healthLevel = "excellent"
      message = "🌟 全家狀況非常好！"
    } else if (overallScore >= 60) {
      healthLevel = "good"
      message = "👍 家庭狀況不錯、有些可以加強"
    } else if (overallScore >= 40) {
      healthLevel = "moderate"
      message = "💪 一般水準、考慮多互動"
    } else {
      healthLevel = "needs_attention"
      message = "⚠️ 需要多關心、看看哪裡可改善"
    }

    res.json({
      overallScore,
      healthLevel,
      message,
      dimensions: [
        {
          key: "mood",
          name: "心情",
          score: moodScore,
          detail: `平均 ${avgMoodScore.toFixed(1)}/5`,
        },
        {
          key: "activity",
          name: "活躍度",
          score: activityScore,
          detail: `近 7 天 ${totalTasks} 個任務`,
        },
        {
          key: "fairness",
          name: "公平度",
          score: fairnessScore,
          detail: totalKids < 2 ? "至少需要 2 個小孩" : "任務分配差異",
        },
      ],
    })
  })
)

/**
 * GET /api/family/kid-mood-trend?kidId=&days=30
 * 小孩心情走勢：近 N 天 mood 分析
 */
router.get(
  "/api/family/kid-mood-trend",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90)

    const result = await db.execute(sql`
      SELECT checkin_date, mood, note
      FROM kids_checkins
      WHERE kid_id = ${kidIdQ}
        AND checkin_date >= CURRENT_DATE - (${days}::int || ' days')::interval
      ORDER BY checkin_date DESC
    `)
    const rows = (
      result as unknown as {
        rows: { checkin_date: Date | string; mood: string; note: string | null }[]
      }
    ).rows

    const MOOD_SCORE: Record<string, number> = {
      "😄 開心": 5,
      "🙂 還好": 4,
      "😐 普通": 3,
      "😢 難過": 2,
      "😡 生氣": 1,
    }

    const checkins = rows.map((r) => ({
      date:
        typeof r.checkin_date === "string"
          ? r.checkin_date.slice(0, 10)
          : new Date(r.checkin_date).toISOString().slice(0, 10),
      mood: r.mood,
      note: r.note,
      score: MOOD_SCORE[r.mood] ?? 3,
    }))

    const totalDays = checkins.length
    const avgScore =
      totalDays > 0
        ? Math.round((checkins.reduce((s, c) => s + c.score, 0) / totalDays) * 100) / 100
        : 0

    const happyDays = checkins.filter((c) => c.score >= 4).length
    const sadDays = checkins.filter((c) => c.score <= 2).length

    let bestDay: (typeof checkins)[0] | null = null
    let worstDay: (typeof checkins)[0] | null = null
    for (const c of checkins) {
      if (!bestDay || c.score > bestDay.score) bestDay = c
      if (!worstDay || c.score < worstDay.score) worstDay = c
    }
    if (bestDay && worstDay && bestDay === worstDay && totalDays === 1) worstDay = null

    let trend: string
    if (totalDays === 0) trend = "🌫️ 還沒打卡過"
    else if (avgScore >= 4.5) trend = "🌞 整體超開心"
    else if (avgScore >= 3.5) trend = "😊 大部分時間不錯"
    else if (avgScore >= 2.5) trend = "🌤️ 起伏正常"
    else trend = "🌧️ 心情比較低、需要關心"

    res.json({
      kidId: kidIdQ,
      days,
      totalDays,
      avgScore,
      happyDays,
      sadDays,
      bestDay,
      worstDay,
      trend,
      checkins,
    })
  })
)

/**
 * GET /api/family/kid-wishlist-summary?kidId=
 * 小孩願望清單分析（多久能買 / 可買幾個）
 */
router.get(
  "/api/family/kid-wishlist-summary",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const [wishes, jars, recentReward] = await Promise.all([
      db.execute(sql`
        SELECT
          id::int AS id,
          title,
          emoji,
          estimated_price::numeric AS price,
          priority,
          status,
          created_at
        FROM kids_wishes
        WHERE kid_id = ${kidIdQ}
          AND status = 'wished'
          AND estimated_price IS NOT NULL
        ORDER BY priority DESC, estimated_price ASC
      `),
      db.execute(sql`
        SELECT
          COALESCE(spend_balance::numeric, 0) + COALESCE(save_balance::numeric, 0) AS available
        FROM kids_jars WHERE kid_id = ${kidIdQ}
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric AS s
        FROM kids_tasks
        WHERE kid_id = ${kidIdQ} AND status = 'approved'
          AND completed_at >= NOW() - INTERVAL '30 days'
      `),
    ])

    const wishList = (
      wishes as unknown as {
        rows: {
          id: number
          title: string
          emoji: string | null
          price: string | number
          priority: number
          status: string
          created_at: Date
        }[]
      }
    ).rows.map((r) => ({
      id: r.id,
      title: r.title,
      emoji: r.emoji ?? "✨",
      price: Number(r.price ?? 0),
      priority: r.priority,
    }))

    const available = Number(
      String(
        (jars as unknown as { rows: { available: string | number }[] }).rows[0]?.available ?? 0
      )
    )
    const monthlyReward = Number(
      String((recentReward as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
    )
    const dailyEarning = monthlyReward / 30

    const totalEstimated = wishList.reduce((s, w) => s + w.price, 0)

    const enriched = wishList.map((w) => {
      let status: "affordable" | "soon" | "saving"
      let etaDays: number | null
      if (w.price <= available) {
        status = "affordable"
        etaDays = 0
      } else {
        const remaining = w.price - available
        if (dailyEarning <= 0) {
          status = "saving"
          etaDays = null
        } else {
          etaDays = Math.ceil(remaining / dailyEarning)
          status = etaDays <= 30 ? "soon" : "saving"
        }
      }
      return { ...w, status, etaDays }
    })

    const affordableCount = enriched.filter((w) => w.status === "affordable").length

    res.json({
      kidId: kidIdQ,
      totalWishes: wishList.length,
      totalEstimated,
      available,
      dailyEarning: Math.round(dailyEarning * 100) / 100,
      affordableCount,
      wishes: enriched,
    })
  })
)

/**
 * GET /api/family/kids-attention
 * 家長關心雷達：找出最近無 task / 無 checkin 的 kid
 */
router.get(
  "/api/family/kids-attention",
  asyncHandler(async (_req, res) => {
    const result = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        (
          SELECT MAX(DATE(completed_at)) FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
        ) AS last_task_date,
        (
          SELECT MAX(checkin_date) FROM kids_checkins
          WHERE kid_id = ka.id
        ) AS last_checkin_date
      FROM kids_accounts ka
      WHERE ka.is_active = true
      ORDER BY ka.id ASC
    `)
    const rows = (
      result as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          last_task_date: Date | null
          last_checkin_date: Date | null
        }[]
      }
    ).rows

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    function daysSince(d: Date | null | string): number {
      if (!d) return 9999
      const date = typeof d === "string" ? new Date(d) : new Date(d)
      date.setHours(0, 0, 0, 0)
      return Math.floor((today.getTime() - date.getTime()) / 86_400_000)
    }

    const kids = rows.map((r) => {
      const daysSinceTask = daysSince(r.last_task_date)
      const daysSinceCheckin = daysSince(r.last_checkin_date)
      const daysQuiet = Math.min(daysSinceTask, daysSinceCheckin)
      const needsAttention = daysQuiet >= 7

      let message: string | null = null
      if (daysQuiet === 9999) message = `${r.kid_name} 完全沒活動過、想想要不要派任務？`
      else if (daysQuiet >= 14) message = `${r.kid_name} 已經 ${daysQuiet} 天沒活動了、該關心！`
      else if (daysQuiet >= 7) message = `${r.kid_name} 已經 ${daysQuiet} 天沒活動、聊聊吧`

      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        lastTaskDate: r.last_task_date,
        lastCheckinDate: r.last_checkin_date,
        daysSinceTask: daysSinceTask === 9999 ? null : daysSinceTask,
        daysSinceCheckin: daysSinceCheckin === 9999 ? null : daysSinceCheckin,
        daysQuiet: daysQuiet === 9999 ? null : daysQuiet,
        needsAttention,
        message,
      }
    })

    const attentionCount = kids.filter((k) => k.needsAttention).length

    res.json({
      totalKids: kids.length,
      attentionCount,
      kids,
    })
  })
)

/**
 * GET /api/family/kid-net-worth?kidId=
 * 小孩總財產：3 罐 balance + 各目標 + lifetime 收入
 */
router.get(
  "/api/family/kid-net-worth",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT
        COALESCE((SELECT spend_balance::numeric FROM kids_jars WHERE kid_id = ${kidIdQ}), 0) AS spend,
        COALESCE((SELECT save_balance::numeric FROM kids_jars WHERE kid_id = ${kidIdQ}), 0) AS save,
        COALESCE((SELECT give_balance::numeric FROM kids_jars WHERE kid_id = ${kidIdQ}), 0) AS give,
        COALESCE((
          SELECT SUM(current_amount::numeric)::numeric FROM kids_goals
          WHERE kid_id = ${kidIdQ} AND status = 'active'
        ), 0) AS goals_saved,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
        ), 0) AS lifetime_earned
    `)
    const row = (
      result as unknown as {
        rows: {
          spend: string | number
          save: string | number
          give: string | number
          goals_saved: string | number
          lifetime_earned: string | number
        }[]
      }
    ).rows[0]!

    const jars = {
      spend: Number(row.spend ?? 0),
      save: Number(row.save ?? 0),
      give: Number(row.give ?? 0),
    }
    const goalsSaved = Number(row.goals_saved ?? 0)
    const lifetimeEarned = Number(row.lifetime_earned ?? 0)
    const totalNetWorth = jars.spend + jars.save + jars.give + goalsSaved

    let levelLabel: string
    if (totalNetWorth >= 5000) levelLabel = "👑 小富翁"
    else if (totalNetWorth >= 1000) levelLabel = "💎 小財主"
    else if (totalNetWorth >= 500) levelLabel = "🌟 存錢小達人"
    else if (totalNetWorth >= 100) levelLabel = "🌱 開始累積"
    else levelLabel = "🥚 剛起步"

    res.json({
      kidId: kidIdQ,
      jars,
      goalsSaved,
      totalNetWorth,
      lifetimeEarned,
      levelLabel,
    })
  })
)

/**
 * GET /api/family/fairness?days=30
 * 家事公平度分析：看任務分配是否公平
 * 算每個 active kid 近 N 天 approved 任務佔比
 * 若一人 > 60% → 警示
 */
router.get(
  "/api/family/fairness",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)

    const result = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= NOW() - (${days}::int || ' days')::interval
        ), 0) AS tasks,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= NOW() - (${days}::int || ' days')::interval
        ), 0) AS reward
      FROM kids_accounts ka
      WHERE ka.is_active = true
      ORDER BY tasks DESC
    `)
    const rows = (
      result as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          tasks: number
          reward: string | number
        }[]
      }
    ).rows

    const totalTasks = rows.reduce((s, r) => s + r.tasks, 0)
    const totalReward = rows.reduce((s, r) => s + Number(r.reward ?? 0), 0)

    const kids = rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      tasks: r.tasks,
      reward: Number(r.reward ?? 0),
      taskPercentage: totalTasks > 0 ? Math.round((r.tasks / totalTasks) * 100) : 0,
      rewardPercentage:
        totalReward > 0 ? Math.round((Number(r.reward ?? 0) / totalReward) * 100) : 0,
    }))

    // 公平度評分：standard deviation 越小越公平
    // 但更直觀：看最大佔比 - 理論平均
    const expectedPerKid = kids.length > 0 ? Math.round(100 / kids.length) : 0
    const maxKid = kids[0] ?? null
    const minKid = kids.length > 0 ? kids[kids.length - 1] : null

    let fairnessLevel: "fair" | "ok" | "unbalanced" | "biased" | "n/a"
    let message: string
    if (totalTasks === 0 || kids.length < 2) {
      fairnessLevel = "n/a"
      message = kids.length < 2 ? "至少 2 個小孩才能比較" : "近期沒有任務、做幾個再看"
    } else if (maxKid && maxKid.taskPercentage <= expectedPerKid + 10) {
      fairnessLevel = "fair"
      message = `🌈 任務分配很公平、每個小孩約 ${expectedPerKid}%`
    } else if (maxKid && maxKid.taskPercentage <= expectedPerKid + 25) {
      fairnessLevel = "ok"
      message = `👍 大致平均、${maxKid.kidName} 略多一些`
    } else if (maxKid && maxKid.taskPercentage <= expectedPerKid + 40) {
      fairnessLevel = "unbalanced"
      message = `⚖️ ${maxKid.kidName} 做太多了（${maxKid.taskPercentage}%）、可以分一些給其他人`
    } else {
      fairnessLevel = "biased"
      message = `❗ ${maxKid?.kidName} 做了 ${maxKid?.taskPercentage}%！分配不平均`
    }

    res.json({
      days,
      totalTasks,
      totalReward,
      expectedPerKid,
      fairnessLevel,
      message,
      maxKid,
      minKid,
      kids,
    })
  })
)

/**
 * GET /api/family/goal-achievers
 * 小孩達成目標排行（看誰最會存錢、家長端）
 */
router.get(
  "/api/family/goal-achievers",
  asyncHandler(async (_req, res) => {
    const result = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COALESCE(COUNT(kg.id)::int, 0) AS goals_completed,
        COALESCE(SUM(kg.target_amount::numeric)::numeric, 0) AS total_target,
        COALESCE(
          AVG(DATE(kg.completed_at) - DATE(kg.created_at))::int,
          0
        ) AS avg_days
      FROM kids_accounts ka
      LEFT JOIN kids_goals kg ON kg.kid_id = ka.id AND kg.status = 'completed'
      WHERE ka.is_active = true
      GROUP BY ka.id, ka.display_name, ka.avatar
      ORDER BY goals_completed DESC, total_target DESC
    `)
    const rows = (
      result as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          goals_completed: number
          total_target: string | number
          avg_days: number
        }[]
      }
    ).rows

    const achievers = rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      goalsCompleted: r.goals_completed,
      totalTarget: Number(r.total_target ?? 0),
      avgDays: r.avg_days ?? 0,
    }))

    const totalGoals = achievers.reduce((s, a) => s + a.goalsCompleted, 0)
    const champion = achievers.find((a) => a.goalsCompleted > 0) ?? null

    res.json({
      totalGoals,
      champion,
      achievers,
    })
  })
)

export default router
