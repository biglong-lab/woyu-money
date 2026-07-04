/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 07，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql, eq } from "drizzle-orm"
import { kidsAccounts } from "@shared/schema"
import { localDateTPE } from "@shared/date-utils"

const router = Router()

/**
 * GET /api/family/completed-goals-history?limit=20
 * 家庭目標達成歷史（家長端、看過去達成的目標）
 *
 * 從 kids_goals WHERE status='completed' 取近期達成
 * 算每個 goal：建立到完成的天數
 * 統計：平均達成天數、最快達成、總達成數
 */
router.get(
  "/api/family/completed-goals-history",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)

    const result = await db.execute(sql`
      SELECT
        kg.id::int AS id,
        kg.name,
        kg.emoji,
        kg.target_amount::numeric AS target,
        kg.current_amount::numeric AS current,
        kg.created_at,
        kg.completed_at,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        (DATE(kg.completed_at) - DATE(kg.created_at))::int AS days_taken,
        kg.reflection
      FROM kids_goals kg
      JOIN kids_accounts ka ON ka.id = kg.kid_id
      WHERE kg.status = 'completed'
      ORDER BY kg.completed_at DESC NULLS LAST
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          id: number
          name: string
          emoji: string | null
          target: string | number
          current: string | number
          created_at: Date
          completed_at: Date | null
          kid_id: number
          kid_name: string
          avatar: string
          days_taken: number | null
          reflection: string | null
        }[]
      }
    ).rows

    const goals = rows.map((r) => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji ?? "🎯",
      targetAmount: Number(r.target ?? 0),
      currentAmount: Number(r.current ?? 0),
      createdAt: r.created_at,
      completedAt: r.completed_at,
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      daysTaken: r.days_taken ?? 0,
      reflection: r.reflection,
    }))

    const total = goals.length
    const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
    const avgDaysTaken =
      total > 0 ? Math.round(goals.reduce((s, g) => s + g.daysTaken, 0) / total) : 0
    let fastestGoal: (typeof goals)[0] | null = null
    let largestGoal: (typeof goals)[0] | null = null
    for (const g of goals) {
      if (!fastestGoal || g.daysTaken < fastestGoal.daysTaken) fastestGoal = g
      if (!largestGoal || g.targetAmount > largestGoal.targetAmount) largestGoal = g
    }

    res.json({
      total,
      totalTarget,
      avgDaysTaken,
      fastestGoal,
      largestGoal,
      goals,
    })
  })
)

/**
 * GET /api/family/pot-top-contributors?potId=&limit=10
 * 家庭 pot 貢獻者排行（看誰捐最多）
 * 不指定 potId 則跨所有 active pots 統計
 */
router.get(
  "/api/family/pot-top-contributors",
  asyncHandler(async (req, res) => {
    const potIdQ = req.query.potId ? Number(req.query.potId) : null
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30)
    if (potIdQ !== null && (!Number.isInteger(potIdQ) || potIdQ < 1)) {
      throw new AppError(400, "potId 無效")
    }

    const result = potIdQ
      ? await db.execute(sql`
          SELECT
            fpc.kid_id::int AS kid_id,
            ka.display_name AS kid_name,
            ka.avatar,
            SUM(fpc.amount::numeric)::numeric AS total_amount,
            COUNT(*)::int AS contribution_count,
            MAX(fpc.created_at) AS last_at
          FROM family_pot_contributions fpc
          JOIN kids_accounts ka ON ka.id = fpc.kid_id
          WHERE fpc.pot_id = ${potIdQ}
          GROUP BY fpc.kid_id, ka.display_name, ka.avatar
          ORDER BY total_amount DESC
          LIMIT ${limit}
        `)
      : await db.execute(sql`
          SELECT
            fpc.kid_id::int AS kid_id,
            ka.display_name AS kid_name,
            ka.avatar,
            SUM(fpc.amount::numeric)::numeric AS total_amount,
            COUNT(*)::int AS contribution_count,
            MAX(fpc.created_at) AS last_at
          FROM family_pot_contributions fpc
          JOIN kids_accounts ka ON ka.id = fpc.kid_id
          GROUP BY fpc.kid_id, ka.display_name, ka.avatar
          ORDER BY total_amount DESC
          LIMIT ${limit}
        `)
    const rows = (
      result as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          total_amount: string | number
          contribution_count: number
          last_at: Date | null
        }[]
      }
    ).rows

    const contributors = rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      totalAmount: Number(r.total_amount ?? 0),
      contributionCount: r.contribution_count,
      lastAt: r.last_at,
    }))

    const totalAmount = contributors.reduce((s, c) => s + c.totalAmount, 0)
    const topContributor = contributors[0] ?? null

    res.json({
      potId: potIdQ,
      total: contributors.length,
      totalAmount,
      topContributor,
      contributors,
    })
  })
)

/**
 * GET /api/family/kid-emoji-cloud?kidId=&limit=15
 * 小孩任務 emoji 雲：統計做最多的 task emoji
 * 視覺化「我做過什麼」、培養回顧感
 */
router.get(
  "/api/family/kid-emoji-cloud",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const limit = Math.min(Math.max(Number(req.query.limit) || 15, 1), 30)

    const result = await db.execute(sql`
      SELECT
        emoji,
        COUNT(*)::int AS count,
        MAX(title) AS sample_title
      FROM kids_tasks
      WHERE kid_id = ${kidIdQ}
        AND status = 'approved'
        AND emoji IS NOT NULL
        AND emoji != ''
      GROUP BY emoji
      ORDER BY count DESC
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: { emoji: string; count: number; sample_title: string }[]
      }
    ).rows

    const total = rows.reduce((s, r) => s + r.count, 0)
    const peak = rows[0]?.count ?? 0

    // 算每個 emoji 的相對大小（用 0.6x ~ 2.4x）
    const emojis = rows.map((r) => {
      const ratio = peak > 0 ? r.count / peak : 0
      const sizeRem = 0.6 + ratio * 1.8 // 0.6 ~ 2.4 rem
      return {
        emoji: r.emoji,
        count: r.count,
        sampleTitle: r.sample_title,
        sizeRem: Math.round(sizeRem * 100) / 100,
        percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
      }
    })

    res.json({
      kidId: kidIdQ,
      total,
      uniqueEmojis: rows.length,
      mostUsed: emojis[0] ?? null,
      emojis,
    })
  })
)

