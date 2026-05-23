/**
 * 家庭共同存錢目標 Card（階段 4.4）
 * - 列目標（active 優先、含 progress bar）
 * - 新增目標
 * - 對某目標 contribute（直接 inline 加錢）
 * - 達成自動標 achieved
 */
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import { Target, PlusCircle, PiggyBank } from "lucide-react"

interface SavingsGoal {
  id: number
  familyId: number
  title: string
  emoji: string
  targetAmount: string
  currentAmount: string
  targetDate: string | null
  status: "active" | "achieved" | "archived"
  notes: string | null
  achievedAt: string | null
  createdAt: string
}

export function FamilySavingsGoalsCard() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState("")
  const [emoji, setEmoji] = useState("💰")
  const [targetAmount, setTargetAmount] = useState("")
  const [targetDate, setTargetDate] = useState("")
  const [notes, setNotes] = useState("")
  const [contributeFor, setContributeFor] = useState<SavingsGoal | null>(null)
  const [contribAmount, setContribAmount] = useState("")
  const [contribNote, setContribNote] = useState("")

  const { data: goals = [], isLoading } = useQuery<SavingsGoal[]>({
    queryKey: ["/api/family/savings-goals"],
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/family/savings-goals"] })

  const createMutation = useMutation<unknown, Error, Record<string, unknown>>({
    mutationFn: (body) => apiRequest("POST", "/api/family/savings-goals", body),
    onSuccess: () => {
      toast({ title: "✅ 目標已建立" })
      setShowCreate(false)
      setTitle("")
      setEmoji("💰")
      setTargetAmount("")
      setTargetDate("")
      setNotes("")
      invalidate()
    },
    onError: (e) => {
      toast({ title: "建立失敗", description: e.message, variant: "destructive" })
    },
  })

  const contributeMutation = useMutation<
    { achieved: boolean; progressPct: number },
    Error,
    { goalId: number; amount: number; note?: string }
  >({
    mutationFn: ({ goalId, amount, note }) =>
      apiRequest("POST", `/api/family/savings-goals/${goalId}/contribute`, {
        amount,
        note,
      }) as Promise<{ achieved: boolean; progressPct: number }>,
    onSuccess: (d) => {
      toast({
        title: d.achieved ? "🎉 達成目標！" : "✅ 已加入存錢",
        description: `進度 ${d.progressPct}%`,
      })
      setContributeFor(null)
      setContribAmount("")
      setContribNote("")
      invalidate()
    },
    onError: (e) => {
      toast({ title: "加錢失敗", description: e.message, variant: "destructive" })
    },
  })

  const handleCreate = () => {
    const amt = parseFloat(targetAmount)
    if (!title.trim()) {
      toast({ title: "請填標題", variant: "destructive" })
      return
    }
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "目標金額需 > 0", variant: "destructive" })
      return
    }
    createMutation.mutate({
      title: title.trim(),
      emoji: emoji.trim() || "💰",
      targetAmount: amt,
      targetDate: targetDate || undefined,
      notes: notes.trim() || undefined,
    })
  }

  const handleContribute = () => {
    if (!contributeFor) return
    const amt = parseFloat(contribAmount)
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "金額需 > 0", variant: "destructive" })
      return
    }
    contributeMutation.mutate({
      goalId: contributeFor.id,
      amount: amt,
      note: contribNote.trim() || undefined,
    })
  }

  const activeCount = goals.filter((g) => g.status === "active").length
  const achievedCount = goals.filter((g) => g.status === "achieved").length

  return (
    <Card className="border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-rose-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <PiggyBank className="w-4 h-4" />
            家庭共同存錢目標
          </CardTitle>
          <CardDescription>
            {activeCount} 進行中 · {achievedCount} 已達成
          </CardDescription>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <PlusCircle className="w-4 h-4" />
              新目標
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>建立家庭存錢目標</DialogTitle>
              <DialogDescription>例如：日本旅遊、新冰箱、夏令營基金</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <div>
                  <Label htmlFor="goal-emoji">圖示</Label>
                  <Input
                    id="goal-emoji"
                    placeholder="💰"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                    className="text-center"
                  />
                </div>
                <div>
                  <Label htmlFor="goal-title">目標標題 *</Label>
                  <Input
                    id="goal-title"
                    placeholder="日本旅遊"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="goal-target">目標金額 *</Label>
                <Input
                  id="goal-target"
                  type="number"
                  step="100"
                  placeholder="80000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div>
                <Label htmlFor="goal-date">截止日（選填）</Label>
                <Input
                  id="goal-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="goal-notes">備註（選填）</Label>
                <Input
                  id="goal-notes"
                  placeholder="例如：機票 + 5 天住宿"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                <Target className="w-4 h-4 mr-1" />
                建立目標
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="text-sm text-gray-500">載入中...</div>}
        {!isLoading && goals.length === 0 && (
          <div className="text-sm text-gray-500 py-4 text-center">
            尚無目標、點上方「新目標」開始
          </div>
        )}
        {!isLoading && goals.length > 0 && (
          <div className="space-y-3">
            {goals.map((g) => {
              const target = parseFloat(g.targetAmount)
              const current = parseFloat(g.currentAmount)
              const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
              const remaining = Math.max(0, target - current)
              const isAchieved = g.status === "achieved"
              const isArchived = g.status === "archived"
              return (
                <div
                  key={g.id}
                  className={`bg-white rounded-lg border p-3 ${
                    isAchieved
                      ? "border-emerald-300"
                      : isArchived
                        ? "border-gray-200 opacity-60"
                        : "border-pink-200"
                  }`}
                  data-testid={`savings-goal-${g.id}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{g.emoji}</span>
                      <span className="font-medium truncate">{g.title}</span>
                      {isAchieved && (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                          🎉 達成
                        </Badge>
                      )}
                      {isArchived && (
                        <Badge variant="outline" className="text-[10px]">
                          已歸檔
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 shrink-0">
                      {g.targetDate ? g.targetDate.slice(0, 10) : "—"}
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 mb-1">
                    NT$ {Math.round(current).toLocaleString()} /{" "}
                    {Math.round(target).toLocaleString()}（{pct}%）
                    {!isAchieved && remaining > 0 && (
                      <span className="ml-2 text-gray-400">還差 {remaining.toLocaleString()}</span>
                    )}
                  </div>

                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isAchieved
                          ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                          : "bg-gradient-to-r from-pink-400 to-rose-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {!isAchieved && !isArchived && (
                    <div className="flex justify-end mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setContributeFor(g)}
                        data-testid={`contribute-${g.id}`}
                      >
                        💰 加錢
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* 加錢 dialog */}
      <Dialog open={!!contributeFor} onOpenChange={(o) => !o && setContributeFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {contributeFor?.emoji} {contributeFor?.title} 加錢
            </DialogTitle>
            <DialogDescription>
              目前 NT${" "}
              {contributeFor
                ? Math.round(parseFloat(contributeFor.currentAmount)).toLocaleString()
                : "0"}{" "}
              /{" "}
              {contributeFor
                ? Math.round(parseFloat(contributeFor.targetAmount)).toLocaleString()
                : "0"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="contrib-amount">金額 *</Label>
              <Input
                id="contrib-amount"
                type="number"
                step="100"
                placeholder="1000"
                value={contribAmount}
                onChange={(e) => setContribAmount(e.target.value)}
                autoFocus
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div>
              <Label htmlFor="contrib-note">備註（選填）</Label>
              <Input
                id="contrib-note"
                placeholder="例如：本月薪水撥出"
                value={contribNote}
                onChange={(e) => setContribNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContributeFor(null)}>
              取消
            </Button>
            <Button onClick={handleContribute} disabled={contributeMutation.isPending}>
              💰 加錢
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
