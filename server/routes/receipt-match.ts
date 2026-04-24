/**
 * 收據自動對應 API（第 10 步）
 *
 * POST /api/receipt-match/suggest
 *   body: { amount?, receiptDate?, vendor?, category?, ocrText?, limit? }
 *   回傳：{ bestMatch, candidates, autoConfirmable }
 *
 * 使用者拍收據 → OCR → 呼叫此 API → 顯示匹配的既有 payment_items
 * 若 autoConfirmable 為 true，UI 可直接顯示「確認已付」按鈕
 */

import { Router } from "express"
import { z } from "zod"
import { asyncHandler, errors } from "../middleware/error-handler"
import { matchReceiptToItems, type ReceiptInput, type CandidateItem } from "@shared/receipt-matcher"

const router = Router()

const suggestBodySchema = z.object({
  amount: z.number().finite().positive().optional(),
  receiptDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  vendor: z.string().max(500).optional(),
  category: z.string().max(200).optional(),
  ocrText: z.string().max(10000).optional(),
  limit: z.number().int().min(1).max(20).optional(),
})

interface CandidateRow {
  id: number
  itemName: string
  totalAmount: string | number
  paidAmount: string | number
  startDate: string | null
  endDate: string | null
  fixedCategoryName: string | null
  debtCategoryName: string | null
}

// 查未付清的 payment_items 作為匹配候選
const CANDIDATES_SQL = `
  SELECT
    pi.id,
    pi.item_name AS "itemName",
    pi.total_amount AS "totalAmount",
    COALESCE(pi.paid_amount, 0) AS "paidAmount",
    pi.start_date::text AS "startDate",
    pi.end_date::text AS "endDate",
    fc.category_name AS "fixedCategoryName",
    dc.category_name AS "debtCategoryName"
  FROM payment_items pi
  LEFT JOIN fixed_categories fc ON pi.fixed_category_id = fc.id
  LEFT JOIN debt_categories dc ON pi.category_id = dc.id
  WHERE pi.is_deleted = false
    AND COALESCE(pi.status, 'pending') != 'paid'
    AND (pi.total_amount::numeric - COALESCE(pi.paid_amount, 0)::numeric) > 0
  ORDER BY pi.updated_at DESC
  LIMIT 200
`

function toCandidate(row: CandidateRow): CandidateItem {
  return {
    id: row.id,
    itemName: row.itemName,
    totalAmount: Number(row.totalAmount),
    paidAmount: Number(row.paidAmount),
    startDate: row.startDate,
    endDate: row.endDate,
    categoryName: row.fixedCategoryName ?? row.debtCategoryName ?? null,
  }
}

router.post(
  "/api/receipt-match/suggest",
  asyncHandler(async (req, res) => {
    const parsed = suggestBodySchema.safeParse(req.body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw errors.badRequest(`請求格式錯誤：${issue?.path.join(".")} - ${issue?.message}`)
    }
    const { amount, receiptDate, vendor, category, ocrText, limit } = parsed.data

    // 至少要有金額或文字才有意義
    if (!amount && !ocrText && !vendor) {
      throw errors.badRequest("至少需要 amount / vendor / ocrText 其中之一")
    }

    const receipt: ReceiptInput = {
      amount: amount ?? null,
      receiptDate: receiptDate ?? null,
      vendor: vendor ?? null,
      category: category ?? null,
      ocrText: ocrText ?? null,
    }

    const { pool } = await import("../db")
    const result = await pool.query<CandidateRow>(CANDIDATES_SQL)
    const candidates = result.rows.map(toCandidate)

    const match = matchReceiptToItems(receipt, candidates, { topN: limit ?? 5 })

    res.json({
      query: receipt,
      totalCandidates: candidates.length,
      ...match,
    })
  })
)

export default router
