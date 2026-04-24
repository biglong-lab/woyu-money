/**
 * 收據自動對應單元測試
 */

import { describe, it, expect } from "vitest"
import { matchReceiptToItems, type ReceiptInput, type CandidateItem } from "@shared/receipt-matcher"

function item(overrides: Partial<CandidateItem> = {}): CandidateItem {
  return {
    id: 1,
    itemName: "電費 4 月",
    totalAmount: 12000,
    paidAmount: 0,
    startDate: "2026-04-01",
    endDate: "2026-04-30",
    categoryName: "電費",
    ...overrides,
  }
}

describe("matchReceiptToItems", () => {
  it("空候選清單應回傳無結果", () => {
    const r = matchReceiptToItems({ amount: 1000 }, [])
    expect(r.bestMatch).toBeNull()
    expect(r.candidates).toHaveLength(0)
    expect(r.autoConfirmable).toBe(false)
  })

  it("金額完全相符應獲高分", () => {
    const r = matchReceiptToItems({ amount: 12000, receiptDate: "2026-04-15" }, [item()])
    expect(r.bestMatch).not.toBeNull()
    expect(r.bestMatch!.score).toBeGreaterThanOrEqual(50)
  })

  it("金額 + 日期 + 分類全符應 auto-confirmable", () => {
    const r = matchReceiptToItems(
      { amount: 12000, receiptDate: "2026-04-15", category: "電費", vendor: "電費 4 月" },
      [item()]
    )
    expect(r.autoConfirmable).toBe(true)
    expect(r.bestMatch!.confidence).toBe("high")
  })

  it("金額完全不符應為低信心", () => {
    const r = matchReceiptToItems({ amount: 99999 }, [item()])
    // 項目未付 +10 但金額不符 → 低分、非 auto-confirmable
    expect(r.bestMatch?.confidence).toBe("low")
    expect(r.autoConfirmable).toBe(false)
  })

  it("應依分數由高到低排序", () => {
    const items = [
      item({ id: 1, totalAmount: 12000 }), // 精確
      item({ id: 2, totalAmount: 11000 }), // 近似
      item({ id: 3, totalAmount: 50000 }), // 不符
    ]
    const r = matchReceiptToItems({ amount: 12000 }, items)
    expect(r.candidates[0].item.id).toBe(1)
  })

  it("topN 應限制回傳數量", () => {
    const items = Array.from({ length: 5 }, (_, i) => item({ id: i + 1, totalAmount: 12000 }))
    const r = matchReceiptToItems({ amount: 12000 }, items, { topN: 2 })
    expect(r.candidates).toHaveLength(2)
  })

  it("未付項目應比已付項目分數高（相同其他條件下）", () => {
    const unpaid = item({ id: 1, paidAmount: 0 })
    const paid = item({ id: 2, paidAmount: 12000 })
    const r = matchReceiptToItems({ amount: 12000 }, [unpaid, paid])
    expect(r.candidates[0].item.id).toBe(1)
  })

  it("金額相等未付餘額（分期尾款）應最優先", () => {
    const installment = item({
      id: 1,
      itemName: "分期 3/6",
      totalAmount: 30000,
      paidAmount: 18000, // 未付 12000
    })
    const exact = item({ id: 2, totalAmount: 12000 })
    const r = matchReceiptToItems({ amount: 12000 }, [installment, exact])
    // 兩者都有匹配，分期的未付額匹配(60) > 精確總額匹配(55)
    expect(r.candidates[0].item.id).toBe(1)
  })

  it("收據日期超出項目範圍應無日期加分", () => {
    const withDate = matchReceiptToItems({ amount: 12000, receiptDate: "2026-04-15" }, [item()])
    const outDate = matchReceiptToItems({ amount: 12000, receiptDate: "2026-12-15" }, [item()])
    expect(withDate.bestMatch!.score).toBeGreaterThan(outDate.bestMatch!.score)
  })

  it("autoConfirmThreshold 可自訂", () => {
    const r = matchReceiptToItems({ amount: 12000 }, [item()], {
      autoConfirmThreshold: 30,
    })
    expect(r.autoConfirmable).toBe(true)
  })

  it("OCR 文字含項目名應加分", () => {
    const r1 = matchReceiptToItems({ amount: 12000, ocrText: "台電 電費 4 月繳費單" }, [item()])
    const r2 = matchReceiptToItems({ amount: 12000 }, [item()])
    expect(r1.bestMatch!.score).toBeGreaterThan(r2.bestMatch!.score)
  })
})
