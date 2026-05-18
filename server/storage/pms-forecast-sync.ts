/**
 * PMS performance_entries → Money forecast_snapshots 同步
 *
 * PMS 使用者「不定期填入本月/下月/下下月預估」資料、每天 cron 拉進 Money。
 * 累積後可訓練預測模型（離月底 N 天填 X → 實際 Y 的比率）。
 */
import { db } from "../db"
import { sql } from "drizzle-orm"
import pg from "pg"

const PMS_DATABASE_URL = process.env.PMS_DATABASE_URL

let pmsPool: pg.Pool | null = null
function getPmsPool(): pg.Pool | null {
  if (!PMS_DATABASE_URL) return null
  if (!pmsPool) pmsPool = new pg.Pool({ connectionString: PMS_DATABASE_URL })
  return pmsPool
}

interface SyncResult {
  ok: boolean
  inserted: number
  skipped: number
  error?: string
}

/**
 * 從 PMS 拉 performance_entries 同步到 forecast_snapshots
 * 每筆拆 3 個 snapshot（本月 + 下月 + 下下月）
 *
 * @param sinceDays 拉最近 N 天的（預設 7、平常 cron）；首次 backfill 用大值
 */
export async function syncFromPMS(sinceDays: number = 7): Promise<SyncResult> {
  const pool = getPmsPool()
  if (!pool) return { ok: false, inserted: 0, skipped: 0, error: "PMS_DATABASE_URL 未配置" }

  try {
    const since = new Date()
    since.setDate(since.getDate() - sinceDays)
    const sinceStr = since.toISOString().slice(0, 10)

    const entries = await pool.query(
      `SELECT date::text, branch_id, current_month_revenue, next_month_forecast, next_next_month_forecast
       FROM performance_entries WHERE date >= $1 ORDER BY date`,
      [sinceStr]
    )

    let inserted = 0
    let skipped = 0

    for (const e of entries.rows as Array<{
      date: string
      branch_id: number
      current_month_revenue: string | null
      next_month_forecast: string | null
      next_next_month_forecast: string | null
    }>) {
      const d = new Date(e.date)
      const targets = [
        { offset: 0, val: e.current_month_revenue },
        { offset: 1, val: e.next_month_forecast },
        { offset: 2, val: e.next_next_month_forecast },
      ]

      for (const t of targets) {
        const amount = parseFloat(t.val ?? "0")
        if (!amount || amount <= 0) continue

        const targetMonth = new Date(d.getFullYear(), d.getMonth() + t.offset, 1)
          .toISOString()
          .slice(0, 7)
        const targetMonthEnd = new Date(d.getFullYear(), d.getMonth() + t.offset + 1, 1)
        const daysAhead = Math.ceil((targetMonthEnd.getTime() - d.getTime()) / 86_400_000)

        try {
          await db.execute(sql`
            INSERT INTO revenue_forecast_snapshots
              (snapshot_date, company_id, target_month, accumulated_revenue, booked_revenue, days_ahead_of_target, source, notes)
            VALUES (${e.date}, ${e.branch_id}, ${targetMonth}, 0, ${amount.toString()}, ${daysAhead}, 'pms-bridge', 'auto sync from PMS')
          `)
          inserted++
        } catch {
          // unique 衝突 → 改 UPDATE（萬一使用者改了 PMS 內的資料）
          try {
            await db.execute(sql`
              UPDATE revenue_forecast_snapshots
              SET booked_revenue = ${amount.toString()},
                  notes = 'auto sync from PMS (updated)'
              WHERE snapshot_date = ${e.date}
                AND company_id = ${e.branch_id}
                AND target_month = ${targetMonth}
                AND source = 'pms-bridge'
            `)
            skipped++
          } catch {
            // 雙重 fail 略過
          }
        }
      }
    }

    return { ok: true, inserted, skipped }
  } catch (err) {
    return {
      ok: false,
      inserted: 0,
      skipped: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
