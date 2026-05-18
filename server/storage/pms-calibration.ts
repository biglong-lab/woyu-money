/**
 * PMS 預估校準模型
 *
 * 邏輯：
 *  1. 對「已結束月份」配對 (PMS 預估, 實際) → 算 ratio = actual / estimate
 *  2. 依「離月底天數」(daysAhead) 分桶、取中位數 + 四分位（P25/P75）
 *  3. 預測：predicted_actual = current_estimate × median_ratio
 *  4. 信心區間：[P25 × estimate, P75 × estimate]
 *
 * 為何用中位數：PMS 早期填的預估很保守（ratio 可能 27x），平均被異常拉高、中位數較穩。
 */
import { db } from "../db"
import { sql } from "drizzle-orm"

interface RawPair {
  days_ahead: number
  estimate: number
  actual: number
  ratio: number
  snapshot_date: string
  target_month: string
  company_id: number
}

export interface CalibrationBucket {
  bucket: string // "0-7天" / "8-15天" / "16-30天" / "31-60天" / "60+天"
  daysAheadMin: number
  daysAheadMax: number
  samples: number
  medianRatio: number
  p25Ratio: number
  p75Ratio: number
  meanRatio: number
}

export interface CalibrationCurve {
  companyId: number | null // null = 全部館
  buckets: CalibrationBucket[]
  totalSamples: number
}

export interface CalibratedPrediction {
  targetMonth: string
  companyId: number | null
  currentEstimate: number // PMS 當前預估
  daysAhead: number
  bucket: CalibrationBucket | null
  pointEstimate: number // 中位數推估
  ci80Lower: number // P10 × estimate
  ci80Upper: number // P90 × estimate
  confidence: "high" | "medium" | "low" | "insufficient"
  note: string
}

const BUCKETS: { name: string; min: number; max: number }[] = [
  { name: "0-7天", min: 0, max: 7 },
  { name: "8-15天", min: 8, max: 15 },
  { name: "16-30天", min: 16, max: 30 },
  { name: "31-60天", min: 31, max: 60 },
  { name: "60+天", min: 61, max: 9999 },
]

