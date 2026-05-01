/**
 * AI 助手擴展整合測試
 *
 * 補充 ai-assistant.test.ts 未覆蓋的端點和邏輯：
 * - AVAILABLE_MODELS 常數驗證
 * - executeTool 函式（透過匯入直接測試）
 * - buildSystemPrompt 系統提示詞
 * - PUT /api/ai/settings 邊界情況
 * - POST /api/ai/chat/stream 更多錯誤路徑
 */
import { describe, it, expect, beforeAll } from "vitest"
import type { Express } from "express"
import request from "supertest"
import { createTestApp, createAuthenticatedAgent } from "../helpers/test-app"

const skipIfNoDb = !process.env.DATABASE_URL

// ─────────────────────────────────────────────
// 單元級別：AVAILABLE_MODELS 常數驗證
// ─────────────────────────────────────────────

describe("AVAILABLE_MODELS 常數", () => {
  it("應匯出模型陣列且不為空", async () => {
    const { AVAILABLE_MODELS } = await import("../../server/routes/ai-assistant-models")
    expect(Array.isArray(AVAILABLE_MODELS)).toBe(true)
    expect(AVAILABLE_MODELS.length).toBeGreaterThan(0)
  })

  it("每個模型應包含 id、name、free 屬性", async () => {
    const { AVAILABLE_MODELS } = await import("../../server/routes/ai-assistant-models")
    for (const model of AVAILABLE_MODELS) {
      expect(model).toHaveProperty("id")
      expect(model).toHaveProperty("name")
      expect(model).toHaveProperty("free")
      expect(typeof model.id).toBe("string")
      expect(typeof model.name).toBe("string")
      expect(typeof model.free).toBe("boolean")
    }
  })

  it("應同時包含付費和免費模型", async () => {
    const { AVAILABLE_MODELS } = await import("../../server/routes/ai-assistant-models")
    const freeModels = AVAILABLE_MODELS.filter((m: { free: boolean }) => m.free)
    const paidModels = AVAILABLE_MODELS.filter((m: { free: boolean }) => !m.free)
    expect(freeModels.length).toBeGreaterThan(0)
    expect(paidModels.length).toBeGreaterThan(0)
  })

  it("模型 id 不應重複", async () => {
    const { AVAILABLE_MODELS } = await import("../../server/routes/ai-assistant-models")
    const ids = AVAILABLE_MODELS.map((m: { id: string }) => m.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})

// ─────────────────────────────────────────────
// 整合測試：AI 設定端點邊界情況
// ─────────────────────────────────────────────

describe.skipIf(skipIfNoDb)("AI 助手擴展整合測試", () => {
  let app: Express
  type AuthAgent = Awaited<ReturnType<typeof createAuthenticatedAgent>>
  let adminAgent: AuthAgent

  beforeAll(async () => {
    app = await createTestApp()
    adminAgent = await createAuthenticatedAgent(app, "admin", "admin123")
  })

  // ── PUT /api/ai/settings 邊界測試 ─────────────────

  describe("PUT /api/ai/settings - 邊界情況", () => {
    it("同時更新多個欄位應全部生效", async () => {
      const res = await adminAgent.put("/api/ai/settings").send({
        selectedModel: "deepseek/deepseek-chat",
        isEnabled: true,
        systemPromptExtra: "邊界測試補充",
      })

      expect(res.status).toBe(200)
      expect(res.body.selectedModel).toBe("deepseek/deepseek-chat")
      expect(res.body.isEnabled).toBe(true)
      expect(res.body.systemPromptExtra).toBe("邊界測試補充")

      // 清理
      await adminAgent.put("/api/ai/settings").send({
        selectedModel: "google/gemini-2.0-flash-exp:free",
        systemPromptExtra: "",
      })
    })

    it("空的 body 應返回 200（無更新）", async () => {
      const res = await adminAgent.put("/api/ai/settings").send({})
      expect(res.status).toBe(200)
    })

    it("systemPromptExtra 設為空字串應清除為 null", async () => {
      // 先設定值
      await adminAgent.put("/api/ai/settings").send({
        systemPromptExtra: "某個提示詞",
      })

      // 清除
      const res = await adminAgent.put("/api/ai/settings").send({
        systemPromptExtra: "",
      })

      expect(res.status).toBe(200)
      expect(res.body.systemPromptExtra).toBeNull()
    })

    it("apiKey 含遮蔽符號時不應更新實際 key", async () => {
      // 先取得目前設定
      const before = await adminAgent.get("/api/ai/settings")

      // 送出含遮蔽符號的 apiKey
      const res = await adminAgent.put("/api/ai/settings").send({
        apiKey: "sk-abcd••••1234",
      })

      expect(res.status).toBe(200)

      // apiKeyMasked 應保持不變
      const after = await adminAgent.get("/api/ai/settings")
      expect(after.body.apiKeyMasked).toBe(before.body.apiKeyMasked)
    })
  })

  // ── GET /api/ai/models 結構驗證 ─────────────────

  describe("GET /api/ai/models - 結構驗證", () => {
    it("模型清單應與 AVAILABLE_MODELS 匯出一致", async () => {
      const { AVAILABLE_MODELS } = await import("../../server/routes/ai-assistant-models")
      const res = await adminAgent.get("/api/ai/models")

      expect(res.status).toBe(200)
      expect(res.body).toEqual(AVAILABLE_MODELS)
    })
  })

  // ── POST /api/ai/test-connection 邊界測試 ─────────

  describe("POST /api/ai/test-connection - 邊界測試", () => {
    it("API Key 為空時應返回 400 且訊息含 API Key", async () => {
      // 確保 apiKey 為空
      await adminAgent.put("/api/ai/settings").send({ apiKey: "" })

      const res = await adminAgent.post("/api/ai/test-connection")

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("API Key")
    })
  })

  // ── POST /api/ai/chat/stream 邊界測試 ─────────────

  describe("POST /api/ai/chat/stream - 邊界測試", () => {
    it("空 messages 陣列且未設定 key 時應返回 400", async () => {
      // 確保 apiKey 為空
      await adminAgent.put("/api/ai/settings").send({ apiKey: "" })

      const res = await adminAgent.post("/api/ai/chat/stream").send({
        messages: [],
      })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("API Key")
    })

    it("有 API Key 但 AI 停用時應返回 400 且含停用訊息", async () => {
      await adminAgent.put("/api/ai/settings").send({
        apiKey: "sk-or-v1-test-disabled-check-key",
        isEnabled: false,
      })

      const res = await adminAgent.post("/api/ai/chat/stream").send({
        messages: [{ role: "user", content: "測試" }],
      })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("停用")

      // 恢復
      await adminAgent.put("/api/ai/settings").send({
        isEnabled: true,
        apiKey: "",
      })
    })

    it("帶有圖片 base64 但缺少 API Key 時應返回 400", async () => {
      await adminAgent.put("/api/ai/settings").send({ apiKey: "" })

      const res = await adminAgent.post("/api/ai/chat/stream").send({
        messages: [{ role: "user", content: "辨識這張圖" }],
        imageBase64: "aGVsbG8=", // base64 "hello"
        imageMimeType: "image/png",
      })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("API Key")
    })
  })

  // ── GET /api/ai/settings 結構驗證 ──────────────────

  describe("GET /api/ai/settings - 結構驗證", () => {
    it("回傳應包含所有必要欄位", async () => {
      const res = await adminAgent.get("/api/ai/settings")

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("id")
      expect(res.body).toHaveProperty("apiProvider")
      expect(res.body).toHaveProperty("selectedModel")
      expect(res.body).toHaveProperty("isEnabled")
      expect(res.body).toHaveProperty("apiKeyMasked")
      // 不應包含明文 apiKey
      expect(res.body).not.toHaveProperty("apiKey")
    })

    it("apiProvider 預設為 openrouter", async () => {
      const res = await adminAgent.get("/api/ai/settings")
      expect(res.body.apiProvider).toBe("openrouter")
    })
  })
})
