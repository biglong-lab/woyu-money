/**
 * 固定開銷月度矩陣視圖
 * 縱軸週期性支出模板 × 橫軸 12 月，預算（成本預估）vs 實際（已付單據）一眼看出超支/結餘
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { CalendarRange, TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { formatNT } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"

const PAYMENT_METHODS = ["現金", "信用卡", "轉帳", "其他"]

interface TemplateInfo {
  id: number
  templateName: string
  categoryId: number | null
  categoryName?: string | null
  estimatedAmount: number
  activeMonths: string
}

interface MatrixCell {
  templateId: number
  month: number
  budget: number
  actual: number
  diff: number
  active: boolean
}

interface MatrixData {
  year: number
  months: number[]
  templates: TemplateInfo[]
  cells: MatrixCell[]
  totals: { budget: number; actual: number; diff: number; overBudgetCount: number }
  monthlyTotals: Array<{ month: number; budget: number; actual: number }>
}

type DebtCategory = { id: number; categoryName: string }

const MONTH_LABELS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
]

// 依差異上色：超支(實際>預算)紅、結餘(實際<預算)綠、未付(實際=0且有預算)灰、無預算空白
function cellClass(c: MatrixCell): string {
  if (!c.active && c.actual === 0) return "bg-gray-50 text-gray-300"
  if (c.budget > 0 && c.actual === 0) return "bg-gray-50 text-gray-400 border-gray-200"
  if (c.diff > 0) return "bg-red-50 text-red-700 border-red-200"
  if (c.diff < 0) return "bg-green-50 text-green-700 border-green-200"
  return "bg-blue-50 text-blue-700 border-blue-200"
}

function cellsFor(cells: MatrixCell[], templateId: number): MatrixCell[] {
  return cells.filter((c) => c.templateId === templateId).sort((a, b) => a.month - b.month)
}

interface PayTarget {
  templateId: number
  templateName: string
  month: number
  budget: number
  actual: number
}

export default function FixedExpenseMatrixPage() {
  useDocumentTitle("固定開銷矩陣")
  const { toast } = useToast()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [categoryId, setCategoryId] = useState<string>("all")

  // 付款對話框狀態
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState("")
  const [payMethod, setPayMethod] = useState("")
  const [payFile, setPayFile] = useState<File | null>(null)

  // 新增固定開銷項目對話框
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState("")
  const [addAmount, setAddAmount] = useState("")
  const [addCategory, setAddCategory] = useState<string>("none")
  const [addMonths, setAddMonths] = useState("*")

  const url =
    categoryId === "all"
      ? `/api/fixed-expense-matrix?year=${year}`
      : `/api/fixed-expense-matrix?year=${year}&categoryId=${categoryId}`

  const { data, isLoading } = useQuery<MatrixData>({ queryKey: [url] })
  const { data: categories = [] } = useQuery<DebtCategory[]>({ queryKey: ["/api/categories"] })

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  const invalidateMatrix = () => {
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" &&
        (q.queryKey[0] as string).startsWith("/api/fixed-expense-matrix"),
    })
  }

  function openPay(t: TemplateInfo, c: MatrixCell) {
    setPayTarget({
      templateId: t.id,
      templateName: t.templateName,
      month: c.month,
      budget: c.budget,
      actual: c.actual,
    })
    // 預設金額：剩餘預算（預算−已實際），否則預算
    const remaining = Math.max(0, c.budget - c.actual)
    setPayAmount(String(remaining > 0 ? remaining : c.budget || ""))
    // 預設付款日：該月 15 號（當月則用今天）
    const mm = String(c.month).padStart(2, "0")
    const today = now.toISOString().slice(0, 10)
    setPayDate(
      c.month === now.getMonth() + 1 && year === now.getFullYear() ? today : `${year}-${mm}-15`
    )
    setPayMethod("")
    setPayFile(null)
  }

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payTarget) throw new Error("無付款目標")
      const fd = new FormData()
      fd.append("templateId", String(payTarget.templateId))
      fd.append("year", String(year))
      fd.append("month", String(payTarget.month))
      fd.append("amount", payAmount)
      if (payDate) fd.append("paymentDate", payDate)
      if (payMethod) fd.append("paymentMethod", payMethod)
      if (payFile) fd.append("receiptFile", payFile)
      return apiRequest("POST", "/api/fixed-expense-matrix/pay", fd)
    },
    onSuccess: () => {
      invalidateMatrix()
      toast({ title: "✅ 已記一筆付款", description: `$${Number(payAmount).toLocaleString()}` })
      setPayTarget(null)
    },
    onError: (e: Error) =>
      toast({ title: "付款失敗", description: e.message, variant: "destructive" }),
  })

  const addMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/recurring-expense-templates", {
        templateName: addName,
        estimatedAmount: addAmount,
        activeMonths: addMonths.trim() || "*",
        categoryId: addCategory === "none" ? undefined : Number(addCategory),
        isActive: true,
      }),
    onSuccess: () => {
      invalidateMatrix()
      toast({ title: "✅ 已新增固定開銷項目", description: addName })
      setAddOpen(false)
      setAddName("")
      setAddAmount("")
      setAddCategory("none")
      setAddMonths("*")
    },
    onError: (e: Error) =>
      toast({ title: "新增失敗", description: e.message, variant: "destructive" }),
  })

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <CalendarRange className="h-6 w-6" />
            固定開銷月度矩陣
          </h1>
          <p className="text-gray-500">預算（成本預估）對比實際付款，掌握每月固定開銷與超支</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28" data-testid="year-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y} 年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-36" data-testid="category-select">
              <SelectValue placeholder="全部類別" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部類別</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.categoryName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => setAddOpen(true)}
            className="bg-amber-600 hover:bg-amber-700"
            data-testid="add-template"
          >
            ＋ 新增固定開銷
          </Button>
        </div>
      </div>

      {/* 彙總卡 */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">年度預算</div>
              <div className="text-xl font-bold">{formatNT(data.totals.budget)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">年度實際</div>
              <div className="text-xl font-bold">{formatNT(data.totals.actual)}</div>
            </CardContent>
          </Card>
          <Card
            className={
              data.totals.diff > 0
                ? "border-red-200 bg-red-50/50"
                : "border-green-200 bg-green-50/50"
            }
          >
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                {data.totals.diff > 0 ? (
                  <TrendingUp className="h-3 w-3 text-red-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-green-500" />
                )}
                差異（實際−預算）
              </div>
              <div
                className={`text-xl font-bold ${data.totals.diff > 0 ? "text-red-600" : "text-green-600"}`}
              >
                {data.totals.diff > 0 ? "+" : ""}
                {formatNT(data.totals.diff)}
              </div>
            </CardContent>
          </Card>
          <Card
            className={data.totals.overBudgetCount > 0 ? "border-amber-200 bg-amber-50/50" : ""}
          >
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">超支月份數</div>
              <div className="text-xl font-bold">{data.totals.overBudgetCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 圖例 */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        <span className="px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
          符合預算
        </span>
        <span className="px-2 py-0.5 rounded border bg-red-50 text-red-700 border-red-200">
          超支
        </span>
        <span className="px-2 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">
          結餘
        </span>
        <span className="px-2 py-0.5 rounded border bg-gray-50 text-gray-400 border-gray-200">
          未付（有預算）
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{year} 年固定開銷矩陣</CardTitle>
          <CardDescription>
            每格上排=實際付款、下排=預算（成本預估）；空白表示該月非預算月且無付款
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">載入中…</div>
          ) : !data || data.templates.length === 0 ? (
            <div className="text-center text-gray-400 py-8 space-y-3">
              <div>尚無固定開銷項目。點右上「＋ 新增固定開銷」建立第一筆（如勞健保、店租）。</div>
              <Button
                onClick={() => setAddOpen(true)}
                className="bg-amber-600 hover:bg-amber-700"
                data-testid="add-template-empty"
              >
                ＋ 新增固定開銷
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-white z-10 min-w-[140px]">項目</th>
                  {MONTH_LABELS.map((m) => (
                    <th key={m} className="p-1 text-center text-xs text-gray-500 min-w-[64px]">
                      {m}
                    </th>
                  ))}
                  <th className="p-2 text-center text-xs text-gray-500 min-w-[80px]">小計</th>
                </tr>
              </thead>
              <tbody>
                {data.templates.map((t) => {
                  const cells = cellsFor(data.cells, t.id)
                  const rowBudget = cells.reduce((s, c) => s + c.budget, 0)
                  const rowActual = cells.reduce((s, c) => s + c.actual, 0)
                  return (
                    <tr key={t.id} className="border-t" data-testid={`row-${t.id}`}>
                      <td className="p-2 sticky left-0 bg-white z-10">
                        <div className="font-medium">{t.templateName}</div>
                        {t.categoryName && (
                          <div className="text-xs text-gray-400">{t.categoryName}</div>
                        )}
                      </td>
                      {cells.map((c) => (
                        <td key={c.month} className="p-1 text-center">
                          <div
                            className={`border rounded py-1 px-0.5 cursor-pointer hover:opacity-80 hover:ring-1 hover:ring-blue-400 active:scale-95 transition-all ${cellClass(c)}`}
                            title={`${MONTH_LABELS[c.month - 1]}\n預算 ${formatNT(c.budget)}\n實際 ${formatNT(c.actual)}\n差異 ${c.diff > 0 ? "+" : ""}${formatNT(c.diff)}\n👆 點此記一筆付款`}
                            data-testid={`cell-${t.id}-${c.month}`}
                            onClick={() => openPay(t, c)}
                          >
                            <div className="font-semibold text-[11px] leading-tight">
                              {c.actual > 0 ? formatNT(c.actual) : c.budget > 0 ? "—" : ""}
                            </div>
                            {c.budget > 0 && (
                              <div className="text-[10px] opacity-60 leading-tight">
                                {formatNT(c.budget)}
                              </div>
                            )}
                          </div>
                        </td>
                      ))}
                      <td className="p-2 text-center">
                        <div className="font-bold text-xs">{formatNT(rowActual)}</div>
                        <div className="text-[10px] text-gray-400">/ {formatNT(rowBudget)}</div>
                      </td>
                    </tr>
                  )
                })}
                {/* 每月小計列 */}
                <tr className="border-t-2 bg-gray-50 font-medium">
                  <td className="p-2 sticky left-0 bg-gray-50 z-10">每月合計</td>
                  {data.monthlyTotals.map((mt) => (
                    <td key={mt.month} className="p-1 text-center text-[11px]">
                      <div className="font-semibold">{formatNT(mt.actual)}</div>
                      <div className="text-[10px] text-gray-400">{formatNT(mt.budget)}</div>
                    </td>
                  ))}
                  <td className="p-2 text-center text-xs font-bold">
                    {formatNT(data.totals.actual)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 記一筆付款 Dialog */}
      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>記一筆付款</DialogTitle>
            <DialogDescription>
              {payTarget &&
                `${payTarget.templateName}・${year} 年 ${payTarget.month} 月（預算 ${formatNT(payTarget.budget)}${payTarget.actual > 0 ? `、已實際 ${formatNT(payTarget.actual)}` : ""}）`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">金額 *</label>
              <Input
                type="number"
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="text-lg font-bold"
                data-testid="pay-amount"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">付款日</label>
                <Input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  data-testid="pay-date"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">付款方式</label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger data-testid="pay-method">
                    <SelectValue placeholder="選填" />
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
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">收據圖片（選填）</label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setPayFile(e.target.files?.[0] ?? null)}
                data-testid="pay-receipt"
              />
              {payFile && <div className="text-xs text-gray-400 mt-1">已選：{payFile.name}</div>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>
              取消
            </Button>
            <Button
              onClick={() => payMutation.mutate()}
              disabled={!payAmount || Number(payAmount) <= 0 || payMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="pay-submit"
            >
              {payMutation.isPending ? "記錄中…" : "記一筆付款"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增固定開銷項目 Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增固定開銷項目</DialogTitle>
            <DialogDescription>
              設定每月預算（成本預估），之後在矩陣點格子記實際付款
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">項目名稱 *</label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="例：勞健保、店租、網路費"
                data-testid="add-name"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">每月預算金額 *</label>
              <Input
                type="number"
                inputMode="decimal"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                className="text-lg font-bold"
                data-testid="add-amount"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">類別（選填）</label>
              <Select value={addCategory} onValueChange={setAddCategory}>
                <SelectTrigger data-testid="add-category">
                  <SelectValue placeholder="未分類" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未分類</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.categoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">適用月份</label>
              <Input
                value={addMonths}
                onChange={(e) => setAddMonths(e.target.value)}
                placeholder="每月填 *、指定月份填 1,6,12"
                data-testid="add-months"
              />
              <div className="text-xs text-gray-400 mt-1">
                每月留「*」；只有特定月份（如年繳）填如「6」或「1,7」
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!addName || !addAmount || Number(addAmount) <= 0 || addMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="add-submit"
            >
              {addMutation.isPending ? "新增中…" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BackToTop />
    </div>
  )
}
