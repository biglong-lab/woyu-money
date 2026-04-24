/**
 * 付款優先級演算法單元測試
 *
 * 測試範圍：
 * - 分類邏輯（classifyItem）
 * - 滯納金估算（estimateLateFee）
 * - 優先級計算（calculatePriority）
 * - 排序與分群（sortByPriority、groupByUrgency）
 * - Markdown 格式化（formatPriorityMarkdown）
 */

import { describe, it, expect } from "vitest"
import {
  CATEGORY_RULES,
  classifyItem,
  estimateLateFee,
  calculatePriority,
  sortByPriority,
  groupByUrgency,
  formatPriorityMarkdown,
  type PriorityInput,
  type CategoryKey,
} from "@shared/payment-priority"

// ─────────────────────────────────────────────
// 測試輔助：建立測試用輸入
// ─────────────────────────────────────────────
function createInput(overrides: Partial<PriorityInput> = {}): PriorityInput {
  return {
    id: 1,
    itemName: "測試項目",
    totalAmount: 10000,
    paidAmount: 0,
    dueDate: "2026-04-25",
    ...overrides,
  }
}

const TODAY = new Date("2026-04-25")

// ─────────────────────────────────────────────
// CATEGORY_RULES 結構測試
// ─────────────────────────────────────────────
describe("CATEGORY_RULES 規則表", () => {
  it("應包含所有預期的分類", () => {
    const expected: CategoryKey[] = [
      "labor_insurance",
      "tax",
      "bank_loan",
      "credit_card",
      "utility",
      "insurance",
      "rental_pay",
      "vendor",
      "other",
    ]
    for (const key of expected) {
      expect(CATEGORY_RULES[key]).toBeDefined()
      expect(CATEGORY_RULES[key].label).toBeTruthy()
    }
  })

  it("勞健保的違約後果權重應最高（90+）", () => {
    expect(CATEGORY_RULES.labor_insurance.consequenceWeight).toBeGreaterThanOrEqual(90)
  })

  it("稅務的違約後果權重應最高（90+）", () => {
    expect(CATEGORY_RULES.tax.consequenceWeight).toBeGreaterThanOrEqual(90)
  })

  it("廠商類別應比勞健保有更高的彈性", () => {
    expect(CATEGORY_RULES.vendor.flexibility).toBeGreaterThan(
      CATEGORY_RULES.labor_insurance.flexibility
    )
  })

  it("每個規則都應有滯納金率（可為 0）", () => {
    for (const rule of Object.values(CATEGORY_RULES)) {
      expect(rule.lateFeeRate).toBeGreaterThanOrEqual(0)
    }
  })
})

