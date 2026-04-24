/**
 * 付款優先級演算法（前後端共用）
 *
 * 解決核心問題：
 * - 看到一堆欠款不知道先付哪筆
 * - 勞健保滯納金滾雪球（使用者實際損失 40%）
 * - 沒有依「違約後果」排序的決策依據
 *
 * 演算法 5 維度：
 *   1. 滯納金率 × 逾期天數 × 未付金額（真實金錢損失）
 *   2. 違約後果權重（強制執行/信用影響/斷供）
 *   3. 關係剛性（政府 > 銀行 > 廠商）
 *   4. 到期接近度（30 日內線性加權）
 *   5. 已協商延後（使用者手動降級）
 */

// ─────────────────────────────────────────────
// 型別定義
// ─────────────────────────────────────────────

export type CategoryKey =
  | "labor_insurance" // 勞健保
  | "tax" // 稅務
  | "bank_loan" // 銀行貸款
  | "credit_card" // 信用卡
  | "utility" // 水電瓦斯
  | "insurance" // 商業保險
  | "rental_pay" // 租金（要付出去的）
  | "vendor" // 廠商貨款
  | "other" // 其他

export type UrgencyLevel = "critical" | "high" | "medium" | "low"

export interface CategoryRule {
  key: CategoryKey
  label: string
  keywords: string[]
  lateFeeRate: number // 每日滯納金率（0.003 = 每日 0.3%）
  consequenceWeight: number // 0-100 違約後果嚴重性
  flexibility: number // 0-100 彈性（越高越可延後）
  description: string
}

export interface PriorityInput {
  id: number
  itemName: string
  totalAmount: number
  paidAmount: number
  dueDate: string // YYYY-MM-DD
  fixedCategoryName?: string | null
  debtCategoryName?: string | null
  projectName?: string | null
  notes?: string | null
  isNegotiated?: boolean // 已協商延後
}

export interface PriorityResult {
  id: number
  itemName: string
  unpaidAmount: number
  dueDate: string
  category: CategoryKey
  categoryLabel: string
  daysOverdue: number
  daysUntilDue: number
  score: number
  urgency: UrgencyLevel
  lateFeeEstimate: number // 已產生滯納金
  dailyLateFee: number // 每多拖一天的滯納金
  reasons: string[]
  projectName?: string
}

// ─────────────────────────────────────────────
// 分類規則表（核心設定）
//
// 依據：
// - 勞健保、稅務：政府強制執行、信用影響（剛性最高）
// - 銀行貸款、信用卡：聯徵影響 5~7 年
// - 水電瓦斯：有斷供風險
// - 保險：斷保風險
// - 租金/廠商：關係維護（彈性較高）
// ─────────────────────────────────────────────

export const CATEGORY_RULES: Record<CategoryKey, CategoryRule> = {
  labor_insurance: {
    key: "labor_insurance",
    label: "勞健保",
    keywords: ["勞健保", "勞保", "健保", "勞工保險", "全民健康保險", "健康保險", "二代健保"],
    lateFeeRate: 0.003,
    consequenceWeight: 100,
    flexibility: 0,
    description: "政府強制執行，信用影響，企業違法風險",
  },
  tax: {
    key: "tax",
    label: "稅務",
    keywords: ["營業稅", "所得稅", "房屋稅", "地價稅", "扣繳", "稅款", "牌照稅", "燃料稅"],
    lateFeeRate: 0.005,
    consequenceWeight: 100,
    flexibility: 0,
    description: "法律追繳、滯納金 + 利息",
  },
  bank_loan: {
    key: "bank_loan",
    label: "銀行貸款",
    keywords: ["房貸", "車貸", "銀行貸款", "信貸", "企業貸款", "貸款"],
    lateFeeRate: 0.0005,
    consequenceWeight: 90,
    flexibility: 10,
    description: "聯徵不良紀錄 5~7 年",
  },
  credit_card: {
    key: "credit_card",
    label: "信用卡",
    keywords: ["信用卡", "卡費", "信用卡費"],
    lateFeeRate: 0.0005,
    consequenceWeight: 80,
    flexibility: 10,
    description: "循環利息年化 15%，影響信用",
  },
  utility: {
    key: "utility",
    label: "水電瓦斯",
    keywords: ["電費", "水費", "瓦斯", "電話費", "網路費", "電信費", "市話", "手機費"],
    lateFeeRate: 0.001,
    consequenceWeight: 70,
    flexibility: 20,
    description: "有斷供風險、影響營運",
  },
  insurance: {
    key: "insurance",
    label: "商業保險",
    keywords: ["壽險", "產險", "意外險", "汽車保險", "火險", "商業保險"],
    lateFeeRate: 0.0001,
    consequenceWeight: 60,
    flexibility: 30,
    description: "斷保、復效手續",
  },
  rental_pay: {
    key: "rental_pay",
    label: "租金",
    keywords: ["房租", "租金", "租賃費"],
    lateFeeRate: 0.0001,
    consequenceWeight: 50,
    flexibility: 50,
    description: "關係維護（多為友好房東）",
  },
  vendor: {
    key: "vendor",
    label: "廠商貨款",
    keywords: ["廠商", "貨款", "應付帳款", "採購款"],
    lateFeeRate: 0,
    consequenceWeight: 40,
    flexibility: 60,
    description: "合作關係，多可協商",
  },
  other: {
    key: "other",
    label: "其他",
    keywords: [],
    lateFeeRate: 0,
    consequenceWeight: 30,
    flexibility: 50,
    description: "未分類項目",
  },
}

