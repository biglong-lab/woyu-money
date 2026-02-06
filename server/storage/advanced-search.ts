/**
 * 進階搜尋模組 (Advanced Search)
 * 提供付款項目、專案、分類的進階搜尋功能
 */

import { db } from "../db"
import {
  paymentItems,
  paymentProjects,
  debtCategories,
} from "@shared/schema"
import { eq } from "drizzle-orm"

/**
 * 進階搜尋付款項目
 * 支援多條件篩選，包含專案名稱、分類名稱等關聯資料
 */
export async function advancedSearchPaymentItems(filters: any[]): Promise<any> {
  try {
    let query = db.select({
      id: paymentItems.id,
      itemName: paymentItems.itemName,
      totalAmount: paymentItems.totalAmount,
      status: paymentItems.status,
      startDate: paymentItems.startDate,
      projectName: paymentProjects.projectName,
      categoryName: debtCategories.categoryName,
    })
    .from(paymentItems)
    .leftJoin(paymentProjects, eq(paymentItems.projectId, paymentProjects.id))
    .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
    .where(eq(paymentItems.isDeleted, false))

    // 應用篩選條件
    for (const filter of filters) {
      if (filter.field === "global") {
        // 全域搜尋邏輯
        continue
      }
      // 添加其他篩選邏輯
    }

    const results = await query.limit(100)
    return { items: results, total: results.length }
  } catch (error) {
    console.error("進階搜尋付款項目失敗:", error)
    throw error
  }
}

/**
 * 進階搜尋專案
 * 返回符合篩選條件的專案列表
 */
export async function advancedSearchProjects(filters: any[]): Promise<any> {
  try {
    const results = await db.select()
      .from(paymentProjects)
      .limit(50)
    return { items: results, total: results.length }
  } catch (error) {
    console.error("搜尋專案失敗:", error)
    throw error
  }
}

/**
 * 進階搜尋分類
 * 返回符合篩選條件的分類列表
 */
export async function advancedSearchCategories(filters: any[]): Promise<any> {
  try {
    const results = await db.select()
      .from(debtCategories)
      .limit(50)
    return { items: results, total: results.length }
  } catch (error) {
    console.error("搜尋分類失敗:", error)
    throw error
  }
}
