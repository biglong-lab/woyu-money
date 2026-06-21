/**
 * 勞健保月度矩陣 API
 *
 * GET  /api/labor-insurance-matrix?year=YYYY
 *   三列（勞保/健保/勞退）× 12 月，跨員工加總 monthly_hr_costs 雇主負擔 + 每月付款狀態
 * POST /api/labor-insurance-matrix/mark-paid  { year, month }
 *   把該月所有 monthly_hr_costs 的 insurancePaid 設為 true（整月勞健保標已繳）
 */
import { Router } from "express"
import { z } from "zod"
import { asyncHandler, errors } from "../middleware/error-handler"
import { buildLaborInsuranceMatrix, type HrCostInput } from "@shared/labor-insurance-matrix"

const router = Router()

const yearSchema = z.preprocess(
  (val) => (val === undefined ? undefined : Number(val)),
  z.number().int().min(2000).max(2100).optional()
)

interface CostRow {
  month: number
  employerLaborInsurance: string | number
  employerEmploymentInsurance: string | number
  employerAccidentInsurance: string | number
  employerHealthInsurance: string | number
  employerPension: string | number
  insurancePaid: boolean
}

const COSTS_SQL = `
  SELECT
    month,
    COALESCE(employer_labor_insurance, 0)       AS "employerLaborInsurance",
    COALESCE(employer_employment_insurance, 0)  AS "employerEmploymentInsurance",
    COALESCE(employer_accident_insurance, 0)    AS "employerAccidentInsurance",
    COALESCE(employer_health_insurance, 0)      AS "employerHealthInsurance",
    COALESCE(employer_pension, 0)               AS "employerPension",
    COALESCE(insurance_paid, false)             AS "insurancePaid"
  FROM monthly_hr_costs
  WHERE year = $1
`

router.get(
  "/api/labor-insurance-matrix",
  asyncHandler(async (req, res) => {
    const parsed = yearSchema.safeParse(req.query.year)
    if (!parsed.success) {
      throw errors.badRequest("year 參數錯誤：必須為 2000~2100 的整數")
    }
    const year = parsed.data ?? new Date().getFullYear()

    const { pool } = await import("../db")
    const { rows } = await pool.query<CostRow>(COSTS_SQL, [year])

    const records: HrCostInput[] = rows.map((r) => ({
      month: r.month,
      employerLaborInsurance: Number(r.employerLaborInsurance),
      employerEmploymentInsurance: Number(r.employerEmploymentInsurance),
      employerAccidentInsurance: Number(r.employerAccidentInsurance),
      employerHealthInsurance: Number(r.employerHealthInsurance),
      employerPension: Number(r.employerPension),
      insurancePaid: Boolean(r.insurancePaid),
    }))

    res.json(buildLaborInsuranceMatrix(year, records))
  })
)

const markPaidSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

router.post(
  "/api/labor-insurance-matrix/mark-paid",
  asyncHandler(async (req, res) => {
    const parsed = markPaidSchema.safeParse(req.body)
    if (!parsed.success) {
      throw errors.badRequest("參數錯誤：year(2000-2100) / month(1-12) 必填")
    }
    const { year, month } = parsed.data

    const { pool } = await import("../db")
    const result = await pool.query(
      `UPDATE monthly_hr_costs SET insurance_paid = true, updated_at = NOW()
       WHERE year = $1 AND month = $2`,
      [year, month]
    )
    res.json({ success: true, year, month, updated: result.rowCount ?? 0 })
  })
)

export default router
