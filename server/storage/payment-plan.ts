/**
 * 排程分配規劃 Storage 層
 * 獨立規劃層的 allocations CRUD（不動 payment_items）
 */
import { db } from "../db"
import {
  paymentPlanAllocations,
  type PaymentPlanAllocation,
  type InsertPaymentPlanAllocation,
} from "@shared/schema"
import { eq, inArray } from "drizzle-orm"

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
