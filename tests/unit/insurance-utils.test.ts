/**
 * 勞健保計算工具測試
 * 測試實際 insurance-utils 模組的所有導出函數
 */
import { describe, it, expect } from "vitest"
import {
  INSURANCE_RATES,
  LABOR_INSURANCE_GRADES,
  LABOR_MAX_INSURED_SALARY,
  PENSION_MAX_SALARY,
  HEALTH_INSURANCE_GRADES,
  getLaborInsuredSalary,
  getHealthInsuredSalary,
  getPensionSalary,
  calculateInsurance,
  calculateMonthlyHRCostSummary,
  type InsuranceCalculationInput,
} from "@shared/insurance-utils"

describe("INSURANCE_RATES 常數", () => {
  it("勞保費率應為 12%", () => {
    expect(INSURANCE_RATES.laborInsuranceRate).toBe(0.12)
  })

  it("健保費率應為 5.17%", () => {
    expect(INSURANCE_RATES.healthInsuranceRate).toBe(0.0517)
  })

  it("勞退雇主提繳應為 6%", () => {
    expect(INSURANCE_RATES.pensionEmployerRate).toBe(0.06)
  })

  it("雇主 + 員工 + 政府比例應為 100%", () => {
    expect(
      INSURANCE_RATES.laborEmployerRatio +
        INSURANCE_RATES.laborEmployeeRatio +
        INSURANCE_RATES.laborGovRatio
    ).toBeCloseTo(1.0)

    expect(
      INSURANCE_RATES.healthEmployerRatio +
        INSURANCE_RATES.healthEmployeeRatio +
        INSURANCE_RATES.healthGovRatio
    ).toBeCloseTo(1.0)
  })
})

describe("級距表", () => {
  it("勞保級距表應有多個等級", () => {
    expect(LABOR_INSURANCE_GRADES.length).toBeGreaterThan(5)
  })

  it("健保級距表應比勞保更多級距", () => {
    expect(HEALTH_INSURANCE_GRADES.length).toBeGreaterThan(LABOR_INSURANCE_GRADES.length)
  })

  it("勞保最高投保薪資應為 45800", () => {
    expect(LABOR_MAX_INSURED_SALARY).toBe(45800)
  })

  it("勞退最高提繳薪資應為 150000", () => {
    expect(PENSION_MAX_SALARY).toBe(150000)
  })
})

describe("getLaborInsuredSalary", () => {
  it("月薪 25000 應對應投保薪資 27470", () => {
    expect(getLaborInsuredSalary(25000)).toBe(27470)
  })

  it("月薪 30000 應對應投保薪資 30300", () => {
    expect(getLaborInsuredSalary(30000)).toBe(30300)
  })

  it("月薪 35000 應對應投保薪資 36300", () => {
    expect(getLaborInsuredSalary(35000)).toBe(36300)
  })

  it("月薪 45000 應對應投保薪資 45800", () => {
    expect(getLaborInsuredSalary(45000)).toBe(45800)
  })

  it("超過最高級距應返回最高投保薪資", () => {
    expect(getLaborInsuredSalary(60000)).toBe(LABOR_MAX_INSURED_SALARY)
  })

  it("最低薪資應對應最低級距", () => {
    expect(getLaborInsuredSalary(0)).toBe(27470)
  })
})

describe("getHealthInsuredSalary", () => {
  it("月薪 30000 應對應投保薪資 30300", () => {
    expect(getHealthInsuredSalary(30000)).toBe(30300)
  })

  it("月薪 100000 應對應適當級距", () => {
    expect(getHealthInsuredSalary(100000)).toBe(101100)
  })

  it("超高薪資應返回最高級距", () => {
    expect(getHealthInsuredSalary(200000)).toBe(219500)
  })
})

describe("getPensionSalary", () => {
  it("應與健保投保薪資相同", () => {
    expect(getPensionSalary(30000)).toBe(getHealthInsuredSalary(30000))
    expect(getPensionSalary(50000)).toBe(getHealthInsuredSalary(50000))
  })
})

