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
}

const CONTRACTS_SQL = `
  SELECT
    id,
    contract_name AS "contractName",
    tenant_name AS "tenantName",
    start_date::text AS "startDate",
    end_date::text AS "endDate",
    base_amount AS "baseAmount"
  FROM rental_contracts
  WHERE COALESCE(is_active, true) = true
  ORDER BY contract_name
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

router.get(
  "/api/rental-matrix",
  asyncHandler(async (req, res) => {
    const parsed = yearSchema.safeParse(req.query.year)
    if (!parsed.success) {
      throw errors.badRequest("year 參數錯誤：必須為 2000~2100 的整數")
    }
    const year = parsed.data ?? new Date().getFullYear()

    const { pool } = await import("../db")
    const result = await pool.query<ContractRow>(CONTRACTS_SQL)
    const contracts = result.rows.map(toContractInfo)

    // payments 目前尚未接入（由 rental 模組負責 mapping）
    const payments: MonthlyPayment[] = []
    const matrix = buildRentalMatrix(contracts, payments, year)
    res.json(matrix)
  })
)

export default router
