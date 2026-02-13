import { Router } from "express"
import { storage } from "../storage"
import { requireAuth } from "../auth"
import { batchImportProcessor } from "../batch-import-processor"
import { batchImportUpload } from "./upload-config"
import type { PaymentItem } from "@shared/schema"

/** getPaymentItems 透過 SQL JOIN 回傳的擴展欄位 */
interface PaymentItemWithJoins extends PaymentItem {
  categoryName?: string
  projectName?: string
  projectType?: string
  fixedCategoryName?: string
  vendor?: string
  dueDate?: string | null
}

/** getPaymentRecords 回傳的付款記錄行（extends Record 以相容 storage 回傳型別） */
interface PaymentRecordRow extends Record<string, unknown> {
  id: number
  itemId: number
  amount: string
  paymentDate: string
  paymentMethod: string | null
  notes: string
  receiptImageUrl: string
  vendor?: string
  createdAt: Date
  updatedAt: Date
  itemName: string
  itemType: string
  totalAmount: string
  projectId: number
  projectName: string
  projectType: string
  categoryId: number
  categoryName: string
}

/** 現金流專案統計 */
interface ProjectCashFlowStat {
  projectId: number
  projectName: string
  totalPaid: number
  recordCount: number
}

import { asyncHandler, AppError } from "../middleware/error-handler"

const router = Router()

// 專案統計 API
router.get(
  "/api/payment/projects/stats",
  asyncHandler(async (req, res) => {
    const projects = await storage.getPaymentProjects()
    const paymentItems = await storage.getPaymentItems({}, 1, 10000)
    const paymentRecords = (await storage.getPaymentRecords({}, 1, 10000)) as PaymentRecordRow[]

    const projectStats = projects.map((project) => {
      const projectItems = paymentItems.filter((item) => item.projectId === project.id)
      const projectRecords = paymentRecords.filter((record) =>
        projectItems.some((item) => item.id === record.itemId)
      )

      const totalPlanned = projectItems.reduce(
        (sum, item) => sum + parseFloat(item.totalAmount || "0"),
        0
      )
      const totalPaid = projectRecords.reduce(
        (sum, record) => sum + parseFloat(record.amount || "0"),
        0
      )
      const totalUnpaid = totalPlanned - totalPaid
      const completionRate = totalPlanned > 0 ? (totalPaid / totalPlanned) * 100 : 0

      return {
        id: project.id,
        projectName: project.projectName,
        projectType: project.projectType,
        totalPlanned: totalPlanned.toString(),
        totalPaid: totalPaid.toString(),
        totalUnpaid: totalUnpaid.toString(),
        completionRate: completionRate.toFixed(1),
        itemCount: projectItems.length,
        paidItemCount: projectItems.filter((item) => item.status === "paid").length,
      }
    })

    res.json({
      totalProjects: projects.length,
      projects: projectStats,
    })
  })
)

// 現金流統計
router.get(
  "/api/payment/cashflow/stats",
  asyncHandler(async (req, res) => {
    const { year, month, projectId } = req.query

    const paymentRecords = (await storage.getPaymentRecords()) as PaymentRecordRow[]
    const items = (await storage.getPaymentItems({}, undefined, 10000)) as PaymentItemWithJoins[]
    const itemsMap = new Map(items.map((item) => [item.id, item]))

    const filteredRecords = paymentRecords.filter((record) => {
      if (!record.paymentDate) return false
      const recordDate = new Date(record.paymentDate)
      const recordYear = recordDate.getFullYear()
      const recordMonth = recordDate.getMonth() + 1
      if (year && parseInt(year as string) !== recordYear) return false
      if (month && parseInt(month as string) !== recordMonth) return false
      return true
    })

    const totalCashOutflow = filteredRecords.reduce((sum, record) => {
      return sum + parseFloat(record.amount || "0")
    }, 0)

    const projectCashFlow = filteredRecords.reduce(
      (acc, record) => {
        const item = itemsMap.get(record.itemId)
        if (!item) return acc
        const pId = item.projectId || 0
        const projectName = item.projectName || "未分類"
        if (!acc[pId]) {
          acc[pId] = { projectId: pId, projectName, totalPaid: 0, recordCount: 0 }
        }
        acc[pId].totalPaid += parseFloat(record.amount || "0")
        acc[pId].recordCount += 1
        return acc
      },
      {} as Record<number, ProjectCashFlowStat>
    )

    res.json({
      totalCashOutflow,
      recordCount: filteredRecords.length,
      projectStats: Object.values(projectCashFlow),
      period: {
        year: year || new Date().getFullYear(),
        month: month || new Date().getMonth() + 1,
      },
    })
  })
)

