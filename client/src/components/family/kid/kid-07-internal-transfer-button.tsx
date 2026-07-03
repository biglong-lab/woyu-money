/**
 * family 卡片元件（自 family.tsx 機械拆分 kid-07-internal-transfer-button，2026-07-03）
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
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
import { Sparkles, ShoppingBag } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import { useInstallPrompt } from "@/hooks/use-install-prompt"
import { Jar, formatMoney, vibrate } from "./family-shared"

export function InternalTransferButton({
  kidId,
  jar,
  toast,
  onSuccess,
}: {
  kidId: number
  jar: Jar
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
  onSuccess: () => void
}) {
  const mut = useMutation({
    mutationFn: (vars: { fromJar: string; toJar: string; amount: number }) =>
      apiRequest("POST", "/api/family/jars/internal-transfer", {
        kidId,
        ...vars,
      }),
    onSuccess: () => {
      toast({ title: "✅ 已調整罐子" })
      vibrate(30)
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const handleClick = () => {
    const JARS = [
      { v: "spend", label: "💸 花用" },
      { v: "save", label: "🐷 存錢" },
      { v: "give", label: "❤️ 捐獻" },
    ]
    const balMap: Record<string, number> = {
      spend: parseFloat(jar.spendBalance),
      save: parseFloat(jar.saveBalance),
      give: parseFloat(jar.giveBalance),
    }
    const fromPrompt = window.prompt(
      `從哪個罐？輸入：\n1 = 💸 花用 ($${balMap.spend})\n2 = 🐷 存錢 ($${balMap.save})\n3 = ❤️ 捐獻 ($${balMap.give})`,
      ""
    )
    const fromIdx = parseInt(fromPrompt ?? "0") - 1
    if (fromIdx < 0 || fromIdx > 2) return
    const fromJar = JARS[fromIdx].v
    const toPrompt = window.prompt(`移到哪個罐？（不可選 ${JARS[fromIdx].label}）`, "")
    const toIdx = parseInt(toPrompt ?? "0") - 1
    if (toIdx < 0 || toIdx > 2 || toIdx === fromIdx) return
    const toJar = JARS[toIdx].v
    const amountStr = window.prompt(
      `從 ${JARS[fromIdx].label} 移多少到 ${JARS[toIdx].label}？（最多 $${balMap[fromJar]}）`,
      ""
    )
    const amount = parseFloat(amountStr ?? "0")
    if (!(amount > 0)) return
    if (amount > balMap[fromJar]) {
      toast({ title: "餘額不足", variant: "destructive" })
      return
    }
    mut.mutate({ fromJar, toJar, amount })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={mut.isPending}
      className="text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded px-2 py-0.5"
      title="在三罐之間移錢調整"
    >
      ⇄ 調整罐子
    </button>
  )
}

export function InstallChip() {
  const { canInstall, install } = useInstallPrompt()
  if (!canInstall) return null
  return (
    <button
      type="button"
      onClick={install}
      className="text-xs bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full px-2.5 py-1 shadow hover:shadow-md transition"
      title="把這個 app 加到主畫面、像原生 app 一樣用"
    >
      📱 安裝
    </button>
  )
}

export function CheckinPrompt({ kidId }: { kidId: number }) {
  const MOODS = ["😄 開心", "🙂 還好", "😐 普通", "😢 難過", "😡 生氣"]
  interface Checkin {
    id: number
    mood: string
    note: string | null
    checkinDate: string
  }
  const { data, refetch } = useQuery<{
    items: Checkin[]
    today: Checkin | null
  }>({
    queryKey: [`/api/family/checkins?kidId=${kidId}&days=7`],
  })

  const mut = useMutation({
    mutationFn: (mood: string) => apiRequest("POST", "/api/family/checkins", { kidId, mood }),
    onSuccess: () => {
      vibrate(30)
      refetch()
    },
  })

  if (!data) return null

  return (
    <div className="mb-3 bg-gradient-to-r from-sky-50 to-violet-50 border border-sky-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">💭</span>
        <span className="text-xs font-medium text-sky-800">
          {data.today ? `今天的心情：${data.today.mood}` : "今天心情如何？"}
        </span>
      </div>
      <div className="flex gap-1 justify-between flex-wrap">
        {MOODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => mut.mutate(m)}
            disabled={mut.isPending}
            className={`text-xl flex-1 min-w-[18%] py-1.5 rounded transition ${
              data.today?.mood === m
                ? "bg-sky-200 scale-110 ring-2 ring-sky-400"
                : "bg-white hover:bg-sky-100"
            }`}
          >
            {m.slice(0, 2)}
          </button>
        ))}
      </div>
      {/* 近 7 天 mood 軌跡 mini bar */}
      {data.items.length >= 2 && (
        <div className="mt-2 flex gap-0.5 items-end h-5">
          {data.items
            .slice(0, 7)
            .reverse()
            .map((c) => (
              <div
                key={c.id}
                className="flex-1 text-center text-[10px]"
                title={`${c.checkinDate}：${c.mood}`}
              >
                {c.mood.slice(0, 2)}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export function DailyMessageBanner({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    message: { id: number; message: string; mood: string; messageDate: string } | null
  }>({
    queryKey: [`/api/family/daily-message?kidId=${kidId}`],
    staleTime: 60_000,
  })
  if (!data?.message) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 rounded-xl bg-gradient-to-r from-pink-100 via-rose-100 to-amber-100 border-2 border-pink-300 p-3 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <div className="text-3xl shrink-0">{data.message.mood || "❤️"}</div>
        <div className="flex-1">
          <div className="text-[10px] text-pink-700 font-medium mb-0.5">大人今天說：</div>
          <div className="text-sm font-medium text-gray-800 leading-snug">
            「{data.message.message}」
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function JarCard({
  label,
  emoji,
  balance,
  ratio,
  bg,
  text,
}: {
  label: string
  emoji: string
  balance: string
  ratio: number
  bg: string
  text: string
}) {
  return (
    <motion.div whileTap={{ scale: 0.96 }} className={`${bg} rounded-xl p-3 shadow-sm text-center`}>
      <div className="text-4xl mb-1">{emoji}</div>
      <div className={`text-xs ${text}`}>{label}</div>
      <div className={`text-lg sm:text-xl font-bold ${text}`}>{formatMoney(balance)}</div>
      <div className="text-[10px] text-gray-500">收入 {ratio}% 進這罐</div>
    </motion.div>
  )
}

const PROPOSE_EMOJI = ["🧹", "🍽️", "🛏️", "📚", "🐕", "👕", "🛒", "🌱", "♻️", "💡", "🎵", "📖"]

export function ProposeTaskDialog({
  kidId,
  onClose,
  onSuccess,
  toast,
}: {
  kidId: number
  onClose: () => void
  onSuccess: () => void
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
}) {
  const [title, setTitle] = useState("")
  const [emoji, setEmoji] = useState("🧹")
  const [rewardAmount, setRewardAmount] = useState("30")
  const [notes, setNotes] = useState("")

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/family/tasks/propose", {
        kidId,
        title: title.trim(),
        emoji,
        rewardAmount: parseFloat(rewardAmount),
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast({ title: "✋ 已提出、等大人同意" })
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
      vibrate(50)
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const canSubmit = title.trim() && parseFloat(rewardAmount) > 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>✋ 我想做家事</DialogTitle>
          <DialogDescription>
            主動提出想做的家事、大人同意後可以做、做完可以拿到獎勵
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>想做什麼？</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：幫忙摺衣服 / 澆花"
            />
          </div>
          <div>
            <Label>圖示</Label>
            <div className="grid grid-cols-6 gap-1 mt-1">
              {PROPOSE_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-xl p-1 rounded ${
                    emoji === e ? "bg-purple-100 ring-2 ring-purple-500" : "hover:bg-gray-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>建議獎勵</Label>
            <Input
              type="number"
              value={rewardAmount}
              onChange={(e) => setRewardAmount(e.target.value)}
              placeholder="30"
              inputMode="numeric"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">最終金額由大人決定喔</p>
          </div>
          <div>
            <Label>說明（選填）</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="（為什麼想做？）"
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
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const SPEND_EMOJI = ["💰", "🍔", "🍦", "🥤", "🎮", "📚", "🎁", "🛍️", "🚌", "✏️", "🐶", "🎨"]

export function SpendDialog({
  kidId,
  jar,
  onClose,
  onSuccess,
}: {
  kidId: number
  jar: Jar
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [whichJar, setWhichJar] = useState<"spend" | "save" | "give">("spend")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [emoji, setEmoji] = useState("💰")
  const [recipient, setRecipient] = useState("")
  const [reflection, setReflection] = useState("")
  const isGive = whichJar === "give"

  // 家長預設的捐贈對象目錄（小孩快選）
  interface FamilyRecipient {
    id: number
    name: string
    emoji: string | null
    description: string | null
  }
  const { data: presetRecipients = [] } = useQuery<FamilyRecipient[]>({
    queryKey: ["/api/family/recipients"],
    enabled: isGive,
  })

  const balance = {
    spend: parseFloat(jar.spendBalance),
    save: parseFloat(jar.saveBalance),
    give: parseFloat(jar.giveBalance),
  }[whichJar]

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/family/spendings", {
        kidId,
        jar: whichJar,
        amount: parseFloat(amount),
        description: description.trim(),
        emoji,
        spendDate: new Date().toISOString().slice(0, 10),
        recipient: isGive && recipient.trim() ? recipient.trim() : undefined,
        reflection: isGive && reflection.trim() ? reflection.trim() : undefined,
      }),
    onSuccess: () => {
      toast({ title: "✅ 已記錄" })
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } })
      vibrate(40)
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const amt = parseFloat(amount)
  const canSubmit = description.trim() && Number.isFinite(amt) && amt > 0 && amt <= balance

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>記一筆花錢</DialogTitle>
          <DialogDescription>從哪個罐子？花在什麼？</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>從哪個罐子扣？</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(["spend", "save", "give"] as const).map((j) => {
                const label = { spend: "💸 花用", save: "🐷 存錢", give: "❤️ 捐獻" }[j]
                const bal = {
                  spend: jar.spendBalance,
                  save: jar.saveBalance,
                  give: jar.giveBalance,
                }[j]
                const active = whichJar === j
                return (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setWhichJar(j)}
                    className={`p-2 rounded-lg border-2 text-center ${
                      active ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                    }`}
                  >
                    <div className="text-sm">{label}</div>
                    <div className="text-xs text-gray-500 font-mono">
                      ${parseFloat(bal).toLocaleString()}
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">餘額 ${balance.toLocaleString()}</p>
          </div>

          <div>
            <Label>花在什麼？</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例：買飲料 / 漫畫 / 文具"
            />
          </div>
          <div>
            <Label>圖示</Label>
            <div className="grid grid-cols-6 gap-1 mt-1">
              {SPEND_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-xl p-1 rounded ${
                    emoji === e ? "bg-amber-100 ring-2 ring-amber-500" : "hover:bg-gray-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>多少錢？</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例：50"
              inputMode="numeric"
            />
            {amt > balance && (
              <p className="text-xs text-red-600 mt-1">超過餘額 ${balance.toLocaleString()}</p>
            )}
          </div>

          {/* 給罐子特別欄位：捐給誰 + 為什麼想捐 */}
          {isGive && (
            <div className="space-y-2 bg-sky-50 -mx-1 px-3 py-2 rounded-lg border border-sky-200">
              <div className="flex items-center gap-1 text-xs text-sky-800 font-medium">
                ❤️ 來說說你的好心捐獻
              </div>
              <div>
                <Label className="text-xs">捐給誰？</Label>
                {presetRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {presetRecipients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setRecipient(p.name)}
                        className={`text-xs px-2 py-1 rounded-full border ${
                          recipient === p.name
                            ? "bg-sky-200 border-sky-400 text-sky-900 font-medium"
                            : "bg-white border-sky-200 hover:bg-sky-50"
                        }`}
                        title={p.description ?? ""}
                      >
                        {p.emoji ?? "❤️"} {p.name}
                      </button>
                    ))}
                  </div>
                )}
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={
                    presetRecipients.length > 0 ? "或自己輸入..." : "例：流浪動物協會 / 學校募款"
                  }
                />
              </div>
              <div>
                <Label className="text-xs">為什麼想捐？（選填）</Label>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder="寫下你的想法..."
                  rows={2}
                  className="w-full text-sm rounded border border-input bg-background px-3 py-2"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">
                  你的好心會被記下、月底回顧你做了哪些善事 🌟
                </p>
              </div>
            </div>
          )}
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
            <ShoppingBag className="h-4 w-4 mr-1" />
            記錄
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const GOAL_EMOJI = ["🎮", "🚲", "📱", "🎨", "⚽", "🎸", "📚", "🧸", "🎯", "✈️", "🎂", "🍦"]

export function GoalDialog({
  kidId,
  onClose,
  onSuccess,
}: {
  kidId: number
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("🎯")
  const [amount, setAmount] = useState("")
  const [deadline, setDeadline] = useState("")
  const [reflection, setReflection] = useState("")

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/family/goals", {
        kidId,
        name: name.trim(),
        emoji,
        targetAmount: parseFloat(amount),
        deadline: deadline || null,
        reflection: reflection.trim() || null,
      }),
    onSuccess: () => {
      toast({ title: "✅ 新目標已建立、加油！" })
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const canSubmit = name.trim() && parseFloat(amount) > 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>新存錢目標</DialogTitle>
          <DialogDescription>想存錢買什麼？</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>名字</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：Switch 遊戲"
            />
          </div>
          <div>
            <Label>圖示</Label>
            <div className="grid grid-cols-6 gap-1 mt-1">
              {GOAL_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-xl p-1 rounded ${
                    emoji === e ? "bg-purple-100 ring-2 ring-purple-500" : "hover:bg-gray-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>金額</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="9000"
            />
          </div>
          <div>
            <Label>期限（選填）</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div>
            <Label>為什麼想存錢買這個？</Label>
            <Input
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="想擁有的理由（可選、未來達成時回看）"
              maxLength={500}
            />
            <div className="text-[10px] text-gray-400 mt-1">寫下原因、達成時回看會很有感</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!canSubmit || mut.isPending}>
            新增
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
