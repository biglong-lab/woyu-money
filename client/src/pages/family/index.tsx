/**
 * 家庭記帳：家長視角主頁（/family）
 *
 * 2026-07-03 Phase 3.2：原 9,524 行拆分 — 卡片元件移至
 * components/family/cards-*.tsx、共用型別移至 family-shared.ts。
 * 2026-07 巨檔再拆分：pages/family.tsx（1,335 行）→ pages/family/ 目錄，
 * 本檔只留狀態管理、查詢與版面組合；行為完全不變。
 */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"
import {
  Kid,
  Task,
  LeaderboardEntry,
  FamilyDashboard,
  isPinVerified,
} from "@/components/family/family-shared"
import { CommentDialog, FamilyYearSummary } from "@/components/family/cards-01-comment-dialog"
import {
  FamilyMonthlySummary,
  FamilyTrendChart,
  KidDialog,
  TaskDialog,
} from "@/components/family/cards-13-family-monthly-summary"
import { BatchTaskDialog, ParentPinDialog } from "@/components/family/cards-14-parent-pin-dialog"
import type { ActivityFeedData, LeaderboardMode } from "./types"
import { useFamilyMutations } from "./hooks"
import { FamilyHeader } from "./FamilyHeader"
import { DashboardStats } from "./DashboardStats"
import { FamilyStatsWall } from "./FamilyStatsWall"
import { FamilyInsightsWall } from "./FamilyInsightsWall"
import { PendingTasksSection } from "./PendingTasksSection"
import { KidsSection } from "./KidsSection"
import { LeaderboardSection } from "./LeaderboardSection"
import { ActivityTimeline } from "./ActivityTimeline"
import { RecentTasksSection } from "./RecentTasksSection"

export default function FamilyPage() {
  useDocumentTitle("家庭記帳")
  const [showAddKid, setShowAddKid] = useState(false)
  const [editKid, setEditKid] = useState<Kid | null>(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [showBatchTask, setShowBatchTask] = useState(false)
  const [pinPrompt, setPinPrompt] = useState<null | (() => void)>(null)
  const [commentTaskId, setCommentTaskId] = useState<number | null>(null)

  const { data: pinStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/family/parent-pin/status"],
    staleTime: 5 * 60 * 1000,
  })

  // 包裝危險動作：若 PIN 啟用且未驗證 → 彈出 modal、否則直接執行
  const requirePin = (action: () => void) => {
    if (!pinStatus?.enabled || isPinVerified()) {
      action()
    } else {
      setPinPrompt(() => action)
    }
  }

  const { data: dashboard } = useQuery<FamilyDashboard>({
    queryKey: ["/api/family/dashboard"],
  })

  const { data: kids = [] } = useQuery<Kid[]>({
    queryKey: ["/api/family/kids"],
  })

  const { data: pendingTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/family/tasks?status=submitted"],
  })

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/family/tasks"],
  })

  const { data: activityFeed } = useQuery<ActivityFeedData>({
    queryKey: ["/api/family/activity-feed?days=30"],
    staleTime: 30_000,
  })

  const currentMonth = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })()
  const [lbMode, setLbMode] = useState<LeaderboardMode>("score")
  const { data: leaderboard } = useQuery<{
    month: string
    leaderboard: LeaderboardEntry[]
  }>({
    queryKey: [`/api/family/leaderboard?month=${currentMonth}&mode=${lbMode}`],
  })

  // 全部 mutations 集中在 hooks.ts（邏輯原樣搬移）
  const {
    invalidateAll,
    bulkApproveMutation,
    approveTaskMutation,
    dailyMessageMutation,
    rejectTaskMutation,
    editTaskMutation,
    cloneTaskMutation,
    deleteTaskMutation,
    deleteKidMutation,
  } = useFamilyMutations()

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 max-w-4xl">
      {/* 標題 */}
      <FamilyHeader
        kidsCount={kids.length}
        onBatchTask={() => setShowBatchTask(true)}
        onAddTask={() => setShowAddTask(true)}
        onAddKid={() => setShowAddKid(true)}
      />

      {/* 全家儀表板 */}
      {dashboard && <DashboardStats dashboard={dashboard} />}

      {/* 統計卡片牆（前半段）*/}
      <FamilyStatsWall />

      {/* 洞察卡片牆（後半段、含任務月曆）*/}
      <FamilyInsightsWall allTasks={allTasks} kids={kids} />

      {/* 待審核任務 */}
      <PendingTasksSection
        pendingTasks={pendingTasks}
        kids={kids}
        bulkApproveMutation={bulkApproveMutation}
        approveTaskMutation={approveTaskMutation}
        rejectTaskMutation={rejectTaskMutation}
        onComment={setCommentTaskId}
      />

      {/* 小孩列表 */}
      <KidsSection
        kids={kids}
        requirePin={requirePin}
        onEdit={setEditKid}
        deleteKidMutation={deleteKidMutation}
        dailyMessageMutation={dailyMessageMutation}
      />

      {/* 本月排行榜 */}
      <LeaderboardSection leaderboard={leaderboard} lbMode={lbMode} onModeChange={setLbMode} />

      {/* 全家儲蓄趨勢比較圖 */}
      {kids.length >= 1 && <FamilyTrendChart />}

      {/* 全家月度總結報 */}
      {kids.length >= 1 && <FamilyMonthlySummary kids={kids} />}

      {/* 家庭年度回顧 */}
      {kids.length >= 1 && <FamilyYearSummary />}

      {/* 全家活動 Timeline（過去 30 天）*/}
      <ActivityTimeline activityFeed={activityFeed} />

      {/* 最近任務 */}
      <RecentTasksSection
        allTasks={allTasks}
        kids={kids}
        requirePin={requirePin}
        editTaskMutation={editTaskMutation}
        cloneTaskMutation={cloneTaskMutation}
        deleteTaskMutation={deleteTaskMutation}
      />

      {/* Dialogs */}
      {showAddKid && (
        <KidDialog
          mode="create"
          onClose={() => setShowAddKid(false)}
          onSuccess={() => {
            invalidateAll()
            setShowAddKid(false)
          }}
        />
      )}
      {editKid && (
        <KidDialog
          mode="edit"
          kid={editKid}
          onClose={() => setEditKid(null)}
          onSuccess={() => {
            invalidateAll()
            setEditKid(null)
          }}
        />
      )}
      {showAddTask && (
        <TaskDialog
          kids={kids}
          onClose={() => setShowAddTask(false)}
          onSuccess={() => {
            invalidateAll()
            setShowAddTask(false)
          }}
        />
      )}

      {showBatchTask && (
        <BatchTaskDialog
          kids={kids}
          onClose={() => setShowBatchTask(false)}
          onSuccess={() => {
            invalidateAll()
            setShowBatchTask(false)
          }}
        />
      )}

      {pinPrompt && (
        <ParentPinDialog
          onClose={() => setPinPrompt(null)}
          onSuccess={() => {
            const action = pinPrompt
            setPinPrompt(null)
            action()
          }}
        />
      )}

      <BackToTop />

      {commentTaskId !== null && (
        <CommentDialog
          taskId={commentTaskId}
          author="parent"
          onClose={() => setCommentTaskId(null)}
        />
      )}
    </div>
  )
}
