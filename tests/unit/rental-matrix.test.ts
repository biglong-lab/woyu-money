/**
 * 租金月度矩陣單元測試
 */

import { describe, it, expect } from "vitest"
import {
  buildRentalMatrix,
  type RentalContractInfo,
  type MonthlyPayment,
} from "@shared/rental-matrix"

function contract(overrides: Partial<RentalContractInfo> = {}): RentalContractInfo {
  return {
    id: 1,
    contractName: "A 房",
    tenantName: "張先生",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    monthlyAmount: 18000,
    ...overrides,
  }
}

const TODAY = new Date("2026-04-25")

describe("buildRentalMatrix", () => {
  it("無合約應回傳空矩陣但 months=12", () => {
    const m = buildRentalMatrix([], [], 2026, TODAY)
    expect(m.months).toHaveLength(12)
    expect(m.cells).toHaveLength(0)
    expect(m.totals.expected).toBe(0)
  })

  it("單合約全年 12 格", () => {
    const c = contract()
    const m = buildRentalMatrix([c], [], 2026, TODAY)
    expect(m.cells).toHaveLength(12)
  })

  it("合約外月份標記為 out_of_contract", () => {
    const c = contract({ startDate: "2026-04-01", endDate: "2026-12-31" })
    const m = buildRentalMatrix([c], [], 2026, TODAY)
    const jan = m.cells.find((x) => x.month === 1)
    const apr = m.cells.find((x) => x.month === 4)
    expect(jan?.status).toBe("out_of_contract")
    expect(apr?.status).not.toBe("out_of_contract")
  })

  it("已付足應為 paid", () => {
    const c = contract()
    const payments: MonthlyPayment[] = [{ contractId: 1, month: 1, paidAmount: 18000 }]
    const m = buildRentalMatrix([c], payments, 2026, TODAY)
    const cell = m.cells.find((x) => x.month === 1)
    expect(cell?.status).toBe("paid")
  })

  it("部分付款應為 partial", () => {
    const c = contract()
    const payments: MonthlyPayment[] = [{ contractId: 1, month: 1, paidAmount: 10000 }]
    const m = buildRentalMatrix([c], payments, 2026, TODAY)
    const cell = m.cells.find((x) => x.month === 1)
    expect(cell?.status).toBe("partial")
  })

  it("過去月份未付為 unpaid", () => {
    const c = contract()
    const m = buildRentalMatrix([c], [], 2026, TODAY)
    // 1~3 月都是過去，未付 → unpaid
    expect(m.cells.find((x) => x.month === 2)?.status).toBe("unpaid")
  })

  it("未來月份未付為 upcoming", () => {
    const c = contract()
    const m = buildRentalMatrix([c], [], 2026, TODAY)
    // 5 月以後為 upcoming（TODAY=4/25）
    expect(m.cells.find((x) => x.month === 6)?.status).toBe("upcoming")
    expect(m.cells.find((x) => x.month === 12)?.status).toBe("upcoming")
  })

  it("本月未付仍算 unpaid（非 upcoming）", () => {
    const c = contract()
    const m = buildRentalMatrix([c], [], 2026, TODAY)
    expect(m.cells.find((x) => x.month === 4)?.status).toBe("unpaid")
  })

  it("跨年 TODAY 應正確比對 upcoming", () => {
    const c = contract({ startDate: "2025-01-01", endDate: "2027-12-31" })
    const m = buildRentalMatrix([c], [], 2027, TODAY)
    expect(m.cells.find((x) => x.month === 1)?.status).toBe("upcoming")
  })

  it("totals 計算只含合約內的月份", () => {
    const c = contract({ startDate: "2026-01-01", endDate: "2026-06-30" })
    const payments: MonthlyPayment[] = [
      { contractId: 1, month: 1, paidAmount: 18000 },
      { contractId: 1, month: 2, paidAmount: 18000 },
    ]
    const m = buildRentalMatrix([c], payments, 2026, TODAY)
    // 1~4 月為過去/本月，5~6 月為 upcoming
    // expected 累計只加 1~4 月（非 upcoming、非 out_of_contract）
    expect(m.totals.expected).toBe(18000 * 4)
    expect(m.totals.paid).toBe(18000 * 2)
    expect(m.totals.paidCount).toBe(2)
    expect(m.totals.unpaidCount).toBe(2)
  })

  it("多合約時應分別產生 cells", () => {
    const a = contract({ id: 1, contractName: "A" })
    const b = contract({ id: 2, contractName: "B" })
    const m = buildRentalMatrix([a, b], [], 2026, TODAY)
    expect(m.cells).toHaveLength(24)
  })

  it("totals.unpaid = expected - paid", () => {
    const c = contract()
    const payments: MonthlyPayment[] = [{ contractId: 1, month: 1, paidAmount: 18000 }]
    const m = buildRentalMatrix([c], payments, 2026, TODAY)
    expect(m.totals.unpaid).toBe(m.totals.expected - m.totals.paid)
  })
})
