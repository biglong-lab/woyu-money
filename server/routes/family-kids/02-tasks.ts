/**
 * family-kids 端點（自 family-kids.ts 機械拆分 part 02，2026-07-03）
 * 路徑與行為不變；掛載順序由 index.ts 保證與原檔一致
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../../middleware/error-handler"
import { db } from "../../db"
import { sql, eq, and, desc } from "drizzle-orm"
import {
  kidsAccounts,
  kidsJars,
  kidsTasks,
  kidsGoals,
  kidsBadges,
  kidsSpendings,
  insertKidsGoalSchema,
  insertKidsSpendingSchema,
  paymentItems,
  paymentRecords,
} from "@shared/schema"
import { localDateTPE } from "@shared/date-utils"
import {
  ensureMonthlyAllowance,
  ensureJarsRow,
  awardBadgeIfNew,
  calcStreak,
  checkStreakBadges,
  checkTaskBadges,
} from "./helpers"

const router = Router()

/**
 * 家長 approve 任務：
 *  1. 更新任務 status=approved
 *  2. 按三罐比例分配 rewardAmount 進 kids_jars
 *  3. 更新 totalReceived
 *  4. 觸發任務徽章（first_task / tasks_10 / tasks_50）
 */
router.post(
  "/api/family/tasks/:id/approve",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const [task] = await db.select().from(kidsTasks).where(eq(kidsTasks.id, id)).limit(1)
    if (!task) throw new AppError(404, "任務不存在")
    if (task.status !== "submitted" && task.status !== "pending") {
      throw new AppError(400, "只可 approve 待處理/已完成任務")
    }
    if (!task.kidId) throw new AppError(400, "任務未指定小孩")

    const [kid] = await db
      .select()
      .from(kidsAccounts)
      .where(eq(kidsAccounts.id, task.kidId))
      .limit(1)
    if (!kid) throw new AppError(404, "小孩帳戶不存在")
    await ensureJarsRow(kid.id)

    const baseReward = parseFloat(task.rewardAmount)
    // 驚喜獎勵：15% 機率觸發隨機 bonus + emoji（小孩有期待感）
    // FAMILY_KIDS_NO_BONUS=1 可關閉
    // 5 種倍率（機率依稀有度遞減）、對應不同 emoji 與標題
    const BONUS_TIERS: Array<{
      multiplier: number
      emoji: string
      label: string
      weight: number
    }> = [
      { multiplier: 0.2, emoji: "🎁", label: "小驚喜", weight: 40 }, // +20%
      { multiplier: 0.5, emoji: "🎉", label: "驚喜獎勵", weight: 30 }, // +50%
      { multiplier: 1.0, emoji: "🌟", label: "閃亮獎勵", weight: 15 }, // +100%
      { multiplier: 1.5, emoji: "💥", label: "超級獎勵", weight: 10 }, // +150%
      { multiplier: 2.0, emoji: "🌈", label: "彩虹大禮", weight: 5 }, // +200%
    ]
    const bonusEnabled = process.env.FAMILY_KIDS_NO_BONUS !== "1"
    const surpriseTriggered = bonusEnabled && Math.random() < 0.15
    let bonusAmount = 0
    let bonusEmoji = ""
    let bonusLabel = ""
    if (surpriseTriggered) {
      // 加權隨機抽 tier
      const totalWeight = BONUS_TIERS.reduce((s, t) => s + t.weight, 0)
      let pick = Math.random() * totalWeight
      let chosen = BONUS_TIERS[0]
      for (const t of BONUS_TIERS) {
        pick -= t.weight
        if (pick <= 0) {
          chosen = t
          break
        }
      }
      bonusAmount = Math.round(baseReward * chosen.multiplier)
      bonusEmoji = chosen.emoji
      bonusLabel = chosen.label
    }
    const reward = baseReward + bonusAmount
    const spendAdd = (reward * kid.spendRatio) / 100
    const saveAdd = (reward * kid.saveRatio) / 100
    const giveAdd = (reward * kid.giveRatio) / 100

    // 更新 jars
    await db.execute(sql`
      UPDATE kids_jars
      SET spend_balance = spend_balance + ${spendAdd.toFixed(2)}::numeric,
          save_balance  = save_balance + ${saveAdd.toFixed(2)}::numeric,
          give_balance  = give_balance + ${giveAdd.toFixed(2)}::numeric,
          total_received = total_received + ${reward.toFixed(2)}::numeric,
          updated_at = NOW()
      WHERE kid_id = ${kid.id}
    `)

    // 串入主系統：寫一筆 payment_item + payment_record 進主系統
    // → 在 /cost-overview「一般單項」會看到、/financial-dashboard 也會算進總支出
    let mainPaymentItemId: number | null = null
    let mainPaymentRecordId: number | null = null
    try {
      const today = localDateTPE()
      const [pi] = await db
        .insert(paymentItems)
        .values({
          itemName: surpriseTriggered
            ? `🎁✨ ${kid.displayName} 零用金（含驚喜）：${task.title}`
            : `🎁 ${kid.displayName} 零用金：${task.title}`,
          totalAmount: reward.toFixed(2),
          paidAmount: reward.toFixed(2),
          itemType: "home",
          paymentType: "single",
          status: "paid",
          startDate: today,
          source: "manual",
          notes:
            `家庭記帳「小孩模式」自動入帳\n小孩：${kid.displayName}（id=${kid.id}）\n任務：${task.title}\n` +
            (surpriseTriggered
              ? `基本 $${baseReward} + 驚喜 +$${bonusAmount} = $${reward}\n`
              : "") +
            `三罐分配：花用 $${spendAdd} / 儲蓄 $${saveAdd} / 捐獻 $${giveAdd}`,
          tags: "kids,allowance",
        })
        .returning({ id: paymentItems.id })
      mainPaymentItemId = pi.id

      const [pr] = await db
        .insert(paymentRecords)
        .values({
          itemId: pi.id,
          amountPaid: reward.toFixed(2),
          paymentDate: today,
          paymentMethod: "現金",
          notes: `家庭記帳：${kid.displayName} 完成「${task.title}」`,
        })
        .returning({ id: paymentRecords.id })
      mainPaymentRecordId = pr.id
    } catch (err) {
      // 串接主系統失敗不阻斷任務 approve（雙保險）
      console.warn("[family-kids] 寫入 payment_records 失敗：", err)
    }

    // 更新 task（含主系統 record id + 可選家長回饋）
    const parentFeedback = req.body?.parentFeedback
      ? String(req.body.parentFeedback).slice(0, 500)
      : null
    const [updated] = await db
      .update(kidsTasks)
      .set({
        status: "approved",
        approvedAt: new Date(),
        paymentRecordId: mainPaymentRecordId,
        updatedAt: new Date(),
        ...(parentFeedback ? { parentFeedback } : {}),
      })
      .where(eq(kidsTasks.id, id))
      .returning()

    // 觸發徽章（任務數 + streak）
    const awarded = await checkTaskBadges(kid.id)
    const streak = await calcStreak(kid.id)
    const streakBadges = await checkStreakBadges(kid.id, streak)
    awarded.push(...streakBadges)

    // Recurring：若任務設定週期重複、自動產生下一筆相同任務
    let nextRecurringTaskId: number | null = null
    if (task.recurringInterval === "weekly" || task.recurringInterval === "monthly") {
      const intervalDays = task.recurringInterval === "weekly" ? 7 : 30
      // 計算下次到期日（從原本 dueDate 算起、無則從今天算）
      // 無 dueDate 用 TPE 今天（UTC midnight 錨定、後續純日期運算不受時區影響）
      const baseDate = task.dueDate
        ? new Date(task.dueDate)
        : new Date(localDateTPE() + "T00:00:00Z")
      const nextDue = new Date(baseDate.getTime() + intervalDays * 86400000)
      const nextDueStr = nextDue.toISOString().slice(0, 10)
      try {
        const [next] = await db
          .insert(kidsTasks)
          .values({
            familyId: task.familyId,
            kidId: task.kidId,
            title: task.title,
            emoji: task.emoji,
            rewardAmount: task.rewardAmount,
            status: "pending",
            notes: task.notes,
            dueDate: nextDueStr,
            recurringInterval: task.recurringInterval,
            // 同 chain 的 parentId 沿用、不存在則自己當 root
            recurringParentId: task.recurringParentId ?? task.id,
          })
          .returning({ id: kidsTasks.id })
        nextRecurringTaskId = next?.id ?? null
      } catch (err) {
        console.warn("[family-kids] 產生 recurring 下一筆失敗：", err)
      }
    }

    res.json({
      task: updated,
      jars: { spendAdd, saveAdd, giveAdd, total: reward },
      newBadges: awarded,
      bonus: {
        triggered: surpriseTriggered,
        baseAmount: baseReward,
        bonusAmount,
        totalAmount: reward,
        emoji: bonusEmoji,
        label: bonusLabel,
      },
      mainSystem: {
        paymentItemId: mainPaymentItemId,
        paymentRecordId: mainPaymentRecordId,
        synced: mainPaymentItemId !== null,
      },
      recurring: {
        interval: task.recurringInterval,
        nextTaskId: nextRecurringTaskId,
      },
    })
  })
)

