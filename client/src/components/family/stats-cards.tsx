/**
 * 家庭統計趨勢主題卡片（從 family.tsx 抽出）
 *
 * 包含：
 *  - FamilyApprovalLeadTimeCard — 家長批准回應速度
 *  - FamilyMonthlyTaskCreationTrendCard — 6 個月派任務量
 *  - FamilyMonthlySpendingTrendCard — 6 個月花費走勢
 *  - FamilyMonthlyGoalsTrendCard — 6 個月達標趨勢
 */
import { useQuery } from "@tanstack/react-query"

export function FamilyApprovalLeadTimeCard() {
  const { data } = useQuery<{
    days: number
    taskCount: number
    avgHours: number
    medianHours: number
    minHours: number
    maxHours: number
    buckets: Array<{ key: string; label: string; count: number; percentage: number }>
    speedLevel: "no_data" | "instant" | "fast" | "slow" | "very_slow"
    message: string
  }>({
    queryKey: ["/api/family/approval-lead-time?days=30"],
  })
  if (!data || data.taskCount === 0) return null

  const LEVEL_BORDER: Record<string, string> = {
    instant: "border-emerald-400",
    fast: "border-blue-300",
    slow: "border-orange-300",
    very_slow: "border-red-400",
  }
  const LEVEL_BG: Record<string, string> = {
    instant: "from-emerald-50 to-green-50",
    fast: "from-blue-50 to-sky-50",
    slow: "from-orange-50 to-amber-50",
    very_slow: "from-red-50 to-rose-50",
  }
  const BUCKET_COLOR: Record<string, string> = {
    instant: "bg-emerald-400",
    fast: "bg-blue-400",
    day: "bg-yellow-400",
    slow: "bg-orange-400",
    stale: "bg-red-400",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${LEVEL_BORDER[data.speedLevel] ?? "border-gray-300"} bg-gradient-to-br ${LEVEL_BG[data.speedLevel] ?? "from-gray-50 to-slate-50"} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">⏱️ 家長批准回應速度</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="font-bold text-emerald-700">{data.avgHours}h</div>
          <div className="text-[10px] text-gray-500">平均</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="font-bold text-blue-700">{data.medianHours}h</div>
          <div className="text-[10px] text-gray-500">中位數</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="font-bold text-rose-700">{Math.round(data.maxHours)}h</div>
          <div className="text-[10px] text-gray-500">最久</div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-2 space-y-1">
        {data.buckets.map((b) => (
          <div key={b.key} className="flex items-center gap-2 text-xs">
            <div className="w-20 text-[10px]">{b.label}</div>
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`${BUCKET_COLOR[b.key] ?? "bg-gray-400"} h-2 transition-all`}
                style={{ width: `${b.percentage}%` }}
              />
            </div>
            <div className="w-12 text-right text-[10px] font-bold">
              {b.count}({b.percentage}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyMonthlyTaskCreationTrendCard() {
  const { data } = useQuery<{
    months: number
    data: Array<{ month: string; taskCount: number; totalReward: number }>
    totalTasks: number
    totalReward: number
    activeMonths: number
    peakMonth: { month: string; taskCount: number } | null
    trend: "growing" | "stable" | "shrinking" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/monthly-task-creation-trend?months=6"],
  })
  if (!data || data.totalTasks === 0) return null

  const maxCount = Math.max(...data.data.map((m) => m.taskCount), 1)

  const TREND_BORDER: Record<string, string> = {
    growing: "border-emerald-300",
    stable: "border-blue-300",
    shrinking: "border-orange-300",
  }
  const TREND_BG: Record<string, string> = {
    growing: "from-emerald-50 to-teal-50",
    stable: "from-blue-50 to-sky-50",
    shrinking: "from-orange-50 to-amber-50",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${TREND_BORDER[data.trend] ?? "border-gray-300"} bg-gradient-to-br ${TREND_BG[data.trend] ?? "from-gray-50 to-slate-50"} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">📋 6 個月派任務量</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="flex items-end gap-1 h-20">
          {data.data.map((m) => {
            const heightPct = (m.taskCount / maxCount) * 100
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center justify-end">
                <div className="text-[9px] font-bold text-cyan-700 mb-1">{m.taskCount || ""}</div>
                <div
                  className={`w-full ${
                    m.taskCount > 0 ? "bg-gradient-to-t from-cyan-400 to-cyan-600" : "bg-gray-100"
                  } rounded-t transition-all`}
                  style={{ height: `${Math.max(2, heightPct)}%` }}
                  title={`${m.month}: ${m.taskCount} 個 ($${Math.round(m.totalReward)})`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[8px] text-gray-400 mt-1">
          {data.data.map((m) => (
            <span key={m.month} className="flex-1 text-center">
              {m.month.slice(5)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 text-xs">
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-cyan-700">{data.totalTasks}</div>
          <div className="text-[9px] text-gray-500">總派發</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-amber-600">
            ${Math.round(data.totalReward).toLocaleString()}
          </div>
          <div className="text-[9px] text-gray-500">總獎金</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-rose-600">{data.peakMonth?.taskCount ?? 0}</div>
          <div className="text-[9px] text-gray-500">
            最忙月 {data.peakMonth?.month?.slice(5) ?? "—"}
          </div>
        </div>
      </div>
    </div>
  )
}

export function FamilyMonthlySpendingTrendCard() {
  const { data } = useQuery<{
    months: number
    data: Array<{ month: string; spendCount: number; totalSpent: number; uniqueKids: number }>
    totalSpent: number
    totalCount: number
    activeMonths: number
    peakMonth: { month: string; totalSpent: number } | null
    trend: "growing" | "stable" | "shrinking" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/monthly-spending-trend?months=6"],
  })
  if (!data || data.totalCount === 0) return null

  const maxSpent = Math.max(...data.data.map((d) => d.totalSpent), 1)

  const TREND_BORDER: Record<string, string> = {
    growing: "border-rose-300",
    stable: "border-blue-300",
    shrinking: "border-emerald-300",
  }
  const TREND_BG: Record<string, string> = {
    growing: "from-rose-50 to-pink-50",
    stable: "from-blue-50 to-sky-50",
    shrinking: "from-emerald-50 to-teal-50",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${TREND_BORDER[data.trend] ?? "border-gray-300"} bg-gradient-to-br ${TREND_BG[data.trend] ?? "from-gray-50 to-slate-50"} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">💸 6 個月花費走勢</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="flex items-end gap-1 h-20">
          {data.data.map((m) => {
            const heightPct = (m.totalSpent / maxSpent) * 100
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center justify-end">
                <div className="text-[9px] font-bold text-rose-700 mb-1">
                  {m.totalSpent > 0 ? Math.round(m.totalSpent) : ""}
                </div>
                <div
                  className={`w-full ${
                    m.totalSpent > 0 ? "bg-gradient-to-t from-rose-400 to-rose-600" : "bg-gray-100"
                  } rounded-t transition-all`}
                  style={{ height: `${Math.max(2, heightPct)}%` }}
                  title={`${m.month}: $${Math.round(m.totalSpent)} (${m.spendCount} 筆)`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[8px] text-gray-400 mt-1">
          {data.data.map((m) => (
            <span key={m.month} className="flex-1 text-center">
              {m.month.slice(5)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 text-xs">
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-rose-700">
            ${Math.round(data.totalSpent).toLocaleString()}
          </div>
          <div className="text-[9px] text-gray-500">總花費</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-blue-600">{data.totalCount}</div>
          <div className="text-[9px] text-gray-500">總筆數</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-amber-600">
            ${Math.round(data.peakMonth?.totalSpent ?? 0)}
          </div>
          <div className="text-[9px] text-gray-500">
            最大月 {data.peakMonth?.month?.slice(5) ?? "—"}
          </div>
        </div>
      </div>
    </div>
  )
}

export function FamilyMonthlyGoalsTrendCard() {
  const { data } = useQuery<{
    months: number
    data: Array<{ month: string; goalCount: number; totalSaved: number }>
    totalGoals: number
    totalSaved: number
    activeMonths: number
    bestMonth: { month: string; goalCount: number } | null
    trend: "growing" | "stable" | "declining" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/monthly-goals-trend?months=6"],
  })
  if (!data || data.totalGoals === 0) return null

  const maxCount = Math.max(...data.data.map((m) => m.goalCount), 1)

  const TREND_BORDER: Record<string, string> = {
    growing: "border-emerald-300",
    stable: "border-blue-300",
    declining: "border-orange-300",
  }
  const TREND_BG: Record<string, string> = {
    growing: "from-emerald-50 to-green-50",
    stable: "from-blue-50 to-sky-50",
    declining: "from-orange-50 to-amber-50",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${TREND_BORDER[data.trend] ?? "border-gray-300"} bg-gradient-to-br ${TREND_BG[data.trend] ?? "from-gray-50 to-slate-50"} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">🎯 6 個月達標趨勢</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="flex items-end gap-1 h-20">
          {data.data.map((m) => {
            const heightPct = (m.goalCount / maxCount) * 100
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center justify-end">
                <div className="text-[9px] font-bold text-blue-700 mb-1">{m.goalCount || ""}</div>
                <div
                  className={`w-full ${
                    m.goalCount > 0
                      ? "bg-gradient-to-t from-emerald-400 to-emerald-600"
                      : "bg-gray-100"
                  } rounded-t transition-all`}
                  style={{ height: `${Math.max(2, heightPct)}%` }}
                  title={`${m.month}: ${m.goalCount} 個 ($${Math.round(m.totalSaved)})`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[8px] text-gray-400 mt-1">
          {data.data.map((m) => (
            <span key={m.month} className="flex-1 text-center">
              {m.month.slice(5)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 text-xs">
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-emerald-700">{data.totalGoals}</div>
          <div className="text-[9px] text-gray-500">總達成</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-blue-600">
            ${Math.round(data.totalSaved).toLocaleString()}
          </div>
          <div className="text-[9px] text-gray-500">總存到</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-amber-600">{data.bestMonth?.goalCount ?? 0}</div>
          <div className="text-[9px] text-gray-500">
            最佳月 {data.bestMonth?.month?.slice(5) ?? "—"}
          </div>
        </div>
      </div>
    </div>
  )
}