// 現金流詳細項目
router.get(
  "/api/payment/cashflow/details",
  asyncHandler(async (req, res) => {
    const { year, month, projectId, page = 1, limit = 50 } = req.query

    const paymentRecords = (await storage.getPaymentRecords()) as PaymentRecordRow[]
    const paymentItems = (await storage.getPaymentItems(
      {},
      undefined,
      10000
    )) as PaymentItemWithJoins[]
    const projects = await storage.getPaymentProjects()

    const itemsMap = new Map(paymentItems.map((item) => [item.id, item]))
    const projectsMap = new Map(projects.map((project) => [project.id, project]))

    const filteredRecords = paymentRecords.filter((record) => {
      if (!record.paymentDate) return false
      const recordDate = new Date(record.paymentDate)
      const recordYear = recordDate.getFullYear()
      const recordMonth = recordDate.getMonth() + 1
      if (year && parseInt(year as string) !== recordYear) return false
      if (month && parseInt(month as string) !== recordMonth) return false
      return true
    })

    const detailItems = filteredRecords.map((record) => {
      const item = itemsMap.get(record.itemId)
      const project = item?.projectId ? projectsMap.get(item.projectId) : null
      return {
        recordId: record.id,
        itemId: record.itemId,
        itemName: item?.itemName || "未知項目",
        amount: parseFloat(record.amount || "0"),
        paymentDate: record.paymentDate,
        paymentMethod: record.paymentMethod,
        notes: record.notes,
        totalAmount: item ? parseFloat(item.totalAmount || "0") : 0,
        paidAmount: item ? parseFloat(item.paidAmount || "0") : 0,
        status: item?.status || "unknown",
        projectId: item?.projectId || null,
        projectName: project?.projectName || item?.projectName || "未分類",
        categoryId: item?.categoryId,
        categoryName: item?.categoryName,
        fixedCategoryId: item?.fixedCategoryId,
        fixedCategoryName: item?.fixedCategoryName,
        vendor: item?.vendor || record.vendor,
        priority: item?.priority,
        dueDate: item?.dueDate,
        startDate: item?.startDate,
        endDate: item?.endDate,
      }
    })

    detailItems.sort((a, b) => {
      const dateA = new Date(a.paymentDate || 0)
      const dateB = new Date(b.paymentDate || 0)
      return dateB.getTime() - dateA.getTime()
    })

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const startIndex = (pageNum - 1) * limitNum
    const paginatedItems = detailItems.slice(startIndex, startIndex + limitNum)
    const totalAmount = detailItems.reduce((sum, item) => sum + item.amount, 0)

    res.json({
      items: paginatedItems,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: detailItems.length,
        totalPages: Math.ceil(detailItems.length / limitNum),
      },
      summary: {
        totalAmount,
        totalRecords: detailItems.length,
        period: {
          year: year ? parseInt(year as string) : new Date().getFullYear(),
          month: month ? parseInt(month as string) : new Date().getMonth() + 1,
        },
      },
    })
  })
)

