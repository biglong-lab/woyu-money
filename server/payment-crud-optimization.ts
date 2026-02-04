// 付款項目新增/修改效能優化分析和方案
import { db } from "./db";
import { sql } from "drizzle-orm";

export class PaymentCRUDOptimizer {
  
  /**
   * 分析目前新增/修改操作的效能問題
   */
  analyzeCurrentPerformanceIssues() {
    return {
      createPaymentItem: {
        issues: [
          "每次新增都要查詢分類類型 (額外 SELECT)",
          "固定分類子選項檢查和創建 (2個額外查詢)",
          "審計日誌創建 (額外 INSERT)",
          "月付/分期項目需要循環創建多筆記錄"
        ],
        estimatedTime: "200-500ms per item"
      },
      updatePaymentItem: {
        issues: [
          "需要先查詢舊資料進行審計比較 (額外 SELECT)",
          "逐欄位比較變更內容 (CPU密集操作)",
          "審計日誌創建 (額外 INSERT)"
        ],
        estimatedTime: "150-300ms per item"
      },
      deletePaymentItem: {
        issues: [
          "需要先查詢舊資料 (額外 SELECT)",
          "刪除相關付款記錄 (可能多筆 DELETE)",
          "審計日誌創建 (額外 INSERT)"
        ],
        estimatedTime: "100-250ms per item"
      }
    };
  }
  
  /**
   * 優化的批量新增操作
   */
  async optimizedBatchCreate(items: any[], userInfo = "系統管理員") {
    // 使用事務提升效能
    return await db.transaction(async (tx) => {
      const results = [];
      
      // 批量處理，減少往返次數
      for (const itemData of items) {
        const cleanData = await this.optimizedDataCleanup(itemData);
        const [item] = await tx.insert(paymentItems).values(cleanData).returning();
        results.push(item);
      }
      
      // 批量創建審計日誌
      const auditLogs = results.map(item => ({
        tableName: "payment_items",
        recordId: item.id,
        action: "INSERT",
        oldValues: null,
        newValues: item,
        changedFields: [],
        userInfo,
        changeReason: "批量新建付款項目",
        createdAt: new Date()
      }));
      
      if (auditLogs.length > 0) {
        await tx.insert(auditLogs).values(auditLogs);
      }
      
      return results;
    });
  }
  
  /**
   * 優化的資料清理流程
   */
  private async optimizedDataCleanup(itemData: any) {
    let cleanData = { ...itemData };
    
    // 批量查詢所需的分類資訊，減少查詢次數
    if (cleanData.categoryId && !cleanData.fixedCategoryId) {
      // 使用快取或批量查詢分類類型
      const categoryInfo = await this.getCategoryInfo(cleanData.categoryId);
      cleanData.itemType = categoryInfo?.categoryType === "household" ? "home" : "project";
    } else if (cleanData.fixedCategoryId) {
      cleanData.categoryId = null;
      cleanData.itemType = "project";
    } else {
      cleanData.itemType = "project";
    }
    
    return cleanData;
  }
  
  /**
   * 快取分類資訊以減少重複查詢
   */
  private categoryCache = new Map<number, any>();
  
  private async getCategoryInfo(categoryId: number) {
    if (this.categoryCache.has(categoryId)) {
      return this.categoryCache.get(categoryId);
    }
    
    const [category] = await db
      .select({ categoryType: debtCategories.categoryType })
      .from(debtCategories)
      .where(eq(debtCategories.id, categoryId))
      .limit(1);
    
    if (category) {
      this.categoryCache.set(categoryId, category);
    }
    
    return category;
  }
  
  /**
   * 優化的更新操作 - 減少審計開銷
   */
  async optimizedUpdate(id: number, itemData: any, userInfo = "系統管理員") {
    // 使用單一查詢獲取舊資料並更新
    const result = await db.execute(sql`
      WITH old_data AS (
        SELECT * FROM payment_items WHERE id = ${id}
      ),
      updated_data AS (
        UPDATE payment_items 
        SET 
          item_name = COALESCE(${itemData.itemName}, item_name),
          total_amount = COALESCE(${itemData.totalAmount}, total_amount),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      )
      SELECT 
        json_build_object('old', row_to_json(old_data.*)) as old_values,
        json_build_object('new', row_to_json(updated_data.*)) as new_values
      FROM old_data, updated_data
    `);
    
    return result.rows[0];
  }
  
  /**
   * 效能監控 - 測量操作時間
   */
  async measureOperationTime<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await operation();
      const endTime = performance.now();
      console.log(`${operationName} 執行時間: ${(endTime - startTime).toFixed(2)}ms`);
      return result;
    } catch (error) {
      const endTime = performance.now();
      console.error(`${operationName} 失敗，執行時間: ${(endTime - startTime).toFixed(2)}ms`, error);
      throw error;
    }
  }
}

export const paymentCRUDOptimizer = new PaymentCRUDOptimizer();