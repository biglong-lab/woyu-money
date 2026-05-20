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
import { ArrowLeft, CheckCircle2, Sparkles, Plus, Target, Award } from "lucide-react"
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

interface KidDashboard {
  scope: "kid"
  kid: Kid
  jar: Jar
  tasks: Task[]
  goals: Goal[]
  badges: Badge[]
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

  const invalidate = () => {
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0] ?? "").includes("/api/family/"),
    })
  }

  const submitMut = useMutation({
    mutationFn: (taskId: number) => apiRequest("POST", `/api/family/tasks/${taskId}/submit`),
    onSuccess: () => {
      toast({ title: "✅ 已標完成、等大人確認" })
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
      vibrate([30, 50, 30])
      invalidate()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
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
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => submitMut.mutate(t.id)}
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
