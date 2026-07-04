/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 08，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"
import { localDateTPE } from "@shared/date-utils"

const router = Router()

/**
 * GET /api/family/kid-goals-deadlines?kidId=
 * 小孩端：有 deadline 的 active goals 倒數 + 緊迫度
 */
router.get(
  "/api/family/kid-goals-deadlines",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT
        id::int AS id,
        name,
        emoji,
        current_amount::numeric AS current,
        target_amount::numeric AS target,
        deadline,
        (deadline - CURRENT_DATE)::int AS days_left
      FROM kids_goals
      WHERE kid_id = ${kidIdQ}
        AND status = 'active'
        AND deadline IS NOT NULL
      ORDER BY deadline ASC
    `)
    const rows = (
      result as unknown as {
        rows: {
          id: number
          name: string
          emoji: string | null
          current: string | number
          target: string | number
          deadline: Date
          days_left: number
        }[]
      }
    ).rows

    const goals = rows.map((r) => {
      const current = Number(r.current ?? 0)
      const target = Number(r.target ?? 0)
      const remaining = Math.max(0, target - current)
      const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
      const days = r.days_left

      let urgency: "passed" | "urgent" | "soon" | "ok"
      let message: string
      if (days < 0) {
        urgency = "passed"
        message = `⏰ 已過期 ${Math.abs(days)} 天、調整目標或日期`
      } else if (days <= 7) {
        urgency = "urgent"
        if (remaining === 0) message = `🎉 達標！可以買了！還 ${days} 天到期`
        else message = `🔥 還剩 ${days} 天、需要再存 $${remaining}`
      } else if (days <= 30) {
        urgency = "soon"
        message = `💪 ${days} 天到期、平均每天存 $${Math.ceil(remaining / days)}`
      } else {
        urgency = "ok"
        message = `🌱 ${days} 天到期、放心慢慢存`
      }

      return {
        id: r.id,
        name: r.name,
        emoji: r.emoji ?? "🎯",
        current,
        target,
        remaining,
        progress,
        deadline: r.deadline,
        daysLeft: days,
        urgency,
        message,
      }
    })

    const passedCount = goals.filter((g) => g.urgency === "passed").length
    const urgentCount = goals.filter((g) => g.urgency === "urgent").length

    res.json({
      kidId: kidIdQ,
      total: goals.length,
      passedCount,
      urgentCount,
      goals,
    })
  })
)

/**
 * GET /api/family/parent-todo
 * 家長端待辦清單：今日該做什麼 actionable items
 *
 * 4 種項目：
 *   - approve_task: 待審核任務（status='submitted'）
 *   - kid_no_checkin: 今日缺打卡的小孩
 *   - goal_deadline_soon: 7 天內到期目標
 *   - stale_wish: > 14 天未升級的願望
 *
 * 每項有 priority（urgent / high / medium / low）+ action 描述
 */
router.get(
  "/api/family/parent-todo",
  asyncHandler(async (_req, res) => {
    const [pendingTasks, kidsNoCheckin, goalsSoon, staleWishes] = await Promise.all([
      db.execute(sql`
        SELECT kt.id::int AS id, kt.title, ka.display_name AS kid_name, ka.avatar
        FROM kids_tasks kt
        JOIN kids_accounts ka ON ka.id = kt.kid_id
        WHERE kt.status = 'submitted'
        ORDER BY kt.updated_at DESC
        LIMIT 20
      `),
      db.execute(sql`
        SELECT ka.id::int AS kid_id, ka.display_name AS kid_name, ka.avatar
        FROM kids_accounts ka
        WHERE ka.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM kids_checkins
            WHERE kid_id = ka.id AND checkin_date = CURRENT_DATE
          )
      `),
      db.execute(sql`
        SELECT
          kg.id::int AS id,
          kg.name AS name,
          ka.display_name AS kid_name,
          ka.avatar,
          kg.deadline,
          (kg.deadline - CURRENT_DATE)::int AS days_left,
          kg.current_amount::numeric AS current,
          kg.target_amount::numeric AS target
        FROM kids_goals kg
        JOIN kids_accounts ka ON ka.id = kg.kid_id
        WHERE kg.status = 'active'
          AND kg.deadline IS NOT NULL
          AND kg.deadline <= CURRENT_DATE + INTERVAL '7 days'
          AND kg.deadline >= CURRENT_DATE
        ORDER BY kg.deadline ASC
      `),
      db.execute(sql`
        SELECT
          kw.id::int AS id,
          kw.title,
          ka.display_name AS kid_name,
          ka.avatar,
          (CURRENT_DATE - DATE(kw.created_at))::int AS days_old
        FROM kids_wishes kw
        JOIN kids_accounts ka ON ka.id = kw.kid_id
        WHERE kw.status = 'wished'
          AND kw.created_at < NOW() - INTERVAL '14 days'
        ORDER BY kw.created_at ASC
        LIMIT 10
      `),
    ])

    const todos: Array<{
      type: string
      priority: "urgent" | "high" | "medium" | "low"
      icon: string
      action: string
      detail?: string
      relatedId?: number
      kidName?: string
      avatar?: string
    }> = []

    for (const r of (
      pendingTasks as unknown as {
        rows: { id: number; title: string; kid_name: string; avatar: string }[]
      }
    ).rows) {
      todos.push({
        type: "approve_task",
        priority: "urgent",
        icon: "⏳",
        action: `審核「${r.title}」`,
        detail: `${r.kid_name} 已完成、等家長確認`,
        relatedId: r.id,
        kidName: r.kid_name,
        avatar: r.avatar,
      })
    }

    for (const r of (
      kidsNoCheckin as unknown as {
        rows: { kid_id: number; kid_name: string; avatar: string }[]
      }
    ).rows) {
      todos.push({
        type: "kid_no_checkin",
        priority: "low",
        icon: "📅",
        action: `提醒 ${r.kid_name} 打卡`,
        detail: "今天還沒寫心情",
        relatedId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
      })
    }

    for (const r of (
      goalsSoon as unknown as {
        rows: {
          id: number
          name: string
          kid_name: string
          avatar: string
          deadline: Date
          days_left: number
          current: string | number
          target: string | number
        }[]
      }
    ).rows) {
      const cur = Number(r.current)
      const tgt = Number(r.target)
      const remaining = tgt - cur
      todos.push({
        type: "goal_deadline_soon",
        priority: r.days_left <= 3 ? "urgent" : "high",
        icon: "🎯",
        action: `關注「${r.name}」目標`,
        detail: `${r.kid_name}、還差 $${remaining} / ${r.days_left} 天到期`,
        relatedId: r.id,
        kidName: r.kid_name,
        avatar: r.avatar,
      })
    }

    for (const r of (
      staleWishes as unknown as {
        rows: {
          id: number
          title: string
          kid_name: string
          avatar: string
          days_old: number
        }[]
      }
    ).rows) {
      todos.push({
        type: "stale_wish",
        priority: "medium",
        icon: "✨",
        action: `跟 ${r.kid_name} 聊「${r.title}」`,
        detail: `願望放著 ${r.days_old} 天了、值得升級成目標？`,
        relatedId: r.id,
        kidName: r.kid_name,
        avatar: r.avatar,
      })
    }

    // 按 priority 排序
    const order = { urgent: 0, high: 1, medium: 2, low: 3 }
    todos.sort((a, b) => order[a.priority] - order[b.priority])

    res.json({
      total: todos.length,
      urgentCount: todos.filter((t) => t.priority === "urgent").length,
      todos,
    })
  })
)

/**
 * GET /api/family/kid-weekly-report?kidId=
 * 小孩本週成績單：本週 vs 上週、4 維度 + 趨勢
 */
router.get(
  "/api/family/kid-weekly-report",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
            AND completed_at >= NOW() - INTERVAL '7 days'
        ), 0) AS this_tasks,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
            AND completed_at >= NOW() - INTERVAL '7 days'
        ), 0) AS this_earned,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ${kidIdQ} AND jar = 'spend'
            AND spend_date >= CURRENT_DATE - INTERVAL '7 days'
        ), 0) AS this_spent,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_checkins
          WHERE kid_id = ${kidIdQ}
            AND checkin_date >= CURRENT_DATE - INTERVAL '7 days'
        ), 0) AS this_checkins,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
            AND completed_at >= NOW() - INTERVAL '14 days'
            AND completed_at < NOW() - INTERVAL '7 days'
        ), 0) AS prev_tasks,
        COALESCE((
          SELECT SUM(reward_amount::numeric)::numeric FROM kids_tasks
          WHERE kid_id = ${kidIdQ} AND status = 'approved'
            AND completed_at >= NOW() - INTERVAL '14 days'
            AND completed_at < NOW() - INTERVAL '7 days'
        ), 0) AS prev_earned,
        COALESCE((
          SELECT SUM(amount::numeric)::numeric FROM kids_spendings
          WHERE kid_id = ${kidIdQ} AND jar = 'spend'
            AND spend_date >= CURRENT_DATE - INTERVAL '14 days'
            AND spend_date < CURRENT_DATE - INTERVAL '7 days'
        ), 0) AS prev_spent,
        COALESCE((
          SELECT COUNT(*)::int FROM kids_checkins
          WHERE kid_id = ${kidIdQ}
            AND checkin_date >= CURRENT_DATE - INTERVAL '14 days'
            AND checkin_date < CURRENT_DATE - INTERVAL '7 days'
        ), 0) AS prev_checkins
    `)
    const row = (
      result as unknown as {
        rows: {
          this_tasks: number
          this_earned: string | number
          this_spent: string | number
          this_checkins: number
          prev_tasks: number
          prev_earned: string | number
          prev_spent: string | number
          prev_checkins: number
        }[]
      }
    ).rows[0]!

    const thisWeek = {
      tasks: row.this_tasks,
      earned: Number(row.this_earned ?? 0),
      spent: Number(row.this_spent ?? 0),
      checkins: row.this_checkins,
    }
    const prevWeek = {
      tasks: row.prev_tasks,
      earned: Number(row.prev_earned ?? 0),
      spent: Number(row.prev_spent ?? 0),
      checkins: row.prev_checkins,
    }

    type Metric = {
      key: string
      name: string
      this: number
      prev: number
      trend: "up" | "down" | "flat"
      trendEmoji: string
      delta: number
    }
    function buildMetric(key: string, name: string, thisV: number, prevV: number): Metric {
      const delta = thisV - prevV
      let trend: "up" | "down" | "flat" = "flat"
      let trendEmoji = "➡️"
      if (delta > 0) {
        trend = "up"
        trendEmoji = "📈"
      } else if (delta < 0) {
        trend = "down"
        trendEmoji = "📉"
      }
      return { key, name, this: thisV, prev: prevV, trend, trendEmoji, delta }
    }
    const metrics = [
      buildMetric("tasks", "完成任務", thisWeek.tasks, prevWeek.tasks),
      buildMetric("earned", "賺到的錢", thisWeek.earned, prevWeek.earned),
      buildMetric("spent", "花掉的錢", thisWeek.spent, prevWeek.spent),
      buildMetric("checkins", "打卡天數", thisWeek.checkins, prevWeek.checkins),
    ]

    const positiveCount = [
      metrics[0].delta > 0,
      metrics[1].delta > 0,
      metrics[2].delta < 0, // 花得少是好事
      metrics[3].delta > 0,
    ].filter(Boolean).length

    let overall: string
    if (thisWeek.tasks === 0 && prevWeek.tasks === 0) {
      overall = "🌱 還沒開始這週的任務、加油！"
    } else if (positiveCount >= 3) {
      overall = "🌟 本週超棒！持續進步中"
    } else if (positiveCount >= 2) {
      overall = "👍 本週有進步、繼續加油"
    } else if (thisWeek.tasks > 0) {
      overall = "💪 本週有完成任務、不錯哦"
    } else {
      overall = "🔄 本週稍慢、下週可以做更多"
    }

    res.json({
      kidId: kidIdQ,
      thisWeek,
      prevWeek,
      metrics,
      overall,
    })
  })
)

