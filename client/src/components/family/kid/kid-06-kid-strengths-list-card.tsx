/**
 * family 卡片元件（自 family.tsx 機械拆分 kid-06-kid-strengths-list-card，2026-07-03）
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Award, ChevronDown, ChevronUp } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Jar, formatMoney, vibrate } from "./family-shared"

export function KidStrengthsListCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    strengthCount: number
    strengths: Array<{ key: string; emoji: string; title: string; detail: string }>
  }>({
    queryKey: ["/api/family/kid-strengths-list", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-strengths-list?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-pink-50 p-4 shadow">
      <h3 className="font-bold text-rose-900 mb-3 flex items-center gap-2">
        ✨ 我的優點（{data.strengthCount}）
      </h3>
      <div className="space-y-2">
        {data.strengths.map((s) => (
          <div key={s.key} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <span className="text-2xl">{s.emoji}</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-rose-900">{s.title}</div>
              <div className="text-xs text-gray-600">{s.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function KidSuggestionsCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    total: number
    suggestions: Array<{
      title: string
      emoji: string
      familyTimes: number
      suggestedReward: number
      category: string
    }>
  }>({
    queryKey: ["/api/family/kid-suggestions", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-suggestions?kidId=${kidId}&limit=5`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 p-4 shadow">
      <h3 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">💡 你可以挑戰這些</h3>
      <div className="space-y-2">
        {data.suggestions.map((s) => (
          <div key={s.title} className="bg-white rounded-lg p-2 flex items-center gap-2 shadow-sm">
            <span className="text-2xl shrink-0">{s.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{s.title}</div>
              <div className="text-xs text-gray-500">
                家人做過 <b className="text-emerald-700">{s.familyTimes}</b> 次・建議 $
                {s.suggestedReward}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-emerald-700 mt-2 text-center">
        💡 跟家人說一聲、就可以開始做了！
      </div>
    </div>
  )
}

export function KidLevelBadge({ kidId }: { kidId: number }) {
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

export function KidLeaderboard({ kidId }: { kidId: number }) {
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

export function AchievementWall({ kidId }: { kidId: number }) {
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

export function CommentDialog({
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

export function DonationsSection({ kidId }: { kidId: number }) {
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

export function FamilyPotsContribute({
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