router.delete(
  "/api/family/tasks/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const [del] = await db.delete(kidsTasks).where(eq(kidsTasks.id, id)).returning()
    if (!del) throw new AppError(404, "任務不存在")
    res.json({ ok: true })
  })
)

// ============================================================
// 3. 存錢目標
// ============================================================
router.get(
  "/api/family/goals",
  asyncHandler(async (req, res) => {
    const kidIdQ = req.query.kidId ? Number(req.query.kidId) : undefined
    const conds = kidIdQ ? [eq(kidsGoals.kidId, kidIdQ)] : []
    const rows = await db
      .select()
      .from(kidsGoals)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(kidsGoals.createdAt))
    res.json(rows)
  })
)

router.post(
  "/api/family/goals",
  asyncHandler(async (req, res) => {
    const parsed = insertKidsGoalSchema.safeParse({ ...req.body, status: "active" })
    if (!parsed.success) {
      throw new AppError(
        400,
        "資料格式錯誤：" + parsed.error.errors.map((e) => e.message).join(", ")
      )
    }
    const [created] = await db.insert(kidsGoals).values(parsed.data).returning()
    res.status(201).json(created)
  })
)

/**
 * 從 save 罐撥錢到目標：
 *  1. 檢查 save_balance 足夠
 *  2. save_balance -= amount、goal.currentAmount += amount
 *  3. 若達標 → status=completed、觸發徽章
 */
