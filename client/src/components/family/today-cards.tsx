/**
 * 家庭今日主題卡片（從 family.tsx 抽出）
 *
 * 包含：
 *  - FamilyTodaySpendingFeedCard — 今日花費即時動態
 *  - FamilyTodayCheckinRosterCard — 今日簽到名冊
 *  - FamilyTodayTasksListCard — 今日完成任務清單
 */
import { useQuery } from "@tanstack/react-query"

export function FamilyTodaySpendingFeedCard() {
  const { data } = useQuery<{
    items: Array<{
      spendingId: number
      amount: number
      description: string
      emoji: string
      jar: string
      recipient: string | null
      createdAt: string
      kidName: string
      kidAvatar: string
    }>
    totalCount: number
    totalAmount: number
    uniqueKids: number
    message: string
  }>({
    queryKey: ["/api/family/today-spending-feed?limit=20"],
  })
  if (!data || data.totalCount === 0) return null

  const JAR_COLOR: Record<string, string> = {
    spend: "border-rose-400",
    save: "border-emerald-400",
    give: "border-pink-400",
  }
  const JAR_EMOJI: Record<string, string> = {
    spend: "💸",
    save: "🐷",
    give: "❤️",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-slate-300 bg-gradient-to-br from-slate-50 to-gray-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📋 今日花費即時動態</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {data.items.map((it) => (
          <div
            key={it.spendingId}
            className={`bg-white rounded-lg p-2 flex items-center gap-2 text-xs border-l-4 ${JAR_COLOR[it.jar] ?? "border-gray-300"}`}
          >
            <div className="text-lg">{it.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {it.description}
                {it.recipient && (
                  <span className="text-gray-500 text-[10px]"> → {it.recipient}</span>
                )}
              </div>
              <div className="text-[10px] text-gray-500">
                {it.kidAvatar} {it.kidName} · {JAR_EMOJI[it.jar] ?? "•"} ·{" "}
                {it.createdAt?.slice(11, 16)}
              </div>
            </div>
            <div className="text-sm font-bold text-slate-700">${it.amount}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyTodayCheckinRosterCard() {
  const { data } = useQuery<{
    totalKids: number
    checkedInCount: number
    uncheckedCount: number
    rate: number
    kids: Array<{
      kidId: number
      kidName: string
      avatar: string
      checkedIn: boolean
      mood: string | null
      note: string | null
    }>
    uncheckedKids: Array<{ kidId: number; kidName: string; avatar: string }>
    message: string
  }>({
    queryKey: ["/api/family/today-checkin-roster"],
  })
  if (!data || data.totalKids === 0) return null

  const allDone = data.checkedInCount === data.totalKids
  const borderColor = allDone ? "border-emerald-300" : "border-yellow-300"
  const bgGradient = allDone ? "from-emerald-50 to-green-50" : "from-yellow-50 to-amber-50"

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${borderColor} bg-gradient-to-br ${bgGradient} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">
        {allDone ? "🎉" : "📋"} 今日簽到名冊 ({data.checkedInCount}/{data.totalKids})
      </h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1">
        {data.kids.map((k) => (
          <div
            key={k.kidId}
            className={`rounded-lg p-2 flex items-center gap-2 text-xs ${k.checkedIn ? "bg-white" : "bg-yellow-50 border border-yellow-200"}`}
          >
            <div className="text-lg">{k.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{k.kidName}</div>
              {k.checkedIn ? (
                <div className="text-[10px] text-gray-600 truncate">
                  {k.mood} {k.note && `· ${k.note}`}
                </div>
              ) : (
                <div className="text-[10px] text-yellow-700">尚未簽到</div>
              )}
            </div>
            <div className="text-base">{k.checkedIn ? "✅" : "⏰"}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyTodayTasksListCard() {
  const { data } = useQuery<{
    tasks: Array<{
      taskId: number
      title: string
      emoji: string
      reward: number
      category: string
      difficulty: string
      completedAt: string
      kidName: string
      kidAvatar: string
    }>
    totalCount: number
    totalReward: number
    message: string
  }>({
    queryKey: ["/api/family/today-tasks-list?limit=20"],
  })
  if (!data || data.tasks.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">📋 今日完成清單</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {data.tasks.map((t) => (
          <div key={t.taskId} className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs">
            <div className="text-lg">{t.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.title}</div>
              <div className="text-[10px] text-gray-500">
                {t.kidAvatar} {t.kidName} · {t.completedAt.slice(11, 16)}
              </div>
            </div>
            <div className="text-sm font-bold text-amber-600">${t.reward}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
