/**
 * 家庭記帳家長主頁 — 待審核任務區塊（一鍵批准全部 + 逐筆確認/駁回/留言）
 *
 * 2026-07 巨檔拆分：從 pages/family.tsx 原樣搬出、邏輯完全不變。
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle } from "lucide-react"
import {
  Kid,
  Task,
  difficultyStars,
  categoryLabel,
  formatMoney,
} from "@/components/family/family-shared"
import type { FamilyMutations } from "./hooks"

interface PendingTasksSectionProps {
  pendingTasks: Task[]
  kids: Kid[]
  bulkApproveMutation: FamilyMutations["bulkApproveMutation"]
  approveTaskMutation: FamilyMutations["approveTaskMutation"]
  rejectTaskMutation: FamilyMutations["rejectTaskMutation"]
  /** 開啟任務留言 dialog */
  onComment: (taskId: number) => void
}

/** 待審核任務清單（無待審核時不渲染）*/
export function PendingTasksSection({
  pendingTasks,
  kids,
  bulkApproveMutation,
  approveTaskMutation,
  rejectTaskMutation,
  onComment,
}: PendingTasksSectionProps) {
  if (pendingTasks.length === 0) return null

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardHeader className="py-3 px-3 sm:px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-amber-700" />
          待審核 ({pendingTasks.length})
        </CardTitle>
        <CardDescription>小孩標完成、等家長確認入帳</CardDescription>
      </CardHeader>
      <CardContent className="py-2 px-3 sm:px-4 space-y-2">
        {pendingTasks.length >= 2 && (
          <Button
            size="sm"
            className="w-full bg-emerald-600 hover:bg-emerald-700 mb-1"
            disabled={bulkApproveMutation.isPending}
            onClick={() => {
              if (
                !window.confirm(
                  `一鍵批准全部 ${pendingTasks.length} 個任務？（自動入帳 + 三罐分配，不會觸發驚喜獎勵或產生重複任務）`
                )
              ) {
                return
              }
              bulkApproveMutation.mutate({ ids: pendingTasks.map((t) => t.id) })
            }}
          >
            ✅ 一鍵批准全部 {pendingTasks.length} 個
          </Button>
        )}
        {pendingTasks.map((t) => {
          const kid = kids.find((k) => k.id === t.kidId)
          return (
            <div key={t.id} className="space-y-1">
              <div className="flex items-center gap-2 bg-white p-2 rounded border border-amber-200 flex-wrap">
                <div className="text-2xl">{t.emoji ?? "📋"}</div>
                <div className="flex-1 min-w-[140px]">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    {t.title}
                    <span className="text-[10px] text-amber-500">
                      {difficultyStars(t.difficulty)}
                    </span>
                    {t.category && t.category !== "other" && (
                      <span className="text-[10px]">{categoryLabel(t.category)}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {kid?.displayName ?? "—"} · {formatMoney(t.rewardAmount)}
                  </div>
                </div>
                {t.proofImageUrl && (
                  <a
                    href={t.proofImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border rounded overflow-hidden"
                    title="點看大圖"
                  >
                    <img src={t.proofImageUrl} alt="證明" className="w-12 h-12 object-cover" />
                  </a>
                )}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onComment(t.id)}
                    className="text-xs h-7 px-2"
                    title="跟小孩討論這個任務"
                  >
                    💬
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const fb = window.prompt(
                        `回饋給孩子（可跳過、會顯示在小孩端）：\n任務：${t.title}`,
                        ""
                      )
                      approveTaskMutation.mutate({
                        id: t.id,
                        parentFeedback: fb?.trim() || undefined,
                      })
                    }}
                    disabled={approveTaskMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    確認
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const fb = window.prompt(
                        `駁回原因（會顯示在小孩端）：\n任務：${t.title}`,
                        ""
                      )
                      rejectTaskMutation.mutate({
                        id: t.id,
                        parentFeedback: fb?.trim() || undefined,
                      })
                    }}
                    disabled={rejectTaskMutation.isPending}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {/* 小孩 submissionNote（如果有寫）顯示給家長看 */}
              {t.submissionNote && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 ml-12 text-xs text-gray-700">
                  <span className="text-amber-600 font-medium">💬 小孩：</span>
                  {t.submissionNote}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
