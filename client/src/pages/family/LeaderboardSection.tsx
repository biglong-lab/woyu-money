/**
 * 家庭記帳家長主頁 — 本月排行榜區塊（積分/任務數/善行/打卡 四種模式）
 *
 * 2026-07 巨檔拆分：從 pages/family.tsx 原樣搬出、邏輯完全不變。
 */
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy } from "lucide-react"
import { LeaderboardEntry, formatMoney } from "@/components/family/family-shared"
import type { LeaderboardMode } from "./types"

interface LeaderboardSectionProps {
  leaderboard: { month: string; leaderboard: LeaderboardEntry[] } | undefined
  lbMode: LeaderboardMode
  onModeChange: (mode: LeaderboardMode) => void
}

/** 本月排行榜（無資料時不渲染）*/
export function LeaderboardSection({ leaderboard, lbMode, onModeChange }: LeaderboardSectionProps) {
  if (!leaderboard || leaderboard.leaderboard.length === 0) return null

  return (
    <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50">
      <CardHeader className="py-3 px-3 sm:px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-600" />
          本月排行榜（{leaderboard.month}）
        </CardTitle>
        <CardDescription>切換不同角度看孩子的努力</CardDescription>
        <div className="flex gap-1 mt-2 flex-wrap">
          {[
            { v: "score" as const, label: "🏆 積分", desc: "難度加權" },
            { v: "tasks" as const, label: "📋 任務數", desc: "完成多少" },
            { v: "giving" as const, label: "❤️ 善行", desc: "捐獻金額" },
            { v: "streak" as const, label: "🔥 打卡", desc: "連續天數" },
          ].map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => onModeChange(m.v)}
              className={`text-xs py-1 px-2.5 rounded border ${
                lbMode === m.v
                  ? "bg-yellow-200 border-yellow-500 font-medium"
                  : "bg-white border-yellow-200 hover:bg-yellow-100"
              }`}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="py-2 px-3 sm:px-4 space-y-2">
        {leaderboard.leaderboard.map((entry) => (
          <motion.div
            key={entry.kidId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: entry.rank * 0.05 }}
            className={`flex items-center gap-2 p-2 rounded-lg ${
              entry.rank === 1
                ? "bg-yellow-100 border-2 border-yellow-400"
                : entry.rank === 2
                  ? "bg-gray-100 border border-gray-300"
                  : entry.rank === 3
                    ? "bg-orange-100 border border-orange-300"
                    : "bg-white"
            }`}
          >
            <div className="text-2xl w-8 text-center">{entry.medal || `#${entry.rank}`}</div>
            <div className="text-3xl">{entry.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold">{entry.displayName}</div>
              <div className="text-[10px] text-gray-500 flex gap-2 flex-wrap">
                <span>📋 {entry.approvedCount} 個任務</span>
                {entry.hardCount > 0 && (
                  <span className="text-rose-600">⭐⭐⭐ ×{entry.hardCount}</span>
                )}
                {entry.completedGoalsCount > 0 && (
                  <span>🎯 達標 {entry.completedGoalsCount}</span>
                )}
                {entry.badgeCount > 0 && <span>🏅 +{entry.badgeCount} 徽章</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-amber-700">
                {lbMode === "giving"
                  ? `❤️ ${formatMoney(entry.giveSum)}`
                  : lbMode === "tasks"
                    ? `📋 ${entry.approvedCount}`
                    : lbMode === "streak"
                      ? `🔥 ${entry.streak} 天`
                      : formatMoney(entry.approvedSum)}
              </div>
              <div className="text-[10px] text-rose-600 font-medium">
                積分 {entry.weightedScore}
              </div>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  )
}
