/**
 * 租金月度矩陣（前後端共用純函式）
 *
 * 第 7 步：把每月 × 每個租約的付款狀態視覺化
 */

export type CellStatus = "paid" | "partial" | "unpaid" | "upcoming" | "out_of_contract"

export interface RentalContractInfo {
  id: number
  contractName: string
  tenantName?: string | null
  startDate: string // YYYY-MM-DD
  endDate: string
  monthlyAmount: number
}

export interface MonthlyPayment {
  contractId: number
  month: number // 1-12
  paidAmount: number
}

export interface MatrixCell {
  contractId: number
  month: number
  status: CellStatus
  paidAmount: number
  expectedAmount: number
}

export interface RentalMatrix {
  year: number
  months: number[]
  contracts: RentalContractInfo[]
  cells: MatrixCell[]
  totals: {
    expected: number
    paid: number
    unpaid: number
    paidCount: number
    unpaidCount: number
  }
}

function parseYearMonth(dateStr: string): { year: number; month: number } {
  const d = new Date(dateStr)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function isMonthInContract(
  year: number,
  month: number,
  start: { year: number; month: number },
  end: { year: number; month: number }
): boolean {
  const cur = year * 12 + month
  const s = start.year * 12 + start.month
  const e = end.year * 12 + end.month
  return cur >= s && cur <= e
}

function isMonthInFuture(year: number, month: number, today: Date): boolean {
  const cur = year * 12 + month
  const now = today.getFullYear() * 12 + (today.getMonth() + 1)
  return cur > now
}

function buildCell(
  contract: RentalContractInfo,
  year: number,
  month: number,
  paidAmount: number,
  today: Date
): MatrixCell {
  const start = parseYearMonth(contract.startDate)
  const end = parseYearMonth(contract.endDate)
  const expected = contract.monthlyAmount

  if (!isMonthInContract(year, month, start, end)) {
    return {
      contractId: contract.id,
      month,
      status: "out_of_contract",
      paidAmount: 0,
      expectedAmount: 0,
    }
  }

  let status: CellStatus
  if (paidAmount >= expected) status = "paid"
  else if (paidAmount > 0) status = "partial"
  else if (isMonthInFuture(year, month, today)) status = "upcoming"
  else status = "unpaid"

  return {
    contractId: contract.id,
    month,
    status,
    paidAmount,
    expectedAmount: expected,
  }
}

function getPaid(payments: MonthlyPayment[], contractId: number, month: number): number {
  const match = payments.find((p) => p.contractId === contractId && p.month === month)
  return match?.paidAmount ?? 0
}

export function buildRentalMatrix(
  contracts: RentalContractInfo[],
  payments: MonthlyPayment[],
  year: number,
  today: Date = new Date()
): RentalMatrix {
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const cells: MatrixCell[] = []

  for (const contract of contracts) {
    for (const month of months) {
      const paid = getPaid(payments, contract.id, month)
      cells.push(buildCell(contract, year, month, paid, today))
    }
  }

  let expected = 0
  let paidTotal = 0
  let paidCount = 0
  let unpaidCount = 0

  for (const cell of cells) {
    if (cell.status === "out_of_contract" || cell.status === "upcoming") continue
    expected += cell.expectedAmount
    paidTotal += cell.paidAmount
    if (cell.status === "paid") paidCount++
    if (cell.status === "unpaid" || cell.status === "partial") unpaidCount++
  }

  return {
    year,
    months,
    contracts,
    cells,
    totals: {
      expected,
      paid: paidTotal,
      unpaid: Math.max(0, expected - paidTotal),
      paidCount,
      unpaidCount,
    },
  }
}
