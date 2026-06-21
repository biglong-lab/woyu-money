/**
 * 勞健保矩陣純函式 — buildLaborInsuranceMatrix
 */
import { describe, it, expect } from "vitest"
import { buildLaborInsuranceMatrix, type HrCostInput } from "../../shared/labor-insurance-matrix"

function rec(month: number, over: Partial<HrCostInput> = {}): HrCostInput {
  return {
    month,
    employerLaborInsurance: 2000,
    employerEmploymentInsurance: 200,
    employerAccidentInsurance: 100,
    employerHealthInsurance: 1500,
    employerPension: 1800,
    insurancePaid: false,
    ...over,
  }
}

describe("buildLaborInsuranceMatrix", () => {
  it("三列、勞保含就業＋職災", () => {
    const m = buildLaborInsuranceMatrix(2026, [rec(1)])
    expect(m.rows.map((r) => r.key)).toEqual(["labor", "health", "pension"])
    const labor = m.rows.find((r) => r.key === "labor")!
    expect(labor.cells.find((c) => c.month === 1)!.amount).toBe(2300) // 2000+200+100
    expect(m.rows.find((r) => r.key === "health")!.cells[0].amount).toBe(1500)
    expect(m.rows.find((r) => r.key === "pension")!.cells[0].amount).toBe(1800)
  })

  it("跨員工同月加總", () => {
    const m = buildLaborInsuranceMatrix(2026, [rec(3), rec(3)])
    const health = m.rows.find((r) => r.key === "health")!
    expect(health.cells.find((c) => c.month === 3)!.amount).toBe(3000)
  })

  it("每月合計 = 勞保+健保+勞退、grandTotal 加總", () => {
    const m = buildLaborInsuranceMatrix(2026, [rec(5)])
    const may = m.monthly.find((x) => x.month === 5)!
    expect(may.total).toBe(2300 + 1500 + 1800) // 5600
    expect(m.grandTotal).toBe(5600)
  })

  it("付款狀態：全付/部分/未付/無資料", () => {
    const m = buildLaborInsuranceMatrix(2026, [
      rec(1, { insurancePaid: true }),
      rec(1, { insurancePaid: true }), // 1 月全付
      rec(2, { insurancePaid: true }),
      rec(2, { insurancePaid: false }), // 2 月部分
      rec(3, { insurancePaid: false }), // 3 月未付
    ])
    expect(m.monthly.find((x) => x.month === 1)!.status).toBe("paid")
    expect(m.monthly.find((x) => x.month === 2)!.status).toBe("partial")
    expect(m.monthly.find((x) => x.month === 3)!.status).toBe("unpaid")
    expect(m.monthly.find((x) => x.month === 6)!.status).toBe("none")
  })
})
