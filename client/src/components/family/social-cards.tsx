/**
 * 家庭社交主題卡片（從 family.tsx 抽出、減輕主檔負擔）
 *
 * 包含：
 *  - FamilyTopTaskEmojisCard — 90 天 task emoji 排行
 *  - FamilyCommentInteractionCard — 30 天評論互動（家長 vs 小孩）
 *  - FamilyKindnessMilestoneCard — 家庭行善里程碑
 *  - FamilyTopRecipientsCard — 家裡最支持的對象 ranking
 *  - FamilyKindnessStoryCard — 本週善心故事
 */
import { useQuery } from "@tanstack/react-query"

export function FamilyTopTaskEmojisCard() {
  const { data } = useQuery<{
    days: number
    emojis: Array<{ emoji: string; useCount: number; uniqueKids: number; percentage: number }>
    emojiCount: number
    totalCount: number
    topEmoji: { emoji: string; useCount: number } | null
    message: string
  }>({
    queryKey: ["/api/family/top-task-emojis?days=90&limit=10"],
  })
  if (!data || data.emojiCount === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-purple-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">🎨 任務 emoji 文化 (90 天)</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-5 gap-2">
        {data.emojis.map((e, i) => (
          <div
            key={e.emoji}
            className="bg-white rounded-lg p-2 text-center border-2 border-violet-100 hover:border-violet-300 transition-colors"
            title={`${e.emoji} × ${e.useCount} 次（${e.uniqueKids} 位小孩、${e.percentage}%）`}
          >
            <div className="text-2xl">{e.emoji}</div>
            <div className="text-[10px] text-gray-600 mt-1">×{e.useCount}</div>
            {i < 3 && (
              <div className="text-[9px] text-violet-600 font-bold">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function FamilyCommentInteractionCard() {
  const { data } = useQuery<{
    days: number
    totalCount: number
    parent: { count: number; percentage: number; uniqueTasks: number }
    kid: { count: number; percentage: number; uniqueTasks: number }
    interaction: "balanced" | "parent_heavy" | "kid_heavy" | "low" | "none"
    message: string
  }>({
    queryKey: ["/api/family/comment-interaction?days=30"],
  })
  if (!data || data.totalCount === 0) return null

  const BG_COLORS: Record<string, string> = {
    balanced: "from-green-50 to-teal-50 border-green-300",
    parent_heavy: "from-blue-50 to-indigo-50 border-blue-300",
    kid_heavy: "from-purple-50 to-pink-50 border-purple-300",
    low: "from-amber-50 to-yellow-50 border-amber-300",
  }
  const cls = BG_COLORS[data.interaction] ?? "from-gray-50 to-slate-50 border-gray-300"

  return (
    <div
      className={`mb-4 rounded-2xl border-2 ${cls.split(" ").slice(-1)[0]} bg-gradient-to-br ${cls.split(" ").slice(0, 2).join(" ")} p-3 shadow`}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">💬 30 天評論互動</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-2 mb-2">
        <div className="flex items-center gap-2 text-xs mb-1">
          <div className="flex-1">
            <span className="text-blue-600">👨‍👩‍👧 家長 {data.parent.count}</span>
          </div>
          <div className="flex-1 text-right">
            <span className="text-purple-600">🧒 小孩 {data.kid.count}</span>
          </div>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden">
          <div
            className="bg-blue-400"
            style={{ width: `${data.parent.percentage}%` }}
            title={`家長 ${data.parent.percentage}%`}
          />
          <div
            className="bg-purple-400"
            style={{ width: `${data.kid.percentage}%` }}
            title={`小孩 ${data.kid.percentage}%`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>{data.parent.percentage}%</span>
          <span>{data.kid.percentage}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white rounded p-2 text-center">
          <div className="font-bold text-blue-700">{data.parent.uniqueTasks}</div>
          <div className="text-[10px] text-gray-500">家長留言 task 數</div>
        </div>
        <div className="bg-white rounded p-2 text-center">
          <div className="font-bold text-purple-700">{data.kid.uniqueTasks}</div>
          <div className="text-[10px] text-gray-500">小孩留言 task 數</div>
        </div>
      </div>
    </div>
  )
}

export function FamilyKindnessMilestoneCard() {
  const { data } = useQuery<{
    total: number
    currentMilestone: { tier: string; amount: number; emoji: string } | null
    nextMilestone: { tier: string; amount: number; emoji: string } | null
    progressToNext: number
    amountToNext: number
    message: string
  }>({
    queryKey: ["/api/family/kindness-milestone"],
  })
  if (!data || data.total === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">
        {data.currentMilestone?.emoji ?? "❤️"} 家庭行善里程碑
      </h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="bg-white rounded-lg p-3 text-center mb-2">
        <div className="text-[10px] text-gray-600">累積行善</div>
        <div className="text-2xl font-bold text-amber-700">
          ${Math.round(data.total).toLocaleString()}
        </div>
        {data.currentMilestone && (
          <div className="text-xs text-amber-600 mt-1">
            目前等級：{data.currentMilestone.emoji} {data.currentMilestone.tier}
          </div>
        )}
      </div>

      {data.nextMilestone && (
        <div className="bg-white rounded-lg p-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600">
              距離 {data.nextMilestone.emoji} {data.nextMilestone.tier}
            </span>
            <span className="font-bold text-amber-700">{data.progressToNext}%</span>
          </div>
          <div className="w-full bg-amber-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-400 to-orange-500 h-2 transition-all"
              style={{ width: `${data.progressToNext}%` }}
            />
          </div>
          <div className="text-[10px] text-gray-500 mt-1 text-center">
            還差 ${Math.round(data.amountToNext)}
          </div>
        </div>
      )}
    </div>
  )
}

export function FamilyTopRecipientsCard() {
  const { data } = useQuery<{
    days: number
    recipients: Array<{
      recipient: string
      totalAmount: number
      giveCount: number
      uniqueKids: number
      lastGiveDate: string
    }>
    grandTotal: number
    recipientCount: number
    topPick: { recipient: string; totalAmount: number } | null
    message: string
  }>({
    queryKey: ["/api/family/top-recipients?days=30&limit=5"],
  })
  if (!data || data.recipients.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-pink-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">❤️ 家裡最支持的對象</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-1">
        {data.recipients.map((r, i) => {
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`
          return (
            <div
              key={r.recipient}
              className="bg-white rounded-lg p-2 flex items-center gap-2 text-xs"
            >
              <div className="w-6 text-center text-sm">{medal}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.recipient}</div>
                <div className="text-[10px] text-gray-500">
                  {r.giveCount} 次 · {r.uniqueKids} 位小孩 · 最近 {r.lastGiveDate}
                </div>
              </div>
              <div className="text-sm font-bold text-rose-600">${Math.round(r.totalAmount)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FamilyKindnessStoryCard() {
  const { data } = useQuery<{
    days: number
    stories: Array<{
      spendingId: number
      amount: number
      description: string
      emoji: string
      recipient: string | null
      reflection: string
      spendDate: string
      kidName: string
      kidAvatar: string
    }>
    totalKindness: number
    uniqueKids: number
    storyCount: number
    message: string
  }>({
    queryKey: ["/api/family/weekly-kindness-story"],
  })
  if (!data || data.stories.length === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50 p-3 shadow">
      <h3 className="font-bold mb-2 flex items-center gap-2">❤️ 本週善心故事</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {data.stories.map((s) => (
          <div key={s.spendingId} className="bg-white rounded-lg p-2 border-l-4 border-pink-400">
            <div className="flex items-center justify-between mb-1 text-xs">
              <div className="flex items-center gap-1">
                <span>{s.kidAvatar}</span>
                <span className="font-medium">{s.kidName}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500">{s.spendDate}</span>
              </div>
              <div className="font-bold text-rose-600">${s.amount}</div>
            </div>
            <div className="text-xs text-gray-700 mb-1">
              {s.emoji} {s.description}
              {s.recipient && <span className="text-gray-500"> → {s.recipient}</span>}
            </div>
            <div className="text-xs italic text-pink-700 bg-pink-50 rounded p-1">
              「{s.reflection}」
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
