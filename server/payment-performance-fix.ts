// 付款管理效能優化 - 修復 N+1 查詢和索引問題
import { db } from "./db";
import { sql } from "drizzle-orm";

export class PaymentPerformanceFix {
  
  /**
   * 建立關鍵索引以提升查詢效能
   */
  async createOptimizedIndexes() {
    console.log("建立效能優化索引...");
    
    try {
      // 1. payment_items 表索引
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_items_project_id 
        ON payment_items(project_id) WHERE is_deleted = false;
      `);
      
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_items_category_id 
        ON payment_items(category_id) WHERE is_deleted = false;
      `);
      
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_items_item_name_gin 
        ON payment_items USING gin(item_name gin_trgm_ops);
      `);
      
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_items_start_date 
        ON payment_items(start_date DESC) WHERE is_deleted = false;
      `);
      
      // 2. payment_records 表索引
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_records_item_id 
        ON payment_records(payment_item_id);
      `);
      
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_records_payment_date 
        ON payment_records(payment_date DESC);
      `);
      
      // 3. 複合索引用於常見查詢組合
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_items_project_status 
        ON payment_items(project_id, status) WHERE is_deleted = false;
      `);
      
      await db.execute(sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_items_type_project 
        ON payment_items(item_type, project_id) WHERE is_deleted = false;
      `);
      
      console.log("索引建立完成");
      return { success: true, message: "所有索引已成功建立" };
      
    } catch (error) {
      console.error("建立索引時發生錯誤:", error);
      return { success: false, message: `索引建立失敗: ${error}` };
    }
  }
  
  /**
   * 優化的付款項目查詢 - 使用單一 JOIN 查詢解決 N+1 問題
   */
  async getOptimizedPaymentItems(filters: any = {}, page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;
    
    // 建立篩選條件
    const conditions = ["pi.is_deleted = false"];
    const params: any = {};
    
    if (filters.projectId) {
      conditions.push("pi.project_id = $1");
      params.projectId = filters.projectId;
    }
    
    if (filters.categoryId) {
      conditions.push("pi.category_id = $2");
      params.categoryId = filters.categoryId;
    }
    
    // 簡化的租約排除邏輯
    if (filters.excludeRental) {
      conditions.push(`(
        pi.item_name NOT LIKE '%租約%' AND 
        pi.item_name NOT LIKE '%租金%' AND 
        pi.item_name NOT LIKE '%第%期/共%期%' AND
        (pp.project_type IS NULL OR pp.project_type != 'rental' OR pi.item_name LIKE '%測試%')
      )`);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // 單一查詢獲取所有需要的數據，包含已付金額
    const query = sql`
      SELECT 
        pi.id,
        pi.category_id as "categoryId",
        pi.fixed_category_id as "fixedCategoryId", 
        pi.fixed_sub_option_id as "fixedSubOptionId",
        pi.project_id as "projectId",
        pi.item_name as "itemName",
        pi.total_amount::text as "totalAmount",
        pi.installment_count as "installmentCount",
        pi.installment_amount::text as "installmentAmount",
        pi.end_date as "dueDate",
        pi.item_type as "itemType",
        pi.payment_type as "paymentType",
        pi.start_date as "startDate",
        pi.end_date as "endDate",
        pi.status,
        pi.priority,
        pi.notes,
        pi.is_deleted as "isDeleted",
        pi.created_at as "createdAt",
        pi.updated_at as "updatedAt",
        dc.category_name as "categoryName",
        pp.project_name as "projectName",
        pp.project_type as "projectType",
        COALESCE(pr.total_paid, '0') as "paidAmount"
      FROM payment_items pi
      LEFT JOIN debt_categories dc ON pi.category_id = dc.id
      LEFT JOIN payment_projects pp ON pi.project_id = pp.id
      LEFT JOIN (
        SELECT 
          payment_item_id,
          SUM(CAST(amount_paid AS DECIMAL(10,2)))::text as total_paid
        FROM payment_records 
        GROUP BY payment_item_id
      ) pr ON pi.id = pr.payment_item_id
      ${sql.raw(whereClause)}
      ORDER BY pi.start_date DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const result = await db.execute(query);
    return result.rows;
  }
  
  /**
   * 優化的付款項目計數查詢
   */
  async getOptimizedPaymentItemsCount(filters: any = {}) {
    const conditions = ["pi.is_deleted = false"];
    
    if (filters.projectId) {
      conditions.push(`pi.project_id = ${filters.projectId}`);
    }
    
    if (filters.categoryId) {
      conditions.push(`pi.category_id = ${filters.categoryId}`);
    }
    
    if (filters.excludeRental) {
      conditions.push(`(
        pi.item_name NOT LIKE '%租約%' AND 
        pi.item_name NOT LIKE '%租金%' AND 
        pi.item_name NOT LIKE '%第%期/共%期%' AND
        (pp.project_type IS NULL OR pp.project_type != 'rental' OR pi.item_name LIKE '%測試%')
      )`);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const query = sql`
      SELECT COUNT(*) as count
      FROM payment_items pi
      LEFT JOIN payment_projects pp ON pi.project_id = pp.id
      ${sql.raw(whereClause)}
    `;
    
    const result = await db.execute(query);
    return parseInt(result.rows[0]?.count || '0');
  }
  
  /**
   * 批量獲取統計數據
   */
  async getBatchStatistics() {
    const query = sql`
      WITH payment_stats AS (
        SELECT 
          COUNT(*)::text as total_items,
          COALESCE(SUM(CAST(total_amount AS DECIMAL(10,2))), 0)::text as total_planned,
          COUNT(CASE WHEN status = 'paid' THEN 1 END)::text as paid_items,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::text as pending_items,
          COUNT(CASE WHEN status = 'overdue' THEN 1 END)::text as overdue_items
        FROM payment_items 
        WHERE is_deleted = false
      ),
      project_stats AS (
        SELECT 
          COUNT(*)::text as total_projects,
          COUNT(CASE WHEN project_type = 'rental' THEN 1 END)::text as rental_projects,
          COUNT(CASE WHEN project_type = 'general' THEN 1 END)::text as general_projects
        FROM payment_projects 
        WHERE is_deleted = false
      ),
      payment_records_stats AS (
        SELECT 
          COALESCE(SUM(CAST(amount_paid AS DECIMAL(10,2))), 0)::text as total_paid,
          COUNT(*)::text as total_records
        FROM payment_records
      )
      SELECT 
        ps.total_items,
        ps.total_planned,
        ps.paid_items,
        ps.pending_items,
        ps.overdue_items,
        prs.total_paid,
        prs.total_records,
        prjs.total_projects,
        prjs.rental_projects,
        prjs.general_projects
      FROM payment_stats ps
      CROSS JOIN project_stats prjs
      CROSS JOIN payment_records_stats prs
    `;
    
    const result = await db.execute(query);
    return result.rows[0];
  }
}

export const paymentPerformanceFix = new PaymentPerformanceFix();