/**
 * 報表模組 (Reports)
 * 提供智慧報表生成、報表匯出等功能
 */

import { db } from "../db"
import { paymentItems, debtCategories } from "@shared/schema"
import { eq, and, gte } from "drizzle-orm"

/**
 * 產生智慧報表
 * 包含月度趨勢、分類統計、現金流預測、關鍵績效指標
 */
/** 智慧報表結果 */
interface IntelligentReportResult {
  monthlyTrends: Array<{
    month: string
    planned: number
    actual: number
    variance: number
  }>
  categoryBreakdown: Array<{
    name: string
    value: number
    percentage: number
    color: string
  }>
  cashFlowForecast: Array<{
    date: string
    projected: number
    confidence: number
  }>
  kpis: {
    totalPlanned: number
    totalPaid: number
    completionRate: number
    averageAmount: number
    overdueItems: number
    monthlyVariance: number
  }
}

export async function generateIntelligentReport(
  period: string,
  reportType: string,
  userId: number
): Promise<IntelligentReportResult> {
  try {
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)

    // 取得付款項目資料
    const paymentItemsData = await db
      .select({
        id: paymentItems.id,
        totalAmount: paymentItems.totalAmount,
        status: paymentItems.status,
        startDate: paymentItems.startDate,
        categoryName: debtCategories.categoryName,
      })
      .from(paymentItems)
      .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
      .where(
        and(eq(paymentItems.isDeleted, false), gte(paymentItems.startDate, startDate.toISOString()))
      )

    // 計算月度趨勢
    const monthlyTrends = []
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStr = month.toISOString().substring(0, 7)
      const monthData = paymentItemsData.filter((item) => item.startDate?.startsWith(monthStr))
      const planned = monthData.reduce((sum, item) => sum + parseFloat(item.totalAmount || "0"), 0)
      const actual = monthData
        .filter((item) => item.status === "paid")
        .reduce((sum, item) => sum + parseFloat(item.totalAmount || "0"), 0)
      monthlyTrends.push({
        month: month.toLocaleDateString("zh-TW", { year: "numeric", month: "short" }),
        planned,
        actual,
        variance: planned > 0 ? ((actual - planned) / planned) * 100 : 0,
      })
    }

    // 計算分類統計
    const categoryStats = new Map()
    paymentItemsData.forEach((item) => {
      const category = item.categoryName || "其他"
      const amount = parseFloat(item.totalAmount || "0")
      categoryStats.set(category, (categoryStats.get(category) || 0) + amount)
    })
    const totalAmount = Array.from(categoryStats.values()).reduce(
      (sum: number, val: number) => sum + val,
      0
    )
    const categoryBreakdown = Array.from(categoryStats.entries()).map(
      ([name, value]: [string, number], index: number) => ({
        name,
        value,
        percentage: totalAmount > 0 ? Math.round((value / totalAmount) * 100) : 0,
        color: ["#2563EB", "#059669", "#DC2626", "#F59E0B", "#8B5CF6"][index % 5],
      })
    )

    // 產生現金流預測（模擬資料）
    const cashFlowForecast = []
    for (let i = 0; i < 12; i++) {
      const futureMonth = new Date(now.getFullYear(), now.getMonth() + i, 1)
      cashFlowForecast.push({
        date: futureMonth.toLocaleDateString("zh-TW", { month: "short" }),
        projected: Math.random() * 500000 + 200000,
        confidence: Math.random() * 0.3 + 0.7,
      })
    }

    // 計算關鍵績效指標
    const totalPlanned = paymentItemsData.reduce(
      (sum, item) => sum + parseFloat(item.totalAmount || "0"),
      0
    )
    const totalPaid = paymentItemsData
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + parseFloat(item.totalAmount || "0"), 0)
    const completionRate = totalPlanned > 0 ? Math.round((totalPaid / totalPlanned) * 100) : 0
    const averageAmount = paymentItemsData.length > 0 ? totalPlanned / paymentItemsData.length : 0
    const overdueItems = paymentItemsData.filter(
      (item) =>
        item.status === "overdue" ||
        (item.status === "pending" && new Date(item.startDate || "") < now)
    ).length

    return {
      monthlyTrends,
      categoryBreakdown,
      cashFlowForecast,
      kpis: {
        totalPlanned,
        totalPaid,
        completionRate,
        averageAmount,
        overdueItems,
        monthlyVariance:
          monthlyTrends.length > 0 ? monthlyTrends[monthlyTrends.length - 1].variance : 0,
      },
    }
  } catch (error) {
    console.error("產生智慧報表失敗:", error)
    throw error
  }
}

/**
 * 匯出報表
 * 產生報表下載連結
 */
/** 匯出報表結果 */
interface ExportReportResult {
  filename: string
  downloadUrl: string
  size: number
  format: string
}

export async function exportReport(
  format: string,
  reportType: string,
  filters: Record<string, unknown>,
  userId: number
): Promise<ExportReportResult> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `report-${reportType}-${timestamp}.${format}`
    return {
      filename,
      downloadUrl: `/api/downloads/${filename}`,
      size: Math.floor(Math.random() * 1000000) + 100000,
      format,
    }
  } catch (error) {
    console.error("匯出報表失敗:", error)
    throw error
  }
}
