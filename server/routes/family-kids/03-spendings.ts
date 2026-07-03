/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 03，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql, eq, and, desc } from "drizzle-orm"
import { kidsAccounts, kidsBadges, kidsSpendings, kidsDailyMessages } from "@shared/schema"
import { calcStreak } from "./helpers"

const router = Router()

router.delete(
  "/api/family/spendings/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const [sp] = await db.select().from(kidsSpendings).where(eq(kidsSpendings.id, id)).limit(1)
    if (!sp) throw new AppError(404, "紀錄不存在")
    const amt = parseFloat(sp.amount)
    const col = `${sp.jar}_balance`
    // 退回餘額
    await db.execute(sql`
      UPDATE kids_jars
      SET ${sql.raw(col)} = ${sql.raw(col)} + ${amt.toFixed(2)}::numeric,
          total_spent = GREATEST(0, total_spent - ${amt.toFixed(2)}::numeric),
          updated_at = NOW()
      WHERE kid_id = ${sp.kidId}
    `)
    await db.delete(kidsSpendings).where(eq(kidsSpendings.id, id))
    res.json({ ok: true })
  })
)

router.get(
  "/api/family/badges",
  asyncHandler(async (req, res) => {
    const kidIdQ = req.query.kidId ? Number(req.query.kidId) : null
    if (!kidIdQ) throw new AppError(400, "需傳 kidId")
    const rows = await db
      .select()
      .from(kidsBadges)
      .where(eq(kidsBadges.kidId, kidIdQ))
      .orderBy(desc(kidsBadges.earnedAt))
    res.json(rows)
  })
)

/**
 * GET /api/family/jars-trend?kidId=&days=30
 * 過去 N 天每天的三罐餘額趨勢（累積收 - 累積花）
 * 給小孩看自己存錢進步、培養儲蓄成就感
 */
router.get(
  "/api/family/jars-trend",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10), 7), 90)

    // 取小孩比例
    const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, kidIdQ)).limit(1)
    if (!kid) throw new AppError(404, "小孩不存在")

    // 對每一天計算「累積至當天」的三罐餘額
    // 收入面：approved tasks WHERE approved_at <= day（按比例分配）
    // 支出面：spendings WHERE spend_date <= day（按 jar 扣）
    const rows = await db.execute(sql`
      WITH RECURSIVE day_series AS (
        SELECT (CURRENT_DATE - INTERVAL '${sql.raw(String(days - 1))} days')::date AS d
        UNION ALL
        SELECT (d + INTERVAL '1 day')::date FROM day_series WHERE d < CURRENT_DATE
      ),
      received AS (
        SELECT
          ds.d,
          COALESCE(SUM(t.reward_amount::numeric), 0)::numeric AS total
        FROM day_series ds
        LEFT JOIN kids_tasks t ON t.kid_id = ${kidIdQ}
          AND t.status = 'approved'
          AND t.approved_at::date <= ds.d
        GROUP BY ds.d
      ),
      spent AS (
        SELECT
          ds.d,
          COALESCE(SUM(s.amount::numeric) FILTER (WHERE s.jar = 'spend'), 0)::numeric AS spend_out,
          COALESCE(SUM(s.amount::numeric) FILTER (WHERE s.jar = 'save'), 0)::numeric AS save_out,
          COALESCE(SUM(s.amount::numeric) FILTER (WHERE s.jar = 'give'), 0)::numeric AS give_out
        FROM day_series ds
        LEFT JOIN kids_spendings s ON s.kid_id = ${kidIdQ} AND s.spend_date <= ds.d
        GROUP BY ds.d
      )
      SELECT
        to_char(r.d, 'YYYY-MM-DD') AS date,
        ROUND(r.total * ${kid.spendRatio} / 100 - sp.spend_out, 2)::numeric AS "spendBalance",
        ROUND(r.total * ${kid.saveRatio}  / 100 - sp.save_out,  2)::numeric AS "saveBalance",
        ROUND(r.total * ${kid.giveRatio}  / 100 - sp.give_out,  2)::numeric AS "giveBalance"
      FROM received r
      JOIN spent sp ON sp.d = r.d
      ORDER BY r.d
    `)
    const trend = (
      rows as unknown as {
        rows: {
          date: string
          spendBalance: string
          saveBalance: string
          giveBalance: string
        }[]
      }
    ).rows.map((r) => ({
      date: r.date,
      spend: parseFloat(r.spendBalance),
      save: parseFloat(r.saveBalance),
      give: parseFloat(r.giveBalance),
    }))
    res.json({ kidId: kidIdQ, days, trend })
  })
)

