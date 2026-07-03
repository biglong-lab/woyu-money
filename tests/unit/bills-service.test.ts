/**
 * bills.service 單元測試 — 強執分期投影、月底日夾限、風險分級、彙總
 */
import { describe, it, expect } from "vitest"
import {
  dueDayInMonth,
  projectInstallmentDues,
  classifyBills,
  summarizeBills,
  type BillRow,
} from "../../server/services/bills.service"

function bill(overrides: Partial<BillRow>): BillRow {
  return {
    source: "payment_item",
    refId: 1,
    name: "測試帳單",
    amount: 1000,
    billIssuedDate: null,
    dueDate: null,
    finalDueDate: null,
    penaltyNote: null,
    status: "pending",
    ...overrides,
  }
}

describe("dueDayInMonth 月底日夾限", () => {
  it("一般日不變（2026-07 的 15 → 15）", () => {
    expect(dueDayInMonth(2026, 6, 15)).toBe(15)
  })
  it("31 日在 2 月（平年）→ 28", () => {
    expect(dueDayInMonth(2026, 1, 31)).toBe(28)
  })
  it("31 日在閏年 2 月 → 29", () => {
    expect(dueDayInMonth(2028, 1, 31)).toBe(29)
  })
  it("31 日在 4 月（小月）→ 30，不再一律夾 28", () => {
    expect(dueDayInMonth(2026, 3, 31)).toBe(30)
  })
  it("30 日在 1 月（大月）→ 30（舊版會錯夾成 28）", () => {
    expect(dueDayInMonth(2026, 0, 30)).toBe(30)
  })
  it("無效日（0 / NaN）fallback 10 號", () => {
    expect(dueDayInMonth(2026, 6, 0)).toBe(10)
    expect(dueDayInMonth(2026, 6, NaN)).toBe(10)
  })
})

describe("projectInstallmentDues 分期投影", () => {
  const inst = { refId: 7, name: "執行處分期", amount: 5000, dayOfMonth: 10 }

  it("投影本月與下月各一筆", () => {
    const out = projectInstallmentDues([inst], "2026-07-03", 45)
    expect(out).toHaveLength(2)
    expect(out[0].dueDate).toBe("2026-07-10")
    expect(out[1].dueDate).toBe("2026-08-10")
    expect(out[0].name).toBe("執行處分期（強執分期）")
    expect(out[0].source).toBe("enforcement_installment")
  })

  it("超出 days 視窗的下月投影被排除", () => {
    // 7/3 基準、視窗 7 天：7/10 在內、8/10 超出
    const out = projectInstallmentDues([inst], "2026-07-03", 7)
    expect(out).toHaveLength(1)
    expect(out[0].dueDate).toBe("2026-07-10")
  })

  it("月底日 31 在跨月時分別取各月實際月底", () => {
    const eom = { refId: 8, name: "月底繳", amount: 100, dayOfMonth: 31 }
    const out = projectInstallmentDues([eom], "2026-01-15", 120)
    expect(out[0].dueDate).toBe("2026-01-31")
    expect(out[1].dueDate).toBe("2026-02-28")
  })

  it("空清單回空陣列", () => {
    expect(projectInstallmentDues([], "2026-07-03", 45)).toEqual([])
  })
})

describe("classifyBills 風險分級", () => {
  const today = "2026-07-03"

  it("已過最終必繳日 → penalty", () => {
    const [b] = classifyBills([bill({ dueDate: "2026-06-01", finalDueDate: "2026-07-01" })], today)
    expect(b.urgency).toBe("penalty")
    expect(b.penaltyRisk).toBe(true)
  })

  it("過法定但最終必繳日未到 → grace", () => {
    const [b] = classifyBills([bill({ dueDate: "2026-07-01", finalDueDate: "2026-07-20" })], today)
    expect(b.urgency).toBe("grace")
    expect(b.overdue).toBe(true)
    expect(b.penaltyRisk).toBe(false)
  })

  it("過期且無最終必繳日 → overdue", () => {
    const [b] = classifyBills([bill({ dueDate: "2026-07-01" })], today)
    expect(b.urgency).toBe("overdue")
  })

  it("7 天內到期 → soon；之後 → upcoming", () => {
    const [soon, upcoming] = classifyBills(
      [bill({ dueDate: "2026-07-08" }), bill({ dueDate: "2026-07-30" })],
      today
    )
    expect(soon.urgency).toBe("soon")
    expect(upcoming.urgency).toBe("upcoming")
  })

  it("依到期日排序", () => {
    const out = classifyBills(
      [bill({ dueDate: "2026-08-01" }), bill({ dueDate: "2026-07-05" })],
      today
    )
    expect(out[0].dueDate).toBe("2026-07-05")
  })
})

describe("summarizeBills 彙總", () => {
  it("加總 totalDue / overdueTotal / penaltyRiskTotal", () => {
    const today = "2026-07-03"
    const classified = classifyBills(
      [
        bill({ amount: 100, dueDate: "2026-07-30" }), // upcoming
        bill({ amount: 200, dueDate: "2026-07-01" }), // overdue
        bill({ amount: 300, dueDate: "2026-06-01", finalDueDate: "2026-07-01" }), // penalty
      ],
      today
    )
    const s = summarizeBills(classified)
    expect(s.count).toBe(3)
    expect(s.totalDue).toBe(600)
    expect(s.overdueTotal).toBe(500) // overdue + penalty 都過期
    expect(s.penaltyRiskTotal).toBe(300)
  })
})

describe("projectInstallmentDues 已繳月份排除（立即處理後消失）", () => {
  const inst = { refId: 7, name: "執行處分期", amount: 5000, dayOfMonth: 10 }

  it("本月已繳足 → 只投影下月", () => {
    const paid = new Map([[7, new Map([["2026-07", 5000]])]])
    const out = projectInstallmentDues([inst], "2026-07-03", 45, paid)
    expect(out).toHaveLength(1)
    expect(out[0].dueDate).toBe("2026-08-10")
  })

  it("本月部分繳 → 投影剩餘金額", () => {
    const paid = new Map([[7, new Map([["2026-07", 2000]])]])
    const out = projectInstallmentDues([inst], "2026-07-03", 45, paid)
    expect(out[0].dueDate).toBe("2026-07-10")
    expect(out[0].amount).toBe(3000)
  })

  it("繳超過月付額 → 該月不投影、不出現負數", () => {
    const paid = new Map([[7, new Map([["2026-07", 6000]])]])
    const out = projectInstallmentDues([inst], "2026-07-03", 45, paid)
    expect(out).toHaveLength(1)
    expect(out[0].dueDate).toBe("2026-08-10")
  })

  it("無 paidByMonth → 行為不變（向後相容）", () => {
    const out = projectInstallmentDues([inst], "2026-07-03", 45)
    expect(out).toHaveLength(2)
  })
})
