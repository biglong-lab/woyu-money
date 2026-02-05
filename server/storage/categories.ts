import { db } from "../db"
import {
  debtCategories,
  paymentProjects,
  paymentItems,
  fixedCategories,
  fixedCategorySubOptions,
  householdBudgets,
  householdExpenses,
  projectCategoryTemplates,
  type DebtCategory,
  type InsertDebtCategory,
  type PaymentProject,
  type InsertPaymentProject,
  type FixedCategory,
  type InsertFixedCategory,
  type FixedCategorySubOption,
  type InsertFixedCategorySubOption,
  type ProjectCategoryTemplate,
  type InsertProjectCategoryTemplate,
} from "@shared/schema"
import { eq, and, sql, desc, gte, lt } from "drizzle-orm"

// === 債務分類 ===

export async function getCategories(): Promise<DebtCategory[]> {
  return await db.select().from(debtCategories).where(eq(debtCategories.isDeleted, false))
}

export async function getProjectCategories(): Promise<DebtCategory[]> {
  return await db
    .select()
    .from(debtCategories)
    .where(and(eq(debtCategories.isDeleted, false), eq(debtCategories.categoryType, "project")))
    .orderBy(debtCategories.categoryName)
}

export async function getHouseholdCategories(): Promise<any[]> {
  const categories = await db
    .select()
    .from(debtCategories)
    .where(and(eq(debtCategories.isDeleted, false), eq(debtCategories.categoryType, "household")))
    .orderBy(debtCategories.categoryName)

  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1

  const budgets = await db
    .select()
    .from(householdBudgets)
    .where(and(eq(householdBudgets.year, currentYear), eq(householdBudgets.month, currentMonth)))

  const monthString = currentMonth.toString().padStart(2, "0")
  const currentMonthStart = `${currentYear}-${monthString}-01`

  const nextMonthDate = new Date(currentYear, currentMonth, 1)
  const nextMonthString = `${nextMonthDate.getFullYear()}-${(nextMonthDate.getMonth() + 1).toString().padStart(2, "0")}-01`

  const expenses = await db
    .select()
    .from(householdExpenses)
    .where(and(gte(householdExpenses.date, currentMonthStart), lt(householdExpenses.date, nextMonthString)))

  return categories.map((category) => {
    const categoryBudget = budgets.find((b) => b.categoryId === category.id)
    const categoryExpenses = expenses.filter((e) => e.categoryId === category.id)

    const budget = categoryBudget ? parseFloat(categoryBudget.budgetAmount) : 0
    const spent = categoryExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0)

    return {
      id: category.id,
      categoryName: category.categoryName,
      budget,
      spent,
    }
  })
}

export async function createCategory(categoryData: InsertDebtCategory): Promise<DebtCategory> {
  const [category] = await db.insert(debtCategories).values(categoryData).returning()
  return category
}

export async function updateCategory(id: number, categoryData: InsertDebtCategory): Promise<DebtCategory> {
  const [category] = await db
    .update(debtCategories)
    .set(categoryData)
    .where(eq(debtCategories.id, id))
    .returning()
  return category
}

export async function deleteCategory(id: number): Promise<void> {
  await db.update(debtCategories).set({ isDeleted: true }).where(eq(debtCategories.id, id))
}

export async function getCategoryUsageCount(categoryId: number): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(paymentItems)
    .where(and(eq(paymentItems.categoryId, categoryId), eq(paymentItems.isDeleted, false)))

  return result?.count || 0
}

