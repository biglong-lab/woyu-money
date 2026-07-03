/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-01-comment-dialog，2026-07-03）
 */
import { useState, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useInstallPrompt } from "@/hooks/use-install-prompt"
import { Kid, Task, formatMoney } from "./family-shared"

export function CommentDialog({
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

export function TaskStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "待完成", cls: "bg-gray-100 text-gray-700" },
    submitted: { label: "待審核", cls: "bg-amber-100 text-amber-800" },
    approved: { label: "已入帳", cls: "bg-green-100 text-green-800" },
    rejected: { label: "已駁回", cls: "bg-red-100 text-red-800" },
  }
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" }
  return <Badge className={`${s.cls} text-[10px]`}>{s.label}</Badge>
}

export function FamilyInstallChip() {
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

export function FamilyYearSummary() {
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

export function TaskCalendar({ tasks, kids }: { tasks: Task[]; kids: Kid[] }) {
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

export function CategoryStats() {
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
