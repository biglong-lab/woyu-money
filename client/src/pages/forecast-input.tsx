/**
 * 預測資料輸入（/forecast-input）
 *
 * 取代外部 PMS 工具：使用者直接在 Money 系統內輸入「不定期未來預訂金額」。
 * 每次輸入 → 寫進 revenue_forecast_snapshots（source='pms-booking'）。
 * 累積資料後、forecast 引擎自動跑「N 天前累積 vs 月底最終」預測模型。
 *
 * 設計：
 *  - 一次填 6 家館 × 本月/下月/下下月 = 18 個格子
 *  - 自動帶上「上次輸入值」當預設、避免每次從 0 開始
 *  - 點儲存 → 對每個有變動的格子 POST /api/forecast/quick-input
 */
import { useState, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Calendar, Save, TrendingUp, Info, CheckCircle2, RotateCcw } from "lucide-react"
import { useDocumentTitle } from "@/hooks/use-document-title"

const COMPANIES = [
  { id: 1, name: "浯島文旅" },
  { id: 2, name: "浯島輕旅" },
  { id: 3, name: "小六路厝" },
  { id: 4, name: "總兵招待所" },
  { id: 5, name: "魁星背包棧" },
  { id: 6, name: "大號文創" },
]

interface ForecastSnapshot {
  id: number
  snapshotDate: string
  companyId: number | null
  targetMonth: string
  bookedRevenue: string
  source: string
}

function monthOffsets(): { label: string; value: string }[] {
  const now = new Date()
  return [0, 1, 2].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const label = offset === 0 ? "本月" : offset === 1 ? "下月" : "下下月"
    return { label, value: d.toISOString().slice(0, 7) }
  })
}

const formatMoney = (v: number) =>
  v >= 0 ? "$" + Math.round(v).toLocaleString() : "-$" + Math.round(-v).toLocaleString()

