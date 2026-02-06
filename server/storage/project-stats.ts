/**
 * 專案統計模組 (Project Stats)
 * 提供專案及其統計資訊的查詢功能
 */

import { db } from "../db"
import { paymentItems, paymentProjects } from "@shared/schema"
import { eq, sql } from "drizzle-orm"

/**
 * 取得所有專案及其統計資訊
 * 包含總金額、已付金額、未付金額、逾期金額、完成率等
 */
export async function getProjectsWithStats(): Promise<any[]> {
  try {
    const projectStats = await db.select({
      projectId: paymentProjects.id,
      projectName: paymentProjects.projectName,
      projectType: paymentProjects.projectType,
      totalAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentItems.isDeleted} = false THEN ${paymentItems.totalAmount}::numeric ELSE 0 END), 0)`,
      paidAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentItems.isDeleted} = false THEN ${paymentItems.paidAmount}::numeric ELSE 0 END), 0)`,
      unpaidAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} != "paid" THEN (${paymentItems.totalAmount}::numeric - ${paymentItems.paidAmount}::numeric) ELSE 0 END), 0)`,
      overdueAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} = "overdue" THEN (${paymentItems.totalAmount}::numeric - ${paymentItems.paidAmount}::numeric) ELSE 0 END), 0)`,
      overdueCount: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} = "overdue" THEN 1 END)`,
      totalCount: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false THEN 1 END)`,
      paidCount: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} = "paid" THEN 1 END)`,
      pendingCount: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} = "pending" THEN 1 END)`,
      partialCount: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} = "partial" THEN 1 END)`,
    })
    .from(paymentProjects)
    .leftJoin(paymentItems, eq(paymentItems.projectId, paymentProjects.id))
    .where(eq(paymentProjects.isDeleted, false))
    .groupBy(paymentProjects.id, paymentProjects.projectName, paymentProjects.projectType)
    .orderBy(paymentProjects.projectName)

    return projectStats.map(stat => {
      const totalAmount = parseFloat(stat.totalAmount)
      const paidAmount = parseFloat(stat.paidAmount)
      const completionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0

      return {
        projectId: stat.projectId,
        projectName: stat.projectName,
        projectType: stat.projectType,
        totalAmount: stat.totalAmount,
        paidAmount: stat.paidAmount,
        unpaidAmount: stat.unpaidAmount,
        overdueAmount: stat.overdueAmount,
        completionRate,
        counts: {
          total: stat.totalCount,
          paid: stat.paidCount,
          pending: stat.pendingCount,
          partial: stat.partialCount,
          overdue: stat.overdueCount,
        },
      }
    })
  } catch (error) {
    console.error("取得專案統計失敗:", error)
    throw error
  }
}
