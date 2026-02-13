/**
 * 人事費管理 API 路由
 * 包含員工 CRUD、月度人事費計算和查詢
 */
import { Router } from "express"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { insertEmployeeSchema } from "@shared/schema"
import { calculateInsurance } from "@shared/insurance-utils"
import * as hrStorage from "../storage/hr-costs"

const router = Router()

// ============================================================
// 員工 CRUD
// ============================================================

// 取得所有員工
router.get(
  "/api/hr/employees",
  asyncHandler(async (req, res) => {
    const { active } = req.query
    const filters = active !== undefined ? { active: active === "true" } : {}

    const result = await hrStorage.getEmployees(filters)
    res.json(result)
  })
)

// 取得單一員工
router.get(
  "/api/hr/employees/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的員工 ID")

    const result = await hrStorage.getEmployee(id)
    if (!result) throw new AppError(404, "找不到該員工")

    res.json(result)
  })
)

// 新增員工
router.post(
  "/api/hr/employees",
  asyncHandler(async (req, res) => {
    try {
      const parsed = insertEmployeeSchema.parse(req.body)
      const result = await hrStorage.createEmployee(parsed)
      res.json(result)
    } catch (error: unknown) {
      if (error instanceof AppError) throw error
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "ZodError" &&
        "errors" in error
      ) {
        return res.status(400).json({
          message: "資料驗證失敗",
          errors: (error as { errors: unknown }).errors,
        })
      }
      throw error
    }
  })
)

// 更新員工
router.put(
  "/api/hr/employees/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的員工 ID")

    const result = await hrStorage.updateEmployee(id, req.body)
    if (!result) throw new AppError(404, "找不到該員工")

    res.json(result)
  })
)

// 刪除（軟刪除）員工
router.delete(
  "/api/hr/employees/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的員工 ID")

    const result = await hrStorage.softDeleteEmployee(id)
    if (!result) throw new AppError(404, "找不到該員工")

    res.json(result)
  })
)

// ============================================================
// 薪資計算
// ============================================================

// 計算單一員工的薪資明細（純計算，保留在路由層）
router.post(
  "/api/hr/calculate",
  asyncHandler(async (req, res) => {
    const { monthlySalary, insuredSalary, dependentsCount = 0, voluntaryPensionRate = 0 } = req.body

    if (!monthlySalary || monthlySalary <= 0) {
      throw new AppError(400, "請輸入有效的月薪")
    }

    const result = calculateInsurance({
      monthlySalary: parseFloat(monthlySalary),
      insuredSalary: insuredSalary ? parseFloat(insuredSalary) : undefined,
      dependentsCount: parseInt(dependentsCount) || 0,
      voluntaryPensionRate: parseFloat(voluntaryPensionRate) || 0,
    })

    res.json(result)
  })
)

// ============================================================
// 月度人事費
// ============================================================

// 取得指定月份的人事費
router.get(
  "/api/hr/monthly-costs",
  asyncHandler(async (req, res) => {
    const { year, month } = req.query

    if (!year || !month) {
      throw new AppError(400, "請提供年份和月份")
    }

    const result = await hrStorage.getMonthlyHrCosts(
      parseInt(year as string),
      parseInt(month as string)
    )

    res.json(result)
  })
)

