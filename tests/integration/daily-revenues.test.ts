/**
 * Daily Revenues API 整合測試
 * 測試每日營收 CRUD 操作與收入報表 API
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const skipIfNoDb = !process.env.DATABASE_URL

/**
 * 建立測試用 Express app
 * 模擬認證中間件，載入 daily-revenues 路由
 */
async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(express.json())

  // 模擬認證中間件，讓所有請求通過驗證
  app.use((req, _res, next) => {
    const reqWithAuth = req as typeof req & {
      user: { id: number; username: string; isActive: boolean }
      isAuthenticated: () => boolean
      session: Record<string, unknown>
    }
    reqWithAuth.user = { id: 1, username: "admin", isActive: true }
    reqWithAuth.isAuthenticated = () => true
    reqWithAuth.session = { userId: 1, isAuthenticated: true }
    next()
  })

  // 載入每日營收路由
  const dailyRevenueRoutes = (await import("../../server/routes/daily-revenues")).default
  app.use(dailyRevenueRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Daily Revenues API", () => {
  let app: Express
  const createdIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    // 清理所有測試建立的記錄
    for (const id of createdIds) {
      try {
        await request(app).delete(`/api/daily-revenues/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── POST /api/daily-revenues ─────────────────────────────────────

  describe("POST /api/daily-revenues - 新增每日營收", () => {
    it("應成功建立營收記錄並回傳 201", async () => {
      const timestamp = Date.now()
      const revenue = {
        date: "2026-03-01",
        amount: "15000",
        description: `整合測試營收_${timestamp}`,
      }

      const res = await request(app).post("/api/daily-revenues").send(revenue).expect(201)

      expect(res.body).toHaveProperty("id")
      expect(res.body.date).toBe("2026-03-01")
      expect(res.body.amount).toBeDefined()
      expect(res.body.description).toContain("整合測試營收")
      createdIds.push(res.body.id)
    })

    it("應成功建立含 projectId 的營收記錄", async () => {
      const timestamp = Date.now()
      const revenue = {
        projectId: "1",
        date: "2026-03-02",
        amount: "25000",
        description: `專案營收測試_${timestamp}`,
      }

      const res = await request(app).post("/api/daily-revenues").send(revenue).expect(201)

      expect(res.body).toHaveProperty("id")
      expect(res.body.projectId).toBeDefined()
      createdIds.push(res.body.id)
    })

    it("缺少 date 應回傳 400", async () => {
      const res = await request(app).post("/api/daily-revenues").send({ amount: "10000" })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("date")
    })

    it("無效的日期格式應回傳 400", async () => {
      const res = await request(app)
        .post("/api/daily-revenues")
        .send({ date: "2026/03/01", amount: "10000" })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("date")
    })

    it("缺少 amount 應回傳 400", async () => {
      const res = await request(app).post("/api/daily-revenues").send({ date: "2026-03-01" })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("amount")
    })

    it("無效的 amount 應回傳 400", async () => {
      const res = await request(app)
        .post("/api/daily-revenues")
        .send({ date: "2026-03-01", amount: "abc" })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("amount")
    })

    it("不帶 description 也應成功建立", async () => {
      const res = await request(app)
        .post("/api/daily-revenues")
        .field("date", "2026-03-03")
        .field("amount", "5000")
        .expect(201)

      expect(res.body).toHaveProperty("id")
      createdIds.push(res.body.id)
    })
  })

  // ── GET /api/daily-revenues ──────────────────────────────────────

  describe("GET /api/daily-revenues - 營收列表", () => {
    it("應回傳營收記錄陣列", async () => {
      const res = await request(app)
        .get("/api/daily-revenues")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("每筆記錄應包含必要欄位", async () => {
      const res = await request(app).get("/api/daily-revenues").expect(200)

      if (res.body.length > 0) {
        const record = res.body[0]
        expect(record).toHaveProperty("id")
        expect(record).toHaveProperty("date")
        expect(record).toHaveProperty("amount")
        expect(record).toHaveProperty("createdAt")
      }
    })

    it("應按日期降冪排序", async () => {
      const res = await request(app).get("/api/daily-revenues").expect(200)

      if (res.body.length >= 2) {
        const dates = res.body.map((r: { date: string }) => r.date)
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i] >= dates[i + 1]).toBe(true)
        }
      }
    })

    it("應支援 startDate 篩選", async () => {
      const res = await request(app).get("/api/daily-revenues?startDate=2026-03-02").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      for (const row of res.body) {
        expect(row.date >= "2026-03-02").toBe(true)
      }
    })

    it("應支援 endDate 篩選", async () => {
      const res = await request(app).get("/api/daily-revenues?endDate=2026-03-02").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      for (const row of res.body) {
        expect(row.date <= "2026-03-02").toBe(true)
      }
    })

    it("應支援 startDate + endDate 範圍篩選", async () => {
      const res = await request(app)
        .get("/api/daily-revenues?startDate=2026-03-01&endDate=2026-03-03")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      for (const row of res.body) {
        expect(row.date >= "2026-03-01").toBe(true)
        expect(row.date <= "2026-03-03").toBe(true)
      }
    })

    it("應支援 projectId 篩選", async () => {
      const res = await request(app).get("/api/daily-revenues?projectId=1").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("無效日期格式應忽略篩選（不報錯）", async () => {
      const res = await request(app).get("/api/daily-revenues?startDate=invalid").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("應包含 projectName（LEFT JOIN 結果）", async () => {
      const res = await request(app).get("/api/daily-revenues").expect(200)

      if (res.body.length > 0) {
        // projectName 可能為 null（無關聯專案），但欄位應存在
        expect(res.body[0]).toHaveProperty("projectName")
      }
    })
  })

  // ── PATCH /api/daily-revenues/:id ────────────────────────────────

  describe("PATCH /api/daily-revenues/:id - 更新營收記錄", () => {
    let testId: number

    beforeAll(async () => {
      // 建立一筆供更新測試使用的記錄
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/daily-revenues")
        .send({
          date: "2026-04-01",
          amount: "20000",
          description: `更新測試記錄_${timestamp}`,
        })
        .expect(201)
      testId = res.body.id
      createdIds.push(testId)
    })

    it("應成功更新金額", async () => {
      const res = await request(app)
        .patch(`/api/daily-revenues/${testId}`)
        .send({ amount: "30000" })
        .expect(200)

      expect(res.body).toHaveProperty("id", testId)
      expect(res.body.amount).toBe("30000.00")
    })

    it("應成功更新日期", async () => {
      const res = await request(app)
        .patch(`/api/daily-revenues/${testId}`)
        .send({ date: "2026-04-15" })
        .expect(200)

      expect(res.body).toHaveProperty("id", testId)
      expect(res.body.date).toBe("2026-04-15")
    })

    it("應成功更新描述", async () => {
      const res = await request(app)
        .patch(`/api/daily-revenues/${testId}`)
        .send({ description: "已更新的描述" })
        .expect(200)

      expect(res.body.description).toBe("已更新的描述")
    })

    it("應成功更新 projectId", async () => {
      const res = await request(app)
        .patch(`/api/daily-revenues/${testId}`)
        .send({ projectId: "1" })
        .expect(200)

      expect(res.body).toHaveProperty("id", testId)
    })

    it("不存在的記錄應回傳 404", async () => {
      const res = await request(app).patch("/api/daily-revenues/999999").send({ amount: "10000" })

      expect(res.status).toBe(404)
      expect(res.body.message).toContain("找不到記錄")
    })

    it("無效的 id 應回傳 400", async () => {
      const res = await request(app).patch("/api/daily-revenues/abc").send({ amount: "10000" })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("無效的 id")
    })

    it("無效的日期格式應回傳 400", async () => {
      const res = await request(app)
        .patch(`/api/daily-revenues/${testId}`)
        .send({ date: "2026/04/01" })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("date")
    })

    it("無效的 amount 應回傳 400", async () => {
      const res = await request(app)
        .patch(`/api/daily-revenues/${testId}`)
        .send({ amount: "not-a-number" })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("amount")
    })

    it("應設定 updatedAt 時間戳", async () => {
      const res = await request(app)
        .patch(`/api/daily-revenues/${testId}`)
        .send({ description: "驗證 updatedAt" })
        .expect(200)

      expect(res.body.updatedAt).toBeDefined()
    })
  })

  // ── DELETE /api/daily-revenues/:id ───────────────────────────────

  describe("DELETE /api/daily-revenues/:id - 刪除營收記錄", () => {
    it("應成功刪除記錄", async () => {
      // 先建立一筆
      const createRes = await request(app)
        .post("/api/daily-revenues")
        .send({ date: "2026-05-01", amount: "8000" })
        .expect(201)

      const deleteRes = await request(app)
        .delete(`/api/daily-revenues/${createRes.body.id}`)
        .expect(200)

      expect(deleteRes.body).toHaveProperty("success", true)
    })

    it("刪除後應無法再查到該記錄", async () => {
      // 建立一筆
      const createRes = await request(app)
        .post("/api/daily-revenues")
        .send({ date: "2026-05-02", amount: "9000", description: "刪除驗證" })
        .expect(201)
      const deletedId = createRes.body.id

      // 刪除
      await request(app).delete(`/api/daily-revenues/${deletedId}`).expect(200)

      // 確認列表中不包含此記錄
      const listRes = await request(app).get("/api/daily-revenues").expect(200)

      const found = listRes.body.find((r: { id: number }) => r.id === deletedId)
      expect(found).toBeUndefined()
    })

    it("無效的 id 應回傳 400", async () => {
      const res = await request(app).delete("/api/daily-revenues/abc")

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("無效的 id")
    })
  })

  // ── GET /api/revenue/reports/stats ───────────────────────────────

  describe("GET /api/revenue/reports/stats - 總統計", () => {
    it("應回傳包含統計欄位的物件", async () => {
      const res = await request(app)
        .get("/api/revenue/reports/stats")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("totalRevenue")
      expect(res.body).toHaveProperty("recordCount")
      expect(res.body).toHaveProperty("avgDaily")
      expect(typeof res.body.totalRevenue).toBe("number")
      expect(typeof res.body.recordCount).toBe("number")
      expect(typeof res.body.avgDaily).toBe("number")
    })

    it("應支援 startDate 與 endDate 篩選", async () => {
      const res = await request(app)
        .get("/api/revenue/reports/stats?startDate=2026-03-01&endDate=2026-03-31")
        .expect(200)

      expect(res.body).toHaveProperty("totalRevenue")
      expect(res.body).toHaveProperty("recordCount")
    })

    it("無資料範圍應回傳零值", async () => {
      const res = await request(app)
        .get("/api/revenue/reports/stats?startDate=1999-01-01&endDate=1999-01-31")
        .expect(200)

      expect(res.body.totalRevenue).toBe(0)
      expect(res.body.recordCount).toBe(0)
      expect(res.body.avgDaily).toBe(0)
    })
  })

  // ── GET /api/revenue/reports/by-project ──────────────────────────

  describe("GET /api/revenue/reports/by-project - 按專案統計", () => {
    it("應回傳陣列，每筆含 projectName 與 totalRevenue", async () => {
      const res = await request(app).get("/api/revenue/reports/by-project").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      if (res.body.length > 0) {
        const row = res.body[0]
        expect(row).toHaveProperty("projectName")
        expect(row).toHaveProperty("totalRevenue")
        expect(row).toHaveProperty("recordCount")
        expect(typeof row.totalRevenue).toBe("number")
        expect(typeof row.recordCount).toBe("number")
      }
    })

    it("應支援日期範圍篩選", async () => {
      const res = await request(app)
        .get("/api/revenue/reports/by-project?startDate=2026-01-01&endDate=2026-12-31")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── GET /api/revenue/reports/daily-trend ──────────────────────────

  describe("GET /api/revenue/reports/daily-trend - 每日趨勢", () => {
    it("應回傳陣列，每筆含 date 與 totalRevenue", async () => {
      const res = await request(app).get("/api/revenue/reports/daily-trend").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      if (res.body.length > 0) {
        const row = res.body[0]
        expect(row).toHaveProperty("date")
        expect(row).toHaveProperty("totalRevenue")
        expect(typeof row.totalRevenue).toBe("number")
      }
    })

    it("預設 limit 30，回傳不超過 30 筆", async () => {
      const res = await request(app).get("/api/revenue/reports/daily-trend").expect(200)

      expect(res.body.length).toBeLessThanOrEqual(30)
    })

    it("應支援自訂 limit", async () => {
      const res = await request(app).get("/api/revenue/reports/daily-trend?limit=5").expect(200)

      expect(res.body.length).toBeLessThanOrEqual(5)
    })

    it("limit 不應超過 365", async () => {
      const res = await request(app).get("/api/revenue/reports/daily-trend?limit=9999").expect(200)

      expect(res.body.length).toBeLessThanOrEqual(365)
    })

    it("應按日期升冪排序（舊到新）", async () => {
      const res = await request(app).get("/api/revenue/reports/daily-trend").expect(200)

      if (res.body.length >= 2) {
        const dates = res.body.map((r: { date: string }) => r.date)
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i] <= dates[i + 1]).toBe(true)
        }
      }
    })

    it("應支援日期範圍篩選", async () => {
      const res = await request(app)
        .get("/api/revenue/reports/daily-trend?startDate=2026-03-01&endDate=2026-03-31")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── GET /api/revenue/reports/monthly-trend ────────────────────────

  describe("GET /api/revenue/reports/monthly-trend - 月度趨勢", () => {
    it("應回傳陣列，每筆含 month 與 totalRevenue", async () => {
      const res = await request(app).get("/api/revenue/reports/monthly-trend").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      if (res.body.length > 0) {
        const row = res.body[0]
        expect(row).toHaveProperty("month")
        expect(row).toHaveProperty("totalRevenue")
        expect(typeof row.totalRevenue).toBe("number")
        // month 格式為 YYYY-MM
        expect(row.month).toMatch(/^\d{4}-\d{2}$/)
      }
    })

    it("預設 limit 12，回傳不超過 12 筆", async () => {
      const res = await request(app).get("/api/revenue/reports/monthly-trend").expect(200)

      expect(res.body.length).toBeLessThanOrEqual(12)
    })

    it("應支援自訂 limit", async () => {
      const res = await request(app).get("/api/revenue/reports/monthly-trend?limit=3").expect(200)

      expect(res.body.length).toBeLessThanOrEqual(3)
    })

    it("應按月份升冪排序", async () => {
      const res = await request(app).get("/api/revenue/reports/monthly-trend").expect(200)

      if (res.body.length >= 2) {
        const months = res.body.map((r: { month: string }) => r.month)
        for (let i = 0; i < months.length - 1; i++) {
          expect(months[i] <= months[i + 1]).toBe(true)
        }
      }
    })
  })

  // ── GET /api/revenue/reports/yearly-comparison ────────────────────

  describe("GET /api/revenue/reports/yearly-comparison - 年度比較", () => {
    it("應回傳陣列，每筆含 year, month, totalRevenue", async () => {
      const res = await request(app).get("/api/revenue/reports/yearly-comparison").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      if (res.body.length > 0) {
        const row = res.body[0]
        expect(row).toHaveProperty("year")
        expect(row).toHaveProperty("month")
        expect(row).toHaveProperty("totalRevenue")
        expect(typeof row.year).toBe("number")
        expect(typeof row.month).toBe("number")
        expect(typeof row.totalRevenue).toBe("number")
      }
    })

    it("month 值應在 1-12 範圍內", async () => {
      const res = await request(app).get("/api/revenue/reports/yearly-comparison").expect(200)

      for (const row of res.body) {
        expect(row.month).toBeGreaterThanOrEqual(1)
        expect(row.month).toBeLessThanOrEqual(12)
      }
    })

    it("應按年月升冪排序", async () => {
      const res = await request(app).get("/api/revenue/reports/yearly-comparison").expect(200)

      if (res.body.length >= 2) {
        for (let i = 0; i < res.body.length - 1; i++) {
          const curr = res.body[i].year * 100 + res.body[i].month
          const next = res.body[i + 1].year * 100 + res.body[i + 1].month
          expect(curr).toBeLessThanOrEqual(next)
        }
      }
    })
  })

  // ── GET /api/revenue/reports/sources ──────────────────────────────

  describe("GET /api/revenue/reports/sources - 來源統計", () => {
    it("應回傳陣列，每筆含 sourceName 與 totalRevenue", async () => {
      const res = await request(app).get("/api/revenue/reports/sources").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
      if (res.body.length > 0) {
        const row = res.body[0]
        expect(row).toHaveProperty("sourceName")
        expect(row).toHaveProperty("sourceKey")
        expect(row).toHaveProperty("totalRevenue")
        expect(row).toHaveProperty("recordCount")
        expect(typeof row.totalRevenue).toBe("number")
        expect(typeof row.recordCount).toBe("number")
      }
    })

    it("應支援日期範圍篩選", async () => {
      const res = await request(app)
        .get("/api/revenue/reports/sources?startDate=2026-01-01&endDate=2026-12-31")
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── 邊界條件測試 ──────────────────────────────────────────────────

  describe("邊界條件", () => {
    it("金額為 0.01（最小正數）應可成功建立", async () => {
      const res = await request(app)
        .post("/api/daily-revenues")
        .send({ date: "2026-06-01", amount: "0.01" })
        .expect(201)

      expect(res.body).toHaveProperty("id")
      createdIds.push(res.body.id)
    })

    it("大額金額應可成功建立", async () => {
      const res = await request(app)
        .post("/api/daily-revenues")
        .send({ date: "2026-06-02", amount: "9999999999.99" })
        .expect(201)

      expect(res.body).toHaveProperty("id")
      createdIds.push(res.body.id)
    })

    it("description 為空字串應視為無描述", async () => {
      const res = await request(app)
        .post("/api/daily-revenues")
        .send({ date: "2026-06-03", amount: "1000", description: "" })
        .expect(201)

      expect(res.body).toHaveProperty("id")
      createdIds.push(res.body.id)
    })

    it("同一天可建立多筆營收記錄", async () => {
      const res1 = await request(app)
        .post("/api/daily-revenues")
        .send({ date: "2026-06-10", amount: "5000", description: "第一筆" })
        .expect(201)
      createdIds.push(res1.body.id)

      const res2 = await request(app)
        .post("/api/daily-revenues")
        .send({ date: "2026-06-10", amount: "3000", description: "第二筆" })
        .expect(201)
      createdIds.push(res2.body.id)

      // 確認兩筆都存在
      const listRes = await request(app)
        .get("/api/daily-revenues?startDate=2026-06-10&endDate=2026-06-10")
        .expect(200)

      const matched = listRes.body.filter(
        (r: { id: number }) => r.id === res1.body.id || r.id === res2.body.id
      )
      expect(matched.length).toBe(2)
    })

    it("PATCH 清除 projectId（設為空）應可成功", async () => {
      // 先建立一筆帶 projectId 的記錄
      const createRes = await request(app)
        .post("/api/daily-revenues")
        .send({ date: "2026-06-20", amount: "7000", projectId: "1" })
        .expect(201)
      createdIds.push(createRes.body.id)

      // 清除 projectId
      const patchRes = await request(app)
        .patch(`/api/daily-revenues/${createRes.body.id}`)
        .send({ projectId: "" })
        .expect(200)

      expect(patchRes.body.projectId).toBeNull()
    })

    it("報表 API 無效日期參數應被忽略而非報錯", async () => {
      await request(app)
        .get("/api/revenue/reports/stats?startDate=bad-date&endDate=also-bad")
        .expect(200)
    })
  })
})
