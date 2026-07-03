import { Router } from "express"
import { asyncHandler } from "../middleware/error-handler"
import { getInvoiceRecords, getInvoiceStats } from "../storage/invoice"

const router = Router()

// 獲取發票記錄列表
router.get(
  "/api/invoice-records",
  asyncHandler(async (req, res) => {
    const { year, month, category, invoiceType } = req.query

    // NaN 防護：無效數字視為未提供
    const yearNum = year ? parseInt(year as string) : NaN
    const monthNum = month ? parseInt(month as string) : NaN
    const records = await getInvoiceRecords({
      year: isNaN(yearNum) ? undefined : yearNum,
      month: isNaN(monthNum) ? undefined : monthNum,
      category: category as string | undefined,
      invoiceType: invoiceType as string | undefined,
    })

    res.json(records)
  })
)

// 獲取發票統計
router.get(
  "/api/invoice-records/stats",
  asyncHandler(async (req, res) => {
    const { year } = req.query
    const parsed = year ? parseInt(year as string) : NaN
    const targetYear = isNaN(parsed) ? new Date().getFullYear() : parsed

    const result = await getInvoiceStats(targetYear)
    res.json(result)
  })
)

export default router
