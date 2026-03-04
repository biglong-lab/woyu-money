/**
 * server/document-ai.ts 單元測試
 * Mock Gemini API 測試文件辨識解析邏輯
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock @google/genai 模組 — 用 class 語法避免 vitest 建構子錯誤
const mockGenerateContent = vi.fn()

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: mockGenerateContent,
      }
    },
    Type: {
      OBJECT: "OBJECT",
      STRING: "STRING",
      NUMBER: "NUMBER",
      ARRAY: "ARRAY",
    },
  }
})

// 設定 API key 環境變數，讓 getAI() 不拋錯
vi.stubEnv("GEMINI_API_KEY", "test-api-key")

import { recognizeDocument, getDocumentSuggestions } from "../../server/document-ai"
import type { DocumentRecognitionResult } from "../../server/document-ai"

describe("recognizeDocument", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset()
  })

  it("成功辨識發票應回傳正確結構", async () => {
    const mockResponse = {
      documentType: "invoice",
      confidence: 0.95,
      vendor: "全聯福利中心",
      amount: 350,
      date: "2026-03-01",
      description: "日常採購",
      category: "餐飲",
      invoiceNumber: "AB12345678",
      taxId: "12345678",
      taxAmount: 17,
      subtotal: 333,
    }

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(mockResponse),
    })

    const result = await recognizeDocument("base64data", "image/jpeg")

    expect(result.success).toBe(true)
    expect(result.confidence).toBe(0.95)
    expect(result.documentType).toBe("invoice")
    expect(result.extractedData.vendor).toBe("全聯福利中心")
    expect(result.extractedData.amount).toBe(350)
    expect(result.extractedData.date).toBe("2026-03-01")
    expect(result.extractedData.invoiceNumber).toBe("AB12345678")
    expect(result.extractedData.taxId).toBe("12345678")
    expect(result.rawResponse).toBe(JSON.stringify(mockResponse))
  })

  it("成功辨識帳單應正確分類", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        documentType: "bill",
        confidence: 0.88,
        vendor: "台灣電力公司",
        amount: 1200,
        date: "2026-02-15",
        description: "電費帳單",
        category: "水電費",
      }),
    })

    const result = await recognizeDocument("base64data", "image/png", "bill")

    expect(result.success).toBe(true)
    expect(result.documentType).toBe("bill")
    expect(result.extractedData.vendor).toBe("台灣電力公司")
    expect(result.extractedData.category).toBe("水電費")
  })

  it("帶有 hintType 應傳入提示文字", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        documentType: "payment",
        confidence: 0.9,
      }),
    })

    await recognizeDocument("base64data", "image/jpeg", "payment")

    // 驗證 generateContent 被呼叫且 prompt 包含付款憑證提示
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    const callArgs = mockGenerateContent.mock.calls[0][0]
    const textPart = callArgs.contents[0].parts[0].text
    expect(textPart).toContain("付款憑證")
  })

  it("未提供 hintType 時 prompt 不包含提示文字", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        documentType: "bill",
        confidence: 0.7,
      }),
    })

    await recognizeDocument("base64data", "image/jpeg")

    const callArgs = mockGenerateContent.mock.calls[0][0]
    const textPart = callArgs.contents[0].parts[0].text
    // 不包含任何提示類型文字
    expect(textPart).not.toContain("用戶提示這是一張")
  })

  it("API 回傳空物件時應使用預設值", async () => {
    mockGenerateContent.mockResolvedValue({
      text: "{}",
    })

    const result = await recognizeDocument("base64data", "image/jpeg", "invoice")

    expect(result.success).toBe(true)
    expect(result.confidence).toBe(0.5) // 預設 confidence
    expect(result.documentType).toBe("invoice") // 使用 hintType 作為 fallback
  })

  it("API 回傳 null text 時應使用空物件", async () => {
    mockGenerateContent.mockResolvedValue({
      text: null,
    })

    const result = await recognizeDocument("base64data", "image/jpeg")

    // text 為 null 時 rawText = "{}"，JSON.parse("{}") 成功
    expect(result.success).toBe(true)
    expect(result.confidence).toBe(0.5)
    expect(result.documentType).toBe("bill") // 無 hintType 時預設 "bill"
  })

  it("API 拋出錯誤應回傳失敗結果", async () => {
    mockGenerateContent.mockRejectedValue(new Error("API quota exceeded"))

    const result = await recognizeDocument("base64data", "image/jpeg", "bill")

    expect(result.success).toBe(false)
    expect(result.confidence).toBe(0)
    expect(result.documentType).toBe("bill")
    expect(result.error).toBe("API quota exceeded")
    expect(result.extractedData).toEqual({})
  })

  it("API 拋出非 Error 型別應回傳「辨識失敗」", async () => {
    mockGenerateContent.mockRejectedValue("unknown failure")

    const result = await recognizeDocument("base64data", "image/jpeg")

    expect(result.success).toBe(false)
    expect(result.error).toBe("辨識失敗")
  })

  it("圖片 base64 和 mimeType 應正確傳入 API", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ documentType: "bill", confidence: 0.8 }),
    })

    await recognizeDocument("myBase64Image", "image/webp")

    const callArgs = mockGenerateContent.mock.calls[0][0]
    const imagePart = callArgs.contents[0].parts[1]
    expect(imagePart.inlineData.data).toBe("myBase64Image")
    expect(imagePart.inlineData.mimeType).toBe("image/webp")
  })

  it("提取的金額和數值應為 number 型別", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        documentType: "invoice",
        confidence: 0.92,
        amount: 1500.5,
        taxAmount: 75,
        subtotal: 1425.5,
      }),
    })

    const result = await recognizeDocument("base64data", "image/jpeg")

    expect(typeof result.extractedData.amount).toBe("number")
    expect(typeof result.extractedData.taxAmount).toBe("number")
    expect(typeof result.extractedData.subtotal).toBe("number")
  })
})

describe("getDocumentSuggestions", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset()
  })

  it("成功取得建議應回傳完整物件", async () => {
    const mockSuggestion = {
      suggestedProject: "日常營運",
      suggestedCategory: "餐飲",
      suggestedTags: ["日用品", "採購"],
      notes: "建議歸入每月日常支出",
    }
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(mockSuggestion),
    })

    const extractedData: DocumentRecognitionResult["extractedData"] = {
      vendor: "全聯福利中心",
      amount: 350,
      description: "日常採購",
      category: "餐飲",
    }

    const result = await getDocumentSuggestions(extractedData, "payment")

    expect(result.suggestedProject).toBe("日常營運")
    expect(result.suggestedCategory).toBe("餐飲")
    expect(result.suggestedTags).toEqual(["日用品", "採購"])
    expect(result.notes).toBe("建議歸入每月日常支出")
  })

  it("API 錯誤應回傳空物件", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Network error"))

    const result = await getDocumentSuggestions({}, "bill")

    expect(result).toEqual({})
  })

  it("不同單據類型應傳入對應的中文名稱", async () => {
    mockGenerateContent.mockResolvedValue({ text: "{}" })

    await getDocumentSuggestions({ vendor: "測試" }, "invoice")

    // prompt 以字串形式傳入 contents
    const callArgs = mockGenerateContent.mock.calls[0][0]
    const prompt = callArgs.contents
    expect(prompt).toContain("發票")
  })

  it("缺少欄位應以「未知」或「無」替代", async () => {
    mockGenerateContent.mockResolvedValue({ text: "{}" })

    await getDocumentSuggestions({}, "bill")

    const callArgs = mockGenerateContent.mock.calls[0][0]
    const prompt = callArgs.contents
    expect(prompt).toContain("未知") // vendor 未提供
  })
})
