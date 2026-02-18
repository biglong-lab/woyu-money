import { db } from "../db"
import {
  incomeSources,
  incomeWebhooks,
  paymentItems,
  paymentRecords,
  type IncomeSource,
  type InsertIncomeSource,
  type IncomeWebhook,
  type InsertIncomeWebhook,
  type ConfirmWebhookInput,
  type BatchConfirmWebhookInput,
} from "@shared/schema"
import { eq, and, desc, isNull, inArray, sql } from "drizzle-orm"
import * as crypto from "crypto"

// ─────────────────────────────────────────────
// 工具函式
// ─────────────────────────────────────────────

/**
 * 用 JSONPath 風格的路徑從物件中取值
 * 支援 $.a.b.c 或 a.b.c 格式
 */
function getValueByPath(obj: unknown, path: string): unknown {
  if (!path || !obj) return undefined
  const keys = path.replace(/^\$\.?/, "").split(".")
  let current: unknown = obj
  for (const key of keys) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/**
 * 驗證 HMAC-SHA256 簽名
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
  // 時間常數比較，防止 timing attack
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature.replace(/^sha256=/, ""), "hex"),
      Buffer.from(expected, "hex")
    )
  } catch {
    return false
  }
}

/**
 * 驗證 Bearer Token
 */
export function verifyBearerToken(token: string, expected: string): boolean {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expected)
    )
  } catch {
    return false
  }
}

/**
 * 驗證 IP 白名單
 */
export function verifyIpAllowlist(ip: string, allowedIps: string[]): boolean {
  if (!allowedIps || allowedIps.length === 0) return true // 空白名單表示全部允許
  return allowedIps.includes(ip)
}

// ─────────────────────────────────────────────
// 進帳來源 CRUD
// ─────────────────────────────────────────────

export async function getIncomeSources(): Promise<IncomeSource[]> {
  return await db
    .select()
    .from(incomeSources)
    .orderBy(desc(incomeSources.createdAt))
}

export async function getIncomeSourceById(id: number): Promise<IncomeSource | null> {
  const [row] = await db
    .select()
    .from(incomeSources)
    .where(eq(incomeSources.id, id))
  return row ?? null
}

export async function getIncomeSourceByKey(sourceKey: string): Promise<IncomeSource | null> {
  const [row] = await db
    .select()
    .from(incomeSources)
    .where(and(eq(incomeSources.sourceKey, sourceKey), eq(incomeSources.isActive, true)))
  return row ?? null
}

export async function createIncomeSource(data: InsertIncomeSource): Promise<IncomeSource> {
  const [row] = await db
    .insert(incomeSources)
    .values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
  return row
}

export async function updateIncomeSource(
  id: number,
  data: Partial<InsertIncomeSource>
): Promise<IncomeSource | null> {
  const [row] = await db
    .update(incomeSources)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(incomeSources.id, id))
    .returning()
  return row ?? null
}

export async function deleteIncomeSource(id: number): Promise<boolean> {
  // 停用而非刪除（保留歷史紀錄）
  const [row] = await db
    .update(incomeSources)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(incomeSources.id, id))
    .returning()
  return !!row
}

// ─────────────────────────────────────────────
// Webhook 進帳紀錄
// ─────────────────────────────────────────────

export interface WebhookFilters {
  sourceId?: number
  status?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface WebhookListResult {
  data: IncomeWebhook[]
  total: number
  page: number
  pageSize: number
}

export async function getIncomeWebhooks(filters: WebhookFilters = {}): Promise<WebhookListResult> {
  const { page = 1, pageSize = 20, sourceId, status } = filters

  const conditions = []
  if (sourceId) conditions.push(eq(incomeWebhooks.sourceId, sourceId))
  if (status) conditions.push(eq(incomeWebhooks.status, status))

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(incomeWebhooks)
    .where(whereClause)

  const total = Number(countResult?.count ?? 0)
  const offset = (page - 1) * pageSize

  const data = await db
    .select()
    .from(incomeWebhooks)
    .where(whereClause)
    .orderBy(desc(incomeWebhooks.createdAt))
    .limit(pageSize)
    .offset(offset)

  return { data, total, page, pageSize }
}

export async function getIncomeWebhookById(id: number): Promise<IncomeWebhook | null> {
  const [row] = await db
    .select()
    .from(incomeWebhooks)
    .where(eq(incomeWebhooks.id, id))
  return row ?? null
}

export async function getPendingWebhooksCount(): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(incomeWebhooks)
    .where(eq(incomeWebhooks.status, "pending"))
  return Number(result?.count ?? 0)
}

// ─────────────────────────────────────────────
// Webhook 接收與解析
// ─────────────────────────────────────────────

export interface ParsedWebhookData {
  amount?: number
  currency?: string
  transactionId?: string
  paidAt?: Date
  description?: string
  payerName?: string
  payerContact?: string
  orderId?: string
}

