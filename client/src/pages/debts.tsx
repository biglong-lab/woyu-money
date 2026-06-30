/**
 * 歷史欠款整理（/debts）
 *
 * 獨立模組。解決「過去帳務散落、急迫才處理、無法掌握全貌」的問題：
 * 先登打所有欠款 → 一眼看總未還金額 → 分期還款 → 歸帳。
 * 與現有記帳窗口（進行中帳務）切開，互不干擾。
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Tag,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  ImageIcon,
} from "lucide-react"
import { DebtForm } from "@/components/debts/debt-form"
import { PaymentsDialog } from "@/components/debts/payments-dialog"
import { CategoriesDialog } from "@/components/debts/categories-dialog"
import { ImageLightbox } from "@/components/card-claims/image-lightbox"
import {
  statusMeta,
  PAYMENT_STATUS_META,
  fmt,
  isOverdue,
  type Category,
  type Debt,
  type DebtSummary,
} from "@/components/debts/shared"

export default function DebtsPage() {
  useDocumentTitle("歷史欠款整理")
  const { toast } = useToast()

  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")

  const [editing, setEditing] = useState<Debt | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [paymentsFor, setPaymentsFor] = useState<Debt | null>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const params = new URLSearchParams()
  if (statusFilter !== "all") params.set("status", statusFilter)
  if (categoryFilter !== "all") params.set("categoryId", categoryFilter)
  if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter)
  const qs = params.toString()
  const suffix = qs ? `?${qs}` : ""

  const { data: debts = [], isLoading } = useQuery<Debt[]>({ queryKey: [`/api/debts${suffix}`] })
  const { data: summary } = useQuery<DebtSummary>({ queryKey: [`/api/debts/summary${suffix}`] })
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/debts/categories"] })

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith("/api/debts"),
    })

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/debts/${id}`),
    onSuccess: () => {
      refresh()
      toast({ title: "已刪除欠款" })
    },
  })

  const reconcileMut = useMutation({
    mutationFn: (debt: Debt) =>
      apiRequest("PATCH", `/api/debts/${debt.id}`, {
        status: debt.status === "reconciled" ? "open" : "reconciled",
      }),
    onSuccess: () => {
      refresh()
      toast({ title: "已更新歸帳狀態" })
    },
  })

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(d: Debt) {
    setEditing(d)
    setFormOpen(true)
  }

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-6xl">
      {/* 標題列 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-rose-600" /> 歷史欠款整理
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            把過去散落的欠款先登打進來看全貌，再做分期還款與歸帳
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
            <Tag className="h-4 w-4 mr-1" /> 分類
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> 新增欠款
          </Button>
        </div>
      </div>

      {/* 全貌摘要 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Wallet className="h-4 w-4" />}
          label="欠款總額"
          value={fmt(summary?.totalDebt ?? 0)}
          tone="text-slate-700"
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="已還"
          value={fmt(summary?.totalPaid ?? 0)}
          tone="text-green-600"
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="未還（待處理）"
          value={fmt(summary?.totalRemaining ?? 0)}
          tone="text-rose-600"
          highlight
        />
        <SummaryCard
          icon={<ClipboardList className="h-4 w-4" />}
          label="筆數"
          value={String(summary?.totalCount ?? 0)}
          tone="text-slate-700"
        />
      </div>

      {/* 分類拆解 */}
      {summary && summary.byCategory.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.byCategory
            .slice()
            .sort((a, b) => b.remaining - a.remaining)
            .map((c) => (
              <button
                key={c.categoryId ?? "none"}
                type="button"
                onClick={() =>
                  setCategoryFilter(
                    categoryFilter === String(c.categoryId ?? "")
                      ? "all"
                      : String(c.categoryId ?? "")
                  )
                }
                className="rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-muted text-left"
              >
                <span className="font-medium">{c.categoryName ?? "未分類"}</span>
                <span className="text-rose-600 ml-2">{fmt(c.remaining)}</span>
                <span className="text-muted-foreground ml-1 text-xs">({c.count})</span>
              </button>
            ))}
        </div>
      )}

      {/* 篩選列 */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="狀態"
          options={[
            { value: "all", label: "全部狀態" },
            { value: "open", label: "處理中" },
            { value: "reconciled", label: "已歸帳" },
            { value: "cancelled", label: "作廢" },
          ]}
        />
        <FilterSelect
          value={paymentFilter}
          onChange={setPaymentFilter}
          placeholder="還款進度"
          options={[
            { value: "all", label: "全部進度" },
            { value: "unpaid", label: "未還" },
            { value: "partial", label: "部分還款" },
            { value: "paid", label: "已還清" },
          ]}
        />
        <FilterSelect
          value={categoryFilter}
          onChange={setCategoryFilter}
          placeholder="分類"
          options={[
            { value: "all", label: "全部分類" },
            ...categories.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
        />
      </div>

      {/* 列表 */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-10">載入中…</p>
      ) : debts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            尚無欠款紀錄，點右上「新增欠款」開始登打
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 桌面：表格 */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>分類 / 對象</TableHead>
                      <TableHead className="text-right">總額</TableHead>
                      <TableHead className="text-right">已還</TableHead>
                      <TableHead className="text-right">未還</TableHead>
                      <TableHead>進度</TableHead>
                      <TableHead>到期日</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debts.map((d) => (
                      <DebtRow
                        key={d.id}
                        debt={d}
                        onPay={() => setPaymentsFor(d)}
                        onEdit={() => openEdit(d)}
                        onReconcile={() => reconcileMut.mutate(d)}
                        onDelete={() => deleteMut.mutate(d.id)}
                        onImage={() => d.receiptImageUrl && setLightbox(d.receiptImageUrl)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* 手機：卡片 */}
          <div className="md:hidden space-y-2">
            {debts.map((d) => (
              <DebtCardMobile
                key={d.id}
                debt={d}
                onPay={() => setPaymentsFor(d)}
                onEdit={() => openEdit(d)}
                onReconcile={() => reconcileMut.mutate(d)}
                onDelete={() => deleteMut.mutate(d.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* 對話框 */}
      {formOpen && (
        <DebtForm debt={editing} categories={categories} onClose={() => setFormOpen(false)} />
      )}
      {paymentsFor && <PaymentsDialog debt={paymentsFor} onClose={() => setPaymentsFor(null)} />}
      {categoriesOpen && <CategoriesDialog onClose={() => setCategoriesOpen(false)} />}
      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: string
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? "border-rose-300 bg-rose-50/40" : ""}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className={`text-xl font-bold mt-1 ${tone}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: Array<{ value: string; label: string }>
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface RowActions {
  onPay: () => void
  onEdit: () => void
  onReconcile: () => void
  onDelete: () => void
}

function DebtRow({ debt, onImage, ...actions }: { debt: Debt; onImage: () => void } & RowActions) {
  const sm = statusMeta(debt.status)
  const pm = PAYMENT_STATUS_META[debt.paymentStatus]
  const overdue = isOverdue(debt)
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {debt.receiptImageUrl && (
            <button type="button" onClick={onImage} className="text-indigo-500" title="檢視單據">
              <ImageIcon className="h-4 w-4" />
            </button>
          )}
          <div>
            <div className="font-medium">{debt.categoryName ?? "未分類"}</div>
            {debt.creditor && <div className="text-xs text-muted-foreground">{debt.creditor}</div>}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right">{fmt(Number(debt.amount))}</TableCell>
      <TableCell className="text-right text-green-600">{fmt(debt.paidAmount)}</TableCell>
      <TableCell className="text-right font-semibold text-rose-600">
        {fmt(debt.remainingAmount)}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={pm.color}>
          {pm.label}
        </Badge>
      </TableCell>
      <TableCell>
        <span className={overdue ? "text-rose-600 font-medium" : "text-muted-foreground"}>
          {debt.dueDate ?? "—"}
          {overdue && " ⚠"}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={sm.color}>
          {sm.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <RowButtons debt={debt} {...actions} />
      </TableCell>
    </TableRow>
  )
}

function DebtCardMobile({ debt, ...actions }: { debt: Debt } & RowActions) {
  const sm = statusMeta(debt.status)
  const pm = PAYMENT_STATUS_META[debt.paymentStatus]
  const overdue = isOverdue(debt)
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-medium">{debt.categoryName ?? "未分類"}</div>
            {debt.creditor && <div className="text-xs text-muted-foreground">{debt.creditor}</div>}
          </div>
          <div className="flex gap-1">
            <Badge variant="secondary" className={pm.color}>
              {pm.label}
            </Badge>
            <Badge variant="secondary" className={sm.color}>
              {sm.label}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">總額</div>
            <div>{fmt(Number(debt.amount))}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">已還</div>
            <div className="text-green-600">{fmt(debt.paidAmount)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">未還</div>
            <div className="font-semibold text-rose-600">{fmt(debt.remainingAmount)}</div>
          </div>
        </div>
        {debt.dueDate && (
          <div
            className={`text-xs ${overdue ? "text-rose-600 font-medium" : "text-muted-foreground"}`}
          >
            到期日：{debt.dueDate}
            {overdue && " ⚠ 已逾期"}
          </div>
        )}
        <div className="flex justify-end">
          <RowButtons debt={debt} {...actions} />
        </div>
      </CardContent>
    </Card>
  )
}

function RowButtons({ debt, onPay, onEdit, onReconcile, onDelete }: { debt: Debt } & RowActions) {
  return (
    <div className="inline-flex gap-1">
      <Button size="sm" variant="outline" className="h-7" onClick={onPay}>
        <Wallet className="h-3.5 w-3.5 mr-1" /> 還款
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        onClick={onReconcile}
        title={debt.status === "reconciled" ? "取消歸帳" : "標記已歸帳"}
      >
        <CheckCircle2
          className={`h-3.5 w-3.5 ${debt.status === "reconciled" ? "text-green-600" : ""}`}
        />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5 text-red-400" />
      </Button>
    </div>
  )
}
