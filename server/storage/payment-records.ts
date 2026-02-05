import { db, pool } from "../db"
import {
  paymentRecords,
  paymentItems,
  paymentProjects,
  debtCategories,
  fixedCategories,
  paymentSchedules,
  paymentItemNotes,
  type PaymentRecord,
  type InsertPaymentRecord,
  type PaymentSchedule,
  type InsertPaymentSchedule,
  type PaymentItemNote,
  type InsertPaymentItemNote,
} from "@shared/schema"
import { eq, and, desc, asc, sql, gte, lte } from "drizzle-orm"

// === 付款記錄 ===

export async function getPaymentRecords(filters: any = {}, page: number = 1, limit: number = 100): Promise<any[]> {
  const offset = (page - 1) * limit

  let whereConditions = []
  if (filters.itemId) {
    whereConditions.push(`pr.payment_item_id = ${filters.itemId}`)
  }
  if (filters.startDate) {
    whereConditions.push(`pr.payment_date >= '${filters.startDate.toISOString().split("T")[0]}'`)
  }
  if (filters.endDate) {
    whereConditions.push(`pr.payment_date <= '${filters.endDate.toISOString().split("T")[0]}'`)
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""

  const rawResults = await db.execute(sql`
    SELECT
      pr.id,
      pr.payment_item_id as "itemId",
      pr.amount_paid::text as amount,
      pr.payment_date::text as "paymentDate",
      pr.payment_method as "paymentMethod",
      COALESCE(pr.notes, '') as notes,
      COALESCE(pr.receipt_image_url, '') as "receiptImageUrl",
      pr.created_at as "createdAt",
      pr.updated_at as "updatedAt",
      COALESCE(pi.item_name, '') as "itemName",
      COALESCE(pi.item_type, 'project') as "itemType",
      COALESCE(pi.total_amount::text, '0') as "totalAmount",
      COALESCE(pi.project_id, 0) as "projectId",
      COALESCE(pp.project_name, '') as "projectName",
      COALESCE(pp.project_type, '') as "projectType",
      COALESCE(pi.category_id, pi.fixed_category_id, 0) as "categoryId",
      COALESCE(dc.category_name, fc.category_name, '未分類') as "categoryName"
    FROM payment_records pr
    LEFT JOIN payment_items pi ON pr.payment_item_id = pi.id
    LEFT JOIN payment_projects pp ON pi.project_id = pp.id
    LEFT JOIN debt_categories dc ON pi.category_id = dc.id
    LEFT JOIN fixed_categories fc ON pi.fixed_category_id = fc.id
    ${sql.raw(whereClause)}
    ORDER BY
      CASE WHEN pr.payment_date >= CURRENT_DATE - INTERVAL '30 days' THEN 0 ELSE 1 END,
      pr.payment_date DESC,
      pr.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `)

  return rawResults.rows.map((row: any) => ({
    id: row.id,
    itemId: row.itemId,
    amount: row.amount,
    paymentDate: row.paymentDate,
    paymentMethod: row.paymentMethod || "轉帳",
    notes: row.notes,
    receiptImageUrl: row.receiptImageUrl,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    itemName: row.itemName,
    itemType: row.itemType,
    totalAmount: row.totalAmount,
    projectId: row.projectId,
    projectName: row.projectName,
    projectType: row.projectType,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
  }))
}

export async function getPaymentRecordsByItemId(itemId: number): Promise<PaymentRecord[]> {
  const result = await db.execute(sql`
    SELECT id, payment_item_id as "itemId", amount_paid as amount, payment_date as "paymentDate",
           payment_method as "paymentMethod", notes, created_at as "createdAt", updated_at as "updatedAt",
           receipt_image_url as "receiptImageUrl"
    FROM payment_records
    WHERE payment_item_id = ${itemId}
    ORDER BY payment_date DESC, created_at DESC
  `)

  return result.rows.map((row: any) => ({
    id: row.id,
    itemId: row.itemId,
    amountPaid: row.amount,
    paymentDate: row.paymentDate,
    paymentMethod: row.paymentMethod || null,
    notes: row.notes || null,
    receiptImageUrl: row.receiptImageUrl || null,
    receiptText: null,
    isPartialPayment: null,
    createdAt: row.createdAt ? new Date(row.createdAt) : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
  }))
}

export async function getFilteredPaymentRecords(filters: {
  dateFrom?: string
  dateTo?: string
  projectId?: number
  categoryId?: number
}): Promise<any[]> {
  let whereConditions = ["pi.is_deleted = false"]
  const params: any[] = []
  let paramCount = 0

  if (filters.dateFrom) {
    paramCount++
    whereConditions.push(`pr.payment_date >= $${paramCount}`)
    params.push(filters.dateFrom)
  }

  if (filters.dateTo) {
    paramCount++
    whereConditions.push(`pr.payment_date <= $${paramCount}`)
    params.push(filters.dateTo)
  }

  if (filters.projectId) {
    paramCount++
    whereConditions.push(`pi.project_id = $${paramCount}`)
    params.push(filters.projectId)
  }

  if (filters.categoryId) {
    const categoryParam = paramCount + 1
    const fixedCategoryParam = paramCount + 2
    paramCount += 2
    whereConditions.push(`(pi.category_id = $${categoryParam} OR pi.fixed_category_id = $${fixedCategoryParam})`)
    params.push(filters.categoryId)
    params.push(filters.categoryId)
  }

  const whereClause = whereConditions.join(" AND ")

  const query = `
    SELECT
      pr.id,
      pr.payment_item_id as "itemId",
      pr.amount_paid as amount,
      pr.payment_date as "paymentDate",
      pr.payment_method as "paymentMethod",
      pr.notes,
      pr.receipt_image_url as "receiptImageUrl",
      pr.created_at as "createdAt",
      pr.updated_at as "updatedAt",
      pi.item_name as "itemName",
      pi.item_type as "itemType",
      pi.total_amount as "totalAmount",
      COALESCE(pp.id, 0) as "projectId",
      COALESCE(pp.project_name, '未分類') as "projectName",
      COALESCE(pp.project_type, 'general') as "projectType",
      COALESCE(dc.id, pi.fixed_category_id, 0) as "categoryId",
      COALESCE(dc.category_name, fc.category_name, '未分類') as "categoryName"
    FROM payment_records pr
    JOIN payment_items pi ON pr.payment_item_id = pi.id
    LEFT JOIN payment_projects pp ON pi.project_id = pp.id
    LEFT JOIN debt_categories dc ON pi.category_id = dc.id
    LEFT JOIN fixed_categories fc ON pi.fixed_category_id = fc.id
    WHERE ${whereClause}
    ORDER BY pr.payment_date DESC, pr.created_at DESC
  `

  const rawResults = await pool.query(query, params)

  return rawResults.rows.map((row: any) => ({
    id: row.id,
    itemId: row.itemId,
    amount: row.amount,
    paymentDate: row.paymentDate,
    paymentMethod: row.paymentMethod || "轉帳",
    notes: row.notes,
    receiptImageUrl: row.receiptImageUrl,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    itemName: row.itemName,
    itemType: row.itemType,
    totalAmount: row.totalAmount,
    projectId: row.projectId,
    projectName: row.projectName,
    projectType: row.projectType,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
  }))
}

export async function createPaymentRecord(recordData: InsertPaymentRecord): Promise<PaymentRecord> {
  const query = `
    INSERT INTO payment_records (
      payment_item_id, amount_paid, payment_date, payment_method, notes, receipt_image_url
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, payment_item_id as "itemId", amount_paid as amount, payment_date as "paymentDate",
             payment_method as "paymentMethod", notes, receipt_image_url as "receiptImageUrl",
             created_at as "createdAt", updated_at as "updatedAt"
  `

  const result = await pool.query(query, [
    recordData.itemId,
    recordData.amountPaid,
    recordData.paymentDate,
    recordData.paymentMethod,
    recordData.notes,
    recordData.receiptImageUrl,
  ])

  const row = result.rows[0]
  return {
    id: row.id,
    itemId: row.itemId,
    amountPaid: row.amount,
    paymentDate: row.paymentDate,
    paymentMethod: row.paymentMethod || null,
    notes: row.notes || null,
    receiptImageUrl: row.receiptImageUrl || null,
    receiptText: null,
    isPartialPayment: null,
    createdAt: row.createdAt ? new Date(row.createdAt) : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
  }
}

export async function updatePaymentRecord(id: number, recordData: InsertPaymentRecord): Promise<PaymentRecord> {
  const [record] = await db.update(paymentRecords).set(recordData).where(eq(paymentRecords.id, id)).returning()
  return record
}

export async function deletePaymentRecord(id: number): Promise<void> {
  await db.delete(paymentRecords).where(eq(paymentRecords.id, id))
}

// === 付款排程 ===

export async function getPaymentSchedules(year: number, month: number): Promise<PaymentSchedule[]> {
  const startDate = `${year}-${month.toString().padStart(2, "0")}-01`
  const endDate = new Date(year, month, 0)
  const endDateStr = `${year}-${month.toString().padStart(2, "0")}-${endDate.getDate()}`

  const schedules = await db
    .select({
      id: paymentSchedules.id,
      paymentItemId: paymentSchedules.paymentItemId,
      scheduledDate: paymentSchedules.scheduledDate,
      originalDueDate: paymentSchedules.originalDueDate,
      rescheduleCount: paymentSchedules.rescheduleCount,
      isOverdue: paymentSchedules.isOverdue,
      overdueDays: paymentSchedules.overdueDays,
      scheduledAmount: paymentSchedules.scheduledAmount,
      status: paymentSchedules.status,
      notes: paymentSchedules.notes,
      createdBy: paymentSchedules.createdBy,
      createdAt: paymentSchedules.createdAt,
      updatedAt: paymentSchedules.updatedAt,
    })
    .from(paymentSchedules)
    .where(and(gte(paymentSchedules.scheduledDate, startDate), lte(paymentSchedules.scheduledDate, endDateStr)))
    .orderBy(paymentSchedules.scheduledDate)

  return schedules
}

export async function getPaymentSchedule(id: number): Promise<PaymentSchedule | undefined> {
  const [schedule] = await db.select().from(paymentSchedules).where(eq(paymentSchedules.id, id))
  return schedule
}

export async function createPaymentSchedule(scheduleData: InsertPaymentSchedule): Promise<PaymentSchedule> {
  const [schedule] = await db.insert(paymentSchedules).values(scheduleData).returning()
  return schedule
}

export async function updatePaymentSchedule(
  id: number,
  scheduleData: Partial<InsertPaymentSchedule>
): Promise<PaymentSchedule> {
  const [schedule] = await db
    .update(paymentSchedules)
    .set({ ...scheduleData, updatedAt: new Date() })
    .where(eq(paymentSchedules.id, id))
    .returning()
  return schedule
}

export async function deletePaymentSchedule(id: number): Promise<void> {
  await db.delete(paymentSchedules).where(eq(paymentSchedules.id, id))
}

export async function getOverdueSchedules(): Promise<PaymentSchedule[]> {
  const schedules = await db
    .select()
    .from(paymentSchedules)
    .where(eq(paymentSchedules.isOverdue, true))
    .orderBy(desc(paymentSchedules.overdueDays), paymentSchedules.scheduledDate)
  return schedules
}

export async function reschedulePayment(id: number, newDate: string, notes?: string): Promise<PaymentSchedule> {
  const [schedule] = await db
    .update(paymentSchedules)
    .set({
      scheduledDate: newDate,
      rescheduleCount: sql`${paymentSchedules.rescheduleCount} + 1`,
      status: "rescheduled",
      notes: notes,
      updatedAt: new Date(),
    })
    .where(eq(paymentSchedules.id, id))
    .returning()
  return schedule
}

export async function getSchedulesByPaymentItem(paymentItemId: number): Promise<PaymentSchedule[]> {
  const schedules = await db
    .select()
    .from(paymentSchedules)
    .where(eq(paymentSchedules.paymentItemId, paymentItemId))
    .orderBy(paymentSchedules.scheduledDate)
  return schedules
}

export async function getUnscheduledPaymentItems(year: number, month: number): Promise<any[]> {
  const startDate = `${year}-${month.toString().padStart(2, "0")}-01`
  const endDate = new Date(year, month, 0)
  const endDateStr = `${year}-${month.toString().padStart(2, "0")}-${endDate.getDate()}`

  const query = sql`
    SELECT DISTINCT
      pi.id,
      pi.category_id as "categoryId",
      pi.fixed_category_id as "fixedCategoryId",
      pi.fixed_sub_option_id as "fixedSubOptionId",
      pi.project_id as "projectId",
      pi.item_name as "itemName",
      pi.total_amount::text as "totalAmount",
      pi.installment_count as "installmentCount",
      pi.installment_amount::text as "installmentAmount",
      COALESCE(pi.end_date, pi.start_date) as "dueDate",
      pi.item_type as "itemType",
      pi.payment_type as "paymentType",
      pi.start_date as "startDate",
      pi.end_date as "endDate",
      pi.status,
      pi.priority as "priority",
      pi.notes,
      pi.paid_amount::text as "paidAmount",
      COALESCE(dc.category_name, '') as "categoryName",
      COALESCE(pp.project_name, '') as "projectName",
      COALESCE(pp.project_type, '') as "projectType",
      COALESCE(scheduled_sum.total_scheduled, 0)::text as "scheduledAmount",
      (pi.total_amount - COALESCE(scheduled_sum.total_scheduled, 0))::text as "remainingAmount"
    FROM payment_items pi
    LEFT JOIN debt_categories dc ON pi.category_id = dc.id
    LEFT JOIN payment_projects pp ON pi.project_id = pp.id
    LEFT JOIN (
      SELECT
        payment_item_id,
        SUM(scheduled_amount) as total_scheduled
      FROM payment_schedules
      WHERE status IN ('scheduled', 'completed')
      GROUP BY payment_item_id
    ) scheduled_sum ON pi.id = scheduled_sum.payment_item_id
    WHERE pi.is_deleted = false
      AND (pi.status = 'pending' OR pi.status = 'unpaid' OR pi.status = 'partial')
      AND (
        (pi.end_date IS NOT NULL AND pi.end_date BETWEEN ${startDate} AND ${endDateStr})
        OR (pi.end_date IS NULL AND pi.start_date BETWEEN ${startDate} AND ${endDateStr})
        OR (pi.payment_type = 'installment' AND pi.start_date <= ${endDateStr} AND COALESCE(pi.end_date, pi.start_date) >= ${startDate})
        OR (pi.payment_type = 'monthly' AND pi.start_date <= ${endDateStr})
      )
      AND (pi.total_amount > COALESCE(scheduled_sum.total_scheduled, 0))
    ORDER BY COALESCE(pi.end_date, pi.start_date), pi.priority DESC NULLS LAST
    LIMIT 20
  `

  const result = await db.execute(query)
  return result.rows as any[]
}

// === 付款備註 ===

export async function getPaymentItemNotes(itemId: number): Promise<PaymentItemNote[]> {
  const notes = await db
    .select()
    .from(paymentItemNotes)
    .where(and(eq(paymentItemNotes.itemId, itemId), eq(paymentItemNotes.isDeleted, false)))
    .orderBy(desc(paymentItemNotes.createdAt))
  return notes
}

export async function createPaymentItemNote(note: InsertPaymentItemNote): Promise<PaymentItemNote> {
  const [newNote] = await db.insert(paymentItemNotes).values(note).returning()
  return newNote
}

export async function updatePaymentItemNote(id: number, note: Partial<InsertPaymentItemNote>): Promise<PaymentItemNote> {
  const [updatedNote] = await db
    .update(paymentItemNotes)
    .set({ ...note, updatedAt: new Date() })
    .where(eq(paymentItemNotes.id, id))
    .returning()
  return updatedNote
}

export async function deletePaymentItemNote(id: number): Promise<void> {
  await db.update(paymentItemNotes).set({ isDeleted: true, updatedAt: new Date() }).where(eq(paymentItemNotes.id, id))
}

// === 付款金額同步 ===

export async function updatePaymentItemAmounts(itemId: number): Promise<void> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(amount_paid::numeric), 0) as total_paid
    FROM payment_records
    WHERE payment_item_id = ${itemId}
  `)

  const totalPaid = parseFloat(String(result.rows[0]?.total_paid || "0"))

  const itemResult = await db.execute(sql`
    SELECT total_amount::numeric as total_amount
    FROM payment_items
    WHERE id = ${itemId}
  `)

  const totalAmount = parseFloat(String(itemResult.rows[0]?.total_amount || "0"))

  let status = "pending"
  if (totalPaid >= totalAmount) {
    status = "completed"
  } else if (totalPaid > 0) {
    status = "partial"
  }

  await db.execute(sql`
    UPDATE payment_items
    SET paid_amount = ${totalPaid},
        status = ${status},
        updated_at = NOW()
    WHERE id = ${itemId}
  `)
}