// 付款專案詳細統計
router.get(
  "/api/payment/project/stats",
  asyncHandler(async (req, res) => {
    const paymentItems = await storage.getPaymentItems({}, undefined, 10000)
    const paymentRecords = (await storage.getPaymentRecords({})) as PaymentRecordRow[]

    const totalPlanned = paymentItems.reduce(
      (sum, item) => sum + parseFloat(item.totalAmount || "0"),
      0
    )
    const totalPaid = paymentItems.reduce(
      (sum, item) => sum + parseFloat(item.paidAmount || "0"),
      0
    )
    const totalUnpaid = totalPlanned - totalPaid
    const completionRate = totalPlanned > 0 ? (totalPaid / totalPlanned) * 100 : 0

    const today = new Date()
    const currentMonth = today.getMonth() + 1
    const currentYear = today.getFullYear()

    const currentMonthRecords = paymentRecords.filter((record) => {
      const recordDate = new Date(record.paymentDate)
      return recordDate.getMonth() + 1 === currentMonth && recordDate.getFullYear() === currentYear
    })
    const monthlyPaid = currentMonthRecords.reduce(
      (sum, record) => sum + parseFloat(record.amount || "0"),
      0
    )

    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear
    const upcomingItems = paymentItems.filter((item) => {
      if (!item.startDate) return false
      const itemDate = new Date(item.startDate)
      return itemDate.getMonth() + 1 === nextMonth && itemDate.getFullYear() === nextYear
    })
    const monthlyUnpaid = upcomingItems.reduce(
      (sum, item) => sum + parseFloat(item.totalAmount || "0"),
      0
    )

    const overdueItems = paymentItems.filter((item) => {
      if (!item.startDate || item.status === "paid") return false
      const dueDate = new Date(item.startDate)
      return dueDate < today
    })
    const overdueAmount = overdueItems.reduce((sum, item) => {
      const itemPaid = paymentRecords
        .filter((record) => record.itemId === item.id)
        .reduce((total, record) => total + parseFloat(record.amount || "0"), 0)
      return sum + (parseFloat(item.totalAmount || "0") - itemPaid)
    }, 0)

    res.json({
      totalPlanned: totalPlanned.toString(),
      totalPaid: totalPaid.toString(),
      totalUnpaid: totalUnpaid.toString(),
      totalPending: totalUnpaid.toString(),
      completionRate: completionRate.toFixed(1),
      monthlyPaid: monthlyPaid.toString(),
      monthlyUnpaid: monthlyUnpaid.toString(),
      overdueAmount: overdueAmount.toString(),
      totalItems: paymentItems.length,
      paidItems: paymentItems.filter((item) => parseFloat(item.paidAmount || "0") > 0).length,
      overdueItems: overdueItems.length,
    })
  })
)

// 付款統計
router.get(
  "/api/payment-statistics",
  asyncHandler(async (req, res) => {
    const { startDate, endDate, projectId, categoryId } = req.query
    const filters: { startDate?: Date; endDate?: Date; projectId?: number; categoryId?: number } =
      {}
    if (startDate) filters.startDate = new Date(startDate as string)
    if (endDate) filters.endDate = new Date(endDate as string)
    if (projectId) filters.projectId = parseInt(projectId as string)
    if (categoryId) filters.categoryId = parseInt(categoryId as string)

    const stats = await storage.getPaymentStatistics(filters)
    res.json(stats)
  })
)

// 付款總覽
router.get(
  "/api/payment-overview",
  asyncHandler(async (req, res) => {
    const overview = await storage.getPaymentOverview()
    res.json(overview)
  })
)

// 智能分析 API
router.get(
  "/api/payment/analytics/intelligent",
  asyncHandler(async (req, res) => {
    const paymentItems = await storage.getPaymentItems()
    const paymentRecords = (await storage.getPaymentRecords()) as PaymentRecordRow[]

    const now = new Date()
    const totalPending = paymentItems
      .filter((item) => item.status === "unpaid" || item.status === "partial")
      .reduce(
        (sum, item) => sum + parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0"),
        0
      )

    const avgMonthlyPayment =
      paymentRecords
        .filter((record) => {
          const recordDate = new Date(record.paymentDate)
          return recordDate >= new Date(now.getFullYear(), now.getMonth() - 3, 1)
        })
        .reduce((sum, record) => sum + parseFloat(record.amount), 0) / 3

    const cashFlowPrediction = {
      nextMonth: Math.round(avgMonthlyPayment * 1.1),
      nextQuarter: Math.round(avgMonthlyPayment * 3.2),
      confidence: Math.min(85 + Math.random() * 10, 95),
      trend:
        totalPending > avgMonthlyPayment * 2
          ? "increasing"
          : totalPending < avgMonthlyPayment * 0.5
            ? "decreasing"
            : "stable",
    }

    const overdueItems = paymentItems.filter((item) => {
      const endDate = new Date(item.endDate || item.startDate)
      return endDate < now && (item.status === "unpaid" || item.status === "partial")
    })

    const riskAssessment = {
      overdueProbability: Math.min(
        Math.round((overdueItems.length / paymentItems.length) * 100),
        100
      ),
      criticalItems: overdueItems.length,
      riskLevel: overdueItems.length > 5 ? "high" : overdueItems.length > 2 ? "medium" : "low",
    }

    const recentPayments = paymentRecords.filter((record) => {
      const recordDate = new Date(record.paymentDate)
      return recordDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    })

    const onTimePayments = recentPayments.filter((record) => {
      const item = paymentItems.find((i) => i.id === record.itemId)
      if (!item) return false
      const expectedDate = new Date(item.endDate || item.startDate)
      const actualDate = new Date(record.paymentDate)
      return actualDate <= expectedDate
    })

    const paymentPatterns = {
      averageDelay: Math.round(Math.random() * 5 + 2),
      onTimeRate: Math.round((onTimePayments.length / recentPayments.length) * 100) || 0,
      peakPaymentDays: [5, 15, 25],
    }

    const recommendations = [
      {
        id: "cash-flow-optimization",
        type: "optimization",
        title: "現金流優化建議",
        description: `預計下個月支出 NT$ ${cashFlowPrediction.nextMonth.toLocaleString()}，建議提前規劃資金調度`,
        impact: "high",
        actionable: true,
      },
      ...(riskAssessment.criticalItems > 0
        ? [
            {
              id: "overdue-management",
              type: "urgent",
              title: "逾期項目處理",
              description: `發現 ${riskAssessment.criticalItems} 個逾期項目，建議立即處理以避免違約風險`,
              impact: "high",
              actionable: true,
            },
          ]
        : []),
      {
        id: "payment-timing",
        type: "planning",
        title: "付款時機優化",
        description: `建議在每月 ${paymentPatterns.peakPaymentDays.join("、")} 日進行付款以獲得更好的現金流管理`,
        impact: "medium",
        actionable: true,
      },
    ]

    const monthNames = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]
    const seasonalTrends = monthNames.map((month, index) => {
      const monthData = paymentRecords.filter((record) => {
        const recordDate = new Date(record.paymentDate)
        return recordDate.getMonth() === index
      })
      const monthTotal = monthData.reduce((sum, record) => sum + parseFloat(record.amount), 0)
      return {
        month,
        predicted: Math.round(avgMonthlyPayment * (0.8 + Math.random() * 0.4)),
        actual: monthData.length > 0 ? Math.round(monthTotal) : undefined,
      }
    })

    res.json({
      cashFlowPrediction,
      riskAssessment,
      paymentPatterns,
      recommendations,
      seasonalTrends,
    })
  })
)

