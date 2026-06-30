/**
 * 歷史欠款整理 Storage 層
 * 獨立模組：欠款 CRUD + 分類管理 + 分期還款 + 進度彙總（已還/未還）+ 歸帳
 */
import { db } from "../db"
import {
  legacyDebts as debts,
  legacyDebtCategories as debtCategories,
  legacyDebtPayments as debtPayments,
  type LegacyDebt as Debt,
  type InsertLegacyDebt as InsertDebt,
  type LegacyDebtCategory as DebtCategory,
  type InsertLegacyDebtCategory as InsertDebtCategory,
  type LegacyDebtPayment as DebtPayment,
  type InsertLegacyDebtPayment as InsertDebtPayment,
} from "@shared/schema"
import { eq, and, asc, desc, sql, inArray } from "drizzle-orm"

// ─────────────────────────────────────────────
// 欠款分類
// ─────────────────────────────────────────────

export async function getCategories(includeInactive = false): Promise<DebtCategory[]> {
  const where = includeInactive ? undefined : eq(debtCategories.isActive, true)
  return db
    .select()
    .from(debtCategories)
    .where(where)
    .orderBy(asc(debtCategories.sortOrder), asc(debtCategories.id))
}

export async function createCategory(data: InsertDebtCategory): Promise<DebtCategory> {
  const [row] = await db.insert(debtCategories).values(data).returning()
  return row
}

export async function updateCategory(
  id: number,
  data: Partial<InsertDebtCategory>
): Promise<DebtCategory | undefined> {
  const [row] = await db
    .update(debtCategories)
    .set(data)
    .where(eq(debtCategories.id, id))
    .returning()
  return row
}

export async function deleteCategory(id: number): Promise<void> {
  // 軟停用（避免破壞既有欠款的 FK）
  await db.update(debtCategories).set({ isActive: false }).where(eq(debtCategories.id, id))
}

// ─────────────────────────────────────────────
// 欠款紀錄
// ─────────────────────────────────────────────

export interface DebtFilters {
  status?: string
  categoryId?: number
  // 還款進度：unpaid 未還 / partial 部分 / paid 已還清
  paymentStatus?: "unpaid" | "partial" | "paid"
}

/** 帶分類名稱 + 還款進度的欠款 */
export interface DebtWithProgress extends Debt {
  categoryName: string | null
  paidAmount: number
  remainingAmount: number
  paymentStatus: "unpaid" | "partial" | "paid"
  paymentCount: number
}

function buildConditions(filters: DebtFilters) {
  const conditions = []
  if (filters.status) conditions.push(eq(debts.status, filters.status))
  if (filters.categoryId) conditions.push(eq(debts.categoryId, filters.categoryId))
  return conditions.length > 0 ? and(...conditions) : undefined
}

function progressOf(total: number, paid: number): "unpaid" | "partial" | "paid" {
  if (paid <= 0) return "unpaid"
  if (paid >= total) return "paid"
  return "partial"
}

