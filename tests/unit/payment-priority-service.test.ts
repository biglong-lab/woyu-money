/**
 * Payment Priority Service 單元測試
 *
 * 測試範圍（純函式層，不連 DB）：
 * - buildPriorityReport：優先級報告組裝
 * - buildAllocation：現金分配演算法
 * - mapRawRowsToInputs：DB row → PriorityInput 轉換
 */

import { describe, it, expect, vi } from "vitest"
import {
  buildPriorityReport,
  buildAllocation,
  mapRawRowsToInputs,
  getPriorityReportWith,
  suggestAllocationWith,
  getPriorityReport,
  suggestAllocation,
  type RawUnpaidRow,
  type UnpaidItemsFetcher,
} from "../../server/services/payment-priority.service"
import { type PriorityInput } from "@shared/payment-priority"

// Mock server/db 以便測試公開 API（getPriorityReport / suggestAllocation）
// 這些函式透過 dynamic import 載入 db.pool，vi.mock 可以攔截
vi.mock("../../server/db", () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}))

const TODAY = new Date("2026-04-25")

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

// ─────────────────────────────────────────────
// buildPriorityReport
// ─────────────────────────────────────────────

describe("buildPriorityReport 優先級報告", () => {
  it("空陣列應回傳空報告但結構完整", () => {
    const report = buildPriorityReport([], TODAY)
    expect(report.all).toHaveLength(0)
    expect(report.totalUnpaid).toBe(0)
    expect(report.counts.critical).toBe(0)
    expect(report.counts.high).toBe(0)
    expect(report.counts.medium).toBe(0)
    expect(report.counts.low).toBe(0)
    expect(report.byUrgency.critical).toHaveLength(0)
    expect(report.generatedAt).toEqual(TODAY)
  })

  it("應依 urgency 分群並計數", () => {
    const items: PriorityInput[] = [
      createInput({ id: 1, itemName: "勞健保", totalAmount: 100000, dueDate: "2026-04-15" }),
      createInput({ id: 2, itemName: "廠商貨款", totalAmount: 50000, dueDate: "2026-06-30" }),
      createInput({ id: 3, itemName: "電費", totalAmount: 5000, dueDate: "2026-04-27" }),
    ]
    const report = buildPriorityReport(items, TODAY)
    expect(report.counts.critical).toBeGreaterThan(0)
    expect(
      report.counts.critical + report.counts.high + report.counts.medium + report.counts.low
    ).toBe(3)
  })

  it("totalUnpaid 應為所有未付金額加總", () => {
    const items: PriorityInput[] = [
      createInput({ id: 1, totalAmount: 10000, paidAmount: 0 }),
      createInput({ id: 2, totalAmount: 20000, paidAmount: 5000 }),
      createInput({ id: 3, totalAmount: 3000, paidAmount: 3000 }),
    ]
    const report = buildPriorityReport(items, TODAY)
    expect(report.totalUnpaid).toBe(10000 + 15000 + 0)
  })

  it("all 欄位應按分數由高至低排序", () => {
    const items: PriorityInput[] = [
      createInput({ id: 1, itemName: "廠商貨款", totalAmount: 50000, dueDate: "2026-05-10" }),
      createInput({ id: 2, itemName: "勞健保", totalAmount: 100000, dueDate: "2026-04-15" }),
    ]
    const report = buildPriorityReport(items, TODAY)
    expect(report.all[0].id).toBe(2)
    expect(report.all[0].score).toBeGreaterThan(report.all[1].score)
  })
})

// ─────────────────────────────────────────────
// buildAllocation
// ─────────────────────────────────────────────

