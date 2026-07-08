/**
 * 家庭記帳家長主頁 — 全家活動 Timeline（過去 30 天事件）
 *
 * 2026-07 巨檔拆分：從 pages/family.tsx 原樣搬出、邏輯完全不變。
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney } from "@/components/family/family-shared"
import type { ActivityFeedData } from "./types"

interface ActivityTimelineProps {
  activityFeed: ActivityFeedData | undefined
}

/** 全家活動 Timeline（無資料時不渲染）*/
export function ActivityTimeline({ activityFeed }: ActivityTimelineProps) {
  if (!activityFeed || activityFeed.items.length === 0) return null

  return (
    <Card>
      <CardHeader className="py-3 px-3 sm:px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-xl">📜</span>
          全家活動 Timeline
        </CardTitle>
        <CardDescription>過去 {activityFeed.days} 天家庭事件</CardDescription>
      </CardHeader>
      <CardContent className="py-2 px-3 sm:px-4 space-y-1.5 max-h-96 overflow-y-auto">
        {activityFeed.items.slice(0, 30).map((it) => {
          const tone =
            it.eventType === "task_approved"
              ? { bg: "bg-green-50", border: "border-green-200", icon: "✅" }
              : it.eventType === "task_rejected"
                ? { bg: "bg-orange-50", border: "border-orange-200", icon: "🙅" }
                : it.eventType === "spending"
                  ? { bg: "bg-amber-50", border: "border-amber-200", icon: "💸" }
                  : it.eventType === "goal_completed"
                    ? { bg: "bg-purple-50", border: "border-purple-200", icon: "🎯" }
                    : { bg: "bg-yellow-50", border: "border-yellow-200", icon: "🏅" }
          const label =
            it.eventType === "task_approved"
              ? "任務完成"
              : it.eventType === "task_rejected"
                ? "任務駁回"
                : it.eventType === "spending"
                  ? "花錢紀錄"
                  : it.eventType === "goal_completed"
                    ? "目標達成"
                    : "獲得徽章"
          const tsDate = new Date(it.ts)
          const dateLabel = `${tsDate.getMonth() + 1}/${tsDate.getDate()}`
          return (
            <div
              key={`${it.eventType}-${it.refId}`}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs ${tone.bg} ${tone.border}`}
            >
              <span className="text-base">{tone.icon}</span>
              <span className="text-base">{it.kidAvatar}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-700 truncate">
                  <span className="text-gray-500">{it.kidName}</span>
                  <span className="mx-1 text-gray-400">·</span>
                  {label}
                  <span className="mx-1 text-gray-400">·</span>
                  <span>
                    {it.emoji ?? ""} {it.detail}
                  </span>
                </div>
              </div>
              {it.amount !== null && (
                <span className="font-mono text-gray-600">{formatMoney(it.amount)}</span>
              )}
              <span className="text-[10px] text-gray-400 tabular-nums">{dateLabel}</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
