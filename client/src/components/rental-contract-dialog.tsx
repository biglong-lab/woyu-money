import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";

// 租約表單驗證 Schema（與主頁面共用）
export const rentalContractSchema = z.object({
  projectId: z.number().min(1, "請選擇專案"),
  contractName: z.string().min(1, "請輸入租約名稱"),
  startDate: z.string().min(1, "請選擇開始日期"),
  endDate: z.string().min(1, "請選擇結束日期"),
  totalYears: z.number().min(1, "租約年數至少1年"),
  baseAmount: z.number().min(0, "基礎金額不能為負數"),
  hasBufferPeriod: z.boolean().default(false),
  bufferMonths: z.number().min(0, "緩衝期月數不能為負數").default(0),
  bufferIncludedInTerm: z.boolean().default(true),
  notes: z.string().optional(),
  priceTiers: z.array(z.object({
    yearStart: z.number().min(1),
    yearEnd: z.number().min(1),
    monthlyAmount: z.number().min(0),
  })).min(1, "請至少添加一個價格階段"),
});

export type RentalContractForm = z.infer<typeof rentalContractSchema>;

// 價格階層資料
export interface PriceTier {
  yearStart: number;
  yearEnd: number;
  monthlyAmount: number;
}

// ==========================================
// 建立/編輯租約對話框
// ==========================================
interface RentalContractDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly editingContract: any | null;
  readonly form: UseFormReturn<RentalContractForm>;
  readonly projects: any[];
  readonly priceTiers: PriceTier[];
  readonly onAddPriceTier: () => void;
  readonly onRemovePriceTier: (index: number) => void;
  readonly onUpdatePriceTier: (index: number, field: string, value: any) => void;
  readonly onSubmit: (data: RentalContractForm) => void;
  readonly isSubmitting: boolean;
}