/**
 * GET /api/family/today-summary
 * 家庭今日重點（家長端、一頁看今日全家動態）
 * 今日全家：完成任務數 / 收入 / 花費 / 待審核 / 打卡數 / 各小孩活動
 */
router.get(
  "/api/family/today-summary",
  asyncHandler(async (_req, res) => {
    const [
      approvedToday,
      rewardToday,
      spentToday,
      givenToday,
      pendingTasks,
      checkinsToday,
      newWishes,
      perKid,
    ] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*)::int AS n FROM kids_tasks
        WHERE status = 'approved' AND DATE(completed_at) = CURRENT_DATE
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(reward_amount::numeric), 0)::numeric AS s
        FROM kids_tasks
        WHERE status = 'approved' AND DATE(completed_at) = CURRENT_DATE
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s
        FROM kids_spendings WHERE jar = 'spend' AND spend_date = CURRENT_DATE
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s
        FROM kids_spendings WHERE jar = 'give' AND spend_date = CURRENT_DATE
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS n FROM kids_tasks WHERE status = 'submitted'
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT kid_id)::int AS n FROM kids_checkins
        WHERE checkin_date = CURRENT_DATE
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS n FROM kids_wishes
        WHERE DATE(created_at) = CURRENT_DATE
      `),
      db.execute(sql`
        SELECT
          ka.id::int AS kid_id,
          ka.display_name AS kid_name,
          ka.avatar,
          COALESCE((
            SELECT COUNT(*)::int FROM kids_tasks
            WHERE kid_id = ka.id AND status = 'approved'
              AND DATE(completed_at) = CURRENT_DATE
          ), 0) AS tasks,
          COALESCE((
            SELECT SUM(amount::numeric)::numeric FROM kids_spendings
            WHERE kid_id = ka.id AND spend_date = CURRENT_DATE
          ), 0) AS spent,
          CASE WHEN EXISTS (
            SELECT 1 FROM kids_checkins
            WHERE kid_id = ka.id AND checkin_date = CURRENT_DATE
          ) THEN true ELSE false END AS checked_in
        FROM kids_accounts ka
        WHERE ka.is_active = true
        ORDER BY tasks DESC, ka.id ASC
      `),
    ])

    const stats = {
      approvedToday: (approvedToday as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
      rewardToday: Number(
        String((rewardToday as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
      ),
      spentToday: Number(
        String((spentToday as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
      ),
      givenToday: Number(
        String((givenToday as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? 0)
      ),
      pendingTasks: (pendingTasks as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
      checkinsToday: (checkinsToday as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
      newWishes: (newWishes as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
    }

    const kids = (
      perKid as unknown as {
        rows: {
          kid_id: number
          kid_name: string
          avatar: string
          tasks: number
          spent: string | number
          checked_in: boolean
        }[]
      }
    ).rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      tasks: r.tasks ?? 0,
      spent: Number(r.spent ?? 0),
      checkedIn: r.checked_in ?? false,
    }))

    // 「今日亮點」自動偵測（給家長 quick scan）
    const highlights: string[] = []
    if (stats.pendingTasks > 0) highlights.push(`⏳ 有 ${stats.pendingTasks} 個任務待您審核`)
    if (stats.approvedToday >= 5)
      highlights.push(`🌟 今天家裡好忙！${stats.approvedToday} 個任務完成`)
    if (stats.givenToday > 0) highlights.push(`❤️ 今日家庭捐贈 $${stats.givenToday}`)
    if (stats.checkinsToday === kids.length && kids.length > 0) highlights.push("📅 全家都打卡了！")
    if (stats.newWishes > 0) highlights.push(`✨ 新增 ${stats.newWishes} 個願望`)

    // 生成可分享文字（一句總結、適合貼 LINE）
    const today = localDateTPE()
    const lines: string[] = [`📊 ${today} 全家成就：`]
    if (stats.approvedToday > 0)
      lines.push(`✅ 完成 ${stats.approvedToday} 個任務（獎勵 $${stats.rewardToday}）`)
    if (stats.spentToday > 0) lines.push(`💸 花費 $${stats.spentToday}`)
    if (stats.givenToday > 0) lines.push(`❤️ 捐贈 $${stats.givenToday}`)
    if (stats.checkinsToday > 0) lines.push(`📅 打卡 ${stats.checkinsToday} 人`)
    if (stats.pendingTasks > 0) lines.push(`⏳ 待審核 ${stats.pendingTasks} 個`)
    if (kids.length > 0) {
      const top = kids[0]
      if (top.tasks > 0)
        lines.push(`🏆 今日最積極：${top.avatar} ${top.kidName}（${top.tasks} 任務）`)
    }
    const shareableText =
      lines.length > 1 ? lines.join("\n") : `📊 ${today} 還沒有家庭活動、來開始吧！`

    res.json({
      date: today,
      stats,
      kids,
      highlights,
      shareableText,
    })
  })
)

/**
 * GET /api/family/kid-donation-recipients?kidId=
 * 小孩捐贈受贈方統計（看給誰最多、培養同理心）
 * 從 kids_spendings WHERE jar='give' AND recipient IS NOT NULL GROUP BY
 */
router.get(
  "/api/family/kid-donation-recipients",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")

    const result = await db.execute(sql`
      SELECT
        recipient,
        COUNT(*)::int AS times,
        SUM(amount::numeric)::numeric AS total,
        MAX(spend_date) AS last_at
      FROM kids_spendings
      WHERE kid_id = ${kidIdQ}
        AND jar = 'give'
        AND recipient IS NOT NULL
        AND TRIM(recipient) != ''
      GROUP BY recipient
      ORDER BY total DESC, times DESC
    `)
    const rows = (
      result as unknown as {
        rows: {
          recipient: string
          times: number
          total: string | number
          last_at: Date | null
        }[]
      }
    ).rows

    const recipients = rows.map((r) => ({
      recipient: r.recipient,
      times: r.times,
      total: Number(r.total ?? 0),
      lastAt: r.last_at,
    }))

    const totalGiven = recipients.reduce((s, r) => s + r.total, 0)
    const totalRecipients = recipients.length

    res.json({
      kidId: kidIdQ,
      totalGiven,
      totalRecipients,
      mostHelped: recipients[0] ?? null,
      recipients,
    })
  })
)

export default router
