/**
 * PMS 績效管理系統 → Money 橋接模組
 *
 * PMS 特性：
 * - performance_entries 記錄每月累計收入（每次更新都是當月累計值）
 * - 同一月份有多筆記錄，取最後一筆（最大 date）= 當月實際收入
 * - 有 4 個分店：浯島文旅/輕旅、總兵招待所、魁星背包棧
 *
 * 策略：
 * - 僅 SELECT，絕不修改 PMS 資料
 * - source_key = "pms-bridge"
 * - external_transaction_id = "pms_{branch_id}_{YYYY-MM}" 防止重複
 * - 每月每分店只有一筆，月底重跑會 upsert 更新最新值
 *
 * 雲端化注意：
 * - PMS_DATABASE_URL 環境變數未來改為雲端 DB URL 即可
 * - 不依賴本地 docker 容器名稱
 */

import { Pool } from "pg"
import { db } from "../db"
import { incomeSources, incomeWebhooks } from "@shared/schema"
import { eq } from "drizzle-orm"

// ─────────────────────────────────────────────
// PMS 資料庫連線（唯讀）
// ─────────────────────────────────────────────

function createPmsPool(): Pool {
  const connStr = process.env.PMS_DATABASE_URL
  if (!connStr) {
    throw new Error("環境變數 PMS_DATABASE_URL 未設定")
  }
  return new Pool({ connectionString: connStr, max: 3 })
}

// ─────────────────────────────────────────────
// 型別定義
// ─────────────────────────────────────────────

interface PmsBranch {
  id: number
  name: string
  code: string
  business_type: string | null
}

interface PmsMonthlyRevenue {
  branch_id: number
  branch_name: string
  branch_code: string
  month: string          // YYYY-MM
  last_entry_date: string // 最後更新日期
  revenue: string         // 當月實際收入（最後一筆累計值）
}

export interface PmsSyncResult {
  synced: number
  skipped: number
  updated: number
  errors: number
  period: { startMonth: string; endMonth: string }
  sourceId: number
  details: Array<{ month: string; branch: string; amount: number; action: string }>
}

// ─────────────────────────────────────────────
// 確保 PMS Bridge income_source 設定
// ─────────────────────────────────────────────

