/**
 * 財務健康度明細抽屜（PR-6）
 *
 * 從首頁 4 張卡（未付總額/逾期筆數/已產生滯納金/年度損失）點擊開啟，
 * 顯示對應「為什麼這麼多」的明細，避免使用者只看到大數字找不到答案。
 */

import { useMemo, useState } from "react"
import { Link } from "wouter"
import { useMutation } from "@tanstack/react-query"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ArrowRight,
  Copy,
  ExternalLink,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Sparkles,
  Wallet,
  Trash2,
  X,
} from "lucide-react"
import { formatNT } from "@/lib/utils"
import { useCopyAmount } from "@/hooks/use-copy-amount"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { FinancialItemRow } from "./financial-item-row"

type UrgencyLevel = "critical" | "high" | "medium" | "low"

interface PriorityResult {
  id: number
  itemName: string
  unpaidAmount: number
  urgency: UrgencyLevel
  daysOverdue: number
  daysUntilDue: number
  lateFeeEstimate: number
  dailyLateFee?: number
  dueDate: string
  projectName?: string
  categoryLabel?: string
}

export interface PriorityReport {
  totalUnpaid: number
  counts: Record<UrgencyLevel, number>
  all: PriorityResult[]
}

export interface AnnualLossItem {
  itemId: number
  itemName: string
  dueDate: string
  paymentDate?: string
  daysOverdue: number
  amount: number
  lateFee: number
}

export interface AnnualLossReport {
  year: number
  itemCount: number
  totalPrincipal: number
  totalLateFee: number
  lossPercentage: number
  items: AnnualLossItem[]
}

export type DetailMode = "unpaid" | "overdue" | "lateFee" | "annual"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: DetailMode
  priority: PriorityReport | undefined
  annual: AnnualLossReport | undefined
}

const TITLES: Record<DetailMode, { title: string; desc: string }> = {
  unpaid: {
    title: "應付總額明細",
    desc: "已逾期 + 14 天內到期（不含未來未發生）",
  },
  overdue: { title: "逾期項目清單", desc: "已過期未付款，請優先處理" },
  lateFee: { title: "已產生滯納金", desc: "目前累計的滯納金損失（每日增加）" },
  annual: { title: "年度損失分析", desc: "今年因延遲付款累計的滯納金" },
}

