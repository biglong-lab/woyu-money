/**
 * 智慧提醒模組 (Smart Alerts)
 * 提供借貸風險評估、到期提醒、逾期通知等功能
 */

import { db } from "../db"
import { loanInvestmentRecords } from "@shared/schema"
import { eq, and, sql } from "drizzle-orm"

// 嚴重程度排序對照表
const severityOrder: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

/**
 * 產生智慧提醒列表
 * 包含：高風險借貸、即將到期、已逾期三種類型的提醒
 */
export async function getSmartAlerts(): Promise<any[]> {
  try {
    const alerts: any[] = []
    const currentDate = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(currentDate.getDate() + 30)

    // 1. 高風險借貸提醒（年利率 >= 15%）
    const highRiskLoans = await db
      .select()
      .from(loanInvestmentRecords)
      .where(
        and(
          sql`${loanInvestmentRecords.annualInterestRate} >= 15`,
          eq(loanInvestmentRecords.status, "active")
        )
      )

    for (const loan of highRiskLoans) {
      alerts.push({
        id: `risk_${loan.id}`,
        type: "risk",
        title: "高風險借貸提醒",
        message: `借貸項目「${loan.itemName}」年利率達${loan.annualInterestRate}%，建議優先處理`,
        severity:
          parseFloat(loan.annualInterestRate) >= 20 ? "critical" : "high",
        entityId: loan.id,
        entityType: "loan",
        amount: loan.principalAmount,
        interestRate: parseFloat(loan.annualInterestRate),
        isRead: false,
        createdAt: (loan.createdAt || new Date()).toISOString(),
      })
    }

    // 2. 即將到期提醒（30 天內）
    const dueSoonLoans = await db
      .select()
      .from(loanInvestmentRecords)
      .where(
        and(
          sql`${loanInvestmentRecords.endDate} <= ${thirtyDaysFromNow.toISOString().split("T")[0]}`,
          sql`${loanInvestmentRecords.endDate} >= ${currentDate.toISOString().split("T")[0]}`,
          eq(loanInvestmentRecords.status, "active")
        )
      )

    for (const loan of dueSoonLoans) {
      const daysUntilDue = Math.ceil(
        (new Date(loan.endDate!).getTime() - currentDate.getTime()) /
          (1000 * 60 * 60 * 24)
      )
      alerts.push({
        id: `due_${loan.id}`,
        type: "due_soon",
        title: "借貸即將到期",
        message: `借貸項目「${loan.itemName}」將在${daysUntilDue}天後到期`,
        severity: daysUntilDue <= 7 ? "high" : "medium",
        entityId: loan.id,
        entityType: "loan",
        amount: loan.principalAmount,
        dueDate: loan.endDate,
        isRead: false,
        createdAt: (loan.createdAt || new Date()).toISOString(),
      })
    }

    // 3. 逾期提醒
    const overdueLoans = await db
      .select()
      .from(loanInvestmentRecords)
      .where(
        and(
          sql`${loanInvestmentRecords.endDate} < ${currentDate.toISOString().split("T")[0]}`,
          eq(loanInvestmentRecords.status, "active")
        )
      )

    for (const loan of overdueLoans) {
      const daysOverdue = Math.ceil(
        (currentDate.getTime() - new Date(loan.endDate!).getTime()) /
          (1000 * 60 * 60 * 24)
      )
      alerts.push({
        id: `overdue_${loan.id}`,
        type: "overdue",
        title: "借貸已逾期",
        message: `借貸項目「${loan.itemName}」已逾期${daysOverdue}天，需立即處理`,
        severity: "critical",
        entityId: loan.id,
        entityType: "loan",
        amount: loan.principalAmount,
        dueDate: loan.endDate,
        isRead: false,
        createdAt: (loan.createdAt || new Date()).toISOString(),
      })
    }

    // 按嚴重程度和建立日期排序
    return alerts.sort((a, b) => {
      const severityDiff =
        (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
      if (severityDiff !== 0) return severityDiff
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    })
  } catch (error) {
    console.error("產生智慧提醒失敗:", error)
    throw error
  }
}

/**
 * 取得智慧提醒統計
 * 返回高風險借貸數、即將到期數、逾期數及相關金額
 */
export async function getSmartAlertStats(): Promise<any> {
  try {
    const currentDate = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(currentDate.getDate() + 30)

    // 高風險借貸數量
    const highRiskCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(loanInvestmentRecords)
      .where(
        and(
          sql`${loanInvestmentRecords.annualInterestRate} >= 15`,
          eq(loanInvestmentRecords.status, "active")
        )
      )

    // 即將到期數量
    const dueSoonCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(loanInvestmentRecords)
      .where(
        and(
          sql`${loanInvestmentRecords.endDate} <= ${thirtyDaysFromNow.toISOString().split("T")[0]}`,
          sql`${loanInvestmentRecords.endDate} >= ${currentDate.toISOString().split("T")[0]}`,
          eq(loanInvestmentRecords.status, "active")
        )
      )

    // 逾期數量
    const overdueCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(loanInvestmentRecords)
      .where(
        and(
          sql`${loanInvestmentRecords.endDate} < ${currentDate.toISOString().split("T")[0]}`,
          eq(loanInvestmentRecords.status, "active")
        )
      )

    // 即將到期金額
    const dueSoonAmount = await db
      .select({
        total: sql<string>`COALESCE(SUM(${loanInvestmentRecords.principalAmount}::numeric), 0)`,
      })
      .from(loanInvestmentRecords)
      .where(
        and(
          sql`${loanInvestmentRecords.endDate} <= ${thirtyDaysFromNow.toISOString().split("T")[0]}`,
          sql`${loanInvestmentRecords.endDate} >= ${currentDate.toISOString().split("T")[0]}`,
          eq(loanInvestmentRecords.status, "active")
        )
      )

    // 逾期金額
    const overdueAmount = await db
      .select({
        total: sql<string>`COALESCE(SUM(${loanInvestmentRecords.principalAmount}::numeric), 0)`,
      })
      .from(loanInvestmentRecords)
      .where(
        and(
          sql`${loanInvestmentRecords.endDate} < ${currentDate.toISOString().split("T")[0]}`,
          eq(loanInvestmentRecords.status, "active")
        )
      )

    const totalAlerts =
      (highRiskCount[0]?.count || 0) +
      (dueSoonCount[0]?.count || 0) +
      (overdueCount[0]?.count || 0)

    const criticalAlerts = overdueCount[0]?.count || 0

    return {
      totalAlerts,
      criticalAlerts,
      highRiskLoans: highRiskCount[0]?.count || 0,
      dueSoonAmount: dueSoonAmount[0]?.total || "0",
      overdueAmount: overdueAmount[0]?.total || "0",
    }
  } catch (error) {
    console.error("取得智慧提醒統計失敗:", error)
    throw error
  }
}

/**
 * 關閉智慧提醒
 * 目前僅記錄操作，未來可擴充為持久化狀態
 */
export async function dismissSmartAlert(alertId: string): Promise<void> {
  try {
    // 目前僅記錄，未來可擴充為持久化狀態
    console.log(`Alert ${alertId} dismissed`)
  } catch (error) {
    console.error("關閉智慧提醒失敗:", error)
    throw error
  }
}