export function RentalContractDialog({
  isOpen,
  onOpenChange,
  editingContract,
  form,
  projects,
  priceTiers,
  onAddPriceTier,
  onRemovePriceTier,
  onUpdatePriceTier,
  onSubmit,
  isSubmitting,
}: RentalContractDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-lg md:text-xl font-semibold">
            {editingContract ? "編輯租約" : "新增租約"}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-2">
            請填寫租約基本資訊和價格階段設定
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contractName">租約名稱</Label>
              <Input
                id="contractName"
                {...form.register("contractName")}
                placeholder="輸入租約名稱"
              />
              {form.formState.errors.contractName && (
                <p className="text-sm text-red-600">{form.formState.errors.contractName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectId">選擇專案</Label>
              <Select onValueChange={(value) => form.setValue("projectId", parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇專案" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project: any) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.projectId && (
                <p className="text-sm text-red-600">{form.formState.errors.projectId.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-sm font-medium">開始日期</Label>
              <Input
                id="startDate"
                type="date"
                {...form.register("startDate")}
                className="w-full"
              />
              {form.formState.errors.startDate && (
                <p className="text-xs text-red-600">{form.formState.errors.startDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-sm font-medium">結束日期</Label>
              <Input
                id="endDate"
                type="date"
                {...form.register("endDate")}
                className="w-full"
              />
              {form.formState.errors.endDate && (
                <p className="text-xs text-red-600">{form.formState.errors.endDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalYears" className="text-sm font-medium">總年數</Label>
              <Input
                id="totalYears"
                type="number"
                {...form.register("totalYears", { valueAsNumber: true })}
                placeholder="租約總年數"
                className="w-full"
              />
              {form.formState.errors.totalYears && (
                <p className="text-xs text-red-600">{form.formState.errors.totalYears.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseAmount">基礎金額</Label>
            <Input
              id="baseAmount"
              type="number"
              step="0.01"
              {...form.register("baseAmount", { valueAsNumber: true })}
              placeholder="基礎租金金額"
            />
            {form.formState.errors.baseAmount && (
              <p className="text-sm text-red-600">{form.formState.errors.baseAmount.message}</p>
            )}
          </div>

          {/* 緩衝期設定 */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg border">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasBufferPeriod"
                checked={form.watch("hasBufferPeriod")}
                onCheckedChange={(checked) => {
                  form.setValue("hasBufferPeriod", !!checked);
                  if (!checked) {
                    form.setValue("bufferMonths", 0);
                  }
                }}
              />
              <Label htmlFor="hasBufferPeriod" className="text-base font-medium">
                租約緩衝期設定
              </Label>
            </div>

            {form.watch("hasBufferPeriod") && (
              <div className="space-y-3 pl-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bufferMonths">緩衝期月數</Label>
                    <Input
                      id="bufferMonths"
                      type="number"
                      min="0"
                      max="12"
                      {...form.register("bufferMonths", { valueAsNumber: true })}
                      placeholder="免租金月數"
                    />
                    {form.formState.errors.bufferMonths && (
                      <p className="text-sm text-red-600">{form.formState.errors.bufferMonths.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">緩衝期計算方式</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="bufferIncluded"
                        name="bufferCalculation"
                        checked={form.watch("bufferIncludedInTerm")}
                        onChange={() => form.setValue("bufferIncludedInTerm", true)}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="bufferIncluded" className="text-sm">
                        包含在租期內（緩衝期{form.watch("bufferMonths") || 0}個月免租金 + 租約{form.watch("totalYears") || 0}年 = 租期{form.watch("totalYears") || 0}年）
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="bufferNotIncluded"
                        name="bufferCalculation"
                        checked={!form.watch("bufferIncludedInTerm")}
                        onChange={() => form.setValue("bufferIncludedInTerm", false)}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="bufferNotIncluded" className="text-sm">
                        未包含在租期內（緩衝期{form.watch("bufferMonths") || 0}個月免租金 + 租約{form.watch("totalYears") || 0}年 = 租期{form.watch("totalYears") || 0}年+{form.watch("bufferMonths") || 0}個月）
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 價格階段設定 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">價格階段設定</Label>
              <Button type="button" onClick={onAddPriceTier} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                新增階段
              </Button>
            </div>

            <div className="space-y-3">
              {priceTiers.map((tier, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">開始年份</Label>
                      <Input
                        type="number"
                        value={tier.yearStart}
                        onChange={(e) => onUpdatePriceTier(index, "yearStart", parseInt(e.target.value))}
                        placeholder="開始年"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">結束年份</Label>
                      <Input
                        type="number"
                        value={tier.yearEnd}
                        onChange={(e) => onUpdatePriceTier(index, "yearEnd", parseInt(e.target.value))}
                        placeholder="結束年"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">月租金額</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={tier.monthlyAmount}
                        onChange={(e) => onUpdatePriceTier(index, "monthlyAmount", parseFloat(e.target.value))}
                        placeholder="月租金"
                      />
                    </div>
                  </div>
                  {priceTiers.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => onRemovePriceTier(index)}
                      variant="outline"
                      size="sm"
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">備註</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="租約相關備註"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {editingContract ? "更新租約" : "建立租約"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 智慧調整對話框
// ==========================================
interface SmartAdjustDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly selectedContract: any | null;
  readonly adjustForm: UseFormReturn<any>;
  readonly adjustmentPreview: any | null;
  readonly onPreview: () => void;
  readonly onConfirm: () => void;
  readonly isSubmitting: boolean;
}

export function SmartAdjustDialog({
  isOpen,
  onOpenChange,
  selectedContract,
  adjustForm,
  adjustmentPreview,
  onPreview,
  onConfirm,
  isSubmitting,
}: SmartAdjustDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            智慧調整 - {selectedContract?.contractName}
          </DialogTitle>
          <DialogDescription>
            智慧調整會自動識別已付款和未來項目，只調整現在和未來的付款金額
          </DialogDescription>
        </DialogHeader>

        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>調整規則</AlertTitle>
          <AlertDescription>
            {/* 使用 Fragment 避免 <br/> 標籤 */}
            <span className="block">已付款項目：保持不變</span>
            <span className="block">過期項目：保持原設定</span>
            <span className="block">現在和未來項目：套用新設定</span>
          </AlertDescription>
        </Alert>

        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>調整方式</Label>
              <Select
                value={adjustForm.watch("adjustmentType")}
                onValueChange={(value) => adjustForm.setValue("adjustmentType", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">百分比調整</SelectItem>
                  <SelectItem value="fixed">固定金額調整</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {adjustForm.watch("adjustmentType") === "percentage" ? "調整百分比 (%)" : "調整金額 (NT$)"}
              </Label>
              <Input
                type="number"
                step="0.01"
                {...adjustForm.register("adjustmentValue", { valueAsNumber: true })}
                placeholder={adjustForm.watch("adjustmentType") === "percentage" ? "如：5 表示增加5%" : "如：1000 表示增加1000元"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>生效日期</Label>
            <Input
              type="date"
              {...adjustForm.register("effectiveDate")}
            />
          </div>

          <div className="space-y-2">
            <Label>調整原因</Label>
            <Textarea
              {...adjustForm.register("reason")}
              placeholder="記錄調整原因，如：市場價格調整、通膨因應等"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onPreview} className="flex-1">
              預覽調整結果
            </Button>
          </div>

          {adjustmentPreview && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>預覽結果</AlertTitle>
              <AlertDescription>
                <span className="block">將調整 {adjustmentPreview.affectedItems} 個未來付款項目</span>
                <span className="block">調整總金額：NT${adjustmentPreview.totalAdjustment?.toLocaleString() || 0}</span>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={!adjustmentPreview || isSubmitting}
            >
              確認調整
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
