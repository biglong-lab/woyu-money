/**
 * 人事費管理 - 月度人事費表格
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Calendar, Calculator, Loader2, CheckCircle2, AlertCircle, Clock, X } from "lucide-react"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "./types"
import type { MonthlyHrCost, MonthTotal } from "./types"

interface MonthlyCostTableProps {
  /** 選擇的年份 */
  selectedYear: number
  /** 選擇的月份 */
  selectedMonth: number
  /** 年份變更回呼 */
  onYearChange: (year: number) => void
  /** 月份變更回呼 */
  onMonthChange: (month: number) => void
  /** 月度人事費資料 */
  monthlyCosts: MonthlyHrCost[]
  /** 月度費用彙總 */
  monthTotal: MonthTotal
  /** 是否載入中 */
  isLoading: boolean
  /** 是否正在產生中 */
  isGenerating: boolean
  /** 產生月度人事費回呼 */
  onGenerate: () => void
  /** 更新付款狀態回呼 */
  onUpdatePayStatus: (id: number, data: { isPaid?: boolean; insurancePaid?: boolean }) => void
}

/** 年份選項（2024-2027） */
const YEAR_OPTIONS = [2024, 2025, 2026, 2027]

/** 月份選項（1-12） */
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)

/** 月度人事費表格 */
export function MonthlyCostTable({
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  monthlyCosts,
  monthTotal,
  isLoading,
  isGenerating,
  onGenerate,
  onUpdatePayStatus,
}: MonthlyCostTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {selectedYear}年{selectedMonth}月 人事費
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={String(selectedYear)} onValueChange={(v) => onYearChange(parseInt(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}年
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedMonth)} onValueChange={(v) => onMonthChange(parseInt(v))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m}月
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Calculator className="w-4 h-4 mr-1" />
              )}
              產生
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
          </div>
        ) : monthlyCosts.length > 0 ? (
          <CostDataTable
            monthlyCosts={monthlyCosts}
            monthTotal={monthTotal}
            onUpdatePayStatus={onUpdatePayStatus}
          />
        ) : (
          <div className="text-center py-12 text-gray-400">
            <Calendar className="w-8 h-8 mx-auto mb-2" />
            <p>尚未產生本月人事費</p>
            <p className="text-xs mt-1">請先新增員工，再按「產生」按鈕計算</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** 計時人員工時編輯（inline）*/
function ActualHoursCell({ cost }: { cost: MonthlyHrCost }) {
  const { toast } = useToast()
  const isHourly =
    cost.employee?.employmentType === "part_time" ||
    cost.employee?.employmentType === "temporary" ||
    cost.employee?.employmentType === "intern"
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(cost.actualHours ?? cost.employee?.monthlyHours ?? "")

  const mutation = useMutation({
    mutationFn: (hours: string | null) =>
      apiRequest("PUT", `/api/hr/monthly-costs/${cost.id}/actual-hours`, {
        actualHours: hours,
      }),
    onSuccess: () => {
      toast({ title: "✓ 工時已更新、薪資與保費已重算" })
      queryClient.invalidateQueries({ queryKey: ["/api/hr/monthly-costs"] })
      setEditing(false)
    },
    onError: (err: Error) =>
      toast({ title: "失敗", description: err.message, variant: "destructive" }),
  })

  if (!isHourly) {
    return <span className="text-gray-300 text-xs">-</span>
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 w-16 text-xs"
          autoFocus
        />
        <button
          onClick={() => mutation.mutate(value)}
          disabled={mutation.isPending}
          className="text-green-600 text-xs"
        >
          ✓
        </button>
        <button
          onClick={() => {
            setEditing(false)
            setValue(cost.actualHours ?? cost.employee?.monthlyHours ?? "")
          }}
          className="text-gray-400 text-xs"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    )
  }

  const isOverride = !!cost.actualHours
  return (
    <button
      onClick={() => setEditing(true)}
      className="text-xs hover:bg-amber-50 px-2 py-0.5 rounded inline-flex items-center gap-1"
    >
      <Clock className="w-3 h-3" />
      {isOverride ? (
        <span className="text-amber-700 font-medium">{cost.actualHours}h</span>
      ) : (
        <span className="text-gray-400">{cost.employee?.monthlyHours ?? "-"}h</span>
      )}
    </button>
  )
}

/** 人事費資料表格 */
function CostDataTable({
  monthlyCosts,
  monthTotal,
  onUpdatePayStatus,
}: {
  monthlyCosts: MonthlyHrCost[]
  monthTotal: MonthTotal
  onUpdatePayStatus: (id: number, data: { isPaid?: boolean; insurancePaid?: boolean }) => void
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>員工</TableHead>
            <TableHead className="text-center">實際工時</TableHead>
            <TableHead className="text-right">底薪</TableHead>
            <TableHead className="text-right">雇主負擔</TableHead>
            <TableHead className="text-right">員工負擔</TableHead>
            <TableHead className="text-right">實領</TableHead>
            <TableHead className="text-right">公司成本</TableHead>
            <TableHead className="text-center">薪資</TableHead>
            <TableHead className="text-center">保費</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {monthlyCosts.map((cost) => (
            <TableRow key={cost.id}>
              <TableCell className="font-medium">
                {cost.employee?.employeeName || `ID:${cost.employeeId}`}
              </TableCell>
              <TableCell className="text-center">
                <ActualHoursCell cost={cost} />
              </TableCell>
              <TableCell className="text-right">${formatCurrency(cost.baseSalary)}</TableCell>
              <TableCell className="text-right text-orange-600">
                ${formatCurrency(cost.employerTotal)}
              </TableCell>
              <TableCell className="text-right text-blue-600">
                ${formatCurrency(cost.employeeTotal)}
              </TableCell>
              <TableCell className="text-right text-green-600">
                ${formatCurrency(cost.netSalary)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                ${formatCurrency(cost.totalCost)}
              </TableCell>
              <TableCell className="text-center">
                <button onClick={() => onUpdatePayStatus(cost.id, { isPaid: !cost.isPaid })}>
                  {cost.isPaid ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-gray-300 mx-auto" />
                  )}
                </button>
              </TableCell>
              <TableCell className="text-center">
                <button
                  onClick={() =>
                    onUpdatePayStatus(cost.id, {
                      insurancePaid: !cost.insurancePaid,
                    })
                  }
                >
                  {cost.insurancePaid ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-gray-300 mx-auto" />
                  )}
                </button>
              </TableCell>
            </TableRow>
          ))}
          {/* 彙總列 */}
          <TableRow className="bg-gray-50 font-semibold">
            <TableCell>合計</TableCell>
            <TableCell className="text-center">-</TableCell>
            <TableCell className="text-right">${formatCurrency(monthTotal.salary)}</TableCell>
            <TableCell className="text-right text-orange-600">
              ${formatCurrency(monthTotal.employerCost)}
            </TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className="text-right">${formatCurrency(monthTotal.totalCost)}</TableCell>
            <TableCell colSpan={2}></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
