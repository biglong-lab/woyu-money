/**
 * 收入預估單元測試
 */

import { describe, it, expect } from "vitest"
import {
  forecastRevenue,
  analyzeCashflowGap,
  type MonthlyRevenue,
  type MonthlyExpense,
} from "@shared/revenue-forecaster"

function rev(year: number, month: number, amount: number): MonthlyRevenue {
  return { year, month, amount }
}

function exp(year: number, month: number, amount: number): MonthlyExpense {
  return { year, month, amount }
}

describe("forecastRevenue", () => {
  it("空歷史應全部 no_data confidence=low", () => {
    const r = forecastRevenue([], 2026, 5, 3)
    expect(r.months).toHaveLength(3)
    expect(r.months.every((m) => m.basis === "no_data")).toBe(true)
    expect(r.months.every((m) => m.confidence === "low")).toBe(true)
    expect(r.months.every((m) => m.estimated === 0)).toBe(true)
  })

  it("有去年同月資料應使用 last_year_same_month", () => {
    const history: MonthlyRevenue[] = [
      rev(2025, 5, 100000),
      rev(2025, 6, 120000),
      rev(2025, 7, 110000),
    ]
    const r = forecastRevenue(history, 2026, 5, 3)
    expect(r.months[0].basis).toBe("last_year_same_month")
    expect(r.months[1].basis).toBe("last_year_same_month")
    expect(r.months[2].basis).toBe("last_year_same_month")
  })

  it("預估應考慮成長率", () => {
    // 上半年平均 80000，下半年平均 120000 → 成長率 +50%
    const history: MonthlyRevenue[] = [
      rev(2025, 1, 80000),
      rev(2025, 2, 80000),
      rev(2025, 3, 80000),
      rev(2025, 4, 80000),
      rev(2025, 5, 80000),
      rev(2025, 6, 80000),
      rev(2025, 7, 120000),
      rev(2025, 8, 120000),
      rev(2025, 9, 120000),
      rev(2025, 10, 120000),
      rev(2025, 11, 120000),
      rev(2025, 12, 120000),
    ]
    const r = forecastRevenue(history, 2026, 1, 1)
    // 2026/1 用去年同月 80000 × (1 + 成長率) 應 > 80000
    expect(r.months[0].estimated).toBeGreaterThan(80000)
    expect(r.trend.growthRate).toBeGreaterThan(0)
  })

  it("缺去年同月但有近期資料應用 recent_average", () => {
    const history: MonthlyRevenue[] = [
      rev(2026, 1, 100000),
      rev(2026, 2, 110000),
      rev(2026, 3, 105000),
    ]
    const r = forecastRevenue(history, 2026, 4, 2)
    expect(r.months[0].basis).toBe("recent_average")
    expect(r.months[0].confidence).toBe("medium")
  })

  it("跨年預估應正確處理月份", () => {
    const history: MonthlyRevenue[] = [rev(2025, 1, 100000), rev(2025, 2, 100000)]
    const r = forecastRevenue(history, 2025, 12, 3)
    // 從 2025/12 開始 3 個月 → 12, 2026/1, 2026/2
    expect(r.months[0].year).toBe(2025)
    expect(r.months[0].month).toBe(12)
    expect(r.months[1].year).toBe(2026)
    expect(r.months[1].month).toBe(1)
    expect(r.months[2].year).toBe(2026)
    expect(r.months[2].month).toBe(2)
  })

  it("monthsAhead=0 應回傳空 months", () => {
    const r = forecastRevenue([rev(2025, 5, 100000)], 2026, 1, 0)
    expect(r.months).toHaveLength(0)
  })

  it("trend 應反映歷史資料", () => {
    const history: MonthlyRevenue[] = Array.from({ length: 12 }, (_, i) => rev(2025, i + 1, 100000))
    const r = forecastRevenue(history, 2026, 1, 3)
    expect(r.trend.recentAvg).toBeCloseTo(100000, 0)
  })
})

describe("analyzeCashflowGap", () => {
  it("收入 > 支出應為正淨額", () => {
    const forecast = forecastRevenue([rev(2025, 5, 100000)], 2026, 5, 1)
    const expenses: MonthlyExpense[] = [exp(2026, 5, 50000)]
    const analysis = analyzeCashflowGap(forecast, expenses)
    expect(analysis).toHaveLength(1)
    expect(analysis[0].net).toBeGreaterThan(0)
    expect(analysis[0].gap).toBeUndefined()
  })

  it("收入 < 支出應標示缺口", () => {
    const forecast = forecastRevenue([rev(2025, 5, 50000)], 2026, 5, 1)
    const expenses: MonthlyExpense[] = [exp(2026, 5, 100000)]
    const analysis = analyzeCashflowGap(forecast, expenses)
    expect(analysis[0].net).toBeLessThan(0)
    expect(analysis[0].gap).toBeGreaterThan(0)
    expect(analysis[0].recommendation).toBeDefined()
  })

  it("缺口月份應有具體建議文字", () => {
    const forecast = forecastRevenue([rev(2025, 5, 50000)], 2026, 5, 1)
    const expenses: MonthlyExpense[] = [exp(2026, 5, 100000)]
    const analysis = analyzeCashflowGap(forecast, expenses)
    expect(analysis[0].recommendation).toMatch(/建議|延後|提前|準備/)
  })

  it("找不到對應月份支出應視為 0", () => {
    const forecast = forecastRevenue([rev(2025, 5, 100000)], 2026, 5, 1)
    const analysis = analyzeCashflowGap(forecast, [])
    expect(analysis[0].estimatedExpense).toBe(0)
    expect(analysis[0].net).toBeGreaterThan(0)
  })
})