// 分類檢查順序（labor_insurance 優先於 insurance，避免「健保」被歸入 insurance）
const CLASSIFICATION_ORDER: CategoryKey[] = [
  "labor_insurance",
  "tax",
  "bank_loan",
  "credit_card",
  "utility",
  "insurance",
  "rental_pay",
  "vendor",
]

// ─────────────────────────────────────────────
// 輔助函式
// ─────────────────────────────────────────────

function toStartOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86_400_000
  return Math.round((toStartOfDay(to).getTime() - toStartOfDay(from).getTime()) / msPerDay)
}

function matchCategory(text: string): CategoryKey | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const key of CLASSIFICATION_ORDER) {
    const rule = CATEGORY_RULES[key]
    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return key
      }
    }
  }
  return null
}

// ─────────────────────────────────────────────
// 分類邏輯
// 優先順序：fixedCategoryName > debtCategoryName > itemName > notes
// ─────────────────────────────────────────────

export function classifyItem(input: PriorityInput): CategoryKey {
  const sources = [
    input.fixedCategoryName ?? "",
    input.debtCategoryName ?? "",
    input.itemName ?? "",
    input.notes ?? "",
  ]

  for (const src of sources) {
    const matched = matchCategory(src)
    if (matched) return matched
  }
  return "other"
}

// ─────────────────────────────────────────────
// 滯納金估算
// ─────────────────────────────────────────────

export function estimateLateFee(
  input: PriorityInput,
  today: Date = new Date()
): { accumulated: number; perDay: number } {
  const category = classifyItem(input)
  const rule = CATEGORY_RULES[category]
  const unpaid = Math.max(0, input.totalAmount - input.paidAmount)
  const dueDate = new Date(input.dueDate)
  const overdueDays = Math.max(0, daysBetween(dueDate, today))

  const perDay = unpaid * rule.lateFeeRate
  const accumulated = perDay * overdueDays

  return { accumulated, perDay }
}

// ─────────────────────────────────────────────
// 優先級分數計算（核心演算法）
// ─────────────────────────────────────────────

function computeScore(
  rule: CategoryRule,
  unpaid: number,
  daysOverdue: number,
  daysUntilDue: number,
  lateFee: number,
  isNegotiated: boolean
): number {
  if (unpaid <= 0) return 0

  let score = 0

  if (daysOverdue > 0) {
    score += 1000 // 逾期基礎分（大幅拉開）
    score += daysOverdue * 10
    score += lateFee / 100
    score += rule.consequenceWeight * 5
  } else if (daysUntilDue <= 30) {
    const proximity = Math.max(0, 30 - daysUntilDue)
    score += proximity * 10
    score += rule.consequenceWeight * 2

    if (daysUntilDue <= 3) score += 200
    else if (daysUntilDue <= 7) score += 100
  }

  score -= rule.flexibility
  score += Math.log10(Math.max(1, unpaid)) * 10

  if (isNegotiated) score -= 500

  return Math.max(0, score)
}

