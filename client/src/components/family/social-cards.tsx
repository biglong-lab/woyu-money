/**
 * 家庭社交主題卡片（從 family.tsx 抽出、減輕主檔負擔）
 *
 * 包含：
 *  - FamilyTopTaskEmojisCard — 90 天 task emoji 排行
 *
 * 之後會逐步加入：行善里程碑 / 善心故事 / top recipients / 評論互動率
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
