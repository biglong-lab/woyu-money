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
import { useState, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Link } from "wouter"
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
        }
      }>("POST", `/api/family/tasks/${vars.id}/approve`, {
        parentFeedback: vars.parentFeedback,
      }),
    onSuccess: (r) => {
      const bonus = r.bonus
      if (bonus?.triggered) {
        toast({
          title: `🎁✨ 驚喜獎勵！ ${formatMoney(bonus.baseAmount)} +${formatMoney(bonus.bonusAmount)} = ${formatMoney(bonus.totalAmount)}`,
          description:
            r.newBadges.length > 0
              ? `🎉 解鎖徽章：${r.newBadges.join(", ")}`
              : "小孩好棒、額外給 +50%",
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
    mutationFn: () =>
      apiRequest("POST", "/api/family/tasks", {
        title: title.trim(),
        emoji,
        rewardAmount: parseFloat(rewardAmount),
        kidId: kidId ? parseInt(kidId) : null,
        notes: notes.trim() || null,
        dueDate: dueDate || null,
        recurringInterval: recurringInterval === "none" ? null : recurringInterval,
        difficulty,
        category,
      }),
    onSuccess: () => {
      toast({ title: "✅ 已派任務" })
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const canSubmit = title.trim() && parseFloat(rewardAmount) > 0 && kidId

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
            <Label>指派給 *</Label>
            <Select value={kidId} onValueChange={setKidId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇小孩" />
              </SelectTrigger>
              <SelectContent>
                {kids.map((k) => (
                  <SelectItem key={k.id} value={k.id.toString()}>
                    {k.avatar} {k.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
