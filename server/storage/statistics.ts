import { db } from "../db"
import {
  paymentItems,
  paymentRecords,
  paymentProjects,
  debtCategories,
  auditLogs,
  type PaymentItem,
  type InsertPaymentItem,
} from "@shared/schema"
import { eq, and, sql, desc, gte, lte, lt, count, ne, or, isNull, isNotNull } from "drizzle-orm"

// === 付款統計 ===

export async function getPaymentHomeStats(): Promise<any> {
  const [stats] = await db
    .select({
      totalPlanned: sql<number>`COALESCE(SUM(CASE WHEN item_type = 'home' THEN total_amount::numeric ELSE 0 END), 0)`,
      totalPaid: sql<number>`COALESCE(SUM(CASE WHEN item_type = 'home' THEN paid_amount::numeric ELSE 0 END), 0)`,
      pendingItems: sql<number>`COUNT(CASE WHEN item_type = 'home' AND status = 'pending' THEN 1 END)`,
      overdueItems: sql<number>`COUNT(CASE WHEN item_type = 'home' AND status = 'overdue' THEN 1 END)`,
    })
    .from(paymentItems)
    .where(eq(paymentItems.isDeleted, false))

  return stats || { totalPlanned: 0, totalPaid: 0, pendingItems: 0, overdueItems: 0 }
}

export async function getPaymentProjectStats(): Promise<any> {
  const [stats] = await db
    .select({
      totalPlanned: sql<number>`COALESCE(SUM(CASE WHEN item_type = 'project' THEN total_amount::numeric ELSE 0 END), 0)`,
      totalPaid: sql<number>`COALESCE(SUM(CASE WHEN item_type = 'project' THEN paid_amount::numeric ELSE 0 END), 0)`,
      pendingItems: sql<number>`COUNT(CASE WHEN item_type = 'project' AND status = 'pending' THEN 1 END)`,
      overdueItems: sql<number>`COUNT(CASE WHEN item_type = 'project' AND status = 'overdue' THEN 1 END)`,
    })
    .from(paymentItems)
    .where(eq(paymentItems.isDeleted, false))

  return stats || { totalPlanned: 0, totalPaid: 0, pendingItems: 0, overdueItems: 0 }
}

export async function getMonthlyPaymentTrend(): Promise<any> {
  return await db
    .select({
      month: sql<string>`TO_CHAR(payment_date, 'YYYY-MM')`,
      paid: sql<number>`COALESCE(SUM(amount_paid::numeric), 0)`,
    })
    .from(paymentRecords)
    .groupBy(sql`TO_CHAR(payment_date, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(payment_date, 'YYYY-MM')`)
}

export async function getTopPaymentCategories(): Promise<any> {
  return await db
    .select({
      categoryName: debtCategories.categoryName,
      totalAmount: sql<number>`COALESCE(SUM(${paymentItems.totalAmount}::numeric), 0)`,
    })
    .from(paymentItems)
    .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
    .where(eq(paymentItems.isDeleted, false))
    .groupBy(debtCategories.categoryName)
    .orderBy(sql`COALESCE(SUM(${paymentItems.totalAmount}::numeric), 0) DESC`)
    .limit(5)
}

export async function getPaymentMethodsReport(): Promise<any> {
  return await db
    .select({
      name: paymentRecords.paymentMethod,
      count: sql<number>`COUNT(*)`,
      total: sql<number>`COALESCE(SUM(amount_paid::numeric), 0)`,
    })
    .from(paymentRecords)
    .groupBy(paymentRecords.paymentMethod)
    .orderBy(sql`COUNT(*) DESC`)
}

export async function getPaymentStatistics(_filters: any): Promise<any> {
  return {}
}

export async function getPaymentOverview(): Promise<any> {
  return {}
}

// === 分頁查詢 ===

