/**
 * 勞健保月度矩陣（前後端共用純函式）
 *
 * 三列：勞保 / 健保 / 勞退（雇主負擔），× 12 月
 * - 勞保列 = 雇主勞保 + 就業保險 + 職災保險（皆由勞保局隨勞保一起收）
 * - 健保列 = 雇主健保
 * - 勞退列 = 雇主提繳勞退金
 * 資料來源：monthly_hr_costs（各員工每月雇主負擔），跨員工加總。
 * 付款狀態以「月」為單位（insurancePaid）：全付 / 部分 / 未付。
 */

export type LaborRowKey = "labor" | "health" | "pension"
export type MonthPayStatus = "paid" | "partial" | "unpaid" | "none"

export interface HrCostInput {
  month: number // 1-12
  employerLaborInsurance: number
  employerEmploymentInsurance: number
  employerAccidentInsurance: number
  employerHealthInsurance: number
  employerPension: number
  insurancePaid: boolean
}

export interface LaborMatrixCell {
  month: number
  amount: number
}

export interface LaborMatrixRow {
  key: LaborRowKey
  label: string
  cells: LaborMatrixCell[]
  total: number
}

export interface MonthSummary {
  month: number
  total: number
  paidCount: number
  recordCount: number
  status: MonthPayStatus
}

export interface LaborInsuranceMatrix {
  year: number
  months: number[]
  rows: LaborMatrixRow[]
  monthly: MonthSummary[]
  grandTotal: number
}

const ROW_DEFS: { key: LaborRowKey; label: string }[] = [
  { key: "labor", label: "勞保" },
  { key: "health", label: "健保" },
  { key: "pension", label: "勞退" },
]

function laborAmount(r: HrCostInput): number {
  return r.employerLaborInsurance + r.employerEmploymentInsurance + r.employerAccidentInsurance
}

function rowAmount(key: LaborRowKey, r: HrCostInput): number {
  if (key === "labor") return laborAmount(r)
  if (key === "health") return r.employerHealthInsurance
  return r.employerPension
}

export function buildLaborInsuranceMatrix(
  year: number,
  records: HrCostInput[]
): LaborInsuranceMatrix {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

  const rows: LaborMatrixRow[] = ROW_DEFS.map((def) => {
    const cells = months.map((m) => {
      const amount = records
        .filter((r) => r.month === m)
        .reduce((s, r) => s + rowAmount(def.key, r), 0)
      return { month: m, amount: Math.round(amount) }
    })
    return { ...def, cells, total: cells.reduce((s, c) => s + c.amount, 0) }
  })

  const monthly: MonthSummary[] = months.map((m) => {
    const monthRecords = records.filter((r) => r.month === m)
    const total = monthRecords.reduce(
      (s, r) => s + laborAmount(r) + r.employerHealthInsurance + r.employerPension,
      0
    )
    const recordCount = monthRecords.length
    const paidCount = monthRecords.filter((r) => r.insurancePaid).length
    let status: MonthPayStatus = "none"
    if (recordCount > 0) {
      if (paidCount === recordCount) status = "paid"
      else if (paidCount > 0) status = "partial"
      else status = "unpaid"
    }
    return { month: m, total: Math.round(total), paidCount, recordCount, status }
  })

  return {
    year,
    months,
    rows,
    monthly,
    grandTotal: monthly.reduce((s, x) => s + x.total, 0),
  }
}
