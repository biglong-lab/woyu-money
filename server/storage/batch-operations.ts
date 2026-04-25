/**
 * 批量操作模組 (Batch Operations)
 * 提供付款項目的批量更新、匯入等功能
 */

import { db } from "../db"
import { paymentItems } from "@shared/schema"
import { eq, inArray } from "drizzle-orm"

/**
 * 批量更新付款項目
 * 支援：更新狀態、更新優先級、更新分類、封存、刪除
 */
/** 批量更新資料 */
interface BatchUpdateData {
  status?: string
  priority?: number
  categoryId?: number
}

/** 批量更新結果 */
interface BatchUpdateResult {
  success: boolean
  updatedCount: number
}

export async function batchUpdatePaymentItems(
  itemIds: number[],
  action: string,
  data: BatchUpdateData,
  userId: number
): Promise<BatchUpdateResult> {
  try {
    // itemIds 必須是非空陣列
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return { success: true, updatedCount: 0 }
    }

    // 用 drizzle 的 inArray() 自動序列化陣列為 PostgreSQL 陣列，
    // 取代易壞的 sql`id = ANY(${itemIds})`（不會自動序列化 JS array）
    const idsClause = inArray(paymentItems.id, itemIds)

    switch (action) {
      case "updateStatus":
        // 標記為已付清時，paidAmount 同步更新為 totalAmount，
        // 確保「待付總額」儀表板立即反映此次批量結算
        // 採兩步驟：先 fetch 得到每筆 totalAmount，再對每筆獨立 update
        // （避免 sql 模板字串在 esbuild 後與 drizzle 對 SET 子句的型別推論衝突）
        if (data.status === "paid") {
          const items = await db
            .select({ id: paymentItems.id, totalAmount: paymentItems.totalAmount })
            .from(paymentItems)
            .where(idsClause)

          for (const item of items) {
            await db
              .update(paymentItems)
              .set({
                status: "paid",
                paidAmount: item.totalAmount,
                updatedAt: new Date(),
              })
              .where(eq(paymentItems.id, item.id))
          }
        } else {
          await db
            .update(paymentItems)
            .set({ status: data.status, updatedAt: new Date() })
            .where(idsClause)
        }
        break
      case "updatePriority":
        await db
          .update(paymentItems)
          .set({ priority: data.priority, updatedAt: new Date() })
          .where(idsClause)
        break
      case "updateCategory":
        await db
          .update(paymentItems)
          .set({ categoryId: data.categoryId, updatedAt: new Date() })
          .where(idsClause)
        break
      case "archive":
        await db
          .update(paymentItems)
          .set({ isDeleted: true, deletedAt: new Date() })
          .where(idsClause)
        break
      case "delete":
        await db.delete(paymentItems).where(idsClause)
        break
    }

    return { success: true, updatedCount: itemIds.length }
  } catch (error) {
    console.error("批量更新失敗:", error)
    throw error
  }
}

/**
 * 批量匯入付款項目
 * 從檔案資料批量建立付款項目
 */
/** 匯入檔案項目 */
interface ImportFileItem {
  name?: string
  amount?: string | number
  date?: string
}

/** 批量匯入結果 */
interface BulkImportResult {
  total: number
  successful: number
  failed: number
  errors: string[]
}

export async function bulkImportPaymentItems(
  fileData: ImportFileItem[],
  projectId: number,
  userId: number
): Promise<BulkImportResult> {
  try {
    const importResults = {
      total: fileData.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const item of fileData) {
      try {
        await db.insert(paymentItems).values({
          itemName: item.name || "匯入項目",
          totalAmount: item.amount?.toString() || "0",
          projectId: projectId,
          status: "pending",
          startDate: item.date || new Date().toISOString(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        importResults.successful++
      } catch (error: unknown) {
        importResults.failed++
        const message = error instanceof Error ? error.message : String(error)
        importResults.errors.push(`項目 ${item.name}: ${message}`)
      }
    }

    return importResults
  } catch (error) {
    console.error("批量匯入失敗:", error)
    throw error
  }
}
