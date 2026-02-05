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
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Receipt, Search } from "lucide-react";
import {
  formatCurrency,
  type ExpenseFormData,
  type ExpenseFilter,
} from "./types";

// ============================================================
// 支出記錄分頁 - 新增支出對話框 + 篩選器 + 支出表格
// ============================================================

/** 付款方式選項（對話框與篩選器共用） */
const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "現金" },
  { value: "credit_card", label: "信用卡" },
  { value: "debit_card", label: "金融卡" },
  { value: "transfer", label: "轉帳" },
  { value: "mobile_payment", label: "行動支付" },
  { value: "other", label: "其他" },
] as const;

interface ExpenseTabProps {
  /** 目前選取的分類 */
  selectedCategory: any;
  /** 已篩選的支出資料 */
  filteredExpenses: any[];
  /** 是否載入中 */
  isLoadingExpenses: boolean;
  /** 支出對話框是否開啟 */
  showExpenseDialog: boolean;
  /** 支出對話框開關回呼 */
  onShowExpenseDialogChange: (open: boolean) => void;
  /** react-hook-form 表單實例 */
  expenseForm: UseFormReturn<ExpenseFormData>;
  /** 表單送出回呼 */
  onExpenseSubmit: (data: ExpenseFormData) => void;
  /** mutation 是否進行中 */
  isExpensePending: boolean;
  /** 篩選條件 */
  expenseFilter: ExpenseFilter;
  /** 篩選條件變更回呼 */
  onFilterChange: (filter: ExpenseFilter) => void;
}

export function ExpenseTab({
  selectedCategory,
  filteredExpenses,
  isLoadingExpenses,
  showExpenseDialog,
  onShowExpenseDialogChange,
  expenseForm,
  onExpenseSubmit,
  isExpensePending,
  expenseFilter,
  onFilterChange,
}: ExpenseTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Receipt className="h-5 w-5 mr-2" />
            支出記錄
          </span>

          {/* 新增支出對話框 */}
          <Dialog
            open={showExpenseDialog}
            onOpenChange={onShowExpenseDialogChange}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                新增支出
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增支出</DialogTitle>
                <DialogDescription>
                  為 {selectedCategory.categoryName} 新增支出記錄
                </DialogDescription>
              </DialogHeader>
              <Form {...expenseForm}>
                <form
                  onSubmit={expenseForm.handleSubmit(onExpenseSubmit)}
                  className="space-y-4"
                >
                  {/* 金額 */}
                  <FormField
                    control={expenseForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>金額</FormLabel>
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

                  {/* 日期 */}
                  <FormField
                    control={expenseForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>日期</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 付款方式 */}
                  <FormField
                    control={expenseForm.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>付款方式</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PAYMENT_METHOD_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 描述（選填） */}
                  <FormField
                    control={expenseForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>描述 (選填)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="支出的詳細說明"
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
                      onClick={() => onShowExpenseDialogChange(false)}
                    >
                      取消
                    </Button>
                    <Button type="submit" disabled={isExpensePending}>
                      新增支出
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
          {/* 篩選列 */}
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="搜尋支出記錄..."
                  className="pl-10"
                  value={expenseFilter.search}
                  onChange={(e) =>
                    onFilterChange({
                      ...expenseFilter,
                      search: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <Select
              value={expenseFilter.paymentMethod}
              onValueChange={(value) =>
                onFilterChange({ ...expenseFilter, paymentMethod: value })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有付款方式</SelectItem>
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 支出表格 */}
          <div>
            {isLoadingExpenses ? (
              <div className="text-center py-4">載入中...</div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暫無支出記錄
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead>金額</TableHead>
                    <TableHead>付款方式</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense: any) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {new Date(expense.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        NT$ {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {expense.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell>{expense.description || "-"}</TableCell>
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
