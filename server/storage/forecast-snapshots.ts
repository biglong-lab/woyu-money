/**
 * 收入預測快照 storage
 *
 * - 每日 cron 呼叫 captureFromPM() 對「本月 / 下月 / 下下月」各拍一張
 * - 從 PM 的 daily_revenue_snapshots 拉「該月累積已實現」
 * - 提供 list / 月內推估查詢給 UI
 */
import { db } from "../db"
import { sql, and, eq, gte } from "drizzle-orm"
import { revenueForecastSnapshots, type RevenueForecastSnapshot } from "@shared/schema"
import pg from "pg"

const PM_DATABASE_URL = process.env.PM_DATABASE_URL

let pmPool: pg.Pool | null = null
function getPmPool(): pg.Pool | null {
  if (!PM_DATABASE_URL) return null
  if (!pmPool) pmPool = new pg.Pool({ connectionString: PM_DATABASE_URL })
  return pmPool
}

// ─────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────

export async function listSnapshots(params: {
  targetMonth?: string
  companyId?: number
  source?: string
  from?: string
  to?: string
}): Promise<RevenueForecastSnapshot[]> {
  const conditions = []
  if (params.targetMonth)
    conditions.push(eq(revenueForecastSnapshots.targetMonth, params.targetMonth))
  if (params.companyId !== undefined)
    conditions.push(eq(revenueForecastSnapshots.companyId, params.companyId))
  if (params.source) conditions.push(eq(revenueForecastSnapshots.source, params.source))
  if (params.from) conditions.push(gte(revenueForecastSnapshots.snapshotDate, params.from))

  return db
    .select()
    .from(revenueForecastSnapshots)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(revenueForecastSnapshots.snapshotDate)
}

/**
 * 給定一個 targetMonth，回傳每天的累積/預訂走勢
 * 適合畫「Sparkline」或「累積曲線」
 */
export async function getMonthlyTrend(
  targetMonth: string,
  companyId: number | null = null
): Promise<RevenueForecastSnapshot[]> {
  const conditions = [eq(revenueForecastSnapshots.targetMonth, targetMonth)]
  if (companyId !== null) conditions.push(eq(revenueForecastSnapshots.companyId, companyId))

  return db
    .select()
    .from(revenueForecastSnapshots)
    .where(and(...conditions))
    .orderBy(revenueForecastSnapshots.snapshotDate)
}

// ─────────────────────────────────────────────
// Capture (從 PM 拉一張快照)
// ─────────────────────────────────────────────

interface CaptureResult {
  ok: boolean
  inserted: number
  skipped: number
  error?: string
}

/**
 * 對「本月、下月、下下月」各拍快照
 * 對每家 PM company 各一筆 + 1 筆 companyId=null 合計
 */