describe("calculateInsurance", () => {
  const baseInput: InsuranceCalculationInput = {
    monthlySalary: 30000,
    dependentsCount: 0,
    voluntaryPensionRate: 0,
  }

  it("應正確計算基本投保薪資", () => {
    const result = calculateInsurance(baseInput)
    expect(result.laborInsuredSalary).toBe(30300)
    expect(result.healthInsuredSalary).toBe(30300)
    expect(result.pensionSalary).toBe(30300)
  })

  it("雇主總負擔應為正數", () => {
    const result = calculateInsurance(baseInput)
    expect(result.employerTotal).toBeGreaterThan(0)
    expect(result.employerLaborInsurance).toBeGreaterThan(0)
    expect(result.employerHealthInsurance).toBeGreaterThan(0)
    expect(result.employerPension).toBeGreaterThan(0)
    expect(result.employerEmploymentInsurance).toBeGreaterThan(0)
    expect(result.employerAccidentInsurance).toBeGreaterThan(0)
  })

  it("雇主總負擔應等於各項加總", () => {
    const result = calculateInsurance(baseInput)
    expect(result.employerTotal).toBe(
      result.employerLaborInsurance +
        result.employerEmploymentInsurance +
        result.employerAccidentInsurance +
        result.employerHealthInsurance +
        result.employerPension
    )
  })

  it("員工負擔應為正數", () => {
    const result = calculateInsurance(baseInput)
    expect(result.employeeTotal).toBeGreaterThan(0)
    expect(result.employeeLaborInsurance).toBeGreaterThan(0)
    expect(result.employeeHealthInsurance).toBeGreaterThan(0)
  })

  it("無自提時員工勞退應為 0", () => {
    const result = calculateInsurance(baseInput)
    expect(result.employeePension).toBe(0)
  })

  it("自提 6% 時員工勞退應為正數", () => {
    const result = calculateInsurance({
      ...baseInput,
      voluntaryPensionRate: 6,
    })
    expect(result.employeePension).toBeGreaterThan(0)
  })

  it("實領薪資 = 月薪 - 員工負擔", () => {
    const result = calculateInsurance(baseInput)
    expect(result.netSalary).toBe(baseInput.monthlySalary - result.employeeTotal)
  })

  it("公司總成本 = 月薪 + 雇主負擔", () => {
    const result = calculateInsurance(baseInput)
    expect(result.totalCost).toBe(baseInput.monthlySalary + result.employerTotal)
  })

  it("有眷屬時員工健保費應增加", () => {
    const noDep = calculateInsurance({ ...baseInput, dependentsCount: 0 })
    const withDep = calculateInsurance({ ...baseInput, dependentsCount: 2 })
    expect(withDep.employeeHealthInsurance).toBeGreaterThan(noDep.employeeHealthInsurance)
  })

  it("眷屬最多計算 3 人", () => {
    const dep3 = calculateInsurance({ ...baseInput, dependentsCount: 3 })
    const dep5 = calculateInsurance({ ...baseInput, dependentsCount: 5 })
    expect(dep3.employeeHealthInsurance).toBe(dep5.employeeHealthInsurance)
  })

  it("自訂投保薪資應覆蓋自動對應", () => {
    const result = calculateInsurance({
      ...baseInput,
      insuredSalary: 40000,
    })
    expect(result.healthInsuredSalary).toBe(40000)
    expect(result.pensionSalary).toBe(40000)
  })

  it("自訂勞保投保薪資不超過最高限額", () => {
    const result = calculateInsurance({
      ...baseInput,
      insuredSalary: 60000,
    })
    expect(result.laborInsuredSalary).toBe(LABOR_MAX_INSURED_SALARY)
  })

  it("自訂職災費率應正確套用", () => {
    const defaultResult = calculateInsurance(baseInput)
    const customRate = calculateInsurance({
      ...baseInput,
      occupationalAccidentRate: 0.005,
    })
    expect(customRate.employerAccidentInsurance).toBeGreaterThan(
      defaultResult.employerAccidentInsurance
    )
  })
})

describe("calculateMonthlyHRCostSummary", () => {
  it("空員工清單應返回全零", () => {
    const result = calculateMonthlyHRCostSummary([])
    expect(result.employeeCount).toBe(0)
    expect(result.totalSalary).toBe(0)
    expect(result.totalEmployerCost).toBe(0)
    expect(result.totalEmployeeCost).toBe(0)
    expect(result.totalCompanyCost).toBe(0)
  })

  it("單人彙總應與個人計算一致", () => {
    const input: InsuranceCalculationInput = {
      monthlySalary: 35000,
      dependentsCount: 1,
      voluntaryPensionRate: 3,
    }
    const individual = calculateInsurance(input)
    const summary = calculateMonthlyHRCostSummary([input])

    expect(summary.employeeCount).toBe(1)
    expect(summary.totalSalary).toBe(35000)
    expect(summary.totalEmployerCost).toBe(individual.employerTotal)
    expect(summary.totalCompanyCost).toBe(individual.totalCost)
  })

  it("多人彙總應正確加總", () => {
    const employees: InsuranceCalculationInput[] = [
      { monthlySalary: 30000, dependentsCount: 0, voluntaryPensionRate: 0 },
      { monthlySalary: 40000, dependentsCount: 1, voluntaryPensionRate: 3 },
      { monthlySalary: 50000, dependentsCount: 2, voluntaryPensionRate: 6 },
    ]
    const summary = calculateMonthlyHRCostSummary(employees)

    expect(summary.employeeCount).toBe(3)
    expect(summary.totalSalary).toBe(120000)
    expect(summary.totalCompanyCost).toBeGreaterThan(120000)
  })
})
