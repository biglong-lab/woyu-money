import { Router } from "express"
import { storage, getAllPaymentSchedules, getPaymentSchedulesByItemId } from "../storage"
import { generateSmartSchedule, type ScheduleItem } from "@shared/schedule-utils"
import { asyncHandler, AppError } from "../middleware/error-handler"

/** getPaymentRecords 回傳的付款記錄行（extends Record 以相容 storage 回傳型別） */
interface PaymentRecordRow extends Record<string, unknown> {
  id: number
  itemId: number
  amount: string
  paymentDate: string
  paymentMethod: string | null
  notes: string
}

const router = Router()

// 取得指定年月的付款排程
router.get(
  "/api/payment/schedule/:year/:month",
  asyncHandler(async (req, res) => {
    const year = parseInt(req.params.year)
    const month = parseInt(req.params.month)

    const schedules = await storage.getPaymentSchedules(year, month)
    res.json(schedules)
  })
)

// 建立付款排程
router.post(
  "/api/payment/schedule",
  asyncHandler(async (req, res) => {
    const { paymentItemId, scheduledDate, scheduledAmount, notes, createdBy } = req.body

    if (!paymentItemId || !scheduledDate || !scheduledAmount) {
      throw new AppError(
        400,
        "Missing required fields: paymentItemId, scheduledDate, scheduledAmount"
      )
    }

    const schedule = await storage.createPaymentSchedule({
      paymentItemId,
      scheduledDate,
      scheduledAmount: scheduledAmount.toString(),
      notes,
      createdBy,
    })

    res.status(201).json(schedule)
  })
)

// 更新付款排程
router.put(
  "/api/payment/schedule/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const updateData = req.body

    const schedule = await storage.updatePaymentSchedule(id, updateData)
    res.json(schedule)
  })
)

// 刪除付款排程
router.delete(
  "/api/payment/schedule/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    await storage.deletePaymentSchedule(id)
    res.status(204).send()
  })
)

// 取得逾期排程
router.get(
  "/api/payment/overdue",
  asyncHandler(async (req, res) => {
    const schedules = await storage.getOverdueSchedules()
    res.json(schedules)
  })
)

// 重新排程付款
router.post(
  "/api/payment/reschedule/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const { newDate, notes } = req.body

    if (!newDate) {
      throw new AppError(400, "Missing required field: newDate")
    }

    const schedule = await storage.reschedulePayment(id, newDate, notes)
    res.json(schedule)
  })
)

// 取得指定年月的排程統計
router.get(
  "/api/payment/schedule/stats/:year/:month",
  asyncHandler(async (req, res) => {
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
    const totalAmount = schedules.reduce((sum, s) => sum + parseFloat(s.scheduledAmount), 0)
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
  })
)

// 取得指定年月未排程的付款項目
router.get(
  "/api/payment/schedule/items/:year/:month",
  asyncHandler(async (req, res) => {
    const year = parseInt(req.params.year)
    const month = parseInt(req.params.month)

    // 取得當月未排程的付款項目
    const unscheduledItems = await storage.getUnscheduledPaymentItems(year, month)

    res.json(unscheduledItems)
  })
)

// 查詢所有逾期項目（包含本月之前的）
router.get(
  "/api/payment/items/overdue",
  asyncHandler(async (req, res) => {
    const overdueItems = await storage.getOverduePaymentItems()

    res.json(overdueItems)
  })
)

// 整合項目數據API - 包含付款記錄、所有排程記錄的完整信息
router.get(
  "/api/payment/items/integrated",
  asyncHandler(async (req, res) => {
    const { year, month } = req.query

    // 獲取所有付款項目
    const items = await storage.getPaymentItems({}, undefined, 10000)

    // 獲取所有付款記錄
    const records = (await storage.getPaymentRecords({})) as PaymentRecordRow[]

    // 獲取所有排程記錄（不限月份，確保跨月追蹤）
    const allSchedules = await getAllPaymentSchedules()

    // 獲取當月排程記錄（用於計算當月排程金額）
    let monthSchedules: Awaited<ReturnType<typeof storage.getPaymentSchedules>> = []
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
      const actualPaid = itemRecords.reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0)

      // 獲取該項目的所有排程記錄
      const allItemSchedules = allSchedules.filter((s) => s.paymentItemId === item.id)

      // 計算當月的排程計劃金額
      const monthItemSchedules = monthSchedules.filter((s) => s.paymentItemId === item.id)
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
        return scheduleDate < today && s.status !== "completed" && !s.isOverdue
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
  })
)

