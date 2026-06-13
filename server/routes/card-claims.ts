/**
 * 信用卡請款紀錄 API 路由（獨立模組）
 *
 * 端點：
 * - GET    /api/card-claims                 列表（支援區間/狀態/標籤/館別篩選）
 * - GET    /api/card-claims/summary         區間統計
 * - POST   /api/card-claims                 新增
 * - PATCH  /api/card-claims/:id             更新
 * - DELETE /api/card-claims/:id             刪除
 * - GET/POST/PATCH/DELETE /api/card-claims/tags        標籤管理
 * - GET/POST/PATCH/DELETE /api/card-claims/properties  館別管理
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import {
  insertCardClaimSchema,
  insertCardClaimTagSchema,
  insertCardClaimPropertySchema,
} from "@shared/schema"
import * as store from "../storage/card-claims"
import { ZodError } from "zod"

const router = Router()

function parseId(raw: string): number {
  const id = parseInt(raw, 10)
  if (isNaN(id)) throw new AppError(400, "無效的 ID")
  return id
}

function handleZod(error: unknown): never {
  if (error instanceof ZodError) {
    throw new AppError(400, "資料驗證失敗：" + error.errors.map((e) => e.message).join("、"))
  }
  throw error
}

function optionalInt(raw: unknown): number | undefined {
  if (raw === undefined || raw === "") return undefined
  const n = parseInt(String(raw), 10)
  return isNaN(n) ? undefined : n
}

// ─────────────────────────────────────────────
// 標籤管理
// ─────────────────────────────────────────────

router.get(
  "/api/card-claims/tags",
  asyncHandler(async (req, res) => {
    res.json(await store.getTags(req.query.all === "true"))
  })
)

router.post(
  "/api/card-claims/tags",
  asyncHandler(async (req, res) => {
    try {
      const data = insertCardClaimTagSchema.parse(req.body)
      res.json(await store.createTag(data))
    } catch (e) {
      handleZod(e)
    }
  })
)

router.patch(
  "/api/card-claims/tags/:id",
  asyncHandler(async (req, res) => {
    try {
      const data = insertCardClaimTagSchema.partial().parse(req.body)
      const row = await store.updateTag(parseId(req.params.id), data)
      if (!row) throw new AppError(404, "找不到該標籤")
      res.json(row)
    } catch (e) {
      handleZod(e)
    }
  })
)

router.delete(
  "/api/card-claims/tags/:id",
  asyncHandler(async (req, res) => {
    await store.deleteTag(parseId(req.params.id))
    res.json({ success: true })
  })
)

// ─────────────────────────────────────────────
// 館別管理
// ─────────────────────────────────────────────

router.get(
  "/api/card-claims/properties",
  asyncHandler(async (req, res) => {
    res.json(await store.getProperties(req.query.all === "true"))
  })
)

router.post(
  "/api/card-claims/properties",
  asyncHandler(async (req, res) => {
    try {
      const data = insertCardClaimPropertySchema.parse(req.body)
      res.json(await store.createProperty(data))
    } catch (e) {
      handleZod(e)
    }
  })
)

router.patch(
  "/api/card-claims/properties/:id",
  asyncHandler(async (req, res) => {
    try {
      const data = insertCardClaimPropertySchema.partial().parse(req.body)
      const row = await store.updateProperty(parseId(req.params.id), data)
      if (!row) throw new AppError(404, "找不到該館別")
      res.json(row)
    } catch (e) {
      handleZod(e)
    }
  })
)

router.delete(
  "/api/card-claims/properties/:id",
  asyncHandler(async (req, res) => {
    await store.deleteProperty(parseId(req.params.id))
    res.json({ success: true })
  })
)

// ─────────────────────────────────────────────
// 統計（注意：須在 /:id 之前定義，避免被動態路由攔截）
// ─────────────────────────────────────────────

router.get(
  "/api/card-claims/summary",
  asyncHandler(async (req, res) => {
    res.json(
      await store.getSummary({
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        status: req.query.status as string | undefined,
        tagId: optionalInt(req.query.tagId),
        propertyId: optionalInt(req.query.propertyId),
      })
    )
  })
)

// ─────────────────────────────────────────────
// 請款紀錄 CRUD
// ─────────────────────────────────────────────

router.get(
  "/api/card-claims",
  asyncHandler(async (req, res) => {
    res.json(
      await store.listClaims({
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        status: req.query.status as string | undefined,
        tagId: optionalInt(req.query.tagId),
        propertyId: optionalInt(req.query.propertyId),
      })
    )
  })
)

router.post(
  "/api/card-claims",
  asyncHandler(async (req, res) => {
    try {
      const data = insertCardClaimSchema.parse(req.body)
      res.json(await store.createClaim(data))
    } catch (e) {
      handleZod(e)
    }
  })
)

router.patch(
  "/api/card-claims/:id",
  asyncHandler(async (req, res) => {
    try {
      const data = insertCardClaimSchema.partial().parse(req.body)
      const row = await store.updateClaim(parseId(req.params.id), data)
      if (!row) throw new AppError(404, "找不到該紀錄")
      res.json(row)
    } catch (e) {
      handleZod(e)
    }
  })
)

router.delete(
  "/api/card-claims/:id",
  asyncHandler(async (req, res) => {
    await store.deleteClaim(parseId(req.params.id))
    res.json({ success: true })
  })
)

export default router
