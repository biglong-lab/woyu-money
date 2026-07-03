/**
 * family-kids 共用 helpers（自 family-kids.ts 機械拆分，2026-07-03）
 * multer 圖片上傳、月零用金補發、三罐、徽章、連續打卡、批量批准
 */
import { AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql, eq, and } from "drizzle-orm"
import multer from "multer"
import path from "path"
import fs from "fs"
import {
  kidsAccounts,
  kidsJars,
  kidsTasks,
  kidsBadges,
  paymentItems,
  paymentRecords,
} from "@shared/schema"

// ============================================================
// 小孩任務照片上傳 multer 設定（uploads/kids-proofs/）
// ============================================================
const proofDir = path.resolve(process.cwd(), "uploads/kids-proofs")
if (!fs.existsSync(proofDir)) {
  fs.mkdirSync(proofDir, { recursive: true })
}
const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, proofDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || ".jpg"
    const ts = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    cb(null, `proof_${ts}_${rand}${ext}`)
  },
})
export const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp|heic)$/.test(file.mimetype)
    if (!ok) return cb(new Error("僅接受圖片（jpeg/png/gif/webp/heic）"))
    cb(null, true)
  },
})

// ============================================================
// helpers
// ============================================================
/**
 * Lazy 補發每月零用金
 * 流程：每次 dashboard 查時呼叫、若 kid.monthlyAllowance > 0 且 lastAllowanceMonth != currentMonth
 *   → 自動入帳 monthlyAllowance 並按三罐分配
 *   → 更新 lastAllowanceMonth = currentMonth
 *   → 寫一筆 payment_items / payment_records（主系統可看見）
 * 回傳：補發金額（0 = 沒發、>0 = 發了多少）
 */
export async function ensureMonthlyAllowance(kidId: number): Promise<number> {
  const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, kidId)).limit(1)
  if (!kid) return 0
  const amount = parseFloat(kid.monthlyAllowance)
  if (!(amount > 0)) return 0
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  if (kid.lastAllowanceMonth === currentMonth) return 0

  // 入帳 + 三罐分配（複用 approve 邏輯）
  const spendAdd = Math.round((amount * kid.spendRatio) / 100)
  const saveAdd = Math.round((amount * kid.saveRatio) / 100)
  const giveAdd = amount - spendAdd - saveAdd
  await ensureJarsRow(kidId)
  await db.execute(sql`
    UPDATE kids_jars SET
      spend_balance = spend_balance + ${spendAdd.toFixed(2)}::numeric,
      save_balance = save_balance + ${saveAdd.toFixed(2)}::numeric,
      give_balance = give_balance + ${giveAdd.toFixed(2)}::numeric,
      total_received = total_received + ${amount.toFixed(2)}::numeric,
      updated_at = NOW()
    WHERE kid_id = ${kidId}
  `)
  await db
    .update(kidsAccounts)
    .set({ lastAllowanceMonth: currentMonth, updatedAt: new Date() })
    .where(eq(kidsAccounts.id, kidId))

  // 寫進主系統（複用既有 tags=kids,allowance 規範）
  try {
    const today = now.toISOString().slice(0, 10)
    const [pi] = await db
      .insert(paymentItems)
      .values({
        itemName: `📅 ${kid.displayName} ${currentMonth} 月零用金（自動入帳）`,
        totalAmount: amount.toFixed(2),
        paidAmount: amount.toFixed(2),
        itemType: "home",
        paymentType: "single",
        status: "paid",
        startDate: today,
        source: "manual",
        notes:
          `家庭記帳「每月零用金」自動入帳\n小孩：${kid.displayName}（id=${kid.id}）\n月份：${currentMonth}\n` +
          `三罐分配：花用 $${spendAdd} / 儲蓄 $${saveAdd} / 捐獻 $${giveAdd}`,
        tags: "kids,allowance,monthly",
      })
      .returning({ id: paymentItems.id })
    await db.insert(paymentRecords).values({
      itemId: pi.id,
      amountPaid: amount.toFixed(2),
      paymentDate: today,
      paymentMethod: "現金",
      notes: `家庭記帳：${kid.displayName} ${currentMonth} 月自動零用金`,
    })
  } catch (err) {
    console.warn("[family-kids] 自動零用金寫入 payment_items 失敗：", err)
  }

  return amount
}