export default function ForecastInputPage() {
  useDocumentTitle("預訂金額輸入")
  const { toast } = useToast()

  const today = new Date().toISOString().slice(0, 10)
  const months = monthOffsets()

  // 對每 (companyId, targetMonth) 拉最近一筆 pms-booking snapshot 作為預設值
  const { data: recentSnaps = [] } = useQuery<ForecastSnapshot[]>({
    queryKey: [`/api/forecast/snapshots?source=pms-booking&from=2026-01-01`],
  })

  // 表單狀態：{ "1:2026-05": "350000" }
  const [values, setValues] = useState<Record<string, string>>({})
  const [initialValues, setInitialValues] = useState<Record<string, string>>({})

  // 載入既有最新值（依 companyId × targetMonth 取最新一筆）
  useEffect(() => {
    if (recentSnaps.length === 0) return

    const latest: Record<string, ForecastSnapshot> = {}
    for (const s of recentSnaps) {
      const key = `${s.companyId}:${s.targetMonth}`
      if (!latest[key] || new Date(s.snapshotDate) > new Date(latest[key].snapshotDate)) {
        latest[key] = s
      }
    }

    const initial: Record<string, string> = {}
    for (const c of COMPANIES) {
      for (const m of months) {
        const key = `${c.id}:${m.value}`
        const snap = latest[key]
        initial[key] = snap ? Math.round(parseFloat(snap.bookedRevenue)).toString() : ""
      }
    }
    setValues(initial)
    setInitialValues(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentSnaps.length])

  const setValue = (companyId: number, month: string, val: string) => {
    setValues({ ...values, [`${companyId}:${month}`]: val })
  }

  const isDirty = (companyId: number, month: string) => {
    const key = `${companyId}:${month}`
    return (values[key] ?? "") !== (initialValues[key] ?? "")
  }

  const dirtyCount = Object.keys(values).filter((k) => {
    const [c, m] = k.split(":")
    return isDirty(parseInt(c), m)
  }).length

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const dirtyEntries = Object.entries(values).filter(([key]) => {
        const [c, m] = key.split(":")
        return isDirty(parseInt(c), m)
      })

      const results = await Promise.allSettled(
        dirtyEntries.map(([key, val]) => {
          const [companyId, targetMonth] = key.split(":")
          const num = parseFloat(val)
          return apiRequest("POST", "/api/forecast/quick-input", {
            snapshotDate: today,
            companyId: parseInt(companyId),
            targetMonth,
            bookedRevenue: isNaN(num) ? 0 : num,
          })
        })
      )

      const ok = results.filter((r) => r.status === "fulfilled").length
      const fail = results.length - ok
      return { ok, fail, total: results.length }
    },
    onSuccess: (r) => {
      toast({
        title: r.fail === 0 ? "✅ 全部已存" : "部分失敗",
        description: `成功 ${r.ok} 筆${r.fail > 0 ? `、失敗 ${r.fail}` : ""}（拍快照日 ${today}）`,
        variant: r.fail === 0 ? "default" : "destructive",
      })
      setInitialValues({ ...values }) // 重置 dirty 狀態
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("/api/forecast"),
      })
    },
  })

  const reset = () => {
    setValues({ ...initialValues })
  }

  // 各館合計
  const companyTotal = (companyId: number) =>
    months.reduce((sum, m) => sum + (parseFloat(values[`${companyId}:${m.value}`] ?? "") || 0), 0)

  // 各月合計
  const monthTotal = (month: string) =>
    COMPANIES.reduce((sum, c) => sum + (parseFloat(values[`${c.id}:${month}`] ?? "") || 0), 0)

  // 總合計
  const grandTotal = COMPANIES.reduce((sum, c) => sum + companyTotal(c.id), 0)

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-indigo-600" />
            預訂金額輸入
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            每次更新預訂時填一遍、系統自動拍快照、累積資料訓練預測模型
          </p>
        </div>
        <div className="flex gap-2">
          {dirtyCount > 0 && (
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              還原
            </Button>
          )}
          <Button
            onClick={() => saveAllMutation.mutate()}
            disabled={dirtyCount === 0 || saveAllMutation.isPending}
          >
            <Save className="h-4 w-4 mr-1" />
            儲存{" "}
            {dirtyCount > 0 && (
              <Badge className="ml-1 bg-amber-200 text-amber-900">{dirtyCount}</Badge>
            )}
          </Button>
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="py-3 px-4 flex items-start gap-2 text-sm">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-blue-900">
            <div>
              <strong>使用方式：</strong> 填各館本月 / 下月 /
              下下月「截至今日累積預訂金額」、按儲存。
            </div>
            <div className="text-xs mt-1">
              拍快照日：<strong>{today}</strong> （未改的欄位不會重複拍、每天至少更新 1 次最佳）
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 輸入矩陣 */}
      <Card>
        <CardContent className="py-4 px-3 sm:px-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-2 w-32">館別</th>
                {months.map((m) => (
                  <th key={m.value} className="text-right py-2 px-2 min-w-[140px]">
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-xs text-gray-400 font-normal">{m.value}</div>
                  </th>
                ))}
                <th className="text-right py-2 pl-2 w-32 text-gray-500">小計</th>
              </tr>
            </thead>
            <tbody>
              {COMPANIES.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 pr-2 font-medium">{c.name}</td>
                  {months.map((m) => {
                    const key = `${c.id}:${m.value}`
                    const dirty = isDirty(c.id, m.value)
                    return (
                      <td key={m.value} className="py-2 px-2">
                        <div className="relative">
                          <Input
                            type="number"
                            value={values[key] ?? ""}
                            onChange={(e) => setValue(c.id, m.value, e.target.value)}
                            placeholder="0"
                            className={`text-right ${dirty ? "ring-2 ring-amber-300 bg-amber-50" : ""}`}
                          />
                          {dirty && (
                            <span className="absolute -top-1 -right-1 text-amber-600 text-xs">
                              ●
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                  <td className="py-2 pl-2 text-right font-semibold text-gray-700">
                    {formatMoney(companyTotal(c.id))}
                  </td>
                </tr>
              ))}
              {/* 月合計列 */}
              <tr className="bg-gray-50 font-semibold">
                <td className="py-2 pr-2">月小計</td>
                {months.map((m) => (
                  <td key={m.value} className="py-2 px-2 text-right text-indigo-700">
                    {formatMoney(monthTotal(m.value))}
                  </td>
                ))}
                <td className="py-2 pl-2 text-right text-indigo-900 text-base">
                  {formatMoney(grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 提示 */}
      <Card className="border-gray-200">
        <CardContent className="py-3 px-4 text-xs text-gray-600 space-y-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            金額填入「截至今日為止」該月份的累積預訂金額
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 text-blue-600" />
            建議每天 / 每次有新預訂時更新、累積資料越多預測越準
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-indigo-600" />
            進「收入預測」頁面看模型推估
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
