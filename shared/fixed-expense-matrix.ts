/**
 * 固定開銷月度矩陣（前後端共用純函式）
 *
 * 模型仿租金矩陣：週期性支出模板 × 12 月
 * - 預算列：模板 estimatedAmount（成本預估、固定金額），僅在 activeMonths 計入
 * - 實際列：該月實際付款單據金額（payment_records 已付）
 * - 差異：實際 − 預算（正=超支、負=結餘）
 *
 * 可依類別篩選或全部一起看。
 */

export interface FixedExpenseTemplateInfo {
  id: number
  templateName: string
  categoryId: number | null
  categoryName?: string | null
  estimatedAmount: number
  activeMonths: string // '*' 或 '1,3,6,9'
}

export interface ActualPayment {
  templateId: number
  month: number // 1-12（依實際付款日）
  amount: number
}

export interface FixedMatrixCell {
  templateId: number
  month: number
  budget: number
  actual: number
  diff: number // actual - budget
  active: boolean // 該月是否為預算月
}

export interface FixedExpenseMatrix {
  year: number
  months: number[]
  templates: FixedExpenseTemplateInfo[]
  cells: FixedMatrixCell[]
  totals: {
    budget: number
    actual: number
    diff: number
    overBudgetCount: number // 超支格數
  }
  // 每月縱向小計（方便看當月固定開銷總額）
  monthlyTotals: Array<{ month: number; budget: number; actual: number }>
}

// 解析 activeMonths：'*' = 全部 12 月；'1,3,6' = 指定月份集合
export function parseActiveMonths(raw: string): Set<number> {
  const trimmed = (raw ?? "*").trim()
  if (trimmed === "*" || trimmed === "") {
    return new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  }
  return new Set(
    trimmed
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => n >= 1 && n <= 12)
  )
}

export function buildFixedExpenseMatrix(
  year: number,
  templates: FixedExpenseTemplateInfo[],
  payments: ActualPayment[]
): FixedExpenseMatrix {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

  // 索引實際付款：templateId|month → 金額加總
  const actualMap = new Map<string, number>()
  for (const p of payments) {
    const key = `${p.templateId}|${p.month}`
    actualMap.set(key, (actualMap.get(key) ?? 0) + p.amount)
  }

  const cells: FixedMatrixCell[] = []
  const monthlyTotals = months.map((m) => ({ month: m, budget: 0, actual: 0 }))
  let totalBudget = 0
  let totalActual = 0
  let overBudgetCount = 0

  for (const t of templates) {
    const activeSet = parseActiveMonths(t.activeMonths)
    for (const month of months) {
      const active = activeSet.has(month)
      const budget = active ? t.estimatedAmount : 0
      const actual = actualMap.get(`${t.id}|${month}`) ?? 0
      const diff = actual - budget
      cells.push({ templateId: t.id, month, budget, actual, diff, active })

      totalBudget += budget
      totalActual += actual
      if (actual > budget && budget > 0) overBudgetCount++

      const mt = monthlyTotals[month - 1]
      mt.budget += budget
      mt.actual += actual
    }
  }

  return {
    year,
    months,
    templates,
    cells,
    totals: {
      budget: totalBudget,
      actual: totalActual,
      diff: totalActual - totalBudget,
      overBudgetCount,
    },
    monthlyTotals,
  }
}
