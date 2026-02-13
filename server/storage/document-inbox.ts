import { db } from "../db"
import {
  documentInbox,
  users,
  paymentItems,
  paymentRecords,
  invoiceRecords,
  type DocumentInbox,
  type InvoiceRecord,
  type PaymentItem,
  type PaymentRecord,
} from "@shared/schema"
import { eq, and, desc, sql } from "drizzle-orm"

// --- 型別定義 ---

/** documentInbox 表的 Drizzle 原生插入型別 */
type DocumentInboxInsert = typeof documentInbox.$inferInsert

/** documentInbox 篩選條件 */
interface DocumentInboxFilters {
  status?: string
  documentType?: string
}

/** 建立 documentInbox 項目的參數 */
interface CreateDocumentInboxData {
  userId?: number | null
  documentType: string
  status: string
  imagePath: string
  originalFilename: string
  notes?: string | null
  uploadedByUsername: string
}

/** AI 辨識結果 */
interface AiRecognitionSuccess {
  success: true
  confidence: number
  extractedData: {
    vendor?: string | null
    amount?: number | string | null
    date?: string | null
    description?: string | null
    category?: string | null
    invoiceNumber?: string | null
  }
  rawResponse?: string | null
}

interface AiRecognitionFailure {
  success: false
  error?: string
  notes?: string | null
}

type AiRecognitionResult = AiRecognitionSuccess | AiRecognitionFailure

/** 使用者顯示名稱 */
interface UserDisplayName {
  username: string | null
  fullName: string | null
}

/** 歸檔狀態更新資料 */
interface ArchiveStatusData {
  archivedToType: string
  archivedToId: number
  archivedByUserId?: number | null
  archivedByUsername: string
}

/** 歸檔為付款項目的資料 */
interface ArchiveToPaymentItemData {
  projectId?: number | null
  categoryId?: number | null
  itemName: string
  totalAmount: string
  startDate: string
  endDate?: string | null
  notes: string
  source: string
  sourceDocumentId: number
  documentUploadedAt: Date | null
  documentUploadedByUserId?: number | null
  documentUploadedByUsername?: string | null
  archivedByUserId?: number | null
  archivedByUsername: string
}

/** 歸檔為付款記錄的資料 */
interface ArchiveToPaymentRecordData {
  itemId: number
  amountPaid: string
  paymentDate: string
  paymentMethod: string
  receiptImageUrl: string
  notes: string
}

/** 歸檔為發票記錄的資料 */
interface ArchiveToInvoiceData {
  userId?: number | null
  invoiceNumber?: string | null
  invoiceDate: string
  vendorName?: string | null
  vendorTaxId?: string | null
  totalAmount: string
  taxAmount?: string | null
  subtotal?: string | null
  category?: string | null
  description?: string | null
  invoiceType: string
  paymentItemId?: number | null
  paymentRecordId?: number | null
  documentInboxId: number
  imagePath: string
  taxYear: number
  taxMonth: number
  notes: string
}

/** 統計項目的狀態計數 */
interface StatusCounts {
  pending: number
  processing: number
  recognized: number
  failed: number
  total: number
}

/** 統計摘要 */
interface DocumentInboxStats {
  bill: StatusCounts
  payment: StatusCounts
  invoice: StatusCounts
  totalPending: number
}

/** documentInbox 允許更新的欄位（白名單） */
interface DocumentInboxUpdateFields {
  documentType?: string
  status?: string
  notes?: string | null
  userConfirmed?: boolean
  confirmedVendor?: string | null
  confirmedAmount?: string | null
  confirmedDate?: string | null
  confirmedDescription?: string | null
  confirmedCategory?: string | null
  tags?: string[] | null
  recognizedVendor?: string | null
  recognizedAmount?: string | null
  recognizedDate?: string | null
  recognizedDescription?: string | null
  recognizedCategory?: string | null
  recognizedInvoiceNumber?: string | null
}

// --- documentInbox CRUD ---

/** 取得文件收件箱項目列表（支援篩選） */
export async function getDocumentInboxItems(
  filters?: DocumentInboxFilters
): Promise<DocumentInbox[]> {
  const conditions = []

  if (filters?.status && filters.status !== "all") {
    conditions.push(eq(documentInbox.status, filters.status))
  } else {
    conditions.push(sql`${documentInbox.status} != 'archived'`)
  }

  if (filters?.documentType && filters.documentType !== "all") {
    conditions.push(eq(documentInbox.documentType, filters.documentType))
  }

  return await db
    .select()
    .from(documentInbox)
    .where(and(...conditions))
    .orderBy(desc(documentInbox.createdAt))
}

/** 取得單一文件收件箱項目 */
export async function getDocumentInboxItem(
  id: number
): Promise<DocumentInbox | undefined> {
  const [doc] = await db
    .select()
    .from(documentInbox)
    .where(eq(documentInbox.id, id))
  return doc
}

