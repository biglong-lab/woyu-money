/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 13，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql, eq, desc } from "drizzle-orm"
import multer from "multer"
import {
  kidsJars,
  familyTaskTemplates,
  familyRecipients,
  familyPots,
  familyPotContributions,
  kidsCheckins,
} from "@shared/schema"
import { proofUpload } from "./helpers"

const router = Router()

/**
 * 小孩每日心情簽到
 *   POST /api/family/checkins                  寫今日心情（同日 upsert）
 *   GET  /api/family/checkins?kidId=&days=30   查近 N 天心情軌跡
 */
const VALID_MOODS = ["😄 開心", "🙂 還好", "😐 普通", "😢 難過", "😡 生氣"]

router.post(
  "/api/family/checkins",
  asyncHandler(async (req, res) => {
    const kidIdN = Number(req.body?.kidId)
    const mood = String(req.body?.mood ?? "").trim()
    const note = req.body?.note ? String(req.body.note).slice(0, 500) : null
    if (!kidIdN) throw new AppError(400, "kidId 必填")
    if (!VALID_MOODS.includes(mood)) throw new AppError(400, "mood 不合法")

    const today = new Date().toISOString().slice(0, 10)
    const existing = await db.execute(sql`
      SELECT id FROM kids_checkins
      WHERE kid_id = ${kidIdN} AND checkin_date = ${today}
      LIMIT 1
    `)
    const existingId = (existing as unknown as { rows: { id: number }[] }).rows[0]?.id

    if (existingId) {
      await db.execute(sql`
        UPDATE kids_checkins SET mood = ${mood}, note = ${note}
        WHERE id = ${existingId}
      `)
      const [updated] = await db
        .select()
        .from(kidsCheckins)
        .where(eq(kidsCheckins.id, existingId))
        .limit(1)
      res.json({ ok: true, checkin: updated, updated: true })
    } else {
      const [created] = await db
        .insert(kidsCheckins)
        .values({ kidId: kidIdN, mood, note, checkinDate: today })
        .returning()
      res.status(201).json({ ok: true, checkin: created, updated: false })
    }
  })
)

router.get(
  "/api/family/checkins",
  asyncHandler(async (req, res) => {
    const kidIdQ = Number(req.query.kidId)
    if (!Number.isInteger(kidIdQ) || kidIdQ < 1) throw new AppError(400, "需傳 kidId")
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10), 1), 90)
    const sinceDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const rows = await db.execute(sql`
      SELECT * FROM kids_checkins
      WHERE kid_id = ${kidIdQ} AND checkin_date >= ${sinceDate}
      ORDER BY checkin_date DESC
    `)
    const today = new Date().toISOString().slice(0, 10)
    const items = (rows as unknown as { rows: Array<{ checkin_date: string }> }).rows
    const todayCheckin = items.find((x) => x.checkin_date === today) ?? null
    res.json({ kidId: kidIdQ, days, items, today: todayCheckin })
  })
)

/**
 * 家庭共同存錢罐
 *   GET    /api/family/pots                     列出（active + 最近 5 個 completed）
 *   POST   /api/family/pots                     新增（name + targetAmount 必填）
 *   POST   /api/family/pots/:id/contribute      小孩貢獻（從 save 罐扣）
 *   POST   /api/family/pots/:id/complete        家長宣告完成
 *   DELETE /api/family/pots/:id                 刪除（abandoned 或誤建）
 */
router.get(
  "/api/family/pots",
  asyncHandler(async (_req, res) => {
    const pots = await db
      .select()
      .from(familyPots)
      .orderBy(desc(familyPots.status), desc(familyPots.id))
      .limit(50)

    // 補貢獻明細
    const result = await Promise.all(
      pots.map(async (p) => {
        const contributions = await db
          .select()
          .from(familyPotContributions)
          .where(eq(familyPotContributions.potId, p.id))
          .orderBy(desc(familyPotContributions.createdAt))
        return { ...p, contributions }
      })
    )
    res.json(result)
  })
)

