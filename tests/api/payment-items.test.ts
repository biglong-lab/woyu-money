/**
 * Payment Items API 整合測試
 * 需要資料庫連線，在 CI 環境或手動執行
 *
 * 執行方式：npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import express from "express"

// 檢查是否有資料庫連線
const skipIfNoDb = !process.env.DATABASE_URL

// 模擬 Express app（不啟動完整 server）
const createTestApp = async () => {
  const app = express()
  app.use(express.json())

  // 模擬認證中間件
  app.use((req, res, next) => {
    ;(req as any).user = { id: 1, username: "testuser" }
    ;(req as any).isAuthenticated = () => true
    next()
  })

  // 動態載入路由
  const { registerRoutes } = await import("../../server/routes/index")
  await registerRoutes(app)

  return app
}

describe.skipIf(skipIfNoDb)("Payment Items API", () => {
  let app: express.Application

  beforeAll(async () => {
    app = await createTestApp()
  })

  describe("GET /api/payment/items", () => {
    it("應該返回付款項目列表", async () => {
      const response = await request(app)
        .get("/api/payment/items")
        .expect("Content-Type", /json/)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty("items")
      expect(response.body).toHaveProperty("pagination")
      expect(Array.isArray(response.body.items)).toBe(true)
    })

    it("應該支援分頁參數", async () => {
      const response = await request(app)
        .get("/api/payment/items?page=1&limit=10")
        .expect(200)

      expect(response.body.pagination).toHaveProperty("currentPage")
      expect(response.body.pagination).toHaveProperty("totalPages")
      expect(response.body.pagination.currentPage).toBe(1)
    })

    it("應該支援專案篩選", async () => {
      const response = await request(app)
        .get("/api/payment/items?projectId=1")
        .expect(200)

      expect(response.body).toHaveProperty("items")
    })
  })

  describe("GET /api/payment/project/stats", () => {
    it("應該返回專案統計數據", async () => {
      const response = await request(app)
        .get("/api/payment/project/stats")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(response.body).toHaveProperty("totalPlanned")
      expect(response.body).toHaveProperty("totalPaid")
      expect(response.body).toHaveProperty("totalRemaining")
    })
  })

  describe("GET /api/payment/records", () => {
    it("應該返回付款記錄列表", async () => {
      const response = await request(app)
        .get("/api/payment/records")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
    })
  })
})

describe.skipIf(skipIfNoDb)("Categories API", () => {
  let app: express.Application

  beforeAll(async () => {
    app = await createTestApp()
  })

  describe("GET /api/categories", () => {
    it("應該返回分類列表", async () => {
      const response = await request(app)
        .get("/api/categories")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
    })
  })
})

describe.skipIf(skipIfNoDb)("Projects API", () => {
  let app: express.Application

  beforeAll(async () => {
    app = await createTestApp()
  })

  describe("GET /api/projects", () => {
    it("應該返回專案列表", async () => {
      const response = await request(app)
        .get("/api/projects")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
    })
  })

  describe("GET /api/payment/projects/stats", () => {
    it("應該返回專案統計", async () => {
      const response = await request(app)
        .get("/api/payment/projects/stats")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(response.body).toHaveProperty("totalProjects")
      expect(response.body).toHaveProperty("projects")
    })
  })
})
