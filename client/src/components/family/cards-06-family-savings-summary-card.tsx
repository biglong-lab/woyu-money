/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-06-family-savings-summary-card，2026-07-03）
 */
import { useQuery } from "@tanstack/react-query"

export function FamilySavingsSummaryCard() {
  const { data } = useQuery<{
    goalCount: number
    uniqueKids: number
    totalTarget: number
    totalCurrent: number
    amountToGo: number
    overallProgress: number
    nearComplete: number
    starting: number
    message: string
  }>({
    queryKey: ["/api/family/savings-summary"],
  })
  if (!data || data.goalCount === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🐷 家庭儲蓄總進度</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-3 mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">已存 / 目標</span>
          <span className="font-bold text-emerald-700">{data.overallProgress}%</span>
        </div>
        <div className="w-full bg-emerald-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-400 to-green-500 h-3 transition-all"
            style={{ width: `${data.overallProgress}%` }}
          />
        </div>
        <div className="text-[10px] text-gray-500 mt-1">
          ${Math.round(data.totalCurrent).toLocaleString()} / $
          {Math.round(data.totalTarget).toLocaleString()} · 還差 $
          {Math.round(data.amountToGo).toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 text-xs">
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-emerald-700">{data.goalCount}</div>
          <div className="text-[10px] text-gray-500">總目標</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-orange-600">{data.nearComplete}</div>
          <div className="text-[10px] text-gray-500">即將達成</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-blue-600">{data.uniqueKids}</div>
          <div className="text-[10px] text-gray-500">參與小孩</div>
        </div>
      </div>
    </div>
  )
}

export function FamilyRecentBadgesCard() {
  const { data } = useQuery<{
    days: number
    badges: Array<{
      badgeId: number
      badgeType: string
      title: string
      emoji: string
      earnedAt: string
      kidName: string
      kidAvatar: string
    }>
    badgeCount: number
    uniqueKids: number
    uniqueTypes: number
    message: string
  }>({
    queryKey: ["/api/family/recent-badges?days=30&limit=20"],
  })
  if (!data || data.badgeCount === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-fuchsia-300 bg-gradient-to-br from-fuchsia-50 to-pink-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏅 30 天徽章時間軸</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {data.badges.map((b) => (
          <div
            key={b.badgeId}
            className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs border-l-4 border-fuchsia-400"
          >
            <div className="text-xl">{b.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{b.title}</div>
              <div className="text-[10px] text-gray-500">
                {b.kidAvatar} {b.kidName} · {b.earnedAt?.slice(0, 10)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyTaskHourDistributionCard() {
  const { data } = useQuery<{
    days: number
    hours: Array<{ hour: number; taskCount: number }>
    segments: Array<{
      key: string
      label: string
      emoji: string
      taskCount: number
      percentage: number
    }>
    totalCount: number
    peakSegment: { label: string; emoji: string; percentage: number } | null
    message: string
  }>({
    queryKey: ["/api/family/task-hour-distribution?days=30"],
  })
  if (!data || data.totalCount === 0) return null

  const maxHourCount = Math.max(...data.hours.map((h) => h.taskCount), 1)

  return (
    <div className="mb-4 rounded-2xl border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⏰ 30 天完成時段熱力圖</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      {/* 4 段大區塊 */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        {data.segments.map((s) => (
          <div key={s.key} className="bg-white rounded-lg p-2 text-center">
            <div className="text-lg">{s.emoji}</div>
            <div className="text-[9px] text-gray-500 truncate">{s.label.split(" ")[0]}</div>
            <div className="text-xs font-bold text-teal-700">{s.percentage}%</div>
            <div className="text-[9px] text-gray-400">{s.taskCount} 次</div>
          </div>
        ))}
      </div>

      {/* 24 小時 mini bar */}
      <div className="bg-white rounded-lg p-2">
        <div className="text-[10px] text-gray-500 mb-1">每小時完成數</div>
        <div className="flex items-end gap-[1px] h-12">
          {data.hours.map((h) => {
            const height = (h.taskCount / maxHourCount) * 100
            return (
              <div
                key={h.hour}
                className="flex-1 bg-teal-400 rounded-t hover:bg-teal-600 transition-colors"
                style={{ height: `${Math.max(2, height)}%` }}
                title={`${h.hour}:00 — ${h.taskCount} 次`}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-[8px] text-gray-400 mt-1">
          <span>0</span>
          <span>6</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
      </div>
    </div>
  )
}

export function FamilyCategoryBreakdownCard() {
  const { data } = useQuery<{
    days: number
    categories: Array<{
      category: string
      label: string
      emoji: string
      taskCount: number
      totalReward: number
      uniqueKids: number
      percentage: number
    }>
    totalCount: number
    topCategory: { label: string; emoji: string } | null
    message: string
  }>({
    queryKey: ["/api/family/task-category-breakdown?days=30"],
  })
  if (!data || data.categories.length === 0) return null

  const COLORS: Record<string, string> = {
    housework: "bg-emerald-400",
    study: "bg-blue-400",
    self_care: "bg-purple-400",
    kindness: "bg-rose-400",
    other: "bg-gray-400",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-blue-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📊 30 天任務類別分佈</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-2">
        {data.categories.map((c) => (
          <div key={c.category} className="bg-white rounded-lg p-2">
            <div className="flex items-center justify-between mb-1 text-xs">
              <span className="font-medium">
                {c.emoji} {c.label}
              </span>
              <span className="text-gray-500">
                {c.taskCount} 次 · ${Math.round(c.totalReward)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`${COLORS[c.category] ?? "bg-gray-400"} h-3 transition-all`}
                  style={{ width: `${c.percentage}%` }}
                />
              </div>
              <span className="text-xs font-bold w-10 text-right">{c.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyProofImageWallCard() {
  const { data } = useQuery<{
    days: number
    photos: Array<{
      taskId: number
      title: string
      emoji: string
      reward: number
      proofImageUrl: string
      approvedAt: string
      kidName: string
      kidAvatar: string
    }>
    photoCount: number
    uniqueKids: number
    message: string
  }>({
    queryKey: ["/api/family/proof-image-wall?days=7"],
  })
  if (!data || data.photos.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-cyan-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📸 努力證明照片牆</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-3 gap-2">
        {data.photos.map((p) => (
          <a
            key={p.taskId}
            href={p.proofImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <img
              src={p.proofImageUrl}
              alt={p.title}
              className="w-full h-24 object-cover"
              loading="lazy"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
              <div className="text-[9px] text-white truncate">
                {p.kidAvatar} {p.kidName}
              </div>
              <div className="text-[9px] text-white truncate">
                {p.emoji} {p.title}
              </div>
            </div>
            <div className="absolute top-1 right-1 bg-amber-400 text-[9px] font-bold px-1 rounded">
              ${p.reward}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

export function FamilyStalePendingTasksCard() {
  const { data } = useQuery<{
    days: number
    tasks: Array<{
      taskId: number
      title: string
      emoji: string
      reward: number
      kidName: string
      kidAvatar: string
      waitingDays: number
    }>
    totalForgotten: number
    maxWaitingDays: number
    severity: "ok" | "warn" | "alert"
    message: string
  }>({
    queryKey: ["/api/family/stale-pending-tasks?days=3"],
  })
  if (!data || data.tasks.length === 0) return null

  const borderColor = data.severity === "alert" ? "border-red-500" : "border-orange-400"
  const bgGradient =
    data.severity === "alert" ? "from-red-50 to-orange-50" : "from-orange-50 to-amber-50"

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${borderColor} bg-gradient-to-br ${bgGradient} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">
        {data.severity === "alert" ? "🚨" : "⏳"} 別忘了批准小孩的努力
      </h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs font-medium">{data.message}</div>

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {data.tasks.map((t) => (
          <div key={t.taskId} className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs">
            <div className="text-lg">{t.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.title}</div>
              <div className="text-[10px] text-gray-500">
                {t.kidAvatar} {t.kidName} · 等了 {t.waitingDays} 天
              </div>
            </div>
            <div className="text-sm font-bold text-red-600">${t.reward}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyTaskRepeatByKidCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      total: number
      uniqueTitles: number
      repeatRate: number
      pattern: "routine" | "mixed" | "variety" | "no_data"
    }>
    patternCounts: { routine: number; mixed: number; variety: number }
    message: string
  }>({
    queryKey: ["/api/family/task-repeat-by-kid?days=90"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.total > 0)
  if (withTasks.length === 0) return null

  const PATTERN_LABEL: Record<string, string> = {
    routine: "📋 日常型",
    mixed: "⚖️ 混合型",
    variety: "🎨 嘗鮮型",
    no_data: "—",
  }
  const PATTERN_COLOR: Record<string, string> = {
    routine: "bg-blue-100 text-blue-700",
    mixed: "bg-emerald-100 text-emerald-700",
    variety: "bg-purple-100 text-purple-700",
    no_data: "bg-gray-100 text-gray-500",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🔁 任務重複率（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withTasks.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                {k.uniqueTitles} 種 / 共 {k.total} 個 · 重複率 {k.repeatRate}%
              </div>
            </div>
            <div className={`text-[10px] px-1.5 py-0.5 rounded ${PATTERN_COLOR[k.pattern]}`}>
              {PATTERN_LABEL[k.pattern]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyFirstTaskTimelineCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      accountAgeDays: number
      firstTaskAt: string | null
      daysToFirstTask: number | null
      speed: "instant" | "fast" | "normal" | "slow" | "never"
    }>
    fastestStart: { kidName: string; avatar: string; daysToFirstTask: number | null } | null
    neverCount: number
    message: string
  }>({
    queryKey: ["/api/family/first-task-timeline"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.speed !== "never")
  if (withTasks.length === 0) return null

  const SPEED_LABEL: Record<string, string> = {
    instant: "⚡ 當天",
    fast: "🚀 一週內",
    normal: "👍 一月內",
    slow: "🐢 超過一月",
    never: "—",
  }
  const SPEED_COLOR: Record<string, string> = {
    instant: "bg-emerald-500 text-white",
    fast: "bg-blue-400 text-white",
    normal: "bg-amber-400 text-white",
    slow: "bg-rose-400 text-white",
    never: "bg-gray-300 text-gray-700",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🌱 首次任務速度</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withTasks.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                {k.daysToFirstTask} 天 · 帳齡 {k.accountAgeDays} 天
              </div>
            </div>
            <div className={`text-[10px] px-1.5 py-0.5 rounded ${SPEED_COLOR[k.speed]}`}>
              {SPEED_LABEL[k.speed]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyKidWeekendVsWeekdayCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      weekendTasks: number
      weekdayTasks: number
      weekendAvg: number
      weekdayAvg: number
      type: "weekend_warrior" | "weekday_focused" | "balanced" | "no_data"
    }>
    typeCounts: { weekend_warrior: number; weekday_focused: number; balanced: number }
    message: string
  }>({
    queryKey: ["/api/family/kid-weekend-vs-weekday?days=60"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.type !== "no_data")
  if (withTasks.length === 0) return null

  const TYPE_LABEL: Record<string, string> = {
    weekend_warrior: "🏖️ 週末戰士",
    weekday_focused: "💼 平日專注",
    balanced: "⚖️ 平衡",
    no_data: "—",
  }
  const TYPE_COLOR: Record<string, string> = {
    weekend_warrior: "bg-purple-100 text-purple-700",
    weekday_focused: "bg-blue-100 text-blue-700",
    balanced: "bg-emerald-100 text-emerald-700",
    no_data: "bg-gray-100 text-gray-500",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-blue-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📆 週末 vs 平日（60 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withTasks.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 text-sm font-medium">{k.kidName}</div>
              <div className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_COLOR[k.type]}`}>
                {TYPE_LABEL[k.type]}
              </div>
            </div>
            <div className="text-[10px] text-gray-500 flex justify-between">
              <span>
                🏖️ 週末 {k.weekendTasks}（日均 {k.weekendAvg}）
              </span>
              <span>
                💼 平日 {k.weekdayTasks}（日均 {k.weekdayAvg}）
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyAllGoalsEtaCard() {
  const { data } = useQuery<{
    goals: Array<{
      goalId: number
      goalName: string
      goalEmoji: string
      target: number
      current: number
      remaining: number
      kidName: string
      kidAvatar: string
      velocity: number
      etaDays: number | null
      etaDate: string | null
      predictable: boolean
    }>
    predictableCount: number
    message: string
  }>({
    queryKey: ["/api/family/all-goals-eta"],
  })
  if (!data || data.goals.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⏱️ 所有目標 ETA</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.goals.slice(0, 6).map((g) => (
          <div key={g.goalId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1 text-xs">
              <span className="text-lg">{g.goalEmoji}</span>
              <span className="flex-1 truncate font-medium">{g.goalName}</span>
              <span className="text-[10px] text-gray-500">
                {g.kidAvatar} {g.kidName}
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>
                ${g.current}/${g.target}（差 ${g.remaining}）
              </span>
              {g.predictable && g.etaDays !== null ? (
                <span className="font-bold text-blue-600">
                  {g.etaDays === 0 ? "已達成" : `${g.etaDays} 天後`}
                  {g.etaDate && g.etaDays > 0 ? `（${g.etaDate.slice(5)}）` : ""}
                </span>
              ) : (
                <span className="text-amber-600">無法預估</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