/**
 * GET /api/family/jars-trend-multi?days=30
 * 全家所有 active 小孩的「總餘額」每日趨勢（spend+save+give）
 * 給家長一目了然看誰存錢進步、誰花得多
 * Response: { days, dates: string[], series: [{ kidId, displayName, avatar, color, values: number[] }] }
 */
router.get(
  "/api/family/jars-trend-multi",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10), 7), 90)
    const kids = await db.select().from(kidsAccounts).where(eq(kidsAccounts.isActive, true))
    if (kids.length === 0) {
      res.json({ days, dates: [], series: [] })
      return
    }

    // 一次 query：對每個 kid 算每天的「總餘額」
    // total = received - all spendings（不分罐、簡化視圖）
    const rows = await db.execute(sql`
      WITH RECURSIVE day_series AS (
        SELECT (CURRENT_DATE - INTERVAL '${sql.raw(String(days - 1))} days')::date AS d
        UNION ALL
        SELECT (d + INTERVAL '1 day')::date FROM day_series WHERE d < CURRENT_DATE
      ),
      kid_day AS (
        SELECT k.id AS kid_id, ds.d
        FROM kids_accounts k
        CROSS JOIN day_series ds
        WHERE k.is_active = true
      ),
      received AS (
        SELECT
          kd.kid_id, kd.d,
          COALESCE(SUM(t.reward_amount::numeric), 0)::numeric AS total_received
        FROM kid_day kd
        LEFT JOIN kids_tasks t ON t.kid_id = kd.kid_id
          AND t.status = 'approved'
          AND t.approved_at::date <= kd.d
        GROUP BY kd.kid_id, kd.d
      ),
      spent AS (
        SELECT
          kd.kid_id, kd.d,
          COALESCE(SUM(s.amount::numeric), 0)::numeric AS total_spent
        FROM kid_day kd
        LEFT JOIN kids_spendings s ON s.kid_id = kd.kid_id AND s.spend_date <= kd.d
        GROUP BY kd.kid_id, kd.d
      )
      SELECT
        r.kid_id AS "kidId",
        to_char(r.d, 'YYYY-MM-DD') AS date,
        ROUND(r.total_received - sp.total_spent, 2)::numeric AS balance
      FROM received r
      JOIN spent sp ON sp.kid_id = r.kid_id AND sp.d = r.d
      ORDER BY r.d, r.kid_id
    `)
    const rs = (
      rows as unknown as {
        rows: { kidId: number; date: string; balance: string | number }[]
      }
    ).rows

    // 組 dates 陣列 + 每個 kid 的 values 陣列（按 dates 對齊）
    const datesSet = new Set<string>()
    rs.forEach((r) => datesSet.add(r.date))
    const dates = Array.from(datesSet).sort()
    const byKid = new Map<number, Record<string, number>>()
    rs.forEach((r) => {
      if (!byKid.has(r.kidId)) byKid.set(r.kidId, {})
      byKid.get(r.kidId)![r.date] = parseFloat(String(r.balance))
    })

    const series = kids.map((k) => ({
      kidId: k.id,
      displayName: k.displayName,
      avatar: k.avatar,
      color: k.color,
      values: dates.map((d) => byKid.get(k.id)?.[d] ?? 0),
    }))

    res.json({ days, dates, series })
  })
)

/**
 * GET /api/family/monthly-report?kidId=&month=YYYY-MM
 * 個別小孩本月戰績：任務 / 入帳 / 三罐增量 / 花錢 / 目標 / 徽章
 */