export async function getPaginatedPaymentItems(page: number = 1, pageSize: number = 50, filters: any = {}): Promise<any> {
  const offset = (page - 1) * pageSize

  const conditions = []
  if (filters.projectId) {
    conditions.push(eq(paymentItems.projectId, filters.projectId))
  }
  if (filters.status) {
    conditions.push(eq(paymentItems.status, filters.status))
  }
  if (!filters.includeDeleted) {
    conditions.push(eq(paymentItems.isDeleted, false))
  }
  if (filters.startDate) {
    conditions.push(gte(paymentItems.startDate, filters.startDate))
  }
  if (filters.endDate) {
    conditions.push(lte(paymentItems.startDate, filters.endDate))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const items = await db
    .select({
      id: paymentItems.id,
      categoryId: paymentItems.categoryId,
      projectId: paymentItems.projectId,
      itemName: paymentItems.itemName,
      totalAmount: paymentItems.totalAmount,
      paidAmount: paymentItems.paidAmount,
      status: paymentItems.status,
      paymentType: paymentItems.paymentType,
      startDate: paymentItems.startDate,
      endDate: paymentItems.endDate,
      priority: paymentItems.priority,
      notes: paymentItems.notes,
      isDeleted: paymentItems.isDeleted,
      createdAt: paymentItems.createdAt,
      updatedAt: paymentItems.updatedAt,
      categoryName: debtCategories.categoryName,
      projectName: paymentProjects.projectName,
    })
    .from(paymentItems)
    .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
    .leftJoin(paymentProjects, eq(paymentItems.projectId, paymentProjects.id))
    .where(whereClause)
    .orderBy(desc(paymentItems.createdAt))
    .limit(pageSize)
    .offset(offset)

  const [{ count: totalCount }] = await db.select({ count: count() }).from(paymentItems).where(whereClause)

  return {
    items,
    pagination: {
      currentPage: page,
      pageSize,
      totalItems: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      hasNextPage: page * pageSize < totalCount,
      hasPreviousPage: page > 1,
    },
  }
}

// === 批量操作 ===

export async function bulkUpdatePaymentItems(
  itemIds: number[],
  updates: Partial<InsertPaymentItem>,
  userInfo = "系統管理員"
): Promise<void> {
  await db.transaction(async (tx) => {
    const oldItems = await tx
      .select()
      .from(paymentItems)
      .where(sql`id = ANY(${itemIds})`)

    await tx
      .update(paymentItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(sql`id = ANY(${itemIds})`)

    for (const oldItem of oldItems) {
      await tx.insert(auditLogs).values({
        tableName: "payment_items",
        recordId: oldItem.id,
        action: "UPDATE",
        oldValues: oldItem,
        newValues: { ...oldItem, ...updates },
        changedFields: Object.keys(updates),
        userInfo,
        changeReason: "批量更新",
      })
    }
  })
}

// === 日期範圍摘要 ===

export async function getPaymentSummaryByDateRange(startDate: string, endDate: string): Promise<any> {
  return await db
    .select({
      status: paymentItems.status,
      count: count(),
      totalAmount: sql<string>`SUM(CAST(${paymentItems.totalAmount} AS DECIMAL))`,
      paidAmount: sql<string>`SUM(CAST(${paymentItems.paidAmount} AS DECIMAL))`,
    })
    .from(paymentItems)
    .where(
      and(gte(paymentItems.startDate, startDate), lte(paymentItems.startDate, endDate), eq(paymentItems.isDeleted, false))
    )
    .groupBy(paymentItems.status)
}

// === 月度付款分析 ===

export async function getMonthlyPaymentAnalysis(year: number, month: number): Promise<any> {
  const currentMonthStart = `${year}-${month.toString().padStart(2, "0")}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const currentMonthEnd = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`

  const currentMonthDue = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalAmount: sql<string>`SUM(${paymentItems.totalAmount} - ${paymentItems.paidAmount})`,
    })
    .from(paymentItems)
    .where(
      sql`${paymentItems.isDeleted} = false
        AND ${paymentItems.status} != 'paid'
        AND ${paymentItems.startDate} >= ${currentMonthStart}
        AND ${paymentItems.startDate} < ${currentMonthEnd}`
    )

  const currentMonthPaid = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalAmount: sql<string>`SUM(${paymentItems.paidAmount})`,
    })
    .from(paymentItems)
    .where(
      sql`${paymentItems.isDeleted} = false
        AND ${paymentItems.status} = 'paid'
        AND ${paymentItems.startDate} >= ${currentMonthStart}
        AND ${paymentItems.startDate} < ${currentMonthEnd}`
    )

  const overduePendingItems = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalAmount: sql<string>`SUM(${paymentItems.totalAmount} - ${paymentItems.paidAmount})`,
    })
    .from(paymentItems)
    .where(
      sql`${paymentItems.isDeleted} = false
        AND ${paymentItems.status} != 'paid'
        AND ${paymentItems.startDate} < ${currentMonthStart}`
    )

  const currentMonthDueDetails = await db
    .select({
      id: paymentItems.id,
      itemName: paymentItems.itemName,
      totalAmount: paymentItems.totalAmount,
      paidAmount: paymentItems.paidAmount,
      remainingAmount: sql<string>`${paymentItems.totalAmount} - ${paymentItems.paidAmount}`,
      startDate: paymentItems.startDate,
      projectName: paymentProjects.projectName,
      categoryName: debtCategories.categoryName,
      status: paymentItems.status,
    })
    .from(paymentItems)
    .leftJoin(paymentProjects, eq(paymentItems.projectId, paymentProjects.id))
    .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
    .where(
      sql`${paymentItems.isDeleted} = false
        AND ${paymentItems.status} != 'paid'
        AND ${paymentItems.startDate} >= ${currentMonthStart}
        AND ${paymentItems.startDate} < ${currentMonthEnd}`
    )
    .orderBy(paymentItems.startDate)

  const overdueDetails = await db
    .select({
      id: paymentItems.id,
      itemName: paymentItems.itemName,
      totalAmount: paymentItems.totalAmount,
      paidAmount: paymentItems.paidAmount,
      remainingAmount: sql<string>`${paymentItems.totalAmount} - ${paymentItems.paidAmount}`,
      startDate: paymentItems.startDate,
      projectName: paymentProjects.projectName,
      categoryName: debtCategories.categoryName,
      status: paymentItems.status,
    })
    .from(paymentItems)
    .leftJoin(paymentProjects, eq(paymentItems.projectId, paymentProjects.id))
    .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
    .where(
      sql`${paymentItems.isDeleted} = false
        AND ${paymentItems.status} != 'paid'
        AND ${paymentItems.startDate} < ${currentMonthStart}`
    )
    .orderBy(paymentItems.startDate)

  return {
    currentMonth: {
      year,
      month,
      due: {
        count: currentMonthDue[0]?.count || 0,
        totalAmount: currentMonthDue[0]?.totalAmount || "0",
        items: currentMonthDueDetails,
      },
      paid: {
        count: currentMonthPaid[0]?.count || 0,
        totalAmount: currentMonthPaid[0]?.totalAmount || "0",
      },
    },
    overdue: {
      count: overduePendingItems[0]?.count || 0,
      totalAmount: overduePendingItems[0]?.totalAmount || "0",
      items: overdueDetails,
    },
  }
}

