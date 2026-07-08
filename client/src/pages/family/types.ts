/**
 * 家庭記帳家長主頁（/family）共用型別
 *
 * 2026-07 巨檔拆分：從 pages/family.tsx 抽出、內容不變。
 * Kid / Task / LeaderboardEntry / FamilyDashboard 等核心型別
 * 仍在 @/components/family/family-shared（多頁共用、不搬）。
 */

/** 全家活動 Timeline 的單筆事件 */
export interface ActivityItem {
  eventType: "task_approved" | "task_rejected" | "spending" | "goal_completed" | "badge_earned"
  refId: number
  kidId: number
  kidName: string
  kidAvatar: string
  detail: string
  emoji: string | null
  amount: number | null
  ts: string
}

/** 活動 Timeline API 回傳格式 */
export interface ActivityFeedData {
  days: number
  items: ActivityItem[]
}

/** 排行榜模式（積分/任務數/善行/打卡）*/
export type LeaderboardMode = "score" | "tasks" | "giving" | "streak"