export async function ensureJarsRow(kidId: number) {
  const existing = await db.select().from(kidsJars).where(eq(kidsJars.kidId, kidId)).limit(1)
  if (existing.length === 0) {
    await db.insert(kidsJars).values({ kidId })
  }
}

export async function awardBadgeIfNew(
  kidId: number,
  badgeType: string,
  title: string,
  emoji: string,
  metadata?: Record<string, unknown>
) {
  const existing = await db
    .select()
    .from(kidsBadges)
    .where(and(eq(kidsBadges.kidId, kidId), eq(kidsBadges.badgeType, badgeType)))
    .limit(1)
  if (existing.length === 0) {
    await db.insert(kidsBadges).values({
      kidId,
      badgeType,
      title,
      emoji,
      metadata: metadata ?? null,
    })
    return true
  }
  return false
}

/**
 * 計算小孩「連續打卡天數」streak
 * 定義：往回算、每天都至少有 1 個 approved 任務（approved_at 那天）
 * 從今天往回找連續日：今天 / 昨天 / ... 中斷則停
 * 若今天還沒 approved 任務、從昨天開始算（給寬限）
 */
export async function calcStreak(kidId: number): Promise<number> {
  const rows = await db.execute(sql`
    SELECT DISTINCT DATE(approved_at)::text AS d
    FROM kids_tasks
    WHERE kid_id = ${kidId} AND status = 'approved' AND approved_at IS NOT NULL
    ORDER BY d DESC
    LIMIT 365
  `)
  const dates = (rows as unknown as { rows: { d: string }[] }).rows.map((r) => r.d)
  if (dates.length === 0) return 0

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  // 寬限：今天 / 昨天有資料才算開始
  let cursor: string
  if (dates[0] === today) cursor = today
  else if (dates[0] === yesterday) cursor = yesterday
  else return 0

  let streak = 0
  const set = new Set(dates)
  while (set.has(cursor)) {
    streak += 1
    cursor = new Date(new Date(cursor).getTime() - 86400000).toISOString().slice(0, 10)
  }
  return streak
}

export async function checkStreakBadges(kidId: number, streak: number) {
  const awarded: string[] = []
  if (streak >= 7 && (await awardBadgeIfNew(kidId, "streak_7", "連續打卡 7 天", "🔥")))
    awarded.push("streak_7")
  if (streak >= 30 && (await awardBadgeIfNew(kidId, "streak_30", "連續打卡 30 天", "🌟")))
    awarded.push("streak_30")
  if (streak >= 100 && (await awardBadgeIfNew(kidId, "streak_100", "連續打卡 100 天", "👑")))
    awarded.push("streak_100")
  if (streak >= 365 && (await awardBadgeIfNew(kidId, "streak_365", "連續打卡 1 年", "🐉")))
    awarded.push("streak_365")
  return awarded
}

