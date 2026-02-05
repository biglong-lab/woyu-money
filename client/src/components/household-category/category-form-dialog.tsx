import { UseFormReturn } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import type { CategoryFormData } from "./types";

// ============================================================
// 分類表單對話框 - 新增或編輯分類
// ============================================================

interface CategoryFormDialogProps {
  /** 對話框是否開啟 */
  open: boolean;
  /** 開關狀態變更回呼 */
  onOpenChange: (open: boolean) => void;
  /** react-hook-form 表單實例 */
  form: UseFormReturn<CategoryFormData>;
  /** 目前是否為編輯模式 */
  editingCategory: any;
  /** 表單送出回呼 */
  onSubmit: (data: CategoryFormData) => void;
  /** 新增或更新 mutation 是否進行中 */
  isPending: boolean;
  /** 重置編輯狀態的回呼 */
  onResetEditing: () => void;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  form,
  editingCategory,
  onSubmit,
  isPending,
  onResetEditing,
}: CategoryFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          onClick={() => {
            onResetEditing();
            form.reset();
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          新增分類
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingCategory ? "編輯分類" : "新增分類"}
          </DialogTitle>
          <DialogDescription>
            {editingCategory ? "修改分類資訊" : "建立新的家用記帳分類"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {/* 分類名稱 */}
            <FormField
              control={form.control}
              name="categoryName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>分類名稱</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例：食物、交通、娛樂"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 分類類型 */}
            <FormField
              control={form.control}
              name="categoryType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>分類類型</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇分類類型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="household">家用</SelectItem>
                      <SelectItem value="personal">個人</SelectItem>
                      <SelectItem value="investment">投資</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 描述（選填） */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>描述 (選填)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="分類的詳細說明或備註"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 操作按鈕 */}
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {editingCategory ? "更新" : "新增"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
