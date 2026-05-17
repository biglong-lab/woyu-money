/**
 * 週期性支出模板 CRUD + 產出邏輯
 */
import { db } from "../db"
import { eq, sql, and } from "drizzle-orm"
import {
  recurringExpenseTemplates,
  paymentItems,
  paymentProjects,
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

    // 3. 該月該 (cat,project) 已有紀錄 → skip
    const duplicate = await db.execute(sql`
      SELECT 1 FROM payment_items
      WHERE NOT is_deleted
        AND (category_id IS NOT DISTINCT FROM ${tpl.categoryId})
        AND (fixed_category_id IS NOT DISTINCT FROM ${tpl.fixedCategoryId})
        AND project_id IS NOT DISTINCT FROM ${tpl.projectId}
        AND DATE_TRUNC('month', start_date)::date = (${targetMonth} || '-01')::date
      LIMIT 1
    `)
    if (
      (duplicate as { rowCount?: number }).rowCount &&
      (duplicate as { rowCount?: number }).rowCount! > 0
    ) {
      skipped.push({ id: tpl.id, reason: "該月已有相同 (cat,project) 紀錄" })
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
        source: "auto_backfill",
        tags: tpl.tags ?? `自動產出,週期性,模板#${tpl.id}`,
        notes: `⚠️ 由「${tpl.templateName}」模板自動產出（template id=${tpl.id}）\n估算金額：$${tpl.estimatedAmount}\n請核實實際金額並改為 paid`,
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
