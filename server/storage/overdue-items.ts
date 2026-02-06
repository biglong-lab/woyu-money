/**
 * 逾期項目模組 (Overdue Items)
 * 提供逾期付款項目的查詢功能
 */

import { db } from "../db"
import { paymentItems } from "@shared/schema"
import {
  and,
  ne,
  or,
  sql,
  lt,
  isNull,
  isNotNull,
  eq,
} from "drizzle-orm"

/**
 * 查詢所有逾期付款項目
 * 區分本月逾期與前月逾期，排除已完全排程的項目
 */
export async function getOverduePaymentItems() {
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
          // 只排除完全排程的項目
          or(
            sql`scheduled_summary.payment_item_id IS NULL`,
            sql`scheduled_summary.total_scheduled < CAST(payment_items.total_amount AS DECIMAL)`
          ),
          or(
            // 有明確結束日期且已逾期
            and(
              isNotNull(paymentItems.endDate),
              lt(paymentItems.endDate, today)
            ),
            // 沒有結束日期但有開始日期且已逾期
            and(
              isNull(paymentItems.endDate),
              isNotNull(paymentItems.startDate),
              lt(paymentItems.startDate, today)
            )
          ),
          // 確保未完全付款
          or(
            isNull(paymentItems.paidAmount),
            lt(paymentItems.paidAmount, paymentItems.totalAmount)
          )
        )
      )
      .orderBy(paymentItems.endDate)

    return result
  } catch (error) {
    console.error("getOverduePaymentItems 失敗:", error)
    throw error
  }
}
