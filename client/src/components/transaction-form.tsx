import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertDebtSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PlusIcon, MinusIcon, SaveIcon, XIcon } from "lucide-react";
import type { InsertDebt, DebtCategory, Vendor } from "@shared/schema";

interface TransactionFormProps {
  show?: boolean;
  onClose?: () => void;
  editingDebt?: any;
}

export default function TransactionForm({ show = true, onClose, editingDebt }: TransactionFormProps) {
  const [transactionType, setTransactionType] = useState<"income" | "expense">("expense");
  const { toast } = useToast();

  const { data: categories } = useQuery<DebtCategory[]>({
    queryKey: ["/api/categories"],
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const form = useForm<InsertDebt>({
    resolver: zodResolver(insertDebtSchema),
    defaultValues: editingDebt ? {
      debtName: editingDebt.debtName || "",
      totalAmount: editingDebt.totalAmount || "",
      categoryId: editingDebt.categoryId || 0,
      vendorId: editingDebt.vendorId || 0,
      note: editingDebt.note || "",
      paymentType: editingDebt.paymentType || "single",
      installments: editingDebt.installments || 1,
      firstDueDate: editingDebt.firstDueDate ? editingDebt.firstDueDate.split('T')[0] : new Date().toISOString().split('T')[0],
    } : {
      debtName: "",
      totalAmount: "",
      categoryId: 0,
      vendorId: 0,
      note: "",
      paymentType: "single",
      installments: 1,
      firstDueDate: new Date().toISOString().split('T')[0],
    },
  });

  const createDebtMutation = useMutation({
    mutationFn: async (data: InsertDebt) => {
      if (editingDebt) {
        return await apiRequest(`/api/debts/${editingDebt.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        return await apiRequest("/api/debts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/debts"] });
      form.reset();
      toast({
        title: "成功",
        description: editingDebt ? "付款項目已更新" : "付款項目已新增",
      });
      onClose?.();
    },
    onError: () => {
      toast({
        title: "錯誤",
        description: editingDebt ? "更新付款項目失敗" : "新增付款項目失敗",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertDebt) => {
    createDebtMutation.mutate(data);
  };

  if (!show) return null;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{editingDebt ? "編輯付款項目" : "新增付款項目"}</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">交易類型</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={transactionType === "income" ? "default" : "outline"}
                  className={transactionType === "income" ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => setTransactionType("income")}
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  收入
                </Button>
                <Button
                  type="button"
                  variant={transactionType === "expense" ? "default" : "outline"}
                  className={transactionType === "expense" ? "bg-red-600 hover:bg-red-700" : ""}
                  onClick={() => setTransactionType("expense")}
                >
                  <MinusIcon className="w-4 h-4 mr-2" />
                  支出
                </Button>
              </div>
            </div>

            <FormField
              control={form.control}
              name="debtName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>項目名稱</FormLabel>
                  <FormControl>
                    <Input placeholder="輸入項目名稱" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>金額</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">NT$</span>
                      <Input
                        type="number"
                        placeholder="0"
                        className="pl-12"
                        {...field}
                      />
                    </div>
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
                  <FormLabel>分類</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇分類" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.categoryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vendorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>廠商/歸屬</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇廠商" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendors?.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id.toString()}>
                          {vendor.vendorName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="輸入備註..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="firstDueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>到期日</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                取消
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-blue-700"
                disabled={createDebtMutation.isPending}
              >
                <SaveIcon className="w-4 h-4 mr-2" />
                {createDebtMutation.isPending ? "儲存中..." : editingDebt ? "更新記錄" : "儲存記錄"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
