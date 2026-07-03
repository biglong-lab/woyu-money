/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 25，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"

const router = Router()

/**
 * GET /api/family/savings-retention
 * 每個 active 小孩存款留存率分析
 * 留存率 = (save_balance + give_balance) / total_received（spend 罐已花用）
 * level: super_saver(>=70%) / good_saver(>=50%) / spender(>=25%) / heavy_spender(<25%)
 */
router.get(
  "/api/family/savings-retention",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COALESCE(j.total_received::numeric, 0) AS lifetime_earned,
        COALESCE(j.save_balance::numeric, 0) AS save_balance,
        COALESCE(j.give_balance::numeric, 0) AS give_balance,
        COALESCE(j.spend_balance::numeric, 0) AS spend_balance
      FROM kids_accounts ka
      LEFT JOIN kids_jars j ON j.kid_id = ka.id
      WHERE ka.is_active = true
      ORDER BY ka.id ASC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          lifetime_earned: string | number
          save_balance: string | number
          give_balance: string | number
          spend_balance: string | number
        }>
      }
    ).rows.map((r) => {
      const earned = Number(r.lifetime_earned)
      const save = Number(r.save_balance)
      const give = Number(r.give_balance)
      const spend = Number(r.spend_balance)
      const retained = save + give
      const ratio = earned > 0 ? retained / earned : 0
      let level: "super_saver" | "good_saver" | "spender" | "heavy_spender" | "no_data"
      let levelLabel: string
      if (earned === 0) {
        level = "no_data"
        levelLabel = "尚無收入"
      } else if (ratio >= 0.7) {
        level = "super_saver"
        levelLabel = "🏆 超級存錢家"
      } else if (ratio >= 0.5) {
        level = "good_saver"
        levelLabel = "💎 會理財"
      } else if (ratio >= 0.25) {
        level = "spender"
        levelLabel = "💰 一般花用"
      } else {
        level = "heavy_spender"
        levelLabel = "🛒 偏向花用"
      }
      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        lifetimeEarned: earned,
        saveBalance: save,
        giveBalance: give,
        spendBalance: spend,
        retentionRatio: Math.round(ratio * 100),
        level,
        levelLabel,
      }
    })

    const sortedKids = [...kids].sort((a, b) => {
      if (a.lifetimeEarned === 0 && b.lifetimeEarned === 0) return 0
      if (a.lifetimeEarned === 0) return 1
      if (b.lifetimeEarned === 0) return -1
      return b.retentionRatio - a.retentionRatio
    })

    const withData = kids.filter((k) => k.lifetimeEarned > 0)
    const topSaver = withData.length > 0 ? sortedKids[0] : null
    const avgRetention =
      withData.length > 0
        ? Math.round(withData.reduce((s, k) => s + k.retentionRatio, 0) / withData.length)
        : 0

    let familyLevel: "super_saver" | "good_saver" | "spender" | "heavy_spender" | "no_data"
    let message: string
    if (withData.length === 0) {
      familyLevel = "no_data"
      message = "還沒有人開始賺零用金、加油！"
    } else if (avgRetention >= 70) {
      familyLevel = "super_saver"
      message = `🏆 全家平均留存 ${avgRetention}%、超會存的！`
    } else if (avgRetention >= 50) {
      familyLevel = "good_saver"
      message = `💎 全家平均留存 ${avgRetention}%、理財觀念不錯`
    } else if (avgRetention >= 25) {
      familyLevel = "spender"
      message = `💰 全家平均留存 ${avgRetention}%、可以更節制`
    } else {
      familyLevel = "heavy_spender"
      message = `🛒 全家平均留存 ${avgRetention}%、花太多了、試試 50/30/20 分配`
    }

    res.json({
      kids: sortedKids,
      summary: {
        totalKids: kids.length,
        kidsWithData: withData.length,
        avgRetention,
        topSaver: topSaver
          ? { kidName: topSaver.kidName, retentionRatio: topSaver.retentionRatio }
          : null,
      },
      familyLevel,
      message,
    })
  })
)

/**
 * GET /api/family/multi-month-trend?months=12
 * 過去 N 個月每月：任務數 / 入帳 / 花用 / 打卡天數
 * 用 generate_series 確保每月都有資料、從舊到新排序
 */
