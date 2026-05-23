/**
 * StreakChip — 連續記帳天數 chip
 *
 * 顯示「🔥 連續 X 天」、含 tooltip 顯示歷史最長 + 活躍度
 * 4 種狀態：
 *  - 0 天：灰色「💤 開始記第一筆」
 *  - 今日已記、current ≥ 7：橘紅色火焰
 *  - 今日已記、current 1-6：暖橘色
 *  - 今日未記但昨天有：黃色「⏰ 還沒記今天」
 */
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

interface StreakResponse {
  current: number
  longest: number
  lastRecordDate: string | null
  daysActive: number
  isOnFireToday: boolean
}

interface Props {
  size?: "sm" | "md"
  className?: string
}

export function StreakChip({ size = "sm", className }: Props) {
  const { data } = useQuery<StreakResponse>({
    queryKey: ["/api/household/streak"],
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })

  if (!data) return null
  const { current, longest, daysActive, isOnFireToday } = data

  // 文字 + 樣式
  let label: string
  let emoji: string
  let colorClass: string
  if (current === 0) {
    label = "開始記第一筆"
    emoji = "💤"
    colorClass = "bg-gray-100 text-gray-600 border-gray-200"
  } else if (!isOnFireToday) {
    // 今天還沒記、但昨天有（current 從昨天算起）
    label = `${current} 天 ·還沒記今天`
    emoji = "⏰"
    colorClass = "bg-amber-100 text-amber-800 border-amber-300"
  } else if (current >= 30) {
    label = `${current} 天 ·超強`
    emoji = "🔥🔥"
    colorClass = "bg-gradient-to-r from-rose-500 to-orange-500 text-white border-rose-600 shadow"
  } else if (current >= 7) {
    label = `${current} 天 ·持續中`
    emoji = "🔥"
    colorClass = "bg-orange-100 text-orange-800 border-orange-300"
  } else {
    label = `${current} 天 ·起步中`
    emoji = "✨"
    colorClass = "bg-amber-50 text-amber-700 border-amber-200"
  }

  const tooltip = `連續 ${current} 天 · 歷史最長 ${longest} 天 · 過去 90 天記 ${daysActive} 天`

  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        colorClass,
        className
      )}
      data-testid="streak-chip"
    >
      <span>{emoji}</span>
      <span>{label}</span>
      {longest > current && <span className="text-[9px] opacity-70 ml-1">最長 {longest}</span>}
    </span>
  )
}
