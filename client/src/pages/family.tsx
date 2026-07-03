/**
 * 家庭記帳：家長視角主頁（/family）
 *
 * 2026-07-03 Phase 3.2：原 9,524 行拆分 — 卡片元件移至
 * components/family/cards-*.tsx、共用型別移至 family-shared.ts，
 * 本檔只留 FamilyPage 主頁組裝。
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import {
  FamilyTopTaskEmojisCard,
  FamilyCommentInteractionCard,
  FamilyKindnessMilestoneCard,
  FamilyTopRecipientsCard,
  FamilyKindnessStoryCard,
} from "@/components/family/social-cards"
import {
  FamilyTodaySpendingFeedCard,
  FamilyTodayCheckinRosterCard,
  FamilyTodayTasksListCard,
} from "@/components/family/today-cards"
import {
  FamilyApprovalLeadTimeCard,
  FamilyMonthlyTaskCreationTrendCard,
  FamilyMonthlySpendingTrendCard,
  FamilyMonthlyGoalsTrendCard,
} from "@/components/family/stats-cards"
import {
  FamilyStreakRankingCard,
  FamilyBiggestSpendingsCard,
  FamilyBiggestWinsCard,
  FamilyWishesAgingCard,
} from "@/components/family/ranking-cards"
import { FamilyMembersCard } from "@/components/family/family-members-card"
import { FamilyCrossDomainCard } from "@/components/family/family-cross-domain-card"
import { FamilySavingsGoalsCard } from "@/components/family/family-savings-goals-card"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Plus, CheckCircle2, XCircle, Trash2, Zap, Trophy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"
import {
  Kid,
  Task,
  difficultyStars,
  categoryLabel,
  LeaderboardEntry,
  FamilyDashboard,
  formatMoney,
  isPinVerified,
} from "@/components/family/family-shared"
import {
  CategoryStats,
  CommentDialog,
  FamilyInstallChip,
  FamilyYearSummary,
  TaskCalendar,
  TaskStatusBadge,
} from "@/components/family/cards-01-comment-dialog"
import {
  DifficultyInsights,
  FamilyPotsManager,
  FamilyWeeklyHeatmap,
  MoodTrends,
  PotContributorsCard,
  RecipientsManager,
} from "@/components/family/cards-02-mood-trends"
import {
  CompletedGoalsHistory,
  FairnessCard,
  FamilyEducationReports,
  FamilyMilestonesCard,
  FamilyPeakWeekCard,
  FamilyWealthTrend,
  GoalAchieversCard,
  SiblingComparisonCard,
} from "@/components/family/cards-03-family-education-reports"
import {
  FamilyActivityFeed,
  FamilyCalendarHeatmap,
  FamilyEmojiCloudCard,
  FamilyGoalsBoard,
  FamilyMonthlyStats,
  FamilyMultiRankCard,
  KidsAttentionRadar,
  PopularTasksCard,
} from "@/components/family/cards-04-family-multi-rank-card"
import {
  FamilyAvgRewardByCategoryCard,
  FamilyCheckinStreakCard,
  FamilyDayOfWeekDistributionCard,
  FamilyKidsNeedingAttentionCard,
  FamilyRejectionRateCard,
  FamilySpendingSummaryCard,
  FamilyWishPriorityBreakdownCard,
  FamilyWishPromotionRateCard,
  ParentTodoList,
} from "@/components/family/cards-05-parent-todo-list"
import {
  FamilyAllGoalsEtaCard,
  FamilyCategoryBreakdownCard,
  FamilyFirstTaskTimelineCard,
  FamilyKidWeekendVsWeekdayCard,
  FamilyProofImageWallCard,
  FamilyRecentBadgesCard,
  FamilySavingsSummaryCard,
  FamilyStalePendingTasksCard,
  FamilyTaskHourDistributionCard,
  FamilyTaskRepeatByKidCard,
} from "@/components/family/cards-06-family-savings-summary-card"
import {
  FamilyDifficultyByKidCard,
  FamilyKidAvgRewardCard,
  FamilyKidDailyAvgTasksCard,
  FamilyKidFavoriteEmojiCard,
  FamilyKidLearningCurveCard,
  FamilyKidPeakHourCard,
  FamilyTaskCategoryByKidCard,
  FamilyTaskSpeedMvpCard,
  FamilyTodayLeaderboardCard,
  FamilyTodayVsYesterdayCard,
} from "@/components/family/cards-07-family-today-leaderboard-card"
import {
  FamilyBadgeLeaderboardCard,
  FamilyCategoryHeatTrendCard,
  FamilyGoalUrgencyRankCard,
  FamilyGoalsMonthlyCompletionCard,
  FamilyJarAllocationByKidCard,
  FamilyKidActiveDaysCard,
  FamilyKidEarningsTrendCard,
  FamilyKidSpendingHabitsCard,
  FamilyKidTaskCompletionRateCard,
  FamilyTaskMvpCard,
} from "@/components/family/cards-08-family-goal-urgency-rank-card"
import {
  FamilyCaptainCard,
  FamilyDeadlineHitRateCard,
  FamilyGoalAmountHistogramCard,
  FamilyGoalsProgressRankCard,
  FamilyMonthlyImprovementCard,
  FamilyPeakMomentCard,
  FamilySavingsVelocityRankCard,
  FamilySpendingTopItemsCard,
  FamilyTaskDurationCard,
  FamilyTaskMonthlyGrowthCard,
  FamilyTodayTipCard,
} from "@/components/family/cards-09-family-savings-velocity-rank-car"
import {
  FamilyApproveLatencyCard,
  FamilyFeedbackRateCard,
  FamilyGoalsCompletionRateCard,
  FamilyGoalsVsWishesCard,
  FamilyIncomeVsSpendingCard,
  FamilyInitiativeRateCard,
  FamilyJarsCurrentCard,
  FamilyRewardStatsCard,
  FamilyWeekendVsWeekdayCard,
} from "@/components/family/cards-10-family-goals-vs-wishes-card"
import {
  FamilyActivityStreakCard,
  FamilyDailyRecapCard,
  FamilyKidsLastActivityCard,
  FamilyMultiMonthTrendCard,
  FamilySavingsRetentionCard,
  FamilySpendingDailyCard,
  FamilyStoryCard,
  FamilyTaskCadenceCard,
  FamilyTimeOfDayCard,
} from "@/components/family/cards-11-family-spending-daily-card"
import {
  FamilyHealthDashboard,
  FamilyLifetimeCard,
  FamilyMoodToday,
  FamilySearch,
  FamilyTodaySummary,
  FamilyWeeklySummaryCard,
  ParentReminders,
} from "@/components/family/cards-12-family-weekly-summary-card"
import {
  FamilyMonthlySummary,
  FamilyTrendChart,
  KidCard,
  KidDialog,
  TaskDialog,
} from "@/components/family/cards-13-family-monthly-summary"
import { BatchTaskDialog, ParentPinDialog } from "@/components/family/cards-14-parent-pin-dialog"

export default function FamilyPage() {
  useDocumentTitle("家庭記帳")
  const { toast } = useToast()
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

  interface ActivityItem {
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
  const { data: activityFeed } = useQuery<{ days: number; items: ActivityItem[] }>({
    queryKey: ["/api/family/activity-feed?days=30"],
    staleTime: 30_000,
  })

  const currentMonth = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })()
  const [lbMode, setLbMode] = useState<"score" | "tasks" | "giving" | "streak">("score")
  const { data: leaderboard } = useQuery<{
    month: string
    leaderboard: LeaderboardEntry[]
  }>({
    queryKey: [`/api/family/leaderboard?month=${currentMonth}&mode=${lbMode}`],
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/family/"),
    })
  }

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

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 max-w-4xl">
      {/* 標題 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" />
            家庭記帳
          </h1>
          <p className="text-sm text-gray-500 mt-1">派任務、入帳、三罐分配、養成小朋友財務習慣</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => setShowBatchTask(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={kids.length === 0}
          >
            <Zap className="h-4 w-4 mr-1" />
            一鍵派
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddTask(true)}
            className="bg-amber-600 hover:bg-amber-700"
            disabled={kids.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            自訂
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowAddKid(true)}>
            <Plus className="h-4 w-4 mr-1" />
            新增小孩
          </Button>
          <FamilyInstallChip />
        </div>
      </div>

      {/* 全家儀表板 */}
      {dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card>
            <CardContent className="py-3 px-3">
              <div className="text-xs text-gray-500">累計給予</div>
              <div className="text-lg sm:text-xl font-bold text-indigo-700">
                {formatMoney(dashboard.totalReceived)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-3">
              <div className="text-xs text-gray-500">存錢罐合計</div>
              <div className="text-lg sm:text-xl font-bold text-green-700">
                {formatMoney(dashboard.totalSaved)}
              </div>
            </CardContent>
          </Card>
          <Card className={dashboard.toApproveCount > 0 ? "border-amber-300 bg-amber-50" : ""}>
            <CardContent className="py-3 px-3">
              <div className="text-xs text-gray-500">待審核</div>
              <div
                className={`text-lg sm:text-xl font-bold ${
                  dashboard.toApproveCount > 0 ? "text-amber-700" : "text-gray-400"
                }`}
              >
                {dashboard.toApproveCount}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-3">
              <div className="text-xs text-gray-500">未完成任務</div>
              <div className="text-lg sm:text-xl font-bold text-blue-700">
                {dashboard.pendingTaskCount}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 家庭今日重點（最頂部）*/}
      <FamilyTodaySummary />

      {/* 家庭健康儀表板 */}
      <FamilyHealthDashboard />

      {/* 家庭累計總成就 */}
      <FamilyLifetimeCard />

      {/* 全家本週摘要 vs 上週 */}
      <FamilyWeeklySummaryCard />

      {/* 家庭月度故事 */}
      <FamilyStoryCard />

      {/* 家庭一週日報 */}
      <FamilyDailyRecapCard />

      {/* 家庭多月趨勢 */}
      <FamilyMultiMonthTrendCard />

      {/* 家庭儲蓄留存率 */}
      <FamilySavingsRetentionCard />

      {/* 家庭最後活動追蹤 */}
      <FamilyKidsLastActivityCard />

      {/* 任務派發頻率 */}
      <FamilyTaskCadenceCard />

      {/* 家庭整體 streak */}
      <FamilyActivityStreakCard />

      {/* 家庭時段熱圖 */}
      <FamilyTimeOfDayCard />

      {/* 家庭花用每日線 */}
      <FamilySpendingDailyCard />

      {/* 家庭目標達成率 */}
      <FamilyGoalsCompletionRateCard />

      {/* 家庭三罐當前餘額 */}
      <FamilyJarsCurrentCard />

      {/* 家庭收入 vs 花用對比 */}
      <FamilyIncomeVsSpendingCard />

      {/* 家庭周末 vs 工作日 */}
      <FamilyWeekendVsWeekdayCard />

      {/* 家庭主動性比例 */}
      <FamilyInitiativeRateCard />

      {/* 家庭獎勵統計 */}
      <FamilyRewardStatsCard />

      {/* 家庭親子互動 */}
      <FamilyFeedbackRateCard />

      {/* 家庭批准延遲 */}
      <FamilyApproveLatencyCard />

      {/* 家庭目標 vs 願望 */}
      <FamilyGoalsVsWishesCard />

      {/* 家庭目標進度排名 */}
      <FamilyGoalsProgressRankCard />

      {/* 家庭高峰時刻 */}
      <FamilyPeakMomentCard />

      {/* 家庭今日提示 */}
      <FamilyTodayTipCard />

      {/* 家庭 deadline 達標率 */}
      <FamilyDeadlineHitRateCard />

      {/* 家庭月度進步榜 */}
      <FamilyMonthlyImprovementCard />

      {/* 家庭隊長 */}
      <FamilyCaptainCard />

      {/* 家庭花用 top 細項 */}
      <FamilySpendingTopItemsCard />

      {/* 家庭 task 處理時長 */}
      <FamilyTaskDurationCard />

      {/* 家庭目標金額直方圖 */}
      <FamilyGoalAmountHistogramCard />

      {/* 家庭月度任務成長率 */}
      <FamilyTaskMonthlyGrowthCard />

      {/* 家庭儲蓄速度排名 */}
      <FamilySavingsVelocityRankCard />

      {/* 家庭 jar 分配對比 */}
      <FamilyJarAllocationByKidCard />

      {/* 家庭兒童任務批准率 */}
      <FamilyKidTaskCompletionRateCard />

      {/* 家庭 task MVP */}
      <FamilyTaskMvpCard />

      {/* 家庭兒童活躍天數 */}
      <FamilyKidActiveDaysCard />

      {/* 家庭兒童花用習慣 */}
      <FamilyKidSpendingHabitsCard />

      {/* 家庭徽章排名 */}
      <FamilyBadgeLeaderboardCard />

      {/* 家庭分類熱度趨勢 */}
      <FamilyCategoryHeatTrendCard />

      {/* 家庭目標月度達成 */}
      <FamilyGoalsMonthlyCompletionCard />

      {/* 家庭兒童入帳趨勢 */}
      <FamilyKidEarningsTrendCard />

      {/* 家庭目標緊急度排名 */}
      <FamilyGoalUrgencyRankCard />

      {/* 家庭兒童分類偏好 */}
      <FamilyTaskCategoryByKidCard />

      {/* 家庭兒童每日平均任務 */}
      <FamilyKidDailyAvgTasksCard />

      {/* 家庭任務速度榮譽榜 */}
      <FamilyTaskSpeedMvpCard />

      {/* 家庭兒童難度分佈對比 */}
      <FamilyDifficultyByKidCard />

      {/* 家庭任務高峰小時 */}
      <FamilyKidPeakHourCard />

      {/* 家庭兒童最愛 emoji */}
      <FamilyKidFavoriteEmojiCard />

      {/* 家庭兒童學習曲線 */}
      <FamilyKidLearningCurveCard />

      {/* 家庭兒童獎勵平均 */}
      <FamilyKidAvgRewardCard />

      {/* 家庭今日 vs 昨日 */}
      <FamilyTodayVsYesterdayCard />

      {/* 家庭今日排行榜 */}
      <FamilyTodayLeaderboardCard />

      {/* 家庭所有目標 ETA */}
      <FamilyAllGoalsEtaCard />

      {/* 家庭兒童週末 vs 平日 */}
      <FamilyKidWeekendVsWeekdayCard />

      {/* 家庭首次任務時間軸 */}
      <FamilyFirstTaskTimelineCard />

      {/* 家庭兒童任務重複率 */}
      <FamilyTaskRepeatByKidCard />

      {/* 家庭今日任務列表 */}
      <FamilyTodayTasksListCard />

      {/* 本週家庭善心故事 */}
      <FamilyKindnessStoryCard />

      {/* 跨領域整合視圖（階段 4.3） */}
      <FamilyCrossDomainCard />

      {/* 共同存錢目標（階段 4.4） */}
      <FamilySavingsGoalsCard />

      {/* 家庭成員管理（階段 4.1 邀請基底） */}
      <FamilyMembersCard />

      {/* 未批准提醒（家長忘記 approve）*/}
      <FamilyStalePendingTasksCard />

      {/* 證明照片牆 */}
      <FamilyProofImageWallCard />

      {/* 最常支持對象 ranking */}
      <FamilyTopRecipientsCard />

      {/* 行善里程碑 */}
      <FamilyKindnessMilestoneCard />

      {/* 任務類別分佈 */}
      <FamilyCategoryBreakdownCard />

      {/* 今日簽到名冊 */}
      <FamilyTodayCheckinRosterCard />

      {/* 最大獎勵 wins */}
      <FamilyBiggestWinsCard />

      {/* 任務時段熱力圖 */}
      <FamilyTaskHourDistributionCard />

      {/* 徽章時間軸 */}
      <FamilyRecentBadgesCard />

      {/* 家庭儲蓄總進度 */}
      <FamilySavingsSummaryCard />

      {/* 評論互動率 */}
      <FamilyCommentInteractionCard />

      {/* 家庭 reject 率 */}
      <FamilyRejectionRateCard />

      {/* 月度達標 trend */}
      <FamilyMonthlyGoalsTrendCard />

      {/* wish priority 分佈 */}
      <FamilyWishPriorityBreakdownCard />

      {/* 家庭打卡連續天數 */}
      <FamilyCheckinStreakCard />

      {/* 花費三罐分布 */}
      <FamilySpendingSummaryCard />

      {/* wish 升級率 */}
      <FamilyWishPromotionRateCard />

      {/* 週末/工作日分布 (按日 DOW) */}
      <FamilyDayOfWeekDistributionCard />

      {/* 家長關注度警示 */}
      <FamilyKidsNeedingAttentionCard />

      {/* 任務 emoji top 10 */}
      <FamilyTopTaskEmojisCard />

      {/* 願望年齡分布 */}
      <FamilyWishesAgingCard />

      {/* 月度花費走勢 */}
      <FamilyMonthlySpendingTrendCard />

      {/* 最大花費 list */}
      <FamilyBiggestSpendingsCard />

      {/* 類別平均獎金 */}
      <FamilyAvgRewardByCategoryCard />

      {/* 今日 spending feed */}
      <FamilyTodaySpendingFeedCard />

      {/* 月度派任務趨勢 */}
      <FamilyMonthlyTaskCreationTrendCard />

      {/* 批准延遲分析 */}
      <FamilyApprovalLeadTimeCard />

      {/* streak 排行 */}
      <FamilyStreakRankingCard />

      {/* 家庭今日氛圍 */}
      <FamilyMoodToday />

      {/* 家長待辦清單 */}
      <ParentTodoList />

      {/* 關心雷達（找需要關心的 kid）*/}
      <KidsAttentionRadar />

      {/* 跨域搜尋 */}
      <FamilySearch />

      {/* 全家月度統計 */}
      <FamilyMonthlyStats />

      {/* 家庭目標進度看板 */}
      <FamilyGoalsBoard />

      {/* 目標達成歷史 */}
      <CompletedGoalsHistory />

      {/* 目標達成者排行 */}
      <GoalAchieversCard />

      {/* 熱門任務 TOP 5 */}
      <PopularTasksCard />

      {/* 家庭 emoji 雲 */}
      <FamilyEmojiCloudCard />

      {/* 家庭日曆熱度 */}
      <FamilyCalendarHeatmap />

      {/* 多維排行榜 */}
      <FamilyMultiRankCard />

      {/* 家庭高潮週回顧 */}
      <FamilyPeakWeekCard />

      {/* 家庭財富趨勢（6 個月）*/}
      <FamilyWealthTrend />

      {/* 家庭里程碑紀錄 */}
      <FamilyMilestonesCard />

      {/* 兄弟姊妹比較 */}
      <SiblingComparisonCard />

      {/* 家事公平度分析 */}
      <FairnessCard />

      {/* 教育成果報告（每個 kid 一份）*/}
      <FamilyEducationReports />

      {/* 週曆熱度 */}
      <FamilyWeeklyHeatmap />

      {/* 全家活動 feed */}
      <FamilyActivityFeed />

      {/* 家長提醒中心 */}
      <ParentReminders />

      {/* 任務難度智能建議 */}
      <DifficultyInsights />

      {/* 家庭心情軌跡 */}
      <MoodTrends />

      {/* 任務分類分布 */}
      <CategoryStats />

      {/* 任務月曆視圖 */}
      <TaskCalendar tasks={allTasks} kids={kids} />

      {/* 家庭共同存錢罐 */}
      <FamilyPotsManager />

      {/* 家庭目標貢獻者排行 */}
      <PotContributorsCard />

      {/* 捐贈對象目錄 */}
      <RecipientsManager />

      {/* 待審核任務 */}
      {pendingTasks.length > 0 && (
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
                        onClick={() => setCommentTaskId(t.id)}
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
      )}

      {/* 小孩列表 */}
      <Card>
        <CardHeader className="py-3 px-3 sm:px-4">
          <CardTitle className="text-base">家庭成員</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3 sm:px-4">
          {kids.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6">
              還沒新增小孩、點上方「新增小孩」開始
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {kids.map((kid) => (
                <KidCard
                  key={kid.id}
                  kid={kid}
                  onEdit={() => requirePin(() => setEditKid(kid))}
                  onDelete={() =>
                    requirePin(() => {
                      if (confirm(`停用 ${kid.displayName}？（資料保留、可重新啟用）`)) {
                        deleteKidMutation.mutate(kid.id)
                      }
                    })
                  }
                  onEncourage={() => {
                    const msg = window.prompt(
                      `寫一句今天給 ${kid.displayName} 的鼓勵（會顯示在小孩首頁）：`,
                      ""
                    )
                    if (msg?.trim()) {
                      dailyMessageMutation.mutate({ kidId: kid.id, message: msg.trim() })
                    }
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 本月排行榜 */}
      {leaderboard && leaderboard.leaderboard.length > 0 && (
        <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50">
          <CardHeader className="py-3 px-3 sm:px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              本月排行榜（{leaderboard.month}）
            </CardTitle>
            <CardDescription>切換不同角度看孩子的努力</CardDescription>
            <div className="flex gap-1 mt-2 flex-wrap">
              {[
                { v: "score" as const, label: "🏆 積分", desc: "難度加權" },
                { v: "tasks" as const, label: "📋 任務數", desc: "完成多少" },
                { v: "giving" as const, label: "❤️ 善行", desc: "捐獻金額" },
                { v: "streak" as const, label: "🔥 打卡", desc: "連續天數" },
              ].map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => setLbMode(m.v)}
                  className={`text-xs py-1 px-2.5 rounded border ${
                    lbMode === m.v
                      ? "bg-yellow-200 border-yellow-500 font-medium"
                      : "bg-white border-yellow-200 hover:bg-yellow-100"
                  }`}
                  title={m.desc}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="py-2 px-3 sm:px-4 space-y-2">
            {leaderboard.leaderboard.map((entry) => (
              <motion.div
                key={entry.kidId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: entry.rank * 0.05 }}
                className={`flex items-center gap-2 p-2 rounded-lg ${
                  entry.rank === 1
                    ? "bg-yellow-100 border-2 border-yellow-400"
                    : entry.rank === 2
                      ? "bg-gray-100 border border-gray-300"
                      : entry.rank === 3
                        ? "bg-orange-100 border border-orange-300"
                        : "bg-white"
                }`}
              >
                <div className="text-2xl w-8 text-center">{entry.medal || `#${entry.rank}`}</div>
                <div className="text-3xl">{entry.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{entry.displayName}</div>
                  <div className="text-[10px] text-gray-500 flex gap-2 flex-wrap">
                    <span>📋 {entry.approvedCount} 個任務</span>
                    {entry.hardCount > 0 && (
                      <span className="text-rose-600">⭐⭐⭐ ×{entry.hardCount}</span>
                    )}
                    {entry.completedGoalsCount > 0 && (
                      <span>🎯 達標 {entry.completedGoalsCount}</span>
                    )}
                    {entry.badgeCount > 0 && <span>🏅 +{entry.badgeCount} 徽章</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-amber-700">
                    {lbMode === "giving"
                      ? `❤️ ${formatMoney(entry.giveSum)}`
                      : lbMode === "tasks"
                        ? `📋 ${entry.approvedCount}`
                        : lbMode === "streak"
                          ? `🔥 ${entry.streak} 天`
                          : formatMoney(entry.approvedSum)}
                  </div>
                  <div className="text-[10px] text-rose-600 font-medium">
                    積分 {entry.weightedScore}
                  </div>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 全家儲蓄趨勢比較圖 */}
      {kids.length >= 1 && <FamilyTrendChart />}

      {/* 全家月度總結報 */}
      {kids.length >= 1 && <FamilyMonthlySummary kids={kids} />}

      {/* 家庭年度回顧 */}
      {kids.length >= 1 && <FamilyYearSummary />}

      {/* 全家活動 Timeline（過去 30 天）*/}
      {activityFeed && activityFeed.items.length > 0 && (
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
      )}

      {/* 最近任務 */}
      {allTasks.length > 0 && (
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
      )}

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