export async function checkTaskBadges(kidId: number) {
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM kids_tasks
    WHERE kid_id = ${kidId} AND status = 'approved'
  `)
  const n = (result as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0
  const awarded: string[] = []
  if (n >= 1 && (await awardBadgeIfNew(kidId, "first_task", "完成第一個任務", "🌟")))
    awarded.push("first_task")
  if (n >= 10 && (await awardBadgeIfNew(kidId, "tasks_10", "完成 10 個任務", "💪")))
    awarded.push("tasks_10")
  if (n >= 50 && (await awardBadgeIfNew(kidId, "tasks_50", "完成 50 個任務", "🏆")))
    awarded.push("tasks_50")
  if (n >= 100 && (await awardBadgeIfNew(kidId, "tasks_100", "完成 100 個任務", "🚀")))
    awarded.push("tasks_100")
  return awarded
}

/**
 * POST /api/family/tasks/bulk-approve
 * 家長一鍵批量批准 submitted/pending 任務
 * body: { ids: number[], parentFeedback?: string }
 * 簡化版邏輯（跳過驚喜獎勵 + recurring + 徽章、純入帳 + 三罐分配 + 串主系統）
 * 個別任務失敗不影響其他（部分成功允許）
 */
export async function bulkApproveOne(
  taskId: number,
  parentFeedback: string | null
): Promise<{
  taskId: number
  kidName: string
  reward: number
  spendAdd: number
  saveAdd: number
  giveAdd: number
}> {
  const [task] = await db.select().from(kidsTasks).where(eq(kidsTasks.id, taskId)).limit(1)
  if (!task) throw new AppError(404, `任務 ${taskId} 不存在`)
  if (task.status !== "submitted" && task.status !== "pending") {
    throw new AppError(400, `任務 ${taskId} 狀態無法批准（${task.status}）`)
  }
  if (!task.kidId) throw new AppError(400, `任務 ${taskId} 未指定小孩`)

  const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, task.kidId)).limit(1)
  if (!kid) throw new AppError(404, `小孩 ${task.kidId} 不存在`)
  await ensureJarsRow(kid.id)

  const reward = parseFloat(task.rewardAmount)
  const spendAdd = (reward * kid.spendRatio) / 100
  const saveAdd = (reward * kid.saveRatio) / 100
  const giveAdd = (reward * kid.giveRatio) / 100

  await db.execute(sql`
    UPDATE kids_jars SET
      spend_balance = spend_balance + ${spendAdd.toFixed(2)}::numeric,
      save_balance  = save_balance  + ${saveAdd.toFixed(2)}::numeric,
      give_balance  = give_balance  + ${giveAdd.toFixed(2)}::numeric,
      total_received = total_received + ${reward.toFixed(2)}::numeric,
      updated_at = NOW()
    WHERE kid_id = ${kid.id}
  `)

  let paymentRecordId: number | null = null
  try {
    const today = new Date().toISOString().slice(0, 10)
    const [pi] = await db
      .insert(paymentItems)
      .values({
        itemName: `🎁 ${kid.displayName} 零用金：${task.title}`,
        totalAmount: reward.toFixed(2),
        paidAmount: reward.toFixed(2),
        itemType: "home",
        paymentType: "single",
        status: "paid",
        startDate: today,
        source: "manual",
        notes: `家庭記帳「小孩模式」批量批准\n小孩：${kid.displayName}\n任務：${task.title}\n三罐：花$${spendAdd} / 存$${saveAdd} / 捐$${giveAdd}`,
        tags: "kids,allowance,bulk",
      })
      .returning({ id: paymentItems.id })

    const [pr] = await db
      .insert(paymentRecords)
      .values({
        itemId: pi.id,
        amountPaid: reward.toFixed(2),
        paymentDate: today,
        paymentMethod: "現金",
        notes: `家庭記帳（批量）：${kid.displayName} 完成「${task.title}」`,
      })
      .returning({ id: paymentRecords.id })
    paymentRecordId = pr.id
  } catch (err) {
    console.warn("[family-kids bulk-approve] payment 寫入失敗：", err)
  }

  await db
    .update(kidsTasks)
    .set({
      status: "approved",
      approvedAt: new Date(),
      paymentRecordId,
      updatedAt: new Date(),
      ...(parentFeedback ? { parentFeedback } : {}),
    })
    .where(eq(kidsTasks.id, taskId))

  return { taskId, kidName: kid.displayName, reward, spendAdd, saveAdd, giveAdd }
}