router.post(
  "/api/family/goals/:id/save",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const amount = Number(req.body?.amount ?? 0)
    if (!(amount > 0)) throw new AppError(400, "amount 需為正數")

    const [goal] = await db.select().from(kidsGoals).where(eq(kidsGoals.id, id)).limit(1)
    if (!goal) throw new AppError(404, "目標不存在")
    if (goal.status !== "active") throw new AppError(400, "目標非進行中")

    const [jar] = await db.select().from(kidsJars).where(eq(kidsJars.kidId, goal.kidId)).limit(1)
    if (!jar) throw new AppError(404, "小孩罐子不存在")
    const saveBal = parseFloat(jar.saveBalance)
    if (saveBal < amount) throw new AppError(400, `存錢罐餘額 $${saveBal} 不足 $${amount}`)

    const newCurrent = parseFloat(goal.currentAmount) + amount
    const targetAmount = parseFloat(goal.targetAmount)
    const reached = newCurrent >= targetAmount

    await db.execute(sql`
      UPDATE kids_jars SET save_balance = save_balance - ${amount.toFixed(2)}::numeric,
                            updated_at = NOW()
      WHERE kid_id = ${goal.kidId}
    `)
    // 達成時可附「達成感言」（completedReflection）
    const completedReflection = req.body?.completedReflection
      ? String(req.body.completedReflection).slice(0, 500)
      : null
    const [updated] = await db
      .update(kidsGoals)
      .set({
        currentAmount: newCurrent.toFixed(2),
        status: reached ? "completed" : "active",
        completedAt: reached ? new Date() : null,
        updatedAt: new Date(),
        ...(reached && completedReflection ? { completedReflection } : {}),
      })
      .where(eq(kidsGoals.id, id))
      .returning()

    const awarded: string[] = []
    if (reached) {
      if (
        await awardBadgeIfNew(goal.kidId, "first_goal", "完成第一個存錢目標", "🎯", { goalId: id })
      ) {
        awarded.push("first_goal")
      }
      // 也檢查「目標 5 個 / 10 個」徽章
      const r = await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM kids_goals WHERE kid_id = ${goal.kidId} AND status = 'completed'
      `)
      const n = (r as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0
      if (n >= 5 && (await awardBadgeIfNew(goal.kidId, "goals_5", "完成 5 個目標", "🌈")))
        awarded.push("goals_5")
      if (n >= 10 && (await awardBadgeIfNew(goal.kidId, "goals_10", "完成 10 個目標", "🏰")))
        awarded.push("goals_10")
    }

    // 儲蓄累積徽章（看 goal current_amount 累積）
    const saveSum = await db.execute(sql`
      SELECT COALESCE(SUM(current_amount::numeric), 0)::numeric AS s
      FROM kids_goals WHERE kid_id = ${goal.kidId}
    `)
    const saved = parseFloat(
      String((saveSum as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? "0")
    )
    if (saved >= 500 && (await awardBadgeIfNew(goal.kidId, "save_500", "存錢達 $500", "🪙")))
      awarded.push("save_500")
    if (saved >= 2000 && (await awardBadgeIfNew(goal.kidId, "save_2000", "存錢達 $2000", "💎")))
      awarded.push("save_2000")

    res.json({ goal: updated, newBadges: awarded, reached })
  })
)

router.put(
  "/api/family/goals/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const body = { ...req.body, updatedAt: new Date() }
    const [updated] = await db.update(kidsGoals).set(body).where(eq(kidsGoals.id, id)).returning()
    if (!updated) throw new AppError(404, "目標不存在")
    res.json(updated)
  })
)

// ============================================================
// 4. Dashboard 聚合
// ============================================================
router.get(
  "/api/family/dashboard",
  asyncHandler(async (req, res) => {
    const kidIdQ = req.query.kidId ? Number(req.query.kidId) : null
    if (!kidIdQ) {
      // 全家：所有小孩 + jars 加總
      const kids = await db.select().from(kidsAccounts).where(eq(kidsAccounts.isActive, true))
      const jars = await db.select().from(kidsJars)
      const totalReceived = jars.reduce((s, j) => s + parseFloat(j.totalReceived), 0)
      const totalSaved = jars.reduce((s, j) => s + parseFloat(j.saveBalance), 0)
      const pendingTasks = await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM kids_tasks WHERE status IN ('pending', 'submitted')
      `)
      const submittedTasks = await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM kids_tasks WHERE status = 'submitted'
      `)
      res.json({
        scope: "family",
        kids,
        totalReceived,
        totalSaved,
        pendingTaskCount: (pendingTasks as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
        toApproveCount: (submittedTasks as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0,
      })
      return
    }

    // 個別小孩
    const [kid] = await db.select().from(kidsAccounts).where(eq(kidsAccounts.id, kidIdQ)).limit(1)
    if (!kid) throw new AppError(404, "小孩不存在")
    await ensureJarsRow(kid.id)
    // Lazy 補發每月零用金（若 monthlyAllowance > 0 且本月未發）
    const allowanceJustGiven = await ensureMonthlyAllowance(kid.id)
    const [jar] = await db.select().from(kidsJars).where(eq(kidsJars.kidId, kid.id)).limit(1)
    const tasksRaw = await db
      .select()
      .from(kidsTasks)
      .where(eq(kidsTasks.kidId, kid.id))
      .orderBy(desc(kidsTasks.createdAt))
      .limit(20)
    // 加 isOverdue / isDueSoon / overdueDays（小孩端視覺警示用）
    const today = localDateTPE()
    const tomorrow = localDateTPE(1)
    const tasks = tasksRaw.map((r) => {
      const isPending = r.status === "pending" || r.status === "submitted"
      const isOverdue = !!(r.dueDate && r.dueDate < today && isPending)
      const isDueSoon = !!(
        r.dueDate &&
        (r.dueDate === today || r.dueDate === tomorrow) &&
        isPending &&
        !isOverdue
      )
      const overdueDays =
        isOverdue && r.dueDate
          ? Math.floor((new Date(today).getTime() - new Date(r.dueDate).getTime()) / 86400000)
          : 0
      return { ...r, isOverdue, isDueSoon, overdueDays }
    })
    const goals = await db
      .select()
      .from(kidsGoals)
      .where(eq(kidsGoals.kidId, kid.id))
      .orderBy(desc(kidsGoals.createdAt))
    const badges = await db
      .select()
      .from(kidsBadges)
      .where(eq(kidsBadges.kidId, kid.id))
      .orderBy(desc(kidsBadges.earnedAt))

    const streak = await calcStreak(kid.id)
    res.json({ scope: "kid", kid, jar, tasks, goals, badges, streak, allowanceJustGiven })
  })
)

// ============================================================
// 5. 花錢紀錄（小孩自己記）
// ============================================================
router.get(
  "/api/family/spendings",
  asyncHandler(async (req, res) => {
    const kidIdQ = req.query.kidId ? Number(req.query.kidId) : undefined
    if (!kidIdQ) throw new AppError(400, "需傳 kidId")
    const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200)
    const rows = await db
      .select()
      .from(kidsSpendings)
      .where(eq(kidsSpendings.kidId, kidIdQ))
      .orderBy(desc(kidsSpendings.spendDate), desc(kidsSpendings.id))
      .limit(limit)
    res.json(rows)
  })
)

/**
 * POST /api/family/spendings
 * Body: { kidId, jar('spend'|'save'|'give'), amount, description, emoji?, spendDate? }
 * 小孩花錢：從對應罐扣餘額、寫紀錄
 */
router.post(
  "/api/family/spendings",
  asyncHandler(async (req, res) => {
    const data = {
      kidId: Number(req.body?.kidId),
      jar: String(req.body?.jar ?? ""),
      amount: req.body?.amount,
      description: String(req.body?.description ?? "").trim(),
      emoji: req.body?.emoji ?? "💰",
      spendDate: req.body?.spendDate ?? localDateTPE(),
      // give 罐特殊欄位（可選）
      recipient: req.body?.recipient ? String(req.body.recipient).slice(0, 100) : null,
      reflection: req.body?.reflection ? String(req.body.reflection).slice(0, 1000) : null,
    }

    if (!data.description) throw new AppError(400, "請填寫項目名稱")
    const parsed = insertKidsSpendingSchema.safeParse(data)
    if (!parsed.success) {
      throw new AppError(
        400,
        "資料格式錯誤：" + parsed.error.errors.map((e) => e.message).join(", ")
      )
    }
    const amt = parseFloat(parsed.data.amount)
    if (!(amt > 0)) throw new AppError(400, "金額需為正數")

    // 檢查餘額
    const [jar] = await db.select().from(kidsJars).where(eq(kidsJars.kidId, data.kidId)).limit(1)
    if (!jar) throw new AppError(404, "小孩罐子不存在")
    const balanceMap = {
      spend: parseFloat(jar.spendBalance),
      save: parseFloat(jar.saveBalance),
      give: parseFloat(jar.giveBalance),
    } as const
    const current = balanceMap[parsed.data.jar as keyof typeof balanceMap]
    if (current < amt) {
      throw new AppError(400, `${parsed.data.jar} 罐餘額 $${current} 不足 $${amt}`)
    }

    // 扣餘額（用 SQL 避免 race）
    const col = `${parsed.data.jar}_balance`
    await db.execute(sql`
      UPDATE kids_jars
      SET ${sql.raw(col)} = ${sql.raw(col)} - ${amt.toFixed(2)}::numeric,
          total_spent = total_spent + ${amt.toFixed(2)}::numeric,
          updated_at = NOW()
      WHERE kid_id = ${data.kidId}
    `)

    const [created] = await db.insert(kidsSpendings).values(parsed.data).returning()

    // 給罐子（捐獻）→ 檢查累計徽章
    const newBadges: string[] = []
    if (parsed.data.jar === "give") {
      const totalRow = await db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0)::numeric AS s FROM kids_spendings
        WHERE kid_id = ${data.kidId} AND jar = 'give'
      `)
      const totalGiven = parseFloat(
        String((totalRow as unknown as { rows: { s: string | number }[] }).rows[0]?.s ?? "0")
      )
      if (totalGiven >= 100 && (await awardBadgeIfNew(data.kidId, "give_100", "捐 $100", "❤️")))
        newBadges.push("give_100")
      if (totalGiven >= 500 && (await awardBadgeIfNew(data.kidId, "give_500", "捐 $500", "💝")))
        newBadges.push("give_500")
      if (totalGiven >= 1000 && (await awardBadgeIfNew(data.kidId, "give_1000", "捐 $1000", "🕊️")))
        newBadges.push("give_1000")
      if (totalGiven >= 5000 && (await awardBadgeIfNew(data.kidId, "give_5000", "捐 $5000", "👼")))
        newBadges.push("give_5000")
    }
    res.status(201).json({ ...created, newBadges })
  })
)

