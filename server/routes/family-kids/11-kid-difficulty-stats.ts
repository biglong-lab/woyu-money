/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 11，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql, eq } from "drizzle-orm"
import { kidsAccounts, kidsGoals } from "@shared/schema"
import { localDateTPE } from "@shared/date-utils"

const router = Router()

/**
 * GET /api/family/kid-difficulty-stats?kidId=
 * 小孩任務難度分佈統計
 * 看小孩有沒有挑戰更難的任務、鼓勵成長
 *
 * 回：
 *   difficulties: [easy/medium/hard 三筆]，含 count + percentage + emoji
 *   totalTasks
 *   averageScore：1.0–3.0（easy=1, medium=2, hard=3）
 *   challengeLevel：beginner / growing / balanced / advanced
 *   suggestion：依分佈給建議
 */
router.get(
  "/api/family/kid-difficulty-stats",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT difficulty, COUNT(*)::int AS n
      FROM kids_tasks
      WHERE kid_id = ${kidIdQ} AND status = 'approved'
      GROUP BY difficulty
    `)
    const byDiff = new Map(
      (result as unknown as { rows: { difficulty: string; n: number }[] }).rows.map((r) => [
        r.difficulty,
        r.n,
      ])
    )

    const easyN = byDiff.get("easy") ?? 0
    const mediumN = byDiff.get("medium") ?? 0
    const hardN = byDiff.get("hard") ?? 0
    const total = easyN + mediumN + hardN

    const DIFF_META = {
      easy: { emoji: "🟢", name: "簡單", score: 1 },
      medium: { emoji: "🟡", name: "中等", score: 2 },
      hard: { emoji: "🔴", name: "困難", score: 3 },
    } as const

    const difficulties = (["easy", "medium", "hard"] as const).map((key) => {
      const count = byDiff.get(key) ?? 0
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0
      return {
        difficulty: key,
        name: DIFF_META[key].name,
        emoji: DIFF_META[key].emoji,
        count,
        percentage,
      }
    })

    const totalScore = easyN * 1 + mediumN * 2 + hardN * 3
    const averageScore = total > 0 ? Math.round((totalScore / total) * 100) / 100 : 0

    let challengeLevel: "none" | "beginner" | "growing" | "balanced" | "advanced"
    let suggestion: string
    if (total === 0) {
      challengeLevel = "none"
      suggestion = "還沒做過任務、開始第一個試試吧！"
    } else if (averageScore < 1.3) {
      challengeLevel = "beginner"
      suggestion = "幾乎都是簡單任務、可以嘗試中等難度挑戰看看！"
    } else if (averageScore < 1.8) {
      challengeLevel = "growing"
      suggestion = "進步中、再多挑戰幾個中等任務"
    } else if (averageScore < 2.3) {
      challengeLevel = "balanced"
      suggestion = "難度搭配得不錯！偶爾試試困難任務獎勵更高"
    } else {
      challengeLevel = "advanced"
      suggestion = "勇於挑戰困難任務、超強的！👏"
    }

    res.json({
      kidId: kidIdQ,
      totalTasks: total,
      difficulties,
      averageScore,
      challengeLevel,
      suggestion,
    })
  })
)

/**
 * GET /api/family/goals/:id/eta
 * 目標達成 ETA 預測（按近 30 天 save 罐淨流入推估）
 *
 * 收入 = 近 30 天 task reward × saveRatio
 * 支出 = 近 30 天 save 罐 spending
 * dailyNetSave = (收入 - 支出) / 30
 * etaDays = ceil(remaining / dailyNetSave)
 */
router.get(
  "/api/family/goals/:id/eta",
  asyncHandler(async (req, res) => {
    const goalId = Number(req.params.id)
    if (!Number.isInteger(goalId) || goalId < 1) throw new AppError(400, "ID 無效")

    const [goal] = await db.select().from(kidsGoals).where(eq(kidsGoals.id, goalId)).limit(1)
    if (!goal) throw new AppError(404, "目標不存在")

    const target = parseFloat(goal.targetAmount)
    const current = parseFloat(goal.currentAmount)
    const remaining = target - current

    if (remaining <= 0) {
      return res.json({
        goalId,
        status: "reached",
        dailyNetSave: 0,
        etaDays: 0,
        etaDate: null,
        remaining: 0,
        suggestion: "🎉 已達成！可以買了！",
      })
    }

    const [kid] = await db
      .select()
      .from(kidsAccounts)
      .where(eq(kidsAccounts.id, goal.kidId))
      .limit(1)
    if (!kid) throw new AppError(404, "小孩不存在")
    const saveRatio = kid.saveRatio / 100

    const earnedRows = await db.execute(sql`
      SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric AS total
      FROM kids_tasks
      WHERE kid_id = ${goal.kidId}
        AND status = 'approved'
        AND completed_at >= NOW() - INTERVAL '30 days'
    `)
    const totalEarned = Number(
      (earnedRows as unknown as { rows: { total: string | number }[] }).rows[0]?.total ?? 0
    )
    const saveEarned = totalEarned * saveRatio

    const spentRows = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS total
      FROM kids_spendings
      WHERE kid_id = ${goal.kidId}
        AND jar = 'save'
        AND spend_date >= CURRENT_DATE - INTERVAL '30 days'
    `)
    const saveSpent = Number(
      (spentRows as unknown as { rows: { total: string | number }[] }).rows[0]?.total ?? 0
    )

    const netSave30 = saveEarned - saveSpent
    const dailyNetSave = netSave30 / 30

    if (dailyNetSave <= 0) {
      return res.json({
        goalId,
        status: "no_savings",
        dailyNetSave: 0,
        etaDays: null,
        etaDate: null,
        remaining,
        suggestion: "近期沒在存錢，多做任務或調整 save 比例試試",
      })
    }

    const etaDays = Math.ceil(remaining / dailyNetSave)

    const suggestion =
      etaDays <= 7
        ? `🔥 再 ${etaDays} 天就能買！繼續加油！`
        : etaDays <= 30
          ? `💪 大約 ${etaDays} 天達成、每天存 ${Math.round(dailyNetSave)} 元`
          : etaDays <= 90
            ? `🌱 還要 ${etaDays} 天、試試提高 save 比例會更快`
            : `🎯 ${etaDays} 天有點久、考慮分階段或調整目標`

    res.json({
      goalId,
      status: "predictable",
      dailyNetSave: Math.round(dailyNetSave * 100) / 100,
      etaDays,
      etaDate: localDateTPE(etaDays),
      remaining,
      suggestion,
    })
  })
)

