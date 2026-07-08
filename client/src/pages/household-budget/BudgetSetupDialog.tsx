// 設定每月預算 Dialog（含觸發按鈕、變更原因欄位）
// 從原 household-budget.tsx 機械搬移、送出行為完全不變
import type { UseFormReturn } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Wallet } from "lucide-react"
import type { BudgetFormData } from "./types"

interface BudgetSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  budgetForm: UseFormReturn<BudgetFormData>
  onSetBudget: (data: BudgetFormData) => void
  isPending: boolean
}

/** 設定每月預算 Dialog（含觸發按鈕） */
export function BudgetSetupDialog({
  open,
  onOpenChange,
  budgetForm,
  onSetBudget,
  isPending,
}: BudgetSetupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          設定預算
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>設定每月預算</DialogTitle>
          <DialogDescription>設定每月生活費預算，建立預算概念</DialogDescription>
        </DialogHeader>
        <form onSubmit={budgetForm.handleSubmit(onSetBudget)} className="space-y-4">
          <div>
            <Label htmlFor="monthlyBudget">
              每月預算 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="monthlyBudget"
              type="number"
              step="0.01"
              placeholder="輸入每月預算"
              onFocus={(e) => e.target.select()}
              autoFocus
              {...budgetForm.register("monthlyBudget", { required: true })}
            />
          </div>
          <div>
            <Label htmlFor="budgetReason">變更原因（選填、留下紀錄）</Label>
            <Input
              id="budgetReason"
              placeholder="例如：因油價上漲、調整交通預算"
              {...budgetForm.register("reason")}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              設定
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
