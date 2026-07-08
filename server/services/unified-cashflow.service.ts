/**
 * 統一現金流匯總層 — 純函式 service（2026-07-08）
 *
 * 背景：系統有四套獨立帳本，但只有 payment_records 進統一財報：
 * - enforcement_installment_payments（強執分期繳款）
 * - legacy_debt_payments（歷史欠款還款）
 * - card_claims settled（信用卡請款到帳，屬流入、僅供參考對照）
 *
 * 本層把前兩者投影進 現金流量表 / 儀表板 YTD / 現金流預測，
 * 讓「本月實際付出多少」不再被系統性低估。
 * 卡請款到帳因與 PM 收入（income_webhooks）可能重複計價，
 * 只以參考欄位呈現、不併入總計 — 防雙算。
 */

export interface MonthlyAmount {
  year: number
  month: number
  amount: number
  /** 該月筆數（月度彙總查詢附帶、合併投影時不保證存在） */
  count?: number
}

/** 給現金流量表的統一營業活動項目 */
export interface StatementItem {
  category: string
  amount: number
}

export const ENFORCEMENT_CATEGORY = "強制執行繳款"
export const LEGACY_DEBT_CATEGORY = "歷史欠款還款"

// ─────────────────────────────────────────────
// 強執分期未來月投影（給現金流預測）
// ─────────────────────────────────────────────

export interface ActiveInstallmentProjection {
  monthlyAmount: number
  /** 總期數（null = 未定 → 投影到視窗結束） */
  periods: number | null
  /** 已繳期數（有繳款紀錄的月份數） */
  paidCount: number
  /** 開始日 YYYY-MM-DD（null = 已開始） */
  startDate: string | null
}

/**
 * 把 active 強執分期投影成未來 monthsAhead 個月的月度支出。
 * 從 (fromYear, fromMonth) 起算（含當月），有期數者只投影剩餘期數。
 */
export function projectEnforcementMonthly(
  installments: ActiveInstallmentProjection[],
  fromYear: number,
  fromMonth: number,
  monthsAhead: number
): MonthlyAmount[] {
  const byMonth = new Map<string, MonthlyAmount>()

  for (const inst of installments) {
    const remaining = inst.periods === null ? Infinity : Math.max(0, inst.periods - inst.paidCount)
    if (remaining <= 0 || inst.monthlyAmount <= 0) continue

    // 開始月（未來才開始的分期，從開始月投影）
    let startYear = fromYear
    let startMonthIdx = fromMonth - 1
    if (inst.startDate) {
      const [sy, sm] = inst.startDate.split("-").map(Number)
      const startsAfter = sy > fromYear || (sy === fromYear && sm > fromMonth)
      if (startsAfter) {
        startYear = sy
        startMonthIdx = sm - 1
      }
    }

    let projected = 0
    for (let offset = 0; offset < monthsAhead; offset++) {
      if (projected >= remaining) break
      const d = new Date(fromYear, fromMonth - 1 + offset, 1)
      const beforeStart =
        d.getFullYear() < startYear ||
        (d.getFullYear() === startYear && d.getMonth() < startMonthIdx)
      if (beforeStart) continue

      const key = `${d.getFullYear()}-${d.getMonth() + 1}`
      const entry = byMonth.get(key) ?? {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        amount: 0,
      }
      entry.amount += inst.monthlyAmount
      byMonth.set(key, entry)
      projected++
    }
  }

  return sortMonthly(Array.from(byMonth.values()))
}

// ─────────────────────────────────────────────
// 多來源月度金額合併
// ─────────────────────────────────────────────

/** 合併多個月度金額清單：同 (year, month) 加總、依年月排序 */
export function mergeMonthlyAmounts(...lists: MonthlyAmount[][]): MonthlyAmount[] {
  const byMonth = new Map<string, MonthlyAmount>()
  for (const list of lists) {
    for (const m of list) {
      const key = `${m.year}-${m.month}`
      const entry = byMonth.get(key)
      if (entry) {
        byMonth.set(key, { ...entry, amount: entry.amount + m.amount })
      } else {
        byMonth.set(key, { ...m })
      }
    }
  }
  return sortMonthly(Array.from(byMonth.values()))
}

function sortMonthly(list: MonthlyAmount[]): MonthlyAmount[] {
  return list.sort((a, b) => a.year - b.year || a.month - b.month)
}

// ─────────────────────────────────────────────
// 現金流量表營業活動組裝
// ─────────────────────────────────────────────

export interface UnifiedOperatingInput {
  baseIncome: number
  baseExpense: number
  enforcementPaid: number
  legacyDebtPaid: number
}

/**
 * 營業活動 = 原收入/支出 + 強執繳款 + 欠款還款（各自獨立負項、金額 0 不列）。
 * 卡請款到帳不在此處 — 由呼叫端以 reference 欄位另行呈現，避免與 PM 收入雙算。
 */
export function buildUnifiedOperating(input: UnifiedOperatingInput): {
  items: StatementItem[]
  total: number
} {
  const items: StatementItem[] = [
    { category: "營業收入", amount: input.baseIncome },
    { category: "營業支出", amount: -input.baseExpense },
  ]
  if (input.enforcementPaid > 0) {
    items.push({ category: ENFORCEMENT_CATEGORY, amount: -input.enforcementPaid })
  }
  if (input.legacyDebtPaid > 0) {
    items.push({ category: LEGACY_DEBT_CATEGORY, amount: -input.legacyDebtPaid })
  }
  const total = items.reduce((s, i) => s + i.amount, 0)
  return { items, total }
}