/** 建立文件收件箱項目 */
export async function createDocumentInboxItem(
  data: CreateDocumentInboxData
): Promise<DocumentInbox> {
  const [newDoc] = await db
    .insert(documentInbox)
    .values({
      userId: data.userId,
      documentType: data.documentType,
      status: data.status,
      imagePath: data.imagePath,
      originalFilename: data.originalFilename,
      notes: data.notes,
      uploadedByUsername: data.uploadedByUsername,
    })
    .returning()
  return newDoc
}

/** 更新文件收件箱項目（自動設定 updatedAt） */
export async function updateDocumentInboxItem(
  id: number,
  data: Partial<DocumentInboxUpdateFields>
): Promise<DocumentInbox | undefined> {
  const [updated] = await db
    .update(documentInbox)
    .set({ ...data, updatedAt: new Date() } as Partial<DocumentInboxInsert>)
    .where(eq(documentInbox.id, id))
    .returning()
  return updated
}

/** 刪除文件收件箱項目 */
export async function deleteDocumentInboxItem(id: number): Promise<void> {
  await db.delete(documentInbox).where(eq(documentInbox.id, id))
}

/** 取得文件收件箱統計（按 documentType + status 分組） */
export async function getDocumentInboxStats(): Promise<DocumentInboxStats> {
  const stats = await db
    .select({
      documentType: documentInbox.documentType,
      status: documentInbox.status,
      count: sql<number>`count(*)::int`,
    })
    .from(documentInbox)
    .where(sql`${documentInbox.status} != 'archived'`)
    .groupBy(documentInbox.documentType, documentInbox.status)

  const summary: DocumentInboxStats = {
    bill: { pending: 0, processing: 0, recognized: 0, failed: 0, total: 0 },
    payment: { pending: 0, processing: 0, recognized: 0, failed: 0, total: 0 },
    invoice: { pending: 0, processing: 0, recognized: 0, failed: 0, total: 0 },
    totalPending: 0,
  }

  for (const stat of stats) {
    const type = stat.documentType as "bill" | "payment" | "invoice"
    if (type in summary && typeof summary[type] === "object") {
      const statusKey = stat.status as keyof StatusCounts
      const typeSummary = summary[type]
      if (statusKey in typeSummary) {
        typeSummary[statusKey] = stat.count
        typeSummary.total += stat.count
      }
    }
  }

  summary.totalPending =
    summary.bill.total + summary.payment.total + summary.invoice.total

  return summary
}

// --- 輔助查詢 ---

/** 取得使用者顯示名稱 */
export async function getUserDisplayName(
  userId: number
): Promise<UserDisplayName | undefined> {
  const [user] = await db
    .select({ username: users.username, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, userId))
  return user
}

// --- AI 辨識更新 ---

/** 更新文件的 AI 辨識結果 */
export async function updateDocumentAiResult(
  id: number,
  result: AiRecognitionResult
): Promise<void> {
  if (result.success) {
    const recognizedDate =
      result.extractedData.date && result.extractedData.date.trim() !== ""
        ? result.extractedData.date
        : null

    await db
      .update(documentInbox)
      .set({
        status: "recognized",
        aiRecognized: true,
        aiConfidence: result.confidence.toString(),
        aiExtractedData: result.extractedData,
        aiRawResponse: result.rawResponse,
        recognizedVendor: result.extractedData.vendor || null,
        recognizedAmount: result.extractedData.amount?.toString() || null,
        recognizedDate: recognizedDate,
        recognizedDescription: result.extractedData.description || null,
        recognizedCategory: result.extractedData.category || null,
        recognizedInvoiceNumber: result.extractedData.invoiceNumber || null,
        updatedAt: new Date(),
      })
      .where(eq(documentInbox.id, id))
  } else {
    const updateData: Partial<DocumentInboxInsert> = {
      status: "failed",
      aiRecognized: false,
      updatedAt: new Date(),
    }

    if (result.notes) {
      updateData.notes = result.notes
    }

    await db
      .update(documentInbox)
      .set(updateData)
      .where(eq(documentInbox.id, id))
  }
}

/** 設定文件狀態為處理中 */
export async function setDocumentProcessing(id: number): Promise<void> {
  await db
    .update(documentInbox)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(documentInbox.id, id))
}

/** 設定文件狀態為失敗 */
export async function setDocumentFailed(id: number): Promise<void> {
  await db
    .update(documentInbox)
    .set({ status: "failed", updatedAt: new Date() })
    .where(eq(documentInbox.id, id))
}

