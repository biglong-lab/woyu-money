/**
 * 家庭記帳家長主頁（/family）mutations 集中管理
 *
 * 2026-07 巨檔拆分：從 pages/family.tsx 原樣搬出、邏輯完全不變。
 */
import { useMutation } from "@tanstack/react-query"
import confetti from "canvas-confetti"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Task, formatMoney } from "@/components/family/family-shared"

/** 讓所有 /api/family/ 開頭的查詢失效重抓 */
export function invalidateAllFamilyQueries() {
  queryClient.invalidateQueries({
    predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/family/"),
  })
}

/** 家長主頁全部 mutations（批量批准/批准/駁回/編輯/複製/刪除/鼓勵卡/停用小孩）*/
export function useFamilyMutations() {
  const { toast } = useToast()
  const invalidateAll = invalidateAllFamilyQueries

  const bulkApproveMutation = useMutation({
    mutationFn: (vars: { ids: number[]; parentFeedback?: string }) =>
      apiRequest<{
        approved: number
        failed: number
        totalReward: number
        failures: Array<{ id: number; error: string }>
      }>("POST", "/api/family/tasks/bulk-approve", vars),
    onSuccess: (r) => {
      if (r.approved > 0) {
        toast({
          title: `✅ 批量批准成功：${r.approved} 個任務、總額 ${formatMoney(r.totalReward)}`,
          description: r.failed > 0 ? `⚠️ ${r.failed} 個失敗` : "已自動入帳 + 三罐分配",
        })
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } })
      } else {
        toast({
          title: "❌ 批量批准失敗",
          description: r.failures[0]?.error ?? "全部失敗",
          variant: "destructive",
        })
      }
      invalidateAll()
    },
  })

  const approveTaskMutation = useMutation({
    mutationFn: (vars: { id: number; parentFeedback?: string }) =>
      apiRequest<{
        task: Task
        jars: { total: number }
        newBadges: string[]
        bonus: {
          triggered: boolean
          baseAmount: number
          bonusAmount: number
          totalAmount: number
          emoji?: string
          label?: string
        }
      }>("POST", `/api/family/tasks/${vars.id}/approve`, {
        parentFeedback: vars.parentFeedback,
      }),
    onSuccess: (r) => {
      const bonus = r.bonus
      if (bonus?.triggered) {
        const pct = Math.round((bonus.bonusAmount / bonus.baseAmount) * 100)
        toast({
          title: `${bonus.emoji ?? "🎁"} ${bonus.label ?? "驚喜獎勵"}！ ${formatMoney(bonus.baseAmount)} +${formatMoney(bonus.bonusAmount)} = ${formatMoney(bonus.totalAmount)}`,
          description:
            r.newBadges.length > 0
              ? `🎉 解鎖徽章：${r.newBadges.join(", ")}`
              : `小孩超棒、額外 +${pct}%`,
        })
        // 大撒花、震動
        confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 }, ticks: 300 })
        setTimeout(() => confetti({ particleCount: 100, spread: 90, origin: { y: 0.7 } }), 250)
      } else {
        toast({
          title: `✅ 任務通過、入帳 ${formatMoney(r.jars.total)}`,
          description:
            r.newBadges.length > 0 ? `🎉 解鎖徽章：${r.newBadges.join(", ")}` : "已自動三罐分配",
        })
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } })
      }
      invalidateAll()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const dailyMessageMutation = useMutation({
    mutationFn: (vars: { kidId: number; message: string; mood?: string }) =>
      apiRequest("POST", "/api/family/daily-message", vars),
    onSuccess: () => {
      toast({ title: "💌 已送出鼓勵卡、小孩首頁會看到" })
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } })
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const rejectTaskMutation = useMutation({
    mutationFn: (vars: { id: number; parentFeedback?: string }) =>
      apiRequest("POST", `/api/family/tasks/${vars.id}/reject`, {
        parentFeedback: vars.parentFeedback,
      }),
    onSuccess: () => {
      toast({ title: "已駁回" })
      invalidateAll()
    },
  })

  // 編輯既有 pending 任務（prompt 改 title + rewardAmount）
  const editTaskMutation = useMutation({
    mutationFn: (vars: { id: number; title?: string; rewardAmount?: number }) => {
      const body: Record<string, unknown> = {}
      if (vars.title !== undefined) body.title = vars.title
      if (vars.rewardAmount !== undefined) body.rewardAmount = vars.rewardAmount
      return apiRequest("PUT", `/api/family/tasks/${vars.id}`, body)
    },
    onSuccess: () => {
      toast({ title: "✅ 已更新任務" })
      invalidateAll()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  // 一鍵再做任務（複製 approved 任務為新 pending）
  const cloneTaskMutation = useMutation({
    mutationFn: (t: Task) =>
      apiRequest("POST", "/api/family/tasks", {
        kidId: t.kidId,
        title: t.title,
        emoji: t.emoji,
        rewardAmount: parseFloat(t.rewardAmount),
        difficulty: t.difficulty ?? "medium",
        category: t.category ?? "other",
      }),
    onSuccess: () => {
      toast({ title: "🔁 已複製成新任務" })
      invalidateAll()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/family/tasks/${id}`),
    onSuccess: () => {
      toast({ title: "✅ 已刪除" })
      invalidateAll()
    },
  })

  const deleteKidMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/family/kids/${id}`),
    onSuccess: () => {
      toast({ title: "已停用小孩帳戶" })
      invalidateAll()
    },
  })

  return {
    invalidateAll,
    bulkApproveMutation,
    approveTaskMutation,
    dailyMessageMutation,
    rejectTaskMutation,
    editTaskMutation,
    cloneTaskMutation,
    deleteTaskMutation,
    deleteKidMutation,
  }
}

/** useFamilyMutations 回傳型別（給子元件 props 用）*/
export type FamilyMutations = ReturnType<typeof useFamilyMutations>