router.post(
  "/api/family/pots",
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? "").trim()
    if (!name) throw new AppError(400, "name 必填")
    const targetAmount = Number(req.body?.targetAmount ?? 0)
    if (!(targetAmount > 0)) throw new AppError(400, "targetAmount 需為正數")
    const emoji = String(req.body?.emoji ?? "🏆").slice(0, 8)
    const description = req.body?.description ? String(req.body.description).slice(0, 500) : null
    const [created] = await db
      .insert(familyPots)
      .values({
        name,
        emoji,
        targetAmount: targetAmount.toFixed(2),
        description,
      })
      .returning()
    res.status(201).json(created)
  })
)

router.post(
  "/api/family/pots/:id/contribute",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const kidIdN = Number(req.body?.kidId)
    const amount = Number(req.body?.amount)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效 potId")
    if (!kidIdN) throw new AppError(400, "kidId 必填")
    if (!(amount > 0)) throw new AppError(400, "amount 需為正數")

    const [pot] = await db.select().from(familyPots).where(eq(familyPots.id, id)).limit(1)
    if (!pot) throw new AppError(404, "罐子不存在")
    if (pot.status !== "active") throw new AppError(400, "罐子非進行中")

    const [jar] = await db.select().from(kidsJars).where(eq(kidsJars.kidId, kidIdN)).limit(1)
    if (!jar) throw new AppError(404, "小孩罐子不存在")
    const saveBal = parseFloat(jar.saveBalance)
    if (saveBal < amount) throw new AppError(400, `存錢罐餘額 $${saveBal} 不足 $${amount}`)

    // 扣 save 罐
    await db.execute(sql`
      UPDATE kids_jars SET save_balance = save_balance - ${amount.toFixed(2)}::numeric,
                            updated_at = NOW()
      WHERE kid_id = ${kidIdN}
    `)
    // 加到 pot
    const newCurrent = parseFloat(pot.currentAmount) + amount
    const reached = newCurrent >= parseFloat(pot.targetAmount)
    const [updatedPot] = await db
      .update(familyPots)
      .set({
        currentAmount: newCurrent.toFixed(2),
        status: reached ? "completed" : "active",
        completedAt: reached ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(familyPots.id, id))
      .returning()
    // 記貢獻
    await db
      .insert(familyPotContributions)
      .values({ potId: id, kidId: kidIdN, amount: amount.toFixed(2) })

    res.json({ ok: true, pot: updatedPot, reached })
  })
)

router.post(
  "/api/family/pots/:id/complete",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效 potId")
    const [pot] = await db.select().from(familyPots).where(eq(familyPots.id, id)).limit(1)
    if (!pot) throw new AppError(404, "罐子不存在")
    if (pot.status === "completed") throw new AppError(400, "已完成")
    const [updated] = await db
      .update(familyPots)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(familyPots.id, id))
      .returning()
    res.json({ ok: true, pot: updated })
  })
)

router.delete(
  "/api/family/pots/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效 potId")
    const deleted = await db
      .delete(familyPots)
      .where(eq(familyPots.id, id))
      .returning({ id: familyPots.id })
    if (deleted.length === 0) throw new AppError(404, "罐子不存在")
    res.json({ ok: true })
  })
)

/**
 * 捐贈對象目錄
 *   GET    /api/family/recipients         列出（按 sortOrder 然後 id）
 *   POST   /api/family/recipients         新增
 *   DELETE /api/family/recipients/:id     刪除
 */
router.get(
  "/api/family/recipients",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(familyRecipients)
      .orderBy(familyRecipients.sortOrder, familyRecipients.id)
    res.json(rows)
  })
)

router.post(
  "/api/family/recipients",
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? "").trim()
    if (!name) throw new AppError(400, "name 必填")
    if (name.length > 100) throw new AppError(400, "name 過長")
    const emoji = String(req.body?.emoji ?? "❤️").slice(0, 8)
    const description = req.body?.description ? String(req.body.description).slice(0, 500) : null
    const sortOrder = Number.isInteger(req.body?.sortOrder) ? Number(req.body.sortOrder) : 0
    const [created] = await db
      .insert(familyRecipients)
      .values({ name, emoji, description, sortOrder })
      .returning()
    res.status(201).json(created)
  })
)

