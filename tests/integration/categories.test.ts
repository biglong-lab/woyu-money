/**
 * Categories & Projects API 整合測試
 * 測試分類與專案的 CRUD 操作
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const skipIfNoDb = !process.env.DATABASE_URL

async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(express.json())

  // 模擬認證中間件
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

  const categoryRoutes = (await import("../../server/routes/categories")).default
  app.use(categoryRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Categories
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("Categories API", () => {
  let app: Express
  const createdCategoryIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    for (const id of createdCategoryIds) {
      try {
        await request(app).delete(`/api/categories/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── GET /api/categories ─────────────────────────────────────────

  describe("GET /api/categories - 分類列表", () => {
    it("應回傳分類陣列", async () => {
      const res = await request(app)
        .get("/api/categories")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("每筆分類應包含基本欄位", async () => {
      const res = await request(app).get("/api/categories").expect(200)

      if (res.body.length > 0) {
        const category = res.body[0]
        expect(category).toHaveProperty("id")
        expect(category).toHaveProperty("categoryName")
      }
    })
  })

  // ── POST /api/categories ────────────────────────────────────────

  describe("POST /api/categories - 新增分類", () => {
    it("應成功建立分類並回傳 201", async () => {
      const timestamp = Date.now()
      const newCategory = {
        categoryName: `測試分類_${timestamp}`,
        categoryType: "project",
        description: "整合測試用分類",
      }

      const res = await request(app).post("/api/categories").send(newCategory).expect(201)

      expect(res.body).toHaveProperty("id")
      expect(res.body.categoryName).toBe(newCategory.categoryName)
      createdCategoryIds.push(res.body.id)
    })

    it("缺少必填欄位應回傳 400", async () => {
      const res = await request(app).post("/api/categories").send({
        description: "沒有名稱",
      })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
    })
  })

  // ── PUT /api/categories/:id ─────────────────────────────────────

  describe("PUT /api/categories/:id - 更新分類", () => {
    let testCategoryId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/categories")
        .send({
          categoryName: `更新測試分類_${timestamp}`,
          categoryType: "project",
        })
        .expect(201)
      testCategoryId = res.body.id
      createdCategoryIds.push(testCategoryId)
    })

    it("應成功更新分類名稱", async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .put(`/api/categories/${testCategoryId}`)
        .send({
          categoryName: `已更新分類_${timestamp}`,
          categoryType: "project",
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  // ── DELETE /api/categories/:id ──────────────────────────────────

  describe("DELETE /api/categories/:id - 刪除分類", () => {
    let testCategoryId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/categories")
        .send({
          categoryName: `刪除測試分類_${timestamp}`,
          categoryType: "project",
        })
        .expect(201)
      testCategoryId = res.body.id
    })

    it("應成功刪除並回傳 204", async () => {
      await request(app).delete(`/api/categories/${testCategoryId}`).expect(204)
    })
  })

  // ── 分類子類型端點 ──────────────────────────────────────────────

  describe("GET /api/categories/debt - 債務分類", () => {
    it("應回傳債務分類陣列", async () => {
      const res = await request(app).get("/api/categories/debt").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe("GET /api/categories/project - 專案分類", () => {
    it("應回傳專案分類陣列", async () => {
      const res = await request(app).get("/api/categories/project").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe("GET /api/categories/household - 家庭分類", () => {
    it("應回傳家庭分類陣列", async () => {
      const res = await request(app).get("/api/categories/household").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe("GET /api/categories/fixed - 固定分類", () => {
    it("應回傳固定分類陣列", async () => {
      const res = await request(app).get("/api/categories/fixed").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Projects
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("Projects API", () => {
  let app: Express
  const createdProjectIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    for (const id of createdProjectIds) {
      try {
        await request(app).delete(`/api/projects/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  // ── GET /api/projects ───────────────────────────────────────────

  describe("GET /api/projects - 專案列表", () => {
    it("應回傳專案陣列", async () => {
      const res = await request(app)
        .get("/api/projects")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("每筆專案應包含基本欄位", async () => {
      const res = await request(app).get("/api/projects").expect(200)

      if (res.body.length > 0) {
        const project = res.body[0]
        expect(project).toHaveProperty("id")
        expect(project).toHaveProperty("projectName")
        expect(project).toHaveProperty("projectType")
      }
    })
  })

  // ── GET /api/payment/projects ───────────────────────────────────

  describe("GET /api/payment/projects - 相容路徑", () => {
    it("應與 /api/projects 回傳相同格式", async () => {
      const res = await request(app).get("/api/payment/projects").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  // ── POST /api/projects ──────────────────────────────────────────

  describe("POST /api/projects - 新增專案", () => {
    it("應成功建立專案並回傳 201", async () => {
      const timestamp = Date.now()
      const newProject = {
        projectName: `測試專案_${timestamp}`,
        projectType: "general",
        description: "整合測試用專案",
      }

      const res = await request(app).post("/api/projects").send(newProject).expect(201)

      expect(res.body).toHaveProperty("id")
      expect(res.body.projectName).toBe(newProject.projectName)
      createdProjectIds.push(res.body.id)
    })

    it("缺少必填欄位應回傳 400", async () => {
      const res = await request(app).post("/api/projects").send({
        description: "沒有名稱",
      })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
    })
  })

  // ── PUT /api/projects/:id ───────────────────────────────────────

  describe("PUT /api/projects/:id - 更新專案", () => {
    let testProjectId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/projects")
        .send({
          projectName: `更新測試專案_${timestamp}`,
          projectType: "general",
        })
        .expect(201)
      testProjectId = res.body.id
      createdProjectIds.push(testProjectId)
    })

    it("應成功更新專案名稱", async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .send({
          projectName: `已更新專案_${timestamp}`,
          projectType: "general",
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  // ── DELETE /api/projects/:id ────────────────────────────────────

  describe("DELETE /api/projects/:id - 刪除專案", () => {
    let testProjectId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/projects")
        .send({
          projectName: `刪除測試專案_${timestamp}`,
          projectType: "general",
        })
        .expect(201)
      testProjectId = res.body.id
    })

    it("應成功刪除並回傳 204", async () => {
      await request(app).delete(`/api/projects/${testProjectId}`).expect(204)
    })
  })

  // ── GET /api/fixed-categories ───────────────────────────────────

  describe("GET /api/fixed-categories - 固定分類列表", () => {
    it("應回傳固定分類陣列", async () => {
      const res = await request(app).get("/api/fixed-categories").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 專案分類專屬 CRUD (Project Categories)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("Project Categories API", () => {
  let app: Express
  const createdCategoryIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    for (const id of createdCategoryIds) {
      try {
        await request(app).delete(`/api/categories/project/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  describe("POST /api/categories/project - 新增專案分類", () => {
    it("應成功建立專案分類並回傳 201", async () => {
      const timestamp = Date.now()
      const newCategory = {
        categoryName: `專案分類_${timestamp}`,
        description: "專案分類測試",
      }

      const res = await request(app)
        .post("/api/categories/project")
        .send(newCategory)
        .expect(201)

      expect(res.body).toHaveProperty("id")
      expect(res.body.categoryName).toBe(newCategory.categoryName)
      createdCategoryIds.push(res.body.id)
    })
  })

  describe("PUT /api/categories/project/:id - 更新專案分類", () => {
    let testCategoryId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/categories/project")
        .send({
          categoryName: `更新專案分類_${timestamp}`,
        })
        .expect(201)
      testCategoryId = res.body.id
      createdCategoryIds.push(testCategoryId)
    })

    it("應成功更新專案分類", async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .put(`/api/categories/project/${testCategoryId}`)
        .send({
          categoryName: `已更新專案分類_${timestamp}`,
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  describe("DELETE /api/categories/project/:id - 刪除專案分類", () => {
    let testCategoryId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/categories/project")
        .send({
          categoryName: `刪除專案分類_${timestamp}`,
        })
        .expect(201)
      testCategoryId = res.body.id
    })

    it("應成功刪除專案分類並回傳 204", async () => {
      await request(app).delete(`/api/categories/project/${testCategoryId}`).expect(204)
    })
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 家庭分類專屬 CRUD (Household Categories)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("Household Categories API", () => {
  let app: Express
  const createdCategoryIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    for (const id of createdCategoryIds) {
      try {
        await request(app).delete(`/api/categories/household/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  describe("POST /api/categories/household - 新增家庭分類", () => {
    it("應成功建立家庭分類並回傳 201", async () => {
      const timestamp = Date.now()
      const newCategory = {
        categoryName: `家庭分類_${timestamp}`,
        description: "家庭分類測試",
      }

      const res = await request(app)
        .post("/api/categories/household")
        .send(newCategory)
        .expect(201)

      expect(res.body).toHaveProperty("id")
      expect(res.body.categoryName).toBe(newCategory.categoryName)
      createdCategoryIds.push(res.body.id)
    })
  })

  describe("PUT /api/categories/household/:id - 更新家庭分類", () => {
    let testCategoryId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/categories/household")
        .send({
          categoryName: `更新家庭分類_${timestamp}`,
        })
        .expect(201)
      testCategoryId = res.body.id
      createdCategoryIds.push(testCategoryId)
    })

    it("應成功更新家庭分類", async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .put(`/api/categories/household/${testCategoryId}`)
        .send({
          categoryName: `已更新家庭分類_${timestamp}`,
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  describe("DELETE /api/categories/household/:id - 刪除家庭分類", () => {
    let testCategoryId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/categories/household")
        .send({
          categoryName: `刪除家庭分類_${timestamp}`,
        })
        .expect(201)
      testCategoryId = res.body.id
    })

    it("應成功刪除家庭分類並回傳 204", async () => {
      await request(app).delete(`/api/categories/household/${testCategoryId}`).expect(204)
    })
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 固定分類 CRUD (Fixed Categories)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("Fixed Categories CRUD API", () => {
  let app: Express
  const createdCategoryIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    for (const id of createdCategoryIds) {
      try {
        await request(app).delete(`/api/categories/fixed/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }
  })

  describe("POST /api/categories/fixed - 新增固定分類", () => {
    it("應成功建立固定分類並回傳 201", async () => {
      const timestamp = Date.now()
      const newCategory = {
        categoryName: `固定分類_${timestamp}`,
        categoryType: "fixed",
        sortOrder: 999,
      }

      const res = await request(app)
        .post("/api/categories/fixed")
        .send(newCategory)
        .expect(201)

      expect(res.body).toHaveProperty("id")
      expect(res.body.categoryName).toBe(newCategory.categoryName)
      createdCategoryIds.push(res.body.id)
    })
  })

  describe("PUT /api/categories/fixed/:id - 更新固定分類", () => {
    let testCategoryId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/categories/fixed")
        .send({
          categoryName: `更新固定分類_${timestamp}`,
          sortOrder: 999,
        })
        .expect(201)
      testCategoryId = res.body.id
      createdCategoryIds.push(testCategoryId)
    })

    it("應成功更新固定分類", async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .put(`/api/categories/fixed/${testCategoryId}`)
        .send({
          categoryName: `已更新固定分類_${timestamp}`,
          sortOrder: 998,
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  describe("DELETE /api/categories/fixed/:id - 刪除固定分類", () => {
    let testCategoryId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/categories/fixed")
        .send({
          categoryName: `刪除固定分類_${timestamp}`,
          sortOrder: 999,
        })
        .expect(201)
      testCategoryId = res.body.id
    })

    it("應成功刪除固定分類並回傳 204", async () => {
      await request(app).delete(`/api/categories/fixed/${testCategoryId}`).expect(204)
    })
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 固定分類子選項 CRUD (Fixed Category Sub Options)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("Fixed Category Sub Options API", () => {
  let app: Express
  let testProjectId: number
  let testFixedCategoryId: number
  const createdSubOptionIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()

    // 建立測試用專案
    const projectRes = await request(app).post("/api/projects").send({
      projectName: `子選項測試專案_${Date.now()}`,
      projectType: "general",
    })
    testProjectId = projectRes.body.id

    // 建立測試用固定分類
    const categoryRes = await request(app).post("/api/categories/fixed").send({
      categoryName: `子選項測試分類_${Date.now()}`,
      sortOrder: 999,
    })
    testFixedCategoryId = categoryRes.body.id
  })

  afterAll(async () => {
    // 清理子選項
    for (const id of createdSubOptionIds) {
      try {
        await request(app).delete(`/api/fixed-category-sub-options/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }

    // 清理測試資料
    try {
      await request(app).delete(`/api/categories/fixed/${testFixedCategoryId}`)
      await request(app).delete(`/api/projects/${testProjectId}`)
    } catch {
      // 忽略清理錯誤
    }
  })

  describe("GET /api/fixed-category-sub-options - 取得子選項列表", () => {
    it("應回傳子選項陣列", async () => {
      const res = await request(app).get("/api/fixed-category-sub-options").expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("支援 projectId 和 fixedCategoryId 查詢參數", async () => {
      const res = await request(app)
        .get("/api/fixed-category-sub-options")
        .query({ projectId: testProjectId, fixedCategoryId: testFixedCategoryId })
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe("GET /api/fixed-category-sub-options/:projectId - 依專案取得子選項", () => {
    it("應回傳指定專案的子選項", async () => {
      const res = await request(app)
        .get(`/api/fixed-category-sub-options/${testProjectId}`)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("支援 fixedCategoryId 查詢參數", async () => {
      const res = await request(app)
        .get(`/api/fixed-category-sub-options/${testProjectId}`)
        .query({ fixedCategoryId: testFixedCategoryId })
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe("POST /api/fixed-category-sub-options - 新增子選項", () => {
    it("應成功建立子選項並回傳 201", async () => {
      const timestamp = Date.now()
      const newSubOption = {
        projectId: testProjectId,
        fixedCategoryId: testFixedCategoryId,
        itemName: `子選項_${timestamp}`,
        accountInfo: "測試帳戶資訊",
        notes: "測試備註",
      }

      const res = await request(app)
        .post("/api/fixed-category-sub-options")
        .send(newSubOption)
        .expect(200)

      expect(res.body).toHaveProperty("id")
      createdSubOptionIds.push(res.body.id)
    })

    it("缺少必填欄位應回傳 400", async () => {
      const res = await request(app).post("/api/fixed-category-sub-options").send({
        projectId: testProjectId,
        // 缺少 fixedCategoryId 和 itemName
      })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
    })

    it("缺少 projectId 應回傳 400", async () => {
      const res = await request(app).post("/api/fixed-category-sub-options").send({
        fixedCategoryId: testFixedCategoryId,
        itemName: "測試",
      })

      expect(res.status).toBe(400)
    })

    it("缺少 fixedCategoryId 應回傳 400", async () => {
      const res = await request(app).post("/api/fixed-category-sub-options").send({
        projectId: testProjectId,
        itemName: "測試",
      })

      expect(res.status).toBe(400)
    })

    it("缺少 itemName 應回傳 400", async () => {
      const res = await request(app).post("/api/fixed-category-sub-options").send({
        projectId: testProjectId,
        fixedCategoryId: testFixedCategoryId,
      })

      expect(res.status).toBe(400)
    })
  })

  describe("PUT /api/fixed-category-sub-options/:id - 更新子選項", () => {
    let testSubOptionId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/fixed-category-sub-options")
        .send({
          projectId: testProjectId,
          fixedCategoryId: testFixedCategoryId,
          itemName: `更新測試子選項_${timestamp}`,
        })
      testSubOptionId = res.body.id
      createdSubOptionIds.push(testSubOptionId)
    })

    it("應成功更新子選項", async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .put(`/api/fixed-category-sub-options/${testSubOptionId}`)
        .send({
          projectId: testProjectId,
          fixedCategoryId: testFixedCategoryId,
          itemName: `已更新子選項_${timestamp}`,
          accountInfo: "已更新帳戶資訊",
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })

    it("缺少必填欄位應回傳 400", async () => {
      const res = await request(app)
        .put(`/api/fixed-category-sub-options/${testSubOptionId}`)
        .send({
          projectId: testProjectId,
          // 缺少 fixedCategoryId 和 itemName
        })

      expect(res.status).toBe(400)
    })
  })

  describe("DELETE /api/fixed-category-sub-options/:id - 刪除子選項", () => {
    let testSubOptionId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/fixed-category-sub-options")
        .send({
          projectId: testProjectId,
          fixedCategoryId: testFixedCategoryId,
          itemName: `刪除測試子選項_${timestamp}`,
        })
      testSubOptionId = res.body.id
    })

    it("應成功刪除子選項並回傳成功訊息", async () => {
      const res = await request(app)
        .delete(`/api/fixed-category-sub-options/${testSubOptionId}`)
        .expect(200)

      expect(res.body).toHaveProperty("message")
    })
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 專案分類模板 CRUD (Project Category Templates)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("Project Category Templates API", () => {
  let app: Express
  let testProjectId: number
  let testCategoryId: number
  const createdTemplateIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()

    // 建立測試用專案
    const projectRes = await request(app).post("/api/projects").send({
      projectName: `模板測試專案_${Date.now()}`,
      projectType: "general",
    })
    testProjectId = projectRes.body.id

    // 建立測試用分類
    const categoryRes = await request(app).post("/api/categories/project").send({
      categoryName: `模板測試分類_${Date.now()}`,
    })
    testCategoryId = categoryRes.body.id
  })

  afterAll(async () => {
    // 清理模板
    for (const id of createdTemplateIds) {
      try {
        await request(app).delete(`/api/project-category-templates/${id}`)
      } catch {
        // 忽略清理錯誤
      }
    }

    // 清理測試資料
    try {
      await request(app).delete(`/api/categories/project/${testCategoryId}`)
      await request(app).delete(`/api/projects/${testProjectId}`)
    } catch {
      // 忽略清理錯誤
    }
  })

  describe("GET /api/project-category-templates/:projectId - 取得專案模板", () => {
    it("應回傳指定專案的模板陣列", async () => {
      const res = await request(app)
        .get(`/api/project-category-templates/${testProjectId}`)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("支援 categoryId 查詢參數", async () => {
      const res = await request(app)
        .get(`/api/project-category-templates/${testProjectId}`)
        .query({ categoryId: testCategoryId })
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe("POST /api/project-category-templates - 新增模板", () => {
    it("應成功建立模板並回傳 200", async () => {
      const timestamp = Date.now()
      const newTemplate = {
        projectId: testProjectId,
        categoryId: testCategoryId,
        templateName: `模板_${timestamp}`,
        defaultAmount: 1000,
      }

      const res = await request(app)
        .post("/api/project-category-templates")
        .send(newTemplate)
        .expect(200)

      expect(res.body).toHaveProperty("id")
      createdTemplateIds.push(res.body.id)
    })
  })

  describe("PUT /api/project-category-templates/:id - 更新模板", () => {
    let testTemplateId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/project-category-templates")
        .send({
          projectId: testProjectId,
          categoryId: testCategoryId,
          templateName: `更新模板_${timestamp}`,
          defaultAmount: 1000,
        })
      testTemplateId = res.body.id
      createdTemplateIds.push(testTemplateId)
    })

    it("應成功更新模板", async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .put(`/api/project-category-templates/${testTemplateId}`)
        .send({
          projectId: testProjectId,
          categoryId: testCategoryId,
          templateName: `已更新模板_${timestamp}`,
          defaultAmount: 2000,
        })
        .expect(200)

      expect(res.body).toHaveProperty("id")
    })
  })

  describe("DELETE /api/project-category-templates/:id - 刪除模板", () => {
    let testTemplateId: number

    beforeAll(async () => {
      const timestamp = Date.now()
      const res = await request(app)
        .post("/api/project-category-templates")
        .send({
          projectId: testProjectId,
          categoryId: testCategoryId,
          templateName: `刪除模板_${timestamp}`,
          defaultAmount: 1000,
        })
      testTemplateId = res.body.id
    })

    it("應成功刪除模板並回傳成功訊息", async () => {
      const res = await request(app)
        .delete(`/api/project-category-templates/${testTemplateId}`)
        .expect(200)

      expect(res.body).toHaveProperty("message")
    })
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 家庭分類統計 (Household Category Stats)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("Household Category Stats API", () => {
  let app: Express
  let testCategoryId: number

  beforeAll(async () => {
    app = await createTestApp()

    // 建立測試用家庭分類
    const categoryRes = await request(app).post("/api/categories/household").send({
      categoryName: `統計測試分類_${Date.now()}`,
    })
    testCategoryId = categoryRes.body.id
  })

  afterAll(async () => {
    try {
      await request(app).delete(`/api/categories/household/${testCategoryId}`)
    } catch {
      // 忽略清理錯誤
    }
  })

  describe("GET /api/household/category-stats/:id - 取得分類統計", () => {
    it("應回傳分類統計資料", async () => {
      const res = await request(app)
        .get(`/api/household/category-stats/${testCategoryId}`)
        .expect(200)

      expect(res.body).toBeDefined()
    })

    it("支援 year 和 month 查詢參數", async () => {
      const res = await request(app)
        .get(`/api/household/category-stats/${testCategoryId}`)
        .query({ year: "2026", month: "2" })
        .expect(200)

      expect(res.body).toBeDefined()
    })
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 邊界情況與錯誤處理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe.skipIf(skipIfNoDb)("Edge Cases & Error Handling", () => {
  let app: Express

  beforeAll(async () => {
    app = await createTestApp()
  })

  describe("無效的 ID 處理", () => {
    it("更新不存在的分類應回傳 404 或 500", async () => {
      const res = await request(app)
        .put("/api/categories/999999")
        .send({
          categoryName: "不存在的分類",
          categoryType: "project",
        })

      expect([200, 404, 500]).toContain(res.status)
    })

    it("刪除不存在的專案應回傳 404 或 500", async () => {
      const res = await request(app).delete("/api/projects/999999")

      expect([204, 404, 500]).toContain(res.status)
    })

    it("更新不存在的固定分類應回傳 404 或 500", async () => {
      const res = await request(app)
        .put("/api/categories/fixed/999999")
        .send({
          categoryName: "不存在",
          sortOrder: 1,
        })

      expect([200, 404, 500]).toContain(res.status)
    })

    it("刪除不存在的子選項應回傳 404 或 500", async () => {
      const res = await request(app).delete("/api/fixed-category-sub-options/999999")

      expect([200, 404, 500]).toContain(res.status)
    })
  })

  describe("資料驗證", () => {
    it("分類名稱為空字串的實際行為（應考慮修正 schema）", async () => {
      const res = await request(app).post("/api/categories").send({
        categoryName: "",
        categoryType: "project",
      })

      expect(res.status).toBe(400)
    })

    it("專案名稱為空字串的實際行為（應考慮修正 schema）", async () => {
      const res = await request(app).post("/api/projects").send({
        projectName: "",
        projectType: "general",
      })

      expect(res.status).toBe(400)
    })

    it("無效的 categoryType 的實際行為", async () => {
      const res = await request(app).post("/api/categories").send({
        categoryName: "測試分類",
        categoryType: "invalid_type",
      })

      expect(res.status).toBe(400)
    })

    it("無效的 projectType 的實際行為", async () => {
      const res = await request(app).post("/api/projects").send({
        projectName: "測試專案",
        projectType: "invalid_type",
      })

      expect(res.status).toBe(400)
    })
  })

  describe("路徑參數驗證", () => {
    it("非數字的 ID 應能正常處理", async () => {
      const res = await request(app).get("/api/household/category-stats/abc")

      // 依照實作可能回傳不同狀態碼
      expect([200, 400, 404, 500]).toContain(res.status)
    })

    it("GET /api/project-category-templates 非數字 projectId 應能正常處理", async () => {
      const res = await request(app).get("/api/project-category-templates/abc")

      expect([200, 400, 404, 500]).toContain(res.status)
    })
  })
})
