/**
 * 家庭記帳家長主頁 — 最近任務區塊（前 10 筆 + 編輯/複製/刪除 + 匯出日曆）
 *
 * 2026-07 巨檔拆分：從 pages/family.tsx 原樣搬出、邏輯完全不變。
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2 } from "lucide-react"
import { Kid, Task, formatMoney } from "@/components/family/family-shared"
import { TaskStatusBadge } from "@/components/family/cards-01-comment-dialog"
import type { FamilyMutations } from "./hooks"

interface RecentTasksSectionProps {
  allTasks: Task[]
  kids: Kid[]
  /** 危險動作 PIN 驗證包裝（由主頁提供）*/
  requirePin: (action: () => void) => void
  editTaskMutation: FamilyMutations["editTaskMutation"]
  cloneTaskMutation: FamilyMutations["cloneTaskMutation"]
  deleteTaskMutation: FamilyMutations["deleteTaskMutation"]
}

/** 最近任務清單（無任務時不渲染）*/
export function RecentTasksSection({
  allTasks,
  kids,
  requirePin,
  editTaskMutation,
  cloneTaskMutation,
  deleteTaskMutation,
}: RecentTasksSectionProps) {
  if (allTasks.length === 0) return null

  return (
    <Card>
      <CardHeader className="py-3 px-3 sm:px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">最近任務</CardTitle>
            <CardDescription>前 10 筆</CardDescription>
          </div>
          <a
            href="/api/family/tasks.ics"
            download="family-tasks.ics"
            className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            title="下載 .ics 匯入 Google Calendar / Apple 行事曆 / Outlook"
          >
            📅 匯出日曆
          </a>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-3 sm:px-4 space-y-1">
        {allTasks.slice(0, 10).map((t) => {
          const kid = kids.find((k) => k.id === t.kidId)
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2 text-sm py-1.5 border-b last:border-0 ${
                t.isOverdue ? "bg-red-50 -mx-2 px-2 rounded" : ""
              }`}
            >
              <span className="text-lg">{t.emoji ?? "📋"}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate">
                  {t.title}
                  {t.proposedByKid && (
                    <span className="ml-1 text-[10px] text-purple-700 bg-purple-100 rounded px-1 py-0.5">
                      ✋ 自提
                    </span>
                  )}
                </div>
                {t.dueDate && (
                  <div
                    className={`text-[10px] ${
                      t.isOverdue ? "text-red-600 font-semibold" : "text-gray-400"
                    }`}
                  >
                    {t.isOverdue
                      ? `🚨 逾期 ${t.overdueDays} 天（${t.dueDate}）`
                      : `⏰ 截止 ${t.dueDate}`}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-500">{kid?.displayName ?? "—"}</span>
              <span className="text-xs font-mono">{formatMoney(t.rewardAmount)}</span>
              <TaskStatusBadge status={t.status} />
              {t.status === "pending" && (
                <button
                  type="button"
                  onClick={() => {
                    const newTitle = window.prompt(`編輯任務標題（目前：${t.title}）`, t.title)
                    const newReward = window.prompt(
                      `編輯獎勵金額（目前：${t.rewardAmount}）`,
                      String(parseFloat(t.rewardAmount))
                    )
                    const titleChanged = newTitle && newTitle.trim() !== t.title
                    const rewardNum = newReward ? parseFloat(newReward) : NaN
                    const rewardChanged =
                      !isNaN(rewardNum) && rewardNum !== parseFloat(t.rewardAmount)
                    if (titleChanged || rewardChanged) {
                      editTaskMutation.mutate({
                        id: t.id,
                        title: titleChanged ? newTitle!.trim() : undefined,
                        rewardAmount: rewardChanged ? rewardNum : undefined,
                      })
                    }
                  }}
                  disabled={editTaskMutation.isPending}
                  className="text-amber-600 hover:bg-amber-50 rounded p-1 text-xs"
                  title="編輯任務"
                >
                  ✏️
                </button>
              )}
              {(t.status === "approved" || t.status === "rejected") && (
                <button
                  type="button"
                  onClick={() => cloneTaskMutation.mutate(t)}
                  disabled={cloneTaskMutation.isPending}
                  className="text-indigo-500 hover:bg-indigo-50 rounded p-1 text-xs"
                  title="一鍵複製成新任務"
                >
                  🔁
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  requirePin(() => {
                    if (confirm("刪除此任務？")) deleteTaskMutation.mutate(t.id)
                  })
                }
                className="text-red-500 hover:bg-red-50 rounded p-1"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
