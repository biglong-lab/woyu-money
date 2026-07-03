/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-13-family-monthly-summary，2026-07-03）
 */
import { useState, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Link } from "wouter"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, Sparkles, PiggyBank } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Kid, Jar, COLOR_TOKENS, AVATAR_OPTIONS, formatMoney } from "./family-shared"

export function FamilyMonthlySummary({ kids }: { kids: Kid[] }) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })

  interface KidSummary {
    kidId: number
    displayName: string
    avatar: string
    color: string
    approvedCount: number
    approvedSum: number
    rejectedCount: number
    hardCount: number
    weightedScore: number
    totalSpent: number
    spendJarOut: number
    saveJarOut: number
    giveJarOut: number
    goalCompletedCount: number
    badgeCount: number
  }
  const { data } = useQuery<{
    month: string
    kids: KidSummary[]
    grandTotal: {
      approvedCount: number
      approvedSum: number
      rejectedCount: number
      hardCount: number
      weightedScore: number
      totalSpent: number
      giveJarOut: number
      goalCompletedCount: number
      badgeCount: number
    }
  }>({
    queryKey: [`/api/family/family-monthly-summary?month=${month}`],
    staleTime: 60_000,
  })

  // 產 6 個月選項（含本月）
  const monthOptions = useMemo(() => {
    const opts: string[] = []
    const d = new Date()
    for (let i = 0; i < 6; i++) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
      opts.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`)
    }
    return opts
  }, [])

  const _ = kids // unused; FamilyTrendChart 共用 kids data

  if (!data) return null

  return (
    <Card className="border-emerald-200">
      <CardHeader className="py-3 px-3 sm:px-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">📊</span>
            全家月度總結
          </CardTitle>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-3 sm:px-4 space-y-2">
        {/* Grand totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500">總任務</div>
            <div className="font-bold text-emerald-700">
              {data.grandTotal.approvedCount}
              {data.grandTotal.hardCount > 0 && (
                <span className="text-[10px] text-rose-500 ml-1">
                  ⭐⭐⭐×{data.grandTotal.hardCount}
                </span>
              )}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500">總給付</div>
            <div className="font-bold text-amber-700">
              {formatMoney(data.grandTotal.approvedSum)}
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500">捐獻</div>
            <div className="font-bold text-rose-700">{formatMoney(data.grandTotal.giveJarOut)}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500">達成目標</div>
            <div className="font-bold text-purple-700">
              {data.grandTotal.goalCompletedCount}
              <span className="text-[10px] text-amber-500 ml-1">
                🏅×{data.grandTotal.badgeCount}
              </span>
            </div>
          </div>
        </div>

        {/* 各小孩明細 */}
        {data.kids.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] text-gray-500 mt-2">各小孩本月戰績（按積分排序）</div>
            {data.kids.map((k, i) => {
              const c = COLOR_TOKENS[k.color] ?? COLOR_TOKENS.blue
              return (
                <div
                  key={k.kidId}
                  className={`flex items-center gap-2 p-2 rounded border ${c.bg} ${c.border} flex-wrap`}
                >
                  <span className="text-xl">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  "}
                  </span>
                  <span className="text-xl">{k.avatar}</span>
                  <div className="flex-1 min-w-[100px]">
                    <div className={`text-sm font-bold ${c.text}`}>{k.displayName}</div>
                    <div className="text-[10px] text-gray-500 flex flex-wrap gap-1">
                      <span>📋 {k.approvedCount}</span>
                      {k.hardCount > 0 && (
                        <span className="text-rose-600">⭐⭐⭐ ×{k.hardCount}</span>
                      )}
                      {k.rejectedCount > 0 && (
                        <span className="text-orange-600">❌ {k.rejectedCount}</span>
                      )}
                      {k.goalCompletedCount > 0 && <span>🎯 ×{k.goalCompletedCount}</span>}
                      {k.badgeCount > 0 && <span>🏅 ×{k.badgeCount}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-bold ${c.text}`}>
                      {formatMoney(k.approvedSum)}
                    </div>
                    <div className="text-[10px] text-rose-600">積分 {k.weightedScore}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function FamilyTrendChart() {
  interface TrendSeries {
    kidId: number
    displayName: string
    avatar: string
    color: string
    values: number[]
  }
  const { data } = useQuery<{ days: number; dates: string[]; series: TrendSeries[] }>({
    queryKey: ["/api/family/jars-trend-multi?days=30"],
    staleTime: 60_000,
  })
  if (!data || data.series.length === 0) return null

  // 組 recharts data：每個 date 一個 row、含每個 kid 的 column
  const chartData = data.dates.map((date, i) => {
    const row: Record<string, string | number> = { date: date.slice(5) } // MM-DD
    data.series.forEach((s) => {
      row[s.displayName] = s.values[i]
    })
    return row
  })

  const LINE_COLORS: Record<string, string> = {
    blue: "#3b82f6",
    pink: "#ec4899",
    green: "#10b981",
    amber: "#f59e0b",
    purple: "#a855f7",
    cyan: "#06b6d4",
  }

  return (
    <Card className="border-indigo-200">
      <CardHeader className="py-3 px-3 sm:px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-xl">📈</span>
          全家儲蓄趨勢
        </CardTitle>
        <CardDescription>過去 {data.days} 天每天的總餘額（收入 - 花費）</CardDescription>
      </CardHeader>
      <CardContent className="py-2 px-1 sm:px-2 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              interval={Math.floor(data.dates.length / 6)}
            />
            <YAxis tick={{ fontSize: 10 }} width={48} />
            <RTooltip
              formatter={(v: number) => "$" + Number(v).toLocaleString()}
              contentStyle={{ fontSize: "12px" }}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            {data.series.map((s) => (
              <Line
                key={s.kidId}
                type="monotone"
                dataKey={s.displayName}
                stroke={LINE_COLORS[s.color] ?? "#6b7280"}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function KidCard({
  kid,
  onEdit,
  onDelete,
  onEncourage,
}: {
  kid: Kid
  onEdit: () => void
  onDelete: () => void
  onEncourage: () => void
}) {
  const c = COLOR_TOKENS[kid.color] ?? COLOR_TOKENS.blue
  const { data: dashboardData } = useQuery<{ jar: Jar }>({
    queryKey: [`/api/family/dashboard?kidId=${kid.id}`],
  })
  const jar = dashboardData?.jar

  return (
    <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
      <Card className={`${c.bg} ${c.border}`}>
        <CardContent className="py-3 px-3">
          <div className="flex items-start gap-2">
            <div className="text-3xl">{kid.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className={`font-bold ${c.text}`}>{kid.displayName}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                💸 {kid.spendRatio}% · 🐷 {kid.saveRatio}% · ❤️ {kid.giveRatio}%
              </div>
              {jar && (
                <div className="mt-1 grid grid-cols-3 gap-1 text-[10px]">
                  <div className="bg-red-50 rounded px-1 py-0.5">
                    <div className="text-red-700">花</div>
                    <div className="font-mono">{formatMoney(jar.spendBalance)}</div>
                  </div>
                  <div className="bg-green-50 rounded px-1 py-0.5">
                    <div className="text-green-700">存</div>
                    <div className="font-mono">{formatMoney(jar.saveBalance)}</div>
                  </div>
                  <div className="bg-blue-50 rounded px-1 py-0.5">
                    <div className="text-blue-700">捐</div>
                    <div className="font-mono">{formatMoney(jar.giveBalance)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1 mt-2 justify-end flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-pink-700 hover:bg-pink-50"
              onClick={onEncourage}
              title="寫一句鼓勵的話"
            >
              💌 鼓勵
            </Button>
            <Link href={`/family/kid/${kid.id}`}>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                <PiggyBank className="h-3 w-3 mr-1" />
                看罐子
              </Button>
            </Link>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onEdit}>
              編輯
            </Button>
            <button
              type="button"
              onClick={onDelete}
              className="text-red-500 hover:bg-red-50 rounded px-1"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function KidDialog({
  mode,
  kid,
  onClose,
  onSuccess,
}: {
  mode: "create" | "edit"
  kid?: Kid
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(kid?.displayName ?? "")
  const [avatar, setAvatar] = useState(kid?.avatar ?? "🧒")
  const [color, setColor] = useState(kid?.color ?? "blue")
  const [pin, setPin] = useState("")
  const [spendRatio, setSpendRatio] = useState(kid?.spendRatio ?? 70)
  const [saveRatio, setSaveRatio] = useState(kid?.saveRatio ?? 20)
  const [giveRatio, setGiveRatio] = useState(kid?.giveRatio ?? 10)
  const [monthlyAllowance, setMonthlyAllowance] = useState(
    kid?.monthlyAllowance ? String(parseFloat(kid.monthlyAllowance)) : "0"
  )

  const total = spendRatio + saveRatio + giveRatio
  const ratioOK = total === 100
  const canSubmit = name.trim() && ratioOK && (mode === "edit" || /^\d{4}$/.test(pin))

  const mut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        displayName: name.trim(),
        avatar,
        color,
        spendRatio,
        saveRatio,
        giveRatio,
        monthlyAllowance: parseFloat(monthlyAllowance) || 0,
      }
      if (mode === "create") body.pin = pin
      return mode === "create"
        ? apiRequest("POST", "/api/family/kids", body)
        : apiRequest("PUT", `/api/family/kids/${kid?.id}`, body)
    },
    onSuccess: () => {
      toast({ title: mode === "create" ? "✅ 已新增" : "✅ 已更新" })
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新增小孩" : "編輯小孩"}</DialogTitle>
          <DialogDescription>名字、頭像、PIN（4 碼）、三罐比例</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>名字 *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="小明" />
          </div>
          <div>
            <Label>頭像</Label>
            <div className="grid grid-cols-6 gap-1 mt-1">
              {AVATAR_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`text-2xl p-1 rounded ${
                    avatar === a ? "bg-indigo-100 ring-2 ring-indigo-500" : "hover:bg-gray-100"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>主題色</Label>
            <div className="flex gap-1 mt-1">
              {Object.keys(COLOR_TOKENS).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded ${COLOR_TOKENS[c].bg} ${
                    color === c ? "ring-2 ring-indigo-500" : ""
                  } ${COLOR_TOKENS[c].border} border-2`}
                />
              ))}
            </div>
          </div>
          {mode === "create" && (
            <div>
              <Label>PIN（4 位數字、登入用）*</Label>
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="例：1234"
                inputMode="numeric"
                maxLength={4}
              />
            </div>
          )}
          <div>
            <Label>三罐分配（總和 100）</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <div>
                <div className="text-xs text-red-700 mb-1">💸 花用</div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={spendRatio}
                  onChange={(e) => setSpendRatio(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <div className="text-xs text-green-700 mb-1">🐷 儲蓄</div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={saveRatio}
                  onChange={(e) => setSaveRatio(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <div className="text-xs text-blue-700 mb-1">❤️ 捐獻</div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={giveRatio}
                  onChange={(e) => setGiveRatio(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <p className={`text-xs mt-1 ${ratioOK ? "text-green-700" : "text-red-700"}`}>
              總和 {total}（需為 100）
            </p>
          </div>
          <div className="border-t pt-3">
            <Label className="flex items-center gap-2">
              📅 每月自動零用金
              <span className="text-[10px] text-gray-400 font-normal">（每月 1 號自動入帳）</span>
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-500">$</span>
              <Input
                type="number"
                value={monthlyAllowance}
                onChange={(e) => setMonthlyAllowance(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              填 0 = 關閉自動入帳、需手動派任務獎勵
              {parseFloat(monthlyAllowance) > 0 && kid?.lastAllowanceMonth && (
                <span className="text-green-700 ml-1">· 上次發放：{kid.lastAllowanceMonth}</span>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!canSubmit || mut.isPending}>
            {mode === "create" ? "新增" : "儲存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const TASK_EMOJI = ["📋", "🧹", "🍽️", "🛏️", "🚿", "📚", "🐕", "🌱", "♻️", "🛒", "✏️", "🎵"]

export function TaskDialog({
  kids,
  onClose,
  onSuccess,
}: {
  kids: Kid[]
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [emoji, setEmoji] = useState("📋")
  const [rewardAmount, setRewardAmount] = useState("50")
  const [kidId, setKidId] = useState<string>(kids[0]?.id?.toString() ?? "")
  const [notes, setNotes] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [recurringInterval, setRecurringInterval] = useState<"none" | "weekly" | "monthly">("none")
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium")
  const [category, setCategory] = useState<
    "housework" | "study" | "self_care" | "kindness" | "other"
  >("other")

  const mut = useMutation({
    mutationFn: () => {
      const body = {
        title: title.trim(),
        emoji,
        rewardAmount: parseFloat(rewardAmount),
        notes: notes.trim() || null,
        dueDate: dueDate || null,
        recurringInterval: recurringInterval === "none" ? null : recurringInterval,
        difficulty,
        category,
      }
      if (kidId === "__broadcast__") {
        return apiRequest<{ count: number }>("POST", "/api/family/tasks/broadcast", body)
      }
      return apiRequest("POST", "/api/family/tasks", {
        ...body,
        kidId: kidId === "__public__" || !kidId ? null : parseInt(kidId),
      })
    },
    onSuccess: (r: unknown) => {
      const broadcastCount = kidId === "__broadcast__" ? (r as { count?: number })?.count : null
      toast({
        title: broadcastCount ? `📣 已派給 ${broadcastCount} 個小孩` : "✅ 已派任務",
      })
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const canSubmit = title.trim() && parseFloat(rewardAmount) > 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>派任務</DialogTitle>
          <DialogDescription>小孩完成後可標「完成」、家長 approve 後自動入帳</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>任務名稱 *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="洗碗 / 倒垃圾 / 整理房間"
            />
          </div>
          <div>
            <Label>圖示</Label>
            <div className="grid grid-cols-6 gap-1 mt-1">
              {TASK_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-xl p-1 rounded ${
                    emoji === e ? "bg-indigo-100 ring-2 ring-indigo-500" : "hover:bg-gray-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>獎勵金額 *</Label>
            <Input
              type="number"
              value={rewardAmount}
              onChange={(e) => setRewardAmount(e.target.value)}
              placeholder="50"
            />
          </div>
          <div>
            <Label>難度</Label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {[
                {
                  v: "easy" as const,
                  label: "⭐ 簡單",
                  active: "bg-green-100 border-green-400 text-green-700 font-medium",
                },
                {
                  v: "medium" as const,
                  label: "⭐⭐ 普通",
                  active: "bg-amber-100 border-amber-400 text-amber-700 font-medium",
                },
                {
                  v: "hard" as const,
                  label: "⭐⭐⭐ 挑戰",
                  active: "bg-rose-100 border-rose-400 text-rose-700 font-medium",
                },
              ].map((d) => (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => setDifficulty(d.v)}
                  className={`text-xs py-1.5 rounded border ${
                    difficulty === d.v ? d.active : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              排行榜按難度加權積分：簡單 ×1、普通 ×2、挑戰 ×3
            </div>
          </div>
          <div>
            <Label>分類</Label>
            <div className="grid grid-cols-5 gap-1 mt-1">
              {(
                [
                  { v: "housework", label: "🧹 家事" },
                  { v: "study", label: "📚 學習" },
                  { v: "self_care", label: "🪥 照顧" },
                  { v: "kindness", label: "❤️ 善行" },
                  { v: "other", label: "📋 其他" },
                ] as const
              ).map((c) => (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => setCategory(c.v)}
                  className={`text-[10px] py-1.5 rounded border ${
                    category === c.v
                      ? "bg-indigo-100 border-indigo-400 text-indigo-700 font-medium"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>指派給</Label>
            <Select value={kidId} onValueChange={setKidId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇小孩" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__broadcast__">📣 派給全家（每人各一份）</SelectItem>
                <SelectItem value="__public__">🙋 公開任務（誰先做誰拿）</SelectItem>
                {kids.map((k) => (
                  <SelectItem key={k.id} value={k.id.toString()}>
                    {k.avatar} {k.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-[10px] text-gray-400 mt-1">選「公開」→ 小孩端可主動搶任務</div>
          </div>
          <div>
            <Label>截止日</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <p className="text-[10px] text-gray-400 mt-0.5">逾期會標紅、自動排前面</p>
          </div>
          <div>
            <Label>重複</Label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {(["none", "weekly", "monthly"] as const).map((v) => {
                const label = { none: "🔄 不重複", weekly: "📅 每週", monthly: "📆 每月" }[v]
                const active = recurringInterval === v
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRecurringInterval(v)}
                    className={`p-2 rounded border-2 text-xs ${
                      active ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {recurringInterval === "none"
                ? "approve 後不會再產出新任務"
                : `approve 後自動產出下一筆（${recurringInterval === "weekly" ? "7" : "30"} 天後）`}
            </p>
          </div>
          <div>
            <Label>備註</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="（選填）"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!canSubmit || mut.isPending}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            派任務
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