router.get(
  "/api/family/multi-month-trend",
  asyncHandler(async (req, res) => {
    const months = Math.min(Math.max(Number(req.query.months) || 12, 1), 24)

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
        (SELECT COUNT(*)::int FROM kids_tasks t
          WHERE t.status = 'approved'
            AND t.completed_at >= m.m_start
            AND t.completed_at < m.m_start + INTERVAL '1 month'
        ) AS tasks,
        (SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric FROM kids_tasks t
          WHERE t.status = 'approved'
            AND t.completed_at >= m.m_start
            AND t.completed_at < m.m_start + INTERVAL '1 month'
        ) AS reward,
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM kids_spendings s
          WHERE s.jar = 'spend'
            AND s.spend_date >= m.m_start::date
            AND s.spend_date < (m.m_start + INTERVAL '1 month')::date
        ) AS spent,
        (SELECT COUNT(DISTINCT checkin_date)::int FROM kids_checkins c
          WHERE c.checkin_date >= m.m_start::date
            AND c.checkin_date < (m.m_start + INTERVAL '1 month')::date
        ) AS checkin_days
      FROM months m
      ORDER BY m.m_start ASC
    `)

    const monthsArr = (
      rows as unknown as {
        rows: Array<{
          month: string
          tasks: number
          reward: string | number
          spent: string | number
          checkin_days: number
        }>
      }
    ).rows.map((r) => ({
      month: r.month,
      tasks: r.tasks,
      reward: Number(r.reward),
      spent: Number(r.spent),
      checkinDays: r.checkin_days,
    }))

    const totalTasks = monthsArr.reduce((s, m) => s + m.tasks, 0)
    const totalReward = monthsArr.reduce((s, m) => s + m.reward, 0)
    const peakMonth = monthsArr.reduce((best, m) => (m.tasks > best.tasks ? m : best), monthsArr[0])

    // 比較最近 3 個月 vs 之前的平均、判斷整體趨勢
    let trend: "growing" | "declining" | "steady" | "no_data"
    let message: string
    if (totalTasks === 0) {
      trend = "no_data"
      message = "過去都沒任務、開始第一個吧 🌱"
    } else if (monthsArr.length >= 4) {
      const recent = monthsArr.slice(-3)
      const earlier = monthsArr.slice(0, -3)
      const recentAvg = recent.reduce((s, m) => s + m.tasks, 0) / recent.length
      const earlierAvg =
        earlier.length > 0 ? earlier.reduce((s, m) => s + m.tasks, 0) / earlier.length : 0
      if (earlierAvg === 0 && recentAvg > 0) {
        trend = "growing"
        message = `🚀 最近 3 個月開始活躍（平均 ${Math.round(recentAvg)} 個任務）`
      } else if (recentAvg > earlierAvg * 1.2) {
        trend = "growing"
        message = `📈 越來越活躍（最近 3 月平均 ${Math.round(recentAvg)} vs 過去 ${Math.round(earlierAvg)}）`
      } else if (recentAvg < earlierAvg * 0.8) {
        trend = "declining"
        message = `📉 最近活動變少（最近 3 月 ${Math.round(recentAvg)} vs 過去 ${Math.round(earlierAvg)}），加把勁！`
      } else {
        trend = "steady"
        message = "穩定發揮 👍"
      }
    } else {
      trend = "steady"
      message = "剛起步階段、繼續累積 🌱"
    }

    res.json({
      months: monthsArr,
      summary: {
        totalTasks,
        totalReward,
        peakMonth: peakMonth?.month ?? null,
        peakTasks: peakMonth?.tasks ?? 0,
      },
      trend,
      message,
    })
  })
)

/**
 * GET /api/family/daily-recap?days=7
 * 過去 N 天每日活動概覽（任務 / 打卡 / 花用 / 捐贈）
 * 用 generate_series 確保每天都有資料（即使 0）、從舊到新
 */
router.get(
  "/api/family/daily-recap",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 60)

    const rows = await db.execute(sql`
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
        (SELECT COUNT(*)::int FROM kids_tasks
          WHERE status = 'approved' AND DATE(completed_at) = d.d) AS tasks,
        (SELECT COUNT(DISTINCT kid_id)::int FROM kids_checkins
          WHERE checkin_date = d.d) AS checkins,
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM kids_spendings
          WHERE jar = 'spend' AND spend_date = d.d) AS spent,
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM kids_spendings
          WHERE jar = 'give' AND spend_date = d.d) AS given,
        (SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric FROM kids_tasks
          WHERE status = 'approved' AND DATE(completed_at) = d.d) AS reward
      FROM days d
      ORDER BY d.d ASC
    `)

    const daysArr = (
      rows as unknown as {
        rows: Array<{
          date: string
          weekday: string
          tasks: number
          checkins: number
          spent: string | number
          given: string | number
          reward: string | number
        }>
      }
    ).rows.map((r) => {
      const tasks = r.tasks
      const checkins = r.checkins
      const spent = Number(r.spent)
      const given = Number(r.given)
      const reward = Number(r.reward)
      const hasActivity = tasks > 0 || checkins > 0 || spent > 0 || given > 0
      return {
        date: r.date,
        weekday: r.weekday,
        tasks,
        checkins,
        spent,
        given,
        reward,
        hasActivity,
      }
    })

    const activeDays = daysArr.filter((d) => d.hasActivity).length
    const totalTasks = daysArr.reduce((s, d) => s + d.tasks, 0)
    const totalReward = daysArr.reduce((s, d) => s + d.reward, 0)

    const ratio = activeDays / days
    let message: string
    if (ratio >= 0.8) {
      message = `🔥 過去 ${days} 天有 ${activeDays} 天活躍、保持得超好！`
    } else if (ratio >= 0.5) {
      message = `💪 過去 ${days} 天 ${activeDays} 天活躍、再加把勁`
    } else if (ratio > 0) {
      message = `🌱 過去 ${days} 天 ${activeDays} 天活躍、可以更積極`
    } else {
      message = `🛌 過去 ${days} 天完全沒活動、該動起來了！`
    }

    res.json({
      days: daysArr,
      summary: {
        totalDays: days,
        activeDays,
        activeRatio: Math.round(ratio * 100),
        totalTasks,
        totalReward,
      },
      message,
    })
  })
)

/**
 * GET /api/family/family-story?month=YYYY-MM
 * 月度家庭故事：敘事化呈現本月家庭數據（多段中文文字、好分享）
 * 自動從 kids_tasks / kids_spendings / kids_checkins / kids_goals 彙整
 */
router.get(
  "/api/family/family-story",
  asyncHandler(async (req, res) => {
    const monthStr = (req.query.month as string | undefined) ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(monthStr)) throw new AppError(400, "month 格式 YYYY-MM")
    const [year, month] = monthStr.split("-").map(Number)
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
    const endY = month === 12 ? year + 1 : year
    const endM = month === 12 ? 1 : month + 1
    const nextMonth = `${endY}-${String(endM).padStart(2, "0")}-01`

    const stats = await db.execute(sql`
      WITH month_tasks AS (
        SELECT t.*, ka.display_name AS kid_name, ka.avatar AS kid_avatar
        FROM kids_tasks t
        JOIN kids_accounts ka ON ka.id = t.kid_id
        WHERE t.status = 'approved'
          AND t.completed_at >= ${monthStart}::date
          AND t.completed_at < ${nextMonth}::date
      ),
      month_spendings AS (
        SELECT s.*, ka.display_name AS kid_name
        FROM kids_spendings s
        JOIN kids_accounts ka ON ka.id = s.kid_id
        WHERE s.spend_date >= ${monthStart}::date AND s.spend_date < ${nextMonth}::date
      )
      SELECT
        (SELECT COUNT(*)::int FROM month_tasks) AS total_tasks,
        (SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric FROM month_tasks) AS total_reward,
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM month_spendings WHERE jar = 'spend') AS total_spent,
        (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM month_spendings WHERE jar = 'give') AS total_given,
        (SELECT COUNT(DISTINCT checkin_date)::int FROM kids_checkins
          WHERE checkin_date >= ${monthStart}::date AND checkin_date < ${nextMonth}::date) AS checkin_days,
        (SELECT COUNT(*)::int FROM kids_goals
          WHERE completed_at >= ${monthStart}::timestamp AND completed_at < ${nextMonth}::timestamp) AS goals_completed,
        (SELECT kid_name FROM month_tasks GROUP BY kid_name
          ORDER BY COUNT(*) DESC NULLS LAST LIMIT 1) AS top_performer,
        (SELECT COUNT(*)::int FROM month_tasks
          WHERE kid_name = (SELECT kid_name FROM month_tasks GROUP BY kid_name ORDER BY COUNT(*) DESC NULLS LAST LIMIT 1)
        ) AS top_performer_tasks,
        (SELECT title FROM month_tasks GROUP BY title
          ORDER BY COUNT(*) DESC NULLS LAST LIMIT 1) AS most_done_task
    `)

    const row = (
      stats as unknown as {
        rows: Array<{
          total_tasks: number
          total_reward: string | number
          total_spent: string | number
          total_given: string | number
          checkin_days: number
          goals_completed: number
          top_performer: string | null
          top_performer_tasks: number | null
          most_done_task: string | null
        }>
      }
    ).rows[0]

    const toNum = (v: string | number | null): number => (v === null ? 0 : Number(v))
    const totalTasks = row?.total_tasks ?? 0
    const totalReward = toNum(row?.total_reward ?? 0)
    const totalSpent = toNum(row?.total_spent ?? 0)
    const totalGiven = toNum(row?.total_given ?? 0)
    const checkinDays = row?.checkin_days ?? 0
    const goalsCompleted = row?.goals_completed ?? 0
    const topPerformer = row?.top_performer ?? null
    const topPerformerTasks = row?.top_performer_tasks ?? 0
    const mostDoneTask = row?.most_done_task ?? null

    const paragraphs: string[] = []

    // 開場
    paragraphs.push(
      `📖 ${year} 年 ${month} 月，我們家走過了 ${totalTasks > 0 ? "充實" : "平靜"}的一個月。`
    )

    // 任務段
    if (totalTasks > 0) {
      paragraphs.push(
        `這個月全家完成了 ${totalTasks} 個任務，總共入帳 $${totalReward}。${topPerformer ? `其中 ${topPerformer} 表現最亮眼，獨自完成了 ${topPerformerTasks} 個任務。` : ""}${mostDoneTask ? `「${mostDoneTask}」是本月最常出現的任務。` : ""}`
      )
    } else {
      paragraphs.push("這個月沒有完成任何任務、可能在準備下一波計畫。")
    }

    // 花用段
    if (totalSpent > 0 || totalGiven > 0) {
      const parts: string[] = []
      if (totalSpent > 0) parts.push(`花用罐用了 $${totalSpent}`)
      if (totalGiven > 0) parts.push(`捐贈罐送出 $${totalGiven}（很有愛心！）`)
      paragraphs.push(`理財方面，${parts.join("、")}。`)
    }

    // 打卡 / 目標段
    if (checkinDays > 0 || goalsCompleted > 0) {
      const parts: string[] = []
      if (checkinDays > 0) parts.push(`累積打卡 ${checkinDays} 天`)
      if (goalsCompleted > 0) parts.push(`達成 ${goalsCompleted} 個目標 🎯`)
      paragraphs.push(`持續累積：${parts.join("，")}。`)
    }

    // 結語
    if (totalTasks >= 20) {
      paragraphs.push("這是個豐收的月份、繼續保持節奏 💪")
    } else if (totalTasks >= 5) {
      paragraphs.push("穩定的一個月、下個月加油！")
    } else if (totalTasks > 0) {
      paragraphs.push("起步階段、慢慢來會更好 🌱")
    } else {
      paragraphs.push("休息也是節奏的一部分、新的月份再衝刺！")
    }

    res.json({
      month: monthStr,
      paragraphs,
      stats: {
        totalTasks,
        totalReward,
        totalSpent,
        totalGiven,
        checkinDays,
        goalsCompleted,
      },
      characters: {
        topPerformer,
        topPerformerTasks,
        mostDoneTask,
      },
    })
  })
)

/**
 * GET /api/family/difficulty-evolution?kidId=&months=6
 * 個別小孩過去 N 個月每月 easy / medium / hard 完成數變化趨勢
 * 用 generate_series 確保每月都有資料（即使 0）、從舊到新排序
 * trend：rising_challenge / easing / steady / no_data
 */
router.get(
  "/api/family/difficulty-evolution",
  asyncHandler(async (req, res) => {
    const kidId = Number(req.query.kidId)
    if (!Number.isInteger(kidId) || kidId < 1) throw new AppError(400, "需傳 kidId")
    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24)

    const rows = await db.execute(sql`
      WITH months AS (
        SELECT generate_series(
          DATE_TRUNC('month', CURRENT_DATE) - ((${months}::int - 1) * INTERVAL '1 month'),
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        )::date AS month_start
      )
      SELECT
        TO_CHAR(m.month_start, 'YYYY-MM') AS month,
        COALESCE(SUM(CASE WHEN t.difficulty = 'easy' THEN 1 ELSE 0 END), 0)::int AS easy,
        COALESCE(SUM(CASE WHEN t.difficulty = 'medium' THEN 1 ELSE 0 END), 0)::int AS medium,
        COALESCE(SUM(CASE WHEN t.difficulty = 'hard' THEN 1 ELSE 0 END), 0)::int AS hard
      FROM months m
      LEFT JOIN kids_tasks t ON
        t.kid_id = ${kidId}
        AND t.status = 'approved'
        AND t.completed_at >= m.month_start
        AND t.completed_at < m.month_start + INTERVAL '1 month'
      GROUP BY m.month_start
      ORDER BY m.month_start ASC
    `)

    const monthsArr = (
      rows as unknown as {
        rows: Array<{ month: string; easy: number; medium: number; hard: number }>
      }
    ).rows

    let trend: "rising_challenge" | "easing" | "steady" | "no_data"
    let message: string

    const totalsAll = monthsArr.reduce(
      (acc, m) => {
        acc.easy += m.easy
        acc.medium += m.medium
        acc.hard += m.hard
        return acc
      },
      { easy: 0, medium: 0, hard: 0 }
    )
    const totalCount = totalsAll.easy + totalsAll.medium + totalsAll.hard
    if (totalCount === 0) {
      trend = "no_data"
      message = "還沒有完成的任務、開始第一個吧！"
    } else {
      const half = Math.floor(monthsArr.length / 2)
      const firstHalf = monthsArr.slice(0, half)
      const secondHalf = monthsArr.slice(half)
      const ratio = (arr: typeof monthsArr) => {
        const s = arr.reduce(
          (acc, m) => {
            acc.hard += m.hard
            acc.total += m.easy + m.medium + m.hard
            return acc
          },
          { hard: 0, total: 0 }
        )
        return s.total > 0 ? s.hard / s.total : 0
      }
      const r1 = ratio(firstHalf)
      const r2 = ratio(secondHalf)
      const diff = r2 - r1
      if (diff > 0.1) {
        trend = "rising_challenge"
        message = `🚀 越來越勇敢挑戰困難任務（hard 比例 +${Math.round(diff * 100)}%）`
      } else if (diff < -0.1) {
        trend = "easing"
        message = `🌱 困難任務變少了、可以再挑戰看看（hard 比例 ${Math.round(diff * 100)}%）`
      } else {
        trend = "steady"
        message = "穩定發揮、繼續保持節奏 👍"
      }
    }

    res.json({
      kidId,
      months: monthsArr,
      totals: totalsAll,
      trend,
      message,
    })
  })
)

/**
 * GET /api/family/weekly-summary
 * 全家本週 vs 上週 metrics 對比 + highlights
 * 起：本週一 00:00（PostgreSQL DATE_TRUNC('week', ...) 對應 ISO 週、週一為起）
 * 對比指標：tasks_approved / total_reward / total_spent / checkins / new_wishes
 */
router.get(
  "/api/family/weekly-summary",
  asyncHandler(async (_req, res) => {
    const stats = await db.execute(sql`
      WITH this_week AS (
        SELECT
          COALESCE((
            SELECT COUNT(*)::int FROM kids_tasks
            WHERE status = 'approved'
              AND completed_at >= DATE_TRUNC('week', CURRENT_DATE)
              AND completed_at < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
          ), 0) AS tasks_approved,
          COALESCE((
            SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
            WHERE status = 'approved'
              AND completed_at >= DATE_TRUNC('week', CURRENT_DATE)
              AND completed_at < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
          ), 0) AS total_reward,
          COALESCE((
            SELECT SUM(amount::numeric)::numeric FROM kids_spendings
            WHERE spend_date >= DATE_TRUNC('week', CURRENT_DATE)::date
              AND spend_date < (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days')::date
          ), 0) AS total_spent,
          COALESCE((
            SELECT COUNT(*)::int FROM kids_checkins
            WHERE checkin_date >= DATE_TRUNC('week', CURRENT_DATE)::date
              AND checkin_date < (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days')::date
          ), 0) AS checkins,
          COALESCE((
            SELECT COUNT(*)::int FROM kids_wishes
            WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)
              AND created_at < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
          ), 0) AS new_wishes
      ),
      last_week AS (
        SELECT
          COALESCE((
            SELECT COUNT(*)::int FROM kids_tasks
            WHERE status = 'approved'
              AND completed_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'
              AND completed_at < DATE_TRUNC('week', CURRENT_DATE)
          ), 0) AS tasks_approved,
          COALESCE((
            SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
            WHERE status = 'approved'
              AND completed_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'
              AND completed_at < DATE_TRUNC('week', CURRENT_DATE)
          ), 0) AS total_reward,
          COALESCE((
            SELECT SUM(amount::numeric)::numeric FROM kids_spendings
            WHERE spend_date >= (DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days')::date
              AND spend_date < DATE_TRUNC('week', CURRENT_DATE)::date
          ), 0) AS total_spent,
          COALESCE((
            SELECT COUNT(*)::int FROM kids_checkins
            WHERE checkin_date >= (DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days')::date
              AND checkin_date < DATE_TRUNC('week', CURRENT_DATE)::date
          ), 0) AS checkins,
          COALESCE((
            SELECT COUNT(*)::int FROM kids_wishes
            WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'
              AND created_at < DATE_TRUNC('week', CURRENT_DATE)
          ), 0) AS new_wishes
      )
      SELECT
        (SELECT row_to_json(this_week.*) FROM this_week) AS this_week_json,
        (SELECT row_to_json(last_week.*) FROM last_week) AS last_week_json
    `)
    const row = (
      stats as unknown as {
        rows: Array<{
          this_week_json: Record<string, number | string>
          last_week_json: Record<string, number | string>
        }>
      }
    ).rows[0]

    const toNum = (v: string | number | undefined): number =>
      v === undefined || v === null ? 0 : Number(v)

    const thisWeek = {
      tasksApproved: toNum(row?.this_week_json?.tasks_approved),
      totalReward: toNum(row?.this_week_json?.total_reward),
      totalSpent: toNum(row?.this_week_json?.total_spent),
      checkins: toNum(row?.this_week_json?.checkins),
      newWishes: toNum(row?.this_week_json?.new_wishes),
    }
    const lastWeek = {
      tasksApproved: toNum(row?.last_week_json?.tasks_approved),
      totalReward: toNum(row?.last_week_json?.total_reward),
      totalSpent: toNum(row?.last_week_json?.total_spent),
      checkins: toNum(row?.last_week_json?.checkins),
      newWishes: toNum(row?.last_week_json?.new_wishes),
    }

    const deltas: Record<string, { abs: number; pct: number | null; arrow: "↑" | "↓" | "→" }> = {}
    for (const key of Object.keys(thisWeek) as Array<keyof typeof thisWeek>) {
      const t = thisWeek[key]
      const l = lastWeek[key]
      const abs = t - l
      const pct = l > 0 ? Math.round((abs / l) * 100) : null
      deltas[key as string] = {
        abs,
        pct,
        arrow: abs > 0 ? "↑" : abs < 0 ? "↓" : "→",
      }
    }

    const highlights: string[] = []
    if (thisWeek.tasksApproved > lastWeek.tasksApproved) {
      highlights.push(`🚀 任務完成數比上週多 ${thisWeek.tasksApproved - lastWeek.tasksApproved} 個`)
    }
    if (thisWeek.totalReward > lastWeek.totalReward) {
      highlights.push(
        `💰 本週入帳 $${thisWeek.totalReward}（多 $${thisWeek.totalReward - lastWeek.totalReward}）`
      )
    }
    if (thisWeek.checkins > lastWeek.checkins && thisWeek.checkins > 0) {
      highlights.push(`📅 本週打卡 ${thisWeek.checkins} 次（成長中）`)
    }
    if (thisWeek.totalSpent > 0 && thisWeek.totalSpent < lastWeek.totalSpent) {
      highlights.push(`💡 花用比上週少 $${lastWeek.totalSpent - thisWeek.totalSpent}（更節制了）`)
    }
    if (highlights.length === 0) {
      if (thisWeek.tasksApproved === 0) {
        highlights.push("📝 本週還沒任務通過、加油！")
      } else {
        highlights.push("💪 本週持續努力中、繼續保持！")
      }
    }

    res.json({
      thisWeek,
      lastWeek,
      deltas,
      highlights,
      generatedAt: new Date().toISOString(),
    })
  })
)

export default router
