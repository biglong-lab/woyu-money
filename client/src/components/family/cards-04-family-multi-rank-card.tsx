/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-04-family-multi-rank-card，2026-07-03）
 */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

export function FamilyMultiRankCard() {
  const { data } = useQuery<{
    days: number
    ranks: Array<{
      metric: string
      name: string
      emoji: string
      top: Array<{ kidId: number; kidName: string; avatar: string; value: number }>
    }>
  }>({
    queryKey: ["/api/family/multi-rank"],
    queryFn: async () => {
      const res = await fetch("/api/family/multi-rank?days=30", { credentials: "include" })
      return res.json()
    },
  })
  if (!data) return null

  const hasAny = data.ranks.some((r) => r.top.length > 0)
  if (!hasAny) return null

  const medals = ["🥇", "🥈", "🥉"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow">
      <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
        🏆 多維排行（近 {data.days} 天）
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {data.ranks
          .filter((r) => r.top.length > 0)
          .map((r) => (
            <div key={r.metric} className="bg-white rounded-lg p-2">
              <div className="text-sm font-bold text-amber-800 mb-1.5">
                {r.emoji} {r.name}
              </div>
              <div className="space-y-1">
                {r.top.map((k, i) => (
                  <div key={k.kidId} className="flex items-center gap-1.5 text-xs">
                    <span>{medals[i] || "🏅"}</span>
                    <span>{k.avatar}</span>
                    <span className="flex-1 truncate font-medium">{k.kidName}</span>
                    <span className="font-bold text-amber-700">{k.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export function FamilyCalendarHeatmap() {
  const { data } = useQuery<{
    month: string
    peak: number
    activeDays: number
    totalActivity: number
    days: Array<{
      date: string
      tasks: number
      spendings: number
      checkins: number
      total: number
    }>
  }>({
    queryKey: ["/api/family/calendar-month"],
    queryFn: async () => {
      const res = await fetch("/api/family/calendar-month", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.activeDays === 0) return null

  const peak = data.peak
  function intensity(total: number) {
    if (total === 0) return "bg-gray-100 text-gray-400"
    if (peak <= 1) return "bg-emerald-200 text-emerald-900"
    if (total <= Math.ceil(peak * 0.33)) return "bg-emerald-200 text-emerald-900"
    if (total <= Math.ceil(peak * 0.66)) return "bg-emerald-400 text-white"
    return "bg-emerald-700 text-white"
  }

  // 第一天是星期幾（補空格）
  const firstDay = new Date(data.days[0].date)
  const firstDow = firstDay.getDay() // 0=週日

  return (
    <div className="mb-4 rounded-2xl border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-teal-900 flex items-center gap-2">
          📅 {data.month} 日曆熱度
        </h3>
        <span className="text-xs text-gray-500">
          {data.activeDays} 活躍日・{data.totalActivity} 活動
        </span>
      </div>

      {/* 星期 header */}
      <div className="grid grid-cols-7 gap-1 mb-1 text-xs text-center text-gray-500">
        <div>日</div>
        <div>一</div>
        <div>二</div>
        <div>三</div>
        <div>四</div>
        <div>五</div>
        <div>六</div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {/* 空格補齊 */}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {data.days.map((d) => {
          const day = parseInt(d.date.slice(8, 10), 10)
          return (
            <div
              key={d.date}
              className={`aspect-square rounded p-1 text-center text-xs flex flex-col items-center justify-center ${intensity(d.total)}`}
              title={`${d.date}：${d.tasks} 任務・${d.spendings} 花費・${d.checkins} 打卡`}
            >
              <div className="font-bold">{day}</div>
              {d.total > 0 && <div className="text-[10px] opacity-80">{d.total}</div>}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-1 mt-2 text-xs text-gray-500">
        <span>少</span>
        <div className="w-3 h-3 rounded bg-gray-100" />
        <div className="w-3 h-3 rounded bg-emerald-200" />
        <div className="w-3 h-3 rounded bg-emerald-400" />
        <div className="w-3 h-3 rounded bg-emerald-700" />
        <span>多</span>
      </div>
    </div>
  )
}

export function FamilyEmojiCloudCard() {
  const { data } = useQuery<{
    total: number
    uniqueEmojis: number
    mostUsed: { emoji: string; count: number; uniqueKids: number } | null
    emojis: Array<{
      emoji: string
      count: number
      uniqueKids: number
      sizeRem: number
      percentage: number
    }>
  }>({
    queryKey: ["/api/family/emoji-cloud"],
    queryFn: async () => {
      const res = await fetch("/api/family/emoji-cloud?limit=20", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-pink-900 flex items-center gap-2">🎨 全家任務 emoji 雲</h3>
        <span className="text-xs text-gray-500">
          {data.uniqueEmojis} 種・{data.total} 任務
        </span>
      </div>

      {data.mostUsed && (
        <div className="bg-white rounded-lg p-3 mb-3 text-center">
          <div className="text-5xl mb-1">{data.mostUsed.emoji}</div>
          <div className="text-xs text-gray-500">
            最常做（{data.mostUsed.count} 次・{data.mostUsed.uniqueKids} 個小孩）
          </div>
        </div>
      )}

      <div className="bg-white/70 rounded-lg p-3 flex flex-wrap gap-2 items-center justify-center">
        {data.emojis.map((e) => (
          <span
            key={e.emoji}
            className="leading-none"
            style={{ fontSize: `${e.sizeRem}rem` }}
            title={`${e.emoji} ${e.count} 次（${e.percentage}%、${e.uniqueKids} 個小孩）`}
          >
            {e.emoji}
          </span>
        ))}
      </div>
    </div>
  )
}

export function PopularTasksCard() {
  const { data } = useQuery<{
    total: number
    tasks: Array<{
      title: string
      emoji: string
      times: number
      totalReward: number
      uniqueKids: number
      lastAt: string | null
    }>
  }>({
    queryKey: ["/api/family/popular-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/family/popular-tasks?limit=5", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  const medals = ["🥇", "🥈", "🥉", "🏅", "🏅"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow">
      <h3 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
        🏆 全家熱門任務 TOP {data.total}
      </h3>
      <div className="space-y-2">
        {data.tasks.map((t, i) => (
          <div key={t.title} className="bg-white rounded-lg p-2 flex items-center gap-2 shadow-sm">
            <span className="text-2xl shrink-0">{medals[i]}</span>
            <span className="text-xl shrink-0">{t.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{t.title}</div>
              <div className="text-xs text-gray-500">
                做了 <b className="text-orange-700">{t.times}</b> 次・累積 ${t.totalReward}・
                {t.uniqueKids} 個小孩
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyGoalsBoard() {
  const { data } = useQuery<{
    total: number
    nearComplete: number
    completedReady: number
    goals: Array<{
      id: number
      kidId: number
      kidName: string
      kidAvatar: string
      name: string
      emoji: string
      currentAmount: number
      targetAmount: number
      remaining: number
      progress: number
      deadline: string | null
    }>
  }>({
    queryKey: ["/api/family/all-goals-summary"],
    queryFn: async () => {
      const res = await fetch("/api/family/all-goals-summary", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-purple-900 flex items-center gap-2">
          🎯 家庭目標進度（{data.total}）
        </h3>
        <div className="flex gap-1 text-xs">
          {data.completedReady > 0 && (
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
              ✅ {data.completedReady} 達成
            </span>
          )}
          {data.nearComplete > 0 && (
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
              🔥 {data.nearComplete} 接近
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {data.goals.map((g) => {
          const isReady = g.progress >= 100
          const isNear = g.progress >= 80 && !isReady
          return (
            <div
              key={g.id}
              className={`rounded-lg p-2 bg-white shadow-sm border-l-4 ${
                isReady ? "border-green-500" : isNear ? "border-amber-500" : "border-purple-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{g.kidAvatar}</span>
                <span className="text-xl">{g.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{g.name}</div>
                  <div className="text-xs text-gray-500">
                    {g.kidName}・${g.currentAmount} / ${g.targetAmount}
                  </div>
                </div>
                <span
                  className={`text-sm font-bold ${
                    isReady ? "text-green-700" : isNear ? "text-amber-700" : "text-purple-700"
                  }`}
                >
                  {g.progress}%
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={
                    isReady
                      ? "h-full bg-gradient-to-r from-green-400 to-emerald-500"
                      : isNear
                        ? "h-full bg-gradient-to-r from-amber-400 to-orange-500"
                        : "h-full bg-gradient-to-r from-purple-400 to-pink-400"
                  }
                  style={{ width: `${g.progress}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FamilyMonthlyStats() {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const { data } = useQuery<{
    month: string
    family: {
      tasksApproved: number
      totalReward: number
      totalSpent: number
      totalSaveUsed: number
      totalGiven: number
      checkinDays: number
    }
    perKid: Array<{
      kidId: number
      kidName: string
      avatar: string
      tasksApproved: number
      totalReward: number
      totalSpent: number
      totalSaveUsed: number
      totalGiven: number
      checkinDays: number
    }>
  }>({
    queryKey: ["/api/family/monthly-stats", currentMonth],
    queryFn: async () => {
      const res = await fetch(`/api/family/monthly-stats?month=${currentMonth}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.perKid.length === 0) return null

  const monthLabel = `${data.month.slice(0, 4)}/${data.month.slice(5)}`

  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 shadow">
      <h3 className="font-bold text-indigo-900 mb-3 flex items-center justify-between">
        <span>📊 全家本月（{monthLabel}）</span>
      </h3>

      {/* 全家 KPI 4 格 */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-xl font-bold text-indigo-700">{data.family.tasksApproved}</div>
          <div className="text-xs text-gray-500">完成任務</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-xl font-bold text-emerald-700">${data.family.totalReward}</div>
          <div className="text-xs text-gray-500">獎勵總額</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-xl font-bold text-rose-700">${data.family.totalSpent}</div>
          <div className="text-xs text-gray-500">花費</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-xl font-bold text-pink-700">${data.family.totalGiven}</div>
          <div className="text-xs text-gray-500">捐贈</div>
        </div>
      </div>

      {/* 每個小孩細項 */}
      <div className="space-y-1">
        {data.perKid.map((k) => (
          <div key={k.kidId} className="bg-white/70 rounded-lg p-2 flex items-center gap-2">
            <span className="text-2xl">{k.avatar}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">{k.kidName}</div>
              <div className="text-xs text-gray-600">
                {k.tasksApproved} 任務・領 ${k.totalReward}・花 ${k.totalSpent}・捐 ${k.totalGiven}
              </div>
            </div>
            {k.checkinDays > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {k.checkinDays} 天打卡
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyActivityFeed() {
  const [expanded, setExpanded] = useState(false)
  const { data } = useQuery<{
    activities: Array<{
      kind: "task" | "spending" | "checkin" | "wish"
      id: number
      kidId: number
      kidName: string
      kidAvatar: string
      label: string
      amount: string
      emoji: string | null
      at: string
    }>
  }>({
    queryKey: ["/api/family/activity"],
    queryFn: async () => {
      const res = await fetch("/api/family/activity?limit=30", { credentials: "include" })
      return res.json()
    },
  })

  const acts = data?.activities ?? []
  if (acts.length === 0) return null

  const visible = expanded ? acts : acts.slice(0, 6)

  const KIND_META: Record<string, { name: string; bg: string; fallback: string }> = {
    task: { name: "完成任務", bg: "bg-green-50 border-green-200", fallback: "📋" },
    spending: { name: "花錢", bg: "bg-rose-50 border-rose-200", fallback: "💸" },
    checkin: { name: "打卡", bg: "bg-amber-50 border-amber-200", fallback: "😊" },
    wish: { name: "願望", bg: "bg-violet-50 border-violet-200", fallback: "✨" },
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
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="font-bold text-gray-700">🌟 全家最近動態</h3>
        <span className="text-xs text-gray-400">{acts.length} 筆</span>
      </div>
      <div className="space-y-1">
        {visible.map((a) => {
          const meta = KIND_META[a.kind]
          return (
            <div
              key={`${a.kind}-${a.id}`}
              className={`flex items-center gap-2 p-2 rounded border ${meta.bg}`}
            >
              <span className="text-xl shrink-0">{a.kidAvatar}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-bold">{a.kidName}</span>{" "}
                  <span className="text-gray-600 text-xs">{meta.name}</span>{" "}
                  <span className="font-medium">{a.label}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {a.emoji || meta.fallback} {a.amount}
                </div>
              </div>
              <span className="text-xs text-gray-400 shrink-0">{timeAgo(a.at)}</span>
            </div>
          )
        })}
      </div>
      {acts.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full text-center text-sm text-blue-600 hover:text-blue-800"
        >
          {expanded ? "收起" : `看更多 (${acts.length - 6} 筆)`}
        </button>
      )}
    </div>
  )
}

export function KidsAttentionRadar() {
  const { data } = useQuery<{
    totalKids: number
    attentionCount: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      daysSinceTask: number | null
      daysSinceCheckin: number | null
      daysQuiet: number | null
      needsAttention: boolean
      message: string | null
    }>
  }>({
    queryKey: ["/api/family/kids-attention"],
    queryFn: async () => {
      const res = await fetch("/api/family/kids-attention", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.attentionCount === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow">
      <h3 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
        🧡 需要關心（{data.attentionCount}）
      </h3>
      <div className="space-y-2">
        {data.kids
          .filter((k) => k.needsAttention)
          .map((k) => (
            <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
              <span className="text-2xl shrink-0">{k.avatar}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{k.kidName}</div>
                {k.message && <div className="text-xs text-gray-600">{k.message}</div>}
                <div className="text-[10px] text-gray-400">
                  最近任務 {k.daysSinceTask === null ? "從未" : `${k.daysSinceTask} 天前`}
                  ・打卡 {k.daysSinceCheckin === null ? "從未" : `${k.daysSinceCheckin} 天前`}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
