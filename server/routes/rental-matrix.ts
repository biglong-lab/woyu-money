/**
 * 租金月度矩陣 API（第 7 步）
 *
 * GET /api/rental-matrix?year=YYYY
 * 回傳指定年度的租金矩陣（合約 × 12 月）
 *
 * 注：payments 資料來源整合留待後續 round 補上（待 rental 模組提供精確付款 mapping）
 *    目前前端可顯示：out_of_contract / upcoming / unpaid 三態骨架
 */

import { Router } from "express"
import { z } from "zod"
import { asyncHandler, errors } from "../middleware/error-handler"
import {
  buildRentalMatrix,
  type RentalContractInfo,
  type MonthlyPayment,
} from "@shared/rental-matrix"

const router = Router()

const yearSchema = z.preprocess(
  (val) => (val === undefined ? undefined : Number(val)),
  z.number().int().min(2000).max(2100).optional()
)

interface ContractRow {
  id: number
  contractName: string
  tenantName: string | null
  startDate: string
  endDate: string
  baseAmount: string | number
  projectId: number | null
}

interface PaymentRow {
  projectId: number
  month: number
  amount: string | number
}

const CONTRACTS_SQL = `
  SELECT
    id,
    contract_name AS "contractName",
    tenant_name AS "tenantName",
    start_date::text AS "startDate",
    end_date::text AS "endDate",
    base_amount AS "baseAmount",
    project_id AS "projectId"
  FROM rental_contracts
  WHERE COALESCE(is_active, true) = true
  ORDER BY contract_name
`

// 聚合指定年度內，每個 project 每月的「租金類」已付款額
// 來源：payment_records JOIN payment_items，過濾租金關鍵字（item_name / category 名稱）
const RENT_PAYMENTS_SQL = `
  SELECT
    pi.project_id AS "projectId",
    EXTRACT(MONTH FROM pr.payment_date)::int AS "month",
    SUM(pr.amount_paid::numeric) AS "amount"
  FROM payment_records pr
  JOIN payment_items pi ON pi.id = pr.payment_item_id
  LEFT JOIN fixed_categories fc ON fc.id = pi.fixed_category_id
  LEFT JOIN debt_categories dc ON dc.id = pi.category_id
  WHERE EXTRACT(YEAR FROM pr.payment_date) = $1
    AND pi.project_id IS NOT NULL
    AND (
      pi.item_name ILIKE '%租金%' OR pi.item_name ILIKE '%房租%' OR
      COALESCE(fc.category_name, '') ILIKE '%租金%' OR
      COALESCE(fc.category_name, '') ILIKE '%房租%' OR
      COALESCE(dc.category_name, '') ILIKE '%租金%' OR
      COALESCE(dc.category_name, '') ILIKE '%房租%'
    )
  GROUP BY pi.project_id, month
`

function toContractInfo(row: ContractRow): RentalContractInfo {
  return {
    id: row.id,
    contractName: row.contractName,
    tenantName: row.tenantName,
    startDate: row.startDate,
    endDate: row.endDate,
    monthlyAmount: Number(row.baseAmount),
  }
}

// 將每個 project 每月的「租金類付款」分配到該 project 的所有 contract
// 簡化規則：同 project 多合約時按 baseAmount 比例分配
function distributePayments(
  contracts: Array<ContractRow>,
  payments: PaymentRow[]
): MonthlyPayment[] {
  const byProjectMonth = new Map<string, number>()
  for (const r of payments) {
    byProjectMonth.set(`${r.projectId}-${r.month}`, Number(r.amount))
  }

  const contractsByProject = new Map<number, ContractRow[]>()
  for (const c of contracts) {
    if (c.projectId == null) continue
    const arr = contractsByProject.get(c.projectId) ?? []
    arr.push(c)
    contractsByProject.set(c.projectId, arr)
  }

  const result: MonthlyPayment[] = []
  Array.from(contractsByProject.entries()).forEach(([projectId, cs]) => {
    const totalMonthly = cs.reduce((s: number, c: ContractRow) => s + Number(c.baseAmount), 0)
    if (totalMonthly <= 0) return
    for (let m = 1; m <= 12; m++) {
      const revenue = byProjectMonth.get(`${projectId}-${m}`) ?? 0
      if (revenue <= 0) continue
      for (const c of cs) {
        const share = (Number(c.baseAmount) / totalMonthly) * revenue
        result.push({ contractId: c.id, month: m, paidAmount: share })
      }
    }
  })
  return result
}

router.get(
  "/api/rental-matrix",
  asyncHandler(async (req, res) => {
    const parsed = yearSchema.safeParse(req.query.year)
    if (!parsed.success) {
      throw errors.badRequest("year 參數錯誤：必須為 2000~2100 的整數")
    }
    const year = parsed.data ?? new Date().getFullYear()

    const { pool } = await import("../db")
    const [contractsResult, paymentsResult] = await Promise.all([
      pool.query<ContractRow>(CONTRACTS_SQL),
      pool.query<PaymentRow>(RENT_PAYMENTS_SQL, [year]),
    ])

    const contractRows = contractsResult.rows
    const contracts = contractRows.map(toContractInfo)
    const payments = distributePayments(contractRows, paymentsResult.rows)

    const matrix = buildRentalMatrix(contracts, payments, year)
    res.json(matrix)
  })
)

export default router