describe("buildAllocation 現金分配演算法", () => {
  it("預算足夠時應全部列為 suggested", () => {
    const items: PriorityInput[] = [
      createInput({ id: 1, itemName: "電費", totalAmount: 5000, dueDate: "2026-04-27" }),
      createInput({ id: 2, itemName: "廠商貨款", totalAmount: 10000, dueDate: "2026-05-10" }),
    ]
    const result = buildAllocation(items, 100000, TODAY)
    expect(result.suggested).toHaveLength(2)
    expect(result.deferred).toHaveLength(0)
    expect(result.shortage).toBe(0)
    expect(result.surplus).toBeGreaterThan(0)
  })

  it("critical 項目無論預算都必須進 suggested", () => {
    const items: PriorityInput[] = [
      createInput({
        id: 1,
        itemName: "勞健保 3 月",
        totalAmount: 500000,
        dueDate: "2026-04-15",
      }),
    ]
    const result = buildAllocation(items, 100000, TODAY) // 預算遠不足
    expect(result.suggested).toHaveLength(1)
    expect(result.suggested[0].id).toBe(1)
    expect(result.shortage).toBe(400000)
  })

  it("medium / low 項目在預算不足時應延後", () => {
    const items: PriorityInput[] = [
      createInput({
        id: 1,
        itemName: "勞健保",
        totalAmount: 80000,
        dueDate: "2026-04-15", // critical（逾期）
      }),
      createInput({
        id: 2,
        itemName: "廠商 A",
        totalAmount: 30000,
        dueDate: "2026-06-30", // low
      }),
      createInput({
        id: 3,
        itemName: "廠商 B",
        totalAmount: 20000,
        dueDate: "2026-06-30", // low
      }),
    ]
    const result = buildAllocation(items, 100000, TODAY)
    // Critical 80000 強制進 → 剩 20000
    // 低優先 30000 無法進 → 延後
    // 低優先 20000 剛好可進
    const suggestedIds = result.suggested.map((r) => r.id)
    expect(suggestedIds).toContain(1)
    expect(result.deferred.length).toBeGreaterThan(0)
  })

  it("預算為 0 時仍應列出 critical + high（shortage 全額）", () => {
    const items: PriorityInput[] = [
      createInput({
        id: 1,
        itemName: "勞健保",
        totalAmount: 100000,
        dueDate: "2026-04-15",
      }),
      createInput({
        id: 2,
        itemName: "廠商貨款",
        totalAmount: 50000,
        dueDate: "2026-08-15", // low
      }),
    ]
    const result = buildAllocation(items, 0, TODAY)
    expect(result.suggested).toHaveLength(1) // 只有 critical
    expect(result.suggested[0].id).toBe(1)
    expect(result.shortage).toBe(100000)
    expect(result.deferred).toHaveLength(1)
  })

  it("空項目應回傳乾淨結果", () => {
    const result = buildAllocation([], 100000, TODAY)
    expect(result.suggested).toHaveLength(0)
    expect(result.deferred).toHaveLength(0)
    expect(result.shortage).toBe(0)
    expect(result.surplus).toBe(100000)
    expect(result.totalNeeded).toBe(0)
  })

  it("應產出 markdown 報告", () => {
    const items: PriorityInput[] = [
      createInput({
        id: 1,
        itemName: "勞健保",
        totalAmount: 100000,
        dueDate: "2026-04-15",
      }),
    ]
    const result = buildAllocation(items, 150000, TODAY)
    expect(result.markdown).toContain("勞健保")
    expect(result.markdown).toContain("100,000")
  })

  it("totalNeeded 應為 suggested + deferred 未付金額", () => {
    const items: PriorityInput[] = [
      createInput({ id: 1, totalAmount: 50000, dueDate: "2026-04-15" }),
      createInput({ id: 2, totalAmount: 30000, dueDate: "2026-06-30" }),
    ]
    const result = buildAllocation(items, 40000, TODAY)
    expect(result.totalNeeded).toBe(80000)
    expect(result.suggestedTotal + result.deferredTotal).toBe(result.totalNeeded)
  })

  it("已全部付清的項目不應出現在 suggested 也不應出現在 deferred", () => {
    const items: PriorityInput[] = [
      createInput({
        id: 1,
        itemName: "已付完",
        totalAmount: 10000,
        paidAmount: 10000,
        dueDate: "2026-04-15",
      }),
      createInput({
        id: 2,
        itemName: "勞健保",
        totalAmount: 100000,
        dueDate: "2026-04-15",
      }),
    ]
    const result = buildAllocation(items, 100000, TODAY)
    const allIds = [...result.suggested, ...result.deferred].map((r) => r.id)
    expect(allIds).not.toContain(1)
    expect(allIds).toContain(2)
  })
})

// ─────────────────────────────────────────────
// mapRawRowsToInputs
// ─────────────────────────────────────────────

