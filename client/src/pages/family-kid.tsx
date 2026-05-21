/**
 * 小孩專屬頁（/family/kid/:id）
 *
 * 設計：手機優先、大字、大圖示、亮色、即時回饋
 * 流程：PIN 登入 → 三罐 dashboard → 任務 / 目標 / 徽章
 *
 * 給 6-12 歲使用：
 *  - PIN 4 位數鍵盤（不用密碼）
 *  - 罐子用 emoji + 彩色 + framer-motion 動畫
 *  - 完成任務 confetti + haptic
 *  - 達成目標撒花
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useParams, Link } from "wouter"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Plus,
  Target,
  Award,
  ShoppingBag,
  Trash2,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useInstallPrompt } from "@/hooks/use-install-prompt"

interface Kid {
  id: number
  displayName: string
  avatar: string
  color: string
  spendRatio: number
  saveRatio: number
  giveRatio: number
}

interface Jar {
  kidId: number
  spendBalance: string
  saveBalance: string
  giveBalance: string
  totalReceived: string
  totalSpent: string
}

interface Task {
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

const difficultyStars = (d?: string) => (d === "easy" ? "⭐" : d === "hard" ? "⭐⭐⭐" : "⭐⭐")

const CATEGORY_FILTER: Array<{ v: string; label: string }> = [
  { v: "all", label: "全部" },
  { v: "housework", label: "🧹 家事" },
  { v: "study", label: "📚 學習" },
  { v: "self_care", label: "🪥 照顧" },
  { v: "kindness", label: "❤️ 善行" },
  { v: "other", label: "📋 其他" },
]

interface Goal {
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

interface Badge {
  id: number
  badgeType: string
  title: string
  emoji: string
  earnedAt: string
}

interface Spending {
  id: number
  jar: "spend" | "save" | "give"
  amount: string
  description: string
  emoji: string | null
  spendDate: string
  recipient?: string | null
  reflection?: string | null
}

interface MonthlyReport {
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

interface KidDashboard {
  scope: "kid"
  kid: Kid
  jar: Jar
  tasks: Task[]
  goals: Goal[]
  badges: Badge[]
  streak: number
}

function formatMoney(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v
  return "$" + Math.round(n).toLocaleString()
}

function vibrate(pattern: number | number[] = 50) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    // 強制 cast、TS type 不接 array、但 spec / 瀏覽器都支援
    ;(navigator.vibrate as (p: number | number[]) => boolean)(pattern)
  }
}

export default function FamilyKidPage() {
  const params = useParams<{ id: string }>()
  const kidId = parseInt(params.id ?? "0", 10)
  useDocumentTitle("我的記帳")
  const { toast } = useToast()
  const [authed, setAuthed] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)

  // 先要 PIN 才看資料
  if (!authed) {
    return <PinLogin kidId={kidId} onSuccess={() => setAuthed(true)} />
  }

  return (
    <KidDashboard
      kidId={kidId}
      onShowAddGoal={() => setShowAddGoal(true)}
      showAddGoal={showAddGoal}
      onCloseAddGoal={() => setShowAddGoal(false)}
      toast={toast}
    />
  )
}

function PinLogin({ kidId, onSuccess }: { kidId: number; onSuccess: () => void }) {
  const { toast } = useToast()
  const [pin, setPin] = useState("")

  const loginMut = useMutation({
    mutationFn: (p: string) => apiRequest<Kid>("POST", "/api/family/kids/pin-login", { pin: p }),
    onSuccess: (kid) => {
      if (kid.id !== kidId) {
        toast({ title: "PIN 是別人的", description: "請確認自己的 PIN", variant: "destructive" })
        setPin("")
        return
      }
      vibrate(40)
      onSuccess()
    },
    onError: () => {
      toast({ title: "PIN 不正確", variant: "destructive" })
      setPin("")
      vibrate([50, 50, 50])
    },
  })

  const handleKey = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    vibrate(20)
    if (next.length === 4) {
      setTimeout(() => loginMut.mutate(next), 150)
    }
  }
  const handleBack = () => {
    setPin((p) => p.slice(0, -1))
    vibrate(20)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 flex flex-col items-center justify-center p-4">
      <div className="text-6xl mb-2">🧒</div>
      <h1 className="text-2xl font-bold mb-1">輸入 PIN</h1>
      <p className="text-sm text-gray-500 mb-6">4 位數字</p>

      <div className="flex gap-3 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-2xl font-bold ${
              pin.length > i
                ? "bg-indigo-500 border-indigo-500 text-white"
                : "border-gray-300 bg-white"
            }`}
          >
            {pin.length > i ? "•" : ""}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-xs">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <motion.button
            key={d}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleKey(d)}
            className="w-16 h-16 rounded-full bg-white shadow text-2xl font-bold hover:bg-indigo-50"
          >
            {d}
          </motion.button>
        ))}
        <div />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => handleKey("0")}
          className="w-16 h-16 rounded-full bg-white shadow text-2xl font-bold hover:bg-indigo-50"
        >
          0
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleBack}
          className="w-16 h-16 rounded-full bg-gray-100 shadow text-2xl"
        >
          ⌫
        </motion.button>
      </div>

      <Link href="/family">
        <Button variant="ghost" size="sm" className="mt-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          回家庭頁
        </Button>
      </Link>
    </div>
  )
}

function KidDashboard({
  kidId,
  onShowAddGoal,
  showAddGoal,
  onCloseAddGoal,
  toast,
}: {
  kidId: number
  onShowAddGoal: () => void
  showAddGoal: boolean
  onCloseAddGoal: () => void
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
}) {
  const { data } = useQuery<KidDashboard>({
    queryKey: [`/api/family/dashboard?kidId=${kidId}`],
  })
  const { data: spendings = [] } = useQuery<Spending[]>({
    queryKey: [`/api/family/spendings?kidId=${kidId}`],
  })
  const currentMonth = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })()
  const { data: report } = useQuery<MonthlyReport>({
    queryKey: [`/api/family/monthly-report?kidId=${kidId}&month=${currentMonth}`],
  })
  const { data: trend } = useQuery<{
    trend: Array<{ date: string; spend: number; save: number; give: number }>
  }>({
    queryKey: [`/api/family/jars-trend?kidId=${kidId}&days=30`],
  })

  // 無主任務（公開、誰先做誰拿）
  interface PublicTask {
    id: number
    title: string
    emoji: string | null
    rewardAmount: string
    kidId: number | null
    status: string
    difficulty?: string
  }
  const publicQuery = useQuery<PublicTask[]>({
    queryKey: ["/api/family/tasks?status=pending"],
    select: (all: PublicTask[]) => all.filter((t) => t.kidId === null),
  })
  const publicTasks = publicQuery.data ?? []
  const claimMut = useMutation({
    mutationFn: (taskId: number) =>
      apiRequest("POST", `/api/family/tasks/${taskId}/claim`, { kidId }),
    onSuccess: () => {
      toast({ title: "🙋 任務搶到了！" })
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } })
      vibrate([30, 50, 30])
      invalidate()
      queryClient.invalidateQueries({ queryKey: ["/api/family/tasks?status=pending"] })
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })
  const [showSpend, setShowSpend] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [showPropose, setShowPropose] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [commentTask, setCommentTask] = useState<{ id: number; title: string } | null>(null)
  const [showPersonalize, setShowPersonalize] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0] ?? "").includes("/api/family/"),
    })
  }

  const submitMut = useMutation({
    mutationFn: (vars: { taskId: number; proofImageUrl?: string; submissionNote?: string }) =>
      apiRequest("POST", `/api/family/tasks/${vars.taskId}/submit`, {
        proofImageUrl: vars.proofImageUrl,
        submissionNote: vars.submissionNote,
      }),
    onSuccess: () => {
      toast({ title: "✅ 已標完成、等大人確認" })
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
      vibrate([30, 50, 30])
      invalidate()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  // 拍照上傳：用 FormData / 既有 /api/upload/images endpoint
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fd = new FormData()
      fd.append("images", file)
      const resp = await fetch("/api/upload/images", { method: "POST", body: fd })
      if (!resp.ok) throw new Error("上傳失敗")
      const data = (await resp.json()) as { imagePaths: string[] }
      return data.imagePaths?.[0] ?? null
    } catch (e: unknown) {
      toast({
        title: "上傳失敗",
        description: e instanceof Error ? e.message : "請重試",
        variant: "destructive",
      })
      return null
    }
  }

  const deleteSpendingMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/family/spendings/${id}`),
    onSuccess: () => {
      toast({ title: "✅ 已刪除、退回餘額" })
      invalidate()
    },
  })

  const saveToGoalMut = useMutation({
    mutationFn: (vars: { goalId: number; amount: number; completedReflection?: string }) =>
      apiRequest<{ reached: boolean; newBadges: string[] }>(
        "POST",
        `/api/family/goals/${vars.goalId}/save`,
        { amount: vars.amount, completedReflection: vars.completedReflection }
      ),
    onSuccess: (r) => {
      toast({
        title: r.reached ? "🎉 達成目標！" : "✅ 已撥到存錢罐",
        description: r.newBadges.length > 0 ? `解鎖徽章：${r.newBadges.join(", ")}` : undefined,
      })
      if (r.reached) {
        confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 }, ticks: 300 })
        vibrate([100, 50, 100, 50, 100])
      } else {
        vibrate(40)
      }
      invalidate()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  if (!data) {
    return <div className="p-6 text-center text-gray-400">載入中…</div>
  }

  const { kid, jar, tasks, goals, badges } = data
  const allPending = tasks.filter((t) => t.status === "pending")
  const pendingTasks =
    categoryFilter === "all"
      ? allPending
      : allPending.filter((t) => (t.category ?? "other") === categoryFilter)
  const activeGoals = goals.filter((g) => g.status === "active")
  const recentApprovedCount = tasks.filter((t) => t.status === "approved").length
  // 家長有寫回饋的最近 3 筆（approved 或 rejected）
  const recentFeedback = tasks
    .filter((t) => t.parentFeedback && (t.status === "approved" || t.status === "rejected"))
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-pink-50 p-3 sm:p-6 pb-20">
      {/* 標題列 */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/family">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <button
          type="button"
          onClick={() => setShowPersonalize(true)}
          className="text-3xl hover:scale-110 transition-transform"
          title="點頭像換造型"
        >
          {kid.avatar}
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">嗨 {kid.displayName}！</h1>
          <p className="text-xs text-gray-500">
            完成 {recentApprovedCount} 個任務 · {badges.length} 個徽章
          </p>
        </div>
        <InstallChip />
        {data.streak > 0 && (
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="bg-gradient-to-br from-orange-400 to-red-500 rounded-full px-3 py-1.5 text-white font-bold shadow-lg flex items-center gap-1"
            title={`連續 ${data.streak} 天做任務、不要中斷！`}
          >
            <span className="text-lg">🔥</span>
            <span>{data.streak}</span>
            <span className="text-xs opacity-90">天</span>
          </motion.div>
        )}
      </div>

      {/* 家長每日鼓勵卡（有寫才顯示）*/}
      <DailyMessageBanner kidId={kidId} />

      {/* 心情簽到（今日心情）*/}
      <CheckinPrompt kidId={kidId} />

      {/* 本月戰績 hero（有資料才顯示）*/}
      {report && (report.tasks.approvedCount > 0 || report.completedGoals.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 rounded-xl bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500 text-white p-3 shadow-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">✨</span>
            <div className="flex-1">
              <div className="text-xs opacity-90">{report.month} 我做到了</div>
              <div className="text-base font-bold">本月戰績</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="bg-white/20 rounded p-1.5">
              <div className="text-[10px] opacity-90">完成任務</div>
              <div className="font-bold text-base">{report.tasks.approvedCount}</div>
            </div>
            <div className="bg-white/20 rounded p-1.5">
              <div className="text-[10px] opacity-90">賺到</div>
              <div className="font-bold text-base">{formatMoney(report.tasks.approvedSum)}</div>
            </div>
            <div className="bg-white/20 rounded p-1.5">
              <div className="text-[10px] opacity-90">達標</div>
              <div className="font-bold text-base">{report.completedGoals.length}</div>
            </div>
            <div className="bg-white/20 rounded p-1.5">
              <div className="text-[10px] opacity-90">徽章</div>
              <div className="font-bold text-base">{report.badges.length}</div>
            </div>
          </div>
          {report.netGain > 0 && (
            <div className="mt-2 text-[10px] text-center opacity-90">
              💰 淨成長 {formatMoney(report.netGain)}（賺 - 花）
            </div>
          )}
        </motion.div>
      )}

      {/* 三罐（最大、最顯眼） */}
      <div className="grid grid-cols-3 gap-2 mb-1">
        <JarCard
          label="花用"
          emoji="💸"
          balance={jar.spendBalance}
          ratio={kid.spendRatio}
          bg="bg-rose-100"
          text="text-rose-700"
        />
        <JarCard
          label="存錢"
          emoji="🐷"
          balance={jar.saveBalance}
          ratio={kid.saveRatio}
          bg="bg-emerald-100"
          text="text-emerald-700"
        />
        <JarCard
          label="捐獻"
          emoji="❤️"
          balance={jar.giveBalance}
          ratio={kid.giveRatio}
          bg="bg-sky-100"
          text="text-sky-700"
        />
      </div>
      <div className="flex justify-center mb-3">
        <InternalTransferButton kidId={kidId} jar={jar} toast={toast} onSuccess={invalidate} />
      </div>

      {/* 三個大按鈕：花錢 + 提任務 + 送禮 */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Button
          onClick={() => setShowSpend(true)}
          className="h-14 text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 shadow-lg"
        >
          💸 花錢了
        </Button>
        <Button
          onClick={() => setShowPropose(true)}
          className="h-14 text-xs sm:text-sm bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 shadow-lg"
        >
          ✋ 做家事
        </Button>
        <Button
          onClick={() => setShowTransfer(true)}
          className="h-14 text-xs sm:text-sm bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 shadow-lg"
        >
          💝 送禮
        </Button>
      </div>

      {/* 總計小卡 */}
      <Card className="mb-4 border-indigo-200 bg-white">
        <CardContent className="py-3 px-3 flex justify-between items-center text-sm">
          <div>
            <div className="text-xs text-gray-500">累計收到</div>
            <div className="text-lg font-bold text-indigo-700">
              {formatMoney(jar.totalReceived)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">已花</div>
            <div className="text-lg font-bold text-amber-700">{formatMoney(jar.totalSpent)}</div>
          </div>
        </CardContent>
      </Card>

      {/* 無主任務（公開、可搶）*/}
      {publicTasks.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold mb-2 flex items-center gap-2">
            <span className="text-amber-500">🙋</span>
            可搶任務（{publicTasks.length}）
          </h2>
          <div className="space-y-2">
            {publicTasks.map((t) => (
              <motion.div
                key={t.id}
                whileTap={{ scale: 0.98 }}
                className="bg-gradient-to-r from-yellow-50 to-amber-100 border-2 border-amber-300 rounded-lg p-3 flex items-center gap-3 shadow-sm"
              >
                <div className="text-3xl">{t.emoji ?? "📋"}</div>
                <div className="flex-1">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-gray-600">
                    搶到可得 {formatMoney(t.rewardAmount)}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => claimMut.mutate(t.id)}
                  disabled={claimMut.isPending}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  🙋 我要做
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 待完成任務 */}
      <div className="mb-4">
        <h2 className="font-bold mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          我的任務（{pendingTasks.length}
          {categoryFilter !== "all" && ` / ${allPending.length}`}）
        </h2>
        {allPending.length >= 3 && (
          <div className="flex gap-1 mb-2 flex-wrap">
            {CATEGORY_FILTER.map((c) => {
              const count =
                c.v === "all"
                  ? allPending.length
                  : allPending.filter((t) => (t.category ?? "other") === c.v).length
              if (c.v !== "all" && count === 0) return null
              return (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => setCategoryFilter(c.v)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    categoryFilter === c.v
                      ? "bg-indigo-500 text-white border-indigo-500"
                      : "bg-white border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {c.label} {c.v !== "all" && `(${count})`}
                </button>
              )
            })}
          </div>
        )}
        {pendingTasks.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-4 bg-white rounded-lg">
            目前沒有任務、好好放鬆吧 😊
          </div>
        ) : (
          <div className="space-y-2">
            {pendingTasks.map((t) => (
              <motion.div
                key={t.id}
                whileTap={{ scale: 0.98 }}
                animate={
                  t.isOverdue
                    ? {
                        boxShadow: [
                          "0 0 0 0 rgba(239,68,68,0)",
                          "0 0 0 4px rgba(239,68,68,0.3)",
                          "0 0 0 0 rgba(239,68,68,0)",
                        ],
                      }
                    : undefined
                }
                transition={t.isOverdue ? { duration: 1.5, repeat: Infinity } : undefined}
                className={`rounded-lg p-3 flex items-center gap-3 shadow-sm border-2 ${
                  t.isOverdue
                    ? "bg-red-50 border-red-400"
                    : t.isDueSoon
                      ? "bg-amber-50 border-amber-400"
                      : "bg-white border-transparent"
                }`}
              >
                <div className="text-3xl">{t.emoji ?? "📋"}</div>
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-1.5 flex-wrap">
                    {t.title}
                    <span className="text-xs text-amber-500">{difficultyStars(t.difficulty)}</span>
                    {t.isOverdue && (
                      <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">
                        ⚠️ 過期 {t.overdueDays} 天
                      </span>
                    )}
                    {t.isDueSoon && !t.isOverdue && (
                      <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">
                        ⏰ 快到期
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    完成可得 {formatMoney(t.rewardAmount)}
                    {t.dueDate && <span className="ml-2 text-[10px]">截止 {t.dueDate}</span>}
                  </div>
                </div>
                {/* 💬 跟大人聊聊 */}
                <button
                  type="button"
                  onClick={() => setCommentTask({ id: t.id, title: t.title })}
                  className="bg-gray-100 hover:bg-gray-200 rounded p-2 text-base"
                  title="跟大人討論這個任務"
                >
                  💬
                </button>
                {/* 拍照 + 完成 */}
                <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 rounded p-2 inline-flex">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const url = await uploadImage(file)
                      if (url) {
                        submitMut.mutate({ taskId: t.id, proofImageUrl: url })
                      }
                    }}
                  />
                  📷
                </label>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    // 輕量 prompt：可寫描述（跳過直接送）
                    const note = window.prompt("跟大人說你做了什麼？（可跳過）", "")
                    submitMut.mutate({
                      taskId: t.id,
                      submissionNote: note?.trim() || undefined,
                    })
                  }}
                  disabled={submitMut.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  完成！
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 家長最近回饋（有寫才顯示）*/}
      {recentFeedback.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold mb-2 flex items-center gap-2">
            <span className="text-amber-500">💬</span>
            大人的話
          </h2>
          <div className="space-y-2">
            {recentFeedback.map((t) => (
              <div
                key={t.id}
                className={`rounded-lg p-3 text-sm border ${
                  t.status === "approved"
                    ? "bg-green-50 border-green-200"
                    : "bg-orange-50 border-orange-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{t.emoji ?? "📋"}</span>
                  <span className="font-medium flex-1">{t.title}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      t.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {t.status === "approved" ? "✅ 通過" : "🙅 駁回"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCommentTask({ id: t.id, title: t.title })}
                    className="text-base hover:bg-white/50 rounded p-1"
                    title="繼續討論"
                  >
                    💬
                  </button>
                </div>
                <div className="text-gray-700">「{t.parentFeedback}」</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 家庭共同罐 - 小孩可貢獻 */}
      <FamilyPotsContribute kidId={kidId} jar={jar} toast={toast} onAfterContribute={invalidate} />

      {/* 願望清單（想要、未必有錢、培養理財決策力）*/}
      <WishesSection kidId={kidId} toast={toast} onAfterPromote={invalidate} />

      {/* 存錢目標 */}
      <div className="mb-4">
        <h2 className="font-bold mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-purple-500" />
            我想買的（{activeGoals.length}）
          </span>
          <Button size="sm" variant="outline" onClick={onShowAddGoal}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            新目標
          </Button>
        </h2>
        {activeGoals.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-4 bg-white rounded-lg">
            還沒設目標、想存錢買什麼？點右上加一個 🎯
          </div>
        ) : (
          <div className="space-y-2">
            {activeGoals.map((g) => {
              const cur = parseFloat(g.currentAmount)
              const target = parseFloat(g.targetAmount)
              const pct = target > 0 ? Math.min(100, Math.round((cur / target) * 100)) : 0
              const saveBal = parseFloat(jar.saveBalance)
              return (
                <div key={g.id} className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="text-2xl">{g.emoji ?? "🎯"}</div>
                    <div className="flex-1">
                      <div className="font-medium">{g.name}</div>
                      <div className="text-xs text-gray-500">
                        {formatMoney(cur)} / {formatMoney(target)}（{pct}%）
                      </div>
                    </div>
                  </div>
                  {g.reflection && (
                    <div className="text-[11px] text-purple-700 bg-purple-50 rounded px-2 py-1 mb-1.5 italic">
                      💭 「{g.reflection}」
                    </div>
                  )}
                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: "spring", stiffness: 100 }}
                      className="h-full bg-gradient-to-r from-purple-400 to-pink-400"
                    />
                  </div>
                  <div className="flex gap-1">
                    {[10, 50, 100].map((amt) => (
                      <Button
                        key={amt}
                        size="sm"
                        variant="outline"
                        disabled={saveBal < amt || saveToGoalMut.isPending}
                        onClick={() => {
                          // 預判是否達成、達成則跳「達成感言」prompt
                          const current = parseFloat(g.currentAmount)
                          const target = parseFloat(g.targetAmount)
                          const willReach = current + amt >= target
                          let completedReflection: string | undefined
                          if (willReach) {
                            const r = window.prompt(
                              `🎉 即將達成「${g.name}」！\n寫下達成的感言（鼓勵自己、可跳過）：`,
                              ""
                            )
                            completedReflection = r?.trim() || undefined
                          }
                          saveToGoalMut.mutate({
                            goalId: g.id,
                            amount: amt,
                            completedReflection,
                          })
                        }}
                        className="flex-1 text-xs h-8"
                      >
                        存 ${amt}
                      </Button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 我的善行（捐贈追蹤）*/}
      <DonationsSection kidId={kidId} />

      {/* 花錢紀錄 */}
      {spendings.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold mb-2 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-amber-600" />
            最近花錢紀錄（{spendings.length}）
          </h2>
          <div className="space-y-1.5">
            {spendings.slice(0, 10).map((s) => {
              const jarColor =
                s.jar === "spend"
                  ? "text-rose-600"
                  : s.jar === "save"
                    ? "text-emerald-600"
                    : "text-sky-600"
              const jarLabel = s.jar === "spend" ? "💸" : s.jar === "save" ? "🐷" : "❤️"
              return (
                <div
                  key={s.id}
                  className="bg-white rounded-lg p-2.5 flex items-start gap-2 text-sm"
                >
                  <span className="text-xl">{s.emoji ?? "💰"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{s.description}</div>
                    {s.jar === "give" && s.recipient && (
                      <div className="text-[10px] text-sky-700 truncate">
                        ❤️ 捐給：{s.recipient}
                      </div>
                    )}
                    {s.jar === "give" && s.reflection && (
                      <div className="text-[10px] text-gray-500 italic truncate">
                        “{s.reflection}”
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400">
                      {s.spendDate} · {jarLabel}
                    </div>
                  </div>
                  <span className={`font-mono font-bold ${jarColor}`}>
                    -{formatMoney(s.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("刪除這筆？（餘額會退回）")) deleteSpendingMut.mutate(s.id)
                    }}
                    className="text-red-400 hover:bg-red-50 rounded p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 等級徽章（累積分數升 level）*/}
      <KidLevelBadge kidId={kidId} />

      {/* 最近活動時間軸 */}
      <KidActivityTimeline kidId={kidId} />

      {/* 個人最佳紀錄牆 */}
      <KidBestsWall kidId={kidId} />

      {/* 成就牆（含未解鎖徽章 + 進度條）*/}
      <AchievementWall kidId={kidId} />

      {/* 全家排行（看自己 vs 兄弟姊妹）*/}
      <KidLeaderboard kidId={kidId} />

      {/* 本月戰績（月報）*/}
      {report && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowReport((s) => !s)}
            className="w-full bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-3 flex items-center justify-between shadow-sm"
          >
            <span className="font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              📊 本月戰績（{report.month}）
            </span>
            {showReport ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
          {showReport && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg p-3 mt-2 space-y-3 text-sm shadow-sm"
            >
              {/* 三大數字 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center bg-amber-50 rounded p-2">
                  <div className="text-2xl">📋</div>
                  <div className="text-lg font-bold text-amber-700">
                    {report.tasks.approvedCount}
                  </div>
                  <div className="text-[10px] text-gray-500">完成任務</div>
                </div>
                <div className="text-center bg-green-50 rounded p-2">
                  <div className="text-2xl">💰</div>
                  <div className="text-lg font-bold text-green-700">
                    {formatMoney(report.tasks.approvedSum)}
                  </div>
                  <div className="text-[10px] text-gray-500">入帳金額</div>
                </div>
                <div className="text-center bg-rose-50 rounded p-2">
                  <div className="text-2xl">💸</div>
                  <div className="text-lg font-bold text-rose-700">
                    {formatMoney(report.spendings.totalSpent)}
                  </div>
                  <div className="text-[10px] text-gray-500">花了</div>
                </div>
              </div>

              {/* 淨增加 */}
              <div
                className={`rounded p-2 text-center ${
                  report.netGain >= 0 ? "bg-blue-50" : "bg-orange-50"
                }`}
              >
                <div className="text-xs text-gray-500">
                  本月淨{report.netGain >= 0 ? "賺" : "花超"}
                </div>
                <div
                  className={`text-xl font-bold ${
                    report.netGain >= 0 ? "text-blue-700" : "text-orange-700"
                  }`}
                >
                  {report.netGain >= 0 ? "+" : ""}
                  {formatMoney(report.netGain)}
                </div>
                {report.tasks.avgReward > 0 && (
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    平均每個任務 ${report.tasks.avgReward}
                  </div>
                )}
              </div>

              {/* 達成目標 */}
              {report.completedGoals.length > 0 && (
                <div>
                  <div className="font-bold text-xs mb-1">
                    🎯 本月達成目標（{report.completedGoals.length}）
                  </div>
                  <div className="space-y-1">
                    {report.completedGoals.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center gap-2 text-xs bg-purple-50 rounded p-1.5"
                      >
                        <span className="text-lg">{g.emoji ?? "🎯"}</span>
                        <span className="flex-1">{g.name}</span>
                        <span className="font-mono">{formatMoney(g.targetAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 解鎖徽章 */}
              {report.badges.length > 0 && (
                <div>
                  <div className="font-bold text-xs mb-1">
                    🏅 本月解鎖徽章（{report.badges.length}）
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {report.badges.map((b) => (
                      <div
                        key={b.id}
                        className="bg-yellow-50 rounded px-2 py-1 text-xs flex items-center gap-1"
                      >
                        <span className="text-base">{b.emoji}</span>
                        <span>{b.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* 三罐趨勢圖（過去 30 天）*/}
      {trend && trend.trend.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold mb-2 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-600" />
            📈 過去 30 天三罐趨勢
          </h2>
          <div className="bg-white rounded-lg p-2 shadow-sm" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.trend} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 9 }} />
                <RTooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  formatter={(v: number) => "$" + Math.round(v).toLocaleString()}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="spend"
                  name="💸 花用"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="save"
                  name="🐷 存錢"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="give"
                  name="❤️ 捐獻"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 text-center">
            紅 = 花用、綠 = 存錢、藍 = 捐獻
          </p>
        </div>
      )}

      {showAddGoal && (
        <GoalDialog
          kidId={kidId}
          onClose={onCloseAddGoal}
          onSuccess={() => {
            invalidate()
            onCloseAddGoal()
          }}
        />
      )}

      {showSpend && (
        <SpendDialog
          kidId={kidId}
          jar={jar}
          onClose={() => setShowSpend(false)}
          onSuccess={() => {
            invalidate()
            setShowSpend(false)
          }}
        />
      )}

      {showPropose && (
        <ProposeTaskDialog
          kidId={kidId}
          onClose={() => setShowPropose(false)}
          onSuccess={() => {
            invalidate()
            setShowPropose(false)
          }}
          toast={toast}
        />
      )}

      {showTransfer && (
        <TransferDialog
          fromKidId={kidId}
          jar={jar}
          onClose={() => setShowTransfer(false)}
          onSuccess={() => {
            invalidate()
            setShowTransfer(false)
          }}
          toast={toast}
        />
      )}

      {commentTask && (
        <CommentDialog
          taskId={commentTask.id}
          taskTitle={commentTask.title}
          onClose={() => setCommentTask(null)}
        />
      )}

      {showPersonalize && (
        <PersonalizeDialog
          kid={kid}
          onClose={() => setShowPersonalize(false)}
          onSuccess={() => {
            invalidate()
            setShowPersonalize(false)
            vibrate(40)
          }}
          toast={toast}
        />
      )}
    </div>
  )
}

function PersonalizeDialog({
  kid,
  onClose,
  onSuccess,
  toast,
}: {
  kid: Kid
  onClose: () => void
  onSuccess: () => void
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
}) {
  const [avatar, setAvatar] = useState(kid.avatar)
  const [color, setColor] = useState(kid.color)

  const AVATARS = [
    "🧒",
    "👧",
    "👦",
    "🧑",
    "👶",
    "🐱",
    "🐶",
    "🐻",
    "🦊",
    "🐰",
    "🐼",
    "🦁",
    "🐯",
    "🦄",
    "🐸",
    "🐵",
  ]
  const COLORS = [
    { v: "blue", label: "藍", bg: "bg-blue-500" },
    { v: "pink", label: "粉", bg: "bg-pink-500" },
    { v: "green", label: "綠", bg: "bg-green-500" },
    { v: "amber", label: "黃", bg: "bg-amber-500" },
    { v: "purple", label: "紫", bg: "bg-purple-500" },
    { v: "cyan", label: "青", bg: "bg-cyan-500" },
  ]

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/family/kids/${kid.id}/personalize`, { avatar, color }),
    onSuccess: () => {
      toast({ title: "✨ 變身成功！" })
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>✨ 我的造型</DialogTitle>
          <DialogDescription>選你喜歡的頭像和顏色</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>頭像</Label>
            <div className="grid grid-cols-8 gap-1 mt-1">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`text-2xl p-1.5 rounded ${
                    avatar === a ? "bg-indigo-100 ring-2 ring-indigo-500" : "hover:bg-gray-100"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>顏色</Label>
            <div className="grid grid-cols-6 gap-1 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => setColor(c.v)}
                  className={`h-10 rounded flex items-center justify-center text-white font-bold ${c.bg} ${
                    color === c.v ? "ring-2 ring-offset-2 ring-gray-700" : ""
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 rounded p-3 flex items-center gap-3 justify-center">
            <span className="text-xs text-gray-500">預覽：</span>
            <span className="text-4xl">{avatar}</span>
            <span
              className={`px-3 py-1 rounded-full text-white text-sm font-bold ${
                COLORS.find((c) => c.v === color)?.bg ?? "bg-blue-500"
              }`}
            >
              {kid.displayName}
            </span>
          </div>
          <ChangePinSection kidId={kid.id} toast={toast} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={mut.isPending || (avatar === kid.avatar && color === kid.color)}
            onClick={() => mut.mutate()}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            ✨ 變身
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChangePinSection({
  kidId,
  toast,
}: {
  kidId: number
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
}) {
  const [open, setOpen] = useState(false)
  const [oldPin, setOldPin] = useState("")
  const [newPin, setNewPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/family/kids/${kidId}/change-pin`, { oldPin, newPin }),
    onSuccess: () => {
      toast({ title: "🔐 PIN 修改成功" })
      vibrate(40)
      setOpen(false)
      setOldPin("")
      setNewPin("")
      setConfirmPin("")
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const valid =
    /^\d{4}$/.test(oldPin) && /^\d{4}$/.test(newPin) && newPin === confirmPin && oldPin !== newPin

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-xs text-indigo-700 hover:bg-indigo-50 rounded py-1.5 border border-indigo-200 mt-2"
      >
        🔐 修改 PIN
      </button>
    )
  }
  return (
    <div className="mt-2 border-t pt-3 space-y-2 bg-indigo-50 -mx-1 px-3 pb-2 rounded-lg">
      <div className="text-xs font-medium text-indigo-700">🔐 修改 PIN</div>
      <Input
        type="password"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        placeholder="舊 PIN（4 位數）"
        value={oldPin}
        onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ""))}
      />
      <Input
        type="password"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        placeholder="新 PIN（4 位數）"
        value={newPin}
        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
      />
      <Input
        type="password"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        placeholder="再輸入一次新 PIN"
        value={confirmPin}
        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
      />
      {newPin && confirmPin && newPin !== confirmPin && (
        <div className="text-[10px] text-rose-600">兩次輸入不一致</div>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(false)}
          className="flex-1 h-8 text-xs"
        >
          取消
        </Button>
        <Button
          size="sm"
          disabled={!valid || mut.isPending}
          onClick={() => mut.mutate()}
          className="flex-1 h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
        >
          確認修改
        </Button>
      </div>
    </div>
  )
}

function TransferDialog({
  fromKidId,
  jar,
  onClose,
  onSuccess,
  toast,
}: {
  fromKidId: number
  jar: Jar
  onClose: () => void
  onSuccess: () => void
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
}) {
  const [toKidId, setToKidId] = useState<string>("")
  const [amount, setAmount] = useState("10")
  const [message, setMessage] = useState("")

  const { data: kids = [] } = useQuery<Kid[]>({ queryKey: ["/api/family/kids"] })
  const siblings = kids.filter((k) => k.id !== fromKidId)

  const mut = useMutation({
    mutationFn: () =>
      apiRequest<{ ok: true; to: string; amount: number }>("POST", "/api/family/jars/transfer", {
        fromKidId,
        toKidId: parseInt(toKidId),
        amount: parseFloat(amount),
        jar: "spend",
        message: message.trim() || null,
      }),
    onSuccess: (r) => {
      toast({
        title: `💝 已送禮 ${formatMoney(r.amount)} 給 ${r.to}`,
        description: "感謝你的愛心！",
      })
      vibrate([50, 80, 50])
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
      onSuccess()
    },
    onError: (e: Error) =>
      toast({ title: "送禮失敗", description: e.message, variant: "destructive" }),
  })

  const spend = parseFloat(jar.spendBalance)
  const canSubmit = toKidId && parseFloat(amount) > 0 && parseFloat(amount) <= spend

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>💝 送禮給兄弟姊妹</DialogTitle>
          <DialogDescription>
            從你的花錢罐 ({formatMoney(spend)}) 送一些給家人、培養互助
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {siblings.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              還沒有兄弟姊妹、請家長新增其他小孩 👨‍👩‍👧‍👦
            </div>
          ) : (
            <>
              <div>
                <Label>送給誰</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {siblings.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setToKidId(String(k.id))}
                      className={`p-3 rounded-lg border-2 text-left ${
                        toKidId === String(k.id)
                          ? "border-rose-400 bg-rose-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="text-3xl">{k.avatar}</div>
                      <div className="font-medium">{k.displayName}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>金額</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10"
                  min="1"
                  max={spend}
                />
                <div className="text-[10px] text-gray-400 mt-1">
                  你的花錢罐目前 {formatMoney(spend)}
                </div>
              </div>
              <div>
                <Label>祝福訊息（可選）</Label>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="生日快樂！"
                  maxLength={200}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!canSubmit || mut.isPending}
            onClick={() => mut.mutate()}
            className="bg-rose-500 hover:bg-rose-600"
          >
            💝 送出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface Wish {
  id: number
  title: string
  emoji: string | null
  estimatedPrice: string | null
  priority: number
  status: "wished" | "promoted_to_goal" | "abandoned"
  promotedGoalId: number | null
}

function WishesSection({
  kidId,
  toast,
  onAfterPromote,
}: {
  kidId: number
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
  onAfterPromote: () => void
}) {
  const { data: wishes = [] } = useQuery<Wish[]>({
    queryKey: [`/api/family/wishes?kidId=${kidId}`],
  })
  const active = wishes.filter((w) => w.status === "wished")

  const addMut = useMutation({
    mutationFn: (vars: {
      title: string
      emoji: string
      estimatedPrice?: number
      priority: number
    }) => apiRequest("POST", "/api/family/wishes", { kidId, ...vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/family/wishes?kidId=${kidId}`] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/family/wishes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/family/wishes?kidId=${kidId}`] })
    },
  })

  const promoteMut = useMutation({
    mutationFn: (vars: { id: number; targetAmount?: number }) =>
      apiRequest("POST", `/api/family/wishes/${vars.id}/promote`, {
        targetAmount: vars.targetAmount,
      }),
    onSuccess: () => {
      toast({ title: "🎯 已升級成存錢目標！" })
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } })
      queryClient.invalidateQueries({ queryKey: [`/api/family/wishes?kidId=${kidId}`] })
      queryClient.invalidateQueries({ queryKey: [`/api/family/dashboard?kidId=${kidId}`] })
      onAfterPromote()
    },
    onError: (e: Error) =>
      toast({ title: "升級失敗", description: e.message, variant: "destructive" }),
  })

  const handleAdd = () => {
    const title = window.prompt("想要什麼？", "")
    if (!title?.trim()) return
    const emoji = window.prompt("emoji（可選）", "✨") || "✨"
    const p = window.prompt("價格（可空、不確定先寫 0）", "0")
    const price = parseFloat(p ?? "0")
    const pr = window.prompt("有多想要？1=低 / 2=中 / 3=高", "2")
    const priority = Math.max(1, Math.min(3, parseInt(pr ?? "2", 10) || 2))
    addMut.mutate({
      title: title.trim(),
      emoji,
      estimatedPrice: price > 0 ? price : undefined,
      priority,
    })
  }

  const handlePromote = (w: Wish) => {
    let target = w.estimatedPrice ? parseFloat(w.estimatedPrice) : 0
    if (!(target > 0)) {
      const r = window.prompt(`目標金額？（要存多少才買「${w.title}」）`, "100")
      target = parseFloat(r ?? "0")
      if (!(target > 0)) {
        toast({ title: "需要金額才能升級", variant: "destructive" })
        return
      }
    }
    promoteMut.mutate({ id: w.id, targetAmount: target })
  }

  return (
    <div className="mb-4">
      <h2 className="font-bold mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-amber-500">✨</span>
          我想要的（{active.length}）
        </span>
        <Button size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          加願望
        </Button>
      </h2>
      {active.length === 0 ? (
        <div className="text-center text-xs text-gray-400 py-3 bg-white rounded-lg">
          看到喜歡的東西先放這、想清楚再升級成存錢目標 ✨
        </div>
      ) : (
        <div className="space-y-1.5">
          {active.map((w) => (
            <div key={w.id} className="bg-white rounded-lg p-2.5 flex items-center gap-2 shadow-sm">
              <div className="text-2xl">{w.emoji ?? "✨"}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {w.title}
                  <span className="ml-1.5 text-xs text-amber-500">{"⭐".repeat(w.priority)}</span>
                </div>
                {w.estimatedPrice && (
                  <div className="text-[10px] text-gray-500">
                    估價 {formatMoney(w.estimatedPrice)}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] text-purple-700"
                onClick={() => handlePromote(w)}
                disabled={promoteMut.isPending}
                title="升級成存錢目標、開始存錢"
              >
                🎯 升級
              </Button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`刪除「${w.title}」？`)) deleteMut.mutate(w.id)
                }}
                className="text-red-400 hover:text-red-600 p-1"
                title="刪除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function KidBestsWall({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    lifetime: {
      totalTasks: number
      totalSaved: number
      totalSpent: number
      totalGiven: number
      totalCheckinDays: number
    }
    bests: {
      biggestReward: number
      biggestSpend: number
      biggestGive: number
      longestStreak: number
    }
    firsts: {
      firstTaskAt: string | null
      firstSpendDate: string | null
      firstWishAt: string | null
    }
  }>({
    queryKey: ["/api/family/kid-bests", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-bests?kidId=${kidId}`, { credentials: "include" })
      return res.json()
    },
  })
  if (!data) return null

  const hasAny =
    data.lifetime.totalTasks > 0 ||
    data.lifetime.totalSpent > 0 ||
    data.lifetime.totalGiven > 0 ||
    data.lifetime.totalCheckinDays > 0
  if (!hasAny) return null

  function fmtDate(iso: string | null) {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("zh-TW")
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 p-4 shadow">
      <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2">🏅 我的紀錄牆</h3>

      {/* Lifetime 大字 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-2xl font-bold text-purple-700">{data.lifetime.totalTasks}</div>
          <div className="text-xs text-gray-500">完成任務</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-2xl font-bold text-blue-700">${data.lifetime.totalSaved}</div>
          <div className="text-xs text-gray-500">存款</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-2xl font-bold text-pink-700">${data.lifetime.totalGiven}</div>
          <div className="text-xs text-gray-500">捐贈</div>
        </div>
      </div>

      {/* Personal Bests */}
      <div className="space-y-1 text-sm">
        {data.bests.biggestReward > 0 && (
          <div className="flex justify-between bg-white/60 rounded px-2 py-1">
            <span>🏆 最大任務獎勵</span>
            <span className="font-bold text-amber-700">${data.bests.biggestReward}</span>
          </div>
        )}
        {data.bests.biggestGive > 0 && (
          <div className="flex justify-between bg-white/60 rounded px-2 py-1">
            <span>❤️ 最大單筆捐贈</span>
            <span className="font-bold text-pink-700">${data.bests.biggestGive}</span>
          </div>
        )}
        {data.bests.longestStreak > 0 && (
          <div className="flex justify-between bg-white/60 rounded px-2 py-1">
            <span>🔥 連續打卡</span>
            <span className="font-bold text-orange-700">{data.bests.longestStreak} 天</span>
          </div>
        )}
        {data.lifetime.totalCheckinDays > 0 && (
          <div className="flex justify-between bg-white/60 rounded px-2 py-1">
            <span>📅 累積打卡</span>
            <span className="font-bold text-indigo-700">{data.lifetime.totalCheckinDays} 天</span>
          </div>
        )}
        {data.firsts.firstTaskAt && (
          <div className="flex justify-between bg-white/60 rounded px-2 py-1">
            <span>🎬 第一次完成任務</span>
            <span className="text-gray-600">{fmtDate(data.firsts.firstTaskAt)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function KidActivityTimeline({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    activities: Array<{
      kind: "task" | "spending" | "checkin" | "wish"
      id: number
      label: string
      amount: string
      emoji: string | null
      at: string
    }>
  }>({
    queryKey: ["/api/family/kid-activity", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-activity?kidId=${kidId}&limit=15`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data?.activities?.length) return null

  const KIND_LABEL: Record<string, { name: string; color: string; fallback: string }> = {
    task: { name: "完成任務", color: "text-green-700 bg-green-50", fallback: "📋" },
    spending: { name: "花錢", color: "text-rose-700 bg-rose-50", fallback: "💸" },
    checkin: { name: "打卡", color: "text-amber-700 bg-amber-50", fallback: "😊" },
    wish: { name: "願望", color: "text-violet-700 bg-violet-50", fallback: "✨" },
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
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="font-bold text-gray-700">📜 最近活動</h3>
        <span className="text-xs text-gray-400">最新 {data.activities.length} 筆</span>
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {data.activities.map((a) => {
          const meta = KIND_LABEL[a.kind]
          return (
            <div
              key={`${a.kind}-${a.id}`}
              className={`flex items-center gap-2 p-2 rounded-lg ${meta.color}`}
            >
              <span className="text-xl">{a.emoji || meta.fallback}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.label}</div>
                <div className="text-xs opacity-75">
                  {meta.name}・{a.amount}
                </div>
              </div>
              <span className="text-xs opacity-60 shrink-0">{timeAgo(a.at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KidLevelBadge({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    totalScore: number
    current: { level: number; title: string; emoji: string; threshold: number }
    next: { level: number; title: string; emoji: string; threshold: number } | null
    progress: number
    scoreToNext: number
  }>({
    queryKey: ["/api/family/kid-level", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-level?kidId=${kidId}`, { credentials: "include" })
      return res.json()
    },
  })
  if (!data) return null
  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{data.current.emoji}</div>
          <div>
            <div className="text-xs text-amber-700 font-bold">Lv {data.current.level}</div>
            <div className="text-lg font-bold text-amber-900">{data.current.title}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">累積分數</div>
          <div className="text-2xl font-bold text-amber-700">{data.totalScore}</div>
        </div>
      </div>
      {data.next ? (
        <>
          <div className="h-3 w-full bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
              style={{ width: `${data.progress}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-amber-700 text-center">
            還差 <b>{data.scoreToNext}</b> 分升到 Lv {data.next.level}・{data.next.emoji}{" "}
            {data.next.title}
          </div>
        </>
      ) : (
        <div className="text-center text-sm text-amber-700 font-bold">🎉 已達最高等級！🎉</div>
      )}
    </div>
  )
}

function KidLeaderboard({ kidId }: { kidId: number }) {
  const [open, setOpen] = useState(false)
  interface Entry {
    kidId: number
    displayName: string
    avatar: string
    color: string
    approvedCount: number
    approvedSum: number
    weightedScore: number
    hardCount: number
    rank: number
    medal: string
  }
  const currentMonth = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })()
  const { data } = useQuery<{ month: string; leaderboard: Entry[] }>({
    queryKey: [`/api/family/leaderboard?month=${currentMonth}`],
    enabled: open,
  })

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-orange-300 rounded-xl p-3 flex items-center gap-3 shadow-sm"
      >
        <div className="text-3xl">🏆</div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-orange-800">本月排行</div>
          <div className="text-xs text-orange-700">看自己 vs 兄弟姊妹</div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-orange-700" />
        ) : (
          <ChevronDown className="h-4 w-4 text-orange-700" />
        )}
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {!data ? (
            <div className="text-center text-xs text-gray-400 py-3">載入中…</div>
          ) : data.leaderboard.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-3 bg-white rounded">
              本月還沒人完成任務、加油 💪
            </div>
          ) : (
            data.leaderboard.map((e) => {
              const isMe = e.kidId === kidId
              return (
                <motion.div
                  key={e.kidId}
                  initial={isMe ? { scale: 0.95 } : false}
                  animate={isMe ? { scale: 1 } : undefined}
                  className={`flex items-center gap-2 p-2 rounded border ${
                    isMe
                      ? "bg-indigo-100 border-indigo-400 ring-2 ring-indigo-300"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <span className="text-lg">{e.medal || `${e.rank}.`}</span>
                  <span className="text-xl">{e.avatar}</span>
                  <span className="flex-1 text-sm font-medium">
                    {e.displayName}
                    {isMe && <span className="ml-1 text-[10px] text-indigo-700">（我）</span>}
                  </span>
                  <div className="text-right">
                    <div className="text-xs font-mono text-amber-700">
                      {formatMoney(e.approvedSum)}
                    </div>
                    <div className="text-[9px] text-gray-400">
                      📋 {e.approvedCount} · 積分 {e.weightedScore}
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function AchievementWall({ kidId }: { kidId: number }) {
  interface CatalogBadge {
    badgeType: string
    title: string
    emoji: string
    target: number
    current: number
    unit: string
    progress: number
    earned: boolean
    earnedAt: string | null
  }
  const { data } = useQuery<{
    totalEarned: number
    totalCatalog: number
    badges: CatalogBadge[]
  }>({
    queryKey: [`/api/family/badges-catalog?kidId=${kidId}`],
  })
  if (!data) return null

  const unitLabel = (u: string) =>
    u === "tasks" ? "個任務" : u === "goals" ? "個目標" : u === "days" ? "天" : "$"

  return (
    <div className="mb-4">
      <h2 className="font-bold mb-2 flex items-center gap-2">
        <Award className="h-4 w-4 text-yellow-500" />
        成就牆（{data.totalEarned} / {data.totalCatalog}）
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {data.badges.map((b) => {
          const remaining = b.target - b.current
          return (
            <motion.div
              key={b.badgeType}
              whileHover={b.earned ? { scale: 1.05, rotate: 3 } : undefined}
              className={`rounded-lg p-2 text-center shadow-sm relative overflow-hidden ${
                b.earned
                  ? "bg-white border border-yellow-300"
                  : "bg-gray-100 border border-gray-200"
              }`}
              title={
                b.earned
                  ? `${b.title}\n獲得於 ${b.earnedAt?.slice(0, 10)}`
                  : `${b.title}\n還差 ${
                      b.unit === "dollars" ? "$" + remaining : remaining + unitLabel(b.unit)
                    }`
              }
            >
              <div className={`text-2xl ${b.earned ? "" : "grayscale opacity-40"} leading-none`}>
                {b.emoji}
              </div>
              <div
                className={`text-[10px] mt-1 line-clamp-2 ${
                  b.earned ? "text-gray-800" : "text-gray-500"
                }`}
              >
                {b.title}
              </div>
              {!b.earned && (
                <>
                  <div className="text-[9px] text-gray-400 mt-0.5">
                    {b.current}/{b.target}
                  </div>
                  {/* progress bar */}
                  <div
                    className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-yellow-300 to-amber-500"
                    style={{ width: `${b.progress}%` }}
                  />
                </>
              )}
              {b.earned && (
                <div className="absolute top-0 right-0 text-[10px] bg-yellow-400 text-yellow-900 px-1 rounded-bl font-bold">
                  ✓
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function CommentDialog({
  taskId,
  taskTitle,
  onClose,
}: {
  taskId: number
  taskTitle: string
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
        author: "kid",
        message: message.trim(),
      }),
    onSuccess: () => {
      setMessage("")
      vibrate(30)
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
          <DialogTitle>💬 跟大人聊聊</DialogTitle>
          <DialogDescription>任務：{taskTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {comments.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6">
              還沒有人留言、來開始討論吧 💬
            </div>
          ) : (
            comments.map((c) => {
              const mine = c.author === "kid"
              return (
                <div key={c.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                      mine ? "bg-pink-500 text-white" : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    <div className="text-[10px] opacity-75 mb-0.5">
                      {c.author === "parent" ? "👨‍👩 大人" : "🧒 我"} ·{" "}
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
            className="bg-pink-600 hover:bg-pink-700"
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

function DonationsSection({ kidId }: { kidId: number }) {
  const [open, setOpen] = useState(false)
  interface DonationData {
    total: number
    count: number
    recipients: Array<{ recipient: string; count: number; total: number }>
    monthlyTrend: Array<{ month: string; total: number }>
    items: Array<{
      id: number
      amount: number
      description: string
      emoji: string | null
      recipient: string | null
      reflection: string | null
      spendDate: string
    }>
  }
  const { data } = useQuery<DonationData>({
    queryKey: [`/api/family/donations?kidId=${kidId}`],
  })
  if (!data || data.count === 0) return null

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full bg-gradient-to-r from-rose-100 to-pink-100 border-2 border-rose-300 rounded-xl p-3 flex items-center gap-3 shadow-sm"
      >
        <div className="text-3xl">❤️</div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-rose-800">我的善行</div>
          <div className="text-xs text-rose-700">
            幫助 {data.recipients.length} 個對象、共 {formatMoney(data.total)}（{data.count} 次）
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-rose-700" />
        ) : (
          <ChevronDown className="h-4 w-4 text-rose-700" />
        )}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {/* recipients top 3 */}
          {data.recipients.length > 0 && (
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-xs text-gray-500 mb-2">幫助的對象（前 3 名）</div>
              <div className="space-y-1.5">
                {data.recipients.slice(0, 3).map((r, i) => (
                  <div key={r.recipient} className="flex items-center gap-2 text-sm">
                    <span className="text-base">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                    <span className="flex-1">{r.recipient}</span>
                    <span className="text-xs text-gray-500">{r.count} 次</span>
                    <span className="font-mono font-medium text-rose-700">
                      {formatMoney(r.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 6 月趨勢 */}
          <div className="bg-white rounded-lg p-2 shadow-sm h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(m: string) => m.slice(5)}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 10 }} width={30} />
                <RTooltip
                  formatter={(v: number) => "$" + Number(v).toLocaleString()}
                  contentStyle={{ fontSize: "11px" }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#e11d48"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* 最近反思 */}
          {data.items.filter((x) => x.reflection).length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 space-y-1">
              <div className="text-xs text-rose-700 mb-1">💭 我的捐贈反思</div>
              {data.items
                .filter((x) => x.reflection)
                .slice(0, 3)
                .map((x) => (
                  <div
                    key={x.id}
                    className="text-xs text-gray-700 italic pl-2 border-l-2 border-rose-300"
                  >
                    「{x.reflection}」<span className="text-gray-400">— {x.spendDate}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FamilyPotsContribute({
  kidId,
  jar,
  toast,
  onAfterContribute,
}: {
  kidId: number
  jar: Jar
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
  onAfterContribute: () => void
}) {
  interface FamilyPot {
    id: number
    name: string
    emoji: string | null
    targetAmount: string
    currentAmount: string
    status: "active" | "completed" | "abandoned"
  }
  const { data: pots = [] } = useQuery<FamilyPot[]>({
    queryKey: ["/api/family/pots"],
  })
  const activePots = pots.filter((p) => p.status === "active")
  const contributeMut = useMutation({
    mutationFn: (vars: { potId: number; amount: number }) =>
      apiRequest<{ reached: boolean }>("POST", `/api/family/pots/${vars.potId}/contribute`, {
        kidId,
        amount: vars.amount,
      }),
    onSuccess: (r) => {
      toast({
        title: r.reached ? "🎉 家庭目標達成！" : "✅ 已貢獻到家庭罐",
      })
      if (r.reached) {
        confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 } })
      } else {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } })
      }
      vibrate(40)
      onAfterContribute()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  if (activePots.length === 0) return null
  const saveBal = parseFloat(jar.saveBalance)

  return (
    <div className="mb-4">
      <h2 className="font-bold mb-2 flex items-center gap-2">
        <span className="text-amber-500">🏆</span>
        家庭共同罐（{activePots.length}）
      </h2>
      <div className="space-y-2">
        {activePots.map((p) => {
          const cur = parseFloat(p.currentAmount)
          const target = parseFloat(p.targetAmount)
          const pct = target > 0 ? Math.min(100, Math.round((cur / target) * 100)) : 0
          return (
            <div
              key={p.id}
              className="bg-gradient-to-br from-yellow-50 to-amber-100 border border-amber-300 rounded-lg p-2.5"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-2xl">{p.emoji ?? "🏆"}</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-gray-600">
                    {formatMoney(cur)} / {formatMoney(target)}（{pct}%）
                  </div>
                </div>
              </div>
              <div className="h-2 bg-white rounded overflow-hidden mb-1.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  className="h-full bg-gradient-to-r from-amber-400 to-yellow-500"
                />
              </div>
              <div className="flex gap-1">
                {[5, 10, 50].map((amt) => (
                  <Button
                    key={amt}
                    size="sm"
                    variant="outline"
                    disabled={saveBal < amt || contributeMut.isPending}
                    onClick={() => contributeMut.mutate({ potId: p.id, amount: amt })}
                    className="flex-1 text-[11px] h-7"
                  >
                    貢獻 ${amt}
                  </Button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InternalTransferButton({
  kidId,
  jar,
  toast,
  onSuccess,
}: {
  kidId: number
  jar: Jar
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
  onSuccess: () => void
}) {
  const mut = useMutation({
    mutationFn: (vars: { fromJar: string; toJar: string; amount: number }) =>
      apiRequest("POST", "/api/family/jars/internal-transfer", {
        kidId,
        ...vars,
      }),
    onSuccess: () => {
      toast({ title: "✅ 已調整罐子" })
      vibrate(30)
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const handleClick = () => {
    const JARS = [
      { v: "spend", label: "💸 花用" },
      { v: "save", label: "🐷 存錢" },
      { v: "give", label: "❤️ 捐獻" },
    ]
    const balMap: Record<string, number> = {
      spend: parseFloat(jar.spendBalance),
      save: parseFloat(jar.saveBalance),
      give: parseFloat(jar.giveBalance),
    }
    const fromPrompt = window.prompt(
      `從哪個罐？輸入：\n1 = 💸 花用 ($${balMap.spend})\n2 = 🐷 存錢 ($${balMap.save})\n3 = ❤️ 捐獻 ($${balMap.give})`,
      ""
    )
    const fromIdx = parseInt(fromPrompt ?? "0") - 1
    if (fromIdx < 0 || fromIdx > 2) return
    const fromJar = JARS[fromIdx].v
    const toPrompt = window.prompt(`移到哪個罐？（不可選 ${JARS[fromIdx].label}）`, "")
    const toIdx = parseInt(toPrompt ?? "0") - 1
    if (toIdx < 0 || toIdx > 2 || toIdx === fromIdx) return
    const toJar = JARS[toIdx].v
    const amountStr = window.prompt(
      `從 ${JARS[fromIdx].label} 移多少到 ${JARS[toIdx].label}？（最多 $${balMap[fromJar]}）`,
      ""
    )
    const amount = parseFloat(amountStr ?? "0")
    if (!(amount > 0)) return
    if (amount > balMap[fromJar]) {
      toast({ title: "餘額不足", variant: "destructive" })
      return
    }
    mut.mutate({ fromJar, toJar, amount })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={mut.isPending}
      className="text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded px-2 py-0.5"
      title="在三罐之間移錢調整"
    >
      ⇄ 調整罐子
    </button>
  )
}

function InstallChip() {
  const { canInstall, install } = useInstallPrompt()
  if (!canInstall) return null
  return (
    <button
      type="button"
      onClick={install}
      className="text-xs bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full px-2.5 py-1 shadow hover:shadow-md transition"
      title="把這個 app 加到主畫面、像原生 app 一樣用"
    >
      📱 安裝
    </button>
  )
}

function CheckinPrompt({ kidId }: { kidId: number }) {
  const MOODS = ["😄 開心", "🙂 還好", "😐 普通", "😢 難過", "😡 生氣"]
  interface Checkin {
    id: number
    mood: string
    note: string | null
    checkinDate: string
  }
  const { data, refetch } = useQuery<{
    items: Checkin[]
    today: Checkin | null
  }>({
    queryKey: [`/api/family/checkins?kidId=${kidId}&days=7`],
  })

  const mut = useMutation({
    mutationFn: (mood: string) => apiRequest("POST", "/api/family/checkins", { kidId, mood }),
    onSuccess: () => {
      vibrate(30)
      refetch()
    },
  })

  if (!data) return null

  return (
    <div className="mb-3 bg-gradient-to-r from-sky-50 to-violet-50 border border-sky-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">💭</span>
        <span className="text-xs font-medium text-sky-800">
          {data.today ? `今天的心情：${data.today.mood}` : "今天心情如何？"}
        </span>
      </div>
      <div className="flex gap-1 justify-between flex-wrap">
        {MOODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => mut.mutate(m)}
            disabled={mut.isPending}
            className={`text-xl flex-1 min-w-[18%] py-1.5 rounded transition ${
              data.today?.mood === m
                ? "bg-sky-200 scale-110 ring-2 ring-sky-400"
                : "bg-white hover:bg-sky-100"
            }`}
          >
            {m.slice(0, 2)}
          </button>
        ))}
      </div>
      {/* 近 7 天 mood 軌跡 mini bar */}
      {data.items.length >= 2 && (
        <div className="mt-2 flex gap-0.5 items-end h-5">
          {data.items
            .slice(0, 7)
            .reverse()
            .map((c) => (
              <div
                key={c.id}
                className="flex-1 text-center text-[10px]"
                title={`${c.checkinDate}：${c.mood}`}
              >
                {c.mood.slice(0, 2)}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function DailyMessageBanner({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    message: { id: number; message: string; mood: string; messageDate: string } | null
  }>({
    queryKey: [`/api/family/daily-message?kidId=${kidId}`],
    staleTime: 60_000,
  })
  if (!data?.message) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 rounded-xl bg-gradient-to-r from-pink-100 via-rose-100 to-amber-100 border-2 border-pink-300 p-3 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <div className="text-3xl shrink-0">{data.message.mood || "❤️"}</div>
        <div className="flex-1">
          <div className="text-[10px] text-pink-700 font-medium mb-0.5">大人今天說：</div>
          <div className="text-sm font-medium text-gray-800 leading-snug">
            「{data.message.message}」
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function JarCard({
  label,
  emoji,
  balance,
  ratio,
  bg,
  text,
}: {
  label: string
  emoji: string
  balance: string
  ratio: number
  bg: string
  text: string
}) {
  return (
    <motion.div whileTap={{ scale: 0.96 }} className={`${bg} rounded-xl p-3 shadow-sm text-center`}>
      <div className="text-4xl mb-1">{emoji}</div>
      <div className={`text-xs ${text}`}>{label}</div>
      <div className={`text-lg sm:text-xl font-bold ${text}`}>{formatMoney(balance)}</div>
      <div className="text-[10px] text-gray-500">收入 {ratio}% 進這罐</div>
    </motion.div>
  )
}

const PROPOSE_EMOJI = ["🧹", "🍽️", "🛏️", "📚", "🐕", "👕", "🛒", "🌱", "♻️", "💡", "🎵", "📖"]

function ProposeTaskDialog({
  kidId,
  onClose,
  onSuccess,
  toast,
}: {
  kidId: number
  onClose: () => void
  onSuccess: () => void
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
}) {
  const [title, setTitle] = useState("")
  const [emoji, setEmoji] = useState("🧹")
  const [rewardAmount, setRewardAmount] = useState("30")
  const [notes, setNotes] = useState("")

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/family/tasks/propose", {
        kidId,
        title: title.trim(),
        emoji,
        rewardAmount: parseFloat(rewardAmount),
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast({ title: "✋ 已提出、等大人同意" })
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
      vibrate(50)
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const canSubmit = title.trim() && parseFloat(rewardAmount) > 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>✋ 我想做家事</DialogTitle>
          <DialogDescription>
            主動提出想做的家事、大人同意後可以做、做完可以拿到獎勵
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>想做什麼？</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：幫忙摺衣服 / 澆花"
            />
          </div>
          <div>
            <Label>圖示</Label>
            <div className="grid grid-cols-6 gap-1 mt-1">
              {PROPOSE_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-xl p-1 rounded ${
                    emoji === e ? "bg-purple-100 ring-2 ring-purple-500" : "hover:bg-gray-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>建議獎勵</Label>
            <Input
              type="number"
              value={rewardAmount}
              onChange={(e) => setRewardAmount(e.target.value)}
              placeholder="30"
              inputMode="numeric"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">最終金額由大人決定喔</p>
          </div>
          <div>
            <Label>說明（選填）</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="（為什麼想做？）"
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
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const SPEND_EMOJI = ["💰", "🍔", "🍦", "🥤", "🎮", "📚", "🎁", "🛍️", "🚌", "✏️", "🐶", "🎨"]

function SpendDialog({
  kidId,
  jar,
  onClose,
  onSuccess,
}: {
  kidId: number
  jar: Jar
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [whichJar, setWhichJar] = useState<"spend" | "save" | "give">("spend")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [emoji, setEmoji] = useState("💰")
  const [recipient, setRecipient] = useState("")
  const [reflection, setReflection] = useState("")
  const isGive = whichJar === "give"

  // 家長預設的捐贈對象目錄（小孩快選）
  interface FamilyRecipient {
    id: number
    name: string
    emoji: string | null
    description: string | null
  }
  const { data: presetRecipients = [] } = useQuery<FamilyRecipient[]>({
    queryKey: ["/api/family/recipients"],
    enabled: isGive,
  })

  const balance = {
    spend: parseFloat(jar.spendBalance),
    save: parseFloat(jar.saveBalance),
    give: parseFloat(jar.giveBalance),
  }[whichJar]

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/family/spendings", {
        kidId,
        jar: whichJar,
        amount: parseFloat(amount),
        description: description.trim(),
        emoji,
        spendDate: new Date().toISOString().slice(0, 10),
        recipient: isGive && recipient.trim() ? recipient.trim() : undefined,
        reflection: isGive && reflection.trim() ? reflection.trim() : undefined,
      }),
    onSuccess: () => {
      toast({ title: "✅ 已記錄" })
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } })
      vibrate(40)
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const amt = parseFloat(amount)
  const canSubmit = description.trim() && Number.isFinite(amt) && amt > 0 && amt <= balance

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>記一筆花錢</DialogTitle>
          <DialogDescription>從哪個罐子？花在什麼？</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>從哪個罐子扣？</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(["spend", "save", "give"] as const).map((j) => {
                const label = { spend: "💸 花用", save: "🐷 存錢", give: "❤️ 捐獻" }[j]
                const bal = {
                  spend: jar.spendBalance,
                  save: jar.saveBalance,
                  give: jar.giveBalance,
                }[j]
                const active = whichJar === j
                return (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setWhichJar(j)}
                    className={`p-2 rounded-lg border-2 text-center ${
                      active ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                    }`}
                  >
                    <div className="text-sm">{label}</div>
                    <div className="text-xs text-gray-500 font-mono">
                      ${parseFloat(bal).toLocaleString()}
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">餘額 ${balance.toLocaleString()}</p>
          </div>

          <div>
            <Label>花在什麼？</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例：買飲料 / 漫畫 / 文具"
            />
          </div>
          <div>
            <Label>圖示</Label>
            <div className="grid grid-cols-6 gap-1 mt-1">
              {SPEND_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-xl p-1 rounded ${
                    emoji === e ? "bg-amber-100 ring-2 ring-amber-500" : "hover:bg-gray-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>多少錢？</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例：50"
              inputMode="numeric"
            />
            {amt > balance && (
              <p className="text-xs text-red-600 mt-1">超過餘額 ${balance.toLocaleString()}</p>
            )}
          </div>

          {/* 給罐子特別欄位：捐給誰 + 為什麼想捐 */}
          {isGive && (
            <div className="space-y-2 bg-sky-50 -mx-1 px-3 py-2 rounded-lg border border-sky-200">
              <div className="flex items-center gap-1 text-xs text-sky-800 font-medium">
                ❤️ 來說說你的好心捐獻
              </div>
              <div>
                <Label className="text-xs">捐給誰？</Label>
                {presetRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {presetRecipients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setRecipient(p.name)}
                        className={`text-xs px-2 py-1 rounded-full border ${
                          recipient === p.name
                            ? "bg-sky-200 border-sky-400 text-sky-900 font-medium"
                            : "bg-white border-sky-200 hover:bg-sky-50"
                        }`}
                        title={p.description ?? ""}
                      >
                        {p.emoji ?? "❤️"} {p.name}
                      </button>
                    ))}
                  </div>
                )}
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={
                    presetRecipients.length > 0 ? "或自己輸入..." : "例：流浪動物協會 / 學校募款"
                  }
                />
              </div>
              <div>
                <Label className="text-xs">為什麼想捐？（選填）</Label>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder="寫下你的想法..."
                  rows={2}
                  className="w-full text-sm rounded border border-input bg-background px-3 py-2"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">
                  你的好心會被記下、月底回顧你做了哪些善事 🌟
                </p>
              </div>
            </div>
          )}
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
            <ShoppingBag className="h-4 w-4 mr-1" />
            記錄
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const GOAL_EMOJI = ["🎮", "🚲", "📱", "🎨", "⚽", "🎸", "📚", "🧸", "🎯", "✈️", "🎂", "🍦"]

function GoalDialog({
  kidId,
  onClose,
  onSuccess,
}: {
  kidId: number
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("🎯")
  const [amount, setAmount] = useState("")
  const [deadline, setDeadline] = useState("")
  const [reflection, setReflection] = useState("")

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/family/goals", {
        kidId,
        name: name.trim(),
        emoji,
        targetAmount: parseFloat(amount),
        deadline: deadline || null,
        reflection: reflection.trim() || null,
      }),
    onSuccess: () => {
      toast({ title: "✅ 新目標已建立、加油！" })
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const canSubmit = name.trim() && parseFloat(amount) > 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>新存錢目標</DialogTitle>
          <DialogDescription>想存錢買什麼？</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>名字</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：Switch 遊戲"
            />
          </div>
          <div>
            <Label>圖示</Label>
            <div className="grid grid-cols-6 gap-1 mt-1">
              {GOAL_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-xl p-1 rounded ${
                    emoji === e ? "bg-purple-100 ring-2 ring-purple-500" : "hover:bg-gray-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>金額</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="9000"
            />
          </div>
          <div>
            <Label>期限（選填）</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div>
            <Label>為什麼想存錢買這個？</Label>
            <Input
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="想擁有的理由（可選、未來達成時回看）"
              maxLength={500}
            />
            <div className="text-[10px] text-gray-400 mt-1">寫下原因、達成時回看會很有感</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!canSubmit || mut.isPending}>
            新增
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
