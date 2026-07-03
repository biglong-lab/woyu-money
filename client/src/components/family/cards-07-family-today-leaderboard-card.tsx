/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-07-family-today-leaderboard-card，2026-07-03）
 */
import { useQuery } from "@tanstack/react-query"

export function FamilyTodayLeaderboardCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      tasks: number
      reward: number
      checkin: number
      spent: number
    }>
    topToday: { kidName: string; avatar: string; tasks: number } | null
    totalTasks: number
    totalReward: number
    message: string
  }>({
    queryKey: ["/api/family/today-leaderboard"],
  })
  if (!data || data.kids.length === 0) return null
  if (!data.topToday) return null

  const MEDAL = ["🥇", "🥈", "🥉"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🌟 今日排行榜</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          全家今日 {data.totalTasks} 個任務 / 入帳 ${data.totalReward}
        </div>
      </div>

      <div className="space-y-1.5">
        {data.kids
          .filter((k) => k.tasks > 0 || k.checkin > 0)
          .map((k, i) => (
            <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
              <div className="text-xl">{i < 3 ? MEDAL[i] : `${i + 1}`}</div>
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{k.kidName}</div>
                <div className="text-[10px] text-gray-500">
                  📋 {k.tasks} · ✅ {k.checkin} · 🛒 ${k.spent}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-amber-600">${k.reward}</div>
                <div className="text-[9px] text-gray-500">入帳</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export function FamilyTodayVsYesterdayCard() {
  const { data } = useQuery<{
    today: { tasks: number; reward: number; spent: number; given: number; checkins: number }
    yesterday: { tasks: number; reward: number; spent: number; given: number; checkins: number }
    deltas: Record<string, { abs: number; arrow: "↑" | "↓" | "→" }>
    message: string
  }>({
    queryKey: ["/api/family/today-vs-yesterday"],
  })
  if (!data) return null
  const totalToday = data.today.tasks + data.today.checkins
  const totalYesterday = data.yesterday.tasks + data.yesterday.checkins
  if (totalToday === 0 && totalYesterday === 0) return null

  const metrics: Array<{ key: keyof typeof data.today; label: string; emoji: string }> = [
    { key: "tasks", label: "任務", emoji: "📋" },
    { key: "reward", label: "入帳", emoji: "💰" },
    { key: "spent", label: "花用", emoji: "🛒" },
    { key: "given", label: "捐贈", emoji: "💝" },
    { key: "checkins", label: "打卡", emoji: "✅" },
  ]

  const ARROW_COLOR: Record<string, string> = {
    "↑": "text-emerald-600",
    "↓": "text-rose-500",
    "→": "text-gray-400",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⏳ 今日 vs 昨日</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-5 gap-1.5">
        {metrics.map((m) => {
          const t = data.today[m.key]
          const y = data.yesterday[m.key]
          const d = data.deltas[m.key]
          return (
            <div key={m.key} className="bg-white rounded-lg p-2 text-center">
              <div className="text-[10px] text-gray-500">
                {m.emoji} {m.label}
              </div>
              <div className="text-base font-bold">{t}</div>
              <div className={`text-[9px] ${ARROW_COLOR[d?.arrow ?? "→"]}`}>
                {d?.arrow} {d?.abs > 0 ? "+" : ""}
                {d?.abs}
              </div>
              <div className="text-[9px] text-gray-400">昨 {y}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FamilyKidAvgRewardCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      taskCount: number
      avgReward: number
      minReward: number
      maxReward: number
      totalReward: number
    }>
    topByAvg: { kidName: string; avatar: string; avgReward: number } | null
    message: string
  }>({
    queryKey: ["/api/family/kid-avg-reward?days=90"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.taskCount > 0)
  if (withTasks.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">💎 任務獎勵平均（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withTasks.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 text-sm font-medium">{k.kidName}</div>
              <div className="text-lg font-bold text-amber-600">${k.avgReward}</div>
              <div className="text-[10px] text-gray-500">平均</div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>共 {k.taskCount} 個</span>
              <span>最低 ${k.minReward}</span>
              <span>最高 ${k.maxReward}</span>
              <span>累計 ${k.totalReward}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyKidLearningCurveCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      accountAgeDays: number
      firstMonthTasks: number
      recentMonthTasks: number
      diff: number
      improvement: "rising" | "steady" | "declining" | "new" | "no_data"
    }>
    risingCount: number
    newCount: number
    message: string
  }>({
    queryKey: ["/api/family/kid-learning-curve"],
  })
  if (!data || data.kids.length === 0) return null

  const established = data.kids.filter(
    (k) => k.improvement !== "new" && k.improvement !== "no_data"
  )
  if (established.length === 0) return null

  const IMP_LABEL: Record<string, string> = {
    rising: "📈 進步",
    steady: "➖ 持平",
    declining: "📉 下滑",
    new: "🌱 新手",
    no_data: "—",
  }
  const IMP_COLOR: Record<string, string> = {
    rising: "bg-emerald-500 text-white",
    steady: "bg-blue-400 text-white",
    declining: "bg-rose-500 text-white",
    new: "bg-amber-300 text-amber-900",
    no_data: "bg-gray-300 text-gray-700",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-blue-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📈 學習曲線</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {established.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                首月 {k.firstMonthTasks} → 最近 {k.recentMonthTasks}（{k.diff >= 0 ? "+" : ""}
                {k.diff}）
              </div>
            </div>
            <div className={`text-[10px] px-1.5 py-0.5 rounded ${IMP_COLOR[k.improvement]}`}>
              {IMP_LABEL[k.improvement]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyKidFavoriteEmojiCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      favoriteEmoji: string | null
      count: number
    }>
    message: string
  }>({
    queryKey: ["/api/family/kid-favorite-emoji?days=90"],
  })
  if (!data) return null
  const withEmoji = data.kids.filter((k) => k.favoriteEmoji)
  if (withEmoji.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎨 最愛 emoji（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-2 gap-2">
        {withEmoji.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1 text-sm">{k.kidName}</div>
            <div className="text-right">
              <div className="text-2xl">{k.favoriteEmoji}</div>
              <div className="text-[9px] text-gray-500">用 {k.count} 次</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyKidPeakHourCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      peakHour: number | null
      peakCount: number
      peakLabel: string | null
    }>
    familyPeak: { hour: number; count: number } | null
    message: string
  }>({
    queryKey: ["/api/family/kid-peak-hour?days=30"],
  })
  if (!data || !data.familyPeak) return null

  const withPeak = data.kids.filter((k) => k.peakHour !== null)
  if (withPeak.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🕐 任務高峰小時（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          全家最常在 {data.familyPeak.hour < 12 ? "上午" : "下午"} {data.familyPeak.hour}:00
          完成任務
        </div>
      </div>

      <div className="space-y-1.5">
        {withPeak.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">{k.peakCount} 個任務</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-indigo-600">{k.peakLabel}</div>
              <div className="text-[9px] text-gray-500">最常做</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyDifficultyByKidCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      easy: number
      medium: number
      hard: number
      total: number
      hardRatio: number
      challengeLevel: "bold" | "balanced" | "safe" | "no_data"
    }>
    boldCount: number
    message: string
  }>({
    queryKey: ["/api/family/difficulty-by-kid?days=90"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.total > 0)
  if (withTasks.length === 0) return null

  const LEVEL_LABEL: Record<string, string> = {
    bold: "🚀 勇敢",
    balanced: "⚖️ 平衡",
    safe: "🛡️ 保守",
    no_data: "—",
  }
  const LEVEL_COLOR: Record<string, string> = {
    bold: "bg-rose-500 text-white",
    balanced: "bg-emerald-500 text-white",
    safe: "bg-blue-400 text-white",
    no_data: "bg-gray-300 text-gray-700",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⭐ 難度分佈對比（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withTasks.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">hard {k.hardRatio}%</div>
              <div className={`text-[10px] px-1.5 py-0.5 rounded ${LEVEL_COLOR[k.challengeLevel]}`}>
                {LEVEL_LABEL[k.challengeLevel]}
              </div>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
              {k.easy > 0 && (
                <div className="bg-green-400" style={{ width: `${(k.easy / k.total) * 100}%` }} />
              )}
              {k.medium > 0 && (
                <div className="bg-amber-400" style={{ width: `${(k.medium / k.total) * 100}%` }} />
              )}
              {k.hard > 0 && (
                <div className="bg-red-500" style={{ width: `${(k.hard / k.total) * 100}%` }} />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
              <span>⭐ easy {k.easy}</span>
              <span>⭐⭐ medium {k.medium}</span>
              <span>⭐⭐⭐ hard {k.hard}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyTaskSpeedMvpCard() {
  const { data } = useQuery<{
    days: number
    tasks: Array<{
      taskId: number
      title: string
      emoji: string
      reward: number
      seconds: number
      durationDisplay: string
      kidName: string
      kidAvatar: string
    }>
    message: string
  }>({
    queryKey: ["/api/family/task-speed-mvp?days=30&limit=5"],
  })
  if (!data || data.tasks.length === 0) return null

  const MEDAL = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⚡ 速度榮譽榜（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.tasks.map((t, i) => (
          <div key={t.taskId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-xl">{MEDAL[i]}</div>
            <div className="text-lg">{t.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{t.title}</div>
              <div className="text-[10px] text-gray-500">
                {t.kidAvatar} {t.kidName} · ${t.reward}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-green-600">{t.durationDisplay}</div>
              <div className="text-[9px] text-gray-500">處理</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyKidDailyAvgTasksCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      taskCount: number
      avgPerDay: number
      pace: "power" | "steady" | "occasional" | "idle"
    }>
    topAchiever: { kidName: string; avatar: string; avgPerDay: number } | null
    familyAvgPerDay: number
    message: string
  }>({
    queryKey: ["/api/family/kid-daily-avg-tasks?days=30"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.taskCount > 0)
  if (withTasks.length === 0) return null

  const PACE_LABEL: Record<string, string> = {
    power: "🚀 全力",
    steady: "💪 穩定",
    occasional: "🌱 偶爾",
    idle: "💤 停滯",
  }
  const PACE_COLOR: Record<string, string> = {
    power: "bg-emerald-500 text-white",
    steady: "bg-blue-400 text-white",
    occasional: "bg-amber-400 text-white",
    idle: "bg-gray-400 text-white",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-teal-400 bg-gradient-to-br from-teal-50 to-cyan-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏃 每日平均（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">全家平均每天 {data.familyAvgPerDay} 個任務</div>
      </div>

      <div className="space-y-1.5">
        {data.kids.map((k, i) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="w-4 text-center text-gray-500">{i + 1}</div>
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">共 {k.taskCount} 個</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-teal-600">{k.avgPerDay}</div>
              <div className="text-[9px] text-gray-500">/天</div>
            </div>
            <div className={`text-[10px] px-1.5 py-0.5 rounded ${PACE_COLOR[k.pace]}`}>
              {PACE_LABEL[k.pace]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyTaskCategoryByKidCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      categories: {
        housework: number
        study: number
        self_care: number
        kindness: number
        other: number
      }
      topCategory: string | null
      topCategoryLabel: string | null
      total: number
    }>
    message: string
  }>({
    queryKey: ["/api/family/task-category-by-kid?days=90"],
  })
  if (!data || data.kids.length === 0) return null
  const withTasks = data.kids.filter((k) => k.total > 0)
  if (withTasks.length === 0) return null

  const CAT_INFO = [
    { key: "housework", label: "🧹 家事", color: "bg-blue-400" },
    { key: "study", label: "📚 學習", color: "bg-purple-400" },
    { key: "self_care", label: "🧴 自理", color: "bg-pink-400" },
    { key: "kindness", label: "💝 善行", color: "bg-rose-400" },
    { key: "other", label: "📋 其他", color: "bg-gray-400" },
  ] as const

  return (
    <div className="mb-4 rounded-2xl border-2 border-fuchsia-300 bg-gradient-to-br from-fuchsia-50 to-purple-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎨 兒童分類偏好（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-2">
        {withTasks.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center justify-between mb-1 text-xs">
              <span>
                {k.avatar} {k.kidName}
              </span>
              <span className="text-[10px] text-gray-500">
                共 {k.total} 個 · 最愛 {k.topCategoryLabel}
              </span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
              {CAT_INFO.map((c) => {
                const count = k.categories[c.key as keyof typeof k.categories]
                const pct = k.total > 0 ? (count / k.total) * 100 : 0
                if (pct === 0) return null
                return (
                  <div
                    key={c.key}
                    className={c.color}
                    style={{ width: `${pct}%` }}
                    title={`${c.label}: ${count}`}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
