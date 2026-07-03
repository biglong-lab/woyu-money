/**
 * 帳單到期看板 — 純函式 service（自 routes/bills.ts 抽出，2026-07-03）
 *
 * 抽出目的：
 * 1. 強執分期的每月投影含日期邊界邏輯（月底日、跨月），route 內無法單元測試
 * 2. 修正舊版把 day_of_month 一律夾到 28 的失真：
 *    改為「該月實際最後一日」夾限（1/31 → 2 月投影在 2/28 或 2/29、3 月回到 3/31）
 */

export interface BillRow {
  source: string
  refId: number
  name: string
  amount: number
  billIssuedDate: string | null
  dueDate: string | null
  finalDueDate: string | null
  penaltyNote: string | null
  status: string
}

export type BillUrgency = "penalty" | "overdue" | "grace" | "soon" | "upcoming"

export interface ClassifiedBill extends BillRow {
  daysUntil: number
  finalDaysUntil: number | null
  overdue: boolean
  penaltyRisk: boolean
  urgency: BillUrgency
}

interface InstallmentInput {
  refId: number
  name: string
  amount: number
  dayOfMonth: number
}

/** installmentId → { "YYYY-MM": 該月已繳合計 } */
export type InstallmentPaidMap = Map<number, Map<string, number>>

const MS_PER_DAY = 86400000

function toDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00")
}

/** 該月實際天數內的應繳日（處理 29/30/31 在小月的情況） */
export function dueDayInMonth(year: number, monthIndex: number, rawDay: number): number {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const day = Math.max(1, Math.round(rawDay) || 10)
  return Math.min(day, lastDay)
}

/**
 * 強執分期投影：以 today 為基準，投影本月與下月的應繳日
 * 只保留 [-45, +days] 天視窗內的項目（與看板顯示範圍一致）
 *
 * paidByMonth（選填）：該月已繳合計 >= 月付額 → 該月不再投影（已繳足）；
 * 部分繳 → 只投影剩餘金額。讓「立即處理」付款後帳單從看板消失。
 */
export function projectInstallmentDues(
  installments: InstallmentInput[],
  today: string,
  days: number,
  paidByMonth?: InstallmentPaidMap
): BillRow[] {
  const now = toDate(today)
  const out: BillRow[] = []
  for (const inst of installments) {
    for (let offset = 0; offset <= 1; offset++) {
      const year = now.getFullYear()
      const monthIndex = now.getMonth() + offset
      const day = dueDayInMonth(year, monthIndex, inst.dayOfMonth)
      const d = new Date(year, monthIndex, day)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const due = `${monthKey}-${String(d.getDate()).padStart(2, "0")}`
      const diffDays = Math.round((d.getTime() - now.getTime()) / MS_PER_DAY)
      if (diffDays < -45 || diffDays > days) continue

      const paidThisMonth = paidByMonth?.get(inst.refId)?.get(monthKey) ?? 0
      const remaining = Math.round((inst.amount - paidThisMonth) * 100) / 100
      if (remaining <= 0) continue // 該月已繳足

      out.push({
        source: "enforcement_installment",
        refId: inst.refId,
        name: `${inst.name}（強執分期）`,
        amount: remaining,
        billIssuedDate: null,
        dueDate: due,
        finalDueDate: null,
        penaltyNote: null,
        status: "pending",
      })
    }
  }
  return out
}

/**
 * 帳單風險分級 + 排序：
 * - penalty：已過最終必繳日（最嚴重）
 * - grace：過法定付款日但有最終必繳日未過（緩衝期）
 * - overdue：過期且無最終必繳日
 * - soon：7 天內到期
 * - upcoming：其他
 */
export function classifyBills(bills: BillRow[], today: string): ClassifiedBill[] {
  const now = toDate(today)
  const dayDiff = (d: string | null) =>
    d ? Math.round((toDate(d).getTime() - now.getTime()) / MS_PER_DAY) : null

  return bills
    .map((b) => {
      const diff = dayDiff(b.dueDate) ?? 999
      const finalDiff = dayDiff(b.finalDueDate)
      let urgency: BillUrgency
      if (finalDiff !== null && finalDiff < 0) urgency = "penalty"
      else if (diff < 0) urgency = b.finalDueDate ? "grace" : "overdue"
      else if (diff <= 7) urgency = "soon"
      else urgency = "upcoming"
      return {
        ...b,
        daysUntil: diff,
        finalDaysUntil: finalDiff,
        overdue: diff < 0,
        penaltyRisk: urgency === "penalty",
        urgency,
      }
    })
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
}

/** 看板彙總數字 */
export function summarizeBills(bills: ClassifiedBill[]) {
  return {
    count: bills.length,
    totalDue: bills.reduce((s, b) => s + b.amount, 0),
    overdueTotal: bills.filter((b) => b.overdue).reduce((s, b) => s + b.amount, 0),
    penaltyRiskTotal: bills.filter((b) => b.penaltyRisk).reduce((s, b) => s + b.amount, 0),
  }
}
