/**
 * 預估回沖 Hook（PR-1 server side）
 *
 * 提供：
 * - reconcileBudgetItemForPayment(): 單筆付款後呼叫，找對應 budget_item 並回沖
 * - recomputeMonthBudgetActuals(): admin 工具，整月重算所有 budget_items 的 actualAmount
 */

import { sql, eq, and } from "drizzle-orm"
import { db } from "../db"
import { paymentItems, paymentRecords, budgetItems, budgetPlans } from "@shared/schema"
import {
  matchBudgetItem,
  calcVariance,
  type PaymentItemForMatch,
  type BudgetItemCandidate,
  type MatchResult,
} from "@shared/budget-reconcile"

// ─────────────────────────────────────────────
// 取得某月份的所有候選 budget_items
// ─────────────────────────────────────────────

async function getMonthCandidates(
  year: number,
  month: number,
  projectId: number
): Promise<BudgetItemCandidate[]> {
  const rows = await db.execute<{
    id: number
    budget_plan_id: number
    fixed_category_id: number | null
    category_id: number | null
    target_project_id: number | null
    start_date: string | null
    attribution: string | null
    planned_amount: string | null
  }>(sql`
    SELECT
      bi.id,
      bi.budget_plan_id,
      bi.fixed_category_id,
      bi.category_id,
      bi.target_project_id,
      bi.start_date::text,
      bi.attribution,
      bi.planned_amount
    FROM budget_items bi
    WHERE bi.target_project_id = ${projectId}
      AND COALESCE(bi.is_deleted, false) = false
      AND EXTRACT(YEAR FROM bi.start_date)::int = ${year}
      AND EXTRACT(MONTH FROM bi.start_date)::int = ${month}
  `)

  return (
    rows.rows as {
      id: number
      budget_plan_id: number
      fixed_category_id: number | null
      category_id: number | null
      target_project_id: number | null
      start_date: string | null
      attribution: string | null
      planned_amount: string | null
    }[]
  ).map((r) => ({
    id: r.id,
    budgetPlanId: r.budget_plan_id,
    fixedCategoryId: r.fixed_category_id,
    categoryId: r.category_id,
    targetProjectId: r.target_project_id,
    startDate: r.start_date,
    attribution: r.attribution,
    plannedAmount: r.planned_amount,
  }))
}

// ─────────────────────────────────────────────
// 重算單一 budget_item 的 actualAmount
// （SUM 所有對應到此 budget_item 的 payment_records）
// ─────────────────────────────────────────────

interface BudgetItemActuals {
  total: number
}

/**
 * 給定一個 budget_item，計算「所有應對應到它的 payment_records」總額。
 *
 * 演算法：找所有同 (project, month) 的 payment_items（候選），
 *   對每個候選跑 matchBudgetItem，若回傳此 bi.id 才採計其 records 總額。
 * 這樣保證和「即時回沖」用一樣的配對邏輯，不會分歧。
 */
async function computeBudgetItemActual(
  budgetItem: BudgetItemCandidate
): Promise<BudgetItemActuals> {
  if (!budgetItem.startDate || !budgetItem.targetProjectId) {
    return { total: 0 }
  }

  const month = budgetItem.startDate.slice(0, 7)
  const [yearStr, monthStr] = month.split("-")
  const year = parseInt(yearStr)
  const monthNum = parseInt(monthStr)

  // 取該 (project, month) 的所有 payment_items + 它們的 payment_records 總額
  const piRows = await db.execute<{
    id: number
    project_id: number | null
    fixed_category_id: number | null
    category_id: number | null
    start_date: string
    paid_total: string
  }>(sql`
    SELECT
      pi.id,
      pi.project_id,
      pi.fixed_category_id,
      pi.category_id,
      pi.start_date::text,
      COALESCE(SUM(pr.amount_paid::numeric), 0)::text AS paid_total
    FROM payment_items pi
    LEFT JOIN payment_records pr ON pr.payment_item_id = pi.id
    WHERE pi.project_id = ${budgetItem.targetProjectId}
      AND COALESCE(pi.is_deleted, false) = false
      AND EXTRACT(YEAR FROM pi.start_date)::int = ${year}
      AND EXTRACT(MONTH FROM pi.start_date)::int = ${monthNum}
    GROUP BY pi.id
  `)

  // 取同月份所有候選 budget_items（用於配對）
  const candidates = await getMonthCandidates(year, monthNum, budgetItem.targetProjectId)

  let total = 0
  for (const r of piRows.rows as {
    id: number
    project_id: number | null
    fixed_category_id: number | null
    category_id: number | null
    start_date: string
    paid_total: string
  }[]) {
    const paidTotal = Number(r.paid_total)
    if (paidTotal <= 0) continue

    const pi: PaymentItemForMatch = {
      id: r.id,
      projectId: r.project_id,
      fixedCategoryId: r.fixed_category_id,
      categoryId: r.category_id,
      startDate: r.start_date,
    }
    const match = matchBudgetItem(pi, candidates)
    if (match.budgetItemId === budgetItem.id) {
      total += paidTotal
    }
  }
  return { total }
}

