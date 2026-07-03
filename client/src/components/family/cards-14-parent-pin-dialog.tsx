/**
 * family 卡片元件（自 family.tsx 機械拆分 cards-14-parent-pin-dialog，2026-07-03）
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
import { CheckCircle2, Trash2, Zap, Lock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Kid, setPinVerified } from "./family-shared"

interface Template {
  title: string
  emoji: string
  rewardAmount: number
}

export function ParentPinDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [pin, setPin] = useState("")
  const mut = useMutation({
    mutationFn: () => apiRequest<{ ok: boolean }>("POST", "/api/family/parent-pin/verify", { pin }),
    onSuccess: (r) => {
      if (r.ok) {
        setPinVerified()
        onSuccess()
      }
    },
    onError: (e: Error) => {
      toast({ title: "PIN 不正確", description: e.message, variant: "destructive" })
      setPin("")
    },
  })
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            家長 PIN
          </DialogTitle>
          <DialogDescription>需家長驗證才能執行此動作（30 分鐘有效）</DialogDescription>
        </DialogHeader>
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="4-8 位數字"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && pin.length >= 4) mut.mutate()
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => mut.mutate()} disabled={pin.length < 4 || mut.isPending}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            驗證
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BatchTaskDialog({
  kids,
  onClose,
  onSuccess,
}: {
  kids: Kid[]
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"daily" | "seasonal" | "custom" | "ai">("daily")
  const [aiGoal, setAiGoal] = useState("")
  const [aiAge, setAiAge] = useState("6-12 歲")
  const [aiSuggestions, setAiSuggestions] = useState<Template[]>([])
  const aiMut = useMutation({
    mutationFn: () =>
      apiRequest<{ tasks: Array<{ title: string; emoji: string; rewardAmount: number }> }>(
        "POST",
        "/api/family/ai-suggest-tasks",
        { learningGoal: aiGoal, ageRange: aiAge, count: 5 }
      ),
    onSuccess: (r) => {
      const tpls: Template[] = r.tasks.map((t) => ({
        title: t.title,
        emoji: t.emoji,
        rewardAmount: t.rewardAmount,
      }))
      setAiSuggestions(tpls)
      setSelectedTpls(new Set(tpls.map((t) => t.title)))
      toast({ title: `🤖 AI 已建議 ${tpls.length} 個任務` })
    },
    onError: (e: Error) =>
      toast({ title: "AI 建議失敗", description: e.message, variant: "destructive" }),
  })
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/family/task-templates"],
  })
  const currentMonth = new Date().getMonth() + 1
  const { data: seasonal } = useQuery<{
    month: number
    festival: string
    emoji: string
    tasks: Template[]
  }>({
    queryKey: [`/api/family/task-templates/seasonal?month=${currentMonth}`],
  })
  // 家長自訂範本
  interface CustomTpl {
    id: number
    title: string
    emoji: string | null
    defaultReward: string
    defaultDifficulty: string
  }
  const { data: customTpls = [] } = useQuery<CustomTpl[]>({
    queryKey: ["/api/family/custom-templates"],
  })
  const customAsTemplates: Template[] = customTpls.map((c) => ({
    title: c.title,
    emoji: c.emoji ?? "📋",
    rewardAmount: parseFloat(c.defaultReward),
  }))
  const deleteCustomMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/family/custom-templates/${id}`),
    onSuccess: () => {
      toast({ title: "已刪除自訂範本" })
      queryClient.invalidateQueries({ queryKey: ["/api/family/custom-templates"] })
    },
  })
  const addCustomMut = useMutation({
    mutationFn: (vars: { title: string; emoji: string; reward: number }) =>
      apiRequest("POST", "/api/family/custom-templates", {
        title: vars.title,
        emoji: vars.emoji,
        defaultReward: vars.reward,
      }),
    onSuccess: () => {
      toast({ title: "✅ 已加入自訂範本" })
      queryClient.invalidateQueries({ queryKey: ["/api/family/custom-templates"] })
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const displayTemplates =
    activeTab === "seasonal"
      ? (seasonal?.tasks ?? [])
      : activeTab === "custom"
        ? customAsTemplates
        : activeTab === "ai"
          ? aiSuggestions
          : templates
  const [selectedTpls, setSelectedTpls] = useState<Set<string>>(new Set())
  const [selectedKids, setSelectedKids] = useState<Set<number>>(new Set(kids.map((k) => k.id)))

  const toggleTpl = (title: string) => {
    setSelectedTpls((s) => {
      const next = new Set(s)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }
  const toggleKid = (id: number) => {
    setSelectedKids((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const mut = useMutation({
    mutationFn: () =>
      apiRequest<{ count: number }>("POST", "/api/family/tasks/batch", {
        kidIds: Array.from(selectedKids),
        tasks: displayTemplates.filter((t) => selectedTpls.has(t.title)),
      }),
    onSuccess: (r) => {
      toast({ title: `✅ 派出 ${r.count} 個任務` })
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } })
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const totalTasks = selectedKids.size * selectedTpls.size
  const totalAmount =
    Array.from(selectedTpls).reduce((s, title) => {
      const t = displayTemplates.find((x) => x.title === title)
      return s + (t?.rewardAmount ?? 0)
    }, 0) * selectedKids.size

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>一鍵派任務</DialogTitle>
          <DialogDescription>選範本 + 選小孩、一次派完所有組合</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <div className="flex gap-1 mb-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("daily")
                  setSelectedTpls(new Set())
                }}
                className={`flex-1 py-1.5 rounded text-sm font-medium border-2 ${
                  activeTab === "daily" ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                }`}
              >
                📋 日常任務
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("seasonal")
                  setSelectedTpls(new Set())
                }}
                className={`flex-1 py-1.5 rounded text-sm font-medium border-2 ${
                  activeTab === "seasonal" ? "border-amber-500 bg-amber-50" : "border-gray-200"
                }`}
              >
                {seasonal?.emoji ?? "🎉"} 節慶
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("custom")
                  setSelectedTpls(new Set())
                }}
                className={`flex-1 py-1.5 rounded text-sm font-medium border-2 ${
                  activeTab === "custom" ? "border-rose-500 bg-rose-50" : "border-gray-200"
                }`}
              >
                💖 自訂
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("ai")
                  setSelectedTpls(new Set())
                }}
                className={`flex-1 py-1.5 rounded text-sm font-medium border-2 ${
                  activeTab === "ai" ? "border-cyan-500 bg-cyan-50" : "border-gray-200"
                }`}
              >
                🤖 AI
              </button>
            </div>
            {activeTab === "ai" && (
              <div className="mb-2 bg-cyan-50 border border-cyan-200 rounded p-2 space-y-1">
                <div className="text-[11px] text-cyan-700">
                  告訴 AI 想培養什麼、它幫你出 5 個適齡任務
                </div>
                <div className="flex gap-1">
                  <Input
                    value={aiAge}
                    onChange={(e) => setAiAge(e.target.value)}
                    placeholder="6-12 歲"
                    className="w-24 h-7 text-xs"
                  />
                  <Input
                    value={aiGoal}
                    onChange={(e) => setAiGoal(e.target.value)}
                    placeholder="例：培養理財觀念 / 學會做家事 / 練字"
                    className="flex-1 h-7 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!aiGoal.trim() || aiMut.isPending}
                    onClick={() => aiMut.mutate()}
                    className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700"
                  >
                    {aiMut.isPending ? "..." : "🤖 建議"}
                  </Button>
                </div>
              </div>
            )}
            {activeTab === "custom" && (
              <div className="mb-2 bg-rose-50 border border-rose-200 rounded p-2 space-y-1">
                <div className="text-[11px] text-rose-700">
                  我家常用任務、點下方加入收藏（最常用的擺前面）
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs"
                  onClick={() => {
                    const title = window.prompt("自訂任務名稱（如「掃地」）：", "")
                    if (!title?.trim()) return
                    const emoji = window.prompt("圖示 emoji（如 🧹）：", "📋") || "📋"
                    const r = window.prompt("預設獎勵金額：", "20")
                    const reward = parseFloat(r ?? "0")
                    if (!(reward > 0)) {
                      toast({ title: "請輸入有效金額", variant: "destructive" })
                      return
                    }
                    addCustomMut.mutate({ title: title.trim(), emoji, reward })
                  }}
                >
                  ➕ 新增自訂範本
                </Button>
              </div>
            )}
            {activeTab === "seasonal" && seasonal && (
              <div className="text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2">
                <b>
                  {seasonal.emoji} {seasonal.festival}
                </b>
                （{seasonal.month} 月）
              </div>
            )}
            <Label className="font-bold">選任務範本（複選）</Label>
            <div className="space-y-1 mt-1 max-h-64 overflow-y-auto">
              {displayTemplates.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-3">
                  {activeTab === "custom"
                    ? "還沒有自訂範本、點上方「新增自訂範本」開始"
                    : "本月無節慶任務"}
                </div>
              ) : (
                displayTemplates.map((t) => {
                  // 自訂 tab 找對應 id（刪除用）
                  const customMatch =
                    activeTab === "custom" ? customTpls.find((c) => c.title === t.title) : null
                  return (
                    <div
                      key={t.title}
                      className={`flex items-center gap-1 ${activeTab === "custom" ? "" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTpl(t.title)}
                        className={`flex-1 text-left flex items-center gap-2 p-2 rounded border ${
                          selectedTpls.has(t.title)
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200"
                        }`}
                      >
                        <span className="text-xl">{t.emoji}</span>
                        <span className="flex-1">{t.title}</span>
                        <span className="text-xs font-mono text-gray-500">${t.rewardAmount}</span>
                        {selectedTpls.has(t.title) && (
                          <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                        )}
                      </button>
                      {customMatch && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`刪除自訂範本「${customMatch.title}」？`)) {
                              deleteCustomMut.mutate(customMatch.id)
                            }
                          }}
                          className="text-red-400 hover:text-red-600 px-1.5 py-1"
                          title="刪除自訂範本"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div>
            <Label className="font-bold">👨‍👩‍👧 派給</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {kids.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => toggleKid(k.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full border-2 ${
                    selectedKids.has(k.id) ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                  }`}
                >
                  <span className="text-lg">{k.avatar}</span>
                  <span className="text-sm">{k.displayName}</span>
                </button>
              ))}
            </div>
          </div>

          {totalTasks > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
              將派出 <b>{totalTasks}</b> 個任務（{selectedKids.size} 小孩 × {selectedTpls.size}{" "}
              範本）、
              <br />
              若全部完成獎勵總額 <b>${totalAmount.toLocaleString()}</b>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={totalTasks === 0 || mut.isPending}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Zap className="h-4 w-4 mr-1" />
            派出 {totalTasks} 個任務
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
