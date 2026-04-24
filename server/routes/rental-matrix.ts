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

interface RevenueRow {
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

// 聚合指定年度內，每個 project 每月的 daily_revenues 總額
const REVENUES_BY_PROJECT_MONTH_SQL = `
  SELECT
    project_id AS "projectId",
    EXTRACT(MONTH FROM date)::int AS "month",
    SUM(amount::numeric) AS "amount"
  FROM daily_revenues
  WHERE EXTRACT(YEAR FROM date) = $1
    AND project_id IS NOT NULL
  GROUP BY project_id, month
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

// 將每個 project 每月的收款分配到該 project 的所有 contract
// 簡化規則：同 project 多合約時按 monthlyAmount 比例分配收款
function distributePayments(
  contracts: Array<ContractRow>,
  revenues: RevenueRow[]
): MonthlyPayment[] {
  const byProjectMonth = new Map<string, number>()
  for (const r of revenues) {
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
    const [contractsResult, revenuesResult] = await Promise.all([
      pool.query<ContractRow>(CONTRACTS_SQL),
      pool.query<RevenueRow>(REVENUES_BY_PROJECT_MONTH_SQL, [year]),
    ])

    const contractRows = contractsResult.rows
    const contracts = contractRows.map(toContractInfo)
    const payments = distributePayments(contractRows, revenuesResult.rows)

    const matrix = buildRentalMatrix(contracts, payments, year)
    res.json(matrix)
  })
)

export default router