describe("mapRawRowsToInputs DB 列轉換", () => {
  it("應正確轉換 string 金額為 number", () => {
    const rows: RawUnpaidRow[] = [
      {
        id: 1,
        itemName: "測試",
        totalAmount: "10000.00",
        paidAmount: "2500.00",
        dueDate: "2026-04-25",
        fixedCategoryName: null,
        debtCategoryName: null,
        projectName: null,
        notes: null,
      },
    ]
    const inputs = mapRawRowsToInputs(rows)
    expect(inputs[0].totalAmount).toBe(10000)
    expect(inputs[0].paidAmount).toBe(2500)
  })

  it("number 金額也應正確處理", () => {
    const rows: RawUnpaidRow[] = [
      {
        id: 1,
        itemName: "測試",
        totalAmount: 8000,
        paidAmount: 0,
        dueDate: "2026-04-25",
        fixedCategoryName: null,
        debtCategoryName: null,
        projectName: null,
        notes: null,
      },
    ]
    const inputs = mapRawRowsToInputs(rows)
    expect(inputs[0].totalAmount).toBe(8000)
  })

  it("null 欄位應保留為 null", () => {
    const rows: RawUnpaidRow[] = [
      {
        id: 1,
        itemName: "測試",
        totalAmount: "1000",
        paidAmount: "0",
        dueDate: "2026-04-25",
        fixedCategoryName: null,
        debtCategoryName: null,
        projectName: null,
        notes: null,
      },
    ]
    const inputs = mapRawRowsToInputs(rows)
    expect(inputs[0].fixedCategoryName).toBeNull()
    expect(inputs[0].notes).toBeNull()
  })

  it("空陣列應回傳空陣列", () => {
    expect(mapRawRowsToInputs([])).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────
// getPriorityReportWith（依賴注入測試）
// ─────────────────────────────────────────────

function createMockFetcher(rows: RawUnpaidRow[]): UnpaidItemsFetcher {
  return async () => rows
}

function createRawRow(overrides: Partial<RawUnpaidRow> = {}): RawUnpaidRow {
  return {
    id: 1,
    itemName: "測試項目",
    totalAmount: "10000",
    paidAmount: "0",
    dueDate: "2026-04-25",
    fixedCategoryName: null,
    debtCategoryName: null,
    projectName: null,
    notes: null,
    ...overrides,
  }
}

describe("getPriorityReportWith 依賴注入", () => {
  it("應透過 fetcher 取得資料並回傳 report", async () => {
    const fetcher = createMockFetcher([
      createRawRow({ id: 1, itemName: "勞健保", totalAmount: "100000", dueDate: "2026-04-15" }),
    ])
    const report = await getPriorityReportWith(fetcher, { asOf: TODAY })
    expect(report.all).toHaveLength(1)
    expect(report.all[0].itemName).toBe("勞健保")
  })

  it("預設不包含 low urgency 項目", async () => {
    const fetcher = createMockFetcher([
      createRawRow({ id: 1, itemName: "勞健保", totalAmount: "100000", dueDate: "2026-04-15" }),
      createRawRow({ id: 2, itemName: "廠商貨款", totalAmount: "50000", dueDate: "2026-08-15" }),
    ])
    const report = await getPriorityReportWith(fetcher, { asOf: TODAY })
    const ids = report.all.map((r) => r.id)
    expect(ids).toContain(1)
    expect(ids).not.toContain(2)
    expect(report.counts.low).toBe(0)
  })

  it("includeLow: true 應包含所有項目", async () => {
    const fetcher = createMockFetcher([
      createRawRow({ id: 1, itemName: "勞健保", totalAmount: "100000", dueDate: "2026-04-15" }),
      createRawRow({ id: 2, itemName: "廠商貨款", totalAmount: "50000", dueDate: "2026-08-15" }),
    ])
    const report = await getPriorityReportWith(fetcher, { asOf: TODAY, includeLow: true })
    expect(report.all).toHaveLength(2)
  })

  it("asOf 未提供時應使用當前時間", async () => {
    const fetcher = createMockFetcher([])
    const report = await getPriorityReportWith(fetcher)
    expect(report.generatedAt).toBeInstanceOf(Date)
    expect(report.all).toHaveLength(0)
  })
})

describe("suggestAllocationWith 依賴注入", () => {
  it("應透過 fetcher 取得資料並回傳 allocation", async () => {
    const fetcher = createMockFetcher([
      createRawRow({ id: 1, itemName: "勞健保", totalAmount: "100000", dueDate: "2026-04-15" }),
    ])
    const result = await suggestAllocationWith(fetcher, {
      availableBudget: 150000,
      asOf: TODAY,
    })
    expect(result.suggested).toHaveLength(1)
    expect(result.availableBudget).toBe(150000)
  })

  it("asOf 未提供時應使用當前時間", async () => {
    const fetcher = createMockFetcher([])
    const result = await suggestAllocationWith(fetcher, { availableBudget: 10000 })
    expect(result.generatedAt).toBeInstanceOf(Date)
    expect(result.suggested).toHaveLength(0)
    expect(result.surplus).toBe(10000)
  })
})

// ─────────────────────────────────────────────
// 公開 API：getPriorityReport / suggestAllocation
// （使用 mocked db.pool 驗證 wrapper 邏輯）
// ─────────────────────────────────────────────

describe("getPriorityReport / suggestAllocation 公開 API", () => {
  it("getPriorityReport 應回傳空報告（mocked empty DB）", async () => {
    const report = await getPriorityReport()
    expect(report.all).toHaveLength(0)
    expect(report.totalUnpaid).toBe(0)
  })

  it("suggestAllocation 應回傳完整分配（mocked empty DB）", async () => {
    const result = await suggestAllocation({ availableBudget: 50000 })
    expect(result.suggested).toHaveLength(0)
    expect(result.surplus).toBe(50000)
    expect(result.shortage).toBe(0)
  })
})
