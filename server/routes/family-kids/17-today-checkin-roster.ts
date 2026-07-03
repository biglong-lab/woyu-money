/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 17，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql } from "drizzle-orm"

const router = Router()

/**
 * GET /api/family/today-checkin-roster
 * 今日每位 active kid 簽到狀態（簽了沒？心情如何？）
 */
router.get(
  "/api/family/today-checkin-roster",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        ka.color,
        c.mood,
        c.note,
        c.created_at AS checkin_time
      FROM kids_accounts ka
      LEFT JOIN kids_checkins c
        ON c.kid_id = ka.id AND c.checkin_date = CURRENT_DATE
      WHERE ka.is_active = true
      ORDER BY ka.id ASC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          color: string
          mood: string | null
          note: string | null
          checkin_time: string | null
        }>
      }
    ).rows.map((r) => ({
      kidId: r.kid_id,
      kidName: r.kid_name,
      avatar: r.avatar,
      color: r.color,
      checkedIn: r.mood !== null,
      mood: r.mood,
      note: r.note,
      checkinTime: r.checkin_time,
    }))

    const totalKids = kids.length
    const checkedInCount = kids.filter((k) => k.checkedIn).length
    const uncheckedKids = kids.filter((k) => !k.checkedIn)
    const rate = totalKids > 0 ? Math.round((checkedInCount / totalKids) * 100) : 0

    let message: string
    if (totalKids === 0) {
      message = "還沒有 active 小孩、新增第一個吧"
    } else if (checkedInCount === totalKids) {
      message = `🎉 全家 ${totalKids} 位小孩今天都簽到了！`
    } else if (checkedInCount === 0) {
      message = `⏰ 今天還沒有人簽到、提醒小孩來打卡吧`
    } else {
      message = `✅ ${checkedInCount}/${totalKids} 位小孩已簽到、還剩 ${uncheckedKids.length} 位`
    }

    res.json({
      totalKids,
      checkedInCount,
      uncheckedCount: uncheckedKids.length,
      rate,
      kids,
      uncheckedKids,
      message,
    })
  })
)

/**
 * GET /api/family/task-category-breakdown?days=30
 * 家庭 N 天任務 category 分布（培養哪方面？）
 */
router.get(
  "/api/family/task-category-breakdown",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)

    const rows = await db.execute(sql`
      SELECT
        t.category,
        COUNT(*)::int AS task_count,
        SUM(t.reward_amount)::numeric AS total_reward,
        COUNT(DISTINCT t.kid_id)::int AS unique_kids
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.status = 'approved'
        AND t.approved_at >= NOW() - (${days} || ' days')::interval
        AND ka.is_active = true
      GROUP BY t.category
      ORDER BY task_count DESC
    `)

    const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
      housework: { label: "家事", emoji: "🧹" },
      study: { label: "學習", emoji: "📚" },
      self_care: { label: "自我照顧", emoji: "🪥" },
      kindness: { label: "善行", emoji: "❤️" },
      other: { label: "其他", emoji: "✨" },
    }

    const data = (
      rows as unknown as {
        rows: Array<{
          category: string
          task_count: number
          total_reward: string
          unique_kids: number
        }>
      }
    ).rows

    const totalCount = data.reduce((s, r) => s + r.task_count, 0)

    const categories = data.map((r) => {
      const meta = CATEGORY_META[r.category] ?? { label: r.category, emoji: "📋" }
      return {
        category: r.category,
        label: meta.label,
        emoji: meta.emoji,
        taskCount: r.task_count,
        totalReward: Number(r.total_reward),
        uniqueKids: r.unique_kids,
        percentage: totalCount > 0 ? Math.round((r.task_count / totalCount) * 100) : 0,
      }
    })

    const topCategory = categories.length > 0 ? categories[0] : null

    let message: string
    if (categories.length === 0) {
      message = `過去 ${days} 天家裡還沒有 approved 任務`
    } else if (topCategory) {
      message = `${topCategory.emoji} 家裡 ${days} 天最多「${topCategory.label}」(${topCategory.percentage}%)、共 ${topCategory.taskCount} 個任務`
    } else {
      message = `共 ${totalCount} 個任務分佈於 ${categories.length} 類`
    }

    res.json({
      days,
      categories,
      totalCount,
      topCategory,
      message,
    })
  })
)

/**
 * GET /api/family/kindness-milestone
 * 家庭 give jar 累積總額 + 里程碑進度（慶祝感）
 */
