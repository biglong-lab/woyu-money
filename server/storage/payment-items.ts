import { db } from "../db"
import {
  paymentItems,
  paymentRecords,
  debtCategories,
  paymentProjects,
  fixedCategories,
  auditLogs,
  type PaymentItem,
  type InsertPaymentItem,
  type AuditLog,
  type InsertAuditLog,
} from "@shared/schema"
import { eq, and, sql, desc, type SQL } from "drizzle-orm"
import {
  getCachedCategoryType,
  createAuditLogAsync,
  createFixedCategorySubOptionAsync,
  calculateMonthsBetween,
  getMonthIndex,
} from "./helpers"

/** Drizzle 原生插入型別（含 startDate 等必填欄位） */
type PaymentItemInsert = typeof paymentItems.$inferInsert

// === 審計日誌 ===

export async function getAuditLogs(tableName: string, recordId: number): Promise<AuditLog[]> {
  return await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.tableName, tableName), eq(auditLogs.recordId, recordId)))
    .orderBy(desc(auditLogs.createdAt))
}

export async function createAuditLog(logData: InsertAuditLog): Promise<AuditLog> {
  const [log] = await db.insert(auditLogs).values(logData).returning()
  return log
}

// === 付款項目 CRUD ===

/** 付款項目篩選條件 */
interface PaymentItemFilters {
  projectId?: number | string
  categoryId?: number | string
  excludeRental?: boolean
}

export async function getPaymentItems(
  filters?: PaymentItemFilters,
  page?: number,
  limit?: number
): Promise<PaymentItem[]> {
  const offset = page && limit ? (page - 1) * limit : 0
  const queryLimit = limit || 5000

  const conditions: SQL[] = [sql`pi.is_deleted = false`]

  if (filters?.projectId) {
    conditions.push(sql`pi.project_id = ${Number(filters.projectId)}`)
  }
  if (filters?.categoryId) {
    conditions.push(sql`pi.category_id = ${Number(filters.categoryId)}`)
  }

  if (filters?.excludeRental) {
    conditions.push(sql`(
      pi.item_name NOT LIKE '%租約%' AND
      pi.item_name NOT LIKE '%租金%' AND
      pi.item_name NOT LIKE '%第%期/共%期%' AND
      pi.item_name NOT LIKE '%房務薪資%' AND
      pi.item_name NOT LIKE '%客務薪資%' AND
      (pp.project_type IS NULL OR pp.project_type != 'rental' OR
       pi.payment_type = 'single')
    )`)
  }

  const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`

  const query = sql`
    SELECT
      pi.id,
      pi.category_id as "categoryId",
      pi.fixed_category_id as "fixedCategoryId",
      pi.fixed_sub_option_id as "fixedSubOptionId",
      pi.project_id as "projectId",
      pi.item_name as "itemName",
      pi.total_amount::text as "totalAmount",
      pi.installment_count as "installmentCount",
      pi.installment_count as "installmentMonths",
      pi.installment_amount::text as "installmentAmount",
      pi.end_date as "dueDate",
      pi.item_type as "itemType",
      pi.payment_type as "paymentType",
      pi.start_date as "startDate",
      pi.end_date as "endDate",
      pi.status,
      pi.priority,
      pi.notes,
      pi.is_deleted as "isDeleted",
      pi.created_at as "createdAt",
      pi.updated_at as "updatedAt",
      COALESCE(dc.category_name, '') as "categoryName",
      COALESCE(pp.project_name, '') as "projectName",
      COALESCE(pp.project_type, '') as "projectType",
      COALESCE(pi.paid_amount::text, '0') as "paidAmount"
    FROM payment_items pi
    LEFT JOIN debt_categories dc ON pi.category_id = dc.id
    LEFT JOIN payment_projects pp ON pi.project_id = pp.id
    ${whereClause}
    ORDER BY pi.start_date DESC
    LIMIT ${queryLimit} OFFSET ${offset}
  `

  const result = await db.execute(query)
  return result.rows as PaymentItem[]
}

export async function getPaymentItemsCount(filters?: PaymentItemFilters): Promise<number> {
  const conditions: SQL[] = [sql`pi.is_deleted = false`]

  if (filters?.projectId) {
    conditions.push(sql`pi.project_id = ${Number(filters.projectId)}`)
  }
  if (filters?.categoryId) {
    conditions.push(sql`pi.category_id = ${Number(filters.categoryId)}`)
  }

  if (filters?.excludeRental) {
    conditions.push(sql`(
      pi.item_name NOT LIKE '%租約%' AND
      pi.item_name NOT LIKE '%租金%' AND
      pi.item_name NOT LIKE '%第%期/共%期%' AND
      pi.item_name NOT LIKE '%房務薪資%' AND
      pi.item_name NOT LIKE '%客務薪資%' AND
      (pp.project_type IS NULL OR pp.project_type != 'rental' OR
       pi.payment_type = 'single')
    )`)
  }

  const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`

  const query = sql`
    SELECT COUNT(*) as count
    FROM payment_items pi
    LEFT JOIN payment_projects pp ON pi.project_id = pp.id
    ${whereClause}
  `

  const result = await db.execute(query)
  const row = result.rows[0] as Record<string, unknown> | undefined
  return parseInt(String(row?.count ?? "0"))
}

