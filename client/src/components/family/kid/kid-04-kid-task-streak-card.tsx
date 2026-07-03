/**
 * family 卡片元件（自 family.tsx 機械拆分 kid-04-kid-task-streak-card，2026-07-03）
 */
import { useQuery } from "@tanstack/react-query"

export function KidTaskStreakCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    currentStreak: number
    longestStreak: number
    lastTaskDate: string | null
    message: string
  }>({
    queryKey: ["/api/family/kid-task-streak", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-task-streak?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data) return null

  // 無任何任務則不顯示
  if (data.longestStreak === 0) return null

  const intensity =
    data.currentStreak === 0
      ? "from-gray-100 to-gray-50 border-gray-300"
      : data.currentStreak < 3
        ? "from-orange-100 to-amber-50 border-orange-300"
        : data.currentStreak < 7
          ? "from-amber-100 to-yellow-50 border-amber-400"
          : data.currentStreak < 30
            ? "from-rose-100 to-orange-50 border-rose-400"
            : "from-purple-100 to-pink-50 border-purple-500"

  return (
    <div className={`mb-4 rounded-2xl border-2 ${intensity} bg-gradient-to-r p-3 shadow`}>
      <div className="flex items-center gap-3">
        <div className="text-4xl">🔥</div>
        <div className="flex-1">
          <div className="text-xs text-gray-600">連續做任務</div>
          <div className="text-3xl font-bold text-orange-700">
            {data.currentStreak} <span className="text-base font-normal text-gray-500">天</span>
          </div>
          <div className="text-xs text-gray-600 mt-0.5">{data.message}</div>
        </div>
        {data.longestStreak > data.currentStreak && (
          <div className="text-right shrink-0">
            <div className="text-xs text-gray-500">最高紀錄</div>
            <div className="text-xl font-bold text-amber-700">{data.longestStreak}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function KidTimeOfDayCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    totalTasks: number
    slots: Array<{
      slot: "morning" | "afternoon" | "evening" | "night"
      name: string
      emoji: string
      range: string
      count: number
      percentage: number
    }>
    dominantSlot: { name: string; emoji: string; personality: string } | null
  }>({
    queryKey: ["/api/family/kid-time-of-day", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-time-of-day?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.totalTasks === 0) return null

  const SLOT_COLOR: Record<string, string> = {
    morning: "bg-yellow-400",
    afternoon: "bg-orange-400",
    evening: "bg-purple-400",
    night: "bg-indigo-400",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50 p-4 shadow">
      <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">⏰ 我什麼時候做最多</h3>

      {data.dominantSlot && (
        <div className="bg-white rounded-lg p-3 mb-3 text-center shadow-sm">
          <div className="text-4xl mb-1">{data.dominantSlot.emoji}</div>
          <div className="text-sm font-bold text-slate-900">{data.dominantSlot.name}型</div>
          <div className="text-xs text-gray-600 mt-1">{data.dominantSlot.personality}</div>
        </div>
      )}

      <div className="space-y-2">
        {data.slots.map((s) => (
          <div key={s.slot} className="bg-white/70 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1 text-sm">
              <span>
                {s.emoji} {s.name} <span className="text-xs text-gray-500">（{s.range}）</span>
              </span>
              <span className="font-bold">
                {s.count} 次 ({s.percentage}%)
              </span>
            </div>
            <div className="h-2 w-full bg-white rounded-full overflow-hidden">
              <div
                className={`h-full ${SLOT_COLOR[s.slot]}`}
                style={{ width: `${s.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function KidDifficultyCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    totalTasks: number
    difficulties: Array<{
      difficulty: "easy" | "medium" | "hard"
      name: string
      emoji: string
      count: number
      percentage: number
    }>
    averageScore: number
    challengeLevel: "none" | "beginner" | "growing" | "balanced" | "advanced"
    suggestion: string
  }>({
    queryKey: ["/api/family/kid-difficulty-stats", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-difficulty-stats?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.totalTasks === 0) return null

  const LEVEL_COLOR: Record<string, { bg: string; text: string }> = {
    beginner: { bg: "bg-green-50 border-green-200", text: "text-green-700" },
    growing: { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700" },
    balanced: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
    advanced: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700" },
    none: { bg: "bg-gray-50 border-gray-200", text: "text-gray-700" },
  }
  const c = LEVEL_COLOR[data.challengeLevel]

  return (
    <div className={`mb-4 rounded-2xl border-2 ${c.bg} p-4 shadow`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-bold ${c.text} flex items-center gap-2`}>🎯 挑戰度</h3>
        <span className={`text-xs ${c.text} font-bold`}>
          平均 {data.averageScore.toFixed(2)} 分
        </span>
      </div>

      {/* 3 個難度條形圖 */}
      <div className="space-y-2 mb-3">
        {data.difficulties.map((d) => (
          <div key={d.difficulty} className="bg-white/70 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1 text-sm">
              <span>
                {d.emoji} {d.name}
              </span>
              <span className="font-bold">
                {d.count} 個 ({d.percentage}%)
              </span>
            </div>
            <div className="h-2 w-full bg-white rounded-full overflow-hidden">
              <div
                className={
                  d.difficulty === "easy"
                    ? "h-full bg-green-400"
                    : d.difficulty === "medium"
                      ? "h-full bg-yellow-400"
                      : "h-full bg-rose-400"
                }
                style={{ width: `${d.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 建議文案 */}
      <div className={`text-sm ${c.text} bg-white/70 rounded px-3 py-2 font-medium`}>
        💬 {data.suggestion}
      </div>
    </div>
  )
}

export function GoalEtaBadge({ goalId }: { goalId: number }) {
  const { data } = useQuery<{
    status: "reached" | "predictable" | "no_savings"
    etaDays: number | null
    etaDate: string | null
    suggestion: string
  }>({
    queryKey: ["/api/family/goals", goalId, "eta"],
    queryFn: async () => {
      const res = await fetch(`/api/family/goals/${goalId}/eta`, { credentials: "include" })
      return res.json()
    },
  })
  if (!data) return null

  const colorByStatus = {
    reached: "bg-green-50 text-green-700 border-green-200",
    predictable: "bg-blue-50 text-blue-700 border-blue-200",
    no_savings: "bg-amber-50 text-amber-700 border-amber-200",
  }
  return (
    <div
      className={`text-xs rounded px-2 py-1.5 mb-1.5 border ${colorByStatus[data.status]} flex items-center gap-1`}
    >
      <span className="shrink-0">⏱️</span>
      <span className="flex-1">{data.suggestion}</span>
    </div>
  )
}

export function KidEmojiCloudCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    total: number
    uniqueEmojis: number
    mostUsed: { emoji: string; count: number } | null
    emojis: Array<{
      emoji: string
      count: number
      sampleTitle: string
      sizeRem: number
      percentage: number
    }>
  }>({
    queryKey: ["/api/family/kid-emoji-cloud", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-emoji-cloud?kidId=${kidId}&limit=15`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-fuchsia-300 bg-gradient-to-br from-fuchsia-50 to-pink-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-fuchsia-900 flex items-center gap-2">🎨 我的成就雲</h3>
        <span className="text-xs text-gray-500">
          {data.uniqueEmojis} 種・{data.total} 個任務
        </span>
      </div>

      {data.mostUsed && (
        <div className="bg-white rounded-lg p-3 mb-3 text-center">
          <div className="text-5xl mb-1">{data.mostUsed.emoji}</div>
          <div className="text-xs text-gray-500">最常做的（{data.mostUsed.count} 次）</div>
        </div>
      )}

      {/* Emoji 雲：依 sizeRem 動態大小 */}
      <div className="bg-white/70 rounded-lg p-3 flex flex-wrap gap-2 items-center justify-center">
        {data.emojis.map((e) => (
          <span
            key={e.emoji}
            className="leading-none"
            style={{ fontSize: `${e.sizeRem}rem` }}
            title={`${e.emoji} ${e.count} 次（${e.percentage}%）`}
          >
            {e.emoji}
          </span>
        ))}
      </div>
    </div>
  )
}

export function KidStrengthsCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    totalTasks: number
    categories: Array<{
      category: string
      name: string
      emoji: string
      count: number
      percentage: number
      level: "S" | "A" | "B" | "C" | "D"
    }>
    topCategory: { name: string; emoji: string; praise: string; level: string } | null
  }>({
    queryKey: ["/api/family/kid-strengths", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-strengths?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.totalTasks === 0) return null

  const LEVEL_COLOR: Record<string, { bg: string; text: string; ring: string }> = {
    S: { bg: "bg-rose-100", text: "text-rose-700", ring: "ring-rose-300" },
    A: { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-300" },
    B: { bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-300" },
    C: { bg: "bg-blue-100", text: "text-blue-700", ring: "ring-blue-300" },
    D: { bg: "bg-gray-100", text: "text-gray-500", ring: "ring-gray-300" },
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-blue-50 p-4 shadow">
      <h3 className="font-bold text-cyan-900 mb-3 flex items-center gap-2">💪 我的天賦</h3>

      {/* topCategory 大字 */}
      {data.topCategory && (
        <div className="bg-white rounded-lg p-3 mb-3 text-center shadow-sm">
          <div className="text-4xl mb-1">{data.topCategory.emoji}</div>
          <div className="text-sm font-bold text-cyan-900">
            最強：{data.topCategory.name}（{data.topCategory.level} 級）
          </div>
          <div className="text-xs text-gray-600 mt-1">{data.topCategory.praise}</div>
        </div>
      )}

      {/* 5 大類條形圖 */}
      <div className="space-y-2">
        {data.categories.map((c) => {
          const color = LEVEL_COLOR[c.level]
          return (
            <div key={c.category} className={`rounded-lg p-2 ${color.bg}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">
                  {c.emoji} {c.name}
                </span>
                <span
                  className={`text-xs font-bold ${color.text} px-2 py-0.5 rounded ring-1 ${color.ring} bg-white`}
                >
                  {c.level} 級・{c.count} 次
                </span>
              </div>
              <div className="h-2 w-full bg-white/60 rounded-full overflow-hidden">
                <div
                  className={`h-full ${color.text.replace("text-", "bg-")}`}
                  style={{ width: `${c.percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function KidDonationRecipientsCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    totalGiven: number
    totalRecipients: number
    mostHelped: { recipient: string; total: number; times: number } | null
    recipients: Array<{
      recipient: string
      times: number
      total: number
      lastAt: string | null
    }>
  }>({
    queryKey: ["/api/family/kid-donation-recipients", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-donation-recipients?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.totalRecipients === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-pink-900 flex items-center gap-2">❤️ 我幫助過誰</h3>
        <span className="text-xs text-gray-500">
          ${data.totalGiven}・{data.totalRecipients} 位
        </span>
      </div>

      {data.mostHelped && (
        <div className="bg-white rounded-lg p-3 mb-3 text-center">
          <div className="text-xs text-gray-500">最常幫助</div>
          <div className="text-lg font-bold text-pink-900">{data.mostHelped.recipient}</div>
          <div className="text-xs text-gray-600">
            累積捐 ${data.mostHelped.total}（{data.mostHelped.times} 次）
          </div>
        </div>
      )}

      <div className="space-y-1">
        {data.recipients.map((r) => {
          const percentage = data.totalGiven > 0 ? Math.round((r.total / data.totalGiven) * 100) : 0
          return (
            <div key={r.recipient} className="bg-white rounded-lg p-2">
              <div className="flex items-center justify-between mb-1 text-sm">
                <span className="font-medium">🤝 {r.recipient}</span>
                <span className="text-xs font-bold text-pink-700">
                  ${r.total}（{r.times} 次）
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-400 to-rose-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function KidSpendingKeywordsCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    totalSpent: number
    totalCount: number
    keywords: Array<{
      description: string
      emoji: string
      jar: string
      count: number
      totalAmount: number
      lastSpentAt: string | null
    }>
    topKeyword: { description: string; totalAmount: number } | null
  }>({
    queryKey: ["/api/family/kid-spending-keywords", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-spending-keywords?kidId=${kidId}&limit=10`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.totalCount === 0) return null

  const JAR_COLOR: Record<string, string> = {
    spend: "bg-rose-100 text-rose-700",
    save: "bg-blue-100 text-blue-700",
    give: "bg-pink-100 text-pink-700",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-orange-900 flex items-center gap-2">🛒 我花錢買什麼</h3>
        <span className="text-xs text-gray-500">
          ${data.totalSpent}・{data.totalCount} 次
        </span>
      </div>

      {data.topKeyword && (
        <div className="bg-white rounded-lg p-2 mb-3 text-center text-sm">
          🏆 最常買：<b>{data.topKeyword.description}</b>（共 ${data.topKeyword.totalAmount}）
        </div>
      )}

      <div className="space-y-1">
        {data.keywords.map((k) => {
          const percentage =
            data.totalSpent > 0 ? Math.round((k.totalAmount / data.totalSpent) * 100) : 0
          return (
            <div key={k.description} className="bg-white rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm flex items-center gap-1">
                  <span>{k.emoji}</span>
                  <span className="font-medium">{k.description}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${JAR_COLOR[k.jar] || JAR_COLOR.spend}`}
                  >
                    {k.jar}
                  </span>
                </span>
                <span className="text-xs font-bold text-orange-700">
                  ${k.totalAmount}（{k.count} 次）
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-amber-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function KidWalletHealthCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    totalReward: number
    breakdown: {
      spent: number
      saved: number
      given: number
      preset: { spend: number; save: number; give: number }
      actual: { spend: number; save: number; give: number }
      delta: { spend: number; save: number; give: number }
    } | null
    healthScore: number | null
    suggestion: string
  }>({
    queryKey: ["/api/family/kid-wallet-health", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-wallet-health?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.totalReward === 0 || !data.breakdown) return null

  const { breakdown, healthScore } = data
  const score = healthScore ?? 0
  const color =
    score >= 85
      ? "text-emerald-700 border-emerald-300 bg-emerald-50"
      : score >= 70
        ? "text-blue-700 border-blue-300 bg-blue-50"
        : score >= 50
          ? "text-amber-700 border-amber-300 bg-amber-50"
          : "text-rose-700 border-rose-300 bg-rose-50"

  function deltaTag(d: number) {
    if (d === 0) return ""
    return d > 0 ? `+${d}%` : `${d}%`
  }

  return (
    <div className={`mb-4 rounded-2xl border-2 p-4 shadow ${color}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2">💼 錢包健康</h3>
        <div className="text-right">
          <div className="text-xs opacity-70">健康分數</div>
          <div className="text-2xl font-bold">{score}</div>
        </div>
      </div>

      {/* 3 罐：preset vs actual */}
      <div className="space-y-2 mb-2">
        {[
          { key: "spend", emoji: "💸", name: "花用" },
          { key: "save", emoji: "🐷", name: "存錢" },
          { key: "give", emoji: "❤️", name: "捐獻" },
        ].map((j) => {
          const preset = breakdown.preset[j.key as "spend" | "save" | "give"]
          const actual = breakdown.actual[j.key as "spend" | "save" | "give"]
          const delta = breakdown.delta[j.key as "spend" | "save" | "give"]
          return (
            <div key={j.key} className="bg-white/70 rounded-lg p-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {j.emoji} {j.name}
                </span>
                <span className="text-xs">
                  預設 {preset}% / 實際 {actual}%
                  {delta !== 0 && (
                    <b className={delta > 0 ? "text-rose-600 ml-1" : "text-amber-600 ml-1"}>
                      （{deltaTag(delta)}）
                    </b>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* 建議 */}
      <div className="text-sm bg-white/70 rounded px-3 py-2 font-medium">{data.suggestion}</div>
    </div>
  )
}
