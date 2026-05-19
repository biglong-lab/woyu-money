/**
 * 週期性支出模板 CRUD + 產出邏輯
 */
import { db } from "../db"
import { eq, sql, and } from "drizzle-orm"
import {
  recurringExpenseTemplates,
  paymentItems,
  paymentProjects,
  paymentRecords,
  type RecurringExpenseTemplate,
  type InsertRecurringExpenseTemplate,
} from "@shared/schema"

export async function listTemplates(): Promise<RecurringExpenseTemplate[]> {
  return db.select().from(recurringExpenseTemplates).orderBy(recurringExpenseTemplates.templateName)
}

export async function getTemplate(id: number): Promise<RecurringExpenseTemplate | undefined> {
  const [row] = await db
    .select()
    .from(recurringExpenseTemplates)
    .where(eq(recurringExpenseTemplates.id, id))
  return row
}

export async function createTemplate(
  data: InsertRecurringExpenseTemplate
): Promise<RecurringExpenseTemplate> {
  const [row] = await db
    .insert(recurringExpenseTemplates)
    .values({ ...data, updatedAt: new Date() })
    .returning()
  return row
}

export async function updateTemplate(
  id: number,
  data: Partial<InsertRecurringExpenseTemplate>
): Promise<RecurringExpenseTemplate | undefined> {
  const [row] = await db
    .update(recurringExpenseTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(recurringExpenseTemplates.id, id))
    .returning()
  return row
}

export async function deleteTemplate(id: number): Promise<boolean> {
  const [row] = await db
    .delete(recurringExpenseTemplates)
    .where(eq(recurringExpenseTemplates.id, id))
    .returning()
  return !!row
}

/**
 * 依指定月份產出 unpaid payment_items（每模板一筆）
 *
 * 安全：跳過已產出的月份（lastGeneratedMonth）+ 跳過該月已有 (cat,project) 紀錄
 *
 * @param targetMonth YYYY-MM
 * @param templateIds 限制處理某幾筆（不填 = 處理全部 active）
 * @returns 新建的 payment_item ids
 */
export async function generateItemsForMonth(
  targetMonth: string,
  templateIds?: number[]
): Promise<{ generated: number[]; skipped: { id: number; reason: string }[] }> {
  const generated: number[] = []
  const skipped: { id: number; reason: string }[] = []

  // 過濾 active + 該月在 activeMonths 範圍內
  const allActive = await db
    .select()
    .from(recurringExpenseTemplates)
    .where(eq(recurringExpenseTemplates.isActive, true))

  const candidates = templateIds ? allActive.filter((t) => templateIds.includes(t.id)) : allActive

  const targetMonthNum = parseInt(targetMonth.split("-")[1], 10)

  for (const tpl of candidates) {
    // 1. 已產出該月 → skip
    if (tpl.lastGeneratedMonth === targetMonth) {
      skipped.push({ id: tpl.id, reason: "已產出該月" })
      continue
    }

    // 2. 月份不在 activeMonths
    if (tpl.activeMonths !== "*") {
      const months = tpl.activeMonths
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n))
      if (!months.includes(targetMonthNum)) {
        skipped.push({ id: tpl.id, reason: `${targetMonthNum} 月不在 activeMonths` })
        continue
      }
    }

    // 3. 該月已有「同模板」對應的 payment_item → skip
    // 用 recurring_template_id FK 對照（精準），不再用 (cat, project) 因 category 多為 NULL、
    // IS NOT DISTINCT FROM NULL = NULL 會誤判「該月該專案任何未分類項目」全部 skip
    const duplicate = await db.execute(sql`
      SELECT 1 FROM payment_items
      WHERE NOT is_deleted
        AND recurring_template_id = ${tpl.id}
        AND DATE_TRUNC('month', start_date)::date = (${targetMonth} || '-01')::date
      LIMIT 1
    `)
    if (
      (duplicate as { rowCount?: number }).rowCount &&
      (duplicate as { rowCount?: number }).rowCount! > 0
    ) {
      skipped.push({ id: tpl.id, reason: "該月已有此模板的占位" })
      continue
    }

    // 4. 取 project_name for itemName
    let projectName: string | null = null
    if (tpl.projectId) {
      const [proj] = await db
        .select({ name: paymentProjects.projectName })
        .from(paymentProjects)
        .where(eq(paymentProjects.id, tpl.projectId))
      projectName = proj?.name ?? null
    }

    const itemName = projectName
      ? `${tpl.templateName} ${targetMonth} - ${projectName}`
      : `${tpl.templateName} ${targetMonth}`

    const day = Math.min(28, Math.max(1, tpl.dayOfMonth)) // 限 1-28 避免月底邊界
    const startDate = `${targetMonth}-${day.toString().padStart(2, "0")}`

    const [item] = await db
      .insert(paymentItems)
      .values({
        itemName,
        totalAmount: tpl.estimatedAmount,
        itemType: "project",
        paymentType: "single",
        projectId: tpl.projectId,
        categoryId: tpl.categoryId,
        fixedCategoryId: tpl.fixedCategoryId,
        startDate,
        status: "unpaid",
        paidAmount: "0",
        // 區分一次性 backfill（2026-05 刪掉的 125 筆）與週期 scheduler 自動產出
        source: "template_scheduled",
        recurringTemplateId: tpl.id,
        tags: tpl.tags ?? `週期估算,模板#${tpl.id}`,
        notes: `🧮 估算占位：由「${tpl.templateName}」模板自動產出（template id=${tpl.id}）\n估算金額：$${tpl.estimatedAmount}\n實際支付時請更新金額並改為 paid（不要新增另一筆）`,
        priority: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: paymentItems.id })

    generated.push(item.id)

    // 5. 更新 lastGeneratedMonth
    await db
      .update(recurringExpenseTemplates)
      .set({ lastGeneratedMonth: targetMonth, updatedAt: new Date() })
      .where(eq(recurringExpenseTemplates.id, tpl.id))
  }

  return { generated, skipped }
}

