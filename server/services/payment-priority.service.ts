/**
 * 付款優先級 Service 層
 *
 * 將 shared/payment-priority 的演算法包裝為服務：
 * - buildPriorityReport / buildAllocation：純函式，易測
 * - getPriorityReport / suggestAllocation：連接 DB
 *
 * 此層為第 3 步「現金分配引擎 API」的基礎。
 *
 * 設計重點：
 * - db 使用 dynamic import 延遲載入，讓單元測試不觸發 db.ts 頂層連線驗證
 * - RawUnpaidRow 型別公開，方便整合測試注入假資料
 */

import {
  sortByPriority,
  groupByUrgency,
  formatPriorityMarkdown,
  type PriorityInput,
  type PriorityResult,
  type UrgencyLevel,
} from "@shared/payment-priority"

// ─────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────

export interface FetchOptions {
  asOf?: Date
  includeLow?: boolean
}

export interface PriorityReport {
  generatedAt: Date
  totalUnpaid: number
  counts: Record<UrgencyLevel, number>
  byUrgency: Record<UrgencyLevel, PriorityResult[]>
  all: PriorityResult[]
}

export interface AllocationInput {
  availableBudget: number
  asOf?: Date
  title?: string
}

export interface AllocationResult {
  generatedAt: Date
  availableBudget: number
  totalNeeded: number
  suggested: PriorityResult[]
  suggestedTotal: number
  deferred: PriorityResult[]
  deferredTotal: number
  shortage: number
  surplus: number
  markdown: string
}

// DB 原始資料型別（金額會以 string 回傳，需轉 number）
export interface RawUnpaidRow {
  id: number
  itemName: string
  totalAmount: string | number
  paidAmount: string | number
  dueDate: string
  fixedCategoryName: string | null
  debtCategoryName: string | null
  projectName: string | null
  notes: string | null
}

// ─────────────────────────────────────────────
// 純函式（易測，不依賴 DB）
// ─────────────────────────────────────────────

export function mapRawRowsToInputs(rows: RawUnpaidRow[]): PriorityInput[] {
  return rows.map((row) => ({
    id: row.id,
    itemName: row.itemName,
    totalAmount: Number(row.totalAmount),
    paidAmount: Number(row.paidAmount),
    dueDate: row.dueDate,
    fixedCategoryName: row.fixedCategoryName,
    debtCategoryName: row.debtCategoryName,
    projectName: row.projectName,
    notes: row.notes,
  }))
}

function countByUrgency(
  byUrgency: Record<UrgencyLevel, PriorityResult[]>
): Record<UrgencyLevel, number> {
  return {
    critical: byUrgency.critical.length,
    high: byUrgency.high.length,
    medium: byUrgency.medium.length,
    low: byUrgency.low.length,
  }
}

export function buildPriorityReport(
  items: PriorityInput[],
  asOf: Date = new Date()
): PriorityReport {
  const sorted = sortByPriority(items, asOf)
  const byUrgency = groupByUrgency(sorted)
  const totalUnpaid = sorted.reduce((sum, r) => sum + r.unpaidAmount, 0)

  return {
    generatedAt: asOf,
    totalUnpaid,
    counts: countByUrgency(byUrgency),
    byUrgency,
    all: sorted,
  }
}

function sumUnpaid(results: PriorityResult[]): number {
  return results.reduce((sum, r) => sum + r.unpaidAmount, 0)
}

const MANDATORY_URGENCY: UrgencyLevel[] = ["critical", "high"]

function isMandatory(result: PriorityResult): boolean {
  return MANDATORY_URGENCY.includes(result.urgency)
}

export function buildAllocation(
  items: PriorityInput[],
  availableBudget: number,
  asOf: Date = new Date()
): AllocationResult {
  const sorted = sortByPriority(items, asOf).filter((r) => r.unpaidAmount > 0)

  const suggested: PriorityResult[] = []
  const deferred: PriorityResult[] = []
  let suggestedTotal = 0

  for (const result of sorted) {
    if (isMandatory(result)) {
      // critical / high：無論預算都必須面對
      suggested.push(result)
      suggestedTotal += result.unpaidAmount
      continue
    }

    if (suggestedTotal + result.unpaidAmount <= availableBudget) {
      suggested.push(result)
      suggestedTotal += result.unpaidAmount
    } else {
      deferred.push(result)
    }
  }

  const deferredTotal = sumUnpaid(deferred)
  const totalNeeded = suggestedTotal + deferredTotal
  const shortage = Math.max(0, suggestedTotal - availableBudget)
  const surplus = Math.max(0, availableBudget - suggestedTotal)

  // 統一用 formatPriorityMarkdown 產 markdown（suggested + deferred 合併）
  const allForMarkdown = [...suggested, ...deferred]
  const markdown = formatPriorityMarkdown(allForMarkdown, {
    now: asOf,
    totalBudget: availableBudget,
    title: "💰 現金分配建議",
  })

  return {
    generatedAt: asOf,
    availableBudget,
    totalNeeded,
    suggested,
    suggestedTotal,
    deferred,
    deferredTotal,
    shortage,
    surplus,
    markdown,
  }
}