// ─────────────────────────────────────────────
// 主要 hook：付款後呼叫，回沖配對的 budget_item
// ─────────────────────────────────────────────

export interface ReconcileResult {
  matched: boolean
  budgetItemId: number | null
  priority: string
  reason: string
  newActualAmount?: number
  newVariance?: number
  newVariancePercentage?: number
}

/**
 * 付款 hook：找對應的 budget_item，重算其 actualAmount 並更新。
 *
 * @param paymentItemId 剛付款的 payment_item id
 * @returns 配對結果（呼叫端可用於 log，不用阻擋付款）
 */
export async function reconcileBudgetItemForPayment(
  paymentItemId: number
): Promise<ReconcileResult> {
  // 1. 取 payment_item 基本資料
  const piRows = await db
    .select({
      id: paymentItems.id,
      projectId: paymentItems.projectId,
      fixedCategoryId: paymentItems.fixedCategoryId,
      categoryId: paymentItems.categoryId,
      startDate: paymentItems.startDate,
    })
    .from(paymentItems)
    .where(eq(paymentItems.id, paymentItemId))
    .limit(1)

  if (piRows.length === 0) {
    return {
      matched: false,
      budgetItemId: null,
      priority: "none",
      reason: "payment_item 不存在",
    }
  }
  const pi = piRows[0]
  if (!pi.projectId || !pi.startDate) {
    return {
      matched: false,
      budgetItemId: null,
      priority: "none",
      reason: "payment_item 缺 projectId 或 startDate",
    }
  }

  const startDateStr = String(pi.startDate)
  const yearStr = startDateStr.slice(0, 4)
  const monthStr = startDateStr.slice(5, 7)
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)

  // 2. 取候選 budget_items
  const candidates = await getMonthCandidates(year, month, pi.projectId)

  // 3. 配對
  const match: MatchResult = matchBudgetItem(
    {
      id: pi.id,
      projectId: pi.projectId,
      fixedCategoryId: pi.fixedCategoryId,
      categoryId: pi.categoryId,
      startDate: startDateStr,
    },
    candidates
  )

  if (match.budgetItemId === null) {
    return {
      matched: false,
      budgetItemId: null,
      priority: match.priority,
      reason: match.reason,
    }
  }

  // 4. 取該 budget_item 完整資料 + 計算 actualAmount
  const budgetItem = candidates.find((c) => c.id === match.budgetItemId)
  if (!budgetItem) {
    return {
      matched: false,
      budgetItemId: null,
      priority: "none",
      reason: "找到的 budget_item 不在候選中（不應發生）",
    }
  }

  const { total: newActual } = await computeBudgetItemActual(budgetItem)
  const planned = Number(budgetItem.plannedAmount ?? "0")
  const { variance, variancePercentage } = calcVariance(planned, newActual)

  // 5. UPDATE budget_item
  await db
    .update(budgetItems)
    .set({
      actualAmount: newActual.toString(),
      variance: variance.toString(),
      variancePercentage: variancePercentage.toString(),
      updatedAt: new Date(),
    })
    .where(eq(budgetItems.id, match.budgetItemId))

  return {
    matched: true,
    budgetItemId: match.budgetItemId,
    priority: match.priority,
    reason: match.reason,
    newActualAmount: newActual,
    newVariance: variance,
    newVariancePercentage: variancePercentage,
  }
}

