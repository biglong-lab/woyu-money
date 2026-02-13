/**
 * 預算管理 Storage 層
 * 負責所有預算計劃與預算項目的資料庫操作
 */
import { db } from "../db"
import {
  budgetPlans,
  budgetItems,
  paymentItems,
  type BudgetPlan,
  type InsertBudgetPlan,
  type BudgetItem,
  type InsertBudgetItem,
} from "@shared/schema"
import { eq, and, desc } from "drizzle-orm"

// === 預算計劃篩選條件 ===
interface BudgetPlanFilters {
  projectId?: number
  status?: string
}

// === 預算計劃 CRUD ===

/** 取得所有預算計劃（支援篩選） */
export async function getBudgetPlans(
  filters: BudgetPlanFilters = {}
): Promise<BudgetPlan[]> {
  const conditions: ReturnType<typeof eq>[] = []

  if (filters.projectId) {
    conditions.push(eq(budgetPlans.projectId, filters.projectId))
  }
  if (filters.status) {
    conditions.push(eq(budgetPlans.status, filters.status))
  }

  if (conditions.length > 0) {
    return db
      .select()
      .from(budgetPlans)
      .where(and(...conditions))
      .orderBy(desc(budgetPlans.createdAt))
  }

  return db
    .select()
    .from(budgetPlans)
    .orderBy(desc(budgetPlans.createdAt))
}

/** 取得單一預算計劃 */
export async function getBudgetPlan(
  id: number
): Promise<BudgetPlan | undefined> {
  const [plan] = await db
    .select()
    .from(budgetPlans)
    .where(eq(budgetPlans.id, id))
  return plan
}

/** 新建預算計劃 */
export async function createBudgetPlan(
  data: InsertBudgetPlan
): Promise<BudgetPlan> {
  const [newPlan] = await db
    .insert(budgetPlans)
    .values(data)
    .returning()
  return newPlan
}

/** 更新預算計劃 */
export async function updateBudgetPlan(
  id: number,
  data: Partial<InsertBudgetPlan>
): Promise<BudgetPlan | undefined> {
  const [updatedPlan] = await db
    .update(budgetPlans)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(budgetPlans.id, id))
    .returning()
  return updatedPlan
}

/** 刪除預算計劃（級聯刪除所有預算項目） */
export async function deleteBudgetPlan(id: number): Promise<void> {
  await db.delete(budgetItems).where(eq(budgetItems.budgetPlanId, id))
  await db.delete(budgetPlans).where(eq(budgetPlans.id, id))
}

// === 預算項目 CRUD ===

/** 取得指定預算計劃的所有項目 */
export async function getBudgetItemsByPlan(
  planId: number,
  includeDeleted = false
): Promise<BudgetItem[]> {
  const conditions = includeDeleted
    ? [eq(budgetItems.budgetPlanId, planId)]
    : [eq(budgetItems.budgetPlanId, planId), eq(budgetItems.isDeleted, false)]

  return db
    .select()
    .from(budgetItems)
    .where(and(...conditions))
    .orderBy(budgetItems.priority, budgetItems.createdAt)
}

/** 篩選查詢預算項目 */
interface BudgetItemFilters {
  budgetPlanId?: number
  convertedToPayment?: boolean
}

export async function getBudgetItems(
  filters: BudgetItemFilters = {}
): Promise<BudgetItem[]> {
  const conditions: ReturnType<typeof eq>[] = [eq(budgetItems.isDeleted, false)]

  if (filters.budgetPlanId !== undefined) {
    conditions.push(eq(budgetItems.budgetPlanId, filters.budgetPlanId))
  }
  if (filters.convertedToPayment !== undefined) {
    conditions.push(eq(budgetItems.convertedToPayment, filters.convertedToPayment))
  }

  return db
    .select()
    .from(budgetItems)
    .where(and(...conditions))
    .orderBy(budgetItems.priority, budgetItems.createdAt)
}

/** 取得單一預算項目 */
export async function getBudgetItem(
  id: number
): Promise<BudgetItem | undefined> {
  const [item] = await db
    .select()
    .from(budgetItems)
    .where(eq(budgetItems.id, id))
  return item
}

