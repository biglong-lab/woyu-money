/**
 * 沙盤推演（/scenario-simulator）— Phase 3
 *
 * 結合：
 *  - 季節性預測（基準收入）
 *  - 週期性支出模板（基準支出）
 *  - 使用者調整參數
 *
 * 模型：
 *  - 行銷預算彈性：marketingMultiplier = 1 + marketingDelta% × elasticity (預設 0.3)
 *  - 漲價彈性：priceMultiplier 直接乘收入
 *  - 固定支出模板：可個別停用 / 改金額
 *  - 收入調整：百分比 ± 直接套
 *
 * 純前端計算、不需新 API
 */
import { useState, useMemo, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart3,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  BookmarkPlus,
  Trash2,
  FolderOpen,
} from "lucide-react"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useToast } from "@/hooks/use-toast"
import { BackToTop } from "@/components/back-to-top"

interface SavedScenario {
  id: string
  name: string
  createdAt: string
  params: {
    marketingDelta: number
    priceDelta: number
    otaShiftDelta: number
    revenueAdjust: number
    marketingElasticity: number
    tplOverrides: Record<number, { active: boolean; amount: number }>
  }
}

const STORAGE_KEY = "scenario-simulator:saved-scenarios"

function loadScenarios(): SavedScenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveScenarios(list: SavedScenario[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // localStorage 滿了 / 隱私模式 — 靜默失敗
  }
}

interface SeasonalForecast {
  targetMonth: string
  pointEstimate: number
  ci80: { lower: number; upper: number }
  confidence: string
  sampleSize: number
  daysElapsed: number
}

interface Template {
  id: number
  templateName: string
  estimatedAmount: string
  isActive: boolean
  projectId: number | null
}

function monthOptions(): string[] {
  const now = new Date()
  return [-1, 0, 1, 2].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    return d.toISOString().slice(0, 7)
  })
}

const formatMoney = (v: number) =>
  v >= 0 ? "$" + Math.round(v).toLocaleString() : "-$" + Math.round(-v).toLocaleString()

