import { Router } from "express"
import { asyncHandler } from "../middleware/error-handler"
import { getInvoiceRecords, getInvoiceStats } from "../storage/invoice"

const router = Router()

// 獲取發票記錄列表
router.get(
  "/api/invoice-records",
  asyncHandler(async (req, res) => {
    const { year, month, category, invoiceType } = req.query

    const records = await getInvoiceRecords({
      year: year ? parseInt(year as string) : undefined,
      month: month ? parseInt(month as string) : undefined,
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
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear()

    const result = await getInvoiceStats(targetYear)
    res.json(result)
  })
)

export default router