// ─────────────────────────────────────────────
// classifyItem 分類邏輯
// ─────────────────────────────────────────────
describe("classifyItem 分類邏輯", () => {
  it("項目名稱含「勞保」應分類為 labor_insurance", () => {
    const input = createInput({ itemName: "勞保費 4 月" })
    expect(classifyItem(input)).toBe("labor_insurance")
  })

  it("項目名稱含「健保」應分類為 labor_insurance", () => {
    const input = createInput({ itemName: "全民健保費" })
    expect(classifyItem(input)).toBe("labor_insurance")
  })

  it("項目名稱含「勞健保」應分類為 labor_insurance", () => {
    const input = createInput({ itemName: "勞健保 3 月" })
    expect(classifyItem(input)).toBe("labor_insurance")
  })

  it("項目名稱含「營業稅」應分類為 tax", () => {
    const input = createInput({ itemName: "營業稅 Q1" })
    expect(classifyItem(input)).toBe("tax")
  })

  it("項目名稱含「扣繳」應分類為 tax", () => {
    const input = createInput({ itemName: "薪資扣繳稅款" })
    expect(classifyItem(input)).toBe("tax")
  })

  it("項目名稱含「貸款」應分類為 bank_loan", () => {
    const input = createInput({ itemName: "房屋貸款" })
    expect(classifyItem(input)).toBe("bank_loan")
  })

  it("項目名稱含「信用卡」應分類為 credit_card", () => {
    const input = createInput({ itemName: "信用卡帳單" })
    expect(classifyItem(input)).toBe("credit_card")
  })

  it("項目名稱含「電費」應分類為 utility", () => {
    const input = createInput({ itemName: "電費 4 月" })
    expect(classifyItem(input)).toBe("utility")
  })

  it("項目名稱含「水費」應分類為 utility", () => {
    const input = createInput({ itemName: "水費" })
    expect(classifyItem(input)).toBe("utility")
  })

  it("項目名稱含「房租」應分類為 rental_pay", () => {
    const input = createInput({ itemName: "A 房房租" })
    expect(classifyItem(input)).toBe("rental_pay")
  })

  it("不匹配任何關鍵字應分類為 other", () => {
    const input = createInput({ itemName: "雜項支出" })
    expect(classifyItem(input)).toBe("other")
  })

  it("fixedCategoryName 優先於 itemName", () => {
    const input = createInput({
      itemName: "其他雜項",
      fixedCategoryName: "電費",
    })
    expect(classifyItem(input)).toBe("utility")
  })

  it("debtCategoryName 也可被辨識", () => {
    const input = createInput({
      itemName: "其他",
      debtCategoryName: "銀行貸款",
    })
    expect(classifyItem(input)).toBe("bank_loan")
  })

  it("notes 欄位也應被用於分類（低優先）", () => {
    const input = createInput({
      itemName: "款項",
      notes: "這是 4 月的勞健保",
    })
    expect(classifyItem(input)).toBe("labor_insurance")
  })
})

// ─────────────────────────────────────────────
// estimateLateFee 滯納金估算
// ─────────────────────────────────────────────
describe("estimateLateFee 滯納金估算", () => {
  it("未逾期項目滯納金為 0", () => {
    const input = createInput({
      itemName: "勞健保",
      totalAmount: 100000,
      dueDate: "2026-05-10",
    })
    const fee = estimateLateFee(input, TODAY)
    expect(fee.accumulated).toBe(0)
  })

  it("勞健保逾期 5 天應有滯納金累積", () => {
    const input = createInput({
      itemName: "勞健保 3 月",
      totalAmount: 100000,
      paidAmount: 0,
      dueDate: "2026-04-20", // 逾期 5 天
    })
    const fee = estimateLateFee(input, TODAY)
    expect(fee.accumulated).toBeGreaterThan(0)
    expect(fee.perDay).toBeGreaterThan(0)
  })

  it("廠商類別滯納金為 0（lateFeeRate = 0）", () => {
    const input = createInput({
      itemName: "廠商貨款",
      totalAmount: 100000,
      dueDate: "2026-04-20",
    })
    const fee = estimateLateFee(input, TODAY)
    expect(fee.accumulated).toBe(0)
    expect(fee.perDay).toBe(0)
  })

  it("已部分付款時應用未付金額計算滯納金", () => {
    const input = createInput({
      itemName: "勞健保",
      totalAmount: 100000,
      paidAmount: 60000,
      dueDate: "2026-04-20", // 逾期 5 天
    })
    const fee = estimateLateFee(input, TODAY)
    const ruleBased = 40000 * CATEGORY_RULES.labor_insurance.lateFeeRate * 5
    expect(fee.accumulated).toBeCloseTo(ruleBased, 1)
  })

  it("每日滯納金（perDay）應對應到類別規則", () => {
    const input = createInput({
      itemName: "電費",
      totalAmount: 10000,
      dueDate: "2026-04-20",
    })
    const fee = estimateLateFee(input, TODAY)
    expect(fee.perDay).toBeCloseTo(10000 * CATEGORY_RULES.utility.lateFeeRate, 2)
  })
})

