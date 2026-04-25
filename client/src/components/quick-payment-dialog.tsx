/**
 * QuickPaymentDialog - 快速付款對話框
 * 3 步驟完成付款：搜尋項目 → 確認金額 → 完成
 */
import { useState, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { localDateISO, friendlyApiError, formatNT } from "@/lib/utils"
import { Search, DollarSign, CheckCircle2, ArrowRight, Loader2 } from "lucide-react"
import { ReceiptUploadButton } from "@/components/receipt-upload-button"

interface QuickPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = "search" | "confirm" | "done"

// 付款項目型別（包含 JOIN 欄位）
interface PaymentItemWithDetails {
  id: number
  itemName: string
  totalAmount: string
  paidAmount: string
  status: string
  isDeleted: boolean
  projectName?: string
  categoryName?: string
  startDate?: string
  endDate?: string | null
}

// API 回應型別
interface PaymentItemsResponse {
  items?: PaymentItemWithDetails[]
}

// 付款表單資料
interface PaymentFormData {
  itemId: number
  amountPaid: string
  paymentDate: string
  paymentMethod: string
  receiptImageUrl?: string | null
}

export function QuickPaymentDialog({ open, onOpenChange }: QuickPaymentDialogProps) {
  const { toast } = useToast()
  const isOnline = useOnlineStatus()
  const [step, setStep] = useState<Step>("search")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedItem, setSelectedItem] = useState<PaymentItemWithDetails | null>(null)
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer")
  const [paymentDate, setPaymentDate] = useState(localDateISO())
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)

  // 查詢所有付款項目（使用 includeAll 取得完整陣列）
  const { data: paymentItemsData, isLoading } = useQuery<
    PaymentItemsResponse | PaymentItemWithDetails[]
  >({
    queryKey: ["/api/payment/items?includeAll=true"],
    enabled: open,
  })

  // 處理 API 回傳格式（可能是陣列或物件）
  const paymentItems = Array.isArray(paymentItemsData)
    ? paymentItemsData
    : paymentItemsData?.items || []

  // 篩選待付款項目
  // 預設只顯示「已逾期 + 30 天內到期」的緊急項目，依 due date 排序
  // 搜尋時則不限日期（讓使用者能找未來項目補登）
  const filteredItems = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const pendingItems = paymentItems.filter((item: PaymentItemWithDetails) => {
      const paid = parseFloat(item.paidAmount || "0")
      const total = parseFloat(item.totalAmount || "0")
      return paid < total && item.status !== "completed" && !item.isDeleted
    })

    // 取 due date（優先 endDate，否則 startDate）
    const getDueDate = (item: PaymentItemWithDetails): Date | null => {
      const dateStr = item.endDate || item.startDate
      if (!dateStr) return null
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return null
      d.setHours(0, 0, 0, 0)
      return d
    }

    // 依 due date 排序（最早到期 = 最上面，逾期最久的優先）
    const sortByDue = (items: PaymentItemWithDetails[]) => {
      return [...items].sort((a, b) => {
        const da = getDueDate(a)
        const db = getDueDate(b)
        if (!da && !db) return 0
        if (!da) return 1 // 無日期排後面
        if (!db) return -1
        return da.getTime() - db.getTime()
      })
    }

    if (searchQuery.trim()) {
      // 搜尋模式：全部待付項目，只用文字過濾，依日期排序
      const query = searchQuery.toLowerCase()
      const matched = pendingItems.filter(
        (item: PaymentItemWithDetails) =>
          item.itemName?.toLowerCase().includes(query) ||
          item.projectName?.toLowerCase().includes(query) ||
          item.categoryName?.toLowerCase().includes(query)
      )
      return sortByDue(matched).slice(0, 50)
    }

    // 無搜尋：預設只顯示「已逾期 + 30 天內到期」
    const cutoffDate = new Date(today)
    cutoffDate.setDate(cutoffDate.getDate() + 30)

    const urgent = pendingItems.filter((item) => {
      const due = getDueDate(item)
      if (!due) return false // 無日期不顯示在「快速付款」（避免雜訊）
      return due <= cutoffDate // 已逾期 或 30 天內到期
    })

    return sortByDue(urgent).slice(0, 20)
  }, [paymentItems, searchQuery])

  // 建立付款記錄
  const paymentMutation = useMutation<unknown, Error, PaymentFormData>({
    mutationFn: async (data: PaymentFormData) => {
      // 改用正確端點：POST /api/payment/items/:id/payments
      // 此端點會自動更新 paidAmount + status + 建立 payment_record（單一交易）
      return apiRequest("POST", `/api/payment/items/${data.itemId}/payments`, {
        amount: data.amountPaid,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        ...(data.receiptImageUrl ? { receiptImageUrl: data.receiptImageUrl } : {}),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/records"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project/stats"] })
      setStep("done")
    },
    onError: (error: Error) => {
      toast({
        title: "付款失敗",
        description: friendlyApiError(error),
        variant: "destructive",
      })
    },
  })

  const handleSelectItem = (item: PaymentItemWithDetails) => {
    setSelectedItem(item)
    const remaining = parseFloat(item.totalAmount || "0") - parseFloat(item.paidAmount || "0")
    setAmount(remaining.toString())
    setStep("confirm")
  }

  const handleConfirmPayment = () => {
    if (!selectedItem || !amount) return
    paymentMutation.mutate({
      itemId: selectedItem.id,
      amountPaid: amount,
      paymentDate,
      paymentMethod,
      receiptImageUrl: receiptUrl,
    })
  }

  const handleClose = () => {
    setStep("search")
    setSearchQuery("")
    setSelectedItem(null)
    setAmount("")
    setPaymentMethod("bank_transfer")
    setPaymentDate(localDateISO())
    setReceiptUrl(null)
    onOpenChange(false)
  }

  // 再付一筆：保留 dialog 開啟、保留付款方式與日期，重置選擇與搜尋
  const handlePayAgain = () => {
    setStep("search")
    setSearchQuery("")
    setSelectedItem(null)
    setAmount("")
    setReceiptUrl(null)
    // 保留 paymentMethod 與 paymentDate（連續付款常用相同方式與日期）
  }

  const formatCurrency = (value: string | number) => {
    const num = parseFloat(value?.toString() || "0")
    return isNaN(num) ? "0" : num.toLocaleString()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            快速付款
          </DialogTitle>
        </DialogHeader>

        {/* 步驟指示器 */}
        <div className="flex items-center justify-center gap-2 py-2">
          {(["search", "confirm", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? "bg-blue-600 text-white"
                    : i < ["search", "confirm", "done"].indexOf(step)
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && <ArrowRight className="w-4 h-4 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* Step 1: 搜尋付款項目 */}
        {step === "search" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜尋項目名稱、專案...（Enter 選第一個）"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredItems.length > 0) {
                    e.preventDefault()
                    handleSelectItem(filteredItems[0])
                  }
                }}
                className="pl-10"
                autoFocus
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">載入中...</span>
                </div>
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item: PaymentItemWithDetails) => {
                  const remaining =
                    parseFloat(item.totalAmount || "0") - parseFloat(item.paidAmount || "0")
                  // 計算到期狀態
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const dueStr = item.endDate || item.startDate
                  const due = dueStr ? new Date(dueStr) : null
                  let dueLabel: string | null = null
                  let dueColor = "text-gray-500"
                  if (due && !isNaN(due.getTime())) {
                    due.setHours(0, 0, 0, 0)
                    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)
                    if (diffDays < 0) {
                      dueLabel = `逾期 ${Math.abs(diffDays)} 天`
                      dueColor = "text-red-700 bg-red-100"
                    } else if (diffDays === 0) {
                      dueLabel = "今天到期"
                      dueColor = "text-orange-700 bg-orange-100"
                    } else if (diffDays <= 7) {
                      dueLabel = `${diffDays} 天後到期`
                      dueColor = "text-orange-700 bg-orange-100"
                    } else if (diffDays <= 30) {
                      dueLabel = `${diffDays} 天後到期`
                      dueColor = "text-yellow-700 bg-yellow-100"
                    } else {
                      dueLabel = `${diffDays} 天後`
                      dueColor = "text-gray-500 bg-gray-100"
                    }
                  }
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-medium text-gray-900 truncate">{item.itemName}</p>
                            {dueLabel && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${dueColor}`}
                              >
                                {dueLabel}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.projectName || "無專案"}
                            {item.categoryName ? ` / ${item.categoryName}` : ""}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-red-600 whitespace-nowrap">
                            ${formatCurrency(remaining)}
                          </p>
                          <p className="text-[10px] text-gray-400">待付</p>
                        </div>
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="text-center py-8 text-gray-400">
                  {searchQuery ? (
                    "找不到匹配的項目"
                  ) : (
                    <>
                      <p>本月沒有逾期或即將到期項目</p>
                      <p className="text-xs mt-2">要付未來月份？請輸入項目名稱搜尋</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: 確認金額 */}
        {step === "confirm" && selectedItem && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-medium text-blue-900">{selectedItem.itemName}</p>
              <p className="text-sm text-blue-700">
                {selectedItem.projectName || "無專案"} / 總額 $
                {formatCurrency(selectedItem.totalAmount)}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="amount">
                  付款金額 <span className="text-red-500">*</span>
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        amount &&
                        !paymentMutation.isPending &&
                        selectedItem
                      ) {
                        e.preventDefault()
                        handleConfirmPayment()
                      }
                    }}
                    className="pl-8"
                    autoFocus
                  />
                </div>
                {amount && parseFloat(amount) > 0 && (
                  <div className="mt-1 text-xs text-blue-700 font-medium">
                    = {formatNT(parseFloat(amount))}
                  </div>
                )}
                {/* 快速金額按鈕（付清 / 半額） */}
                {(() => {
                  const remaining =
                    parseFloat(selectedItem.totalAmount || "0") -
                    parseFloat(selectedItem.paidAmount || "0")
                  if (remaining <= 0) return null
                  return (
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAmount(remaining.toString())}
                        className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 active:scale-95 transition-all"
                        title="輸入剩餘應付金額"
                      >
                        付清 {formatCurrency(remaining)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmount(Math.round(remaining / 2).toString())}
                        className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 hover:bg-yellow-200 active:scale-95 transition-all"
                        title="輸入剩餘應付的一半"
                      >
                        半額 {formatCurrency(Math.round(remaining / 2))}
                      </button>
                    </div>
                  )
                })()}
              </div>

              <div>
                <Label htmlFor="method">付款方式</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                    <SelectItem value="cash">現金</SelectItem>
                    <SelectItem value="credit_card">信用卡</SelectItem>
                    <SelectItem value="check">支票</SelectItem>
                    <SelectItem value="mobile_payment">行動支付</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="date">付款日期</Label>
                <Input
                  id="date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* 收據上傳（選填） */}
              <div>
                <Label className="block mb-2">
                  付款憑證 <span className="text-gray-400 text-xs">（選填）</span>
                </Label>
                <ReceiptUploadButton value={receiptUrl} onChange={setReceiptUrl} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("search")}>
                上一步
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmPayment}
                disabled={paymentMutation.isPending || !amount || !isOnline}
                title={!isOnline ? "離線中無法提交，請等網路恢復" : undefined}
              >
                {paymentMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {!isOnline ? "離線中" : "確認付款"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: 完成 */}
        {step === "done" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">付款成功</h3>
              <p className="text-sm text-gray-500 mt-1">
                已為「{selectedItem?.itemName}」記錄 ${formatCurrency(amount)} 的付款
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePayAgain} className="flex-1">
                再付一筆
              </Button>
              <Button onClick={handleClose} className="flex-1">
                完成
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default QuickPaymentDialog