/**
 * 根據來源的 fieldMapping 解析原始 payload
 */
export function parseWebhookPayload(
  rawPayload: unknown,
  fieldMapping: Record<string, string>
): ParsedWebhookData {
  const result: ParsedWebhookData = {}

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
  if (fieldMapping.description) {
    const raw = getValueByPath(rawPayload, fieldMapping.description)
    if (raw !== undefined) result.description = String(raw)
  }
  if (fieldMapping.payerName) {
    const raw = getValueByPath(rawPayload, fieldMapping.payerName)
    if (raw !== undefined) result.payerName = String(raw)
  }
  if (fieldMapping.payerContact) {
    const raw = getValueByPath(rawPayload, fieldMapping.payerContact)
    if (raw !== undefined) result.payerContact = String(raw)
  }
  if (fieldMapping.orderId) {
    const raw = getValueByPath(rawPayload, fieldMapping.orderId)
    if (raw !== undefined) result.orderId = String(raw)
  }

  return result
}

/**
 * 接收並建立一筆 webhook 進帳紀錄
 * - 驗證簽名 / Token
 * - 解析 payload
 * - 檢查重複
 * - 寫入資料庫
 */
export interface ReceiveWebhookInput {
  source: IncomeSource
  rawPayload: unknown
  rawBody: string           // 用於 HMAC 驗證
  signatureHeader?: string  // X-Signature 或 X-Hub-Signature-256
  tokenHeader?: string      // Authorization Bearer
  requestIp?: string
  requestHeaders?: Record<string, string>
}

export interface ReceiveWebhookResult {
  success: boolean
  webhookId?: number
  isDuplicate?: boolean
  error?: string
}

