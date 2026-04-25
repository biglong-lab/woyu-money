/**
 * 收入預估與現金流缺口分析（第 9 步）
 *
 * 基於民宿歷史月度營收，推算未來 N 個月收入；
 * 結合預估支出，輸出缺口月份 + 行動建議（超前部署）。
 */

export interface MonthlyRevenue {
  year: number
  month: number // 1-12
  amount: number
}

export interface MonthlyExpense {
  year: number
  month: number
  amount: number
}

export type ForecastBasis =
  | "last_year_same_month"
  | "recent_average"
  | "overall_average"
  | "no_data"

export type ForecastConfidence = "high" | "medium" | "low"

export interface ForecastMonth {
  year: number
  month: number
  estimated: number
  basis: ForecastBasis
  confidence: ForecastConfidence
}

export interface TrendInfo {
  growthRate: number
  recentAvg: number
  lastYearAvg: number
}

export interface ForecastResult {
  months: ForecastMonth[]
  trend: TrendInfo
}

export interface GapAnalysis {
  year: number
  month: number
  estimatedIncome: number
  estimatedExpense: number
  net: number
  gap?: number
  recommendation?: string
  /** 該月開銷是否為「大額月」（> 12 個月平均 × 1.5） */
  isHighExpense?: boolean
  /** 該月開銷與平均的比例（例：1.8 = 比平均高 80%） */
  expenseRatio?: number
  /** 預估依據說明（給前端顯示用） */
  basisLabel?: string
}

// ─────────────────────────────────────────────
// 輔助
// ─────────────────────────────────────────────

function keyOf(year: number, month: number): string {
  return `${year}-${month}`
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function calcGrowthRate(sortedHistory: MonthlyRevenue[]): number {
  if (sortedHistory.length < 4) return 0
  const n = sortedHistory.length
  const half = Math.floor(n / 2)
  const older = sortedHistory.slice(0, half).map((r) => r.amount)
  const recent = sortedHistory.slice(n - half).map((r) => r.amount)
  const olderAvg = average(older)
  const recentAvg = average(recent)
  if (olderAvg <= 0) return 0
  return recentAvg / olderAvg - 1
}

// ─────────────────────────────────────────────
// 預估
// ─────────────────────────────────────────────

interface HistoryIndex {
  map: Map<string, number>
  sorted: MonthlyRevenue[]
  recentAvg: number
  overallAvg: number
  growthRate: number
  lastYearAvg: number
}

function buildHistoryIndex(history: MonthlyRevenue[]): HistoryIndex {
  const sorted = [...history].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  )
  const map = new Map<string, number>()
  for (const r of sorted) map.set(keyOf(r.year, r.month), r.amount)
  const recent = sorted.slice(-3).map((r) => r.amount)
  const lastYear = sorted.slice(-12).map((r) => r.amount)
  return {
    map,
    sorted,
    recentAvg: average(recent),
    overallAvg: average(sorted.map((r) => r.amount)),
    growthRate: calcGrowthRate(sorted),
    lastYearAvg: average(lastYear),
  }
}

function estimateOneMonth(year: number, month: number, idx: HistoryIndex): ForecastMonth {
  // 1) 去年同月
  const lastYearAmt = idx.map.get(keyOf(year - 1, month))
  if (lastYearAmt !== undefined && lastYearAmt > 0) {
    return {
      year,
      month,
      estimated: Math.round(lastYearAmt * (1 + idx.growthRate)),
      basis: "last_year_same_month",
      confidence: "high",
    }
  }

  // 2) 近期平均
  if (idx.recentAvg > 0) {
    return {
      year,
      month,
      estimated: Math.round(idx.recentAvg),
      basis: "recent_average",
      confidence: "medium",
    }
  }

  // 3) 整體平均
  if (idx.overallAvg > 0) {
    return {
      year,
      month,
      estimated: Math.round(idx.overallAvg),
      basis: "overall_average",
      confidence: "low",
    }
  }

  // 4) 無資料
  return { year, month, estimated: 0, basis: "no_data", confidence: "low" }
}

export function forecastRevenue(
  history: MonthlyRevenue[],
  fromYear: number,
  fromMonth: number,
  monthsAhead: number
): ForecastResult {
  const idx = buildHistoryIndex(history)
  const months: ForecastMonth[] = []
  for (let i = 0; i < monthsAhead; i++) {
    const { year, month } = addMonths(fromYear, fromMonth, i)
    months.push(estimateOneMonth(year, month, idx))
  }
  return {
    months,
    trend: {
      growthRate: Math.round(idx.growthRate * 10000) / 10000,
      recentAvg: Math.round(idx.recentAvg),
      lastYearAvg: Math.round(idx.lastYearAvg),
    },
  }
}

// ─────────────────────────────────────────────
// 缺口分析
// ─────────────────────────────────────────────

function buildRecommendation(gap: number): string {
  if (gap <= 50000) return `建議提前準備現金 NT$ ${Math.round(gap).toLocaleString()}`
  if (gap <= 200000) return `現金缺口較大，建議延後可延款項或催收應收`
  return `缺口嚴重，建議：(1) 提前籌資 (2) 分期談判 (3) 延後非緊急支出`
}

/**
 * 預估依據說明（給前端顯示）
 */
function basisLabel(basis: ForecastBasis): string {
  switch (basis) {
    case "last_year_same_month":
      return "去年同月參考（季節性）"
    case "recent_average":
      return "近 3 個月平均"
    case "overall_average":
      return "全期平均"
    case "no_data":
      return "無歷史資料"
  }
}

export function analyzeCashflowGap(
  forecast: ForecastResult,
  expenses: MonthlyExpense[]
): GapAnalysis[] {
  const expMap = new Map<string, number>()
  for (const e of expenses) expMap.set(keyOf(e.year, e.month), e.amount)

  // ── 計算未來月開銷的平均（用於大額警示）────
  const expectedAmounts = forecast.months.map((fm) => expMap.get(keyOf(fm.year, fm.month)) ?? 0)
  const validExpenses = expectedAmounts.filter((a) => a > 0)
  const avgExpense = validExpenses.length > 0 ? average(validExpenses) : 0
  const HIGH_EXPENSE_RATIO = 1.5 // 超過平均 1.5 倍 = 大額月

  return forecast.months.map((fm) => {
    const estimatedExpense = expMap.get(keyOf(fm.year, fm.month)) ?? 0
    const net = fm.estimated - estimatedExpense
    const expenseRatio = avgExpense > 0 ? estimatedExpense / avgExpense : 0
    const isHighExpense = expenseRatio >= HIGH_EXPENSE_RATIO

    const result: GapAnalysis = {
      year: fm.year,
      month: fm.month,
      estimatedIncome: fm.estimated,
      estimatedExpense,
      net,
      expenseRatio: Math.round(expenseRatio * 100) / 100,
      isHighExpense,
      basisLabel: basisLabel(fm.basis),
    }
    if (net < 0) {
      const gap = -net
      result.gap = gap
      let rec = buildRecommendation(gap)
      if (isHighExpense) {
        rec = `⚠️ 此月為大額支出月（${(expenseRatio * 100).toFixed(0)}% 超平均）。${rec}`
      }
      result.recommendation = rec
    } else if (isHighExpense) {
      result.recommendation = `此月開銷較高（${(expenseRatio * 100).toFixed(0)}% 超平均），收入仍可 cover，但建議留意現金流`
    }
    return result
  })
}