function determineUrgency(
  unpaid: number,
  daysOverdue: number,
  daysUntilDue: number,
  consequenceWeight: number,
  isNegotiated: boolean
): UrgencyLevel {
  if (unpaid <= 0) return "low"
  if (isNegotiated && daysOverdue <= 0) return "low"

  if (daysOverdue > 0) {
    return consequenceWeight >= 80 ? "critical" : "high"
  }

  if (daysUntilDue <= 3) {
    return consequenceWeight >= 80 ? "critical" : "high"
  }
  if (daysUntilDue <= 7) {
    return consequenceWeight >= 80 ? "high" : "medium"
  }
  if (daysUntilDue <= 14) return "medium"
  return "low"
}

function buildReasons(
  rule: CategoryRule,
  daysOverdue: number,
  daysUntilDue: number,
  lateFee: number,
  isNegotiated: boolean
): string[] {
  const reasons: string[] = []
  if (daysOverdue > 0) reasons.push(`已逾期 ${daysOverdue} 天`)
  else if (daysUntilDue <= 3) reasons.push(`${daysUntilDue} 天內到期`)
  else if (daysUntilDue <= 7) reasons.push(`1 週內到期`)
  else if (daysUntilDue <= 14) reasons.push(`2 週內到期`)

  if (lateFee > 0) reasons.push(`已產生滯納金 NT$ ${Math.round(lateFee).toLocaleString()}`)
  if (rule.consequenceWeight >= 90) reasons.push(rule.description)
  if (isNegotiated) reasons.push("已協商延後")

  return reasons
}

export function calculatePriority(input: PriorityInput, today: Date = new Date()): PriorityResult {
  const category = classifyItem(input)
  const rule = CATEGORY_RULES[category]
  const unpaid = Math.max(0, input.totalAmount - input.paidAmount)
  const dueDate = new Date(input.dueDate)
  const diff = daysBetween(dueDate, today)
  const daysOverdue = Math.max(0, diff)
  const daysUntilDue = Math.max(0, -diff)

  const { accumulated: lateFeeEstimate, perDay: dailyLateFee } = estimateLateFee(input, today)
  const isNegotiated = input.isNegotiated ?? false

  const score = computeScore(rule, unpaid, daysOverdue, daysUntilDue, lateFeeEstimate, isNegotiated)
  const urgency = determineUrgency(
    unpaid,
    daysOverdue,
    daysUntilDue,
    rule.consequenceWeight,
    isNegotiated
  )
  const reasons = buildReasons(rule, daysOverdue, daysUntilDue, lateFeeEstimate, isNegotiated)

  return {
    id: input.id,
    itemName: input.itemName,
    unpaidAmount: unpaid,
    dueDate: input.dueDate,
    category,
    categoryLabel: rule.label,
    daysOverdue,
    daysUntilDue,
    score: Math.round(score * 100) / 100,
    urgency,
    lateFeeEstimate: Math.round(lateFeeEstimate * 100) / 100,
    dailyLateFee: Math.round(dailyLateFee * 100) / 100,
    reasons,
    projectName: input.projectName ?? undefined,
  }
}

// ─────────────────────────────────────────────
// 排序與分群
// ─────────────────────────────────────────────

export function sortByPriority(
  inputs: PriorityInput[],
  today: Date = new Date()
): PriorityResult[] {
  return inputs.map((input) => calculatePriority(input, today)).sort((a, b) => b.score - a.score)
}

export function groupByUrgency(results: PriorityResult[]): Record<UrgencyLevel, PriorityResult[]> {
  const groups: Record<UrgencyLevel, PriorityResult[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  }
  for (const r of results) {
    groups[r.urgency].push(r)
  }
  return groups
}

// ─────────────────────────────────────────────
// Markdown 格式化輸出（CLI + Email + LINE 共用）
// ─────────────────────────────────────────────