export async function receiveWebhook(input: ReceiveWebhookInput): Promise<ReceiveWebhookResult> {
  const { source, rawPayload, rawBody, signatureHeader, tokenHeader, requestIp, requestHeaders } =
    input

  // 1. 驗證 IP 白名單
  const allowedIps = (source.allowedIps as string[]) ?? []
  if (requestIp && !verifyIpAllowlist(requestIp, allowedIps)) {
    return { success: false, error: "IP 不在白名單中" }
  }

  // 2. 驗證簽名 / Token
  let signatureValid = true
  const authType = source.authType ?? "token"

  if (authType === "token" || authType === "both") {
    if (source.apiToken && tokenHeader) {
      const token = tokenHeader.replace(/^Bearer\s+/i, "")
      if (!verifyBearerToken(token, source.apiToken)) {
        return { success: false, error: "Token 驗證失敗" }
      }
    }
  }

  if (authType === "hmac" || authType === "both") {
    if (source.webhookSecret && signatureHeader) {
      signatureValid = verifyHmacSignature(rawBody, signatureHeader, source.webhookSecret)
      if (!signatureValid) {
        return { success: false, error: "HMAC 簽名驗證失敗" }
      }
    }
  }

  // 3. 解析 payload
  const fieldMapping = (source.fieldMapping as Record<string, string>) ?? {}
  const parsed = parseWebhookPayload(rawPayload, fieldMapping)

  // 4. 檢查重複（同一來源的 externalTransactionId）
  if (parsed.transactionId) {
    const existing = await db
      .select({ id: incomeWebhooks.id })
      .from(incomeWebhooks)
      .where(
        and(
          eq(incomeWebhooks.sourceId, source.id),
          eq(incomeWebhooks.externalTransactionId, parsed.transactionId)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return { success: true, webhookId: existing[0].id, isDuplicate: true }
    }
  }

  // 5. 金額換算（目前記錄原始幣別，台幣直接等值）
  const currency = parsed.currency ?? source.defaultCurrency ?? "TWD"
  const amountTwd =
    currency === "TWD" ? (parsed.amount ?? null) : null // 外幣換算預留，目前為 null

  // 6. 寫入資料庫
  const [webhook] = await db
    .insert(incomeWebhooks)
    .values({
      sourceId: source.id,
      externalTransactionId: parsed.transactionId ?? null,
      rawPayload: rawPayload as Record<string, unknown>,
      parsedAmount: parsed.amount?.toString() ?? null,
      parsedCurrency: currency,
      parsedAmountTwd: amountTwd?.toString() ?? null,
      parsedDescription: parsed.description ?? null,
      parsedPaidAt: parsed.paidAt ?? null,
      parsedPayerName: parsed.payerName ?? null,
      parsedPayerContact: parsed.payerContact ?? null,
      parsedOrderId: parsed.orderId ?? null,
      signatureValid,
      status: source.autoConfirm ? "confirmed" : "pending",
      requestIp: requestIp ?? null,
      requestHeaders: (requestHeaders ?? {}) as Record<string, string>,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  // 7. 更新來源統計
  await db
    .update(incomeSources)
    .set({
      totalReceived: sql`${incomeSources.totalReceived} + 1`,
      lastReceivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(incomeSources.id, source.id))

  // 8. 若 autoConfirm，直接建立 paymentItem + paymentRecord
  if (source.autoConfirm && webhook) {
    await _createPaymentFromWebhook(webhook, {
      projectId: source.defaultProjectId!,
      categoryId: source.defaultCategoryId ?? undefined,
    })
  }

  return { success: true, webhookId: webhook.id }
}

// ─────────────────────────────────────────────
// 人工確認（單筆 / 批次）
// ─────────────────────────────────────────────

export interface ConfirmResult {
  success: boolean
  webhookId: number
  paymentItemId?: number
  paymentRecordId?: number
  error?: string
}

export async function confirmWebhook(
  webhookId: number,
  userId: number,
  input: ConfirmWebhookInput
): Promise<ConfirmResult> {
  const webhook = await getIncomeWebhookById(webhookId)

  if (!webhook) return { success: false, webhookId, error: "找不到此進帳紀錄" }
  if (webhook.status !== "pending")
    return { success: false, webhookId, error: `此紀錄狀態為「${webhook.status}」，無法確認` }
  if (!webhook.parsedAmount)
    return { success: false, webhookId, error: "無法解析金額，請手動建立" }

  const { paymentItemId, paymentRecordId } = await _createPaymentFromWebhook(webhook, input)

  await db
    .update(incomeWebhooks)
    .set({
      status: "confirmed",
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote ?? null,
      linkedItemId: paymentItemId,
      linkedRecordId: paymentRecordId,
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(incomeWebhooks.id, webhookId))

  return { success: true, webhookId, paymentItemId, paymentRecordId }
}

export async function batchConfirmWebhooks(
  userId: number,
  input: BatchConfirmWebhookInput
): Promise<{ results: ConfirmResult[]; successCount: number; failCount: number }> {
  const results: ConfirmResult[] = []

  for (const id of input.ids) {
    const result = await confirmWebhook(id, userId, {
      projectId: input.projectId,
      categoryId: input.categoryId,
      reviewNote: input.reviewNote,
    })
    results.push(result)
  }

  return {
    results,
    successCount: results.filter((r) => r.success).length,
    failCount: results.filter((r) => !r.success).length,
  }
}

export async function rejectWebhook(
  webhookId: number,
  userId: number,
  reviewNote?: string
): Promise<boolean> {
  const [row] = await db
    .update(incomeWebhooks)
    .set({
      status: "rejected",
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      reviewNote: reviewNote ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(incomeWebhooks.id, webhookId), eq(incomeWebhooks.status, "pending")))
    .returning()
  return !!row
}

export async function reprocessWebhook(webhookId: number): Promise<boolean> {
  // 重設狀態為 pending，讓人工重新審核
  const [row] = await db
    .update(incomeWebhooks)
    .set({
      status: "pending",
      linkedItemId: null,
      linkedRecordId: null,
      processedAt: null,
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNote: null,
      updatedAt: new Date(),
    })
    .where(eq(incomeWebhooks.id, webhookId))
    .returning()
  return !!row
}

// ─────────────────────────────────────────────
// 內部：建立 paymentItem + paymentRecord
// ─────────────────────────────────────────────

async function _createPaymentFromWebhook(
  webhook: IncomeWebhook,
  input: Pick<ConfirmWebhookInput, "projectId" | "categoryId" | "itemName">
): Promise<{ paymentItemId: number; paymentRecordId: number }> {
  const amount = webhook.parsedAmountTwd ?? webhook.parsedAmount ?? "0"
  const paidAt = webhook.parsedPaidAt ?? new Date()
  const dateStr = paidAt.toISOString().split("T")[0]

  // 建立 paymentItem（itemType = 'income'）
  const itemName =
    input.itemName ??
    webhook.parsedDescription ??
    `進帳 ${dateStr}`

  const [item] = await db
    .insert(paymentItems)
    .values({
      itemName,
      totalAmount: amount.toString(),
      itemType: "income",
      paymentType: "single",
      projectId: input.projectId,
      categoryId: input.categoryId ?? null,
      startDate: dateStr,
      status: "paid",
      paidAmount: amount.toString(),
      source: "webhook",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  // 建立 paymentRecord
  const [record] = await db
    .insert(paymentRecords)
    .values({
      itemId: item.id,
      amountPaid: amount.toString(),
      paymentDate: dateStr,
      paymentMethod: "webhook",
      notes: [
        webhook.parsedPayerName ? `付款方：${webhook.parsedPayerName}` : null,
        webhook.parsedOrderId ? `訂單號：${webhook.parsedOrderId}` : null,
        webhook.externalTransactionId ? `交易ID：${webhook.externalTransactionId}` : null,
      ]
        .filter(Boolean)
        .join(" | ") || null,
      isPartialPayment: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  return { paymentItemId: item.id, paymentRecordId: record.id }
}
