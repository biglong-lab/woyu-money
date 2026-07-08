/**
 * 統一現金流匯總層 — 純函式單元測試
 *
 * 目標：把強執分期繳款 / 歷史欠款還款 / 信用卡請款到帳
 * 投影進統一報表（現金流量表、儀表板 YTD、現金流預測）
 */
import { describe, it, expect } from "vitest"
import {
  projectEnforcementMonthly,
  mergeMonthlyAmounts,
  buildUnifiedOperating,
  ENFORCEMENT_CATEGORY,
  LEGACY_DEBT_CATEGORY,
  type MonthlyAmount,
} from "../../server/services/unified-cashflow.service"

// ─────────────────────────────────────────────
// projectEnforcementMonthly：強執分期未來月投影
// ─────────────────────────────────────────────

describe("projectEnforcementMonthly", () => {
  it("periods 未定（null）→ 視窗內每月都投影", () => {
    const out = projectEnforcementMonthly(
      [{ monthlyAmount: 50000, periods: null, paidCount: 0, startDate: null }],
      2026,
      7,
      3
    )
    expect(out).toEqual([
      { year: 2026, month: 7, amount: 50000 },
      { year: 2026, month: 8, amount: 50000 },
      { year: 2026, month: 9, amount: 50000 },
    ])
  })

  it("有期數 → 只投影剩餘期數（periods - paidCount）", () => {
    const out = projectEnforcementMonthly(
      [{ monthlyAmount: 30000, periods: 10, paidCount: 8, startDate: null }],
      2026,
      7,
      6
    )
    // 剩 2 期 → 只投影 7、8 月
    expect(out).toEqual([
      { year: 2026, month: 7, amount: 30000 },
      { year: 2026, month: 8, amount: 30000 },
    ])
  })

  it("已繳完（paidCount >= periods）→ 不投影", () => {
    const out = projectEnforcementMonthly(
      [{ monthlyAmount: 30000, periods: 5, paidCount: 5, startDate: null }],
      2026,
      7,
      6
    )
    expect(out).toEqual([])
  })

  it("startDate 在未來 → 從開始月才投影", () => {
    const out = projectEnforcementMonthly(
      [{ monthlyAmount: 20000, periods: null, paidCount: 0, startDate: "2026-09-15" }],
      2026,
      7,
      4
    )
    expect(out).toEqual([
      { year: 2026, month: 9, amount: 20000 },
      { year: 2026, month: 10, amount: 20000 },
    ])
  })

  it("跨年投影（11 月起看 4 個月 → 到隔年 2 月）", () => {
    const out = projectEnforcementMonthly(
      [{ monthlyAmount: 10000, periods: null, paidCount: 0, startDate: null }],
      2026,
      11,
      4
    )
    expect(out).toEqual([
      { year: 2026, month: 11, amount: 10000 },
      { year: 2026, month: 12, amount: 10000 },
      { year: 2027, month: 1, amount: 10000 },
      { year: 2027, month: 2, amount: 10000 },
    ])
  })

  it("多筆分期同月合併加總", () => {
    const out = projectEnforcementMonthly(
      [
        { monthlyAmount: 10000, periods: null, paidCount: 0, startDate: null },
        { monthlyAmount: 5000, periods: 1, paidCount: 0, startDate: null },
      ],
      2026,
      7,
      2
    )
    expect(out).toEqual([
      { year: 2026, month: 7, amount: 15000 },
      { year: 2026, month: 8, amount: 10000 },
    ])
  })
})

// ─────────────────────────────────────────────
// mergeMonthlyAmounts：多來源月度金額合併
// ─────────────────────────────────────────────

describe("mergeMonthlyAmounts", () => {
  it("同月加總、不同月各自保留、依年月排序", () => {
    const a: MonthlyAmount[] = [
      { year: 2026, month: 8, amount: 100 },
      { year: 2026, month: 7, amount: 50 },
    ]
    const b: MonthlyAmount[] = [
      { year: 2026, month: 7, amount: 30 },
      { year: 2027, month: 1, amount: 20 },
    ]
    expect(mergeMonthlyAmounts(a, b)).toEqual([
      { year: 2026, month: 7, amount: 80 },
      { year: 2026, month: 8, amount: 100 },
      { year: 2027, month: 1, amount: 20 },
    ])
  })

  it("空清單回空陣列", () => {
    expect(mergeMonthlyAmounts([], [])).toEqual([])
  })
})

// ─────────────────────────────────────────────
// buildUnifiedOperating：現金流量表營業活動組裝
// ─────────────────────────────────────────────

describe("buildUnifiedOperating", () => {
  it("強執/欠款繳款以獨立負項列入、總計扣除", () => {
    const out = buildUnifiedOperating({
      baseIncome: 500000,
      baseExpense: 300000,
      enforcementPaid: 40000,
      legacyDebtPaid: 10000,
    })
    expect(out.items).toEqual([
      { category: "營業收入", amount: 500000 },
      { category: "營業支出", amount: -300000 },
      { category: ENFORCEMENT_CATEGORY, amount: -40000 },
      { category: LEGACY_DEBT_CATEGORY, amount: -10000 },
    ])
    expect(out.total).toBe(150000)
  })

  it("強執/欠款為 0 時不列出（維持原兩行）", () => {
    const out = buildUnifiedOperating({
      baseIncome: 100,
      baseExpense: 60,
      enforcementPaid: 0,
      legacyDebtPaid: 0,
    })
    expect(out.items).toEqual([
      { category: "營業收入", amount: 100 },
      { category: "營業支出", amount: -60 },
    ])
    expect(out.total).toBe(40)
  })
})