// 獲取項目的所有排程歷史記錄
router.get(
  "/api/payment/items/:itemId/schedules",
  asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.itemId)

    const allSchedules = await getPaymentSchedulesByItemId(itemId)

    res.json(allSchedules)
  })
)

// 智慧排程建議 API
router.post(
  "/api/payment/schedule/smart-suggest",
  asyncHandler(async (req, res) => {
    const { year, month, budget } = req.body

    if (!year || !month || budget === undefined) {
      throw new AppError(400, "需要提供 year、month、budget 參數")
    }

    const yearNum = parseInt(year)
    const monthNum = parseInt(month)
    const budgetNum = parseFloat(budget)

    // 取得所有待付款項目
    const items = await storage.getPaymentItems({}, undefined, 10000)
    const today = new Date()

    // 取得已有排程
    const existingSchedules = await storage.getPaymentSchedules(yearNum, monthNum)
    const scheduledItemIds = new Set(existingSchedules.map((s) => s.paymentItemId))

    // 篩選需要排程的項目
    // getPaymentItems 透過 SQL JOIN 回傳額外欄位（projectName 等），用擴展型別處理
    type ItemWithJoin = (typeof items)[number] & { projectName?: string }
    const scheduleItems: ScheduleItem[] = (items as ItemWithJoin[])
      .filter((item) => {
        if (item.isDeleted || item.status === "completed") return false
        const paid = parseFloat(item.paidAmount || "0")
        const total = parseFloat(item.totalAmount || "0")
        return paid < total
      })
      .map((item) => {
        const total = parseFloat(item.totalAmount || "0")
        const paid = parseFloat(item.paidAmount || "0")
        const remaining = total - paid

        // 判斷是否逾期
        const dueDate = item.endDate || item.startDate
        const dueDateObj = dueDate ? new Date(dueDate) : null
        const isOverdue = dueDateObj ? dueDateObj < today : false
        const overdueDays = dueDateObj
          ? Math.max(0, Math.ceil((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24)))
          : 0

        // 判斷分類類型
        let categoryType = "general"
        const name = (item.itemName || "").toLowerCase()
        if (name.includes("租金") || name.includes("房租")) categoryType = "rent"
        else if (name.includes("勞保") || name.includes("健保") || name.includes("勞健保"))
          categoryType = "insurance"
        else if (name.includes("水電") || name.includes("電費") || name.includes("水費"))
          categoryType = "utility"

        return {
          id: item.id,
          itemName: item.itemName,
          totalAmount: total,
          paidAmount: paid,
          remainingAmount: remaining,
          dueDate: dueDate || undefined,
          paymentType: item.paymentType || "single",
          categoryType,
          isOverdue,
          overdueDays,
          hasLateFee: categoryType === "insurance" || categoryType === "rent",
          projectName: item.projectName,
        }
      })

    const result = generateSmartSchedule(scheduleItems, budgetNum)

    res.json(result)
  })
)

// 批次重排逾期項目
router.post(
  "/api/payment/schedule/auto-reschedule",
  asyncHandler(async (req, res) => {
    const { targetYear, targetMonth } = req.body

    if (!targetYear || !targetMonth) {
      throw new AppError(400, "需要提供 targetYear、targetMonth 參數")
    }

    // 取得所有逾期排程
    const overdueSchedules = await storage.getOverdueSchedules()

    if (overdueSchedules.length === 0) {
      return res.json({ message: "沒有逾期項目需要重排", rescheduled: 0 })
    }

    // 將逾期排程移到目標月份的 1 號
    const targetDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`
    let rescheduledCount = 0

    for (const schedule of overdueSchedules) {
      try {
        await storage.reschedulePayment(
          schedule.id,
          targetDate,
          `自動重排：原排期 ${schedule.scheduledDate}，逾期移至 ${targetDate}`
        )
        rescheduledCount++
      } catch (err) {
        // 單筆失敗不中斷整批
      }
    }

    res.json({
      message: `已將 ${rescheduledCount} 筆逾期項目重排至 ${targetYear}年${targetMonth}月`,
      rescheduled: rescheduledCount,
      total: overdueSchedules.length,
    })
  })
)

export default router
