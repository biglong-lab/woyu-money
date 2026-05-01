/**
 * 財務明細列（PR-7：行動層強化）
 *
 * 用於 FinancialDetailSheet 內每一筆未付項目的呈現 + 操作。
 *
 * 功能：
 *   - 顯示：itemName / projectName / dueDate / 金額 / 滯納金 / 重複/逾期 badge
 *   - 點擊金額複製
 *   - 點擊 row 展開動作區（💰立即付款 / ✏️編輯 / 🗑️軟刪除）
 *   - 內建編輯對話框（改 itemName/totalAmount/dueDate）
 *   - 內建軟刪除確認對話框
 */

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Copy, Wallet, Edit, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { formatNT } from "@/lib/utils"
import { useCopyAmount } from "@/hooks/use-copy-amount"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"

export interface FinancialItem {
  id: number
  itemName: string
  unpaidAmount: number
  daysOverdue: number
  daysUntilDue: number
  lateFeeEstimate: number
  dailyLateFee?: number
  dueDate: string
  projectName?: string
  categoryLabel?: string
}

interface Props {
  item: FinancialItem
  showOverdue: boolean
  isDuplicate?: boolean
  /** 批量選取模式 */
  selectMode?: boolean
  selected?: boolean
  onSelectChange?: (id: number, checked: boolean) => void
}

export function FinancialItemRow({
  item,
  showOverdue,
  isDuplicate = false,
  selectMode = false,
  selected = false,
  onSelectChange,
}: Props) {
  const copyAmount = useCopyAmount()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // 軟刪除
  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/payment/items/${item.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["/api/payment/priority-report?includeLow=false"],
      })
      void queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
      toast({ title: "已軟刪除", description: item.itemName })
      setDeleteOpen(false)
    },
    onError: (e: Error) => {
      toast({ title: "刪除失敗", description: e.message, variant: "destructive" })
    },
  })

  const triggerQuickPayment = () => {
    // 派送事件給 App.tsx 開 QuickPaymentDialog
    window.dispatchEvent(
      new CustomEvent("open-quick-payment", {
        detail: { itemId: item.id, itemName: item.itemName, amount: item.unpaidAmount },
      })
    )
  }

  return (
    <>
      <div
        className={`rounded border ${
          isDuplicate ? "bg-amber-50 border-amber-300" : "bg-white"
        } ${selected ? "ring-2 ring-blue-400" : ""}`}
      >
        <div className="p-2">
          <div className="flex items-start justify-between gap-2">
            {/* 選取模式 checkbox */}
            {selectMode && (
              <Checkbox
                checked={selected}
                onCheckedChange={(c) => onSelectChange?.(item.id, c === true)}
                className="mt-0.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
            )}

            <button
              type="button"
              onClick={() => !selectMode && setExpanded(!expanded)}
              className="flex-1 min-w-0 text-left"
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                {isDuplicate && (
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 h-4 bg-amber-100 text-amber-800 border-amber-300 shrink-0"
                  >
                    ⚠️ 疑似重複
                  </Badge>
                )}
                <span className="text-sm font-medium truncate">{item.itemName}</span>
                {item.categoryLabel && (
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 h-4 bg-gray-50 text-gray-700 shrink-0"
                  >
                    {item.categoryLabel}
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
                <span className="truncate">{item.projectName ?? "—"}</span>
                <span>·</span>
                <span className="whitespace-nowrap">{item.dueDate}</span>
                {showOverdue && item.daysOverdue > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 h-4 bg-red-100 text-red-800 border-red-200"
                  >
                    逾期 {item.daysOverdue} 天
                  </Badge>
                )}
                {showOverdue && item.daysOverdue === 0 && item.daysUntilDue >= 0 && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] py-0 h-4 ${
                      item.daysUntilDue <= 3
                        ? "bg-orange-100 text-orange-800 border-orange-200"
                        : item.daysUntilDue <= 7
                          ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                          : "bg-blue-100 text-blue-800 border-blue-200"
                    }`}
                  >
                    {item.daysUntilDue === 0 ? "今天到期" : `剩 ${item.daysUntilDue} 天`}
                  </Badge>
                )}
              </div>
            </button>

            {/* 金額 + 複製 */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  copyAmount(item.unpaidAmount, item.itemName)
                }}
                className="text-sm font-bold whitespace-nowrap inline-flex items-center gap-1 hover:underline"
                title="點擊複製金額"
              >
                {formatNT(item.unpaidAmount)}
                <Copy className="h-3 w-3 opacity-50" />
              </button>
              {!selectMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded(!expanded)
                  }}
                  className="p-0.5 text-gray-400 hover:text-gray-600"
                  aria-label="展開動作"
                >
                  {expanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* 滯納金/累積率提示 */}
          {(item.lateFeeEstimate > 0 || (item.dailyLateFee ?? 0) > 0) && (
            <div className="mt-1 text-[11px] text-amber-700 flex items-center gap-2 flex-wrap">
              {item.lateFeeEstimate > 0 && (
                <span>已累計滯納金 +{formatNT(item.lateFeeEstimate)}</span>
              )}
              {(item.dailyLateFee ?? 0) > 0 && (
                <span className="text-amber-600">+{formatNT(item.dailyLateFee ?? 0)} / 天</span>
              )}
            </div>
          )}
        </div>

        {/* 動作區（展開） */}
        {expanded && !selectMode && (
          <div className="border-t bg-gray-50 px-2 py-1.5 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs"
              onClick={triggerQuickPayment}
            >
              <Wallet className="h-3 w-3 mr-1" />
              立即付款
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setEditOpen(true)}
            >
              <Edit className="h-3 w-3 mr-1" />
              編輯
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-red-600 hover:bg-red-50"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              軟刪除
            </Button>
          </div>
        )}
      </div>

      {/* 編輯對話框 */}
      <EditItemDialog open={editOpen} onOpenChange={setEditOpen} item={item} />

      {/* 軟刪除確認 */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認軟刪除「{item.itemName}」？</AlertDialogTitle>
            <AlertDialogDescription>
              軟刪除後此項目從應付清單消失，可從「回收站」恢復。
              {item.lateFeeEstimate > 0 && (
                <span className="block mt-1 text-amber-700 text-xs">
                  注意：已累計滯納金 {formatNT(item.lateFeeEstimate)} 也會一併隱藏
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─────────────────────────────────────────────
// 編輯對話框
// ─────────────────────────────────────────────

function EditItemDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  item: FinancialItem
}) {
  const { toast } = useToast()
  const [itemName, setItemName] = useState(item.itemName)
  const [totalAmount, setTotalAmount] = useState(String(item.unpaidAmount))
  const [dueDate, setDueDate] = useState(item.dueDate)

  // 同步 props
  useState(() => {
    setItemName(item.itemName)
    setTotalAmount(String(item.unpaidAmount))
    setDueDate(item.dueDate)
  })

  const updateMutation = useMutation({
    mutationFn: async () =>
      apiRequest("PUT", `/api/payment/items/${item.id}`, {
        itemName,
        totalAmount: Number(totalAmount),
        startDate: dueDate,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["/api/payment/priority-report?includeLow=false"],
      })
      void queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
      toast({ title: "更新成功" })
      onOpenChange(false)
    },
    onError: (e: Error) => {
      toast({ title: "更新失敗", description: e.message, variant: "destructive" })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>編輯項目</DialogTitle>
          <DialogDescription>修改名稱、金額、到期日。其他欄位請到付款管理頁。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">名稱</label>
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">金額</label>
            <Input
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">到期日</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !itemName.trim() || !totalAmount}
          >
            {updateMutation.isPending ? "儲存中…" : "儲存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
