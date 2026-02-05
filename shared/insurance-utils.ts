/**
 * 勞健保計算工具（前後端共用）
 * 依據台灣 2025 年勞保/健保/勞退費率計算
 *
 * 費率說明：
 * - 勞保費率：12%（含就業保險 1%）
 *   - 雇主 70%、勞工 20%、政府 10%
 * - 健保費率：5.17%
 *   - 雇主 60%、勞工 30%、政府 10%
 *   - 雇主平均眷口數 0.57（含員工本人共 1.57）
 * - 勞退：雇主強制提繳 6%
 * - 職災保險：依行業別 0.04%~0.92%，民宿業約 0.16%
 */

// 費率常數（2025年度）
export const INSURANCE_RATES = {
  // 勞保
  laborInsuranceRate: 0.12,         // 勞保費率 12%（含就業保險）
  laborEmployerRatio: 0.7,          // 雇主負擔 70%
  laborEmployeeRatio: 0.2,          // 員工負擔 20%
  laborGovRatio: 0.1,               // 政府負擔 10%

  // 就業保險
  employmentInsuranceRate: 0.01,    // 就業保險費率 1%
  employmentEmployerRatio: 0.7,
  employmentEmployeeRatio: 0.2,

  // 普通事故保費率（勞保扣除就業保險）
  ordinaryAccidentRate: 0.11,       // 11%

  // 健保
  healthInsuranceRate: 0.0517,      // 健保費率 5.17%
  healthEmployerRatio: 0.6,         // 雇主負擔 60%
  healthEmployeeRatio: 0.3,         // 員工負擔 30%
  healthGovRatio: 0.1,              // 政府負擔 10%
  healthEmployerAvgDependents: 1.57, // 雇主負擔平均眷口數（含本人）

  // 勞退
  pensionEmployerRate: 0.06,        // 雇主提繳 6%

  // 職災保險（民宿/旅館業預設費率）
  occupationalAccidentRate: 0.0016, // 0.16%
} as const;

// 勞保投保薪資級距表（2025年）
export const LABOR_INSURANCE_GRADES = [
  { min: 0,     max: 27470,  insuredSalary: 27470 },
  { min: 27471, max: 28800,  insuredSalary: 28800 },
  { min: 28801, max: 30300,  insuredSalary: 30300 },
  { min: 30301, max: 31800,  insuredSalary: 31800 },
  { min: 31801, max: 33300,  insuredSalary: 33300 },
  { min: 33301, max: 34800,  insuredSalary: 34800 },
  { min: 34801, max: 36300,  insuredSalary: 36300 },
  { min: 36301, max: 38200,  insuredSalary: 38200 },
  { min: 38201, max: 40100,  insuredSalary: 40100 },
  { min: 40101, max: 42000,  insuredSalary: 42000 },
  { min: 42001, max: 43900,  insuredSalary: 43900 },
  { min: 43901, max: 45800,  insuredSalary: 45800 },
] as const;

// 勞保最高投保薪資
export const LABOR_MAX_INSURED_SALARY = 45800;

// 勞退提繳分級表最高級距
export const PENSION_MAX_SALARY = 150000;

