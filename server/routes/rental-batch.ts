/**
 * 租金批次操作 API（第 8 步）
 *
 * - GET  /api/rental-batch/month-preview?year=YYYY&month=MM
 *   查看該月份所有「應付租金」清單（依 active contract + 日期範圍）
 * - POST /api/rental-batch/mark-month-paid
 *   body: { year, month, paymentDate? }
 *   批次為該月所有 rental 類別 payment_items 建立 payment_records
 *
 * 設計：依賴既有 payment_items (rental 類別) + storage.addPaymentRecord 的寫入邏輯
 *       preview 僅查 rental_contracts（用於 UI 顯示）
 */

import { Router } from "express"
import { z } from "zod"
import { asyncHandler, errors } from "../middleware/error-handler"
import { localDateTPE } from "@shared/date-utils"

const router = Router()

// ─────────────────────────────────────────────
// 驗證
// ─────────────────────────────────────────────

const yearMonthQuerySchema = z.object({
  year: z.preprocess(
    (v) => (v === undefined ? undefined : Number(v)),
    z.number().int().min(2000).max(2100)
  ),
  month: z.preprocess(
    (v) => (v === undefined ? undefined : Number(v)),
    z.number().int().min(1).max(12)
  ),
})

const markPaidBodySchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

// ─────────────────────────────────────────────
// GET month-preview（讀 rental_contracts）
// ─────────────────────────────────────────────

interface ContractRow {
  id: number
  contractName: string
  tenantName: string | null
  baseAmount: string | number
}

const PREVIEW_SQL = `
  SELECT
    id,
    contract_name AS "contractName",
    tenant_name AS "tenantName",
    base_amount AS "baseAmount"
  FROM rental_contracts
  WHERE COALESCE(is_active, true) = true
    AND start_date <= make_date($1, $2, 28)
    AND end_date >= make_date($1, $2, 1)
  ORDER BY contract_name
`

router.get(
  "/api/rental-batch/month-preview",
  asyncHandler(async (req, res) => {
    const parsed = yearMonthQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw errors.badRequest("year 或 month 參數無效（year: 2000-2100, month: 1-12）")
    }
    const { year, month } = parsed.data

    const { pool } = await import("../db")
    const result = await pool.query<ContractRow>(PREVIEW_SQL, [year, month])

    const items = result.rows.map((row) => ({
      id: row.id,
      contractName: row.contractName,
      tenantName: row.tenantName,
      expectedAmount: Number(row.baseAmount),
    }))
    const totalAmount = items.reduce((sum, it) => sum + it.expectedAmount, 0)

    res.json({ year, month, count: items.length, totalAmount, items })
  })
)

// ─────────────────────────────────────────────
// POST mark-month-paid（批次標記已付）
//
// 策略：取該月所有 rental 類別的 payment_items（未付清），
//       對每個 item INSERT payment_record（amount = unpaid）
// ─────────────────────────────────────────────

interface PendingRentalRow {
  id: number
  itemName: string
  totalAmount: string | number
  paidAmount: string | number
}

const PENDING_RENTAL_SQL = `
  SELECT
    pi.id,
    pi.item_name AS "itemName",
    pi.total_amount AS "totalAmount",
    COALESCE(pi.paid_amount, 0) AS "paidAmount"
  FROM payment_items pi
  LEFT JOIN fixed_categories fc ON pi.fixed_category_id = fc.id
  LEFT JOIN debt_categories dc ON pi.category_id = dc.id
  WHERE pi.is_deleted = false
    AND COALESCE(pi.status, 'pending') != 'paid'
    AND (pi.total_amount::numeric - COALESCE(pi.paid_amount, 0)::numeric) > 0
    AND (
      pi.item_name ILIKE '%租金%' OR pi.item_name ILIKE '%房租%' OR
      COALESCE(fc.category_name, '') ILIKE '%租金%' OR
      COALESCE(fc.category_name, '') ILIKE '%房租%' OR
      COALESCE(dc.category_name, '') ILIKE '%租金%' OR
      COALESCE(dc.category_name, '') ILIKE '%房租%'
    )
    AND EXTRACT(YEAR FROM COALESCE(pi.end_date, pi.start_date)) = $1
    AND EXTRACT(MONTH FROM COALESCE(pi.end_date, pi.start_date)) = $2
`

const INSERT_RECORD_SQL = `
  INSERT INTO payment_records (payment_item_id, amount_paid, payment_date, notes)
  VALUES ($1, $2, $3, $4)
  RETURNING id
`

const UPDATE_ITEM_PAID_SQL = `
  UPDATE payment_items
  SET paid_amount = total_amount,
      status = 'paid',
      updated_at = NOW()
  WHERE id = $1
`

router.post(
  "/api/rental-batch/mark-month-paid",
  asyncHandler(async (req, res) => {
    const parsed = markPaidBodySchema.safeParse(req.body)
    if (!parsed.success) {
      throw errors.badRequest("請求格式錯誤（year/month/paymentDate）")
    }
    const { year, month } = parsed.data
    const paymentDate = parsed.data.paymentDate ?? localDateTPE()

    const { pool } = await import("../db")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const pendingResult = await client.query<PendingRentalRow>(PENDING_RENTAL_SQL, [year, month])
      const pending = pendingResult.rows

      const processed: Array<{ itemId: number; itemName: string; amountPaid: number }> = []
      let totalPaid = 0

      for (const row of pending) {
        const unpaid = Number(row.totalAmount) - Number(row.paidAmount)
        if (unpaid <= 0) continue
        await client.query(INSERT_RECORD_SQL, [
          row.id,
          unpaid.toFixed(2),
          paymentDate,
          `批次標記：${year}/${month} 租金`,
        ])
        await client.query(UPDATE_ITEM_PAID_SQL, [row.id])
        processed.push({ itemId: row.id, itemName: row.itemName, amountPaid: unpaid })
        totalPaid += unpaid
      }

      await client.query("COMMIT")
      res.json({
        year,
        month,
        paymentDate,
        processedCount: processed.length,
        totalPaid,
        items: processed,
      })
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
  })
)

