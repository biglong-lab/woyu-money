/**
 * 年度成本結構純函式 — buildAnnualCostStructure
 */
import { describe, it, expect } from "vitest"
import { buildAnnualCostStructure, type BucketMonthInput } from "../../shared/cost-structure-annual"

describe("buildAnnualCostStructure", () => {
  it("五桶、各 12 格", () => {
    const m = buildAnnualCostStructure(2026, [])
    expect(m.buckets.map((b) => b.key)).toEqual(["rental", "hr", "fixed", "ledger", "manual"])
    for (const b of m.buckets) expect(b.cells).toHaveLength(12)
    expect(m.monthly).toHaveLength(12)
  })

  it("同桶同月加總、小計與每月彙總正確", () => {
    const inputs: BucketMonthInput[] = [
      { bucket: "rental", month: 1, budget: 50000, actual: 50000 },
      { bucket: "rental", month: 1, budget: 10000, actual: 0 }, // 同月再加
      { bucket: "hr", month: 1, budget: 80000, actual: 80000 },
      { bucket: "ledger", month: 1, budget: 0, actual: 1200 },
    ]
    const m = buildAnnualCostStructure(2026, inputs)
    const rental = m.buckets.find((b) => b.key === "rental")!
    expect(rental.cells[0]).toEqual({ month: 1, budget: 60000, actual: 50000 })
    const jan = m.monthly.find((x) => x.month === 1)!
    expect(jan.budget).toBe(60000 + 80000 + 0) // ledger budget=0
    expect(jan.actual).toBe(50000 + 80000 + 1200)
  })

  it("占比 sharePct 以實際總成本為分母", () => {
    const m = buildAnnualCostStructure(2026, [
      { bucket: "rental", month: 1, budget: 0, actual: 75 },
      { bucket: "hr", month: 1, budget: 0, actual: 25 },
    ])
    expect(m.buckets.find((b) => b.key === "rental")!.sharePct).toBe(75)
    expect(m.buckets.find((b) => b.key === "hr")!.sharePct).toBe(25)
  })

  it("totals.diff = 實際 − 預算", () => {
    const m = buildAnnualCostStructure(2026, [
      { bucket: "manual", month: 2, budget: 1000, actual: 1200 },
    ])
    expect(m.totals.budget).toBe(1000)
    expect(m.totals.actual).toBe(1200)
    expect(m.totals.diff).toBe(200)
  })

  it("空輸入 sharePct 為 0、不除以零", () => {
    const m = buildAnnualCostStructure(2026, [])
    expect(m.buckets.every((b) => b.sharePct === 0)).toBe(true)
    expect(m.totals.actual).toBe(0)
  })
})
