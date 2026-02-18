/**
 * PM 旅館系統 → Money 橋接模組
 *
 * 策略：直接唯讀連線 PM PostgreSQL，將 revenues 資料
 * 轉換為 incomeWebhooks 記錄，供人工批次確認。
 *
 * 原則：
 * - 僅做 SELECT，絕不修改 PM 任何資料
 * - 以 `pm_bridge_${revenue.id}` 作為外部交易 ID 防止重複匯入
 * - 支援依日期區間增量同步
 */

import { Pool } from "pg"
import { db } from "../db"
import { incomeSources, incomeWebhooks } from "@shared/schema"
import { eq, and, isNull } from "drizzle-orm"

// ─────────────────────────────────────────────
// PM 資料庫連線（唯讀用途）
// ─────────────────────────────────────────────

function createPmPool(): Pool {
  const connStr = process.env.PM_DATABASE_URL
  if (!connStr) {
    throw new Error("環境變數 PM_DATABASE_URL 未設定")
  }
  return new Pool({ connectionString: connStr, max: 3 })
}

// ─────────────────────────────────────────────
// 型別定義
// ─────────────────────────────────────────────

interface PmRevenue {
  id: number
  date: string        // ISO date string
  source: string | null
  amount: string      // decimal string
  description: string | null
  company_id: number | null
  order_number: string | null
  payment_method: string | null
  notes: string | null
}

interface PmCompany {
  id: number
  name: string
}

export interface SyncResult {
  synced: number      // 新匯入筆數
  skipped: number     // 已存在、略過筆數
  errors: number      // 錯誤筆數
  period: { startDate: string; endDate: string }
  sourceId: number
}

// ─────────────────────────────────────────────
// 取得或建立 PM Bridge 的 income source 設定
// ─────────────────────────────────────────────

/**
 * 確保 PM Bridge 的 income_sources 設定存在
 * 若不存在則自動建立（一次性初始化）
 */
export async function ensurePmBridgeSource(): Promise<number> {
  const existing = await db
    .select({ id: incomeSources.id })
    .from(incomeSources)
    .where(eq(incomeSources.sourceKey, "pm-bridge"))
    .limit(1)

  if (existing.length > 0) return existing[0].id

  // 自動建立預設來源設定
  const [created] = await db
    .insert(incomeSources)
    .values({
      sourceName: "浯島旅館系統 (PM)",
      sourceKey: "pm-bridge",
      sourceType: "custom_api",
      description: "從 PM 旅館管理系統直接同步收入記錄（唯讀橋接）",
      authType: "token",
      isActive: true,
      autoConfirm: false,
      fieldMapping: {},
      allowedIps: [],
      defaultCurrency: "TWD",
    })
    .returning({ id: incomeSources.id })

  return created.id
}

// ─────────────────────────────────────────────
// 從 PM 資料庫拉取收入資料
// ─────────────────────────────────────────────

/**
 * 從 PM revenues 表讀取指定日期區間的記錄
 * 僅唯讀，不做任何寫入
 */
async function fetchPmRevenues(
  startDate: string,
  endDate: string,
  companyId?: number
): Promise<{ revenues: PmRevenue[]; companies: Map<number, string> }> {
  const pool = createPmPool()
  try {
    // 取得館舍名稱對照
    const companyResult = await pool.query<PmCompany>(
      "SELECT id, name FROM companies ORDER BY id"
    )
    const companies = new Map<number, string>()
    companyResult.rows.forEach((c) => companies.set(c.id, c.name))

    // 查詢 revenues（僅唯讀 SELECT）
    let query = `
      SELECT
        id,
        date::text AS date,
        source,
        amount,
        description,
        company_id,
        order_number,
        payment_method,
        notes
      FROM revenues
      WHERE deleted_at IS NULL
        AND date::date >= $1::date
        AND date::date <= $2::date
    `
    const params: (string | number)[] = [startDate, endDate]

    if (companyId) {
      query += ` AND company_id = $${params.length + 1}`
      params.push(companyId)
    }

    query += " ORDER BY date DESC, id DESC"

    const result = await pool.query<PmRevenue>(query, params)
    return { revenues: result.rows, companies }
  } finally {
    await pool.end()
  }
}

// ─────────────────────────────────────────────
// 主要同步函式
// ─────────────────────────────────────────────

/**
 * 將 PM 收入資料同步到 Money 的 incomeWebhooks
 *
 * @param startDate  起始日期 YYYY-MM-DD
 * @param endDate    結束日期 YYYY-MM-DD
 * @param companyId  可選，指定單一館舍
 */
