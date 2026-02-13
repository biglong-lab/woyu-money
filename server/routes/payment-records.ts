import { Router } from "express"
import { storage, getPaymentRecordsCashFlow } from "../storage"
import { requireAuth } from "../auth"
import { insertPaymentRecordSchema, insertPaymentItemNoteSchema } from "@shared/schema"
import { asyncHandler, AppError } from "../middleware/error-handler"

const router = Router()

// 取得付款記錄
router.get(
  "/api/payment/records",
  asyncHandler(async (req, res) => {
    const { itemId, startDate, endDate, page = "1", limit = "100" } = req.query
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)

    const filters: Record<string, number | Date> = {}
    if (itemId) filters.itemId = parseInt(itemId as string)
    if (startDate) filters.startDate = new Date(startDate as string)
    if (endDate) filters.endDate = new Date(endDate as string)

    const records = await storage.getPaymentRecords(filters, pageNum, limitNum)
    res.json(records)
  })
)

// 建立付款記錄
router.post(
  "/api/payment-records",
  asyncHandler(async (req, res) => {
    const result = insertPaymentRecordSchema.safeParse(req.body)
    if (!result.success) {
      return res
        .status(400)
        .json({ message: "Invalid payment record data", errors: result.error.errors })
    }
    const record = await storage.createPaymentRecord(result.data)
    res.status(201).json(record)
  })
)

// 更新付款記錄
router.put(
  "/api/payment-records/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const result = insertPaymentRecordSchema.safeParse(req.body)
    if (!result.success) {
      return res
        .status(400)
        .json({ message: "Invalid payment record data", errors: result.error.errors })
    }
    const record = await storage.updatePaymentRecord(id, result.data)
    res.json(record)
  })
)

// 刪除付款記錄
router.delete(
  "/api/payment-records/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    await storage.deletePaymentRecord(id)
    res.status(204).send()
  })
)

// 現金流專用付款記錄 API - 包含項目到期日資訊
router.get(
  "/api/payment/records/cashflow",
  asyncHandler(async (req, res) => {
    const { monthsBack = "6" } = req.query
    const monthsBackNum = parseInt(monthsBack as string)

    const records = await getPaymentRecordsCashFlow(monthsBackNum)

    // 處理記錄，計算是本月項目還是他月項目
    const enrichedRecords = records.map((record) => {
      const paymentDateObj = new Date(record.paymentDate)
      const paymentMonth = `${paymentDateObj.getFullYear()}-${String(paymentDateObj.getMonth() + 1).padStart(2, "0")}`

      const dueDate = record.itemEndDate || record.itemStartDate
      const dueDateObj = dueDate ? new Date(dueDate) : null
      const dueMonth = dueDateObj
        ? `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth() + 1).padStart(2, "0")}`
        : paymentMonth

      const isCurrentMonthItem = paymentMonth === dueMonth

      return {
        id: record.id,
        itemId: record.itemId,
        itemName: record.itemName,
        amountPaid: record.amountPaid,
        paymentDate: record.paymentDate,
        paymentMonth,
        dueDate,
        dueMonth,
        isCurrentMonthItem,
        originLabel: isCurrentMonthItem
          ? "本月"
          : `${dueDateObj ? dueDateObj.getMonth() + 1 : "?"}月`,
        projectName: record.projectName,
        paymentMethod: record.paymentMethod,
      }
    })

    res.json(enrichedRecords)
  })
)

// 取得項目備註
router.get(
  "/api/payment-items/:itemId/notes",
  asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.itemId)
    const notes = await storage.getPaymentItemNotes(itemId)
    res.json(notes)
  })
)

// 建立項目備註
router.post(
  "/api/payment-items/:itemId/notes",
  requireAuth,
  asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.itemId)
    const user = req.user
    const noteData = {
      ...req.body,
      itemId,
      userId: user?.id || null,
      userInfo: user ? user.fullName || user.username || `用戶ID: ${user.id}` : "匿名用戶",
    }

    const result = insertPaymentItemNoteSchema.safeParse(noteData)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid note data", errors: result.error.errors })
    }

    const note = await storage.createPaymentItemNote(result.data)
    res.status(201).json(note)
  })
)

// 更新項目備註
router.put(
  "/api/payment-item-notes/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const result = insertPaymentItemNoteSchema.partial().safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid note data", errors: result.error.errors })
    }

    const note = await storage.updatePaymentItemNote(id, result.data)
    res.json(note)
  })
)

// 刪除項目備註
router.delete(
  "/api/payment-item-notes/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    await storage.deletePaymentItemNote(id)
    res.status(204).send()
  })
)

export default router
