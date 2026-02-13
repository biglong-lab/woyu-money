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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PlusIcon, MinusIcon, SaveIcon, XIcon } from "lucide-react";
import type { DebtCategory, InsertPaymentItem, PaymentItem } from "@shared/schema";
import { insertPaymentItemSchema } from "@shared/schema";
import { z } from "zod";

// 廠商型別定義
type Vendor = { 
  id: number; 
  vendorName: string;
};

interface TransactionFormProps {
  show?: boolean;
  onClose?: () => void;
  editingDebt?: PaymentItem;
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

  const form = useForm<z.infer<typeof insertPaymentItemSchema>>({
    resolver: zodResolver(insertPaymentItemSchema),
    defaultValues: editingDebt ? {
      itemName: editingDebt.itemName || "",
      totalAmount: editingDebt.totalAmount || "",
      categoryId: editingDebt.categoryId || undefined,
      projectId: editingDebt.projectId || undefined,
      notes: editingDebt.notes || "",
      paymentType: editingDebt.paymentType || "single",
      installmentCount: editingDebt.installmentCount || 1,
      startDate: editingDebt.startDate ? editingDebt.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
    } : {
      itemName: "",
      totalAmount: "",
      categoryId: undefined,
      projectId: undefined,
      notes: "",
      paymentType: "single",
      installmentCount: 1,
      startDate: new Date().toISOString().split('T')[0],
    },
  });

  const createDebtMutation = useMutation({
    mutationFn: async (data: InsertPaymentItem) => {
      if (editingDebt) {
        return await apiRequest("PUT", `/api/debts/${editingDebt.id}`, data);
      } else {
        return await apiRequest("POST", "/api/debts", data);
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
    onError: (error: Error) => {
      toast({
        title: "錯誤",
        description: error.message || (editingDebt ? "更新付款項目失敗" : "新增付款項目失敗"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertPaymentItem) => {
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
              name="itemName"
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
              name="projectId"
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="輸入備註..."
                      className="resize-none"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>到期日</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value || ""}
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
