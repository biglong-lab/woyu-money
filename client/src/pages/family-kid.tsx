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
}

interface Goal {
  id: number
  name: string
  emoji: string | null
  targetAmount: string
  currentAmount: string
  status: "active" | "completed" | "abandoned"
  deadline: string | null
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
  const [showSpend, setShowSpend] = useState(false)
  const [showPropose, setShowPropose] = useState(false)
  const [showReport, setShowReport] = useState(false)

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
    mutationFn: (vars: { goalId: number; amount: number }) =>
      apiRequest<{ reached: boolean; newBadges: string[] }>(
        "POST",
        `/api/family/goals/${vars.goalId}/save`,
        { amount: vars.amount }
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
  const pendingTasks = tasks.filter((t) => t.status === "pending")
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
        <div className="text-3xl">{kid.avatar}</div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">嗨 {kid.displayName}！</h1>
          <p className="text-xs text-gray-500">
            完成 {recentApprovedCount} 個任務 · {badges.length} 個徽章
          </p>
        </div>
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

      {/* 三罐（最大、最顯眼） */}
      <div className="grid grid-cols-3 gap-2 mb-4">
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

      {/* 兩個大按鈕：花錢 + 主動提任務 */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Button
          onClick={() => setShowSpend(true)}
          className="h-14 text-sm bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 shadow-lg"
        >
          <ShoppingBag className="h-5 w-5 mr-1" />
          💸 我花錢了
        </Button>
        <Button
          onClick={() => setShowPropose(true)}
          className="h-14 text-sm bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 shadow-lg"
        >
          <Sparkles className="h-5 w-5 mr-1" />✋ 我想做家事
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

      {/* 待完成任務 */}
      <div className="mb-4">
        <h2 className="font-bold mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          我的任務（{pendingTasks.length}）
        </h2>
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
                className="bg-white rounded-lg p-3 flex items-center gap-3 shadow-sm"
              >
                <div className="text-3xl">{t.emoji ?? "📋"}</div>
                <div className="flex-1">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-gray-500">
                    完成可得 {formatMoney(t.rewardAmount)}
                  </div>
                </div>
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
                  <span className="font-medium">{t.title}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      t.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {t.status === "approved" ? "✅ 通過" : "🙅 駁回"}
                  </span>
                </div>
                <div className="text-gray-700">「{t.parentFeedback}」</div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                        onClick={() => saveToGoalMut.mutate({ goalId: g.id, amount: amt })}
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

      {/* 徽章 */}
      {badges.length > 0 && (
        <div>
          <h2 className="font-bold mb-2 flex items-center gap-2">
            <Award className="h-4 w-4 text-yellow-500" />
            我的徽章（{badges.length}）
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {badges.map((b) => (
              <motion.div
                key={b.id}
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="bg-white rounded-lg p-2 text-center shadow-sm"
                title={b.title}
              >
                <div className="text-3xl">{b.emoji}</div>
                <div className="text-[10px] mt-0.5 text-gray-700 line-clamp-2">{b.title}</div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

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
    </div>
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
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="例：流浪動物協會 / 學校募款"
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

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/family/goals", {
        kidId,
        name: name.trim(),
        emoji,
        targetAmount: parseFloat(amount),
        deadline: deadline || null,
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