/**
 * GET /api/family/activity?limit=30
 * 全家活動 feed（家長端、不指定 kidId）
 * 一次看全家最近動態：task / spending / checkin / wish
 * 每筆含 kidName + kidAvatar
 */
router.get(
  "/api/family/activity",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 30, 100)

    const result = await db.execute(sql`
      SELECT * FROM (
        SELECT
          'task'::text AS kind,
          kt.id::int AS id,
          kt.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar AS kid_avatar,
          kt.title AS label,
          (kt.reward_amount::text || ' 元') AS amount,
          kt.emoji AS emoji,
          kt.completed_at AS at
        FROM kids_tasks kt
        JOIN kids_accounts ka ON ka.id = kt.kid_id
        WHERE kt.status = 'approved' AND kt.completed_at IS NOT NULL

        UNION ALL

        SELECT
          'spending'::text AS kind,
          ks.id::int AS id,
          ks.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar AS kid_avatar,
          ks.description AS label,
          ('-' || ks.amount::text || ' (' || ks.jar || ')') AS amount,
          ks.emoji AS emoji,
          ks.created_at AS at
        FROM kids_spendings ks
        JOIN kids_accounts ka ON ka.id = ks.kid_id

        UNION ALL

        SELECT
          'checkin'::text AS kind,
          kc.id::int AS id,
          kc.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar AS kid_avatar,
          COALESCE(kc.note, '今日打卡') AS label,
          kc.mood::text AS amount,
          NULL::varchar AS emoji,
          kc.created_at AS at
        FROM kids_checkins kc
        JOIN kids_accounts ka ON ka.id = kc.kid_id

        UNION ALL

        SELECT
          'wish'::text AS kind,
          kw.id::int AS id,
          kw.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar AS kid_avatar,
          kw.title AS label,
          (COALESCE(kw.estimated_price::text, '?') || ' 元・' || kw.status::text) AS amount,
          kw.emoji AS emoji,
          kw.created_at AS at
        FROM kids_wishes kw
        JOIN kids_accounts ka ON ka.id = kw.kid_id
      ) u
      ORDER BY at DESC NULLS LAST
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          kind: string
          id: number
          kid_id: number
          kid_name: string
          kid_avatar: string
          label: string
          amount: string | null
          emoji: string | null
          at: Date | null
        }[]
      }
    ).rows
    res.json({
      activities: rows.map((r) => ({
        kind: r.kind,
        id: r.id,
        kidId: r.kid_id,
        kidName: r.kid_name,
        kidAvatar: r.kid_avatar,
        label: r.label,
        amount: r.amount,
        emoji: r.emoji,
        at: r.at,
      })),
    })
  })
)

/**
 * GET /api/family/kid-bests?kidId=
 * 小孩終生統計 + 個人最佳紀錄
 * 培養長期成就感（看見一路走來的軌跡）
 *
 * 回傳：
 *   lifetime: { totalTasks, totalSaved, totalSpent, totalGiven, totalDays }
 *   bests: { biggestReward, biggestSpend, biggestGive, longestStreak }
 *   firsts: { firstTaskDate, firstSpendDate, firstWishDate }
 */
router.get(
  "/api/family/kid-bests",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const lifetime = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM kids_tasks WHERE kid_id = ${kidIdQ} AND status = 'approved') AS total_tasks,
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM kids_spendings WHERE kid_id = ${kidIdQ} AND jar = 'save') AS total_save_spent,
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM kids_spendings WHERE kid_id = ${kidIdQ} AND jar = 'spend') AS total_spent,
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM kids_spendings WHERE kid_id = ${kidIdQ} AND jar = 'give') AS total_given,
        (SELECT COUNT(DISTINCT checkin_date)::int FROM kids_checkins WHERE kid_id = ${kidIdQ}) AS total_checkin_days,
        (SELECT save_balance::numeric FROM kids_jars WHERE kid_id = ${kidIdQ}) AS save_balance
    `)
    const lt = (
      lifetime as unknown as {
        rows: {
          total_tasks: number
          total_save_spent: string | number
          total_spent: string | number
          total_given: string | number
          total_checkin_days: number
          save_balance: string | number | null
        }[]
      }
    ).rows[0] ?? {
      total_tasks: 0,
      total_save_spent: 0,
      total_spent: 0,
      total_given: 0,
      total_checkin_days: 0,
      save_balance: 0,
    }

    const bests = await db.execute(sql`
      SELECT
        (SELECT COALESCE(MAX(reward_amount::numeric), 0)::numeric FROM kids_tasks WHERE kid_id = ${kidIdQ} AND status = 'approved') AS biggest_reward,
        (SELECT COALESCE(MAX(amount::numeric), 0)::numeric FROM kids_spendings WHERE kid_id = ${kidIdQ} AND jar = 'spend') AS biggest_spend,
        (SELECT COALESCE(MAX(amount::numeric), 0)::numeric FROM kids_spendings WHERE kid_id = ${kidIdQ} AND jar = 'give') AS biggest_give
    `)
    const bt = (
      bests as unknown as {
        rows: {
          biggest_reward: string | number
          biggest_spend: string | number
          biggest_give: string | number
        }[]
      }
    ).rows[0] ?? { biggest_reward: 0, biggest_spend: 0, biggest_give: 0 }

    const firsts = await db.execute(sql`
      SELECT
        (SELECT MIN(completed_at) FROM kids_tasks WHERE kid_id = ${kidIdQ} AND status = 'approved') AS first_task_at,
        (SELECT MIN(spend_date) FROM kids_spendings WHERE kid_id = ${kidIdQ}) AS first_spend_date,
        (SELECT MIN(created_at) FROM kids_wishes WHERE kid_id = ${kidIdQ}) AS first_wish_at
    `)
    const fr = (
      firsts as unknown as {
        rows: {
          first_task_at: Date | null
          first_spend_date: Date | null
          first_wish_at: Date | null
        }[]
      }
    ).rows[0] ?? { first_task_at: null, first_spend_date: null, first_wish_at: null }

    // 連續打卡（latest streak、不必歷史最長、用今日往回算）
    const streakRows = await db.execute(sql`
      SELECT DISTINCT checkin_date FROM kids_checkins
      WHERE kid_id = ${kidIdQ}
      ORDER BY checkin_date DESC
      LIMIT 365
    `)
    const dates = (streakRows as unknown as { rows: { checkin_date: Date }[] }).rows.map((r) =>
      new Date(r.checkin_date).toISOString().slice(0, 10)
    )
    let streak = 0
    if (dates.length > 0) {
      const today = localDateTPE()
      const yesterday = localDateTPE(-1)
      if (dates[0] === today || dates[0] === yesterday) {
        streak = 1
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i - 1])
          const cur = new Date(dates[i])
          const diff = Math.round((prev.getTime() - cur.getTime()) / 86_400_000)
          if (diff === 1) streak++
          else break
        }
      }
    }

    res.json({
      kidId: kidIdQ,
      lifetime: {
        totalTasks: lt.total_tasks ?? 0,
        totalSaved: Number(lt.save_balance ?? 0),
        totalSpent: Number(lt.total_spent ?? 0),
        totalGiven: Number(lt.total_given ?? 0),
        totalCheckinDays: lt.total_checkin_days ?? 0,
      },
      bests: {
        biggestReward: Number(bt.biggest_reward ?? 0),
        biggestSpend: Number(bt.biggest_spend ?? 0),
        biggestGive: Number(bt.biggest_give ?? 0),
        longestStreak: streak,
      },
      firsts: {
        firstTaskAt: fr.first_task_at,
        firstSpendDate: fr.first_spend_date,
        firstWishAt: fr.first_wish_at,
      },
    })
  })
)

