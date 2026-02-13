/**
 * 發票記錄 Storage 模組
 * 提供發票記錄的查詢與統計功能
 */
import { db } from "../db"
import { invoiceRecords } from "@shared/schema"
import { eq, and, desc, sql } from "drizzle-orm"

/** 發票記錄查詢篩選條件 */
interface InvoiceRecordFilters {
  year?: number
  month?: number
  category?: string
  invoiceType?: string
}

/** 取得發票記錄列表 */
export async function getInvoiceRecords(filters: InvoiceRecordFilters = {}) {
  const conditions = []

  if (filters.year !== undefined) {
    conditions.push(eq(invoiceRecords.taxYear, filters.year))
  }
  if (filters.month !== undefined) {
    conditions.push(eq(invoiceRecords.taxMonth, filters.month))
  }
  if (filters.category) {
    conditions.push(eq(invoiceRecords.category, filters.category))
  }
  if (filters.invoiceType) {
    conditions.push(eq(invoiceRecords.invoiceType, filters.invoiceType))
  }

  return conditions.length > 0
    ? await db.select().from(invoiceRecords).where(and(...conditions)).orderBy(desc(invoiceRecords.invoiceDate))
    : await db.select().from(invoiceRecords).orderBy(desc(invoiceRecords.invoiceDate))
}

/** 發票統計結果行 */
interface InvoiceStatRow {
  month: number | null
  invoiceType: string | null
  totalAmount: string
  count: number
}

/** 取得發票統計（按月份和發票類型分組） */
export async function getInvoiceStats(year: number): Promise<{ year: number; stats: InvoiceStatRow[] }> {
  const stats = await db.select({
    month: invoiceRecords.taxMonth,
    invoiceType: invoiceRecords.invoiceType,
    totalAmount: sql<string>`sum(${invoiceRecords.totalAmount})::text`,
    count: sql<number>`count(*)::int`,
  })
    .from(invoiceRecords)
    .where(eq(invoiceRecords.taxYear, year))
    .groupBy(invoiceRecords.taxMonth, invoiceRecords.invoiceType)

  return { year, stats }
}