router.delete(
  "/api/family/recipients/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const deleted = await db
      .delete(familyRecipients)
      .where(eq(familyRecipients.id, id))
      .returning({ id: familyRecipients.id })
    if (deleted.length === 0) throw new AppError(404, "對象不存在")
    res.json({ ok: true, id })
  })
)

/**
 * 家長自訂任務範本收藏
 *   GET    /api/family/custom-templates       列出
 *   POST   /api/family/custom-templates       新增（title, emoji?, defaultReward, defaultDifficulty?）
 *   DELETE /api/family/custom-templates/:id   刪除
 */
router.get(
  "/api/family/custom-templates",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(familyTaskTemplates)
      .orderBy(familyTaskTemplates.sortOrder, familyTaskTemplates.id)
    res.json(rows)
  })
)

router.post(
  "/api/family/custom-templates",
  asyncHandler(async (req, res) => {
    const title = String(req.body?.title ?? "").trim()
    if (!title) throw new AppError(400, "title 必填")
    if (title.length > 100) throw new AppError(400, "title 過長")
    const emoji = String(req.body?.emoji ?? "📋").slice(0, 8)
    const defaultReward = Number(req.body?.defaultReward ?? 0)
    if (!(defaultReward > 0)) throw new AppError(400, "defaultReward 需為正數")
    const defaultDifficulty = String(req.body?.defaultDifficulty ?? "medium")
    if (!["easy", "medium", "hard"].includes(defaultDifficulty)) {
      throw new AppError(400, "難度需為 easy / medium / hard")
    }
    const sortOrder = Number.isInteger(req.body?.sortOrder) ? Number(req.body.sortOrder) : 0

    const [created] = await db
      .insert(familyTaskTemplates)
      .values({
        title,
        emoji,
        defaultReward: defaultReward.toFixed(2),
        defaultDifficulty,
        sortOrder,
      })
      .returning()
    res.status(201).json(created)
  })
)

router.delete(
  "/api/family/custom-templates/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "無效的 ID")
    const deleted = await db
      .delete(familyTaskTemplates)
      .where(eq(familyTaskTemplates.id, id))
      .returning({ id: familyTaskTemplates.id })
    if (deleted.length === 0) throw new AppError(404, "範本不存在")
    res.json({ ok: true, id })
  })
)

/**
 * GET /api/family/activity-feed?days=30
 * 全家活動 Timeline：過去 N 天的所有事件
 *   - tasks（approved / rejected）
 *   - spendings
 *   - goals（completed）
 *   - badges
 * 按時間倒序、家長首頁一頁看完
 */
