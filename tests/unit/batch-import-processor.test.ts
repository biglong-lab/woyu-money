/**
 * server/batch-import-processor.ts 單元測試
 * 測試純邏輯函式：parseAmount, parseDate, mapRowToRecord, parseFile (CSV/Excel)
 * 不依賴資料庫的部分
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// mock storage 模組（避免連線資料庫）
vi.mock("../../server/storage", () => ({
  storage: {
    getPaymentProjects: vi.fn().mockResolvedValue([]),
    getProjectCategories: vi.fn().mockResolvedValue([]),
    createPaymentProject: vi.fn().mockResolvedValue({ id: 1 }),
    createDebtCategory: vi.fn().mockResolvedValue({ id: 1 }),
    createPaymentItem: vi.fn().mockResolvedValue({ id: 1 }),
    createPaymentRecord: vi.fn().mockResolvedValue({ id: 1 }),
    updatePaymentItemAmounts: vi.fn().mockResolvedValue(undefined),
  },
}))

import { BatchImportProcessor } from "../../server/batch-import-processor"
import type { ImportRecord } from "../../server/batch-import-processor"

// 透過子類別暴露 private 方法進行單元測試
class TestableProcessor extends BatchImportProcessor {
  public testParseAmount(value: unknown): number {
    return (this as unknown as { parseAmount: (v: unknown) => number }).parseAmount(value)
  }

  public testParseDate(value: unknown): string {
    return (this as unknown as { parseDate: (v: unknown) => string }).parseDate(value)
  }

  public testMapRowToRecord(row: Record<string, unknown>): ImportRecord | null {
    return (
      this as unknown as { mapRowToRecord: (r: Record<string, unknown>) => ImportRecord | null }
    ).mapRowToRecord(row)
  }
}

describe("BatchImportProcessor - 純邏輯單元測試", () => {
  let processor: TestableProcessor

  beforeEach(() => {
    processor = new TestableProcessor()
  })

  // ========== parseAmount ==========
  describe("parseAmount - 金額解析", () => {
    it("數字型別直接回傳", () => {
      expect(processor.testParseAmount(1500)).toBe(1500)
    })

    it("字串數字應正確解析", () => {
      expect(processor.testParseAmount("1500")).toBe(1500)
    })

    it("含逗號的金額應正確解析", () => {
      expect(processor.testParseAmount("1,500")).toBe(1500)
    })

    it("含 NT$ 前綴應正確解析", () => {
      expect(processor.testParseAmount("NT$2,000")).toBe(2000)
    })

    it("含 $ 前綴應正確解析", () => {
      expect(processor.testParseAmount("$3,500")).toBe(3500)
    })

    it("含空格的金額應正確解析", () => {
      expect(processor.testParseAmount(" 1000 ")).toBe(1000)
    })

    it("小數金額應正確解析", () => {
      expect(processor.testParseAmount("99.5")).toBe(99.5)
    })

    it("非數字字串應回傳 0", () => {
      expect(processor.testParseAmount("abc")).toBe(0)
    })

    it("null/undefined 應回傳 0", () => {
      expect(processor.testParseAmount(null)).toBe(0)
      expect(processor.testParseAmount(undefined)).toBe(0)
    })

    it("布林值應回傳 0", () => {
      expect(processor.testParseAmount(true)).toBe(0)
    })

    it("空字串應回傳 0", () => {
      expect(processor.testParseAmount("")).toBe(0)
    })
  })

  // ========== parseDate ==========
  describe("parseDate - 日期解析", () => {
    it("ISO 格式日期應正確解析", () => {
      expect(processor.testParseDate("2026-03-15")).toBe("2026-03-15")
    })

    it("YYYY/MM/DD 格式應正確解析", () => {
      // new Date(year, month, day) 使用本地時區，
      // toISOString() 輸出 UTC，可能有時區偏移
      const result = processor.testParseDate("2026/03/15")
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // 驗證解析到了正確的年月（時區可能造成日期 +/- 1 天）
      expect(result.startsWith("2026-03")).toBe(true)
    })

    it("MM/DD/YYYY 格式應正確解析", () => {
      const result = processor.testParseDate("03/15/2026")
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(result.startsWith("2026-03")).toBe(true)
    })

    it("Date 物件應正確解析", () => {
      // 使用 UTC 時間避免時區問題
      const date = new Date(Date.UTC(2026, 2, 15))
      const result = processor.testParseDate(date)
      expect(result).toBe("2026-03-15")
    })

    it("Excel 日期序列號應正確解析", () => {
      // Excel 日期：46099 大約對應 2026-03-15
      const result = processor.testParseDate(46099)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it("null/undefined 應回傳空字串", () => {
      expect(processor.testParseDate(null)).toBe("")
      expect(processor.testParseDate(undefined)).toBe("")
    })

    it("空字串應回傳空字串", () => {
      expect(processor.testParseDate("")).toBe("")
    })

    it("無效日期字串應回傳空字串", () => {
      expect(processor.testParseDate("not-a-date")).toBe("")
    })

    it("物件型別應回傳空字串", () => {
      expect(processor.testParseDate({})).toBe("")
    })
  })

  // ========== mapRowToRecord ==========
  describe("mapRowToRecord - 行資料映射", () => {
    it("完整的中文欄位應正確映射", () => {
      const row = {
        項目名稱: "辦公室租金",
        金額: 50000,
        日期: "2026-03-01",
        專案: "營運費用",
        分類: "房租",
        廠商: "房東",
        備註: "3月份租金",
      }
      const record = processor.testMapRowToRecord(row)
      expect(record).not.toBeNull()
      expect(record!.itemName).toBe("辦公室租金")
      expect(record!.amount).toBe(50000)
      expect(record!.date).toBe("2026-03-01")
      expect(record!.projectName).toBe("營運費用")
      expect(record!.categoryName).toBe("房租")
      expect(record!.vendor).toBe("房東")
      expect(record!.notes).toBe("3月份租金")
    })

    it("英文欄位名稱應正確映射", () => {
      const row = {
        itemName: "Office Rent",
        amount: 30000,
        date: "2026-03-01",
        project: "Operating Costs",
        category: "Rent",
      }
      const record = processor.testMapRowToRecord(row)
      expect(record).not.toBeNull()
      expect(record!.itemName).toBe("Office Rent")
      expect(record!.amount).toBe(30000)
    })

    it("缺少必填欄位應回傳 null（缺少項目名稱）", () => {
      const row = {
        金額: 50000,
        日期: "2026-03-01",
        專案: "營運費用",
      }
      const record = processor.testMapRowToRecord(row)
      expect(record).toBeNull()
    })

    it("缺少金額應回傳 null", () => {
      const row = {
        項目名稱: "測試",
        日期: "2026-03-01",
        專案: "測試專案",
      }
      const record = processor.testMapRowToRecord(row)
      expect(record).toBeNull()
    })

    it("缺少日期應回傳 null", () => {
      const row = {
        項目名稱: "測試",
        金額: 1000,
        專案: "測試專案",
      }
      const record = processor.testMapRowToRecord(row)
      expect(record).toBeNull()
    })

    it("缺少專案名稱應回傳 null", () => {
      const row = {
        項目名稱: "測試",
        金額: 1000,
        日期: "2026-03-01",
      }
      const record = processor.testMapRowToRecord(row)
      expect(record).toBeNull()
    })

    it("priority 應限制在 1~3 範圍", () => {
      const row = {
        項目名稱: "測試",
        金額: 1000,
        日期: "2026-03-01",
        專案: "測試",
        優先級: "5",
      }
      const record = processor.testMapRowToRecord(row)
      expect(record).not.toBeNull()
      expect(record!.priority).toBe(3) // 上限 3
    })

    it("priority 低於 1 應設為 1", () => {
      const row = {
        項目名稱: "測試",
        金額: 1000,
        日期: "2026-03-01",
        專案: "測試",
        優先級: "0",
      }
      const record = processor.testMapRowToRecord(row)
      expect(record).not.toBeNull()
      expect(record!.priority).toBe(1) // 下限 1
    })

    it("預設付款狀態應為「未付款」", () => {
      const row = {
        項目名稱: "測試",
        金額: 1000,
        日期: "2026-03-01",
        專案: "測試",
      }
      const record = processor.testMapRowToRecord(row)
      expect(record).not.toBeNull()
      expect(record!.paymentStatus).toBe("未付款")
    })

    it("isValid 初始值應為 false", () => {
      const row = {
        項目名稱: "測試",
        金額: 1000,
        日期: "2026-03-01",
        專案: "測試",
      }
      const record = processor.testMapRowToRecord(row)
      expect(record).not.toBeNull()
      expect(record!.isValid).toBe(false)
    })

    it("errors 初始值應為空陣列", () => {
      const row = {
        項目名稱: "測試",
        金額: 1000,
        日期: "2026-03-01",
        專案: "測試",
      }
      const record = processor.testMapRowToRecord(row)
      expect(record).not.toBeNull()
      expect(record!.errors).toEqual([])
    })

    it("欄位值應正確 trim 空格", () => {
      const row = {
        項目名稱: "  測試  ",
        金額: 1000,
        日期: "2026-03-01",
        專案: "  專案  ",
        分類: "  分類  ",
        廠商: "  廠商  ",
      }
      const record = processor.testMapRowToRecord(row)
      expect(record).not.toBeNull()
      expect(record!.itemName).toBe("測試")
      expect(record!.projectName).toBe("專案")
      expect(record!.categoryName).toBe("分類")
      expect(record!.vendor).toBe("廠商")
    })
  })

  // ========== parseFile ==========
  describe("parseFile - 檔案解析", () => {
    it("不支援的檔案格式應拋出錯誤", async () => {
      const buffer = Buffer.from("test")
      await expect(processor.parseFile(buffer, "test.txt")).rejects.toThrow("不支援的檔案格式")
    })

    it("不支援的檔案格式錯誤訊息應包含說明", async () => {
      const buffer = Buffer.from("test")
      await expect(processor.parseFile(buffer, "test.pdf")).rejects.toThrow("CSV 或 Excel")
    })

    it("CSV 檔案應正確解析", async () => {
      const csvContent = [
        "項目名稱,金額,日期,專案,分類",
        "辦公用品,500,2026-03-01,營運,雜費",
        "水電費,2000,2026-03-01,營運,公用事業",
      ].join("\n")
      const buffer = Buffer.from(csvContent)

      const result = await processor.parseFile(buffer, "test.csv")
      expect(result.records).toHaveLength(2)
      expect(result.records[0].itemName).toBe("辦公用品")
      expect(result.records[0].amount).toBe(500)
      expect(result.records[1].itemName).toBe("水電費")
    })

    it("空 CSV 檔案應回傳空陣列", async () => {
      const csvContent = "項目名稱,金額,日期,專案,分類\n"
      const buffer = Buffer.from(csvContent)

      const result = await processor.parseFile(buffer, "test.csv")
      expect(result.records).toHaveLength(0)
    })

    it("Excel 檔案（xlsx）應正確辨識副檔名", async () => {
      // 使用 xlsx 套件建立簡易工作簿
      const XLSX = await import("xlsx")
      const ws = XLSX.utils.json_to_sheet([
        {
          項目名稱: "測試項目",
          金額: 3000,
          日期: "2026-03-01",
          專案: "測試專案",
          分類: "測試分類",
        },
      ])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer

      const result = await processor.parseFile(buffer, "test.xlsx")
      expect(result.records).toHaveLength(1)
      expect(result.records[0].itemName).toBe("測試項目")
      expect(result.records[0].amount).toBe(3000)
    })
  })

  // ========== executeImport ==========
  describe("executeImport - 執行匯入", () => {
    it("無效記錄應計入 failed", async () => {
      const records: ImportRecord[] = [
        {
          itemName: "",
          amount: 0,
          date: "",
          projectName: "",
          categoryName: "",
          isValid: false,
          errors: ["項目名稱不能為空", "金額必須大於 0"],
        },
      ]

      const result = await processor.executeImport(records)
      expect(result.failed).toBe(1)
      expect(result.success).toBe(0)
      expect(result.details[0].success).toBe(false)
      expect(result.details[0].error).toContain("項目名稱不能為空")
    })

    it("空記錄陣列應回傳零成功零失敗", async () => {
      const result = await processor.executeImport([])
      expect(result.success).toBe(0)
      expect(result.failed).toBe(0)
      expect(result.details).toHaveLength(0)
    })
  })
})