export async function getPaymentItem(id: number): Promise<PaymentItem | undefined> {
  const [item] = await db.select().from(paymentItems).where(eq(paymentItems.id, id))
  return item
}

// 建立月付項目的輔助函式
async function createMonthlyPaymentItems(
  itemData: InsertPaymentItem,
  userInfo: string
): Promise<PaymentItem> {
  const startDate = new Date(itemData.startDate!)
  const endDate = new Date(itemData.endDate!)
  const monthlyAmount =
    parseFloat(itemData.totalAmount) / calculateMonthsBetween(startDate, endDate)

  const [parentItem] = await db
    .insert(paymentItems)
    .values({ ...itemData, updatedAt: new Date() } as PaymentItemInsert)
    .returning()

  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    await db.execute(sql`
      INSERT INTO payment_records (payment_item_id, amount_paid, payment_date, notes)
      VALUES (${parentItem.id}, ${monthlyAmount.toFixed(2)}, ${currentDate.toISOString().split("T")[0]}, ${`第 ${getMonthIndex(startDate, currentDate) + 1} 期月付`})
    `)

    currentDate.setMonth(currentDate.getMonth() + 1)
  }

  await createAuditLog({
    tableName: "payment_items",
    recordId: parentItem.id,
    action: "INSERT",
    oldValues: null,
    newValues: parentItem,
    changedFields: [],
    userInfo,
    changeReason: "新建月付項目",
  })

  return parentItem
}

// 建立分期付款項目的輔助函式
async function createInstallmentPaymentItems(
  itemData: InsertPaymentItem,
  userInfo: string
): Promise<PaymentItem> {
  const startDate = new Date(itemData.startDate!)
  const endDate = new Date(itemData.endDate!)
  const totalAmount = parseFloat(itemData.totalAmount)

  const installments = calculateMonthsBetween(startDate, endDate)
  const installmentAmount = totalAmount / installments

  const [parentItem] = await db
    .insert(paymentItems)
    .values({ ...itemData, updatedAt: new Date() } as PaymentItemInsert)
    .returning()

  const currentDate = new Date(startDate)
  for (let i = 0; i < installments; i++) {
    await db.execute(sql`
      INSERT INTO payment_records (payment_item_id, amount_paid, payment_date, notes)
      VALUES (${parentItem.id}, ${installmentAmount.toFixed(2)}, ${currentDate.toISOString().split("T")[0]}, ${`第 ${i + 1} 期分期付款`})
    `)

    currentDate.setMonth(currentDate.getMonth() + 1)
  }

  await createAuditLog({
    tableName: "payment_items",
    recordId: parentItem.id,
    action: "INSERT",
    oldValues: null,
    newValues: parentItem,
    changedFields: [],
    userInfo,
    changeReason: "新建分期付款項目",
  })

  return parentItem
}

