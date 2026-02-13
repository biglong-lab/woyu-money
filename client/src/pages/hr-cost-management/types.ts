/**
 * 人事費管理 - 共用型別定義與工具函式
 */

/** 員工資料介面 */
export interface Employee {
  id: number;
  employeeName: string;
  position?: string;
  monthlySalary: string;
  insuredSalary?: string;
  hireDate: string;
  terminationDate?: string;
  dependentsCount: number;
  voluntaryPensionRate: string;
  isActive: boolean;
  notes?: string;
}

/** 月度人事費介面 */
export interface MonthlyHrCost {
  id: number;
  year: number;
  month: number;
  employeeId: number;
  baseSalary: string;
  employerTotal: string;
  employeeTotal: string;
  netSalary: string;
  totalCost: string;
  isPaid: boolean;
  insurancePaid: boolean;
  employee?: Employee;
}

/** 員工表單資料介面 */
export interface EmployeeFormData {
  employeeName: string;
  position: string;
  monthlySalary: string;
  insuredSalary: string;
  hireDate: string;
  dependentsCount: string;
  voluntaryPensionRate: string;
  notes: string;
}

/** 月度費用彙總介面 */
export interface MonthTotal {
  salary: number;
  employerCost: number;
  totalCost: number;
}

/** 建立空白表單資料 */
export const createEmptyFormData = (): EmployeeFormData => ({
  employeeName: "",
  position: "",
  monthlySalary: "",
  insuredSalary: "",
  hireDate: new Date().toISOString().split("T")[0],
  dependentsCount: "0",
  voluntaryPensionRate: "0",
  notes: "",
});

/** 格式化金額為千位分隔格式 */
export const formatCurrency = (value: string | number | null | undefined): string => {
  const num = parseFloat(String(value ?? "0"));
  return isNaN(num) ? "0" : Math.round(num).toLocaleString();
};