// 健保投保薪資級距表（2025年）— 簡化版，常見級距
export const HEALTH_INSURANCE_GRADES = [
  { min: 0,     max: 27470,  insuredSalary: 27470 },
  { min: 27471, max: 28800,  insuredSalary: 28800 },
  { min: 28801, max: 30300,  insuredSalary: 30300 },
  { min: 30301, max: 31800,  insuredSalary: 31800 },
  { min: 31801, max: 33300,  insuredSalary: 33300 },
  { min: 33301, max: 34800,  insuredSalary: 34800 },
  { min: 34801, max: 36300,  insuredSalary: 36300 },
  { min: 36301, max: 38200,  insuredSalary: 38200 },
  { min: 38201, max: 40100,  insuredSalary: 40100 },
  { min: 40101, max: 42000,  insuredSalary: 42000 },
  { min: 42001, max: 43900,  insuredSalary: 43900 },
  { min: 43901, max: 45800,  insuredSalary: 45800 },
  { min: 45801, max: 48200,  insuredSalary: 48200 },
  { min: 48201, max: 50600,  insuredSalary: 50600 },
  { min: 50601, max: 53000,  insuredSalary: 53000 },
  { min: 53001, max: 55400,  insuredSalary: 55400 },
  { min: 55401, max: 57800,  insuredSalary: 57800 },
  { min: 57801, max: 60800,  insuredSalary: 60800 },
  { min: 60801, max: 63800,  insuredSalary: 63800 },
  { min: 63801, max: 66800,  insuredSalary: 66800 },
  { min: 66801, max: 69800,  insuredSalary: 69800 },
  { min: 69801, max: 72800,  insuredSalary: 72800 },
  { min: 72801, max: 76500,  insuredSalary: 76500 },
  { min: 76501, max: 80200,  insuredSalary: 80200 },
  { min: 80201, max: 83900,  insuredSalary: 83900 },
  { min: 83901, max: 87600,  insuredSalary: 87600 },
  { min: 87601, max: 92100,  insuredSalary: 92100 },
  { min: 92101, max: 96600,  insuredSalary: 96600 },
  { min: 96601, max: 101100, insuredSalary: 101100 },
  { min: 101101, max: 105600, insuredSalary: 105600 },
  { min: 105601, max: 110100, insuredSalary: 110100 },
  { min: 110101, max: 115500, insuredSalary: 115500 },
  { min: 115501, max: 120900, insuredSalary: 120900 },
  { min: 120901, max: 126300, insuredSalary: 126300 },
  { min: 126301, max: 131700, insuredSalary: 131700 },
  { min: 131701, max: 137100, insuredSalary: 137100 },
  { min: 137101, max: 142500, insuredSalary: 142500 },
  { min: 142501, max: 147900, insuredSalary: 147900 },
  { min: 147901, max: 150000, insuredSalary: 150000 },
  { min: 150001, max: 175600, insuredSalary: 175600 },
  { min: 175601, max: 999999, insuredSalary: 219500 },
] as const;

// 根據月薪查找勞保投保薪資
export function getLaborInsuredSalary(monthlySalary: number): number {
  const grade = LABOR_INSURANCE_GRADES.find(
    (g) => monthlySalary >= g.min && monthlySalary <= g.max
  );
  return grade ? grade.insuredSalary : LABOR_MAX_INSURED_SALARY;
}

// 根據月薪查找健保投保薪資
export function getHealthInsuredSalary(monthlySalary: number): number {
  const grade = HEALTH_INSURANCE_GRADES.find(
    (g) => monthlySalary >= g.min && monthlySalary <= g.max
  );
  return grade ? grade.insuredSalary : 219500;
}

// 根據月薪查找勞退提繳薪資
export function getPensionSalary(monthlySalary: number): number {
  // 勞退提繳薪資分級表與健保相同
  return getHealthInsuredSalary(monthlySalary);
}

// 計算結果介面
export interface InsuranceCalculationResult {
  // 投保薪資
  laborInsuredSalary: number;
  healthInsuredSalary: number;
  pensionSalary: number;

  // 雇主負擔
  employerLaborInsurance: number;      // 雇主勞保費
  employerHealthInsurance: number;     // 雇主健保費
  employerPension: number;             // 雇主勞退
  employerEmploymentInsurance: number; // 雇主就業保險
  employerAccidentInsurance: number;   // 雇主職災保險
  employerTotal: number;               // 雇主總負擔

  // 員工負擔
  employeeLaborInsurance: number;
  employeeHealthInsurance: number;
  employeePension: number;             // 員工自提勞退
  employeeTotal: number;

  // 實際
  netSalary: number;                   // 員工實領
  totalCost: number;                   // 公司總成本（薪資 + 雇主負擔）
}

// 計算輸入介面
export interface InsuranceCalculationInput {
  monthlySalary: number;               // 實際月薪
  insuredSalary?: number;              // 自訂投保薪資（可選，預設依級距自動對應）
  dependentsCount: number;             // 眷屬人數（0-3）
  voluntaryPensionRate: number;        // 自提勞退比例（0-6%）
  occupationalAccidentRate?: number;   // 職災費率（可選，預設民宿業）
}

