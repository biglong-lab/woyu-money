/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-08-family-goal-urgency-rank-card，2026-07-03）
 */
import { useQuery } from "@tanstack/react-query"

export function FamilyGoalUrgencyRankCard() {
  const { data } = useQuery<{
    goals: Array<{
      goalId: number
      goalName: string
      goalEmoji: string
      target: number
      current: number
      progress: number
      deadline: string
      daysUntil: number
      kidName: string
      kidAvatar: string
      urgency: "overdue" | "critical" | "warning" | "safe"
    }>
    total: number
    overdueCount: number
    criticalCount: number
    message: string
  }>({
    queryKey: ["/api/family/goal-urgency-rank?limit=10"],
  })
  if (!data || data.total === 0) return null

  const URGENCY_BG: Record<string, string> = {
    overdue: "bg-rose-100 border-rose-400",
    critical: "bg-amber-100 border-amber-400",
    warning: "bg-yellow-100 border-yellow-400",
    safe: "bg-emerald-100 border-emerald-300",
  }
  const URGENCY_LABEL: Record<string, string> = {
    overdue: "🚨 過期",
    critical: "⏰ 緊急",
    warning: "⚠️ 注意",
    safe: "✅ 安全",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">⏳ 目標 deadline 緊急度</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.goals.slice(0, 6).map((g) => (
          <div key={g.goalId} className={`rounded-lg p-2 border ${URGENCY_BG[g.urgency]}`}>
            <div className="flex items-center gap-2 mb-1 text-xs">
              <span className="text-lg">{g.goalEmoji}</span>
              <span className="flex-1 truncate font-medium">{g.goalName}</span>
              <span className="text-[10px]">{URGENCY_LABEL[g.urgency]}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>
                {g.kidAvatar} {g.kidName} · ${g.current}/${g.target}（{g.progress}%）
              </span>
              <span className={g.daysUntil < 0 ? "text-red-600 font-bold" : ""}>
                {g.daysUntil < 0 ? `逾期 ${Math.abs(g.daysUntil)} 天` : `剩 ${g.daysUntil} 天`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyKidEarningsTrendCard() {
  const { data } = useQuery<{
    months: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      months: Array<{ month: string; earnings: number }>
      total: number
    }>
    topEarner: { kidName: string; avatar: string; total: number } | null
    familyTotal: number
    message: string
  }>({
    queryKey: ["/api/family/kid-earnings-trend?months=6"],
  })
  if (!data || data.kids.length === 0 || data.familyTotal === 0) return null

  const allMaxEarnings = Math.max(...data.kids.flatMap((k) => k.months.map((m) => m.earnings)), 1)

  return (
    <div className="mb-4 rounded-2xl border-2 border-cyan-400 bg-gradient-to-br from-cyan-50 to-blue-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">💰 兒童入帳趨勢（6 月）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">全家累計 ${data.familyTotal}</div>
      </div>

      <div className="space-y-2">
        {data.kids.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center justify-between mb-1 text-xs">
              <span>
                {k.avatar} {k.kidName}
              </span>
              <span className="font-bold">${k.total}</span>
            </div>
            <div className="flex items-end gap-1 h-10">
              {k.months.map((m) => {
                const h = (m.earnings / allMaxEarnings) * 100
                return (
                  <div
                    key={m.month}
                    className="flex-1 flex flex-col items-center justify-end"
                    title={`${m.month}: $${m.earnings}`}
                  >
                    <div
                      className="w-full bg-cyan-500 rounded-t"
                      style={{ height: `${Math.max(h, 2)}%` }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyGoalsMonthlyCompletionCard() {
  const { data } = useQuery<{
    months: Array<{ month: string; goalsCount: number; totalAmount: number }>
    grandTotalGoals: number
    grandTotalAmount: number
    biggestMonth: { month: string; goalsCount: number; totalAmount: number } | null
    message: string
  }>({
    queryKey: ["/api/family/goals-monthly-completion?months=6"],
  })
  if (!data || data.grandTotalGoals === 0) return null

  const maxAmount = Math.max(...data.months.map((m) => m.totalAmount), 1)

  return (
    <div className="mb-4 rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎯 目標達成（6 月）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          累計 {data.grandTotalGoals} 個目標 / ${data.grandTotalAmount}
        </div>
      </div>

      <div className="flex items-end gap-1 h-20 bg-white/40 rounded p-2">
        {data.months.map((m) => {
          const h = (m.totalAmount / maxAmount) * 100
          return (
            <div
              key={m.month}
              className="flex-1 flex flex-col items-center justify-end"
              title={`${m.month}: ${m.goalsCount} 個 / $${m.totalAmount}`}
            >
              <div className="text-[9px] text-gray-600 font-bold">{m.goalsCount}</div>
              <div
                className="w-full bg-gradient-to-t from-emerald-400 to-green-500 rounded-t"
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

export function FamilyCategoryHeatTrendCard() {
  const { data } = useQuery<{
    months: Array<{
      month: string
      housework: number
      study: number
      self_care: number
      kindness: number
      other: number
    }>
    totals: Record<string, number>
    topCategory: string | null
    topCategoryLabel: string | null
    grandTotal: number
    message: string
  }>({
    queryKey: ["/api/family/category-heat-trend?months=6"],
  })
  if (!data || data.grandTotal === 0) return null

  const CAT_INFO: Array<{ key: string; label: string; color: string }> = [
    { key: "housework", label: "🧹 家事", color: "bg-blue-400" },
    { key: "study", label: "📚 學習", color: "bg-purple-400" },
    { key: "self_care", label: "🧴 自我照顧", color: "bg-pink-400" },
    { key: "kindness", label: "💝 善行", color: "bg-rose-400" },
    { key: "other", label: "📋 其他", color: "bg-gray-400" },
  ]

  return (
    <div className="mb-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎨 任務分類熱度（6 月）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {CAT_INFO.map((c) => {
          const count = data.totals[c.key]
          const pct = data.grandTotal > 0 ? Math.round((count / data.grandTotal) * 100) : 0
          if (count === 0) return null
          return (
            <div key={c.key} className="bg-white rounded-lg p-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>{c.label}</span>
                <span className="font-bold">
                  {count}（{pct}%）
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                <div className={`h-full ${c.color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FamilyBadgeLeaderboardCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      badgeCount: number
      latestBadge: { title: string; emoji: string; earnedAt: string } | null
    }>
    totalBadges: number
    topAchiever: { kidName: string; avatar: string; badgeCount: number } | null
    message: string
  }>({
    queryKey: ["/api/family/badge-leaderboard"],
  })
  if (!data || data.kids.length === 0 || data.totalBadges === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎖️ 徽章排名</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.kids.map((k, i) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="w-4 text-center text-gray-500">{i + 1}</div>
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{k.kidName}</div>
              {k.latestBadge && (
                <div className="text-[10px] text-gray-500 truncate">
                  最新：{k.latestBadge.emoji} {k.latestBadge.title}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-amber-600">{k.badgeCount}</div>
              <div className="text-[9px] text-gray-500">徽章</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyKidSpendingHabitsCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      spent: number
      given: number
      earned: number
      giveRatio: number
      habit: "generous" | "spender" | "saver" | "balanced" | "no_data"
    }>
    habitCounts: { generous: number; spender: number; saver: number; balanced: number }
    message: string
  }>({
    queryKey: ["/api/family/kid-spending-habits?days=30"],
  })
  if (!data || data.kids.length === 0) return null
  const withActivity = data.kids.filter((k) => k.habit !== "no_data")
  if (withActivity.length === 0) return null

  const HABIT_LABEL: Record<string, string> = {
    generous: "💝 慷慨",
    spender: "🛒 花用",
    saver: "💎 節儉",
    balanced: "⚖️ 平衡",
    no_data: "—",
  }
  const HABIT_COLOR: Record<string, string> = {
    generous: "bg-violet-100 text-violet-700",
    spender: "bg-rose-100 text-rose-700",
    saver: "bg-emerald-100 text-emerald-700",
    balanced: "bg-blue-100 text-blue-700",
    no_data: "bg-gray-100 text-gray-500",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-pink-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🪙 花用習慣（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withActivity.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 text-sm font-medium">{k.kidName}</div>
              <div className={`text-[10px] px-2 py-0.5 rounded ${HABIT_COLOR[k.habit]}`}>
                {HABIT_LABEL[k.habit]}
              </div>
            </div>
            <div className="text-[10px] text-gray-500 flex justify-between">
              <span>💰 賺 ${k.earned}</span>
              <span>🛒 花 ${k.spent}</span>
              <span>
                💝 捐 ${k.given}（{k.giveRatio}%）
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyKidActiveDaysCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      activeDays: number
      ratio: number
    }>
    topPerformer: { kidName: string; avatar: string; activeDays: number; ratio: number } | null
    familyAvgRatio: number
    message: string
  }>({
    queryKey: ["/api/family/kid-active-days?days=30"],
  })
  if (!data || data.kids.length === 0) return null
  const hasActivity = data.kids.some((k) => k.activeDays > 0)
  if (!hasActivity) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-cyan-400 bg-gradient-to-br from-cyan-50 to-teal-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📅 活躍天數排名（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        {data.topPerformer && (
          <div className="text-gray-600 mt-1">
            👑 最活躍：{data.topPerformer.avatar} {data.topPerformer.kidName}（
            {data.topPerformer.activeDays}/{data.days} 天 = {data.topPerformer.ratio}%）
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {data.kids.map((k, i) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="w-4 text-center text-gray-500">{i + 1}</div>
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="h-1.5 bg-gray-100 rounded overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-teal-500"
                  style={{ width: `${k.ratio}%` }}
                />
              </div>
            </div>
            <div className="text-right whitespace-nowrap">
              <div className="text-sm font-bold">
                {k.activeDays}/{data.days}
              </div>
              <div className="text-[9px] text-gray-500">{k.ratio}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyTaskMvpCard() {
  const { data } = useQuery<{
    days: number
    tasks: Array<{
      taskId: number
      title: string
      emoji: string
      reward: number
      difficulty: string
      category: string
      completedAt: string
      kidName: string
      kidAvatar: string
    }>
    message: string
  }>({
    queryKey: ["/api/family/task-mvp?days=30&limit=5"],
  })
  if (!data || data.tasks.length === 0) return null

  const MEDAL = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]

  return (
    <div className="mb-4 rounded-2xl border-2 border-yellow-500 bg-gradient-to-br from-yellow-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏆 Task MVP（30 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {data.tasks.map((t, i) => (
          <div key={t.taskId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-xl">{MEDAL[i]}</div>
            <div className="text-lg">{t.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{t.title}</div>
              <div className="text-[10px] text-gray-500">
                {t.kidAvatar} {t.kidName} · {t.completedAt.slice(0, 10)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-amber-600">${t.reward}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyKidTaskCompletionRateCard() {
  const { data } = useQuery<{
    days: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      approved: number
      rejected: number
      rate: number
      level: "perfect" | "great" | "good" | "needs_practice" | "no_data"
    }>
    familyAvg: number
    message: string
  }>({
    queryKey: ["/api/family/kid-task-completion-rate?days=90"],
  })
  if (!data || data.kids.length === 0) return null
  const withData = data.kids.filter((k) => k.approved + k.rejected > 0)
  if (withData.length === 0) return null

  const LEVEL_COLOR: Record<string, string> = {
    perfect: "bg-yellow-400 text-yellow-900",
    great: "bg-emerald-400 text-white",
    good: "bg-blue-400 text-white",
    needs_practice: "bg-amber-400 text-white",
    no_data: "bg-gray-300 text-gray-700",
  }
  const LEVEL_LABEL: Record<string, string> = {
    perfect: "🏆 完美",
    great: "💪 優秀",
    good: "👍 良好",
    needs_practice: "📋 加強",
    no_data: "—",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">✅ 任務批准率（90 天）</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1.5">
        {withData.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2 flex items-center gap-2">
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1">
              <div className="text-sm font-medium">{k.kidName}</div>
              <div className="text-[10px] text-gray-500">
                ✓ {k.approved} · ✗ {k.rejected}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{k.rate}%</div>
              <div
                className={`text-[10px] px-1.5 py-0.5 rounded ${LEVEL_COLOR[k.level]} inline-block`}
              >
                {LEVEL_LABEL[k.level]}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyJarAllocationByKidCard() {
  const { data } = useQuery<{
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      spendRatio: number
      saveRatio: number
      giveRatio: number
      type: "saver" | "spender" | "giver" | "balanced"
    }>
    familyAvg: { spend: number; save: number; give: number }
    typeCounts: { saver: number; spender: number; giver: number; balanced: number }
    message: string
  }>({
    queryKey: ["/api/family/jar-allocation-by-kid"],
  })
  if (!data || data.kids.length === 0) return null

  const TYPE_LABEL: Record<string, string> = {
    saver: "💎 儲蓄型",
    spender: "🛒 花用型",
    giver: "💝 捐贈型",
    balanced: "⚖️ 平衡型",
  }
  const TYPE_COLOR: Record<string, string> = {
    saver: "bg-emerald-100 text-emerald-700",
    spender: "bg-rose-100 text-rose-700",
    giver: "bg-violet-100 text-violet-700",
    balanced: "bg-blue-100 text-blue-700",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏺 Jar 分配對比</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">
        {data.message}
        <div className="text-gray-600 mt-1">
          全家平均 花 {data.familyAvg.spend}% / 存 {data.familyAvg.save}% / 捐 {data.familyAvg.give}
          %
        </div>
      </div>

      <div className="space-y-1.5">
        {data.kids.map((k) => (
          <div key={k.kidId} className="bg-white rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 text-sm font-medium">{k.kidName}</div>
              <div className={`text-[10px] px-2 py-0.5 rounded ${TYPE_COLOR[k.type]}`}>
                {TYPE_LABEL[k.type]}
              </div>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
              <div className="bg-rose-400" style={{ width: `${k.spendRatio}%` }} />
              <div className="bg-emerald-500" style={{ width: `${k.saveRatio}%` }} />
              <div className="bg-violet-500" style={{ width: `${k.giveRatio}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
              <span>🛒{k.spendRatio}%</span>
              <span>💎{k.saveRatio}%</span>
              <span>💝{k.giveRatio}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
