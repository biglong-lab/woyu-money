import { db } from "../db"
import {
  householdBudgets,
  householdExpenses,
  debtCategories,
  type HouseholdBudget,
  type InsertHouseholdBudget,
  type HouseholdExpense,
  type InsertHouseholdExpense,
} from "@shared/schema"
import { eq, and, sql, desc } from "drizzle-orm"

// === 家用預算 ===

export async function getHouseholdBudget(month: string): Promise<HouseholdBudget | undefined> {
  // month 欄位為 integer，需要轉換
  const monthNum = parseInt(month, 10)
  const [budget] = await db
    .select()
    .from(householdBudgets)
    .where(eq(householdBudgets.month, monthNum))
  return budget
}

export async function setHouseholdBudget(
  budgetData: InsertHouseholdBudget
): Promise<HouseholdBudget> {
  const existing = await getHouseholdBudget(String(budgetData.month))

  if (existing) {
    const [updated] = await db
      .update(householdBudgets)
      .set({
        budgetAmount: budgetData.budgetAmount,
        updatedAt: new Date(),
      })
      .where(eq(householdBudgets.month, budgetData.month))
      .returning()
    return updated
  } else {
    const [created] = await db.insert(householdBudgets).values(budgetData).returning()
    return created
  }
}

/** 家用預算查詢結果 */
interface HouseholdBudgetSummary {
  id: number
  categoryId: number | null
  budgetAmount: string
  month: number
}

export async function getHouseholdBudgets(month: string): Promise<HouseholdBudgetSummary[]> {
  const budgets = await db
    .select({
      id: householdBudgets.id,
      categoryId: householdBudgets.categoryId,
      budgetAmount: householdBudgets.budgetAmount,
      month: householdBudgets.month,
    })
    .from(householdBudgets)
    .where(eq(householdBudgets.month, parseInt(month, 10)))

  return budgets
}

export async function createOrUpdateHouseholdBudget(
  budgetData: InsertHouseholdBudget
): Promise<HouseholdBudget> {
  if (budgetData.categoryId) {
    const existing = await db
      .select()
      .from(householdBudgets)
      .where(
        and(
          eq(householdBudgets.categoryId, budgetData.categoryId),
          eq(householdBudgets.month, budgetData.month)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      const [updated] = await db
        .update(householdBudgets)
        .set({
          budgetAmount: budgetData.budgetAmount,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(householdBudgets.categoryId, budgetData.categoryId),
            eq(householdBudgets.month, budgetData.month)
          )
        )
        .returning()
      return updated
    }
  }

  const [created] = await db.insert(householdBudgets).values(budgetData).returning()
  return created
}

// === 家用支出 ===

/** 家用支出篩選條件 */
interface HouseholdExpenseFilters {
  year?: string
  month?: string
  categoryId?: number
}

export async function getHouseholdExpenses(
  filters?: HouseholdExpenseFilters,
  page?: number,
  limit?: number
): Promise<HouseholdExpense[]> {
  const conditions = []

  if (filters?.year && filters?.month) {
    const year = filters.year
    const month = filters.month.padStart(2, "0")
    const startDate = `${year}-${month}-01`
    const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1
    const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year)
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`

    conditions.push(sql`date >= ${startDate} AND date < ${endDate}`)
  } else if (filters?.month) {
    const startDate = `${filters.month}-01`
    const [year, month] = filters.month.split("-").map(Number)
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`

    conditions.push(sql`date >= ${startDate} AND date < ${endDate}`)
  }

  if (filters?.categoryId) {
    conditions.push(eq(householdExpenses.categoryId, filters.categoryId))
  }

  const whereClause =
    conditions.length > 0
      ? conditions.length === 1
        ? conditions[0]
        : and(...conditions)
      : undefined

  if (page && limit) {
    const offset = (page - 1) * limit
    return await db
      .select()
      .from(householdExpenses)
      .where(whereClause)
      .orderBy(desc(householdExpenses.date), desc(householdExpenses.createdAt))
      .limit(limit)
      .offset(offset)
  }

  return await db
    .select()
    .from(householdExpenses)
    .where(whereClause)
    .orderBy(desc(householdExpenses.date), desc(householdExpenses.createdAt))
}

export async function createHouseholdExpense(
  expenseData: InsertHouseholdExpense
): Promise<HouseholdExpense> {
  const [expense] = await db.insert(householdExpenses).values(expenseData).returning()
  return expense
}