/**
 * 列出指定月份的所有「模板自動產出占位項」
 * 給前端「本月待填實際金額」清單用
 */
export async function listScheduledItems(targetMonth: string) {
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    throw new Error("月份格式錯誤、需 YYYY-MM")
  }
  const rows = await db.execute(sql`
    SELECT
      pi.id,
      pi.item_name             AS "itemName",
      pi.total_amount::numeric AS "estimatedAmount",
      pi.paid_amount::numeric  AS "paidAmount",
      pi.status,
      pi.start_date            AS "startDate",
      pi.notes,
      pi.recurring_template_id AS "templateId",
      t.template_name          AS "templateName",
      t.estimated_amount::numeric AS "templateEstimatedAmount",
      p.project_name           AS "projectName"
    FROM payment_items pi
    LEFT JOIN recurring_expense_templates t ON t.id = pi.recurring_template_id
    LEFT JOIN payment_projects p            ON p.id = pi.project_id
    WHERE NOT pi.is_deleted
      AND pi.source = 'template_scheduled'
      AND TO_CHAR(pi.start_date, 'YYYY-MM') = ${targetMonth}
    ORDER BY pi.status, pi.start_date, pi.id
  `)
  return (rows as unknown as { rows: unknown[] }).rows
}

/**
 * 把既有的 payment_item 連結到週期模板（不改 source / 金額 / 狀態）
 *
 * 場景：「未分類」抽屜內、使用者把已存在的支付項標記為「這筆是電費模板的本月實際支付」
 * 動作：
 *  - 設 recurring_template_id = templateId
 *  - 補 categoryId / fixedCategoryId（若 payment_item 沒設、套用 template 的）
 *  - 補 projectId（同上）
 *  - notes 加標記「📎 已連結模板 #N（templateName）」
 *
 * @param markPaid 是否同時把 status 改成 paid + paidAmount = totalAmount
 */
export async function linkItemToTemplate(params: {
  itemId: number
  templateId: number
  markPaid?: boolean
}): Promise<{ ok: true; templateName: string; itemId: number }> {
  const { itemId, templateId, markPaid } = params

  const [tpl] = await db
    .select()
    .from(recurringExpenseTemplates)
    .where(eq(recurringExpenseTemplates.id, templateId))
  if (!tpl) throw new Error("模板不存在")

  const [item] = await db
    .select({
      id: paymentItems.id,
      notes: paymentItems.notes,
      categoryId: paymentItems.categoryId,
      fixedCategoryId: paymentItems.fixedCategoryId,
      projectId: paymentItems.projectId,
      totalAmount: paymentItems.totalAmount,
      isDeleted: paymentItems.isDeleted,
    })
    .from(paymentItems)
    .where(eq(paymentItems.id, itemId))
  if (!item) throw new Error("付款項目不存在")
  if (item.isDeleted) throw new Error("付款項目已刪除")

  const stamp = new Date().toISOString().slice(0, 10)
  const linkNote = `📎 已連結模板 #${templateId}（${tpl.templateName}、${stamp}）`

  const newNotes = item.notes
    ? item.notes.includes(`#${templateId}`)
      ? item.notes
      : `${linkNote}\n${item.notes}`
    : linkNote

  const update: Record<string, unknown> = {
    recurringTemplateId: templateId,
    notes: newNotes,
    updatedAt: new Date(),
  }
  if (item.categoryId === null && tpl.categoryId) update.categoryId = tpl.categoryId
  if (item.fixedCategoryId === null && tpl.fixedCategoryId)
    update.fixedCategoryId = tpl.fixedCategoryId
  if (item.projectId === null && tpl.projectId) update.projectId = tpl.projectId

  if (markPaid) {
    update.status = "paid"
    update.paidAmount = item.totalAmount
  }

  await db.update(paymentItems).set(update).where(eq(paymentItems.id, itemId))

  return { ok: true, templateName: tpl.templateName, itemId }
}

