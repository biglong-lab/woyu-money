import { Router } from "express"
import { invoiceRecords } from "@shared/schema"
import { eq, desc, and, sql } from "drizzle-orm"
import { db } from "../db"

const router = Router()

// 獲取發票記錄列表
router.get("/api/invoice-records", async (req, res) => {
  try {
    const { year, month, category, invoiceType } = req.query

    const conditions = []

    if (year) {
      conditions.push(eq(invoiceRecords.taxYear, parseInt(year as string)))
    }
    if (month) {
      conditions.push(eq(invoiceRecords.taxMonth, parseInt(month as string)))
    }
    if (category) {
      conditions.push(eq(invoiceRecords.category, category as string))
    }
    if (invoiceType) {
      conditions.push(eq(invoiceRecords.invoiceType, invoiceType as string))
    }

    const records = conditions.length > 0
      ? await db.select().from(invoiceRecords).where(and(...conditions)).orderBy(desc(invoiceRecords.invoiceDate))
      : await db.select().from(invoiceRecords).orderBy(desc(invoiceRecords.invoiceDate))

    res.json(records)
  } catch (error: any) {
    console.error("Error fetching invoice records:", error)
    res.status(500).json({ message: "獲取發票記錄失敗" })
  }
})

// 獲取發票統計
router.get("/api/invoice-records/stats", async (req, res) => {
  try {
    const { year } = req.query
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear()

    const stats = await db.select({
      month: invoiceRecords.taxMonth,
      invoiceType: invoiceRecords.invoiceType,
      totalAmount: sql<string>`sum(${invoiceRecords.totalAmount})::text`,
      count: sql<number>`count(*)::int`,
    })
      .from(invoiceRecords)
      .where(eq(invoiceRecords.taxYear, targetYear))
      .groupBy(invoiceRecords.taxMonth, invoiceRecords.invoiceType)

    res.json({ year: targetYear, stats })
  } catch (error: any) {
    console.error("Error fetching invoice stats:", error)
    res.status(500).json({ message: "獲取發票統計失敗" })
  }
})

export default router
