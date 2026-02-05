import { Router } from "express"
import { storage } from "../storage"
import { paymentSchedules } from "@shared/schema"
import { eq, desc } from "drizzle-orm"
import { db } from "../db"

const router = Router()

// 取得指定年月的付款排程
router.get("/api/payment/schedule/:year/:month", async (req, res) => {
  try {
    const year = parseInt(req.params.year)
    const month = parseInt(req.params.month)

    const schedules = await storage.getPaymentSchedules(year, month)
    res.json(schedules)
  } catch (error: any) {
    console.error("Error fetching payment schedules:", error)
    res.status(500).json({ message: "Failed to fetch payment schedules" })
  }
})

// 建立付款排程
router.post("/api/payment/schedule", async (req, res) => {
  try {
    const { paymentItemId, scheduledDate, scheduledAmount, notes, createdBy } = req.body

    if (!paymentItemId || !scheduledDate || !scheduledAmount) {
      return res.status(400).json({
        message: "Missing required fields: paymentItemId, scheduledDate, scheduledAmount",
      })
    }

    const schedule = await storage.createPaymentSchedule({
      paymentItemId,
      scheduledDate,
      scheduledAmount: scheduledAmount.toString(),
      notes,
      createdBy,
    })

    res.status(201).json(schedule)
  } catch (error: any) {
    console.error("Error creating payment schedule:", error)
    res.status(500).json({ message: "Failed to create payment schedule" })
  }
})

// 更新付款排程
router.put("/api/payment/schedule/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const updateData = req.body

    const schedule = await storage.updatePaymentSchedule(id, updateData)
    res.json(schedule)
  } catch (error: any) {
    console.error("Error updating payment schedule:", error)
    res.status(500).json({ message: "Failed to update payment schedule" })
  }
})

// 刪除付款排程
router.delete("/api/payment/schedule/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    await storage.deletePaymentSchedule(id)
    res.status(204).send()
  } catch (error: any) {
    console.error("Error deleting payment schedule:", error)
    res.status(500).json({ message: "Failed to delete payment schedule" })
  }
})

// 取得逾期排程
router.get("/api/payment/overdue", async (req, res) => {
  try {
    const schedules = await storage.getOverdueSchedules()
    res.json(schedules)
  } catch (error: any) {
    console.error("Error fetching overdue schedules:", error)
    res.status(500).json({ message: "Failed to fetch overdue schedules" })
  }
})

// 重新排程付款
router.post("/api/payment/reschedule/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { newDate, notes } = req.body

    if (!newDate) {
      return res.status(400).json({ message: "Missing required field: newDate" })
    }

    const schedule = await storage.reschedulePayment(id, newDate, notes)
    res.json(schedule)
  } catch (error: any) {
    console.error("Error rescheduling payment:", error)
    res.status(500).json({ message: "Failed to reschedule payment" })
  }
})

// 取得指定年月的排程統計
router.get("/api/payment/schedule/stats/:year/:month", async (req, res) => {
  try {
    const year = parseInt(req.params.year)
    const month = parseInt(req.params.month)

    const schedules = await storage.getPaymentSchedules(year, month)

    // 計算每日統計
    const dailyStats: Record<string, { amount: number; count: number }> = {}
    schedules.forEach((schedule) => {
      const date = schedule.scheduledDate
      if (!dailyStats[date]) {
        dailyStats[date] = { amount: 0, count: 0 }
      }
      dailyStats[date].amount += parseFloat(schedule.scheduledAmount)
      dailyStats[date].count += 1
    })

    // 計算總統計
    const totalAmount = schedules.reduce(
      (sum, s) => sum + parseFloat(s.scheduledAmount),
      0
    )
    const totalCount = schedules.length
    const overdueCount = schedules.filter((s) => s.isOverdue).length

    res.json({
      year,
      month,
      totalAmount,
      totalCount,
      overdueCount,
      dailyStats,
    })
  } catch (error: any) {
    console.error("Error fetching payment schedule stats:", error)
    res.status(500).json({ message: "Failed to fetch payment schedule stats" })
  }
})

