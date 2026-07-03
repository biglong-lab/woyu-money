/**
 * 歷史欠款整理 API 路由（獨立模組）
 *
 * 端點：
 * - GET    /api/debts                      欠款列表（支援狀態/分類/還款進度篩選）
 * - GET    /api/debts/summary              全貌彙總（總欠款/已還/未還 + 分類拆解）
 * - POST   /api/debts                      新增欠款
 * - PATCH  /api/debts/:id                  更新欠款（含歸帳）
 * - DELETE /api/debts/:id                  刪除欠款
 * - GET    /api/debts/:id/payments         某筆欠款的還款列表
 * - POST   /api/debts/:id/payments         新增一筆分期還款
 * - DELETE /api/debts/payments/:paymentId  刪除一筆還款
 * - GET/POST/PATCH/DELETE /api/debts/categories  分類管理
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import {
  insertLegacyDebtSchema as insertDebtSchema,
  insertLegacyDebtCategorySchema as insertDebtCategorySchema,
  insertLegacyDebtPaymentSchema as insertDebtPaymentSchema,
} from "@shared/schema"
import * as store from "../storage/debts"
import { parseId, optionalInt, handleZod } from "./request-params"

const router = Router()

function paymentStatusOf(raw: unknown): store.DebtFilters["paymentStatus"] {
  if (raw === "unpaid" || raw === "partial" || raw === "paid") return raw
  return undefined
}

// ─────────────────────────────────────────────
// 分類管理（須在 /:id 之前定義）
// ─────────────────────────────────────────────

router.get(
  "/api/debts/categories",
  asyncHandler(async (req, res) => {
    res.json(await store.getCategories(req.query.all === "true"))
  })
)

router.post(
  "/api/debts/categories",
  asyncHandler(async (req, res) => {
    try {
      const data = insertDebtCategorySchema.parse(req.body)
      res.json(await store.createCategory(data))
    } catch (e) {
      handleZod(e)
    }
  })
)

router.patch(
  "/api/debts/categories/:id",
  asyncHandler(async (req, res) => {
    try {
      const data = insertDebtCategorySchema.partial().parse(req.body)
      const row = await store.updateCategory(parseId(req.params.id), data)
      if (!row) throw new AppError(404, "找不到該分類")
      res.json(row)
    } catch (e) {
      handleZod(e)
    }
  })
)

router.delete(
  "/api/debts/categories/:id",
  asyncHandler(async (req, res) => {
    await store.deleteCategory(parseId(req.params.id))
    res.json({ success: true })
  })
)

// ─────────────────────────────────────────────
// 全貌彙總（須在 /:id 之前定義）
// ─────────────────────────────────────────────

router.get(
  "/api/debts/summary",
  asyncHandler(async (req, res) => {
    res.json(
      await store.getSummary({
        status: req.query.status as string | undefined,
        categoryId: optionalInt(req.query.categoryId),
        paymentStatus: paymentStatusOf(req.query.paymentStatus),
      })
    )
  })
)

// ─────────────────────────────────────────────
// 還款紀錄刪除（須在 /:id 之前定義，避免被動態路由攔截）
// ─────────────────────────────────────────────

router.delete(
  "/api/debts/payments/:paymentId",
  asyncHandler(async (req, res) => {
    await store.deletePayment(parseId(req.params.paymentId))
    res.json({ success: true })
  })
)

// ─────────────────────────────────────────────
// 欠款 CRUD
// ─────────────────────────────────────────────

router.get(
  "/api/debts",
  asyncHandler(async (req, res) => {
    res.json(
      await store.listDebts({
        status: req.query.status as string | undefined,
        categoryId: optionalInt(req.query.categoryId),
        paymentStatus: paymentStatusOf(req.query.paymentStatus),
      })
    )
  })
)

router.post(
  "/api/debts",
  asyncHandler(async (req, res) => {
    try {
      const data = insertDebtSchema.parse(req.body)
      res.json(await store.createDebt(data))
    } catch (e) {
      handleZod(e)
    }
  })
)

router.patch(
  "/api/debts/:id",
  asyncHandler(async (req, res) => {
    try {
      const data = insertDebtSchema.partial().parse(req.body)
      const row = await store.updateDebt(parseId(req.params.id), data)
      if (!row) throw new AppError(404, "找不到該欠款")
      res.json(row)
    } catch (e) {
      handleZod(e)
    }
  })
)

router.delete(
  "/api/debts/:id",
  asyncHandler(async (req, res) => {
    await store.deleteDebt(parseId(req.params.id))
    res.json({ success: true })
  })
)

// ─────────────────────────────────────────────
// 分期 / 還款紀錄
// ─────────────────────────────────────────────

router.get(
  "/api/debts/:id/payments",
  asyncHandler(async (req, res) => {
    res.json(await store.listPayments(parseId(req.params.id)))
  })
)

router.post(
  "/api/debts/:id/payments",
  asyncHandler(async (req, res) => {
    try {
      const data = insertDebtPaymentSchema.parse(req.body)
      res.json(await store.addPayment(parseId(req.params.id), data))
    } catch (e) {
      handleZod(e)
    }
  })
)

export default router
