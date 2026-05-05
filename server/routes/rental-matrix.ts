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

// 租金 match 規則（雙條件 OR，避免漏算各館不同命名習慣）：
//   規則 1：項目名含「租」字（涵蓋 租金/房租/租約/租賃/月租...）
//   規則 2：項目名以 YYYY-MM- 或 YYYY-MM 空格開頭，且包含 rental_contracts.contract_name
//          → 抓得到「2026-04-總兵招待所-軍友社」「2026-04-魁星背包棧」這類命名
// 排除：「Super8-浯島輕旅」這類雜支（不含「租」+ 非 YYYY-MM 前綴）
const RENT_ITEM_FILTER = `
  pi.item_name ILIKE '%租%'
  OR (
    pi.item_name ~ '^[0-9]{4}-[0-9]{2}[- ]'
    AND rc.contract_name IS NOT NULL
    AND pi.item_name ILIKE '%' || rc.contract_name || '%'
  )
`

// 合約列：以 rental_contracts 為唯一真理源（與 /rental-management-enhanced 一致）
// 透過 project_id 對應到 payment_items 取每月實際付款狀態
const CONTRACTS_SQL = `
  SELECT
    rc.project_id AS "id",
    rc.contract_name AS "projectName",
    rc.start_date::text AS "earliest",
    rc.end_date::text AS "latest",
    rc.base_amount AS "avgMonthly"
  FROM rental_contracts rc
  WHERE COALESCE(rc.is_active, true) = true
  ORDER BY rc.contract_name
`

// 每月應付/已付（依 project_id + start_date 月份聚合）
// 只取對應 rental_contracts 的 project_id（與合約清單同步）+ 租金項目
const MONTHLY_SQL = `
  SELECT
    pi.project_id AS "projectId",
    EXTRACT(MONTH FROM pi.start_date)::int AS "month",
    SUM(pi.total_amount::numeric) AS "expected",
    SUM(COALESCE(pi.paid_amount, 0)::numeric) AS "paid"
  FROM payment_items pi
  JOIN rental_contracts rc ON rc.project_id = pi.project_id
  WHERE pi.is_deleted = false
    AND COALESCE(rc.is_active, true) = true
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
    // 覆寫每格金額狀態。注意：
    // - buildRentalMatrix 已根據 contract.startDate/endDate 判斷該月是否在合約內，
    //   合約期外會回傳 status='out_of_contract'，此處需「尊重該判斷」不覆蓋。
    // - 合約期內但無 payment_item → 用 contract.monthlyAmount (avgMonthly) 為應付額，
    //   paid=0，狀態保留 buildCell 原本的 unpaid/upcoming 判斷（已含日期）。
    matrix.cells = matrix.cells.map((c) => {
      // 合約期外直接保留（不要覆寫成有金額）
      if (c.status === "out_of_contract") {
        return { ...c, expectedAmount: 0, paidAmount: 0 }
      }

      const key = `${c.contractId}-${c.month}`
      const expectedFromDb = expectedMap.get(key)
      const expected = expectedFromDb ?? c.expectedAmount // fallback 用合約 base_amount
      const paid = c.paidAmount

      // 重新計算 status（保留 upcoming 判斷給未來月份）
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
