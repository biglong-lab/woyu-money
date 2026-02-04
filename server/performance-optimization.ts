// 高效能付款管理系統優化方案
// 針對大量數據記錄的架構優化

import { db } from "./db";
import { sql } from "drizzle-orm";

export class PaymentPerformanceOptimizer {
  /**
   * 批量查詢優化 - 減少 N+1 查詢問題
   */
  async getPaymentItemsWithDetails(filters: {
    projectId?: number;
    status?: string;
    dateRange?: { start: string; end: string };
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];
    const params: any = {};

    if (filters.projectId) {
      conditions.push("pi.project_id = $projectId");
      params.projectId = filters.projectId;
    }

    if (filters.status) {
      conditions.push("pi.status = $status");
      params.status = filters.status;
    }

    if (filters.dateRange) {
      conditions.push("pi.start_date >= $startDate AND pi.start_date <= $endDate");
      params.startDate = filters.dateRange.start;
      params.endDate = filters.dateRange.end;
    }

    if (!filters.includeDeleted) {
      conditions.push("pi.is_deleted = false");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitClause = filters.limit ? `LIMIT ${filters.limit}` : "";
    const offsetClause = filters.offset ? `OFFSET ${filters.offset}` : "";

    return await db.execute(sql`
      SELECT 
        pi.*,
        pp.project_name,
        dc.category_name,
        COALESCE(SUM(pr.amount_paid), 0) as total_paid,
        COUNT(pr.id) as payment_count,
        CASE 
          WHEN pi.end_date < CURRENT_DATE AND pi.status != 'paid' THEN 'overdue'
          ELSE pi.status
        END as computed_status
      FROM payment_items pi
      LEFT JOIN payment_projects pp ON pi.project_id = pp.id
      LEFT JOIN debt_categories dc ON pi.category_id = dc.id
      LEFT JOIN payment_records pr ON pi.id = pr.payment_item_id
      ${sql.raw(whereClause)}
      GROUP BY pi.id, pp.project_name, dc.category_name
      ORDER BY pi.created_at DESC
      ${sql.raw(limitClause)}
      ${sql.raw(offsetClause)}
    `);
  }

  /**
   * 月度分析優化 - 使用物化視圖概念
   */
  async getMonthlyAnalysisOptimized(year: number, month: number) {
    return await db.execute(sql`
      WITH monthly_stats AS (
        SELECT 
          pi.status,
          COUNT(*) as item_count,
          SUM(CAST(pi.total_amount AS DECIMAL)) as total_amount,
          SUM(COALESCE(pr_sum.total_paid, 0)) as total_paid
        FROM payment_items pi
        LEFT JOIN (
          SELECT 
            payment_item_id,
            SUM(CAST(amount_paid AS DECIMAL)) as total_paid
          FROM payment_records 
          GROUP BY payment_item_id
        ) pr_sum ON pi.id = pr_sum.payment_item_id
        WHERE 
          EXTRACT(YEAR FROM pi.start_date) = ${year}
          AND EXTRACT(MONTH FROM pi.start_date) = ${month}
          AND pi.is_deleted = false
        GROUP BY pi.status
      ),
      category_stats AS (
        SELECT 
          dc.category_name,
          SUM(CAST(pi.total_amount AS DECIMAL)) as category_total,
          COUNT(*) as category_count
        FROM payment_items pi
        JOIN debt_categories dc ON pi.category_id = dc.id
        WHERE 
          EXTRACT(YEAR FROM pi.start_date) = ${year}
          AND EXTRACT(MONTH FROM pi.start_date) = ${month}
          AND pi.is_deleted = false
        GROUP BY dc.category_name
        ORDER BY category_total DESC
        LIMIT 10
      )
      SELECT 
        json_build_object(
          'monthly_stats', (SELECT json_agg(monthly_stats) FROM monthly_stats),
          'category_stats', (SELECT json_agg(category_stats) FROM category_stats)
        ) as analysis_data
    `);
  }

  /**
   * 分頁查詢優化
   */
  async getPaginatedPaymentItems(
    page: number = 1, 
    pageSize: number = 50,
    filters: any = {}
  ) {
    const offset = (page - 1) * pageSize;
    
    const items = await this.getPaymentItemsWithDetails({
      ...filters,
      limit: pageSize,
      offset: offset
    });

    // 總數查詢優化
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM payment_items pi
      WHERE pi.is_deleted = ${filters.includeDeleted || false}
    `);

    return {
      items: items.rows,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalItems: Number(countResult.rows[0].total),
        totalPages: Math.ceil(Number(countResult.rows[0].total) / pageSize)
      }
    };
  }

  /**
   * 快取策略 - Redis 風格的記憶體快取
   */
  private cache = new Map<string, { data: any; expiry: number }>();

  async getCachedData<T>(
    key: string, 
    fetchFunction: () => Promise<T>, 
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const data = await fetchFunction();
    this.cache.set(key, {
      data,
      expiry: Date.now() + (ttlSeconds * 1000)
    });

    return data;
  }

  /**
   * 批量操作優化
   */
  async bulkUpdatePaymentStatus(itemIds: number[], status: string, userInfo: string) {
    // 使用事務確保數據一致性
    return await db.transaction(async (tx) => {
      // 批量更新
      await tx.execute(sql`
        UPDATE payment_items 
        SET status = ${status}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY(${itemIds})
      `);

      // 批量記錄審計日誌
      for (const itemId of itemIds) {
        await tx.execute(sql`
          INSERT INTO audit_logs (
            table_name, record_id, action, new_values, 
            user_info, change_reason, created_at
          ) VALUES (
            'payment_items', ${itemId}, 'UPDATE',
            json_build_object('status', ${status}),
            ${userInfo}, 'Bulk status update', CURRENT_TIMESTAMP
          )
        `);
      }
    });
  }

  /**
   * 資料庫連接池優化建議
   */
  getDatabaseOptimizationRecommendations() {
    return {
      connectionPool: {
        min: 5,
        max: 30,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
      queryOptimization: [
        "使用準備語句減少解析時間",
        "實施查詢結果快取策略",
        "定期分析查詢計劃並優化慢查詢",
        "考慮使用讀寫分離架構"
      ],
      indexStrategy: [
        "已添加基本索引提升查詢效能",
        "考慮部分索引減少存儲空間",
        "定期重建索引維護效能",
        "監控索引使用率"
      ]
    };
  }
}

export const performanceOptimizer = new PaymentPerformanceOptimizer();