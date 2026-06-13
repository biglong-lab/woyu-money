/**
 * 欠款分期規劃器（駕駛艙頁內面板，不跳頁）
 *
 * 用途：勞健保/貨款等大筆欠款 → 輸入 → 自動分期方案 + 滯納金推估
 *      → 一鍵建立 N 筆應付款項（每期一筆，沿用系統既有「第i/N期」慣例）
 *      → 立即進入優先級排序與現金流預估，全程不離開駕駛艙
 */
import { useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Layers, Plus, AlertTriangle, CheckCircle2 } from "lucide-react"

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

// 類別 → 預設每月滯納金率（%），可在表單調整。供「不分期繼續拖」的損失推估
const CATEGORIES = [
  { value: "勞保", lateRate: 9 }, // 0.3%/日 ≈ 9%/月
  { value: "健保", lateRate: 3 }, // 0.1%/日 ≈ 3%/月
  { value: "勞退", lateRate: 3 },
  { value: "稅務", lateRate: 15 },
  { value: "貨款", lateRate: 0 },
  { value: "銀行貸款", lateRate: 2 },
  { value: "其他", lateRate: 0 },
]

function addMonths(base: Date, n: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + n, 1)
}
function monthEnd(d: Date): string {
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`
}
function monthStart(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
function ym(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

interface PlanRow {
  period: number
  monthLabel: string
  startDate: string
  dueDate: string
  amount: number
}

export function ArrearsPlanner() {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [category, setCategory] = useState("勞保")
  const [total, setTotal] = useState("")
  const [installments, setInstallments] = useState("12")
  const [firstMonthOffset, setFirstMonthOffset] = useState("1") // 0=本月 1=下月
  const [lateRate, setLateRate] = useState("9")
  const [notes, setNotes] = useState("")

  // 切換類別自動帶入預設滯納率
  function onCategoryChange(v: string) {
    setCategory(v)
    const c = CATEGORIES.find((c) => c.value === v)
    if (c) setLateRate(String(c.lateRate))
  }

  const totalNum = parseFloat(total) || 0
  const n = Math.max(1, parseInt(installments, 10) || 1)

  // 分期方案（最後一期吸收餘數）
  const plan = useMemo<PlanRow[]>(() => {
    if (totalNum <= 0) return []
    const base = addMonths(new Date(), parseInt(firstMonthOffset, 10) || 0)
    const per = Math.floor((totalNum / n) * 100) / 100
    const rows: PlanRow[] = []
    let allocated = 0
    for (let i = 0; i < n; i++) {
      const d = addMonths(base, i)
      const amount = i === n - 1 ? Math.round((totalNum - allocated) * 100) / 100 : per
      allocated += per
      rows.push({
        period: i + 1,
        monthLabel: ym(d),
        startDate: monthStart(d),
        dueDate: monthEnd(d),
        amount,
      })
    }
    return rows
  }, [totalNum, n, firstMonthOffset])

  // 「不分期繼續拖」推估損失（簡化：每月對未清餘額計滯納金，分期則逐月清償）
  const dragLoss = useMemo(() => {
    const rate = (parseFloat(lateRate) || 0) / 100
    if (totalNum <= 0 || rate <= 0) return 0
    // 假設若不處理、拖到分期期數那麼多個月：對全額逐月累計
    return Math.round(totalNum * rate * n)
  }, [totalNum, lateRate, n])

  const perAmount = plan.length > 0 ? plan[0].amount : 0

  const createMut = useMutation({
    mutationFn: async () => {
      // 每期建立一筆 payment_item（沿用「第i/共N期」慣例）
      for (const row of plan) {
        await apiRequest("POST", "/api/payment/items", {
          itemName: `${name}（第${row.period}/共${n}期）`,
          totalAmount: row.amount.toFixed(2),
          itemType: "project",
          paymentType: "single",
          startDate: row.startDate,
          dueDate: row.dueDate,
          status: "pending",
          notes:
            notes ||
            `欠款分期規劃：${category}，總欠款 ${fmt(totalNum)}，共 ${n} 期，每期約 ${fmt(perAmount)}`,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          ["/api/payment", "/api/cashflow", "/api/dashboard"].some((p) =>
            String(q.queryKey[0]).startsWith(p)
          ),
      })
      toast({
        title: `已建立 ${n} 期分期應付款`,
        description: "已進入應付款排序與現金流預估",
      })
      setName("")
      setTotal("")
      setNotes("")
    },
    onError: (e: Error) =>
      toast({ title: "建立失敗", description: e.message, variant: "destructive" }),
  })

  function submit() {
    if (!name.trim()) {
      toast({ title: "請輸入欠款名稱", variant: "destructive" })
      return
    }
    if (totalNum <= 0) {
      toast({ title: "請輸入有效總欠款金額", variant: "destructive" })
      return
    }
    createMut.mutate()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" />
            欠款分期規劃器
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            勞健保 / 貨款等大筆欠款，輸入後自動分期、推估拖欠損失，一鍵排進未來月份
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>欠款名稱 *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：勞健保欠款、XX 貨款"
              />
            </div>
            <div>
              <Label>類別</Label>
              <Select value={category} onValueChange={onCategoryChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>總欠款金額 *</Label>
              <Input
                type="number"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>分幾期</Label>
              <Input
                type="number"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                min={1}
              />
            </div>
            <div>
              <Label>首期月份</Label>
              <Select value={firstMonthOffset} onValueChange={setFirstMonthOffset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">本月</SelectItem>
                  <SelectItem value="1">下月</SelectItem>
                  <SelectItem value="2">下下月</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>每月滯納金率（%，推估用）</Label>
              <Input
                type="number"
                value={lateRate}
                onChange={(e) => setLateRate(e.target.value)}
                step="0.1"
              />
            </div>
          </div>
          <div>
            <Label>備註</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {/* 推估摘要 */}
          {totalNum > 0 && plan.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="border rounded-lg p-2 text-center">
                <div className="text-xs text-muted-foreground">每期約</div>
                <div className="font-bold text-indigo-600">{fmt(perAmount)}</div>
              </div>
              <div className="border rounded-lg p-2 text-center">
                <div className="text-xs text-muted-foreground">分期期數</div>
                <div className="font-bold">{n} 期</div>
              </div>
              {dragLoss > 0 && (
                <div className="border border-red-200 bg-red-50 rounded-lg p-2 text-center">
                  <div className="text-xs text-red-600 flex items-center justify-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    繼續拖估損失
                  </div>
                  <div className="font-bold text-red-600">{fmt(dragLoss)}</div>
                </div>
              )}
            </div>
          )}

          <Button onClick={submit} disabled={createMut.isPending} className="w-full">
            {createMut.isPending ? (
              "建立中…"
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" /> 建立 {plan.length || ""} 期分期應付款
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 分期預覽 */}
      {plan.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" /> 分期預覽（{n} 期）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>期數</TableHead>
                    <TableHead>月份</TableHead>
                    <TableHead>到期日</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.map((r) => (
                    <TableRow key={r.period}>
                      <TableCell>第 {r.period} 期</TableCell>
                      <TableCell>{r.monthLabel}</TableCell>
                      <TableCell>{r.dueDate}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(r.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