export async function createPaymentItem(
  itemData: InsertPaymentItem,
  userInfo = "系統管理員"
): Promise<PaymentItem> {
  const cleanData = { ...itemData }

  if (!cleanData.fixedCategoryId || cleanData.fixedCategoryId === 0) {
    cleanData.fixedCategoryId = null
    cleanData.fixedSubOptionId = null

    if (cleanData.categoryId) {
      cleanData.itemType = await getCachedCategoryType(cleanData.categoryId)
    } else {
      cleanData.itemType = "project"
    }
  } else {
    cleanData.categoryId = null
    cleanData.itemType = "project"
  }

  if (cleanData.paymentType === "monthly" && cleanData.endDate) {
    return await createMonthlyPaymentItems(cleanData, userInfo)
  } else if (cleanData.paymentType === "installment" && cleanData.endDate) {
    return await createInstallmentPaymentItems(cleanData, userInfo)
  } else {
    const [item] = await db
      .insert(paymentItems)
      .values({ ...cleanData, updatedAt: new Date() } as PaymentItemInsert)
      .returning()

    if (cleanData.fixedCategoryId && cleanData.projectId && cleanData.itemName) {
      setImmediate(() => {
        createFixedCategorySubOptionAsync(
          cleanData.fixedCategoryId!,
          cleanData.projectId!,
          cleanData.itemName
        ).catch((error: unknown) => {
          console.error("非同步創建固定分類子選項失敗:", error)
        })
      })
    }

    setImmediate(() => {
      createAuditLogAsync({
        tableName: "payment_items",
        recordId: item.id,
        action: "INSERT",
        oldValues: null,
        newValues: item,
        changedFields: [],
        userInfo,
        changeReason: "新建付款項目",
      }).catch((error: unknown) => {
        console.error("非同步創建審計日誌失敗:", error)
      })
    })

    return item
  }
}

export async function updatePaymentItem(
  id: number,
  itemData: Partial<InsertPaymentItem>,
  userInfo = "系統管理員",
  reason = "更新項目資訊"
): Promise<PaymentItem> {
  try {
    const cleanedData = { ...itemData }
    if (cleanedData.fixedCategoryId === 0) {
      cleanedData.fixedCategoryId = null
    }
    if (cleanedData.fixedSubOptionId === 0) {
      cleanedData.fixedSubOptionId = null
    }

    const [oldItem] = await db.select().from(paymentItems).where(eq(paymentItems.id, id))

    if (!oldItem) {
      throw new Error("項目不存在")
    }

    const [updatedItem] = await db
      .update(paymentItems)
      .set({ ...cleanedData, updatedAt: new Date() } as Partial<PaymentItemInsert>)
      .where(eq(paymentItems.id, id))
      .returning()

    setImmediate(() => {
      createAuditLogAsync({
        tableName: "payment_items",
        recordId: id,
        action: "UPDATE",
        oldValues: oldItem,
        newValues: updatedItem,
        changedFields: Object.keys(cleanedData),
        userInfo,
        changeReason: reason,
      }).catch((error: unknown) => {
        console.error("非同步創建更新審計日誌失敗:", error)
      })
    })

    return updatedItem
  } catch (error) {
    console.error("Error updating payment item:", error)
    throw error
  }
}

export async function deletePaymentItem(
  id: number,
  userInfo = "系統管理員",
  reason = "刪除項目"
): Promise<void> {
  const oldItem = await getPaymentItem(id)

  const now = new Date()
  await db
    .update(paymentItems)
    .set({
      isDeleted: true,
      deletedAt: now,
      updatedAt: now,
    })
    .where(eq(paymentItems.id, id))

  await createAuditLog({
    tableName: "payment_items",
    recordId: id,
    action: "DELETE",
    oldValues: oldItem,
    newValues: { ...oldItem, isDeleted: true, deletedAt: now },
    changedFields: ["isDeleted", "deletedAt"],
    userInfo,
    changeReason: reason,
  })
}

