/**
 * 租金月度矩陣視圖（第 7 步）
 * 縱軸租約 × 橫軸 12 月份，一眼看出哪間房哪個月欠租
 */

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Calendar, CalendarPlus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { formatNT, friendlyApiError } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useCopyAmount } from "@/hooks/use-copy-amount"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"
import PaymentCellDetail from "@/components/payment-cell-detail"
import type { PaymentItem } from "@/components/installment-types"

type CellStatus = "paid" | "partial" | "unpaid" | "upcoming" | "out_of_contract"

interface Contract {
  id: number
  contractName: string
  tenantName?: string | null
  startDate: string
  endDate: string
  monthlyAmount: number
}

interface Cell {
  contractId: number
  month: number
  status: CellStatus
  paidAmount: number
  expectedAmount: number
}

interface RentalMatrixData {
  year: number
  months: number[]
  contracts: Contract[]
  cells: Cell[]
  totals: {
    expected: number
    paid: number
    unpaid: number
    paidCount: number
    unpaidCount: number
  }
}

const STATUS_META: Record<CellStatus, { label: string; bg: string; icon: string }> = {
  paid: { label: "已付", bg: "bg-green-100 text-green-800 border-green-200", icon: "✅" },
  partial: { label: "部分", bg: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: "🟡" },
  unpaid: { label: "未付", bg: "bg-red-100 text-red-800 border-red-300", icon: "🔴" },
  upcoming: { label: "未到期", bg: "bg-gray-50 text-gray-500 border-gray-200", icon: "⚪" },
  out_of_contract: {
    label: "合約外",
    bg: "bg-gray-100 text-gray-400 border-transparent",
    icon: "—",
  },
}

function MatrixCell({
  cell,
  contractName,
  onClick,
}: {
  cell: Cell
  contractName: string
  onClick?: (cell: Cell, contractName: string) => void
}) {
  const meta = STATUS_META[cell.status]
  const clickable = cell.status === "unpaid" || cell.status === "partial"
  const tooltip = clickable
    ? `${meta.label}\n應付 ${formatNT(cell.expectedAmount)}${
        cell.paidAmount > 0 ? `\n已付 ${formatNT(cell.paidAmount)}` : ""
      }\n👆 點此標記已付`
    : cell.status === "out_of_contract"
      ? "合約未涵蓋此月份"
      : `${meta.label}\n應付 ${formatNT(cell.expectedAmount)}${
          cell.paidAmount > 0 ? `\n已付 ${formatNT(cell.paidAmount)}` : ""
        }`
  return (
    <td className="p-1 text-center">
      <div
        className={`border rounded text-xs font-medium py-1 px-1 ${meta.bg} ${
          clickable ? "cursor-pointer hover:opacity-80 active:scale-95 transition-all" : ""
        }`}
        title={tooltip}
        onClick={() => clickable && onClick && onClick(cell, contractName)}
        data-testid={`cell-${cell.contractId}-${cell.month}`}
      >
        {meta.icon}
      </div>
    </td>
  )
}

function cellsFor(cells: Cell[], contractId: number): Cell[] {
  return cells.filter((c) => c.contractId === contractId).sort((a, b) => a.month - b.month)
}

function LegendBar() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-gray-700">
      {(Object.entries(STATUS_META) as [CellStatus, (typeof STATUS_META)[CellStatus]][]).map(
        ([key, meta]) => (
          <div key={key} className="flex items-center gap-1">
            <span
              className={`inline-flex items-center justify-center w-5 h-5 border rounded ${meta.bg}`}
            >
              {meta.icon}
            </span>
            <span>{meta.label}</span>
          </div>
        )
      )}
    </div>
  )
}

