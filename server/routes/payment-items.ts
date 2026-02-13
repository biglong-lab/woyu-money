import { Router } from "express"
import { storage } from "../storage"
import { requireAuth } from "../auth"
import { insertPaymentItemSchema } from "@shared/schema"
import { upload } from "./upload-config"
import { asyncHandler, AppError } from "../middleware/error-handler"

const router = Router()

router.get(
  "/api/payment/items",
  asyncHandler(async (req, res) => {
    const {
      projectId,
      categoryId,
      page = "1",
      limit = "50",
      includeAll = "false",
      itemType = "all", // 新增itemType篩選參數
    } = req.query

    const pageNum = parseInt(page as string)
    const limitNum = Math.min(parseInt(limit as string), 200) // 合理的分頁大小
    const shouldIncludeAll = includeAll === "true"

    const filters: Record<string, number | boolean> = {}
    if (projectId) filters.projectId = parseInt(projectId as string)
    if (categoryId) filters.categoryId = parseInt(categoryId as string)

    // 根據itemType篩選：一般付款管理只顯示非租約項目
    if (itemType === "general") {
      // 一般付款管理：排除租約相關項目，只顯示home和project類型
      filters.excludeRental = true
    }

    if (shouldIncludeAll) {
      // 特殊情況：需要所有數據時（如導出功能）
      const items = await storage.getPaymentItems(filters)

      res.json(items)
    } else {
      // 一般情況：使用分頁
      const items = await storage.getPaymentItems(filters, pageNum, limitNum)

      // 計算總數用於分頁資訊
      const totalCount = await storage.getPaymentItemsCount(filters)
      const totalPages = Math.ceil(totalCount / limitNum)

      res.json({
        items,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: totalCount,
          pageSize: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1,
        },
      })
    }
  })
)

// Enhanced paginated payment items endpoint
router.get(
  "/api/payment/items/paginated",
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100)
    const filters = {
      projectId: req.query.projectId ? parseInt(req.query.projectId as string) : undefined,
      status: req.query.status as string,
      includeDeleted: req.query.includeDeleted === "true",
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    }

    const result = await storage.getPaginatedPaymentItems(page, pageSize, filters)
    res.json(result)
  })
)

router.post(
  "/api/payment/items",
  asyncHandler(async (req, res) => {
    // Clean empty date strings and provide defaults
    const cleanData = { ...req.body }
    const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD format

    if (cleanData.startDate === "" || !cleanData.startDate) {
      cleanData.startDate = today
    }
    if (cleanData.dueDate === "") {
      cleanData.dueDate = undefined
    }
    if (cleanData.actualPaymentDate === "") {
      cleanData.actualPaymentDate = undefined
    }

    const result = insertPaymentItemSchema.safeParse(cleanData)
    if (!result.success) {
      return res
        .status(400)
        .json({ message: "Invalid payment item data", errors: result.error.errors })
    }
    const item = await storage.createPaymentItem(result.data)
    res.status(201).json(item)
  })
)

router.put(
  "/api/payment/items/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)

    // Clean empty date strings and provide defaults
    const cleanData = { ...req.body }
    const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD format

    if (cleanData.startDate === "" || !cleanData.startDate) {
      cleanData.startDate = today
    }
    if (cleanData.dueDate === "") {
      cleanData.dueDate = undefined
    }
    if (cleanData.actualPaymentDate === "") {
      cleanData.actualPaymentDate = undefined
    }

    // Get current item to compare amounts
    const currentItem = await storage.getPaymentItem(id)
    if (!currentItem) {
      throw new AppError(404, "Payment item not found")
    }

    // If total amount is being changed, recalculate status based on current paid amount
    if (cleanData.totalAmount && cleanData.totalAmount !== currentItem.totalAmount) {
      const newTotalAmount = parseFloat(cleanData.totalAmount)
      const currentPaidAmount = parseFloat(currentItem.paidAmount || "0")

      // Recalculate status based on new total amount
      if (currentPaidAmount >= newTotalAmount && currentPaidAmount > 0) {
        cleanData.status = "paid"
      } else if (currentPaidAmount > 0 && currentPaidAmount < newTotalAmount) {
        cleanData.status = "partial"
      } else {
        cleanData.status = currentItem.status || "pending"
      }
    }

    const result = insertPaymentItemSchema.safeParse(cleanData)
    if (!result.success) {
      return res
        .status(400)
        .json({ message: "Invalid payment item data", errors: result.error.errors })
    }
    const item = await storage.updatePaymentItem(id, result.data)
    res.json(item)
  })
)