/** 新建預算項目 */
export async function createBudgetItem(
  data: InsertBudgetItem
): Promise<BudgetItem> {
  const [newItem] = await db
    .insert(budgetItems)
    .values(data)
    .returning()
  return newItem
}

/** 更新預算項目 */
export async function updateBudgetItem(
  id: number,
  data: Partial<InsertBudgetItem> & Record<string, unknown>
): Promise<BudgetItem | undefined> {
  const [updatedItem] = await db
    .update(budgetItems)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(budgetItems.id, id))
    .returning()
  return updatedItem
}

/** 軟刪除預算項目 */
export async function softDeleteBudgetItem(
  id: number
): Promise<BudgetItem | undefined> {
  const [item] = await db
    .update(budgetItems)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(budgetItems.id, id))
    .returning()
  return item
}

// === 預算計劃實際支出計算 ===

/** 重新計算並更新預算計劃的實際支出金額 */
export async function updateBudgetPlanActualSpent(
  planId: number
): Promise<void> {
  const items = await db
    .select()
    .from(budgetItems)
    .where(
      and(eq(budgetItems.budgetPlanId, planId), eq(budgetItems.isDeleted, false))
    )

  const totalActual = items.reduce(
    (sum, item) => sum + parseFloat(item.actualAmount || "0"),
    0
  )

  await db
    .update(budgetPlans)
    .set({ actualSpent: totalActual.toFixed(2), updatedAt: new Date() })
    .where(eq(budgetPlans.id, planId))
}

// === 預算項目轉換為付款項目 ===

/** 轉換結果型別 */
interface ConvertBudgetItemResult {
  paymentItem: typeof paymentItems.$inferSelect
  budgetItem: BudgetItem
}

/** 將預算項目轉換為付款項目 */
export async function convertBudgetItemToPayment(
  budgetItemId: number
): Promise<ConvertBudgetItemResult> {
  // 取得預算項目
  const budgetItem = await getBudgetItem(budgetItemId)
  if (!budgetItem) {
    throw new Error("預算項目不存在")
  }

  if (budgetItem.convertedToPayment) {
    throw new Error("該預算項目已轉換為付款項目")
  }

  // 取得對應的預算計劃（取得 projectId）
  const budgetPlan = await getBudgetPlan(budgetItem.budgetPlanId)

  // 建立付款項目資料
  const paymentItemData: Record<string, unknown> = {
    itemName: budgetItem.itemName,
    projectId: budgetPlan?.projectId,
    categoryId: budgetItem.categoryId,
    fixedCategoryId: budgetItem.fixedCategoryId,
    totalAmount: budgetItem.plannedAmount,
    paidAmount: "0.00",
    startDate:
      budgetItem.startDate ||
      budgetItem.endDate ||
      new Date().toISOString().split("T")[0],
    dueDate: budgetItem.endDate || budgetItem.startDate,
    status: "pending",
    priority: budgetItem.priority,
    notes: budgetItem.notes
      ? `[預算轉換] ${budgetItem.notes}`
      : "[預算轉換項目]",
  }

  // 分期付款特殊處理
  if (
    budgetItem.paymentType === "installment" &&
    budgetItem.installmentCount
  ) {
    paymentItemData.paymentType = "installment"
    paymentItemData.installmentCount = budgetItem.installmentCount
    paymentItemData.installmentAmount = budgetItem.installmentAmount
  }

  // 插入付款項目
  const [newPaymentItem] = await db
    .insert(paymentItems)
    .values(paymentItemData as typeof paymentItems.$inferInsert)
    .returning()

  // 更新預算項目的轉換狀態
  const [updatedBudgetItem] = await db
    .update(budgetItems)
    .set({
      convertedToPayment: true,
      linkedPaymentItemId: newPaymentItem.id,
      conversionDate: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(budgetItems.id, budgetItemId))
    .returning()

  return {
    paymentItem: newPaymentItem,
    budgetItem: updatedBudgetItem,
  }
}