export async function getCategoryStats(type: "project" | "household"): Promise<any[]> {
  try {
    const stats = await db
      .select({
        categoryId: debtCategories.id,
        categoryName: debtCategories.categoryName,
        totalAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentItems.isDeleted} = false THEN ${paymentItems.totalAmount}::numeric ELSE 0 END), 0)`,
        paidAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentItems.isDeleted} = false THEN ${paymentItems.paidAmount}::numeric ELSE 0 END), 0)`,
        unpaidAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} != 'paid' THEN (${paymentItems.totalAmount}::numeric - ${paymentItems.paidAmount}::numeric) ELSE 0 END), 0)`,
        overdueAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} = 'overdue' THEN (${paymentItems.totalAmount}::numeric - ${paymentItems.paidAmount}::numeric) ELSE 0 END), 0)`,
        overdueCount: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} = 'overdue' THEN 1 END)`,
        totalCount: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false THEN 1 END)`,
        paidCount: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.status} = 'paid' THEN 1 END)`,
        singlePayments: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.paymentType} = 'single' THEN 1 END)`,
        installmentPayments: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.paymentType} = 'installment' THEN 1 END)`,
        monthlyPayments: sql<number>`COUNT(CASE WHEN ${paymentItems.isDeleted} = false AND ${paymentItems.paymentType} = 'monthly' THEN 1 END)`,
      })
      .from(debtCategories)
      .leftJoin(paymentItems, eq(paymentItems.categoryId, debtCategories.id))
      .where(and(eq(debtCategories.categoryType, type), eq(debtCategories.isDeleted, false)))
      .groupBy(debtCategories.id, debtCategories.categoryName)
      .orderBy(debtCategories.categoryName)

    return stats.map((stat) => ({
      categoryId: stat.categoryId,
      categoryName: stat.categoryName,
      totalAmount: stat.totalAmount.toString(),
      paidAmount: stat.paidAmount.toString(),
      unpaidAmount: stat.unpaidAmount.toString(),
      overdueAmount: stat.overdueAmount.toString(),
      overdueCount: stat.overdueCount,
      totalCount: stat.totalCount,
      paidCount: stat.paidCount,
      paymentTypes: {
        single: stat.singlePayments,
        installment: stat.installmentPayments,
        monthly: stat.monthlyPayments,
      },
    }))
  } catch (error) {
    console.error("Error fetching category stats:", error)
    throw error
  }
}

// === 債務分類管理（額外方法）===

export async function getDebtCategories(): Promise<DebtCategory[]> {
  try {
    return await db.select().from(debtCategories).where(eq(debtCategories.isDeleted, false)).orderBy(debtCategories.categoryName)
  } catch (error) {
    console.error("Error fetching debt categories:", error)
    throw error
  }
}

export async function createDebtCategory(categoryData: InsertDebtCategory): Promise<DebtCategory> {
  try {
    const [category] = await db.insert(debtCategories).values(categoryData).returning()
    return category
  } catch (error) {
    console.error("Error creating debt category:", error)
    throw error
  }
}

export async function updateDebtCategory(id: number, categoryData: Partial<InsertDebtCategory>): Promise<DebtCategory> {
  try {
    const [category] = await db
      .update(debtCategories)
      .set({ ...categoryData, updatedAt: new Date() })
      .where(eq(debtCategories.id, id))
      .returning()
    return category
  } catch (error) {
    console.error("Error updating debt category:", error)
    throw error
  }
}

export async function deleteDebtCategory(id: number): Promise<void> {
  try {
    await db.update(debtCategories).set({ isDeleted: true, updatedAt: new Date() }).where(eq(debtCategories.id, id))
  } catch (error) {
    console.error("Error deleting debt category:", error)
    throw error
  }
}

// === 家用分類管理 ===

export async function createHouseholdCategory(categoryData: any): Promise<any> {
  try {
    const result = await db.execute(sql`
      INSERT INTO household_categories (category_name, level, parent_id, color, icon, is_active)
      VALUES (${categoryData.categoryName}, ${categoryData.level || 1}, ${categoryData.parentId}, ${categoryData.color || "#6B7280"}, ${categoryData.icon || "Receipt"}, true)
      RETURNING *
    `)
    return result.rows[0]
  } catch (error) {
    console.error("Error creating household category:", error)
    throw error
  }
}

export async function updateHouseholdCategory(id: number, categoryData: any): Promise<any> {
  try {
    const result = await db.execute(sql`
      UPDATE household_categories
      SET category_name = ${categoryData.categoryName},
          level = ${categoryData.level},
          parent_id = ${categoryData.parentId},
          color = ${categoryData.color},
          icon = ${categoryData.icon},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `)
    return result.rows[0]
  } catch (error) {
    console.error("Error updating household category:", error)
    throw error
  }
}

export async function deleteHouseholdCategory(id: number): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE household_categories
      SET is_active = false, updated_at = NOW()
      WHERE id = ${id}
    `)
  } catch (error) {
    console.error("Error deleting household category:", error)
    throw error
  }
}

// === 付款專案 ===

export async function getPaymentProjects(): Promise<PaymentProject[]> {
  return await db.select().from(paymentProjects).where(eq(paymentProjects.isDeleted, false))
}

export async function createPaymentProject(projectData: InsertPaymentProject): Promise<PaymentProject> {
  const [project] = await db.insert(paymentProjects).values(projectData).returning()
  return project
}

export async function updatePaymentProject(id: number, projectData: InsertPaymentProject): Promise<PaymentProject> {
  const [project] = await db
    .update(paymentProjects)
    .set(projectData)
    .where(eq(paymentProjects.id, id))
    .returning()
  return project
}