export function FinancialDetailSheet({ open, onOpenChange, mode, priority, annual }: Props) {
  const { title, desc } = TITLES[mode]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b sticky top-0 bg-white z-10">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{desc}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 px-4 py-3">
          {mode === "unpaid" && <UnpaidView priority={priority} />}
          {mode === "overdue" && <OverdueView priority={priority} />}
          {mode === "lateFee" && <LateFeeView priority={priority} />}
          {mode === "annual" && <AnnualView annual={annual} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─────────────────────────────────────────────
// 未付總額視圖
// ─────────────────────────────────────────────

function UnpaidView({ priority }: { priority: PriorityReport | undefined }) {
  const { toast } = useToast()
  const copyAmount = useCopyAmount()
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchPaidOpen, setBatchPaidOpen] = useState(false)
  const [smartCleanOpen, setSmartCleanOpen] = useState(false)

  const handleSelectChange = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  // 批量標記已付清
  const batchPaidMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      // 為每個 id 建立一筆 payment_record（金額 = 該項目剩餘未付）
      // 用 sequential 處理避免單次失敗影響全部
      const errors: string[] = []
      for (const id of ids) {
        const item = priority?.all.find((r) => r.id === id)
        if (!item) continue
        try {
          await apiRequest("POST", `/api/payment/items/${id}/payments`, {
            amountPaid: item.unpaidAmount,
            paymentDate: new Date().toISOString().slice(0, 10),
            notes: "批量記為已付清",
          })
        } catch (e) {
          errors.push(`${item.itemName}: ${(e as Error).message}`)
        }
      }
      return errors
    },
    onSuccess: (errors) => {
      void queryClient.invalidateQueries({
        queryKey: ["/api/payment/priority-report?includeLow=false"],
      })
      void queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
      if (errors.length === 0) {
        toast({ title: `已記為已付清 ${selectedIds.size} 筆` })
      } else {
        toast({
          title: `部分成功（${selectedIds.size - errors.length}/${selectedIds.size}）`,
          description: errors.slice(0, 3).join("\n"),
          variant: "destructive",
        })
      }
      exitSelectMode()
      setBatchPaidOpen(false)
    },
  })

  // 重複智能清理：每組保留 id 最小（早期建立、語意豐富）
  const smartCleanMutation = useMutation({
    mutationFn: async (idsToDelete: number[]) => {
      const errors: string[] = []
      for (const id of idsToDelete) {
        try {
          await apiRequest("DELETE", `/api/payment/items/${id}`)
        } catch (e) {
          errors.push(`#${id}: ${(e as Error).message}`)
        }
      }
      return errors
    },
    onSuccess: (errors) => {
      void queryClient.invalidateQueries({
        queryKey: ["/api/payment/priority-report?includeLow=false"],
      })
      void queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
      if (errors.length === 0) {
        toast({ title: "重複清理完成" })
      } else {
        toast({
          title: "部分失敗",
          description: errors.slice(0, 3).join("\n"),
          variant: "destructive",
        })
      }
      setSmartCleanOpen(false)
    },
  })

  // 按專案分組
  const byProject = useMemo(() => {
    if (!priority) return []
    const map = new Map<string, { total: number; count: number; items: PriorityResult[] }>()
    for (const r of priority.all) {
      const key = r.projectName ?? "（未指定專案）"
      const g = map.get(key) ?? { total: 0, count: 0, items: [] }
      g.total += r.unpaidAmount
      g.count += 1
      g.items.push(r)
      map.set(key, g)
    }
    return Array.from(map.entries())
      .map(([name, g]) => ({ name, ...g }))
      .sort((a, b) => b.total - a.total)
  }, [priority])

  // Top 10 最大金額
  const top10 = useMemo(() => {
    if (!priority) return []
    return [...priority.all].sort((a, b) => b.unpaidAmount - a.unpaidAmount).slice(0, 10)
  }, [priority])

  // 偵測疑似重複：同專案 + 同年月 + 同金額（典型重複建立的特徵）
  const duplicateGroups = useMemo(() => {
    if (!priority) return [] as { key: string; items: PriorityResult[] }[]
    const map = new Map<string, PriorityResult[]>()
    for (const r of priority.all) {
      if (!r.projectName) continue
      const yearMonth = r.dueDate?.slice(0, 7) ?? ""
      if (!yearMonth) continue
      const key = `${r.projectName}|${yearMonth}|${r.unpaidAmount}`
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }
    return Array.from(map.entries())
      .filter(([, arr]) => arr.length > 1)
      .map(([key, arr]) => ({ key, items: arr.sort((a, b) => a.dueDate.localeCompare(b.dueDate)) }))
  }, [priority])

  // 把疑似重複的 id 集合化方便 ItemRow 查詢
  const duplicateIds = useMemo(() => {
    const set = new Set<number>()
    for (const g of duplicateGroups) {
      for (const r of g.items) set.add(r.id)
    }
    return set
  }, [duplicateGroups])

  if (!priority) return <Skeleton />
  if (priority.all.length === 0) return <Empty msg="目前沒有未付款項目 🎉" />

  return (
    <div className="space-y-5">
      {/* 疑似重複警告（同專案 + 同月 + 同金額） */}
      {duplicateGroups.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-amber-900">
                發現 {duplicateGroups.length} 組疑似重複項目
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                同專案 + 同月份 + 同金額，可能是重複建立。建議到付款管理頁刪除多餘的。
              </div>
              <div className="mt-2 space-y-1">
                {duplicateGroups.slice(0, 5).map((g) => (
                  <div key={g.key} className="text-xs bg-white/70 rounded p-1.5">
                    <div className="font-medium text-amber-900">
                      {g.items[0].projectName} · {g.items[0].dueDate.slice(0, 7)} ·{" "}
                      {formatNT(g.items[0].unpaidAmount)} × {g.items.length} 筆
                    </div>
                    <div className="text-amber-700 mt-0.5">
                      {g.items.map((r) => `「${r.itemName}」`).join("、")}
                    </div>
                  </div>
                ))}
                {duplicateGroups.length > 5 && (
                  <div className="text-xs text-amber-700 text-center">
                    還有 {duplicateGroups.length - 5} 組…（往下看清單均有 ⚠️ 標記）
                  </div>
                )}
              </div>
              {/* 智能清理按鈕：保留每組 id 最小者（早期建立、語意豐富） */}
              <Button
                size="sm"
                variant="default"
                className="mt-3 bg-amber-600 hover:bg-amber-700"
                onClick={() => setSmartCleanOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                智能清理（保留每組最早建立）
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 批量選取模式切換列 */}
      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant={selectMode ? "default" : "outline"}
          onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
        >
          <CheckSquare className="h-4 w-4 mr-1" />
          {selectMode ? `已選 ${selectedIds.size} 筆` : "批量選取"}
        </Button>
        {selectMode && (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="default"
              disabled={selectedIds.size === 0}
              onClick={() => setBatchPaidOpen(true)}
            >
              <Wallet className="h-3.5 w-3.5 mr-1" />
              批量記為已付清
            </Button>
            <Button size="sm" variant="ghost" onClick={exitSelectMode}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* 總額大數字 */}
      <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-3 border">
        <div className="text-xs text-gray-600">應付總額（14 天內到期 + 已逾期）</div>
        <button
          type="button"
          onClick={() => copyAmount(priority.totalUnpaid, "應付總額")}
          className="mt-1 inline-flex items-center gap-1 text-2xl font-bold text-gray-900 hover:underline"
          title="點擊複製金額"
        >
          {formatNT(priority.totalUnpaid)}
          <Copy className="h-4 w-4 opacity-50" />
        </button>
        <div className="text-xs text-gray-500 mt-1">
          共 {priority.all.length} 筆 · 不含 14 天以上未到期項目
        </div>
      </div>

      {/* 按到期狀態分（更直觀，避免 priority 引擎的 critical/high 混淆） */}
      <Section title="按到期狀態">
        <div className="grid grid-cols-3 gap-2">
          {(() => {
            const overdue = priority.all.filter((r) => r.daysOverdue > 0)
            const thisWeek = priority.all.filter((r) => r.daysOverdue === 0 && r.daysUntilDue <= 7)
            const within2w = priority.all.filter(
              (r) => r.daysOverdue === 0 && r.daysUntilDue > 7 && r.daysUntilDue <= 14
            )
            const groups = [
              { items: overdue, label: "已逾期", cls: "bg-red-50 border-red-200 text-red-800" },
              {
                items: thisWeek,
                label: "7 天內到期",
                cls: "bg-orange-50 border-orange-200 text-orange-800",
              },
              {
                items: within2w,
                label: "8–14 天到期",
                cls: "bg-yellow-50 border-yellow-200 text-yellow-800",
              },
            ]
            return groups.map((g) => {
              const sum = g.items.reduce((s, r) => s + r.unpaidAmount, 0)
              return (
                <div key={g.label} className={`rounded border p-2 text-sm ${g.cls}`}>
                  <div className="text-xs">{g.label}</div>
                  <div className="font-semibold">{formatNT(sum)}</div>
                  <div className="text-xs opacity-80">{g.items.length} 筆</div>
                </div>
              )
            })
          })()}
        </div>
      </Section>

      {/* 按專案 — 可展開看每筆細項 */}
      <Section title={`按專案分組（共 ${byProject.length} 個專案，點擊展開看細項）`}>
        <div className="space-y-1.5">
          {byProject.map((g) => (
            <ProjectGroup
              key={g.name}
              name={g.name}
              total={g.total}
              count={g.count}
              items={g.items}
              totalUnpaid={priority.totalUnpaid}
              duplicateIds={duplicateIds}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onSelectChange={handleSelectChange}
            />
          ))}
        </div>
      </Section>

      {/* Top 10 大筆 */}
      <Section title="最大筆 Top 10">
        <div className="space-y-1.5">
          {top10.map((r) => (
            <FinancialItemRow
              key={r.id}
              item={r}
              showOverdue={true}
              isDuplicate={duplicateIds.has(r.id)}
              selectMode={selectMode}
              selected={selectedIds.has(r.id)}
              onSelectChange={handleSelectChange}
            />
          ))}
        </div>
      </Section>

      {/* 批量已付清確認 */}
      <AlertDialog open={batchPaidOpen} onOpenChange={setBatchPaidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量記為已付清</AlertDialogTitle>
            <AlertDialogDescription>
              將為已選 {selectedIds.size} 筆建立付款記錄，金額 = 該筆剩餘未付。
              <span className="block mt-2 font-semibold text-foreground">
                合計{" "}
                {formatNT(
                  Array.from(selectedIds).reduce(
                    (s, id) => s + (priority.all.find((r) => r.id === id)?.unpaidAmount ?? 0),
                    0
                  )
                )}
              </span>
              <span className="block mt-1 text-amber-700 text-xs">
                此操作不可一鍵還原（要逐筆刪除付款記錄）
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => batchPaidMutation.mutate(Array.from(selectedIds))}
              disabled={batchPaidMutation.isPending}
            >
              {batchPaidMutation.isPending ? "處理中…" : "確認"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 智能清理重複確認 */}
      <AlertDialog open={smartCleanOpen} onOpenChange={setSmartCleanOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>智能清理疑似重複</AlertDialogTitle>
            <AlertDialogDescription>
              將軟刪除每組重複中「id 較大者」（保留 id 最小、較早建立、命名通常較完整的版本）。
              <span className="block mt-2 font-semibold text-foreground">
                總共軟刪除 {duplicateGroups.reduce((s, g) => s + g.items.length - 1, 0)} 筆， 影響{" "}
                {duplicateGroups.length} 組
              </span>
              <span className="block mt-1 text-amber-700 text-xs">若刪錯了可從「回收站」恢復</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // 每組保留 id 最小，刪其他
                const toDelete: number[] = []
                for (const g of duplicateGroups) {
                  const sorted = [...g.items].sort((a, b) => a.id - b.id)
                  for (let i = 1; i < sorted.length; i++) {
                    toDelete.push(sorted[i].id)
                  }
                }
                smartCleanMutation.mutate(toDelete)
              }}
              disabled={smartCleanMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {smartCleanMutation.isPending ? "清理中…" : "確認清理"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CTA */}
      <Link href="/cash-allocation">
        <Button className="w-full" size="lg">
          進入現金分配助理
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────
// 逾期項目視圖
// ─────────────────────────────────────────────

function OverdueView({ priority }: { priority: PriorityReport | undefined }) {
  const overdue = useMemo(() => {
    if (!priority) return []
    return priority.all
      .filter((r) => r.daysOverdue > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
  }, [priority])

  // 偵測疑似重複（同邏輯）
  const duplicateIds = useMemo(() => {
    const set = new Set<number>()
    if (!priority) return set
    const map = new Map<string, PriorityResult[]>()
    for (const r of priority.all) {
      if (!r.projectName || !r.dueDate) continue
      const key = `${r.projectName}|${r.dueDate.slice(0, 7)}|${r.unpaidAmount}`
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }
    map.forEach((arr) => {
      if (arr.length > 1) arr.forEach((r) => set.add(r.id))
    })
    return set
  }, [priority])

  if (!priority) return <Skeleton />
  if (overdue.length === 0) return <Empty msg="沒有逾期項目 ✅" />

  const totalOverdueAmount = overdue.reduce((s, r) => s + r.unpaidAmount, 0)
  const totalLateFee = overdue.reduce((s, r) => s + (r.lateFeeEstimate ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* 摘要 */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="逾期筆數" value={`${overdue.length} 筆`} variant="danger" />
        <Stat label="逾期總額" value={formatNT(totalOverdueAmount)} variant="danger" />
        <Stat label="累計滯納金" value={formatNT(totalLateFee)} variant="warning" />
      </div>

      {/* 列表 — 標記疑似重複 */}
      <Section title={`逾期清單（按逾期天數排序）`}>
        <div className="space-y-1.5">
          {overdue.map((r) => (
            <FinancialItemRow
              key={r.id}
              item={r}
              showOverdue={true}
              isDuplicate={duplicateIds.has(r.id)}
            />
          ))}
        </div>
      </Section>

      <Link href="/cash-allocation">
        <Button className="w-full" size="lg" variant="destructive">
          立刻分配現金處理逾期
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────
// 已產生滯納金視圖
// ─────────────────────────────────────────────

function LateFeeView({ priority }: { priority: PriorityReport | undefined }) {
  const items = useMemo(() => {
    if (!priority) return []
    return priority.all
      .filter((r) => r.lateFeeEstimate > 0)
      .sort((a, b) => b.lateFeeEstimate - a.lateFeeEstimate)
  }, [priority])

  if (!priority) return <Skeleton />
  if (items.length === 0) return <Empty msg="目前無累計滯納金 ✅" />

  const totalLateFee = items.reduce((s, r) => s + r.lateFeeEstimate, 0)

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-xs text-amber-700">已累計滯納金</div>
            <div className="text-2xl font-bold text-amber-800">{formatNT(totalLateFee)}</div>
            <div className="text-xs text-amber-700 mt-1">
              共 {items.length} 筆項目，每天還在增加
            </div>
          </div>
        </div>
      </div>

      <Section title="滯納金來源項目（按金額排序）">
        <div className="space-y-1.5">
          {items.map((r) => (
            <div key={r.id} className="rounded border p-2 bg-white">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{r.itemName}</span>
                <span className="text-sm font-semibold text-amber-700 whitespace-nowrap">
                  +{formatNT(r.lateFeeEstimate)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                <span>{r.projectName ?? "—"}</span>
                <span>逾期 {r.daysOverdue} 天</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Link href="/labor-insurance-watch">
        <Button className="w-full" size="lg" variant="outline">
          看完整滯納金監控
          <ExternalLink className="h-4 w-4 ml-1" />
        </Button>
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────
// 年度損失視圖
// ─────────────────────────────────────────────

function AnnualView({ annual }: { annual: AnnualLossReport | undefined }) {
  // 按月分組（Hook 必須在 early return 之前）
  const byMonth = useMemo(() => {
    if (!annual) return []
    const map = new Map<string, { total: number; count: number }>()
    for (const r of annual.items) {
      const month = r.dueDate.slice(0, 7)
      const g = map.get(month) ?? { total: 0, count: 0 }
      g.total += r.lateFee
      g.count += 1
      map.set(month, g)
    }
    return Array.from(map.entries())
      .map(([month, g]) => ({ month, ...g }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [annual])

  if (!annual) return <Skeleton />
  if (annual.totalLateFee === 0)
    return <Empty msg={`${annual.year} 年度沒有滯納金損失，做得好 ✅`} />

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-red-50 border border-red-200 p-3">
        <div className="text-xs text-red-700">{annual.year} 年度損失</div>
        <div className="text-2xl font-bold text-red-800">{formatNT(annual.totalLateFee)}</div>
        <div className="text-xs text-red-700 mt-1">
          佔本金 {annual.lossPercentage.toFixed(2)}% · 共 {annual.itemCount} 筆遲繳
        </div>
      </div>

      {byMonth.length > 0 && (
        <Section title="按月損失">
          <div className="space-y-1">
            {byMonth.map((m) => (
              <div key={m.month} className="flex items-center justify-between rounded border p-2">
                <span className="text-sm">{m.month}</span>
                <span className="text-sm font-semibold text-red-700">
                  {formatNT(m.total)}
                  <span className="ml-2 text-xs text-gray-500">({m.count} 筆)</span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Link href="/labor-insurance-watch">
        <Button className="w-full" size="lg" variant="outline">
          看完整滯納金監控
          <ExternalLink className="h-4 w-4 ml-1" />
        </Button>
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────
// 子元件
// ─────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-700 mb-1.5">{title}</div>
      {children}
    </div>
  )
}

function Stat({
  label,
  value,
  variant,
}: {
  label: string
  value: string
  variant: "danger" | "warning" | "default"
}) {
  const cls = {
    danger: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    default: "bg-gray-50 border-gray-200 text-gray-800",
  }[variant]
  return (
    <div className={`rounded border p-2 ${cls}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-sm font-bold mt-0.5">{value}</div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 子元件：ProjectGroup（可展開看細項）
// ─────────────────────────────────────────────

function ProjectGroup({
  name,
  total,
  count,
  items,
  totalUnpaid,
  duplicateIds,
  selectMode = false,
  selectedIds,
  onSelectChange,
}: {
  name: string
  total: number
  count: number
  items: PriorityResult[]
  totalUnpaid: number
  duplicateIds?: Set<number>
  selectMode?: boolean
  selectedIds?: Set<number>
  onSelectChange?: (id: number, checked: boolean) => void
}) {
  // 進入選取模式自動展開所有專案，方便批量勾選
  const [expanded, setExpanded] = useState(false)
  const isExpanded = expanded || selectMode
  const pct = (total / totalUnpaid) * 100
  const dupInProject = items.filter((it) => duplicateIds?.has(it.id)).length

  // 預設按金額排序展示
  const sortedItems = [...items].sort((a, b) => b.unpaidAmount - a.unpaidAmount)

  return (
    <div className="rounded border bg-white">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-2 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
            )}
            <span className="text-sm font-medium truncate">{name}</span>
            {dupInProject > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] py-0 h-4 bg-amber-100 text-amber-800 border-amber-300 shrink-0"
              >
                ⚠️ {dupInProject} 筆疑似重複
              </Badge>
            )}
          </div>
          <span className="text-sm font-semibold whitespace-nowrap">{formatNT(total)}</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden ml-5">
          <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="mt-0.5 flex items-center justify-between text-xs text-gray-500 ml-5">
          <span>{count} 筆</span>
          <span>{pct.toFixed(1)}%</span>
        </div>
      </button>
      {isExpanded && (
        <div className="border-t p-2 space-y-1.5 bg-gray-50/50">
          {sortedItems.map((it) => (
            <FinancialItemRow
              key={it.id}
              item={it}
              showOverdue={true}
              isDuplicate={duplicateIds?.has(it.id) ?? false}
              selectMode={selectMode}
              selected={selectedIds?.has(it.id) ?? false}
              onSelectChange={onSelectChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ItemRow 已抽離至 financial-item-row.tsx（PR-7：含立即付款/編輯/軟刪除動作）

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-20 bg-gray-200 rounded" />
      <div className="h-32 bg-gray-200 rounded" />
      <div className="h-32 bg-gray-200 rounded" />
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-center py-12 text-sm text-gray-500">{msg}</div>
}
