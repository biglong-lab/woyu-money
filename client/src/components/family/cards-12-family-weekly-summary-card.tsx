/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-12-family-weekly-summary-card，2026-07-03）
 */
import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function FamilyWeeklySummaryCard() {
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

export function FamilyLifetimeCard() {
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

export function FamilyHealthDashboard() {
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

export function FamilyMoodToday() {
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

export function FamilyTodaySummary() {
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

export function FamilySearch() {
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

export function ParentReminders() {
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
