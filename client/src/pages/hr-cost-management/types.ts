/**
 * 人事費管理 - 共用型別定義與工具函式
 */

import { localDateISO } from "@/lib/utils"

/** 員工類型 */
export type EmploymentType = "full_time" | "part_time" | "temporary" | "intern" | "contractor"

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "正職",
  part_time: "計時／兼職",
  temporary: "臨時工",
  intern: "工讀生",
  contractor: "約聘／外包",
}

/** 員工資料介面 */
export interface Employee {
  id: number
  employeeName: string
  position?: string
  monthlySalary: string
  insuredSalary?: string
  hireDate: string
  terminationDate?: string
  dependentsCount: number
  voluntaryPensionRate: string
  isActive: boolean
  hasInsurance: boolean // 是否投保勞健保
  employmentType: EmploymentType
  hourlyRate?: string // 時薪（計時人員）
  monthlyHours?: string // 每月平均工時（計時人員）
  notes?: string
}

/** 月度人事費介面 */
export interface MonthlyHrCost {
  id: number
  year: number
  month: number
  employeeId: number
  baseSalary: string
  employerTotal: string
  employeeTotal: string
  netSalary: string
  totalCost: string
  isPaid: boolean
  insurancePaid: boolean
  employee?: Employee
}

/** 員工表單資料介面 */
export interface EmployeeFormData {
  employeeName: string
  position: string
  monthlySalary: string
  insuredSalary: string
  hireDate: string
  dependentsCount: string
  voluntaryPensionRate: string
  hasInsurance: boolean
  employmentType: EmploymentType
  hourlyRate: string
  monthlyHours: string
  notes: string
}

/** 月度費用彙總介面 */
export interface MonthTotal {
  salary: number
  employerCost: number
  totalCost: number
}

/** 建立空白表單資料 */
export const createEmptyFormData = (): EmployeeFormData => ({
  employeeName: "",
  position: "",
  monthlySalary: "",
  insuredSalary: "",
  hireDate: localDateISO(),
  dependentsCount: "0",
  voluntaryPensionRate: "0",
  hasInsurance: true,
  employmentType: "full_time",
  hourlyRate: "",
  monthlyHours: "",
  notes: "",
})

/** 格式化金額為千位分隔格式 */
export const formatCurrency = (value: string | number | null | undefined): string => {
  const num = parseFloat(String(value ?? "0"))
  return isNaN(num) ? "0" : Math.round(num).toLocaleString()
}