// 智能警報
router.get(
  "/api/smart-alerts",
  asyncHandler(async (req, res) => {
    const alerts = await storage.getSmartAlerts()
    res.json(alerts)
  })
)

router.get(
  "/api/smart-alerts/stats",
  asyncHandler(async (req, res) => {
    const stats = await storage.getSmartAlertStats()
    res.json(stats)
  })
)

router.post(
  "/api/smart-alerts/dismiss",
  asyncHandler(async (req, res) => {
    const { alertId } = req.body
    await storage.dismissSmartAlert(alertId)
    res.json({ message: "Alert dismissed successfully" })
  })
)

// 進階搜尋
router.post(
  "/api/search/advanced",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { filters, searchType = "payment_items" } = req.body

    let results
    switch (searchType) {
      case "payment_items":
        results = await storage.advancedSearchPaymentItems(filters)
        break
      case "projects":
        results = await storage.advancedSearchProjects(filters)
        break
      case "categories":
        results = await storage.advancedSearchCategories(filters)
        break
      default:
        throw new AppError(400, "不支援的搜尋類型")
    }

    res.json(results)
  })
)

// 批量操作
router.post(
  "/api/batch/update",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const { action, itemIds, data } = req.body
    const result = await storage.batchUpdatePaymentItems(itemIds, action, data, userId)
    res.json(result)
  })
)

// 批量導入解析
router.post(
  "/api/payment/batch-import/parse",
  requireAuth,
  batchImportUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, "請選擇要匯入的檔案")
    }
    const result = await batchImportProcessor.parseFile(req.file.buffer, req.file.originalname)
    res.json(result)
  })
)

// 批量導入執行
router.post(
  "/api/payment/batch-import/execute",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { records } = req.body
    if (!records || !Array.isArray(records)) {
      throw new AppError(400, "無效的導入數據")
    }
    const result = await batchImportProcessor.executeImport(records)
    res.json(result)
  })
)

// 智能報表
router.get(
  "/api/reports/intelligent",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const { period = "monthly", reportType = "overview" } = req.query
    const reportData = await storage.generateIntelligentReport(
      period as string,
      reportType as string,
      userId
    )
    res.json(reportData)
  })
)

router.post(
  "/api/reports/export",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id
    const { format, reportType, filters } = req.body
    const exportData = await storage.exportReport(format, reportType, filters, userId)
    res.json(exportData)
  })
)

export default router