/**
 * 將模板自動產出的「估算占位」更新成「實際支付」
 *
 * 流程：
 * - 找該 payment_item 並確認來自 template_scheduled（避免誤改一般項目）
 * - 更新 totalAmount = actualAmount、paidAmount = actualAmount、status = 'paid'
 * - 在 notes 加上「✅ 已實付：原估算 $X → 實際 $Y（差額 ±$Z、Date）」
 * - 同時新增一筆 payment_record（含 paymentDate、receiptImageUrl 選填）
 *
 * 設計選擇：不新增另一筆 payment_item、保留 recurringTemplateId 連結
 * → 統計時用真實金額、後台可從 template 回溯所有實際發生
 */
export async function replaceScheduledWithActual(params: {
  itemId: number
  actualAmount: number
  paymentDate: string // YYYY-MM-DD
  paymentMethod?: string | null
  notes?: string | null
  receiptImageUrl?: string | null
}): Promise<{ itemId: number; recordId: number; estimatedAmount: number; diff: number }> {
  const { itemId, actualAmount, paymentDate, paymentMethod, notes, receiptImageUrl } = params

  if (!(actualAmount > 0)) throw new Error("實際金額需大於 0")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) throw new Error("付款日格式需 YYYY-MM-DD")

  // 用 transaction 確保 item update + record insert 同步
  return db.transaction(async (tx) => {
    // 1. 取現有 item
    const [item] = await tx
      .select({
        id: paymentItems.id,
        source: paymentItems.source,
        totalAmount: paymentItems.totalAmount,
        recurringTemplateId: paymentItems.recurringTemplateId,
        notes: paymentItems.notes,
        status: paymentItems.status,
        isDeleted: paymentItems.isDeleted,
      })
      .from(paymentItems)
      .where(eq(paymentItems.id, itemId))

    if (!item) throw new Error("付款項目不存在")
    if (item.isDeleted) throw new Error("付款項目已刪除")
    if (item.source !== "template_scheduled" && !item.recurringTemplateId) {
      throw new Error("此項目非模板自動產出、不可用此 API 取代（請改用一般付款流程）")
    }

    const estimatedAmount = parseFloat(item.totalAmount)
    const diff = actualAmount - estimatedAmount
    const diffStr =
      diff === 0
        ? "持平"
        : diff > 0
          ? `+$${diff.toLocaleString()}`
          : `-$${Math.abs(diff).toLocaleString()}`

    const updatedNotes = [
      `✅ 已實付（${paymentDate}）：原估算 $${estimatedAmount.toLocaleString()} → 實際 $${actualAmount.toLocaleString()}（${diffStr}）`,
      notes?.trim() || null,
      item.notes ? `[原占位備註] ${item.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    // 2. 更新 payment_item
    await tx
      .update(paymentItems)
      .set({
        totalAmount: actualAmount.toFixed(2),
        paidAmount: actualAmount.toFixed(2),
        status: "paid",
        notes: updatedNotes,
        updatedAt: new Date(),
      })
      .where(eq(paymentItems.id, itemId))

    // 3. 新增 payment_record
    const [record] = await tx
      .insert(paymentRecords)
      .values({
        itemId,
        amountPaid: actualAmount.toFixed(2),
        paymentDate,
        paymentMethod: paymentMethod ?? null,
        notes: notes?.trim() || `由「模板占位 → 實際金額」介面新增`,
        receiptImageUrl: receiptImageUrl ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: paymentRecords.id })

    return { itemId, recordId: record.id, estimatedAmount, diff }
  })
}
