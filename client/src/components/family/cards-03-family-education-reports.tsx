/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-03-family-education-reports，2026-07-03）
 */
import { useQuery } from "@tanstack/react-query"

import { KidEducationCard } from "./cards-02-mood-trends"

export function FamilyEducationReports() {
  const { data: kids } = useQuery<
    Array<{ id: number; displayName: string; avatar: string; isActive: boolean }>
  >({
    queryKey: ["/api/family/kids"],
    queryFn: async () => {
      const res = await fetch("/api/family/kids", { credentials: "include" })
      return res.json()
    },
  })
  if (!kids || kids.length === 0) return null
  const activeKids = kids.filter((k) => k.isActive !== false)
  if (activeKids.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow">
      <h3 className="font-bold text-violet-900 mb-3 flex items-center gap-2">🎓 教育成果報告</h3>
      <div className="space-y-2">
        {activeKids.map((k) => (
          <KidEducationCard key={k.id} kidId={k.id} kidName={k.displayName} avatar={k.avatar} />
        ))}
      </div>
      <div className="text-[11px] text-violet-600 mt-2 text-center">
        4 維度：主動性 / 儲蓄能力 / 同理心 / 規律性
      </div>
    </div>
  )
}

export function FairnessCard() {
  const { data } = useQuery<{
    days: number
    totalTasks: number
    expectedPerKid: number
    fairnessLevel: "fair" | "ok" | "unbalanced" | "biased" | "n/a"
    message: string
    maxKid: { kidName: string; avatar: string; taskPercentage: number } | null
    minKid: { kidName: string; avatar: string; taskPercentage: number } | null
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      tasks: number
      reward: number
      taskPercentage: number
    }>
  }>({
    queryKey: ["/api/family/fairness"],
    queryFn: async () => {
      const res = await fetch("/api/family/fairness?days=30", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.fairnessLevel === "n/a" || data.totalTasks === 0) return null

  const LEVEL_COLOR: Record<string, string> = {
    fair: "border-emerald-300 from-emerald-50 to-green-50 text-emerald-900",
    ok: "border-blue-300 from-blue-50 to-sky-50 text-blue-900",
    unbalanced: "border-amber-300 from-amber-50 to-yellow-50 text-amber-900",
    biased: "border-rose-400 from-rose-50 to-red-50 text-rose-900",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_COLOR[data.fairnessLevel] || ""} p-4 shadow`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2">⚖️ 任務公平度（{data.days} 天）</h3>
        <span className="text-xs opacity-75">
          {data.totalTasks} 任務・每人 {data.expectedPerKid}%
        </span>
      </div>

      <div className="bg-white/70 rounded-lg p-2 mb-3 text-sm font-medium">{data.message}</div>

      <div className="space-y-1">
        {data.kids
          .filter((k) => k.tasks > 0)
          .map((k) => (
            <div key={k.kidId} className="bg-white rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{k.avatar}</span>
                <span className="text-sm font-bold flex-1">{k.kidName}</span>
                <span className="text-xs font-bold">
                  {k.tasks} 任務（{k.taskPercentage}%）
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                  style={{ width: `${k.taskPercentage}%` }}
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export function SiblingComparisonCard() {
  const { data } = useQuery<{
    kidCount: number
    message?: string
    familyAvg?: { tasks: number; reward: number; spent: number; given: number }
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      tasks: number
      reward: number
      spent: number
      given: number
      ratios: { tasks: number; reward: number; spent: number; given: number }
      highlights: string[]
    }>
  }>({
    queryKey: ["/api/family/sibling-comparison"],
    queryFn: async () => {
      const res = await fetch("/api/family/sibling-comparison", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.kidCount < 2 || data.kids.length === 0) return null

  function ratioColor(r: number) {
    if (r >= 1.5) return "text-emerald-700 bg-emerald-50"
    if (r >= 1.0) return "text-blue-700 bg-blue-50"
    if (r >= 0.5) return "text-amber-700 bg-amber-50"
    return "text-rose-700 bg-rose-50"
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 shadow">
      <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">⚖️ 兄弟姊妹比較</h3>

      {/* 家庭平均 */}
      {data.familyAvg && (
        <div className="bg-white rounded-lg p-2 mb-3 text-center text-xs text-gray-600">
          家庭平均：{data.familyAvg.tasks} 任務・$ {data.familyAvg.reward} 獎勵
        </div>
      )}

      {/* 每個小孩 */}
      <div className="space-y-2">
        {data.kids.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-2xl">{k.avatar}</span>
              <span className="font-bold text-sm flex-1">{k.kidName}</span>
              <span className="text-xs text-gray-500">
                {k.tasks} 任務・$ {k.reward}
              </span>
            </div>

            {/* 4 個 ratio */}
            <div className="grid grid-cols-4 gap-1 mb-1">
              {[
                { key: "tasks", label: "任務", r: k.ratios.tasks },
                { key: "reward", label: "獎勵", r: k.ratios.reward },
                { key: "spent", label: "花用", r: k.ratios.spent },
                { key: "given", label: "捐贈", r: k.ratios.given },
              ].map((m) => (
                <div key={m.key} className={`text-center rounded p-1 text-xs ${ratioColor(m.r)}`}>
                  <div className="font-bold">{m.r.toFixed(1)}×</div>
                  <div className="opacity-70">{m.label}</div>
                </div>
              ))}
            </div>

            {/* highlights */}
            {k.highlights.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {k.highlights.map((h) => (
                  <span
                    key={h}
                    className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold"
                  >
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyMilestonesCard() {
  const { data } = useQuery<{
    totals: { tasks: number; reward: number; given: number; saved: number; checkins: number }
    milestones: Array<{
      key: string
      name: string
      unit: string
      total: number
      reached: Array<{ value: number; emoji: string; label: string }>
      next: {
        value: number
        emoji: string
        label: string
        remaining: number
        progress: number
      } | null
      complete: boolean
    }>
    summary: { totalReached: number; totalPossible: number }
  }>({
    queryKey: ["/api/family/milestones"],
    queryFn: async () => {
      const res = await fetch("/api/family/milestones", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.summary.totalReached === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-amber-900 flex items-center gap-2">🏛️ 家庭里程碑</h3>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
          {data.summary.totalReached} / {data.summary.totalPossible}
        </span>
      </div>

      <div className="space-y-2">
        {data.milestones.map((m) => (
          <div
            key={m.key}
            className={`rounded-lg p-2 ${
              m.complete ? "bg-emerald-50 border border-emerald-300" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-1 text-sm">
              <span className="font-medium">{m.name}</span>
              <span className="text-xs text-gray-500">
                {m.total} {m.unit}
              </span>
            </div>

            {/* 已達成徽章 */}
            <div className="flex gap-1 mb-1">
              {m.reached.map((r) => (
                <span
                  key={r.value}
                  className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"
                  title={r.label}
                >
                  {r.emoji} {r.label}
                </span>
              ))}
              {m.complete && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                  🎊 全達成
                </span>
              )}
            </div>

            {/* 下一個目標 */}
            {m.next && (
              <>
                <div className="text-xs text-gray-600 mb-0.5">
                  下個：{m.next.emoji} {m.next.label}（還差 {m.next.remaining} {m.unit}）
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                    style={{ width: `${m.next.progress}%` }}
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyWealthTrend() {
  const { data } = useQuery<{
    months: number
    summary: { totalReward: number; totalSpent: number; totalGiven: number; totalNet: number }
    trend: Array<{
      month: string
      reward: number
      spent: number
      given: number
      net: number
    }>
  }>({
    queryKey: ["/api/family/wealth-trend"],
    queryFn: async () => {
      const res = await fetch("/api/family/wealth-trend?months=6", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.summary.totalReward === 0) return null

  // 取最大值給 bar 縮放
  const peak = Math.max(...data.trend.map((t) => Math.max(t.reward, t.spent, t.given)))

  return (
    <div className="mb-4 rounded-2xl border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50 p-4 shadow">
      <h3 className="font-bold text-teal-900 mb-3 flex items-center gap-2">
        📈 6 個月家庭財富趨勢
      </h3>

      {/* 4 格 summary */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        <div className="bg-white rounded p-2 text-center">
          <div className="text-xs text-gray-500">總獎勵</div>
          <div className="text-sm font-bold text-emerald-700">${data.summary.totalReward}</div>
        </div>
        <div className="bg-white rounded p-2 text-center">
          <div className="text-xs text-gray-500">總花費</div>
          <div className="text-sm font-bold text-rose-700">${data.summary.totalSpent}</div>
        </div>
        <div className="bg-white rounded p-2 text-center">
          <div className="text-xs text-gray-500">總捐贈</div>
          <div className="text-sm font-bold text-pink-700">${data.summary.totalGiven}</div>
        </div>
        <div className="bg-white rounded p-2 text-center">
          <div className="text-xs text-gray-500">淨累積</div>
          <div className="text-sm font-bold text-teal-700">${data.summary.totalNet}</div>
        </div>
      </div>

      {/* 6 個月直條圖 */}
      <div className="flex gap-1 items-end h-24">
        {data.trend.map((t) => {
          const monthLabel = t.month.slice(5)
          return (
            <div key={t.month} className="flex-1 flex flex-col items-center">
              <div className="flex-1 w-full flex gap-0.5 items-end">
                {/* reward (emerald) */}
                <div
                  className="flex-1 bg-emerald-400 rounded-t"
                  style={{ height: peak > 0 ? `${(t.reward / peak) * 100}%` : "0%" }}
                  title={`獎勵 $${t.reward}`}
                />
                {/* spent (rose) */}
                <div
                  className="flex-1 bg-rose-400 rounded-t"
                  style={{ height: peak > 0 ? `${(t.spent / peak) * 100}%` : "0%" }}
                  title={`花費 $${t.spent}`}
                />
                {/* given (pink) */}
                <div
                  className="flex-1 bg-pink-400 rounded-t"
                  style={{ height: peak > 0 ? `${(t.given / peak) * 100}%` : "0%" }}
                  title={`捐贈 $${t.given}`}
                />
              </div>
              <div className="text-xs text-gray-600 mt-1">{monthLabel}</div>
            </div>
          )
        })}
      </div>

      {/* 圖例 */}
      <div className="flex justify-center gap-3 mt-2 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-emerald-400 rounded inline-block" />
          獎勵
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-rose-400 rounded inline-block" />
          花費
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-pink-400 rounded inline-block" />
          捐贈
        </span>
      </div>
    </div>
  )
}

export function GoalAchieversCard() {
  const { data } = useQuery<{
    totalGoals: number
    champion: {
      kidName: string
      avatar: string
      goalsCompleted: number
      totalTarget: number
    } | null
    achievers: Array<{
      kidId: number
      kidName: string
      avatar: string
      goalsCompleted: number
      totalTarget: number
      avgDays: number
    }>
  }>({
    queryKey: ["/api/family/goal-achievers"],
    queryFn: async () => {
      const res = await fetch("/api/family/goal-achievers", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.totalGoals === 0) return null

  const medals = ["🥇", "🥈", "🥉", "🏅", "🏅"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-amber-900 flex items-center gap-2">🎖️ 目標達成排行</h3>
        <span className="text-xs text-gray-500">共 {data.totalGoals} 個達成</span>
      </div>

      {data.champion && (
        <div className="bg-white rounded-lg p-3 mb-3 text-center">
          <div className="text-4xl mb-1">{data.champion.avatar}</div>
          <div className="text-sm font-bold text-amber-900">存錢王：{data.champion.kidName}</div>
          <div className="text-xs text-gray-600">
            達成 {data.champion.goalsCompleted} 個・累積 ${data.champion.totalTarget}
          </div>
        </div>
      )}

      <div className="space-y-1">
        {data.achievers
          .filter((a) => a.goalsCompleted > 0)
          .map((a, i) => (
            <div key={a.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
              <span className="text-xl shrink-0">{medals[i] ?? "🏅"}</span>
              <span className="text-lg shrink-0">{a.avatar}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{a.kidName}</div>
                <div className="text-xs text-gray-500">
                  {a.goalsCompleted} 個目標・${a.totalTarget}・平均 {a.avgDays} 天
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

export function CompletedGoalsHistory() {
  const { data } = useQuery<{
    total: number
    totalTarget: number
    avgDaysTaken: number
    fastestGoal: {
      name: string
      emoji: string
      daysTaken: number
      kidName: string
      avatar: string
    } | null
    largestGoal: {
      name: string
      emoji: string
      targetAmount: number
      kidName: string
      avatar: string
    } | null
    goals: Array<{
      id: number
      name: string
      emoji: string
      targetAmount: number
      kidName: string
      avatar: string
      daysTaken: number
      reflection: string | null
      completedAt: string | null
    }>
  }>({
    queryKey: ["/api/family/completed-goals-history"],
    queryFn: async () => {
      const res = await fetch("/api/family/completed-goals-history?limit=20", {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-green-900 flex items-center gap-2">
          🎊 達成的目標（{data.total}）
        </h3>
        <span className="text-xs text-gray-500">累積 ${data.totalTarget}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {data.fastestGoal && (
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">最快達成</div>
            <div className="text-2xl">{data.fastestGoal.emoji}</div>
            <div className="text-xs font-bold truncate">{data.fastestGoal.name}</div>
            <div className="text-xs text-emerald-700 font-bold">
              {data.fastestGoal.daysTaken} 天
            </div>
          </div>
        )}
        {data.largestGoal && (
          <div className="bg-white rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">最大金額</div>
            <div className="text-2xl">{data.largestGoal.emoji}</div>
            <div className="text-xs font-bold truncate">{data.largestGoal.name}</div>
            <div className="text-xs text-emerald-700 font-bold">
              ${data.largestGoal.targetAmount}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {data.goals.map((g) => (
          <div key={g.id} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <span className="text-2xl shrink-0">{g.avatar}</span>
            <span className="text-xl shrink-0">{g.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{g.name}</div>
              <div className="text-xs text-gray-500">
                {g.kidName}・${g.targetAmount}・{g.daysTaken} 天達成
              </div>
              {g.reflection && (
                <div className="text-[11px] text-emerald-700 italic mt-0.5">💭 {g.reflection}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-green-700 mt-2 text-center">
        平均達成時間：{data.avgDaysTaken} 天
      </div>
    </div>
  )
}

export function FamilyPeakWeekCard() {
  const { data } = useQuery<{
    weeks: number
    totalActivity: number
    avgPerWeek: number
    bestWeek: {
      weekStart: string
      tasks: number
      spendings: number
      checkins: number
      total: number
    } | null
    bestWeekKids: Array<{ kidId: number; kidName: string; avatar: string; tasks: number }>
  }>({
    queryKey: ["/api/family/peak-week"],
    queryFn: async () => {
      const res = await fetch("/api/family/peak-week?weeks=12", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || !data.bestWeek) return null

  const weekStart = new Date(data.bestWeek.weekStart)
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

  return (
    <div className="mb-4 rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-orange-50 p-4 shadow">
      <h3 className="font-bold text-rose-900 mb-3 flex items-center gap-2">🔥 家庭最忙週回顧</h3>

      <div className="bg-white rounded-lg p-3 mb-3 text-center">
        <div className="text-sm text-gray-500 mb-1">
          {fmt(weekStart)} ~ {fmt(weekEnd)}
        </div>
        <div className="text-3xl font-bold text-rose-700">{data.bestWeek.total}</div>
        <div className="text-xs text-gray-600 mt-1">
          {data.bestWeek.tasks} 任務・{data.bestWeek.spendings} 花費・{data.bestWeek.checkins} 打卡
        </div>
      </div>

      {data.bestWeekKids.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">那週各 kid 任務數：</div>
          <div className="flex gap-1 flex-wrap">
            {data.bestWeekKids.map((k) => (
              <span
                key={k.kidId}
                className="text-xs bg-rose-100 text-rose-800 px-2 py-1 rounded-full"
              >
                {k.avatar} {k.kidName} ×{k.tasks}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 mt-2 text-center">
        近 {data.weeks} 週、平均每週 {data.avgPerWeek} 活動
      </div>
    </div>
  )
}
