/**
 * 成本結構總覽（/cost-overview）
 *
 * 四大成本來源（租金 / 人事 / 週期模板 / 一般單項）一頁看完。
 * 各區塊可展開明細、點項目跳到原始頁編輯。
 */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Home,
  Users,
  Repeat,
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { BackToTop } from "@/components/back-to-top"
import { formatStatus, isCompletedStatus } from "@/lib/status-labels"

interface RentalItem {
  contractId: number
  contractName: string
  tenantName: string | null
  projectName: string | null
  amount: number
  paymentDay: number
  paid: boolean
  paymentItemId: number | null
  paymentItemStatus: string | null
}

interface HrItem {
  employeeId: number
  employeeName: string | null
  position: string | null
  totalCost: number
  isPaid: boolean
}

interface TemplateGeneratedItem {
  itemId: number
  templateId: number | null
  templateName: string | null
  itemName: string
  estimatedAmount: number
  paidAmount: number
  status: string
  startDate: string
}

interface TemplateNotGenerated {
  templateId: number
  templateName: string
  estimatedAmount: number
  dayOfMonth: number
}

interface ManualItem {
  id: number
  itemName: string
  amount: number
  status: string
  startDate: string
  source: string
  categoryName: string | null
  projectName: string | null
}

interface Alert {
  level: "info" | "warning" | "error"
  type: string
  message: string
}

interface CostStructureData {
  month: string
  year: number
  monthNum: number
  rental: { total: number; actual: number; planned: number; count: number; items: RentalItem[] }
  hr: {
    total: number
    actual: number
    planned: number
    count: number
    unpaidCount: number
    items: HrItem[]
  }
  template: {
    total: number
    actual: number
    planned: number
    count: number
    notGeneratedCount: number
    generatedItems: TemplateGeneratedItem[]
    notGenerated: TemplateNotGenerated[]
  }
  manual: { total: number; actual: number; planned: number; count: number; items: ManualItem[] }
  grandTotal: number
  grandActual: number
  grandPlanned: number
  alerts: Alert[]
}

const formatMoney = (v: number) =>
  v >= 0 ? "$" + Math.round(v).toLocaleString() : "-$" + Math.round(-v).toLocaleString()

function monthOptions(): { value: string; label: string }[] {
  const now = new Date()
  const opts: { value: string; label: string }[] = []
  for (let i = -3; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = i === 0 ? `${v}（本月）` : i < 0 ? v : `${v}（未來）`
    opts.push({ value: v, label })
  }
  return opts
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "手動",
  webhook: "Webhook",
  "pm-bridge": "PM 系統",
  ai_scan: "OCR 辨識",
  document_inbox: "文件歸檔",
}

