/**
 * 家庭記帳：家長視角主頁（/family）
 *
 * 功能：
 *  - 家庭成員（小孩）管理：新增 / 編輯 / 三罐比例
 *  - 任務派發 + 審核中心
 *  - 全家儀表板總覽
 *  - 各小孩 jars 概覽（連到 /family/kid/:id 看細節）
 *
 * 設計：手機優先、單手拇指區操作、Bottom Sheet 取代 Dialog（手機）
 */
import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Link } from "wouter"
import { FamilyTopTaskEmojisCard } from "@/components/family/social-cards"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  Plus,
  CheckCircle2,
  XCircle,
  Trash2,
  Sparkles,
  PiggyBank,
  Target,
  ExternalLink,
  Zap,
  Trophy,
  Lock,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"
import { useInstallPrompt } from "@/hooks/use-install-prompt"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface Kid {
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

interface Task {
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

const difficultyStars = (d?: string) => (d === "easy" ? "⭐" : d === "hard" ? "⭐⭐⭐" : "⭐⭐")

const categoryLabel = (c?: string) =>
  c === "housework"
    ? "🧹"
    : c === "study"
      ? "📚"
      : c === "self_care"
        ? "🪥"
        : c === "kindness"
          ? "❤️"
          : ""

interface Jar {
  kidId: number
  spendBalance: string
  saveBalance: string
  giveBalance: string
  totalReceived: string
  totalSpent: string
}

interface LeaderboardEntry {
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

interface FamilyDashboard {
  scope: "family"
  kids: Kid[]
  totalReceived: number
  totalSaved: number
  pendingTaskCount: number
  toApproveCount: number
}

const COLOR_TOKENS: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  pink: { bg: "bg-pink-50", border: "border-pink-300", text: "text-pink-700" },
  green: { bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
  amber: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
  purple: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  cyan: { bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700" },
}

const AVATAR_OPTIONS = ["🧒", "👧", "👦", "🧑", "👶", "🐱", "🐶", "🐻", "🦊", "🐰", "🐼", "🦁"]

function formatMoney(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v
  return "$" + Math.round(n).toLocaleString()
}

// 家長 PIN：sessionStorage 記憶 30 分鐘
const PIN_KEY = "family.parentPin.verifiedAt"
const PIN_TTL_MS = 30 * 60 * 1000
function isPinVerified(): boolean {
  const ts = parseInt(sessionStorage.getItem(PIN_KEY) || "0", 10)
  return ts > 0 && Date.now() - ts < PIN_TTL_MS
}
function setPinVerified() {
  sessionStorage.setItem(PIN_KEY, String(Date.now()))
}

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

function CommentDialog({
  taskId,
  author,
  onClose,
}: {
  taskId: number
  author: "parent" | "kid"
  onClose: () => void
}) {
  const { toast } = useToast()
  const [message, setMessage] = useState("")

  interface Comment {
    id: number
    taskId: number
    author: "parent" | "kid"
    message: string
    emoji: string
    createdAt: string
  }

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: [`/api/family/tasks/${taskId}/comments`],
  })

  const sendMut = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/family/tasks/${taskId}/comments`, {
        author,
        message: message.trim(),
      }),
    onSuccess: () => {
      setMessage("")
      queryClient.invalidateQueries({
        queryKey: [`/api/family/tasks/${taskId}/comments`],
      })
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>💬 任務討論</DialogTitle>
          <DialogDescription>家長和小孩可在這對話、像 LINE 一樣</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {comments.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6">
              還沒有人留言、來開始討論吧 💬
            </div>
          ) : (
            comments.map((c) => {
              const mine = c.author === author
              return (
                <div key={c.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                      mine
                        ? "bg-indigo-500 text-white"
                        : c.author === "parent"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-pink-100 text-pink-900"
                    }`}
                  >
                    <div className="text-[10px] opacity-75 mb-0.5">
                      {c.author === "parent" ? "👨‍👩 大人" : "🧒 小孩"} ·{" "}
                      {new Date(c.createdAt).toLocaleString("zh-TW", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div>{c.message}</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="flex gap-2 items-end">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="輸入訊息..."
            maxLength={500}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && message.trim()) {
                e.preventDefault()
                sendMut.mutate()
              }
            }}
            className="flex-1"
          />
          <Button
            disabled={!message.trim() || sendMut.isPending}
            onClick={() => sendMut.mutate()}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            送出
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TaskStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "待完成", cls: "bg-gray-100 text-gray-700" },
    submitted: { label: "待審核", cls: "bg-amber-100 text-amber-800" },
    approved: { label: "已入帳", cls: "bg-green-100 text-green-800" },
    rejected: { label: "已駁回", cls: "bg-red-100 text-red-800" },
  }
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" }
  return <Badge className={`${s.cls} text-[10px]`}>{s.label}</Badge>
}

function FamilyInstallChip() {
  const { canInstall, install } = useInstallPrompt()
  if (!canInstall) return null
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={install}
      className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
      title="把家庭記帳加到主畫面、像原生 app"
    >
      📱 安裝
    </Button>
  )
}

