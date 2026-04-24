/**
 * 租金月度矩陣視圖（第 7 步）
 * 縱軸租約 × 橫軸 12 月份，一眼看出哪間房哪個月欠租
 */

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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

function formatCurrency(n: number): string {
  return `NT$ ${Math.round(n).toLocaleString()}`
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

function MatrixCell({ cell }: { cell: Cell }) {
  const meta = STATUS_META[cell.status]
  const tooltip =
    cell.status === "out_of_contract"
      ? "合約未涵蓋此月份"
      : `${meta.label}\n應付 ${formatCurrency(cell.expectedAmount)}${
          cell.paidAmount > 0 ? `\n已付 ${formatCurrency(cell.paidAmount)}` : ""
        }`
  return (
    <td className="p-1 text-center">
      <div
        className={`border rounded text-xs font-medium py-1 px-1 ${meta.bg}`}
        title={tooltip}
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
  const [year, setYear] = useState(new Date().getFullYear())
  const years = [year - 1, year, year + 1].filter((y) => y >= 2020)

  const { data, isLoading } = useQuery<RentalMatrixData>({
    queryKey: [`/api/rental-matrix?year=${year}`],
  })

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="h-7 w-7 text-blue-600" />
          租金月度矩陣
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          一眼看出哪間房哪個月欠租，點格子可標記已付（未來功能）
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
            <div className="flex gap-1">
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
                          <div className="font-medium">{c.contractName}</div>
                          {c.tenantName && (
                            <div className="text-xs text-gray-500">{c.tenantName}</div>
                          )}
                        </td>
                        {cells.map((cell) => (
                          <MatrixCell key={cell.month} cell={cell} />
                        ))}
                        <td className="p-2 text-right text-xs text-gray-700">
                          {formatCurrency(expected)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="p-2">合計</td>
                    <td colSpan={12} className="p-2 text-right text-xs text-gray-600">
                      已付 {formatCurrency(data.totals.paid)} / 應付
                    </td>
                    <td className="p-2 text-right">{formatCurrency(data.totals.expected)}</td>
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
    </div>
  )
}
