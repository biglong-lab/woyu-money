/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 04，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"

const router = Router()

/**
 * GET /api/family/year-summary?year=YYYY
 * 家庭年度回顧、年底儀式感、家長愛看
 * 統計：總任務 / 總給付 / 各小孩戰績 / 達成目標 / 徽章 / 最長 streak / 捐贈
 */
router.get(
  "/api/family/year-summary",
  asyncHandler(async (req, res) => {
    const year = Number(req.query.year ?? new Date().getFullYear())
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      throw new AppError(400, "year 不合法")
    }
    const yearStart = `${year}-01-01`
    const nextYear = `${year + 1}-01-01`

    // 1) 各小孩戰績
    const kidStats = await db.execute(sql`
      SELECT
        k.id AS "kidId",
        k.display_name AS "displayName",
        k.avatar,
        k.color,
        COUNT(t.id) FILTER (WHERE t.status = 'approved')::int AS "approvedCount",
        COALESCE(SUM(t.reward_amount::numeric) FILTER (WHERE t.status = 'approved'), 0)::numeric AS "approvedSum",
        COUNT(*) FILTER (WHERE t.status = 'approved' AND t.difficulty = 'hard')::int AS "hardCount"
      FROM kids_accounts k
      LEFT JOIN kids_tasks t ON t.kid_id = k.id
        AND t.approved_at >= ${yearStart}::timestamp
        AND t.approved_at < ${nextYear}::timestamp
      WHERE k.is_active = true
      GROUP BY k.id, k.display_name, k.avatar, k.color
      ORDER BY "approvedSum" DESC, "approvedCount" DESC
    `)

    // 2) 達成目標
    const goalRows = await db.execute(sql`
      SELECT g.name, g.emoji, g.target_amount::numeric AS target,
             g.completed_at, k.display_name AS kid_name, k.avatar
      FROM kids_goals g
      LEFT JOIN kids_accounts k ON k.id = g.kid_id
      WHERE g.status = 'completed'
        AND g.completed_at >= ${yearStart}::timestamp
        AND g.completed_at < ${nextYear}::timestamp
      ORDER BY g.completed_at DESC
    `)

    // 3) 徽章
    const badgeRows = await db.execute(sql`
      SELECT b.badge_type, b.title, b.emoji, b.earned_at,
             k.display_name AS kid_name, k.avatar
      FROM kids_badges b
      LEFT JOIN kids_accounts k ON k.id = b.kid_id
      WHERE b.earned_at >= ${yearStart}::timestamp
        AND b.earned_at < ${nextYear}::timestamp
      ORDER BY b.earned_at DESC
    `)

    // 4) 捐贈紀錄
    const giveRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(s.amount::numeric), 0)::numeric AS total_given,
        COUNT(DISTINCT s.recipient) FILTER (WHERE s.recipient IS NOT NULL)::int AS recipient_count,
        COUNT(*)::int AS donation_count
      FROM kids_spendings s
      WHERE s.jar = 'give'
        AND s.spend_date >= ${yearStart}::date
        AND s.spend_date < ${nextYear}::date
    `)
    const giveStats = (
      giveRows as unknown as {
        rows: Array<{
          total_given: string | number
          recipient_count: number
          donation_count: number
        }>
      }
    ).rows[0]

    // 5) 月度給付分布（12 月一字排開）
    const monthRows = await db.execute(sql`
      SELECT
        EXTRACT(MONTH FROM approved_at)::int AS month,
        COALESCE(SUM(reward_amount::numeric), 0)::numeric AS total
      FROM kids_tasks
      WHERE status = 'approved'
        AND approved_at >= ${yearStart}::timestamp
        AND approved_at < ${nextYear}::timestamp
      GROUP BY EXTRACT(MONTH FROM approved_at)
      ORDER BY month
    `)
    const monthlyMap: Record<number, number> = {}
    ;(monthRows as unknown as { rows: { month: number; total: string | number }[] }).rows.forEach(
      (r) => {
        monthlyMap[r.month] = parseFloat(String(r.total))
      }
    )
    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      total: monthlyMap[i + 1] ?? 0,
    }))

    const kids = (
      kidStats as unknown as {
        rows: Array<{
          kidId: number
          displayName: string
          avatar: string
          color: string
          approvedCount: number
          approvedSum: string | number
          hardCount: number
        }>
      }
    ).rows.map((r) => ({
      ...r,
      approvedSum: parseFloat(String(r.approvedSum)),
    }))

    const grandTotal = {
      tasks: kids.reduce((s, k) => s + k.approvedCount, 0),
      reward: kids.reduce((s, k) => s + k.approvedSum, 0),
      hardCount: kids.reduce((s, k) => s + k.hardCount, 0),
      goalsCompleted: (goalRows as unknown as { rows: unknown[] }).rows.length,
      badgesEarned: (badgeRows as unknown as { rows: unknown[] }).rows.length,
      totalGiven: parseFloat(String(giveStats?.total_given ?? 0)),
      donationCount: giveStats?.donation_count ?? 0,
      recipientCount: giveStats?.recipient_count ?? 0,
    }

    res.json({
      year,
      kids,
      goals: (
        goalRows as unknown as {
          rows: Array<{
            name: string
            emoji: string | null
            target: string | number
            completed_at: string
            kid_name: string
            avatar: string
          }>
        }
      ).rows.map((r) => ({
        name: r.name,
        emoji: r.emoji,
        target: parseFloat(String(r.target)),
        completedAt: r.completed_at,
        kidName: r.kid_name,
        avatar: r.avatar,
      })),
      badges: (
        badgeRows as unknown as {
          rows: Array<{
            badge_type: string
            title: string
            emoji: string
            earned_at: string
            kid_name: string
            avatar: string
          }>
        }
      ).rows.map((r) => ({
        badgeType: r.badge_type,
        title: r.title,
        emoji: r.emoji,
        earnedAt: r.earned_at,
        kidName: r.kid_name,
        avatar: r.avatar,
      })),
      monthly,
      grandTotal,
    })
  })
)

/**
 * GET /api/family/category-stats?days=30
 * 各 active 小孩近 N 天 5 大 category approved 任務數 + 全家總計
 * 家長看小孩偏好 / 缺什麼類別任務
 */
router.get(
  "/api/family/category-stats",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10), 7), 365)
    const sinceIso = new Date(Date.now() - days * 86400000).toISOString()

    const rows = await db.execute(sql`
      SELECT
        k.id AS "kidId",
        k.display_name AS "displayName",
        k.avatar,
        k.color,
        t.category,
        COUNT(*)::int AS count,
        SUM(t.reward_amount::numeric)::numeric AS reward_sum
      FROM kids_accounts k
      LEFT JOIN kids_tasks t ON t.kid_id = k.id
        AND t.status = 'approved'
        AND t.approved_at >= ${sinceIso}::timestamp
      WHERE k.is_active = true
      GROUP BY k.id, k.display_name, k.avatar, k.color, t.category
    `)

    type Row = {
      kidId: number
      displayName: string
      avatar: string
      color: string
      category: string | null
      count: number
      reward_sum: string | number | null
    }
    const data = (rows as unknown as { rows: Row[] }).rows

    const CATEGORIES = ["housework", "study", "self_care", "kindness", "other"] as const
    const byKid = new Map<
      number,
      {
        kidId: number
        displayName: string
        avatar: string
        color: string
        categories: Record<string, { count: number; rewardSum: number }>
        total: number
      }
    >()
    data.forEach((r) => {
      if (!byKid.has(r.kidId)) {
        byKid.set(r.kidId, {
          kidId: r.kidId,
          displayName: r.displayName,
          avatar: r.avatar,
          color: r.color,
          categories: {},
          total: 0,
        })
      }
      if (r.category) {
        const k = byKid.get(r.kidId)!
        k.categories[r.category] = {
          count: r.count,
          rewardSum: parseFloat(String(r.reward_sum ?? 0)),
        }
        k.total += r.count
      }
    })

    const kids = Array.from(byKid.values()).map((k) => ({
      ...k,
      categories: CATEGORIES.reduce(
        (acc, c) => {
          acc[c] = k.categories[c] ?? { count: 0, rewardSum: 0 }
          return acc
        },
        {} as Record<string, { count: number; rewardSum: number }>
      ),
    }))

    // grand total
    const grandTotal = CATEGORIES.reduce(
      (acc, c) => {
        acc[c] = { count: 0, rewardSum: 0 }
        return acc
      },
      {} as Record<string, { count: number; rewardSum: number }>
    )
    kids.forEach((k) => {
      CATEGORIES.forEach((c) => {
        grandTotal[c].count += k.categories[c].count
        grandTotal[c].rewardSum += k.categories[c].rewardSum
      })
    })

    res.json({ days, kids, grandTotal })
  })
)

/**
 * GET /api/family/difficulty-insights
 * 看每個 active 小孩過去 90 天 hard/medium/easy 任務的 approved/rejected 比例
 * 自動建議升降難度（讓家長知道任務太簡單或太難）
 */
router.get(
  "/api/family/difficulty-insights",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        k.id AS "kidId",
        k.display_name AS "displayName",
        k.avatar,
        t.difficulty,
        COUNT(*) FILTER (WHERE t.status = 'approved')::int AS approved_count,
        COUNT(*) FILTER (WHERE t.status = 'rejected')::int AS rejected_count,
        COUNT(*)::int AS total_count
      FROM kids_accounts k
      LEFT JOIN kids_tasks t ON t.kid_id = k.id
        AND t.created_at >= (NOW() - INTERVAL '90 days')
        AND t.status IN ('approved', 'rejected')
      WHERE k.is_active = true
      GROUP BY k.id, k.display_name, k.avatar, t.difficulty
    `)

    type Row = {
      kidId: number
      displayName: string
      avatar: string
      difficulty: string | null
      approved_count: number
      rejected_count: number
      total_count: number
    }
    const data = (rows as unknown as { rows: Row[] }).rows

    const byKid = new Map<
      number,
      {
        kidId: number
        displayName: string
        avatar: string
        breakdown: Record<string, { approved: number; rejected: number; rate: number }>
      }
    >()
    data.forEach((r) => {
      if (!r.difficulty) return
      if (!byKid.has(r.kidId)) {
        byKid.set(r.kidId, {
          kidId: r.kidId,
          displayName: r.displayName,
          avatar: r.avatar,
          breakdown: {},
        })
      }
      const total = r.total_count || 1
      byKid.get(r.kidId)!.breakdown[r.difficulty] = {
        approved: r.approved_count,
        rejected: r.rejected_count,
        rate: Math.round((r.approved_count / total) * 100),
      }
    })

    const insights = Array.from(byKid.values()).map((k) => {
      const easy = k.breakdown.easy
      const medium = k.breakdown.medium
      const hard = k.breakdown.hard
      const suggestions: string[] = []

      if (easy && easy.approved + easy.rejected >= 5 && easy.rate >= 90) {
        suggestions.push("簡單任務通過率高、可挑戰更多 ⭐⭐ 普通難度")
      }
      if (medium && medium.approved + medium.rejected >= 5 && medium.rate >= 90) {
        suggestions.push("普通任務輕鬆完成、可派 ⭐⭐⭐ 挑戰任務")
      }
      if (hard && hard.approved + hard.rejected >= 3 && hard.rate < 50) {
        suggestions.push("挑戰任務通過率低、考慮先給 ⭐⭐ 普通讓他建立信心")
      }
      if (!hard && medium && medium.rate >= 80) {
        suggestions.push("可嘗試派第一個 ⭐⭐⭐ 挑戰任務")
      }

      return { ...k, suggestions }
    })

    res.json({ insights: insights.filter((i) => i.suggestions.length > 0) })
  })
)

