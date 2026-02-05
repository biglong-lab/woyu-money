import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import type { LoanInvestmentFormData, LoanInvestmentRecord } from "./types";
import {
  BasicInfoSection,
  PartyInfoSection,
  ContractDetailsSection,
  RiskStatusSection,
  AdditionalInfoSection,
} from "./form-sections";

/**
 * 借貸投資管理 -- 新增/編輯對話框
 * 負責對話框外殼與表單結構，各區段由 form-sections 提供
 */

interface RecordFormDialogProps {
  /** 對話框開關狀態 */
  open: boolean;
  /** 切換對話框開關 */
  onOpenChange: (open: boolean) => void;
  /** react-hook-form 表單實例 */
  form: UseFormReturn<LoanInvestmentFormData>;
  /** 目前正在編輯的記錄（null 表示新增模式） */
  editingRecord: LoanInvestmentRecord | null;
  /** 表單送出回呼 */
  onSubmit: (data: LoanInvestmentFormData) => void;
  /** 送出中（用於停用按鈕） */
  isSubmitting: boolean;
}

export default function RecordFormDialog({
  open,
  onOpenChange,
  form,
  editingRecord,
  onSubmit,
  isSubmitting,
}: RecordFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRecord ? "編輯借貸投資記錄" : "新增借貸投資記錄"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 基本資訊 */}
              <BasicInfoSection form={form} />

              {/* 當事人資訊 */}
              <PartyInfoSection form={form} />

              {/* 合約詳情 */}
              <ContractDetailsSection form={form} />

              {/* 狀態與風險 */}
              <RiskStatusSection form={form} />
            </div>

            {/* 其他資訊 */}
            <AdditionalInfoSection form={form} />

            {/* 送出按鈕 */}
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                )}
                {editingRecord ? "更新" : "建立"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
