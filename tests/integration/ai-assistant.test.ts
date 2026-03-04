/**
 * AI 助手 API 整合測試
 * 測試 AI 設定管理、模型清單、連線測試、串流對話端點
 *
 * 注意：AI 相關端點需要 OpenRouter API Key 才能真正呼叫外部 API，
 * 這裡主要測試端點的回傳格式、錯誤處理和驗證邏輯。
 *
 * 需要 PostgreSQL 連線（Docker port 5439）
 */
import { describe, it, expect, beforeAll } from "vitest"
import type { Express } from "express"
import request from "supertest"
import { createTestApp, createAuthenticatedAgent } from "../helpers/test-app"

const skipIfNoDb = !process.env.DATABASE_URL

describe.skipIf(skipIfNoDb)("AI 助手 API 整合測試", () => {
  let app: Express
  let adminAgent: ReturnType<typeof createAuthenticatedAgent> extends Promise<infer T> ? T : never

  beforeAll(async () => {
    app = await createTestApp()
    adminAgent = await createAuthenticatedAgent(app, "admin", "admin123")
  })

  // ─────────────────────────────────────────────
  // GET /api/ai/settings — 取得 AI 設定（遮蔽版）
  // ─────────────────────────────────────────────

  describe("GET /api/ai/settings", () => {
    it("應返回 AI 設定（API Key 已遮蔽）", async () => {
      const res = await adminAgent.get("/api/ai/settings")

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("id")
      expect(res.body).toHaveProperty("isEnabled")
      expect(res.body).toHaveProperty("selectedModel")
      // 不應包含明文 apiKey
      expect(res.body).not.toHaveProperty("apiKey")
      // 應包含遮蔽版 apiKeyMasked
      expect(res.body).toHaveProperty("apiKeyMasked")
    })

    it("apiKeyMasked 格式正確（null 或含遮蔽符號）", async () => {
      const res = await adminAgent.get("/api/ai/settings")

      const masked = res.body.apiKeyMasked
      if (masked !== null) {
        // 遮蔽版應包含 • 符號
        expect(masked).toContain("•")
      }
    })
  })

  // ─────────────────────────────────────────────
  // PUT /api/ai/settings — 更新 AI 設定
  // ─────────────────────────────────────────────

  describe("PUT /api/ai/settings", () => {
    it("應成功更新模型選擇", async () => {
      const res = await adminAgent.put("/api/ai/settings").send({
        selectedModel: "openai/gpt-4o-mini",
      })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("selectedModel", "openai/gpt-4o-mini")
    })

    it("應成功更新啟用狀態", async () => {
      const res = await adminAgent.put("/api/ai/settings").send({
        isEnabled: false,
      })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("isEnabled", false)

      // 恢復啟用
      await adminAgent.put("/api/ai/settings").send({ isEnabled: true })
    })

    it("應成功更新自訂系統提示詞", async () => {
      const extra = "你是測試模式的 AI 助手"
      const res = await adminAgent.put("/api/ai/settings").send({
        systemPromptExtra: extra,
      })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("systemPromptExtra", extra)

      // 清除自訂提示詞
      await adminAgent.put("/api/ai/settings").send({ systemPromptExtra: "" })
    })

    it("含遮蔽符號的 apiKey 不應更新原始 key", async () => {
      // 先取得目前設定
      const before = await adminAgent.get("/api/ai/settings")
      const beforeMasked = before.body.apiKeyMasked

      // 送出包含遮蔽符號的 key（模擬前端未修改 key 的情境）
      const res = await adminAgent.put("/api/ai/settings").send({
        apiKey: "sk-or-v1-abcd••••efgh",
      })

      expect(res.status).toBe(200)

      // 重新取得，masked 應保持不變
      const after = await adminAgent.get("/api/ai/settings")
      expect(after.body.apiKeyMasked).toBe(beforeMasked)
    })

    it("設定空字串 apiKey 應將其設為 null", async () => {
      const res = await adminAgent.put("/api/ai/settings").send({
        apiKey: "",
      })

      expect(res.status).toBe(200)

      // 確認 key 已清除
      const check = await adminAgent.get("/api/ai/settings")
      expect(check.body.apiKeyMasked).toBeNull()
    })
  })

  // ─────────────────────────────────────────────
  // GET /api/ai/models — 取得可用模型清單
  // ─────────────────────────────────────────────

  describe("GET /api/ai/models", () => {
    it("應返回模型陣列", async () => {
      const res = await adminAgent.get("/api/ai/models")

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
    })

    it("每個模型應有 id、name、free 屬性", async () => {
      const res = await adminAgent.get("/api/ai/models")

      for (const model of res.body) {
        expect(model).toHaveProperty("id")
        expect(model).toHaveProperty("name")
        expect(model).toHaveProperty("free")
        expect(typeof model.id).toBe("string")
        expect(typeof model.name).toBe("string")
        expect(typeof model.free).toBe("boolean")
      }
    })

    it("應包含付費和免費模型", async () => {
      const res = await adminAgent.get("/api/ai/models")

      const freeModels = res.body.filter((m: { free: boolean }) => m.free)
      const paidModels = res.body.filter((m: { free: boolean }) => !m.free)

      expect(freeModels.length).toBeGreaterThan(0)
      expect(paidModels.length).toBeGreaterThan(0)
    })
  })

  // ─────────────────────────────────────────────
  // POST /api/ai/test-connection — 測試 AI 連線
  // ─────────────────────────────────────────────

  describe("POST /api/ai/test-connection", () => {
    it("未設定 API Key 應返回 400", async () => {
      // 先確保 apiKey 為空
      await adminAgent.put("/api/ai/settings").send({ apiKey: "" })

      const res = await adminAgent.post("/api/ai/test-connection")

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("API Key")
    })

    it("設定無效 API Key 應返回錯誤", async () => {
      // 設定假的 API Key
      await adminAgent.put("/api/ai/settings").send({
        apiKey: "sk-or-v1-invalid-test-key-12345",
      })

      const res = await adminAgent.post("/api/ai/test-connection")

      // 應返回認證失敗或其他錯誤（非 200）
      expect([400, 401, 403, 500, 503]).toContain(res.status)

      // 清除假 key
      await adminAgent.put("/api/ai/settings").send({ apiKey: "" })
    })
  })

  // ─────────────────────────────────────────────
  // POST /api/ai/chat/stream — 串流對話
  // ─────────────────────────────────────────────

  describe("POST /api/ai/chat/stream", () => {
    it("未設定 API Key 應返回 400", async () => {
      // 確保 apiKey 為空
      await adminAgent.put("/api/ai/settings").send({ apiKey: "" })

      const res = await adminAgent.post("/api/ai/chat/stream").send({
        messages: [{ role: "user", content: "你好" }],
      })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("API Key")
    })

    it("AI 已停用時應返回 400", async () => {
      // 設定假 key 並停用 AI
      await adminAgent.put("/api/ai/settings").send({
        apiKey: "sk-or-v1-test-key-for-disabled",
        isEnabled: false,
      })

      const res = await adminAgent.post("/api/ai/chat/stream").send({
        messages: [{ role: "user", content: "你好" }],
      })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("停用")

      // 恢復啟用，清除假 key
      await adminAgent.put("/api/ai/settings").send({
        isEnabled: true,
        apiKey: "",
      })
    })
  })

  // ─────────────────────────────────────────────
  // AI 設定 Storage 層測試（getAiSettingsMasked）
  // ─────────────────────────────────────────────

  describe("AI 設定 Storage 邏輯", () => {
    it("getAiSettings 應返回預設設定（第一次存取時初始化）", async () => {
      const { getAiSettings } = await import("../../server/storage/ai-settings")
      const settings = await getAiSettings()

      expect(settings).toHaveProperty("id", 1)
      expect(settings).toHaveProperty("isEnabled")
      expect(settings).toHaveProperty("apiProvider")
    })

    it("getAiSettingsMasked 應正確遮蔽長 key", async () => {
      const { updateAiSettings, getAiSettingsMasked } =
        await import("../../server/storage/ai-settings")

      // 設定一個夠長的假 key
      await updateAiSettings({ apiKey: "sk-or-v1-abcdefghijklmnopqrstuvwxyz123456" })

      const masked = await getAiSettingsMasked()
      expect(masked.apiKeyMasked).not.toBeNull()
      expect(masked.apiKeyMasked!).toContain("••••")
      // 遮蔽版應以原始 key 前 8 字元開頭
      expect(masked.apiKeyMasked!.startsWith("sk-or-v1")).toBe(true)

      // 清除
      await updateAiSettings({ apiKey: null })
    })

    it("getAiSettingsMasked 應處理短 key", async () => {
      const { updateAiSettings, getAiSettingsMasked } =
        await import("../../server/storage/ai-settings")

      // 設定一個很短的 key
      await updateAiSettings({ apiKey: "short" })

      const masked = await getAiSettingsMasked()
      expect(masked.apiKeyMasked).toBe("••••••••")

      // 清除
      await updateAiSettings({ apiKey: null })
    })

    it("getAiSettingsMasked 應處理 null key", async () => {
      const { updateAiSettings, getAiSettingsMasked } =
        await import("../../server/storage/ai-settings")

      await updateAiSettings({ apiKey: null })

      const masked = await getAiSettingsMasked()
      expect(masked.apiKeyMasked).toBeNull()
    })

    it("updateAiSettings 應能更新多個欄位", async () => {
      const { updateAiSettings } = await import("../../server/storage/ai-settings")

      const updated = await updateAiSettings({
        selectedModel: "test-model",
        isEnabled: false,
        systemPromptExtra: "測試提示詞",
      })

      expect(updated.selectedModel).toBe("test-model")
      expect(updated.isEnabled).toBe(false)
      expect(updated.systemPromptExtra).toBe("測試提示詞")

      // 恢復
      await updateAiSettings({
        selectedModel: "google/gemini-2.0-flash-exp:free",
        isEnabled: true,
        systemPromptExtra: null,
      })
    })
  })
})