export default function CostOverviewPage() {
  useDocumentTitle("成本結構總覽")

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    rental: false,
    hr: false,
    template: false,
    manual: false,
  })

  const { data, isLoading } = useQuery<CostStructureData>({
    queryKey: [`/api/dashboard/cost-structure?month=${selectedMonth}`],
  })

  const toggle = (k: string) => setExpanded((s) => ({ ...s, [k]: !s[k] }))

  return (
    <div className="container mx-auto py-4 sm:py-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-600" />
            成本結構總覽
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            一頁看完租金 / 人事 / 週期模板 / 一般單項四大成本來源
          </p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions().map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 警示區 */}
      {data && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((a, i) => (
            <div
              key={i}
              className={`rounded-md px-3 py-2 text-sm flex items-center gap-2 ${
                a.level === "error"
                  ? "bg-red-50 border border-red-200 text-red-800"
                  : a.level === "warning"
                    ? "bg-amber-50 border border-amber-200 text-amber-800"
                    : "bg-blue-50 border border-blue-200 text-blue-800"
              }`}
            >
              {a.level === "error" ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : a.level === "warning" ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <Info className="h-4 w-4 shrink-0" />
              )}
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* 總計卡 */}
      {data && (
        <Card className="border-indigo-200 bg-indigo-50">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-xs text-indigo-700">總成本</div>
                <div className="text-2xl font-bold text-indigo-900">
                  {formatMoney(data.grandTotal)}
                </div>
              </div>
              <div>
                <div className="text-xs text-green-700">已發生（actual）</div>
                <div className="text-xl font-semibold text-green-800">
                  {formatMoney(data.grandActual)}
                </div>
              </div>
              <div>
                <div className="text-xs text-amber-700">預定（planned）</div>
                <div className="text-xl font-semibold text-amber-700">
                  {formatMoney(data.grandPlanned)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4 大區塊卡 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <CostCard
          icon={Home}
          color="rose"
          title="租金"
          total={data?.rental.total ?? 0}
          actual={data?.rental.actual ?? 0}
          planned={data?.rental.planned ?? 0}
          count={data?.rental.count ?? 0}
          subtitle="rental_contracts"
          isLoading={isLoading}
          onClick={() => toggle("rental")}
          expanded={expanded.rental}
        />
        <CostCard
          icon={Users}
          color="purple"
          title="人事"
          total={data?.hr.total ?? 0}
          actual={data?.hr.actual ?? 0}
          planned={data?.hr.planned ?? 0}
          count={data?.hr.count ?? 0}
          subtitle={
            data && data.hr.unpaidCount > 0 ? `${data.hr.unpaidCount} 人未發放` : "monthly_hr_costs"
          }
          isLoading={isLoading}
          onClick={() => toggle("hr")}
          expanded={expanded.hr}
        />
        <CostCard
          icon={Repeat}
          color="blue"
          title="週期模板"
          total={data?.template.total ?? 0}
          actual={data?.template.actual ?? 0}
          planned={data?.template.planned ?? 0}
          count={data?.template.count ?? 0}
          subtitle={
            data && data.template.notGeneratedCount > 0
              ? `${data.template.notGeneratedCount} 個未產出`
              : "recurring_expense_templates"
          }
          isLoading={isLoading}
          onClick={() => toggle("template")}
          expanded={expanded.template}
        />
        <CostCard
          icon={FileText}
          color="gray"
          title="一般單項"
          total={data?.manual.total ?? 0}
          actual={data?.manual.actual ?? 0}
          planned={data?.manual.planned ?? 0}
          count={data?.manual.count ?? 0}
          subtitle="payment_items"
          isLoading={isLoading}
          onClick={() => toggle("manual")}
          expanded={expanded.manual}
        />
      </div>

      {/* 明細展開區 */}
      {data && expanded.rental && (
        <SectionTable
          title="🏠 租金明細"
          link="/rental-matrix"
          linkLabel="到租金矩陣編輯"
          empty={data.rental.items.length === 0 ? "本月無有效租約" : null}
        >
          {data.rental.items.map((r) => (
            <tr key={r.contractId} className="border-b last:border-0 hover:bg-gray-50">
              <td className="px-3 py-2 text-sm">{r.contractName}</td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {r.tenantName ?? "—"}
                {r.projectName ? ` · ${r.projectName}` : ""}
              </td>
              <td className="px-3 py-2 text-xs">每月 {r.paymentDay} 日</td>
              <td className="px-3 py-2 text-sm font-mono">{formatMoney(r.amount)}</td>
              <td className="px-3 py-2 text-xs">
                {r.paymentItemId === null ? (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700">
                    未產出
                  </Badge>
                ) : (
                  <Badge
                    className={
                      isCompletedStatus(r.paymentItemStatus)
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }
                  >
                    {formatStatus(r.paymentItemStatus)}
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </SectionTable>
      )}

      {data && expanded.hr && (
        <SectionTable
          title="👥 人事明細"
          link="/hr-cost-management"
          linkLabel="到人事管理"
          empty={data.hr.items.length === 0 ? `${selectedMonth} 還沒結算人事成本` : null}
        >
          {data.hr.items.map((h) => (
            <tr key={h.employeeId} className="border-b last:border-0 hover:bg-gray-50">
              <td className="px-3 py-2 text-sm">{h.employeeName ?? `員工 #${h.employeeId}`}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{h.position ?? "—"}</td>
              <td className="px-3 py-2 text-sm font-mono">{formatMoney(h.totalCost)}</td>
              <td className="px-3 py-2 text-xs">
                <Badge
                  className={
                    h.isPaid ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                  }
                >
                  {h.isPaid ? "已發放" : "未發放"}
                </Badge>
              </td>
            </tr>
          ))}
        </SectionTable>
      )}

      {data && expanded.template && (
        <>
          <SectionTable
            title={`📋 已產出占位（${data.template.count}）`}
            link="/recurring-expenses"
            linkLabel="到週期模板管理"
            empty={data.template.generatedItems.length === 0 ? "尚無產出占位" : null}
          >
            {data.template.generatedItems.map((g) => (
              <tr key={g.itemId} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-3 py-2 text-sm">
                  {g.itemName}
                  {g.templateName && (
                    <span className="ml-1.5 text-[10px] text-blue-600 bg-blue-50 rounded px-1 py-0.5">
                      模板 #{g.templateId}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">{g.startDate}</td>
                <td className="px-3 py-2 text-sm font-mono">{formatMoney(g.estimatedAmount)}</td>
                <td className="px-3 py-2 text-xs">
                  <Badge
                    className={
                      isCompletedStatus(g.status)
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }
                  >
                    {formatStatus(g.status)}
                  </Badge>
                </td>
              </tr>
            ))}
          </SectionTable>
          {data.template.notGenerated.length > 0 && (
            <SectionTable
              title={`⚠️ 未產出占位（${data.template.notGenerated.length}）`}
              link="/recurring-expenses"
              linkLabel="到週期模板管理產出"
              empty={null}
            >
              {data.template.notGenerated.map((t) => (
                <tr key={t.templateId} className="border-b last:border-0 hover:bg-amber-50">
                  <td className="px-3 py-2 text-sm">{t.templateName}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">每月 {t.dayOfMonth} 日預計</td>
                  <td className="px-3 py-2 text-sm font-mono text-amber-700">
                    {formatMoney(t.estimatedAmount)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <Badge variant="outline" className="bg-amber-50 text-amber-700">
                      待產出
                    </Badge>
                  </td>
                </tr>
              ))}
            </SectionTable>
          )}
        </>
      )}

      {data && expanded.manual && (
        <SectionTable
          title={`📝 一般單項（${data.manual.count}）`}
          link="/payment-project"
          linkLabel="到付款管理"
          empty={data.manual.items.length === 0 ? "本月無一般單項" : null}
        >
          {data.manual.items.slice(0, 50).map((m) => (
            <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="px-3 py-2 text-sm">
                {m.itemName}
                <span className="ml-1.5 text-[10px] text-gray-500 bg-gray-100 rounded px-1 py-0.5">
                  {SOURCE_LABEL[m.source] ?? m.source}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {m.categoryName ?? "未分類"}
                {m.projectName ? ` · ${m.projectName}` : ""}
              </td>
              <td className="px-3 py-2 text-sm font-mono">{formatMoney(m.amount)}</td>
              <td className="px-3 py-2 text-xs">
                <Badge
                  className={
                    isCompletedStatus(m.status)
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }
                >
                  {formatStatus(m.status)}
                </Badge>
              </td>
            </tr>
          ))}
          {data.manual.items.length > 50 && (
            <tr>
              <td colSpan={4} className="px-3 py-2 text-xs text-gray-400 text-center italic">
                只顯示前 50 筆、其餘 {data.manual.items.length - 50} 筆請至付款管理查看
              </td>
            </tr>
          )}
        </SectionTable>
      )}

      <BackToTop />
    </div>
  )
}

function CostCard({
  icon: Icon,
  color,
  title,
  total,
  actual,
  planned,
  count,
  subtitle,
  isLoading,
  onClick,
  expanded,
}: {
  icon: React.ComponentType<{ className?: string }>
  color: "rose" | "purple" | "blue" | "gray"
  title: string
  total: number
  actual: number
  planned: number
  count: number
  subtitle: string
  isLoading: boolean
  onClick: () => void
  expanded: boolean
}) {
  const colorMap = {
    rose: { border: "border-rose-200", bg: "bg-rose-50", text: "text-rose-700" },
    purple: { border: "border-purple-200", bg: "bg-purple-50", text: "text-purple-700" },
    blue: { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700" },
    gray: { border: "border-gray-200", bg: "bg-gray-50", text: "text-gray-700" },
  }
  const c = colorMap[color]
  return (
    <Card
      onClick={onClick}
      className={`${c.border} ${c.bg} cursor-pointer hover:shadow-md transition-shadow`}
    >
      <CardContent className="py-3 px-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className={`text-xs ${c.text} font-medium flex items-center gap-1`}>
            <Icon className="h-3.5 w-3.5" />
            {title}
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <div className="text-xl font-bold">{isLoading ? "—" : formatMoney(total)}</div>
        <div className="text-[10px] text-gray-500 mt-1">
          {isLoading ? "載入中…" : `${count} 筆 · ${subtitle}`}
        </div>
        {!isLoading && (
          <div className="mt-1.5 text-[10px] flex gap-2">
            <span className="text-green-700">實 {formatMoney(actual)}</span>
            <span className="text-amber-700">預 {formatMoney(planned)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SectionTable({
  title,
  link,
  linkLabel,
  empty,
  children,
}: {
  title: string
  link: string
  linkLabel: string
  empty: string | null
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="py-3 px-3 sm:px-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">{title}</h3>
          <Link href={link}>
            <Button variant="ghost" size="sm" className="text-xs">
              {linkLabel}
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
        {empty ? (
          <div className="text-sm text-gray-400 py-4 text-center">{empty}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <tbody>{children}</tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
