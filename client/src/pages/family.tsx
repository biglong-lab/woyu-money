/**
 * 家庭記帳：家長視角主頁（/family）
 *
 * 功能：
 *  - 家庭成員（小孩）管理：新增 / 編輯 / 三罐比例
 *  - 任務派發 + 審核中心
 *  - 全家儀表板總覽
 *  - 各小孩 jars 概覽（連到 /family/kid/:id 看細節）
 *
 * 設計：手機優先、單手拇指區操作、Bottom Sheet 取代 Dialog（手機）
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Link } from "wouter"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
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
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  Plus,
  CheckCircle2,
  XCircle,
  Trash2,
  Sparkles,
  PiggyBank,
  Target,
  ExternalLink,
  Zap,
  Trophy,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"

interface Kid {
  id: number
  displayName: string
  avatar: string
  color: string
  spendRatio: number
  saveRatio: number
  giveRatio: number
}

interface Task {
  id: number
  kidId: number | null
  title: string
  emoji: string | null
  rewardAmount: string
  status: "pending" | "submitted" | "approved" | "rejected"
  notes: string | null
  dueDate: string | null
  createdAt: string
  isOverdue?: boolean
  overdueDays?: number
}

interface Jar {
  kidId: number
  spendBalance: string
  saveBalance: string
  giveBalance: string
  totalReceived: string
  totalSpent: string
}

interface LeaderboardEntry {
  kidId: number
  displayName: string
  avatar: string
  color: string
  approvedCount: number
  approvedSum: number
  completedGoalsCount: number
  badgeCount: number
  rank: number
  medal: string
}

interface FamilyDashboard {
  scope: "family"
  kids: Kid[]
  totalReceived: number
  totalSaved: number
  pendingTaskCount: number
  toApproveCount: number
}

const COLOR_TOKENS: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  pink: { bg: "bg-pink-50", border: "border-pink-300", text: "text-pink-700" },
  green: { bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
  amber: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
  purple: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  cyan: { bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700" },
}

const AVATAR_OPTIONS = ["🧒", "👧", "👦", "🧑", "👶", "🐱", "🐶", "🐻", "🦊", "🐰", "🐼", "🦁"]

function formatMoney(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v
  return "$" + Math.round(n).toLocaleString()
}

export default function FamilyPage() {
  useDocumentTitle("家庭記帳")
  const { toast } = useToast()
  const [showAddKid, setShowAddKid] = useState(false)
  const [editKid, setEditKid] = useState<Kid | null>(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [showBatchTask, setShowBatchTask] = useState(false)

  const { data: dashboard } = useQuery<FamilyDashboard>({
    queryKey: ["/api/family/dashboard"],
  })

  const { data: kids = [] } = useQuery<Kid[]>({
    queryKey: ["/api/family/kids"],
  })

  const { data: pendingTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/family/tasks?status=submitted"],
  })

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/family/tasks"],
  })

  const currentMonth = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })()
  const { data: leaderboard } = useQuery<{
    month: string
    leaderboard: LeaderboardEntry[]
  }>({
    queryKey: [`/api/family/leaderboard?month=${currentMonth}`],
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/family/"),
    })
  }

  const approveTaskMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest<{
        task: Task
        jars: { total: number }
        newBadges: string[]
        bonus: {
          triggered: boolean
          baseAmount: number
          bonusAmount: number
          totalAmount: number
        }
      }>("POST", `/api/family/tasks/${id}/approve`),
    onSuccess: (r) => {
      const bonus = r.bonus
      if (bonus?.triggered) {
        toast({
          title: `🎁✨ 驚喜獎勵！ ${formatMoney(bonus.baseAmount)} +${formatMoney(bonus.bonusAmount)} = ${formatMoney(bonus.totalAmount)}`,
          description:
            r.newBadges.length > 0
              ? `🎉 解鎖徽章：${r.newBadges.join(", ")}`
              : "小孩好棒、額外給 +50%",
        })
        // 大撒花、震動
        confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 }, ticks: 300 })
        setTimeout(() => confetti({ particleCount: 100, spread: 90, origin: { y: 0.7 } }), 250)
      } else {
        toast({
          title: `✅ 任務通過、入帳 ${formatMoney(r.jars.total)}`,
          description:
            r.newBadges.length > 0 ? `🎉 解鎖徽章：${r.newBadges.join(", ")}` : "已自動三罐分配",
        })
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } })
      }
      invalidateAll()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const rejectTaskMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/family/tasks/${id}/reject`),
    onSuccess: () => {
      toast({ title: "已駁回" })
      invalidateAll()
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/family/tasks/${id}`),
    onSuccess: () => {
      toast({ title: "✅ 已刪除" })
      invalidateAll()
    },
  })

  const deleteKidMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/family/kids/${id}`),
    onSuccess: () => {
      toast({ title: "已停用小孩帳戶" })
      invalidateAll()
    },
  })

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 max-w-4xl">
      {/* 標題 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" />
            家庭記帳
          </h1>
          <p className="text-sm text-gray-500 mt-1">派任務、入帳、三罐分配、養成小朋友財務習慣</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => setShowBatchTask(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={kids.length === 0}
          >
            <Zap className="h-4 w-4 mr-1" />
            一鍵派
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddTask(true)}
            className="bg-amber-600 hover:bg-amber-700"
            disabled={kids.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            自訂
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowAddKid(true)}>
            <Plus className="h-4 w-4 mr-1" />
            新增小孩
          </Button>
        </div>
      </div>

      {/* 全家儀表板 */}
      {dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card>
            <CardContent className="py-3 px-3">
              <div className="text-xs text-gray-500">累計給予</div>
              <div className="text-lg sm:text-xl font-bold text-indigo-700">
                {formatMoney(dashboard.totalReceived)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-3">
              <div className="text-xs text-gray-500">存錢罐合計</div>
              <div className="text-lg sm:text-xl font-bold text-green-700">
                {formatMoney(dashboard.totalSaved)}
              </div>
            </CardContent>
          </Card>
          <Card className={dashboard.toApproveCount > 0 ? "border-amber-300 bg-amber-50" : ""}>
            <CardContent className="py-3 px-3">
              <div className="text-xs text-gray-500">待審核</div>
              <div
                className={`text-lg sm:text-xl font-bold ${
                  dashboard.toApproveCount > 0 ? "text-amber-700" : "text-gray-400"
                }`}
              >
                {dashboard.toApproveCount}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-3">
              <div className="text-xs text-gray-500">未完成任務</div>
              <div className="text-lg sm:text-xl font-bold text-blue-700">
                {dashboard.pendingTaskCount}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 待審核任務 */}
      {pendingTasks.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader className="py-3 px-3 sm:px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-amber-700" />
              待審核 ({pendingTasks.length})
            </CardTitle>
            <CardDescription>小孩標完成、等家長確認入帳</CardDescription>
          </CardHeader>
          <CardContent className="py-2 px-3 sm:px-4 space-y-2">
            {pendingTasks.map((t) => {
              const kid = kids.find((k) => k.id === t.kidId)
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-2 bg-white p-2 rounded border border-amber-200 flex-wrap"
                >
                  <div className="text-2xl">{t.emoji ?? "📋"}</div>
                  <div className="flex-1 min-w-[140px]">
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-gray-500">
                      {kid?.displayName ?? "—"} · {formatMoney(t.rewardAmount)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => approveTaskMutation.mutate(t.id)}
                      disabled={approveTaskMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      確認
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectTaskMutation.mutate(t.id)}
                      disabled={rejectTaskMutation.isPending}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* 小孩列表 */}
      <Card>
        <CardHeader className="py-3 px-3 sm:px-4">
          <CardTitle className="text-base">家庭成員</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3 sm:px-4">
          {kids.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6">
              還沒新增小孩、點上方「新增小孩」開始
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {kids.map((kid) => (
                <KidCard
                  key={kid.id}
                  kid={kid}
                  onEdit={() => setEditKid(kid)}
                  onDelete={() => {
                    if (confirm(`停用 ${kid.displayName}？（資料保留、可重新啟用）`)) {
                      deleteKidMutation.mutate(kid.id)
                    }
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 本月排行榜 */}
      {leaderboard && leaderboard.leaderboard.length > 0 && (
        <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50">
          <CardHeader className="py-3 px-3 sm:px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              本月排行榜（{leaderboard.month}）
            </CardTitle>
            <CardDescription>賺最多 / 完成任務最多的孩子優先</CardDescription>
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
                    {entry.completedGoalsCount > 0 && (
                      <span>🎯 達標 {entry.completedGoalsCount}</span>
                    )}
                    {entry.badgeCount > 0 && <span>🏅 +{entry.badgeCount} 徽章</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-amber-700">
                    {formatMoney(entry.approvedSum)}
                  </div>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 最近任務 */}
      {allTasks.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-3 sm:px-4">
            <CardTitle className="text-base">最近任務</CardTitle>
            <CardDescription>前 10 筆</CardDescription>
          </CardHeader>
          <CardContent className="py-2 px-3 sm:px-4 space-y-1">
            {allTasks.slice(0, 10).map((t) => {
              const kid = kids.find((k) => k.id === t.kidId)
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 text-sm py-1.5 border-b last:border-0 ${
                    t.isOverdue ? "bg-red-50 -mx-2 px-2 rounded" : ""
                  }`}
                >
                  <span className="text-lg">{t.emoji ?? "📋"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{t.title}</div>
                    {t.dueDate && (
                      <div
                        className={`text-[10px] ${
                          t.isOverdue ? "text-red-600 font-semibold" : "text-gray-400"
                        }`}
                      >
                        {t.isOverdue
                          ? `🚨 逾期 ${t.overdueDays} 天（${t.dueDate}）`
                          : `⏰ 截止 ${t.dueDate}`}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{kid?.displayName ?? "—"}</span>
                  <span className="text-xs font-mono">{formatMoney(t.rewardAmount)}</span>
                  <TaskStatusBadge status={t.status} />
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("刪除此任務？")) deleteTaskMutation.mutate(t.id)
                    }}
                    className="text-red-500 hover:bg-red-50 rounded p-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      {showAddKid && (
        <KidDialog
          mode="create"
          onClose={() => setShowAddKid(false)}
          onSuccess={() => {
            invalidateAll()
            setShowAddKid(false)
          }}
        />
      )}
      {editKid && (
        <KidDialog
          mode="edit"
          kid={editKid}
          onClose={() => setEditKid(null)}
          onSuccess={() => {
            invalidateAll()
            setEditKid(null)
          }}
        />
      )}
      {showAddTask && (
        <TaskDialog
          kids={kids}
          onClose={() => setShowAddTask(false)}
          onSuccess={() => {
            invalidateAll()
            setShowAddTask(false)
          }}
        />
      )}

      {showBatchTask && (
        <BatchTaskDialog
          kids={kids}
          onClose={() => setShowBatchTask(false)}
          onSuccess={() => {
            invalidateAll()
            setShowBatchTask(false)
          }}
        />
      )}

      <BackToTop />
    </div>
  )
}

function TaskStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "待完成", cls: "bg-gray-100 text-gray-700" },
    submitted: { label: "待審核", cls: "bg-amber-100 text-amber-800" },
    approved: { label: "已入帳", cls: "bg-green-100 text-green-800" },
    rejected: { label: "已駁回", cls: "bg-red-100 text-red-800" },
  }
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" }
  return <Badge className={`${s.cls} text-[10px]`}>{s.label}</Badge>
}

function KidCard({
  kid,
  onEdit,
  onDelete,
}: {
  kid: Kid
  onEdit: () => void
  onDelete: () => void
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
          <div className="flex gap-1 mt-2 justify-end">
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

function KidDialog({
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

function TaskDialog({
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

  const mut = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/family/tasks", {
        title: title.trim(),
        emoji,
        rewardAmount: parseFloat(rewardAmount),
        kidId: kidId ? parseInt(kidId) : null,
        notes: notes.trim() || null,
        dueDate: dueDate || null,
      }),
    onSuccess: () => {
      toast({ title: "✅ 已派任務" })
      onSuccess()
    },
    onError: (e: Error) => toast({ title: "失敗", description: e.message, variant: "destructive" }),
  })

  const canSubmit = title.trim() && parseFloat(rewardAmount) > 0 && kidId

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
            <Label>指派給 *</Label>
            <Select value={kidId} onValueChange={setKidId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇小孩" />
              </SelectTrigger>
              <SelectContent>
                {kids.map((k) => (
                  <SelectItem key={k.id} value={k.id.toString()}>
                    {k.avatar} {k.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>截止日</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <p className="text-[10px] text-gray-400 mt-0.5">逾期會標紅、自動排前面</p>
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

interface Template {
  title: string
  emoji: string
  rewardAmount: number
}

function BatchTaskDialog({
  kids,
  onClose,
  onSuccess,
}: {
  kids: Kid[]
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/family/task-templates"],
  })
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
        tasks: templates.filter((t) => selectedTpls.has(t.title)),
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
      const t = templates.find((x) => x.title === title)
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
            <Label className="font-bold">📋 選任務範本（複選）</Label>
            <div className="space-y-1 mt-1 max-h-64 overflow-y-auto">
              {templates.map((t) => (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => toggleTpl(t.title)}
                  className={`w-full text-left flex items-center gap-2 p-2 rounded border ${
                    selectedTpls.has(t.title) ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                  }`}
                >
                  <span className="text-xl">{t.emoji}</span>
                  <span className="flex-1">{t.title}</span>
                  <span className="text-xs font-mono text-gray-500">${t.rewardAmount}</span>
                  {selectedTpls.has(t.title) && (
                    <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                  )}
                </button>
              ))}
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
