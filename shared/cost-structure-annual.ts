/**
 * 年度成本結構（前後端共用純函式）
 *
 * 五桶 × 12 月，預算 vs 實際：
 *  - rental  租金
 *  - hr      人事（含勞健保，勞健保矩陣為其下鑽明細）
 *  - fixed   固定開銷（週期模板）
 *  - ledger  流水雜支（expense_ledger，每筆即已花費，無預算）
 *  - manual  其他單項（一般 payment_items）
 *
 * 設計：各桶在後端以 SQL 依月份加總後丟進來，本函式只負責組裝矩陣、
 * 小計、占比（避免雙算的排除邏輯在 SQL 層處理）。
 */

export type BucketKey = "rental" | "hr" | "fixed" | "ledger" | "manual"

export interface BucketMonthInput {
  bucket: BucketKey
  month: number // 1-12
  budget: number
  actual: number
}

export interface CostBucketCell {
  month: number
  budget: number
  actual: number
}

export interface CostBucketRow {
  key: BucketKey
  label: string
  cells: CostBucketCell[]
  budgetTotal: number
  actualTotal: number
  sharePct: number // 占實際總成本百分比（0-100，四捨五入到 1 位）
}

export interface AnnualMonthSummary {
  month: number
  budget: number
  actual: number
}

export interface AnnualCostStructure {
  year: number
  months: number[]
  buckets: CostBucketRow[]
  monthly: AnnualMonthSummary[]
  totals: { budget: number; actual: number; diff: number }
}

const BUCKET_DEFS: { key: BucketKey; label: string }[] = [
  { key: "rental", label: "租金" },
  { key: "hr", label: "人事（含勞健保）" },
  { key: "fixed", label: "固定開銷" },
  { key: "ledger", label: "流水雜支" },
  { key: "manual", label: "其他單項" },
]

export function buildAnnualCostStructure(
  year: number,
  inputs: BucketMonthInput[]
): AnnualCostStructure {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

  // index：bucket|month → {budget, actual}
  const map = new Map<string, { budget: number; actual: number }>()
  for (const i of inputs) {
    const key = `${i.bucket}|${i.month}`
    const prev = map.get(key) ?? { budget: 0, actual: 0 }
    map.set(key, { budget: prev.budget + i.budget, actual: prev.actual + i.actual })
  }

  const grandActual = inputs.reduce((s, i) => s + i.actual, 0)

  const buckets: CostBucketRow[] = BUCKET_DEFS.map((def) => {
    const cells = months.map((m) => {
      const v = map.get(`${def.key}|${m}`) ?? { budget: 0, actual: 0 }
      return { month: m, budget: Math.round(v.budget), actual: Math.round(v.actual) }
    })
    const budgetTotal = cells.reduce((s, c) => s + c.budget, 0)
    const actualTotal = cells.reduce((s, c) => s + c.actual, 0)
    const sharePct = grandActual > 0 ? Math.round((actualTotal / grandActual) * 1000) / 10 : 0
    return { ...def, cells, budgetTotal, actualTotal, sharePct }
  })

  const monthly: AnnualMonthSummary[] = months.map((m) => {
    let budget = 0
    let actual = 0
    for (const b of buckets) {
      const c = b.cells[m - 1]
      budget += c.budget
      actual += c.actual
    }
    return { month: m, budget, actual }
  })

  const totalBudget = buckets.reduce((s, b) => s + b.budgetTotal, 0)
  const totalActual = buckets.reduce((s, b) => s + b.actualTotal, 0)

  return {
    year,
    months,
    buckets,
    monthly,
    totals: { budget: totalBudget, actual: totalActual, diff: totalActual - totalBudget },
  }
}
