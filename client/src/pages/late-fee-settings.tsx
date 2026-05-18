/**
 * 滯納金規則設定（/late-fee-settings）
 *
 * 取代過去硬編寫的 CATEGORY_RULES，使用者可自行調整：
 *  - 每類別的每日費率
 *  - 寬限期（dueDate + N 天）
 *  - 是否啟用
 */
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { AlertTriangle, Save, Info, ShieldCheck } from "lucide-react"
import { useDocumentTitle } from "@/hooks/use-document-title"

interface Policy {
  id: number
  categoryKey: string
  label: string
  dailyRate: string
  gracePeriodDays: number
  isEnabled: boolean
  notes: string | null
}

const ICON_BY_KEY: Record<string, string> = {
  labor_insurance: "🏥",
  tax: "🏛️",
  bank_loan: "🏦",
  credit_card: "💳",
  utility: "⚡",
  insurance: "🛡️",
  rental_pay: "🏠",
  vendor: "📦",
  other: "📋",
}

export default function LateFeeSettingsPage() {
  useDocumentTitle("滯納金規則設定")
  const { toast } = useToast()

  const { data: policies = [] } = useQuery<Policy[]>({
    queryKey: ["/api/late-fee-policies"],
  })

  // 本地編輯狀態（暫存改動）
  const [edits, setEdits] = useState<Record<string, Partial<Policy>>>({})

  const updateMutation = useMutation({
    mutationFn: (vars: { categoryKey: string; data: Partial<Policy> }) =>
      apiRequest("PUT", `/api/late-fee-policies/${vars.categoryKey}`, vars.data),
    onSuccess: (_, vars) => {
      toast({ title: "✅ 已儲存", description: `${vars.categoryKey} 規則已更新` })
      setEdits((prev) => {
        const { [vars.categoryKey]: _unused, ...rest } = prev
        return rest
      })
      queryClient.invalidateQueries({ queryKey: ["/api/late-fee-policies"] })
      queryClient.invalidateQueries({ queryKey: ["/api/late-fee-policies/rate-map"] })
    },
    onError: (err: Error) =>
      toast({ title: "失敗", description: err.message, variant: "destructive" }),
  })

  const getValue = (p: Policy, field: keyof Policy) => {
    const edit = edits[p.categoryKey]
    return edit && field in edit ? (edit[field] as any) : (p[field] as any)
  }

  const setValue = (key: string, field: keyof Policy, value: any) => {
    setEdits({ ...edits, [key]: { ...edits[key], [field]: value } })
  }

  const isDirty = (key: string) => key in edits

  const save = (p: Policy) => {
    const edit = edits[p.categoryKey]
    if (!edit) return
    updateMutation.mutate({ categoryKey: p.categoryKey, data: edit })
  }

  const enabledCount = policies.filter((p) => {
    const v = getValue(p, "isEnabled")
    return v
  }).length

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-amber-600" />
          滯納金規則設定
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          設定各類別的每日費率與寬限期。**只有勞健保與稅務有法律強制滯納金**、其他類別預設關閉。
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-900">
            <div className="font-semibold">滯納金計算公式：</div>
            <code className="text-xs bg-white px-1 py-0.5 rounded">
              滯納金 = 未付金額 × 每日費率 × max(0, 今日 − 到期日 − 寬限期)
            </code>
            <div className="mt-1.5 text-xs">
              啟用中：<span className="font-bold">{enabledCount}</span> / {policies.length} 類別
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {policies.map((p) => {
          const rate = parseFloat(getValue(p, "dailyRate") ?? "0")
          const grace = getValue(p, "gracePeriodDays") ?? 0
          const enabled = getValue(p, "isEnabled") ?? false
          const dirty = isDirty(p.categoryKey)

          return (
            <Card
              key={p.categoryKey}
              className={dirty ? "border-amber-300 bg-amber-50/40" : !enabled ? "opacity-60" : ""}
            >
              <CardContent className="py-3 px-3 sm:px-4">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="text-2xl">{ICON_BY_KEY[p.categoryKey] ?? "📋"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold flex items-center gap-2 flex-wrap">
                      {p.label}
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                        {p.categoryKey}
                      </code>
                      {dirty && <Badge className="bg-amber-100 text-amber-800">尚未儲存</Badge>}
                    </div>
                    {p.notes && <div className="text-xs text-gray-500 mt-0.5">{p.notes}</div>}
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => setValue(p.categoryKey, "isEnabled", v)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">每日費率 (%/天)</label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step={0.001}
                        min={0}
                        max={1}
                        value={(rate * 100).toFixed(3)}
                        onChange={(e) =>
                          setValue(
                            p.categoryKey,
                            "dailyRate",
                            (parseFloat(e.target.value) / 100).toString()
                          )
                        }
                        disabled={!enabled}
                        className="h-8"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      月化約 {(rate * 30 * 100).toFixed(1)}% / 年化約{" "}
                      {(rate * 365 * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">寬限期（天）</label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={grace}
                      onChange={(e) =>
                        setValue(p.categoryKey, "gracePeriodDays", parseInt(e.target.value) || 0)
                      }
                      disabled={!enabled}
                      className="h-8"
                    />
                    <div className="text-xs text-gray-400 mt-0.5">
                      到期後 N 天才開始累積（例：勞健保 25 日截止 + 5 天 = 30 日才算逾期）
                    </div>
                  </div>
                  <div className="flex items-end">
                    {dirty && (
                      <Button
                        size="sm"
                        onClick={() => save(p)}
                        disabled={updateMutation.isPending}
                        className="w-full"
                      >
                        <Save className="h-3.5 w-3.5 mr-1" />
                        儲存此項
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {policies.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-400">
            <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
            載入中...（首次使用會自動建立預設規則）
          </CardContent>
        </Card>
      )}
    </div>
  )
}
