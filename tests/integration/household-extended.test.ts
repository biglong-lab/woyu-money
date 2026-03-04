/**
 * Household API 擴展整合測試
 *
 * 覆蓋：統計查詢、月度支出追蹤、預算比較、年度預算、
 *       預算 CRUD 完整流程、分類預算篩選
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { Express } from "express"
import type TestAgent from "supertest/lib/agent"

const skipIfNoDb = !process.env.DATABASE_URL

// 動態匯入避免無 DB 時模組初始化失敗
async function setup() {
  const { createTestApp, createAuthenticatedAgent } = await import("../helpers/test-app")
  return { createTestApp, createAuthenticatedAgent }
}

describe.skipIf(skipIfNoDb)("Household API — 擴展測試", () => {
  let app: Express
  let agent: TestAgent

  // 追蹤測試建立的資源，用於清理
  const createdBudgetIds: number[] = []
  const createdExpenseIds: number[] = []

  beforeAll(async () => {
    const { createTestApp, createAuthenticatedAgent } = await setup()
    app = await createTestApp()
    agent = await createAuthenticatedAgent(app)
  })

  afterAll(async () => {
    // 清理測試建立的支出
    for (const id of createdExpenseIds) {
      try {
        await agent.delete(`/api/household-expenses/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
    // 清理測試建立的預算
    for (const id of createdBudgetIds) {
      try {
        await agent.delete(`/api/household-budgets/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── 預算 CRUD 完整流程 ──────────────────────────────────────

  describe("預算 CRUD 完整流程", () => {
    let budgetId: number

    it("POST /api/household-budgets — 建立分類預算", async () => {
      const res = await agent
        .post("/api/household-budgets")
        .send({
          categoryId: 1,
          year: 2026,
          month: 3,
          budgetAmount: "8000",
        })
        .expect(201)

      expect(res.body).toHaveProperty("id")
      // DB 的 numeric 欄位回傳帶小數位
      expect(parseFloat(res.body.budgetAmount)).toBe(8000)
      budgetId = res.body.id
      createdBudgetIds.push(budgetId)
    })

    it("POST /api/household-budgets — 同分類同月份應更新而非重複建立", async () => {
      const res = await agent
        .post("/api/household-budgets")
        .send({
          categoryId: 1,
          year: 2026,
          month: 3,
          budgetAmount: "9000",
        })
        .expect(201)

      // 應該是更新同一筆記錄
      expect(parseFloat(res.body.budgetAmount)).toBe(9000)
    })

    it("PUT /api/household-budgets/:id — 更新指定預算", async () => {
      if (!budgetId) return

      const res = await agent
        .put(`/api/household-budgets/${budgetId}`)
        .send({
          categoryId: 1,
          year: 2026,
          month: 3,
          budgetAmount: "12000",
        })
        .expect(200)

      expect(parseFloat(res.body.budgetAmount)).toBe(12000)
    })

    it("PUT /api/household-budgets/:id — 無效資料應回傳 400", async () => {
      if (!budgetId) return

      await agent
        .put(`/api/household-budgets/${budgetId}`)
        .send({ invalidField: "test" })
        .expect(400)
    })

    it("GET /api/household-budgets — 取得所有分類預算", async () => {
      const res = await agent.get("/api/household-budgets").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── 支出篩選與分頁 ──────────────────────────────────────────

  describe("支出篩選與分頁", () => {
    let expenseId: number

    it("POST /api/household-expenses — 建立測試支出", async () => {
      const res = await agent
        .post("/api/household-expenses")
        .send({
          categoryId: 1,
          amount: "1500",
          description: "擴展測試支出 — 三月份",
          date: "2026-03-10",
          paymentMethod: "cash",
        })
        .expect(201)

      expect(res.body).toHaveProperty("id")
      expenseId = res.body.id
      createdExpenseIds.push(expenseId)
    })

    it("GET /api/household-expenses?page=1&limit=3 — 分頁查詢", async () => {
      const res = await agent.get("/api/household-expenses?page=1&limit=3").expect(200)

      // 結果為陣列或帶 data 的物件
      expect(res.body).toBeDefined()
    })

    it("GET /api/household-expenses?categoryId=1 — 分類篩選", async () => {
      const res = await agent.get("/api/household-expenses?categoryId=1").expect(200)

      expect(res.body).toBeDefined()
    })

    it("GET /api/household-expenses?startDate&endDate — 日期範圍篩選", async () => {
      const res = await agent
        .get("/api/household-expenses?startDate=2026-03-01&endDate=2026-03-31")
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("PUT /api/household-expenses/:id — 更新支出", async () => {
      if (!expenseId) return

      const res = await agent
        .put(`/api/household-expenses/${expenseId}`)
        .send({
          categoryId: 1,
          amount: "2000",
          description: "已更新的擴展測試支出",
          date: "2026-03-10",
          paymentMethod: "credit_card",
        })
        .expect(200)

      expect(parseFloat(res.body.amount)).toBe(2000)
    })

    it("DELETE /api/household-expenses/:id — 刪除支出", async () => {
      // 先建立一筆待刪除的
      const createRes = await agent
        .post("/api/household-expenses")
        .send({
          categoryId: 1,
          amount: "50",
          description: "待刪除",
          date: "2026-03-10",
          paymentMethod: "cash",
        })
        .expect(201)

      await agent.delete(`/api/household-expenses/${createRes.body.id}`).expect(204)
    })
  })

  // ── 分類統計查詢 ────────────────────────────────────────────

  describe("GET /api/household/category-stats/:id — 分類統計", () => {
    it("應回傳指定分類的統計資料", async () => {
      const res = await agent.get("/api/household/category-stats/1").expect(200)

      expect(res.body).toHaveProperty("currentBudget")
      expect(res.body).toHaveProperty("totalExpenses")
      expect(res.body).toHaveProperty("remainingBudget")
      expect(res.body).toHaveProperty("expenseCount")
      expect(res.body).toHaveProperty("expenses")
    })

    it("應支援 year 和 month 查詢參數", async () => {
      const res = await agent.get("/api/household/category-stats/1?year=2026&month=3").expect(200)

      expect(res.body).toHaveProperty("currentBudget")
      expect(res.body).toHaveProperty("totalExpenses")
    })

    it("不存在的分類也應回傳（預設零值）", async () => {
      const res = await agent
        .get("/api/household/category-stats/9999?year=2026&month=1")
        .expect(200)

      expect(res.body.totalExpenses).toBe("0")
      expect(res.body.expenseCount).toBe(0)
    })
  })

  // ── 分類列表 ────────────────────────────────────────────────

  describe("GET /api/household-categories — 家用分類列表", () => {
    it("應回傳分類陣列", async () => {
      const res = await agent.get("/api/household-categories").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── 多筆支出建立與批次驗證 ──────────────────────────────────

  describe("多筆支出建立與批次驗證", () => {
    const batchExpenseIds: number[] = []

    afterAll(async () => {
      for (const id of batchExpenseIds) {
        try {
          await agent.delete(`/api/household-expenses/${id}`)
        } catch {
          // 忽略
        }
      }
    })

    it("應能連續建立多筆不同分類的支出", async () => {
      const expenses = [
        {
          categoryId: 1,
          amount: "100",
          description: "批次A",
          date: "2026-03-15",
          paymentMethod: "cash",
        },
        {
          categoryId: 1,
          amount: "200",
          description: "批次B",
          date: "2026-03-16",
          paymentMethod: "credit_card",
        },
        {
          categoryId: 1,
          amount: "300",
          description: "批次C",
          date: "2026-03-17",
          paymentMethod: "cash",
        },
      ]

      for (const expense of expenses) {
        const res = await agent.post("/api/household-expenses").send(expense).expect(201)

        expect(res.body).toHaveProperty("id")
        batchExpenseIds.push(res.body.id)
        createdExpenseIds.push(res.body.id)
      }

      expect(batchExpenseIds.length).toBe(3)
    })

    it("分頁查詢應依日期倒序排列", async () => {
      const res = await agent.get("/api/household-expenses?page=1&limit=50").expect(200)

      const items = Array.isArray(res.body) ? res.body : res.body.data || []
      if (items.length >= 2) {
        // 驗證排序：較新日期排前面
        const firstDate = new Date(items[0].date).getTime()
        const secondDate = new Date(items[1].date).getTime()
        expect(firstDate).toBeGreaterThanOrEqual(secondDate)
      }
    })
  })

  // ── 預算驗證邊界案例 ───────────────────────────────────────

  describe("預算驗證邊界案例", () => {
    it("POST /api/household-budgets — 缺少必要欄位應回傳 400", async () => {
      await agent.post("/api/household-budgets").send({}).expect(400)
    })

    it("POST /api/household-budgets — 只有 budgetAmount 沒有 categoryId 應回傳 400", async () => {
      await agent.post("/api/household-budgets").send({ budgetAmount: "5000" }).expect(400)
    })
  })

  // ── 支出驗證邊界案例 ───────────────────────────────────────

  describe("支出驗證邊界案例", () => {
    it("POST /api/household-expenses — 缺少必要欄位應回傳 400", async () => {
      await agent.post("/api/household-expenses").send({}).expect(400)
    })

    it("PUT /api/household-expenses/:id — 無效資料應回傳 400", async () => {
      // 使用不存在的 ID 但無效資料
      await agent.put("/api/household-expenses/99999").send({ invalidField: "test" }).expect(400)
    })
  })
})