/** 更新文件備註（含編輯者資訊） */
export async function updateDocumentNotes(
  id: number,
  notes: string | null,
  editedByUserId: number | null | undefined,
  editedByUsername: string
): Promise<DocumentInbox | undefined> {
  const [updated] = await db
    .update(documentInbox)
    .set({
      notes: notes || null,
      editedByUserId: editedByUserId,
      editedByUsername,
      editedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(documentInbox.id, id))
    .returning()
  return updated
}

// --- 歸檔操作（使用 transaction） ---

/** 歸檔為付款項目（transaction：建立 paymentItem + 更新 documentInbox） */
export async function archiveToPaymentItem(
  docId: number,
  paymentItemData: ArchiveToPaymentItemData,
  archiveData: ArchiveStatusData
): Promise<PaymentItem> {
  return await db.transaction(async (tx) => {
    const now = new Date()

    const [newItem] = await tx
      .insert(paymentItems)
      .values({
        projectId: paymentItemData.projectId,
        categoryId: paymentItemData.categoryId,
        itemName: paymentItemData.itemName,
        totalAmount: paymentItemData.totalAmount,
        paidAmount: "0",
        status: "unpaid",
        startDate: paymentItemData.startDate,
        endDate: paymentItemData.endDate,
        notes: paymentItemData.notes,
        createdAt: now,
        updatedAt: now,
        source: paymentItemData.source,
        sourceDocumentId: paymentItemData.sourceDocumentId,
        documentUploadedAt: paymentItemData.documentUploadedAt,
        documentUploadedByUserId: paymentItemData.documentUploadedByUserId,
        documentUploadedByUsername: paymentItemData.documentUploadedByUsername,
        archivedByUserId: paymentItemData.archivedByUserId,
        archivedByUsername: paymentItemData.archivedByUsername,
        archivedAt: now,
      })
      .returning()

    await tx
      .update(documentInbox)
      .set({
        status: "archived",
        archivedToType: archiveData.archivedToType,
        archivedToId: newItem.id,
        archivedAt: now,
        archivedByUserId: archiveData.archivedByUserId,
        archivedByUsername: archiveData.archivedByUsername,
        updatedAt: now,
      })
      .where(eq(documentInbox.id, docId))

    return newItem
  })
}

/** 歸檔為付款記錄（transaction：建立 paymentRecord + 更新 paymentItem 已付金額 + 更新 documentInbox） */
export async function archiveToPaymentRecord(
  docId: number,
  recordData: ArchiveToPaymentRecordData,
  archiveData: ArchiveStatusData
): Promise<PaymentRecord> {
  return await db.transaction(async (tx) => {
    const now = new Date()

    const [newRecord] = await tx
      .insert(paymentRecords)
      .values({
        itemId: recordData.itemId,
        amountPaid: recordData.amountPaid,
        paymentDate: recordData.paymentDate,
        paymentMethod: recordData.paymentMethod,
        receiptImageUrl: recordData.receiptImageUrl,
        notes: recordData.notes,
      })
      .returning()

    // 更新付款項目已付金額
    const [item] = await tx
      .select()
      .from(paymentItems)
      .where(eq(paymentItems.id, recordData.itemId))

    if (item) {
      const newPaidAmount =
        parseFloat(item.paidAmount || "0") +
        parseFloat(newRecord.amountPaid || "0")
      const newStatus =
        newPaidAmount >= parseFloat(item.totalAmount || "0")
          ? "paid"
          : "partial"

      await tx
        .update(paymentItems)
        .set({
          paidAmount: newPaidAmount.toFixed(2),
          status: newStatus,
          updatedAt: now,
        })
        .where(eq(paymentItems.id, recordData.itemId))
    }

    await tx
      .update(documentInbox)
      .set({
        status: "archived",
        archivedToType: archiveData.archivedToType,
        archivedToId: newRecord.id,
        archivedAt: now,
        archivedByUserId: archiveData.archivedByUserId,
        archivedByUsername: archiveData.archivedByUsername,
        updatedAt: now,
      })
      .where(eq(documentInbox.id, docId))

    return newRecord
  })
}

/** 歸檔為發票記錄（transaction：建立 invoiceRecord + 更新 documentInbox） */
export async function archiveToInvoiceRecord(
  docId: number,
  invoiceData: ArchiveToInvoiceData,
  archiveData: ArchiveStatusData
): Promise<InvoiceRecord> {
  return await db.transaction(async (tx) => {
    const now = new Date()

    const [newInvoice] = await tx
      .insert(invoiceRecords)
      .values({
        userId: invoiceData.userId,
        invoiceNumber: invoiceData.invoiceNumber,
        invoiceDate: invoiceData.invoiceDate,
        vendorName: invoiceData.vendorName,
        vendorTaxId: invoiceData.vendorTaxId,
        totalAmount: invoiceData.totalAmount,
        taxAmount: invoiceData.taxAmount,
        subtotal: invoiceData.subtotal,
        category: invoiceData.category,
        description: invoiceData.description,
        invoiceType: invoiceData.invoiceType,
        paymentItemId: invoiceData.paymentItemId,
        paymentRecordId: invoiceData.paymentRecordId,
        documentInboxId: invoiceData.documentInboxId,
        imagePath: invoiceData.imagePath,
        taxYear: invoiceData.taxYear,
        taxMonth: invoiceData.taxMonth,
        notes: invoiceData.notes,
      })
      .returning()

    await tx
      .update(documentInbox)
      .set({
        status: "archived",
        archivedToType: archiveData.archivedToType,
        archivedToId: newInvoice.id,
        archivedAt: now,
        archivedByUserId: archiveData.archivedByUserId,
        archivedByUsername: archiveData.archivedByUsername,
        updatedAt: now,
      })
      .where(eq(documentInbox.id, docId))

    return newInvoice
  })
}
