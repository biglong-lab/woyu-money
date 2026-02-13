/**
 * 報表 API 路由
 * 提供財務三表和人事費報表的查詢端點
 */
import { Router } from "express"
import { asyncHandler } from "../middleware/error-handler"
import {
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowStatement,
  getHrCostReport,
  getHrCostMonthlyDetail,
  getBusinessTaxReport,
  getSalaryWithholdingReport,
  getSupplementaryHealthReport,
} from "../storage/financial-reports"

const router = Router()

// 簡易損益表
router.get(
  "/api/reports/income-statement",
  asyncHandler(async (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1
    res.json(await getIncomeStatement(year, month))
  })
)

// 簡易資產負債表
router.get(
  "/api/reports/balance-sheet",
  asyncHandler(async (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1
    res.json(await getBalanceSheet(year, month))
  })
)

// 現金流量表
router.get(
  "/api/reports/cash-flow",
  asyncHandler(async (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1
    res.json(await getCashFlowStatement(year, month))
  })
)

// 人事費年度報表
router.get(
  "/api/reports/hr-cost-report",
  asyncHandler(async (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    res.json(await getHrCostReport(year))
  })
)

// 人事費月度明細
router.get(
  "/api/reports/hr-cost-report/:year/:month",
  asyncHandler(async (req, res) => {
    const year = parseInt(req.params.year)
    const month = parseInt(req.params.month)
    res.json(await getHrCostMonthlyDetail(year, month))
  })
)

// 營業稅彙總（每兩個月一期）
router.get(
  "/api/reports/tax/business-tax",
  asyncHandler(async (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    const period = parseInt(req.query.period as string) || 1
    res.json(await getBusinessTaxReport(year, period))
  })
)

// 薪資扣繳彙總（年度）
router.get(
  "/api/reports/tax/salary-withholding",
  asyncHandler(async (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    res.json(await getSalaryWithholdingReport(year))
  })
)

// 二代健保補充保費試算
router.get(
  "/api/reports/tax/supplementary-health",
  asyncHandler(async (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    res.json(await getSupplementaryHealthReport(year))
  })
)

export default router