router.get(
  "/api/family/kindness-milestone",
  asyncHandler(async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT COALESCE(SUM(s.amount), 0)::numeric AS total
      FROM kids_spendings s
      JOIN kids_accounts ka ON ka.id = s.kid_id
      WHERE s.jar = 'give' AND ka.is_active = true
    `)
    const total = Number(
      (rows as unknown as { rows: Array<{ total: string }> }).rows[0]?.total ?? 0
    )

    const milestones = [
      { tier: "Bronze 銅", amount: 100, emoji: "🥉" },
      { tier: "Silver 銀", amount: 300, emoji: "🥈" },
      { tier: "Gold 金", amount: 500, emoji: "🥇" },
      { tier: "Hero 英雄", amount: 1000, emoji: "🦸" },
      { tier: "Champion 冠軍", amount: 3000, emoji: "🏆" },
      { tier: "Legend 傳奇", amount: 5000, emoji: "🌟" },
      { tier: "Saint 聖者", amount: 10000, emoji: "👑" },
    ]

    const currentMilestone = [...milestones].reverse().find((m) => total >= m.amount) ?? null
    const nextMilestone = milestones.find((m) => total < m.amount) ?? null
    const progressToNext = nextMilestone
      ? Math.min(100, Math.round((total / nextMilestone.amount) * 100))
      : 100
    const amountToNext = nextMilestone ? Math.max(0, nextMilestone.amount - total) : 0

    let message: string
    if (total === 0) {
      message = "家裡還沒有 give jar 行善紀錄、從第一筆開始吧 ❤️"
    } else if (nextMilestone) {
      message = currentMilestone
        ? `${currentMilestone.emoji} 已達 ${currentMilestone.tier}、再 $${Math.round(amountToNext)} 升等 ${nextMilestone.emoji} ${nextMilestone.tier}`
        : `❤️ 再 $${Math.round(amountToNext)} 達 ${nextMilestone.emoji} ${nextMilestone.tier}`
    } else {
      message = `👑 已達最高 ${currentMilestone?.tier ?? "Saint"} 等級、家庭善心傳奇！`
    }

    res.json({
      total: Math.round(total * 100) / 100,
      currentMilestone,
      nextMilestone,
      progressToNext,
      amountToNext: Math.round(amountToNext * 100) / 100,
      milestones,
      message,
    })
  })
)

/**
 * GET /api/family/top-recipients?days=30&limit=5
 * 家裡 give jar 最常支持的對象 ranking、培養家庭價值觀
 */
router.get(
  "/api/family/top-recipients",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20)

    const rows = await db.execute(sql`
      SELECT
        s.recipient,
        SUM(s.amount)::numeric AS total_amount,
        COUNT(*)::int AS give_count,
        COUNT(DISTINCT s.kid_id)::int AS unique_kids,
        MAX(s.spend_date) AS last_give_date
      FROM kids_spendings s
      JOIN kids_accounts ka ON ka.id = s.kid_id
      WHERE s.jar = 'give'
        AND s.recipient IS NOT NULL
        AND length(trim(s.recipient)) > 0
        AND s.spend_date >= CURRENT_DATE - (${days} || ' days')::interval
        AND ka.is_active = true
      GROUP BY s.recipient
      ORDER BY total_amount DESC
      LIMIT ${limit}
    `)

    const recipients = (
      rows as unknown as {
        rows: Array<{
          recipient: string
          total_amount: string
          give_count: number
          unique_kids: number
          last_give_date: string
        }>
      }
    ).rows.map((r) => ({
      recipient: r.recipient,
      totalAmount: Number(r.total_amount),
      giveCount: r.give_count,
      uniqueKids: r.unique_kids,
      lastGiveDate: r.last_give_date,
    }))

    const grandTotal = recipients.reduce((s, r) => s + r.totalAmount, 0)
    const topPick = recipients.length > 0 ? recipients[0] : null

    let message: string
    if (recipients.length === 0) {
      message = `過去 ${days} 天家裡還沒有具名捐獻對象`
    } else if (topPick) {
      message = `❤️ 家裡 ${days} 天最支持「${topPick.recipient}」、共捐 $${Math.round(topPick.totalAmount)}`
    } else {
      message = `共支持 ${recipients.length} 個對象、總計 $${Math.round(grandTotal)}`
    }

    res.json({
      days,
      recipients,
      grandTotal: Math.round(grandTotal * 100) / 100,
      recipientCount: recipients.length,
      topPick,
      message,
    })
  })
)

/**
 * GET /api/family/proof-image-wall?days=7
 * 過去 N 天 approved + 有 proof_image_url 任務的縮圖牆
 */
router.get(
  "/api/family/proof-image-wall",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 30)

    const rows = await db.execute(sql`
      SELECT
        t.id::int AS task_id,
        t.title,
        t.emoji,
        t.reward_amount::numeric AS reward,
        t.proof_image_url,
        t.approved_at,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.status = 'approved'
        AND t.proof_image_url IS NOT NULL
        AND length(trim(t.proof_image_url)) > 0
        AND t.approved_at >= NOW() - (${days} || ' days')::interval
        AND ka.is_active = true
      ORDER BY t.approved_at DESC
      LIMIT 30
    `)

    const photos = (
      rows as unknown as {
        rows: Array<{
          task_id: number
          title: string
          emoji: string
          reward: string
          proof_image_url: string
          approved_at: string
          kid_id: number
          kid_name: string
          avatar: string
        }>
      }
    ).rows.map((r) => ({
      taskId: r.task_id,
      title: r.title,
      emoji: r.emoji,
      reward: Number(r.reward),
      proofImageUrl: r.proof_image_url,
      approvedAt: r.approved_at,
      kidId: r.kid_id,
      kidName: r.kid_name,
      kidAvatar: r.avatar,
    }))

    const uniqueKids = new Set(photos.map((p) => p.kidId)).size

    let message: string
    if (photos.length === 0) {
      message = `過去 ${days} 天還沒有附上證明照片的任務`
    } else {
      message = `📸 過去 ${days} 天家裡 ${uniqueKids} 位小孩留下了 ${photos.length} 張努力證明`
    }

    res.json({
      days,
      photos,
      photoCount: photos.length,
      uniqueKids,
      message,
    })
  })
)

/**
 * GET /api/family/stale-pending-tasks?days=3
 * 小孩 submit 後家長 N 天未 approve 的任務（被遺忘的獎勵）
 * 排序 waitingDays DESC
 */
router.get(
  "/api/family/stale-pending-tasks",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 3, 1), 30)

    const rows = await db.execute(sql`
      SELECT
        t.id::int AS task_id,
        t.title,
        t.emoji,
        t.reward_amount::numeric AS reward,
        t.completed_at,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        EXTRACT(DAY FROM (NOW() - t.completed_at))::int AS waiting_days
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.status = 'submitted'
        AND t.completed_at IS NOT NULL
        AND t.completed_at < NOW() - (${days} || ' days')::interval
        AND ka.is_active = true
      ORDER BY t.completed_at ASC
      LIMIT 50
    `)

    const tasks = (
      rows as unknown as {
        rows: Array<{
          task_id: number
          title: string
          emoji: string
          reward: string
          completed_at: string
          kid_id: number
          kid_name: string
          avatar: string
          waiting_days: number
        }>
      }
    ).rows.map((r) => ({
      taskId: r.task_id,
      title: r.title,
      emoji: r.emoji,
      reward: Number(r.reward),
      completedAt: r.completed_at,
      kidId: r.kid_id,
      kidName: r.kid_name,
      kidAvatar: r.avatar,
      waitingDays: r.waiting_days,
    }))

    const totalForgotten = tasks.reduce((s, t) => s + t.reward, 0)
    const uniqueKids = new Set(tasks.map((t) => t.kidId)).size
    const maxWait = tasks.length > 0 ? Math.max(...tasks.map((t) => t.waitingDays)) : 0

    let message: string
    let severity: "ok" | "warn" | "alert"
    if (tasks.length === 0) {
      message = `家長很棒！沒有超過 ${days} 天未批准的任務`
      severity = "ok"
    } else if (maxWait >= 7) {
      message = `🚨 有 ${tasks.length} 個任務等了 ${maxWait} 天還沒批准（共 $${Math.round(totalForgotten)}）— 快去看看`
      severity = "alert"
    } else {
      message = `⏳ 有 ${tasks.length} 個任務等了超過 ${days} 天（共 $${Math.round(totalForgotten)}）`
      severity = "warn"
    }

    res.json({
      days,
      tasks,
      totalForgotten: Math.round(totalForgotten * 100) / 100,
      uniqueKids,
      maxWaitingDays: maxWait,
      severity,
      message,
    })
  })
)

/**
 * GET /api/family/weekly-kindness-story?days=7
 * 過去 N 天 give jar 有 reflection 的捐獻故事彙整
 */
router.get(
  "/api/family/weekly-kindness-story",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 30)

    const rows = await db.execute(sql`
      SELECT
        s.id::int AS spending_id,
        s.amount::numeric AS amount,
        s.description,
        s.emoji,
        s.recipient,
        s.reflection,
        s.spend_date,
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar
      FROM kids_spendings s
      JOIN kids_accounts ka ON ka.id = s.kid_id
      WHERE s.jar = 'give'
        AND s.reflection IS NOT NULL
        AND length(trim(s.reflection)) > 0
        AND s.spend_date >= CURRENT_DATE - (${days - 1} || ' days')::interval
        AND ka.is_active = true
      ORDER BY s.spend_date DESC, s.created_at DESC
      LIMIT 20
    `)

    const stories = (
      rows as unknown as {
        rows: Array<{
          spending_id: number
          amount: string
          description: string
          emoji: string
          recipient: string | null
          reflection: string
          spend_date: string
          kid_id: number
          kid_name: string
          avatar: string
        }>
      }
    ).rows.map((r) => ({
      spendingId: r.spending_id,
      amount: Number(r.amount),
      description: r.description,
      emoji: r.emoji,
      recipient: r.recipient,
      reflection: r.reflection,
      spendDate: r.spend_date,
      kidId: r.kid_id,
      kidName: r.kid_name,
      kidAvatar: r.avatar,
    }))

    const totalKindness = stories.reduce((s, x) => s + x.amount, 0)
    const uniqueKids = new Set(stories.map((s) => s.kidId)).size

    let message: string
    if (stories.length === 0) {
      message = `過去 ${days} 天還沒有寫下捐獻反思的故事`
    } else {
      message = `❤️ 過去 ${days} 天家裡有 ${uniqueKids} 位小孩寫下 ${stories.length} 則善心故事、共捐 $${Math.round(totalKindness)}`
    }

    res.json({
      days,
      stories,
      totalKindness: Math.round(totalKindness * 100) / 100,
      uniqueKids,
      storyCount: stories.length,
      message,
    })
  })
)

/**
 * GET /api/family/task-repeat-by-kid?days=90
 * 每個 active kid 過去 N 天 task 重複率（1 - unique/total）
 * pattern: routine(>=60% repeat) / mixed / variety(<20% repeat) / no_data
 */
router.get(
  "/api/family/task-repeat-by-kid",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365)

    const rows = await db.execute(sql`
      SELECT
        ka.id::int AS kid_id,
        ka.display_name AS kid_name,
        ka.avatar,
        COUNT(t.id)::int AS total,
        COUNT(DISTINCT t.title)::int AS unique_titles
      FROM kids_accounts ka
      LEFT JOIN kids_tasks t ON
        t.kid_id = ka.id
        AND t.status = 'approved'
        AND t.completed_at >= CURRENT_DATE - (${days}::int * INTERVAL '1 day')
      WHERE ka.is_active = true
      GROUP BY ka.id, ka.display_name, ka.avatar
      ORDER BY ka.id ASC
    `)

    const kids = (
      rows as unknown as {
        rows: Array<{
          kid_id: number
          kid_name: string
          avatar: string
          total: number
          unique_titles: number
        }>
      }
    ).rows.map((r) => {
      const total = r.total
      const unique = r.unique_titles
      const repeatRate = total > 0 ? Math.round((1 - unique / total) * 100) : 0
      let pattern: "routine" | "mixed" | "variety" | "no_data"
      if (total === 0) pattern = "no_data"
      else if (repeatRate >= 60) pattern = "routine"
      else if (repeatRate < 20) pattern = "variety"
      else pattern = "mixed"
      return {
        kidId: r.kid_id,
        kidName: r.kid_name,
        avatar: r.avatar,
        total,
        uniqueTitles: unique,
        repeatRate,
        pattern,
      }
    })

    const counts = {
      routine: kids.filter((k) => k.pattern === "routine").length,
      mixed: kids.filter((k) => k.pattern === "mixed").length,
      variety: kids.filter((k) => k.pattern === "variety").length,
    }

    let message: string
    const withTasks = kids.filter((k) => k.total > 0)
    if (withTasks.length === 0) {
      message = `過去 ${days} 天還沒任務`
    } else if (counts.routine > 0) {
      message = `📋 ${counts.routine} 個小孩日常型（高重複）、有固定生活節奏`
    } else if (counts.variety === withTasks.length) {
      message = `🎨 全家都愛嘗鮮、各種任務都試試看`
    } else {
      message = "家庭任務組合多元"
    }

    res.json({
      days,
      kids,
      patternCounts: counts,
      message,
    })
  })
)

export default router
