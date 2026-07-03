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
}

export interface Jar {
  kidId: number
  spendBalance: string
  saveBalance: string
  giveBalance: string
  totalReceived: string
  totalSpent: string
}

export interface Task {
  id: number
  title: string
  emoji: string | null
  rewardAmount: string
  status: "pending" | "submitted" | "approved" | "rejected"
  proofImageUrl?: string | null
  proposedByKid?: boolean
  submissionNote?: string | null
  parentFeedback?: string | null
  difficulty?: "easy" | "medium" | "hard"
  dueDate?: string | null
  isOverdue?: boolean
  isDueSoon?: boolean
  overdueDays?: number
  category?: "housework" | "study" | "self_care" | "kindness" | "other"
}

export const difficultyStars = (d?: string) =>
  d === "easy" ? "⭐" : d === "hard" ? "⭐⭐⭐" : "⭐⭐"

export const CATEGORY_FILTER: Array<{ v: string; label: string }> = [
  { v: "all", label: "全部" },
  { v: "housework", label: "🧹 家事" },
  { v: "study", label: "📚 學習" },
  { v: "self_care", label: "🪥 照顧" },
  { v: "kindness", label: "❤️ 善行" },
  { v: "other", label: "📋 其他" },
]

export interface Goal {
  id: number
  name: string
  emoji: string | null
  targetAmount: string
  currentAmount: string
  status: "active" | "completed" | "abandoned"
  deadline: string | null
  reflection: string | null
  completedReflection: string | null
}

export interface Badge {
  id: number
  badgeType: string
  title: string
  emoji: string
  earnedAt: string
}

export interface Spending {
  id: number
  jar: "spend" | "save" | "give"
  amount: string
  description: string
  emoji: string | null
  spendDate: string
  recipient?: string | null
  reflection?: string | null
}

export interface MonthlyReport {
  kidId: number
  month: string
  tasks: {
    approvedCount: number
    approvedSum: number
    rejectedCount: number
    pendingCount: number
    avgReward: number
  }
  spendings: {
    count: number
    totalSpent: number
    items: Array<{
      id: number
      jar: string
      amount: number
      description: string
      emoji: string | null
      spendDate: string
    }>
  }
  completedGoals: Array<{
    id: number
    name: string
    emoji: string | null
    targetAmount: number
    completedAt: string
  }>
  badges: Array<{
    id: number
    badgeType: string
    title: string
    emoji: string
    earnedAt: string
  }>
  netGain: number
}

export interface KidDashboard {
  scope: "kid"
  kid: Kid
  jar: Jar
  tasks: Task[]
  goals: Goal[]
  badges: Badge[]
  streak: number
}

export function formatMoney(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v
  return "$" + Math.round(n).toLocaleString()
}

export function vibrate(pattern: number | number[] = 50) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    // 強制 cast、TS type 不接 array、但 spec / 瀏覽器都支援
    ;(navigator.vibrate as (p: number | number[]) => boolean)(pattern)
  }
}