export async function captureFromPM(): Promise<CaptureResult> {
  const pool = getPmPool()
  if (!pool) return { ok: false, inserted: 0, skipped: 0, error: "PM_DATABASE_URL 未配置" }

  try {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const months = [0, 1, 2].map((offset) => {
      const d = new Date(today.getFullYear(), today.getMonth() + offset, 1)
      return d.toISOString().slice(0, 7)
    })

    let inserted = 0
    let skipped = 0

    for (const targetMonth of months) {
      // 從 PM 拉該月每家公司「截至今日」累積（含今日）
      const result = await pool.query<{
        company_id: number
        accumulated: string
      }>(
        `SELECT company_id, COALESCE(SUM(total_revenue), 0)::text AS accumulated
         FROM daily_revenue_snapshots
         WHERE TO_CHAR(date, 'YYYY-MM') = $1
           AND date <= $2::date
         GROUP BY company_id`,
        [targetMonth, todayStr]
      )

      const daysAhead = Math.ceil(
        (new Date(targetMonth + "-01").setMonth(new Date(targetMonth + "-01").getMonth() + 1) -
          today.getTime()) /
          (1000 * 60 * 60 * 24)
      )

      // 每家公司
      let monthTotal = 0
      for (const row of result.rows) {
        const accumulated = parseFloat(row.accumulated)
        monthTotal += accumulated

        try {
          await db.insert(revenueForecastSnapshots).values({
            snapshotDate: todayStr,
            companyId: row.company_id,
            targetMonth,
            accumulatedRevenue: accumulated.toString(),
            bookedRevenue: "0",
            daysAheadOfTarget: daysAhead,
            source: "pm-daily-snapshot",
          })
          inserted++
        } catch {
          skipped++
        }
      }

      // 合計：直接用各公司累積加總（已是「截至今日」、不會有跨日缺紀錄問題）
      try {
        await db.insert(revenueForecastSnapshots).values({
          snapshotDate: todayStr,
          companyId: null,
          targetMonth,
          accumulatedRevenue: monthTotal.toString(),
          bookedRevenue: "0",
          daysAheadOfTarget: daysAhead,
          source: "pm-daily-snapshot",
        })
        inserted++
      } catch {
        skipped++
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

/**
 * Backfill：把 PM 既有 daily_revenue_snapshots 歷史轉成 forecast snapshots
 * 對每個 (PM 已有的 date, target_month=該 date 的 YYYY-MM) 建一筆 snapshot
 * 模擬「在那天拍的快照」
 */
export async function backfillFromPMHistory(): Promise<CaptureResult> {
  const pool = getPmPool()
  if (!pool) return { ok: false, inserted: 0, skipped: 0, error: "PM_DATABASE_URL 未配置" }

  try {
    // 拉 PM 全部 daily_revenue_snapshots
    const result = await pool.query<{
      date: string
      company_id: number
      total_revenue: string
    }>(
      `SELECT date, company_id, COALESCE(total_revenue, 0)::text AS total_revenue
       FROM daily_revenue_snapshots
       ORDER BY date, company_id`
    )

    if (result.rows.length === 0) {
      return { ok: true, inserted: 0, skipped: 0, error: "PM 無歷史資料" }
    }

    // 對每個 (date, company_id) 計算「該日該月累積」
    // 用 SQL window function 計算 running sum 比較快
    const cumulative = await pool.query<{
      date: string
      company_id: number
      target_month: string
      accumulated: string
    }>(
      `SELECT date::text, company_id, TO_CHAR(date, 'YYYY-MM') AS target_month,
              SUM(total_revenue) OVER (
                PARTITION BY company_id, TO_CHAR(date, 'YYYY-MM')
                ORDER BY date
              )::text AS accumulated
       FROM daily_revenue_snapshots
       ORDER BY date, company_id`
    )

    let inserted = 0
    let skipped = 0

    for (const row of cumulative.rows) {
      const daysAhead = Math.ceil(
        (new Date(row.target_month + "-01").setMonth(
          new Date(row.target_month + "-01").getMonth() + 1
        ) -
          new Date(row.date).getTime()) /
          (1000 * 60 * 60 * 24)
      )

      try {
        await db.insert(revenueForecastSnapshots).values({
          snapshotDate: row.date,
          companyId: row.company_id,
          targetMonth: row.target_month,
          accumulatedRevenue: row.accumulated,
          bookedRevenue: "0",
          daysAheadOfTarget: daysAhead,
          source: "pm-daily-snapshot",
          notes: "backfill from PM history",
        })
        inserted++
      } catch {
        skipped++
      }
    }

    // 補合計（companyId NULL）— 對每一日各 targetMonth 加總
    const aggregated = await pool.query<{
      date: string
      target_month: string
      total: string
    }>(
      `WITH cumu AS (
        SELECT date, company_id, TO_CHAR(date, 'YYYY-MM') AS tm,
               SUM(total_revenue) OVER (
                 PARTITION BY company_id, TO_CHAR(date, 'YYYY-MM')
                 ORDER BY date
               ) AS cum
        FROM daily_revenue_snapshots
      )
      SELECT date::text, tm AS target_month, SUM(cum)::text AS total
      FROM cumu
      GROUP BY date, tm
      ORDER BY date`
    )

    for (const row of aggregated.rows) {
      const daysAhead = Math.ceil(
        (new Date(row.target_month + "-01").setMonth(
          new Date(row.target_month + "-01").getMonth() + 1
        ) -
          new Date(row.date).getTime()) /
          (1000 * 60 * 60 * 24)
      )

      try {
        await db.insert(revenueForecastSnapshots).values({
          snapshotDate: row.date,
          companyId: null,
          targetMonth: row.target_month,
          accumulatedRevenue: row.total,
          bookedRevenue: "0",
          daysAheadOfTarget: daysAhead,
          source: "pm-daily-snapshot",
          notes: "backfill aggregate",
        })
        inserted++
      } catch {
        skipped++
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

// ─────────────────────────────────────────────
// 推估：簡單版（純函式）
// ─────────────────────────────────────────────

/**
 * 季節性預測：用歷史「同 day 累積 / 最終」比率推估
 *
 * 公式：
 *   predictedFinal = currentAccumulated / avgRatio(history)
 *   其中 ratio[m] = accumulated_at_day_K[m] / final_accumulated[m]
 *
 * 信心區間：基於歷史比率標準差
 *   95% CI = ratio ± 1.96 × std
 *   80% CI = ratio ± 1.28 × std
 *
 * 對應的最終金額區間：currentAcc / [upperRatio, lowerRatio]
 */
export async function getSeasonalForecast(
  targetMonth: string,
  companyId: number | null = null,
  historyMonths: number = 6
): Promise<{
  targetMonth: string
  daysElapsed: number
  currentAccumulated: number
  history: Array<{
    month: string
    accAtSameDay: number
    finalAcc: number
    ratio: number // accAtSameDay / finalAcc
  }>
  sampleSize: number
  avgRatio: number
  stdRatio: number
  pointEstimate: number
  ci80: { lower: number; upper: number }
  ci95: { lower: number; upper: number }
  confidence: "high" | "medium" | "low" | "insufficient"
}> {
  // 1. 取本月最新快照
  const conditions = [eq(revenueForecastSnapshots.targetMonth, targetMonth)]
  if (companyId !== null) conditions.push(eq(revenueForecastSnapshots.companyId, companyId))

  const currentSnapshots = await db
    .select()
    .from(revenueForecastSnapshots)
    .where(and(...conditions))
    .orderBy(revenueForecastSnapshots.snapshotDate)

  if (currentSnapshots.length === 0) {
    return {
      targetMonth,
      daysElapsed: 0,
      currentAccumulated: 0,
      history: [],
      sampleSize: 0,
      avgRatio: 0,
      stdRatio: 0,
      pointEstimate: 0,
      ci80: { lower: 0, upper: 0 },
      ci95: { lower: 0, upper: 0 },
      confidence: "insufficient",
    }
  }

  const latest = currentSnapshots[currentSnapshots.length - 1]
  const daysElapsed = new Date(latest.snapshotDate).getDate()
  const currentAccumulated = parseFloat(latest.accumulatedRevenue)

  // 2. 對過去 N 月：找該月第 daysElapsed 天累積 + 該月最終累積
  const [y, m] = targetMonth.split("-").map(Number)
  const pastMonths: string[] = []
  for (let i = 1; i <= historyMonths; i++) {
    const d = new Date(y, m - 1 - i, 1)
    pastMonths.push(d.toISOString().slice(0, 7))
  }

  const history: Array<{ month: string; accAtSameDay: number; finalAcc: number; ratio: number }> =
    []

  for (const hm of pastMonths) {
    const hmConditions = [eq(revenueForecastSnapshots.targetMonth, hm)]
    if (companyId !== null) hmConditions.push(eq(revenueForecastSnapshots.companyId, companyId))

    const hmSnaps = await db
      .select()
      .from(revenueForecastSnapshots)
      .where(and(...hmConditions))
      .orderBy(revenueForecastSnapshots.snapshotDate)

    if (hmSnaps.length === 0) continue

    // 在同 day 累積：找 snapshotDate.day == daysElapsed 的 snapshot（取最接近的）
    let sameDayAcc = 0
    let minDiff = Infinity
    for (const s of hmSnaps) {
      const day = new Date(s.snapshotDate).getDate()
      const diff = Math.abs(day - daysElapsed)
      if (diff < minDiff) {
        minDiff = diff
        sameDayAcc = parseFloat(s.accumulatedRevenue)
      }
    }

    // 最終累積：該月最後一筆 snapshot
    const finalAcc = parseFloat(hmSnaps[hmSnaps.length - 1].accumulatedRevenue)

    if (finalAcc > 0 && sameDayAcc > 0) {
      history.push({
        month: hm,
        accAtSameDay: sameDayAcc,
        finalAcc,
        ratio: sameDayAcc / finalAcc, // 0~1 之間
      })
    }
  }

  const sampleSize = history.length

  if (sampleSize === 0) {
    // 沒任何歷史可比，退化為線性推估
    const [y2, m2] = targetMonth.split("-").map(Number)
    const monthEnd = new Date(y2, m2, 0).getDate()
    const linearProj = (currentAccumulated / daysElapsed) * monthEnd
    return {
      targetMonth,
      daysElapsed,
      currentAccumulated,
      history,
      sampleSize: 0,
      avgRatio: daysElapsed / monthEnd,
      stdRatio: 0,
      pointEstimate: Math.round(linearProj),
      ci80: { lower: Math.round(linearProj * 0.85), upper: Math.round(linearProj * 1.15) },
      ci95: { lower: Math.round(linearProj * 0.75), upper: Math.round(linearProj * 1.25) },
      confidence: "insufficient",
    }
  }

  // 3. 平均比率與標準差
  const ratios = history.map((h) => h.ratio)
  const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length
  const variance = ratios.reduce((sum, r) => sum + (r - avgRatio) ** 2, 0) / ratios.length
  const stdRatio = Math.sqrt(variance)

  // 4. 點估計 + 信心區間
  const pointEstimate = currentAccumulated / avgRatio

  // 用 ratio 的不確定性反推 final 區間
  // 若 ratio 高 → final 低；ratio 低 → final 高
  const lowerRatio95 = avgRatio + 1.96 * stdRatio
  const upperRatio95 = Math.max(0.01, avgRatio - 1.96 * stdRatio) // 防 0
  const lowerRatio80 = avgRatio + 1.28 * stdRatio
  const upperRatio80 = Math.max(0.01, avgRatio - 1.28 * stdRatio)

  const ci95 = {
    lower: Math.round(currentAccumulated / lowerRatio95),
    upper: Math.round(currentAccumulated / upperRatio95),
  }
  const ci80 = {
    lower: Math.round(currentAccumulated / lowerRatio80),
    upper: Math.round(currentAccumulated / upperRatio80),
  }

  const confidence: "high" | "medium" | "low" | "insufficient" =
    sampleSize >= 6 && stdRatio < 0.05
      ? "high"
      : sampleSize >= 4 && stdRatio < 0.1
        ? "medium"
        : sampleSize >= 2
          ? "low"
          : "insufficient"

  return {
    targetMonth,
    daysElapsed,
    currentAccumulated,
    history,
    sampleSize,
    avgRatio,
    stdRatio,
    pointEstimate: Math.round(pointEstimate),
    ci80,
    ci95,
    confidence,
  }
}

/**
 * 給定 targetMonth、回傳：
 *  - 當下累積（最新快照）
 *  - 該月剩餘天數
 *  - 簡單線性推估 = 當下累積 / 已過天數 × 整月天數
 *  - 比較最近 2 月同期累積比率
 */
export async function getSimpleForecast(
  targetMonth: string,
  companyId: number | null = null
): Promise<{
  targetMonth: string
  latestSnapshot?: RevenueForecastSnapshot
  daysElapsed: number
  daysInMonth: number
  daysRemaining: number
  linearProjection: number
  pastMonthsComparison: Array<{ month: string; ratio: number; finalAmount: number }>
}> {
  const snapshots = await getMonthlyTrend(targetMonth, companyId)
  const latestSnapshot = snapshots[snapshots.length - 1]

  const monthStart = new Date(targetMonth + "-01")
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  const daysInMonth = monthEnd.getDate()

  const today = new Date()
  const isCurrentMonth = targetMonth === today.toISOString().slice(0, 7)
  const daysElapsed = isCurrentMonth ? Math.min(today.getDate(), daysInMonth) : daysInMonth
  const daysRemaining = daysInMonth - daysElapsed

  const latestAccumulated = latestSnapshot ? parseFloat(latestSnapshot.accumulatedRevenue) : 0

  const linearProjection = daysElapsed > 0 ? (latestAccumulated / daysElapsed) * daysInMonth : 0

  return {
    targetMonth,
    latestSnapshot,
    daysElapsed,
    daysInMonth,
    daysRemaining,
    linearProjection: Math.round(linearProjection),
    pastMonthsComparison: [], // 未來補：同 daysElapsed 日數歷史比率
  }
}