// === 逾期項目查詢 ===

export async function getOverduePaymentItems(): Promise<any[]> {
  try {
    const today = new Date().toISOString().split("T")[0]
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]

    const result = await db
      .select({
        id: paymentItems.id,
        itemName: paymentItems.itemName,
        totalAmount: paymentItems.totalAmount,
        priority: paymentItems.priority,
        status: paymentItems.status,
        startDate: paymentItems.startDate,
        endDate: paymentItems.endDate,
        dueDate: paymentItems.endDate,
        paidAmount: paymentItems.paidAmount,
        description: sql<string>`
          CASE
            WHEN ${paymentItems.notes} IS NOT NULL AND ${paymentItems.notes} != ''
            THEN ${paymentItems.notes}
            ELSE NULL
          END
        `,
        categoryName: sql<string>`
          CASE
            WHEN ${paymentItems.categoryId} IS NOT NULL
            THEN (SELECT category_name FROM debt_categories WHERE id = ${paymentItems.categoryId})
            WHEN ${paymentItems.fixedCategoryId} IS NOT NULL
            THEN (SELECT category_name FROM fixed_categories WHERE id = ${paymentItems.fixedCategoryId})
            ELSE '未分類'
          END
        `,
        projectName: sql<string>`
          CASE
            WHEN ${paymentItems.projectId} IS NOT NULL
            THEN (SELECT project_name FROM payment_projects WHERE id = ${paymentItems.projectId})
            ELSE '預設專案'
          END
        `,
        isCurrentMonthOverdue: sql<boolean>`
          CASE
            WHEN COALESCE(${paymentItems.endDate}, ${paymentItems.startDate}) >= ${currentMonthStart}
                 AND COALESCE(${paymentItems.endDate}, ${paymentItems.startDate}) < ${today}
            THEN true
            ELSE false
          END
        `,
        isPreviousMonthsOverdue: sql<boolean>`
          CASE
            WHEN COALESCE(${paymentItems.endDate}, ${paymentItems.startDate}) < ${currentMonthStart}
            THEN true
            ELSE false
          END
        `,
      })
      .from(paymentItems)
      .leftJoin(
        sql`(
          SELECT payment_item_id, COALESCE(SUM(CAST(scheduled_amount AS DECIMAL)), 0) as total_scheduled
          FROM payment_schedules
          GROUP BY payment_item_id
        ) scheduled_summary`,
        sql`payment_items.id = scheduled_summary.payment_item_id`
      )
      .where(
        and(
          ne(paymentItems.status, "paid"),
          eq(paymentItems.isDeleted, false),
          or(
            sql`scheduled_summary.payment_item_id IS NULL`,
            sql`scheduled_summary.total_scheduled < CAST(payment_items.total_amount AS DECIMAL)`
          ),
          or(
            and(isNotNull(paymentItems.endDate), lt(paymentItems.endDate, today)),
            and(isNull(paymentItems.endDate), isNotNull(paymentItems.startDate), lt(paymentItems.startDate, today))
          ),
          or(isNull(paymentItems.paidAmount), lt(paymentItems.paidAmount, paymentItems.totalAmount))
        )
      )
      .orderBy(paymentItems.endDate)

    return result
  } catch (error) {
    console.error("Error in getOverduePaymentItems:", error)
    throw error
  }
}
