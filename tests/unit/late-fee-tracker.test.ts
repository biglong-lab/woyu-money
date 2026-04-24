/**
 * 勞健保滯納金追蹤單元測試
 *
 * 測試範圍：
 * - isLaborInsurance：識別勞健保項目
 * - calculateUnpaidLateFee：未付項目累積滯納金
 * - calculatePaidLateFee：已付項目歷史滯納金
 * - aggregateAnnualLoss：年度損失報告
 * - getReminderLevel：依日期判斷提醒等級
 */

import { describe, it, expect } from "vitest"
import {
  isLaborInsurance,
  calculateUnpaidLateFee,
  calculatePaidLateFee,
  aggregateAnnualLoss,
  getReminderLevel,
  shouldRemindToday,
  LABOR_INSURANCE_LATE_FEE_RATE,
  type LateFeeItem,
  type PaymentHistory,
} from "@shared/late-fee-tracker"

// ─────────────────────────────────────────────
// isLaborInsurance
// ─────────────────────────────────────────────

describe("isLaborInsurance 識別勞健保項目", () => {
  it("項目名稱含「勞健保」應為 true", () => {
    expect(isLaborInsurance("勞健保 3 月")).toBe(true)
  })
  it("項目名稱含「勞保」應為 true", () => {
    expect(isLaborInsurance("勞保費")).toBe(true)
  })
  it("項目名稱含「健保」應為 true", () => {
    expect(isLaborInsurance("全民健保")).toBe(true)
  })
  it("項目名稱含「二代健保」應為 true", () => {
    expect(isLaborInsurance("二代健保")).toBe(true)
  })
  it("廠商貨款不是勞健保", () => {
    expect(isLaborInsurance("廠商貨款")).toBe(false)
  })
  it("categoryName 有勞健保也應為 true", () => {
    expect(isLaborInsurance("其他項目", "勞健保")).toBe(true)
  })
  it("空字串應為 false", () => {
    expect(isLaborInsurance("")).toBe(false)
  })
})

// ─────────────────────────────────────────────
// calculateUnpaidLateFee 未付項目累積滯納金
// ─────────────────────────────────────────────

const TODAY = new Date("2026-04-25")

function createItem(overrides: Partial<LateFeeItem> = {}): LateFeeItem {
  return {
    id: 1,
    itemName: "勞健保 3 月",
    totalAmount: 100000,
    paidAmount: 0,
    dueDate: "2026-04-15",
    ...overrides,
  }
}

describe("calculateUnpaidLateFee 未付項目累積滯納金", () => {
  it("逾期 10 天應累積對應滯納金", () => {
    const item = createItem({ dueDate: "2026-04-15" })
    const fee = calculateUnpaidLateFee(item, TODAY)
    expect(fee).toBeCloseTo(100000 * LABOR_INSURANCE_LATE_FEE_RATE * 10, 1)
  })

  it("未逾期項目滯納金為 0", () => {
    const item = createItem({ dueDate: "2026-05-01" })
    expect(calculateUnpaidLateFee(item, TODAY)).toBe(0)
  })

  it("已部分付款時用未付金額計算", () => {
    const item = createItem({ totalAmount: 100000, paidAmount: 40000, dueDate: "2026-04-15" })
    const fee = calculateUnpaidLateFee(item, TODAY)
    expect(fee).toBeCloseTo(60000 * LABOR_INSURANCE_LATE_FEE_RATE * 10, 1)
  })

  it("已付清應為 0", () => {
    const item = createItem({ totalAmount: 100000, paidAmount: 100000, dueDate: "2026-04-15" })
    expect(calculateUnpaidLateFee(item, TODAY)).toBe(0)
  })

  it("自訂 lateFeeRate 應覆蓋預設值", () => {
    const item = createItem({ lateFeeRate: 0.01, dueDate: "2026-04-15" })
    const fee = calculateUnpaidLateFee(item, TODAY)
    expect(fee).toBeCloseTo(100000 * 0.01 * 10, 1)
  })
})

// ─────────────────────────────────────────────
// calculatePaidLateFee 已付項目歷史滯納金
// ─────────────────────────────────────────────

function createHistory(overrides: Partial<PaymentHistory> = {}): PaymentHistory {
  return {
    itemId: 1,
    itemName: "勞健保 3 月",
    totalAmount: 100000,
    amountPaid: 100000,
    dueDate: "2026-03-25",
    paymentDate: "2026-04-05",
    ...overrides,
  }
}

describe("calculatePaidLateFee 已付項目歷史滯納金", () => {
  it("按時付款滯納金為 0", () => {
    const h = createHistory({ dueDate: "2026-03-25", paymentDate: "2026-03-25" })
    expect(calculatePaidLateFee(h)).toBe(0)
  })

  it("提前付款滯納金為 0", () => {
    const h = createHistory({ dueDate: "2026-03-25", paymentDate: "2026-03-20" })
    expect(calculatePaidLateFee(h)).toBe(0)
  })

  it("延遲付款應計算逾期天數 × 金額 × 費率", () => {
    // 3/25 到期，4/5 付款 → 逾期 11 天
    const h = createHistory({
      totalAmount: 100000,
      amountPaid: 100000,
      dueDate: "2026-03-25",
      paymentDate: "2026-04-05",
    })
    const fee = calculatePaidLateFee(h)
    expect(fee).toBeCloseTo(100000 * LABOR_INSURANCE_LATE_FEE_RATE * 11, 1)
  })

  it("使用 amountPaid 而非 totalAmount 計算", () => {
    const h = createHistory({
      totalAmount: 100000,
      amountPaid: 40000,
      dueDate: "2026-03-25",
      paymentDate: "2026-04-05",
    })
    const fee = calculatePaidLateFee(h)
    expect(fee).toBeCloseTo(40000 * LABOR_INSURANCE_LATE_FEE_RATE * 11, 1)
  })
})