// ─────────────────────────────────────────────
// calculatePriority 優先級計算
// ─────────────────────────────────────────────
describe("calculatePriority 優先級計算", () => {
  it("逾期勞健保應為 critical", () => {
    const input = createInput({
      itemName: "勞健保 3 月",
      totalAmount: 120000,
      dueDate: "2026-04-15", // 逾期 10 天
    })
    const result = calculatePriority(input, TODAY)
    expect(result.urgency).toBe("critical")
    expect(result.daysOverdue).toBe(10)
  })

  it("3 日內到期的勞健保應為 high 以上", () => {
    const input = createInput({
      itemName: "勞健保",
      totalAmount: 120000,
      dueDate: "2026-04-27", // 2 天內到期
    })
    const result = calculatePriority(input, TODAY)
    expect(["critical", "high"]).toContain(result.urgency)
  })

  it("30 天後到期的廠商款應為 low", () => {
    const input = createInput({
      itemName: "廠商貨款",
      totalAmount: 50000,
      dueDate: "2026-05-25", // 30 天後
    })
    const result = calculatePriority(input, TODAY)
    expect(result.urgency).toBe("low")
  })

  it("逾期勞健保分數應高於逾期同天數廠商款", () => {
    const insurance = calculatePriority(
      createInput({ itemName: "勞健保", totalAmount: 100000, dueDate: "2026-04-15" }),
      TODAY
    )
    const vendor = calculatePriority(
      createInput({ id: 2, itemName: "廠商貨款", totalAmount: 100000, dueDate: "2026-04-15" }),
      TODAY
    )
    expect(insurance.score).toBeGreaterThan(vendor.score)
  })

  it("已協商延後 (isNegotiated) 應大幅降低分數", () => {
    const normal = calculatePriority(
      createInput({
        itemName: "廠商貨款",
        totalAmount: 100000,
        dueDate: "2026-04-20",
      }),
      TODAY
    )
    const negotiated = calculatePriority(
      createInput({
        id: 2,
        itemName: "廠商貨款",
        totalAmount: 100000,
        dueDate: "2026-04-20",
        isNegotiated: true,
      }),
      TODAY
    )
    expect(negotiated.score).toBeLessThan(normal.score)
  })

  it("未付金額為 0 的項目分數應很低或為 0", () => {
    const input = createInput({
      totalAmount: 10000,
      paidAmount: 10000,
      dueDate: "2026-04-15",
    })
    const result = calculatePriority(input, TODAY)
    expect(result.unpaidAmount).toBe(0)
    expect(result.urgency).toBe("low")
  })

  it("應回傳至少一個可讀的原因", () => {
    const input = createInput({
      itemName: "勞健保",
      totalAmount: 100000,
      dueDate: "2026-04-15",
    })
    const result = calculatePriority(input, TODAY)
    expect(result.reasons.length).toBeGreaterThan(0)
    expect(result.reasons.join("")).toContain("逾期")
  })

  it("應正確計算未付金額", () => {
    const input = createInput({
      totalAmount: 50000,
      paidAmount: 20000,
      dueDate: "2026-04-25",
    })
    const result = calculatePriority(input, TODAY)
    expect(result.unpaidAmount).toBe(30000)
  })

  it("daysOverdue 與 daysUntilDue 不應同時 > 0", () => {
    const overdue = calculatePriority(createInput({ dueDate: "2026-04-20" }), TODAY)
    const upcoming = calculatePriority(createInput({ dueDate: "2026-05-10" }), TODAY)
    expect(overdue.daysOverdue).toBeGreaterThan(0)
    expect(overdue.daysUntilDue).toBe(0)
    expect(upcoming.daysUntilDue).toBeGreaterThan(0)
    expect(upcoming.daysOverdue).toBe(0)
  })
})

