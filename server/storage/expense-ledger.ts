/**
 * 開銷流水帳 Storage 層（先記錄、後分帳）
 */
import { db } from "../db"
import {
  expenseLedger,
  type ExpenseLedgerEntry,
  type InsertExpenseLedgerEntry,
} from "@shared/schema"
import { eq, and, gte, lte, desc, sql } from "drizzle-orm"

export interface LedgerFilters {
  status?: string
  startDate?: string
  endDate?: string
}

function buildConditions(f: LedgerFilters) {
  const c = []
  if (f.status) c.push(eq(expenseLedger.status, f.status))
  if (f.startDate) c.push(gte(expenseLedger.entryDate, f.startDate))
  if (f.endDate) c.push(lte(expenseLedger.entryDate, f.endDate))
  return c.length > 0 ? and(...c) : undefined
}

export async function listEntries(f: LedgerFilters = {}): Promise<ExpenseLedgerEntry[]> {
  return db
    .select()
    .from(expenseLedger)
    .where(buildConditions(f))
    .orderBy(desc(expenseLedger.entryDate), desc(expenseLedger.id))
}

export async function createEntry(data: InsertExpenseLedgerEntry): Promise<ExpenseLedgerEntry> {
  const [row] = await db.insert(expenseLedger).values(data).returning()
  return row
}

export async function updateEntry(
  id: number,
  data: Partial<InsertExpenseLedgerEntry>
): Promise<ExpenseLedgerEntry | undefined> {
  // 有填分類/科目時自動標記 classified（除非明確指定 status）
  const patch: Record<string, unknown> = { ...data, updatedAt: new Date() }
  if (!data.status && (data.categoryId || data.accountCode)) {
    patch.status = "classified"
  }
  const [row] = await db
    .update(expenseLedger)
    .set(patch)
    .where(eq(expenseLedger.id, id))
    .returning()
  return row
}

export async function deleteEntry(id: number): Promise<void> {
  await db.delete(expenseLedger).where(eq(expenseLedger.id, id))
}

export interface LedgerSummary {
  total: number
  count: number
  unclassifiedCount: number
  unclassifiedAmount: number
}

export async function getSummary(f: LedgerFilters = {}): Promise<LedgerSummary> {
  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${expenseLedger.amount}), 0)`,
      count: sql<number>`COUNT(*)::int`,
      unclassifiedCount: sql<number>`COUNT(*) FILTER (WHERE ${expenseLedger.status} = 'unclassified')::int`,
      unclassifiedAmount: sql<string>`COALESCE(SUM(${expenseLedger.amount}) FILTER (WHERE ${expenseLedger.status} = 'unclassified'), 0)`,
    })
    .from(expenseLedger)
    .where(buildConditions(f))
  return {
    total: Number(row.total),
    count: row.count,
    unclassifiedCount: row.unclassifiedCount,
    unclassifiedAmount: Number(row.unclassifiedAmount),
  }
}