router.get(
  "/api/family/monthly-report",
  asyncHandler(async (req, res) => {
    const kidId = Number(req.query.kidId)
    if (!Number.isInteger(kidId) || kidId < 1) throw new AppError(400, "需傳 kidId")
    const monthStr = (req.query.month as string | undefined) ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(monthStr)) throw new AppError(400, "month 格式 YYYY-MM")
    const [year, month] = monthStr.split("-").map(Number)
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
    const endY = month === 12 ? year + 1 : year
    const endM = month === 12 ? 1 : month + 1
    const nextMonth = `${endY}-${String(endM).padStart(2, "0")}-01`

    // 任務統計
    const taskAgg = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_count,
        COALESCE(SUM(reward_amount::numeric) FILTER (WHERE status = 'approved'), 0)::numeric AS approved_sum,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_count,
        COUNT(*) FILTER (WHERE status IN ('pending', 'submitted'))::int AS pending_count
      FROM kids_tasks
      WHERE kid_id = ${kidId}
        AND (approved_at >= ${monthStart}::timestamp AND approved_at < ${nextMonth}::timestamp
             OR created_at >= ${monthStart}::timestamp AND created_at < ${nextMonth}::timestamp)
    `)
    const taskStats = (
      taskAgg as unknown as {
        rows: {
          approved_count: number
          approved_sum: string
          rejected_count: number
          pending_count: number
        }[]
      }
    ).rows[0] ?? { approved_count: 0, approved_sum: "0", rejected_count: 0, pending_count: 0 }

    // 花錢列表
    const spendingsRows = await db.execute(sql`
      SELECT id, jar, amount::numeric AS amount, description, emoji, spend_date AS "spendDate"
      FROM kids_spendings
      WHERE kid_id = ${kidId}
        AND spend_date >= ${monthStart}::date AND spend_date < ${nextMonth}::date
      ORDER BY spend_date DESC, id DESC
    `)
    const spendings = (
      spendingsRows as unknown as {
        rows: {
          id: number
          jar: string
          amount: string
          description: string
          emoji: string | null
          spendDate: string
        }[]
      }
    ).rows.map((s) => ({ ...s, amount: parseFloat(s.amount) }))
    const totalSpent = spendings.reduce((sum, s) => sum + s.amount, 0)

    // 完成目標
    const goalsRows = await db.execute(sql`
      SELECT id, name, emoji, target_amount::numeric AS "targetAmount", completed_at AS "completedAt"
      FROM kids_goals
      WHERE kid_id = ${kidId} AND status = 'completed'
        AND completed_at >= ${monthStart}::timestamp AND completed_at < ${nextMonth}::timestamp
      ORDER BY completed_at DESC
    `)
    const completedGoals = (
      goalsRows as unknown as {
        rows: {
          id: number
          name: string
          emoji: string | null
          targetAmount: string
          completedAt: string
        }[]
      }
    ).rows.map((g) => ({ ...g, targetAmount: parseFloat(g.targetAmount) }))

    // 解鎖徽章
    const badgesRows = await db.execute(sql`
      SELECT id, badge_type AS "badgeType", title, emoji, earned_at AS "earnedAt"
      FROM kids_badges
      WHERE kid_id = ${kidId}
        AND earned_at >= ${monthStart}::timestamp AND earned_at < ${nextMonth}::timestamp
      ORDER BY earned_at DESC
    `)
    const badges = (
      badgesRows as unknown as {
        rows: {
          id: number
          badgeType: string
          title: string
          emoji: string
          earnedAt: string
        }[]
      }
    ).rows

    const approvedSum = parseFloat(taskStats.approved_sum)

    res.json({
      kidId,
      month: monthStr,
      tasks: {
        approvedCount: taskStats.approved_count,
        approvedSum,
        rejectedCount: taskStats.rejected_count,
        pendingCount: taskStats.pending_count,
        avgReward:
          taskStats.approved_count > 0 ? Math.round(approvedSum / taskStats.approved_count) : 0,
      },
      spendings: {
        count: spendings.length,
        totalSpent,
        items: spendings,
      },
      completedGoals,
      badges,
      netGain: approvedSum - totalSpent,
    })
  })
)

/**
 * GET /api/family/leaderboard?month=YYYY-MM&mode=score
 * 本月排行榜、4 種 mode：
 *   - score（預設）：weightedScore + approvedSum + approvedCount
 *   - tasks：approvedCount
 *   - giving：本月 give 罐 sum
 *   - streak：當前 streak（不限本月、看當下）
 */
router.get(
  "/api/family/leaderboard",
  asyncHandler(async (req, res) => {
    const monthStr = (req.query.month as string | undefined) ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(monthStr)) throw new AppError(400, "month 格式 YYYY-MM")
    const mode = String(req.query.mode ?? "score")
    if (!["score", "tasks", "giving", "streak"].includes(mode)) {
      throw new AppError(400, "mode 須為 score / tasks / giving / streak")
    }
    const [year, month] = monthStr.split("-").map(Number)
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
    const endY = month === 12 ? year + 1 : year
    const endM = month === 12 ? 1 : month + 1
    const nextMonth = `${endY}-${String(endM).padStart(2, "0")}-01`

    const rows = await db.execute(sql`
      SELECT
        k.id AS "kidId",
        k.display_name AS "displayName",
        k.avatar,
        k.color,
        COALESCE(t.approved_count, 0)::int AS "approvedCount",
        COALESCE(t.approved_sum, 0)::numeric AS "approvedSum",
        COALESCE(t.weighted_score, 0)::int AS "weightedScore",
        COALESCE(t.hard_count, 0)::int AS "hardCount",
        COALESCE(g.completed_count, 0)::int AS "completedGoalsCount",
        COALESCE(b.badge_count, 0)::int AS "badgeCount",
        COALESCE(s.give_sum, 0)::numeric AS "giveSum"
      FROM kids_accounts k
      LEFT JOIN (
        SELECT kid_id,
               COUNT(*) AS approved_count,
               SUM(reward_amount::numeric) AS approved_sum,
               SUM(CASE difficulty
                     WHEN 'hard' THEN 3
                     WHEN 'medium' THEN 2
                     ELSE 1
                   END) AS weighted_score,
               COUNT(*) FILTER (WHERE difficulty = 'hard')::int AS hard_count
        FROM kids_tasks
        WHERE status = 'approved'
          AND approved_at >= ${monthStart}::timestamp
          AND approved_at < ${nextMonth}::timestamp
        GROUP BY kid_id
      ) t ON t.kid_id = k.id
      LEFT JOIN (
        SELECT kid_id, COUNT(*) AS completed_count
        FROM kids_goals
        WHERE status = 'completed'
          AND completed_at >= ${monthStart}::timestamp
          AND completed_at < ${nextMonth}::timestamp
        GROUP BY kid_id
      ) g ON g.kid_id = k.id
      LEFT JOIN (
        SELECT kid_id, COUNT(*) AS badge_count
        FROM kids_badges
        WHERE earned_at >= ${monthStart}::timestamp
          AND earned_at < ${nextMonth}::timestamp
        GROUP BY kid_id
      ) b ON b.kid_id = k.id
      LEFT JOIN (
        SELECT kid_id, SUM(amount::numeric) AS give_sum
        FROM kids_spendings
        WHERE jar = 'give'
          AND spend_date >= ${monthStart}::date
          AND spend_date < ${nextMonth}::date
        GROUP BY kid_id
      ) s ON s.kid_id = k.id
      WHERE k.is_active = true
    `)
    const baseList = (
      rows as unknown as {
        rows: {
          kidId: number
          displayName: string
          avatar: string
          color: string
          approvedCount: number
          approvedSum: string | number
          weightedScore: number
          hardCount: number
          completedGoalsCount: number
          badgeCount: number
          giveSum: string | number
        }[]
      }
    ).rows.map((r) => ({
      ...r,
      approvedSum: parseFloat(String(r.approvedSum)),
      giveSum: parseFloat(String(r.giveSum)),
    }))

    // 補 streak（per kid 算）
    const withStreak = await Promise.all(
      baseList.map(async (k) => ({ ...k, streak: await calcStreak(k.kidId) }))
    )

    // 按 mode 排序
    const sorted = [...withStreak].sort((a, b) => {
      if (mode === "tasks")
        return b.approvedCount - a.approvedCount || b.approvedSum - a.approvedSum
      if (mode === "giving") return b.giveSum - a.giveSum || b.approvedSum - a.approvedSum
      if (mode === "streak") return b.streak - a.streak || b.approvedCount - a.approvedCount
      // score（預設）
      return (
        b.weightedScore - a.weightedScore ||
        b.approvedSum - a.approvedSum ||
        b.approvedCount - a.approvedCount
      )
    })

    const list = sorted.map((r, i) => ({
      ...r,
      rank: i + 1,
      medal: i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "",
    }))
    res.json({ month: monthStr, mode, leaderboard: list })
  })
)

/**
 * 家長每日鼓勵卡
 *   POST /api/family/daily-message  → 寫鼓勵卡（每天每個小孩最多 1 則、覆蓋舊的）
 *   GET  /api/family/daily-message?kidId=&date= → 查當日鼓勵（沒寫回 null）
 */
router.post(
  "/api/family/daily-message",
  asyncHandler(async (req, res) => {
    const kidIdN = Number(req.body?.kidId)
    const message = String(req.body?.message ?? "").trim()
    const mood = String(req.body?.mood ?? "❤️").slice(0, 8)
    if (!kidIdN) throw new AppError(400, "kidId 必填")
    if (!message) throw new AppError(400, "message 必填")
    if (message.length > 500) throw new AppError(400, "訊息過長（500 字以內）")

    const today = new Date().toISOString().slice(0, 10)
    // Upsert by (kidId, messageDate)
    const existing = await db.execute(sql`
      SELECT id FROM kids_daily_messages
      WHERE kid_id = ${kidIdN} AND message_date = ${today}
      LIMIT 1
    `)
    const existingId = (existing as unknown as { rows: { id: number }[] }).rows[0]?.id

    if (existingId) {
      await db.execute(sql`
        UPDATE kids_daily_messages
        SET message = ${message}, mood = ${mood}
        WHERE id = ${existingId}
      `)
      const [updated] = await db
        .select()
        .from(kidsDailyMessages)
        .where(eq(kidsDailyMessages.id, existingId))
        .limit(1)
      res.json({ ok: true, message: updated, updated: true })
    } else {
      const [created] = await db
        .insert(kidsDailyMessages)
        .values({ kidId: kidIdN, message, mood, messageDate: today })
        .returning()
      res.status(201).json({ ok: true, message: created, updated: false })
    }
  })
)

router.get(
  "/api/family/daily-message",
  asyncHandler(async (req, res) => {
    const kidIdN = Number(req.query?.kidId)
    if (!kidIdN) throw new AppError(400, "kidId 必填")
    const date = (req.query?.date as string) ?? new Date().toISOString().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError(400, "date 格式 YYYY-MM-DD")
    const [row] = await db
      .select()
      .from(kidsDailyMessages)
      .where(and(eq(kidsDailyMessages.kidId, kidIdN), eq(kidsDailyMessages.messageDate, date)))
      .limit(1)
    res.json({ kidId: kidIdN, date, message: row ?? null })
  })
)

/**
 * GET /api/family/family-monthly-summary?month=YYYY-MM
 * 全家本月匯總：每個 active 小孩 + grand totals
 * 家長一頁看完全家本月戰績
 */
router.get(
  "/api/family/family-monthly-summary",
  asyncHandler(async (req, res) => {
    const monthStr = (req.query.month as string | undefined) ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(monthStr)) throw new AppError(400, "month 格式 YYYY-MM")
    const [year, month] = monthStr.split("-").map(Number)
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
    const endY = month === 12 ? year + 1 : year
    const endM = month === 12 ? 1 : month + 1
    const nextMonth = `${endY}-${String(endM).padStart(2, "0")}-01`

    const rows = await db.execute(sql`
      SELECT
        k.id AS "kidId",
        k.display_name AS "displayName",
        k.avatar,
        k.color,
        COALESCE(t.approved_count, 0)::int AS "approvedCount",
        COALESCE(t.approved_sum, 0)::numeric AS "approvedSum",
        COALESCE(t.rejected_count, 0)::int AS "rejectedCount",
        COALESCE(t.hard_count, 0)::int AS "hardCount",
        COALESCE(t.weighted_score, 0)::int AS "weightedScore",
        COALESCE(s.total_spent, 0)::numeric AS "totalSpent",
        COALESCE(s.spend_jar, 0)::numeric AS "spendJarOut",
        COALESCE(s.save_jar, 0)::numeric AS "saveJarOut",
        COALESCE(s.give_jar, 0)::numeric AS "giveJarOut",
        COALESCE(g.completed_count, 0)::int AS "goalCompletedCount",
        COALESCE(b.badge_count, 0)::int AS "badgeCount"
      FROM kids_accounts k
      LEFT JOIN (
        SELECT kid_id,
               COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
               SUM(reward_amount::numeric) FILTER (WHERE status = 'approved') AS approved_sum,
               COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
               COUNT(*) FILTER (WHERE status = 'approved' AND difficulty = 'hard') AS hard_count,
               SUM(CASE WHEN status = 'approved'
                        THEN CASE difficulty
                               WHEN 'hard' THEN 3 WHEN 'medium' THEN 2 ELSE 1
                             END
                        ELSE 0 END) AS weighted_score
        FROM kids_tasks
        WHERE (approved_at >= ${monthStart}::timestamp AND approved_at < ${nextMonth}::timestamp)
           OR (status = 'rejected' AND updated_at >= ${monthStart}::timestamp AND updated_at < ${nextMonth}::timestamp)
        GROUP BY kid_id
      ) t ON t.kid_id = k.id
      LEFT JOIN (
        SELECT kid_id,
               SUM(amount::numeric) AS total_spent,
               SUM(amount::numeric) FILTER (WHERE jar = 'spend') AS spend_jar,
               SUM(amount::numeric) FILTER (WHERE jar = 'save') AS save_jar,
               SUM(amount::numeric) FILTER (WHERE jar = 'give') AS give_jar
        FROM kids_spendings
        WHERE spend_date >= ${monthStart}::date AND spend_date < ${nextMonth}::date
        GROUP BY kid_id
      ) s ON s.kid_id = k.id
      LEFT JOIN (
        SELECT kid_id, COUNT(*) AS completed_count
        FROM kids_goals
        WHERE status = 'completed'
          AND completed_at >= ${monthStart}::timestamp
          AND completed_at < ${nextMonth}::timestamp
        GROUP BY kid_id
      ) g ON g.kid_id = k.id
      LEFT JOIN (
        SELECT kid_id, COUNT(*) AS badge_count
        FROM kids_badges
        WHERE earned_at >= ${monthStart}::timestamp AND earned_at < ${nextMonth}::timestamp
        GROUP BY kid_id
      ) b ON b.kid_id = k.id
      WHERE k.is_active = true
      ORDER BY "weightedScore" DESC, "approvedSum" DESC, k.id
    `)

    const kidsList = (
      rows as unknown as {
        rows: Array<{
          kidId: number
          displayName: string
          avatar: string
          color: string
          approvedCount: number
          approvedSum: string | number
          rejectedCount: number
          hardCount: number
          weightedScore: number
          totalSpent: string | number
          spendJarOut: string | number
          saveJarOut: string | number
          giveJarOut: string | number
          goalCompletedCount: number
          badgeCount: number
        }>
      }
    ).rows.map((r) => ({
      ...r,
      approvedSum: parseFloat(String(r.approvedSum)),
      totalSpent: parseFloat(String(r.totalSpent)),
      spendJarOut: parseFloat(String(r.spendJarOut)),
      saveJarOut: parseFloat(String(r.saveJarOut)),
      giveJarOut: parseFloat(String(r.giveJarOut)),
    }))

    const grandTotal = kidsList.reduce(
      (s, k) => ({
        approvedCount: s.approvedCount + k.approvedCount,
        approvedSum: s.approvedSum + k.approvedSum,
        rejectedCount: s.rejectedCount + k.rejectedCount,
        hardCount: s.hardCount + k.hardCount,
        weightedScore: s.weightedScore + k.weightedScore,
        totalSpent: s.totalSpent + k.totalSpent,
        giveJarOut: s.giveJarOut + k.giveJarOut,
        goalCompletedCount: s.goalCompletedCount + k.goalCompletedCount,
        badgeCount: s.badgeCount + k.badgeCount,
      }),
      {
        approvedCount: 0,
        approvedSum: 0,
        rejectedCount: 0,
        hardCount: 0,
        weightedScore: 0,
        totalSpent: 0,
        giveJarOut: 0,
        goalCompletedCount: 0,
        badgeCount: 0,
      }
    )

    res.json({ month: monthStr, kids: kidsList, grandTotal })
  })
)

export default router
