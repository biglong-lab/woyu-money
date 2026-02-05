/**
 * 人事費管理 API 路由
 * 包含員工 CRUD、月度人事費計算和查詢
 */
import { Router } from "express"
import { requireAuth } from "../auth"
import { db } from "../db"
import {
  employees,
  monthlyHrCosts,
  insertEmployeeSchema,
  type Employee,
  type MonthlyHrCost,
} from "@shared/schema"
import { eq, and, desc, asc } from "drizzle-orm"
import { calculateInsurance } from "@shared/insurance-utils"

const router = Router()

// ============================================================
// 員工 CRUD
// ============================================================

// 取得所有員工
router.get("/api/hr/employees", async (req, res) => {
  try {
    const { active } = req.query
    const conditions = active === "true" ? eq(employees.isActive, true) : undefined

    const result = await db.query.employees.findMany({
      where: conditions,
      orderBy: [asc(employees.employeeName)],
    })

    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 取得單一員工
router.get("/api/hr/employees/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const result = await db.query.employees.findFirst({
      where: eq(employees.id, id),
    })

    if (!result) {
      return res.status(404).json({ error: "找不到該員工" })
    }

    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 新增員工
router.post("/api/hr/employees", async (req, res) => {
  try {
    const parsed = insertEmployeeSchema.parse(req.body)
    const [result] = await db.insert(employees).values(parsed).returning()
    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// 更新員工
router.put("/api/hr/employees/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const updateData = {
      ...req.body,
      updatedAt: new Date(),
    }
    const [result] = await db
      .update(employees)
      .set(updateData)
      .where(eq(employees.id, id))
      .returning()

    if (!result) {
      return res.status(404).json({ error: "找不到該員工" })
    }

    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// 刪除（軟刪除）員工
router.delete("/api/hr/employees/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const [result] = await db
      .update(employees)
      .set({ isActive: false, terminationDate: new Date().toISOString().split("T")[0], updatedAt: new Date() })
      .where(eq(employees.id, id))
      .returning()

    if (!result) {
      return res.status(404).json({ error: "找不到該員工" })
    }

    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================================
// 薪資計算
// ============================================================

// 計算單一員工的薪資明細
router.post("/api/hr/calculate", async (req, res) => {
  try {
    const { monthlySalary, insuredSalary, dependentsCount = 0, voluntaryPensionRate = 0 } = req.body

    if (!monthlySalary || monthlySalary <= 0) {
      return res.status(400).json({ error: "請輸入有效的月薪" })
    }

    const result = calculateInsurance({
      monthlySalary: parseFloat(monthlySalary),
      insuredSalary: insuredSalary ? parseFloat(insuredSalary) : undefined,
      dependentsCount: parseInt(dependentsCount) || 0,
      voluntaryPensionRate: parseFloat(voluntaryPensionRate) || 0,
    })

    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// ============================================================
// 月度人事費
// ============================================================

// 取得指定月份的人事費
router.get("/api/hr/monthly-costs", async (req, res) => {
  try {
    const { year, month } = req.query

    if (!year || !month) {
      return res.status(400).json({ error: "請提供年份和月份" })
    }

    const result = await db.query.monthlyHrCosts.findMany({
      where: and(
        eq(monthlyHrCosts.year, parseInt(year as string)),
        eq(monthlyHrCosts.month, parseInt(month as string))
      ),
      with: {
        employee: true,
      },
      orderBy: [asc(monthlyHrCosts.employeeId)],
    })

    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 自動生成指定月份的人事費
router.post("/api/hr/monthly-costs/generate", async (req, res) => {
  try {
    const { year, month } = req.body

    if (!year || !month) {
      return res.status(400).json({ error: "請提供年份和月份" })
    }

    const yearNum = parseInt(year)
    const monthNum = parseInt(month)

    // 取得所有在職員工
    const activeEmployees = await db.query.employees.findMany({
      where: eq(employees.isActive, true),
    })

    if (activeEmployees.length === 0) {
      return res.status(400).json({ error: "沒有在職員工" })
    }

    // 刪除已有的該月記錄
    await db.delete(monthlyHrCosts).where(
      and(
        eq(monthlyHrCosts.year, yearNum),
        eq(monthlyHrCosts.month, monthNum)
      )
    )

    // 為每位員工計算並產生月度記錄
    const records = activeEmployees
      .filter((emp) => {
        // 確認到職日在該月之前
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
      return res.json({ message: "該月沒有符合條件的員工", records: [] })
    }

    const inserted = await db.insert(monthlyHrCosts).values(records).returning()

    res.json({
      message: `已為 ${inserted.length} 位員工產生 ${yearNum}年${monthNum}月 人事費`,
      records: inserted,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 更新月度人事費付款狀態
router.put("/api/hr/monthly-costs/:id/pay", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { isPaid, insurancePaid } = req.body

    const updateData: Record<string, any> = { updatedAt: new Date() }
    if (isPaid !== undefined) updateData.isPaid = isPaid
    if (insurancePaid !== undefined) updateData.insurancePaid = insurancePaid

    const [result] = await db
      .update(monthlyHrCosts)
      .set(updateData)
      .where(eq(monthlyHrCosts.id, id))
      .returning()

    if (!result) {
      return res.status(404).json({ error: "找不到該記錄" })
    }

    res.json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// 取得人事費彙總統計
router.get("/api/hr/summary", async (req, res) => {
  try {
    const { year } = req.query
    const yearNum = year ? parseInt(year as string) : new Date().getFullYear()

    // 取得該年所有月度記錄
    const records = await db.query.monthlyHrCosts.findMany({
      where: eq(monthlyHrCosts.year, yearNum),
      with: {
        employee: true,
      },
    })

    // 按月份彙總
    const monthlySummary: Record<number, {
      totalSalary: number
      totalEmployerCost: number
      totalCost: number
      employeeCount: number
      salaryPaid: number
      insurancePaid: number
    }> = {}

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
    const activeEmployees = await db.query.employees.findMany({
      where: eq(employees.isActive, true),
    })

    res.json({
      year: yearNum,
      activeEmployeeCount: activeEmployees.length,
      monthlySummary,
      annualTotal: {
        totalSalary: Object.values(monthlySummary).reduce((s, m) => s + m.totalSalary, 0),
        totalEmployerCost: Object.values(monthlySummary).reduce((s, m) => s + m.totalEmployerCost, 0),
        totalCost: Object.values(monthlySummary).reduce((s, m) => s + m.totalCost, 0),
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