router.get(
  "/api/family/activity-feed",
  asyncHandler(async (req, res) => {
    const days = Math.max(1, Math.min(365, Number(req.query.days ?? 30)))
    const sinceIso = new Date(Date.now() - days * 86400000).toISOString()

    const rows = await db.execute(sql`
      SELECT * FROM (
        SELECT
          'task_approved' AS event_type,
          t.id AS ref_id,
          t.kid_id,
          k.display_name AS kid_name,
          k.avatar AS kid_avatar,
          t.title AS detail,
          t.emoji AS emoji,
          t.reward_amount::numeric AS amount,
          t.approved_at AS ts
        FROM kids_tasks t
        JOIN kids_accounts k ON k.id = t.kid_id
        WHERE t.status = 'approved'
          AND t.approved_at IS NOT NULL
          AND t.approved_at >= ${sinceIso}::timestamp

        UNION ALL
        SELECT
          'task_rejected' AS event_type,
          t.id AS ref_id,
          t.kid_id,
          k.display_name AS kid_name,
          k.avatar AS kid_avatar,
          t.title AS detail,
          t.emoji AS emoji,
          NULL::numeric AS amount,
          t.updated_at AS ts
        FROM kids_tasks t
        JOIN kids_accounts k ON k.id = t.kid_id
        WHERE t.status = 'rejected'
          AND t.updated_at >= ${sinceIso}::timestamp

        UNION ALL
        SELECT
          'spending' AS event_type,
          s.id AS ref_id,
          s.kid_id,
          k.display_name AS kid_name,
          k.avatar AS kid_avatar,
          s.description AS detail,
          s.emoji AS emoji,
          s.amount::numeric AS amount,
          s.created_at AS ts
        FROM kids_spendings s
        JOIN kids_accounts k ON k.id = s.kid_id
        WHERE s.created_at >= ${sinceIso}::timestamp

        UNION ALL
        SELECT
          'goal_completed' AS event_type,
          g.id AS ref_id,
          g.kid_id,
          k.display_name AS kid_name,
          k.avatar AS kid_avatar,
          g.name AS detail,
          g.emoji AS emoji,
          g.target_amount::numeric AS amount,
          g.completed_at AS ts
        FROM kids_goals g
        JOIN kids_accounts k ON k.id = g.kid_id
        WHERE g.status = 'completed'
          AND g.completed_at IS NOT NULL
          AND g.completed_at >= ${sinceIso}::timestamp

        UNION ALL
        SELECT
          'badge_earned' AS event_type,
          b.id AS ref_id,
          b.kid_id,
          k.display_name AS kid_name,
          k.avatar AS kid_avatar,
          b.title AS detail,
          b.emoji AS emoji,
          NULL::numeric AS amount,
          b.earned_at AS ts
        FROM kids_badges b
        JOIN kids_accounts k ON k.id = b.kid_id
        WHERE b.earned_at >= ${sinceIso}::timestamp
      ) feed
      ORDER BY ts DESC
      LIMIT 100
    `)

    const items = (
      rows as unknown as {
        rows: {
          event_type: string
          ref_id: number
          kid_id: number
          kid_name: string
          kid_avatar: string
          detail: string
          emoji: string | null
          amount: string | number | null
          ts: string
        }[]
      }
    ).rows.map((r) => ({
      eventType: r.event_type,
      refId: r.ref_id,
      kidId: r.kid_id,
      kidName: r.kid_name,
      kidAvatar: r.kid_avatar,
      detail: r.detail,
      emoji: r.emoji,
      amount: r.amount === null ? null : parseFloat(String(r.amount)),
      ts: r.ts,
    }))

    res.json({ days, items })
  })
)

/**
 * GET /api/family/tasks.ics
 * 匯出未完成 + 有 dueDate 的任務為 ICS 行事曆檔
 * 家長可下載匯入 Google Calendar / Apple Calendar / Outlook
 *
 * 規格參考 RFC 5545、最小可用：BEGIN:VCALENDAR ... VEVENT
 * UID 用 task ID + domain、DTSTART/DTEND 用 dueDate 整天事件
 */
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
}

function formatIcsDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

function formatIcsTimestamp(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  const h = String(d.getUTCHours()).padStart(2, "0")
  const mi = String(d.getUTCMinutes()).padStart(2, "0")
  const s = String(d.getUTCSeconds()).padStart(2, "0")
  return `${y}${m}${day}T${h}${mi}${s}Z`
}