// PATCH endpoint for partial updates (used by edit dialog)
router.patch(
  "/api/payment/items/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const { changeReason, userInfo, ...updateData } = req.body

    // Get current item to merge with partial update
    const currentItem = await storage.getPaymentItem(id)
    if (!currentItem) {
      throw new AppError(404, "Payment item not found")
    }

    // Handle empty date strings
    if (updateData.endDate === "") {
      updateData.endDate = null
    }
    if (updateData.notes === "") {
      updateData.notes = null
    }

    // Convert totalAmount to string if it's a number
    if (typeof updateData.totalAmount === "number") {
      updateData.totalAmount = updateData.totalAmount.toString()
    }

    // Merge current item with update data for validation
    const mergedData = {
      ...currentItem,
      ...updateData,
      updatedAt: new Date(),
    }

    // Remove undefined fields to avoid validation issues
    Object.keys(mergedData).forEach((key) => {
      if (mergedData[key] === undefined) {
        delete mergedData[key]
      }
    })

    // Validate the merged data
    const result = insertPaymentItemSchema.safeParse(mergedData)
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid payment item data",
        errors: result.error.errors,
      })
    }

    // Update the item
    const item = await storage.updatePaymentItem(
      id,
      result.data,
      userInfo || "系統管理員",
      changeReason || "修改項目資訊"
    )

    res.json(item)
  })
)

// 獲取所有已刪除的項目（回收站）- 必須放在 /:id 路由之前
router.get(
  "/api/payment/items/deleted",
  asyncHandler(async (req, res) => {
    const deletedItems = await storage.getDeletedPaymentItems()
    res.json(deletedItems)
  })
)

// 軟刪除項目
router.delete(
  "/api/payment/items/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const userInfo = req.user?.username || "系統管理員"
    const { reason } = req.body || {}
    await storage.deletePaymentItem(id, userInfo, reason || "刪除項目")
    res.status(204).send()
  })
)

// 恢復已刪除的項目
router.post(
  "/api/payment/items/:id/restore",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const userInfo = req.user?.username || "系統管理員"
    const { reason } = req.body || {}
    const item = await storage.restorePaymentItem(id, userInfo, reason || "恢復項目")
    res.json(item)
  })
)

// 永久刪除項目（僅限管理員）
router.delete(
  "/api/payment/items/:id/permanent",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const userInfo = req.user?.username || "系統管理員"
    const { reason } = req.body || {}
    await storage.permanentlyDeletePaymentItem(id, userInfo, reason || "永久刪除項目")
    res.status(204).send()
  })
)

// 獲取項目的操作歷史記錄
router.get(
  "/api/payment/items/:id/audit-logs",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const logs = await storage.getAuditLogs("payment_items", id)
    res.json(logs)
  })
)

// Payment processing endpoint
// Get payment records for a specific item
router.get(
  "/api/payment/items/:id/records",
  asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.id)
    const records = await storage.getPaymentRecords({ itemId })
    res.json(records)
  })
)

router.post(
  "/api/payment/items/:id/payments",
  upload.single("receiptFile"),
  asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.id)
    const { amount, amountPaid, paymentDate, paymentMethod, notes, receiptImageUrl } = req.body
    const paymentAmount = amount || amountPaid

    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      throw new AppError(400, "Invalid payment amount")
    }

    // Get current payment item
    const item = await storage.getPaymentItem(itemId)
    if (!item) {
      throw new AppError(404, "Payment item not found")
    }

    // Calculate new paid amount
    const currentPaid = parseFloat(item.paidAmount || "0")
    const paymentAmountFloat = parseFloat(paymentAmount)
    const totalAmount = parseFloat(item.totalAmount)
    const newPaidAmount = currentPaid + paymentAmountFloat

    if (newPaidAmount > totalAmount) {
      throw new AppError(400, "Payment amount exceeds remaining balance")
    }

    // Update payment item with new paid amount
    const updatedItem = await storage.updatePaymentItem(itemId, {
      paidAmount: newPaidAmount.toString(),
      status: newPaidAmount >= totalAmount ? "paid" : "partial",
    })

    // Create payment record with uploaded file and payment method
    await storage.createPaymentRecord({
      itemId: itemId,
      amountPaid: paymentAmountFloat.toString(),
      paymentDate: paymentDate || new Date().toISOString().split("T")[0],
      paymentMethod: paymentMethod || "bank_transfer",
      notes: notes || null,
      receiptImageUrl:
        receiptImageUrl || (req.file ? `/uploads/receipts/${req.file.filename}` : null),
    })

    res.json(updatedItem)
  })
)

export default router
