import { GoogleGenAI, Type } from "@google/genai"

// 延遲初始化：僅在有 API key 且實際呼叫時才建立
let _ai: GoogleGenAI | null = null
function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error("Gemini API key 未設定，AI 辨識功能無法使用")
    }
    _ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || undefined,
      },
    })
  }
  return _ai
}
const ai = new Proxy({} as GoogleGenAI, {
  get(_target, prop: string | symbol) {
    const instance = getAI()
    return instance[prop as keyof GoogleGenAI]
  },
})

export interface DocumentRecognitionResult {
  success: boolean
  confidence: number
  documentType: "bill" | "payment" | "invoice"
  extractedData: {
    vendor?: string
    amount?: number
    date?: string
    description?: string
    category?: string
    invoiceNumber?: string
    taxId?: string
    taxAmount?: number
    subtotal?: number
    items?: Array<{
      description: string
      quantity?: number
      unitPrice?: number
      amount?: number
    }>
  }
  rawResponse?: string
  error?: string
}

const DOCUMENT_RECOGNITION_PROMPT = `你是一個專業的財務單據辨識系統。請分析這張圖片並提取以下資訊：

請根據圖片內容判斷單據類型：
- bill (帳單): 需要付款的帳單、繳費單、通知單
- payment (付款憑證): 已付款的收據、轉帳證明、刷卡簽單
- invoice (發票): 統一發票、電子發票、收據發票

請提取以下欄位（如果圖片中有的話）：
1. vendor (廠商/店家名稱)
2. amount (總金額，只取數字)
3. date (日期，格式: YYYY-MM-DD)
4. description (簡短描述這張單據的用途)
5. category (分類建議：水電費/電信費/保險費/租金/餐飲/交通/辦公用品/維修費/其他)
6. invoiceNumber (發票號碼或單據編號)
7. taxId (統一編號，如果有)
8. taxAmount (稅額，如果有)
9. subtotal (未稅金額，如果有)

注意事項：
- 金額請只提取數字，不含逗號和貨幣符號
- 日期請轉換為 YYYY-MM-DD 格式
- 如果無法辨識某個欄位，請留空
- 盡可能準確地辨識台灣繁體中文內容`

export async function recognizeDocument(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  hintType?: "bill" | "payment" | "invoice"
): Promise<DocumentRecognitionResult> {
  try {
    const typeHint = hintType
      ? `用戶提示這是一張${hintType === "bill" ? "帳單" : hintType === "payment" ? "付款憑證" : "發票"}。`
      : ""

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: DOCUMENT_RECOGNITION_PROMPT + "\n" + typeHint },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documentType: {
              type: Type.STRING,
              enum: ["bill", "payment", "invoice"],
            },
            confidence: { type: Type.NUMBER },
            vendor: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            date: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            invoiceNumber: { type: Type.STRING },
            taxId: { type: Type.STRING },
            taxAmount: { type: Type.NUMBER },
            subtotal: { type: Type.NUMBER },
          },
          required: ["documentType", "confidence"],
        },
      },
    })

    const rawText = response.text || "{}"
    const parsed = JSON.parse(rawText)

    return {
      success: true,
      confidence: parsed.confidence || 0.5,
      documentType: parsed.documentType || hintType || "bill",
      extractedData: {
        vendor: parsed.vendor,
        amount: parsed.amount,
        date: parsed.date,
        description: parsed.description,
        category: parsed.category,
        invoiceNumber: parsed.invoiceNumber,
        taxId: parsed.taxId,
        taxAmount: parsed.taxAmount,
        subtotal: parsed.subtotal,
      },
      rawResponse: rawText,
    }
  } catch (error: unknown) {
    console.error("Document recognition error:", error)
    return {
      success: false,
      confidence: 0,
      documentType: hintType || "bill",
      extractedData: {},
      error: error instanceof Error ? error.message : "辨識失敗",
    }
  }
}

export async function getDocumentSuggestions(
  extractedData: DocumentRecognitionResult["extractedData"],
  documentType: "bill" | "payment" | "invoice"
): Promise<{
  suggestedProject?: string
  suggestedCategory?: string
  suggestedTags?: string[]
  notes?: string
}> {
  try {
    const prompt = `根據以下單據資訊，請建議適合的專案歸屬和分類標籤：

單據類型: ${documentType === "bill" ? "帳單" : documentType === "payment" ? "付款憑證" : "發票"}
廠商: ${extractedData.vendor || "未知"}
金額: ${extractedData.amount || "未知"}
描述: ${extractedData.description || "無"}
分類: ${extractedData.category || "無"}

請根據常見的財務管理場景，建議：
1. 可能的專案名稱（例如：日常營運、裝修工程、設備採購等）
2. 適合的標籤（2-4個）
3. 簡短的備註建議`

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedProject: { type: Type.STRING },
            suggestedCategory: { type: Type.STRING },
            suggestedTags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            notes: { type: Type.STRING },
          },
        },
      },
    })

    return JSON.parse(response.text || "{}")
  } catch (error) {
    console.error("Suggestion generation error:", error)
    return {}
  }
}
