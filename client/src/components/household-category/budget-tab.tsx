import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Target } from "lucide-react";
import { formatCurrency, type BudgetFormData } from "./types";

// ============================================================
// 預算管理分頁 - 設定預算對話框 + 年月篩選 + 預算表格
// ============================================================

interface BudgetTabProps {
  /** 目前選取的分類 */
  selectedCategory: any;
  /** 預算資料陣列 */
  budgets: any[];
  /** 是否載入中 */
  isLoadingBudgets: boolean;
  /** 預算對話框是否開啟 */
  showBudgetDialog: boolean;
  /** 預算對話框開關回呼 */
  onShowBudgetDialogChange: (open: boolean) => void;
  /** react-hook-form 表單實例 */
  budgetForm: UseFormReturn<BudgetFormData>;
  /** 表單送出回呼 */
  onBudgetSubmit: (data: BudgetFormData) => void;
  /** mutation 是否進行中 */
  isBudgetPending: boolean;
  /** 選取的年份 */
  selectedYear: string;
  /** 年份變更回呼 */
  onYearChange: (year: string) => void;
  /** 選取的月份 */
  selectedMonth: string;
  /** 月份變更回呼 */
  onMonthChange: (month: string) => void;
}

export function BudgetTab({
  selectedCategory,
  budgets,
  isLoadingBudgets,
  showBudgetDialog,
  onShowBudgetDialogChange,
  budgetForm,
  onBudgetSubmit,
  isBudgetPending,
  selectedYear,
  onYearChange,
  selectedMonth,
  onMonthChange,
}: BudgetTabProps) {
  /** 產生最近 5 年的年份選項 */
  const yearOptions = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - i
  );

  /** 產生 01~12 月份選項 */
  const monthOptions = Array.from({ length: 12 }, (_, i) =>
    (i + 1).toString().padStart(2, "0")
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Target className="h-5 w-5 mr-2" />
            預算管理
          </span>

          {/* 設定預算對話框 */}
          <Dialog
            open={showBudgetDialog}
            onOpenChange={onShowBudgetDialogChange}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                設定預算
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>設定預算</DialogTitle>
                <DialogDescription>
                  為 {selectedCategory.categoryName} 設定月度預算
                </DialogDescription>
              </DialogHeader>
              <Form {...budgetForm}>
                <form
                  onSubmit={budgetForm.handleSubmit(onBudgetSubmit)}
                  className="space-y-4"
                >
                  {/* 月份 */}
                  <FormField
                    control={budgetForm.control}
                    name="month"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>月份</FormLabel>
                        <FormControl>
                          <Input type="month" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 預算金額 */}
                  <FormField
                    control={budgetForm.control}
                    name="budgetAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>預算金額</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            step="0.01"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 備註 */}
                  <FormField
                    control={budgetForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>備註 (選填)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="預算設定的備註說明"
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
                      onClick={() => onShowBudgetDialogChange(false)}
                    >
                      取消
                    </Button>
                    <Button type="submit" disabled={isBudgetPending}>
                      設定預算
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* 年月篩選器 */}
          <div className="flex space-x-4">
            <div>
              <label className="text-sm font-medium">年份</label>
              <Select value={selectedYear} onValueChange={onYearChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">月份</label>
              <Select value={selectedMonth} onValueChange={onMonthChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}月
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 預算表格 */}
          <div>
            {isLoadingBudgets ? (
              <div className="text-center py-4">載入中...</div>
            ) : budgets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                此月份尚未設定預算
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>月份</TableHead>
                    <TableHead>預算金額</TableHead>
                    <TableHead>備註</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.map((budget: any) => (
                    <TableRow key={budget.id}>
                      <TableCell>{budget.month}</TableCell>
                      <TableCell>
                        NT$ {formatCurrency(budget.budgetAmount)}
                      </TableCell>
                      <TableCell>{budget.notes || "-"}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