// ─────────────────────────────────────────────
// aggregateAnnualLoss 年度損失報告
// ─────────────────────────────────────────────

describe("aggregateAnnualLoss 年度損失報告", () => {
  it("空輸入應回傳零值報告", () => {
    const report = aggregateAnnualLoss([], [], 2026, TODAY)
    expect(report.year).toBe(2026)
    expect(report.itemCount).toBe(0)
    expect(report.totalPrincipal).toBe(0)
    expect(report.totalLateFee).toBe(0)
    expect(report.lossPercentage).toBe(0)
    expect(report.items).toHaveLength(0)
  })

  it("應彙總未付 + 已付逾期的滯納金", () => {
    const unpaid: LateFeeItem[] = [
      createItem({ id: 1, totalAmount: 100000, paidAmount: 0, dueDate: "2026-04-15" }),
    ]
    const paid: PaymentHistory[] = [
      createHistory({
        itemId: 2,
        itemName: "勞健保 1 月",
        totalAmount: 80000,
        amountPaid: 80000,
        dueDate: "2026-01-25",
        paymentDate: "2026-02-05",
      }),
    ]
    const report = aggregateAnnualLoss(unpaid, paid, 2026, TODAY)
    expect(report.itemCount).toBe(2)
    expect(report.totalPrincipal).toBe(180000)
    expect(report.totalLateFee).toBeGreaterThan(0)
    expect(report.items).toHaveLength(2)
  })

  it("應只含指定年度的項目（by dueDate）", () => {
    const paid: PaymentHistory[] = [
      createHistory({
        itemId: 1,
        dueDate: "2026-01-25",
        paymentDate: "2026-02-05",
      }),
      createHistory({
        itemId: 2,
        dueDate: "2025-11-25", // 上一年
        paymentDate: "2025-12-05",
      }),
    ]
    const report = aggregateAnnualLoss([], paid, 2026, TODAY)
    expect(report.itemCount).toBe(1)
    expect(report.items[0].itemId).toBe(1)
  })

  it("lossPercentage 應為滯納金 / 本金", () => {
    const unpaid: LateFeeItem[] = [
      createItem({ id: 1, totalAmount: 100000, paidAmount: 0, dueDate: "2026-04-15" }),
    ]
    const report = aggregateAnnualLoss(unpaid, [], 2026, TODAY)
    const expectedPct = (report.totalLateFee / report.totalPrincipal) * 100
    expect(report.lossPercentage).toBeCloseTo(expectedPct, 1)
  })

  it("準時付款不計入損失但仍計入項目", () => {
    const paid: PaymentHistory[] = [
      createHistory({
        itemId: 1,
        dueDate: "2026-01-25",
        paymentDate: "2026-01-25", // 當日付款
      }),
    ]
    const report = aggregateAnnualLoss([], paid, 2026, TODAY)
    expect(report.itemCount).toBe(1)
    expect(report.totalLateFee).toBe(0)
    expect(report.items[0].status).toBe("paid_on_time")
  })

  it("逾期付款狀態應為 paid_late", () => {
    const paid: PaymentHistory[] = [
      createHistory({
        itemId: 1,
        dueDate: "2026-01-25",
        paymentDate: "2026-02-10",
      }),
    ]
    const report = aggregateAnnualLoss([], paid, 2026, TODAY)
    expect(report.items[0].status).toBe("paid_late")
  })

  it("未付狀態應為 unpaid", () => {
    const unpaid: LateFeeItem[] = [createItem({ id: 1, dueDate: "2026-04-15" })]
    const report = aggregateAnnualLoss(unpaid, [], 2026, TODAY)
    expect(report.items[0].status).toBe("unpaid")
  })
})

// ─────────────────────────────────────────────
// getReminderLevel / shouldRemindToday
// ─────────────────────────────────────────────

describe("getReminderLevel 提醒等級判斷", () => {
  it("月初 1 號應為 none", () => {
    expect(getReminderLevel(new Date("2026-04-01"))).toBe("none")
  })
  it("月中 15 號應為 none", () => {
    expect(getReminderLevel(new Date("2026-04-15"))).toBe("none")
  })
  it("20 號應為 early", () => {
    expect(getReminderLevel(new Date("2026-04-20"))).toBe("early")
  })
  it("25 號應為 warning", () => {
    expect(getReminderLevel(new Date("2026-04-25"))).toBe("warning")
  })
  it("28 號應為 final", () => {
    expect(getReminderLevel(new Date("2026-04-28"))).toBe("final")
  })
  it("月底 30 號應為 final", () => {
    expect(getReminderLevel(new Date("2026-04-30"))).toBe("final")
  })
  it("21-24 號之間應為 early", () => {
    expect(getReminderLevel(new Date("2026-04-22"))).toBe("early")
  })
  it("26-27 號應為 warning", () => {
    expect(getReminderLevel(new Date("2026-04-27"))).toBe("warning")
  })
})

describe("shouldRemindToday", () => {
  it("1 號不應提醒", () => {
    expect(shouldRemindToday(new Date("2026-04-01"))).toBe(false)
  })
  it("20 號應提醒", () => {
    expect(shouldRemindToday(new Date("2026-04-20"))).toBe(true)
  })
  it("25 號應提醒", () => {
    expect(shouldRemindToday(new Date("2026-04-25"))).toBe(true)
  })
  it("28 號應提醒", () => {
    expect(shouldRemindToday(new Date("2026-04-28"))).toBe(true)
  })
})