export async function deletePaymentProject(id: number): Promise<void> {
  const [itemCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(paymentItems)
    .where(and(eq(paymentItems.projectId, id), eq(paymentItems.isDeleted, false)))

  if (itemCount.count > 0) {
    await db.update(paymentProjects).set({ isDeleted: true, updatedAt: new Date() }).where(eq(paymentProjects.id, id))
  } else {
    await db.delete(paymentProjects).where(eq(paymentProjects.id, id))
  }
}

// === 固定分類 ===

export async function getFixedCategories(): Promise<FixedCategory[]> {
  try {
    return await db
      .select()
      .from(fixedCategories)
      .where(eq(fixedCategories.isActive, true))
      .orderBy(fixedCategories.sortOrder, fixedCategories.categoryName)
  } catch (error) {
    console.error("Error fetching fixed categories:", error)
    throw error
  }
}

export async function createFixedCategory(categoryData: InsertFixedCategory): Promise<FixedCategory> {
  const [category] = await db.insert(fixedCategories).values(categoryData).returning()
  return category
}

export async function updateFixedCategory(id: number, categoryData: Partial<InsertFixedCategory>): Promise<FixedCategory> {
  const [category] = await db.update(fixedCategories).set(categoryData).where(eq(fixedCategories.id, id)).returning()
  return category
}

export async function deleteFixedCategory(id: number): Promise<void> {
  await db.delete(fixedCategories).where(eq(fixedCategories.id, id))
}

// === 固定分類子選項 ===

export async function getFixedCategorySubOptions(
  projectId?: number,
  fixedCategoryId?: number
): Promise<FixedCategorySubOption[]> {
  try {
    const conditions = [eq(fixedCategorySubOptions.isActive, true)]

    if (projectId) {
      conditions.push(eq(fixedCategorySubOptions.projectId, projectId))
    } else {
      return []
    }

    if (fixedCategoryId) {
      conditions.push(eq(fixedCategorySubOptions.fixedCategoryId, fixedCategoryId))
    }

    return await db
      .select({
        id: fixedCategorySubOptions.id,
        fixedCategoryId: fixedCategorySubOptions.fixedCategoryId,
        projectId: fixedCategorySubOptions.projectId,
        subOptionName: fixedCategorySubOptions.subOptionName,
        displayName: fixedCategorySubOptions.displayName,
        isActive: fixedCategorySubOptions.isActive,
        createdAt: fixedCategorySubOptions.createdAt,
        updatedAt: fixedCategorySubOptions.updatedAt,
        categoryName: fixedCategories.categoryName,
        categoryType: fixedCategories.categoryType,
      })
      .from(fixedCategorySubOptions)
      .leftJoin(fixedCategories, eq(fixedCategorySubOptions.fixedCategoryId, fixedCategories.id))
      .where(and(...conditions))
      .orderBy(fixedCategories.sortOrder, fixedCategorySubOptions.subOptionName)
  } catch (error) {
    console.error("Error fetching fixed category sub options:", error)
    throw error
  }
}

export async function createFixedCategorySubOption(
  subOption: InsertFixedCategorySubOption
): Promise<FixedCategorySubOption> {
  try {
    const [newSubOption] = await db.insert(fixedCategorySubOptions).values(subOption).returning()
    return newSubOption
  } catch (error) {
    console.error("Error creating fixed category sub option:", error)
    throw error
  }
}

export async function updateFixedCategorySubOption(
  id: number,
  subOption: Partial<InsertFixedCategorySubOption>
): Promise<FixedCategorySubOption> {
  try {
    const [updatedSubOption] = await db
      .update(fixedCategorySubOptions)
      .set({ ...subOption, updatedAt: new Date() })
      .where(eq(fixedCategorySubOptions.id, id))
      .returning()
    return updatedSubOption
  } catch (error) {
    console.error("Error updating fixed category sub option:", error)
    throw error
  }
}

export async function deleteFixedCategorySubOption(id: number): Promise<void> {
  try {
    await db
      .update(fixedCategorySubOptions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(fixedCategorySubOptions.id, id))
  } catch (error) {
    console.error("Error deleting fixed category sub option:", error)
    throw error
  }
}

// === 專案分類範本 ===

export async function getProjectCategoryTemplates(
  projectId: number,
  categoryId?: number
): Promise<ProjectCategoryTemplate[]> {
  let query = db
    .select()
    .from(projectCategoryTemplates)
    .where(and(eq(projectCategoryTemplates.projectId, projectId), eq(projectCategoryTemplates.isActive, true)))

  if (categoryId) {
    query = query.where(eq(projectCategoryTemplates.categoryId, categoryId))
  }

  return await query.orderBy(projectCategoryTemplates.templateName)
}

export async function createProjectCategoryTemplate(
  templateData: InsertProjectCategoryTemplate
): Promise<ProjectCategoryTemplate> {
  const [template] = await db.insert(projectCategoryTemplates).values(templateData).returning()
  return template
}

export async function updateProjectCategoryTemplate(
  id: number,
  templateData: Partial<InsertProjectCategoryTemplate>
): Promise<ProjectCategoryTemplate> {
  const [template] = await db
    .update(projectCategoryTemplates)
    .set({ ...templateData, updatedAt: new Date() })
    .where(eq(projectCategoryTemplates.id, id))
    .returning()
  return template
}

export async function deleteProjectCategoryTemplate(id: number): Promise<void> {
  await db
    .update(projectCategoryTemplates)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(projectCategoryTemplates.id, id))
}
