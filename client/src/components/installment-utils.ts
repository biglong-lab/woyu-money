// 分期付款管理共用工具函式

import type {
  PaymentItem,
  AnalyzedInstallmentItem,
  InstallmentStats,
  PaymentCalculation,
} from "./installment-types"
import { localDateISO } from "@/lib/utils"

/**
 * 分析單一分期項目，計算期數進度、金額、狀態等
 */
export function analyzeInstallmentItem(item: PaymentItem): AnalyzedInstallmentItem {
  // 從項目名稱解析分期資訊
  const installmentMatch = item.itemName.match(/第(\d+)期\/共(\d+)期/)
  const currentPeriod = installmentMatch ? parseInt(installmentMatch[1]) : 1
  const totalPeriods = installmentMatch ? parseInt(installmentMatch[2]) : 1

  // 提取基本專案名稱
  const baseName = item.itemName.replace(/\s*\(第\d+期\/共\d+期\)/, "")

  // 使用 startDate 計算正確到期日
  const startDateValue = item.startDate || localDateISO()
  const dueDate = new Date(startDateValue)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  dueDate.setHours(0, 0, 0, 0)

  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // 付款狀態計算
  const paidAmount = parseFloat(item.paidAmount || "0")
  const totalAmount = parseFloat(item.totalAmount || "0")
  const remainingAmount = totalAmount - paidAmount
  const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0
  const isPaid = progress >= 100

  // 狀態判斷
  const isOverdue = !isPaid && daysUntilDue < 0
  const isDueSoon = !isPaid && daysUntilDue >= 0 && daysUntilDue <= 7

  // 從備註解析專案總額
  const notesMatch = item.notes?.match(/總費用\s*=\s*([\d,]+)/)
  const projectTotalAmount = notesMatch
    ? parseInt(notesMatch[1].replace(/,/g, ""))
    : totalAmount * totalPeriods

  // 計算期數進度
  const periodProgress = (currentPeriod / totalPeriods) * 100
  const paidPeriods = isPaid ? currentPeriod : Math.max(0, currentPeriod - 1)
  const remainingPeriods = totalPeriods - paidPeriods

  // 每期金額
  const monthlyAmount = totalAmount
  const averageMonthlyAmount = projectTotalAmount / totalPeriods

  return {
    ...item,
    currentPeriod,
    totalPeriods,
    baseName,
    dueDate,
    daysUntilDue,
    paidAmount,
    totalAmount,
    remainingAmount,
    progress,
    periodProgress,
    isPaid,
    isOverdue,
    isDueSoon,
    projectTotalAmount,
    paidPeriods,
    remainingPeriods,
    monthlyAmount,
    averageMonthlyAmount,
    status: isPaid ? "paid" : isOverdue ? "overdue" : isDueSoon ? "due-soon" : "normal",
  }
}

/**
 * 計算分期付款統計資料
 */
export function calculateInstallmentStats(paymentItems: PaymentItem[]): InstallmentStats {
  const installmentItems = paymentItems.filter((item) => item.paymentType === "installment")
  const total = installmentItems.length

  const today = new Date()

  let dueSoon = 0
  let overdue = 0
  let completed = 0
  let totalAmount = 0
  let paidAmount = 0

  installmentItems.forEach((item) => {
    const dueDate = new Date(item.dueDate)
    const isPaid = parseFloat(item.paidAmount || "0") >= parseFloat(item.totalAmount || "0")

    totalAmount += parseFloat(item.totalAmount || "0")
    paidAmount += parseFloat(item.paidAmount || "0")

    if (isPaid) {
      completed++
    } else {
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      if (daysUntilDue < 0) {
        overdue++
      } else if (daysUntilDue <= 7) {
        dueSoon++
      }
    }
  })

  const averageProgress = total > 0 ? (paidAmount / totalAmount) * 100 : 0

  return {
    total,
    dueSoon,
    overdue,
    completed,
    totalAmount,
    paidAmount,
    remainingAmount: totalAmount - paidAmount,
    averageProgress: Math.round(averageProgress * 10) / 10,
  }
}

/**
 * 分期付款計算邏輯（頭期含零頭）
 */
export function calculateInstallmentPayments(
  totalAmount: number,
  months: number
): PaymentCalculation {
  if (!totalAmount || !months || months <= 0) {
    return { monthlyAmount: 0, firstPayment: 0, calculations: [] }
  }

  const monthlyAmount = Math.floor(totalAmount / months)
  const remainder = totalAmount - monthlyAmount * months
  const firstPayment = monthlyAmount + remainder

  const calculations = []
  for (let i = 1; i <= months; i++) {
    calculations.push({
      period: i,
      amount: i === 1 ? firstPayment : monthlyAmount,
      type: i === 1 ? "頭期（含零頭）" : "一般期數",
    })
  }

  return { monthlyAmount, firstPayment, calculations }
}

/**
 * 反向推算：由「總金額 + 每期金額」推算期數。
 * 期數 = 無條件進位(總額 / 每期額)，零頭併入首期 (與 calculateInstallmentPayments 一致)。
 */
export function monthsFromMonthlyAmount(totalAmount: number, monthlyAmount: number): number {
  if (!totalAmount || !monthlyAmount || monthlyAmount <= 0) return 0
  return Math.max(1, Math.ceil(totalAmount / monthlyAmount))
}

/**
 * 由「首期日期 + 期數」推算最終期日期 (YYYY-MM-DD)。
 * 每期間隔一個月，末期 = 首期 + (期數 - 1) 個月。
 */
export function finalMonthFromStart(startDateISO: string, months: number): string {
  if (!startDateISO || !months || months <= 0) return ""
  const d = new Date(startDateISO)
  d.setMonth(d.getMonth() + (months - 1))
  return d.toISOString().split("T")[0]
}

/**
 * 反向推算：由「首期日期 + 末期日期」推算期數 (含頭尾，逐月)。
 * 例：2026-01 ~ 2026-12 = 12 期。
 */
export function monthsBetweenInclusive(startDateISO: string, endDateISO: string): number {
  if (!startDateISO || !endDateISO) return 0
  const s = new Date(startDateISO)
  const e = new Date(endDateISO)
  const diff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1
  return Math.max(0, diff)
}

/**
 * 計算付款進度百分比
 */
export function calculateProgress(item: PaymentItem): number {
  const paid = parseFloat(item.paidAmount) || 0
  const total = parseFloat(item.totalAmount) || 0
  return total > 0 ? (paid / total) * 100 : 0
}
