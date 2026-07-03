/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-11-family-spending-daily-card，2026-07-03）
 */
import { useQuery } from "@tanstack/react-query"

export function FamilySpendingDailyCard() {
  const { data } = useQuery<{
    daily: Array<{ date: string; weekday: string; spent: number; given: number; total: number }>
    summary: {
      days: number
      totalSpent: number
      totalGiven: number
      totalAll: number
      avgPerDay: number
      recent7Avg: number
    }
    trend: "spiking" | "rising" | "stable" | "declining" | "no_data"
    alert: boolean
    message: string
  }>({
    queryKey: ["/api/family/spending-daily?days=30"],
  })
  if (!data || data.summary.totalAll === 0) return null

  const max = Math.max(...data.daily.map((d) => d.total), 1)

  const TREND_BG: Record<string, string> = {
    spiking: "from-rose-50 to-red-50 border-rose-500",
    rising: "from-amber-50 to-orange-50 border-amber-300",
    stable: "from-blue-50 to-sky-50 border-blue-300",
    declining: "from-emerald-50 to-green-50 border-emerald-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${TREND_BG[data.trend]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">
        💸 家庭花用線（30 天）
        {data.alert && <span className="text-rose-600 text-sm">🚨 警示</span>}
      </h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          總花 ${data.summary.totalSpent} + 總捐 ${data.summary.totalGiven} = $
          {data.summary.totalAll} · 最近 7 天平均 ${data.summary.recent7Avg}/天
        </div>
      </div>

      <div className="flex items-end gap-0.5 h-20 bg-white/40 rounded p-2">
        {data.daily.map((d) => {
          const h = (d.total / max) * 100
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-end"
              title={`${d.date}: $${d.total}`}
            >
              <div
                className="w-full bg-gradient-to-t from-rose-400 to-pink-500 rounded-t"
                style={{ height: `${Math.max(h, 2)}%` }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FamilyTimeOfDayCard() {
  const { data } = useQuery<{
    days: number
    slotsLabeled: Record<string, { label: string; count: number }>
    total: number
    dominantSlot: "morning" | "afternoon" | "evening" | "late" | null
    message: string
  }>({
    queryKey: ["/api/family/time-of-day?days=30"],
  })
  if (!data || data.total === 0) return null

  const max = Math.max(...Object.values(data.slotsLabeled).map((s) => s.count), 1)

  const order: Array<keyof typeof data.slotsLabeled> = ["morning", "afternoon", "evening", "late"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🕐 家庭活躍時段（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1">
        {order.map((k) => {
          const slot = data.slotsLabeled[k]
          const ratio = (slot.count / max) * 100
          const isDom = data.dominantSlot === k
          return (
            <div key={k} className="flex items-center gap-2">
              <div className="w-24 text-xs">{slot.label}</div>
              <div className="flex-1 h-4 bg-white rounded overflow-hidden">
                <div
                  className={`h-full ${isDom ? "bg-indigo-600" : "bg-indigo-400"}`}
                  style={{ width: `${Math.max(ratio, 2)}%` }}
                />
              </div>
              <div className="w-8 text-right text-xs font-bold">{slot.count}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FamilyActivityStreakCard() {
  const { data } = useQuery<{
    currentStreak: number
    longestStreak: number
    activeDaysCount: number
    lookback: number
    activeRatio: number
    level: "legendary" | "great" | "good" | "starting" | "inactive"
    message: string
  }>({
    queryKey: ["/api/family/activity-streak"],
  })
  if (!data) return null
  if (data.longestStreak === 0) return null

  const LEVEL_BG: Record<string, string> = {
    legendary: "from-purple-50 to-pink-50 border-purple-500",
    great: "from-orange-50 to-red-50 border-orange-400",
    good: "from-emerald-50 to-green-50 border-emerald-300",
    starting: "from-sky-50 to-blue-50 border-sky-300",
    inactive: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🔥 家庭 streak</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-sm">{data.message}</div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-orange-600">{data.currentStreak}</div>
          <div className="text-[10px] text-gray-500">當前連續天數</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-violet-600">{data.longestStreak}</div>
          <div className="text-[10px] text-gray-500">歷史最長</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-blue-600">{data.activeRatio}%</div>
          <div className="text-[10px] text-gray-500">{data.lookback} 天活躍率</div>
        </div>
      </div>
    </div>
  )
}

export function FamilyTaskCadenceCard() {
  const { data } = useQuery<{
    byWeekday: Record<string, number>
    summary: {
      totalCreated: number
      avgPerDay: number
      busiestDate: string | null
      busiestCount: number
      consecutiveDryDays: number
      favWeekday: string | null
    }
    cadenceLevel: "very_active" | "active" | "occasional" | "rare" | "none"
    message: string
  }>({
    queryKey: ["/api/family/task-creation-cadence?days=30"],
  })
  if (!data) return null
  if (data.summary.totalCreated === 0) return null

  const LEVEL_BG: Record<string, string> = {
    very_active: "from-emerald-50 to-green-50 border-emerald-400",
    active: "from-blue-50 to-sky-50 border-blue-300",
    occasional: "from-amber-50 to-yellow-50 border-amber-300",
    rare: "from-rose-50 to-red-50 border-rose-300",
    none: "from-gray-50 to-slate-50 border-gray-300",
  }

  const WEEKDAY_LABELS: Record<string, string> = {
    Mon: "週一",
    Tue: "週二",
    Wed: "週三",
    Thu: "週四",
    Fri: "週五",
    Sat: "週六",
    Sun: "週日",
  }
  const maxWd = Math.max(...Object.values(data.byWeekday), 1)

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.cadenceLevel]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">📅 派任務節奏（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          總計派 {data.summary.totalCreated} 個 · 平均 {data.summary.avgPerDay}/天
          {data.summary.favWeekday && ` · 最常派：${WEEKDAY_LABELS[data.summary.favWeekday]}`}
        </div>
      </div>

      <div className="bg-white/40 rounded-lg p-2">
        <div className="text-[10px] text-gray-500 mb-1">星期分佈</div>
        <div className="flex items-end gap-1.5 h-16">
          {Object.entries(data.byWeekday).map(([wd, count]) => (
            <div key={wd} className="flex-1 flex flex-col items-center justify-end">
              <div className="text-[9px] text-gray-600">{count}</div>
              <div
                className="w-full bg-purple-500 rounded-t"
                style={{ height: `${Math.max((count / maxWd) * 100, 4)}%` }}
              />
              <div className="text-[9px] text-gray-500 mt-1">
                {WEEKDAY_LABELS[wd]?.slice(1) ?? wd}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function FamilyKidsLastActivityCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      lastTaskTitle: string | null
      latestType: "task" | "checkin" | "spending" | null
      latestAt: string | null
      daysSince: number | null
      attentionLevel: "ok" | "watch" | "alert" | "never"
      summary: string
    }>
    summary: { totalKids: number; alertCount: number; watchCount: number; okCount: number }
    message: string
  }>({
    queryKey: ["/api/family/kids-last-activity"],
  })
  if (!data || data.summary.totalKids === 0) return null

  const ROW_BG: Record<string, string> = {
    ok: "bg-emerald-50 border-emerald-200",
    watch: "bg-amber-50 border-amber-300",
    alert: "bg-rose-50 border-rose-400",
    never: "bg-gray-50 border-gray-300",
  }

  const TYPE_EMOJI: Record<string, string> = {
    task: "📋",
    checkin: "✅",
    spending: "🛒",
  }

  // 顯示策略：alert/watch 排前 + ok 排後（家長最先看到需要關注的）
  const sorted = [...data.kids].sort((a, b) => {
    const order = { alert: 0, watch: 1, never: 2, ok: 3 }
    return order[a.attentionLevel] - order[b.attentionLevel]
  })

  return (
    <div className="mb-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⏰ 最後活動追蹤</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {sorted.map((k) => (
          <div
            key={k.kidId}
            className={`flex items-center gap-2 rounded-lg p-2 border ${ROW_BG[k.attentionLevel]}`}
          >
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[11px] text-gray-600 truncate">
                {k.latestType && TYPE_EMOJI[k.latestType]} {k.summary}
                {k.lastTaskTitle && k.latestType === "task" && (
                  <span className="text-gray-500"> · 最後任務：{k.lastTaskTitle}</span>
                )}
              </div>
            </div>
            {k.daysSince !== null && (
              <div className="text-xs font-bold text-gray-700 whitespace-nowrap">
                {k.daysSince === 0 ? "今天" : `${k.daysSince}d`}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilySavingsRetentionCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      lifetimeEarned: number
      retentionRatio: number
      level: "super_saver" | "good_saver" | "spender" | "heavy_spender" | "no_data"
      levelLabel: string
    }>
    summary: {
      totalKids: number
      kidsWithData: number
      avgRetention: number
      topSaver: { kidName: string; retentionRatio: number } | null
    }
    familyLevel: "super_saver" | "good_saver" | "spender" | "heavy_spender" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/savings-retention"],
  })
  if (!data) return null
  if (data.summary.kidsWithData === 0) return null

  const FAMILY_BG: Record<string, string> = {
    super_saver: "from-yellow-50 to-amber-50 border-yellow-400",
    good_saver: "from-emerald-50 to-green-50 border-emerald-300",
    spender: "from-blue-50 to-sky-50 border-blue-300",
    heavy_spender: "from-rose-50 to-red-50 border-rose-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  const LEVEL_COLOR: Record<string, string> = {
    super_saver: "bg-yellow-400 text-yellow-900",
    good_saver: "bg-emerald-400 text-emerald-900",
    spender: "bg-blue-400 text-white",
    heavy_spender: "bg-rose-400 text-white",
    no_data: "bg-gray-300 text-gray-700",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${FAMILY_BG[data.familyLevel]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">💎 儲蓄留存率</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        {data.summary.topSaver && (
          <div className="text-gray-600 mt-1">
            👑 留存王：{data.summary.topSaver.kidName}（{data.summary.topSaver.retentionRatio}%）
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {data.kids.map((k) => (
          <div key={k.kidId} className="flex items-center gap-2 bg-white/80 rounded-lg p-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">累計 ${k.lifetimeEarned}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{k.retentionRatio}%</div>
              <div
                className={`text-[10px] px-1.5 py-0.5 rounded ${LEVEL_COLOR[k.level]} inline-block`}
              >
                {k.levelLabel}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyMultiMonthTrendCard() {
  const { data } = useQuery<{
    months: Array<{
      month: string
      tasks: number
      reward: number
      spent: number
      checkinDays: number
    }>
    summary: {
      totalTasks: number
      totalReward: number
      peakMonth: string | null
      peakTasks: number
    }
    trend: "growing" | "declining" | "steady" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/multi-month-trend?months=12"],
  })
  if (!data) return null
  if (data.summary.totalTasks === 0) return null

  const maxTasks = Math.max(...data.months.map((m) => m.tasks), 1)

  const TREND_BG: Record<string, string> = {
    growing: "from-emerald-50 to-green-50 border-emerald-300",
    declining: "from-amber-50 to-orange-50 border-amber-300",
    steady: "from-sky-50 to-blue-50 border-sky-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${TREND_BG[data.trend]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">📈 過去 12 個月趨勢</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        {data.summary.peakMonth && (
          <div className="text-gray-600 mt-1">
            高峰：{data.summary.peakMonth}（{data.summary.peakTasks} 個任務） · 累計{" "}
            {data.summary.totalTasks} 個 / ${data.summary.totalReward}
          </div>
        )}
      </div>

      <div className="flex items-end gap-1 h-24 bg-white/40 rounded p-2">
        {data.months.map((m) => {
          const h = (m.tasks / maxTasks) * 100
          return (
            <div
              key={m.month}
              className="flex-1 flex flex-col items-center justify-end"
              title={`${m.month}: ${m.tasks} 個任務 / $${m.reward}`}
            >
              <div className="text-[9px] text-gray-500">{m.tasks}</div>
              <div
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${Math.max(h, 2)}%` }}
              />
              <div className="text-[9px] text-gray-500 mt-1">{m.month.slice(5)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FamilyDailyRecapCard() {
  const { data } = useQuery<{
    days: Array<{
      date: string
      weekday: string
      tasks: number
      checkins: number
      spent: number
      given: number
      reward: number
      hasActivity: boolean
    }>
    summary: {
      totalDays: number
      activeDays: number
      activeRatio: number
      totalTasks: number
      totalReward: number
    }
    message: string
  }>({
    queryKey: ["/api/family/daily-recap?days=7"],
  })
  if (!data) return null

  const maxTasks = Math.max(...data.days.map((d) => d.tasks), 1)

  return (
    <div className="mb-4 rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-blue-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📅 一週日報</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message} · 活躍 {data.summary.activeDays}/{data.summary.totalDays} 天 · 完成{" "}
        {data.summary.totalTasks} 個任務（${data.summary.totalReward}）
      </div>

      <div className="space-y-1">
        {data.days.map((d) => {
          const isToday = d.date === new Date().toISOString().slice(0, 10)
          return (
            <div
              key={d.date}
              className={`flex items-center gap-2 text-xs ${isToday ? "font-bold" : ""}`}
            >
              <div className="w-16 text-gray-500">
                {d.date.slice(5)} ({d.weekday})
              </div>
              <div className="flex-1 h-4 bg-white rounded relative overflow-hidden">
                {d.tasks > 0 && (
                  <div
                    className="h-full bg-emerald-400"
                    style={{ width: `${(d.tasks / maxTasks) * 100}%` }}
                    title={`${d.tasks} 個任務`}
                  />
                )}
              </div>
              <div className="w-20 text-right text-gray-600">
                {d.hasActivity ? (
                  <span>
                    {d.tasks > 0 && `📋${d.tasks}`} {d.checkins > 0 && `✅${d.checkins}`}
                  </span>
                ) : (
                  <span className="text-gray-300">無</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FamilyStoryCard() {
  const { data } = useQuery<{
    month: string
    paragraphs: string[]
    stats: { totalTasks: number; totalReward: number; totalSpent: number; totalGiven: number }
    characters: { topPerformer: string | null }
  }>({
    queryKey: ["/api/family/family-story"],
  })
  if (!data) return null

  const copy = async () => {
    const text = `📖 ${data.month} 家庭故事\n\n${data.paragraphs.join("\n\n")}`
    try {
      await navigator.clipboard.writeText(text)
      alert("已複製到剪貼簿、可分享囉！")
    } catch {
      alert("複製失敗、請手動複製")
    }
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2">📖 {data.month} 家庭故事</h3>
        <button
          onClick={copy}
          className="text-xs px-2 py-1 bg-violet-600 text-white rounded hover:bg-violet-700"
        >
          📋 複製分享
        </button>
      </div>

      <div className="space-y-2 bg-white/70 rounded-lg p-3">
        {data.paragraphs.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed">
            {p}
          </p>
        ))}
      </div>
    </div>
  )
}
