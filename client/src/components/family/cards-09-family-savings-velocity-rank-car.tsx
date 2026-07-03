/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-09-family-savings-velocity-rank-car，2026-07-03）
 */
import { useQuery } from "@tanstack/react-query"
import { Task } from "./family-shared"

export function FamilySavingsVelocityRankCard() {
  const { data } = useQuery<{
    months: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      saveRatio: number
      monthlyVelocity: number
      currentSave: number
      monthsTo1000: number | null
    }>
    topSaver: {
      kidName: string
      avatar: string
      monthlyVelocity: number
      monthsTo1000: number | null
    } | null
    message: string
  }>({
    queryKey: ["/api/family/savings-velocity-rank?months=3"],
  })
  if (!data || data.kids.length === 0) return null
  const hasVelocity = data.kids.some((k) => k.monthlyVelocity > 0)
  if (!hasVelocity) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-cyan-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">💎 儲蓄速度排名（3 月）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        {data.topSaver && data.topSaver.monthsTo1000 !== null && data.topSaver.monthsTo1000 > 0 && (
          <div className="text-gray-600 mt-1">預估 {data.topSaver.monthsTo1000} 個月可達 $1000</div>
        )}
      </div>

      <div className="space-y-1.5">
        {data.kids.map((k, i) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="w-4 text-center text-gray-500">{i + 1}</div>
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                save {k.saveRatio}% · 目前 ${k.currentSave}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-emerald-600">+${k.monthlyVelocity}</div>
              <div className="text-[9px] text-gray-500">/月</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyTaskMonthlyGrowthCard() {
  const { data } = useQuery<{
    months: Array<{ month: string; tasks: number; growth: number | null }>
    totalTasks: number
    avgGrowth: number
    trend: "rising" | "steady" | "declining" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/task-monthly-growth?months=6"],
  })
  if (!data || data.totalTasks === 0) return null

  const TREND_BG: Record<string, string> = {
    rising: "from-emerald-50 to-green-50 border-emerald-500",
    steady: "from-blue-50 to-sky-50 border-blue-300",
    declining: "from-rose-50 to-red-50 border-rose-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  const maxTasks = Math.max(...data.months.map((m) => m.tasks), 1)

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${TREND_BG[data.trend]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">📈 月度成長率（6 月）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="flex items-end gap-1.5 h-20 bg-white/40 rounded p-2">
        {data.months.map((m) => {
          const h = (m.tasks / maxTasks) * 100
          return (
            <div
              key={m.month}
              className="flex-1 flex flex-col items-center justify-end"
              title={`${m.month}: ${m.tasks} 個${m.growth !== null ? `（${m.growth >= 0 ? "+" : ""}${m.growth}%）` : ""}`}
            >
              <div className="text-[9px] text-gray-600 font-bold">{m.tasks}</div>
              <div
                className={`w-full rounded-t ${m.growth !== null && m.growth >= 0 ? "bg-emerald-500" : m.growth !== null && m.growth < 0 ? "bg-rose-400" : "bg-blue-400"}`}
                style={{ height: `${Math.max(h, 2)}%` }}
              />
              <div className="text-[9px] text-gray-500 mt-1">{m.month.slice(5)}</div>
              {m.growth !== null && (
                <div
                  className={`text-[9px] font-bold ${m.growth >= 0 ? "text-emerald-600" : "text-rose-500"}`}
                >
                  {m.growth >= 0 ? "+" : ""}
                  {m.growth}%
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FamilyGoalAmountHistogramCard() {
  const { data } = useQuery<{
    buckets: Array<{ label: string; range: string; count: number }>
    stats: { total: number; active: number; completed: number; avg: number; max: number }
    dominantBucket: string
    pattern: "modest" | "balanced" | "ambitious" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/goal-amount-histogram"],
  })
  if (!data || data.stats.total === 0) return null

  const maxCount = Math.max(...data.buckets.map((b) => b.count), 1)

  const PATTERN_BG: Record<string, string> = {
    modest: "from-blue-50 to-cyan-50 border-blue-300",
    balanced: "from-emerald-50 to-green-50 border-emerald-400",
    ambitious: "from-violet-50 to-purple-50 border-violet-500",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${PATTERN_BG[data.pattern]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🎯 目標金額分佈</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          總共 {data.stats.total} 個 · 進行中 {data.stats.active} · 已達成 {data.stats.completed} ·
          最高 ${data.stats.max}
        </div>
      </div>

      <div className="space-y-1">
        {data.buckets.map((b) => (
          <div key={b.range} className="flex items-center gap-2 text-xs">
            <div className="w-20 text-right text-gray-600">{b.label}</div>
            <div className="flex-1 h-3 bg-white rounded overflow-hidden">
              {b.count > 0 && (
                <div
                  className={`h-full ${b.label === data.dominantBucket ? "bg-violet-600" : "bg-violet-400"}`}
                  style={{ width: `${(b.count / maxCount) * 100}%` }}
                />
              )}
            </div>
            <div className="w-8 text-right font-bold">{b.count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyTaskDurationCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      taskCount: number
      avgDays: number
    }>
    fastest: { kidName: string; avgDays: number } | null
    slowest: { kidName: string; avgDays: number } | null
    familyAvg: number
    message: string
  }>({
    queryKey: ["/api/family/task-duration?days=60"],
  })
  if (!data || data.kids.length === 0) return null
  const hasTask = data.kids.some((k) => k.taskCount > 0)
  if (!hasTask) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⏱️ Task 處理速度（60 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        {data.fastest && (
          <div className="text-gray-600 mt-1">
            ⚡ 最快：{data.fastest.kidName}（{data.fastest.avgDays} 天）
            {data.slowest && ` · 最慢：${data.slowest.kidName}（${data.slowest.avgDays} 天）`}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {data.kids
          .filter((k) => k.taskCount > 0)
          .map((k) => (
            <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1">
                <div className="text-sm font-medium">{k.kidName}</div>
                <div className="text-[10px] text-gray-500">{k.taskCount} 個任務</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-teal-600">{k.avgDays}</div>
                <div className="text-[9px] text-gray-500">平均天</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export function FamilySpendingTopItemsCard() {
  const { data } = useQuery<{
    days: number
    items: Array<{ description: string; count: number; total: number; percentage: number }>
    grandTotal: number
    message: string
  }>({
    queryKey: ["/api/family/spending-top-items?days=90&limit=10"],
  })
  if (!data || data.items.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🛒 花用 top 細項（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1">
        {data.items.map((it, i) => (
          <div key={i} className="bg-white rounded p-2">
            <div className="flex items-center justify-between mb-0.5 text-xs">
              <div className="flex-1 truncate">
                <span className="text-gray-400">#{i + 1}</span> {it.description}
              </div>
              <div className="font-bold">${it.total}</div>
            </div>
            <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-400 to-rose-500"
                style={{ width: `${it.percentage}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {it.count} 筆 · 占 {it.percentage}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyCaptainCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      tasks: number
      checkins: number
      goalsCompleted: number
      score: number
    }>
    captain: { kidName: string; avatar: string; score: number } | null
    message: string
  }>({
    queryKey: ["/api/family/captain?days=30"],
  })
  if (!data || data.kids.length === 0) return null
  if (!data.captain) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-yellow-500 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎖️ 家庭隊長（30 天）</h3>

      <div className="bg-white/80 rounded-lg p-3 mb-2 text-center">
        <div className="text-5xl mb-1">{data.captain.avatar}</div>
        <div className="text-lg font-bold">{data.captain.kidName}</div>
        <div className="text-2xl font-bold text-amber-600 mt-1">{data.captain.score} 分</div>
        <div className="text-[10px] text-gray-500 mt-1">{data.message}</div>
      </div>

      <div className="space-y-1">
        {data.kids.map((k, i) => (
          <div key={k.kidId} className="bg-white rounded p-1.5 flex items-center gap-2 text-xs">
            <div className="w-4 text-center text-gray-500">{i + 1}</div>
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1 truncate">{k.kidName}</div>
            <div className="text-[10px] text-gray-500">
              📋{k.tasks} ✅{k.checkins} 🎯{k.goalsCompleted}
            </div>
            <div className="font-bold text-amber-600">{k.score}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyMonthlyImprovementCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      thisMonth: number
      lastMonth: number
      diff: number
      improvement: number
      status: "improving" | "steady" | "declining" | "stagnated"
    }>
    topImprover: { kidName: string; avatar: string; improvement: number } | null
    stagnatedCount: number
    message: string
  }>({
    queryKey: ["/api/family/monthly-improvement-rank"],
  })
  if (!data || data.kids.length === 0) return null
  const hasActivity = data.kids.some((k) => k.thisMonth > 0 || k.lastMonth > 0)
  if (!hasActivity) return null

  const STATUS_COLOR: Record<string, string> = {
    improving: "bg-emerald-500 text-white",
    steady: "bg-blue-400 text-white",
    declining: "bg-rose-500 text-white",
    stagnated: "bg-gray-400 text-white",
  }

  const STATUS_LABEL: Record<string, string> = {
    improving: "📈 進步",
    steady: "➖ 持平",
    declining: "📉 下滑",
    stagnated: "💤 停滯",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏃 月度進步榜</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.kids.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                本月 {k.thisMonth} · 上月 {k.lastMonth} · {k.diff >= 0 ? "+" : ""}
                {k.diff}
              </div>
            </div>
            <div
              className={`text-[10px] px-2 py-0.5 rounded ${STATUS_COLOR[k.status]} whitespace-nowrap`}
            >
              {STATUS_LABEL[k.status]} {k.improvement >= 0 ? "+" : ""}
              {k.improvement}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyDeadlineHitRateCard() {
  const { data } = useQuery<{
    days: number
    stats: { total: number; onTime: number; late: number }
    hitRate: number
    level: "excellent" | "good" | "fair" | "poor" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/deadline-hit-rate?days=90"],
  })
  if (!data || data.stats.total === 0) return null

  const LEVEL_BG: Record<string, string> = {
    excellent: "from-emerald-50 to-green-50 border-emerald-500",
    good: "from-blue-50 to-sky-50 border-blue-400",
    fair: "from-amber-50 to-yellow-50 border-amber-400",
    poor: "from-rose-50 to-red-50 border-rose-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">⏰ Deadline 達標率（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-4 gap-2 mb-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-blue-600">{data.stats.total}</div>
          <div className="text-[10px] text-gray-500">總計</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-emerald-600">{data.stats.onTime}</div>
          <div className="text-[10px] text-gray-500">準時</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-rose-500">{data.stats.late}</div>
          <div className="text-[10px] text-gray-500">遲到</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-violet-600">{data.hitRate}%</div>
          <div className="text-[10px] text-gray-500">達標率</div>
        </div>
      </div>

      <div className="h-2 bg-white rounded overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
          style={{ width: `${data.hitRate}%` }}
        />
      </div>
    </div>
  )
}

export function FamilyTodayTipCard() {
  const { data } = useQuery<{
    tipType:
      | "pending_overflow"
      | "no_recent_activity"
      | "save_too_low"
      | "goal_stalled"
      | "encourage_checkin"
      | "positive"
      | "no_data"
    message: string
    action: string | null
  }>({
    queryKey: ["/api/family/today-tip"],
  })
  if (!data) return null
  if (data.tipType === "no_data") return null

  const TYPE_BG: Record<string, string> = {
    pending_overflow: "from-amber-50 to-orange-50 border-amber-400",
    no_recent_activity: "from-rose-50 to-red-50 border-rose-400",
    save_too_low: "from-violet-50 to-purple-50 border-violet-400",
    goal_stalled: "from-blue-50 to-sky-50 border-blue-400",
    encourage_checkin: "from-cyan-50 to-blue-50 border-cyan-400",
    positive: "from-emerald-50 to-green-50 border-emerald-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${TYPE_BG[data.tipType]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">💡 今日智能提示</h3>
      <div className="bg-white/70 rounded-lg p-2 text-sm">{data.message}</div>
    </div>
  )
}

export function FamilyPeakMomentCard() {
  const { data } = useQuery<{
    days: number
    top3: Array<{
      date: string
      weekday: string
      tasks: number
      checkins: number
      spendings: number
      score: number
    }>
    avgScore: number
    totalScore: number
    message: string
  }>({
    queryKey: ["/api/family/peak-moment?days=30"],
  })
  if (!data || data.totalScore === 0) return null

  const MEDAL = ["🥇", "🥈", "🥉"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏆 家庭高峰時刻（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.top3.map((d, i) => (
          <div key={d.date} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-2xl">{MEDAL[i]}</div>
            <div className="flex-1">
              <div className="text-sm font-bold">
                {d.date} ({d.weekday})
              </div>
              <div className="text-[10px] text-gray-500">
                📋 {d.tasks} 任務 · ✅ {d.checkins} 打卡 · 🛒 {d.spendings} 花用
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600">{d.score}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-[10px] text-gray-600 text-center">
        平均每天 {data.avgScore} 個活動
      </div>
    </div>
  )
}

export function FamilyGoalsProgressRankCard() {
  const { data } = useQuery<{
    goals: Array<{
      goalId: number
      goalName: string
      goalEmoji: string
      target: number
      current: number
      progress: number
      deadline: string | null
      daysUntilDeadline: number | null
      kidName: string
      kidAvatar: string
      stage: "near_complete" | "midway" | "starting"
    }>
    total: number
    nearCompleteCount: number
    message: string
  }>({
    queryKey: ["/api/family/goals-progress-rank?limit=10"],
  })
  if (!data || data.total === 0) return null

  const STAGE_COLOR: Record<string, string> = {
    near_complete: "bg-emerald-500",
    midway: "bg-blue-500",
    starting: "bg-amber-400",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎯 目標進度排名（即將達成）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.goals.slice(0, 6).map((g) => (
          <div key={g.goalId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{g.goalEmoji}</span>
              <span className="text-xs flex-1 font-medium truncate">{g.goalName}</span>
              <span className="text-xs text-gray-500">
                {g.kidAvatar} {g.kidName}
              </span>
              <span className="text-sm font-bold">{g.progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded overflow-hidden">
              <div
                className={`h-full ${STAGE_COLOR[g.stage]}`}
                style={{ width: `${g.progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>
                ${g.current} / ${g.target}
              </span>
              {g.daysUntilDeadline !== null && (
                <span className={g.daysUntilDeadline < 7 ? "text-red-600 font-bold" : ""}>
                  剩 {g.daysUntilDeadline} 天
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