// ─────────────────────────────────────────────
// sortByPriority 排序
// ─────────────────────────────────────────────
describe("sortByPriority 排序", () => {
  it("排序結果應由高分到低分", () => {
    const inputs: PriorityInput[] = [
      createInput({ id: 1, itemName: "廠商貨款", totalAmount: 50000, dueDate: "2026-05-10" }),
      createInput({ id: 2, itemName: "勞健保", totalAmount: 100000, dueDate: "2026-04-15" }),
      createInput({ id: 3, itemName: "電費", totalAmount: 5000, dueDate: "2026-04-26" }),
    ]
    const sorted = sortByPriority(inputs, TODAY)
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].score).toBeGreaterThanOrEqual(sorted[i + 1].score)
    }
  })

  it("第一筆應為逾期的勞健保", () => {
    const inputs: PriorityInput[] = [
      createInput({ id: 1, itemName: "廠商貨款", totalAmount: 50000, dueDate: "2026-05-10" }),
      createInput({ id: 2, itemName: "勞健保", totalAmount: 100000, dueDate: "2026-04-15" }),
    ]
    const sorted = sortByPriority(inputs, TODAY)
    expect(sorted[0].id).toBe(2)
  })

  it("不應改變原始陣列", () => {
    const inputs: PriorityInput[] = [
      createInput({ id: 1, itemName: "A" }),
      createInput({ id: 2, itemName: "B" }),
    ]
    const snapshot = [...inputs]
    sortByPriority(inputs, TODAY)
    expect(inputs).toEqual(snapshot)
  })
})

// ─────────────────────────────────────────────
// groupByUrgency 分群
// ─────────────────────────────────────────────
describe("groupByUrgency 分群", () => {
  it("應正確分群為 critical/high/medium/low", () => {
    const inputs: PriorityInput[] = [
      createInput({ id: 1, itemName: "勞健保", totalAmount: 100000, dueDate: "2026-04-15" }),
      createInput({ id: 2, itemName: "廠商貨款", totalAmount: 50000, dueDate: "2026-05-20" }),
    ]
    const results = sortByPriority(inputs, TODAY)
    const groups = groupByUrgency(results)
    expect(groups.critical.length).toBeGreaterThan(0)
    expect(groups.low.length).toBeGreaterThan(0)
    expect(
      groups.critical.length + groups.high.length + groups.medium.length + groups.low.length
    ).toBe(inputs.length)
  })
})

// ─────────────────────────────────────────────
// formatPriorityMarkdown 輸出格式
// ─────────────────────────────────────────────
describe("formatPriorityMarkdown 輸出格式", () => {
  it("應包含標題與生成時間", () => {
    const md = formatPriorityMarkdown([], { now: TODAY })
    expect(md).toContain("#")
    expect(md).toContain("2026-04-25")
  })

  it("空清單應有合適提示", () => {
    const md = formatPriorityMarkdown([], { now: TODAY })
    expect(md).toMatch(/目前沒有|暫無|無需付款/)
  })

  it("應列出 critical 項目並標記醒目", () => {
    const results = sortByPriority(
      [
        createInput({
          id: 1,
          itemName: "勞健保 3 月",
          totalAmount: 120000,
          dueDate: "2026-04-15",
        }),
      ],
      TODAY
    )
    const md = formatPriorityMarkdown(results, { now: TODAY })
    expect(md).toContain("勞健保 3 月")
    expect(md).toContain("120,000")
    expect(md).toMatch(/逾期|CRITICAL|🔴/i)
  })

  it("應顯示總金額統計", () => {
    const results = sortByPriority(
      [
        createInput({ id: 1, itemName: "勞健保", totalAmount: 100000, dueDate: "2026-04-20" }),
        createInput({ id: 2, itemName: "電費", totalAmount: 5000, dueDate: "2026-04-26" }),
      ],
      TODAY
    )
    const md = formatPriorityMarkdown(results, { now: TODAY })
    expect(md).toMatch(/總.*105,000|合計.*105,000/)
  })

  it("提供 totalBudget 時應計算缺口/餘額", () => {
    const results = sortByPriority(
      [createInput({ id: 1, itemName: "勞健保", totalAmount: 200000, dueDate: "2026-04-20" })],
      TODAY
    )
    const md = formatPriorityMarkdown(results, { now: TODAY, totalBudget: 100000 })
    expect(md).toMatch(/缺口|不足|短缺/)
  })

  it("可用金額足夠時應顯示餘額", () => {
    const results = sortByPriority(
      [createInput({ id: 1, itemName: "電費", totalAmount: 5000, dueDate: "2026-04-26" })],
      TODAY
    )
    const md = formatPriorityMarkdown(results, { now: TODAY, totalBudget: 100000 })
    expect(md).toMatch(/餘額|剩餘|可用/)
  })
})
