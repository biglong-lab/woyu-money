/**
 * ExpenseTemplatesCard — 固定支出範本卡片
 *
 * - 顯示「我的範本」cards（房租 / 水電 / 訂閱…）
 * - 點卡片 → onApply 回傳範本物件、由父層填入 quick-add 表單
 * - 新增 / 編輯 / 軟刪除範本
 */
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import { PlusCircle, Trash2, Edit, Calendar } from "lucide-react"
import { getCategoryDecor } from "@/lib/category-emoji"

export interface ExpenseTemplate {
  id: number
  familyId: number
  name: string
  emoji: string
  amount: string
  categoryId: number | null
  paymentMethod: string
  description: string | null
  dayOfMonth: number | null
  sortOrder: number
  isActive: boolean
  createdAt: string
}

interface HouseholdCategory {
  id: number
  categoryName: string
  color: string
}

interface Props {
  onApply: (template: ExpenseTemplate) => void
}

export function ExpenseTemplatesCard({ onApply }: Props) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<ExpenseTemplate | null>(null)
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("📋")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [description, setDescription] = useState("")
  const [dayOfMonth, setDayOfMonth] = useState("")

  const { data: templates = [], isLoading } = useQuery<ExpenseTemplate[]>({
    queryKey: ["/api/household/templates"],
  })
  const { data: categories = [] } = useQuery<HouseholdCategory[]>({
    queryKey: ["/api/categories/household"],
    staleTime: 10 * 60 * 1000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/household/templates"] })

  const createMutation = useMutation<unknown, Error, Record<string, unknown>>({
    mutationFn: (body) => apiRequest("POST", "/api/household/templates", body),
    onSuccess: () => {
      toast({ title: "✅ 範本已新增" })
      closeAndReset()
      invalidate()
    },
    onError: (e) => {
      toast({ title: "新增失敗", description: e.message, variant: "destructive" })
    },
  })

  const updateMutation = useMutation<unknown, Error, { id: number; body: Record<string, unknown> }>(
    {
      mutationFn: ({ id, body }) => apiRequest("PUT", `/api/household/templates/${id}`, body),
      onSuccess: () => {
        toast({ title: "✅ 範本已更新" })
        closeAndReset()
        invalidate()
      },
      onError: (e) => {
        toast({ title: "更新失敗", description: e.message, variant: "destructive" })
      },
    }
  )

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id) => apiRequest("DELETE", `/api/household/templates/${id}`),
    onSuccess: () => {
      toast({ title: "已刪除範本" })
      invalidate()
    },
    onError: (e) => {
      toast({ title: "刪除失敗", description: e.message, variant: "destructive" })
    },
  })

  function closeAndReset(): void {
    setShowCreate(false)
    setEditing(null)
    setName("")
    setEmoji("📋")
    setAmount("")
    setCategoryId("")
    setPaymentMethod("cash")
    setDescription("")
    setDayOfMonth("")
  }

  function openEdit(t: ExpenseTemplate): void {
    setEditing(t)
    setName(t.name)
    setEmoji(t.emoji)
    setAmount(t.amount)
    setCategoryId(t.categoryId ? String(t.categoryId) : "")
    setPaymentMethod(t.paymentMethod || "cash")
    setDescription(t.description || "")
    setDayOfMonth(t.dayOfMonth ? String(t.dayOfMonth) : "")
    setShowCreate(true)
  }

  function handleSubmit(): void {
    const amt = parseFloat(amount)
    if (!name.trim()) {
      toast({ title: "請填名稱", variant: "destructive" })
      return
    }
    if (isNaN(amt) || amt < 0) {
      toast({ title: "請填正確金額", variant: "destructive" })
      return
    }
    const body: Record<string, unknown> = {
      name: name.trim(),
      emoji: emoji.trim() || "📋",
      amount: amt,
      categoryId: categoryId ? parseInt(categoryId) : null,
      paymentMethod,
      description: description.trim() || null,
      dayOfMonth: dayOfMonth ? parseInt(dayOfMonth) : null,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, body })
    } else {
      createMutation.mutate(body)
    }
  }

  return (
    <Card className="border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-blue-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">📌 我的範本</CardTitle>
          <CardDescription>
            一鍵記錄固定支出（房租 / 水費 / 訂閱）· {templates.length} 個
          </CardDescription>
        </div>
        <Dialog open={showCreate} onOpenChange={(o) => (o ? setShowCreate(true) : closeAndReset())}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <PlusCircle className="w-4 h-4" />
              新範本
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "編輯範本" : "建立支出範本"}</DialogTitle>
              <DialogDescription>
                例如：房租 NT$15,000、水費 NT$300、Netflix NT$330
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <div>
                  <Label htmlFor="t-emoji">圖示</Label>
                  <Input
                    id="t-emoji"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                    className="text-center text-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="t-name">名稱 *</Label>
                  <Input
                    id="t-name"
                    placeholder="房租 / 水費 / Netflix"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="t-amount">金額 *</Label>
                  <Input
                    id="t-amount"
                    type="number"
                    step="1"
                    placeholder="15000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div>
                  <Label htmlFor="t-day">習慣記錄日（1-31）</Label>
                  <Input
                    id="t-day"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="5"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="t-category">分類</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="t-category">
                    <SelectValue placeholder="選擇分類（選填）" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        <span className="flex items-center gap-2">
                          <span className="text-base">
                            {getCategoryDecor(c.categoryName).emoji}
                          </span>
                          {c.categoryName}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="t-payment">付款方式</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="t-payment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">💵 現金</SelectItem>
                    <SelectItem value="card">💳 信用卡</SelectItem>
                    <SelectItem value="bank_transfer">🏦 銀行轉帳</SelectItem>
                    <SelectItem value="mobile_payment">📱 行動支付</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="t-desc">預設備註（選填）</Label>
                <Input
                  id="t-desc"
                  placeholder="例如：劃機房租"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeAndReset}>
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? "更新" : "建立"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="text-sm text-gray-500">載入中...</div>}
        {!isLoading && templates.length === 0 && (
          <div className="text-sm text-gray-500 py-4 text-center">
            尚無範本、點上方「新範本」建立常用支出（房租 / 水費 / 訂閱）
          </div>
        )}
        {!isLoading && templates.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="group relative bg-white rounded-lg border-2 border-gray-200 hover:border-sky-400 p-3 transition-all active:scale-[0.98]"
                data-testid={`template-${t.id}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onApply(t)
                    toast({
                      title: `📌 已套用範本：${t.name}`,
                      description: `NT$ ${Math.round(parseFloat(t.amount)).toLocaleString()}`,
                    })
                  }}
                  className="w-full text-left"
                  data-testid={`apply-template-${t.id}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{t.name}</div>
                      <div className="text-base font-bold text-sky-700">
                        NT$ {Math.round(parseFloat(t.amount)).toLocaleString()}
                      </div>
                      {t.dayOfMonth && (
                        <div className="text-[10px] text-gray-500 flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          每月 {t.dayOfMonth} 號
                        </div>
                      )}
                    </div>
                  </div>
                </button>
                {/* 浮動 edit / delete */}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="p-1 rounded hover:bg-blue-50 text-blue-600"
                    title="編輯"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`刪除範本「${t.name}」？`)) deleteMutation.mutate(t.id)
                    }}
                    className="p-1 rounded hover:bg-rose-50 text-rose-600"
                    title="刪除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
