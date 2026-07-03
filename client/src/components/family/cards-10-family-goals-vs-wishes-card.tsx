/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-10-family-goals-vs-wishes-card，2026-07-03）
 */
import { useQuery } from "@tanstack/react-query"

export function FamilyGoalsVsWishesCard() {
  const { data } = useQuery<{
    goals: { total: number; active: number; completed: number }
    wishes: { total: number; wished: number; promoted: number; abandoned: number }
    promotionRate: number
    goalToWishRatio: number
    discipline: "highly_disciplined" | "balanced" | "wishful" | "no_goals" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/goals-vs-wishes"],
  })
  if (!data) return null
  if (data.goals.total === 0 && data.wishes.total === 0) return null

  const LEVEL_BG: Record<string, string> = {
    highly_disciplined: "from-yellow-50 to-amber-50 border-yellow-500",
    balanced: "from-emerald-50 to-green-50 border-emerald-400",
    wishful: "from-sky-50 to-blue-50 border-sky-300",
    no_goals: "from-amber-50 to-orange-50 border-amber-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.discipline]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🎯 目標 vs 願望（自律度）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-white rounded-lg p-2">
          <div className="text-[10px] text-gray-500 mb-1">🎯 目標</div>
          <div className="text-sm font-bold">{data.goals.total} 個</div>
          <div className="text-[10px] text-gray-600">
            進行 {data.goals.active} · 達成 {data.goals.completed}
          </div>
        </div>
        <div className="bg-white rounded-lg p-2">
          <div className="text-[10px] text-gray-500 mb-1">✨ 願望</div>
          <div className="text-sm font-bold">{data.wishes.total} 個</div>
          <div className="text-[10px] text-gray-600">
            未動 {data.wishes.wished} · 升級 {data.wishes.promoted}
          </div>
        </div>
      </div>

      {data.wishes.total > 0 && (
        <div className="bg-white/40 rounded p-2">
          <div className="text-[10px] text-gray-600 mb-1">願望升級率 {data.promotionRate}%</div>
          <div className="h-2 bg-white rounded overflow-hidden">
            <div
              className={`h-full ${data.promotionRate >= 40 ? "bg-yellow-500" : data.promotionRate >= 15 ? "bg-emerald-500" : "bg-amber-400"}`}
              style={{ width: `${Math.min(data.promotionRate, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function FamilyApproveLatencyCard() {
  const { data } = useQuery<{
    days: number
    stats: { total: number; avgHours: number; medianHours: number }
    buckets: Array<{ label: string; range: string; count: number }>
    level: "instant" | "fast" | "good" | "slow" | "sluggish" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/approve-latency?days=60"],
  })
  if (!data || data.stats.total === 0) return null

  const LEVEL_BG: Record<string, string> = {
    instant: "from-emerald-50 to-green-50 border-emerald-500",
    fast: "from-blue-50 to-sky-50 border-blue-400",
    good: "from-sky-50 to-cyan-50 border-sky-300",
    slow: "from-amber-50 to-yellow-50 border-amber-400",
    sluggish: "from-rose-50 to-red-50 border-rose-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  const maxCount = Math.max(...data.buckets.map((b) => b.count), 1)

  const fmtHours = (h: number) =>
    h < 1 ? `${Math.round(h * 60)} 分` : h < 24 ? `${h} 小時` : `${(h / 24).toFixed(1)} 天`

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">⏱️ 批准延遲（60 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">{data.stats.total}</div>
          <div className="text-[9px] text-gray-500">總批准</div>
        </div>
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">{fmtHours(data.stats.avgHours)}</div>
          <div className="text-[9px] text-gray-500">平均</div>
        </div>
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">{fmtHours(data.stats.medianHours)}</div>
          <div className="text-[9px] text-gray-500">中位數</div>
        </div>
      </div>

      <div className="space-y-1">
        {data.buckets.map((b) => (
          <div key={b.range} className="flex items-center gap-2 text-xs">
            <div className="w-16 text-right text-gray-600">{b.label}</div>
            <div className="flex-1 h-3 bg-white rounded overflow-hidden">
              {b.count > 0 && (
                <div
                  className={`h-full ${b.range === "instant" || b.range === "fast" ? "bg-emerald-500" : b.range === "normal" ? "bg-blue-500" : "bg-rose-400"}`}
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

export function FamilyFeedbackRateCard() {
  const { data } = useQuery<{
    days: number
    totalApproved: number
    parentFeedbackRate: number
    kidSubmissionNoteRate: number
    interactionScore: number
    level: "highly_engaged" | "engaged" | "moderate" | "passive" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/feedback-rate?days=90"],
  })
  if (!data || data.totalApproved === 0) return null

  const LEVEL_BG: Record<string, string> = {
    highly_engaged: "from-violet-50 to-pink-50 border-violet-500",
    engaged: "from-emerald-50 to-green-50 border-emerald-400",
    moderate: "from-blue-50 to-sky-50 border-blue-300",
    passive: "from-amber-50 to-orange-50 border-amber-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🤝 親子互動深度（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-violet-600">{data.parentFeedbackRate}%</div>
          <div className="text-[10px] text-gray-500">家長 feedback</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-emerald-600">{data.kidSubmissionNoteRate}%</div>
          <div className="text-[10px] text-gray-500">小孩描述</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-blue-600">{data.interactionScore}</div>
          <div className="text-[10px] text-gray-500">互動分</div>
        </div>
      </div>
    </div>
  )
}

export function FamilyRewardStatsCard() {
  const { data } = useQuery<{
    days: number
    stats: { total: number; min: number; max: number; avg: number; median: number }
    buckets: Array<{ label: string; range: string; count: number }>
    dominantBucket: string
    pattern: "diverse" | "concentrated" | "high_value" | "low_value" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/reward-stats?days=90"],
  })
  if (!data || data.stats.total === 0) return null

  const PATTERN_BG: Record<string, string> = {
    diverse: "from-violet-50 to-pink-50 border-violet-400",
    concentrated: "from-blue-50 to-sky-50 border-blue-300",
    high_value: "from-emerald-50 to-green-50 border-emerald-400",
    low_value: "from-amber-50 to-yellow-50 border-amber-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  const maxCount = Math.max(...data.buckets.map((b) => b.count), 1)

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${PATTERN_BG[data.pattern]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">💰 獎勵統計（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-4 gap-2 mb-2">
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">${data.stats.avg}</div>
          <div className="text-[9px] text-gray-500">平均</div>
        </div>
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">${data.stats.median}</div>
          <div className="text-[9px] text-gray-500">中位數</div>
        </div>
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">${data.stats.min}</div>
          <div className="text-[9px] text-gray-500">最小</div>
        </div>
        <div className="bg-white rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold">${data.stats.max}</div>
          <div className="text-[9px] text-gray-500">最大</div>
        </div>
      </div>

      <div className="space-y-1">
        {data.buckets.map((b) => (
          <div key={b.range} className="flex items-center gap-2 text-xs">
            <div className="w-16 text-right text-gray-600">{b.label}</div>
            <div className="flex-1 h-3 bg-white rounded overflow-hidden">
              {b.count > 0 && (
                <div
                  className={`h-full ${b.label === data.dominantBucket ? "bg-emerald-500" : "bg-emerald-300"}`}
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

export function FamilyInitiativeRateCard() {
  const { data } = useQuery<{
    days: number
    stats: { proposed: number; assigned: number; total: number }
    initiativeRate: number
    topProposer: { kidName: string; avatar: string; count: number } | null
    level: "high_initiative" | "good_initiative" | "moderate" | "low" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/initiative-rate?days=90"],
  })
  if (!data || data.stats.total === 0) return null

  const LEVEL_BG: Record<string, string> = {
    high_initiative: "from-violet-50 to-purple-50 border-violet-500",
    good_initiative: "from-emerald-50 to-green-50 border-emerald-400",
    moderate: "from-blue-50 to-sky-50 border-blue-300",
    low: "from-amber-50 to-yellow-50 border-amber-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🚀 家庭主動性</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-violet-600">{data.stats.proposed}</div>
          <div className="text-[10px] text-gray-500">小孩自提</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-blue-600">{data.stats.assigned}</div>
          <div className="text-[10px] text-gray-500">家長派</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-emerald-600">{data.initiativeRate}%</div>
          <div className="text-[10px] text-gray-500">主動率</div>
        </div>
      </div>

      {data.topProposer && (
        <div className="bg-white/40 rounded p-2 text-center text-xs">
          🥇 最主動：{data.topProposer.avatar} {data.topProposer.kidName}（{data.topProposer.count}{" "}
          個）
        </div>
      )}
    </div>
  )
}

export function FamilyWeekendVsWeekdayCard() {
  const { data } = useQuery<{
    days: number
    weekend: { tasks: number; tasksPerDay: number; spent: number; days: number }
    weekday: { tasks: number; tasksPerDay: number; spent: number; days: number }
    pattern: "weekend_warriors" | "weekday_grinders" | "balanced" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/weekend-vs-weekday?days=60"],
  })
  if (!data || data.weekend.tasks + data.weekday.tasks === 0) return null

  const PATTERN_BG: Record<string, string> = {
    weekend_warriors: "from-violet-50 to-purple-50 border-violet-400",
    weekday_grinders: "from-blue-50 to-cyan-50 border-blue-400",
    balanced: "from-emerald-50 to-green-50 border-emerald-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${PATTERN_BG[data.pattern]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">📆 週末 vs 平日（60 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-1">🏠 週末</div>
          <div className="text-lg font-bold">{data.weekend.tasks} 任務</div>
          <div className="text-[10px] text-gray-500">
            日均 {data.weekend.tasksPerDay} · 花 ${data.weekend.spent}
          </div>
        </div>
        <div className="bg-white rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-1">💼 平日</div>
          <div className="text-lg font-bold">{data.weekday.tasks} 任務</div>
          <div className="text-[10px] text-gray-500">
            日均 {data.weekday.tasksPerDay} · 花 ${data.weekday.spent}
          </div>
        </div>
      </div>
    </div>
  )
}

export function FamilyIncomeVsSpendingCard() {
  const { data } = useQuery<{
    days: number
    income: number
    spent: number
    given: number
    totalOut: number
    balance: number
    ratio: number
    level: "saver" | "balanced" | "spender" | "overspending" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/income-vs-spending?days=30"],
  })
  if (!data) return null
  if (data.income === 0 && data.totalOut === 0) return null

  const LEVEL_BG: Record<string, string> = {
    saver: "from-emerald-50 to-green-50 border-emerald-500",
    balanced: "from-blue-50 to-sky-50 border-blue-300",
    spender: "from-amber-50 to-yellow-50 border-amber-400",
    overspending: "from-rose-50 to-red-50 border-rose-500",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">⚖️ 收入 vs 花用（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-emerald-600">${data.income}</div>
          <div className="text-[10px] text-gray-500">收入</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-rose-500">${data.totalOut}</div>
          <div className="text-[10px] text-gray-500">花用</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div
            className={`text-xl font-bold ${data.balance >= 0 ? "text-blue-600" : "text-red-600"}`}
          >
            {data.balance >= 0 ? "+" : ""}${data.balance}
          </div>
          <div className="text-[10px] text-gray-500">結餘</div>
        </div>
      </div>

      {data.income > 0 && (
        <div className="bg-white/40 rounded p-2">
          <div className="text-[10px] text-gray-600 mb-1">花用占收入比例 {data.ratio}%</div>
          <div className="h-2 bg-white rounded overflow-hidden">
            <div
              className={`h-full ${data.ratio > 100 ? "bg-rose-500" : data.ratio > 60 ? "bg-amber-500" : data.ratio > 30 ? "bg-blue-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(data.ratio, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function FamilyJarsCurrentCard() {
  const { data } = useQuery<{
    jars: {
      spend: {
        total: number
        ratio: number
        topKid: { kidName: string; balance: number; avatar: string } | null
      }
      save: {
        total: number
        ratio: number
        topKid: { kidName: string; balance: number; avatar: string } | null
      }
      give: {
        total: number
        ratio: number
        topKid: { kidName: string; balance: number; avatar: string } | null
      }
    }
    total: number
    health: "healthy" | "ok" | "unhealthy" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/jars-current-balance"],
  })
  if (!data || data.total === 0) return null

  const HEALTH_BG: Record<string, string> = {
    healthy: "from-emerald-50 to-green-50 border-emerald-400",
    ok: "from-blue-50 to-sky-50 border-blue-300",
    unhealthy: "from-amber-50 to-orange-50 border-amber-400",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  const items = [
    { key: "spend", label: "🛒 花用罐", color: "bg-rose-500", data: data.jars.spend },
    { key: "save", label: "💎 儲蓄罐", color: "bg-emerald-500", data: data.jars.save },
    { key: "give", label: "💝 捐贈罐", color: "bg-violet-500", data: data.jars.give },
  ]

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${HEALTH_BG[data.health]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🏺 全家三罐 ${data.total}</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="flex h-3 rounded-full overflow-hidden mb-3 bg-white/50">
        {items.map((it) => (
          <div
            key={it.key}
            className={it.color}
            style={{ width: `${it.data.ratio}%` }}
            title={`${it.label}: ${it.data.ratio}%`}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.key} className="bg-white/80 rounded-lg p-2 flex items-center gap-2">
            <div className="w-24 text-xs">{it.label}</div>
            <div className="flex-1">
              <div className="text-sm font-bold">${it.data.total}</div>
              <div className="text-[10px] text-gray-500">{it.data.ratio}%</div>
            </div>
            {it.data.topKid && (
              <div className="text-right text-[10px] text-gray-600">
                <div>
                  🥇 {it.data.topKid.avatar} {it.data.topKid.kidName}
                </div>
                <div>${it.data.topKid.balance}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyGoalsCompletionRateCard() {
  const { data } = useQuery<{
    stats: { active: number; completed: number; abandoned: number; total: number }
    completionRate: number
    avgCompletionDays: number
    avgCompletedAmount: number
    avgActiveAmount: number
    level: "excellent" | "good" | "fair" | "needs_work" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/goals-completion-rate"],
  })
  if (!data || data.stats.total === 0) return null

  const LEVEL_BG: Record<string, string> = {
    excellent: "from-yellow-50 to-amber-50 border-yellow-500",
    good: "from-emerald-50 to-green-50 border-emerald-400",
    fair: "from-sky-50 to-blue-50 border-sky-300",
    needs_work: "from-amber-50 to-orange-50 border-amber-300",
    no_data: "from-gray-50 to-slate-50 border-gray-300",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${LEVEL_BG[data.level]} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🎯 家庭目標達成率</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-emerald-600">{data.stats.completed}</div>
          <div className="text-[10px] text-gray-500">已達成</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-blue-600">{data.stats.active}</div>
          <div className="text-[10px] text-gray-500">進行中</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-gray-500">{data.stats.abandoned}</div>
          <div className="text-[10px] text-gray-500">已放棄</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-2xl font-bold text-violet-600">{data.completionRate}%</div>
          <div className="text-[10px] text-gray-500">達成率</div>
        </div>
      </div>

      {data.avgCompletionDays > 0 && (
        <div className="mt-2 text-[11px] text-gray-600 bg-white/40 rounded p-1.5">
          平均達成 {data.avgCompletionDays} 天 · 已達成平均 ${data.avgCompletedAmount} · 進行中平均
          ${data.avgActiveAmount}
        </div>
      )}
    </div>
  )
}
