/**
 * family 頁共用型別與工具（自 family.tsx 機械拆分，2026-07-03）
 */
export interface Kid {
  id: number
  displayName: string
  avatar: string
  color: string
  spendRatio: number
  saveRatio: number
  giveRatio: number
  monthlyAllowance?: string
  lastAllowanceMonth?: string | null
}

export interface Task {
  id: number
  kidId: number | null
  title: string
  emoji: string | null
  rewardAmount: string
  status: "pending" | "submitted" | "approved" | "rejected"
  notes: string | null
  dueDate: string | null
  createdAt: string
  isOverdue?: boolean
  overdueDays?: number
  proofImageUrl?: string | null
  proposedByKid?: boolean
  submissionNote?: string | null
  parentFeedback?: string | null
  difficulty?: "easy" | "medium" | "hard"
  category?: "housework" | "study" | "self_care" | "kindness" | "other"
}

export const difficultyStars = (d?: string) =>
  d === "easy" ? "⭐" : d === "hard" ? "⭐⭐⭐" : "⭐⭐"

export const categoryLabel = (c?: string) =>
  c === "housework"
    ? "🧹"
    : c === "study"
      ? "📚"
      : c === "self_care"
        ? "🪥"
        : c === "kindness"
          ? "❤️"
          : ""

export interface Jar {
  kidId: number
  spendBalance: string
  saveBalance: string
  giveBalance: string
  totalReceived: string
  totalSpent: string
}

export interface LeaderboardEntry {
  kidId: number
  displayName: string
  avatar: string
  color: string
  approvedCount: number
  approvedSum: number
  weightedScore: number
  hardCount: number
  completedGoalsCount: number
  badgeCount: number
  giveSum: number
  streak: number
  rank: number
  medal: string
}

export interface FamilyDashboard {
  scope: "family"
  kids: Kid[]
  totalReceived: number
  totalSaved: number
  pendingTaskCount: number
  toApproveCount: number
}

export const COLOR_TOKENS: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  pink: { bg: "bg-pink-50", border: "border-pink-300", text: "text-pink-700" },
  green: { bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
  amber: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
  purple: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  cyan: { bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700" },
}

export const AVATAR_OPTIONS = [
  "🧒",
  "👧",
  "👦",
  "🧑",
  "👶",
  "🐱",
  "🐶",
  "🐻",
  "🦊",
  "🐰",
  "🐼",
  "🦁",
]

export function formatMoney(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v
  return "$" + Math.round(n).toLocaleString()
}

// 家長 PIN：sessionStorage 記憶 30 分鐘
export const PIN_KEY = "family.parentPin.verifiedAt"
export const PIN_TTL_MS = 30 * 60 * 1000
export function isPinVerified(): boolean {
  const ts = parseInt(sessionStorage.getItem(PIN_KEY) || "0", 10)
  return ts > 0 && Date.now() - ts < PIN_TTL_MS
}
export function setPinVerified() {
  sessionStorage.setItem(PIN_KEY, String(Date.now()))
}