export async function ensurePmsBridgeSource(): Promise<number> {
  const existing = await db
    .select({ id: incomeSources.id })
    .from(incomeSources)
    .where(eq(incomeSources.sourceKey, "pms-bridge"))
    .limit(1)

  if (existing.length > 0) return existing[0].id

  const [created] = await db
    .insert(incomeSources)
    .values({
      sourceName: "浯島 PMS 績效管理系統",
      sourceKey: "pms-bridge",
      sourceType: "custom_api",
      description: "從 PMS 績效管理系統同步月度收入（含4個分店：浯島文旅/輕旅、總兵招待所、魁星背包棧）",
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
// 從 PMS 拉取月度收入（每月每分店取最後一筆）
// ─────────────────────────────────────────────

async function fetchPmsMonthlyRevenues(
  startMonth: string,
  endMonth: string
): Promise<{ revenues: PmsMonthlyRevenue[]; branches: PmsBranch[] }> {
  const pool = createPmsPool()
  try {
    // 取得所有分店
    const branchResult = await pool.query<PmsBranch>(
      "SELECT id, name, code, business_type FROM branches ORDER BY id"
    )
    const branches = branchResult.rows

    // 每月每分店取最後一筆（即最大日期的記錄 = 最新累計值）
    const result = await pool.query<PmsMonthlyRevenue>(`
      WITH latest_per_month AS (
        SELECT DISTINCT ON (branch_id, TO_CHAR(date, 'YYYY-MM'))
          pe.branch_id,
          b.name  AS branch_name,
          b.code  AS branch_code,
          TO_CHAR(pe.date, 'YYYY-MM')        AS month,
          pe.date::text                       AS last_entry_date,
          pe.current_month_revenue::text      AS revenue
        FROM performance_entries pe
        JOIN branches b ON b.id = pe.branch_id
        WHERE TO_CHAR(pe.date, 'YYYY-MM') >= $1
          AND TO_CHAR(pe.date, 'YYYY-MM') <= $2
        ORDER BY branch_id, TO_CHAR(pe.date, 'YYYY-MM'), pe.date DESC
      )
      SELECT * FROM latest_per_month
      ORDER BY month, branch_id
    `, [startMonth, endMonth])

    return { revenues: result.rows, branches }
  } finally {
    await pool.end()
  }
}

// ─────────────────────────────────────────────
// 同步 PMS 月度收入到 income_webhooks
// ─────────────────────────────────────────────

export async function syncPmsRevenues(
  startMonth: string = "2025-07",
  endMonth: string = new Date().toISOString().slice(0, 7)
): Promise<PmsSyncResult> {
  const sourceId = await ensurePmsBridgeSource()
  const { revenues } = await fetchPmsMonthlyRevenues(startMonth, endMonth)

  const result: PmsSyncResult = {
    synced: 0,
    skipped: 0,
    updated: 0,
    errors: 0,
    period: { startMonth, endMonth },
    sourceId,
    details: [],
  }

  for (const rev of revenues) {
    // external ID 格式：pms_{branchId}_{YYYY-MM}
    const externalId = `pms_${rev.branch_id}_${rev.month}`
    const amount = parseFloat(rev.revenue)

    if (isNaN(amount) || amount <= 0) continue

    try {
      // 用月底日期作為 parsedPaidAt（月份最後一天 23:59:59）
      // 直接存台灣日期 midnight，避免時區問題
      const lastDayOfMonth = new Date(`${rev.month}-01`)
      lastDayOfMonth.setMonth(lastDayOfMonth.getMonth() + 1)
      lastDayOfMonth.setDate(0) // 月底
      const twDateStr = lastDayOfMonth.toISOString().slice(0, 10) // YYYY-MM-DD

      // 檢查是否已存在
      const existing = await db
        .select({
          id: incomeWebhooks.id,
          amount: incomeWebhooks.parsedAmountTwd,
        })
        .from(incomeWebhooks)
        .where(eq(incomeWebhooks.externalTransactionId, externalId))
        .limit(1)

      if (existing.length > 0) {
        const existingAmount = parseFloat(existing[0].amount ?? "0")

        // 若金額有變化（月中重跑），更新金額
        if (Math.abs(existingAmount - amount) > 0.01) {
          await db
            .update(incomeWebhooks)
            .set({
              parsedAmountTwd: amount.toFixed(2),
              parsedPaidAt: new Date(twDateStr),
              rawPayload: buildRawPayload(rev),
              updatedAt: new Date(),
            })
            .where(eq(incomeWebhooks.externalTransactionId, externalId))

          result.updated++
          result.details.push({
            month: rev.month,
            branch: rev.branch_name,
            amount,
            action: `updated (${existingAmount} → ${amount})`,
          })
        } else {
          result.skipped++
        }
        continue
      }

      // 新增記錄
      await db.insert(incomeWebhooks).values({
        sourceId,
        externalTransactionId: externalId,
        status: "pending",
        rawPayload: buildRawPayload(rev),
        parsedAmountTwd: amount.toFixed(2),
        parsedPaidAt: new Date(twDateStr),
        parsedPayerName: rev.branch_name,
        parsedDescription: `PMS 月度收入 ${rev.month} - ${rev.branch_name}（${rev.branch_code}）`,
        parsedCurrency: "TWD",
      })

      result.synced++
      result.details.push({
        month: rev.month,
        branch: rev.branch_name,
        amount,
        action: "synced",
      })
    } catch (err) {
      result.errors++
      console.error(`[PMS Bridge] 同步失敗 ${externalId}:`, err)
    }
  }

  return result
}

// ─────────────────────────────────────────────
// 預覽（不寫入）
// ─────────────────────────────────────────────

export async function previewPmsRevenues(
  startMonth: string,
  endMonth: string
): Promise<{
  revenues: PmsMonthlyRevenue[]
  branches: PmsBranch[]
  summary: { month: string; total: number; branches: number }[]
}> {
  const { revenues, branches } = await fetchPmsMonthlyRevenues(startMonth, endMonth)

  // 按月匯總
  const monthMap = new Map<string, { total: number; branches: Set<number> }>()
  for (const rev of revenues) {
    if (!monthMap.has(rev.month)) {
      monthMap.set(rev.month, { total: 0, branches: new Set() })
    }
    const m = monthMap.get(rev.month)!
    m.total += parseFloat(rev.revenue)
    m.branches.add(rev.branch_id)
  }

  const summary = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { total, branches: bSet }]) => ({
      month,
      total,
      branches: bSet.size,
    }))

  return { revenues, branches, summary }
}

// ─────────────────────────────────────────────
// 工具函式
// ─────────────────────────────────────────────

function buildRawPayload(rev: PmsMonthlyRevenue): Record<string, unknown> {
  return {
    source: "pms-bridge",
    branch_id: rev.branch_id,
    branch_name: rev.branch_name,
    branch_code: rev.branch_code,
    month: rev.month,
    last_entry_date: rev.last_entry_date,
    revenue: rev.revenue,
    date: `${rev.month}-${lastDayOfMonthStr(rev.month)}`, // YYYY-MM-DD 台灣日期
  }
}

function lastDayOfMonthStr(month: string): string {
  const d = new Date(`${month}-01`)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return String(d.getDate()).padStart(2, "0")
}
