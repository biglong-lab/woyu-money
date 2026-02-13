/**
 * Auth API 整合測試
 * 測試登入、登出、註冊、session 管理等認證流程
 *
 * 需要 PostgreSQL 連線（Docker port 5434）
 * 執行方式：npm run test:integration
 */
import { describe, it, expect, beforeAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

// 檢查是否有資料庫連線
const skipIfNoDb = !process.env.DATABASE_URL

/**
 * 建立包含完整認證系統的測試 app
 * 使用 registerRoutes 註冊所有路由（含 setupAuth）
 */
async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(express.json())

  const { registerRoutes } = await import("../../server/routes/index")
  await registerRoutes(app)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)

  return app
}

describe.skipIf(skipIfNoDb)("Auth API 整合測試", () => {
  let app: Express

  beforeAll(async () => {
    app = await createTestApp()
  })

  // --- GET /api/user ---
  describe("GET /api/user", () => {
    it("未登入時應返回 401", async () => {
      const res = await request(app).get("/api/user")

      expect(res.status).toBe(401)
      expect(res.body).toHaveProperty("message")
    })
  })

  // --- POST /api/login ---
  describe("POST /api/login", () => {
    it("正確帳密應登入成功", async () => {
      const agent = request.agent(app)
      const res = await agent
        .post("/api/login")
        .send({ username: "admin", password: "admin123" })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("id")
      expect(res.body).toHaveProperty("username", "admin")
      expect(res.body).toHaveProperty("role")
    })

    it("錯誤密碼應返回 401", async () => {
      const res = await request(app)
        .post("/api/login")
        .send({ username: "admin", password: "wrongpassword" })

      expect(res.status).toBe(401)
      expect(res.body).toHaveProperty("message")
    })

    it("不存在的用戶應返回 401", async () => {
      const res = await request(app)
        .post("/api/login")
        .send({ username: "nonexistent_user_xyz", password: "password123" })

      expect(res.status).toBe(401)
    })

    it("缺少帳號或密碼應返回 401", async () => {
      const res = await request(app).post("/api/login").send({})

      expect(res.status).toBe(401)
    })
  })

  // --- 登入後的 session ---
  describe("登入後的 session", () => {
    it("登入後 GET /api/user 應返回用戶資訊", async () => {
      const agent = request.agent(app)

      // 先登入
      const loginRes = await agent
        .post("/api/login")
        .send({ username: "admin", password: "admin123" })
      expect(loginRes.status).toBe(200)

      // 驗證 session 保持
      const userRes = await agent.get("/api/user")
      expect(userRes.status).toBe(200)
      expect(userRes.body).toHaveProperty("username", "admin")
      expect(userRes.body).toHaveProperty("id")
      expect(userRes.body).toHaveProperty("role")
    })

    it("不同 agent 之間 session 應互相獨立", async () => {
      const agent1 = request.agent(app)
      const agent2 = request.agent(app)

      // agent1 登入
      await agent1.post("/api/login").send({ username: "admin", password: "admin123" })

      // agent2 未登入，應該無法存取
      const userRes = await agent2.get("/api/user")
      expect(userRes.status).toBe(401)
    })
  })

  // --- POST /api/logout ---
  describe("POST /api/logout", () => {
    it("登出後應無法存取 /api/user", async () => {
      const agent = request.agent(app)

      // 登入
      const loginRes = await agent
        .post("/api/login")
        .send({ username: "admin", password: "admin123" })
      expect(loginRes.status).toBe(200)

      // 確認已登入
      const userBeforeLogout = await agent.get("/api/user")
      expect(userBeforeLogout.status).toBe(200)

      // 登出
      const logoutRes = await agent.post("/api/logout")
      expect(logoutRes.status).toBe(200)
      expect(logoutRes.body).toHaveProperty("message")

      // 驗證已登出
      const userAfterLogout = await agent.get("/api/user")
      expect(userAfterLogout.status).toBe(401)
    })
  })

  // --- POST /api/register ---
  describe("POST /api/register", () => {
    it("缺少必填欄位應返回 400", async () => {
      const res = await request(app).post("/api/register").send({ username: "", password: "" })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
    })

    it("密碼太短應返回 400", async () => {
      const res = await request(app)
        .post("/api/register")
        .send({ username: "testuser_short_pw", password: "abc1" })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("密碼")
    })

    it("密碼缺少數字應返回 400", async () => {
      const res = await request(app)
        .post("/api/register")
        .send({ username: "testuser_no_digit", password: "abcdefgh" })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("密碼")
    })

    it("密碼缺少字母應返回 400", async () => {
      const res = await request(app)
        .post("/api/register")
        .send({ username: "testuser_no_alpha", password: "12345678" })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("密碼")
    })

    it("重複用戶名應返回 400", async () => {
      const res = await request(app)
        .post("/api/register")
        .send({ username: "admin", password: "validPass123" })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("已存在")
    })
  })

  // --- 認證保護 ---
  describe("認證保護", () => {
    it("未登入存取受保護的 API 應返回 401", async () => {
      const res = await request(app).get("/api/payment/items")

      expect(res.status).toBe(401)
    })

    it("登入後應可存取受保護的 API", async () => {
      const agent = request.agent(app)

      // 登入
      await agent.post("/api/login").send({ username: "admin", password: "admin123" })

      // 存取受保護的 API
      const res = await agent.get("/api/payment/items")
      expect(res.status).toBe(200)
    })
  })
})
