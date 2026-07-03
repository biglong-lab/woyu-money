/**
 * family 卡片元件（自 family.tsx 機械拆分 kid-02-personalize-dialog，2026-07-03）
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
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
import { Plus, Trash2 } from "lucide-react"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Kid, Jar, formatMoney, vibrate } from "./family-shared"

export function PersonalizeDialog({
  kid,
  onClose,
  onSuccess,
  toast,
}: {
  kid: Kid
  onClose: () => void
  onSuccess: () => void
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
}) {
  const [avatar, setAvatar] = useState(kid.avatar)
  const [color, setColor] = useState(kid.color)

  const AVATARS = [
    "🧒",
    "👧",
    "👦",
    "🧑",
    "👶",
    "🐱",
    "🐶",
    "🐻",
    "🦊",
    "🐰",
    "🐼",
    "🦁",
    "🐯",
    "🦄",
    "🐸",
    "🐵",
  ]
  const COLORS = [
    { v: "blue", label: "藍", bg: "bg-blue-500" },
    { v: "pink", label: "粉", bg: "bg-pink-500" },
    { v: "green", label: "綠", bg: "bg-green-500" },
    { v: "amber", label: "黃", bg: "bg-amber-500" },
    { v: "purple", label: "紫", bg: "bg-purple-500" },
    { v: "cyan", label: "青", bg: "bg-cyan-500" },
  ]

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/family/kids/${kid.id}/personalize`, { avatar, color }),
    onSuccess: () => {
      toast({ title: "✨ 變身成功！" })
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>✨ 我的造型</DialogTitle>
          <DialogDescription>選你喜歡的頭像和顏色</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>頭像</Label>
            <div className="grid grid-cols-8 gap-1 mt-1">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`text-2xl p-1.5 rounded ${
                    avatar === a ? "bg-indigo-100 ring-2 ring-indigo-500" : "hover:bg-gray-100"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>顏色</Label>
            <div className="grid grid-cols-6 gap-1 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => setColor(c.v)}
                  className={`h-10 rounded flex items-center justify-center text-white font-bold ${c.bg} ${
                    color === c.v ? "ring-2 ring-offset-2 ring-gray-700" : ""
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 rounded p-3 flex items-center gap-3 justify-center">
            <span className="text-xs text-gray-500">預覽：</span>
            <span className="text-4xl">{avatar}</span>
            <span
              className={`px-3 py-1 rounded-full text-white text-sm font-bold ${
                COLORS.find((c) => c.v === color)?.bg ?? "bg-blue-500"
              }`}
            >
              {kid.displayName}
            </span>
          </div>
          <ChangePinSection kidId={kid.id} toast={toast} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={mut.isPending || (avatar === kid.avatar && color === kid.color)}
            onClick={() => mut.mutate()}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            ✨ 變身
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ChangePinSection({
  kidId,
  toast,
}: {
  kidId: number
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
}) {
  const [open, setOpen] = useState(false)
  const [oldPin, setOldPin] = useState("")
  const [newPin, setNewPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/family/kids/${kidId}/change-pin`, { oldPin, newPin }),
    onSuccess: () => {
      toast({ title: "🔐 PIN 修改成功" })
      vibrate(40)
      setOpen(false)
      setOldPin("")
      setNewPin("")
      setConfirmPin("")
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const valid =
    /^\d{4}$/.test(oldPin) && /^\d{4}$/.test(newPin) && newPin === confirmPin && oldPin !== newPin

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-xs text-indigo-700 hover:bg-indigo-50 rounded py-1.5 border border-indigo-200 mt-2"
      >
        🔐 修改 PIN
      </button>
    )
  }
  return (
    <div className="mt-2 border-t pt-3 space-y-2 bg-indigo-50 -mx-1 px-3 pb-2 rounded-lg">
      <div className="text-xs font-medium text-indigo-700">🔐 修改 PIN</div>
      <Input
        type="password"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        placeholder="舊 PIN（4 位數）"
        value={oldPin}
        onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ""))}
      />
      <Input
        type="password"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        placeholder="新 PIN（4 位數）"
        value={newPin}
        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
      />
      <Input
        type="password"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        placeholder="再輸入一次新 PIN"
        value={confirmPin}
        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
      />
      {newPin && confirmPin && newPin !== confirmPin && (
        <div className="text-[10px] text-rose-600">兩次輸入不一致</div>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(false)}
          className="flex-1 h-8 text-xs"
        >
          取消
        </Button>
        <Button
          size="sm"
          disabled={!valid || mut.isPending}
          onClick={() => mut.mutate()}
          className="flex-1 h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
        >
          確認修改
        </Button>
      </div>
    </div>
  )
}

export function TransferDialog({
  fromKidId,
  jar,
  onClose,
  onSuccess,
  toast,
}: {
  fromKidId: number
  jar: Jar
  onClose: () => void
  onSuccess: () => void
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
}) {
  const [toKidId, setToKidId] = useState<string>("")
  const [amount, setAmount] = useState("10")
  const [message, setMessage] = useState("")

  const { data: kids = [] } = useQuery<Kid[]>({ queryKey: ["/api/family/kids"] })
  const siblings = kids.filter((k) => k.id !== fromKidId)

  const mut = useMutation({
    mutationFn: () =>
      apiRequest<{ ok: true; to: string; amount: number }>("POST", "/api/family/jars/transfer", {
        fromKidId,
        toKidId: parseInt(toKidId),
        amount: parseFloat(amount),
        jar: "spend",
        message: message.trim() || null,
      }),
    onSuccess: (r) => {
      toast({
        title: `💝 已送禮 ${formatMoney(r.amount)} 給 ${r.to}`,
        description: "感謝你的愛心！",
      })
      vibrate([50, 80, 50])
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
      onSuccess()
    },
    onError: (e: Error) =>
      toast({ title: "送禮失敗", description: e.message, variant: "destructive" }),
  })

  const spend = parseFloat(jar.spendBalance)
  const canSubmit = toKidId && parseFloat(amount) > 0 && parseFloat(amount) <= spend

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>💝 送禮給兄弟姊妹</DialogTitle>
          <DialogDescription>
            從你的花錢罐 ({formatMoney(spend)}) 送一些給家人、培養互助
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {siblings.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              還沒有兄弟姊妹、請家長新增其他小孩 👨‍👩‍👧‍👦
            </div>
          ) : (
            <>
              <div>
                <Label>送給誰</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {siblings.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setToKidId(String(k.id))}
                      className={`p-3 rounded-lg border-2 text-left ${
                        toKidId === String(k.id)
                          ? "border-rose-400 bg-rose-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="text-3xl">{k.avatar}</div>
                      <div className="font-medium">{k.displayName}</div>
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
                  placeholder="10"
                  min="1"
                  max={spend}
                />
                <div className="text-[10px] text-gray-400 mt-1">
                  你的花錢罐目前 {formatMoney(spend)}
                </div>
              </div>
              <div>
                <Label>祝福訊息（可選）</Label>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="生日快樂！"
                  maxLength={200}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!canSubmit || mut.isPending}
            onClick={() => mut.mutate()}
            className="bg-rose-500 hover:bg-rose-600"
          >
            💝 送出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface Wish {
  id: number
  title: string
  emoji: string | null
  estimatedPrice: string | null
  priority: number
  status: "wished" | "promoted_to_goal" | "abandoned"
  promotedGoalId: number | null
}

export function WishesSection({
  kidId,
  toast,
  onAfterPromote,
}: {
  kidId: number
  toast: (opts: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => void
  onAfterPromote: () => void
}) {
  const { data: wishes = [] } = useQuery<Wish[]>({
    queryKey: [`/api/family/wishes?kidId=${kidId}`],
  })
  const active = wishes.filter((w) => w.status === "wished")

  const addMut = useMutation({
    mutationFn: (vars: {
      title: string
      emoji: string
      estimatedPrice?: number
      priority: number
    }) => apiRequest("POST", "/api/family/wishes", { kidId, ...vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/family/wishes?kidId=${kidId}`] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/family/wishes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/family/wishes?kidId=${kidId}`] })
    },
  })

  const promoteMut = useMutation({
    mutationFn: (vars: { id: number; targetAmount?: number }) =>
      apiRequest("POST", `/api/family/wishes/${vars.id}/promote`, {
        targetAmount: vars.targetAmount,
      }),
    onSuccess: () => {
      toast({ title: "🎯 已升級成存錢目標！" })
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } })
      queryClient.invalidateQueries({ queryKey: [`/api/family/wishes?kidId=${kidId}`] })
      queryClient.invalidateQueries({ queryKey: [`/api/family/dashboard?kidId=${kidId}`] })
      onAfterPromote()
    },
    onError: (e: Error) =>
      toast({ title: "升級失敗", description: e.message, variant: "destructive" }),
  })

  const handleAdd = () => {
    const title = window.prompt("想要什麼？", "")
    if (!title?.trim()) return
    const emoji = window.prompt("emoji（可選）", "✨") || "✨"
    const p = window.prompt("價格（可空、不確定先寫 0）", "0")
    const price = parseFloat(p ?? "0")
    const pr = window.prompt("有多想要？1=低 / 2=中 / 3=高", "2")
    const priority = Math.max(1, Math.min(3, parseInt(pr ?? "2", 10) || 2))
    addMut.mutate({
      title: title.trim(),
      emoji,
      estimatedPrice: price > 0 ? price : undefined,
      priority,
    })
  }

  const handlePromote = (w: Wish) => {
    let target = w.estimatedPrice ? parseFloat(w.estimatedPrice) : 0
    if (!(target > 0)) {
      const r = window.prompt(`目標金額？（要存多少才買「${w.title}」）`, "100")
      target = parseFloat(r ?? "0")
      if (!(target > 0)) {
        toast({ title: "需要金額才能升級", variant: "destructive" })
        return
      }
    }
    promoteMut.mutate({ id: w.id, targetAmount: target })
  }

  return (
    <div className="mb-4">
      <h2 className="font-bold mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-amber-500">✨</span>
          我想要的（{active.length}）
        </span>
        <Button size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          加願望
        </Button>
      </h2>
      {active.length === 0 ? (
        <div className="text-center text-xs text-gray-400 py-3 bg-white rounded-lg">
          看到喜歡的東西先放這、想清楚再升級成存錢目標 ✨
        </div>
      ) : (
        <div className="space-y-1.5">
          {active.map((w) => (
            <div key={w.id} className="bg-white rounded-lg p-2.5 flex items-center gap-2 shadow-sm">
              <div className="text-2xl">{w.emoji ?? "✨"}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {w.title}
                  <span className="ml-1.5 text-xs text-amber-500">{"⭐".repeat(w.priority)}</span>
                </div>
                {w.estimatedPrice && (
                  <div className="text-[10px] text-gray-500">
                    估價 {formatMoney(w.estimatedPrice)}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] text-purple-700"
                onClick={() => handlePromote(w)}
                disabled={promoteMut.isPending}
                title="升級成存錢目標、開始存錢"
              >
                🎯 升級
              </Button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`刪除「${w.title}」？`)) deleteMut.mutate(w.id)
                }}
                className="text-red-400 hover:text-red-600 p-1"
                title="刪除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function KidGrowthStageCard({ kidId }: { kidId: number }) {
  const { data } = useQuery<{
    metrics: {
      accountAgeDays: number
      tasksApproved: number
      lifetimeEarned: number
      checkinDays: number
      goalsCompleted: number
      badgesEarned: number
    }
    score: number
    stage: "newbie" | "learner" | "regular" | "veteran" | "legend"
    stageLabel: string
    progressInStage: number
    nextMilestone: string
  }>({
    queryKey: [`/api/family/kid-growth-stage?kidId=${kidId}`],
  })
  if (!data) return null

  const STAGE_BG: Record<string, string> = {
    newbie: "from-gray-50 to-slate-50 border-gray-300",
    learner: "from-sky-50 to-blue-50 border-sky-300",
    regular: "from-emerald-50 to-green-50 border-emerald-300",
    veteran: "from-amber-50 to-orange-50 border-amber-400",
    legend: "from-purple-50 to-pink-50 border-purple-500",
  }

  return (
    <div
      className={`mb-4 rounded-2xl border-2 bg-gradient-to-br ${STAGE_BG[data.stage]} p-3 shadow`}
    >
      <h2 className="font-bold mb-2 flex items-center gap-2">📈 我的成長階段</h2>

      <div className="bg-white/70 rounded-lg p-2 mb-2 text-center">
        <div className="text-2xl font-bold mb-1">{data.stageLabel}</div>
        <div className="text-xs text-gray-600">綜合分數 {data.score} 分</div>
      </div>

      {data.stage !== "legend" && (
        <div className="mb-2">
          <div className="h-2 bg-white rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-purple-500"
              style={{ width: `${data.progressInStage}%` }}
            />
          </div>
          <div className="text-[10px] text-gray-600 text-center mt-1">{data.nextMilestone}</div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-white rounded p-1.5 text-center">
          <div className="text-sm font-bold">{data.metrics.accountAgeDays}</div>
          <div className="text-[9px] text-gray-500">天</div>
        </div>
        <div className="bg-white rounded p-1.5 text-center">
          <div className="text-sm font-bold">{data.metrics.tasksApproved}</div>
          <div className="text-[9px] text-gray-500">任務</div>
        </div>
        <div className="bg-white rounded p-1.5 text-center">
          <div className="text-sm font-bold">{data.metrics.checkinDays}</div>
          <div className="text-[9px] text-gray-500">打卡</div>
        </div>
        <div className="bg-white rounded p-1.5 text-center">
          <div className="text-sm font-bold">{data.metrics.goalsCompleted}</div>
          <div className="text-[9px] text-gray-500">目標</div>
        </div>
        <div className="bg-white rounded p-1.5 text-center">
          <div className="text-sm font-bold">{data.metrics.badgesEarned}</div>
          <div className="text-[9px] text-gray-500">徽章</div>
        </div>
        <div className="bg-white rounded p-1.5 text-center">
          <div className="text-sm font-bold">${data.metrics.lifetimeEarned}</div>
          <div className="text-[9px] text-gray-500">累計</div>
        </div>
      </div>
    </div>
  )
}
