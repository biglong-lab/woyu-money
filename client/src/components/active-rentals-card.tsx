/**
 * 常用合約本月狀態卡（首頁）
 * 直接顯示主要租金合約本月狀態 + 一鍵付款
 */

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Building2, CheckCircle2, Copy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { formatNT } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useCopyAmount } from "@/hooks/use-copy-amount"

type CellStatus = "paid" | "partial" | "unpaid" | "upcoming" | "out_of_contract"

interface Contract {
  id: number
  contractName: string
  monthlyAmount: number
}
interface Cell {
  contractId: number
  month: number
  status: CellStatus
  paidAmount: number
  expectedAmount: number
}
interface MatrixData {
  year: number
  contracts: Contract[]
  cells: Cell[]
}

const STATUS_BADGE: Record<CellStatus, { label: string; cls: string; icon: string }> = {
  paid: { label: "已付", cls: "bg-green-100 text-green-800", icon: "✅" },
  partial: { label: "部分", cls: "bg-yellow-100 text-yellow-800", icon: "🟡" },
  unpaid: { label: "未付", cls: "bg-red-100 text-red-800", icon: "🔴" },
  upcoming: { label: "未到期", cls: "bg-gray-100 text-gray-600", icon: "⚪" },
  out_of_contract: { label: "—", cls: "bg-gray-50 text-gray-400", icon: "—" },
}