export async function updateHouseholdExpense(
  id: number,
  expenseData: Partial<InsertHouseholdExpense>
): Promise<HouseholdExpense> {
  const [expense] = await db
    .update(householdExpenses)
    .set({ ...expenseData, updatedAt: new Date() })
    .where(eq(householdExpenses.id, id))
    .returning()
  return expense
}

export async function deleteHouseholdExpense(id: number): Promise<void> {
  await db.delete(householdExpenses).where(eq(householdExpenses.id, id))
}

// === 家用分類預算 ===

/** 家用分類預算篩選條件 */
interface HouseholdCategoryBudgetFilters {
  year?: number
  month?: number
  categoryId?: number
  isActive?: boolean
}

export async function getHouseholdCategoryBudgets(
  filters?: HouseholdCategoryBudgetFilters
): Promise<HouseholdBudget[]> {
  const conditions = []
  if (filters?.year) {
    conditions.push(eq(householdBudgets.year, filters.year))
  }
  if (filters?.month) {
    conditions.push(eq(householdBudgets.month, filters.month))
  }
  if (filters?.categoryId) {
    conditions.push(eq(householdBudgets.categoryId, filters.categoryId))
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(householdBudgets.isActive, filters.isActive))
  }

  const whereClause =
    conditions.length > 0
      ? conditions.length === 1
        ? conditions[0]
        : and(...conditions)
      : undefined

  return await db
    .select()
    .from(householdBudgets)
    .where(whereClause)
    .orderBy(desc(householdBudgets.year), desc(householdBudgets.month))
}

export async function createHouseholdBudget(
  budgetData: InsertHouseholdBudget
): Promise<HouseholdBudget> {
  if (!budgetData.categoryId || !budgetData.year || !budgetData.month) {
    throw new Error("categoryId, year and month are required")
  }

  const existingBudgets = await db
    .select()
    .from(householdBudgets)
    .where(
      and(
        eq(householdBudgets.categoryId, budgetData.categoryId),
        eq(householdBudgets.year, budgetData.year),
        eq(householdBudgets.month, budgetData.month)
      )
    )
    .orderBy(desc(householdBudgets.updatedAt))

  if (existingBudgets.length > 1) {
    const [latestRecord, ...duplicates] = existingBudgets

    for (const duplicate of duplicates) {
      await db.delete(householdBudgets).where(eq(householdBudgets.id, duplicate.id))
    }

    const [updatedBudget] = await db
      .update(householdBudgets)
      .set({
        budgetAmount: budgetData.budgetAmount,
        updatedAt: new Date(),
      })
      .where(eq(householdBudgets.id, latestRecord.id))
      .returning()
    return updatedBudget
  }

  if (existingBudgets.length === 1) {
    const [updatedBudget] = await db
      .update(householdBudgets)
      .set({
        budgetAmount: budgetData.budgetAmount,
        updatedAt: new Date(),
      })
      .where(eq(householdBudgets.id, existingBudgets[0].id))
      .returning()
    return updatedBudget
  }

  const [budget] = await db.insert(householdBudgets).values(budgetData).returning()
  return budget
}

export async function updateHouseholdBudget(
  id: number,
  budgetData: Partial<InsertHouseholdBudget>
): Promise<HouseholdBudget> {
  const [budget] = await db
    .update(householdBudgets)
    .set({ ...budgetData, updatedAt: new Date() })
    .where(eq(householdBudgets.id, id))
    .returning()
  return budget
}

export async function updateHouseholdCategoryBudget(
  id: number,
  budgetData: Partial<InsertHouseholdBudget>
): Promise<HouseholdBudget> {
  const [budget] = await db
    .update(householdBudgets)
    .set({ ...budgetData, updatedAt: new Date() })
    .where(eq(householdBudgets.id, id))
    .returning()
  return budget
}

export async function deleteHouseholdBudget(id: number): Promise<void> {
  await db.delete(householdBudgets).where(eq(householdBudgets.id, id))
}

// === 家用分類統計 ===

/** 家用分類統計結果 */
interface HouseholdCategoryStatsResult {
  currentBudget: string
  totalExpenses: string
  remainingBudget: string
  expenseCount: number
  expenses: HouseholdExpense[]
}