// 取得指定年月未排程的付款項目
router.get("/api/payment/schedule/items/:year/:month", async (req, res) => {
  try {
    const year = parseInt(req.params.year)
    const month = parseInt(req.params.month)

    // 取得當月未排程的付款項目
    const unscheduledItems = await storage.getUnscheduledPaymentItems(year, month)

    res.json(unscheduledItems)
  } catch (error: any) {
    console.error("Error fetching unscheduled payment items:", error)
    res.status(500).json({ message: "Failed to fetch unscheduled payment items" })
  }
})

// 查詢所有逾期項目（包含本月之前的）
router.get("/api/payment/items/overdue", async (req, res) => {
  try {
    const overdueItems = await storage.getOverduePaymentItems()

    res.json(overdueItems)
  } catch (error: any) {
    console.error("查詢逾期項目時發生錯誤:", error)
    res.status(500).json({ message: "查詢逾期項目失敗" })
  }
})

// 整合項目數據API - 包含付款記錄、所有排程記錄的完整信息
router.get("/api/payment/items/integrated", async (req, res) => {
  try {
    const { year, month } = req.query

    // 獲取所有付款項目
    const items = await storage.getPaymentItems({}, undefined, 10000)

    // 獲取所有付款記錄
    const records = await storage.getPaymentRecords({})

    // 獲取所有排程記錄（不限月份，確保跨月追蹤）
    const allSchedules = await db
      .select()
      .from(paymentSchedules)
      .orderBy(desc(paymentSchedules.scheduledDate))

    // 獲取當月排程記錄（用於計算當月排程金額）
    let monthSchedules: any[] = []
    if (year && month) {
      monthSchedules = await storage.getPaymentSchedules(
        parseInt(year as string),
        parseInt(month as string)
      )
    }

    // 整合數據
    const integratedItems = items.map((item) => {
      // 計算該項目的實際已付金額
      const itemRecords = records.filter((r) => r.itemId === item.id)
      const actualPaid = itemRecords.reduce(
        (sum, r) => sum + parseFloat(r.amount || "0"),
        0
      )

      // 獲取該項目的所有排程記錄
      const allItemSchedules = allSchedules.filter(
        (s) => s.paymentItemId === item.id
      )

      // 計算當月的排程計劃金額
      const monthItemSchedules = monthSchedules.filter(
        (s) => s.paymentItemId === item.id
      )
      const scheduledTotal = monthItemSchedules.reduce(
        (sum, s) => sum + parseFloat(s.scheduledAmount || "0"),
        0
      )

      // 計算待付金額
      const totalAmount = parseFloat(item.totalAmount || "0")
      const pendingAmount = totalAmount - actualPaid

      // 檢查是否有逾期未執行的排程
      const today = new Date()
      const hasOverdueSchedule = allItemSchedules.some((s) => {
        const scheduleDate = new Date(s.scheduledDate)
        return (
          scheduleDate < today && s.status !== "completed" && !s.isOverdue
        )
      })

      return {
        ...item,
        actualPaid: actualPaid.toFixed(2),
        scheduledTotal: scheduledTotal.toFixed(2),
        pendingAmount: pendingAmount.toFixed(2),
        paymentRecords: itemRecords,
        schedules: allItemSchedules, // 返回所有排程記錄
        monthSchedules: monthItemSchedules, // 當月排程
        scheduleCount: allItemSchedules.length,
        recordCount: itemRecords.length,
        hasOverdueSchedule,
      }
    })

    res.json(integratedItems)
  } catch (error: any) {
    console.error("Error fetching integrated payment items:", error)
    res.status(500).json({ message: "Failed to fetch integrated payment items" })
  }
})

// 獲取項目的所有排程歷史記錄
router.get("/api/payment/items/:itemId/schedules", async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId)

    const allSchedules = await db
      .select()
      .from(paymentSchedules)
      .where(eq(paymentSchedules.paymentItemId, itemId))
      .orderBy(desc(paymentSchedules.scheduledDate))

    res.json(allSchedules)
  } catch (error: any) {
    console.error("Error fetching item schedules:", error)
    res.status(500).json({ message: "Failed to fetch item schedules" })
  }
})

export default router