router.get(
  "/api/family/tasks.ics",
  asyncHandler(async (req, res) => {
    // 只匯出未完成（pending/submitted）且有 dueDate 的
    const tasks = await db.execute(sql`
      SELECT t.id, t.title, t.emoji, t.reward_amount, t.due_date, t.status, t.difficulty,
             t.notes, k.display_name AS kid_name
      FROM kids_tasks t
      LEFT JOIN kids_accounts k ON k.id = t.kid_id
      WHERE t.due_date IS NOT NULL
        AND t.status IN ('pending', 'submitted')
      ORDER BY t.due_date ASC
    `)
    const rows = (
      tasks as unknown as {
        rows: {
          id: number
          title: string
          emoji: string | null
          reward_amount: string
          due_date: string
          status: string
          difficulty: string
          notes: string | null
          kid_name: string | null
        }[]
      }
    ).rows

    const now = new Date()
    const dtstamp = formatIcsTimestamp(now)

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//homi.cc//Money Family Tasks//ZH-TW",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:家庭任務",
      "X-WR-TIMEZONE:Asia/Taipei",
    ]
    for (const row of rows) {
      const due = new Date(row.due_date)
      const dueStart = formatIcsDate(due)
      // 整天事件 DTEND 是隔天
      const dayAfter = new Date(due.getTime() + 24 * 60 * 60 * 1000)
      const dueEnd = formatIcsDate(dayAfter)
      const stars = row.difficulty === "easy" ? "⭐" : row.difficulty === "hard" ? "⭐⭐⭐" : "⭐⭐"
      const summary = `${row.emoji ?? "📋"} ${row.title} ${stars} ($${row.reward_amount})`
      const desc = [
        `指派給：${row.kid_name ?? "—"}`,
        `獎勵：$${row.reward_amount}`,
        `難度：${stars}`,
        `狀態：${row.status}`,
        row.notes ? `備註：${row.notes}` : "",
      ]
        .filter(Boolean)
        .join("\\n")
      lines.push(
        "BEGIN:VEVENT",
        `UID:family-task-${row.id}@homi.cc`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dueStart}`,
        `DTEND;VALUE=DATE:${dueEnd}`,
        `SUMMARY:${escapeIcs(summary)}`,
        `DESCRIPTION:${escapeIcs(desc)}`,
        "CATEGORIES:家庭任務",
        "STATUS:CONFIRMED",
        "TRANSP:TRANSPARENT",
        // VALARM：事件前 15 小時提醒（整天事件 DTSTART 是 00:00、-PT15H = 前一天 09:00）
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeIcs(`明天截止：${row.title}（獎勵 $${row.reward_amount}）`)}`,
        "TRIGGER:-PT15H",
        "END:VALARM",
        "END:VEVENT"
      )
    }
    lines.push("END:VCALENDAR")

    const body = lines.join("\r\n") + "\r\n"
    res.setHeader("Content-Type", "text/calendar; charset=utf-8")
    res.setHeader("Content-Disposition", 'attachment; filename="family-tasks.ics"')
    res.send(body)
  })
)

/**
 * POST /api/family/upload-proof
 * 小孩任務照片上傳（multipart/form-data, field=image）
 * 回傳：{ url }（相對路徑、前端用 src 直接渲染）
 */
router.post(
  "/api/family/upload-proof",
  (req, res, next) => {
    proofUpload.single("image")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "檔案過大（上限 5MB）" })
        }
        return res.status(400).json({ error: err.message || "上傳失敗" })
      }
      if (err) return res.status(400).json({ error: err.message || "上傳失敗" })
      next()
    })
  },
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, "需附帶圖片（field: image）")
    const url = `/uploads/kids-proofs/${req.file.filename}`
    res.json({ url, filename: req.file.filename, size: req.file.size })
  })
)

/**
 * GET /api/family/today-tasks-list?limit=20
 * 今日所有 approved task 詳細列表（家長一頁看完）
 */
router.get(
  "/api/family/today-tasks-list",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)

    const rows = await db.execute(sql`
      SELECT
        t.id::int AS task_id,
        t.title,
        t.emoji,
        t.reward_amount::numeric AS reward,
        t.category,
        t.difficulty,
        t.completed_at,
        ka.display_name AS kid_name,
        ka.avatar
      FROM kids_tasks t
      JOIN kids_accounts ka ON ka.id = t.kid_id
      WHERE t.status = 'approved'
        AND ka.is_active = true
        AND DATE(t.completed_at) = CURRENT_DATE
      ORDER BY t.completed_at DESC
      LIMIT ${limit}
    `)

    const tasks = (
      rows as unknown as {
        rows: Array<{
          task_id: number
          title: string
          emoji: string
          reward: string | number
          category: string
          difficulty: string
          completed_at: string
          kid_name: string
          avatar: string
        }>
      }
    ).rows.map((r) => ({
      taskId: r.task_id,
      title: r.title,
      emoji: r.emoji,
      reward: Number(r.reward),
      category: r.category,
      difficulty: r.difficulty,
      completedAt: r.completed_at,
      kidName: r.kid_name,
      kidAvatar: r.avatar,
    }))

    const totalReward = tasks.reduce((s, t) => s + t.reward, 0)

    let message: string
    if (tasks.length === 0) {
      message = "今天還沒有任務完成、誰先衝？"
    } else {
      message = `🌟 今日全家完成 ${tasks.length} 個任務、累計 $${totalReward}`
    }

    res.json({
      tasks,
      totalCount: tasks.length,
      totalReward,
      message,
    })
  })
)

export default router
