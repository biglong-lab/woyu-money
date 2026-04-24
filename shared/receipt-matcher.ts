/**
 * 收據自動對應演算法（第 10 步）
 *
 * 解決使用者痛點：拍收據 → 自動匹配既有 payment_item，一鍵標記已付。
 * 改造前：OCR 辨識後「新增項目」；改造後：先嘗試對應既有項目，找不到才新增。
 */

export interface ReceiptInput {
  amount?: number | null
  receiptDate?: string | null // ISO YYYY-MM-DD
  vendor?: string | null
  category?: string | null
  ocrText?: string | null
}

export interface CandidateItem {
  id: number
  itemName: string
  totalAmount: number
  paidAmount: number
  startDate?: string | null
  endDate?: string | null
  categoryName?: string | null
  vendor?: string | null
}

export interface MatchCandidate {
  item: CandidateItem
  score: number
  reasons: string[]
  confidence: "high" | "medium" | "low"
}

export interface MatchResult {
  bestMatch: MatchCandidate | null
  candidates: MatchCandidate[]
  autoConfirmable: boolean
}

// ─────────────────────────────────────────────
// 輔助
// ─────────────────────────────────────────────

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

function approx(a: number, b: number, tolerance: number): boolean {
  if (b === 0) return a === 0
  return Math.abs(a - b) / b <= tolerance
}

function isDateInRange(target: string, start?: string | null, end?: string | null): boolean {
  if (!start && !end) return false
  const t = new Date(target).getTime()
  if (Number.isNaN(t)) return false
  if (start) {
    const s = new Date(start).getTime()
    if (Number.isFinite(s) && t < s) return false
  }
  if (end) {
    const e = new Date(end).getTime()
    if (Number.isFinite(e) && t > e) return false
  }
  return true
}

function normalize(s?: string | null): string {
  return (s ?? "").trim().toLowerCase()
}

function textIncludes(haystack: string, needle: string): boolean {
  return needle.length > 0 && haystack.includes(needle)
}

// ─────────────────────────────────────────────
// 計分
// ─────────────────────────────────────────────

interface ScoreResult {
  score: number
  reasons: string[]
}

function scoreAmount(
  receiptAmount: number | null | undefined,
  candidate: CandidateItem
): ScoreResult {
  if (!isNum(receiptAmount) || receiptAmount <= 0) return { score: 0, reasons: [] }
  const reasons: string[] = []
  const unpaid = Math.max(0, candidate.totalAmount - candidate.paidAmount)
  // 未付金額精確相符（分期款付尾款場景）
  if (unpaid > 0 && Math.abs(receiptAmount - unpaid) < 1) {
    return { score: 60, reasons: ["金額與未付餘額完全相符"] }
  }
  // 總額精確相符
  if (Math.abs(receiptAmount - candidate.totalAmount) < 1) {
    return { score: 55, reasons: ["金額與總額完全相符"] }
  }
  // 總額近似（5% 容忍）
  if (approx(receiptAmount, candidate.totalAmount, 0.05)) {
    return { score: 40, reasons: ["金額近似（±5%）"] }
  }
  // 總額寬鬆近似（10%）
  if (approx(receiptAmount, candidate.totalAmount, 0.1)) {
    return { score: 25, reasons: ["金額近似（±10%）"] }
  }
  return { score: 0, reasons }
}

function scoreDate(receiptDate: string | null | undefined, candidate: CandidateItem): ScoreResult {
  if (!receiptDate) return { score: 0, reasons: [] }
  if (isDateInRange(receiptDate, candidate.startDate, candidate.endDate)) {
    return { score: 20, reasons: ["收據日期在項目期間內"] }
  }
  return { score: 0, reasons: [] }
}

function scoreText(receipt: ReceiptInput, candidate: CandidateItem): ScoreResult {
  const reasons: string[] = []
  let score = 0

  const itemNameLower = normalize(candidate.itemName)
  const vendorLower = normalize(receipt.vendor)
  const ocrLower = normalize(receipt.ocrText)

  if (vendorLower && textIncludes(itemNameLower, vendorLower)) {
    score += 20
    reasons.push("廠商名稱匹配項目名")
  }
  if (ocrLower && itemNameLower && textIncludes(ocrLower, itemNameLower)) {
    score += 15
    reasons.push("OCR 文字含項目名")
  }

  const categoryLower = normalize(receipt.category)
  const candidateCategoryLower = normalize(candidate.categoryName)
  if (
    categoryLower &&
    candidateCategoryLower &&
    (textIncludes(categoryLower, candidateCategoryLower) ||
      textIncludes(candidateCategoryLower, categoryLower))
  ) {
    score += 15
    reasons.push("分類相符")
  }

  return { score, reasons }
}

function scoreUnpaidBonus(candidate: CandidateItem): ScoreResult {
  const unpaid = candidate.totalAmount - candidate.paidAmount
  if (unpaid > 0) return { score: 10, reasons: ["項目尚未付清"] }
  return { score: 0, reasons: [] }
}

function scoreCandidate(receipt: ReceiptInput, candidate: CandidateItem): MatchCandidate {
  const parts = [
    scoreAmount(receipt.amount, candidate),
    scoreDate(receipt.receiptDate, candidate),
    scoreText(receipt, candidate),
    scoreUnpaidBonus(candidate),
  ]
  const score = parts.reduce((s, p) => s + p.score, 0)
  const reasons = parts.flatMap((p) => p.reasons)

  let confidence: MatchCandidate["confidence"]
  if (score >= 80) confidence = "high"
  else if (score >= 50) confidence = "medium"
  else confidence = "low"

  return { item: candidate, score, reasons, confidence }
}

// ─────────────────────────────────────────────
// 公開 API
// ─────────────────────────────────────────────

export function matchReceiptToItems(
  receipt: ReceiptInput,
  candidates: CandidateItem[],
  options: { topN?: number; autoConfirmThreshold?: number } = {}
): MatchResult {
  const topN = options.topN ?? 3
  const autoThreshold = options.autoConfirmThreshold ?? 80

  if (candidates.length === 0) {
    return { bestMatch: null, candidates: [], autoConfirmable: false }
  }

  const scored = candidates
    .map((c) => scoreCandidate(receipt, c))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)

  const top = scored.slice(0, topN)
  const best = top[0] ?? null
  const autoConfirmable = best !== null && best.score >= autoThreshold

  return { bestMatch: best, candidates: top, autoConfirmable }
}
