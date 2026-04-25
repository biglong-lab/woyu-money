/**
 * 租金月度矩陣 API（第 7 步）
 *
 * GET /api/rental-matrix?year=YYYY
 * 以 payment_projects 為合約維度，合併兩種租金記錄來源：
 * 1. project_type='rental'（浯島文旅、浯島輕旅）
 * 2. payment_items 名稱含「租」的 project（小六路厝、總兵招待所等）
 *
 * 月度應付/已付由 payment_items 按 project_id + month(start_date) 聚合。
 */

import { Router } from "express"
import { z } from "zod"
import { asyncHandler, errors } from "../middleware/error-handler"
import { buildRentalMatrix, type RentalContractInfo } from "@shared/rental-matrix"

const router = Router()

const yearSchema = z.preprocess(
  (val) => (val === undefined ? undefined : Number(val)),
  z.number().int().min(2000).max(2100).optional()
)

interface ProjectRow {
  id: number
  projectName: string
  earliest: string | null
  latest: string | null
  avgMonthly: string | number | null
}

interface MonthlyRow {
  projectId: number
  month: number
  expected: string | number
  paid: string | number
}

// 合約列：有租金項目的 active project，排除「雜項無分類」(id=1)
// 重要：只看 item_name 是「租金/房租/租約/租賃」的項目，
// 不能用 project_type='rental' 短路（會把該 project 所有雜費也當租金）
const RENT_ITEM_FILTER = `
  pi.item_name ILIKE '%租金%'
  OR pi.item_name ILIKE '%房租%'
  OR pi.item_name ILIKE '%租約%'
  OR pi.item_name ILIKE '%租賃%'
`

const CONTRACTS_SQL = `
  SELECT
    pp.id,
    pp.project_name AS "projectName",
    MIN(pi.start_date)::text AS "earliest",
    MAX(pi.start_date)::text AS "latest",
    AVG(pi.total_amount::numeric) AS "avgMonthly"
  FROM payment_projects pp
  JOIN payment_items pi ON pi.project_id = pp.id AND pi.is_deleted = false
  WHERE pp.is_active = true
    AND COALESCE(pp.is_deleted, false) = false
    AND pp.id != 1
    AND (${RENT_ITEM_FILTER})
  GROUP BY pp.id, pp.project_name
  ORDER BY pp.project_name
`

// 每月應付/已付（依 project_id + start_date 月份聚合）
// 同樣只算租金項目，避免把雜費（如水肥、洗滌、暫繳款、保險）誤入計算
const MONTHLY_SQL = `
  SELECT
    pi.project_id AS "projectId",
    EXTRACT(MONTH FROM pi.start_date)::int AS "month",
    SUM(pi.total_amount::numeric) AS "expected",
    SUM(COALESCE(pi.paid_amount, 0)::numeric) AS "paid"
  FROM payment_items pi
  JOIN payment_projects pp ON pp.id = pi.project_id
  WHERE pi.is_deleted = false
    AND pp.id != 1
    AND EXTRACT(YEAR FROM pi.start_date) = $1
    AND (${RENT_ITEM_FILTER})
  GROUP BY pi.project_id, month
`

router.get(
  "/api/rental-matrix",
  asyncHandler(async (req, res) => {
    const parsed = yearSchema.safeParse(req.query.year)
    if (!parsed.success) {
      throw errors.badRequest("year 參數錯誤：必須為 2000~2100 的整數")
    }
    const year = parsed.data ?? new Date().getFullYear()

    const { pool } = await import("../db")
    const [projectsRes, monthlyRes] = await Promise.all([
      pool.query<ProjectRow>(CONTRACTS_SQL),
      pool.query<MonthlyRow>(MONTHLY_SQL, [year]),
    ])

    // project -> contract info（每個合約=一個 rental project）
    const contracts: RentalContractInfo[] = projectsRes.rows.map((row) => ({
      id: row.id,
      contractName: row.projectName,
      tenantName: null,
      startDate: row.earliest ?? `${year}-01-01`,
      endDate: row.latest ?? `${year}-12-31`,
      monthlyAmount: Math.round(Number(row.avgMonthly ?? 0)),
    }))

    // monthly 聚合 → 直接傳入 shared matrix（buildRentalMatrix 需要 MonthlyPayment，
    // 但我們這裡以 expectedAmount 從資料庫得來，所以自己組矩陣）
    const matrix = buildRentalMatrix(
      contracts,
      monthlyRes.rows.map((r) => ({
        contractId: r.projectId,
        month: r.month,
        paidAmount: Number(r.paid),
      })),
      year
    )

    // 覆寫 expectedAmount 為 DB 實際月度總額（而非 contract.monthlyAmount 推算）
    const expectedMap = new Map<string, number>()
    for (const r of monthlyRes.rows) {
      expectedMap.set(`${r.projectId}-${r.month}`, Number(r.expected))
    }
    matrix.cells = matrix.cells.map((c) => {
      const key = `${c.contractId}-${c.month}`
      const expected = expectedMap.get(key)
      if (expected === undefined) {
        // 該月無租金項目 → out_of_contract
        return { ...c, status: "out_of_contract", expectedAmount: 0, paidAmount: 0 }
      }
      const paid = c.paidAmount
      let status: typeof c.status
      if (paid >= expected && expected > 0) status = "paid"
      else if (paid > 0) status = "partial"
      else {
        const now = new Date()
        const cur = now.getFullYear() * 12 + now.getMonth() + 1
        const cellYM = year * 12 + c.month
        status = cellYM > cur ? "upcoming" : "unpaid"
      }
      return { ...c, status, expectedAmount: expected, paidAmount: paid }
    })

    // 重新計算 totals
    let expectedSum = 0,
      paidSum = 0,
      paidCount = 0,
      unpaidCount = 0
    for (const cell of matrix.cells) {
      if (cell.status === "out_of_contract" || cell.status === "upcoming") continue
      expectedSum += cell.expectedAmount
      paidSum += cell.paidAmount
      if (cell.status === "paid") paidCount++
      if (cell.status === "unpaid" || cell.status === "partial") unpaidCount++
    }
    matrix.totals = {
      expected: expectedSum,
      paid: paidSum,
      unpaid: Math.max(0, expectedSum - paidSum),
      paidCount,
      unpaidCount,
    }

    res.json(matrix)
  })
)

export default router
