/**
 * Expense Webhooks 儲存層
 *
 * 鏡像 income.ts 的 receiveWebhook 流程，差異：
 * - 對接 payment_items / payment_records（支出端）
 * - 兩種 webhookMode：as_pending（建 payment_items）/ as_paid（建 payment_records）
 *
 * Helpers（verifyHmac / verifyBearer / verifyIp）直接複用 income.ts 已 export 的版本，
 * 避免重複實作。getValueByPath 本地複製（income 內未 export，未來可重構為 shared util）。
 */
import { db } from "../db"
import {
  expenseSources,
  expenseWebhooks,
  paymentItems,
  paymentRecords,
  type ExpenseSource,
} from "@shared/schema"
import { and, eq, sql } from "drizzle-orm"
import { verifyHmacSignature, verifyBearerToken, verifyIpAllowlist } from "./income"
import { localDateTPE } from "@shared/date-utils"

// ─────────────────────────────────────────────
// JSONPath 解析（複製版，未來抽 shared util）
// ─────────────────────────────────────────────
function getValueByPath(obj: unknown, path: string): unknown {
  if (!path) return undefined
  // 支援 $.a.b.c 或 a.b.c
  const cleanPath = path.startsWith("$.")
    ? path.slice(2)
    : path.startsWith("$")
      ? path.slice(1)
      : path
  const parts = cleanPath.split(".").filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return cur
}

// ─────────────────────────────────────────────
// Payload 解析（依 fieldMapping）
// ─────────────────────────────────────────────
interface ParsedExpenseData {
  amount?: number
  currency?: string
  transactionId?: string
  paidAt?: Date
  dueAt?: Date
  description?: string
  vendor?: string
  invoiceNumber?: string
  categoryHint?: string
  tags?: string[]
}

export function parseExpensePayload(
  rawPayload: unknown,
  fieldMapping: Record<string, string>
): ParsedExpenseData {
  const result: ParsedExpenseData = {}

  if (fieldMapping.amount) {
    const raw = getValueByPath(rawPayload, fieldMapping.amount)
    if (raw !== undefined) result.amount = Number(raw)
  }
  if (fieldMapping.currency) {
    const raw = getValueByPath(rawPayload, fieldMapping.currency)
    if (raw !== undefined) result.currency = String(raw)
  }
  if (fieldMapping.transactionId) {
    const raw = getValueByPath(rawPayload, fieldMapping.transactionId)
    if (raw !== undefined) result.transactionId = String(raw)
  }
  if (fieldMapping.paidAt) {
    const raw = getValueByPath(rawPayload, fieldMapping.paidAt)
    if (raw !== undefined) {
      const d = new Date(String(raw))
      if (!isNaN(d.getTime())) result.paidAt = d
    }
  }
  if (fieldMapping.dueAt) {
    const raw = getValueByPath(rawPayload, fieldMapping.dueAt)
    if (raw !== undefined) {
      const d = new Date(String(raw))
      if (!isNaN(d.getTime())) result.dueAt = d
    }
  }
  if (fieldMapping.description) {
    const raw = getValueByPath(rawPayload, fieldMapping.description)
    if (raw !== undefined) result.description = String(raw)
  }
  if (fieldMapping.vendor) {
    const raw = getValueByPath(rawPayload, fieldMapping.vendor)
    if (raw !== undefined) result.vendor = String(raw)
  }
  if (fieldMapping.invoiceNumber) {
    const raw = getValueByPath(rawPayload, fieldMapping.invoiceNumber)
    if (raw !== undefined) result.invoiceNumber = String(raw)
  }
  if (fieldMapping.categoryHint) {
    const raw = getValueByPath(rawPayload, fieldMapping.categoryHint)
    if (raw !== undefined) result.categoryHint = String(raw)
  }
  if (fieldMapping.tags) {
    const raw = getValueByPath(rawPayload, fieldMapping.tags)
    if (Array.isArray(raw)) result.tags = raw.map(String)
    else if (raw !== undefined) result.tags = [String(raw)]
  }

  return result
}

// ─────────────────────────────────────────────
// CRUD：sources
// ─────────────────────────────────────────────
export async function getExpenseSourceByKey(sourceKey: string): Promise<ExpenseSource | null> {
  const [row] = await db
    .select()
    .from(expenseSources)
    .where(and(eq(expenseSources.sourceKey, sourceKey), eq(expenseSources.isActive, true)))
    .limit(1)
  return row ?? null
}