export async function listDebts(filters: DebtFilters = {}): Promise<DebtWithProgress[]> {
  const rows = await db
    .select({
      id: debts.id,
      amount: debts.amount,
      categoryId: debts.categoryId,
      creditor: debts.creditor,
      incurDate: debts.incurDate,
      dueDate: debts.dueDate,
      status: debts.status,
      accountCode: debts.accountCode,
      reconciledAt: debts.reconciledAt,
      note: debts.note,
      receiptImageUrl: debts.receiptImageUrl,
      createdAt: debts.createdAt,
      updatedAt: debts.updatedAt,
      categoryName: debtCategories.name,
    })
    .from(debts)
    .leftJoin(debtCategories, eq(debts.categoryId, debtCategories.id))
    .where(buildConditions(filters))
    .orderBy(desc(debts.dueDate), desc(debts.id))

  // 一次撈所有相關還款，於記憶體彙總（避免 N+1）
  const debtIds = rows.map((r) => r.id)
  const paidMap = new Map<number, { paid: number; count: number }>()
  if (debtIds.length > 0) {
    const agg = await db
      .select({
        debtId: debtPayments.debtId,
        paid: sql<string>`COALESCE(SUM(${debtPayments.amount}), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(debtPayments)
      .where(inArray(debtPayments.debtId, debtIds))
      .groupBy(debtPayments.debtId)
    for (const a of agg) paidMap.set(a.debtId, { paid: Number(a.paid) || 0, count: a.count })
  }

  const result = rows.map((r) => {
    const total = Number(r.amount) || 0
    const { paid, count } = paidMap.get(r.id) ?? { paid: 0, count: 0 }
    const remaining = Math.round((total - paid) * 100) / 100
    return {
      ...r,
      paidAmount: paid,
      remainingAmount: remaining,
      paymentStatus: progressOf(total, paid),
      paymentCount: count,
    }
  })

  // 還款進度篩選（衍生欄位，於記憶體過濾）
  if (filters.paymentStatus) {
    return result.filter((d) => d.paymentStatus === filters.paymentStatus)
  }
  return result
}

export async function getDebt(id: number): Promise<DebtWithProgress | undefined> {
  const list = await listDebts({})
  return list.find((d) => d.id === id)
}

export async function createDebt(data: InsertDebt): Promise<Debt> {
  const [row] = await db.insert(debts).values(data).returning()
  return row
}

export async function updateDebt(id: number, data: Partial<InsertDebt>): Promise<Debt | undefined> {
  const patch: Record<string, unknown> = { ...data, updatedAt: new Date() }
  // 切到/離開「已歸帳」時，自動記錄/清除歸帳時間
  if (data.status === "reconciled") patch.reconciledAt = new Date()
  else if (data.status === "open" || data.status === "cancelled") patch.reconciledAt = null
  const [row] = await db.update(debts).set(patch).where(eq(debts.id, id)).returning()
  return row
}

export async function deleteDebt(id: number): Promise<void> {
  // 還款紀錄透過 ON DELETE CASCADE 自動清除
  await db.delete(debts).where(eq(debts.id, id))
}

// ─────────────────────────────────────────────
// 分期 / 還款紀錄
// ─────────────────────────────────────────────

export async function listPayments(debtId: number): Promise<DebtPayment[]> {
  return db
    .select()
    .from(debtPayments)
    .where(eq(debtPayments.debtId, debtId))
    .orderBy(desc(debtPayments.payDate), desc(debtPayments.id))
}

export async function addPayment(debtId: number, data: InsertDebtPayment): Promise<DebtPayment> {
  const [row] = await db
    .insert(debtPayments)
    .values({ ...data, debtId })
    .returning()
  await db.update(debts).set({ updatedAt: new Date() }).where(eq(debts.id, debtId))
  return row
}

export async function deletePayment(id: number): Promise<void> {
  await db.delete(debtPayments).where(eq(debtPayments.id, id))
}

// ─────────────────────────────────────────────
// 全貌彙總
// ─────────────────────────────────────────────

export interface DebtSummary {
  // 全部欠款總額（排除作廢）
  totalDebt: number
  // 已還總額
  totalPaid: number
  // 未還總額（= 全貌掌握的重點）
  totalRemaining: number
  totalCount: number
  byCategory: Array<{
    categoryId: number | null
    categoryName: string | null
    total: number
    paid: number
    remaining: number
    count: number
  }>
  byStatus: Array<{ status: string; count: number; remaining: number }>
}

/** 全貌彙總：總欠款 / 已還 / 未還 + 依分類、狀態拆解 */
export async function getSummary(filters: DebtFilters = {}): Promise<DebtSummary> {
  const list = await listDebts(filters)
  const active = list.filter((d) => d.status !== "cancelled")

  let totalDebt = 0
  let totalPaid = 0
  let totalRemaining = 0
  const catMap = new Map<
    string,
    {
      categoryId: number | null
      categoryName: string | null
      total: number
      paid: number
      remaining: number
      count: number
    }
  >()
  const statusMap = new Map<string, { count: number; remaining: number }>()

  for (const d of active) {
    const total = Number(d.amount) || 0
    totalDebt += total
    totalPaid += d.paidAmount
    totalRemaining += d.remainingAmount

    const key = String(d.categoryId ?? "none")
    const c = catMap.get(key) ?? {
      categoryId: d.categoryId,
      categoryName: d.categoryName,
      total: 0,
      paid: 0,
      remaining: 0,
      count: 0,
    }
    c.total += total
    c.paid += d.paidAmount
    c.remaining += d.remainingAmount
    c.count += 1
    catMap.set(key, c)
  }

  // 狀態彙總含全部（包含作廢）以便檢視
  for (const d of list) {
    const s = statusMap.get(d.status) ?? { count: 0, remaining: 0 }
    s.count += 1
    if (d.status !== "cancelled") s.remaining += d.remainingAmount
    statusMap.set(d.status, s)
  }

  const round = (n: number) => Math.round(n * 100) / 100
  return {
    totalDebt: round(totalDebt),
    totalPaid: round(totalPaid),
    totalRemaining: round(totalRemaining),
    totalCount: active.length,
    byCategory: Array.from(catMap.values()).map((c) => ({
      ...c,
      total: round(c.total),
      paid: round(c.paid),
      remaining: round(c.remaining),
    })),
    byStatus: Array.from(statusMap.entries()).map(([status, s]) => ({
      status,
      count: s.count,
      remaining: round(s.remaining),
    })),
  }
}
