/**
 * 人事費管理 Storage 層
 * 負責員工 CRUD 與月度人事費的資料庫操作
 */
import { db } from "../db"
import {
  employees,
  monthlyHrCosts,
  type Employee,
  type InsertEmployee,
  type MonthlyHrCost,
} from "@shared/schema"
import { eq, and, asc } from "drizzle-orm"

// === 員工 CRUD ===

/** 員工篩選條件 */
interface EmployeeFilters {
  active?: boolean
}

/** 取得員工列表（支援篩選在職狀態） */
export async function getEmployees(
  filters: EmployeeFilters = {}
): Promise<Employee[]> {
  const conditions = filters.active !== undefined
    ? eq(employees.isActive, filters.active)
    : undefined

  return db.query.employees.findMany({
    where: conditions,
    orderBy: [asc(employees.employeeName)],
  })
}

/** 取得單一員工 */
export async function getEmployee(
  id: number
): Promise<Employee | undefined> {
  return db.query.employees.findFirst({
    where: eq(employees.id, id),
  })
}

/** 新增員工 */
export async function createEmployee(
  data: InsertEmployee
): Promise<Employee> {
  const [result] = await db
    .insert(employees)
    .values(data)
    .returning()
  return result
}

/** 更新員工資料 */
export async function updateEmployee(
  id: number,
  data: Partial<InsertEmployee>
): Promise<Employee | undefined> {
  const [result] = await db
    .update(employees)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(employees.id, id))
    .returning()
  return result
}

/** 軟刪除員工（設為離職） */
export async function softDeleteEmployee(
  id: number
): Promise<Employee | undefined> {
  const [result] = await db
    .update(employees)
    .set({
      isActive: false,
      terminationDate: new Date().toISOString().split("T")[0],
      updatedAt: new Date(),
    })
    .where(eq(employees.id, id))
    .returning()
  return result
}

// === 月度人事費 ===

/** 月度人事費含員工關聯的查詢結果型別 */
type MonthlyHrCostWithEmployee = MonthlyHrCost & {
  employee: Employee
}

/** 取得指定月份的人事費（含員工關聯） */
export async function getMonthlyHrCosts(
  year: number,
  month: number
): Promise<MonthlyHrCostWithEmployee[]> {
  const result = await db.query.monthlyHrCosts.findMany({
    where: and(
      eq(monthlyHrCosts.year, year),
      eq(monthlyHrCosts.month, month)
    ),
    with: {
      employee: true,
    },
    orderBy: [asc(monthlyHrCosts.employeeId)],
  })
  return result as MonthlyHrCostWithEmployee[]
}

/** 批量插入月度人事費記錄 */
export async function createMonthlyHrCosts(
  records: Array<typeof monthlyHrCosts.$inferInsert>
): Promise<MonthlyHrCost[]> {
  return db.insert(monthlyHrCosts).values(records).returning()
}

/** 刪除指定月份的所有人事費記錄 */
export async function deleteMonthlyHrCosts(
  year: number,
  month: number
): Promise<void> {
  await db.delete(monthlyHrCosts).where(
    and(
      eq(monthlyHrCosts.year, year),
      eq(monthlyHrCosts.month, month)
    )
  )
}

/** 更新單筆月度人事費 */
export async function updateMonthlyHrCost(
  id: number,
  data: Partial<{
    isPaid: boolean
    insurancePaid: boolean
  }>
): Promise<MonthlyHrCost | undefined> {
  const [result] = await db
    .update(monthlyHrCosts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(monthlyHrCosts.id, id))
    .returning()
  return result
}

/** 取得指定年度的所有月度人事費（含員工關聯） */
export async function getHrCostsByYear(
  year: number
): Promise<MonthlyHrCostWithEmployee[]> {
  const result = await db.query.monthlyHrCosts.findMany({
    where: eq(monthlyHrCosts.year, year),
    with: {
      employee: true,
    },
  })
  return result as MonthlyHrCostWithEmployee[]
}

/** 取得在職員工人數 */
export async function getActiveEmployeeCount(): Promise<number> {
  const result = await db.query.employees.findMany({
    where: eq(employees.isActive, true),
  })
  return result.length
}

/** 取得所有在職員工 */
export async function getActiveEmployees(): Promise<Employee[]> {
  return db.query.employees.findMany({
    where: eq(employees.isActive, true),
  })
}