export async function listExpenseSources(): Promise<ExpenseSource[]> {
  return db.select().from(expenseSources).orderBy(expenseSources.createdAt)
}

export async function getExpenseSourceById(id: number): Promise<ExpenseSource | null> {
  const [row] = await db.select().from(expenseSources).where(eq(expenseSources.id, id)).limit(1)
  return row ?? null
}

export async function getExpenseWebhookById(id: number) {
  const [row] = await db.select().from(expenseWebhooks).where(eq(expenseWebhooks.id, id)).limit(1)
  return row ?? null
}

// ─────────────────────────────────────────────
// Webhook 確認 / 拒絕（將 pending 變 payment_item）
// ─────────────────────────────────────────────
export interface ConfirmExpenseInput {
  projectId: number
  categoryId?: number | null
  itemName?: string | null
  asPaid?: boolean
  paymentMethod?: string | null
  reviewNote?: string | null
}

export async function confirmExpenseWebhook(
  webhookId: number,
  userId: number | null,
  input: ConfirmExpenseInput
): Promise<{ success: boolean; paymentItemId?: number; paymentRecordId?: number; error?: string }> {
  const webhook = await getExpenseWebhookById(webhookId)
  if (!webhook) return { success: false, error: "找不到此帳單紀錄" }
  if (webhook.status !== "pending") {
    return { success: false, error: `此紀錄狀態為「${webhook.status}」、無法確認` }
  }
  if (!webhook.parsedAmount || parseFloat(webhook.parsedAmount) <= 0) {
    return { success: false, error: "無法解析金額" }
  }

  // 取來源資訊（用於標籤、source 值）
  const sourceObj = await getExpenseSourceById(webhook.sourceId)
  const sourceName = sourceObj?.sourceName ?? "外部系統"
  const sourceKey = sourceObj?.sourceKey ?? ""

  const itemName =
    input.itemName || webhook.parsedVendor || webhook.parsedDescription || `帳單 #${webhook.id}`

  const today = localDateTPE()
  const startDate = webhook.parsedPaidAt
    ? webhook.parsedPaidAt.toISOString().split("T")[0]
    : webhook.parsedDueAt
      ? webhook.parsedDueAt.toISOString().split("T")[0]
      : today
  const endDate = webhook.parsedDueAt ? webhook.parsedDueAt.toISOString().split("T")[0] : null

  const amount = webhook.parsedAmount

  // PM 帳單照片（從 rawPayload 取）
  const rawPhoto = (webhook.rawPayload as Record<string, unknown> | null)?.pmInvoicePhoto
  const pmInvoicePhoto = typeof rawPhoto === "string" && rawPhoto ? rawPhoto : null

  // 來源欄位：sourceKey 含 "pm" → 統一寫 "pm"，其他寫 "webhook"
  const isPmSource =
    sourceKey.toLowerCase().includes("pm") || sourceKey.toLowerCase().includes("wd")
  const sourceValue = isPmSource ? "pm" : "webhook"

  // 標籤：來源類型 + sourceKey 識別
  const tagParts = [isPmSource ? "PM系統" : "外部系統"]
  if (sourceKey) tagParts.push(sourceKey)
  const tagsValue = tagParts.join(",")

  // notes：包含原始描述、照片連結、原始 webhook id
  const notesParts: string[] = []
  if (input.reviewNote) notesParts.push(input.reviewNote)
  notesParts.push(`來源：${sourceName} (webhook id=${webhookId})`)
  if (webhook.parsedDescription) notesParts.push(webhook.parsedDescription)
  if (webhook.externalTransactionId)
    notesParts.push(`外部交易編號：${webhook.externalTransactionId}`)
  if (pmInvoicePhoto) notesParts.push(`📷 PM 帳單照片：${pmInvoicePhoto}`)
  const notesValue = notesParts.join("\n")

  return await db.transaction(async (tx) => {
    // 1. 建 payment_item
    const [newItem] = await tx
      .insert(paymentItems)
      .values({
        projectId: input.projectId,
        categoryId: input.categoryId ?? null,
        itemName,
        totalAmount: amount,
        paidAmount: input.asPaid ? amount : "0",
        status: input.asPaid ? "paid" : "unpaid",
        startDate,
        endDate,
        notes: notesValue,
        tags: tagsValue,
        source: sourceValue,
        paymentType: "single",
        itemType: "project",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    let recordId: number | undefined
    if (input.asPaid) {
      const [newRecord] = await tx
        .insert(paymentRecords)
        .values({
          itemId: newItem.id,
          amountPaid: amount,
          paymentDate: webhook.parsedPaidAt
            ? webhook.parsedPaidAt.toISOString().split("T")[0]
            : today,
          paymentMethod: input.paymentMethod || (isPmSource ? "PM 系統" : "外部系統"),
          receiptImageUrl: pmInvoicePhoto,
          notes: `Webhook 確認自動建立${pmInvoicePhoto ? "（含 PM 帳單照片）" : ""}`,
        })
        .returning()
      recordId = newRecord.id
    }

    // 2. 更新 webhook
    await tx
      .update(expenseWebhooks)
      .set({
        status: "confirmed",
        linkedItemId: newItem.id,
        linkedRecordId: recordId ?? null,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote ?? null,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(expenseWebhooks.id, webhookId))

    return { success: true, paymentItemId: newItem.id, paymentRecordId: recordId }
  })
}

export async function batchConfirmExpenseWebhooks(
  ids: number[],
  userId: number | null,
  input: ConfirmExpenseInput
): Promise<{
  successCount: number
  failCount: number
  errors: Array<{ id: number; error: string }>
}> {
  let successCount = 0
  let failCount = 0
  const errors: Array<{ id: number; error: string }> = []
  for (const id of ids) {
    const r = await confirmExpenseWebhook(id, userId, input)
    if (r.success) successCount++
    else {
      failCount++
      errors.push({ id, error: r.error ?? "未知錯誤" })
    }
  }
  return { successCount, failCount, errors }
}

// ─────────────────────────────────────────────
// Webhook 接收主流程
// ─────────────────────────────────────────────
export interface ReceiveExpenseWebhookInput {
  source: ExpenseSource
  rawPayload: unknown
  rawBody: string
  signatureHeader?: string
  tokenHeader?: string
  requestIp?: string
  requestHeaders?: Record<string, string>
}

export interface ReceiveExpenseWebhookResult {
  success: boolean
  webhookId?: number
  isDuplicate?: boolean
  error?: string
}

export async function receiveExpenseWebhook(
  input: ReceiveExpenseWebhookInput
): Promise<ReceiveExpenseWebhookResult> {
  const { source, rawPayload, rawBody, signatureHeader, tokenHeader, requestIp, requestHeaders } =
    input

  // 1. IP 白名單
  const allowedIps = (source.allowedIps as string[]) ?? []
  if (requestIp && !verifyIpAllowlist(requestIp, allowedIps)) {
    return { success: false, error: "IP 不在白名單中" }
  }

  // 2. 簽名 / Token
  let signatureValid = true
  const authType = source.authType ?? "token"

  // SECURITY：authType 設了就嚴格驗證。token/secret 為空時拒絕、不可 silently 放行
  if (authType === "token" || authType === "both") {
    if (!source.apiToken) {
      return { success: false, error: "Token 驗證未設定（請聯絡管理員設定 api_token）" }
    }
    if (!tokenHeader) {
      return { success: false, error: "缺少 Authorization header" }
    }
    const token = tokenHeader.replace(/^Bearer\s+/i, "")
    if (!verifyBearerToken(token, source.apiToken)) {
      return { success: false, error: "Token 驗證失敗" }
    }
  }

  if (authType === "hmac" || authType === "both") {
    if (!source.webhookSecret) {
      return { success: false, error: "HMAC Secret 未設定（請聯絡管理員設定 webhook_secret）" }
    }
    if (!signatureHeader) {
      return { success: false, error: "缺少 X-Signature header" }
    }
    signatureValid = verifyHmacSignature(rawBody, signatureHeader, source.webhookSecret)
    if (!signatureValid) {
      return { success: false, error: "HMAC 簽名驗證失敗" }
    }
  }

  // 3. 解析 payload
  const fieldMapping = (source.fieldMapping as Record<string, string>) ?? {}
  const parsed = parseExpensePayload(rawPayload, fieldMapping)

  // 4. 重複檢查
  if (parsed.transactionId) {
    const existing = await db
      .select({ id: expenseWebhooks.id })
      .from(expenseWebhooks)
      .where(
        and(
          eq(expenseWebhooks.sourceId, source.id),
          eq(expenseWebhooks.externalTransactionId, parsed.transactionId)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return { success: true, webhookId: existing[0].id, isDuplicate: true }
    }
  }

  // 5. 金額（外幣換算預留）
  const currency = parsed.currency ?? source.defaultCurrency ?? "TWD"
  const amountTwd = currency === "TWD" ? (parsed.amount ?? null) : null

  // 6. 標籤合併（source 預設 + payload 帶入）
  const sourceTags = (source.defaultTags as string[]) ?? []
  const payloadTags = parsed.tags ?? []
  const mergedTags = Array.from(new Set([...sourceTags, ...payloadTags]))

  // 7. 寫入
  const [webhook] = await db
    .insert(expenseWebhooks)
    .values({
      sourceId: source.id,
      externalTransactionId: parsed.transactionId ?? null,
      rawPayload: rawPayload as Record<string, unknown>,
      parsedAmount: parsed.amount?.toString() ?? null,
      parsedCurrency: currency,
      parsedAmountTwd: amountTwd?.toString() ?? null,
      parsedDescription: parsed.description ?? null,
      parsedPaidAt: parsed.paidAt ?? null,
      parsedDueAt: parsed.dueAt ?? null,
      parsedVendor: parsed.vendor ?? source.defaultVendor ?? null,
      parsedInvoiceNumber: parsed.invoiceNumber ?? null,
      parsedCategoryHint: parsed.categoryHint ?? null,
      parsedTags: mergedTags,
      signatureValid,
      status: source.autoConfirm ? "confirmed" : "pending",
      requestIp: requestIp ?? null,
      requestHeaders: (requestHeaders ?? {}) as Record<string, string>,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  // 8. 更新統計
  await db
    .update(expenseSources)
    .set({
      totalReceived: sql`${expenseSources.totalReceived} + 1`,
      lastReceivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(expenseSources.id, source.id))

  // 9. autoConfirm 模式：依 webhookMode 建立 payment_items 或 payment_records
  if (source.autoConfirm && webhook && source.defaultProjectId) {
    await _createPaymentFromExpenseWebhook(webhook.id, source, parsed)
  }

  return { success: true, webhookId: webhook.id }
}

/** autoConfirm 時建立對應的 payment_items（as_pending）或 payment_records（as_paid） */
async function _createPaymentFromExpenseWebhook(
  webhookId: number,
  source: ExpenseSource,
  parsed: ParsedExpenseData
): Promise<void> {
  if (!source.defaultProjectId) return
  const amount = parsed.amount ?? 0
  if (amount <= 0) return

  const itemName =
    parsed.description || parsed.invoiceNumber || parsed.vendor || `${source.sourceName} 自動匯入`

  // 建立 payment_item
  const [item] = await db
    .insert(paymentItems)
    .values({
      projectId: source.defaultProjectId,
      categoryId: source.defaultCategoryId ?? null,
      itemName,
      totalAmount: amount.toString(),
      paidAmount: source.webhookMode === "as_paid" ? amount.toString() : "0",
      paymentType: "single",
      itemType: "project",
      status: source.webhookMode === "as_paid" ? "paid" : "pending",
      startDate: (parsed.paidAt ?? parsed.dueAt ?? new Date()).toISOString().split("T")[0],
      endDate: parsed.dueAt?.toISOString().split("T")[0] ?? null,
      source: `webhook:${source.sourceKey}`.slice(0, 20),
      notes: parsed.vendor ? `廠商：${parsed.vendor}` : null,
    })
    .returning()

  // 更新 webhook linkedItemId
  await db
    .update(expenseWebhooks)
    .set({ linkedItemId: item.id, processedAt: new Date(), updatedAt: new Date() })
    .where(eq(expenseWebhooks.id, webhookId))

  // 若 as_paid，建立對應 payment_record
  if (source.webhookMode === "as_paid") {
    const [record] = await db
      .insert(paymentRecords)
      .values({
        itemId: item.id,
        amountPaid: amount.toString(),
        paymentDate: (parsed.paidAt ?? new Date()).toISOString().split("T")[0],
        paymentMethod: "外部系統",
        notes: `Webhook 自動匯入：${source.sourceName}`,
      })
      .returning()

    await db
      .update(expenseWebhooks)
      .set({ linkedRecordId: record.id, updatedAt: new Date() })
      .where(eq(expenseWebhooks.id, webhookId))
  }
}
