import { db, pool, handleDatabaseError } from "../db"
import { auditLogs, debtCategories, fixedCategorySubOptions } from "@shared/schema"
import type { InsertAuditLog } from "@shared/schema"
import { eq, and } from "drizzle-orm"

// 資料庫操作重試機制
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error

      if (
        error.message?.includes("Too many database connection attempts") ||
        error.message?.includes("timeout") ||
        error.message?.includes("connection")
      ) {
        console.warn(
          `Database operation failed (attempt ${attempt}/${maxRetries}):`,
          error.message
        )

        if (attempt < maxRetries) {
          await handleDatabaseError(error)
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
            )
          )
          continue
        }
      }

      throw error
    }
  }

  throw lastError!
}

// 分類類型快取
const categoryTypeCache = new Map<number, string>()

export async function getCachedCategoryType(categoryId: number): Promise<string> {
  if (categoryTypeCache.has(categoryId)) {
    return categoryTypeCache.get(categoryId)!
  }

  const [category] = await db
    .select({ categoryType: debtCategories.categoryType })
    .from(debtCategories)
    .where(eq(debtCategories.id, categoryId))
    .limit(1)

  const categoryType = category?.categoryType === "household" ? "home" : "project"
  categoryTypeCache.set(categoryId, categoryType)
  return categoryType
}

// 非同步創建審計日誌
export async function createAuditLogAsync(logData: InsertAuditLog): Promise<void> {
  try {
    await db
      .insert(auditLogs)
      .values({ ...logData, createdAt: new Date() })
  } catch (error) {
    console.error("非同步創建審計日誌失敗:", error)
  }
}

// 非同步創建固定分類子選項
export async function createFixedCategorySubOptionAsync(
  fixedCategoryId: number,
  projectId: number,
  itemName: string
): Promise<void> {
  try {
    const existingSubOption = await db
      .select()
      .from(fixedCategorySubOptions)
      .where(
        and(
          eq(fixedCategorySubOptions.fixedCategoryId, fixedCategoryId),
          eq(fixedCategorySubOptions.projectId, projectId),
          eq(fixedCategorySubOptions.subOptionName, itemName)
        )
      )
      .limit(1)

    if (existingSubOption.length === 0) {
      await db.insert(fixedCategorySubOptions).values({
        fixedCategoryId,
        projectId,
        subOptionName: itemName,
        displayName: itemName,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
  } catch (error) {
    console.error("非同步創建固定分類子選項失敗:", error)
  }
}

// 計算兩個日期之間的月數
export function calculateMonthsBetween(startDate: Date, endDate: Date): number {
  return (
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) +
    1
  )
}

// 計算月份索引
export function getMonthIndex(startDate: Date, currentDate: Date): number {
  return (
    (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
    (currentDate.getMonth() - startDate.getMonth())
  )
}

export { db, pool }
