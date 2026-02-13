import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import type { PaymentItem, PaymentProject, DebtCategory, InsertPaymentItem } from "@shared/schema";

// ========================================
// 新增/編輯付款項目對話框元件
// ========================================

interface PaymentItemDialogProps {
  /** 對話框是否開啟 */
  open: boolean;
  /** 開關狀態變更處理 */
  onOpenChange: (open: boolean) => void;
  /** 正在編輯的項目（null 表示新增模式） */
  editingItem: PaymentItem | null;
  /** 表單實例 */
  form: UseFormReturn<InsertPaymentItem>;
  /** 表單提交處理 */
  onSubmit: (data: InsertPaymentItem) => void;
  /** 重置編輯狀態 */
  onResetEditing: () => void;
  /** 是否正在處理中 */
  isPending: boolean;
  /** 專案列表 */
  projects: PaymentProject[];
  /** 分類列表 */
  categories: DebtCategory[];
}

/** 新增或編輯付款項目對話框 */
export function PaymentItemDialog({
  open,
  onOpenChange,
  editingItem,
  form,
  onSubmit,
  onResetEditing,
  isPending,
  projects,
  categories,
}: PaymentItemDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onResetEditing();
        }
        onOpenChange(isOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button onClick={onResetEditing}>
          <Plus className="w-4 h-4 mr-2" />
          新增付款項目
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? "編輯付款項目" : "建立付款項目"}
          </DialogTitle>
          <DialogDescription>
            {editingItem
              ? "編輯現有的付款項目資訊"
              : "建立新的付款項目並設定相關資訊"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 專案 + 分類 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>專案 *</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選擇專案" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id.toString()}>
                              {project.projectName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分類 *</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選擇分類" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.categoryName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 項目名稱 */}
            <FormField
              control={form.control}
              name="itemName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>項目名稱 *</FormLabel>
                  <FormControl>
                    <Input placeholder="輸入項目名稱" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 總金額 */}
            <FormField
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>總金額 *</FormLabel>
                  <FormControl>
                    <Input placeholder="輸入總金額" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 付款類型 + 優先級 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paymentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>付款類型 *</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇付款類型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">一次性付款</SelectItem>
                          <SelectItem value="recurring">定期付款</SelectItem>
                          <SelectItem value="installment">分期付款</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>優先級</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選擇優先級" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">高</SelectItem>
                          <SelectItem value="2">中</SelectItem>
                          <SelectItem value="3">低</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 日期 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>開始日期 *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>結束日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 備註 */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註</FormLabel>
                  <FormControl>
                    <Textarea placeholder="輸入備註資訊（選填）" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "處理中..."
                  : editingItem ? "更新項目" : "建立項目"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
