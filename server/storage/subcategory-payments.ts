import { db } from "../db"
import {
  paymentItems,
  paymentRecords,
  paymentProjects,
  debtCategories,
  auditLogs,
  type PaymentItem,
} from "@shared/schema"
import { eq, and, sql, ne, desc } from "drizzle-orm"

// === 子分類付款狀態 ===

export async function getSubcategoryStatus(
  parentCategoryId: number,
  projectId?: number
): Promise<any[]> {
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1

  const categories = await db
    .select()
    .from(debtCategories)
    .where(eq(debtCategories.categoryType, "project"))

  const results = []

  for (const category of categories) {
    const [currentMonthResult] = await db
      .select({
        totalDue: sql<string>`COALESCE(SUM(total_amount::numeric), 0)`,
        totalPaid: sql<string>`COALESCE(SUM(paid_amount::numeric), 0)`,
        unpaidItems: sql<number>`COUNT(CASE WHEN status != 'paid' THEN 1 END)`,
      })
      .from(paymentItems)
      .where(
        and(
          eq(paymentItems.categoryId, category.id),
          eq(paymentItems.isDeleted, false),
          sql`EXTRACT(YEAR FROM start_date) = ${currentYear}`,
          sql`EXTRACT(MONTH FROM start_date) = ${currentMonth}`,
          ...(projectId ? [eq(paymentItems.projectId, projectId)] : [])
        )
      )

    const [accumulatedResult] = await db
      .select({
        totalUnpaid: sql<string>`COALESCE(SUM(total_amount::numeric - paid_amount::numeric), 0)`,
        overdueItems: sql<number>`COUNT(CASE WHEN status = 'overdue' THEN 1 END)`,
      })
      .from(paymentItems)
      .where(
        and(
          eq(paymentItems.categoryId, category.id),
          eq(paymentItems.isDeleted, false),
          sql`status != 'paid'`,
          ...(projectId ? [eq(paymentItems.projectId, projectId)] : [])
        )
      )

    const [installmentResult] = await db
      .select({
        totalInstallments: sql<number>`COUNT(*)`,
        completedInstallments: sql<number>`COUNT(CASE WHEN status = 'paid' THEN 1 END)`,
        nextDueDate: sql<string>`MIN(CASE WHEN status != 'paid' THEN start_date END)`,
      })
      .from(paymentItems)
      .where(
        and(
          eq(paymentItems.categoryId, category.id),
          eq(paymentItems.paymentType, "installment"),
          eq(paymentItems.isDeleted, false),
          ...(projectId ? [eq(paymentItems.projectId, projectId)] : [])
        )
      )

    const [remainingResult] = await db
      .select({
        remaining: sql<string>`COALESCE(SUM(total_amount::numeric - paid_amount::numeric), 0)`,
      })
      .from(paymentItems)
      .where(
        and(
          eq(paymentItems.categoryId, category.id),
          eq(paymentItems.isDeleted, false),
          sql`status != 'paid'`,
          ...(projectId ? [eq(paymentItems.projectId, projectId)] : [])
        )
      )

    results.push({
      subcategoryId: category.id,
      subcategoryName: category.categoryName,
      currentMonth: {
        totalDue: currentMonthResult?.totalDue || "0",
        totalPaid: currentMonthResult?.totalPaid || "0",
        unpaidItems: currentMonthResult?.unpaidItems || 0,
      },
      accumulated: {
        totalUnpaid: accumulatedResult?.totalUnpaid || "0",
        overdueItems: accumulatedResult?.overdueItems || 0,
      },
      installments: {
        totalInstallments: installmentResult?.totalInstallments || 0,
        completedInstallments: installmentResult?.completedInstallments || 0,
        nextDueDate: installmentResult?.nextDueDate || undefined,
      },
      remainingAmount: remainingResult?.remaining || "0",
    })
  }

  return results
}

// === 子分類付款優先順序 ===

