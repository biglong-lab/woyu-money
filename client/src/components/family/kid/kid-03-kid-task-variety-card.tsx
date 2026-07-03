/**
 * family 卡片元件（自 family.tsx 機械拆分 kid-03-kid-task-variety-card，2026-07-03）
 */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

export function KidTaskVarietyCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    summary: {
      totalTasks: number
      uniqueTitles: number
      uniqueCategories: number
      uniqueDifficulties: number
      days: number
    }
    byCategory: Array<{ category: string; label: string; count: number }>
    diversity: "high" | "medium" | "low" | "none"
    message: string
  }>({
    queryKey: [`/api/family/kid-task-variety?kidId=${kidId}&days=30`],
  })
  if (!data) return null
  if (data.summary.totalTasks === 0) return null

  const DIVERSITY_BG: Record<string, string> = {
    high: "from-rainbow-50 to-violet-50 border-violet-400 bg-gradient-to-br from-violet-50 to-pink-50",
    medium: "from-emerald-50 to-green-50 border-emerald-300",
    low: "from-amber-50 to-yellow-50 border-amber-300",
    none: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${DIVERSITY_BG[data.diversity]} p-3 shadow`}
    >
      <h2 className="font-bold mb-2 flex items-center gap-2">🎨 任務多樣性（30 天）</h2>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-sm">{data.message}</div>

      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-lg font-bold">{data.summary.totalTasks}</div>
          <div className="text-[10px] text-gray-500">總任務</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-lg font-bold">{data.summary.uniqueTitles}</div>
          <div className="text-[10px] text-gray-500">不同任務</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-lg font-bold">{data.summary.uniqueCategories}/5</div>
          <div className="text-[10px] text-gray-500">類別覆蓋</div>
        </div>
      </div>

      {data.byCategory.length > 0 && (
        <div className="space-y-1">
          {data.byCategory.map((c) => (
            <div
              key={c.category}
              className="flex items-center justify-between bg-white/80 rounded p-1.5"
            >
              <span className="text-xs">{c.label}</span>
              <span className="text-xs font-bold">{c.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function KidDifficultyEvolutionCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    months: Array<{ month: string; easy: number; medium: number; hard: number }>
    totals: { easy: number; medium: number; hard: number }
    trend: "rising_challenge" | "easing" | "steady" | "no_data"
    message: string
  }>({
    queryKey: [`/api/family/difficulty-evolution?kidId=${kidId}&months=6`],
  })
  if (!data) return null
  if (data.totals.easy + data.totals.medium + data.totals.hard === 0) return null

  const max = Math.max(...data.months.map((m) => m.easy + m.medium + m.hard), 1)

  const TREND_BG: Record<string, string> = {
    rising_challenge: "from-orange-50 to-red-50 border-orange-300",
    easing: "from-sky-50 to-blue-50 border-sky-300",
    steady: "from-emerald-50 to-green-50 border-emerald-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${TREND_BG[data.trend]} p-3 shadow`}
    >
      <h2 className="font-bold mb-2 flex items-center gap-2">⚡ 我的難度演進（6 個月）</h2>

      <div className="bg-white/80 rounded-lg p-2 mb-2 text-sm">{data.message}</div>

      <div className="flex items-end gap-1.5 h-28 mb-2">
        {data.months.map((m) => {
          const total = m.easy + m.medium + m.hard
          const h = (total / max) * 100
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center justify-end">
              <div
                className="w-full flex flex-col-reverse rounded overflow-hidden bg-white/50"
                style={{ height: `${Math.max(h, 4)}%` }}
              >
                {m.easy > 0 && (
                  <div
                    className="bg-green-400 w-full"
                    style={{ height: `${(m.easy / Math.max(total, 1)) * 100}%` }}
                    title={`easy: ${m.easy}`}
                  />
                )}
                {m.medium > 0 && (
                  <div
                    className="bg-amber-400 w-full"
                    style={{ height: `${(m.medium / Math.max(total, 1)) * 100}%` }}
                    title={`medium: ${m.medium}`}
                  />
                )}
                {m.hard > 0 && (
                  <div
                    className="bg-red-500 w-full"
                    style={{ height: `${(m.hard / Math.max(total, 1)) * 100}%` }}
                    title={`hard: ${m.hard}`}
                  />
                )}
              </div>
              <div className="text-[9px] text-gray-500 mt-1">{m.month.slice(5)}</div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-center gap-3 text-xs text-gray-600">
        <span>
          <span className="inline-block w-2.5 h-2.5 bg-green-400 rounded-sm mr-1" />⭐ easy{" "}
          {data.totals.easy}
        </span>
        <span>
          <span className="inline-block w-2.5 h-2.5 bg-amber-400 rounded-sm mr-1" />
          ⭐⭐ medium {data.totals.medium}
        </span>
        <span>
          <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-sm mr-1" />
          ⭐⭐⭐ hard {data.totals.hard}
        </span>
      </div>
    </div>
  )
}

export function KidTimecapsuleCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    total: number
    capsules: Array<{
      key: "year" | "halfYear" | "month"
      label: string
      date: string
      tasks: Array<{ title: string; emoji: string; reward: number }>
      spendings: Array<{ description: string; emoji: string; amount: number; jar: string }>
      mood: string | null
    }>
  }>({
    queryKey: ["/api/family/kid-timecapsule", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-timecapsule?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 shadow">
      <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">🕰️ 時光膠囊</h3>

      <div className="space-y-3">
        {data.capsules.map((c) => (
          <div key={c.key} className="bg-white rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-indigo-700">📅 {c.label}的今天</span>
              <span className="text-xs text-gray-500">{c.date}</span>
            </div>

            {c.tasks.length > 0 && (
              <div className="mb-1.5">
                <div className="text-xs text-gray-500 mb-0.5">完成了：</div>
                <div className="flex flex-wrap gap-1">
                  {c.tasks.map((t, i) => (
                    <span
                      key={i}
                      className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full"
                    >
                      {t.emoji} {t.title} (${t.reward})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {c.spendings.length > 0 && (
              <div className="mb-1.5">
                <div className="text-xs text-gray-500 mb-0.5">花了：</div>
                <div className="flex flex-wrap gap-1">
                  {c.spendings.map((s, i) => (
                    <span
                      key={i}
                      className="text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full"
                    >
                      {s.emoji} {s.description} ${s.amount}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {c.mood && (
              <div className="text-xs">
                <span className="text-gray-500">當天心情：</span>
                <span className="font-medium">{c.mood}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function KidPraisesCard({ kidId }: { kidId: number }) {
  const [expanded, setExpanded] = useState(false)
  const { data } = useQuery<{
    total: number
    praises: Array<{
      id: number
      title: string
      emoji: string
      reward: number
      message: string
      at: string | null
    }>
  }>({
    queryKey: ["/api/family/kid-praises", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-praises?kidId=${kidId}&limit=20`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  const visible = expanded ? data.praises : data.praises.slice(0, 3)

  function fmtDate(iso: string | null) {
    if (!iso) return ""
    return new Date(iso).toLocaleDateString("zh-TW")
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-4 shadow">
      <h3 className="font-bold text-pink-900 mb-3 flex items-center gap-2">
        💖 家長最近誇我（{data.total}）
      </h3>

      <div className="space-y-2">
        {visible.map((p) => (
          <div key={p.id} className="bg-white rounded-lg p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{p.emoji}</span>
              <span className="text-sm font-medium flex-1 truncate">{p.title}</span>
              <span className="text-xs text-gray-500">{fmtDate(p.at)}</span>
            </div>
            <div className="text-sm text-pink-800 bg-pink-50 rounded px-2 py-1.5 italic">
              💬 「{p.message}」
            </div>
          </div>
        ))}
      </div>

      {data.praises.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full text-center text-sm text-pink-600 hover:text-pink-800"
        >
          {expanded ? "收起" : `看更多 (${data.praises.length - 3} 則)`}
        </button>
      )}
    </div>
  )
}

export function KidActivityHeatmap({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    weeks: number
    peak: number
    activeDays: number
    days: Array<{
      date: string
      taskCount: number
      spendingCount: number
      total: number
    }>
  }>({
    queryKey: ["/api/family/kid-activity-heatmap", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-activity-heatmap?kidId=${kidId}&weeks=12`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.activeDays === 0) return null

  const peak = data.peak
  const allDays = data.days
  const activeDays = data.activeDays

  const weeks: Array<Array<(typeof allDays)[0]>> = []
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7))
  }

  function intensity(total: number) {
    if (total === 0) return "bg-gray-100"
    if (peak <= 1 || total === 1) return "bg-emerald-200"
    if (total <= Math.ceil(peak * 0.33)) return "bg-emerald-300"
    if (total <= Math.ceil(peak * 0.66)) return "bg-emerald-500"
    return "bg-emerald-700"
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-emerald-800 flex items-center gap-2">🗓️ 12 週活動</h3>
        <span className="text-xs text-gray-500">
          {activeDays} 個活躍日・最高 {peak} 件/日
        </span>
      </div>

      <div className="flex gap-0.5 overflow-x-auto">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((day) => (
              <div
                key={day.date}
                className={`w-3 h-3 rounded ${intensity(day.total)}`}
                title={`${day.date}：${day.taskCount} 任務、${day.spendingCount} 支出`}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1 mt-2 text-xs text-gray-500">
        <span>少</span>
        <div className="w-3 h-3 rounded bg-gray-100" />
        <div className="w-3 h-3 rounded bg-emerald-200" />
        <div className="w-3 h-3 rounded bg-emerald-300" />
        <div className="w-3 h-3 rounded bg-emerald-500" />
        <div className="w-3 h-3 rounded bg-emerald-700" />
        <span>多</span>
      </div>
    </div>
  )
}

export function KidNextBadgeCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    next: {
      type: string
      title: string
      emoji: string
      target: number
      current: number
      remaining: number
      unit: string
      progress: number
    } | null
    message: string
  }>({
    queryKey: ["/api/family/kid-next-badge", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-next-badge?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data) return null

  // 全解鎖
  if (!data.next) {
    return (
      <div className="mb-4 rounded-2xl border-2 border-purple-400 bg-gradient-to-r from-purple-100 to-pink-100 p-4 shadow text-center">
        <div className="text-3xl mb-1">🎊</div>
        <div className="font-bold text-purple-900">{data.message}</div>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-yellow-400 bg-gradient-to-r from-yellow-50 to-amber-50 p-4 shadow">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-5xl">{data.next.emoji}</div>
        <div className="flex-1">
          <div className="text-xs text-amber-700">下一個徽章</div>
          <div className="font-bold text-amber-900">{data.next.title}</div>
          <div className="text-xs text-gray-600 mt-0.5">
            還差 <b className="text-amber-700">{data.next.remaining}</b> {data.next.unit}
          </div>
        </div>
      </div>
      <div className="h-3 bg-amber-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all"
          style={{ width: `${data.next.progress}%` }}
        />
      </div>
      <div className="text-center mt-1 text-xs text-gray-600">
        {data.next.current} / {data.next.target}（{data.next.progress}%）
      </div>
    </div>
  )
}

export function KidWeeklyReportCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    thisWeek: { tasks: number; earned: number; spent: number; checkins: number }
    prevWeek: { tasks: number; earned: number; spent: number; checkins: number }
    metrics: Array<{
      key: string
      name: string
      this: number
      prev: number
      trend: "up" | "down" | "flat"
      trendEmoji: string
      delta: number
    }>
    overall: string
  }>({
    queryKey: ["/api/family/kid-weekly-report", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-weekly-report?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data) return null

  // 本週 + 上週都 0 任務不顯示
  if (data.thisWeek.tasks === 0 && data.prevWeek.tasks === 0) return null

  function deltaTag(d: number, key: string) {
    if (d === 0) return "持平"
    const sign = d > 0 ? "+" : ""
    if (key === "earned" || key === "spent") return `${sign}$${d}`
    return `${sign}${d}`
  }

  // spent up 是壞、其他 up 是好
  function trendColor(key: string, trend: "up" | "down" | "flat") {
    if (trend === "flat") return "text-gray-500"
    if (key === "spent") {
      return trend === "up" ? "text-rose-600" : "text-emerald-600"
    }
    return trend === "up" ? "text-emerald-600" : "text-rose-600"
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-blue-50 p-4 shadow">
      <h3 className="font-bold text-sky-900 mb-3 flex items-center gap-2">📅 本週成績單</h3>

      {/* overall 大字 */}
      <div className="bg-white rounded-lg p-3 mb-3 text-center text-sm font-medium text-sky-900">
        {data.overall}
      </div>

      {/* 4 metrics */}
      <div className="grid grid-cols-2 gap-2">
        {data.metrics.map((m) => (
          <div key={m.key} className="bg-white rounded-lg p-2">
            <div className="text-xs text-gray-500 mb-0.5">
              {m.name} <span>{m.trendEmoji}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-sky-700">
                {m.key === "earned" || m.key === "spent" ? `$${m.this}` : m.this}
              </span>
              <span className={`text-xs font-bold ${trendColor(m.key, m.trend)}`}>
                {deltaTag(m.delta, m.key)}
              </span>
            </div>
            <div className="text-[10px] text-gray-400">
              上週 {m.key === "earned" || m.key === "spent" ? `$${m.prev}` : m.prev}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function KidMoodTrendCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    totalDays: number
    avgScore: number
    happyDays: number
    sadDays: number
    bestDay: { date: string; mood: string } | null
    worstDay: { date: string; mood: string } | null
    trend: string
    checkins: Array<{ date: string; mood: string; score: number; note: string | null }>
  }>({
    queryKey: ["/api/family/kid-mood-trend", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-mood-trend?kidId=${kidId}&days=30`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.totalDays === 0) return null

  function scoreColor(score: number) {
    if (score >= 5) return "bg-yellow-400"
    if (score >= 4) return "bg-emerald-400"
    if (score >= 3) return "bg-blue-400"
    if (score >= 2) return "bg-indigo-400"
    return "bg-rose-400"
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-pink-900 flex items-center gap-2">🎭 心情走勢</h3>
        <span className="text-xs text-gray-500">
          {data.totalDays} 天・平均 {data.avgScore}/5
        </span>
      </div>

      <div className="bg-white rounded-lg p-3 mb-3 text-center">
        <div className="text-base font-bold text-pink-900">{data.trend}</div>
        <div className="text-xs text-gray-600 mt-1">
          😊 開心 {data.happyDays} 天・😢 難過 {data.sadDays} 天
        </div>
      </div>

      {/* 心情條（每天 1 個小方格、最近 30 天）*/}
      <div className="flex gap-0.5 mb-2">
        {data.checkins.slice(0, 30).map((c) => (
          <div
            key={c.date}
            className={`w-2.5 h-6 rounded ${scoreColor(c.score)}`}
            title={`${c.date}：${c.mood}`}
          />
        ))}
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        {data.bestDay && (
          <span>
            最開心：{data.bestDay.mood}（{new Date(data.bestDay.date).toLocaleDateString("zh-TW")}）
          </span>
        )}
      </div>
    </div>
  )
}