/**
 * POST /api/family/jars/internal-transfer
 * 小孩自己在三罐之間移錢（不影響 totalReceived/totalSpent）
 * Body: { kidId, fromJar, toJar, amount }
 * 培養理財調整能力（多存錢、多花錢都可調整）
 */
router.post(
  "/api/family/jars/internal-transfer",
  asyncHandler(async (req, res) => {
    const kidIdN = Number(req.body?.kidId)
    const fromJar = String(req.body?.fromJar ?? "")
    const toJar = String(req.body?.toJar ?? "")
    const amount = Number(req.body?.amount ?? 0)
    if (!kidIdN) throw new AppError(400, "kidId 必填")
    if (!["spend", "save", "give"].includes(fromJar))
      throw new AppError(400, "fromJar 須為 spend / save / give")
    if (!["spend", "save", "give"].includes(toJar))
      throw new AppError(400, "toJar 須為 spend / save / give")
    if (fromJar === toJar) throw new AppError(400, "來源與目標罐相同")
    if (!(amount > 0)) throw new AppError(400, "金額需為正數")

    await ensureJarsRow(kidIdN)
    const [jar] = await db.select().from(kidsJars).where(eq(kidsJars.kidId, kidIdN)).limit(1)
    if (!jar) throw new AppError(404, "小孩罐子不存在")
    const balMap = {
      spend: parseFloat(jar.spendBalance),
      save: parseFloat(jar.saveBalance),
      give: parseFloat(jar.giveBalance),
    }
    if (balMap[fromJar as keyof typeof balMap] < amount) {
      throw new AppError(
        400,
        `${fromJar} 罐餘額 $${balMap[fromJar as keyof typeof balMap]} 不足 $${amount}`
      )
    }

    const fromCol = `${fromJar}_balance`
    const toCol = `${toJar}_balance`
    await db.execute(sql`
      UPDATE kids_jars
      SET ${sql.raw(fromCol)} = ${sql.raw(fromCol)} - ${amount.toFixed(2)}::numeric,
          ${sql.raw(toCol)} = ${sql.raw(toCol)} + ${amount.toFixed(2)}::numeric,
          updated_at = NOW()
      WHERE kid_id = ${kidIdN}
    `)
    res.json({ ok: true, kidId: kidIdN, fromJar, toJar, amount })
  })
)