// ─────────────────────────────────────────────
// DB 查詢（依賴注入 + 延遲載入）
//
// 設計：把 fetcher 作為依賴，讓單元測試可以注入 mock
// fetchUnpaidRowsFromDb 為預設實作，連線真實資料庫
// ─────────────────────────────────────────────

export type UnpaidItemsFetcher = () => Promise<RawUnpaidRow[]>

const UNPAID_QUERY_SQL = `
  SELECT
    pi.id,
    pi.item_name AS "itemName",
    pi.total_amount AS "totalAmount",
    COALESCE(pi.paid_amount, 0) AS "paidAmount",
    COALESCE(
      (
        SELECT ps.scheduled_date::text
        FROM payment_schedules ps
        WHERE ps.payment_item_id = pi.id
          AND ps.status != 'completed'
        ORDER BY ps.scheduled_date ASC
        LIMIT 1
      ),
      pi.start_date::text
    ) AS "dueDate",
    fc.category_name AS "fixedCategoryName",
    dc.category_name AS "debtCategoryName",
    pp.project_name AS "projectName",
    pi.notes
  FROM payment_items pi
  LEFT JOIN fixed_categories fc ON pi.fixed_category_id = fc.id
  LEFT JOIN debt_categories dc ON pi.category_id = dc.id
  LEFT JOIN payment_projects pp ON pi.project_id = pp.id
  WHERE pi.is_deleted = false
    AND COALESCE(pi.status, 'pending') != 'paid'
    AND (pi.total_amount::numeric - COALESCE(pi.paid_amount, 0)::numeric) > 0
  ORDER BY pi.id
`

export async function fetchUnpaidRowsFromDb(): Promise<RawUnpaidRow[]> {
  const { pool } = await import("../db")
  const result = await pool.query<RawUnpaidRow>(UNPAID_QUERY_SQL)
  return result.rows
}

function filterLowUrgency(report: PriorityReport, includeLow: boolean | undefined): PriorityReport {
  if (includeLow) return report
  // 修正：排除 low 時必須同步重算 totalUnpaid，否則金額會包含「未來 14+ 天才到期」
  // 造成首頁「未付總額」看起來虛高
  const filteredAll = report.all.filter((r) => r.urgency !== "low")
  const recomputedTotal = filteredAll.reduce((sum, r) => sum + r.unpaidAmount, 0)
  return {
    ...report,
    totalUnpaid: recomputedTotal,
    all: filteredAll,
    byUrgency: { ...report.byUrgency, low: [] },
    counts: { ...report.counts, low: 0 },
  }
}

// Service：可注入 fetcher 版本（單元測試友善）
export async function getPriorityReportWith(
  fetcher: UnpaidItemsFetcher,
  opts: FetchOptions = {}
): Promise<PriorityReport> {
  const asOf = opts.asOf ?? new Date()
  const rows = await fetcher()
  const items = mapRawRowsToInputs(rows)
  const report = buildPriorityReport(items, asOf)
  return filterLowUrgency(report, opts.includeLow)
}

export async function suggestAllocationWith(
  fetcher: UnpaidItemsFetcher,
  input: AllocationInput
): Promise<AllocationResult> {
  const asOf = input.asOf ?? new Date()
  const rows = await fetcher()
  const items = mapRawRowsToInputs(rows)
  return buildAllocation(items, input.availableBudget, asOf)
}

// Public API：使用預設 DB fetcher
export async function getPriorityReport(opts: FetchOptions = {}): Promise<PriorityReport> {
  return getPriorityReportWith(fetchUnpaidRowsFromDb, opts)
}

export async function suggestAllocation(input: AllocationInput): Promise<AllocationResult> {
  return suggestAllocationWith(fetchUnpaidRowsFromDb, input)
}