export function ActiveRentalsCard() {
  const year = new Date().getFullYear()
  const month = new Date().getMonth() + 1
  const { toast } = useToast()
  const copyAmount = useCopyAmount()
  const [pendingId, setPendingId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<MatrixData>({
    queryKey: [`/api/rental-matrix?year=${year}`],
  })

  const markPaidMutation = useMutation<
    unknown,
    Error,
    { projectId: number; contractName: string; expected: number }
  >({
    mutationFn: (input) =>
      apiRequest("POST", "/api/rental-batch/mark-cell-paid", {
        projectId: input.projectId,
        year,
        month,
      }),
    onMutate: (input) => setPendingId(input.projectId),
    onSuccess: (_data, input) => {
      toast({ title: `${input.contractName} 已標記` })
      queryClient.invalidateQueries({ queryKey: [`/api/rental-matrix?year=${year}`] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/priority-report?includeLow=true"] })
    },
    onSettled: () => setPendingId(null),
    onError: (err) =>
      toast({ title: "標記失敗", description: err.message, variant: "destructive" }),
  })

  // 一鍵批次：本月所有未付標記為已付
  const batchMarkPaidMutation = useMutation<
    { processedCount: number; totalPaid: number },
    Error,
    void
  >({
    mutationFn: () =>
      apiRequest("POST", "/api/rental-batch/mark-month-paid", { year, month }) as Promise<{
        processedCount: number
        totalPaid: number
      }>,
    onSuccess: (result) => {
      toast({
        title: `已標記 ${result.processedCount} 筆租金為已付`,
        description: `合計 NT$ ${Math.round(result.totalPaid).toLocaleString()}`,
      })
      queryClient.invalidateQueries({ queryKey: [`/api/rental-matrix?year=${year}`] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/priority-report?includeLow=true"] })
    },
    onError: (err) =>
      toast({ title: "批次標記失敗", description: err.message, variant: "destructive" }),
  })

  const handleBatchMarkPaid = () => {
    if (
      !window.confirm(
        `確定為 ${month} 月所有未付租金標記為已付？\n（這將為符合條件的租金項目建立付款記錄）`
      )
    )
      return
    batchMarkPaidMutation.mutate()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!data || data.contracts.length === 0) return null

  // 取本月的 cells，依合約配對
  const thisMonth = data.cells.filter((c) => c.month === month && c.status !== "out_of_contract")
  if (thisMonth.length === 0) return null

  // 排序：未付 > 部分 > 已付 > 未到期（待處理優先）
  const STATUS_ORDER: Record<CellStatus, number> = {
    unpaid: 0,
    partial: 1,
    paid: 2,
    upcoming: 3,
    out_of_contract: 4,
  }
  const sortedThisMonth = [...thisMonth].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  )

  const items = sortedThisMonth.map((cell) => {
    const contract = data.contracts.find((c) => c.id === cell.contractId)
    return { cell, contract }
  })

  // 統計進度
  const total = thisMonth.length
  const paidCount = thisMonth.filter((c) => c.status === "paid").length
  const pendingCount = thisMonth.filter(
    (c) => c.status === "unpaid" || c.status === "partial"
  ).length
  const monthExpected = thisMonth.reduce((sum, c) => sum + c.expectedAmount, 0)
  const monthPaid = thisMonth.reduce((sum, c) => sum + c.paidAmount, 0)
  const progressPct = monthExpected > 0 ? (monthPaid / monthExpected) * 100 : 0
  // 慶祝條件：無未付/部分（未到期不算）
  const allPaid = pendingCount === 0 && total > 0 && paidCount > 0

  // 複製本月待繳清單（給 LINE / 備忘錄）
  const handleCopyPendingList = async () => {
    const pending = items.filter(
      ({ cell }) => cell.status === "unpaid" || cell.status === "partial"
    )
    if (pending.length === 0) return
    const sumDue = pending.reduce(
      (sum, { cell }) => sum + (cell.expectedAmount - cell.paidAmount),
      0
    )
    const lines = pending
      .map(({ cell, contract }, i) => {
        if (!contract) return ""
        const due = cell.expectedAmount - cell.paidAmount
        const partial = cell.paidAmount > 0 ? `（已付 ${formatNT(cell.paidAmount)}）` : ""
        return `${i + 1}. ${contract.contractName} ${formatNT(due)}${partial}`
      })
      .filter(Boolean)
    const text =
      `🏠 ${month} 月租金待繳（${pending.length} 件 / 共 ${formatNT(sumDue)}）：\n\n` +
      lines.join("\n")
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "已複製清單", description: "可貼到 LINE / 備忘錄" })
    } catch {
      toast({ title: "複製失敗", variant: "destructive" })
    }
  }

  return (
    <Card
      className={allPaid ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-300" : ""}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm sm:text-base flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            {month} 月租金狀態
          </CardTitle>
          {allPaid ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              🎉 本月全部付清
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                已付 {paidCount}/{total} · {formatNT(monthPaid)} / {formatNT(monthExpected)}
              </span>
              {pendingCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={handleCopyPendingList}
                  title={`複製待繳 ${pendingCount} 筆清單`}
                  data-testid="copy-pending-rentals"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  清單 ({pendingCount})
                </Button>
              )}
            </div>
          )}
        </div>
        {/* 進度條 */}
        <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${allPaid ? "bg-emerald-500" : "bg-green-500"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {/* 一鍵批次：≥2 筆未付才顯示，避免單筆時誤觸 */}
        {pendingCount >= 2 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 w-full text-xs h-8 border-green-300 text-green-700 hover:bg-green-50"
            onClick={handleBatchMarkPaid}
            disabled={batchMarkPaidMutation.isPending}
            data-testid="batch-mark-all-paid"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            {batchMarkPaidMutation.isPending
              ? "處理中..."
              : `🚀 一鍵全部標記已付（${pendingCount} 筆 ${formatNT(monthExpected - monthPaid)}）`}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map(({ cell, contract }) => {
          if (!contract) return null
          const meta = STATUS_BADGE[cell.status]
          const canPay = cell.status === "unpaid" || cell.status === "partial"
          return (
            <div
              key={cell.contractId}
              className="flex items-center justify-between gap-2 rounded-lg border p-2 sm:p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{contract.contractName}</span>
                  <Badge className={`text-xs ${meta.cls}`} variant="outline">
                    {meta.icon} {meta.label}
                  </Badge>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  應付{" "}
                  <button
                    type="button"
                    onClick={() => copyAmount(cell.expectedAmount, contract.contractName)}
                    className="font-medium hover:text-blue-600 hover:underline cursor-pointer"
                    title="點擊複製數字（轉帳用）"
                    data-testid={`copy-amount-${cell.contractId}`}
                  >
                    {formatNT(cell.expectedAmount)}
                  </button>
                  {cell.paidAmount > 0 && cell.status !== "paid" && (
                    <span className="ml-1">/ 已付 {formatNT(cell.paidAmount)}</span>
                  )}
                </div>
              </div>
              {canPay && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-xs h-7 shrink-0"
                  onClick={() => {
                    const due = cell.expectedAmount - cell.paidAmount
                    if (
                      !window.confirm(
                        `確定為「${contract.contractName}」標記 ${formatNT(due)} 為已付？`
                      )
                    )
                      return
                    markPaidMutation.mutate({
                      projectId: cell.contractId,
                      contractName: contract.contractName,
                      expected: cell.expectedAmount,
                    })
                  }}
                  disabled={pendingId === cell.contractId}
                  data-testid={`active-rental-paid-${cell.contractId}`}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {pendingId === cell.contractId ? "..." : "已付"}
                </Button>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
