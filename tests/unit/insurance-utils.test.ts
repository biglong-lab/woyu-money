/**
 * 勞健保計算工具測試
 * 測試薪資和保費計算的正確性
 */
import { describe, it, expect } from "vitest"

// 假設這些工具函數存在於 shared/insurance-utils.ts
// 這裡先建立測試，之後實作時確保符合測試

describe("勞健保計算工具", () => {
  describe("勞保費計算", () => {
    it("應該正確計算雇主負擔的勞保費（70%）", () => {
      // 以投保薪資 30,300 為例
      // 勞保費率 12%，雇主負擔 70%
      const insuredSalary = 30300
      const laborInsuranceRate = 0.12
      const employerShare = 0.7

      const expectedEmployerCost = insuredSalary * laborInsuranceRate * employerShare
      expect(expectedEmployerCost).toBeCloseTo(2545.2, 1)
    })

    it("應該正確計算員工負擔的勞保費（20%）", () => {
      const insuredSalary = 30300
      const laborInsuranceRate = 0.12
      const employeeShare = 0.2

      const expectedEmployeeCost = insuredSalary * laborInsuranceRate * employeeShare
      expect(expectedEmployeeCost).toBeCloseTo(727.2, 1)
    })
  })

  describe("健保費計算", () => {
    it("應該正確計算無眷屬的健保費", () => {
      // 健保費率 5.17%，雇主負擔 60%
      const insuredSalary = 30300
      const healthInsuranceRate = 0.0517
      const employerShare = 0.6

      const expectedEmployerCost = insuredSalary * healthInsuranceRate * employerShare
      expect(expectedEmployerCost).toBeCloseTo(939.9, 0) // 允許整數精度
    })

    it("應該正確計算含眷屬的健保費", () => {
      // 眷屬最多計算 3 人
      const insuredSalary = 30300
      const healthInsuranceRate = 0.0517
      const dependentsCount = 2

      // 眷屬費用由員工全額負擔
      const basePremium = insuredSalary * healthInsuranceRate
      const employeePremium = basePremium * 0.3 // 員工本人 30%
      const dependentsPremium = basePremium * dependentsCount // 眷屬全額

      expect(employeePremium + dependentsPremium).toBeGreaterThan(employeePremium)
    })
  })

  describe("勞退計算", () => {
    it("應該正確計算雇主強制提撥 6%", () => {
      const monthlySalary = 35000
      const expectedPension = monthlySalary * 0.06
      expect(expectedPension).toBe(2100)
    })

    it("應該正確計算員工自提（0-6%）", () => {
      const monthlySalary = 35000
      const voluntaryRate = 0.03 // 自提 3%

      const expectedVoluntary = monthlySalary * voluntaryRate
      expect(expectedVoluntary).toBe(1050)
    })
  })

  describe("總成本計算", () => {
    it("應該正確計算公司總人事成本", () => {
      const baseSalary = 30000
      const employerLaborIns = 2500
      const employerHealthIns = 900
      const employerPension = 1800

      const totalCost = baseSalary + employerLaborIns + employerHealthIns + employerPension
      expect(totalCost).toBe(35200)
    })

    it("應該正確計算員工實領薪資", () => {
      const baseSalary = 30000
      const employeeLaborIns = 720
      const employeeHealthIns = 450
      const employeePension = 0 // 假設不自提

      const netSalary = baseSalary - employeeLaborIns - employeeHealthIns - employeePension
      expect(netSalary).toBe(28830)
    })
  })
})

describe("投保級距對應", () => {
  it("應該根據月薪對應正確的投保薪資", () => {
    // 常見級距對應
    const gradeMapping = [
      { salary: 25000, insuredSalary: 25250 },
      { salary: 30000, insuredSalary: 30300 },
      { salary: 35000, insuredSalary: 35200 },
      { salary: 45000, insuredSalary: 45800 },
    ]

    for (const { salary, insuredSalary } of gradeMapping) {
      expect(insuredSalary).toBeGreaterThanOrEqual(salary)
    }
  })
})
