/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 09，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql, eq } from "drizzle-orm"
import { kidsAccounts } from "@shared/schema"

const router = Router()

/**
 * GET /api/family/kid-spending-keywords?kidId=&limit=10
 * 小孩消費分類分析：按 description 分群、看錢花在哪
 *
 * 回：
 *   totalSpent / totalCount
 *   keywords: [{ description, count, totalAmount, lastSpentAt }]
 *   topKeyword: 花最多錢那個
 */
router.get(
  "/api/family/kid-spending-keywords",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30)

    const result = await db.execute(sql`
      SELECT
        description,
        MAX(emoji) AS emoji,
        MAX(jar) AS jar,
        COUNT(*)::int AS count,
        SUM(amount::numeric)::numeric AS total_amount,
        MAX(spend_date) AS last_spent_at
      FROM kids_spendings
      WHERE kid_id = ${kidIdQ}
      GROUP BY description
      ORDER BY total_amount DESC, count DESC
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          description: string
          emoji: string | null
          jar: string
          count: number
          total_amount: string | number
          last_spent_at: Date | null
        }[]
      }
    ).rows

    const keywords = rows.map((r) => ({
      description: r.description,
      emoji: r.emoji ?? "💰",
      jar: r.jar,
      count: r.count,
      totalAmount: Number(r.total_amount ?? 0),
      lastSpentAt: r.last_spent_at,
    }))

    const totalSpent = keywords.reduce((s, k) => s + k.totalAmount, 0)
    const totalCount = keywords.reduce((s, k) => s + k.count, 0)
    const topKeyword = keywords[0] ?? null

    res.json({
      kidId: kidIdQ,
      totalSpent,
      totalCount,
      keywords,
      topKeyword,
    })
  })
)

/**
 * GET /api/family/sibling-comparison
 * 兄弟姊妹比較（家長端、看公平性）
 * 每個 active kid 相對家庭平均的 ratio（任務數/獎勵/儲蓄/花費/捐贈）
 *
 * ratio = kidValue / familyAvg
 *   1.0 = 跟平均一樣
 *   > 1 = 比平均多
 *   < 1 = 比平均少
 */
router.get(
  "/api/family/sibling-comparison",
  asyncHandler(async (_req, res) => {
    const result = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar AS avatar,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= NOW() - INTERVAL '30 days'
        ), 0) AS tasks,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ka.id AND status = 'approved'
            AND completed_at >= NOW() - INTERVAL '30 days'
        ), 0) AS reward,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ka.id AND jar = 'spend'
            AND spend_date >= CURRENT_DATE - INTERVAL '30 days'
        ), 0) AS spent,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ka.id AND jar = 'give'
            AND spend_date >= CURRENT_DATE - INTERVAL '30 days'
        ), 0) AS given
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
          tasks: number
          reward: string | number
          spent: string | number
          given: string | number
        }[]
      }
    ).rows

    if (rows.length < 2) {
      return res.json({
        kidCount: rows.length,
        message: "需要至少 2 個小孩才能比較",
        kids: [],
      })
    }

    const kidsData = rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      tasks: r.tasks ?? 0,
      reward: Number(r.reward ?? 0),
      spent: Number(r.spent ?? 0),
      given: Number(r.given ?? 0),
    }))

    const familyAvg = {
      tasks: kidsData.reduce((s, k) => s + k.tasks, 0) / kidsData.length,
      reward: kidsData.reduce((s, k) => s + k.reward, 0) / kidsData.length,
      spent: kidsData.reduce((s, k) => s + k.spent, 0) / kidsData.length,
      given: kidsData.reduce((s, k) => s + k.given, 0) / kidsData.length,
    }

    function ratio(v: number, avg: number) {
      if (avg === 0) return v > 0 ? 2.0 : 1.0
      return Math.round((v / avg) * 100) / 100
    }

    // 標記每個 kid 的「特長」 + 「需要注意」
    const kids = kidsData.map((k) => {
      const ratios = {
        tasks: ratio(k.tasks, familyAvg.tasks),
        reward: ratio(k.reward, familyAvg.reward),
        spent: ratio(k.spent, familyAvg.spent),
        given: ratio(k.given, familyAvg.given),
      }
      const highlights: string[] = []
      if (ratios.tasks >= 1.5) highlights.push("🏆 任務超積極")
      if (ratios.given >= 1.5) highlights.push("❤️ 最有愛心")
      if (ratios.spent <= 0.5 && k.reward > 0) highlights.push("🐷 最會存錢")
      if (ratios.spent >= 2.0) highlights.push("💸 花最多")

      return {
        ...k,
        ratios,
        highlights,
      }
    })

    res.json({
      period: "近 30 天",
      kidCount: kids.length,
      familyAvg: {
        tasks: Math.round(familyAvg.tasks * 10) / 10,
        reward: Math.round(familyAvg.reward),
        spent: Math.round(familyAvg.spent),
        given: Math.round(familyAvg.given),
      },
      kids,
    })
  })
)

/**
 * GET /api/family/kid-suggestions?kidId=&limit=5
 * 推薦小孩可挑戰的任務（別的小孩做過、這個小孩沒做過的）
 */
router.get(
  "/api/family/kid-suggestions",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 10)

    const result = await db.execute(sql`
      WITH family_recent AS (
        SELECT
          title,
          MAX(emoji) AS emoji,
          COUNT(*)::int AS times,
          ROUND(AVG(reward_amount::numeric))::int AS avg_reward,
          MAX(category) AS category
        FROM kids_tasks
        WHERE status = 'approved'
          AND completed_at >= NOW() - INTERVAL '60 days'
        GROUP BY title
      ),
      kid_recent AS (
        SELECT DISTINCT title FROM kids_tasks
        WHERE kid_id = ${kidIdQ}
          AND completed_at >= NOW() - INTERVAL '30 days'
      )
      SELECT fr.title, fr.emoji, fr.times, fr.avg_reward, fr.category
      FROM family_recent fr
      LEFT JOIN kid_recent kr ON kr.title = fr.title
      WHERE kr.title IS NULL
      ORDER BY fr.times DESC, fr.avg_reward DESC
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          title: string
          emoji: string | null
          times: number
          avg_reward: number
          category: string
        }[]
      }
    ).rows

    res.json({
      kidId: kidIdQ,
      total: rows.length,
      suggestions: rows.map((r) => ({
        title: r.title,
        emoji: r.emoji ?? "📋",
        familyTimes: r.times,
        suggestedReward: r.avg_reward,
        category: r.category ?? "other",
      })),
    })
  })
)