export async function getHouseholdCategoryStats(
  categoryId: number,
  year?: string,
  month?: string
): Promise<HouseholdCategoryStatsResult> {
  const currentYear = year ? parseInt(year) : new Date().getFullYear()
  const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1

  const [budget] = await db
    .select()
    .from(householdBudgets)
    .where(
      and(
        eq(householdBudgets.categoryId, categoryId),
        eq(householdBudgets.year, currentYear),
        eq(householdBudgets.month, currentMonth)
      )
    )

  const monthString = currentMonth.toString().padStart(2, "0")
  const startDate = `${currentYear}-${monthString}-01`
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear
  const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`

  const expenses = await db
    .select()
    .from(householdExpenses)
    .where(
      and(
        eq(householdExpenses.categoryId, categoryId),
        sql`date >= ${startDate} AND date < ${endDate}`
      )
    )

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + parseFloat(expense.amount || "0"),
    0
  )

  return {
    currentBudget: budget?.budgetAmount || "0",
    totalExpenses: totalExpenses.toString(),
    remainingBudget: budget
      ? (parseFloat(budget.budgetAmount) - totalExpenses).toString()
      : (-totalExpenses).toString(),
    expenseCount: expenses.length,
    expenses: expenses,
  }
}

/** 家用統計結果 */
interface HouseholdStatsResult {
  budget: string
  totalExpenses: string
  remaining: string
  expenseCount: number
  categoryBreakdown: HouseholdExpense[]
}

export async function getHouseholdStats(): Promise<HouseholdStatsResult> {
  const currentMonth = new Date().toISOString().slice(0, 7)

  const budget = await getHouseholdBudget(currentMonth)

  const startDate = `${currentMonth}-01`
  const [year, month] = currentMonth.split("-").map(Number)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`

  const monthlyExpenses = await db
    .select()
    .from(householdExpenses)
    .where(sql`date >= ${startDate} AND date < ${endDate}`)

  const totalExpenses = monthlyExpenses.reduce(
    (sum, expense) => sum + parseFloat(expense.amount || "0"),
    0
  )

  const budgetAmount = budget?.budgetAmount ? parseFloat(budget.budgetAmount) : 0

  return {
    budget: budget?.budgetAmount || "0",
    totalExpenses: totalExpenses.toString(),
    remaining: (budgetAmount - totalExpenses).toString(),
    expenseCount: monthlyExpenses.length,
    categoryBreakdown: monthlyExpenses,
  }
}

// === 年度預算 ===

/** 年度預算查詢結果 */
interface YearlyBudgetRow {
  id: number
  categoryId: number | null
  year: number
  month: number
  budgetAmount: string
  categoryName: string | null
}

export async function getYearlyBudgets(year: number): Promise<YearlyBudgetRow[]> {
  const budgets = await db
    .select({
      id: householdBudgets.id,
      categoryId: householdBudgets.categoryId,
      year: householdBudgets.year,
      month: householdBudgets.month,
      budgetAmount: householdBudgets.budgetAmount,
      categoryName: debtCategories.categoryName,
    })
    .from(householdBudgets)
    .leftJoin(debtCategories, eq(householdBudgets.categoryId, debtCategories.id))
    .where(eq(householdBudgets.year, year))
    .orderBy(householdBudgets.month, debtCategories.categoryName)

  return budgets
}

/** 年度預算建立或更新資料 */
interface YearlyBudgetData {
  categoryId: number
  year: number
  month: number
  budgetAmount: string | number
}

export async function createOrUpdateYearlyBudget(
  budgetData: YearlyBudgetData
): Promise<HouseholdBudget> {
  const { categoryId, year, month, budgetAmount } = budgetData

  const [existingBudget] = await db
    .select()
    .from(householdBudgets)
    .where(
      and(
        eq(householdBudgets.categoryId, categoryId),
        eq(householdBudgets.year, year),
        eq(householdBudgets.month, month)
      )
    )

  if (existingBudget) {
    const [updatedBudget] = await db
      .update(householdBudgets)
      .set({
        budgetAmount: budgetAmount.toString(),
        updatedAt: new Date(),
      })
      .where(eq(householdBudgets.id, existingBudget.id))
      .returning()
    return updatedBudget
  } else {
    const [newBudget] = await db
      .insert(householdBudgets)
      .values({
        categoryId,
        year,
        month,
        budgetAmount: budgetAmount.toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
    return newBudget
  }
}

export async function getMonthlyBudgets(year: number, month: number): Promise<YearlyBudgetRow[]> {
  const budgets = await db
    .select({
      id: householdBudgets.id,
      categoryId: householdBudgets.categoryId,
      year: householdBudgets.year,
      month: householdBudgets.month,
      budgetAmount: householdBudgets.budgetAmount,
      categoryName: debtCategories.categoryName,
    })
    .from(householdBudgets)
    .leftJoin(debtCategories, eq(householdBudgets.categoryId, debtCategories.id))
    .where(and(eq(householdBudgets.year, year), eq(householdBudgets.month, month)))
    .orderBy(debtCategories.categoryName)

  return budgets
}