// 計算勞健保費用
export function calculateInsurance(
  input: InsuranceCalculationInput
): InsuranceCalculationResult {
  const {
    monthlySalary,
    dependentsCount,
    voluntaryPensionRate,
    occupationalAccidentRate = INSURANCE_RATES.occupationalAccidentRate,
  } = input;

  // 確定投保薪資
  const laborInsuredSalary = input.insuredSalary
    ? Math.min(input.insuredSalary, LABOR_MAX_INSURED_SALARY)
    : getLaborInsuredSalary(monthlySalary);

  const healthInsuredSalary = input.insuredSalary
    ? input.insuredSalary
    : getHealthInsuredSalary(monthlySalary);

  const pensionSalary = input.insuredSalary
    ? input.insuredSalary
    : getPensionSalary(monthlySalary);

  // === 雇主負擔 ===

  // 勞保費（普通事故）= 投保薪資 x 普通事故費率 x 雇主比例
  const employerLaborInsurance = Math.round(
    laborInsuredSalary *
      INSURANCE_RATES.ordinaryAccidentRate *
      INSURANCE_RATES.laborEmployerRatio
  );

  // 就業保險費 = 投保薪資 x 就業保險費率 x 雇主比例
  const employerEmploymentInsurance = Math.round(
    laborInsuredSalary *
      INSURANCE_RATES.employmentInsuranceRate *
      INSURANCE_RATES.employmentEmployerRatio
  );

  // 職災保險費 = 投保薪資 x 職災費率（雇主全額負擔）
  const employerAccidentInsurance = Math.round(
    laborInsuredSalary * occupationalAccidentRate
  );

  // 健保費（雇主）= 投保薪資 x 健保費率 x 雇主比例 x 平均眷口數
  const employerHealthInsurance = Math.round(
    healthInsuredSalary *
      INSURANCE_RATES.healthInsuranceRate *
      INSURANCE_RATES.healthEmployerRatio *
      INSURANCE_RATES.healthEmployerAvgDependents
  );

  // 勞退（雇主 6%）
  const employerPension = Math.round(
    pensionSalary * INSURANCE_RATES.pensionEmployerRate
  );

  const employerTotal =
    employerLaborInsurance +
    employerEmploymentInsurance +
    employerAccidentInsurance +
    employerHealthInsurance +
    employerPension;

  // === 員工負擔 ===

  // 勞保費（員工）= 投保薪資 x 普通事故費率 x 員工比例
  const employeeLaborInsurance = Math.round(
    laborInsuredSalary *
      INSURANCE_RATES.ordinaryAccidentRate *
      INSURANCE_RATES.laborEmployeeRatio
  );

  // 就業保險費（員工）
  const employeeEmploymentInsurance = Math.round(
    laborInsuredSalary *
      INSURANCE_RATES.employmentInsuranceRate *
      INSURANCE_RATES.employmentEmployeeRatio
  );

  // 健保費（員工）= 投保薪資 x 健保費率 x 員工比例 x (本人+眷屬數)
  const healthDependentsMultiplier = 1 + Math.min(dependentsCount, 3);
  const employeeHealthInsurance = Math.round(
    healthInsuredSalary *
      INSURANCE_RATES.healthInsuranceRate *
      INSURANCE_RATES.healthEmployeeRatio *
      healthDependentsMultiplier
  );

  // 員工自提勞退
  const voluntaryRate = Math.min(voluntaryPensionRate, 6) / 100;
  const employeePension = Math.round(pensionSalary * voluntaryRate);

  const employeeTotal =
    employeeLaborInsurance +
    employeeEmploymentInsurance +
    employeeHealthInsurance +
    employeePension;

  // 員工實領 = 月薪 - 員工負擔
  const netSalary = monthlySalary - employeeTotal;

  // 公司總成本 = 月薪 + 雇主負擔
  const totalCost = monthlySalary + employerTotal;

  return {
    laborInsuredSalary,
    healthInsuredSalary,
    pensionSalary,
    employerLaborInsurance,
    employerHealthInsurance,
    employerPension,
    employerEmploymentInsurance,
    employerAccidentInsurance,
    employerTotal,
    employeeLaborInsurance,
    employeeHealthInsurance,
    employeePension,
    employeeTotal,
    netSalary,
    totalCost,
  };
}

// 計算多位員工的月度人事費彙總
export function calculateMonthlyHRCostSummary(
  employees: InsuranceCalculationInput[]
): {
  totalSalary: number;
  totalEmployerCost: number;
  totalEmployeeCost: number;
  totalCompanyCost: number;
  employeeCount: number;
} {
  const results = employees.map(calculateInsurance);

  return {
    totalSalary: employees.reduce((sum, e) => sum + e.monthlySalary, 0),
    totalEmployerCost: results.reduce((sum, r) => sum + r.employerTotal, 0),
    totalEmployeeCost: results.reduce((sum, r) => sum + r.employeeTotal, 0),
    totalCompanyCost: results.reduce((sum, r) => sum + r.totalCost, 0),
    employeeCount: employees.length,
  };
}
