/**
 * 固定開銷矩陣純函式 — buildFixedExpenseMatrix / parseActiveMonths
 */
import { describe, it, expect } from "vitest"
import {
  buildFixedExpenseMatrix,
  parseActiveMonths,
  type FixedExpenseTemplateInfo,
} from "../../shared/fixed-expense-matrix"

describe("parseActiveMonths", () => {
  it("'*' 與空字串 = 全部 12 月", () => {
    expect(parseActiveMonths("*").size).toBe(12)
    expect(parseActiveMonths("").size).toBe(12)
  })
  it("指定月份集合", () => {
    const s = parseActiveMonths("1,6,12")
    expect([...s].sort((a, b) => a - b)).toEqual([1, 6, 12])
  })
  it("忽略越界月份", () => {
    expect(parseActiveMonths("0,13,5").has(5)).toBe(true)
    expect(parseActiveMonths("0,13,5").has(0)).toBe(false)
    expect(parseActiveMonths("0,13,5").has(13)).toBe(false)
  })
})

describe("buildFixedExpenseMatrix", () => {
  const templates: FixedExpenseTemplateInfo[] = [
    { id: 1, templateName: "勞健保", categoryId: 10, estimatedAmount: 30000, activeMonths: "*" },
    { id: 2, templateName: "年度保險", categoryId: 11, estimatedAmount: 12000, activeMonths: "6" },
  ]

  it("預算僅在 active 月計入；全年模板 12 月皆有預算", () => {
    const m = buildFixedExpenseMatrix(2026, templates, [])
    expect(m.totals.budget).toBe(30000 * 12 + 12000) // 月月勞健保 + 一次保險
    const t2Cells = m.cells.filter((c) => c.templateId === 2)
    expect(t2Cells.filter((c) => c.active).length).toBe(1)
    expect(t2Cells.find((c) => c.month === 6)?.budget).toBe(12000)
    expect(t2Cells.find((c) => c.month === 1)?.budget).toBe(0)
  })

  it("實際付款依月份聚合、計算差異與超支數", () => {
    const m = buildFixedExpenseMatrix(2026, templates, [
      { templateId: 1, month: 1, amount: 32000 }, // 超支 +2000
      { templateId: 1, month: 2, amount: 28000 }, // 結餘 -2000
      { templateId: 2, month: 6, amount: 12000 }, // 持平
    ])
    const jan = m.cells.find((c) => c.templateId === 1 && c.month === 1)!
    expect(jan.actual).toBe(32000)
    expect(jan.diff).toBe(2000)
    expect(m.totals.actual).toBe(32000 + 28000 + 12000)
    expect(m.totals.overBudgetCount).toBe(1) // 只有 1 月超支
  })

  it("每月縱向小計正確", () => {
    const m = buildFixedExpenseMatrix(2026, templates, [{ templateId: 1, month: 6, amount: 30000 }])
    const jun = m.monthlyTotals.find((x) => x.month === 6)!
    expect(jun.budget).toBe(30000 + 12000) // 勞健保 + 保險
    expect(jun.actual).toBe(30000)
  })
})