/**
 * POST /api/family/ai-suggest-tasks
 * Body: { ageRange?: string, learningGoal: string, count?: number }
 * 用 Gemini 生成適齡家事任務 + 建議獎勵金額
 * 失敗或無 API key 回 503、UI 自行 fallback
 */
router.post(
  "/api/family/ai-suggest-tasks",
  asyncHandler(async (req, res) => {
    const ageRange = String(req.body?.ageRange ?? "6-12 歲").slice(0, 30)
    const learningGoal = String(req.body?.learningGoal ?? "").trim()
    const count = Math.min(Math.max(Number(req.body?.count ?? 5), 1), 10)
    if (!learningGoal) throw new AppError(400, "learningGoal 必填")
    if (learningGoal.length > 200) throw new AppError(400, "learningGoal 過長")

    if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
      throw new AppError(503, "AI 服務未設定、請聯絡管理員設定 GEMINI_API_KEY")
    }

    const { GoogleGenAI, Type } = await import("@google/genai")
    const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
    const customBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL
    const ai = new GoogleGenAI({
      apiKey,
      ...(customBaseUrl ? { httpOptions: { apiVersion: "", baseUrl: customBaseUrl } } : {}),
    })

    const prompt = `你是家庭教育專家、幫家長為 ${ageRange} 小孩設計家事任務。
家長學習目標：${learningGoal}

請生成 ${count} 個具體任務、每個含：
- title：簡短中文（不超過 15 字）、動詞開頭
- emoji：1 個適合的 emoji
- rewardAmount：建議獎勵新台幣（5-100、由小到大、考慮任務難度）
- difficulty：easy / medium / hard

要求：
- 任務貼近實際家事 / 自我照顧 / 學習 / 同理心
- 動詞用 6-12 歲小孩能懂的詞
- 獎勵 reasonable 不浮誇
- 不重複`

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  emoji: { type: Type.STRING },
                  rewardAmount: { type: Type.NUMBER },
                  difficulty: {
                    type: Type.STRING,
                    enum: ["easy", "medium", "hard"],
                  },
                },
                required: ["title", "emoji", "rewardAmount", "difficulty"],
              },
            },
          },
          required: ["tasks"],
        },
      },
    })

    let parsed: { tasks?: Array<unknown> }
    try {
      parsed = JSON.parse(response.text || "{}")
    } catch {
      throw new AppError(502, "AI 回應格式錯誤、請稍後再試")
    }
    if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      throw new AppError(502, "AI 未生成任務、請改用更明確的目標")
    }
    res.json({
      ageRange,
      learningGoal,
      tasks: parsed.tasks,
    })
  })
)