// ─────────────────────────────────────────────
// POST mark-cell-paid（單格標記：某 project 某月所有租金 payment_items 標記已付）
// ─────────────────────────────────────────────

const cellPaidBodySchema = z.object({
  projectId: z.number().int().positive(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

const PROJECT_MONTH_RENT_ITEMS_SQL = `
  SELECT
    pi.id,
    pi.item_name AS "itemName",
    pi.total_amount AS "totalAmount",
    COALESCE(pi.paid_amount, 0) AS "paidAmount"
  FROM payment_items pi
  LEFT JOIN payment_projects pp ON pp.id = pi.project_id
  WHERE pi.is_deleted = false
    AND pi.project_id = $1
    AND EXTRACT(YEAR FROM pi.start_date) = $2
    AND EXTRACT(MONTH FROM pi.start_date) = $3
    AND COALESCE(pi.status, 'pending') != 'paid'
    AND (pi.total_amount::numeric - COALESCE(pi.paid_amount, 0)::numeric) > 0
    AND (
      pp.project_type = 'rental'
      OR pi.item_name ILIKE '%租金%'
      OR pi.item_name ILIKE '%房租%'
      OR pi.item_name ILIKE '%租約%'
      OR pi.item_name ILIKE '%租賃%'
    )
`

router.post(
  "/api/rental-batch/mark-cell-paid",
  asyncHandler(async (req, res) => {
    const parsed = cellPaidBodySchema.safeParse(req.body)
    if (!parsed.success) {
      throw errors.badRequest("請求格式錯誤（projectId/year/month）")
    }
    const { projectId, year, month } = parsed.data
    const paymentDate = parsed.data.paymentDate ?? localDateTPE()

    const { pool } = await import("../db")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const pendingResult = await client.query<PendingRentalRow>(PROJECT_MONTH_RENT_ITEMS_SQL, [
        projectId,
        year,
        month,
      ])
      const pending = pendingResult.rows

      const processed: Array<{ itemId: number; itemName: string; amountPaid: number }> = []
      let totalPaid = 0

      for (const row of pending) {
        const unpaid = Number(row.totalAmount) - Number(row.paidAmount)
        if (unpaid <= 0) continue
        await client.query(INSERT_RECORD_SQL, [
          row.id,
          unpaid.toFixed(2),
          paymentDate,
          `矩陣點選標記：${year}/${month} ${row.itemName}`,
        ])
        await client.query(UPDATE_ITEM_PAID_SQL, [row.id])
        processed.push({ itemId: row.id, itemName: row.itemName, amountPaid: unpaid })
        totalPaid += unpaid
      }

      await client.query("COMMIT")
      res.json({
        projectId,
        year,
        month,
        paymentDate,
        processedCount: processed.length,
        totalPaid,
        items: processed,
      })
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
  })
)

// ─────────────────────────────────────────────
// POST create-yearly-items（為某 project 整年建立月租 payment_items）
// ─────────────────────────────────────────────

const yearlyItemsBodySchema = z.object({
  projectId: z.number().int().positive(),
  year: z.number().int().min(2000).max(2100),
  monthlyAmount: z.number().finite().positive(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  itemNamePrefix: z.string().max(100).optional(),
})

const CHECK_EXISTING_SQL = `
  SELECT EXTRACT(MONTH FROM start_date)::int AS month
  FROM payment_items
  WHERE project_id = $1
    AND is_deleted = false
    AND EXTRACT(YEAR FROM start_date) = $2
    AND (item_name ILIKE '%租%')
`

const INSERT_RENTAL_ITEM_SQL = `
  INSERT INTO payment_items (
    project_id, item_name, total_amount, item_type, payment_type,
    start_date, paid_amount, status
  ) VALUES ($1, $2, $3, 'project', 'single', $4, 0, 'pending')
  RETURNING id
`

router.post(
  "/api/rental-batch/create-yearly-items",
  asyncHandler(async (req, res) => {
    const parsed = yearlyItemsBodySchema.safeParse(req.body)
    if (!parsed.success) {
      throw errors.badRequest("請求格式錯誤")
    }
    const { projectId, year, monthlyAmount } = parsed.data
    const dayOfMonth = parsed.data.dayOfMonth ?? 1
    const prefix = parsed.data.itemNamePrefix ?? "租金"

    const { pool } = await import("../db")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      // 檢查既有月份避免重複建立
      const existing = await client.query<{ month: number }>(CHECK_EXISTING_SQL, [projectId, year])
      const existingMonths = new Set(existing.rows.map((r) => r.month))

      const created: Array<{ month: number; itemId: number }> = []
      for (let m = 1; m <= 12; m++) {
        if (existingMonths.has(m)) continue
        const monthStr = String(m).padStart(2, "0")
        const dayStr = String(dayOfMonth).padStart(2, "0")
        const startDate = `${year}-${monthStr}-${dayStr}`
        const itemName = `${year}-${monthStr} ${prefix}`
        const result = await client.query<{ id: number }>(INSERT_RENTAL_ITEM_SQL, [
          projectId,
          itemName,
          monthlyAmount.toFixed(2),
          startDate,
        ])
        created.push({ month: m, itemId: result.rows[0].id })
      }

      await client.query("COMMIT")
      res.json({
        projectId,
        year,
        monthlyAmount,
        skipped: 12 - created.length,
        createdCount: created.length,
        items: created,
      })
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
  })
)

export default router