function formatCurrency(n: number): string {
  return `NT$ ${Math.round(n).toLocaleString()}`
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const URGENCY_META: Record<UrgencyLevel, { icon: string; title: string; subtitle: string }> = {
  critical: { icon: "🔴", title: "Critical", subtitle: "必須立刻處理（有滯納金 / 強制執行風險）" },
  high: { icon: "🟠", title: "High", subtitle: "本週內必須付款" },
  medium: { icon: "🟡", title: "Medium", subtitle: "2 週內到期" },
  low: { icon: "🟢", title: "Low", subtitle: "可稍後處理" },
}

function renderItem(r: PriorityResult, index: number): string {
  const lines: string[] = []
  lines.push(`### ${index}. ${r.itemName} — ${formatCurrency(r.unpaidAmount)}`)
  lines.push(
    `- **到期日：** ${r.dueDate}${r.daysOverdue > 0 ? `（已逾期 ${r.daysOverdue} 天）` : ""}`
  )
  lines.push(`- **類別：** ${r.categoryLabel}`)
  if (r.lateFeeEstimate > 0) {
    lines.push(
      `- **已產生滯納金：** ${formatCurrency(r.lateFeeEstimate)}（每拖一天 +${formatCurrency(r.dailyLateFee)}）`
    )
  } else if (r.dailyLateFee > 0 && r.daysUntilDue <= 7) {
    lines.push(`- **逾期後每日滯納金：** ${formatCurrency(r.dailyLateFee)}`)
  }
  if (r.projectName) lines.push(`- **專案：** ${r.projectName}`)
  if (r.reasons.length > 0) lines.push(`- **原因：** ${r.reasons.join("、")}`)
  return lines.join("\n")
}

function renderGroup(level: UrgencyLevel, items: PriorityResult[], startIndex: number): string {
  if (items.length === 0) return ""
  const meta = URGENCY_META[level]
  const header = `## ${meta.icon} ${meta.title}（${meta.subtitle}）— ${items.length} 筆`
  const body = items.map((r, i) => renderItem(r, startIndex + i)).join("\n\n")
  return `${header}\n\n${body}`
}

function renderCategoryStats(results: PriorityResult[]): string {
  const stats = new Map<string, { count: number; amount: number }>()
  for (const r of results) {
    const s = stats.get(r.categoryLabel) ?? { count: 0, amount: 0 }
    s.count++
    s.amount += r.unpaidAmount
    stats.set(r.categoryLabel, s)
  }
  const rows = Array.from(stats.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([label, s]) => `| ${label} | ${s.count} | ${formatCurrency(s.amount)} |`)
    .join("\n")
  return `## 📊 分類統計\n\n| 類別 | 筆數 | 總金額 |\n|------|------|--------|\n${rows}`
}

export interface FormatOptions {
  title?: string
  now?: Date
  totalBudget?: number
}

export function formatPriorityMarkdown(
  results: PriorityResult[],
  options: FormatOptions = {}
): string {
  const title = options.title ?? "🎯 優先付款清單"
  const now = options.now ?? new Date()

  const header = [`# ${title}`, "", `**產出時間：** ${formatDate(now)}`]

  if (results.length === 0) {
    header.push("", "✅ 目前沒有需處理的未付款項目。")
    return header.join("\n")
  }

  const totalAmount = results.reduce((sum, r) => sum + r.unpaidAmount, 0)
  header.push(`**總項目數：** ${results.length} 筆`)
  header.push(`**合計應付：** ${formatCurrency(totalAmount)}`)

  // 預算對照
  if (typeof options.totalBudget === "number") {
    const budget = options.totalBudget
    header.push("", `> 💰 可動用金額：${formatCurrency(budget)}`)
    if (budget >= totalAmount) {
      header.push(`> ✅ 餘額：${formatCurrency(budget - totalAmount)}（足以付清全部）`)
    } else {
      header.push(
        `> ⚠️ 缺口：${formatCurrency(totalAmount - budget)}（建議優先付清 Critical 項目）`
      )
    }
  }

  const groups = groupByUrgency(results)
  const sections: string[] = []
  let idx = 1
  for (const level of ["critical", "high", "medium", "low"] as UrgencyLevel[]) {
    const items = groups[level]
    if (items.length === 0) continue
    sections.push(renderGroup(level, items, idx))
    idx += items.length
  }

  const parts = [
    header.join("\n"),
    "",
    "---",
    "",
    sections.join("\n\n---\n\n"),
    "",
    "---",
    "",
    renderCategoryStats(results),
  ]
  return parts.join("\n")
}
