import { Router } from "express"
import { storage } from "../storage"
import { requireAuth } from "../auth"
import {
  insertPaymentRecordSchema,
  insertPaymentItemNoteSchema,
  paymentRecords,
  paymentItems,
  paymentProjects,
} from "@shared/schema"
import { eq, desc, and, gte } from "drizzle-orm"
import { db } from "../db"

const router = Router()

// 取得付款記錄
router.get("/api/payment/records", async (req, res) => {
  try {
    const { itemId, startDate, endDate, page = "1", limit = "100" } = req.query
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)

    const filters: any = {}
    if (itemId) filters.itemId = parseInt(itemId as string)
    if (startDate) filters.startDate = new Date(startDate as string)
    if (endDate) filters.endDate = new Date(endDate as string)

    const records = await storage.getPaymentRecords(filters, pageNum, limitNum)
    res.json(records)
  } catch (error: any) {
    console.error("Error fetching payment records:", error)
    res.status(500).json({ message: "Failed to fetch payment records" })
  }
})

// 建立付款記錄
router.post("/api/payment-records", async (req, res) => {
  try {
    const result = insertPaymentRecordSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid payment record data", errors: result.error.errors })
    }
    const record = await storage.createPaymentRecord(result.data)
    res.status(201).json(record)
  } catch (error: any) {
    console.error("Error creating payment record:", error)
    res.status(500).json({ message: "Failed to create payment record" })
  }
})

// 更新付款記錄
router.put("/api/payment-records/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const result = insertPaymentRecordSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid payment record data", errors: result.error.errors })
    }
    const record = await storage.updatePaymentRecord(id, result.data)
    res.json(record)
  } catch (error: any) {
    console.error("Error updating payment record:", error)
    res.status(500).json({ message: "Failed to update payment record" })
  }
})

// 刪除付款記錄
router.delete("/api/payment-records/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await storage.deletePaymentRecord(id)
    res.status(204).send()
  } catch (error: any) {
    console.error("Error deleting payment record:", error)
    res.status(500).json({ message: "Failed to delete payment record" })
  }
})

// 現金流專用付款記錄 API - 包含項目到期日資訊
router.get("/api/payment/records/cashflow", async (req, res) => {
  try {
    const { monthsBack = "6" } = req.query
    const monthsBackNum = parseInt(monthsBack as string)

    // 計算查詢範圍：從 N 個月前到現在
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - monthsBackNum)
    startDate.setDate(1)

    // 查詢付款記錄並聯結項目資訊
    const records = await db
      .select({
        id: paymentRecords.id,
        itemId: paymentRecords.itemId,
        amountPaid: paymentRecords.amountPaid,
        paymentDate: paymentRecords.paymentDate,
        paymentMethod: paymentRecords.paymentMethod,
        notes: paymentRecords.notes,
        itemName: paymentItems.itemName,
        itemStartDate: paymentItems.startDate,
        itemEndDate: paymentItems.endDate,
        projectId: paymentItems.projectId,
      })
      .from(paymentRecords)
      .innerJoin(paymentItems, eq(paymentRecords.itemId, paymentItems.id))
      .where(
        and(
          gte(paymentRecords.paymentDate, startDate.toISOString().split("T")[0]),
          eq(paymentItems.isDeleted, false)
        )
      )
      .orderBy(desc(paymentRecords.paymentDate))

    // 取得專案名稱對照
    const projectsList = await db.select().from(paymentProjects)
    const projectMap = new Map(projectsList.map((p) => [p.id, p.projectName]))

    // 處理記錄，計算是本月項目還是他月項目
    const enrichedRecords = records.map((record) => {
      const paymentDateObj = new Date(record.paymentDate)
      const paymentMonth = `${paymentDateObj.getFullYear()}-${String(paymentDateObj.getMonth() + 1).padStart(2, "0")}`

      // 取得項目到期月份（使用 endDate 或 startDate）
      const dueDate = record.itemEndDate || record.itemStartDate
      const dueDateObj = dueDate ? new Date(dueDate) : null
      const dueMonth = dueDateObj
        ? `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth() + 1).padStart(2, "0")}`
        : paymentMonth

      // 判斷是本月項目還是他月項目
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
        originLabel: isCurrentMonthItem ? "本月" : `${dueDateObj ? dueDateObj.getMonth() + 1 : "?"}月`,
        projectName: record.projectId ? projectMap.get(record.projectId) : null,
        paymentMethod: record.paymentMethod,
      }
    })

    res.json(enrichedRecords)
  } catch (error: any) {
    console.error("Error fetching cashflow payment records:", error)
    res.status(500).json({ message: "Failed to fetch cashflow payment records" })
  }
})

// 取得項目備註
router.get("/api/payment-items/:itemId/notes", async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId)
    const notes = await storage.getPaymentItemNotes(itemId)
    res.json(notes)
  } catch (error: any) {
    console.error("Error fetching payment item notes:", error)
    res.status(500).json({ message: "Failed to fetch payment item notes" })
  }
})

// 建立項目備註
router.post("/api/payment-items/:itemId/notes", requireAuth, async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId)
    const user = req.user as any
    const noteData = {
      ...req.body,
      itemId,
      userId: user?.id || null,
      userInfo: user ? (user.fullName || user.username || `用戶ID: ${user.id}`) : "匿名用戶",
    }

    const result = insertPaymentItemNoteSchema.safeParse(noteData)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid note data", errors: result.error.errors })
    }

    const note = await storage.createPaymentItemNote(result.data)
    res.status(201).json(note)
  } catch (error: any) {
    console.error("Error creating payment item note:", error)
    res.status(500).json({ message: "Failed to create payment item note" })
  }
})

// 更新項目備註
router.put("/api/payment-item-notes/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const result = insertPaymentItemNoteSchema.partial().safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: "Invalid note data", errors: result.error.errors })
    }

    const note = await storage.updatePaymentItemNote(id, result.data)
    res.json(note)
  } catch (error: any) {
    console.error("Error updating payment item note:", error)
    res.status(500).json({ message: "Failed to update payment item note" })
  }
})

// 刪除項目備註
router.delete("/api/payment-item-notes/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await storage.deletePaymentItemNote(id)
    res.status(204).send()
  } catch (error: any) {
    console.error("Error deleting payment item note:", error)
    res.status(500).json({ message: "Failed to delete payment item note" })
  }
})

export default router