// 自動生成指定月份的人事費
router.post(
  "/api/hr/monthly-costs/generate",
  asyncHandler(async (req, res) => {
    const { year, month } = req.body

    if (!year || !month) {
      throw new AppError(400, "請提供年份和月份")
    }

    const yearNum = parseInt(year)
    const monthNum = parseInt(month)

    // 取得所有在職員工
    const activeEmployees = await hrStorage.getActiveEmployees()

    if (activeEmployees.length === 0) {
      throw new AppError(400, "沒有在職員工")
    }

    // 刪除已有的該月記錄
    await hrStorage.deleteMonthlyHrCosts(yearNum, monthNum)

    // 為每位符合條件的員工計算月度記錄
    const records = activeEmployees
      .filter((emp) => {
        const hireDate = new Date(emp.hireDate)
        const monthStart = new Date(yearNum, monthNum - 1, 1)
        return hireDate <= monthStart
      })
      .map((emp) => {
        const salary = parseFloat(emp.monthlySalary || "0")
        const insuredSalaryVal = emp.insuredSalary ? parseFloat(emp.insuredSalary) : undefined
        const voluntaryRate = parseFloat(emp.voluntaryPensionRate || "0")
        const dependents = emp.dependentsCount || 0

        const calc = calculateInsurance({
          monthlySalary: salary,
          insuredSalary: insuredSalaryVal,
          dependentsCount: dependents,
          voluntaryPensionRate: voluntaryRate,
        })

        return {
          year: yearNum,
          month: monthNum,
          employeeId: emp.id,
          baseSalary: salary.toString(),
          insuredSalary: calc.laborInsuredSalary.toString(),
          employerLaborInsurance: calc.employerLaborInsurance.toString(),
          employerHealthInsurance: calc.employerHealthInsurance.toString(),
          employerPension: calc.employerPension.toString(),
          employerEmploymentInsurance: calc.employerEmploymentInsurance.toString(),
          employerAccidentInsurance: calc.employerAccidentInsurance.toString(),
          employerTotal: calc.employerTotal.toString(),
          employeeLaborInsurance: calc.employeeLaborInsurance.toString(),
          employeeHealthInsurance: calc.employeeHealthInsurance.toString(),
          employeePension: calc.employeePension.toString(),
          employeeTotal: calc.employeeTotal.toString(),
          netSalary: calc.netSalary.toString(),
          totalCost: calc.totalCost.toString(),
        }
      })

    if (records.length === 0) {
      return res.json({
        message: "該月沒有符合條件的員工",
        records: [],
      })
    }

    const inserted = await hrStorage.createMonthlyHrCosts(records)

    res.json({
      message: `已為 ${inserted.length} 位員工產生 ${yearNum}年${monthNum}月 人事費`,
      records: inserted,
    })
  })
)

// 更新月度人事費付款狀態
router.put(
  "/api/hr/monthly-costs/:id/pay",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) throw new AppError(400, "無效的記錄 ID")

    const { isPaid, insurancePaid } = req.body

    const updateData: { isPaid?: boolean; insurancePaid?: boolean } = {}
    if (isPaid !== undefined) updateData.isPaid = isPaid
    if (insurancePaid !== undefined) updateData.insurancePaid = insurancePaid

    const result = await hrStorage.updateMonthlyHrCost(id, updateData)
    if (!result) throw new AppError(404, "找不到該記錄")

    res.json(result)
  })
)

// 取得人事費彙總統計
router.get(
  "/api/hr/summary",
  asyncHandler(async (req, res) => {
    const { year } = req.query
    const yearNum = year ? parseInt(year as string) : new Date().getFullYear()

    // 取得該年所有月度記錄
    const records = await hrStorage.getHrCostsByYear(yearNum)

    // 按月份彙總
    const monthlySummary: Record<
      number,
      {
        totalSalary: number
        totalEmployerCost: number
        totalCost: number
        employeeCount: number
        salaryPaid: number
        insurancePaid: number
      }
    > = {}

    for (let m = 1; m <= 12; m++) {
      const monthRecords = records.filter((r) => r.month === m)
      monthlySummary[m] = {
        totalSalary: monthRecords.reduce((s, r) => s + parseFloat(r.baseSalary || "0"), 0),
        totalEmployerCost: monthRecords.reduce((s, r) => s + parseFloat(r.employerTotal || "0"), 0),
        totalCost: monthRecords.reduce((s, r) => s + parseFloat(r.totalCost || "0"), 0),
        employeeCount: monthRecords.length,
        salaryPaid: monthRecords.filter((r) => r.isPaid).length,
        insurancePaid: monthRecords.filter((r) => r.insurancePaid).length,
      }
    }

    // 在職人數
    const activeEmployeeCount = await hrStorage.getActiveEmployeeCount()

    res.json({
      year: yearNum,
      activeEmployeeCount,
      monthlySummary,
      annualTotal: {
        totalSalary: Object.values(monthlySummary).reduce((s, m) => s + m.totalSalary, 0),
        totalEmployerCost: Object.values(monthlySummary).reduce(
          (s, m) => s + m.totalEmployerCost,
          0
        ),
        totalCost: Object.values(monthlySummary).reduce((s, m) => s + m.totalCost, 0),
      },
    })
  })
)

export default router
