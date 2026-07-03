/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-02-mood-trends，2026-07-03）
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { formatMoney } from "./family-shared"

export function MoodTrends() {
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

export function PotContributorsCard() {
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

export function FamilyPotsManager() {
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

export function RecipientsManager() {
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

export function DifficultyInsights() {
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

export function KidEducationCard({
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

export function FamilyWeeklyHeatmap() {
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
