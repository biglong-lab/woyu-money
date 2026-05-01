/**
 * 預估回沖配對邏輯測試
 *
 * PR-2 更新：fixed_categories 已合併至 debt_categories，
 *           簡化為 categoryId + project_month 兩級配對。
 *
 * 涵蓋：
 * - 2 種優先級配對
 * - 邊界條件
 * - variance 計算
 */

import { describe, it, expect } from "vitest"
import {
  matchBudgetItem,
  calcVariance,
  type PaymentItemForMatch,
  type BudgetItemCandidate,
} from "../../shared/budget-reconcile"

const TODAY = "2026-04-15"

function makeBudget(partial: Partial<BudgetItemCandidate>): BudgetItemCandidate {
  return {
    id: 1,
    budgetPlanId: 100,
    categoryId: null,
    targetProjectId: 4,
    startDate: "2026-04-01",
    attribution: "single",
    plannedAmount: "10000",
    ...partial,
  }
}

function makePayment(partial: Partial<PaymentItemForMatch>): PaymentItemForMatch {
  return {
    id: 999,
    projectId: 4,
    categoryId: null,
    startDate: TODAY,
    ...partial,
  }
}

// ─────────────────────────────────────────────
// 優先級 1：categoryId 配對
// ─────────────────────────────────────────────

describe("matchBudgetItem - 優先級 1：categoryId 配對", () => {
  it("相同 categoryId → category", () => {
    const payment = makePayment({ categoryId: 7 })
    const candidates = [
      makeBudget({ id: 1, categoryId: 5 }),
      makeBudget({ id: 2, categoryId: 7 }),
      makeBudget({ id: 3, categoryId: 9 }),
    ]
    const result = matchBudgetItem(payment, candidates)
    expect(result.budgetItemId).toBe(2)
    expect(result.priority).toBe("category")
  })

  it("payment 沒 categoryId → 跳過此級，看寬鬆配對", () => {
    const payment = makePayment({ categoryId: null })
    const candidates = [makeBudget({ id: 5, categoryId: null })]
    const result = matchBudgetItem(payment, candidates)
    expect(result.budgetItemId).toBe(5)
    expect(result.priority).toBe("project_month")
  })

  it("候選 categoryId 不同 → 不配對", () => {
    const payment = makePayment({ categoryId: 7 })
    const candidates = [makeBudget({ id: 5, categoryId: 8 })]
    const result = matchBudgetItem(payment, candidates)
    expect(result.budgetItemId).toBeNull()
  })
})

// ─────────────────────────────────────────────
// 優先級 2：寬鬆配對（project_month）
// ─────────────────────────────────────────────

describe("matchBudgetItem - 優先級 2：寬鬆配對", () => {
  it("唯一 1 筆無分類預估 → 配對", () => {
    const payment = makePayment({})
    const candidates = [makeBudget({ id: 99, categoryId: null })]
    const result = matchBudgetItem(payment, candidates)
    expect(result.budgetItemId).toBe(99)
    expect(result.priority).toBe("project_month")
  })

  it("有 2 筆無分類預估 → 不配對（避免錯配）", () => {
    const payment = makePayment({})
    const candidates = [
      makeBudget({ id: 1, categoryId: null }),
      makeBudget({ id: 2, categoryId: null }),
    ]
    const result = matchBudgetItem(payment, candidates)
    expect(result.budgetItemId).toBeNull()
    expect(result.priority).toBe("none")
  })
})

// ─────────────────────────────────────────────
// 過濾條件
// ─────────────────────────────────────────────

describe("matchBudgetItem - 過濾條件", () => {
  it("不同月份不配對", () => {
    const payment = makePayment({ startDate: "2026-04-15" })
    const candidates = [makeBudget({ startDate: "2026-05-01" })]
    const result = matchBudgetItem(payment, candidates)
    expect(result.budgetItemId).toBeNull()
  })

  it("不同專案不配對", () => {
    const payment = makePayment({ projectId: 4 })
    const candidates = [makeBudget({ targetProjectId: 99 })]
    const result = matchBudgetItem(payment, candidates)
    expect(result.budgetItemId).toBeNull()
  })

  it("attribution='shared' 排除", () => {
    const payment = makePayment({ categoryId: 7 })
    const candidates = [
      makeBudget({ id: 1, categoryId: 7, attribution: "shared" }),
      makeBudget({ id: 2, categoryId: 7, attribution: "single" }),
    ]
    const result = matchBudgetItem(payment, candidates)
    expect(result.budgetItemId).toBe(2)
  })

  it("attribution='company' 排除", () => {
    const payment = makePayment({ categoryId: 7 })
    const candidates = [makeBudget({ id: 1, categoryId: 7, attribution: "company" })]
    const result = matchBudgetItem(payment, candidates)
    expect(result.budgetItemId).toBeNull()
  })

  it("attribution=null 視為 single（向後相容）", () => {
    const payment = makePayment({ categoryId: 7 })
    const candidates = [makeBudget({ id: 1, categoryId: 7, attribution: null })]
    const result = matchBudgetItem(payment, candidates)
    expect(result.budgetItemId).toBe(1)
  })
})

// ─────────────────────────────────────────────
// 邊界條件
// ─────────────────────────────────────────────

describe("matchBudgetItem - 邊界條件", () => {
  it("payment 無 projectId → 不配對", () => {
    const payment = makePayment({ projectId: null })
    const candidates = [makeBudget({})]
    const result = matchBudgetItem(payment, candidates)
    expect(result.budgetItemId).toBeNull()
  })

  it("空候選 → 不配對", () => {
    const payment = makePayment({})
    const result = matchBudgetItem(payment, [])
    expect(result.budgetItemId).toBeNull()
  })

  it("payment.startDate 是 ISO timestamp 也能解析", () => {
    const payment = makePayment({ startDate: "2026-04-15T10:00:00.000Z" })
    const candidates = [makeBudget({ id: 99, categoryId: null })]
    const result = matchBudgetItem(payment, candidates)
    expect(result.budgetItemId).toBe(99)
  })
})

// ─────────────────────────────────────────────
// calcVariance
// ─────────────────────────────────────────────

describe("calcVariance", () => {
  it("實際 = 預估 → variance=0, percent=0", () => {
    const v = calcVariance(10000, 10000)
    expect(v.variance).toBe(0)
    expect(v.variancePercentage).toBe(0)
  })

  it("超支：預估 18,000、實際 24,000 → +6000, +33.33%", () => {
    const v = calcVariance(18000, 24000)
    expect(v.variance).toBe(6000)
    expect(v.variancePercentage).toBe(33.33)
  })

  it("節省：預估 18,000、實際 12,000 → -6000, -33.33%", () => {
    const v = calcVariance(18000, 12000)
    expect(v.variance).toBe(-6000)
    expect(v.variancePercentage).toBe(-33.33)
  })

  it("預估 0 → percent=0（避免除以零）", () => {
    const v = calcVariance(0, 5000)
    expect(v.variance).toBe(5000)
    expect(v.variancePercentage).toBe(0)
  })

  it("實際 0（漏記）→ -100%", () => {
    const v = calcVariance(10000, 0)
    expect(v.variance).toBe(-10000)
    expect(v.variancePercentage).toBe(-100)
  })
})