export async function permanentlyDeletePaymentItem(
  id: number,
  userInfo = "系統管理員",
  reason = "永久刪除項目"
): Promise<void> {
  const oldItem = await getPaymentItem(id)

  await db.execute(sql`
    DELETE FROM payment_records
    WHERE payment_item_id = ${id}
  `)

  await db.delete(paymentItems).where(eq(paymentItems.id, id))

  await createAuditLog({
    tableName: "payment_items",
    recordId: id,
    action: "PERMANENT_DELETE",
    oldValues: oldItem,
    newValues: null,
    changedFields: ["permanent_deletion"],
    userInfo,
    changeReason: reason,
  })
}

export async function restorePaymentItem(
  id: number,
  userInfo = "系統管理員",
  reason = "恢復項目"
): Promise<PaymentItem> {
  const oldItem = await getPaymentItem(id)

  const [item] = await db
    .update(paymentItems)
    .set({
      isDeleted: false,
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(paymentItems.id, id))
    .returning()

  await createAuditLog({
    tableName: "payment_items",
    recordId: id,
    action: "RESTORE",
    oldValues: oldItem,
    newValues: item,
    changedFields: ["isDeleted", "deletedAt"],
    userInfo,
    changeReason: reason,
  })

  return item
}

/** 已刪除付款項目（含關聯名稱） */
interface DeletedPaymentItemRow extends Record<string, unknown> {
  id: number
  category_id: number | null
  fixed_category_id: number | null
  fixed_sub_option_id: number | null
  project_id: number | null
  item_name: string
  total_amount: string
  item_type: string | null
  payment_type: string | null
  recurring_interval: string | null
  installment_count: number | null
  installment_amount: string | null
  start_date: string
  end_date: string | null
  paid_amount: string | null
  status: string
  priority: number | null
  notes: string | null
  tags: string | null
  is_deleted: boolean
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
  categoryName: string | null
  projectName: string | null
  projectType: string | null
  fixedCategoryName: string | null
}

export async function getDeletedPaymentItems(): Promise<Record<string, unknown>[]> {
  const result = await db.execute(sql`
    SELECT
      pi.*,
      dc.category_name as "categoryName",
      pp.project_name as "projectName",
      pp.project_type as "projectType",
      fc.category_name as "fixedCategoryName"
    FROM payment_items pi
    LEFT JOIN debt_categories dc ON pi.category_id = dc.id
    LEFT JOIN payment_projects pp ON pi.project_id = pp.id
    LEFT JOIN fixed_categories fc ON pi.fixed_category_id = fc.id
    WHERE pi.is_deleted = true
    ORDER BY pi.deleted_at DESC
  `)

  return result.rows.map((r: Record<string, unknown>) => {
    const row = r as DeletedPaymentItemRow
    return {
      id: row.id,
      categoryId: row.category_id,
      fixedCategoryId: row.fixed_category_id,
      fixedSubOptionId: row.fixed_sub_option_id,
      projectId: row.project_id,
      itemName: row.item_name,
      totalAmount: row.total_amount,
      itemType: row.item_type,
      paymentType: row.payment_type,
      recurringInterval: row.recurring_interval,
      installmentCount: row.installment_count,
      installmentAmount: row.installment_amount,
      startDate: row.start_date,
      endDate: row.end_date,
      paidAmount: row.paid_amount,
      status: row.status,
      priority: row.priority,
      notes: row.notes,
      tags: row.tags,
      isDeleted: row.is_deleted,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      categoryName: row.categoryName,
      projectName: row.projectName,
      projectType: row.projectType,
      fixedCategoryName: row.fixedCategoryName,
    }
  })
}
