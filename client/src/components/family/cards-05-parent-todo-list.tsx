/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-05-parent-todo-list，2026-07-03）
 */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

export function ParentTodoList() {
  const [collapsed, setCollapsed] = useState(true)
  const { data } = useQuery<{
    total: number
    urgentCount: number
    todos: Array<{
      type: string
      priority: "urgent" | "high" | "medium" | "low"
      icon: string
      action: string
      detail?: string
      relatedId?: number
      kidName?: string
      avatar?: string
    }>
  }>({
    queryKey: ["/api/family/parent-todo"],
    queryFn: async () => {
      const res = await fetch("/api/family/parent-todo", { credentials: "include" })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  const PRIORITY_COLOR: Record<string, string> = {
    urgent: "bg-rose-100 border-rose-300 text-rose-900",
    high: "bg-amber-100 border-amber-300 text-amber-900",
    medium: "bg-blue-100 border-blue-300 text-blue-900",
    low: "bg-gray-100 border-gray-300 text-gray-700",
  }

  const visible = collapsed ? data.todos.slice(0, 3) : data.todos

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-amber-900 flex items-center gap-2">
          📋 待辦清單（{data.total}）
        </h3>
        {data.urgentCount > 0 && (
          <span className="text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold">
            🔴 {data.urgentCount} 急
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {visible.map((t, i) => (
          <div key={i} className={`rounded-lg p-2 border ${PRIORITY_COLOR[t.priority]}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl shrink-0">{t.icon}</span>
              {t.avatar && <span className="text-lg shrink-0">{t.avatar}</span>}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t.action}</div>
                {t.detail && <div className="text-xs opacity-75">{t.detail}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.todos.length > 3 && (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="mt-2 w-full text-center text-sm text-amber-700 hover:text-amber-900"
        >
          {collapsed ? `看全部 (${data.todos.length - 3} 筆)` : "收起"}
        </button>
      )}
    </div>
  )
}

export function FamilyAvgRewardByCategoryCard() {
  const { data } = useQuery<{
    days: number
    categories: Array<{
      category: string
      label: string
      emoji: string
      taskCount: number
      avgReward: number
      minReward: number
      maxReward: number
      totalReward: number
    }>
    totalCount: number
    totalReward: number
    overallAvg: number
    topCategory: { label: string; avgReward: number } | null
    lowCategory: { label: string; avgReward: number } | null
    message: string
  }>({
    queryKey: ["/api/family/avg-reward-by-category?days=90"],
  })
  if (!data || data.totalCount === 0) return null

  const maxAvg = Math.max(...data.categories.map((c) => c.avgReward), 1)

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">💰 90 天類別獎金水準</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-2">
        {data.categories.map((c) => (
          <div key={c.category} className="bg-white rounded-lg p-2">
            <div className="flex items-center justify-between mb-1 text-xs">
              <span className="font-medium">
                {c.emoji} {c.label}
              </span>
              <span className="text-gray-500">
                avg ${c.avgReward} · {c.taskCount} 次
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-300 to-amber-500 h-2 transition-all"
                style={{ width: `${(c.avgReward / maxAvg) * 100}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-400 mt-1 flex justify-between">
              <span>min ${c.minReward}</span>
              <span>max ${c.maxReward}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 pt-2 border-t border-amber-200 text-[10px] text-gray-600 text-center">
        整體平均 ${data.overallAvg} · 總計 ${Math.round(data.totalReward).toLocaleString()}（
        {data.totalCount} 筆）
      </div>
    </div>
  )
}

export function FamilyKidsNeedingAttentionCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      lastApprove: string | null
      daysSinceLastApprove: number
    }>
    kidCount: number
    maxDaysSince: number
    level: "ok" | "warn" | "alert"
    message: string
  }>({
    queryKey: ["/api/family/kids-needing-attention?days=7"],
  })
  if (!data || data.kidCount === 0) return null

  const borderColor = data.level === "alert" ? "border-red-500" : "border-orange-400"
  const bgGradient =
    data.level === "alert" ? "from-red-50 to-rose-50" : "from-orange-50 to-amber-50"

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${borderColor} bg-gradient-to-br ${bgGradient} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">
        {data.level === "alert" ? "🚨" : "⏰"} 家長關注度提醒
      </h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs font-medium">{data.message}</div>

      <div className="space-y-1">
        {data.kids.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                {k.lastApprove
                  ? `上次 approve：${k.lastApprove.slice(0, 10)}（${k.daysSinceLastApprove} 天前）`
                  : "還沒被 approve 過"}
              </div>
            </div>
            <div className="text-sm font-bold text-red-600">{k.daysSinceLastApprove}d</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyDayOfWeekDistributionCard() {
  const { data } = useQuery<{
    days: number
    totalCount: number
    weekendCount: number
    weekdayCount: number
    weekendPct: number
    weekdayPct: number
    byDay: Array<{ dow: number; label: string; taskCount: number; isWeekend: boolean }>
    peakDay: { label: string; taskCount: number } | null
    pattern: "no_data" | "weekend_focused" | "weekday_focused" | "balanced"
    message: string
  }>({
    queryKey: ["/api/family/family-weekend-vs-weekday?days=30"],
  })
  if (!data || data.totalCount === 0) return null

  const maxCount = Math.max(...data.byDay.map((d) => d.taskCount), 1)

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📅 30 天作息分布</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-lg">🏖️</div>
          <div className="font-bold text-orange-700">{data.weekendCount}</div>
          <div className="text-[10px] text-gray-500">週末（{data.weekendPct}%）</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center">
          <div className="text-lg">📚</div>
          <div className="font-bold text-blue-700">{data.weekdayCount}</div>
          <div className="text-[10px] text-gray-500">平日（{data.weekdayPct}%）</div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-2">
        <div className="text-[10px] text-gray-500 mb-1">每日分布</div>
        <div className="flex items-end gap-1 h-16">
          {data.byDay.map((d) => {
            const heightPct = (d.taskCount / maxCount) * 100
            return (
              <div key={d.dow} className="flex-1 flex flex-col items-center justify-end">
                <div className="text-[8px] font-bold text-amber-700 mb-1">{d.taskCount || ""}</div>
                <div
                  className={`w-full ${
                    d.taskCount > 0
                      ? d.isWeekend
                        ? "bg-orange-400"
                        : "bg-blue-400"
                      : "bg-gray-100"
                  } rounded-t transition-all`}
                  style={{ height: `${Math.max(2, heightPct)}%` }}
                  title={`${d.label}: ${d.taskCount} 次`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[8px] text-gray-400 mt-1">
          {data.byDay.map((d) => (
            <span key={d.dow} className="flex-1 text-center">
              {d.label.slice(1)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function FamilyWishPromotionRateCard() {
  const { data } = useQuery<{
    days: number
    total: number
    promoted: number
    stillWished: number
    abandoned: number
    promotionRate: number
    abandonmentRate: number
    decisionRate: number
    maturityLevel: "no_data" | "starting" | "thinking" | "deciding" | "mature"
    message: string
  }>({
    queryKey: ["/api/family/wish-promotion-rate?days=90"],
  })
  if (!data || data.total === 0) return null

  const LEVEL_BORDER: Record<string, string> = {
    starting: "border-blue-300",
    thinking: "border-indigo-300",
    deciding: "border-purple-300",
    mature: "border-emerald-400",
  }
  const LEVEL_BG: Record<string, string> = {
    starting: "from-blue-50 to-sky-50",
    thinking: "from-indigo-50 to-blue-50",
    deciding: "from-purple-50 to-fuchsia-50",
    mature: "from-emerald-50 to-green-50",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${LEVEL_BORDER[data.maturityLevel] ?? "border-gray-300"} bg-gradient-to-br ${LEVEL_BG[data.maturityLevel] ?? "from-gray-50 to-slate-50"} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">💭 90 天願望決策成熟度</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="flex h-3 rounded-full overflow-hidden">
          <div
            className="bg-emerald-400"
            style={{ width: `${data.promotionRate}%` }}
            title={`升級 ${data.promotionRate}%`}
          />
          <div
            className="bg-rose-400"
            style={{ width: `${data.abandonmentRate}%` }}
            title={`放棄 ${data.abandonmentRate}%`}
          />
          <div
            className="bg-gray-300"
            style={{ width: `${100 - data.decisionRate}%` }}
            title={`還在想 ${100 - data.decisionRate}%`}
          />
        </div>
        <div className="flex justify-between text-[9px] mt-1">
          <span className="text-emerald-600">🎯 升級 {data.promotionRate}%</span>
          <span className="text-rose-500">🗑️ 放棄 {data.abandonmentRate}%</span>
          <span className="text-gray-500">💭 {100 - data.decisionRate}%</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 text-xs">
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-gray-700">{data.total}</div>
          <div className="text-[9px] text-gray-500">總願望</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-emerald-700">{data.promoted}</div>
          <div className="text-[9px] text-gray-500">已升級</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-indigo-600">{data.stillWished}</div>
          <div className="text-[9px] text-gray-500">還在想</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-rose-500">{data.abandoned}</div>
          <div className="text-[9px] text-gray-500">放棄</div>
        </div>
      </div>
    </div>
  )
}

export function FamilySpendingSummaryCard() {
  const { data } = useQuery<{
    days: number
    jars: Array<{
      jar: string
      label: string
      emoji: string
      color: string
      spendCount: number
      totalAmount: number
      uniqueKids: number
      percentage: number
    }>
    totalAmount: number
    totalCount: number
    topJar: { jar: string; label: string; emoji: string; totalAmount: number } | null
    message: string
  }>({
    queryKey: ["/api/family/spending-summary?days=30"],
  })
  if (!data || data.totalCount === 0) return null

  const COLOR_BAR: Record<string, string> = {
    rose: "bg-rose-400",
    emerald: "bg-emerald-400",
    pink: "bg-pink-400",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-blue-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">💰 30 天花費分布</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-3 mb-2 text-center">
        <div className="text-2xl font-bold text-cyan-700">
          ${Math.round(data.totalAmount).toLocaleString()}
        </div>
        <div className="text-[10px] text-gray-500">總花費（{data.totalCount} 筆）</div>
      </div>

      <div className="space-y-2">
        {data.jars
          .filter((j) => j.spendCount > 0)
          .sort((a, b) => b.totalAmount - a.totalAmount)
          .map((j) => (
            <div key={j.jar} className="bg-white rounded-lg p-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">
                  {j.emoji} {j.label}
                </span>
                <span className="text-gray-500">
                  ${Math.round(j.totalAmount)} · {j.spendCount} 筆
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`${COLOR_BAR[j.color] ?? "bg-gray-400"} h-2 transition-all`}
                  style={{ width: `${j.percentage}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-400 text-right mt-1">{j.percentage}%</div>
            </div>
          ))}
      </div>
    </div>
  )
}

export function FamilyCheckinStreakCard() {
  const { data } = useQuery<{
    streak: number
    lastCheckinDate: string | null
    level: "none" | "starting" | "good" | "great" | "legend"
    message: string
  }>({
    queryKey: ["/api/family/family-checkin-streak"],
  })
  if (!data || data.streak === 0) return null

  const LEVEL_BORDER: Record<string, string> = {
    starting: "border-green-300",
    good: "border-orange-300",
    great: "border-red-300",
    legend: "border-purple-400",
  }
  const LEVEL_BG: Record<string, string> = {
    starting: "from-green-50 to-emerald-50",
    good: "from-orange-50 to-amber-50",
    great: "from-red-50 to-rose-50",
    legend: "from-purple-50 to-fuchsia-50",
  }
  const LEVEL_EMOJI: Record<string, string> = {
    starting: "🌱",
    good: "🔥",
    great: "🚀",
    legend: "🏆",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${LEVEL_BORDER[data.level] ?? "border-gray-300"} bg-gradient-to-br ${LEVEL_BG[data.level] ?? "from-gray-50 to-slate-50"} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">
        {LEVEL_EMOJI[data.level] ?? "📅"} 家庭打卡連續天數
      </h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-4 text-center">
        <div className="text-5xl font-bold text-red-600">{data.streak}</div>
        <div className="text-[10px] text-gray-500 mt-1">連續天數</div>
        {data.lastCheckinDate && (
          <div className="text-[10px] text-gray-400 mt-1">最後簽到 {data.lastCheckinDate}</div>
        )}
      </div>
    </div>
  )
}

export function FamilyWishPriorityBreakdownCard() {
  const { data } = useQuery<{
    priorities: Array<{
      priority: number
      label: string
      emoji: string
      color: string
      wishCount: number
      totalValue: number
      uniqueKids: number
    }>
    totalWishes: number
    totalValue: number
    highPriorityCount: number
    message: string
  }>({
    queryKey: ["/api/family/wish-priority-breakdown"],
  })
  if (!data || data.totalWishes === 0) return null

  const COLOR_BG: Record<string, string> = {
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-gray-100 text-gray-600",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-fuchsia-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">✨ 願望優先級分佈</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1">
        {data.priorities
          .filter((p) => p.wishCount > 0)
          .map((p) => (
            <div
              key={p.priority}
              className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs"
            >
              <div className={`px-2 py-1 rounded ${COLOR_BG[p.color] ?? "bg-gray-100"}`}>
                {p.emoji} {p.label}
              </div>
              <div className="flex-1">
                <div className="font-medium">{p.wishCount} 個願望</div>
                <div className="text-[10px] text-gray-500">{p.uniqueKids} 位小孩</div>
              </div>
              <div className="text-sm font-bold text-purple-700">${Math.round(p.totalValue)}</div>
            </div>
          ))}
      </div>

      <div className="mt-2 pt-2 border-t border-purple-200 text-[10px] text-gray-600 text-center">
        共 {data.totalWishes} 個願望、總值 ${Math.round(data.totalValue).toLocaleString()}
      </div>
    </div>
  )
}

export function FamilyRejectionRateCard() {
  const { data } = useQuery<{
    days: number
    approved: number
    rejected: number
    submitted: number
    pending: number
    decidedTotal: number
    approvalRate: number
    rejectionRate: number
    standardLevel: "ok" | "too_strict" | "too_loose" | "no_data"
    message: string
  }>({
    queryKey: ["/api/family/family-rejection-rate?days=30"],
  })
  if (!data || data.decidedTotal === 0) return null

  const borderColor =
    data.standardLevel === "too_strict"
      ? "border-red-300"
      : data.standardLevel === "too_loose"
        ? "border-orange-300"
        : "border-green-300"
  const bgGradient =
    data.standardLevel === "too_strict"
      ? "from-red-50 to-rose-50"
      : data.standardLevel === "too_loose"
        ? "from-orange-50 to-amber-50"
        : "from-green-50 to-emerald-50"

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${borderColor} bg-gradient-to-br ${bgGradient} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">⚖️ 30 天家長標準鬆緊</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="flex h-3 rounded-full overflow-hidden">
          <div
            className="bg-emerald-400"
            style={{ width: `${data.approvalRate}%` }}
            title={`批准 ${data.approvalRate}%`}
          />
          <div
            className="bg-red-400"
            style={{ width: `${data.rejectionRate}%` }}
            title={`駁回 ${data.rejectionRate}%`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span className="text-emerald-600">✅ 批准 {data.approvalRate}%</span>
          <span className="text-red-500">❌ 駁回 {data.rejectionRate}%</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 text-xs">
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-emerald-700">{data.approved}</div>
          <div className="text-[9px] text-gray-500">已批准</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-red-600">{data.rejected}</div>
          <div className="text-[9px] text-gray-500">已駁回</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-blue-600">{data.submitted}</div>
          <div className="text-[9px] text-gray-500">待批准</div>
        </div>
        <div className="bg-white rounded p-1 text-center">
          <div className="font-bold text-gray-500">{data.pending}</div>
          <div className="text-[9px] text-gray-500">未完成</div>
        </div>
      </div>
    </div>
  )
}
