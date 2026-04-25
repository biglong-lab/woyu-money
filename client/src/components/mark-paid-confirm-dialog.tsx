/**
 * 標記已付確認對話框（共用元件）
 *
 * 用於 cash-allocation / cashflow-decision-center / labor-insurance-watch 等頁面
 * 取代「單擊即付」的舊行為，新增：
 * - 確認步驟（避免誤點）
 * - 可調整金額（預設帶入 unpaid）
 * - 可調整付款日期（預設今天）
 * - 可選附付款憑證
 *
 * 設計：保持簡潔，必填只有「確認」，其他都選填
 */

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Loader2 } from "lucide-react"
import { ReceiptUploadButton } from "@/components/receipt-upload-button"
import { localDateISO, formatNT } from "@/lib/utils"

export interface MarkPaidPayload {
  amountPaid: number
  paymentDate: string
  receiptUrl: string | null
}

interface MarkPaidConfirmDialogProps {
  /** 對話框開啟狀態 */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 項目名稱（顯示用） */
  itemName: string
  /** 預設應付金額 */
  defaultAmount: number
  /** 描述（小字、選填，例如「文旅 / 4 月電費」） */
  description?: string
  /** 確認時呼叫 */
  onConfirm: (payload: MarkPaidPayload) => void
  /** mutation pending 狀態 */
  isPending?: boolean
}

export function MarkPaidConfirmDialog({
  open,
  onOpenChange,
  itemName,
  defaultAmount,
  description,
  onConfirm,
  isPending = false,
}: MarkPaidConfirmDialogProps) {
  const [amount, setAmount] = useState<string>(String(Math.round(defaultAmount)))
  const [paymentDate, setPaymentDate] = useState<string>(localDateISO())
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)

  // 開啟時帶入預設值
  useEffect(() => {
    if (open) {
      setAmount(String(Math.round(defaultAmount)))
      setPaymentDate(localDateISO())
      setReceiptUrl(null)
    }
  }, [open, defaultAmount])

  const parsedAmount = parseFloat(amount.replace(/[,\s]/g, ""))
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0
  const canSubmit = isValidAmount && !isPending

  const handleConfirm = () => {
    if (!canSubmit) return
    onConfirm({
      amountPaid: parsedAmount,
      paymentDate,
      receiptUrl,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            標記為已付款
          </DialogTitle>
          <DialogDescription>
            <div className="font-medium text-foreground mt-1">{itemName}</div>
            {description && (
              <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="mp-amount">付款金額 *</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                NT$
              </span>
              <Input
                id="mp-amount"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) {
                    e.preventDefault()
                    handleConfirm()
                  }
                }}
                className="pl-12 font-semibold text-base"
                autoFocus
              />
            </div>
            {isValidAmount && (
              <div className="text-xs text-blue-700 font-medium mt-1">
                = {formatNT(parsedAmount)}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="mp-date">付款日期</Label>
            <Input
              id="mp-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="block mb-2">
              付款憑證 <span className="text-xs text-muted-foreground">（選填）</span>
            </Label>
            <ReceiptUploadButton value={receiptUrl} onChange={setReceiptUrl} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> 處理中...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1" /> 確認已付
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