export async function getSubcategoryPaymentPriority(subcategoryId: number): Promise<PaymentItem[]> {
  return await db
    .select({
      id: paymentItems.id,
      categoryId: paymentItems.categoryId,
      fixedCategoryId: paymentItems.fixedCategoryId,
      fixedSubOptionId: paymentItems.fixedSubOptionId,
      projectId: paymentItems.projectId,
      itemName: paymentItems.itemName,
      totalAmount: paymentItems.totalAmount,
      itemType: paymentItems.itemType,
      paymentType: paymentItems.paymentType,
      startDate: paymentItems.startDate,
      endDate: paymentItems.endDate,
      paidAmount: paymentItems.paidAmount,
      status: paymentItems.status,
      priority: paymentItems.priority,
      notes: paymentItems.notes,
      isDeleted: paymentItems.isDeleted,
      createdAt: paymentItems.createdAt,
      updatedAt: paymentItems.updatedAt,
    })
    .from(paymentItems)
    .where(and(eq(paymentItems.categoryId, subcategoryId), eq(paymentItems.isDeleted, false), sql`status != 'paid'`))
    .orderBy(
      sql`CASE
        WHEN status = 'overdue' THEN 1
        WHEN DATE(start_date) <= CURRENT_DATE THEN 2
        ELSE 3
      END`,
      paymentItems.startDate
    )
}

// === 子分類統一付款 ===

