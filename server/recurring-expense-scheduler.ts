/**
 * 月度週期性支出自動產出 scheduler
 *
 * 邏輯：每天台北時間 09:00 檢查；若是當月 1 號（且當月還沒跑過），
 * 依「過去 6 個月有 ≥2 筆 manual + 當月還沒紀錄」的 (cat, project) 組合，
 * 產生一筆 auto_backfill payment_item（status=unpaid、金額用歷史平均）。
 *
 * 對應 scripts/backfill-recurring-expenses.sql 的相同邏輯，但只跑「當月」。
 * 涵蓋類別：洗滌費 / 人事費用 / 借貸 / 水費 / 電費 / 軟體服務 / 電話費 / 保險稅務
 */
import { db } from "./db"
import { sql } from "drizzle-orm"
import { log } from "./vite"

const RECURRING_CATEGORIES = [
  "洗滌費",
  "人事費用",
  "借貸",
  "水費",
  "電費",
  "軟體服務",
  "電話費",
  "保險稅務",
]

class RecurringExpenseScheduler {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private lastGeneratedMonth: string | null = null

  start() {
    if (this.isRunning) return
    this.isRunning = true

    // 啟動時跑一次（補今天若是 1 號還沒跑過的情況）
    this.checkAndGenerate()

    // 每 6 小時檢查一次（容錯：即使重啟也能在當天補跑）
    this.intervalId = setInterval(() => this.checkAndGenerate(), 6 * 60 * 60 * 1000)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
  }

  /** 檢查是否該產出（每月只跑一次） */
  private async checkAndGenerate() {
    try {
      const now = new Date()
      // 台北時間 (UTC+8)
      const tpe = new Date(now.getTime() + 8 * 60 * 60 * 1000)
      const day = tpe.getUTCDate()
      const month = tpe.toISOString().slice(0, 7) // YYYY-MM

      // 每月 1-3 號之間有機會跑（避免時區邊界）
      if (day > 3) return
      // 同月不重複
      if (this.lastGeneratedMonth === month) return

      const inserted = await this.generateForMonth(month)
      this.lastGeneratedMonth = month
      console.log(
        `[RecurringExpenseScheduler] ${month} 產出 ${inserted} 筆 auto_backfill payment_items`
      )
    } catch (err) {
      console.error("[RecurringExpenseScheduler] 失敗:", err)
    }
  }

  /** 對指定月份（YYYY-MM）產出 auto_backfill items */
  async generateForMonth(month: string): Promise<number> {
    const result = await db.execute(sql`
      WITH eligible AS (
        SELECT
          pi.category_id,
          pi.fixed_category_id,
          pi.project_id,
          MIN(COALESCE(dc.category_name, fc.category_name)) AS cat_name,
          MIN(pp.project_name) AS project_name,
          MAX(pi.start_date) AS last_date,
          ROUND(AVG(pi.total_amount::numeric))::int AS avg_amt,
          COUNT(*) AS history_count
        FROM payment_items pi
        LEFT JOIN debt_categories dc ON dc.id = pi.category_id
        LEFT JOIN fixed_categories fc ON fc.id = pi.fixed_category_id
        LEFT JOIN payment_projects pp ON pp.id = pi.project_id
        WHERE pi.source = 'manual' AND NOT pi.is_deleted
          AND pi.item_type IN ('project', 'home')
          AND pi.start_date >= (${month}::date - INTERVAL '6 months')
          AND COALESCE(dc.category_name, fc.category_name) = ANY(${sql.raw(`ARRAY[${RECURRING_CATEGORIES.map((c) => `'${c}'`).join(",")}]`)}::text[])
        GROUP BY pi.category_id, pi.fixed_category_id, pi.project_id
        HAVING COUNT(*) >= 2
      ),
      to_insert AS (
        SELECT e.*
        FROM eligible e
        WHERE NOT EXISTS (
          SELECT 1 FROM payment_items pi
          WHERE pi.source IN ('manual', 'auto_backfill')
            AND NOT pi.is_deleted
            AND (pi.category_id IS NOT DISTINCT FROM e.category_id)
            AND (pi.fixed_category_id IS NOT DISTINCT FROM e.fixed_category_id)
            AND pi.project_id = e.project_id
            AND DATE_TRUNC('month', pi.start_date)::date = (${month} || '-01')::date
        )
      )
      INSERT INTO payment_items (
        item_name, total_amount, item_type, payment_type,
        project_id, category_id, fixed_category_id,
        start_date, status, paid_amount, source,
        tags, notes, priority, created_at, updated_at
      )
      SELECT
        cat_name || ' ' || ${month} || COALESCE(' - ' || project_name, ''),
        avg_amt::numeric,
        'project', 'single',
        project_id, category_id, fixed_category_id,
        (${month} || '-10')::date, 'unpaid', 0, 'auto_backfill',
        '自動補建,週期性支出,' || cat_name,
        E'⚠️ 自動產出（每月 cron）：依歷史 ' || history_count || ' 筆平均金額 $' || avg_amt ||
          E'\n請核實實際金額並改為 paid 狀態' ||
          E'\n若該月實際未發生，請刪除此筆',
        3,
        NOW(), NOW()
      FROM to_insert
      RETURNING id
    `)
    return (result as { rowCount?: number }).rowCount ?? 0
  }
}

export const recurringExpenseScheduler = new RecurringExpenseScheduler()
