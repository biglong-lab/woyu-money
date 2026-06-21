/**
 * 開銷流水帳 API（先記錄、後分帳）
 * - GET    /api/expense-ledger          列表（?status&startDate&endDate）
 * - GET    /api/expense-ledger/summary  彙總
 * - POST   /api/expense-ledger          新增（只需金額）
 * - PUT    /api/expense-ledger/:id      更新/分帳
 * - DELETE /api/expense-ledger/:id      刪除
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { insertExpenseLedgerSchema } from "@shared/schema"
import * as store from "../storage/expense-ledger"
import { ZodError } from "zod"

const router = Router()

function parseId(raw: string): number {
  const id = parseInt(raw, 10)
  if (isNaN(id)) throw new AppError(400, "無效的 ID")
  return id
}
function handleZod(e: unknown): never {
  if (e instanceof ZodError) {
    throw new AppError(400, "資料驗證失敗：" + e.errors.map((x) => x.message).join("、"))
  }
  throw e
}

router.get(
  "/api/expense-ledger/summary",
  asyncHandler(async (req, res) => {
    res.json(
      await store.getSummary({
        status: req.query.status as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      })
    )
  })
)

router.get(
  "/api/expense-ledger",
  asyncHandler(async (req, res) => {
    res.json(
      await store.listEntries({
        status: req.query.status as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      })
    )
  })
)

router.post(
  "/api/expense-ledger",
  asyncHandler(async (req, res) => {
    try {
      const data = insertExpenseLedgerSchema.parse(req.body)
      res.json(await store.createEntry(data))
    } catch (e) {
      handleZod(e)
    }
  })
)

router.put(
  "/api/expense-ledger/:id",
  asyncHandler(async (req, res) => {
    try {
      const data = insertExpenseLedgerSchema.partial().parse(req.body)
      const row = await store.updateEntry(parseId(req.params.id), data)
      if (!row) throw new AppError(404, "找不到該流水")
      res.json(row)
    } catch (e) {
      handleZod(e)
    }
  })
)

router.delete(
  "/api/expense-ledger/:id",
  asyncHandler(async (req, res) => {
    await store.deleteEntry(parseId(req.params.id))
    res.json({ success: true })
  })
)

export default router