export async function syncPmRevenues(
  startDate: string,
  endDate: string,
  companyId?: number
): Promise<SyncResult> {
  const sourceId = await ensurePmBridgeSource()
  const { revenues, companies } = await fetchPmRevenues(startDate, endDate, companyId)

  let synced = 0
  let skipped = 0
  let errors = 0

  for (const rev of revenues) {
    const externalTxId = `pm_${rev.id}`

    try {
      // 檢查是否已匯入（防重複）
      const exists = await db
        .select({ id: incomeWebhooks.id })
        .from(incomeWebhooks)
        .where(
          and(
            eq(incomeWebhooks.sourceId, sourceId),
            eq(incomeWebhooks.externalTransactionId, externalTxId)
          )
        )
        .limit(1)

      if (exists.length > 0) {
        skipped++
        continue
      }

      const companyName = rev.company_id ? (companies.get(rev.company_id) ?? `館舍#${rev.company_id}`) : null
      const source = rev.source ?? "未分類"

      // 組合描述
      const parts: string[] = []
      if (companyName) parts.push(companyName)
      if (source) parts.push(source)
      if (rev.description && rev.description !== source) parts.push(rev.description)
      const description = parts.join(" · ")

      // PM 的 date 欄位存的是 UTC 前一日午夜（UTC+8 關係），需轉換為台灣日期
      // 例：2026-02-15T16:00:00Z = 台灣 2026-02-16 00:00
      const utcDate = new Date(rev.date)
      const twDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000)
      const dateStr = twDate.toISOString().slice(0, 10)  // 台灣當地 YYYY-MM-DD

      // 組合原始 payload（完整保留 PM 資料）
      const rawPayload = {
        _source: "pm-bridge",
        pm_id: rev.id,
        date: dateStr, // 台灣日期 (UTC+8)
        source: rev.source,
        amount: rev.amount,
        description: rev.description,
        company_id: rev.company_id,
        company_name: companyName,
        order_number: rev.order_number,
        payment_method: rev.payment_method,
        notes: rev.notes,
      }

      await db.insert(incomeWebhooks).values({
        sourceId,
        externalTransactionId: externalTxId,
        rawPayload,
        parsedAmount: rev.amount,
        parsedCurrency: "TWD",
        parsedAmountTwd: rev.amount,
        parsedDescription: description,
        parsedPaidAt: new Date(dateStr),
        parsedOrderId: rev.order_number ?? undefined,
        parsedPayerName: companyName ?? source,
        signatureValid: true,
        status: "pending",
        requestIp: "internal",
        requestHeaders: { "x-bridge": "pm-db-sync" },
      })

      synced++
    } catch (err) {
      console.error(`[pm-bridge] 匯入 revenue#${rev.id} 失敗:`, err)
      errors++
    }
  }

  // 更新來源統計（先計算筆數，再更新，避免 circular JSON）
  if (synced > 0) {
    const countResult = await db
      .select({ id: incomeWebhooks.id })
      .from(incomeWebhooks)
      .where(eq(incomeWebhooks.sourceId, sourceId))
    await db
      .update(incomeSources)
      .set({
        totalReceived: countResult.length,
        lastReceivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(incomeSources.id, sourceId))
  }

  return { synced, skipped, errors, period: { startDate, endDate }, sourceId }
}

// ─────────────────────────────────────────────
// 預覽（不寫入，只回傳會匯入的資料）
// ─────────────────────────────────────────────

export interface PmRevenuePreview {
  pmId: number
  date: string
  source: string
  amount: string
  companyName: string | null
  description: string
  alreadyImported: boolean
}

export async function previewPmRevenues(
  startDate: string,
  endDate: string,
  companyId?: number
): Promise<PmRevenuePreview[]> {
  const sourceId = await ensurePmBridgeSource()
  const { revenues, companies } = await fetchPmRevenues(startDate, endDate, companyId)

  // 查出已匯入的 externalTransactionId
  const existingTxIds = new Set(
    (
      await db
        .select({ externalTransactionId: incomeWebhooks.externalTransactionId })
        .from(incomeWebhooks)
        .where(eq(incomeWebhooks.sourceId, sourceId))
    ).map((r) => r.externalTransactionId)
  )

  return revenues.map((rev) => {
    const companyName = rev.company_id ? (companies.get(rev.company_id) ?? null) : null
    const source = rev.source ?? "未分類"
    const parts: string[] = []
    if (companyName) parts.push(companyName)
    if (source) parts.push(source)
    if (rev.description && rev.description !== source) parts.push(rev.description)

    const utcD = new Date(rev.date)
    const twD = new Date(utcD.getTime() + 8 * 60 * 60 * 1000)
    return {
      pmId: rev.id,
      date: twD.toISOString().slice(0, 10), // 台灣日期
      source,
      amount: rev.amount,
      companyName,
      description: parts.join(" · "),
      alreadyImported: existingTxIds.has(`pm_${rev.id}`),
    }
  })
}
