/**
 * 家庭排行 / bucket 主題卡片（從 family.tsx 抽出）
 *
 * 包含：
 *  - FamilyStreakRankingCard — 連續打卡排行
 *  - FamilyBiggestSpendingsCard — 30 天最大花費排行
 *  - FamilyBiggestWinsCard — 30 天大獎排行
 *  - FamilyWishesAgingCard — 願望年齡分布 buckets
 */
import { useQuery } from "@tanstack/react-query"

export function FamilyStreakRankingCard() {
  const { data } = useQuery<{
    totalKids: number
    activeStreakers: number
    maxStreak: number
    champion: { kidName: string; avatar: string; streak: number } | null
    ranking: Array<{ kidId: number; kidName: string; avatar: string; streak: number }>
    message: string
  }>({
    queryKey: ["/api/family/streak-ranking"],
  })
  if (!data || data.totalKids === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-yellow-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🔥 連續打卡排行</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1">
        {data.ranking.map((k, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`
          const isChampion = i === 0 && k.streak > 0
          return (
            <div
              key={k.kidId}
              className={`rounded-lg p-2 flex items-center gap-2 text-xs ${
                isChampion ? "bg-yellow-100 border-2 border-yellow-400" : "bg-white"
              }`}
            >
              <div className="w-6 text-center text-sm">{medal}</div>
              <div className="text-lg">{k.avatar}</div>
              <div className="flex-1 font-medium">{k.kidName}</div>
              <div className="text-xl font-bold text-orange-600">
                {k.streak > 0 ? `🔥 ${k.streak}` : "—"}
              </div>
              <div className="text-[10px] text-gray-500 w-8">天</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FamilyBiggestSpendingsCard() {
  const { data } = useQuery<{
    days: number
    spendings: Array<{
      spendingId: number
      amount: number
      description: string
      emoji: string
      jar: string
      recipient: string | null
      spendDate: string
      kidName: string
      kidAvatar: string
    }>
    spendingCount: number
    topSpending: { amount: number; description: string; kidName: string } | null
    grandTotal: number
    message: string
  }>({
    queryKey: ["/api/family/biggest-spendings?days=30&limit=10"],
  })
  if (!data || data.spendingCount === 0) return null

  const JAR_EMOJI: Record<string, string> = {
    spend: "💸",
    save: "🐷",
    give: "❤️",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-pink-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">💸 30 天最大花費排行</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {data.spendings.map((s, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`
          return (
            <div
              key={s.spendingId}
              className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs"
            >
              <div className="w-6 text-center text-sm">{medal}</div>
              <div className="text-lg">{s.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.description}</div>
                <div className="text-[10px] text-gray-500">
                  {s.kidAvatar} {s.kidName} · {JAR_EMOJI[s.jar] ?? "•"} {s.spendDate}
                  {s.recipient && ` · → ${s.recipient}`}
                </div>
              </div>
              <div className="text-base font-bold text-rose-700">${s.amount}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FamilyBiggestWinsCard() {
  const { data } = useQuery<{
    days: number
    wins: Array<{
      taskId: number
      title: string
      emoji: string
      reward: number
      difficulty: string
      approvedAt: string
      kidName: string
      kidAvatar: string
    }>
    winCount: number
    topWin: { reward: number; kidName: string; title: string } | null
    grandTotal: number
    message: string
  }>({
    queryKey: ["/api/family/biggest-wins?days=30&limit=10"],
  })
  if (!data || data.winCount === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🏆 30 天大獎排行</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {data.wins.map((w, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`
          return (
            <div key={w.taskId} className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs">
              <div className="w-6 text-center text-sm">{medal}</div>
              <div className="text-lg">{w.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{w.title}</div>
                <div className="text-[10px] text-gray-500">
                  {w.kidAvatar} {w.kidName} · {w.approvedAt?.slice(0, 10)}
                </div>
              </div>
              <div className="text-base font-bold text-amber-700">${w.reward}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FamilyWishesAgingCard() {
  const { data } = useQuery<{
    totalWishes: number
    buckets: Array<{
      key: string
      label: string
      emoji: string
      wishCount: number
      totalValue: number
    }>
    oldest: { title: string; ageDays: number; kidName: string } | null
    averageAge: number
    ancientCount: number
    message: string
  }>({
    queryKey: ["/api/family/wishes-aging"],
  })
  if (!data || data.totalWishes === 0) return null

  const BUCKET_COLOR: Record<string, string> = {
    fresh: "bg-emerald-100 text-emerald-700",
    thinking: "bg-blue-100 text-blue-700",
    stale: "bg-orange-100 text-orange-700",
    ancient: "bg-red-100 text-red-700",
  }

  const borderColor = data.ancientCount > 0 ? "border-red-300" : "border-purple-300"
  const bgGradient =
    data.ancientCount > 0 ? "from-red-50 to-rose-50" : "from-purple-50 to-fuchsia-50"

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${borderColor} bg-gradient-to-br ${bgGradient} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">📦 願望年齡分布</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-4 gap-1 mb-2">
        {data.buckets.map((b) => (
          <div
            key={b.key}
            className={`rounded-lg p-2 text-center ${BUCKET_COLOR[b.key] ?? "bg-gray-100"}`}
          >
            <div className="text-lg">{b.emoji}</div>
            <div className="text-[9px] truncate">{b.label}</div>
            <div className="font-bold">{b.wishCount}</div>
          </div>
        ))}
      </div>

      {data.oldest && (
        <div className="bg-white rounded-lg p-2 text-xs">
          <div className="text-[10px] text-gray-500">最老願望</div>
          <div className="font-medium">
            「{data.oldest.title}」— {data.oldest.kidName}（{data.oldest.ageDays} 天）
          </div>
        </div>
      )}
    </div>
  )
}