/**
 * GET /api/family/parent-reminders
 * 家長提醒中心：一頁聚合該關注的事
 *   - 待審任務（submitted 等家長 approve）
 *   - 逾期任務（dueDate 已過 + still pending/submitted）
 *   - 接近達成的目標（≥80%）
 *   - 7 天無活動的 active 小孩
 */
router.get(
  "/api/family/parent-reminders",
  asyncHandler(async (_req, res) => {
    const submittedRows = await db.execute(sql`
      SELECT t.id, t.title, t.emoji, t.reward_amount::numeric AS reward,
             k.display_name AS kid_name, k.avatar
      FROM kids_tasks t
      LEFT JOIN kids_accounts k ON k.id = t.kid_id
      WHERE t.status = 'submitted'
      ORDER BY t.completed_at DESC
      LIMIT 20
    `)

    const overdueRows = await db.execute(sql`
      SELECT t.id, t.title, t.emoji, t.due_date,
             (CURRENT_DATE - t.due_date)::int AS days_overdue,
             k.display_name AS kid_name, k.avatar
      FROM kids_tasks t
      LEFT JOIN kids_accounts k ON k.id = t.kid_id
      WHERE t.status IN ('pending', 'submitted')
        AND t.due_date IS NOT NULL
        AND t.due_date < CURRENT_DATE
      ORDER BY t.due_date ASC
      LIMIT 20
    `)

    const nearGoalRows = await db.execute(sql`
      SELECT g.id, g.name, g.emoji,
             g.target_amount::numeric AS target,
             g.current_amount::numeric AS current,
             ROUND(g.current_amount::numeric / g.target_amount::numeric * 100, 0)::int AS progress,
             k.display_name AS kid_name, k.avatar
      FROM kids_goals g
      LEFT JOIN kids_accounts k ON k.id = g.kid_id
      WHERE g.status = 'active'
        AND g.target_amount::numeric > 0
        AND g.current_amount::numeric / g.target_amount::numeric >= 0.8
      ORDER BY progress DESC
      LIMIT 10
    `)

    const inactiveRows = await db.execute(sql`
      SELECT k.id, k.display_name, k.avatar,
             COALESCE(MAX(GREATEST(
               COALESCE(t.approved_at, '1970-01-01'::timestamp),
               COALESCE(s.created_at, '1970-01-01'::timestamp)
             )), '1970-01-01'::timestamp) AS last_activity
      FROM kids_accounts k
      LEFT JOIN kids_tasks t ON t.kid_id = k.id AND t.status = 'approved'
      LEFT JOIN kids_spendings s ON s.kid_id = k.id
      WHERE k.is_active = true
      GROUP BY k.id, k.display_name, k.avatar
      HAVING COALESCE(MAX(GREATEST(
        COALESCE(t.approved_at, '1970-01-01'::timestamp),
        COALESCE(s.created_at, '1970-01-01'::timestamp)
      )), '1970-01-01'::timestamp) < (NOW() - INTERVAL '7 days')
    `)

    res.json({
      submitted: (
        submittedRows as unknown as {
          rows: Array<{
            id: number
            title: string
            emoji: string | null
            reward: string | number
            kid_name: string
            avatar: string
          }>
        }
      ).rows.map((r) => ({
        id: r.id,
        title: r.title,
        emoji: r.emoji,
        reward: parseFloat(String(r.reward)),
        kidName: r.kid_name,
        avatar: r.avatar,
      })),
      overdue: (
        overdueRows as unknown as {
          rows: Array<{
            id: number
            title: string
            emoji: string | null
            due_date: string
            days_overdue: number
            kid_name: string
            avatar: string
          }>
        }
      ).rows.map((r) => ({
        id: r.id,
        title: r.title,
        emoji: r.emoji,
        dueDate: r.due_date,
        daysOverdue: r.days_overdue,
        kidName: r.kid_name,
        avatar: r.avatar,
      })),
      nearGoal: (
        nearGoalRows as unknown as {
          rows: Array<{
            id: number
            name: string
            emoji: string | null
            target: string | number
            current: string | number
            progress: number
            kid_name: string
            avatar: string
          }>
        }
      ).rows.map((r) => ({
        id: r.id,
        name: r.name,
        emoji: r.emoji,
        target: parseFloat(String(r.target)),
        current: parseFloat(String(r.current)),
        progress: r.progress,
        kidName: r.kid_name,
        avatar: r.avatar,
      })),
      inactiveKids: (
        inactiveRows as unknown as {
          rows: Array<{
            id: number
            display_name: string
            avatar: string
            last_activity: string
          }>
        }
      ).rows.map((r) => ({
        id: r.id,
        displayName: r.display_name,
        avatar: r.avatar,
        lastActivity: r.last_activity,
      })),
    })
  })
)

export default router