/**
 * GET /api/family/kid-activity?kidId=&limit=20
 * 小孩個人活動時間軸：tasks（approved）/ spendings / checkins / wishes
 * 提升黏著度（看自己最近做了什麼）
 */
router.get(
  "/api/family/kid-activity",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const limit = Math.min(Number(req.query.limit) || 20, 50)

    const result = await db.execute(sql`
      SELECT * FROM (
        SELECT
          'task'::text AS kind,
          kt.id::int AS id,
          kt.title AS label,
          (kt.reward_amount::text || ' 元') AS amount,
          kt.emoji AS emoji,
          kt.completed_at AS at
        FROM kids_tasks kt
        WHERE kt.kid_id = ${kidIdQ} AND kt.status = 'approved' AND kt.completed_at IS NOT NULL

        UNION ALL

        SELECT
          'spending'::text AS kind,
          ks.id::int AS id,
          ks.description AS label,
          ('-' || ks.amount::text || ' (' || ks.jar || ')') AS amount,
          ks.emoji AS emoji,
          ks.created_at AS at
        FROM kids_spendings ks
        WHERE ks.kid_id = ${kidIdQ}

        UNION ALL

        SELECT
          'checkin'::text AS kind,
          kc.id::int AS id,
          COALESCE(kc.note, '今日打卡') AS label,
          kc.mood::text AS amount,
          NULL::varchar AS emoji,
          kc.created_at AS at
        FROM kids_checkins kc
        WHERE kc.kid_id = ${kidIdQ}

        UNION ALL

        SELECT
          'wish'::text AS kind,
          kw.id::int AS id,
          kw.title AS label,
          (COALESCE(kw.estimated_price::text, '?') || ' 元・' || kw.status::text) AS amount,
          kw.emoji AS emoji,
          kw.created_at AS at
        FROM kids_wishes kw
        WHERE kw.kid_id = ${kidIdQ}
      ) u
      ORDER BY at DESC NULLS LAST
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          kind: string
          id: number
          label: string
          amount: string | null
          emoji: string | null
          at: Date | null
        }[]
      }
    ).rows
    res.json({
      kidId: kidIdQ,
      activities: rows.map((r) => ({
        kind: r.kind,
        id: r.id,
        label: r.label,
        amount: r.amount,
        emoji: r.emoji,
        at: r.at,
      })),
    })
  })
)

/**
 * GET /api/family/search?q=&limit=20
 * 跨域搜尋：tasks（title）/ goals（title）/ comments（body）/ wishes（title）
 * 家長一次找全部、ILIKE 不分大小寫
 */
router.get(
  "/api/family/search",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim()
    if (!q) return res.json({ q: "", results: [] })
    if (q.length > 100) throw new AppError(400, "q 過長")
    const limit = Math.min(Number(req.query.limit) || 20, 50)
    const pattern = `%${q}%`

    const result = await db.execute(sql`
      SELECT * FROM (
        SELECT
          'task'::text AS kind,
          kt.id::int AS id,
          kt.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          kt.title AS label,
          kt.status::text AS sub,
          kt.created_at AS at
        FROM kids_tasks kt
        JOIN kids_accounts ka ON ka.id = kt.kid_id
        WHERE kt.title ILIKE ${pattern}

        UNION ALL

        SELECT
          'goal'::text AS kind,
          kg.id::int AS id,
          kg.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          kg.name AS label,
          (kg.current_amount::text || '/' || kg.target_amount::text) AS sub,
          kg.created_at AS at
        FROM kids_goals kg
        JOIN kids_accounts ka ON ka.id = kg.kid_id
        WHERE kg.name ILIKE ${pattern}

        UNION ALL

        SELECT
          'comment'::text AS kind,
          ktc.id::int AS id,
          kt.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          ktc.message AS label,
          ktc.author::text AS sub,
          ktc.created_at AS at
        FROM kids_task_comments ktc
        JOIN kids_tasks kt ON kt.id = ktc.task_id
        JOIN kids_accounts ka ON ka.id = kt.kid_id
        WHERE ktc.message ILIKE ${pattern}

        UNION ALL

        SELECT
          'wish'::text AS kind,
          kw.id::int AS id,
          kw.kid_id::int AS kid_id,
          ka.display_name AS kid_name,
          kw.title AS label,
          kw.status::text AS sub,
          kw.created_at AS at
        FROM kids_wishes kw
        JOIN kids_accounts ka ON ka.id = kw.kid_id
        WHERE kw.title ILIKE ${pattern}
      ) u
      ORDER BY at DESC NULLS LAST
      LIMIT ${limit}
    `)
    const rows = (
      result as unknown as {
        rows: {
          kind: string
          id: number
          kid_id: number
          kid_name: string
          label: string
          sub: string
          at: Date | null
        }[]
      }
    ).rows
    res.json({
      q,
      results: rows.map((r) => ({
        kind: r.kind,
        id: r.id,
        kidId: r.kid_id,
        kidName: r.kid_name,
        label: r.label,
        sub: r.sub,
        at: r.at,
      })),
    })
  })
)

export default router
