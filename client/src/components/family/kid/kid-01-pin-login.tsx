/**
 * family 卡片元件（自 family.tsx 機械拆分 kid-01-pin-login，2026-07-03）
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Link } from "wouter"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Plus,
  Target,
  ShoppingBag,
  Trash2,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
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
import {
  Kid,
  difficultyStars,
  CATEGORY_FILTER,
  Spending,
  MonthlyReport,
  KidDashboard,
  formatMoney,
  vibrate,
} from "./family-shared"
import {
  KidGrowthStageCard,
  PersonalizeDialog,
  TransferDialog,
  WishesSection,
} from "./kid-02-personalize-dialog"
import {
  KidActivityHeatmap,
  KidDifficultyEvolutionCard,
  KidMoodTrendCard,
  KidNextBadgeCard,
  KidPraisesCard,
  KidTaskVarietyCard,
  KidTimecapsuleCard,
  KidWeeklyReportCard,
} from "./kid-03-kid-task-variety-card"
import {
  GoalEtaBadge,
  KidDifficultyCard,
  KidDonationRecipientsCard,
  KidEmojiCloudCard,
  KidSpendingKeywordsCard,
  KidStrengthsCard,
  KidTaskStreakCard,
  KidTimeOfDayCard,
  KidWalletHealthCard,
} from "./kid-04-kid-task-streak-card"
import {
  DailyMiniGoals,
  DailyMoneyQuote,
  KidActivityTimeline,
  KidBestsWall,
  KidGoalDeadlinesCard,
  KidJarFlow30dCard,
  KidNetWorthCard,
  KidWishlistSummaryCard,
} from "./kid-05-kid-bests-wall"
import {
  AchievementWall,
  CommentDialog,
  DonationsSection,
  FamilyPotsContribute,
  KidLeaderboard,
  KidLevelBadge,
  KidStrengthsListCard,
  KidSuggestionsCard,
} from "./kid-06-kid-strengths-list-card"
import {
  CheckinPrompt,
  DailyMessageBanner,
  GoalDialog,
  InstallChip,
  InternalTransferButton,
  JarCard,
  ProposeTaskDialog,
  SpendDialog,
} from "./kid-07-internal-transfer-button"

export function PinLogin({ kidId, onSuccess }: { kidId: number; onSuccess: () => void }) {
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

export function KidDashboard({
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

  // 拍照上傳：用小孩端開放的 /api/family/upload-proof（不需 auth）
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fd = new FormData()
      fd.append("image", file)
      const resp = await fetch("/api/family/upload-proof", { method: "POST", body: fd })
      if (!resp.ok) {
        const err = (await resp.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? "上傳失敗")
      }
      const data = (await resp.json()) as { url: string }
      return data.url ?? null
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
          <h1 className="text-xl font-bold">
            {(() => {
              const h = new Date().getHours()
              if (h < 6) return "🌙 還沒睡？"
              if (h < 12) return "🌅 早安"
              if (h < 18) return "☀️ 午安"
              if (h < 22) return "🌆 晚安"
              return "🌙 該睡了"
            })()}
            、{kid.displayName}！
          </h1>
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

      {/* 願望清單分析（買得起多少 / 還要多久）*/}
      <KidWishlistSummaryCard kidId={kidId} />

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
                  <GoalEtaBadge goalId={g.id} />
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

      {/* 每日金錢小語 */}
      <DailyMoneyQuote />

      {/* 今日小目標（每天 3 個 nudge）*/}
      <DailyMiniGoals kidId={kidId} />

      {/* 總財產 */}
      <KidNetWorthCard kidId={kidId} />

      {/* 等級徽章（累積分數升 level）*/}
      <KidLevelBadge kidId={kidId} />

      {/* 我的優點清單 */}
      <KidStrengthsListCard kidId={kidId} />

      {/* 任務挑戰推薦（明天試試這些）*/}
      <KidSuggestionsCard kidId={kidId} />

      {/* 目標倒數 */}
      <KidGoalDeadlinesCard kidId={kidId} />

      {/* 任務 streak（連續做任務）*/}
      <KidTaskStreakCard kidId={kidId} />

      {/* 心情走勢（近 30 天）*/}
      <KidMoodTrendCard kidId={kidId} />

      {/* 本週成績單 */}
      <KidWeeklyReportCard kidId={kidId} />

      {/* 活動 heatmap（12 週小方塊）*/}
      <KidActivityHeatmap kidId={kidId} />

      {/* 下一個徽章提示 */}
      <KidNextBadgeCard kidId={kidId} />

      {/* 家長誇獎回顧（暖心）*/}
      <KidPraisesCard kidId={kidId} />

      {/* 時光膠囊（年前/月前的今天）*/}
      <KidTimecapsuleCard kidId={kidId} />

      {/* 最近活動時間軸 */}
      <KidActivityTimeline kidId={kidId} />

      {/* 個人最佳紀錄牆 */}
      <KidBestsWall kidId={kidId} />

      {/* 錢包健康分析 */}
      <KidWalletHealthCard kidId={kidId} />

      {/* 消費分類 */}
      <KidSpendingKeywordsCard kidId={kidId} />

      {/* 捐贈受贈方統計 */}
      <KidDonationRecipientsCard kidId={kidId} />

      {/* 能力強項統計 */}
      <KidStrengthsCard kidId={kidId} />

      {/* Emoji 雲 */}
      <KidEmojiCloudCard kidId={kidId} />

      {/* 任務難度分佈 */}
      <KidDifficultyCard kidId={kidId} />

      {/* 任務時段分析 */}
      <KidTimeOfDayCard kidId={kidId} />

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

      {/* 難度演進（過去 6 個月）*/}
      <KidDifficultyEvolutionCard kidId={kidId} />

      {/* 任務多樣性（過去 30 天）*/}
      <KidTaskVarietyCard kidId={kidId} />

      {/* 30 天金流摘要（賺多少 / 花多少 / 三罐比例提示）*/}
      <KidJarFlow30dCard kidId={kidId} />

      {/* 成長階段 */}
      <KidGrowthStageCard kidId={kidId} />

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