export default function RentalMatrixPage() {
  useDocumentTitle("租金矩陣")
  const [year, setYear] = useState(new Date().getFullYear())
  const [detailCell, setDetailCell] = useState<{
    contractId: number
    contractName: string
    month: number
  } | null>(null)
  const { toast } = useToast()
  const copyAmount = useCopyAmount()
  const years = [year - 1, year, year + 1].filter((y) => y >= 2020)

  const { data, isLoading } = useQuery<RentalMatrixData>({
    queryKey: [`/api/rental-matrix?year=${year}`],
  })

  // 取得所有應付項目, 供點格逐筆記錄付款 (此矩陣 contractId 即 projectId)
  const { data: payItemsResp } = useQuery({
    queryKey: ["/api/payment/items", { includeAll: true }],
    queryFn: () => fetch("/api/payment/items?includeAll=true").then((r) => r.json()),
  })
  const payItems: PaymentItem[] = Array.isArray(payItemsResp)
    ? payItemsResp
    : payItemsResp?.items || []

  const detailItems = detailCell
    ? payItems.filter((it) => {
        if (!it.startDate) return false
        const d = new Date(it.startDate)
        return (
          it.projectId === detailCell.contractId &&
          d.getFullYear() === year &&
          d.getMonth() + 1 === detailCell.month
        )
      })
    : []

  const yearlyCreateMutation = useMutation<
    { createdCount: number; skipped: number },
    Error,
    { projectId: number; monthlyAmount: number; contractName: string }
  >({
    mutationFn: (input) =>
      apiRequest("POST", "/api/rental-batch/create-yearly-items", {
        projectId: input.projectId,
        year,
        monthlyAmount: input.monthlyAmount,
      }),
    onSuccess: (result, input) => {
      toast({
        title: `已建立 ${result.createdCount} 筆月租項目`,
        description:
          result.skipped > 0
            ? `${input.contractName}（${year} 年；${result.skipped} 個月已存在略過）`
            : input.contractName,
      })
      queryClient.invalidateQueries({ queryKey: [`/api/rental-matrix?year=${year}`] })
    },
    onError: (err) =>
      toast({ title: "建立失敗", description: friendlyApiError(err), variant: "destructive" }),
  })

  const handleCreateYear = (projectId: number, monthlyAmount: number, contractName: string) => {
    if (monthlyAmount <= 0) {
      toast({
        title: "無法建立",
        description: "此合約沒有月租金額參考，請先手動建立一筆作為範本",
        variant: "destructive",
      })
      return
    }
    if (
      !window.confirm(
        `為「${contractName}」建立 ${year} 年缺少月份的月租項目？\n每月 NT$ ${Math.round(monthlyAmount).toLocaleString()}`
      )
    )
      return
    yearlyCreateMutation.mutate({ projectId, monthlyAmount, contractName })
  }

  // 點格後刷新矩陣 (付款記錄由 PaymentCellDetail 內部處理)
  const refreshMatrix = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/rental-matrix?year=${year}`] })
    queryClient.invalidateQueries({ queryKey: ["/api/payment/priority-report?includeLow=true"] })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="h-7 w-7 text-blue-600" />
          租金月度矩陣
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          一眼看出哪間房哪個月欠租。<strong>點格子可逐筆記錄付款（可分多次直到付清）</strong>
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">{year} 年度</CardTitle>
              <CardDescription className="text-xs">
                {data ? `共 ${data.contracts.length} 份合約` : "載入中..."}
              </CardDescription>
            </div>
            <div className="flex gap-1 flex-wrap items-center">
              {years.map((y) => (
                <Button
                  key={y}
                  variant={y === year ? "default" : "outline"}
                  size="sm"
                  onClick={() => setYear(y)}
                  className="text-xs"
                >
                  {y}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="text-sm text-gray-500">載入中...</div>}
          {!isLoading && data && data.contracts.length === 0 && (
            <div className="text-sm text-gray-600">目前沒有有效的租約。</div>
          )}
          {data && data.contracts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 min-w-[140px]">合約</th>
                    {data.months.map((m) => (
                      <th key={m} className="p-1 text-center w-10">
                        {m}月
                      </th>
                    ))}
                    <th className="p-2 text-right">應付</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contracts.map((c) => {
                    const cells = cellsFor(data.cells, c.id)
                    const expected = cells
                      .filter(
                        (cell) => cell.status !== "out_of_contract" && cell.status !== "upcoming"
                      )
                      .reduce((sum, cell) => sum + cell.expectedAmount, 0)
                    return (
                      <tr key={c.id} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="p-2">
                          <div className="flex items-center justify-between gap-1">
                            <div>
                              <div className="font-medium">{c.contractName}</div>
                              {c.tenantName && (
                                <div className="text-xs text-gray-500">{c.tenantName}</div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[10px] shrink-0"
                              onClick={() =>
                                handleCreateYear(c.id, c.monthlyAmount, c.contractName)
                              }
                              disabled={yearlyCreateMutation.isPending}
                              title={`為 ${year} 年建立缺少月份的月租項目`}
                              data-testid={`create-year-${c.id}`}
                            >
                              <CalendarPlus className="h-3 w-3 mr-0.5" />
                              +12
                            </Button>
                          </div>
                        </td>
                        {cells.map((cell) => (
                          <MatrixCell
                            key={cell.month}
                            cell={cell}
                            contractName={c.contractName}
                            onClick={(cell, contractName) =>
                              setDetailCell({
                                contractId: cell.contractId,
                                contractName,
                                month: cell.month,
                              })
                            }
                          />
                        ))}
                        <td className="p-2 text-right text-xs text-gray-700">
                          <button
                            type="button"
                            onClick={() => copyAmount(expected, `${c.contractName} ${year} 年應付`)}
                            className="hover:text-blue-600 hover:underline cursor-pointer"
                            title="點擊複製此合約年度應付總額"
                          >
                            {formatNT(expected)}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  {/* 每月應付小計 */}
                  <tr className="border-t-2 font-semibold bg-gray-50">
                    <td className="p-2 text-xs text-gray-600">每月應付</td>
                    {data.months.map((m) => {
                      const monthExpected = data.cells
                        .filter(
                          (c) =>
                            c.month === m &&
                            c.status !== "out_of_contract" &&
                            c.status !== "upcoming"
                        )
                        .reduce((sum, c) => sum + c.expectedAmount, 0)
                      return (
                        <td key={m} className="p-1 text-center text-[10px] text-gray-600">
                          {monthExpected > 0 ? `${Math.round(monthExpected / 1000)}k` : "—"}
                        </td>
                      )
                    })}
                    <td className="p-2 text-right text-sm">
                      <button
                        type="button"
                        onClick={() => copyAmount(data.totals.expected, `${year} 年應付總額`)}
                        className="hover:text-blue-600 hover:underline cursor-pointer"
                        title="點擊複製年度應付總額"
                      >
                        {formatNT(data.totals.expected)}
                      </button>
                    </td>
                  </tr>
                  {/* 每月已付小計 */}
                  <tr className="font-semibold bg-green-50">
                    <td className="p-2 text-xs text-green-800">每月已付</td>
                    {data.months.map((m) => {
                      const monthPaid = data.cells
                        .filter((c) => c.month === m)
                        .reduce((sum, c) => sum + c.paidAmount, 0)
                      return (
                        <td key={m} className="p-1 text-center text-[10px] text-green-700">
                          {monthPaid > 0 ? `${Math.round(monthPaid / 1000)}k` : "—"}
                        </td>
                      )
                    })}
                    <td className="p-2 text-right text-sm text-green-700">
                      <button
                        type="button"
                        onClick={() => copyAmount(data.totals.paid, `${year} 年已付總額`)}
                        className="hover:text-blue-600 hover:underline cursor-pointer"
                        title="點擊複製年度已付總額"
                      >
                        {formatNT(data.totals.paid)}
                      </button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gray-50">
        <CardContent className="pt-6">
          <LegendBar />
        </CardContent>
      </Card>

      {/* 點格 → 逐筆記錄付款 (共用元件; 只記錄不刪除, 結構性項目調整請回租約設定) */}
      <PaymentCellDetail
        open={!!detailCell}
        onClose={() => setDetailCell(null)}
        title={detailCell ? `${detailCell.contractName} · ${detailCell.month}月` : ""}
        items={detailItems}
        onChanged={refreshMatrix}
      />
      <BackToTop />
    </div>
  )
}
