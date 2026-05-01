/**
 * 預估回沖配對邏輯（PR-1 純函式核心）
 *
 * 目的：付款記錄發生時，找到對應的 budget_item 並更新 actualAmount。
 *
 * 配對策略（先嚴格後寬鬆）：
 *   優先級 1：projectId + fixedCategoryId + month(start_date)
 *   優先級 2：projectId + categoryId + month
 *   優先級 3：projectId + month（同月同館，無分類）
 *   都找不到：返回 null（payment 不阻擋，僅記 log）
 *
 * 重要：
 * - actualAmount 用 SUM 重算（idempotent），不用 +=
 * - 配對是純函式，不直接動 DB（呼叫端自己 update）
 */

export interface PaymentItemForMatch {
  id: number
  projectId: number | null
  fixedCategoryId: number | null
  categoryId: number | null
  startDate: string // YYYY-MM-DD
}

export interface BudgetItemCandidate {
  id: number
  budgetPlanId: number
  fixedCategoryId: number | null
  categoryId: number | null
  targetProjectId: number | null
  startDate: string | null // 該預估所屬月份的第一天 (yyyy-mm-dd)
  attribution: string | null // single | shared | occupancy | company
  plannedAmount: string | null // numeric, decimal
}

export type MatchPriority = "exact" | "category" | "project_month" | "none"

export interface MatchResult {
  budgetItemId: number | null
  priority: MatchPriority
  reason: string
}

// ─────────────────────────────────────────────
// 取月份（yyyy-mm）
// ─────────────────────────────────────────────

function monthKey(dateStr: string): string {
  // 接受 yyyy-mm-dd 或 yyyy-mm-ddTHH:MM:SS
  if (!dateStr || dateStr.length < 7) return ""
  return dateStr.slice(0, 7)
}

// ─────────────────────────────────────────────
// 配對核心邏輯
// ─────────────────────────────────────────────

export function matchBudgetItem(
  paymentItem: PaymentItemForMatch,
  candidates: BudgetItemCandidate[]
): MatchResult {
  const piMonth = monthKey(paymentItem.startDate)
  if (!piMonth || paymentItem.projectId === null) {
    return {
      budgetItemId: null,
      priority: "none",
      reason: "付款項目缺 projectId 或 startDate",
    }
  }

  // 排除 attribution='shared'/'company'（這類不靠 single 配對）
  // 只看 attribution='single' 或 NULL（早期資料）的 budget_items
  const eligible = candidates.filter((c) => {
    if (c.attribution !== null && c.attribution !== "single") return false
    if (c.targetProjectId !== paymentItem.projectId) return false
    if (!c.startDate) return false
    return monthKey(c.startDate) === piMonth
  })

  if (eligible.length === 0) {
    return {
      budgetItemId: null,
      priority: "none",
      reason: `無 budget_item 對應（project=${paymentItem.projectId}, month=${piMonth}）`,
    }
  }

  // 優先級 1：fixedCategoryId 完全相同
  if (paymentItem.fixedCategoryId !== null) {
    const exact = eligible.find((c) => c.fixedCategoryId === paymentItem.fixedCategoryId)
    if (exact) {
      return {
        budgetItemId: exact.id,
        priority: "exact",
        reason: `精準配對：相同 fixedCategoryId=${paymentItem.fixedCategoryId}`,
      }
    }
  }

  // 優先級 2：categoryId 完全相同
  if (paymentItem.categoryId !== null) {
    const matchByCategory = eligible.find((c) => c.categoryId === paymentItem.categoryId)
    if (matchByCategory) {
      return {
        budgetItemId: matchByCategory.id,
        priority: "category",
        reason: `分類配對：相同 categoryId=${paymentItem.categoryId}`,
      }
    }
  }

  // 優先級 3：同 project 同 month 但無分類資訊（單一候選才採用，避免錯配）
  const noCategoryItems = eligible.filter(
    (c) => c.fixedCategoryId === null && c.categoryId === null
  )
  if (noCategoryItems.length === 1) {
    return {
      budgetItemId: noCategoryItems[0].id,
      priority: "project_month",
      reason: `寬鬆配對：同專案同月，且僅有 1 筆無分類預估`,
    }
  }

  return {
    budgetItemId: null,
    priority: "none",
    reason: `候選有 ${eligible.length} 筆但無分類匹配，避免錯配`,
  }
}

// ─────────────────────────────────────────────
// variance 計算（給回沖時用）
// ─────────────────────────────────────────────

export interface VarianceCalc {
  variance: number
  variancePercentage: number
}

/**
 * 計算 variance + variancePercentage
 * - variance = actual - planned（正數 = 超支，負數 = 節省）
 * - variancePercentage = variance / planned * 100（保留 2 位小數）
 */
export function calcVariance(planned: number, actual: number): VarianceCalc {
  const variance = actual - planned
  if (planned === 0) {
    return {
      variance,
      variancePercentage: 0,
    }
  }
  const pct = (variance / planned) * 100
  return {
    variance,
    variancePercentage: Math.round(pct * 100) / 100,
  }
}
