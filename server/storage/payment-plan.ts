/**
 * 排程分配規劃 Storage 層
 * 獨立規劃層的 allocations CRUD（不動 payment_items）
 */
import { db } from "../db"
import {
  paymentPlanAllocations,
  paymentPlanItemCategories,
  paymentPlanCategoryBudgets,
  type PaymentPlanAllocation,
  type InsertPaymentPlanAllocation,
  type PaymentPlanItemCategory,
  type PaymentPlanCategoryBudget,
} from "@shared/schema"
import { eq, inArray, and } from "drizzle-orm"

export async function getAllocations(): Promise<PaymentPlanAllocation[]> {
  return db.select().from(paymentPlanAllocations)
}

export async function createAllocation(
  data: InsertPaymentPlanAllocation
): Promise<PaymentPlanAllocation> {
  const [row] = await db.insert(paymentPlanAllocations).values(data).returning()
  return row
}

export async function updateAllocation(
  id: number,
  data: Partial<InsertPaymentPlanAllocation>
): Promise<PaymentPlanAllocation | undefined> {
  const [row] = await db
    .update(paymentPlanAllocations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(paymentPlanAllocations.id, id))
    .returning()
  return row
}

export async function deleteAllocation(id: number): Promise<void> {
  await db.delete(paymentPlanAllocations).where(eq(paymentPlanAllocations.id, id))
}

/** 刪除指定應付款的所有規劃（自動分配前清空重排用） */
export async function deleteAllocationsForItems(itemIds: number[]): Promise<void> {
  if (itemIds.length === 0) return
  await db
    .delete(paymentPlanAllocations)
    .where(inArray(paymentPlanAllocations.paymentItemId, itemIds))
}

/** 批次建立（自動分配用） */
export async function bulkCreateAllocations(
  rows: InsertPaymentPlanAllocation[]
): Promise<PaymentPlanAllocation[]> {
  if (rows.length === 0) return []
  return db.insert(paymentPlanAllocations).values(rows).returning()
}

// ─────────────────────────────────────────────
// 分類覆寫
// ─────────────────────────────────────────────
export async function getItemCategories(): Promise<PaymentPlanItemCategory[]> {
  return db.select().from(paymentPlanItemCategories)
}

export async function setItemCategory(
  paymentItemId: number,
  category: string
): Promise<PaymentPlanItemCategory> {
  const [row] = await db
    .insert(paymentPlanItemCategories)
    .values({ paymentItemId, category })
    .onConflictDoUpdate({
      target: paymentPlanItemCategories.paymentItemId,
      set: { category, updatedAt: new Date() },
    })
    .returning()
  return row
}

// ─────────────────────────────────────────────
// 分類月度預算
// ─────────────────────────────────────────────
export async function getCategoryBudgets(): Promise<PaymentPlanCategoryBudget[]> {
  return db.select().from(paymentPlanCategoryBudgets)
}

/** upsert 某類別某月的預算；amount<=0 則刪除 */
export async function setCategoryBudget(
  category: string,
  plannedMonth: string,
  amount: string
): Promise<void> {
  const existing = await db
    .select()
    .from(paymentPlanCategoryBudgets)
    .where(
      and(
        eq(paymentPlanCategoryBudgets.category, category),
        eq(paymentPlanCategoryBudgets.plannedMonth, plannedMonth)
      )
    )
    .limit(1)

  if (parseFloat(amount) <= 0) {
    if (existing.length > 0) {
      await db
        .delete(paymentPlanCategoryBudgets)
        .where(eq(paymentPlanCategoryBudgets.id, existing[0].id))
    }
    return
  }

  if (existing.length > 0) {
    await db
      .update(paymentPlanCategoryBudgets)
      .set({ amount, updatedAt: new Date() })
      .where(eq(paymentPlanCategoryBudgets.id, existing[0].id))
  } else {
    await db.insert(paymentPlanCategoryBudgets).values({ category, plannedMonth, amount })
  }
}

/** 把某類別在指定月份平均攤（先清掉這些月份的該類預算、再寫入） */
export async function distributeCategory(
  category: string,
  totalAmount: number,
  months: string[]
): Promise<void> {
  for (const m of months) {
    await db
      .delete(paymentPlanCategoryBudgets)
      .where(
        and(
          eq(paymentPlanCategoryBudgets.category, category),
          eq(paymentPlanCategoryBudgets.plannedMonth, m)
        )
      )
  }
  if (months.length === 0 || totalAmount <= 0) return
  const per = Math.floor((totalAmount / months.length) * 100) / 100
  let allocated = 0
  const rows = months.map((m, i) => {
    const amt = i === months.length - 1 ? Math.round((totalAmount - allocated) * 100) / 100 : per
    allocated += per
    return { category, plannedMonth: m, amount: amt.toFixed(2) }
  })
  await db.insert(paymentPlanCategoryBudgets).values(rows)
}