function FamilyYearSummary() {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())

  interface YearSummary {
    year: number
    kids: Array<{
      kidId: number
      displayName: string
      avatar: string
      color: string
      approvedCount: number
      approvedSum: number
      hardCount: number
    }>
    goals: Array<{
      name: string
      emoji: string | null
      target: number
      completedAt: string
      kidName: string
      avatar: string
    }>
    badges: Array<{
      title: string
      emoji: string
      earnedAt: string
      kidName: string
    }>
    monthly: Array<{ month: number; total: number }>
    grandTotal: {
      tasks: number
      reward: number
      hardCount: number
      goalsCompleted: number
      badgesEarned: number
      totalGiven: number
      donationCount: number
      recipientCount: number
    }
  }
  const { data } = useQuery<YearSummary>({
    queryKey: [`/api/family/year-summary?year=${year}`],
    enabled: open,
    staleTime: 5 * 60_000,
  })

  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear()
    return [cur, cur - 1, cur - 2, cur - 3]
  }, [])

  return (
    <Card className="border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-purple-50 to-pink-50">
      <CardHeader className="py-3 px-3 sm:px-4 cursor-pointer" onClick={() => setOpen((s) => !s)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">🎊</span>
            家庭年度回顧
          </CardTitle>
          <span className="text-xs text-fuchsia-700">{open ? "▲ 收起" : "▼ 展開"}</span>
        </div>
        <CardDescription>家庭年底儀式、全年戰績一頁看完</CardDescription>
      </CardHeader>
      {open && (
        <CardContent className="py-2 px-3 sm:px-4 space-y-3">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)} className="text-xs">
                  {y} 年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!data ? (
            <div className="text-center text-sm text-gray-400 py-4">載入中…</div>
          ) : (
            <>
              {/* Grand totals */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white rounded p-2 text-center border border-fuchsia-200">
                  <div className="text-[10px] text-gray-500">完成任務</div>
                  <div className="font-bold text-fuchsia-700">{data.grandTotal.tasks}</div>
                  {data.grandTotal.hardCount > 0 && (
                    <div className="text-[9px] text-rose-500">
                      ⭐⭐⭐×{data.grandTotal.hardCount}
                    </div>
                  )}
                </div>
                <div className="bg-white rounded p-2 text-center border border-fuchsia-200">
                  <div className="text-[10px] text-gray-500">總給付</div>
                  <div className="font-bold text-amber-700">
                    {formatMoney(data.grandTotal.reward)}
                  </div>
                </div>
                <div className="bg-white rounded p-2 text-center border border-fuchsia-200">
                  <div className="text-[10px] text-gray-500">達成目標</div>
                  <div className="font-bold text-purple-700">
                    {data.grandTotal.goalsCompleted}
                    <span className="text-[10px] text-amber-500 ml-1">
                      🏅×{data.grandTotal.badgesEarned}
                    </span>
                  </div>
                </div>
                <div className="bg-white rounded p-2 text-center border border-fuchsia-200">
                  <div className="text-[10px] text-gray-500">愛心捐獻</div>
                  <div className="font-bold text-rose-700">
                    {formatMoney(data.grandTotal.totalGiven)}
                  </div>
                  <div className="text-[9px] text-gray-400">{data.grandTotal.donationCount} 筆</div>
                </div>
              </div>

              {/* 各小孩戰績 */}
              {data.kids.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-700 mb-1">🏆 小孩戰績排名</div>
                  <div className="space-y-1">
                    {data.kids.map((k, i) => (
                      <div
                        key={k.kidId}
                        className="flex items-center gap-2 bg-white rounded p-2 text-sm border border-fuchsia-100"
                      >
                        <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : ""}</span>
                        <span className="text-xl">{k.avatar}</span>
                        <span className="font-medium flex-1">{k.displayName}</span>
                        <span className="text-xs text-gray-500">📋 {k.approvedCount}</span>
                        <span className="font-mono font-bold text-amber-700">
                          {formatMoney(k.approvedSum)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 達成目標 */}
              {data.goals.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-700 mb-1">
                    🎯 達成的目標（{data.goals.length}）
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.goals.slice(0, 10).map((g, i) => (
                      <div
                        key={i}
                        className="text-xs bg-white border border-purple-200 px-2 py-0.5 rounded-full"
                      >
                        {g.emoji ?? "🎯"} {g.name}
                        <span className="text-gray-400 ml-1">
                          ({g.avatar} {formatMoney(g.target)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 徽章 */}
              {data.badges.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-700 mb-1">
                    🏅 解鎖徽章（{data.badges.length}）
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.badges.slice(0, 20).map((b, i) => (
                      <span key={i} title={`${b.kidName} · ${b.title}`} className="text-2xl">
                        {b.emoji}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function TaskCalendar({ tasks, kids }: { tasks: Task[]; kids: Kid[] }) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // 只看有 dueDate 的任務
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks.forEach((t) => {
      if (!t.dueDate) return
      const date = String(t.dueDate).slice(0, 10)
      if (!map.has(date)) map.set(date, [])
      map.get(date)!.push(t)
    })
    return map
  }, [tasks])

  // 算月曆格子
  const grid = useMemo(() => {
    const firstDay = new Date(viewMonth.year, viewMonth.month, 1)
    const startWeekday = firstDay.getDay() // 0=日
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate()
    const cells: Array<{ date: string | null; day: number | null }> = []
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null, day: null })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      cells.push({ date, day: d })
    }
    return cells
  }, [viewMonth])

  const monthLabel = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}`
  const today = new Date().toISOString().slice(0, 10)
  const totalThisMonth = grid.reduce(
    (s, c) => s + (c.date ? (tasksByDate.get(c.date)?.length ?? 0) : 0),
    0
  )

  const goPrev = () =>
    setViewMonth((s) => ({
      year: s.month === 0 ? s.year - 1 : s.year,
      month: s.month === 0 ? 11 : s.month - 1,
    }))
  const goNext = () =>
    setViewMonth((s) => ({
      year: s.month === 11 ? s.year + 1 : s.year,
      month: s.month === 11 ? 0 : s.month + 1,
    }))

  const selectedTasks = selectedDate ? (tasksByDate.get(selectedDate) ?? []) : []

  if (totalThisMonth === 0 && !open) return null

  return (
    <Card className="border-violet-200 bg-violet-50">
      <CardHeader className="py-3 px-3 sm:px-4 cursor-pointer" onClick={() => setOpen((s) => !s)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">📆</span>
            任務月曆
          </CardTitle>
          <span className="text-xs text-violet-700">
            {open ? "▲" : "▼"} ({totalThisMonth} 個截止)
          </span>
        </div>
        <CardDescription>看哪天小孩要做什麼、避免擠在同一天</CardDescription>
      </CardHeader>
      {open && (
        <CardContent className="py-2 px-3 sm:px-4">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={goPrev}
              className="px-2 py-0.5 text-xs hover:bg-white rounded"
            >
              ◀
            </button>
            <span className="text-sm font-medium">{monthLabel}</span>
            <button
              type="button"
              onClick={goNext}
              className="px-2 py-0.5 text-xs hover:bg-white rounded"
            >
              ▶
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-[10px]">
            {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
              <div key={w} className="text-center text-gray-500 font-medium py-1">
                {w}
              </div>
            ))}
            {grid.map((c, i) => {
              if (!c.date) return <div key={i} className="aspect-square bg-transparent" />
              const dayTasks = tasksByDate.get(c.date) ?? []
              const isToday = c.date === today
              const isSelected = c.date === selectedDate
              const hasTask = dayTasks.length > 0
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : c.date)}
                  className={`aspect-square rounded text-xs flex flex-col items-center justify-center transition relative ${
                    isSelected
                      ? "bg-violet-500 text-white"
                      : isToday
                        ? "bg-violet-200 font-bold"
                        : hasTask
                          ? "bg-white hover:bg-violet-100"
                          : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                  }`}
                >
                  <span>{c.day}</span>
                  {hasTask && (
                    <span
                      className={`text-[8px] leading-none mt-0.5 ${
                        isSelected ? "text-white" : "text-violet-700"
                      }`}
                    >
                      {dayTasks.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {selectedDate && selectedTasks.length > 0 && (
            <div className="mt-3 pt-2 border-t border-violet-200 space-y-1">
              <div className="text-xs font-medium text-violet-700">
                📌 {selectedDate} 的任務（{selectedTasks.length}）
              </div>
              {selectedTasks.map((t) => {
                const kid = kids.find((k) => k.id === t.kidId)
                return (
                  <div
                    key={t.id}
                    className="bg-white rounded p-2 text-xs flex items-center gap-2 border border-violet-200"
                  >
                    <span className="text-base">{t.emoji ?? "📋"}</span>
                    <span className="flex-1">{t.title}</span>
                    <span className="text-gray-500">
                      {kid?.avatar} {kid?.displayName}
                    </span>
                    <TaskStatusBadge status={t.status} />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function CategoryStats() {
  interface KidStat {
    kidId: number
    displayName: string
    avatar: string
    color: string
    categories: Record<string, { count: number; rewardSum: number }>
    total: number
  }
  const { data } = useQuery<{
    days: number
    kids: KidStat[]
    grandTotal: Record<string, { count: number; rewardSum: number }>
  }>({
    queryKey: ["/api/family/category-stats?days=30"],
    staleTime: 60_000,
  })
  if (!data) return null
  const totalCount = Object.values(data.grandTotal).reduce((s, c) => s + c.count, 0)
  if (totalCount === 0) return null

  const CATEGORIES = [
    { key: "housework", label: "🧹 家事", color: "bg-blue-400" },
    { key: "study", label: "📚 學習", color: "bg-purple-400" },
    { key: "self_care", label: "🪥 照顧", color: "bg-amber-400" },
    { key: "kindness", label: "❤️ 善行", color: "bg-rose-400" },
    { key: "other", label: "📋 其他", color: "bg-gray-400" },
  ] as const

  return (
    <Card className="border-indigo-200 bg-indigo-50">
      <CardHeader className="py-3 px-3 sm:px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-xl">📊</span>
          任務分類分布
        </CardTitle>
        <CardDescription>過去 {data.days} 天各小孩做哪些類別、發現偏好或缺什麼</CardDescription>
      </CardHeader>
      <CardContent className="py-2 px-3 sm:px-4 space-y-2">
        {/* 各小孩 stack bar */}
        {data.kids
          .filter((k) => k.total > 0)
          .map((k) => (
            <div key={k.kidId} className="bg-white rounded p-2 border border-indigo-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{k.avatar}</span>
                <span className="font-medium text-sm flex-1">{k.displayName}</span>
                <span className="text-xs text-gray-500">{k.total} 個任務</span>
              </div>
              <div className="flex h-4 rounded overflow-hidden bg-gray-100">
                {CATEGORIES.map((c) => {
                  const pct = (k.categories[c.key].count / k.total) * 100
                  if (pct === 0) return null
                  return (
                    <div
                      key={c.key}
                      className={c.color}
                      style={{ width: `${pct}%` }}
                      title={`${c.label}：${k.categories[c.key].count} 個`}
                    />
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                {CATEGORIES.map((c) => {
                  if (k.categories[c.key].count === 0) return null
                  return (
                    <span key={c.key} className="text-gray-700">
                      {c.label} {k.categories[c.key].count}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  )
}

function MoodTrends() {
  interface Series {
    kidId: number
    displayName: string
    avatar: string
    color: string
    checkins: Array<{ date: string; mood: string }>
    avgScore: number
    count: number
  }
  const { data } = useQuery<{ days: number; series: Series[] }>({
    queryKey: ["/api/family/mood-trends?days=14"],
    staleTime: 60_000,
  })
  if (!data || data.series.length === 0) return null
  const hasAnyCheckin = data.series.some((s) => s.count > 0)
  if (!hasAnyCheckin) return null

  return (
    <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-violet-50">
      <CardHeader className="py-3 px-3 sm:px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-xl">💭</span>
          家庭心情軌跡
        </CardTitle>
        <CardDescription>近 {data.days} 天小孩心情、關心情緒變化</CardDescription>
      </CardHeader>
      <CardContent className="py-2 px-3 sm:px-4 space-y-2">
        {data.series
          .filter((s) => s.count > 0)
          .map((s) => {
            const moodLabel =
              s.avgScore >= 4.5
                ? "很好 🌞"
                : s.avgScore >= 3.5
                  ? "不錯 🙂"
                  : s.avgScore >= 2.5
                    ? "普通 😐"
                    : s.avgScore >= 1.5
                      ? "不太好 😢"
                      : "需要關心 ❤️"
            return (
              <div key={s.kidId} className="bg-white rounded p-2 border border-sky-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">{s.avatar}</span>
                  <span className="font-medium text-sm flex-1">{s.displayName}</span>
                  <span className="text-xs text-sky-700 font-medium">
                    {moodLabel}（{s.count} 天）
                  </span>
                </div>
                <div className="flex gap-0.5 items-center">
                  {s.checkins.slice(-14).map((c, i) => (
                    <span key={i} className="text-base" title={`${c.date}：${c.mood}`}>
                      {c.mood.slice(0, 2)}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
      </CardContent>
    </Card>
  )
}

function PotContributorsCard() {
  const { data } = useQuery<{
    total: number
    totalAmount: number
    topContributor: { kidName: string; avatar: string; totalAmount: number } | null
    contributors: Array<{
      kidId: number
      kidName: string
      avatar: string
      totalAmount: number
      contributionCount: number
    }>
  }>({
    queryKey: ["/api/family/pot-top-contributors"],
    queryFn: async () => {
      const res = await fetch("/api/family/pot-top-contributors?limit=10", {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  const medals = ["🥇", "🥈", "🥉", "🏅", "🏅"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-fuchsia-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-purple-900 flex items-center gap-2">🏆 家庭目標貢獻者</h3>
        <span className="text-xs text-gray-500">總計 ${data.totalAmount}</span>
      </div>

      {data.topContributor && (
        <div className="bg-white rounded-lg p-3 mb-3 text-center">
          <div className="text-4xl mb-1">{data.topContributor.avatar}</div>
          <div className="text-sm font-bold text-purple-900">
            最大功臣：{data.topContributor.kidName}
          </div>
          <div className="text-xs text-gray-600">累積貢獻 ${data.topContributor.totalAmount}</div>
        </div>
      )}

      <div className="space-y-1">
        {data.contributors.map((c, i) => {
          const percentage =
            data.totalAmount > 0 ? Math.round((c.totalAmount / data.totalAmount) * 100) : 0
          return (
            <div key={c.kidId} className="bg-white rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{medals[i] ?? "🏅"}</span>
                <span className="text-lg">{c.avatar}</span>
                <span className="text-sm font-bold flex-1">{c.kidName}</span>
                <span className="text-xs font-bold text-purple-700">
                  ${c.totalAmount}（{c.contributionCount} 次）
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-fuchsia-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyPotsManager() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  interface PotContribution {
    id: number
    kidId: number
    amount: string
    createdAt: string
  }
  interface FamilyPot {
    id: number
    name: string
    emoji: string | null
    targetAmount: string
    currentAmount: string
    status: "active" | "completed" | "abandoned"
    description: string | null
    completedAt: string | null
    contributions: PotContribution[]
  }
  const { data: pots = [] } = useQuery<FamilyPot[]>({
    queryKey: ["/api/family/pots"],
    enabled: open,
  })
  const activePots = pots.filter((p) => p.status === "active")
  const completedPots = pots.filter((p) => p.status === "completed").slice(0, 5)

  const addMut = useMutation({
    mutationFn: (vars: { name: string; emoji: string; targetAmount: number }) =>
      apiRequest("POST", "/api/family/pots", vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family/pots"] })
      toast({ title: "🏆 新罐建立成功" })
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })
  const delMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/family/pots/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family/pots"] })
    },
  })

  return (
    <Card className="border-amber-300 bg-gradient-to-br from-yellow-50 to-amber-50">
      <CardHeader className="py-3 px-3 sm:px-4 cursor-pointer" onClick={() => setOpen((s) => !s)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">🏆</span>
            家庭共同存錢罐
          </CardTitle>
          <span className="text-xs text-amber-700">{open ? "▲" : "▼"}</span>
        </div>
        <CardDescription>全家為共同目標一起存（如：旅行、家庭遊戲機）</CardDescription>
      </CardHeader>
      {open && (
        <CardContent className="py-2 px-3 sm:px-4 space-y-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs"
            onClick={() => {
              const name = window.prompt("罐名稱（如「家庭旅行」）：", "")
              if (!name?.trim()) return
              const emoji = window.prompt("emoji（如 ✈️）：", "🏆") || "🏆"
              const t = window.prompt("目標金額：", "")
              const target = parseFloat(t ?? "0")
              if (!(target > 0)) {
                toast({ title: "請輸入有效金額", variant: "destructive" })
                return
              }
              addMut.mutate({ name: name.trim(), emoji, targetAmount: target })
            }}
          >
            ➕ 新增共同罐
          </Button>
          {activePots.length === 0 && completedPots.length === 0 && (
            <div className="text-center text-xs text-gray-400 py-2">還沒有共同罐、點上方新增</div>
          )}
          {activePots.map((p) => {
            const cur = parseFloat(p.currentAmount)
            const target = parseFloat(p.targetAmount)
            const pct = target > 0 ? Math.min(100, Math.round((cur / target) * 100)) : 0
            return (
              <div key={p.id} className="bg-white border border-amber-200 rounded p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">{p.emoji ?? "🏆"}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      {formatMoney(cur)} / {formatMoney(target)}（{pct}%）
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`刪除「${p.name}」？貢獻不會退還`)) delMut.mutate(p.id)
                    }}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="h-2 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-yellow-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {p.contributions.length > 0 && (
                  <div className="text-[10px] text-gray-500 mt-1">
                    {p.contributions.length} 筆貢獻
                  </div>
                )}
              </div>
            )
          })}
          {completedPots.length > 0 && (
            <div className="pt-2 border-t border-amber-200">
              <div className="text-xs text-gray-600 mb-1">🎉 已達成</div>
              <div className="space-y-1">
                {completedPots.map((p) => (
                  <div
                    key={p.id}
                    className="text-xs bg-emerald-50 border border-emerald-200 rounded p-1.5 flex items-center gap-1.5"
                  >
                    <span>{p.emoji ?? "🏆"}</span>
                    <span className="flex-1">{p.name}</span>
                    <span className="font-mono text-emerald-700">
                      {formatMoney(p.targetAmount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function RecipientsManager() {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  interface Recipient {
    id: number
    name: string
    emoji: string | null
    description: string | null
    sortOrder: number
  }
  const { data: recipients = [] } = useQuery<Recipient[]>({
    queryKey: ["/api/family/recipients"],
    enabled: open,
  })
  const addMut = useMutation({
    mutationFn: (vars: { name: string; emoji: string; description?: string }) =>
      apiRequest("POST", "/api/family/recipients", vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family/recipients"] })
      toast({ title: "✅ 已新增" })
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })
  const delMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/family/recipients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family/recipients"] })
    },
  })

  return (
    <Card className="border-rose-200">
      <CardHeader className="py-3 px-3 sm:px-4 cursor-pointer" onClick={() => setOpen((s) => !s)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">❤️</span>
            捐贈對象目錄
          </CardTitle>
          <span className="text-xs text-rose-700">{open ? "▲" : "▼"}</span>
        </div>
        <CardDescription>家長預設常見對象、小孩 give 罐時直接點選</CardDescription>
      </CardHeader>
      {open && (
        <CardContent className="py-2 px-3 sm:px-4 space-y-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs"
            onClick={() => {
              const name = window.prompt("對象名稱（如「動物保護協會」）：", "")
              if (!name?.trim()) return
              const emoji = window.prompt("emoji（如 🐶）：", "❤️") || "❤️"
              const description = window.prompt("描述（可選）：", "") || undefined
              addMut.mutate({ name: name.trim(), emoji, description })
            }}
          >
            ➕ 新增捐贈對象
          </Button>
          {recipients.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-2">還沒有對象、點上方新增</div>
          ) : (
            <div className="space-y-1">
              {recipients.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 bg-white border border-rose-200 rounded p-2"
                >
                  <span className="text-xl">{r.emoji ?? "❤️"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{r.name}</div>
                    {r.description && (
                      <div className="text-[10px] text-gray-500 truncate">{r.description}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`刪除「${r.name}」？`)) delMut.mutate(r.id)
                    }}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function DifficultyInsights() {
  interface Insight {
    kidId: number
    displayName: string
    avatar: string
    breakdown: Record<string, { approved: number; rejected: number; rate: number }>
    suggestions: string[]
  }
  const { data } = useQuery<{ insights: Insight[] }>({
    queryKey: ["/api/family/difficulty-insights"],
    staleTime: 5 * 60_000,
  })
  if (!data || data.insights.length === 0) return null

  return (
    <Card className="border-cyan-200 bg-cyan-50">
      <CardHeader className="py-3 px-3 sm:px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-xl">🧠</span>
          難度智能建議
        </CardTitle>
        <CardDescription>過去 90 天通過率分析、自動建議調整任務難度</CardDescription>
      </CardHeader>
      <CardContent className="py-2 px-3 sm:px-4 space-y-2">
        {data.insights.map((i) => (
          <div key={i.kidId} className="bg-white rounded p-2 border border-cyan-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{i.avatar}</span>
              <span className="font-medium text-sm">{i.displayName}</span>
              <div className="ml-auto flex gap-1 text-[10px]">
                {(["easy", "medium", "hard"] as const).map((d) =>
                  i.breakdown[d] ? (
                    <span
                      key={d}
                      className={`px-1.5 py-0.5 rounded ${
                        d === "easy"
                          ? "bg-green-100 text-green-700"
                          : d === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {d === "easy" ? "⭐" : d === "medium" ? "⭐⭐" : "⭐⭐⭐"}{" "}
                      {i.breakdown[d].rate}%
                    </span>
                  ) : null
                )}
              </div>
            </div>
            {i.suggestions.map((s, idx) => (
              <div key={idx} className="text-xs text-cyan-700 pl-7 leading-relaxed">
                💡 {s}
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function KidEducationCard({
  kidId,
  kidName,
  avatar,
}: {
  kidId: number
  kidName: string
  avatar: string
}) {
  const { data } = useQuery<{
    overallScore: number
    overallComment: string
    dimensions: Array<{
      key: string
      name: string
      emoji: string
      score: number
      comment: string
      detail: string
    }>
  }>({
    queryKey: ["/api/family/kid-education-report", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-education-report?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data) return null

  function scoreColor(s: number) {
    if (s >= 80) return "bg-emerald-500"
    if (s >= 60) return "bg-blue-500"
    if (s >= 40) return "bg-amber-500"
    if (s >= 20) return "bg-orange-400"
    return "bg-gray-300"
  }

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{avatar}</span>
        <div className="flex-1">
          <div className="font-bold text-sm">{kidName}</div>
          <div className="text-xs text-gray-500">{data.overallComment}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-violet-700">{data.overallScore}</div>
          <div className="text-[10px] text-gray-500">總分</div>
        </div>
      </div>

      <div className="space-y-1">
        {data.dimensions.map((d) => (
          <div key={d.key}>
            <div className="flex items-center justify-between mb-0.5 text-xs">
              <span>
                {d.emoji} {d.name}
              </span>
              <span className="font-bold text-gray-700">{d.score}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${scoreColor(d.score)}`} style={{ width: `${d.score}%` }} />
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{d.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyWeeklyHeatmap() {
  const { data } = useQuery<{
    weeks: number
    totalTasks: number
    peak: number
    busiestDay: { dow: number; name: string; emoji: string; count: number } | null
    quietestDay: { dow: number; name: string; emoji: string; count: number } | null
    days: Array<{
      dow: number
      name: string
      emoji: string
      count: number
      totalReward: number
    }>
    insight: string
  }>({
    queryKey: ["/api/family/weekly-heatmap"],
    queryFn: async () => {
      const res = await fetch("/api/family/weekly-heatmap?weeks=12", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.totalTasks === 0) return null

  const peak = data.peak

  function intensity(c: number) {
    if (c === 0) return "bg-gray-100 text-gray-400"
    if (peak <= 1) return "bg-emerald-200 text-emerald-900"
    if (c <= Math.ceil(peak * 0.33)) return "bg-emerald-200 text-emerald-900"
    if (c <= Math.ceil(peak * 0.66)) return "bg-emerald-400 text-white"
    return "bg-emerald-700 text-white"
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-emerald-900 flex items-center gap-2">
          📊 週曆熱度（近 {data.weeks} 週）
        </h3>
        <span className="text-xs text-gray-500">{data.totalTasks} 個任務</span>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-3">
        {data.days.map((d) => (
          <div
            key={d.dow}
            className={`rounded-lg p-2 text-center transition-colors ${intensity(d.count)}`}
            title={`${d.name}：${d.count} 個任務、$${d.totalReward}`}
          >
            <div className="text-lg">{d.emoji}</div>
            <div className="text-xs font-bold">{d.name.slice(1)}</div>
            <div className="text-lg font-bold mt-0.5">{d.count}</div>
          </div>
        ))}
      </div>

      <div className="bg-white/70 rounded px-3 py-2 text-sm text-emerald-900 font-medium">
        💡 {data.insight}
      </div>
    </div>
  )
}

function FamilyEducationReports() {
  const { data: kids } = useQuery<
    Array<{ id: number; displayName: string; avatar: string; isActive: boolean }>
  >({
    queryKey: ["/api/family/kids"],
    queryFn: async () => {
      const res = await fetch("/api/family/kids", { credentials: "include" })
      return res.json()
    },
  })
  if (!kids || kids.length === 0) return null
  const activeKids = kids.filter((k) => k.isActive !== false)
  if (activeKids.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow">
      <h3 className="font-bold text-violet-900 mb-3 flex items-center gap-2">🎓 教育成果報告</h3>
      <div className="space-y-2">
        {activeKids.map((k) => (
          <KidEducationCard key={k.id} kidId={k.id} kidName={k.displayName} avatar={k.avatar} />
        ))}
      </div>
      <div className="text-[11px] text-violet-600 mt-2 text-center">
        4 維度：主動性 / 儲蓄能力 / 同理心 / 規律性
      </div>
    </div>
  )
}

function FairnessCard() {
  const { data } = useQuery<{
    days: number
    totalTasks: number
    expectedPerKid: number
    fairnessLevel: "fair" | "ok" | "unbalanced" | "biased" | "n/a"
    message: string
    maxKid: { kidName: string; avatar: string; taskPercentage: number } | null
    minKid: { kidName: string; avatar: string; taskPercentage: number } | null
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      tasks: number
      reward: number
      taskPercentage: number
    }>
  }>({
    queryKey: ["/api/family/fairness"],
    queryFn: async () => {
      const res = await fetch("/api/family/fairness?days=30", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.fairnessLevel === "n/a" || data.totalTasks === 0) return null

  const LEVEL_COLOR: Record<string, string> = {
    fair: "border-emerald-300 from-emerald-50 to-green-50 text-emerald-900",
    ok: "border-blue-300 from-blue-50 to-sky-50 text-blue-900",
    unbalanced: "border-amber-300 from-amber-50 to-yellow-50 text-amber-900",
    biased: "border-rose-400 from-rose-50 to-red-50 text-rose-900",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_COLOR[data.fairnessLevel] || ""} p-4 shadow`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2">⚖️ 任務公平度（{data.days} 天）</h3>
        <span className="text-xs opacity-75">
          {data.totalTasks} 任務・每人 {data.expectedPerKid}%
        </span>
      </div>

      <div className="bg-white/70 rounded-lg p-2 mb-3 text-sm font-medium">{data.message}</div>

      <div className="space-y-1">
        {data.kids
          .filter((k) => k.tasks > 0)
          .map((k) => (
            <div key={k.kidId} className="bg-white rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{k.avatar}</span>
                <span className="text-sm font-bold flex-1">{k.kidName}</span>
                <span className="text-xs font-bold">
                  {k.tasks} 任務（{k.taskPercentage}%）
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                  style={{ width: `${k.taskPercentage}%` }}
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function SiblingComparisonCard() {
  const { data } = useQuery<{
    kidCount: number
    message?: string
    familyAvg?: { tasks: number; reward: number; spent: number; given: number }
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      tasks: number
      reward: number
      spent: number
      given: number
      ratios: { tasks: number; reward: number; spent: number; given: number }
      highlights: string[]
    }>
  }>({
    queryKey: ["/api/family/sibling-comparison"],
    queryFn: async () => {
      const res = await fetch("/api/family/sibling-comparison", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.kidCount < 2 || data.kids.length === 0) return null

  function ratioColor(r: number) {
    if (r >= 1.5) return "text-emerald-700 bg-emerald-50"
    if (r >= 1.0) return "text-blue-700 bg-blue-50"
    if (r >= 0.5) return "text-amber-700 bg-amber-50"
    return "text-rose-700 bg-rose-50"
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 shadow">
      <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">⚖️ 兄弟姊妹比較</h3>

      {/* 家庭平均 */}
      {data.familyAvg && (
        <div className="bg-white rounded-lg p-2 mb-3 text-center text-xs text-gray-600">
          家庭平均：{data.familyAvg.tasks} 任務・$ {data.familyAvg.reward} 獎勵
        </div>
      )}

      {/* 每個小孩 */}
      <div className="space-y-2">
        {data.kids.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-2xl">{k.avatar}</span>
              <span className="font-bold text-sm flex-1">{k.kidName}</span>
              <span className="text-xs text-gray-500">
                {k.tasks} 任務・$ {k.reward}
              </span>
            </div>

            {/* 4 個 ratio */}
            <div className="grid grid-cols-4 gap-1 mb-1">
              {[
                { key: "tasks", label: "任務", r: k.ratios.tasks },
                { key: "reward", label: "獎勵", r: k.ratios.reward },
                { key: "spent", label: "花用", r: k.ratios.spent },
                { key: "given", label: "捐贈", r: k.ratios.given },
              ].map((m) => (
                <div key={m.key} className={`text-center rounded p-1 text-xs ${ratioColor(m.r)}`}>
                  <div className="font-bold">{m.r.toFixed(1)}×</div>
                  <div className="opacity-70">{m.label}</div>
                </div>
              ))}
            </div>

            {/* highlights */}
            {k.highlights.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {k.highlights.map((h) => (
                  <span
                    key={h}
                    className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold"
                  >
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyMilestonesCard() {
  const { data } = useQuery<{
    totals: { tasks: number; reward: number; given: number; saved: number; checkins: number }
    milestones: Array<{
      key: string
      name: string
      unit: string
      total: number
      reached: Array<{ value: number; emoji: string; label: string }>
      next: {
        value: number
        emoji: string
        label: string
        remaining: number
        progress: number
      } | null
      complete: boolean
    }>
    summary: { totalReached: number; totalPossible: number }
  }>({
    queryKey: ["/api/family/milestones"],
    queryFn: async () => {
      const res = await fetch("/api/family/milestones", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.summary.totalReached === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-amber-900 flex items-center gap-2">🏛️ 家庭里程碑</h3>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
          {data.summary.totalReached} / {data.summary.totalPossible}
        </span>
      </div>

      <div className="space-y-2">
        {data.milestones.map((m) => (
          <div
            key={m.key}
            className={`rounded-lg p-2 ${
              m.complete ? "bg-emerald-50 border border-emerald-300" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-1 text-sm">
              <span className="font-medium">{m.name}</span>
              <span className="text-xs text-gray-500">
                {m.total} {m.unit}
              </span>
            </div>

            {/* 已達成徽章 */}
            <div className="flex gap-1 mb-1">
              {m.reached.map((r) => (
                <span
                  key={r.value}
                  className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"
                  title={r.label}
                >
                  {r.emoji} {r.label}
                </span>
              ))}
              {m.complete && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                  🎊 全達成
                </span>
              )}
            </div>

            {/* 下一個目標 */}
            {m.next && (
              <>
                <div className="text-xs text-gray-600 mb-0.5">
                  下個：{m.next.emoji} {m.next.label}（還差 {m.next.remaining} {m.unit}）
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                    style={{ width: `${m.next.progress}%` }}
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyWealthTrend() {
  const { data } = useQuery<{
    months: number
    summary: { totalReward: number; totalSpent: number; totalGiven: number; totalNet: number }
    trend: Array<{
      month: string
      reward: number
      spent: number
      given: number
      net: number
    }>
  }>({
    queryKey: ["/api/family/wealth-trend"],
    queryFn: async () => {
      const res = await fetch("/api/family/wealth-trend?months=6", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.summary.totalReward === 0) return null

  // 取最大值給 bar 縮放
  const peak = Math.max(...data.trend.map((t) => Math.max(t.reward, t.spent, t.given)))

  return (
    <div className="mb-4 rounded-2xl border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50 p-4 shadow">
      <h3 className="font-bold text-teal-900 mb-3 flex items-center gap-2">
        📈 6 個月家庭財富趨勢
      </h3>

      {/* 4 格 summary */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        <div className="bg-white rounded p-2 text-center">
          <div className="text-xs text-gray-500">總獎勵</div>
          <div className="text-sm font-bold text-emerald-700">${data.summary.totalReward}</div>
        </div>
        <div className="bg-white rounded p-2 text-center">
          <div className="text-xs text-gray-500">總花費</div>
          <div className="text-sm font-bold text-rose-700">${data.summary.totalSpent}</div>
        </div>
        <div className="bg-white rounded p-2 text-center">
          <div className="text-xs text-gray-500">總捐贈</div>
          <div className="text-sm font-bold text-pink-700">${data.summary.totalGiven}</div>
        </div>
        <div className="bg-white rounded p-2 text-center">
          <div className="text-xs text-gray-500">淨累積</div>
          <div className="text-sm font-bold text-teal-700">${data.summary.totalNet}</div>
        </div>
      </div>

      {/* 6 個月直條圖 */}
      <div className="flex gap-1 items-end h-24">
        {data.trend.map((t) => {
          const monthLabel = t.month.slice(5)
          return (
            <div key={t.month} className="flex-1 flex flex-col items-center">
              <div className="flex-1 w-full flex gap-0.5 items-end">
                {/* reward (emerald) */}
                <div
                  className="flex-1 bg-emerald-400 rounded-t"
                  style={{ height: peak > 0 ? `${(t.reward / peak) * 100}%` : "0%" }}
                  title={`獎勵 $${t.reward}`}
                />
                {/* spent (rose) */}
                <div
                  className="flex-1 bg-rose-400 rounded-t"
                  style={{ height: peak > 0 ? `${(t.spent / peak) * 100}%` : "0%" }}
                  title={`花費 $${t.spent}`}
                />
                {/* given (pink) */}
                <div
                  className="flex-1 bg-pink-400 rounded-t"
                  style={{ height: peak > 0 ? `${(t.given / peak) * 100}%` : "0%" }}
                  title={`捐贈 $${t.given}`}
                />
              </div>
              <div className="text-xs text-gray-600 mt-1">{monthLabel}</div>
            </div>
          )
        })}
      </div>

      {/* 圖例 */}
      <div className="flex justify-center gap-3 mt-2 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-emerald-400 rounded inline-block" />
          獎勵
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-rose-400 rounded inline-block" />
          花費
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-pink-400 rounded inline-block" />
          捐贈
        </span>
      </div>
    </div>
  )
}

function GoalAchieversCard() {
  const { data } = useQuery<{
    totalGoals: number
    champion: {
      kidName: string
      avatar: string
      goalsCompleted: number
      totalTarget: number
    } | null
    achievers: Array<{
      kidId: number
      kidName: string
      avatar: string
      goalsCompleted: number
      totalTarget: number
      avgDays: number
    }>
  }>({
    queryKey: ["/api/family/goal-achievers"],
    queryFn: async () => {
      const res = await fetch("/api/family/goal-achievers", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.totalGoals === 0) return null

  const medals = ["🥇", "🥈", "🥉", "🏅", "🏅"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-amber-900 flex items-center gap-2">🎖️ 目標達成排行</h3>
        <span className="text-xs text-gray-500">共 {data.totalGoals} 個達成</span>
      </div>

      {data.champion && (
        <div className="bg-white rounded-lg p-3 mb-3 text-center">
          <div className="text-4xl mb-1">{data.champion.avatar}</div>
          <div className="text-sm font-bold text-amber-900">存錢王：{data.champion.kidName}</div>
          <div className="text-xs text-gray-600">
            達成 {data.champion.goalsCompleted} 個・累積 ${data.champion.totalTarget}
          </div>
        </div>
      )}

      <div className="space-y-1">
        {data.achievers
          .filter((a) => a.goalsCompleted > 0)
          .map((a, i) => (
            <div key={a.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
              <span className="text-xl shrink-0">{medals[i] ?? "🏅"}</span>
              <span className="text-lg shrink-0">{a.avatar}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{a.kidName}</div>
                <div className="text-xs text-gray-500">
                  {a.goalsCompleted} 個目標・${a.totalTarget}・平均 {a.avgDays} 天
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function CompletedGoalsHistory() {
  const { data } = useQuery<{
    total: number
    totalTarget: number
    avgDaysTaken: number
    fastestGoal: {
      name: string
      emoji: string
      daysTaken: number
      kidName: string
      avatar: string
    } | null
    largestGoal: {
      name: string
      emoji: string
      targetAmount: number
      kidName: string
      avatar: string
    } | null
    goals: Array<{
      id: number
      name: string
      emoji: string
      targetAmount: number
      kidName: string
      avatar: string
      daysTaken: number
      reflection: string | null
      completedAt: string | null
    }>
  }>({
    queryKey: ["/api/family/completed-goals-history"],
    queryFn: async () => {
      const res = await fetch("/api/family/completed-goals-history?limit=20", {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-green-900 flex items-center gap-2">
          🎊 達成的目標（{data.total}）
        </h3>
        <span className="text-xs text-gray-500">累積 ${data.totalTarget}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {data.fastestGoal && (
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">最快達成</div>
            <div className="text-2xl">{data.fastestGoal.emoji}</div>
            <div className="text-xs font-bold truncate">{data.fastestGoal.name}</div>
            <div className="text-xs text-emerald-700 font-bold">
              {data.fastestGoal.daysTaken} 天
            </div>
          </div>
        )}
        {data.largestGoal && (
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">最大金額</div>
            <div className="text-2xl">{data.largestGoal.emoji}</div>
            <div className="text-xs font-bold truncate">{data.largestGoal.name}</div>
            <div className="text-xs text-emerald-700 font-bold">
              ${data.largestGoal.targetAmount}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {data.goals.map((g) => (
          <div key={g.id} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <span className="text-2xl shrink-0">{g.avatar}</span>
            <span className="text-xl shrink-0">{g.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{g.name}</div>
              <div className="text-xs text-gray-500">
                {g.kidName}・${g.targetAmount}・{g.daysTaken} 天達成
              </div>
              {g.reflection && (
                <div className="text-[11px] text-emerald-700 italic mt-0.5">💭 {g.reflection}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-green-700 mt-2 text-center">
        平均達成時間：{data.avgDaysTaken} 天
      </div>
    </div>
  )
}

function FamilyPeakWeekCard() {
  const { data } = useQuery<{
    weeks: number
    totalActivity: number
    avgPerWeek: number
    bestWeek: {
      weekStart: string
      tasks: number
      spendings: number
      checkins: number
      total: number
    } | null
    bestWeekKids: Array<{ kidId: number; kidName: string; avatar: string; tasks: number }>
  }>({
    queryKey: ["/api/family/peak-week"],
    queryFn: async () => {
      const res = await fetch("/api/family/peak-week?weeks=12", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || !data.bestWeek) return null

  const weekStart = new Date(data.bestWeek.weekStart)
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

  return (
    <div className="mb-4 rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-orange-50 p-4 shadow">
      <h3 className="font-bold text-rose-900 mb-3 flex items-center gap-2">🔥 家庭最忙週回顧</h3>

      <div className="bg-white rounded-lg p-3 mb-3 text-center">
        <div className="text-sm text-gray-500 mb-1">
          {fmt(weekStart)} ~ {fmt(weekEnd)}
        </div>
        <div className="text-3xl font-bold text-rose-700">{data.bestWeek.total}</div>
        <div className="text-xs text-gray-600 mt-1">
          {data.bestWeek.tasks} 任務・{data.bestWeek.spendings} 花費・{data.bestWeek.checkins} 打卡
        </div>
      </div>

      {data.bestWeekKids.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">那週各 kid 任務數：</div>
          <div className="flex gap-1 flex-wrap">
            {data.bestWeekKids.map((k) => (
              <span
                key={k.kidId}
                className="text-xs bg-rose-100 text-rose-800 px-2 py-1 rounded-full"
              >
                {k.avatar} {k.kidName} ×{k.tasks}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 mt-2 text-center">
        近 {data.weeks} 週、平均每週 {data.avgPerWeek} 活動
      </div>
    </div>
  )
}

function FamilyMultiRankCard() {
  const { data } = useQuery<{
    days: number
    ranks: Array<{
      metric: string
      name: string
      emoji: string
      top: Array<{ kidId: number; kidName: string; avatar: string; value: number }>
    }>
  }>({
    queryKey: ["/api/family/multi-rank"],
    queryFn: async () => {
      const res = await fetch("/api/family/multi-rank?days=30", { credentials: "include" })
      return res.json()
    },
  })
  if (!data) return null

  const hasAny = data.ranks.some((r) => r.top.length > 0)
  if (!hasAny) return null

  const medals = ["🥇", "🥈", "🥉"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow">
      <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
        🏆 多維排行（近 {data.days} 天）
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {data.ranks
          .filter((r) => r.top.length > 0)
          .map((r) => (
            <div key={r.metric} className="bg-white rounded-lg p-2">
              <div className="text-sm font-bold text-amber-800 mb-1.5">
                {r.emoji} {r.name}
              </div>
              <div className="space-y-1">
                {r.top.map((k, i) => (
                  <div key={k.kidId} className="flex items-center gap-1.5 text-xs">
                    <span>{medals[i] || "🏅"}</span>
                    <span>{k.avatar}</span>
                    <span className="flex-1 truncate font-medium">{k.kidName}</span>
                    <span className="font-bold text-amber-700">{k.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function FamilyCalendarHeatmap() {
  const { data } = useQuery<{
    month: string
    peak: number
    activeDays: number
    totalActivity: number
    days: Array<{
      date: string
      tasks: number
      spendings: number
      checkins: number
      total: number
    }>
  }>({
    queryKey: ["/api/family/calendar-month"],
    queryFn: async () => {
      const res = await fetch("/api/family/calendar-month", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.activeDays === 0) return null

  const peak = data.peak
  function intensity(total: number) {
    if (total === 0) return "bg-gray-100 text-gray-400"
    if (peak <= 1) return "bg-emerald-200 text-emerald-900"
    if (total <= Math.ceil(peak * 0.33)) return "bg-emerald-200 text-emerald-900"
    if (total <= Math.ceil(peak * 0.66)) return "bg-emerald-400 text-white"
    return "bg-emerald-700 text-white"
  }

  // 第一天是星期幾（補空格）
  const firstDay = new Date(data.days[0].date)
  const firstDow = firstDay.getDay() // 0=週日

  return (
    <div className="mb-4 rounded-2xl border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-teal-900 flex items-center gap-2">
          📅 {data.month} 日曆熱度
        </h3>
        <span className="text-xs text-gray-500">
          {data.activeDays} 活躍日・{data.totalActivity} 活動
        </span>
      </div>

      {/* 星期 header */}
      <div className="grid grid-cols-7 gap-1 mb-1 text-xs text-center text-gray-500">
        <div>日</div>
        <div>一</div>
        <div>二</div>
        <div>三</div>
        <div>四</div>
        <div>五</div>
        <div>六</div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {/* 空格補齊 */}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {data.days.map((d) => {
          const day = parseInt(d.date.slice(8, 10), 10)
          return (
            <div
              key={d.date}
              className={`aspect-square rounded p-1 text-center text-xs flex flex-col items-center justify-center ${intensity(d.total)}`}
              title={`${d.date}：${d.tasks} 任務・${d.spendings} 花費・${d.checkins} 打卡`}
            >
              <div className="font-bold">{day}</div>
              {d.total > 0 && <div className="text-[10px] opacity-80">{d.total}</div>}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-1 mt-2 text-xs text-gray-500">
        <span>少</span>
        <div className="w-3 h-3 rounded bg-gray-100" />
        <div className="w-3 h-3 rounded bg-emerald-200" />
        <div className="w-3 h-3 rounded bg-emerald-400" />
        <div className="w-3 h-3 rounded bg-emerald-700" />
        <span>多</span>
      </div>
    </div>
  )
}

function FamilyEmojiCloudCard() {
  const { data } = useQuery<{
    total: number
    uniqueEmojis: number
    mostUsed: { emoji: string; count: number; uniqueKids: number } | null
    emojis: Array<{
      emoji: string
      count: number
      uniqueKids: number
      sizeRem: number
      percentage: number
    }>
  }>({
    queryKey: ["/api/family/emoji-cloud"],
    queryFn: async () => {
      const res = await fetch("/api/family/emoji-cloud?limit=20", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-pink-900 flex items-center gap-2">🎨 全家任務 emoji 雲</h3>
        <span className="text-xs text-gray-500">
          {data.uniqueEmojis} 種・{data.total} 任務
        </span>
      </div>

      {data.mostUsed && (
        <div className="bg-white rounded-lg p-3 mb-3 text-center">
          <div className="text-5xl mb-1">{data.mostUsed.emoji}</div>
          <div className="text-xs text-gray-500">
            最常做（{data.mostUsed.count} 次・{data.mostUsed.uniqueKids} 個小孩）
          </div>
        </div>
      )}

      <div className="bg-white/70 rounded-lg p-3 flex flex-wrap gap-2 items-center justify-center">
        {data.emojis.map((e) => (
          <span
            key={e.emoji}
            className="leading-none"
            style={{ fontSize: `${e.sizeRem}rem` }}
            title={`${e.emoji} ${e.count} 次（${e.percentage}%、${e.uniqueKids} 個小孩）`}
          >
            {e.emoji}
          </span>
        ))}
      </div>
    </div>
  )
}

function PopularTasksCard() {
  const { data } = useQuery<{
    total: number
    tasks: Array<{
      title: string
      emoji: string
      times: number
      totalReward: number
      uniqueKids: number
      lastAt: string | null
    }>
  }>({
    queryKey: ["/api/family/popular-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/family/popular-tasks?limit=5", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  const medals = ["🥇", "🥈", "🥉", "🏅", "🏅"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow">
      <h3 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
        🏆 全家熱門任務 TOP {data.total}
      </h3>
      <div className="space-y-2">
        {data.tasks.map((t, i) => (
          <div key={t.title} className="bg-white rounded-lg p-2 flex items-center gap-2 shadow-sm">
            <span className="text-2xl shrink-0">{medals[i]}</span>
            <span className="text-xl shrink-0">{t.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{t.title}</div>
              <div className="text-xs text-gray-500">
                做了 <b className="text-orange-700">{t.times}</b> 次・累積 ${t.totalReward}・
                {t.uniqueKids} 個小孩
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyGoalsBoard() {
  const { data } = useQuery<{
    total: number
    nearComplete: number
    completedReady: number
    goals: Array<{
      id: number
      kidId: number
      kidName: string
      kidAvatar: string
      name: string
      emoji: string
      currentAmount: number
      targetAmount: number
      remaining: number
      progress: number
      deadline: string | null
    }>
  }>({
    queryKey: ["/api/family/all-goals-summary"],
    queryFn: async () => {
      const res = await fetch("/api/family/all-goals-summary", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-purple-900 flex items-center gap-2">
          🎯 家庭目標進度（{data.total}）
        </h3>
        <div className="flex gap-1 text-xs">
          {data.completedReady > 0 && (
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
              ✅ {data.completedReady} 達成
            </span>
          )}
          {data.nearComplete > 0 && (
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
              🔥 {data.nearComplete} 接近
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {data.goals.map((g) => {
          const isReady = g.progress >= 100
          const isNear = g.progress >= 80 && !isReady
          return (
            <div
              key={g.id}
              className={`rounded-lg p-2 bg-white shadow-sm border-l-4 ${
                isReady ? "border-green-500" : isNear ? "border-amber-500" : "border-purple-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{g.kidAvatar}</span>
                <span className="text-xl">{g.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{g.name}</div>
                  <div className="text-xs text-gray-500">
                    {g.kidName}・${g.currentAmount} / ${g.targetAmount}
                  </div>
                </div>
                <span
                  className={`text-sm font-bold ${
                    isReady ? "text-green-700" : isNear ? "text-amber-700" : "text-purple-700"
                  }`}
                >
                  {g.progress}%
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={
                    isReady
                      ? "h-full bg-gradient-to-r from-green-400 to-emerald-500"
                      : isNear
                        ? "h-full bg-gradient-to-r from-amber-400 to-orange-500"
                        : "h-full bg-gradient-to-r from-purple-400 to-pink-400"
                  }
                  style={{ width: `${g.progress}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyMonthlyStats() {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const { data } = useQuery<{
    month: string
    family: {
      tasksApproved: number
      totalReward: number
      totalSpent: number
      totalSaveUsed: number
      totalGiven: number
      checkinDays: number
    }
    perKid: Array<{
      kidId: number
      kidName: string
      avatar: string
      tasksApproved: number
      totalReward: number
      totalSpent: number
      totalSaveUsed: number
      totalGiven: number
      checkinDays: number
    }>
  }>({
    queryKey: ["/api/family/monthly-stats", currentMonth],
    queryFn: async () => {
      const res = await fetch(`/api/family/monthly-stats?month=${currentMonth}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.perKid.length === 0) return null

  const monthLabel = `${data.month.slice(0, 4)}/${data.month.slice(5)}`

  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 shadow">
      <h3 className="font-bold text-indigo-900 mb-3 flex items-center justify-between">
        <span>📊 全家本月（{monthLabel}）</span>
      </h3>

      {/* 全家 KPI 4 格 */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-xl font-bold text-indigo-700">{data.family.tasksApproved}</div>
          <div className="text-xs text-gray-500">完成任務</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-xl font-bold text-emerald-700">${data.family.totalReward}</div>
          <div className="text-xs text-gray-500">獎勵總額</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-xl font-bold text-rose-700">${data.family.totalSpent}</div>
          <div className="text-xs text-gray-500">花費</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-xl font-bold text-pink-700">${data.family.totalGiven}</div>
          <div className="text-xs text-gray-500">捐贈</div>
        </div>
      </div>

      {/* 每個小孩細項 */}
      <div className="space-y-1">
        {data.perKid.map((k) => (
          <div key={k.kidId} className="bg-white/70 rounded-lg p-2 flex items-center gap-2">
            <span className="text-2xl">{k.avatar}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">{k.kidName}</div>
              <div className="text-xs text-gray-600">
                {k.tasksApproved} 任務・領 ${k.totalReward}・花 ${k.totalSpent}・捐 ${k.totalGiven}
              </div>
            </div>
            {k.checkinDays > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {k.checkinDays} 天打卡
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyActivityFeed() {
  const [expanded, setExpanded] = useState(false)
  const { data } = useQuery<{
    activities: Array<{
      kind: "task" | "spending" | "checkin" | "wish"
      id: number
      kidId: number
      kidName: string
      kidAvatar: string
      label: string
      amount: string
      emoji: string | null
      at: string
    }>
  }>({
    queryKey: ["/api/family/activity"],
    queryFn: async () => {
      const res = await fetch("/api/family/activity?limit=30", { credentials: "include" })
      return res.json()
    },
  })

  const acts = data?.activities ?? []
  if (acts.length === 0) return null

  const visible = expanded ? acts : acts.slice(0, 6)

  const KIND_META: Record<string, { name: string; bg: string; fallback: string }> = {
    task: { name: "完成任務", bg: "bg-green-50 border-green-200", fallback: "📋" },
    spending: { name: "花錢", bg: "bg-rose-50 border-rose-200", fallback: "💸" },
    checkin: { name: "打卡", bg: "bg-amber-50 border-amber-200", fallback: "😊" },
    wish: { name: "願望", bg: "bg-violet-50 border-violet-200", fallback: "✨" },
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return "剛剛"
    if (min < 60) return `${min} 分鐘前`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr} 小時前`
    const day = Math.floor(hr / 24)
    if (day < 30) return `${day} 天前`
    return new Date(iso).toLocaleDateString("zh-TW")
  }

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="font-bold text-gray-700">🌟 全家最近動態</h3>
        <span className="text-xs text-gray-400">{acts.length} 筆</span>
      </div>
      <div className="space-y-1">
        {visible.map((a) => {
          const meta = KIND_META[a.kind]
          return (
            <div
              key={`${a.kind}-${a.id}`}
              className={`flex items-center gap-2 p-2 rounded border ${meta.bg}`}
            >
              <span className="text-xl shrink-0">{a.kidAvatar}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-bold">{a.kidName}</span>{" "}
                  <span className="text-gray-600 text-xs">{meta.name}</span>{" "}
                  <span className="font-medium">{a.label}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {a.emoji || meta.fallback} {a.amount}
                </div>
              </div>
              <span className="text-xs text-gray-400 shrink-0">{timeAgo(a.at)}</span>
            </div>
          )
        })}
      </div>
      {acts.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full text-center text-sm text-blue-600 hover:text-blue-800"
        >
          {expanded ? "收起" : `看更多 (${acts.length - 6} 筆)`}
        </button>
      )}
    </div>
  )
}

function KidsAttentionRadar() {
  const { data } = useQuery<{
    totalKids: number
    attentionCount: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      daysSinceTask: number | null
      daysSinceCheckin: number | null
      daysQuiet: number | null
      needsAttention: boolean
      message: string | null
    }>
  }>({
    queryKey: ["/api/family/kids-attention"],
    queryFn: async () => {
      const res = await fetch("/api/family/kids-attention", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.attentionCount === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow">
      <h3 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
        🧡 需要關心（{data.attentionCount}）
      </h3>
      <div className="space-y-2">
        {data.kids
          .filter((k) => k.needsAttention)
          .map((k) => (
            <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
              <span className="text-2xl shrink-0">{k.avatar}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{k.kidName}</div>
                {k.message && <div className="text-xs text-gray-600">{k.message}</div>}
                <div className="text-[10px] text-gray-400">
                  最近任務 {k.daysSinceTask === null ? "從未" : `${k.daysSinceTask} 天前`}
                  ・打卡 {k.daysSinceCheckin === null ? "從未" : `${k.daysSinceCheckin} 天前`}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function ParentTodoList() {
  const [collapsed, setCollapsed] = useState(true)
  const { data } = useQuery<{
    total: number
    urgentCount: number
    todos: Array<{
      type: string
      priority: "urgent" | "high" | "medium" | "low"
      icon: string
      action: string
      detail?: string
      relatedId?: number
      kidName?: string
      avatar?: string
    }>
  }>({
    queryKey: ["/api/family/parent-todo"],
    queryFn: async () => {
      const res = await fetch("/api/family/parent-todo", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  const PRIORITY_COLOR: Record<string, string> = {
    urgent: "bg-rose-100 border-rose-300 text-rose-900",
    high: "bg-amber-100 border-amber-300 text-amber-900",
    medium: "bg-blue-100 border-blue-300 text-blue-900",
    low: "bg-gray-100 border-gray-300 text-gray-700",
  }

  const visible = collapsed ? data.todos.slice(0, 3) : data.todos

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-amber-900 flex items-center gap-2">
          📋 待辦清單（{data.total}）
        </h3>
        {data.urgentCount > 0 && (
          <span className="text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold">
            🔴 {data.urgentCount} 急
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {visible.map((t, i) => (
          <div key={i} className={`rounded-lg p-2 border ${PRIORITY_COLOR[t.priority]}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl shrink-0">{t.icon}</span>
              {t.avatar && <span className="text-lg shrink-0">{t.avatar}</span>}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t.action}</div>
                {t.detail && <div className="text-xs opacity-75">{t.detail}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.todos.length > 3 && (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="mt-2 w-full text-center text-sm text-amber-700 hover:text-amber-900"
        >
          {collapsed ? `看全部 (${data.todos.length - 3} 筆)` : "收起"}
        </button>
      )}
    </div>
  )
}

function FamilyStreakRankingCard() {
  const { data } = useQuery<{
    totalKids: number
    activeStreakers: number
    maxStreak: number
    champion: { kidName: string; avatar: string; streak: number } | null
    ranking: Array<{ kidId: number; kidName: string; avatar: string; streak: number }>
    message: string
  }>({
    queryKey: ["/api/family/streak-ranking"],
  })
  if (!data || data.totalKids === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-yellow-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🔥 連續打卡排行</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1">
        {data.ranking.map((k, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`
          const isChampion = i === 0 && k.streak > 0
          return (
            <div
              key={k.kidId}
              className={`rounded-lg p-2 flex items-center gap-2 text-xs ${
                isChampion ? "bg-yellow-100 border-2 border-yellow-400" : "bg-white"
              }`}
            >
              <div className="w-6 text-center text-sm">{medal}</div>
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 font-medium">{k.kidName}</div>
              <div className="text-xl font-bold text-orange-600">
                {k.streak > 0 ? `🔥 ${k.streak}` : "—"}
              </div>
              <div className="text-[10px] text-gray-500 w-8">天</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyApprovalLeadTimeCard() {
  const { data } = useQuery<{
    days: number
    taskCount: number
    avgHours: number
    medianHours: number
    minHours: number
    maxHours: number
    buckets: Array<{ key: string; label: string; count: number; percentage: number }>
    speedLevel: "no_data" | "instant" | "fast" | "slow" | "very_slow"
    message: string
  }>({
    queryKey: ["/api/family/approval-lead-time?days=30"],
  })
  if (!data || data.taskCount === 0) return null

  const LEVEL_BORDER: Record<string, string> = {
    instant: "border-emerald-400",
    fast: "border-blue-300",
    slow: "border-orange-300",
    very_slow: "border-red-400",
  }
  const LEVEL_BG: Record<string, string> = {
    instant: "from-emerald-50 to-green-50",
    fast: "from-blue-50 to-sky-50",
    slow: "from-orange-50 to-amber-50",
    very_slow: "from-red-50 to-rose-50",
  }
  const BUCKET_COLOR: Record<string, string> = {
    instant: "bg-emerald-400",
    fast: "bg-blue-400",
    day: "bg-yellow-400",
    slow: "bg-orange-400",
    stale: "bg-red-400",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${LEVEL_BORDER[data.speedLevel] ?? "border-gray-300"} bg-gradient-to-br ${LEVEL_BG[data.speedLevel] ?? "from-gray-50 to-slate-50"} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">⏱️ 家長批准回應速度</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="font-bold text-emerald-700">{data.avgHours}h</div>
          <div className="text-[10px] text-gray-500">平均</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="font-bold text-blue-700">{data.medianHours}h</div>
          <div className="text-[10px] text-gray-500">中位數</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="font-bold text-rose-700">{Math.round(data.maxHours)}h</div>
          <div className="text-[10px] text-gray-500">最久</div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-2 space-y-1">
        {data.buckets.map((b) => (
          <div key={b.key} className="flex items-center gap-2 text-xs">
            <div className="w-20 text-[10px]">{b.label}</div>
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`${BUCKET_COLOR[b.key] ?? "bg-gray-400"} h-2 transition-all`}
                style={{ width: `${b.percentage}%` }}
              />
            </div>
            <div className="w-12 text-right text-[10px] font-bold">
              {b.count}({b.percentage}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyMonthlyTaskCreationTrendCard() {
  const { data } = useQuery<{
    months: number
    data: Array<{ month: string; taskCount: number; totalReward: number }>
    totalTasks: number
    totalReward: number
    activeMonths: number
    peakMonth: { month: string; taskCount: number } | null
    trend: "growing" | "stable" | "shrinking" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/monthly-task-creation-trend?months=6"],
  })
  if (!data || data.totalTasks === 0) return null

  const maxCount = Math.max(...data.data.map((m) => m.taskCount), 1)

  const TREND_BORDER: Record<string, string> = {
    growing: "border-emerald-300",
    stable: "border-blue-300",
    shrinking: "border-orange-300",
  }
  const TREND_BG: Record<string, string> = {
    growing: "from-emerald-50 to-teal-50",
    stable: "from-blue-50 to-sky-50",
    shrinking: "from-orange-50 to-amber-50",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${TREND_BORDER[data.trend] ?? "border-gray-300"} bg-gradient-to-br ${TREND_BG[data.trend] ?? "from-gray-50 to-slate-50"} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">📋 6 個月派任務量</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="flex items-end gap-1 h-20">
          {data.data.map((m) => {
            const heightPct = (m.taskCount / maxCount) * 100
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center justify-end">
                <div className="text-[9px] font-bold text-cyan-700 mb-1">{m.taskCount || ""}</div>
                <div
                  className={`w-full ${
                    m.taskCount > 0 ? "bg-gradient-to-t from-cyan-400 to-cyan-600" : "bg-gray-100"
                  } rounded-t transition-all`}
                  style={{ height: `${Math.max(2, heightPct)}%` }}
                  title={`${m.month}: ${m.taskCount} 個 ($${Math.round(m.totalReward)})`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[8px] text-gray-400 mt-1">
          {data.data.map((m) => (
            <span key={m.month} className="flex-1 text-center">
              {m.month.slice(5)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 text-xs">
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-cyan-700">{data.totalTasks}</div>
          <div className="text-[9px] text-gray-500">總派發</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-amber-600">
            ${Math.round(data.totalReward).toLocaleString()}
          </div>
          <div className="text-[9px] text-gray-500">總獎金</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-rose-600">{data.peakMonth?.taskCount ?? 0}</div>
          <div className="text-[9px] text-gray-500">
            最忙月 {data.peakMonth?.month?.slice(5) ?? "—"}
          </div>
        </div>
      </div>
    </div>
  )
}

function FamilyTodaySpendingFeedCard() {
  const { data } = useQuery<{
    items: Array<{
      spendingId: number
      amount: number
      description: string
      emoji: string
      jar: string
      recipient: string | null
      createdAt: string
      kidName: string
      kidAvatar: string
    }>
    totalCount: number
    totalAmount: number
    uniqueKids: number
    message: string
  }>({
    queryKey: ["/api/family/today-spending-feed?limit=20"],
  })
  if (!data || data.totalCount === 0) return null

  const JAR_COLOR: Record<string, string> = {
    spend: "border-rose-400",
    save: "border-emerald-400",
    give: "border-pink-400",
  }
  const JAR_EMOJI: Record<string, string> = {
    spend: "💸",
    save: "🐷",
    give: "❤️",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-slate-300 bg-gradient-to-br from-slate-50 to-gray-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📋 今日花費即時動態</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {data.items.map((it) => (
          <div
            key={it.spendingId}
            className={`bg-white rounded-lg p-2 flex items-center gap-2 text-xs border-l-4 ${JAR_COLOR[it.jar] ?? "border-gray-300"}`}
          >
            <div className="text-lg">{it.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {it.description}
                {it.recipient && (
                  <span className="text-gray-500 text-[10px]"> → {it.recipient}</span>
                )}
              </div>
              <div className="text-[10px] text-gray-500">
                {it.kidAvatar} {it.kidName} · {JAR_EMOJI[it.jar] ?? "•"} ·{" "}
                {it.createdAt?.slice(11, 16)}
              </div>
            </div>
            <div className="text-sm font-bold text-slate-700">${it.amount}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyAvgRewardByCategoryCard() {
  const { data } = useQuery<{
    days: number
    categories: Array<{
      category: string
      label: string
      emoji: string
      taskCount: number
      avgReward: number
      minReward: number
      maxReward: number
      totalReward: number
    }>
    totalCount: number
    totalReward: number
    overallAvg: number
    topCategory: { label: string; avgReward: number } | null
    lowCategory: { label: string; avgReward: number } | null
    message: string
  }>({
    queryKey: ["/api/family/avg-reward-by-category?days=90"],
  })
  if (!data || data.totalCount === 0) return null

  const maxAvg = Math.max(...data.categories.map((c) => c.avgReward), 1)

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">💰 90 天類別獎金水準</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-2">
        {data.categories.map((c) => (
          <div key={c.category} className="bg-white rounded-lg p-2">
            <div className="flex items-center justify-between mb-1 text-xs">
              <span className="font-medium">
                {c.emoji} {c.label}
              </span>
              <span className="text-gray-500">
                avg ${c.avgReward} · {c.taskCount} 次
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-300 to-amber-500 h-2 transition-all"
                style={{ width: `${(c.avgReward / maxAvg) * 100}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-400 mt-1 flex justify-between">
              <span>min ${c.minReward}</span>
              <span>max ${c.maxReward}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 pt-2 border-t border-amber-200 text-[10px] text-gray-600 text-center">
        整體平均 ${data.overallAvg} · 總計 ${Math.round(data.totalReward).toLocaleString()}（
        {data.totalCount} 筆）
      </div>
    </div>
  )
}

function FamilyBiggestSpendingsCard() {
  const { data } = useQuery<{
    days: number
    spendings: Array<{
      spendingId: number
      amount: number
      description: string
      emoji: string
      jar: string
      recipient: string | null
      spendDate: string
      kidName: string
      kidAvatar: string
    }>
    spendingCount: number
    topSpending: { amount: number; description: string; kidName: string } | null
    grandTotal: number
    message: string
  }>({
    queryKey: ["/api/family/biggest-spendings?days=30&limit=10"],
  })
  if (!data || data.spendingCount === 0) return null

  const JAR_EMOJI: Record<string, string> = {
    spend: "💸",
    save: "🐷",
    give: "❤️",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-pink-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">💸 30 天最大花費排行</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {data.spendings.map((s, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`
          return (
            <div
              key={s.spendingId}
              className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs"
            >
              <div className="w-6 text-center text-sm">{medal}</div>
              <div className="text-lg">{s.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.description}</div>
                <div className="text-[10px] text-gray-500">
                  {s.kidAvatar} {s.kidName} · {JAR_EMOJI[s.jar] ?? "•"} {s.spendDate}
                  {s.recipient && ` · → ${s.recipient}`}
                </div>
              </div>
              <div className="text-base font-bold text-rose-700">${s.amount}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyMonthlySpendingTrendCard() {
  const { data } = useQuery<{
    months: number
    data: Array<{ month: string; spendCount: number; totalSpent: number; uniqueKids: number }>
    totalSpent: number
    totalCount: number
    activeMonths: number
    peakMonth: { month: string; totalSpent: number } | null
    trend: "growing" | "stable" | "shrinking" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/monthly-spending-trend?months=6"],
  })
  if (!data || data.totalCount === 0) return null

  const maxSpent = Math.max(...data.data.map((d) => d.totalSpent), 1)

  const TREND_BORDER: Record<string, string> = {
    growing: "border-rose-300",
    stable: "border-blue-300",
    shrinking: "border-emerald-300",
  }
  const TREND_BG: Record<string, string> = {
    growing: "from-rose-50 to-pink-50",
    stable: "from-blue-50 to-sky-50",
    shrinking: "from-emerald-50 to-teal-50",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${TREND_BORDER[data.trend] ?? "border-gray-300"} bg-gradient-to-br ${TREND_BG[data.trend] ?? "from-gray-50 to-slate-50"} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">💸 6 個月花費走勢</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="flex items-end gap-1 h-20">
          {data.data.map((m) => {
            const heightPct = (m.totalSpent / maxSpent) * 100
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center justify-end">
                <div className="text-[9px] font-bold text-rose-700 mb-1">
                  {m.totalSpent > 0 ? Math.round(m.totalSpent) : ""}
                </div>
                <div
                  className={`w-full ${
                    m.totalSpent > 0 ? "bg-gradient-to-t from-rose-400 to-rose-600" : "bg-gray-100"
                  } rounded-t transition-all`}
                  style={{ height: `${Math.max(2, heightPct)}%` }}
                  title={`${m.month}: $${Math.round(m.totalSpent)} (${m.spendCount} 筆)`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[8px] text-gray-400 mt-1">
          {data.data.map((m) => (
            <span key={m.month} className="flex-1 text-center">
              {m.month.slice(5)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 text-xs">
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-rose-700">
            ${Math.round(data.totalSpent).toLocaleString()}
          </div>
          <div className="text-[9px] text-gray-500">總花費</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-blue-600">{data.totalCount}</div>
          <div className="text-[9px] text-gray-500">總筆數</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-amber-600">
            ${Math.round(data.peakMonth?.totalSpent ?? 0)}
          </div>
          <div className="text-[9px] text-gray-500">
            最大月 {data.peakMonth?.month?.slice(5) ?? "—"}
          </div>
        </div>
      </div>
    </div>
  )
}

function FamilyWishesAgingCard() {
  const { data } = useQuery<{
    totalWishes: number
    buckets: Array<{
      key: string
      label: string
      emoji: string
      wishCount: number
      totalValue: number
    }>
    oldest: { title: string; ageDays: number; kidName: string } | null
    averageAge: number
    ancientCount: number
    message: string
  }>({
    queryKey: ["/api/family/wishes-aging"],
  })
  if (!data || data.totalWishes === 0) return null

  const BUCKET_COLOR: Record<string, string> = {
    fresh: "bg-emerald-100 text-emerald-700",
    thinking: "bg-blue-100 text-blue-700",
    stale: "bg-orange-100 text-orange-700",
    ancient: "bg-red-100 text-red-700",
  }

  const borderColor = data.ancientCount > 0 ? "border-red-300" : "border-purple-300"
  const bgGradient =
    data.ancientCount > 0 ? "from-red-50 to-rose-50" : "from-purple-50 to-fuchsia-50"

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${borderColor} bg-gradient-to-br ${bgGradient} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">📦 願望年齡分布</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-4 gap-1 mb-2">
        {data.buckets.map((b) => (
          <div
            key={b.key}
            className={`rounded-lg p-2 text-center ${BUCKET_COLOR[b.key] ?? "bg-gray-100"}`}
          >
            <div className="text-lg">{b.emoji}</div>
            <div className="text-[9px] truncate">{b.label}</div>
            <div className="font-bold">{b.wishCount}</div>
          </div>
        ))}
      </div>

      {data.oldest && (
        <div className="bg-white rounded-lg p-2 text-xs">
          <div className="text-[10px] text-gray-500">最老願望</div>
          <div className="font-medium">
            「{data.oldest.title}」— {data.oldest.kidName}（{data.oldest.ageDays} 天）
          </div>
        </div>
      )}
    </div>
  )
}

function FamilyKidsNeedingAttentionCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      lastApprove: string | null
      daysSinceLastApprove: number
    }>
    kidCount: number
    maxDaysSince: number
    level: "ok" | "warn" | "alert"
    message: string
  }>({
    queryKey: ["/api/family/kids-needing-attention?days=7"],
  })
  if (!data || data.kidCount === 0) return null

  const borderColor = data.level === "alert" ? "border-red-500" : "border-orange-400"
  const bgGradient =
    data.level === "alert" ? "from-red-50 to-rose-50" : "from-orange-50 to-amber-50"

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${borderColor} bg-gradient-to-br ${bgGradient} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">
        {data.level === "alert" ? "🚨" : "⏰"} 家長關注度提醒
      </h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs font-medium">{data.message}</div>

      <div className="space-y-1">
        {data.kids.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                {k.lastApprove
                  ? `上次 approve：${k.lastApprove.slice(0, 10)}（${k.daysSinceLastApprove} 天前）`
                  : "還沒被 approve 過"}
              </div>
            </div>
            <div className="text-sm font-bold text-red-600">{k.daysSinceLastApprove}d</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyDayOfWeekDistributionCard() {
  const { data } = useQuery<{
    days: number
    totalCount: number
    weekendCount: number
    weekdayCount: number
    weekendPct: number
    weekdayPct: number
    byDay: Array<{ dow: number; label: string; taskCount: number; isWeekend: boolean }>
    peakDay: { label: string; taskCount: number } | null
    pattern: "no_data" | "weekend_focused" | "weekday_focused" | "balanced"
    message: string
  }>({
    queryKey: ["/api/family/family-weekend-vs-weekday?days=30"],
  })
  if (!data || data.totalCount === 0) return null

  const maxCount = Math.max(...data.byDay.map((d) => d.taskCount), 1)

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📅 30 天作息分布</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-lg">🏖️</div>
          <div className="font-bold text-orange-700">{data.weekendCount}</div>
          <div className="text-[10px] text-gray-500">週末（{data.weekendPct}%）</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-lg">📚</div>
          <div className="font-bold text-blue-700">{data.weekdayCount}</div>
          <div className="text-[10px] text-gray-500">平日（{data.weekdayPct}%）</div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-2">
        <div className="text-[10px] text-gray-500 mb-1">每日分布</div>
        <div className="flex items-end gap-1 h-16">
          {data.byDay.map((d) => {
            const heightPct = (d.taskCount / maxCount) * 100
            return (
              <div key={d.dow} className="flex-1 flex flex-col items-center justify-end">
                <div className="text-[8px] font-bold text-amber-700 mb-1">{d.taskCount || ""}</div>
                <div
                  className={`w-full ${
                    d.taskCount > 0
                      ? d.isWeekend
                        ? "bg-orange-400"
                        : "bg-blue-400"
                      : "bg-gray-100"
                  } rounded-t transition-all`}
                  style={{ height: `${Math.max(2, heightPct)}%` }}
                  title={`${d.label}: ${d.taskCount} 次`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[8px] text-gray-400 mt-1">
          {data.byDay.map((d) => (
            <span key={d.dow} className="flex-1 text-center">
              {d.label.slice(1)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function FamilyWishPromotionRateCard() {
  const { data } = useQuery<{
    days: number
    total: number
    promoted: number
    stillWished: number
    abandoned: number
    promotionRate: number
    abandonmentRate: number
    decisionRate: number
    maturityLevel: "no_data" | "starting" | "thinking" | "deciding" | "mature"
    message: string
  }>({
    queryKey: ["/api/family/wish-promotion-rate?days=90"],
  })
  if (!data || data.total === 0) return null

  const LEVEL_BORDER: Record<string, string> = {
    starting: "border-blue-300",
    thinking: "border-indigo-300",
    deciding: "border-purple-300",
    mature: "border-emerald-400",
  }
  const LEVEL_BG: Record<string, string> = {
    starting: "from-blue-50 to-sky-50",
    thinking: "from-indigo-50 to-blue-50",
    deciding: "from-purple-50 to-fuchsia-50",
    mature: "from-emerald-50 to-green-50",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${LEVEL_BORDER[data.maturityLevel] ?? "border-gray-300"} bg-gradient-to-br ${LEVEL_BG[data.maturityLevel] ?? "from-gray-50 to-slate-50"} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">💭 90 天願望決策成熟度</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="flex h-3 rounded-full overflow-hidden">
          <div
            className="bg-emerald-400"
            style={{ width: `${data.promotionRate}%` }}
            title={`升級 ${data.promotionRate}%`}
          />
          <div
            className="bg-rose-400"
            style={{ width: `${data.abandonmentRate}%` }}
            title={`放棄 ${data.abandonmentRate}%`}
          />
          <div
            className="bg-gray-300"
            style={{ width: `${100 - data.decisionRate}%` }}
            title={`還在想 ${100 - data.decisionRate}%`}
          />
        </div>
        <div className="flex justify-between text-[9px] mt-1">
          <span className="text-emerald-600">🎯 升級 {data.promotionRate}%</span>
          <span className="text-rose-500">🗑️ 放棄 {data.abandonmentRate}%</span>
          <span className="text-gray-500">💭 {100 - data.decisionRate}%</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 text-xs">
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-gray-700">{data.total}</div>
          <div className="text-[9px] text-gray-500">總願望</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-emerald-700">{data.promoted}</div>
          <div className="text-[9px] text-gray-500">已升級</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-indigo-600">{data.stillWished}</div>
          <div className="text-[9px] text-gray-500">還在想</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-rose-500">{data.abandoned}</div>
          <div className="text-[9px] text-gray-500">放棄</div>
        </div>
      </div>
    </div>
  )
}

function FamilySpendingSummaryCard() {
  const { data } = useQuery<{
    days: number
    jars: Array<{
      jar: string
      label: string
      emoji: string
      color: string
      spendCount: number
      totalAmount: number
      uniqueKids: number
      percentage: number
    }>
    totalAmount: number
    totalCount: number
    topJar: { jar: string; label: string; emoji: string; totalAmount: number } | null
    message: string
  }>({
    queryKey: ["/api/family/spending-summary?days=30"],
  })
  if (!data || data.totalCount === 0) return null

  const COLOR_BAR: Record<string, string> = {
    rose: "bg-rose-400",
    emerald: "bg-emerald-400",
    pink: "bg-pink-400",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-blue-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">💰 30 天花費分布</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-3 mb-2 text-center">
        <div className="text-2xl font-bold text-cyan-700">
          ${Math.round(data.totalAmount).toLocaleString()}
        </div>
        <div className="text-[10px] text-gray-500">總花費（{data.totalCount} 筆）</div>
      </div>

      <div className="space-y-2">
        {data.jars
          .filter((j) => j.spendCount > 0)
          .sort((a, b) => b.totalAmount - a.totalAmount)
          .map((j) => (
            <div key={j.jar} className="bg-white rounded-lg p-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">
                  {j.emoji} {j.label}
                </span>
                <span className="text-gray-500">
                  ${Math.round(j.totalAmount)} · {j.spendCount} 筆
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`${COLOR_BAR[j.color] ?? "bg-gray-400"} h-2 transition-all`}
                  style={{ width: `${j.percentage}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-400 text-right mt-1">{j.percentage}%</div>
            </div>
          ))}
      </div>
    </div>
  )
}

function FamilyCheckinStreakCard() {
  const { data } = useQuery<{
    streak: number
    lastCheckinDate: string | null
    level: "none" | "starting" | "good" | "great" | "legend"
    message: string
  }>({
    queryKey: ["/api/family/family-checkin-streak"],
  })
  if (!data || data.streak === 0) return null

  const LEVEL_BORDER: Record<string, string> = {
    starting: "border-green-300",
    good: "border-orange-300",
    great: "border-red-300",
    legend: "border-purple-400",
  }
  const LEVEL_BG: Record<string, string> = {
    starting: "from-green-50 to-emerald-50",
    good: "from-orange-50 to-amber-50",
    great: "from-red-50 to-rose-50",
    legend: "from-purple-50 to-fuchsia-50",
  }
  const LEVEL_EMOJI: Record<string, string> = {
    starting: "🌱",
    good: "🔥",
    great: "🚀",
    legend: "🏆",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${LEVEL_BORDER[data.level] ?? "border-gray-300"} bg-gradient-to-br ${LEVEL_BG[data.level] ?? "from-gray-50 to-slate-50"} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">
        {LEVEL_EMOJI[data.level] ?? "📅"} 家庭打卡連續天數
      </h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-4 text-center">
        <div className="text-5xl font-bold text-red-600">{data.streak}</div>
        <div className="text-[10px] text-gray-500 mt-1">連續天數</div>
        {data.lastCheckinDate && (
          <div className="text-[10px] text-gray-400 mt-1">最後簽到 {data.lastCheckinDate}</div>
        )}
      </div>
    </div>
  )
}

function FamilyWishPriorityBreakdownCard() {
  const { data } = useQuery<{
    priorities: Array<{
      priority: number
      label: string
      emoji: string
      color: string
      wishCount: number
      totalValue: number
      uniqueKids: number
    }>
    totalWishes: number
    totalValue: number
    highPriorityCount: number
    message: string
  }>({
    queryKey: ["/api/family/wish-priority-breakdown"],
  })
  if (!data || data.totalWishes === 0) return null

  const COLOR_BG: Record<string, string> = {
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-gray-100 text-gray-600",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-fuchsia-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">✨ 願望優先級分佈</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1">
        {data.priorities
          .filter((p) => p.wishCount > 0)
          .map((p) => (
            <div
              key={p.priority}
              className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs"
            >
              <div className={`px-2 py-1 rounded ${COLOR_BG[p.color] ?? "bg-gray-100"}`}>
                {p.emoji} {p.label}
              </div>
              <div className="flex-1">
                <div className="font-medium">{p.wishCount} 個願望</div>
                <div className="text-[10px] text-gray-500">{p.uniqueKids} 位小孩</div>
              </div>
              <div className="text-sm font-bold text-purple-700">${Math.round(p.totalValue)}</div>
            </div>
          ))}
      </div>

      <div className="mt-2 pt-2 border-t border-purple-200 text-[10px] text-gray-600 text-center">
        共 {data.totalWishes} 個願望、總值 ${Math.round(data.totalValue).toLocaleString()}
      </div>
    </div>
  )
}

function FamilyMonthlyGoalsTrendCard() {
  const { data } = useQuery<{
    months: number
    data: Array<{ month: string; goalCount: number; totalSaved: number }>
    totalGoals: number
    totalSaved: number
    activeMonths: number
    bestMonth: { month: string; goalCount: number } | null
    trend: "growing" | "stable" | "declining" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/monthly-goals-trend?months=6"],
  })
  if (!data || data.totalGoals === 0) return null

  const maxCount = Math.max(...data.data.map((m) => m.goalCount), 1)

  const TREND_BORDER: Record<string, string> = {
    growing: "border-emerald-300",
    stable: "border-blue-300",
    declining: "border-orange-300",
  }
  const TREND_BG: Record<string, string> = {
    growing: "from-emerald-50 to-green-50",
    stable: "from-blue-50 to-sky-50",
    declining: "from-orange-50 to-amber-50",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${TREND_BORDER[data.trend] ?? "border-gray-300"} bg-gradient-to-br ${TREND_BG[data.trend] ?? "from-gray-50 to-slate-50"} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🎯 6 個月達標趨勢</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="flex items-end gap-1 h-20">
          {data.data.map((m) => {
            const heightPct = (m.goalCount / maxCount) * 100
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center justify-end">
                <div className="text-[9px] font-bold text-blue-700 mb-1">{m.goalCount || ""}</div>
                <div
                  className={`w-full ${
                    m.goalCount > 0
                      ? "bg-gradient-to-t from-emerald-400 to-emerald-600"
                      : "bg-gray-100"
                  } rounded-t transition-all`}
                  style={{ height: `${Math.max(2, heightPct)}%` }}
                  title={`${m.month}: ${m.goalCount} 個 ($${Math.round(m.totalSaved)})`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[8px] text-gray-400 mt-1">
          {data.data.map((m) => (
            <span key={m.month} className="flex-1 text-center">
              {m.month.slice(5)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 text-xs">
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-emerald-700">{data.totalGoals}</div>
          <div className="text-[9px] text-gray-500">總達成</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-blue-600">
            ${Math.round(data.totalSaved).toLocaleString()}
          </div>
          <div className="text-[9px] text-gray-500">總存到</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-amber-600">{data.bestMonth?.goalCount ?? 0}</div>
          <div className="text-[9px] text-gray-500">
            最佳月 {data.bestMonth?.month?.slice(5) ?? "—"}
          </div>
        </div>
      </div>
    </div>
  )
}

function FamilyRejectionRateCard() {
  const { data } = useQuery<{
    days: number
    approved: number
    rejected: number
    submitted: number
    pending: number
    decidedTotal: number
    approvalRate: number
    rejectionRate: number
    standardLevel: "ok" | "too_strict" | "too_loose" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/family-rejection-rate?days=30"],
  })
  if (!data || data.decidedTotal === 0) return null

  const borderColor =
    data.standardLevel === "too_strict"
      ? "border-red-300"
      : data.standardLevel === "too_loose"
        ? "border-orange-300"
        : "border-green-300"
  const bgGradient =
    data.standardLevel === "too_strict"
      ? "from-red-50 to-rose-50"
      : data.standardLevel === "too_loose"
        ? "from-orange-50 to-amber-50"
        : "from-green-50 to-emerald-50"

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${borderColor} bg-gradient-to-br ${bgGradient} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">⚖️ 30 天家長標準鬆緊</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="flex h-3 rounded-full overflow-hidden">
          <div
            className="bg-emerald-400"
            style={{ width: `${data.approvalRate}%` }}
            title={`批准 ${data.approvalRate}%`}
          />
          <div
            className="bg-red-400"
            style={{ width: `${data.rejectionRate}%` }}
            title={`駁回 ${data.rejectionRate}%`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span className="text-emerald-600">✅ 批准 {data.approvalRate}%</span>
          <span className="text-red-500">❌ 駁回 {data.rejectionRate}%</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 text-xs">
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-emerald-700">{data.approved}</div>
          <div className="text-[9px] text-gray-500">已批准</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-red-600">{data.rejected}</div>
          <div className="text-[9px] text-gray-500">已駁回</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-blue-600">{data.submitted}</div>
          <div className="text-[9px] text-gray-500">待批准</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-gray-500">{data.pending}</div>
          <div className="text-[9px] text-gray-500">未完成</div>
        </div>
      </div>
    </div>
  )
}

function FamilyCommentInteractionCard() {
  const { data } = useQuery<{
    days: number
    totalCount: number
    parent: { count: number; percentage: number; uniqueTasks: number }
    kid: { count: number; percentage: number; uniqueTasks: number }
    interaction: "balanced" | "parent_heavy" | "kid_heavy" | "low" | "none"
    message: string
  }>({
    queryKey: ["/api/family/comment-interaction?days=30"],
  })
  if (!data || data.totalCount === 0) return null

  const BG_COLORS: Record<string, string> = {
    balanced: "from-green-50 to-teal-50 border-green-300",
    parent_heavy: "from-blue-50 to-indigo-50 border-blue-300",
    kid_heavy: "from-purple-50 to-pink-50 border-purple-300",
    low: "from-amber-50 to-yellow-50 border-amber-300",
  }
  const cls = BG_COLORS[data.interaction] ?? "from-gray-50 to-slate-50 border-gray-300"

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${cls.split(" ").slice(-1)[0]} bg-gradient-to-br ${cls.split(" ").slice(0, 2).join(" ")} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">💬 30 天評論互動</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="flex items-center gap-2 text-xs mb-1">
          <div className="flex-1">
            <span className="text-blue-600">👨‍👩‍👧 家長 {data.parent.count}</span>
          </div>
          <div className="flex-1 text-right">
            <span className="text-purple-600">🧒 小孩 {data.kid.count}</span>
          </div>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden">
          <div
            className="bg-blue-400"
            style={{ width: `${data.parent.percentage}%` }}
            title={`家長 ${data.parent.percentage}%`}
          />
          <div
            className="bg-purple-400"
            style={{ width: `${data.kid.percentage}%` }}
            title={`小孩 ${data.kid.percentage}%`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>{data.parent.percentage}%</span>
          <span>{data.kid.percentage}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white rounded p-2 text-center">
          <div className="font-bold text-blue-700">{data.parent.uniqueTasks}</div>
          <div className="text-[10px] text-gray-500">家長留言 task 數</div>
        </div>
        <div className="bg-white rounded p-2 text-center">
          <div className="font-bold text-purple-700">{data.kid.uniqueTasks}</div>
          <div className="text-[10px] text-gray-500">小孩留言 task 數</div>
        </div>
      </div>
    </div>
  )
}

function FamilySavingsSummaryCard() {
  const { data } = useQuery<{
    goalCount: number
    uniqueKids: number
    totalTarget: number
    totalCurrent: number
    amountToGo: number
    overallProgress: number
    nearComplete: number
    starting: number
    message: string
  }>({
    queryKey: ["/api/family/savings-summary"],
  })
  if (!data || data.goalCount === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🐷 家庭儲蓄總進度</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-3 mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">已存 / 目標</span>
          <span className="font-bold text-emerald-700">{data.overallProgress}%</span>
        </div>
        <div className="w-full bg-emerald-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-400 to-green-500 h-3 transition-all"
            style={{ width: `${data.overallProgress}%` }}
          />
        </div>
        <div className="text-[10px] text-gray-500 mt-1">
          ${Math.round(data.totalCurrent).toLocaleString()} / $
          {Math.round(data.totalTarget).toLocaleString()} · 還差 $
          {Math.round(data.amountToGo).toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 text-xs">
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-emerald-700">{data.goalCount}</div>
          <div className="text-[10px] text-gray-500">總目標</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-orange-600">{data.nearComplete}</div>
          <div className="text-[10px] text-gray-500">即將達成</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-blue-600">{data.uniqueKids}</div>
          <div className="text-[10px] text-gray-500">參與小孩</div>
        </div>
      </div>
    </div>
  )
}

function FamilyRecentBadgesCard() {
  const { data } = useQuery<{
    days: number
    badges: Array<{
      badgeId: number
      badgeType: string
      title: string
      emoji: string
      earnedAt: string
      kidName: string
      kidAvatar: string
    }>
    badgeCount: number
    uniqueKids: number
    uniqueTypes: number
    message: string
  }>({
    queryKey: ["/api/family/recent-badges?days=30&limit=20"],
  })
  if (!data || data.badgeCount === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-fuchsia-300 bg-gradient-to-br from-fuchsia-50 to-pink-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏅 30 天徽章時間軸</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {data.badges.map((b) => (
          <div
            key={b.badgeId}
            className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs border-l-4 border-fuchsia-400"
          >
            <div className="text-xl">{b.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{b.title}</div>
              <div className="text-[10px] text-gray-500">
                {b.kidAvatar} {b.kidName} · {b.earnedAt?.slice(0, 10)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyTaskHourDistributionCard() {
  const { data } = useQuery<{
    days: number
    hours: Array<{ hour: number; taskCount: number }>
    segments: Array<{
      key: string
      label: string
      emoji: string
      taskCount: number
      percentage: number
    }>
    totalCount: number
    peakSegment: { label: string; emoji: string; percentage: number } | null
    message: string
  }>({
    queryKey: ["/api/family/task-hour-distribution?days=30"],
  })
  if (!data || data.totalCount === 0) return null

  const maxHourCount = Math.max(...data.hours.map((h) => h.taskCount), 1)

  return (
    <div className="mb-4 rounded-2xl border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⏰ 30 天完成時段熱力圖</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      {/* 4 段大區塊 */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        {data.segments.map((s) => (
          <div key={s.key} className="bg-white rounded-lg p-2 text-center">
            <div className="text-lg">{s.emoji}</div>
            <div className="text-[9px] text-gray-500 truncate">{s.label.split(" ")[0]}</div>
            <div className="text-xs font-bold text-teal-700">{s.percentage}%</div>
            <div className="text-[9px] text-gray-400">{s.taskCount} 次</div>
          </div>
        ))}
      </div>

      {/* 24 小時 mini bar */}
      <div className="bg-white rounded-lg p-2">
        <div className="text-[10px] text-gray-500 mb-1">每小時完成數</div>
        <div className="flex items-end gap-[1px] h-12">
          {data.hours.map((h) => {
            const height = (h.taskCount / maxHourCount) * 100
            return (
              <div
                key={h.hour}
                className="flex-1 bg-teal-400 rounded-t hover:bg-teal-600 transition-colors"
                style={{ height: `${Math.max(2, height)}%` }}
                title={`${h.hour}:00 — ${h.taskCount} 次`}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-[8px] text-gray-400 mt-1">
          <span>0</span>
          <span>6</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
      </div>
    </div>
  )
}

function FamilyBiggestWinsCard() {
  const { data } = useQuery<{
    days: number
    wins: Array<{
      taskId: number
      title: string
      emoji: string
      reward: number
      difficulty: string
      approvedAt: string
      kidName: string
      kidAvatar: string
    }>
    winCount: number
    topWin: { reward: number; kidName: string; title: string } | null
    grandTotal: number
    message: string
  }>({
    queryKey: ["/api/family/biggest-wins?days=30&limit=10"],
  })
  if (!data || data.winCount === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏆 30 天大獎排行</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {data.wins.map((w, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`
          return (
            <div key={w.taskId} className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs">
              <div className="w-6 text-center text-sm">{medal}</div>
              <div className="text-lg">{w.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{w.title}</div>
                <div className="text-[10px] text-gray-500">
                  {w.kidAvatar} {w.kidName} · {w.approvedAt?.slice(0, 10)}
                </div>
              </div>
              <div className="text-base font-bold text-amber-700">${w.reward}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyTodayCheckinRosterCard() {
  const { data } = useQuery<{
    totalKids: number
    checkedInCount: number
    uncheckedCount: number
    rate: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      checkedIn: boolean
      mood: string | null
      note: string | null
    }>
    uncheckedKids: Array<{ kidId: number; kidName: string; avatar: string }>
    message: string
  }>({
    queryKey: ["/api/family/today-checkin-roster"],
  })
  if (!data || data.totalKids === 0) return null

  const allDone = data.checkedInCount === data.totalKids
  const borderColor = allDone ? "border-emerald-300" : "border-yellow-300"
  const bgGradient = allDone ? "from-emerald-50 to-green-50" : "from-yellow-50 to-amber-50"

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${borderColor} bg-gradient-to-br ${bgGradient} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">
        {allDone ? "🎉" : "📋"} 今日簽到名冊 ({data.checkedInCount}/{data.totalKids})
      </h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1">
        {data.kids.map((k) => (
          <div
            key={k.kidId}
            className={`rounded-lg p-2 flex items-center gap-2 text-xs ${k.checkedIn ? "bg-white" : "bg-yellow-50 border border-yellow-200"}`}
          >
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{k.kidName}</div>
              {k.checkedIn ? (
                <div className="text-[10px] text-gray-600 truncate">
                  {k.mood} {k.note && `· ${k.note}`}
                </div>
              ) : (
                <div className="text-[10px] text-yellow-700">尚未簽到</div>
              )}
            </div>
            <div className="text-base">{k.checkedIn ? "✅" : "⏰"}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyCategoryBreakdownCard() {
  const { data } = useQuery<{
    days: number
    categories: Array<{
      category: string
      label: string
      emoji: string
      taskCount: number
      totalReward: number
      uniqueKids: number
      percentage: number
    }>
    totalCount: number
    topCategory: { label: string; emoji: string } | null
    message: string
  }>({
    queryKey: ["/api/family/task-category-breakdown?days=30"],
  })
  if (!data || data.categories.length === 0) return null

  const COLORS: Record<string, string> = {
    housework: "bg-emerald-400",
    study: "bg-blue-400",
    self_care: "bg-purple-400",
    kindness: "bg-rose-400",
    other: "bg-gray-400",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-blue-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📊 30 天任務類別分佈</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-2">
        {data.categories.map((c) => (
          <div key={c.category} className="bg-white rounded-lg p-2">
            <div className="flex items-center justify-between mb-1 text-xs">
              <span className="font-medium">
                {c.emoji} {c.label}
              </span>
              <span className="text-gray-500">
                {c.taskCount} 次 · ${Math.round(c.totalReward)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`${COLORS[c.category] ?? "bg-gray-400"} h-3 transition-all`}
                  style={{ width: `${c.percentage}%` }}
                />
              </div>
              <span className="text-xs font-bold w-10 text-right">{c.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyKindnessMilestoneCard() {
  const { data } = useQuery<{
    total: number
    currentMilestone: { tier: string; amount: number; emoji: string } | null
    nextMilestone: { tier: string; amount: number; emoji: string } | null
    progressToNext: number
    amountToNext: number
    message: string
  }>({
    queryKey: ["/api/family/kindness-milestone"],
  })
  if (!data || data.total === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">
        {data.currentMilestone?.emoji ?? "❤️"} 家庭行善里程碑
      </h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-3 text-center mb-2">
        <div className="text-[10px] text-gray-600">累積行善</div>
        <div className="text-2xl font-bold text-amber-700">
          ${Math.round(data.total).toLocaleString()}
        </div>
        {data.currentMilestone && (
          <div className="text-xs text-amber-600 mt-1">
            目前等級：{data.currentMilestone.emoji} {data.currentMilestone.tier}
          </div>
        )}
      </div>

      {data.nextMilestone && (
        <div className="bg-white rounded-lg p-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600">
              距離 {data.nextMilestone.emoji} {data.nextMilestone.tier}
            </span>
            <span className="font-bold text-amber-700">{data.progressToNext}%</span>
          </div>
          <div className="w-full bg-amber-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-400 to-orange-500 h-2 transition-all"
              style={{ width: `${data.progressToNext}%` }}
            />
          </div>
          <div className="text-[10px] text-gray-500 mt-1 text-center">
            還差 ${Math.round(data.amountToNext)}
          </div>
        </div>
      )}
    </div>
  )
}

function FamilyTopRecipientsCard() {
  const { data } = useQuery<{
    days: number
    recipients: Array<{
      recipient: string
      totalAmount: number
      giveCount: number
      uniqueKids: number
      lastGiveDate: string
    }>
    grandTotal: number
    recipientCount: number
    topPick: { recipient: string; totalAmount: number } | null
    message: string
  }>({
    queryKey: ["/api/family/top-recipients?days=30&limit=5"],
  })
  if (!data || data.recipients.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-pink-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">❤️ 家裡最支持的對象</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1">
        {data.recipients.map((r, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`
          return (
            <div
              key={r.recipient}
              className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs"
            >
              <div className="w-6 text-center text-sm">{medal}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.recipient}</div>
                <div className="text-[10px] text-gray-500">
                  {r.giveCount} 次 · {r.uniqueKids} 位小孩 · 最近 {r.lastGiveDate}
                </div>
              </div>
              <div className="text-sm font-bold text-rose-600">${Math.round(r.totalAmount)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyProofImageWallCard() {
  const { data } = useQuery<{
    days: number
    photos: Array<{
      taskId: number
      title: string
      emoji: string
      reward: number
      proofImageUrl: string
      approvedAt: string
      kidName: string
      kidAvatar: string
    }>
    photoCount: number
    uniqueKids: number
    message: string
  }>({
    queryKey: ["/api/family/proof-image-wall?days=7"],
  })
  if (!data || data.photos.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-cyan-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📸 努力證明照片牆</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-3 gap-2">
        {data.photos.map((p) => (
          <a
            key={p.taskId}
            href={p.proofImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <img
              src={p.proofImageUrl}
              alt={p.title}
              className="w-full h-24 object-cover"
              loading="lazy"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
              <div className="text-[9px] text-white truncate">
                {p.kidAvatar} {p.kidName}
              </div>
              <div className="text-[9px] text-white truncate">
                {p.emoji} {p.title}
              </div>
            </div>
            <div className="absolute top-1 right-1 bg-amber-400 text-[9px] font-bold px-1 rounded">
              ${p.reward}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

function FamilyStalePendingTasksCard() {
  const { data } = useQuery<{
    days: number
    tasks: Array<{
      taskId: number
      title: string
      emoji: string
      reward: number
      kidName: string
      kidAvatar: string
      waitingDays: number
    }>
    totalForgotten: number
    maxWaitingDays: number
    severity: "ok" | "warn" | "alert"
    message: string
  }>({
    queryKey: ["/api/family/stale-pending-tasks?days=3"],
  })
  if (!data || data.tasks.length === 0) return null

  const borderColor = data.severity === "alert" ? "border-red-500" : "border-orange-400"
  const bgGradient =
    data.severity === "alert" ? "from-red-50 to-orange-50" : "from-orange-50 to-amber-50"

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${borderColor} bg-gradient-to-br ${bgGradient} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">
        {data.severity === "alert" ? "🚨" : "⏳"} 別忘了批准小孩的努力
      </h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs font-medium">{data.message}</div>

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {data.tasks.map((t) => (
          <div key={t.taskId} className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs">
            <div className="text-lg">{t.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.title}</div>
              <div className="text-[10px] text-gray-500">
                {t.kidAvatar} {t.kidName} · 等了 {t.waitingDays} 天
              </div>
            </div>
            <div className="text-sm font-bold text-red-600">${t.reward}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyKindnessStoryCard() {
  const { data } = useQuery<{
    days: number
    stories: Array<{
      spendingId: number
      amount: number
      description: string
      emoji: string
      recipient: string | null
      reflection: string
      spendDate: string
      kidName: string
      kidAvatar: string
    }>
    totalKindness: number
    uniqueKids: number
    storyCount: number
    message: string
  }>({
    queryKey: ["/api/family/weekly-kindness-story"],
  })
  if (!data || data.stories.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">❤️ 本週善心故事</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {data.stories.map((s) => (
          <div key={s.spendingId} className="bg-white rounded-lg p-2 border-l-4 border-pink-400">
            <div className="flex items-center justify-between mb-1 text-xs">
              <div className="flex items-center gap-1">
                <span>{s.kidAvatar}</span>
                <span className="font-medium">{s.kidName}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500">{s.spendDate}</span>
              </div>
              <div className="font-bold text-rose-600">${s.amount}</div>
            </div>
            <div className="text-xs text-gray-700 mb-1">
              {s.emoji} {s.description}
              {s.recipient && <span className="text-gray-500"> → {s.recipient}</span>}
            </div>
            <div className="text-xs italic text-pink-700 bg-pink-50 rounded p-1">
              「{s.reflection}」
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyTodayTasksListCard() {
  const { data } = useQuery<{
    tasks: Array<{
      taskId: number
      title: string
      emoji: string
      reward: number
      category: string
      difficulty: string
      completedAt: string
      kidName: string
      kidAvatar: string
    }>
    totalCount: number
    totalReward: number
    message: string
  }>({
    queryKey: ["/api/family/today-tasks-list?limit=20"],
  })
  if (!data || data.tasks.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📋 今日完成清單</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {data.tasks.map((t) => (
          <div key={t.taskId} className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs">
            <div className="text-lg">{t.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.title}</div>
              <div className="text-[10px] text-gray-500">
                {t.kidAvatar} {t.kidName} · {t.completedAt.slice(11, 16)}
              </div>
            </div>
            <div className="text-sm font-bold text-amber-600">${t.reward}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyTaskRepeatByKidCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      total: number
      uniqueTitles: number
      repeatRate: number
      pattern: "routine" | "mixed" | "variety" | "no_data"
    }>
    patternCounts: { routine: number; mixed: number; variety: number }
    message: string
  }>({
    queryKey: ["/api/family/task-repeat-by-kid?days=90"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.total > 0)
  if (withTasks.length === 0) return null

  const PATTERN_LABEL: Record<string, string> = {
    routine: "📋 日常型",
    mixed: "⚖️ 混合型",
    variety: "🎨 嘗鮮型",
    no_data: "—",
  }
  const PATTERN_COLOR: Record<string, string> = {
    routine: "bg-blue-100 text-blue-700",
    mixed: "bg-emerald-100 text-emerald-700",
    variety: "bg-purple-100 text-purple-700",
    no_data: "bg-gray-100 text-gray-500",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🔁 任務重複率（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withTasks.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                {k.uniqueTitles} 種 / 共 {k.total} 個 · 重複率 {k.repeatRate}%
              </div>
            </div>
            <div className={`text-[10px] px-1.5 py-0.5 rounded ${PATTERN_COLOR[k.pattern]}`}>
              {PATTERN_LABEL[k.pattern]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyFirstTaskTimelineCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      accountAgeDays: number
      firstTaskAt: string | null
      daysToFirstTask: number | null
      speed: "instant" | "fast" | "normal" | "slow" | "never"
    }>
    fastestStart: { kidName: string; avatar: string; daysToFirstTask: number | null } | null
    neverCount: number
    message: string
  }>({
    queryKey: ["/api/family/first-task-timeline"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.speed !== "never")
  if (withTasks.length === 0) return null

  const SPEED_LABEL: Record<string, string> = {
    instant: "⚡ 當天",
    fast: "🚀 一週內",
    normal: "👍 一月內",
    slow: "🐢 超過一月",
    never: "—",
  }
  const SPEED_COLOR: Record<string, string> = {
    instant: "bg-emerald-500 text-white",
    fast: "bg-blue-400 text-white",
    normal: "bg-amber-400 text-white",
    slow: "bg-rose-400 text-white",
    never: "bg-gray-300 text-gray-700",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🌱 首次任務速度</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withTasks.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                {k.daysToFirstTask} 天 · 帳齡 {k.accountAgeDays} 天
              </div>
            </div>
            <div className={`text-[10px] px-1.5 py-0.5 rounded ${SPEED_COLOR[k.speed]}`}>
              {SPEED_LABEL[k.speed]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyKidWeekendVsWeekdayCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      weekendTasks: number
      weekdayTasks: number
      weekendAvg: number
      weekdayAvg: number
      type: "weekend_warrior" | "weekday_focused" | "balanced" | "no_data"
    }>
    typeCounts: { weekend_warrior: number; weekday_focused: number; balanced: number }
    message: string
  }>({
    queryKey: ["/api/family/kid-weekend-vs-weekday?days=60"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.type !== "no_data")
  if (withTasks.length === 0) return null

  const TYPE_LABEL: Record<string, string> = {
    weekend_warrior: "🏖️ 週末戰士",
    weekday_focused: "💼 平日專注",
    balanced: "⚖️ 平衡",
    no_data: "—",
  }
  const TYPE_COLOR: Record<string, string> = {
    weekend_warrior: "bg-purple-100 text-purple-700",
    weekday_focused: "bg-blue-100 text-blue-700",
    balanced: "bg-emerald-100 text-emerald-700",
    no_data: "bg-gray-100 text-gray-500",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-blue-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📆 週末 vs 平日（60 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withTasks.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 text-sm font-medium">{k.kidName}</div>
              <div className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_COLOR[k.type]}`}>
                {TYPE_LABEL[k.type]}
              </div>
            </div>
            <div className="text-[10px] text-gray-500 flex justify-between">
              <span>
                🏖️ 週末 {k.weekendTasks}（日均 {k.weekendAvg}）
              </span>
              <span>
                💼 平日 {k.weekdayTasks}（日均 {k.weekdayAvg}）
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyAllGoalsEtaCard() {
  const { data } = useQuery<{
    goals: Array<{
      goalId: number
      goalName: string
      goalEmoji: string
      target: number
      current: number
      remaining: number
      kidName: string
      kidAvatar: string
      velocity: number
      etaDays: number | null
      etaDate: string | null
      predictable: boolean
    }>
    predictableCount: number
    message: string
  }>({
    queryKey: ["/api/family/all-goals-eta"],
  })
  if (!data || data.goals.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⏱️ 所有目標 ETA</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.goals.slice(0, 6).map((g) => (
          <div key={g.goalId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1 text-xs">
              <span className="text-lg">{g.goalEmoji}</span>
              <span className="flex-1 truncate font-medium">{g.goalName}</span>
              <span className="text-[10px] text-gray-500">
                {g.kidAvatar} {g.kidName}
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>
                ${g.current}/${g.target}（差 ${g.remaining}）
              </span>
              {g.predictable && g.etaDays !== null ? (
                <span className="font-bold text-blue-600">
                  {g.etaDays === 0 ? "已達成" : `${g.etaDays} 天後`}
                  {g.etaDate && g.etaDays > 0 ? `（${g.etaDate.slice(5)}）` : ""}
                </span>
              ) : (
                <span className="text-amber-600">無法預估</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyTodayLeaderboardCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      tasks: number
      reward: number
      checkin: number
      spent: number
    }>
    topToday: { kidName: string; avatar: string; tasks: number } | null
    totalTasks: number
    totalReward: number
    message: string
  }>({
    queryKey: ["/api/family/today-leaderboard"],
  })
  if (!data || data.kids.length === 0) return null
  if (!data.topToday) return null

  const MEDAL = ["🥇", "🥈", "🥉"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🌟 今日排行榜</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          全家今日 {data.totalTasks} 個任務 / 入帳 ${data.totalReward}
        </div>
      </div>

      <div className="space-y-1.5">
        {data.kids
          .filter((k) => k.tasks > 0 || k.checkin > 0)
          .map((k, i) => (
            <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
              <div className="text-xl">{i < 3 ? MEDAL[i] : `${i + 1}`}</div>
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{k.kidName}</div>
                <div className="text-[10px] text-gray-500">
                  📋 {k.tasks} · ✅ {k.checkin} · 🛒 ${k.spent}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-amber-600">${k.reward}</div>
                <div className="text-[9px] text-gray-500">入帳</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function FamilyTodayVsYesterdayCard() {
  const { data } = useQuery<{
    today: { tasks: number; reward: number; spent: number; given: number; checkins: number }
    yesterday: { tasks: number; reward: number; spent: number; given: number; checkins: number }
    deltas: Record<string, { abs: number; arrow: "↑" | "↓" | "→" }>
    message: string
  }>({
    queryKey: ["/api/family/today-vs-yesterday"],
  })
  if (!data) return null
  const totalToday = data.today.tasks + data.today.checkins
  const totalYesterday = data.yesterday.tasks + data.yesterday.checkins
  if (totalToday === 0 && totalYesterday === 0) return null

  const metrics: Array<{ key: keyof typeof data.today; label: string; emoji: string }> = [
    { key: "tasks", label: "任務", emoji: "📋" },
    { key: "reward", label: "入帳", emoji: "💰" },
    { key: "spent", label: "花用", emoji: "🛒" },
    { key: "given", label: "捐贈", emoji: "💝" },
    { key: "checkins", label: "打卡", emoji: "✅" },
  ]

  const ARROW_COLOR: Record<string, string> = {
    "↑": "text-emerald-600",
    "↓": "text-rose-500",
    "→": "text-gray-400",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⏳ 今日 vs 昨日</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-5 gap-1.5">
        {metrics.map((m) => {
          const t = data.today[m.key]
          const y = data.yesterday[m.key]
          const d = data.deltas[m.key]
          return (
            <div key={m.key} className="bg-white rounded-lg p-2 text-center">
              <div className="text-[10px] text-gray-500">
                {m.emoji} {m.label}
              </div>
              <div className="text-base font-bold">{t}</div>
              <div className={`text-[9px] ${ARROW_COLOR[d?.arrow ?? "→"]}`}>
                {d?.arrow} {d?.abs > 0 ? "+" : ""}
                {d?.abs}
              </div>
              <div className="text-[9px] text-gray-400">昨 {y}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyKidAvgRewardCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      taskCount: number
      avgReward: number
      minReward: number
      maxReward: number
      totalReward: number
    }>
    topByAvg: { kidName: string; avatar: string; avgReward: number } | null
    message: string
  }>({
    queryKey: ["/api/family/kid-avg-reward?days=90"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.taskCount > 0)
  if (withTasks.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">💎 任務獎勵平均（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withTasks.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 text-sm font-medium">{k.kidName}</div>
              <div className="text-lg font-bold text-amber-600">${k.avgReward}</div>
              <div className="text-[10px] text-gray-500">平均</div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>共 {k.taskCount} 個</span>
              <span>最低 ${k.minReward}</span>
              <span>最高 ${k.maxReward}</span>
              <span>累計 ${k.totalReward}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyKidLearningCurveCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      accountAgeDays: number
      firstMonthTasks: number
      recentMonthTasks: number
      diff: number
      improvement: "rising" | "steady" | "declining" | "new" | "no_data"
    }>
    risingCount: number
    newCount: number
    message: string
  }>({
    queryKey: ["/api/family/kid-learning-curve"],
  })
  if (!data || data.kids.length === 0) return null

  const established = data.kids.filter(
    (k) => k.improvement !== "new" && k.improvement !== "no_data"
  )
  if (established.length === 0) return null

  const IMP_LABEL: Record<string, string> = {
    rising: "📈 進步",
    steady: "➖ 持平",
    declining: "📉 下滑",
    new: "🌱 新手",
    no_data: "—",
  }
  const IMP_COLOR: Record<string, string> = {
    rising: "bg-emerald-500 text-white",
    steady: "bg-blue-400 text-white",
    declining: "bg-rose-500 text-white",
    new: "bg-amber-300 text-amber-900",
    no_data: "bg-gray-300 text-gray-700",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-blue-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📈 學習曲線</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {established.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                首月 {k.firstMonthTasks} → 最近 {k.recentMonthTasks}（{k.diff >= 0 ? "+" : ""}
                {k.diff}）
              </div>
            </div>
            <div className={`text-[10px] px-1.5 py-0.5 rounded ${IMP_COLOR[k.improvement]}`}>
              {IMP_LABEL[k.improvement]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyKidFavoriteEmojiCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      favoriteEmoji: string | null
      count: number
    }>
    message: string
  }>({
    queryKey: ["/api/family/kid-favorite-emoji?days=90"],
  })
  if (!data) return null
  const withEmoji = data.kids.filter((k) => k.favoriteEmoji)
  if (withEmoji.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎨 最愛 emoji（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-2 gap-2">
        {withEmoji.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1 text-sm">{k.kidName}</div>
            <div className="text-right">
              <div className="text-2xl">{k.favoriteEmoji}</div>
              <div className="text-[9px] text-gray-500">用 {k.count} 次</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyKidPeakHourCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      peakHour: number | null
      peakCount: number
      peakLabel: string | null
    }>
    familyPeak: { hour: number; count: number } | null
    message: string
  }>({
    queryKey: ["/api/family/kid-peak-hour?days=30"],
  })
  if (!data || !data.familyPeak) return null

  const withPeak = data.kids.filter((k) => k.peakHour !== null)
  if (withPeak.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🕐 任務高峰小時（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          全家最常在 {data.familyPeak.hour < 12 ? "上午" : "下午"} {data.familyPeak.hour}:00
          完成任務
        </div>
      </div>

      <div className="space-y-1.5">
        {withPeak.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">{k.peakCount} 個任務</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-indigo-600">{k.peakLabel}</div>
              <div className="text-[9px] text-gray-500">最常做</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyDifficultyByKidCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      easy: number
      medium: number
      hard: number
      total: number
      hardRatio: number
      challengeLevel: "bold" | "balanced" | "safe" | "no_data"
    }>
    boldCount: number
    message: string
  }>({
    queryKey: ["/api/family/difficulty-by-kid?days=90"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.total > 0)
  if (withTasks.length === 0) return null

  const LEVEL_LABEL: Record<string, string> = {
    bold: "🚀 勇敢",
    balanced: "⚖️ 平衡",
    safe: "🛡️ 保守",
    no_data: "—",
  }
  const LEVEL_COLOR: Record<string, string> = {
    bold: "bg-rose-500 text-white",
    balanced: "bg-emerald-500 text-white",
    safe: "bg-blue-400 text-white",
    no_data: "bg-gray-300 text-gray-700",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⭐ 難度分佈對比（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withTasks.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">hard {k.hardRatio}%</div>
              <div className={`text-[10px] px-1.5 py-0.5 rounded ${LEVEL_COLOR[k.challengeLevel]}`}>
                {LEVEL_LABEL[k.challengeLevel]}
              </div>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
              {k.easy > 0 && (
                <div className="bg-green-400" style={{ width: `${(k.easy / k.total) * 100}%` }} />
              )}
              {k.medium > 0 && (
                <div className="bg-amber-400" style={{ width: `${(k.medium / k.total) * 100}%` }} />
              )}
              {k.hard > 0 && (
                <div className="bg-red-500" style={{ width: `${(k.hard / k.total) * 100}%` }} />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
              <span>⭐ easy {k.easy}</span>
              <span>⭐⭐ medium {k.medium}</span>
              <span>⭐⭐⭐ hard {k.hard}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyTaskSpeedMvpCard() {
  const { data } = useQuery<{
    days: number
    tasks: Array<{
      taskId: number
      title: string
      emoji: string
      reward: number
      seconds: number
      durationDisplay: string
      kidName: string
      kidAvatar: string
    }>
    message: string
  }>({
    queryKey: ["/api/family/task-speed-mvp?days=30&limit=5"],
  })
  if (!data || data.tasks.length === 0) return null

  const MEDAL = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⚡ 速度榮譽榜（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.tasks.map((t, i) => (
          <div key={t.taskId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-xl">{MEDAL[i]}</div>
            <div className="text-lg">{t.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{t.title}</div>
              <div className="text-[10px] text-gray-500">
                {t.kidAvatar} {t.kidName} · ${t.reward}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-green-600">{t.durationDisplay}</div>
              <div className="text-[9px] text-gray-500">處理</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyKidDailyAvgTasksCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      taskCount: number
      avgPerDay: number
      pace: "power" | "steady" | "occasional" | "idle"
    }>
    topAchiever: { kidName: string; avatar: string; avgPerDay: number } | null
    familyAvgPerDay: number
    message: string
  }>({
    queryKey: ["/api/family/kid-daily-avg-tasks?days=30"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.taskCount > 0)
  if (withTasks.length === 0) return null

  const PACE_LABEL: Record<string, string> = {
    power: "🚀 全力",
    steady: "💪 穩定",
    occasional: "🌱 偶爾",
    idle: "💤 停滯",
  }
  const PACE_COLOR: Record<string, string> = {
    power: "bg-emerald-500 text-white",
    steady: "bg-blue-400 text-white",
    occasional: "bg-amber-400 text-white",
    idle: "bg-gray-400 text-white",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-teal-400 bg-gradient-to-br from-teal-50 to-cyan-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏃 每日平均（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">全家平均每天 {data.familyAvgPerDay} 個任務</div>
      </div>

      <div className="space-y-1.5">
        {data.kids.map((k, i) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="w-4 text-center text-gray-500">{i + 1}</div>
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">共 {k.taskCount} 個</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-teal-600">{k.avgPerDay}</div>
              <div className="text-[9px] text-gray-500">/天</div>
            </div>
            <div className={`text-[10px] px-1.5 py-0.5 rounded ${PACE_COLOR[k.pace]}`}>
              {PACE_LABEL[k.pace]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyTaskCategoryByKidCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      categories: {
        housework: number
        study: number
        self_care: number
        kindness: number
        other: number
      }
      topCategory: string | null
      topCategoryLabel: string | null
      total: number
    }>
    message: string
  }>({
    queryKey: ["/api/family/task-category-by-kid?days=90"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.total > 0)
  if (withTasks.length === 0) return null

  const CAT_INFO = [
    { key: "housework", label: "🧹 家事", color: "bg-blue-400" },
    { key: "study", label: "📚 學習", color: "bg-purple-400" },
    { key: "self_care", label: "🧴 自理", color: "bg-pink-400" },
    { key: "kindness", label: "💝 善行", color: "bg-rose-400" },
    { key: "other", label: "📋 其他", color: "bg-gray-400" },
  ] as const

  return (
    <div className="mb-4 rounded-2xl border-2 border-fuchsia-300 bg-gradient-to-br from-fuchsia-50 to-purple-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎨 兒童分類偏好（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-2">
        {withTasks.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center justify-between mb-1 text-xs">
              <span>
                {k.avatar} {k.kidName}
              </span>
              <span className="text-[10px] text-gray-500">
                共 {k.total} 個 · 最愛 {k.topCategoryLabel}
              </span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
              {CAT_INFO.map((c) => {
                const count = k.categories[c.key as keyof typeof k.categories]
                const pct = k.total > 0 ? (count / k.total) * 100 : 0
                if (pct === 0) return null
                return (
                  <div
                    key={c.key}
                    className={c.color}
                    style={{ width: `${pct}%` }}
                    title={`${c.label}: ${count}`}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyGoalUrgencyRankCard() {
  const { data } = useQuery<{
    goals: Array<{
      goalId: number
      goalName: string
      goalEmoji: string
      target: number
      current: number
      progress: number
      deadline: string
      daysUntil: number
      kidName: string
      kidAvatar: string
      urgency: "overdue" | "critical" | "warning" | "safe"
    }>
    total: number
    overdueCount: number
    criticalCount: number
    message: string
  }>({
    queryKey: ["/api/family/goal-urgency-rank?limit=10"],
  })
  if (!data || data.total === 0) return null

  const URGENCY_BG: Record<string, string> = {
    overdue: "bg-rose-100 border-rose-400",
    critical: "bg-amber-100 border-amber-400",
    warning: "bg-yellow-100 border-yellow-400",
    safe: "bg-emerald-100 border-emerald-300",
  }
  const URGENCY_LABEL: Record<string, string> = {
    overdue: "🚨 過期",
    critical: "⏰ 緊急",
    warning: "⚠️ 注意",
    safe: "✅ 安全",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⏳ 目標 deadline 緊急度</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.goals.slice(0, 6).map((g) => (
          <div key={g.goalId} className={`rounded-lg p-2 border ${URGENCY_BG[g.urgency]}`}>
            <div className="flex items-center gap-2 mb-1 text-xs">
              <span className="text-lg">{g.goalEmoji}</span>
              <span className="flex-1 truncate font-medium">{g.goalName}</span>
              <span className="text-[10px]">{URGENCY_LABEL[g.urgency]}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>
                {g.kidAvatar} {g.kidName} · ${g.current}/${g.target}（{g.progress}%）
              </span>
              <span className={g.daysUntil < 0 ? "text-red-600 font-bold" : ""}>
                {g.daysUntil < 0 ? `逾期 ${Math.abs(g.daysUntil)} 天` : `剩 ${g.daysUntil} 天`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyKidEarningsTrendCard() {
  const { data } = useQuery<{
    months: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      months: Array<{ month: string; earnings: number }>
      total: number
    }>
    topEarner: { kidName: string; avatar: string; total: number } | null
    familyTotal: number
    message: string
  }>({
    queryKey: ["/api/family/kid-earnings-trend?months=6"],
  })
  if (!data || data.kids.length === 0 || data.familyTotal === 0) return null

  const allMaxEarnings = Math.max(...data.kids.flatMap((k) => k.months.map((m) => m.earnings)), 1)

  return (
    <div className="mb-4 rounded-2xl border-2 border-cyan-400 bg-gradient-to-br from-cyan-50 to-blue-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">💰 兒童入帳趨勢（6 月）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">全家累計 ${data.familyTotal}</div>
      </div>

      <div className="space-y-2">
        {data.kids.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center justify-between mb-1 text-xs">
              <span>
                {k.avatar} {k.kidName}
              </span>
              <span className="font-bold">${k.total}</span>
            </div>
            <div className="flex items-end gap-1 h-10">
              {k.months.map((m) => {
                const h = (m.earnings / allMaxEarnings) * 100
                return (
                  <div
                    key={m.month}
                    className="flex-1 flex flex-col items-center justify-end"
                    title={`${m.month}: $${m.earnings}`}
                  >
                    <div
                      className="w-full bg-cyan-500 rounded-t"
                      style={{ height: `${Math.max(h, 2)}%` }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyGoalsMonthlyCompletionCard() {
  const { data } = useQuery<{
    months: Array<{ month: string; goalsCount: number; totalAmount: number }>
    grandTotalGoals: number
    grandTotalAmount: number
    biggestMonth: { month: string; goalsCount: number; totalAmount: number } | null
    message: string
  }>({
    queryKey: ["/api/family/goals-monthly-completion?months=6"],
  })
  if (!data || data.grandTotalGoals === 0) return null

  const maxAmount = Math.max(...data.months.map((m) => m.totalAmount), 1)

  return (
    <div className="mb-4 rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎯 目標達成（6 月）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          累計 {data.grandTotalGoals} 個目標 / ${data.grandTotalAmount}
        </div>
      </div>

      <div className="flex items-end gap-1 h-20 bg-white/40 rounded p-2">
        {data.months.map((m) => {
          const h = (m.totalAmount / maxAmount) * 100
          return (
            <div
              key={m.month}
              className="flex-1 flex flex-col items-center justify-end"
              title={`${m.month}: ${m.goalsCount} 個 / $${m.totalAmount}`}
            >
              <div className="text-[9px] text-gray-600 font-bold">{m.goalsCount}</div>
              <div
                className="w-full bg-gradient-to-t from-emerald-400 to-green-500 rounded-t"
                style={{ height: `${Math.max(h, 2)}%` }}
              />
              <div className="text-[9px] text-gray-500 mt-1">{m.month.slice(5)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyCategoryHeatTrendCard() {
  const { data } = useQuery<{
    months: Array<{
      month: string
      housework: number
      study: number
      self_care: number
      kindness: number
      other: number
    }>
    totals: Record<string, number>
    topCategory: string | null
    topCategoryLabel: string | null
    grandTotal: number
    message: string
  }>({
    queryKey: ["/api/family/category-heat-trend?months=6"],
  })
  if (!data || data.grandTotal === 0) return null

  const CAT_INFO: Array<{ key: string; label: string; color: string }> = [
    { key: "housework", label: "🧹 家事", color: "bg-blue-400" },
    { key: "study", label: "📚 學習", color: "bg-purple-400" },
    { key: "self_care", label: "🧴 自我照顧", color: "bg-pink-400" },
    { key: "kindness", label: "💝 善行", color: "bg-rose-400" },
    { key: "other", label: "📋 其他", color: "bg-gray-400" },
  ]

  return (
    <div className="mb-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎨 任務分類熱度（6 月）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {CAT_INFO.map((c) => {
          const count = data.totals[c.key]
          const pct = data.grandTotal > 0 ? Math.round((count / data.grandTotal) * 100) : 0
          if (count === 0) return null
          return (
            <div key={c.key} className="bg-white rounded-lg p-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>{c.label}</span>
                <span className="font-bold">
                  {count}（{pct}%）
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                <div className={`h-full ${c.color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyBadgeLeaderboardCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      badgeCount: number
      latestBadge: { title: string; emoji: string; earnedAt: string } | null
    }>
    totalBadges: number
    topAchiever: { kidName: string; avatar: string; badgeCount: number } | null
    message: string
  }>({
    queryKey: ["/api/family/badge-leaderboard"],
  })
  if (!data || data.kids.length === 0 || data.totalBadges === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎖️ 徽章排名</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.kids.map((k, i) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="w-4 text-center text-gray-500">{i + 1}</div>
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{k.kidName}</div>
              {k.latestBadge && (
                <div className="text-[10px] text-gray-500 truncate">
                  最新：{k.latestBadge.emoji} {k.latestBadge.title}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-amber-600">{k.badgeCount}</div>
              <div className="text-[9px] text-gray-500">徽章</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyKidSpendingHabitsCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      spent: number
      given: number
      earned: number
      giveRatio: number
      habit: "generous" | "spender" | "saver" | "balanced" | "no_data"
    }>
    habitCounts: { generous: number; spender: number; saver: number; balanced: number }
    message: string
  }>({
    queryKey: ["/api/family/kid-spending-habits?days=30"],
  })
  if (!data || data.kids.length === 0) return null
  const withActivity = data.kids.filter((k) => k.habit !== "no_data")
  if (withActivity.length === 0) return null

  const HABIT_LABEL: Record<string, string> = {
    generous: "💝 慷慨",
    spender: "🛒 花用",
    saver: "💎 節儉",
    balanced: "⚖️ 平衡",
    no_data: "—",
  }
  const HABIT_COLOR: Record<string, string> = {
    generous: "bg-violet-100 text-violet-700",
    spender: "bg-rose-100 text-rose-700",
    saver: "bg-emerald-100 text-emerald-700",
    balanced: "bg-blue-100 text-blue-700",
    no_data: "bg-gray-100 text-gray-500",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-pink-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🪙 花用習慣（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withActivity.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 text-sm font-medium">{k.kidName}</div>
              <div className={`text-[10px] px-2 py-0.5 rounded ${HABIT_COLOR[k.habit]}`}>
                {HABIT_LABEL[k.habit]}
              </div>
            </div>
            <div className="text-[10px] text-gray-500 flex justify-between">
              <span>💰 賺 ${k.earned}</span>
              <span>🛒 花 ${k.spent}</span>
              <span>
                💝 捐 ${k.given}（{k.giveRatio}%）
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyKidActiveDaysCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      activeDays: number
      ratio: number
    }>
    topPerformer: { kidName: string; avatar: string; activeDays: number; ratio: number } | null
    familyAvgRatio: number
    message: string
  }>({
    queryKey: ["/api/family/kid-active-days?days=30"],
  })
  if (!data || data.kids.length === 0) return null
  const hasActivity = data.kids.some((k) => k.activeDays > 0)
  if (!hasActivity) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-cyan-400 bg-gradient-to-br from-cyan-50 to-teal-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📅 活躍天數排名（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        {data.topPerformer && (
          <div className="text-gray-600 mt-1">
            👑 最活躍：{data.topPerformer.avatar} {data.topPerformer.kidName}（
            {data.topPerformer.activeDays}/{data.days} 天 = {data.topPerformer.ratio}%）
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {data.kids.map((k, i) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="w-4 text-center text-gray-500">{i + 1}</div>
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="h-1.5 bg-gray-100 rounded overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-teal-500"
                  style={{ width: `${k.ratio}%` }}
                />
              </div>
            </div>
            <div className="text-right whitespace-nowrap">
              <div className="text-sm font-bold">
                {k.activeDays}/{data.days}
              </div>
              <div className="text-[9px] text-gray-500">{k.ratio}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyTaskMvpCard() {
  const { data } = useQuery<{
    days: number
    tasks: Array<{
      taskId: number
      title: string
      emoji: string
      reward: number
      difficulty: string
      category: string
      completedAt: string
      kidName: string
      kidAvatar: string
    }>
    message: string
  }>({
    queryKey: ["/api/family/task-mvp?days=30&limit=5"],
  })
  if (!data || data.tasks.length === 0) return null

  const MEDAL = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-yellow-500 bg-gradient-to-br from-yellow-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏆 Task MVP（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.tasks.map((t, i) => (
          <div key={t.taskId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-xl">{MEDAL[i]}</div>
            <div className="text-lg">{t.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{t.title}</div>
              <div className="text-[10px] text-gray-500">
                {t.kidAvatar} {t.kidName} · {t.completedAt.slice(0, 10)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-amber-600">${t.reward}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyKidTaskCompletionRateCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      approved: number
      rejected: number
      rate: number
      level: "perfect" | "great" | "good" | "needs_practice" | "no_data"
    }>
    familyAvg: number
    message: string
  }>({
    queryKey: ["/api/family/kid-task-completion-rate?days=90"],
  })
  if (!data || data.kids.length === 0) return null
  const withData = data.kids.filter((k) => k.approved + k.rejected > 0)
  if (withData.length === 0) return null

  const LEVEL_COLOR: Record<string, string> = {
    perfect: "bg-yellow-400 text-yellow-900",
    great: "bg-emerald-400 text-white",
    good: "bg-blue-400 text-white",
    needs_practice: "bg-amber-400 text-white",
    no_data: "bg-gray-300 text-gray-700",
  }
  const LEVEL_LABEL: Record<string, string> = {
    perfect: "🏆 完美",
    great: "💪 優秀",
    good: "👍 良好",
    needs_practice: "📋 加強",
    no_data: "—",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">✅ 任務批准率（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withData.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                ✓ {k.approved} · ✗ {k.rejected}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{k.rate}%</div>
              <div
                className={`text-[10px] px-1.5 py-0.5 rounded ${LEVEL_COLOR[k.level]} inline-block`}
              >
                {LEVEL_LABEL[k.level]}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyJarAllocationByKidCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      spendRatio: number
      saveRatio: number
      giveRatio: number
      type: "saver" | "spender" | "giver" | "balanced"
    }>
    familyAvg: { spend: number; save: number; give: number }
    typeCounts: { saver: number; spender: number; giver: number; balanced: number }
    message: string
  }>({
    queryKey: ["/api/family/jar-allocation-by-kid"],
  })
  if (!data || data.kids.length === 0) return null

  const TYPE_LABEL: Record<string, string> = {
    saver: "💎 儲蓄型",
    spender: "🛒 花用型",
    giver: "💝 捐贈型",
    balanced: "⚖️ 平衡型",
  }
  const TYPE_COLOR: Record<string, string> = {
    saver: "bg-emerald-100 text-emerald-700",
    spender: "bg-rose-100 text-rose-700",
    giver: "bg-violet-100 text-violet-700",
    balanced: "bg-blue-100 text-blue-700",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏺 Jar 分配對比</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          全家平均 花 {data.familyAvg.spend}% / 存 {data.familyAvg.save}% / 捐 {data.familyAvg.give}
          %
        </div>
      </div>

      <div className="space-y-1.5">
        {data.kids.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 text-sm font-medium">{k.kidName}</div>
              <div className={`text-[10px] px-2 py-0.5 rounded ${TYPE_COLOR[k.type]}`}>
                {TYPE_LABEL[k.type]}
              </div>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
              <div className="bg-rose-400" style={{ width: `${k.spendRatio}%` }} />
              <div className="bg-emerald-500" style={{ width: `${k.saveRatio}%` }} />
              <div className="bg-violet-500" style={{ width: `${k.giveRatio}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
              <span>🛒{k.spendRatio}%</span>
              <span>💎{k.saveRatio}%</span>
              <span>💝{k.giveRatio}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilySavingsVelocityRankCard() {
  const { data } = useQuery<{
    months: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      saveRatio: number
      monthlyVelocity: number
      currentSave: number
      monthsTo1000: number | null
    }>
    topSaver: {
      kidName: string
      avatar: string
      monthlyVelocity: number
      monthsTo1000: number | null
    } | null
    message: string
  }>({
    queryKey: ["/api/family/savings-velocity-rank?months=3"],
  })
  if (!data || data.kids.length === 0) return null
  const hasVelocity = data.kids.some((k) => k.monthlyVelocity > 0)
  if (!hasVelocity) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-cyan-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">💎 儲蓄速度排名（3 月）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        {data.topSaver && data.topSaver.monthsTo1000 !== null && data.topSaver.monthsTo1000 > 0 && (
          <div className="text-gray-600 mt-1">預估 {data.topSaver.monthsTo1000} 個月可達 $1000</div>
        )}
      </div>

      <div className="space-y-1.5">
        {data.kids.map((k, i) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="w-4 text-center text-gray-500">{i + 1}</div>
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                save {k.saveRatio}% · 目前 ${k.currentSave}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-emerald-600">+${k.monthlyVelocity}</div>
              <div className="text-[9px] text-gray-500">/月</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyTaskMonthlyGrowthCard() {
  const { data } = useQuery<{
    months: Array<{ month: string; tasks: number; growth: number | null }>
    totalTasks: number
    avgGrowth: number
    trend: "rising" | "steady" | "declining" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/task-monthly-growth?months=6"],
  })
  if (!data || data.totalTasks === 0) return null

  const TREND_BG: Record<string, string> = {
    rising: "from-emerald-50 to-green-50 border-emerald-500",
    steady: "from-blue-50 to-sky-50 border-blue-300",
    declining: "from-rose-50 to-red-50 border-rose-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  const maxTasks = Math.max(...data.months.map((m) => m.tasks), 1)

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${TREND_BG[data.trend]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">📈 月度成長率（6 月）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="flex items-end gap-1.5 h-20 bg-white/40 rounded p-2">
        {data.months.map((m) => {
          const h = (m.tasks / maxTasks) * 100
          return (
            <div
              key={m.month}
              className="flex-1 flex flex-col items-center justify-end"
              title={`${m.month}: ${m.tasks} 個${m.growth !== null ? `（${m.growth >= 0 ? "+" : ""}${m.growth}%）` : ""}`}
            >
              <div className="text-[9px] text-gray-600 font-bold">{m.tasks}</div>
              <div
                className={`w-full rounded-t ${m.growth !== null && m.growth >= 0 ? "bg-emerald-500" : m.growth !== null && m.growth < 0 ? "bg-rose-400" : "bg-blue-400"}`}
                style={{ height: `${Math.max(h, 2)}%` }}
              />
              <div className="text-[9px] text-gray-500 mt-1">{m.month.slice(5)}</div>
              {m.growth !== null && (
                <div
                  className={`text-[9px] font-bold ${m.growth >= 0 ? "text-emerald-600" : "text-rose-500"}`}
                >
                  {m.growth >= 0 ? "+" : ""}
                  {m.growth}%
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyGoalAmountHistogramCard() {
  const { data } = useQuery<{
    buckets: Array<{ label: string; range: string; count: number }>
    stats: { total: number; active: number; completed: number; avg: number; max: number }
    dominantBucket: string
    pattern: "modest" | "balanced" | "ambitious" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/goal-amount-histogram"],
  })
  if (!data || data.stats.total === 0) return null

  const maxCount = Math.max(...data.buckets.map((b) => b.count), 1)

  const PATTERN_BG: Record<string, string> = {
    modest: "from-blue-50 to-cyan-50 border-blue-300",
    balanced: "from-emerald-50 to-green-50 border-emerald-400",
    ambitious: "from-violet-50 to-purple-50 border-violet-500",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${PATTERN_BG[data.pattern]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🎯 目標金額分佈</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          總共 {data.stats.total} 個 · 進行中 {data.stats.active} · 已達成 {data.stats.completed} ·
          最高 ${data.stats.max}
        </div>
      </div>

      <div className="space-y-1">
        {data.buckets.map((b) => (
          <div key={b.range} className="flex items-center gap-2 text-xs">
            <div className="w-20 text-right text-gray-600">{b.label}</div>
            <div className="flex-1 h-3 bg-white rounded overflow-hidden">
              {b.count > 0 && (
                <div
                  className={`h-full ${b.label === data.dominantBucket ? "bg-violet-600" : "bg-violet-400"}`}
                  style={{ width: `${(b.count / maxCount) * 100}%` }}
                />
              )}
            </div>
            <div className="w-8 text-right font-bold">{b.count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyTaskDurationCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      taskCount: number
      avgDays: number
    }>
    fastest: { kidName: string; avgDays: number } | null
    slowest: { kidName: string; avgDays: number } | null
    familyAvg: number
    message: string
  }>({
    queryKey: ["/api/family/task-duration?days=60"],
  })
  if (!data || data.kids.length === 0) return null
  const hasTask = data.kids.some((k) => k.taskCount > 0)
  if (!hasTask) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⏱️ Task 處理速度（60 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        {data.fastest && (
          <div className="text-gray-600 mt-1">
            ⚡ 最快：{data.fastest.kidName}（{data.fastest.avgDays} 天）
            {data.slowest && ` · 最慢：${data.slowest.kidName}（${data.slowest.avgDays} 天）`}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {data.kids
          .filter((k) => k.taskCount > 0)
          .map((k) => (
            <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1">
                <div className="text-sm font-medium">{k.kidName}</div>
                <div className="text-[10px] text-gray-500">{k.taskCount} 個任務</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-teal-600">{k.avgDays}</div>
                <div className="text-[9px] text-gray-500">平均天</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function FamilySpendingTopItemsCard() {
  const { data } = useQuery<{
    days: number
    items: Array<{ description: string; count: number; total: number; percentage: number }>
    grandTotal: number
    message: string
  }>({
    queryKey: ["/api/family/spending-top-items?days=90&limit=10"],
  })
  if (!data || data.items.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🛒 花用 top 細項（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1">
        {data.items.map((it, i) => (
          <div key={i} className="bg-white rounded p-2">
            <div className="flex items-center justify-between mb-0.5 text-xs">
              <div className="flex-1 truncate">
                <span className="text-gray-400">#{i + 1}</span> {it.description}
              </div>
              <div className="font-bold">${it.total}</div>
            </div>
            <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-400 to-rose-500"
                style={{ width: `${it.percentage}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {it.count} 筆 · 占 {it.percentage}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyCaptainCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      tasks: number
      checkins: number
      goalsCompleted: number
      score: number
    }>
    captain: { kidName: string; avatar: string; score: number } | null
    message: string
  }>({
    queryKey: ["/api/family/captain?days=30"],
  })
  if (!data || data.kids.length === 0) return null
  if (!data.captain) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-yellow-500 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎖️ 家庭隊長（30 天）</h3>

      <div className="bg-white/80 rounded-lg p-3 mb-2 text-center">
        <div className="text-5xl mb-1">{data.captain.avatar}</div>
        <div className="text-lg font-bold">{data.captain.kidName}</div>
        <div className="text-2xl font-bold text-amber-600 mt-1">{data.captain.score} 分</div>
        <div className="text-[10px] text-gray-500 mt-1">{data.message}</div>
      </div>

      <div className="space-y-1">
        {data.kids.map((k, i) => (
          <div key={k.kidId} className="bg-white rounded p-1.5 flex items-center gap-2 text-xs">
            <div className="w-4 text-center text-gray-500">{i + 1}</div>
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1 truncate">{k.kidName}</div>
            <div className="text-[10px] text-gray-500">
              📋{k.tasks} ✅{k.checkins} 🎯{k.goalsCompleted}
            </div>
            <div className="font-bold text-amber-600">{k.score}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyMonthlyImprovementCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      thisMonth: number
      lastMonth: number
      diff: number
      improvement: number
      status: "improving" | "steady" | "declining" | "stagnated"
    }>
    topImprover: { kidName: string; avatar: string; improvement: number } | null
    stagnatedCount: number
    message: string
  }>({
    queryKey: ["/api/family/monthly-improvement-rank"],
  })
  if (!data || data.kids.length === 0) return null
  const hasActivity = data.kids.some((k) => k.thisMonth > 0 || k.lastMonth > 0)
  if (!hasActivity) return null

  const STATUS_COLOR: Record<string, string> = {
    improving: "bg-emerald-500 text-white",
    steady: "bg-blue-400 text-white",
    declining: "bg-rose-500 text-white",
    stagnated: "bg-gray-400 text-white",
  }

  const STATUS_LABEL: Record<string, string> = {
    improving: "📈 進步",
    steady: "➖ 持平",
    declining: "📉 下滑",
    stagnated: "💤 停滯",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏃 月度進步榜</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.kids.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                本月 {k.thisMonth} · 上月 {k.lastMonth} · {k.diff >= 0 ? "+" : ""}
                {k.diff}
              </div>
            </div>
            <div
              className={`text-[10px] px-2 py-0.5 rounded ${STATUS_COLOR[k.status]} whitespace-nowrap`}
            >
              {STATUS_LABEL[k.status]} {k.improvement >= 0 ? "+" : ""}
              {k.improvement}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyDeadlineHitRateCard() {
  const { data } = useQuery<{
    days: number
    stats: { total: number; onTime: number; late: number }
    hitRate: number
    level: "excellent" | "good" | "fair" | "poor" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/deadline-hit-rate?days=90"],
  })
  if (!data || data.stats.total === 0) return null

  const LEVEL_BG: Record<string, string> = {
    excellent: "from-emerald-50 to-green-50 border-emerald-500",
    good: "from-blue-50 to-sky-50 border-blue-400",
    fair: "from-amber-50 to-yellow-50 border-amber-400",
    poor: "from-rose-50 to-red-50 border-rose-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">⏰ Deadline 達標率（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-4 gap-2 mb-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-blue-600">{data.stats.total}</div>
          <div className="text-[10px] text-gray-500">總計</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-emerald-600">{data.stats.onTime}</div>
          <div className="text-[10px] text-gray-500">準時</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-rose-500">{data.stats.late}</div>
          <div className="text-[10px] text-gray-500">遲到</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-violet-600">{data.hitRate}%</div>
          <div className="text-[10px] text-gray-500">達標率</div>
        </div>
      </div>

      <div className="h-2 bg-white rounded overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
          style={{ width: `${data.hitRate}%` }}
        />
      </div>
    </div>
  )
}

function FamilyTodayTipCard() {
  const { data } = useQuery<{
    tipType:
      | "pending_overflow"
      | "no_recent_activity"
      | "save_too_low"
      | "goal_stalled"
      | "encourage_checkin"
      | "positive"
      | "no_data"
    message: string
    action: string | null
  }>({
    queryKey: ["/api/family/today-tip"],
  })
  if (!data) return null
  if (data.tipType === "no_data") return null

  const TYPE_BG: Record<string, string> = {
    pending_overflow: "from-amber-50 to-orange-50 border-amber-400",
    no_recent_activity: "from-rose-50 to-red-50 border-rose-400",
    save_too_low: "from-violet-50 to-purple-50 border-violet-400",
    goal_stalled: "from-blue-50 to-sky-50 border-blue-400",
    encourage_checkin: "from-cyan-50 to-blue-50 border-cyan-400",
    positive: "from-emerald-50 to-green-50 border-emerald-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${TYPE_BG[data.tipType]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">💡 今日智能提示</h3>
      <div className="bg-white/70 rounded-lg p-2 text-sm">{data.message}</div>
    </div>
  )
}

function FamilyPeakMomentCard() {
  const { data } = useQuery<{
    days: number
    top3: Array<{
      date: string
      weekday: string
      tasks: number
      checkins: number
      spendings: number
      score: number
    }>
    avgScore: number
    totalScore: number
    message: string
  }>({
    queryKey: ["/api/family/peak-moment?days=30"],
  })
  if (!data || data.totalScore === 0) return null

  const MEDAL = ["🥇", "🥈", "🥉"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏆 家庭高峰時刻（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.top3.map((d, i) => (
          <div key={d.date} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-2xl">{MEDAL[i]}</div>
            <div className="flex-1">
              <div className="text-sm font-bold">
                {d.date} ({d.weekday})
              </div>
              <div className="text-[10px] text-gray-500">
                📋 {d.tasks} 任務 · ✅ {d.checkins} 打卡 · 🛒 {d.spendings} 花用
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600">{d.score}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-[10px] text-gray-600 text-center">
        平均每天 {data.avgScore} 個活動
      </div>
    </div>
  )
}

function FamilyGoalsProgressRankCard() {
  const { data } = useQuery<{
    goals: Array<{
      goalId: number
      goalName: string
      goalEmoji: string
      target: number
      current: number
      progress: number
      deadline: string | null
      daysUntilDeadline: number | null
      kidName: string
      kidAvatar: string
      stage: "near_complete" | "midway" | "starting"
    }>
    total: number
    nearCompleteCount: number
    message: string
  }>({
    queryKey: ["/api/family/goals-progress-rank?limit=10"],
  })
  if (!data || data.total === 0) return null

  const STAGE_COLOR: Record<string, string> = {
    near_complete: "bg-emerald-500",
    midway: "bg-blue-500",
    starting: "bg-amber-400",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎯 目標進度排名（即將達成）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.goals.slice(0, 6).map((g) => (
          <div key={g.goalId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{g.goalEmoji}</span>
              <span className="text-xs flex-1 font-medium truncate">{g.goalName}</span>
              <span className="text-xs text-gray-500">
                {g.kidAvatar} {g.kidName}
              </span>
              <span className="text-sm font-bold">{g.progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded overflow-hidden">
              <div
                className={`h-full ${STAGE_COLOR[g.stage]}`}
                style={{ width: `${g.progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>
                ${g.current} / ${g.target}
              </span>
              {g.daysUntilDeadline !== null && (
                <span className={g.daysUntilDeadline < 7 ? "text-red-600 font-bold" : ""}>
                  剩 {g.daysUntilDeadline} 天
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyGoalsVsWishesCard() {
  const { data } = useQuery<{
    goals: { total: number; active: number; completed: number }
    wishes: { total: number; wished: number; promoted: number; abandoned: number }
    promotionRate: number
    goalToWishRatio: number
    discipline: "highly_disciplined" | "balanced" | "wishful" | "no_goals" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/goals-vs-wishes"],
  })
  if (!data) return null
  if (data.goals.total === 0 && data.wishes.total === 0) return null

  const LEVEL_BG: Record<string, string> = {
    highly_disciplined: "from-yellow-50 to-amber-50 border-yellow-500",
    balanced: "from-emerald-50 to-green-50 border-emerald-400",
    wishful: "from-sky-50 to-blue-50 border-sky-300",
    no_goals: "from-amber-50 to-orange-50 border-amber-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.discipline]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🎯 目標 vs 願望（自律度）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-white rounded-lg p-2">
          <div className="text-[10px] text-gray-500 mb-1">🎯 目標</div>
          <div className="text-sm font-bold">{data.goals.total} 個</div>
          <div className="text-[10px] text-gray-600">
            進行 {data.goals.active} · 達成 {data.goals.completed}
          </div>
        </div>
        <div className="bg-white rounded-lg p-2">
          <div className="text-[10px] text-gray-500 mb-1">✨ 願望</div>
          <div className="text-sm font-bold">{data.wishes.total} 個</div>
          <div className="text-[10px] text-gray-600">
            未動 {data.wishes.wished} · 升級 {data.wishes.promoted}
          </div>
        </div>
      </div>

      {data.wishes.total > 0 && (
        <div className="bg-white/40 rounded p-2">
          <div className="text-[10px] text-gray-600 mb-1">願望升級率 {data.promotionRate}%</div>
          <div className="h-2 bg-white rounded overflow-hidden">
            <div
              className={`h-full ${data.promotionRate >= 40 ? "bg-yellow-500" : data.promotionRate >= 15 ? "bg-emerald-500" : "bg-amber-400"}`}
              style={{ width: `${Math.min(data.promotionRate, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function FamilyApproveLatencyCard() {
  const { data } = useQuery<{
    days: number
    stats: { total: number; avgHours: number; medianHours: number }
    buckets: Array<{ label: string; range: string; count: number }>
    level: "instant" | "fast" | "good" | "slow" | "sluggish" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/approve-latency?days=60"],
  })
  if (!data || data.stats.total === 0) return null

  const LEVEL_BG: Record<string, string> = {
    instant: "from-emerald-50 to-green-50 border-emerald-500",
    fast: "from-blue-50 to-sky-50 border-blue-400",
    good: "from-sky-50 to-cyan-50 border-sky-300",
    slow: "from-amber-50 to-yellow-50 border-amber-400",
    sluggish: "from-rose-50 to-red-50 border-rose-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  const maxCount = Math.max(...data.buckets.map((b) => b.count), 1)

  const fmtHours = (h: number) =>
    h < 1 ? `${Math.round(h * 60)} 分` : h < 24 ? `${h} 小時` : `${(h / 24).toFixed(1)} 天`

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">⏱️ 批准延遲（60 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">{data.stats.total}</div>
          <div className="text-[9px] text-gray-500">總批准</div>
        </div>
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">{fmtHours(data.stats.avgHours)}</div>
          <div className="text-[9px] text-gray-500">平均</div>
        </div>
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">{fmtHours(data.stats.medianHours)}</div>
          <div className="text-[9px] text-gray-500">中位數</div>
        </div>
      </div>

      <div className="space-y-1">
        {data.buckets.map((b) => (
          <div key={b.range} className="flex items-center gap-2 text-xs">
            <div className="w-16 text-right text-gray-600">{b.label}</div>
            <div className="flex-1 h-3 bg-white rounded overflow-hidden">
              {b.count > 0 && (
                <div
                  className={`h-full ${b.range === "instant" || b.range === "fast" ? "bg-emerald-500" : b.range === "normal" ? "bg-blue-500" : "bg-rose-400"}`}
                  style={{ width: `${(b.count / maxCount) * 100}%` }}
                />
              )}
            </div>
            <div className="w-8 text-right font-bold">{b.count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyFeedbackRateCard() {
  const { data } = useQuery<{
    days: number
    totalApproved: number
    parentFeedbackRate: number
    kidSubmissionNoteRate: number
    interactionScore: number
    level: "highly_engaged" | "engaged" | "moderate" | "passive" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/feedback-rate?days=90"],
  })
  if (!data || data.totalApproved === 0) return null

  const LEVEL_BG: Record<string, string> = {
    highly_engaged: "from-violet-50 to-pink-50 border-violet-500",
    engaged: "from-emerald-50 to-green-50 border-emerald-400",
    moderate: "from-blue-50 to-sky-50 border-blue-300",
    passive: "from-amber-50 to-orange-50 border-amber-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🤝 親子互動深度（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-violet-600">{data.parentFeedbackRate}%</div>
          <div className="text-[10px] text-gray-500">家長 feedback</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-emerald-600">{data.kidSubmissionNoteRate}%</div>
          <div className="text-[10px] text-gray-500">小孩描述</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-blue-600">{data.interactionScore}</div>
          <div className="text-[10px] text-gray-500">互動分</div>
        </div>
      </div>
    </div>
  )
}

function FamilyRewardStatsCard() {
  const { data } = useQuery<{
    days: number
    stats: { total: number; min: number; max: number; avg: number; median: number }
    buckets: Array<{ label: string; range: string; count: number }>
    dominantBucket: string
    pattern: "diverse" | "concentrated" | "high_value" | "low_value" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/reward-stats?days=90"],
  })
  if (!data || data.stats.total === 0) return null

  const PATTERN_BG: Record<string, string> = {
    diverse: "from-violet-50 to-pink-50 border-violet-400",
    concentrated: "from-blue-50 to-sky-50 border-blue-300",
    high_value: "from-emerald-50 to-green-50 border-emerald-400",
    low_value: "from-amber-50 to-yellow-50 border-amber-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  const maxCount = Math.max(...data.buckets.map((b) => b.count), 1)

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${PATTERN_BG[data.pattern]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">💰 獎勵統計（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-4 gap-2 mb-2">
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">${data.stats.avg}</div>
          <div className="text-[9px] text-gray-500">平均</div>
        </div>
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">${data.stats.median}</div>
          <div className="text-[9px] text-gray-500">中位數</div>
        </div>
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">${data.stats.min}</div>
          <div className="text-[9px] text-gray-500">最小</div>
        </div>
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">${data.stats.max}</div>
          <div className="text-[9px] text-gray-500">最大</div>
        </div>
      </div>

      <div className="space-y-1">
        {data.buckets.map((b) => (
          <div key={b.range} className="flex items-center gap-2 text-xs">
            <div className="w-16 text-right text-gray-600">{b.label}</div>
            <div className="flex-1 h-3 bg-white rounded overflow-hidden">
              {b.count > 0 && (
                <div
                  className={`h-full ${b.label === data.dominantBucket ? "bg-emerald-500" : "bg-emerald-300"}`}
                  style={{ width: `${(b.count / maxCount) * 100}%` }}
                />
              )}
            </div>
            <div className="w-8 text-right font-bold">{b.count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyInitiativeRateCard() {
  const { data } = useQuery<{
    days: number
    stats: { proposed: number; assigned: number; total: number }
    initiativeRate: number
    topProposer: { kidName: string; avatar: string; count: number } | null
    level: "high_initiative" | "good_initiative" | "moderate" | "low" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/initiative-rate?days=90"],
  })
  if (!data || data.stats.total === 0) return null

  const LEVEL_BG: Record<string, string> = {
    high_initiative: "from-violet-50 to-purple-50 border-violet-500",
    good_initiative: "from-emerald-50 to-green-50 border-emerald-400",
    moderate: "from-blue-50 to-sky-50 border-blue-300",
    low: "from-amber-50 to-yellow-50 border-amber-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🚀 家庭主動性</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-violet-600">{data.stats.proposed}</div>
          <div className="text-[10px] text-gray-500">小孩自提</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-blue-600">{data.stats.assigned}</div>
          <div className="text-[10px] text-gray-500">家長派</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-emerald-600">{data.initiativeRate}%</div>
          <div className="text-[10px] text-gray-500">主動率</div>
        </div>
      </div>

      {data.topProposer && (
        <div className="bg-white/40 rounded p-2 text-center text-xs">
          🥇 最主動：{data.topProposer.avatar} {data.topProposer.kidName}（{data.topProposer.count}{" "}
          個）
        </div>
      )}
    </div>
  )
}

function FamilyWeekendVsWeekdayCard() {
  const { data } = useQuery<{
    days: number
    weekend: { tasks: number; tasksPerDay: number; spent: number; days: number }
    weekday: { tasks: number; tasksPerDay: number; spent: number; days: number }
    pattern: "weekend_warriors" | "weekday_grinders" | "balanced" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/weekend-vs-weekday?days=60"],
  })
  if (!data || data.weekend.tasks + data.weekday.tasks === 0) return null

  const PATTERN_BG: Record<string, string> = {
    weekend_warriors: "from-violet-50 to-purple-50 border-violet-400",
    weekday_grinders: "from-blue-50 to-cyan-50 border-blue-400",
    balanced: "from-emerald-50 to-green-50 border-emerald-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${PATTERN_BG[data.pattern]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">📆 週末 vs 平日（60 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-1">🏠 週末</div>
          <div className="text-lg font-bold">{data.weekend.tasks} 任務</div>
          <div className="text-[10px] text-gray-500">
            日均 {data.weekend.tasksPerDay} · 花 ${data.weekend.spent}
          </div>
        </div>
        <div className="bg-white rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-1">💼 平日</div>
          <div className="text-lg font-bold">{data.weekday.tasks} 任務</div>
          <div className="text-[10px] text-gray-500">
            日均 {data.weekday.tasksPerDay} · 花 ${data.weekday.spent}
          </div>
        </div>
      </div>
    </div>
  )
}

function FamilyIncomeVsSpendingCard() {
  const { data } = useQuery<{
    days: number
    income: number
    spent: number
    given: number
    totalOut: number
    balance: number
    ratio: number
    level: "saver" | "balanced" | "spender" | "overspending" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/income-vs-spending?days=30"],
  })
  if (!data) return null
  if (data.income === 0 && data.totalOut === 0) return null

  const LEVEL_BG: Record<string, string> = {
    saver: "from-emerald-50 to-green-50 border-emerald-500",
    balanced: "from-blue-50 to-sky-50 border-blue-300",
    spender: "from-amber-50 to-yellow-50 border-amber-400",
    overspending: "from-rose-50 to-red-50 border-rose-500",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">⚖️ 收入 vs 花用（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-emerald-600">${data.income}</div>
          <div className="text-[10px] text-gray-500">收入</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-rose-500">${data.totalOut}</div>
          <div className="text-[10px] text-gray-500">花用</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div
            className={`text-xl font-bold ${data.balance >= 0 ? "text-blue-600" : "text-red-600"}`}
          >
            {data.balance >= 0 ? "+" : ""}${data.balance}
          </div>
          <div className="text-[10px] text-gray-500">結餘</div>
        </div>
      </div>

      {data.income > 0 && (
        <div className="bg-white/40 rounded p-2">
          <div className="text-[10px] text-gray-600 mb-1">花用占收入比例 {data.ratio}%</div>
          <div className="h-2 bg-white rounded overflow-hidden">
            <div
              className={`h-full ${data.ratio > 100 ? "bg-rose-500" : data.ratio > 60 ? "bg-amber-500" : data.ratio > 30 ? "bg-blue-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(data.ratio, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function FamilyJarsCurrentCard() {
  const { data } = useQuery<{
    jars: {
      spend: {
        total: number
        ratio: number
        topKid: { kidName: string; balance: number; avatar: string } | null
      }
      save: {
        total: number
        ratio: number
        topKid: { kidName: string; balance: number; avatar: string } | null
      }
      give: {
        total: number
        ratio: number
        topKid: { kidName: string; balance: number; avatar: string } | null
      }
    }
    total: number
    health: "healthy" | "ok" | "unhealthy" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/jars-current-balance"],
  })
  if (!data || data.total === 0) return null

  const HEALTH_BG: Record<string, string> = {
    healthy: "from-emerald-50 to-green-50 border-emerald-400",
    ok: "from-blue-50 to-sky-50 border-blue-300",
    unhealthy: "from-amber-50 to-orange-50 border-amber-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  const items = [
    { key: "spend", label: "🛒 花用罐", color: "bg-rose-500", data: data.jars.spend },
    { key: "save", label: "💎 儲蓄罐", color: "bg-emerald-500", data: data.jars.save },
    { key: "give", label: "💝 捐贈罐", color: "bg-violet-500", data: data.jars.give },
  ]

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${HEALTH_BG[data.health]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🏺 全家三罐 ${data.total}</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="flex h-3 rounded-full overflow-hidden mb-3 bg-white/50">
        {items.map((it) => (
          <div
            key={it.key}
            className={it.color}
            style={{ width: `${it.data.ratio}%` }}
            title={`${it.label}: ${it.data.ratio}%`}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.key} className="bg-white/80 rounded-lg p-2 flex items-center gap-2">
            <div className="w-24 text-xs">{it.label}</div>
            <div className="flex-1">
              <div className="text-sm font-bold">${it.data.total}</div>
              <div className="text-[10px] text-gray-500">{it.data.ratio}%</div>
            </div>
            {it.data.topKid && (
              <div className="text-right text-[10px] text-gray-600">
                <div>
                  🥇 {it.data.topKid.avatar} {it.data.topKid.kidName}
                </div>
                <div>${it.data.topKid.balance}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyGoalsCompletionRateCard() {
  const { data } = useQuery<{
    stats: { active: number; completed: number; abandoned: number; total: number }
    completionRate: number
    avgCompletionDays: number
    avgCompletedAmount: number
    avgActiveAmount: number
    level: "excellent" | "good" | "fair" | "needs_work" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/goals-completion-rate"],
  })
  if (!data || data.stats.total === 0) return null

  const LEVEL_BG: Record<string, string> = {
    excellent: "from-yellow-50 to-amber-50 border-yellow-500",
    good: "from-emerald-50 to-green-50 border-emerald-400",
    fair: "from-sky-50 to-blue-50 border-sky-300",
    needs_work: "from-amber-50 to-orange-50 border-amber-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🎯 家庭目標達成率</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-emerald-600">{data.stats.completed}</div>
          <div className="text-[10px] text-gray-500">已達成</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-blue-600">{data.stats.active}</div>
          <div className="text-[10px] text-gray-500">進行中</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-gray-500">{data.stats.abandoned}</div>
          <div className="text-[10px] text-gray-500">已放棄</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-violet-600">{data.completionRate}%</div>
          <div className="text-[10px] text-gray-500">達成率</div>
        </div>
      </div>

      {data.avgCompletionDays > 0 && (
        <div className="mt-2 text-[11px] text-gray-600 bg-white/40 rounded p-1.5">
          平均達成 {data.avgCompletionDays} 天 · 已達成平均 ${data.avgCompletedAmount} · 進行中平均
          ${data.avgActiveAmount}
        </div>
      )}
    </div>
  )
}

function FamilySpendingDailyCard() {
  const { data } = useQuery<{
    daily: Array<{ date: string; weekday: string; spent: number; given: number; total: number }>
    summary: {
      days: number
      totalSpent: number
      totalGiven: number
      totalAll: number
      avgPerDay: number
      recent7Avg: number
    }
    trend: "spiking" | "rising" | "stable" | "declining" | "no_data"
    alert: boolean
    message: string
  }>({
    queryKey: ["/api/family/spending-daily?days=30"],
  })
  if (!data || data.summary.totalAll === 0) return null

  const max = Math.max(...data.daily.map((d) => d.total), 1)

  const TREND_BG: Record<string, string> = {
    spiking: "from-rose-50 to-red-50 border-rose-500",
    rising: "from-amber-50 to-orange-50 border-amber-300",
    stable: "from-blue-50 to-sky-50 border-blue-300",
    declining: "from-emerald-50 to-green-50 border-emerald-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${TREND_BG[data.trend]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">
        💸 家庭花用線（30 天）
        {data.alert && <span className="text-rose-600 text-sm">🚨 警示</span>}
      </h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          總花 ${data.summary.totalSpent} + 總捐 ${data.summary.totalGiven} = $
          {data.summary.totalAll} · 最近 7 天平均 ${data.summary.recent7Avg}/天
        </div>
      </div>

      <div className="flex items-end gap-0.5 h-20 bg-white/40 rounded p-2">
        {data.daily.map((d) => {
          const h = (d.total / max) * 100
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-end"
              title={`${d.date}: $${d.total}`}
            >
              <div
                className="w-full bg-gradient-to-t from-rose-400 to-pink-500 rounded-t"
                style={{ height: `${Math.max(h, 2)}%` }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyTimeOfDayCard() {
  const { data } = useQuery<{
    days: number
    slotsLabeled: Record<string, { label: string; count: number }>
    total: number
    dominantSlot: "morning" | "afternoon" | "evening" | "late" | null
    message: string
  }>({
    queryKey: ["/api/family/time-of-day?days=30"],
  })
  if (!data || data.total === 0) return null

  const max = Math.max(...Object.values(data.slotsLabeled).map((s) => s.count), 1)

  const order: Array<keyof typeof data.slotsLabeled> = ["morning", "afternoon", "evening", "late"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🕐 家庭活躍時段（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1">
        {order.map((k) => {
          const slot = data.slotsLabeled[k]
          const ratio = (slot.count / max) * 100
          const isDom = data.dominantSlot === k
          return (
            <div key={k} className="flex items-center gap-2">
              <div className="w-24 text-xs">{slot.label}</div>
              <div className="flex-1 h-4 bg-white rounded overflow-hidden">
                <div
                  className={`h-full ${isDom ? "bg-indigo-600" : "bg-indigo-400"}`}
                  style={{ width: `${Math.max(ratio, 2)}%` }}
                />
              </div>
              <div className="w-8 text-right text-xs font-bold">{slot.count}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyActivityStreakCard() {
  const { data } = useQuery<{
    currentStreak: number
    longestStreak: number
    activeDaysCount: number
    lookback: number
    activeRatio: number
    level: "legendary" | "great" | "good" | "starting" | "inactive"
    message: string
  }>({
    queryKey: ["/api/family/activity-streak"],
  })
  if (!data) return null
  if (data.longestStreak === 0) return null

  const LEVEL_BG: Record<string, string> = {
    legendary: "from-purple-50 to-pink-50 border-purple-500",
    great: "from-orange-50 to-red-50 border-orange-400",
    good: "from-emerald-50 to-green-50 border-emerald-300",
    starting: "from-sky-50 to-blue-50 border-sky-300",
    inactive: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🔥 家庭 streak</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-sm">{data.message}</div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-orange-600">{data.currentStreak}</div>
          <div className="text-[10px] text-gray-500">當前連續天數</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-violet-600">{data.longestStreak}</div>
          <div className="text-[10px] text-gray-500">歷史最長</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-blue-600">{data.activeRatio}%</div>
          <div className="text-[10px] text-gray-500">{data.lookback} 天活躍率</div>
        </div>
      </div>
    </div>
  )
}

function FamilyTaskCadenceCard() {
  const { data } = useQuery<{
    byWeekday: Record<string, number>
    summary: {
      totalCreated: number
      avgPerDay: number
      busiestDate: string | null
      busiestCount: number
      consecutiveDryDays: number
      favWeekday: string | null
    }
    cadenceLevel: "very_active" | "active" | "occasional" | "rare" | "none"
    message: string
  }>({
    queryKey: ["/api/family/task-creation-cadence?days=30"],
  })
  if (!data) return null
  if (data.summary.totalCreated === 0) return null

  const LEVEL_BG: Record<string, string> = {
    very_active: "from-emerald-50 to-green-50 border-emerald-400",
    active: "from-blue-50 to-sky-50 border-blue-300",
    occasional: "from-amber-50 to-yellow-50 border-amber-300",
    rare: "from-rose-50 to-red-50 border-rose-300",
    none: "from-gray-50 to-slate-50 border-gray-300",
  }

  const WEEKDAY_LABELS: Record<string, string> = {
    Mon: "週一",
    Tue: "週二",
    Wed: "週三",
    Thu: "週四",
    Fri: "週五",
    Sat: "週六",
    Sun: "週日",
  }
  const maxWd = Math.max(...Object.values(data.byWeekday), 1)

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.cadenceLevel]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">📅 派任務節奏（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          總計派 {data.summary.totalCreated} 個 · 平均 {data.summary.avgPerDay}/天
          {data.summary.favWeekday && ` · 最常派：${WEEKDAY_LABELS[data.summary.favWeekday]}`}
        </div>
      </div>

      <div className="bg-white/40 rounded-lg p-2">
        <div className="text-[10px] text-gray-500 mb-1">星期分佈</div>
        <div className="flex items-end gap-1.5 h-16">
          {Object.entries(data.byWeekday).map(([wd, count]) => (
            <div key={wd} className="flex-1 flex flex-col items-center justify-end">
              <div className="text-[9px] text-gray-600">{count}</div>
              <div
                className="w-full bg-purple-500 rounded-t"
                style={{ height: `${Math.max((count / maxWd) * 100, 4)}%` }}
              />
              <div className="text-[9px] text-gray-500 mt-1">
                {WEEKDAY_LABELS[wd]?.slice(1) ?? wd}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FamilyKidsLastActivityCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      lastTaskTitle: string | null
      latestType: "task" | "checkin" | "spending" | null
      latestAt: string | null
      daysSince: number | null
      attentionLevel: "ok" | "watch" | "alert" | "never"
      summary: string
    }>
    summary: { totalKids: number; alertCount: number; watchCount: number; okCount: number }
    message: string
  }>({
    queryKey: ["/api/family/kids-last-activity"],
  })
  if (!data || data.summary.totalKids === 0) return null

  const ROW_BG: Record<string, string> = {
    ok: "bg-emerald-50 border-emerald-200",
    watch: "bg-amber-50 border-amber-300",
    alert: "bg-rose-50 border-rose-400",
    never: "bg-gray-50 border-gray-300",
  }

  const TYPE_EMOJI: Record<string, string> = {
    task: "📋",
    checkin: "✅",
    spending: "🛒",
  }

  // 顯示策略：alert/watch 排前 + ok 排後（家長最先看到需要關注的）
  const sorted = [...data.kids].sort((a, b) => {
    const order = { alert: 0, watch: 1, never: 2, ok: 3 }
    return order[a.attentionLevel] - order[b.attentionLevel]
  })

  return (
    <div className="mb-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⏰ 最後活動追蹤</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {sorted.map((k) => (
          <div
            key={k.kidId}
            className={`flex items-center gap-2 rounded-lg p-2 border ${ROW_BG[k.attentionLevel]}`}
          >
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[11px] text-gray-600 truncate">
                {k.latestType && TYPE_EMOJI[k.latestType]} {k.summary}
                {k.lastTaskTitle && k.latestType === "task" && (
                  <span className="text-gray-500"> · 最後任務：{k.lastTaskTitle}</span>
                )}
              </div>
            </div>
            {k.daysSince !== null && (
              <div className="text-xs font-bold text-gray-700 whitespace-nowrap">
                {k.daysSince === 0 ? "今天" : `${k.daysSince}d`}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilySavingsRetentionCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      lifetimeEarned: number
      retentionRatio: number
      level: "super_saver" | "good_saver" | "spender" | "heavy_spender" | "no_data"
      levelLabel: string
    }>
    summary: {
      totalKids: number
      kidsWithData: number
      avgRetention: number
      topSaver: { kidName: string; retentionRatio: number } | null
    }
    familyLevel: "super_saver" | "good_saver" | "spender" | "heavy_spender" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/savings-retention"],
  })
  if (!data) return null
  if (data.summary.kidsWithData === 0) return null

  const FAMILY_BG: Record<string, string> = {
    super_saver: "from-yellow-50 to-amber-50 border-yellow-400",
    good_saver: "from-emerald-50 to-green-50 border-emerald-300",
    spender: "from-blue-50 to-sky-50 border-blue-300",
    heavy_spender: "from-rose-50 to-red-50 border-rose-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  const LEVEL_COLOR: Record<string, string> = {
    super_saver: "bg-yellow-400 text-yellow-900",
    good_saver: "bg-emerald-400 text-emerald-900",
    spender: "bg-blue-400 text-white",
    heavy_spender: "bg-rose-400 text-white",
    no_data: "bg-gray-300 text-gray-700",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${FAMILY_BG[data.familyLevel]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">💎 儲蓄留存率</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        {data.summary.topSaver && (
          <div className="text-gray-600 mt-1">
            👑 留存王：{data.summary.topSaver.kidName}（{data.summary.topSaver.retentionRatio}%）
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {data.kids.map((k) => (
          <div key={k.kidId} className="flex items-center gap-2 bg-white/80 rounded-lg p-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">累計 ${k.lifetimeEarned}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{k.retentionRatio}%</div>
              <div
                className={`text-[10px] px-1.5 py-0.5 rounded ${LEVEL_COLOR[k.level]} inline-block`}
              >
                {k.levelLabel}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyMultiMonthTrendCard() {
  const { data } = useQuery<{
    months: Array<{
      month: string
      tasks: number
      reward: number
      spent: number
      checkinDays: number
    }>
    summary: {
      totalTasks: number
      totalReward: number
      peakMonth: string | null
      peakTasks: number
    }
    trend: "growing" | "declining" | "steady" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/multi-month-trend?months=12"],
  })
  if (!data) return null
  if (data.summary.totalTasks === 0) return null

  const maxTasks = Math.max(...data.months.map((m) => m.tasks), 1)

  const TREND_BG: Record<string, string> = {
    growing: "from-emerald-50 to-green-50 border-emerald-300",
    declining: "from-amber-50 to-orange-50 border-amber-300",
    steady: "from-sky-50 to-blue-50 border-sky-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${TREND_BG[data.trend]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">📈 過去 12 個月趨勢</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        {data.summary.peakMonth && (
          <div className="text-gray-600 mt-1">
            高峰：{data.summary.peakMonth}（{data.summary.peakTasks} 個任務） · 累計{" "}
            {data.summary.totalTasks} 個 / ${data.summary.totalReward}
          </div>
        )}
      </div>

      <div className="flex items-end gap-1 h-24 bg-white/40 rounded p-2">
        {data.months.map((m) => {
          const h = (m.tasks / maxTasks) * 100
          return (
            <div
              key={m.month}
              className="flex-1 flex flex-col items-center justify-end"
              title={`${m.month}: ${m.tasks} 個任務 / $${m.reward}`}
            >
              <div className="text-[9px] text-gray-500">{m.tasks}</div>
              <div
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${Math.max(h, 2)}%` }}
              />
              <div className="text-[9px] text-gray-500 mt-1">{m.month.slice(5)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyDailyRecapCard() {
  const { data } = useQuery<{
    days: Array<{
      date: string
      weekday: string
      tasks: number
      checkins: number
      spent: number
      given: number
      reward: number
      hasActivity: boolean
    }>
    summary: {
      totalDays: number
      activeDays: number
      activeRatio: number
      totalTasks: number
      totalReward: number
    }
    message: string
  }>({
    queryKey: ["/api/family/daily-recap?days=7"],
  })
  if (!data) return null

  const maxTasks = Math.max(...data.days.map((d) => d.tasks), 1)

  return (
    <div className="mb-4 rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-blue-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📅 一週日報</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message} · 活躍 {data.summary.activeDays}/{data.summary.totalDays} 天 · 完成{" "}
        {data.summary.totalTasks} 個任務（${data.summary.totalReward}）
      </div>

      <div className="space-y-1">
        {data.days.map((d) => {
          const isToday = d.date === new Date().toISOString().slice(0, 10)
          return (
            <div
              key={d.date}
              className={`flex items-center gap-2 text-xs ${isToday ? "font-bold" : ""}`}
            >
              <div className="w-16 text-gray-500">
                {d.date.slice(5)} ({d.weekday})
              </div>
              <div className="flex-1 h-4 bg-white rounded relative overflow-hidden">
                {d.tasks > 0 && (
                  <div
                    className="h-full bg-emerald-400"
                    style={{ width: `${(d.tasks / maxTasks) * 100}%` }}
                    title={`${d.tasks} 個任務`}
                  />
                )}
              </div>
              <div className="w-20 text-right text-gray-600">
                {d.hasActivity ? (
                  <span>
                    {d.tasks > 0 && `📋${d.tasks}`} {d.checkins > 0 && `✅${d.checkins}`}
                  </span>
                ) : (
                  <span className="text-gray-300">無</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyStoryCard() {
  const { data } = useQuery<{
    month: string
    paragraphs: string[]
    stats: { totalTasks: number; totalReward: number; totalSpent: number; totalGiven: number }
    characters: { topPerformer: string | null }
  }>({
    queryKey: ["/api/family/family-story"],
  })
  if (!data) return null

  const copy = async () => {
    const text = `📖 ${data.month} 家庭故事\n\n${data.paragraphs.join("\n\n")}`
    try {
      await navigator.clipboard.writeText(text)
      alert("已複製到剪貼簿、可分享囉！")
    } catch {
      alert("複製失敗、請手動複製")
    }
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2">📖 {data.month} 家庭故事</h3>
        <button
          onClick={copy}
          className="text-xs px-2 py-1 bg-violet-600 text-white rounded hover:bg-violet-700"
        >
          📋 複製分享
        </button>
      </div>

      <div className="space-y-2 bg-white/70 rounded-lg p-3">
        {data.paragraphs.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed">
            {p}
          </p>
        ))}
      </div>
    </div>
  )
}

function FamilyWeeklySummaryCard() {
  const { data } = useQuery<{
    thisWeek: {
      tasksApproved: number
      totalReward: number
      totalSpent: number
      checkins: number
      newWishes: number
    }
    lastWeek: {
      tasksApproved: number
      totalReward: number
      totalSpent: number
      checkins: number
      newWishes: number
    }
    deltas: Record<string, { abs: number; pct: number | null; arrow: "↑" | "↓" | "→" }>
    highlights: string[]
  }>({
    queryKey: ["/api/family/weekly-summary"],
  })
  if (!data) return null

  const ARROW_COLOR: Record<string, string> = {
    "↑": "text-emerald-600",
    "↓": "text-red-500",
    "→": "text-gray-400",
  }

  const metrics: Array<{ key: keyof typeof data.thisWeek; label: string; emoji: string }> = [
    { key: "tasksApproved", label: "任務完成", emoji: "✅" },
    { key: "totalReward", label: "入帳", emoji: "💰" },
    { key: "totalSpent", label: "花費", emoji: "🛒" },
    { key: "checkins", label: "打卡", emoji: "📅" },
    { key: "newWishes", label: "新願望", emoji: "🎁" },
  ]

  return (
    <div className="mb-4 rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 shadow">
      <h3 className="font-bold mb-3 flex items-center gap-2">📊 本週 vs 上週</h3>

      {data.highlights.length > 0 && (
        <div className="bg-white/70 rounded-lg p-2 mb-3 space-y-1">
          {data.highlights.map((h, i) => (
            <div key={i} className="text-sm">
              {h}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5">
        {metrics.map((m) => {
          const t = data.thisWeek[m.key]
          const l = data.lastWeek[m.key]
          const d = data.deltas[m.key]
          return (
            <div key={m.key} className="bg-white rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500">
                {m.emoji} {m.label}
              </div>
              <div className="text-lg font-bold">{t}</div>
              <div className={`text-xs ${ARROW_COLOR[d?.arrow ?? "→"]}`}>
                {d?.arrow} {d?.abs > 0 ? "+" : ""}
                {d?.abs}
                {d?.pct !== null && d?.pct !== undefined ? ` (${d.pct}%)` : ""}
              </div>
              <div className="text-[10px] text-gray-400">上週 {l}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FamilyLifetimeCard() {
  const { data } = useQuery<{
    stats: {
      tasksApproved: number
      totalReward: number
      totalSpent: number
      totalGiven: number
      totalSaved: number
      checkinDays: number
      uniqueCategories: number
      wishesPromoted: number
      goalsCompleted: number
    }
    familyDays: number | null
    level: "newborn" | "growing" | "established" | "legendary"
    message: string
  }>({
    queryKey: ["/api/family/lifetime-stats"],
    queryFn: async () => {
      const res = await fetch("/api/family/lifetime-stats", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.stats.tasksApproved === 0) return null

  const LEVEL_BG: Record<string, string> = {
    newborn: "from-gray-50 to-slate-50 border-gray-300",
    growing: "from-blue-50 to-cyan-50 border-blue-300",
    established: "from-emerald-50 to-green-50 border-emerald-400",
    legendary: "from-purple-50 to-pink-50 border-purple-500",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-4 shadow`}
    >
      <h3 className="font-bold mb-3 flex items-center gap-2">🏛️ 家庭一路走來</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-3 text-center font-medium text-sm">
        {data.message}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-emerald-700">{data.stats.tasksApproved}</div>
          <div className="text-xs text-gray-500">完成任務</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-blue-700">${data.stats.totalReward}</div>
          <div className="text-xs text-gray-500">總獎勵</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-pink-700">${data.stats.totalGiven}</div>
          <div className="text-xs text-gray-500">總捐贈</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-amber-700">{data.stats.checkinDays}</div>
          <div className="text-xs text-gray-500">打卡天數</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-violet-700">{data.stats.goalsCompleted}</div>
          <div className="text-xs text-gray-500">完成目標</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-indigo-700">{data.familyDays ?? 0}</div>
          <div className="text-xs text-gray-500">家庭天數</div>
        </div>
      </div>
    </div>
  )
}

function FamilyHealthDashboard() {
  const { data } = useQuery<{
    overallScore: number
    healthLevel: "excellent" | "good" | "moderate" | "needs_attention"
    message: string
    dimensions: Array<{ key: string; name: string; score: number; detail: string }>
  }>({
    queryKey: ["/api/family/health-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/family/health-dashboard", { credentials: "include" })
      return res.json()
    },
  })
  if (!data) return null

  const LEVEL_COLOR: Record<string, string> = {
    excellent: "from-emerald-50 to-green-50 border-emerald-400",
    good: "from-blue-50 to-sky-50 border-blue-300",
    moderate: "from-amber-50 to-yellow-50 border-amber-300",
    needs_attention: "from-rose-50 to-red-50 border-rose-400",
  }

  function scoreColor(s: number) {
    if (s >= 80) return "bg-emerald-500"
    if (s >= 60) return "bg-blue-500"
    if (s >= 40) return "bg-amber-500"
    return "bg-rose-500"
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_COLOR[data.healthLevel]} p-4 shadow`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2">💖 家庭健康指數</h3>
        <div className="text-right">
          <div className="text-3xl font-bold">{data.overallScore}</div>
          <div className="text-xs opacity-70">/ 100</div>
        </div>
      </div>

      <div className="bg-white/70 rounded-lg p-2 mb-3 text-sm font-medium text-center">
        {data.message}
      </div>

      <div className="space-y-2">
        {data.dimensions.map((d) => (
          <div key={d.key} className="bg-white/70 rounded p-2">
            <div className="flex items-center justify-between mb-1 text-sm">
              <span className="font-medium">{d.name}</span>
              <span className="font-bold">{d.score} / 100</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-1">
              <div className={`h-full ${scoreColor(d.score)}`} style={{ width: `${d.score}%` }} />
            </div>
            <div className="text-xs text-gray-600">{d.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyMoodToday() {
  const { data } = useQuery<{
    totalKids: number
    checkinCount: number
    avgScore: number
    atmosphere: string
    atmosphereEmoji: string
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      mood: string | null
      note: string | null
      score: number | null
      checkedIn: boolean
    }>
  }>({
    queryKey: ["/api/family/family-mood-today"],
    queryFn: async () => {
      const res = await fetch("/api/family/family-mood-today", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.totalKids === 0) return null

  const bg =
    data.checkinCount === 0
      ? "from-gray-50 to-slate-50 border-gray-300"
      : data.avgScore >= 4.5
        ? "from-yellow-50 to-orange-50 border-yellow-400"
        : data.avgScore >= 3.5
          ? "from-emerald-50 to-green-50 border-emerald-300"
          : data.avgScore >= 2.5
            ? "from-blue-50 to-sky-50 border-blue-300"
            : data.avgScore >= 1.5
              ? "from-indigo-50 to-purple-50 border-indigo-300"
              : "from-rose-50 to-red-50 border-rose-400"

  return (
    <div className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${bg} p-4 shadow`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2">{data.atmosphereEmoji} 今日家庭氛圍</h3>
        <span className="text-xs text-gray-500">
          {data.checkinCount} / {data.totalKids} 打卡
        </span>
      </div>

      {/* 大字氛圍評語 */}
      <div className="text-center bg-white/70 rounded-lg p-3 mb-3">
        <div className="text-3xl mb-1">{data.atmosphereEmoji}</div>
        <div className="text-base font-bold">{data.atmosphere}</div>
        {data.checkinCount > 0 && (
          <div className="text-xs text-gray-500 mt-1">平均分數 {data.avgScore.toFixed(2)} / 5</div>
        )}
      </div>

      {/* 每個 kid 的 mood */}
      <div className="flex flex-wrap gap-1">
        {data.kids.map((k) => (
          <div
            key={k.kidId}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
              k.checkedIn ? "bg-white" : "bg-gray-200 opacity-60"
            }`}
          >
            <span className="text-base">{k.avatar}</span>
            <span className="font-bold">{k.kidName}</span>
            {k.checkedIn ? <span>{k.mood}</span> : <span className="text-gray-500">未打卡</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function FamilyTodaySummary() {
  const { data } = useQuery<{
    date: string
    stats: {
      approvedToday: number
      rewardToday: number
      spentToday: number
      givenToday: number
      pendingTasks: number
      checkinsToday: number
      newWishes: number
    }
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      tasks: number
      spent: number
      checkedIn: boolean
    }>
    highlights: string[]
    shareableText: string
  }>({
    queryKey: ["/api/family/today-summary"],
    queryFn: async () => {
      const res = await fetch("/api/family/today-summary", { credentials: "include" })
      return res.json()
    },
  })
  if (!data) return null

  const hasActivity =
    data.stats.approvedToday > 0 ||
    data.stats.pendingTasks > 0 ||
    data.stats.checkinsToday > 0 ||
    data.kids.length > 0
  if (!hasActivity) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 shadow">
      <h3 className="font-bold text-violet-900 mb-3 flex items-center gap-2">🌅 今日重點</h3>

      {/* 4 個快速 KPI */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-xl font-bold text-emerald-700">{data.stats.approvedToday}</div>
          <div className="text-xs text-gray-500">已完成</div>
        </div>
        <div
          className={`rounded-lg p-2 text-center shadow-sm ${
            data.stats.pendingTasks > 0 ? "bg-amber-100" : "bg-white"
          }`}
        >
          <div className="text-xl font-bold text-amber-700">{data.stats.pendingTasks}</div>
          <div className="text-xs text-gray-500">待審核</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-xl font-bold text-blue-700">${data.stats.rewardToday}</div>
          <div className="text-xs text-gray-500">今日獎勵</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-xl font-bold text-pink-700">{data.stats.checkinsToday}</div>
          <div className="text-xs text-gray-500">打卡數</div>
        </div>
      </div>

      {/* highlights */}
      {data.highlights.length > 0 && (
        <div className="space-y-1 mb-3">
          {data.highlights.map((h, i) => (
            <div
              key={i}
              className="text-sm bg-white/70 rounded px-2 py-1 text-violet-800 font-medium"
            >
              {h}
            </div>
          ))}
        </div>
      )}

      {/* 每個 kid 今日狀態 */}
      {data.kids.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {data.kids.map((k) => (
            <div
              key={k.kidId}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                k.checkedIn ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              <span className="text-base">{k.avatar}</span>
              <span className="font-bold">{k.kidName}</span>
              <span>{k.tasks} 任務</span>
              {k.checkedIn && <span>✓</span>}
            </div>
          ))}
        </div>
      )}

      {/* 分享按鈕：複製今日總結到剪貼簿 */}
      {data.shareableText && (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(data.shareableText)
              alert("✅ 今日總結已複製到剪貼簿、可以貼到 LINE 分享了")
            } catch {
              alert("複製失敗、請手動複製")
            }
          }}
          className="mt-3 w-full text-center text-sm py-2 rounded bg-violet-500 text-white hover:bg-violet-600 transition-colors"
        >
          📋 複製今日總結（分享到 LINE）
        </button>
      )}
    </div>
  )
}

function FamilySearch() {
  const [q, setQ] = useState("")
  const [debounced, setDebounced] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const { data } = useQuery<{
    results: Array<{
      kind: "task" | "goal" | "comment" | "wish"
      id: number
      kidId: number
      kidName: string
      label: string
      sub: string
      at: string | null
    }>
  }>({
    queryKey: ["/api/family/search", debounced],
    queryFn: async () => {
      if (!debounced) return { results: [] }
      const res = await fetch(`/api/family/search?q=${encodeURIComponent(debounced)}`, {
        credentials: "include",
      })
      return res.json()
    },
    enabled: debounced.length > 0,
  })

  const KIND_ICON: Record<string, string> = {
    task: "📋",
    goal: "🎯",
    comment: "💬",
    wish: "✨",
  }
  const KIND_NAME: Record<string, string> = {
    task: "任務",
    goal: "目標",
    comment: "留言",
    wish: "願望",
  }

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🔍</span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋任務 / 目標 / 留言 / 願望..."
          className="flex-1 px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
          >
            清除
          </button>
        )}
      </div>
      {debounced && data && (
        <div className="max-h-80 overflow-y-auto space-y-1">
          {data.results.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-3">沒有找到相關項目</div>
          ) : (
            data.results.map((r) => (
              <div
                key={`${r.kind}-${r.id}`}
                className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 border border-gray-100"
              >
                <span className="text-lg">{KIND_ICON[r.kind]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.label}</div>
                  <div className="text-xs text-gray-500">
                    {KIND_NAME[r.kind]}・{r.kidName}・{r.sub}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function ParentReminders() {
  interface Reminders {
    submitted: Array<{
      id: number
      title: string
      emoji: string | null
      reward: number
      kidName: string
      avatar: string
    }>
    overdue: Array<{
      id: number
      title: string
      emoji: string | null
      dueDate: string
      daysOverdue: number
      kidName: string
      avatar: string
    }>
    nearGoal: Array<{
      id: number
      name: string
      emoji: string | null
      target: number
      current: number
      progress: number
      kidName: string
      avatar: string
    }>
    inactiveKids: Array<{ id: number; displayName: string; avatar: string; lastActivity: string }>
  }
  const { data } = useQuery<Reminders>({
    queryKey: ["/api/family/parent-reminders"],
    staleTime: 30_000,
  })
  if (!data) return null
  const totalReminders =
    data.submitted.length + data.overdue.length + data.nearGoal.length + data.inactiveKids.length
  if (totalReminders === 0) return null

  return (
    <Card className="border-orange-300 bg-gradient-to-r from-orange-50 to-yellow-50">
      <CardHeader className="py-3 px-3 sm:px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-xl">📌</span>
          家長提醒中心
          <span className="text-xs bg-orange-200 text-orange-900 px-2 py-0.5 rounded-full font-bold">
            {totalReminders}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-3 sm:px-4 space-y-2">
        {data.overdue.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded p-2">
            <div className="text-xs font-bold text-red-700 mb-1">
              ⏰ 逾期任務（{data.overdue.length}）
            </div>
            <div className="space-y-0.5">
              {data.overdue.slice(0, 5).map((t) => (
                <div key={t.id} className="text-xs flex items-center gap-1.5">
                  <span>{t.avatar}</span>
                  <span className="font-medium">{t.kidName}</span>
                  <span className="text-gray-400">·</span>
                  <span>
                    {t.emoji ?? "📋"} {t.title}
                  </span>
                  <span className="ml-auto text-red-600 font-bold">遲 {t.daysOverdue} 天</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {data.submitted.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2">
            <div className="text-xs font-bold text-amber-700">
              📝 待審任務 {data.submitted.length} 個（滑下方審核）
            </div>
          </div>
        )}
        {data.nearGoal.length > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded p-2">
            <div className="text-xs font-bold text-purple-700 mb-1">🎯 即將達成目標（≥80%）</div>
            <div className="space-y-0.5">
              {data.nearGoal.slice(0, 5).map((g) => (
                <div key={g.id} className="text-xs flex items-center gap-1.5">
                  <span>{g.avatar}</span>
                  <span className="font-medium">{g.kidName}</span>
                  <span className="text-gray-400">·</span>
                  <span>
                    {g.emoji ?? "🎯"} {g.name}
                  </span>
                  <span className="ml-auto text-purple-700 font-bold">{g.progress}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {data.inactiveKids.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded p-2">
            <div className="text-xs font-bold text-gray-600 mb-1">💤 7 天以上無活動的小孩</div>
            <div className="flex flex-wrap gap-1.5">
              {data.inactiveKids.map((k) => (
                <div
                  key={k.id}
                  className="text-xs inline-flex items-center gap-1 bg-white border border-gray-300 px-2 py-0.5 rounded-full"
                >
                  <span>{k.avatar}</span>
                  <span>{k.displayName}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">考慮派點任務或留言鼓勵</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FamilyMonthlySummary({ kids }: { kids: Kid[] }) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })

  interface KidSummary {
    kidId: number
    displayName: string
    avatar: string
    color: string
    approvedCount: number
    approvedSum: number
    rejectedCount: number
    hardCount: number
    weightedScore: number
    totalSpent: number
    spendJarOut: number
    saveJarOut: number
    giveJarOut: number
    goalCompletedCount: number
    badgeCount: number
  }
  const { data } = useQuery<{
    month: string
    kids: KidSummary[]
    grandTotal: {
      approvedCount: number
      approvedSum: number
      rejectedCount: number
      hardCount: number
      weightedScore: number
      totalSpent: number
      giveJarOut: number
      goalCompletedCount: number
      badgeCount: number
    }
  }>({
    queryKey: [`/api/family/family-monthly-summary?month=${month}`],
    staleTime: 60_000,
  })

  // 產 6 個月選項（含本月）
  const monthOptions = useMemo(() => {
    const opts: string[] = []
    const d = new Date()
    for (let i = 0; i < 6; i++) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
      opts.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`)
    }
    return opts
  }, [])

  const _ = kids // unused; FamilyTrendChart 共用 kids data

  if (!data) return null

  return (
    <Card className="border-emerald-200">
      <CardHeader className="py-3 px-3 sm:px-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">📊</span>
            全家月度總結
          </CardTitle>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-3 sm:px-4 space-y-2">
        {/* Grand totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500">總任務</div>
            <div className="font-bold text-emerald-700">
              {data.grandTotal.approvedCount}
              {data.grandTotal.hardCount > 0 && (
                <span className="text-[10px] text-rose-500 ml-1">
                  ⭐⭐⭐×{data.grandTotal.hardCount}
                </span>
              )}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500">總給付</div>
            <div className="font-bold text-amber-700">
              {formatMoney(data.grandTotal.approvedSum)}
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500">捐獻</div>
            <div className="font-bold text-rose-700">{formatMoney(data.grandTotal.giveJarOut)}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500">達成目標</div>
            <div className="font-bold text-purple-700">
              {data.grandTotal.goalCompletedCount}
              <span className="text-[10px] text-amber-500 ml-1">
                🏅×{data.grandTotal.badgeCount}
              </span>
            </div>
          </div>
        </div>

        {/* 各小孩明細 */}
        {data.kids.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] text-gray-500 mt-2">各小孩本月戰績（按積分排序）</div>
            {data.kids.map((k, i) => {
              const c = COLOR_TOKENS[k.color] ?? COLOR_TOKENS.blue
              return (
                <div
                  key={k.kidId}
                  className={`flex items-center gap-2 p-2 rounded border ${c.bg} ${c.border} flex-wrap`}
                >
                  <span className="text-xl">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  "}
                  </span>
                  <span className="text-xl">{k.avatar}</span>
                  <div className="flex-1 min-w-[100px]">
                    <div className={`text-sm font-bold ${c.text}`}>{k.displayName}</div>
                    <div className="text-[10px] text-gray-500 flex flex-wrap gap-1">
                      <span>📋 {k.approvedCount}</span>
                      {k.hardCount > 0 && (
                        <span className="text-rose-600">⭐⭐⭐ ×{k.hardCount}</span>
                      )}
                      {k.rejectedCount > 0 && (
                        <span className="text-orange-600">❌ {k.rejectedCount}</span>
                      )}
                      {k.goalCompletedCount > 0 && <span>🎯 ×{k.goalCompletedCount}</span>}
                      {k.badgeCount > 0 && <span>🏅 ×{k.badgeCount}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-bold ${c.text}`}>
                      {formatMoney(k.approvedSum)}
                    </div>
                    <div className="text-[10px] text-rose-600">積分 {k.weightedScore}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FamilyTrendChart() {
  interface TrendSeries {
    kidId: number
    displayName: string
    avatar: string
    color: string
    values: number[]
  }
  const { data } = useQuery<{ days: number; dates: string[]; series: TrendSeries[] }>({
    queryKey: ["/api/family/jars-trend-multi?days=30"],
    staleTime: 60_000,
  })
  if (!data || data.series.length === 0) return null

  // 組 recharts data：每個 date 一個 row、含每個 kid 的 column
  const chartData = data.dates.map((date, i) => {
    const row: Record<string, string | number> = { date: date.slice(5) } // MM-DD
    data.series.forEach((s) => {
      row[s.displayName] = s.values[i]
    })
    return row
  })

  const LINE_COLORS: Record<string, string> = {
    blue: "#3b82f6",
    pink: "#ec4899",
    green: "#10b981",
    amber: "#f59e0b",
    purple: "#a855f7",
    cyan: "#06b6d4",
  }

  return (
    <Card className="border-indigo-200">
      <CardHeader className="py-3 px-3 sm:px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-xl">📈</span>
          全家儲蓄趨勢
        </CardTitle>
        <CardDescription>過去 {data.days} 天每天的總餘額（收入 - 花費）</CardDescription>
      </CardHeader>
      <CardContent className="py-2 px-1 sm:px-2 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              interval={Math.floor(data.dates.length / 6)}
            />
            <YAxis tick={{ fontSize: 10 }} width={48} />
            <RTooltip
              formatter={(v: number) => "$" + Number(v).toLocaleString()}
              contentStyle={{ fontSize: "12px" }}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            {data.series.map((s) => (
              <Line
                key={s.kidId}
                type="monotone"
                dataKey={s.displayName}
                stroke={LINE_COLORS[s.color] ?? "#6b7280"}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function KidCard({
  kid,
  onEdit,
  onDelete,
  onEncourage,
}: {
  kid: Kid
  onEdit: () => void
  onDelete: () => void
  onEncourage: () => void
}) {
  const c = COLOR_TOKENS[kid.color] ?? COLOR_TOKENS.blue
  const { data: dashboardData } = useQuery<{ jar: Jar }>({
    queryKey: [`/api/family/dashboard?kidId=${kid.id}`],
  })
  const jar = dashboardData?.jar

  return (
    <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
      <Card className={`${c.bg} ${c.border}`}>
        <CardContent className="py-3 px-3">
          <div className="flex items-start gap-2">
            <div className="text-3xl">{kid.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className={`font-bold ${c.text}`}>{kid.displayName}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                💸 {kid.spendRatio}% · 🐷 {kid.saveRatio}% · ❤️ {kid.giveRatio}%
              </div>
              {jar && (
                <div className="mt-1 grid grid-cols-3 gap-1 text-[10px]">
                  <div className="bg-red-50 rounded px-1 py-0.5">
                    <div className="text-red-700">花</div>
                    <div className="font-mono">{formatMoney(jar.spendBalance)}</div>
                  </div>
                  <div className="bg-green-50 rounded px-1 py-0.5">
                    <div className="text-green-700">存</div>
                    <div className="font-mono">{formatMoney(jar.saveBalance)}</div>
                  </div>
                  <div className="bg-blue-50 rounded px-1 py-0.5">
                    <div className="text-blue-700">捐</div>
                    <div className="font-mono">{formatMoney(jar.giveBalance)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1 mt-2 justify-end flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-pink-700 hover:bg-pink-50"
              onClick={onEncourage}
              title="寫一句鼓勵的話"
            >
              💌 鼓勵
            </Button>
            <Link href={`/family/kid/${kid.id}`}>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                <PiggyBank className="h-3 w-3 mr-1" />
                看罐子
              </Button>
            </Link>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onEdit}>
              編輯
            </Button>
            <button
              type="button"
              onClick={onDelete}
              className="text-red-500 hover:bg-red-50 rounded px-1"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function KidDialog({
  mode,
  kid,
  onClose,
  onSuccess,
}: {
  mode: "create" | "edit"
  kid?: Kid
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(kid?.displayName ?? "")
  const [avatar, setAvatar] = useState(kid?.avatar ?? "🧒")
  const [color, setColor] = useState(kid?.color ?? "blue")
  const [pin, setPin] = useState("")
  const [spendRatio, setSpendRatio] = useState(kid?.spendRatio ?? 70)
  const [saveRatio, setSaveRatio] = useState(kid?.saveRatio ?? 20)
  const [giveRatio, setGiveRatio] = useState(kid?.giveRatio ?? 10)
  const [monthlyAllowance, setMonthlyAllowance] = useState(
    kid?.monthlyAllowance ? String(parseFloat(kid.monthlyAllowance)) : "0"
  )

  const total = spendRatio + saveRatio + giveRatio
  const ratioOK = total === 100
  const canSubmit = name.trim() && ratioOK && (mode === "edit" || /^\d{4}$/.test(pin))

  const mut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        displayName: name.trim(),
        avatar,
        color,
        spendRatio,
        saveRatio,
        giveRatio,
        monthlyAllowance: parseFloat(monthlyAllowance) || 0,
      }
      if (mode === "create") body.pin = pin
      return mode === "create"
        ? apiRequest("POST", "/api/family/kids", body)
        : apiRequest("PUT", `/api/family/kids/${kid?.id}`, body)
    },
    onSuccess: () => {
      toast({ title: mode === "create" ? "✅ 已新增" : "✅ 已更新" })
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新增小孩" : "編輯小孩"}</DialogTitle>
          <DialogDescription>名字、頭像、PIN（4 碼）、三罐比例</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>名字 *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="小明" />
          </div>
          <div>
            <Label>頭像</Label>
            <div className="grid grid-cols-6 gap-1 mt-1">
              {AVATAR_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`text-2xl p-1 rounded ${
                    avatar === a ? "bg-indigo-100 ring-2 ring-indigo-500" : "hover:bg-gray-100"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>主題色</Label>
            <div className="flex gap-1 mt-1">
              {Object.keys(COLOR_TOKENS).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded ${COLOR_TOKENS[c].bg} ${
                    color === c ? "ring-2 ring-indigo-500" : ""
                  } ${COLOR_TOKENS[c].border} border-2`}
                />
              ))}
            </div>
          </div>
          {mode === "create" && (
            <div>
              <Label>PIN（4 位數字、登入用）*</Label>
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="例：1234"
                inputMode="numeric"
                maxLength={4}
              />
            </div>
          )}
          <div>
            <Label>三罐分配（總和 100）</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <div>
                <div className="text-xs text-red-700 mb-1">💸 花用</div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={spendRatio}
                  onChange={(e) => setSpendRatio(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <div className="text-xs text-green-700 mb-1">🐷 儲蓄</div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={saveRatio}
                  onChange={(e) => setSaveRatio(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <div className="text-xs text-blue-700 mb-1">❤️ 捐獻</div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={giveRatio}
                  onChange={(e) => setGiveRatio(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <p className={`text-xs mt-1 ${ratioOK ? "text-green-700" : "text-red-700"}`}>
              總和 {total}（需為 100）
            </p>
          </div>
          <div className="border-t pt-3">
            <Label className="flex items-center gap-2">
              📅 每月自動零用金
              <span className="text-[10px] text-gray-400 font-normal">（每月 1 號自動入帳）</span>
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-500">$</span>
              <Input
                type="number"
                value={monthlyAllowance}
                onChange={(e) => setMonthlyAllowance(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              填 0 = 關閉自動入帳、需手動派任務獎勵
              {parseFloat(monthlyAllowance) > 0 && kid?.lastAllowanceMonth && (
                <span className="text-green-700 ml-1">· 上次發放：{kid.lastAllowanceMonth}</span>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!canSubmit || mut.isPending}>
            {mode === "create" ? "新增" : "儲存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const TASK_EMOJI = ["📋", "🧹", "🍽️", "🛏️", "🚿", "📚", "🐕", "🌱", "♻️", "🛒", "✏️", "🎵"]

function TaskDialog({
  kids,
  onClose,
  onSuccess,
}: {
  kids: Kid[]
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [emoji, setEmoji] = useState("📋")
  const [rewardAmount, setRewardAmount] = useState("50")
  const [kidId, setKidId] = useState<string>(kids[0]?.id?.toString() ?? "")
  const [notes, setNotes] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [recurringInterval, setRecurringInterval] = useState<"none" | "weekly" | "monthly">("none")
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium")
  const [category, setCategory] = useState<
    "housework" | "study" | "self_care" | "kindness" | "other"
  >("other")

  const mut = useMutation({
    mutationFn: () => {
      const body = {
        title: title.trim(),
        emoji,
        rewardAmount: parseFloat(rewardAmount),
        notes: notes.trim() || null,
        dueDate: dueDate || null,
        recurringInterval: recurringInterval === "none" ? null : recurringInterval,
        difficulty,
        category,
      }
      if (kidId === "__broadcast__") {
        return apiRequest<{ count: number }>("POST", "/api/family/tasks/broadcast", body)
      }
      return apiRequest("POST", "/api/family/tasks", {
        ...body,
        kidId: kidId === "__public__" || !kidId ? null : parseInt(kidId),
      })
    },
    onSuccess: (r: unknown) => {
      const broadcastCount = kidId === "__broadcast__" ? (r as { count?: number })?.count : null
      toast({
        title: broadcastCount ? `📣 已派給 ${broadcastCount} 個小孩` : "✅ 已派任務",
      })
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const canSubmit = title.trim() && parseFloat(rewardAmount) > 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>派任務</DialogTitle>
          <DialogDescription>小孩完成後可標「完成」、家長 approve 後自動入帳</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>任務名稱 *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="洗碗 / 倒垃圾 / 整理房間"
            />
          </div>
          <div>
            <Label>圖示</Label>
            <div className="grid grid-cols-6 gap-1 mt-1">
              {TASK_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-xl p-1 rounded ${
                    emoji === e ? "bg-indigo-100 ring-2 ring-indigo-500" : "hover:bg-gray-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>獎勵金額 *</Label>
            <Input
              type="number"
              value={rewardAmount}
              onChange={(e) => setRewardAmount(e.target.value)}
              placeholder="50"
            />
          </div>
          <div>
            <Label>難度</Label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {[
                {
                  v: "easy" as const,
                  label: "⭐ 簡單",
                  active: "bg-green-100 border-green-400 text-green-700 font-medium",
                },
                {
                  v: "medium" as const,
                  label: "⭐⭐ 普通",
                  active: "bg-amber-100 border-amber-400 text-amber-700 font-medium",
                },
                {
                  v: "hard" as const,
                  label: "⭐⭐⭐ 挑戰",
                  active: "bg-rose-100 border-rose-400 text-rose-700 font-medium",
                },
              ].map((d) => (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => setDifficulty(d.v)}
                  className={`text-xs py-1.5 rounded border ${
                    difficulty === d.v ? d.active : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              排行榜按難度加權積分：簡單 ×1、普通 ×2、挑戰 ×3
            </div>
          </div>
          <div>
            <Label>分類</Label>
            <div className="grid grid-cols-5 gap-1 mt-1">
              {(
                [
                  { v: "housework", label: "🧹 家事" },
                  { v: "study", label: "📚 學習" },
                  { v: "self_care", label: "🪥 照顧" },
                  { v: "kindness", label: "❤️ 善行" },
                  { v: "other", label: "📋 其他" },
                ] as const
              ).map((c) => (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => setCategory(c.v)}
                  className={`text-[10px] py-1.5 rounded border ${
                    category === c.v
                      ? "bg-indigo-100 border-indigo-400 text-indigo-700 font-medium"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>指派給</Label>
            <Select value={kidId} onValueChange={setKidId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇小孩" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__broadcast__">📣 派給全家（每人各一份）</SelectItem>
                <SelectItem value="__public__">🙋 公開任務（誰先做誰拿）</SelectItem>
                {kids.map((k) => (
                  <SelectItem key={k.id} value={k.id.toString()}>
                    {k.avatar} {k.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-[10px] text-gray-400 mt-1">選「公開」→ 小孩端可主動搶任務</div>
          </div>
          <div>
            <Label>截止日</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <p className="text-[10px] text-gray-400 mt-0.5">逾期會標紅、自動排前面</p>
          </div>
          <div>
            <Label>重複</Label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {(["none", "weekly", "monthly"] as const).map((v) => {
                const label = { none: "🔄 不重複", weekly: "📅 每週", monthly: "📆 每月" }[v]
                const active = recurringInterval === v
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRecurringInterval(v)}
                    className={`p-2 rounded border-2 text-xs ${
                      active ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {recurringInterval === "none"
                ? "approve 後不會再產出新任務"
                : `approve 後自動產出下一筆（${recurringInterval === "weekly" ? "7" : "30"} 天後）`}
            </p>
          </div>
          <div>
            <Label>備註</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="（選填）"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!canSubmit || mut.isPending}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            派任務
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface Template {
  title: string
  emoji: string
  rewardAmount: number
}

function ParentPinDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast()
  const [pin, setPin] = useState("")
  const mut = useMutation({
    mutationFn: () => apiRequest<{ ok: boolean }>("POST", "/api/family/parent-pin/verify", { pin }),
    onSuccess: (r) => {
      if (r.ok) {
        setPinVerified()
        onSuccess()
      }
    },
    onError: (e: Error) => {
      toast({ title: "PIN 不正確", description: e.message, variant: "destructive" })
      setPin("")
    },
  })
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            家長 PIN
          </DialogTitle>
          <DialogDescription>需家長驗證才能執行此動作（30 分鐘有效）</DialogDescription>
        </DialogHeader>
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="4-8 位數字"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && pin.length >= 4) mut.mutate()
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => mut.mutate()} disabled={pin.length < 4 || mut.isPending}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            驗證
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BatchTaskDialog({
  kids,
  onClose,
  onSuccess,
}: {
  kids: Kid[]
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"daily" | "seasonal" | "custom" | "ai">("daily")
  const [aiGoal, setAiGoal] = useState("")
  const [aiAge, setAiAge] = useState("6-12 歲")
  const [aiSuggestions, setAiSuggestions] = useState<Template[]>([])
  const aiMut = useMutation({
    mutationFn: () =>
      apiRequest<{ tasks: Array<{ title: string; emoji: string; rewardAmount: number }> }>(
        "POST",
        "/api/family/ai-suggest-tasks",
        { learningGoal: aiGoal, ageRange: aiAge, count: 5 }
      ),
    onSuccess: (r) => {
      const tpls: Template[] = r.tasks.map((t) => ({
        title: t.title,
        emoji: t.emoji,
        rewardAmount: t.rewardAmount,
      }))
      setAiSuggestions(tpls)
      setSelectedTpls(new Set(tpls.map((t) => t.title)))
      toast({ title: `🤖 AI 已建議 ${tpls.length} 個任務` })
    },
    onError: (e: Error) =>
      toast({ title: "AI 建議失敗", description: e.message, variant: "destructive" }),
  })
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/family/task-templates"],
  })
  const currentMonth = new Date().getMonth() + 1
  const { data: seasonal } = useQuery<{
    month: number
    festival: string
    emoji: string
    tasks: Template[]
  }>({
    queryKey: [`/api/family/task-templates/seasonal?month=${currentMonth}`],
  })
  // 家長自訂範本
  interface CustomTpl {
    id: number
    title: string
    emoji: string | null
    defaultReward: string
    defaultDifficulty: string
  }
  const { data: customTpls = [] } = useQuery<CustomTpl[]>({
    queryKey: ["/api/family/custom-templates"],
  })
  const customAsTemplates: Template[] = customTpls.map((c) => ({
    title: c.title,
    emoji: c.emoji ?? "📋",
    rewardAmount: parseFloat(c.defaultReward),
  }))
  const deleteCustomMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/family/custom-templates/${id}`),
    onSuccess: () => {
      toast({ title: "已刪除自訂範本" })
      queryClient.invalidateQueries({ queryKey: ["/api/family/custom-templates"] })
    },
  })
  const addCustomMut = useMutation({
    mutationFn: (vars: { title: string; emoji: string; reward: number }) =>
      apiRequest("POST", "/api/family/custom-templates", {
        title: vars.title,
        emoji: vars.emoji,
        defaultReward: vars.reward,
      }),
    onSuccess: () => {
      toast({ title: "✅ 已加入自訂範本" })
      queryClient.invalidateQueries({ queryKey: ["/api/family/custom-templates"] })
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const displayTemplates =
    activeTab === "seasonal"
      ? (seasonal?.tasks ?? [])
      : activeTab === "custom"
        ? customAsTemplates
        : activeTab === "ai"
          ? aiSuggestions
          : templates
  const [selectedTpls, setSelectedTpls] = useState<Set<string>>(new Set())
  const [selectedKids, setSelectedKids] = useState<Set<number>>(new Set(kids.map((k) => k.id)))

  const toggleTpl = (title: string) => {
    setSelectedTpls((s) => {
      const next = new Set(s)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }
  const toggleKid = (id: number) => {
    setSelectedKids((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const mut = useMutation({
    mutationFn: () =>
      apiRequest<{ count: number }>("POST", "/api/family/tasks/batch", {
        kidIds: Array.from(selectedKids),
        tasks: displayTemplates.filter((t) => selectedTpls.has(t.title)),
      }),
    onSuccess: (r) => {
      toast({ title: `✅ 派出 ${r.count} 個任務` })
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } })
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const totalTasks = selectedKids.size * selectedTpls.size
  const totalAmount =
    Array.from(selectedTpls).reduce((s, title) => {
      const t = displayTemplates.find((x) => x.title === title)
      return s + (t?.rewardAmount ?? 0)
    }, 0) * selectedKids.size

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>一鍵派任務</DialogTitle>
          <DialogDescription>選範本 + 選小孩、一次派完所有組合</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <div className="flex gap-1 mb-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("daily")
                  setSelectedTpls(new Set())
                }}
                className={`flex-1 py-1.5 rounded text-sm font-medium border-2 ${
                  activeTab === "daily" ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                }`}
              >
                📋 日常任務
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("seasonal")
                  setSelectedTpls(new Set())
                }}
                className={`flex-1 py-1.5 rounded text-sm font-medium border-2 ${
                  activeTab === "seasonal" ? "border-amber-500 bg-amber-50" : "border-gray-200"
                }`}
              >
                {seasonal?.emoji ?? "🎉"} 節慶
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("custom")
                  setSelectedTpls(new Set())
                }}
                className={`flex-1 py-1.5 rounded text-sm font-medium border-2 ${
                  activeTab === "custom" ? "border-rose-500 bg-rose-50" : "border-gray-200"
                }`}
              >
                💖 自訂
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("ai")
                  setSelectedTpls(new Set())
                }}
                className={`flex-1 py-1.5 rounded text-sm font-medium border-2 ${
                  activeTab === "ai" ? "border-cyan-500 bg-cyan-50" : "border-gray-200"
                }`}
              >
                🤖 AI
              </button>
            </div>
            {activeTab === "ai" && (
              <div className="mb-2 bg-cyan-50 border border-cyan-200 rounded p-2 space-y-1">
                <div className="text-[11px] text-cyan-700">
                  告訴 AI 想培養什麼、它幫你出 5 個適齡任務
                </div>
                <div className="flex gap-1">
                  <Input
                    value={aiAge}
                    onChange={(e) => setAiAge(e.target.value)}
                    placeholder="6-12 歲"
                    className="w-24 h-7 text-xs"
                  />
                  <Input
                    value={aiGoal}
                    onChange={(e) => setAiGoal(e.target.value)}
                    placeholder="例：培養理財觀念 / 學會做家事 / 練字"
                    className="flex-1 h-7 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!aiGoal.trim() || aiMut.isPending}
                    onClick={() => aiMut.mutate()}
                    className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700"
                  >
                    {aiMut.isPending ? "..." : "🤖 建議"}
                  </Button>
                </div>
              </div>
            )}
            {activeTab === "custom" && (
              <div className="mb-2 bg-rose-50 border border-rose-200 rounded p-2 space-y-1">
                <div className="text-[11px] text-rose-700">
                  我家常用任務、點下方加入收藏（最常用的擺前面）
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs"
                  onClick={() => {
                    const title = window.prompt("自訂任務名稱（如「掃地」）：", "")
                    if (!title?.trim()) return
                    const emoji = window.prompt("圖示 emoji（如 🧹）：", "📋") || "📋"
                    const r = window.prompt("預設獎勵金額：", "20")
                    const reward = parseFloat(r ?? "0")
                    if (!(reward > 0)) {
                      toast({ title: "請輸入有效金額", variant: "destructive" })
                      return
                    }
                    addCustomMut.mutate({ title: title.trim(), emoji, reward })
                  }}
                >
                  ➕ 新增自訂範本
                </Button>
              </div>
            )}
            {activeTab === "seasonal" && seasonal && (
              <div className="text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2">
                <b>
                  {seasonal.emoji} {seasonal.festival}
                </b>
                （{seasonal.month} 月）
              </div>
            )}
            <Label className="font-bold">選任務範本（複選）</Label>
            <div className="space-y-1 mt-1 max-h-64 overflow-y-auto">
              {displayTemplates.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-3">
                  {activeTab === "custom"
                    ? "還沒有自訂範本、點上方「新增自訂範本」開始"
                    : "本月無節慶任務"}
                </div>
              ) : (
                displayTemplates.map((t) => {
                  // 自訂 tab 找對應 id（刪除用）
                  const customMatch =
                    activeTab === "custom" ? customTpls.find((c) => c.title === t.title) : null
                  return (
                    <div
                      key={t.title}
                      className={`flex items-center gap-1 ${activeTab === "custom" ? "" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTpl(t.title)}
                        className={`flex-1 text-left flex items-center gap-2 p-2 rounded border ${
                          selectedTpls.has(t.title)
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200"
                        }`}
                      >
                        <span className="text-xl">{t.emoji}</span>
                        <span className="flex-1">{t.title}</span>
                        <span className="text-xs font-mono text-gray-500">${t.rewardAmount}</span>
                        {selectedTpls.has(t.title) && (
                          <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                        )}
                      </button>
                      {customMatch && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`刪除自訂範本「${customMatch.title}」？`)) {
                              deleteCustomMut.mutate(customMatch.id)
                            }
                          }}
                          className="text-red-400 hover:text-red-600 px-1.5 py-1"
                          title="刪除自訂範本"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div>
            <Label className="font-bold">👨‍👩‍👧 派給</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {kids.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => toggleKid(k.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full border-2 ${
                    selectedKids.has(k.id) ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                  }`}
                >
                  <span className="text-lg">{k.avatar}</span>
                  <span className="text-sm">{k.displayName}</span>
                </button>
              ))}
            </div>
          </div>

          {totalTasks > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
              將派出 <b>{totalTasks}</b> 個任務（{selectedKids.size} 小孩 × {selectedTpls.size}{" "}
              範本）、
              <br />
              若全部完成獎勵總額 <b>${totalAmount.toLocaleString()}</b>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={totalTasks === 0 || mut.isPending}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Zap className="h-4 w-4 mr-1" />
            派出 {totalTasks} 個任務
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
