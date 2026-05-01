/**
 * 統一 Categories API 整合測試（PR-2）
 *
 * 涵蓋：
 *   GET  /api/categories/unified
 *   POST /api/categories/:id/merge
 *   POST /api/categories/archive-unused
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

  const categoriesUnifiedRoutes = (await import("../../server/routes/categories-unified")).default
  const categoryRoutes = (await import("../../server/routes/categories")).default
  app.use(categoriesUnifiedRoutes)
  app.use(categoryRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

interface UnifiedCategory {
  id: number
  categoryName: string | null
  categoryType: string | null
  description: string | null
  isDeleted: boolean
  createdAt: string | null
  usedCount: number
  lastUsedAt: string | null
  budgetCount: number
  isInUse: boolean
}

describe.skipIf(skipIfNoDb)("Categories Unified API", () => {
  let app: Express
  const cleanupIds: number[] = []

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    if (cleanupIds.length === 0) return
    const { db } = await import("../../server/db")
    const { inArray } = await import("drizzle-orm")
    const { debtCategories } = await import("../../shared/schema")
    await db.delete(debtCategories).where(inArray(debtCategories.id, cleanupIds))
  })

  // ─────────────────────────────────────────────
  // GET /api/categories/unified
  // ─────────────────────────────────────────────

  describe("GET /api/categories/unified", () => {
    it("應該回傳所有分類含使用統計", async () => {
      const res = await request(app).get("/api/categories/unified")
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)

      if (res.body.length > 0) {
        const c = res.body[0] as UnifiedCategory
        expect(c).toHaveProperty("id")
        expect(c).toHaveProperty("categoryName")
        expect(c).toHaveProperty("usedCount")
        expect(c).toHaveProperty("isInUse")
        expect(typeof c.usedCount).toBe("number")
        expect(typeof c.isInUse).toBe("boolean")
      }
    })

    it("isInUse 應該等於 (usedCount > 0 OR budgetCount > 0)", async () => {
      const res = await request(app).get("/api/categories/unified")
      expect(res.status).toBe(200)

      for (const c of res.body as UnifiedCategory[]) {
        const expected = c.usedCount > 0 || c.budgetCount > 0
        expect(c.isInUse).toBe(expected)
      }
    })
  })

  // ─────────────────────────────────────────────
  // POST /api/categories/:id/merge
  // ─────────────────────────────────────────────

  describe("POST /api/categories/:id/merge", () => {
    it("targetId 缺失應回 400", async () => {
      const res = await request(app).post("/api/categories/9999/merge").send({})
      expect(res.status).toBe(400)
    })

    it("targetId === sourceId 應回 400", async () => {
      const res = await request(app).post("/api/categories/9999/merge").send({ targetId: 9999 })
      expect(res.status).toBe(400)
    })

    it("不存在的來源分類應回 404", async () => {
      const res = await request(app).post("/api/categories/99999999/merge").send({ targetId: 1 })
      expect(res.status).toBe(404)
    })

    it("成功合併兩個測試分類", async () => {
      // 建立兩個測試分類
      const create1 = await request(app)
        .post("/api/categories")
        .send({ categoryName: "test_merge_source", categoryType: "project" })
      const create2 = await request(app)
        .post("/api/categories")
        .send({ categoryName: "test_merge_target", categoryType: "project" })

      expect(create1.status).toBe(201)
      expect(create2.status).toBe(201)

      const sourceId = create1.body.id as number
      const targetId = create2.body.id as number
      cleanupIds.push(sourceId, targetId)

      // 合併
      const merge = await request(app).post(`/api/categories/${sourceId}/merge`).send({ targetId })

      expect(merge.status).toBe(200)
      expect(merge.body.success).toBe(true)
      expect(merge.body.sourceId).toBe(sourceId)
      expect(merge.body.targetId).toBe(targetId)
      expect(typeof merge.body.paymentItemsMoved).toBe("number")
      expect(typeof merge.body.budgetItemsMoved).toBe("number")

      // 驗證 source 已軟刪除
      const list = (await request(app).get("/api/categories/unified")).body as UnifiedCategory[]
      const source = list.find((c) => c.id === sourceId)
      expect(source?.isDeleted).toBe(true)
    })
  })

  // ─────────────────────────────────────────────
  // POST /api/categories/archive-unused
  // ─────────────────────────────────────────────

  describe("POST /api/categories/archive-unused", () => {
    it("dryRun=true（預設）只回報不執行", async () => {
      const res = await request(app).post("/api/categories/archive-unused").send({})
      expect(res.status).toBe(200)
      expect(res.body.dryRun).toBe(true)
      expect(typeof res.body.candidatesCount).toBe("number")
      expect(Array.isArray(res.body.candidates)).toBe(true)
    })

    it("dryRun=false 但無候選時不應錯誤", async () => {
      // 即使沒有符合條件的（90 天 + 未使用），也應正常回 200
      const res = await request(app).post("/api/categories/archive-unused").send({ dryRun: false })
      expect(res.status).toBe(200)
      expect(typeof res.body.dryRun).toBe("boolean")
    })
  })
})