/**
 * GET /api/family/family-mood-today
 * 家庭今日氛圍：今日所有打卡的 mood 平均
 *
 * mood 對應分數（基於既有 VALID_MOODS）：
 *   😄 開心 = 5 / 🙂 還好 = 4 / 😐 普通 = 3 / 😢 難過 = 2 / 😡 生氣 = 1
 * 平均算家庭整體氛圍
 */
router.get(
  "/api/family/family-mood-today",
  asyncHandler(async (_req, res) => {
    const result = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        kc.mood,
        kc.note
      FROM kids_accounts ka
      LEFT JOIN kids_checkins kc ON kc.kid_id = ka.id AND kc.checkin_date = CURRENT_DATE
      WHERE ka.is_active = true
      ORDER BY ka.id ASC
    `)
    const rows = (
      result as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          mood: string | null
          note: string | null
        }[]
      }
    ).rows

    const MOOD_SCORE: Record<string, number> = {
      "😄 開心": 5,
      "🙂 還好": 4,
      "😐 普通": 3,
      "😢 難過": 2,
      "😡 生氣": 1,
    }

    const kids = rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      mood: r.mood,
      note: r.note,
      score: r.mood ? (MOOD_SCORE[r.mood] ?? 3) : null,
      checkedIn: !!r.mood,
    }))

    const moodScores = kids.filter((k) => k.score !== null).map((k) => k.score as number)
    const checkinCount = moodScores.length
    const totalKids = kids.length
    const avgScore =
      moodScores.length > 0
        ? Math.round((moodScores.reduce((s, v) => s + v, 0) / moodScores.length) * 100) / 100
        : 0

    let atmosphere: string
    let atmosphereEmoji: string
    if (checkinCount === 0) {
      atmosphere = "還沒人打卡"
      atmosphereEmoji = "🌫️"
    } else if (avgScore >= 4.5) {
      atmosphere = "全家超開心！"
      atmosphereEmoji = "🌞"
    } else if (avgScore >= 3.5) {
      atmosphere = "家裡氣氛不錯"
      atmosphereEmoji = "😊"
    } else if (avgScore >= 2.5) {
      atmosphere = "家裡平穩"
      atmosphereEmoji = "🌤️"
    } else if (avgScore >= 1.5) {
      atmosphere = "有人需要關心"
      atmosphereEmoji = "🌧️"
    } else {
      atmosphere = "今天情緒比較重、來個家庭聚會吧"
      atmosphereEmoji = "⛈️"
    }

    res.json({
      date: localDateTPE(),
      totalKids,
      checkinCount,
      avgScore,
      atmosphere,
      atmosphereEmoji,
      kids,
    })
  })
)

/**
 * GET /api/family/weekly-heatmap?weeks=12
 * 家庭週曆熱度：按星期幾統計 approved task 數
 */
router.get(
  "/api/family/weekly-heatmap",
  asyncHandler(async (req, res) => {
    const weeks = Math.min(Math.max(Number(req.query.weeks) || 12, 1), 52)

    const result = await db.execute(sql`
      SELECT
        EXTRACT(DOW FROM completed_at)::int AS dow,
        COUNT(*)::int AS n,
        COALESCE(SUM(reward_amount::numeric), 0)::numeric AS total_reward
      FROM kids_tasks
      WHERE status = 'approved'
        AND completed_at >= NOW() - (${weeks * 7}::int || ' days')::interval
      GROUP BY dow
      ORDER BY dow ASC
    `)
    const rows = (
      result as unknown as { rows: { dow: number; n: number; total_reward: string | number }[] }
    ).rows

    const DAY_META = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"]
    const DAY_EMOJI = ["☀️", "💼", "📚", "🎯", "📖", "🎉", "🌟"]
    const byDow = new Map(rows.map((r) => [r.dow, r]))

    const days = Array.from({ length: 7 }, (_, i) => {
      const r = byDow.get(i)
      const count = r?.n ?? 0
      const total = Number(r?.total_reward ?? 0)
      return {
        dow: i,
        name: DAY_META[i],
        emoji: DAY_EMOJI[i],
        count,
        totalReward: total,
      }
    })

    const totalTasks = days.reduce((s, d) => s + d.count, 0)
    const peak = days.reduce((m, d) => Math.max(m, d.count), 0)

    let busiestDay: (typeof days)[0] | null = null
    let quietestDay: (typeof days)[0] | null = null
    for (const d of days) {
      if (!busiestDay || d.count > busiestDay.count) busiestDay = d
      if (!quietestDay || d.count < quietestDay.count) quietestDay = d
    }

    let insight: string
    if (totalTasks === 0) {
      insight = "📊 還沒夠資料、做幾個任務後再看吧"
    } else if (busiestDay && peak > 0) {
      const weekendCount = (days[0]?.count ?? 0) + (days[6]?.count ?? 0)
      const weekdayCount = totalTasks - weekendCount
      if (weekendCount > weekdayCount) {
        insight = `🎉 週末家事比較多（${busiestDay.name} 最忙）`
      } else if (weekdayCount > weekendCount * 2) {
        insight = `💼 平日做得多（${busiestDay.name} 最忙）`
      } else {
        insight = `📊 整週分散、${busiestDay.name} 最忙`
      }
    } else {
      insight = "📊 全週分散"
    }

    res.json({
      weeks,
      totalTasks,
      peak,
      busiestDay,
      quietestDay,
      days,
      insight,
    })
  })
)

/**
 * GET /api/family/kid-education-report?kidId=
 * 小孩教育成果報告（家長端、評估 4 大金融素養面向）
 *
 * 4 維度（each 0-100 分）：
 *   - initiative（主動性）：自己提任務佔總任務的比例
 *   - savings（儲蓄能力）：完成 goal 數 + 存款累積
 *   - empathy（同理心）：捐贈次數 + 不同 recipient 數
 *   - consistency（規律性）：打卡天數 / 註冊以來天數
 *
 * overallScore = 4 個平均
 * 給每個面向評語
 */
router.get(
  "/api/family/kid-education-report",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, kidIdQ)).limit(1)
    if (!kid) throw new AppError(404, "小孩不存在")

    const result = await db.execute(sql`
      SELECT
        -- 主動性：notes 含 '小孩提議' 或 created_by_kid 的任務佔比
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
        ), 0) AS total_approved,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
            AND (notes LIKE '%小孩%' OR notes LIKE '%我要%' OR notes LIKE '%主動%')
        ), 0) AS self_proposed,
        -- 儲蓄能力
        COALESCE((
          SELECT COUNT(*)::int FROM kids_goals
          WHERE kid_id = ${kidIdQ} AND status = 'completed'
        ), 0) AS goals_completed,
        COALESCE((
          SELECT save_balance::numeric FROM kids_jars WHERE kid_id = ${kidIdQ}
        ), 0) AS save_balance,
        -- 同理心
        COALESCE((
          SELECT COUNT(*)::int FROM kids_spendings
          WHERE kid_id = ${kidIdQ} AND jar = 'give'
        ), 0) AS give_count,
        COALESCE((
          SELECT COUNT(DISTINCT recipient)::int FROM kids_spendings
          WHERE kid_id = ${kidIdQ} AND jar = 'give'
            AND recipient IS NOT NULL AND TRIM(recipient) != ''
        ), 0) AS unique_recipients,
        -- 規律性
        COALESCE((
          SELECT COUNT(DISTINCT checkin_date)::int FROM kids_checkins
          WHERE kid_id = ${kidIdQ}
        ), 0) AS total_checkin_days,
        GREATEST((CURRENT_DATE - DATE(${kid.createdAt}))::int, 1) AS account_age_days
    `)
    const row = (
      result as unknown as {
        rows: {
          total_approved: number
          self_proposed: number
          goals_completed: number
          save_balance: string | number
          give_count: number
          unique_recipients: number
          total_checkin_days: number
          account_age_days: number
        }[]
      }
    ).rows[0]!

    // 4 分數計算（各 0-100）
    // 主動性：self_proposed / total（上限 50%、× 200）；無任務則 0
    const initiativeScore =
      row.total_approved > 0
        ? Math.min(100, Math.round((row.self_proposed / row.total_approved) * 200))
        : 0

    // 儲蓄：goals_completed × 20（上限 60）+ save_balance / 50（上限 40）
    const savingsBase = Math.min(60, row.goals_completed * 20)
    const savingsBonus = Math.min(40, Math.round(Number(row.save_balance) / 50))
    const savingsScore = savingsBase + savingsBonus

    // 同理心：give_count × 5（上限 60）+ unique_recipients × 10（上限 40）
    const empathyBase = Math.min(60, row.give_count * 5)
    const empathyBonus = Math.min(40, row.unique_recipients * 10)
    const empathyScore = empathyBase + empathyBonus

    // 規律性：checkin_days / account_age_days × 100
    const consistencyScore = Math.min(
      100,
      Math.round((row.total_checkin_days / row.account_age_days) * 100)
    )

    const overallScore = Math.round(
      (initiativeScore + savingsScore + empathyScore + consistencyScore) / 4
    )

    function comment(score: number): string {
      if (score >= 80) return "🌟 表現傑出！"
      if (score >= 60) return "👍 表現良好"
      if (score >= 40) return "💪 進步中、繼續加油"
      if (score >= 20) return "🌱 剛起步、可培養更多"
      return "🆕 還未開始發展這項"
    }

    const dimensions = [
      {
        key: "initiative",
        name: "主動性",
        emoji: "🚀",
        score: initiativeScore,
        comment: comment(initiativeScore),
        detail: `${row.self_proposed} / ${row.total_approved} 任務自己提議`,
      },
      {
        key: "savings",
        name: "儲蓄能力",
        emoji: "🐷",
        score: savingsScore,
        comment: comment(savingsScore),
        detail: `${row.goals_completed} 個目標達成、存款 $${row.save_balance}`,
      },
      {
        key: "empathy",
        name: "同理心",
        emoji: "❤️",
        score: empathyScore,
        comment: comment(empathyScore),
        detail: `${row.give_count} 次捐贈、幫助 ${row.unique_recipients} 位`,
      },
      {
        key: "consistency",
        name: "規律性",
        emoji: "📅",
        score: consistencyScore,
        comment: comment(consistencyScore),
        detail: `${row.total_checkin_days} 天打卡 / ${row.account_age_days} 天帳號`,
      },
    ]

    res.json({
      kidId: kidIdQ,
      overallScore,
      overallComment: comment(overallScore),
      dimensions,
    })
  })
)

/**
 * GET /api/family/kid-timecapsule?kidId=
 * 小孩時光膠囊：1 年 / 半年 / 1 個月前的同一天紀錄
 *
 * 對每個時間點找：
 *   - approved tasks
 *   - spendings
 *   - mood checkin
 * 回 3 個 capsules（year / halfYear / month）
 */
router.get(
  "/api/family/kid-timecapsule",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    type Capsule = {
      key: "year" | "halfYear" | "month"
      label: string
      date: string
      tasks: Array<{ title: string; emoji: string; reward: number }>
      spendings: Array<{ description: string; emoji: string; amount: number; jar: string }>
      mood: string | null
    }

    async function fetchCapsule(
      key: Capsule["key"],
      label: string,
      daysBack: number
    ): Promise<Capsule | null> {
      const result = await db.execute(sql`
        SELECT
          CURRENT_DATE - (${daysBack}::int) AS d,
          (
            SELECT json_agg(json_build_object(
              'title', title,
              'emoji', emoji,
              'reward', reward_amount::numeric
            ))
            FROM kids_tasks
            WHERE kid_id = ${kidIdQ} AND status = 'approved'
              AND DATE(completed_at) = CURRENT_DATE - (${daysBack}::int)
          ) AS tasks,
          (
            SELECT json_agg(json_build_object(
              'description', description,
              'emoji', emoji,
              'amount', amount::numeric,
              'jar', jar
            ))
            FROM kids_spendings
            WHERE kid_id = ${kidIdQ}
              AND spend_date = CURRENT_DATE - (${daysBack}::int)
          ) AS spendings,
          (
            SELECT mood FROM kids_checkins
            WHERE kid_id = ${kidIdQ}
              AND checkin_date = CURRENT_DATE - (${daysBack}::int)
            LIMIT 1
          ) AS mood
      `)
      const row = (
        result as unknown as {
          rows: {
            d: Date
            tasks: Array<{ title: string; emoji: string; reward: number }> | null
            spendings: Array<{
              description: string
              emoji: string
              amount: number
              jar: string
            }> | null
            mood: string | null
          }[]
        }
      ).rows[0]
      if (!row) return null

      const tasks = (row.tasks ?? []).map((t) => ({
        title: t.title,
        emoji: t.emoji ?? "📋",
        reward: Number(t.reward ?? 0),
      }))
      const spendings = (row.spendings ?? []).map((s) => ({
        description: s.description,
        emoji: s.emoji ?? "💰",
        amount: Number(s.amount ?? 0),
        jar: s.jar,
      }))

      // 沒任何紀錄不回 capsule
      if (tasks.length === 0 && spendings.length === 0 && !row.mood) return null

      return {
        key,
        label,
        date: new Date(row.d).toISOString().slice(0, 10),
        tasks,
        spendings,
        mood: row.mood,
      }
    }

    const [year, halfYear, month] = await Promise.all([
      fetchCapsule("year", "一年前", 365),
      fetchCapsule("halfYear", "半年前", 182),
      fetchCapsule("month", "一個月前", 30),
    ])

    const capsules = [year, halfYear, month].filter((c): c is Capsule => c !== null)

    res.json({
      kidId: kidIdQ,
      total: capsules.length,
      capsules,
    })
  })
)

export default router
