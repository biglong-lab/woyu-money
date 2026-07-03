/**
 * family 卡片元件（自 family.tsx 機械拆分 kid-05-kid-bests-wall，2026-07-03）
 */
import { useQuery } from "@tanstack/react-query"

export function KidBestsWall({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    lifetime: {
      totalTasks: number
      totalSaved: number
      totalSpent: number
      totalGiven: number
      totalCheckinDays: number
    }
    bests: {
      biggestReward: number
      biggestSpend: number
      biggestGive: number
      longestStreak: number
    }
    firsts: {
      firstTaskAt: string | null
      firstSpendDate: string | null
      firstWishAt: string | null
    }
  }>({
    queryKey: ["/api/family/kid-bests", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-bests?kidId=${kidId}`, { credentials: "include" })
      return res.json()
    },
  })
  if (!data) return null

  const hasAny =
    data.lifetime.totalTasks > 0 ||
    data.lifetime.totalSpent > 0 ||
    data.lifetime.totalGiven > 0 ||
    data.lifetime.totalCheckinDays > 0
  if (!hasAny) return null

  function fmtDate(iso: string | null) {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("zh-TW")
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 p-4 shadow">
      <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2">🏅 我的紀錄牆</h3>

      {/* Lifetime 大字 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-2xl font-bold text-purple-700">{data.lifetime.totalTasks}</div>
          <div className="text-xs text-gray-500">完成任務</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-2xl font-bold text-blue-700">${data.lifetime.totalSaved}</div>
          <div className="text-xs text-gray-500">存款</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center shadow-sm">
          <div className="text-2xl font-bold text-pink-700">${data.lifetime.totalGiven}</div>
          <div className="text-xs text-gray-500">捐贈</div>
        </div>
      </div>

      {/* Personal Bests */}
      <div className="space-y-1 text-sm">
        {data.bests.biggestReward > 0 && (
          <div className="flex justify-between bg-white/60 rounded px-2 py-1">
            <span>🏆 最大任務獎勵</span>
            <span className="font-bold text-amber-700">${data.bests.biggestReward}</span>
          </div>
        )}
        {data.bests.biggestGive > 0 && (
          <div className="flex justify-between bg-white/60 rounded px-2 py-1">
            <span>❤️ 最大單筆捐贈</span>
            <span className="font-bold text-pink-700">${data.bests.biggestGive}</span>
          </div>
        )}
        {data.bests.longestStreak > 0 && (
          <div className="flex justify-between bg-white/60 rounded px-2 py-1">
            <span>🔥 連續打卡</span>
            <span className="font-bold text-orange-700">{data.bests.longestStreak} 天</span>
          </div>
        )}
        {data.lifetime.totalCheckinDays > 0 && (
          <div className="flex justify-between bg-white/60 rounded px-2 py-1">
            <span>📅 累積打卡</span>
            <span className="font-bold text-indigo-700">{data.lifetime.totalCheckinDays} 天</span>
          </div>
        )}
        {data.firsts.firstTaskAt && (
          <div className="flex justify-between bg-white/60 rounded px-2 py-1">
            <span>🎬 第一次完成任務</span>
            <span className="text-gray-600">{fmtDate(data.firsts.firstTaskAt)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function KidActivityTimeline({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    activities: Array<{
      kind: "task" | "spending" | "checkin" | "wish"
      id: number
      label: string
      amount: string
      emoji: string | null
      at: string
    }>
  }>({
    queryKey: ["/api/family/kid-activity", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-activity?kidId=${kidId}&limit=15`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data?.activities?.length) return null

  const KIND_LABEL: Record<string, { name: string; color: string; fallback: string }> = {
    task: { name: "完成任務", color: "text-green-700 bg-green-50", fallback: "📋" },
    spending: { name: "花錢", color: "text-rose-700 bg-rose-50", fallback: "💸" },
    checkin: { name: "打卡", color: "text-amber-700 bg-amber-50", fallback: "😊" },
    wish: { name: "願望", color: "text-violet-700 bg-violet-50", fallback: "✨" },
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return "剛剛"
    if (min < 60) return `${min} 分鐘前`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr} 小時前`
    const day = Math.floor(hr / 24)
    if (day < 30) return `${day} 天前`
    return new Date(iso).toLocaleDateString("zh-TW")
  }

  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="font-bold text-gray-700">📜 最近活動</h3>
        <span className="text-xs text-gray-400">最新 {data.activities.length} 筆</span>
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {data.activities.map((a) => {
          const meta = KIND_LABEL[a.kind]
          return (
            <div
              key={`${a.kind}-${a.id}`}
              className={`flex items-center gap-2 p-2 rounded-lg ${meta.color}`}
            >
              <span className="text-xl">{a.emoji || meta.fallback}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.label}</div>
                <div className="text-xs opacity-75">
                  {meta.name}・{a.amount}
                </div>
              </div>
              <span className="text-xs opacity-60 shrink-0">{timeAgo(a.at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function KidGoalDeadlinesCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    total: number
    passedCount: number
    urgentCount: number
    goals: Array<{
      id: number
      name: string
      emoji: string
      current: number
      target: number
      remaining: number
      progress: number
      daysLeft: number
      urgency: "passed" | "urgent" | "soon" | "ok"
      message: string
    }>
  }>({
    queryKey: ["/api/family/kid-goals-deadlines", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-goals-deadlines?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.total === 0) return null

  const URGENCY_COLOR: Record<string, string> = {
    passed: "bg-gray-100 border-gray-300 text-gray-700",
    urgent: "bg-rose-100 border-rose-400 text-rose-900",
    soon: "bg-amber-100 border-amber-400 text-amber-900",
    ok: "bg-emerald-50 border-emerald-300 text-emerald-900",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-pink-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-rose-900 flex items-center gap-2">⏳ 目標倒數</h3>
        {(data.urgentCount > 0 || data.passedCount > 0) && (
          <div className="flex gap-1 text-xs">
            {data.urgentCount > 0 && (
              <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold">
                🔥 {data.urgentCount}
              </span>
            )}
            {data.passedCount > 0 && (
              <span className="bg-gray-500 text-white px-2 py-0.5 rounded-full font-bold">
                ⏰ {data.passedCount}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {data.goals.map((g) => (
          <div key={g.id} className={`rounded-lg p-2 border-2 ${URGENCY_COLOR[g.urgency]}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{g.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{g.name}</div>
                <div className="text-xs opacity-75">
                  ${g.current} / ${g.target}（{g.progress}%）
                </div>
              </div>
            </div>
            <div className="h-1.5 w-full bg-white/70 rounded-full overflow-hidden mb-1">
              <div
                className={
                  g.urgency === "urgent"
                    ? "h-full bg-rose-500"
                    : g.urgency === "soon"
                      ? "h-full bg-amber-500"
                      : g.urgency === "passed"
                        ? "h-full bg-gray-400"
                        : "h-full bg-emerald-500"
                }
                style={{ width: `${g.progress}%` }}
              />
            </div>
            <div className="text-xs font-medium">{g.message}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const MONEY_QUOTES: Array<{ text: string; emoji: string }> = [
  { text: "存錢就是把今天的選擇、留給明天的自己。", emoji: "🐷" },
  { text: "錢不是萬能、但有錢能讓夢想變真實。", emoji: "💫" },
  { text: "賺錢有兩種：用時間換、和用智慧換。", emoji: "🧠" },
  { text: "想買東西前先問：我真的需要嗎？", emoji: "🤔" },
  { text: "捐贈一塊錢、就是分享一份善意。", emoji: "❤️" },
  { text: "小錢累積、就是大事業的起點。", emoji: "🌱" },
  { text: "比賺錢更重要的、是學會管錢。", emoji: "📚" },
  { text: "不要看別人有什麼、看自己想成為什麼。", emoji: "⭐" },
  { text: "存錢的習慣、比賺多少更重要。", emoji: "✨" },
  { text: "每一次儲蓄、都是對未來的投資。", emoji: "🌳" },
  { text: "聰明的人讓錢工作、傻的人為錢工作。", emoji: "🎯" },
  { text: "預算不是限制、是給自由的計畫。", emoji: "🗺️" },
  { text: "想要 vs 需要：兩個字差很多。", emoji: "💡" },
  { text: "金錢是工具、不是目標。", emoji: "🔧" },
  { text: "幫助別人、也是讓自己變得富足。", emoji: "🤝" },
  { text: "今天少花一杯飲料、明天多一個選擇。", emoji: "🥤" },
  { text: "存錢就像種樹、要有耐心等開花。", emoji: "🌸" },
  { text: "誠實的勞動最有價值。", emoji: "💪" },
  { text: "理財是一輩子的功課、慢慢學。", emoji: "🎓" },
  { text: "存夠了再買、不要先借再還。", emoji: "🐢" },
  { text: "感恩你擁有的、就會發現自己很富有。", emoji: "🙏" },
  { text: "金錢能買東西、買不到時間。", emoji: "⏰" },
  { text: "比別人少花、不是吝嗇、是聰明。", emoji: "🦊" },
  { text: "成功的人不是賺得多、是花得對。", emoji: "🎖️" },
  { text: "把錢分成三份：花、存、給予。", emoji: "🌈" },
  { text: "投資自己永遠是最棒的投資。", emoji: "🚀" },
  { text: "存錢罐沉沉的、心情會很滿足。", emoji: "🥰" },
  { text: "做家事不是為了錢、是為了愛家人。", emoji: "🏠" },
  { text: "學會等待、就學會了存錢。", emoji: "🕰️" },
  { text: "節儉是美德、不是吝嗇。", emoji: "🌟" },
]

export function KidWishlistSummaryCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    totalWishes: number
    totalEstimated: number
    available: number
    dailyEarning: number
    affordableCount: number
    wishes: Array<{
      id: number
      title: string
      emoji: string
      price: number
      status: "affordable" | "soon" | "saving"
      etaDays: number | null
    }>
  }>({
    queryKey: ["/api/family/kid-wishlist-summary", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-wishlist-summary?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.totalWishes === 0) return null

  const STATUS_COLOR: Record<string, string> = {
    affordable: "bg-emerald-100 text-emerald-800 border-emerald-300",
    soon: "bg-amber-100 text-amber-800 border-amber-300",
    saving: "bg-gray-100 text-gray-700 border-gray-300",
  }
  const STATUS_LABEL: Record<string, string> = {
    affordable: "🎉 可以買！",
    soon: "💪 快了！",
    saving: "🌱 還要存",
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-violet-900 flex items-center gap-2">🎁 我的願望</h3>
        <span className="text-xs text-gray-500">
          {data.affordableCount} 可買・全部 ${data.totalEstimated}
        </span>
      </div>

      <div className="bg-white rounded-lg p-2 mb-3 text-center text-xs text-gray-600">
        現在可用 <b className="text-violet-700">${data.available}</b>・每天賺{" "}
        <b className="text-violet-700">${data.dailyEarning.toFixed(0)}</b>
      </div>

      <div className="space-y-1.5">
        {data.wishes.slice(0, 8).map((w) => (
          <div key={w.id} className={`rounded-lg p-2 border ${STATUS_COLOR[w.status]}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{w.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{w.title}</div>
                <div className="text-xs opacity-75">
                  ${w.price}
                  {w.etaDays !== null && w.etaDays > 0 && `・${w.etaDays} 天後可買`}
                  {w.etaDays === null && "・先做任務才能買"}
                </div>
              </div>
              <span className="text-xs font-bold shrink-0">{STATUS_LABEL[w.status]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function KidJarFlow30dCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    days: number
    ratio: { spend: number; save: number; give: number }
    daily: Array<{
      spendIn: number
      saveIn: number
      giveIn: number
      spendOut: number
      saveOut: number
      giveOut: number
    }>
    totalEarned: number
    totalSpent: number
    message: string
  }>({
    queryKey: [`/api/family/kids/${kidId}/jar-balance-history?days=30`],
  })
  if (!data) return null

  const totalSpendIn = data.daily.reduce((s, d) => s + d.spendIn, 0)
  const totalSaveIn = data.daily.reduce((s, d) => s + d.saveIn, 0)
  const totalGiveIn = data.daily.reduce((s, d) => s + d.giveIn, 0)

  return (
    <div className="mb-4 rounded-xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-purple-50 p-3 shadow">
      <h3 className="font-bold mb-2 text-sm">📊 過去 30 天金流摘要</h3>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-xs">{data.message}</div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-emerald-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-600">💰 賺</div>
          <div className="text-base font-bold text-emerald-700">${data.totalEarned}</div>
        </div>
        <div className="bg-rose-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-600">💸 花</div>
          <div className="text-base font-bold text-rose-700">${data.totalSpent}</div>
        </div>
      </div>

      {data.totalEarned > 0 && (
        <div className="bg-white rounded-lg p-2">
          <div className="text-[10px] text-gray-600 mb-1">
            收入按 {data.ratio.spend}/{data.ratio.save}/{data.ratio.give} 分配
          </div>
          <div className="grid grid-cols-3 gap-1 text-xs">
            <div className="text-center">
              <div className="text-rose-600">💸 ${Math.round(totalSpendIn)}</div>
            </div>
            <div className="text-center">
              <div className="text-emerald-600">🐷 ${Math.round(totalSaveIn)}</div>
            </div>
            <div className="text-center">
              <div className="text-amber-600">🎁 ${Math.round(totalGiveIn)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function KidNetWorthCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    jars: { spend: number; save: number; give: number }
    goalsSaved: number
    totalNetWorth: number
    lifetimeEarned: number
    levelLabel: string
  }>({
    queryKey: ["/api/family/kid-net-worth", kidId],
    queryFn: async () => {
      const res = await fetch(`/api/family/kid-net-worth?kidId=${kidId}`, {
        credentials: "include",
      })
      return res.json()
    },
  })
  if (!data || data.totalNetWorth === 0) return null

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-yellow-100 via-amber-100 to-orange-100 p-4 shadow">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs text-amber-800">{data.levelLabel}</div>
          <div className="text-3xl font-bold text-amber-900">${data.totalNetWorth}</div>
          <div className="text-xs text-gray-600">我目前總財產</div>
        </div>
        <div className="text-right text-xs text-gray-600">
          <div>賺過 ${data.lifetimeEarned}</div>
          {data.goalsSaved > 0 && <div>存目標 ${data.goalsSaved}</div>}
        </div>
      </div>
      <div className="flex gap-1 text-xs">
        <span className="flex-1 bg-rose-100 text-rose-700 rounded px-2 py-1 text-center">
          💸 ${data.jars.spend}
        </span>
        <span className="flex-1 bg-blue-100 text-blue-700 rounded px-2 py-1 text-center">
          🐷 ${data.jars.save}
        </span>
        <span className="flex-1 bg-pink-100 text-pink-700 rounded px-2 py-1 text-center">
          ❤️ ${data.jars.give}
        </span>
      </div>
    </div>
  )
}

export function DailyMiniGoals({ kidId }: { kidId: number }) {
  // 用既有的 today-summary 看小孩今日是否完成 3 件事
  const { data: today } = useQuery<{
    stats: { approvedToday: number; checkinsToday: number }
    kids: Array<{ kidId: number; checkedIn: boolean; tasks: number }>
  }>({
    queryKey: ["/api/family/today-summary"],
    queryFn: async () => {
      const res = await fetch("/api/family/today-summary", { credentials: "include" })
      return res.json()
    },
  })

  const myToday = today?.kids?.find((k) => k.kidId === kidId)
  const doneTask = !!myToday && myToday.tasks > 0
  const doneCheckin = !!myToday && myToday.checkedIn

  const goals = [
    {
      key: "task",
      emoji: "✅",
      label: "完成 1 個任務",
      done: doneTask,
    },
    {
      key: "checkin",
      emoji: "📅",
      label: "今日打卡",
      done: doneCheckin,
    },
    {
      key: "wish",
      emoji: "✨",
      label: "看看我的願望",
      done: false, // 預設未完成、純提示
    },
  ]

  const doneCount = goals.filter((g) => g.done).length

  return (
    <div className="mb-4 rounded-2xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-sky-50 p-3 shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-cyan-900 text-sm">🎯 今日小目標</h3>
        <span className="text-xs text-cyan-700 font-bold">{doneCount} / 3</span>
      </div>
      <div className="flex gap-2">
        {goals.map((g) => (
          <div
            key={g.key}
            className={`flex-1 rounded-lg p-2 text-center text-xs ${
              g.done ? "bg-emerald-100 text-emerald-800" : "bg-white text-gray-600"
            }`}
          >
            <div className="text-lg mb-0.5">{g.done ? "✓" : g.emoji}</div>
            <div>{g.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DailyMoneyQuote() {
  // 用 day-of-year 選每天不同金句
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / 86_400_000)
  const quote = MONEY_QUOTES[dayOfYear % MONEY_QUOTES.length]

  return (
    <div className="mb-4 rounded-2xl border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 p-4 shadow">
      <div className="flex items-start gap-3">
        <div className="text-4xl shrink-0">{quote.emoji}</div>
        <div className="flex-1">
          <div className="text-xs text-amber-700 mb-1">💬 今日金錢小語</div>
          <div className="text-sm font-medium text-amber-900 leading-relaxed">「{quote.text}」</div>
        </div>
      </div>
    </div>
  )
}
