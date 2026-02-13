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
import { Building2 } from "lucide-react";
import { UseFormReturn, FieldValues } from "react-hook-form";

// ========================================
// 新增專案對話框元件
// ========================================

interface ProjectDialogProps {
  /** 對話框是否開啟 */
  open: boolean;
  /** 開關狀態變更處理 */
  onOpenChange: (open: boolean) => void;
  /** 專案表單實例 */
  form: UseFormReturn<FieldValues>;
  /** 表單提交處理（建立專案） */
  onSubmit: (data: FieldValues) => void;
  /** 是否正在建立中 */
  isPending: boolean;
}

/** 新增專案對話框，包含名稱、類型、描述欄位 */
export function ProjectDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
  isPending,
}: ProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Building2 className="w-4 h-4 mr-2" />
          新增專案
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>建立新專案</DialogTitle>
          <DialogDescription>建立新的付款專案分類</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 專案名稱 */}
            <FormField
              control={form.control}
              name="projectName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>專案名稱 *</FormLabel>
                  <FormControl>
                    <Input placeholder="輸入專案名稱" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 專案類型 */}
            <FormField
              control={form.control}
              name="projectType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>專案類型 *</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇專案類型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">一般</SelectItem>
                        <SelectItem value="business">商業</SelectItem>
                        <SelectItem value="personal">個人</SelectItem>
                        <SelectItem value="investment">投資</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 專案描述 */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>專案描述</FormLabel>
                  <FormControl>
                    <Textarea placeholder="專案描述（選填）" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "建立中..." : "建立專案"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