function bucketOf(daysAhead: number): { name: string; min: number; max: number } | null {
  for (const b of BUCKETS) {
    if (daysAhead >= b.min && daysAhead <= b.max) return b
  }
  return null
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/**
 * 從 DB 拉所有 (PMS預估, 實際) 配對
 * @param companyId 限定某館（null = 全部）
 */
async function getTrainingPairs(companyId: number | null): Promise<RawPair[]> {
  const result = await db.execute(sql`
    WITH pms_est AS (
      SELECT snapshot_date::text, company_id, target_month,
             booked_revenue::numeric AS estimate,
             days_ahead_of_target AS days_ahead
      FROM revenue_forecast_snapshots
      WHERE source = 'pms-bridge'
        AND booked_revenue::numeric > 0
        ${companyId !== null ? sql`AND company_id = ${companyId}` : sql``}
    ),
    actual AS (
      SELECT
        CASE
          WHEN item_name LIKE '%浯島文旅%' THEN 1
          WHEN item_name LIKE '%浯島輕旅%' THEN 2
          WHEN item_name LIKE '%總兵%'   THEN 4
          WHEN item_name LIKE '%魁星%'   THEN 5
          WHEN item_name LIKE '%大號%'   THEN 6
          WHEN item_name LIKE '%小六%'   THEN 3
        END AS company_id,
        TO_CHAR(start_date, 'YYYY-MM') AS target_month,
        SUM(total_amount::numeric) AS actual
      FROM payment_items
      WHERE item_type = 'income' AND NOT is_deleted AND source = 'webhook'
      GROUP BY 1, 2
    )
    SELECT p.snapshot_date::text, p.company_id, p.target_month,
           p.estimate, p.days_ahead, a.actual,
           (a.actual / NULLIF(p.estimate, 0)) AS ratio
    FROM pms_est p
    JOIN actual a ON a.company_id = p.company_id AND a.target_month = p.target_month
    WHERE p.target_month < TO_CHAR(NOW(), 'YYYY-MM')
      AND p.estimate > 0
      AND a.actual > 0
  `)

  return (result as unknown as { rows: RawPair[] }).rows.map((r) => ({
    ...r,
    estimate: Number(r.estimate),
    actual: Number(r.actual),
    ratio: Number(r.ratio),
    days_ahead: Number(r.days_ahead),
  }))
}

/**
 * 算校準曲線
 */
export async function getCalibrationCurve(
  companyId: number | null = null
): Promise<CalibrationCurve> {
  const pairs = await getTrainingPairs(companyId)
  const byBucket = new Map<string, RawPair[]>()

  for (const p of pairs) {
    const b = bucketOf(p.days_ahead)
    if (!b) continue
    if (!byBucket.has(b.name)) byBucket.set(b.name, [])
    byBucket.get(b.name)!.push(p)
  }

  const buckets: CalibrationBucket[] = []
  for (const b of BUCKETS) {
    const list = byBucket.get(b.name) ?? []
    if (list.length === 0) continue
    const ratios = list.map((p) => p.ratio).filter((r) => isFinite(r))
    if (ratios.length === 0) continue
    buckets.push({
      bucket: b.name,
      daysAheadMin: b.min,
      daysAheadMax: b.max,
      samples: ratios.length,
      medianRatio: percentile(ratios, 50),
      p25Ratio: percentile(ratios, 25),
      p75Ratio: percentile(ratios, 75),
      meanRatio: ratios.reduce((s, r) => s + r, 0) / ratios.length,
    })
  }

  return {
    companyId,
    buckets,
    totalSamples: pairs.length,
  }
}

/**
 * 用校準模型預測指定 targetMonth 最終收入
 */
export async function predictWithCalibration(
  targetMonth: string,
  companyId: number | null = null
): Promise<CalibratedPrediction> {
  // 取 PMS 對該 targetMonth 最新一筆預估
  const latest = await db.execute(sql`
    SELECT snapshot_date::text, booked_revenue::numeric AS estimate, days_ahead_of_target AS days_ahead
    FROM revenue_forecast_snapshots
    WHERE source = 'pms-bridge'
      AND target_month = ${targetMonth}
      ${companyId !== null ? sql`AND company_id = ${companyId}` : sql``}
      AND booked_revenue::numeric > 0
    ORDER BY snapshot_date DESC
    LIMIT 1
  `)
  const rows = (latest as unknown as { rows: Array<{ estimate: string; days_ahead: number }> }).rows

  if (rows.length === 0) {
    return {
      targetMonth,
      companyId,
      currentEstimate: 0,
      daysAhead: 0,
      bucket: null,
      pointEstimate: 0,
      ci80Lower: 0,
      ci80Upper: 0,
      confidence: "insufficient",
      note: "PMS 尚無對該月的預估資料",
    }
  }

  const estimate = Number(rows[0].estimate)
  const daysAhead = Number(rows[0].days_ahead)

  // 拿校準曲線
  const curve = await getCalibrationCurve(companyId)
  const bucketDef = bucketOf(daysAhead)
  const bucket = curve.buckets.find((b) => b.bucket === bucketDef?.name) ?? null

  if (!bucket || bucket.samples < 3) {
    // 樣本不足、退化為純 PMS 估
    return {
      targetMonth,
      companyId,
      currentEstimate: estimate,
      daysAhead,
      bucket,
      pointEstimate: estimate,
      ci80Lower: estimate * 0.7,
      ci80Upper: estimate * 1.3,
      confidence: "insufficient",
      note: `${bucketDef?.name ?? "?"} 桶歷史樣本不足、退化為原始預估 ± 30%`,
    }
  }

  const confidence: CalibratedPrediction["confidence"] =
    bucket.samples >= 30
      ? "high"
      : bucket.samples >= 15
        ? "medium"
        : bucket.samples >= 5
          ? "low"
          : "insufficient"

  return {
    targetMonth,
    companyId,
    currentEstimate: estimate,
    daysAhead,
    bucket,
    pointEstimate: Math.round(estimate * bucket.medianRatio),
    ci80Lower: Math.round(estimate * bucket.p25Ratio),
    ci80Upper: Math.round(estimate * bucket.p75Ratio),
    confidence,
    note: `${bucket.bucket} 桶 ${bucket.samples} 筆樣本，中位 ratio ${bucket.medianRatio.toFixed(2)}x`,
  }
}
