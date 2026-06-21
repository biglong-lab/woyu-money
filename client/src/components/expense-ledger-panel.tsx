// 開銷流水帳面板（先記錄、後分帳）
// 與單據收件箱整合成單一窗口：最簡只填金額即可記一筆，之後再批次分帳
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Trash2, Zap, Wallet, AlertCircle } from "lucide-react"
import type { ExpenseLedgerEntry } from "@shared/schema"

type DebtCategory = { id: number; categoryName: string; categoryType: string }

interface LedgerSummary {
  total: number
  count: number
  unclassifiedCount: number
  unclassifiedAmount: number
}

const PAYMENT_METHODS = ["現金", "信用卡", "轉帳", "其他"]

// 取今天日期（本地時區 YYYY-MM-DD）
function todayStr(): string {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

export default function ExpenseLedgerPanel() {
  const { toast } = useToast()
  const [amount, setAmount] = useState("")
  const [entryDate, setEntryDate] = useState(todayStr())
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [note, setNote] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "unclassified" | "classified">(
    "unclassified"
  )

  const listUrl =
    filterStatus === "all" ? "/api/expense-ledger" : `/api/expense-ledger?status=${filterStatus}`

  const { data: entries = [], isLoading } = useQuery<ExpenseLedgerEntry[]>({
    queryKey: [listUrl],
    refetchInterval: 10000,
  })

  const { data: summary } = useQuery<LedgerSummary>({
    queryKey: ["/api/expense-ledger/summary"],
    refetchInterval: 10000,
  })

  const { data: categories = [] } = useQuery<DebtCategory[]>({
    queryKey: ["/api/categories"],
  })

  const invalidate = () => {
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" &&
        (q.queryKey[0] as string).startsWith("/api/expense-ledger"),
    })
  }

  // 快速記一筆
  const createMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/expense-ledger", {
        amount,
        entryDate,
        paymentMethod: paymentMethod || null,
        note: note || null,
      }),
    onSuccess: () => {
      invalidate()
      toast({
        title: "✅ 已記一筆",
        description: `$${Number(amount).toLocaleString()} — 稍後可分帳`,
      })
      setAmount("")
      setNote("")
      setPaymentMethod("")
    },
    onError: (e: Error) =>
      toast({ title: "記錄失敗", description: e.message, variant: "destructive" }),
  })

  // 分帳（指定分類 → 自動標 classified）
  const classifyMutation = useMutation({
    mutationFn: async ({ id, categoryId }: { id: number; categoryId: number }) =>
      apiRequest("PUT", `/api/expense-ledger/${id}`, { categoryId }),
    onSuccess: () => {
      invalidate()
      toast({ title: "已分帳" })
    },
    onError: (e: Error) =>
      toast({ title: "分帳失敗", description: e.message, variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/expense-ledger/${id}`),
    onSuccess: () => {
      invalidate()
      toast({ title: "已刪除" })
    },
  })

  const canSubmit = amount !== "" && Number(amount) >= 0 && entryDate !== ""

  return (
    <div className="space-y-6">
      {/* 快速記一筆 */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-700 font-medium">
            <Zap className="h-4 w-4" />
            快速記一筆（只要金額就能記，之後再分帳）
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-3">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="金額 *"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg font-bold"
                data-testid="ledger-amount"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) createMutation.mutate()
                }}
              />
            </div>
            <div className="sm:col-span-3">
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                data-testid="ledger-date"
              />
            </div>
            <div className="sm:col-span-2">
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger data-testid="ledger-method">
                  <SelectValue placeholder="付款方式" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-4 flex gap-2">
              <Input
                placeholder="備註（選填）"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                data-testid="ledger-note"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) createMutation.mutate()
                }}
              />
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 shrink-0"
                data-testid="ledger-submit"
              >
                記一筆
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 彙總 */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Wallet className="h-5 w-5 text-gray-500" />
              <div>
                <div className="text-xs text-gray-500">本表合計</div>
                <div className="text-xl font-bold">${summary.total.toLocaleString()}</div>
                <div className="text-xs text-gray-400">{summary.count} 筆</div>
              </div>
            </CardContent>
          </Card>
          <Card className={summary.unclassifiedCount > 0 ? "border-amber-300 bg-amber-50/50" : ""}>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle
                className={`h-5 w-5 ${summary.unclassifiedCount > 0 ? "text-amber-600" : "text-gray-400"}`}
              />
              <div>
                <div className="text-xs text-gray-500">待分帳</div>
                <div className="text-xl font-bold">{summary.unclassifiedCount} 筆</div>
                <div className="text-xs text-gray-400">
                  ${summary.unclassifiedAmount.toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 篩選 */}
      <div className="flex gap-2">
        {(
          [
            ["unclassified", "待分帳"],
            ["classified", "已分帳"],
            ["all", "全部"],
          ] as const
        ).map(([v, label]) => (
          <Button
            key={v}
            variant={filterStatus === v ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(v)}
            data-testid={`ledger-filter-${v}`}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* 列表 */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center text-gray-400 py-8">載入中…</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-gray-400 py-8">沒有流水紀錄</div>
        ) : (
          entries.map((e) => (
            <Card key={e.id} data-testid={`ledger-row-${e.id}`}>
              <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                <div className="text-lg font-bold w-24 shrink-0">
                  ${Number(e.amount).toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 w-24 shrink-0">{e.entryDate}</div>
                {e.paymentMethod && (
                  <Badge variant="outline" className="shrink-0">
                    {e.paymentMethod}
                  </Badge>
                )}
                <div className="flex-1 min-w-[120px] text-sm text-gray-700 truncate">
                  {e.note || <span className="text-gray-300">—</span>}
                </div>
                {e.status === "unclassified" ? (
                  <Select
                    onValueChange={(v) =>
                      classifyMutation.mutate({ id: e.id, categoryId: Number(v) })
                    }
                  >
                    <SelectTrigger
                      className="w-36 shrink-0"
                      data-testid={`ledger-classify-${e.id}`}
                    >
                      <SelectValue placeholder="分帳到…" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.categoryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className="shrink-0 bg-green-100 text-green-700 hover:bg-green-100">
                    {categories.find((c) => c.id === e.categoryId)?.categoryName || "已分帳"}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-gray-400 hover:text-red-500"
                  onClick={() => deleteMutation.mutate(e.id)}
                  data-testid={`ledger-delete-${e.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