/**
 * GET /api/family/kid-wallet-health?kidId=
 * 小孩錢包健康分析：實際支出 vs preset 比較
 *
 * 邏輯：
 *   - 近 30 天 jar=spend 總額（實際花掉）
 *   - 近 30 天 task reward × preset 各比（理論收入）
 *   - actualSpendRatio = spentAmount / totalReward × 100
 *   - presetSpendRatio = kid.spendRatio
 *   - delta = actualSpendRatio - presetSpendRatio
 *   - healthScore：偏離 preset 越多扣越多分
 */
router.get(
  "/api/family/kid-wallet-health",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, kidIdQ)).limit(1)
    if (!kid) throw new AppError(404, "小孩不存在")

    const [rewardRows, spentRows, savedRows, givenRows] = await Promise.all([
      db.execute(sql`
        SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric AS s
        FROM kids_tasks
        WHERE kid_id = ${kidIdQ} AND status = 'approved'
          AND completed_at >= NOW() - INTERVAL '30 days'
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s
        FROM kids_spendings
        WHERE kid_id = ${kidIdQ} AND jar = 'spend'
          AND spend_date >= CURRENT_DATE - INTERVAL '30 days'
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s
        FROM kids_spendings
        WHERE kid_id = ${kidIdQ} AND jar = 'save'
          AND spend_date >= CURRENT_DATE - INTERVAL '30 days'
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s
        FROM kids_spendings
        WHERE kid_id = ${kidIdQ} AND jar = 'give'
          AND spend_date >= CURRENT_DATE - INTERVAL '30 days'
      `),
    ])

    const totalReward = Number(
      String((rewardRows as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
    )
    const spent = Number(
      String((spentRows as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
    )
    const saved = Number(
      String((savedRows as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
    )
    const given = Number(
      String((givenRows as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
    )

    if (totalReward === 0) {
      return res.json({
        kidId: kidIdQ,
        period: "近 30 天",
        totalReward: 0,
        breakdown: null,
        healthScore: null,
        suggestion: "近 30 天還沒收入、先做任務累積看看吧！",
      })
    }

    // 實際比例（佔 totalReward 的百分比）
    const actualSpend = Math.round((spent / totalReward) * 100)
    const actualSave = Math.round((saved / totalReward) * 100)
    const actualGive = Math.round((given / totalReward) * 100)

    const preset = {
      spend: kid.spendRatio,
      save: kid.saveRatio,
      give: kid.giveRatio,
    }
    const actual = { spend: actualSpend, save: actualSave, give: actualGive }
    const delta = {
      spend: actualSpend - preset.spend,
      save: actualSave - preset.save,
      give: actualGive - preset.give,
    }

    // 健康分數：每個 ratio 偏離超過 preset 的 abs 累加扣分
    // 100 - sum(|delta|) / 3
    const totalDeviation = Math.abs(delta.spend) + Math.abs(delta.save) + Math.abs(delta.give)
    const healthScore = Math.max(0, Math.min(100, 100 - Math.round(totalDeviation / 3)))

    let suggestion: string
    if (healthScore >= 85) {
      suggestion = "🌟 完美！實際支出跟預設比例幾乎一致！"
    } else if (healthScore >= 70) {
      suggestion = "👍 不錯！偶爾偏一點點正常"
    } else if (delta.spend > 15) {
      suggestion = `⚠️ 花用花太多了（多花 ${delta.spend}%）、試試把錢移到存錢罐`
    } else if (delta.save < -15) {
      suggestion = `🐷 存得比預設少（少存 ${Math.abs(delta.save)}%）、加油存！`
    } else if (delta.give < -10) {
      suggestion = `❤️ 捐贈比預設少（少捐 ${Math.abs(delta.give)}%）、可以多幫助別人`
    } else {
      suggestion = "📊 比例偏離一些、調整看看 spend/save/give 比"
    }

    res.json({
      kidId: kidIdQ,
      period: "近 30 天",
      totalReward,
      breakdown: {
        spent,
        saved,
        given,
        preset,
        actual,
        delta,
      },
      healthScore,
      suggestion,
    })
  })
)

/**
 * GET /api/family/milestones
 * 家庭里程碑紀錄（全家共同達成）
 * 5 大 tracks × 3 階里程碑、看達成/剩多少
 */
router.get(
  "/api/family/milestones",
  asyncHandler(async (_req, res) => {
    const [taskStats, rewardStats, giveStats, saveStats, checkinStats] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS n FROM kids_tasks WHERE status = 'approved'`),
      db.execute(sql`
        SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric AS s
        FROM kids_tasks WHERE status = 'approved'
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s
        FROM kids_spendings WHERE jar = 'give'
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(current_amount::numeric), 0)::numeric AS s
        FROM kids_goals
      `),
      db.execute(sql`SELECT COUNT(DISTINCT checkin_date)::int AS n FROM kids_checkins`),
    ])

    const totals = {
      tasks: (taskStats as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
      reward: Number(
        String((rewardStats as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
      ),
      given: Number(
        String((giveStats as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
      ),
      saved: Number(
        String((saveStats as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
      ),
      checkins: (checkinStats as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
    }

    type Tier = { value: number; emoji: string; label: string }
    type Track = { key: string; name: string; total: number; tiers: Tier[]; unit: string }
    const tracks: Track[] = [
      {
        key: "tasks",
        name: "全家任務",
        total: totals.tasks,
        unit: "個",
        tiers: [
          { value: 100, emoji: "🌟", label: "百任務達人" },
          { value: 500, emoji: "🏆", label: "五百任務勇者" },
          { value: 1000, emoji: "🐉", label: "千任務傳奇" },
        ],
      },
      {
        key: "reward",
        name: "總獎勵",
        total: totals.reward,
        unit: "元",
        tiers: [
          { value: 5000, emoji: "💰", label: "五千賺手" },
          { value: 20000, emoji: "💎", label: "兩萬大戶" },
          { value: 50000, emoji: "👑", label: "五萬王者" },
        ],
      },
      {
        key: "given",
        name: "全家捐贈",
        total: totals.given,
        unit: "元",
        tiers: [
          { value: 1000, emoji: "❤️", label: "千元愛心" },
          { value: 5000, emoji: "🌈", label: "五千慈善" },
          { value: 10000, emoji: "👼", label: "萬元天使" },
        ],
      },
      {
        key: "saved",
        name: "家庭存款",
        total: totals.saved,
        unit: "元",
        tiers: [
          { value: 5000, emoji: "🐷", label: "五千小金豬" },
          { value: 20000, emoji: "🪙", label: "兩萬金庫" },
          { value: 50000, emoji: "🏰", label: "五萬城堡" },
        ],
      },
      {
        key: "checkins",
        name: "全家打卡",
        total: totals.checkins,
        unit: "天",
        tiers: [
          { value: 30, emoji: "📅", label: "30 天打卡" },
          { value: 100, emoji: "🔥", label: "百日打卡" },
          { value: 365, emoji: "⚡", label: "一年連續" },
        ],
      },
    ]

    const milestones = tracks.map((tr) => {
      const reached = tr.tiers.filter((t) => tr.total >= t.value)
      const next = tr.tiers.find((t) => tr.total < t.value)
      return {
        key: tr.key,
        name: tr.name,
        unit: tr.unit,
        total: tr.total,
        reached,
        next: next
          ? {
              ...next,
              remaining: next.value - tr.total,
              progress: Math.round((tr.total / next.value) * 100),
            }
          : null,
        complete: !next,
      }
    })

    const totalReached = milestones.reduce((s, m) => s + m.reached.length, 0)
    const totalPossible = tracks.reduce((s, t) => s + t.tiers.length, 0)

    res.json({
      totals,
      milestones,
      summary: { totalReached, totalPossible },
    })
  })
)

/**
 * GET /api/family/wealth-trend?months=6
 * 家庭近 N 月財富趨勢：每月 reward / spent / given / net
 */
router.get(
  "/api/family/wealth-trend",
  asyncHandler(async (req, res) => {
    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24)

    const result = await db.execute(sql`
      WITH month_series AS (
        SELECT generate_series(
          DATE_TRUNC('month', CURRENT_DATE - (${months - 1}::int || ' months')::interval),
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        )::date AS m
      )
      SELECT
        TO_CHAR(ms.m, 'YYYY-MM') AS month,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE status = 'approved'
            AND DATE_TRUNC('month', completed_at) = ms.m
        ), 0) AS reward,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE jar = 'spend'
            AND DATE_TRUNC('month', spend_date) = ms.m
        ), 0) AS spent,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE jar = 'give'
            AND DATE_TRUNC('month', spend_date) = ms.m
        ), 0) AS given
      FROM month_series ms
      ORDER BY ms.m ASC
    `)
    const rows = (
      result as unknown as {
        rows: {
          month: string
          reward: string | number
          spent: string | number
          given: string | number
        }[]
      }
    ).rows

    const trend = rows.map((r) => ({
      month: r.month,
      reward: Number(r.reward ?? 0),
      spent: Number(r.spent ?? 0),
      given: Number(r.given ?? 0),
      net: Number(r.reward ?? 0) - Number(r.spent ?? 0) - Number(r.given ?? 0),
    }))

    const summary = {
      totalReward: trend.reduce((s, t) => s + t.reward, 0),
      totalSpent: trend.reduce((s, t) => s + t.spent, 0),
      totalGiven: trend.reduce((s, t) => s + t.given, 0),
      totalNet: trend.reduce((s, t) => s + t.net, 0),
    }

    res.json({ months, summary, trend })
  })
)

/**
 * GET /api/family/kid-time-of-day?kidId=
 * 小孩任務完成時段分析（看是早起型/午後型/夜貓型）
 *
 * 4 時段：
 *   morning（06-11）/ afternoon（12-17）/ evening（18-21）/ night（22-05）
 * 回 totalTasks + slots + dominantSlot
 */
router.get(
  "/api/family/kid-time-of-day",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT EXTRACT(HOUR FROM completed_at)::int AS h, COUNT(*)::int AS n
      FROM kids_tasks
      WHERE kid_id = ${kidIdQ}
        AND status = 'approved'
        AND completed_at IS NOT NULL
      GROUP BY h
    `)
    const rows = (result as unknown as { rows: { h: number; n: number }[] }).rows

    const counts = { morning: 0, afternoon: 0, evening: 0, night: 0 }
    for (const r of rows) {
      const h = r.h
      if (h >= 6 && h < 12) counts.morning += r.n
      else if (h >= 12 && h < 18) counts.afternoon += r.n
      else if (h >= 18 && h < 22) counts.evening += r.n
      else counts.night += r.n
    }

    const total = counts.morning + counts.afternoon + counts.evening + counts.night

    const SLOT_META: Record<
      string,
      { name: string; emoji: string; range: string; personality: string }
    > = {
      morning: {
        name: "早晨",
        emoji: "🌅",
        range: "06-11",
        personality: "早起型 — 一日之計在於晨！",
      },
      afternoon: {
        name: "下午",
        emoji: "☀️",
        range: "12-17",
        personality: "午後型 — 下午精力旺盛！",
      },
      evening: {
        name: "傍晚",
        emoji: "🌆",
        range: "18-21",
        personality: "傍晚型 — 晚餐前的家事達人！",
      },
      night: { name: "深夜", emoji: "🌙", range: "22-05", personality: "夜貓型 — 夜晚的勞動者！" },
    }

    const slots = (["morning", "afternoon", "evening", "night"] as const).map((key) => {
      const count = counts[key]
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0
      return {
        slot: key,
        name: SLOT_META[key].name,
        emoji: SLOT_META[key].emoji,
        range: SLOT_META[key].range,
        count,
        percentage,
      }
    })

    let dominantSlot: (typeof slots)[0] & { personality: string } = {
      ...slots[0],
      personality: "",
    }
    let topCount = -1
    for (const s of slots) {
      if (s.count > topCount) {
        topCount = s.count
        dominantSlot = { ...s, personality: SLOT_META[s.slot].personality }
      }
    }

    res.json({
      kidId: kidIdQ,
      totalTasks: total,
      slots,
      dominantSlot: total > 0 ? dominantSlot : null,
    })
  })
)

export default router
