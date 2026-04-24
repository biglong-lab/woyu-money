/**
 * 常用合約本月狀態卡（首頁）
 * 直接顯示主要租金合約本月狀態 + 一鍵付款
 */

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Building2, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"

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

function fmt(n: number): string {
  return `NT$ ${Math.round(n).toLocaleString()}`
}

export function ActiveRentalsCard() {
  const year = new Date().getFullYear()
  const month = new Date().getMonth() + 1
  const { toast } = useToast()
  const [pendingId, setPendingId] = useState<number | null>(null)

  const { data } = useQuery<MatrixData>({
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

  if (!data || data.contracts.length === 0) return null

  // 取本月的 cells，依合約配對
  const thisMonth = data.cells.filter((c) => c.month === month && c.status !== "out_of_contract")
  if (thisMonth.length === 0) return null

  const items = thisMonth.map((cell) => {
    const contract = data.contracts.find((c) => c.id === cell.contractId)
    return { cell, contract }
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-base flex items-center gap-1.5">
          <Building2 className="h-4 w-4" />
          {month} 月租金狀態
        </CardTitle>
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
                  應付 {fmt(cell.expectedAmount)}
                  {cell.paidAmount > 0 && cell.status !== "paid" && (
                    <span className="ml-1">/ 已付 {fmt(cell.paidAmount)}</span>
                  )}
                </div>
              </div>
              {canPay && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-xs h-7 shrink-0"
                  onClick={() =>
                    markPaidMutation.mutate({
                      projectId: cell.contractId,
                      contractName: contract.contractName,
                      expected: cell.expectedAmount,
                    })
                  }
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