// ─────────────────────────────────────────────
// Admin 工具：整月重算
// ─────────────────────────────────────────────

export interface RecomputeResult {
  year: number
  month: number
  totalBudgetItems: number
  updated: number
  skipped: number
  details: Array<{
    budgetItemId: number
    itemName: string
    plannedAmount: number
    oldActual: number
    newActual: number
    variance: number
  }>
}

/**
 * 整月重算所有 budget_items 的 actualAmount。
 * 用於：
 * - 歷史資料補回沖
 * - 配對邏輯改動後重新跑
 */
export async function recomputeMonthBudgetActuals(
  year: number,
  month: number
): Promise<RecomputeResult> {
  // 1. 取該月所有 active budget_plans
  const planRows = await db
    .select({ id: budgetPlans.id })
    .from(budgetPlans)
    .where(
      and(
        sql`EXTRACT(YEAR FROM ${budgetPlans.startDate})::int = ${year}`,
        sql`EXTRACT(MONTH FROM ${budgetPlans.startDate})::int = ${month}`,
        sql`COALESCE(${budgetPlans.status}, 'active') = 'active'`
      )
    )

  if (planRows.length === 0) {
    return {
      year,
      month,
      totalBudgetItems: 0,
      updated: 0,
      skipped: 0,
      details: [],
    }
  }

  // 2. 取所有 single attribution 的 budget_items（shared/company 不靠此回沖）
  const planIds = planRows.map((p) => p.id)
  const items = await db.execute<{
    id: number
    item_name: string
    target_project_id: number | null
    fixed_category_id: number | null
    category_id: number | null
    start_date: string | null
    attribution: string | null
    planned_amount: string | null
    actual_amount: string | null
  }>(sql`
    SELECT
      id, item_name, target_project_id, fixed_category_id, category_id,
      start_date::text, attribution, planned_amount, actual_amount
    FROM budget_items
    WHERE budget_plan_id = ANY(${planIds})
      AND COALESCE(is_deleted, false) = false
      AND COALESCE(attribution, 'single') = 'single'
      AND target_project_id IS NOT NULL
  `)

  const result: RecomputeResult = {
    year,
    month,
    totalBudgetItems: items.rows.length,
    updated: 0,
    skipped: 0,
    details: [],
  }

  for (const r of items.rows as {
    id: number
    item_name: string
    target_project_id: number | null
    fixed_category_id: number | null
    category_id: number | null
    start_date: string | null
    attribution: string | null
    planned_amount: string | null
    actual_amount: string | null
  }[]) {
    if (!r.target_project_id || !r.start_date) {
      result.skipped++
      continue
    }

    const candidate: BudgetItemCandidate = {
      id: r.id,
      budgetPlanId: 0, // 不影響配對
      fixedCategoryId: r.fixed_category_id,
      categoryId: r.category_id,
      targetProjectId: r.target_project_id,
      startDate: r.start_date,
      attribution: r.attribution,
      plannedAmount: r.planned_amount,
    }

    const { total: newActual } = await computeBudgetItemActual(candidate)
    const oldActual = Number(r.actual_amount ?? "0")
    const planned = Number(r.planned_amount ?? "0")
    const { variance, variancePercentage } = calcVariance(planned, newActual)

    await db
      .update(budgetItems)
      .set({
        actualAmount: newActual.toString(),
        variance: variance.toString(),
        variancePercentage: variancePercentage.toString(),
        updatedAt: new Date(),
      })
      .where(eq(budgetItems.id, r.id))

    result.updated++
    result.details.push({
      budgetItemId: r.id,
      itemName: r.item_name,
      plannedAmount: planned,
      oldActual,
      newActual,
      variance,
    })
  }

  return result
}