/**
 * POST /api/family/jars/transfer
 * 兄弟姊妹互贈零用金
 * Body: { fromKidId, toKidId, amount, jar?, message? }
 *
 * 流程：
 *  1. 從 fromKid 對應 jar 扣（預設 spend 罐）
 *  2. 加到 toKid 的 spend 罐 + totalReceived
 *  3. 兩邊各建一筆 kids_spendings 紀錄（培養同理心 + 受贈紀錄）
 *
 * 培養同理心、家庭互助
 */
router.post(
  "/api/family/jars/transfer",
  asyncHandler(async (req, res) => {
    const fromKidId = Number(req.body?.fromKidId)
    const toKidId = Number(req.body?.toKidId)
    const amount = Number(req.body?.amount)
    const fromJar = String(req.body?.jar ?? "spend") as "spend" | "save" | "give"
    const message = req.body?.message ? String(req.body.message).slice(0, 200) : null

    if (!fromKidId || !toKidId) throw new AppError(400, "fromKidId / toKidId 必填")
    if (fromKidId === toKidId) throw new AppError(400, "不能送禮給自己")
    if (!(amount > 0)) throw new AppError(400, "金額需為正數")
    if (!["spend", "save", "give"].includes(fromJar)) {
      throw new AppError(400, "jar 須為 spend / save / give")
    }

    const [fromKid] = await db
      .select()
      .from(kidsAccounts)
      .where(eq(kidsAccounts.id, fromKidId))
      .limit(1)
    const [toKid] = await db
      .select()
      .from(kidsAccounts)
      .where(eq(kidsAccounts.id, toKidId))
      .limit(1)
    if (!fromKid || !toKid) throw new AppError(404, "找不到指定小孩")

    await ensureJarsRow(fromKidId)
    await ensureJarsRow(toKidId)
    const [fromJarRow] = await db
      .select()
      .from(kidsJars)
      .where(eq(kidsJars.kidId, fromKidId))
      .limit(1)
    const balMap = {
      spend: parseFloat(fromJarRow.spendBalance),
      save: parseFloat(fromJarRow.saveBalance),
      give: parseFloat(fromJarRow.giveBalance),
    }
    if (balMap[fromJar] < amount) {
      throw new AppError(400, `${fromJar} 罐餘額 $${balMap[fromJar]} 不足 $${amount}`)
    }

    // 扣 from 罐
    const fromCol = `${fromJar}_balance`
    await db.execute(sql`
      UPDATE kids_jars
      SET ${sql.raw(fromCol)} = ${sql.raw(fromCol)} - ${amount.toFixed(2)}::numeric,
          total_spent = total_spent + ${amount.toFixed(2)}::numeric,
          updated_at = NOW()
      WHERE kid_id = ${fromKidId}
    `)
    // 加到 to 的 spend 罐（受贈方可自由運用）+ totalReceived
    await db.execute(sql`
      UPDATE kids_jars
      SET spend_balance = spend_balance + ${amount.toFixed(2)}::numeric,
          total_received = total_received + ${amount.toFixed(2)}::numeric,
          updated_at = NOW()
      WHERE kid_id = ${toKidId}
    `)

    const today = localDateTPE()
    // from 紀錄（jar=give、recipient=toKid 名字）
    // to 方靠 jars.total_received 累計、不另建負值紀錄
    await db.insert(kidsSpendings).values({
      kidId: fromKidId,
      jar: "give",
      amount: amount.toFixed(2),
      description: `送禮給 ${toKid.displayName}`,
      emoji: "💝",
      spendDate: today,
      recipient: toKid.displayName,
      reflection: message,
    })

    res.json({
      ok: true,
      from: fromKid.displayName,
      to: toKid.displayName,
      amount,
      fromJar,
      message,
    })
  })
)

export default router