export default function ScenarioSimulatorPage() {
  useDocumentTitle("沙盤推演")
  const { toast } = useToast()

  const [targetMonth, setTargetMonth] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1) // 預設下個月
    return d.toISOString().slice(0, 7)
  })

  // 場景儲存（localStorage）
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => loadScenarios())
  const [newScenarioName, setNewScenarioName] = useState("")

  // 模擬參數
  const [marketingDelta, setMarketingDelta] = useState(0) // -50 ~ +100 %
  const [priceDelta, setPriceDelta] = useState(0) // -20 ~ +30 %
  const [otaShiftDelta, setOtaShiftDelta] = useState(0) // OTA 佔比變化（每 +10% → 因抽成 -2% 收入）
  const [revenueAdjust, setRevenueAdjust] = useState(0) // 收入直接調整 %
  const [marketingElasticity, setMarketingElasticity] = useState(0.3)

  // 各模板的「模擬狀態」（暫停 + 調金額）
  const [tplOverrides, setTplOverrides] = useState<
    Record<number, { active: boolean; amount: number }>
  >({})

  // 基準收入：季節性預測
  const { data: seasonal } = useQuery<SeasonalForecast>({
    queryKey: [`/api/forecast/seasonal?targetMonth=${targetMonth}&companyId=null`],
  })

  // 基準支出：週期性支出模板
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/recurring-expense-templates"],
  })

  // 初始化 tplOverrides
  useMemo(() => {
    const init: Record<number, { active: boolean; amount: number }> = {}
    for (const t of templates) {
      if (!(t.id in tplOverrides)) {
        init[t.id] = { active: t.isActive, amount: parseFloat(t.estimatedAmount) }
      }
    }
    if (Object.keys(init).length > 0) {
      setTplOverrides((prev) => ({ ...init, ...prev }))
    }
  }, [templates])

  const baseline = useMemo(() => {
    const baseRev = seasonal?.pointEstimate ?? 0
    const baseExp = templates
      .filter((t) => t.isActive)
      .reduce((sum, t) => sum + parseFloat(t.estimatedAmount), 0)
    return {
      revenue: baseRev,
      expense: baseExp,
      profit: baseRev - baseExp,
      marginPct: baseRev > 0 ? ((baseRev - baseExp) / baseRev) * 100 : 0,
    }
  }, [seasonal, templates])

  const simulated = useMemo(() => {
    if (!seasonal) return null

    // 收入模擬
    const marketingMul = 1 + (marketingDelta / 100) * marketingElasticity
    const priceMul = 1 + priceDelta / 100
    // OTA 抽成假設平均 12%、直訂 0%
    // OTA 佔比 +10% → 加權成本 +1.2% → 收入淨額 -1.2%
    const otaMul = 1 - (otaShiftDelta / 100) * 0.12
    const adjustMul = 1 + revenueAdjust / 100

    const simRevenue = baseline.revenue * marketingMul * priceMul * otaMul * adjustMul

    // 支出：原本固定支出 + 調整 + 行銷增量
    // 行銷預算本身就是支出的一部分，這裡簡化：直接從模板中標記為「行銷」的調整
    // 否則先用「行銷彈性增加的成本佔基準收入 X%」假設行銷預算原本 = 3% revenue
    const baseMarketingBudget = baseline.revenue * 0.03
    const newMarketingBudget = baseMarketingBudget * (1 + marketingDelta / 100)
    const extraMarketing = newMarketingBudget - baseMarketingBudget

    const simExpense =
      templates.reduce((sum, t) => {
        const o = tplOverrides[t.id]
        if (o) {
          if (!o.active) return sum
          return sum + o.amount
        }
        return t.isActive ? sum + parseFloat(t.estimatedAmount) : sum
      }, 0) + extraMarketing

    return {
      revenue: simRevenue,
      expense: simExpense,
      profit: simRevenue - simExpense,
      marginPct: simRevenue > 0 ? ((simRevenue - simExpense) / simRevenue) * 100 : 0,
      extraMarketing,
    }
  }, [
    seasonal,
    templates,
    baseline,
    marketingDelta,
    priceDelta,
    otaShiftDelta,
    revenueAdjust,
    marketingElasticity,
    tplOverrides,
  ])

  const reset = () => {
    setMarketingDelta(0)
    setPriceDelta(0)
    setOtaShiftDelta(0)
    setRevenueAdjust(0)
    setMarketingElasticity(0.3)
    const init: Record<number, { active: boolean; amount: number }> = {}
    for (const t of templates) {
      init[t.id] = { active: t.isActive, amount: parseFloat(t.estimatedAmount) }
    }
    setTplOverrides(init)
  }

  const handleSaveScenario = () => {
    const name = newScenarioName.trim()
    if (!name) {
      toast({ title: "請先輸入場景名稱", variant: "destructive" })
      return
    }
    if (savedScenarios.length >= 20) {
      toast({
        title: "已達上限",
        description: "最多儲存 20 個場景、請先刪除不用的",
        variant: "destructive",
      })
      return
    }
    const dup = savedScenarios.find((s) => s.name === name)
    if (dup && !confirm(`已存在同名場景「${name}」、要覆蓋嗎？`)) return

    const next: SavedScenario = {
      id: dup?.id ?? `s_${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      params: {
        marketingDelta,
        priceDelta,
        otaShiftDelta,
        revenueAdjust,
        marketingElasticity,
        tplOverrides,
      },
    }
    const list = dup
      ? savedScenarios.map((s) => (s.id === dup.id ? next : s))
      : [...savedScenarios, next]
    setSavedScenarios(list)
    saveScenarios(list)
    setNewScenarioName("")
    toast({ title: "✅ 已儲存場景", description: name })
  }

  const handleLoadScenario = (s: SavedScenario) => {
    setMarketingDelta(s.params.marketingDelta)
    setPriceDelta(s.params.priceDelta)
    setOtaShiftDelta(s.params.otaShiftDelta)
    setRevenueAdjust(s.params.revenueAdjust)
    setMarketingElasticity(s.params.marketingElasticity)
    setTplOverrides(s.params.tplOverrides)
    toast({ title: "已套用場景", description: s.name })
  }

  const handleDeleteScenario = (id: string) => {
    const target = savedScenarios.find((s) => s.id === id)
    if (!target) return
    if (!confirm(`確定刪除「${target.name}」？`)) return
    const list = savedScenarios.filter((s) => s.id !== id)
    setSavedScenarios(list)
    saveScenarios(list)
  }

  const diff = simulated
    ? {
        revenue: simulated.revenue - baseline.revenue,
        expense: simulated.expense - baseline.expense,
        profit: simulated.profit - baseline.profit,
      }
    : null

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-600" />
            沙盤推演
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            調整行銷、訂價、固定支出，即時看到對下月收支的影響
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            重置
          </Button>
        </div>
      </div>

      {/* 目標月選擇 */}
      <Card>
        <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-xs text-gray-500 mb-1">模擬目標月</div>
            <Select value={targetMonth} onValueChange={setTargetMonth}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions().map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {seasonal && (
            <div className="flex-1 text-sm text-gray-600 flex flex-col">
              <span>
                基準收入採用 <strong>季節性預測</strong>（sample {seasonal.sampleSize}、信心{" "}
                {seasonal.confidence}）
              </span>
              <span className="text-xs text-gray-500">
                若信心 = insufficient，預測退化為線性推估，模擬僅供參考
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 常用場景儲存區 */}
      <Card>
        <CardContent className="py-3 px-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <FolderOpen className="h-4 w-4 text-violet-600" />
            常用場景
            <Badge variant="outline" className="ml-1 text-xs">
              {savedScenarios.length} / 20
            </Badge>
          </div>

          {/* 已存場景列表 */}
          {savedScenarios.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {savedScenarios.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-1 bg-violet-50 border border-violet-200 rounded-md px-2 py-1"
                >
                  <button
                    type="button"
                    onClick={() => handleLoadScenario(s)}
                    title={`套用：${s.name}\n建立於 ${s.createdAt.slice(0, 10)}`}
                    className="text-sm text-violet-900 hover:text-violet-700 font-medium"
                  >
                    {s.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteScenario(s.id)}
                    title="刪除"
                    className="text-violet-400 hover:text-red-600 transition"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400">尚無儲存的場景。調好參數後在下方命名儲存</div>
          )}

          {/* 新增 */}
          <div className="flex gap-2 items-center flex-wrap">
            <Input
              type="text"
              placeholder="場景名稱（例：下月行銷+20%）"
              value={newScenarioName}
              onChange={(e) => setNewScenarioName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveScenario()
              }}
              maxLength={30}
              className="h-8 text-sm flex-1 min-w-[180px]"
            />
            <Button size="sm" onClick={handleSaveScenario}>
              <BookmarkPlus className="h-4 w-4 mr-1" />
              儲存當前
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 對比卡 — 基準 vs 模擬 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard
          label="收入"
          baseline={baseline.revenue}
          simulated={simulated?.revenue}
          diff={diff?.revenue}
          accent="green"
        />
        <SummaryCard
          label="支出"
          baseline={baseline.expense}
          simulated={simulated?.expense}
          diff={diff?.expense}
          accent="red"
          invertColor
        />
        <SummaryCard
          label="淨利"
          baseline={baseline.profit}
          simulated={simulated?.profit}
          diff={diff?.profit}
          accent="blue"
          highlight
        />
      </div>

      {simulated && (
        <Card className="border-violet-200 bg-violet-50">
          <CardContent className="py-3 px-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              <div>
                <div className="text-xs text-violet-700">模擬後利潤率</div>
                <div className="text-xl font-bold text-violet-900">
                  {simulated.marginPct.toFixed(1)}%
                  <span className="text-sm font-normal text-violet-600 ml-2">
                    （基準 {baseline.marginPct.toFixed(1)}%）
                  </span>
                </div>
              </div>
            </div>
            {Math.abs(simulated.marginPct - baseline.marginPct) > 5 && (
              <Badge
                className={
                  simulated.marginPct > baseline.marginPct
                    ? "bg-green-100 text-green-800 ml-auto"
                    : "bg-red-100 text-red-800 ml-auto"
                }
              >
                {simulated.marginPct > baseline.marginPct ? "明顯改善" : "明顯惡化"}{" "}
                {(simulated.marginPct - baseline.marginPct).toFixed(1)} pp
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* 收入參數 */}
      <Card>
        <CardContent className="py-4 px-4 space-y-5">
          <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            收入參數
          </div>

          <SliderRow
            label="行銷預算調整"
            value={marketingDelta}
            onChange={setMarketingDelta}
            min={-50}
            max={100}
            step={5}
            unit="%"
            hint={`彈性係數 ${marketingElasticity}（每 +10% 行銷 → 收入 +${(marketingElasticity * 10).toFixed(1)}%）`}
          />
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              <span>彈性係數：</span>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={marketingElasticity}
                onChange={(e) => setMarketingElasticity(parseFloat(e.target.value) || 0)}
                className="w-20 h-7 text-xs"
              />
              <span className="text-gray-400">（拖滑桿選業界範圍）</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { v: 0.1, label: "0.1 保守", desc: "成熟品牌 / 行銷已飽和" },
                { v: 0.3, label: "0.3 中性", desc: "業界平均（旅宿業）" },
                { v: 0.5, label: "0.5 積極", desc: "新品牌 / 行銷強敏感" },
                { v: 0.8, label: "0.8 激進", desc: "罕見 / 新興市場" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setMarketingElasticity(opt.v)}
                  className={`text-xs px-2 py-1 rounded border transition ${
                    Math.abs(marketingElasticity - opt.v) < 0.01
                      ? "bg-blue-100 border-blue-400 text-blue-900"
                      : "bg-white border-gray-300 hover:border-blue-300"
                  }`}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400">
              💡 行銷預算 +10% → 收入 +{(marketingElasticity * 10).toFixed(1)}%（依目前係數）
            </div>
          </div>

          <SliderRow
            label="訂價調整"
            value={priceDelta}
            onChange={setPriceDelta}
            min={-20}
            max={30}
            step={1}
            unit="%"
            hint="假設不影響占房率（簡化模型；實際漲價會降低需求）"
          />

          <SliderRow
            label="OTA 渠道佔比變化"
            value={otaShiftDelta}
            onChange={setOtaShiftDelta}
            min={-50}
            max={50}
            step={5}
            unit="%"
            hint="OTA 抽成 12%、直訂 0%。+ 表示更多 OTA、收入淨額會減少"
          />

          <SliderRow
            label="收入直接調整（其他因素）"
            value={revenueAdjust}
            onChange={setRevenueAdjust}
            min={-30}
            max={30}
            step={1}
            unit="%"
            hint="意外事件：旅遊熱潮 +、災害事件 -"
          />
        </CardContent>
      </Card>

      {/* 支出參數 */}
      <Card>
        <CardContent className="py-4 px-4">
          <div className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4 text-red-600" />
            支出參數（個別調整每個模板）
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-400">
              尚未建立任何模板。先到「週期性支出模板」建立基準支出，再回來推演
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => {
                const o = tplOverrides[t.id] ?? {
                  active: t.isActive,
                  amount: parseFloat(t.estimatedAmount),
                }
                const origAmount = parseFloat(t.estimatedAmount)
                const changed = !o.active || o.amount !== origAmount
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 py-2 px-3 rounded border flex-wrap ${
                      changed ? "border-violet-300 bg-violet-50" : "border-gray-200"
                    }`}
                  >
                    <Switch
                      checked={o.active}
                      onCheckedChange={(v) =>
                        setTplOverrides({ ...tplOverrides, [t.id]: { ...o, active: v } })
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.templateName}</div>
                      <div className="text-xs text-gray-500">原 ${origAmount.toLocaleString()}</div>
                    </div>
                    <Input
                      type="number"
                      value={o.amount}
                      onChange={(e) =>
                        setTplOverrides({
                          ...tplOverrides,
                          [t.id]: { ...o, amount: parseFloat(e.target.value) || 0 },
                        })
                      }
                      disabled={!o.active}
                      className="w-28 h-8 text-sm"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <BackToTop />

      {/* 警示 */}
      {simulated && simulated.profit < 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-3 px-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-red-900">⚠️ 模擬結果為虧損</div>
              <div className="text-red-700 mt-1">
                模擬月份淨利 {formatMoney(simulated.profit)}。建議調整：
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>暫停非關鍵的固定支出（看支出清單關閉開關）</li>
                  <li>提高行銷預算測試是否能推高收入</li>
                  <li>考慮直訂渠道（降低 OTA 抽成）</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  baseline,
  simulated,
  diff,
  accent,
  invertColor,
  highlight,
}: {
  label: string
  baseline: number
  simulated?: number
  diff?: number
  accent: "green" | "red" | "blue"
  invertColor?: boolean
  highlight?: boolean
}) {
  const bgColor = {
    green: "border-green-200 bg-green-50",
    red: "border-red-200 bg-red-50",
    blue: "border-blue-200 bg-blue-50",
  }[accent]

  // 對「支出」來說、增加是壞事，要紅色
  const isPositive = (diff ?? 0) > 0
  const diffColor = invertColor
    ? isPositive
      ? "text-red-700"
      : "text-green-700"
    : isPositive
      ? "text-green-700"
      : "text-red-700"

  return (
    <Card className={`${bgColor} ${highlight ? "border-2" : ""}`}>
      <CardContent className="py-3 px-4">
        <div className="text-xs text-gray-600 mb-1">{label}</div>
        <div className="text-xs text-gray-500">基準</div>
        <div className="text-lg font-semibold text-gray-800">{formatMoney(baseline)}</div>
        <div className="text-xs text-gray-500 mt-2">模擬後</div>
        <div className="text-2xl font-bold">
          {simulated !== undefined ? formatMoney(simulated) : "—"}
        </div>
        {diff !== undefined && Math.abs(diff) > 0.5 && (
          <div className={`text-sm font-medium mt-1 ${diffColor}`}>
            {diff > 0 ? "+" : ""}
            {formatMoney(diff)}{" "}
            <span className="text-xs">
              ({baseline > 0 ? ((diff / baseline) * 100).toFixed(1) : "—"}%)
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  unit?: string
  hint?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="text-sm">{label}</div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-20 h-7 text-sm text-right"
          />
          {unit && <span className="text-sm text-gray-500">{unit}</span>}
        </div>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={min}
        max={max}
        step={step}
      />
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  )
}