export async function processSubcategoryPayment(
  subcategoryId: number,
  amount: string,
  paymentDate: string,
  userInfo?: string
): Promise<{
  allocatedPayments: Array<{
    itemId: number
    itemName: string
    allocatedAmount: string
    isFullyPaid: boolean
  }>
  remainingAmount: string
}> {
  const paymentAmount = parseFloat(amount)
  let remainingPayment = paymentAmount
  const allocatedPayments = []

  const priorityItems = await getSubcategoryPaymentPriority(subcategoryId)

  for (const item of priorityItems) {
    if (remainingPayment <= 0) break

    const totalAmount = parseFloat(item.totalAmount || "0")
    const paidAmount = parseFloat(item.paidAmount ?? "0")
    const needToPay = totalAmount - paidAmount

    if (needToPay <= 0) continue

    const allocatedAmount = Math.min(remainingPayment, needToPay)
    const newPaidAmount = paidAmount + allocatedAmount
    const isFullyPaid = newPaidAmount >= totalAmount

    await db
      .update(paymentItems)
      .set({
        paidAmount: newPaidAmount.toFixed(2),
        status: isFullyPaid ? "paid" : "partial",
        updatedAt: new Date(),
      })
      .where(eq(paymentItems.id, item.id))

    await db.insert(paymentRecords).values({
      itemId: item.id,
      amount: allocatedAmount.toFixed(2),
      paymentDate: paymentDate,
      paymentMethod: "subcategory_allocation",
      notes: `子分類統一付款分配 - ${item.itemName}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await db.insert(auditLogs).values({
      tableName: "payment_items",
      recordId: item.id,
      action: "UPDATE",
      oldValues: { paidAmount: paidAmount.toFixed(2), status: item.status },
      newValues: { paidAmount: newPaidAmount.toFixed(2), status: isFullyPaid ? "paid" : "partial" },
      changedFields: ["paidAmount", "status"],
      userInfo: userInfo || "系統自動分配",
      changeReason: `子分類統一付款，分配金額：${allocatedAmount.toFixed(2)}`,
    })

    allocatedPayments.push({
      itemId: item.id,
      itemName: item.itemName,
      allocatedAmount: allocatedAmount.toFixed(2),
      isFullyPaid,
    })

    remainingPayment -= allocatedAmount
  }

  return {
    allocatedPayments,
    remainingAmount: remainingPayment.toFixed(2),
  }
}

// === 統一付款管理 ===

export async function getUnifiedPaymentData(
  projectId?: number,
  categoryId?: number
): Promise<{
  items: PaymentItem[]
  totalAmount: number
  overdueAmount: number
  currentMonthAmount: number
  futureAmount: number
}> {
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1

  const conditions = [eq(paymentItems.isDeleted, false), ne(paymentItems.status, "paid")]

  if (projectId) {
    conditions.push(eq(paymentItems.projectId, projectId))
  }

  if (categoryId) {
    conditions.push(eq(paymentItems.categoryId, categoryId))
  }

  const items = await db
    .select()
    .from(paymentItems)
    .where(and(...conditions))
    .orderBy(paymentItems.startDate)

  let totalAmount = 0
  let overdueAmount = 0
  let currentMonthAmount = 0
  let futureAmount = 0

  for (const item of items) {
    const remaining = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0")
    totalAmount += remaining

    const itemDate = new Date(item.startDate)
    const itemYear = itemDate.getFullYear()
    const itemMonth = itemDate.getMonth() + 1

    if (itemYear < currentYear || (itemYear === currentYear && itemMonth < currentMonth)) {
      overdueAmount += remaining
    } else if (itemYear === currentYear && itemMonth === currentMonth) {
      currentMonthAmount += remaining
    } else {
      futureAmount += remaining
    }
  }

  return {
    items,
    totalAmount,
    overdueAmount,
    currentMonthAmount,
    futureAmount,
  }
}

export async function executeUnifiedPayment(
  amount: number,
  projectId?: number,
  categoryId?: number,
  notes?: string,
  userInfo?: string
): Promise<{
  allocatedPayments: Array<{
    itemId: number
    itemName: string
    allocatedAmount: number
    isFullyPaid: boolean
  }>
  remainingAmount: number
}> {
  let remainingPayment = amount
  const allocatedPayments = []

  const conditions = [eq(paymentItems.isDeleted, false), ne(paymentItems.status, "paid")]

  if (projectId) {
    conditions.push(eq(paymentItems.projectId, projectId))
  }

  if (categoryId) {
    conditions.push(eq(paymentItems.categoryId, categoryId))
  }

  const priorityItems = await db
    .select()
    .from(paymentItems)
    .where(and(...conditions))
    .orderBy(
      sql`CASE
        WHEN status = 'overdue' THEN 1
        WHEN DATE(start_date) <= CURRENT_DATE THEN 2
        ELSE 3
      END`,
      paymentItems.startDate
    )

  for (const item of priorityItems) {
    if (remainingPayment <= 0) break

    const totalAmount = parseFloat(item.totalAmount)
    const paidAmount = parseFloat(item.paidAmount || "0")
    const needToPay = totalAmount - paidAmount

    if (needToPay <= 0) continue

    const allocatedAmount = Math.min(remainingPayment, needToPay)
    const newPaidAmount = paidAmount + allocatedAmount
    const isFullyPaid = newPaidAmount >= totalAmount

    await db
      .update(paymentItems)
      .set({
        paidAmount: newPaidAmount.toFixed(2),
        status: isFullyPaid ? "paid" : "partial",
        updatedAt: new Date(),
      })
      .where(eq(paymentItems.id, item.id))

    await db.insert(paymentRecords).values({
      itemId: item.id,
      amount: allocatedAmount.toFixed(2),
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "unified_payment",
      notes: notes || `統一付款分配 - ${item.itemName}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await db.insert(auditLogs).values({
      tableName: "payment_items",
      recordId: item.id,
      action: "UPDATE",
      oldValues: { paidAmount: paidAmount.toFixed(2), status: item.status },
      newValues: { paidAmount: newPaidAmount.toFixed(2), status: isFullyPaid ? "paid" : "partial" },
      changedFields: ["paidAmount", "status"],
      userInfo: userInfo || "統一付款系統",
      changeReason: `統一付款分配，金額：${allocatedAmount.toFixed(2)}`,
    })

    allocatedPayments.push({
      itemId: item.id,
      itemName: item.itemName,
      allocatedAmount,
      isFullyPaid,
    })

    remainingPayment -= allocatedAmount
  }

  return {
    allocatedPayments,
    remainingAmount: remainingPayment,
  }
}

// === 專案統計 ===

export async function getProjectsWithStats(): Promise<any[]> {
  try {
    const projectStats = await db
      .select({
        projectId: paymentProjects.id,
        projectName: paymentProjects.projectName,
        projectType: paymentProjects.projectType,
        totalAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentItems.isDeleted} = false THEN ${paymentItems.totalAmount}::numeric ELSE 0 END), 0)`,
        paidAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentItems.isDeleted} = false THEN ${paymentItems.paidAmount}::numeric ELSE 0 END), 0)`,
        unpaidAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} != 'paid' THEN (${paymentItems.totalAmount}::numeric - ${paymentItems.paidAmount}::numeric) ELSE 0 END), 0)`,
        overdueAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} = 'overdue' THEN (${paymentItems.totalAmount}::numeric - ${paymentItems.paidAmount}::numeric) ELSE 0 END), 0)`,
        overdueCount: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} = 'overdue' THEN 1 END)`,
        totalCount: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false THEN 1 END)`,
        paidCount: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} = 'paid' THEN 1 END)`,
        pendingCount: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} = 'pending' THEN 1 END)`,
        partialCount: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} = 'partial' THEN 1 END)`,
      })
      .from(paymentProjects)
      .leftJoin(paymentItems, eq(paymentItems.projectId, paymentProjects.id))
      .where(eq(paymentProjects.isDeleted, false))
      .groupBy(paymentProjects.id, paymentProjects.projectName, paymentProjects.projectType)
      .orderBy(paymentProjects.projectName)

    return projectStats.map((stat) => {
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
    console.error("Error fetching projects with stats:", error)
    throw error
  }
}
