import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Camera, Wallet, TrendingDown, TrendingUp, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { HouseholdExpense } from "@shared/schema/household";
import type { DebtCategory } from "@shared/schema/category";

// API 回應型別定義
interface MonthlyBudgetResponse {
  amount: string | number;
}

interface MonthlyStatsResponse {
  totalSpent: number;
  categoryBreakdown: Record<string, number>;
}

interface HouseholdCategory {
  id: number;
  categoryName: string;
  color: string;
}

interface ExpenseWithCategory extends HouseholdExpense {
  categoryName?: string;
  receiptPhoto?: string;
}

// 表單型別定義
interface QuickAddFormData {
  amount: string;
  categoryId: string;
  description: string;
  paymentMethod: string;
  date: string;
}

interface BudgetFormData {
  monthlyBudget: string;
}

interface AddExpensePayload {
  amount: number;
  categoryId: number;
  description: string;
  paymentMethod: string;
  date: string;
}

interface SetBudgetPayload {
  amount: number;
  month: string;
}

export default function HouseholdBudget() {
  const { data: monthlyBudget, isLoading: isLoadingBudget } = useQuery<MonthlyBudgetResponse>({
    queryKey: ["/api/household/budget"],
  });

  const { data: dailyExpenses, isLoading: isLoadingExpenses } = useQuery<ExpenseWithCategory[]>({
    queryKey: ["/api/household/expenses"],
  });

  const { data: monthlyStats, isLoading: isLoadingStats } = useQuery<MonthlyStatsResponse>({
    queryKey: ["/api/household/stats"],
  });

  // Load household categories from the category management system
  const { data: householdCategories = [], isLoading: isLoadingCategories } = useQuery<HouseholdCategory[]>({
    queryKey: ["/api/categories/household"],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  const { toast } = useToast();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showBudgetSetup, setShowBudgetSetup] = useState(false);
  const queryClient = useQueryClient();

  // 快速記帳表單
  const quickAddForm = useForm<QuickAddFormData>({
    defaultValues: {
      amount: "",
      categoryId: "",
      description: "",
      paymentMethod: "cash",
      date: new Date().toISOString().split('T')[0],
    },
  });

  // 預算設定表單
  const budgetForm = useForm<BudgetFormData>({
    defaultValues: {
      monthlyBudget: monthlyBudget?.amount?.toString() || "",
    },
  });

  // 快速記帳
  const addExpenseMutation = useMutation({
    mutationFn: async (data: QuickAddFormData) => {
      const formattedData: AddExpensePayload = {
        ...data,
        amount: parseFloat(data.amount),
        categoryId: parseInt(data.categoryId)
      };
      return await apiRequest("/api/household/expenses", "POST", formattedData);
    },
    onSuccess: () => {
      toast({
        title: "記帳成功",
        description: "支出已記錄",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/household/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/household/stats"] });
      setShowQuickAdd(false);
      quickAddForm.reset();
    },
    onError: () => {
      toast({
        title: "記帳失敗",
        description: "請重試",
        variant: "destructive",
      });
    },
  });

  // 設定預算
  const setBudgetMutation = useMutation({
    mutationFn: async (data: BudgetFormData) => {
      const budgetData: SetBudgetPayload = {
        amount: parseFloat(data.monthlyBudget),
        month: new Date().toISOString().slice(0, 7), // YYYY-MM
      };
      return await apiRequest("/api/household/budget", "POST", budgetData);
    },
    onSuccess: () => {
      toast({
        title: "預算設定成功",
        description: "每月預算已更新",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/household/budget"] });
      queryClient.invalidateQueries({ queryKey: ["/api/household/stats"] });
      setShowBudgetSetup(false);
    },
    onError: () => {
      toast({
        title: "設定失敗",
        description: "請重試",
        variant: "destructive",
      });
    },
  });

  const onQuickAdd = (data: QuickAddFormData) => {
    if (!data.categoryId || !data.amount) {
      toast({
        title: "請填寫必要欄位",
        description: "請選擇分類並輸入金額",
        variant: "destructive",
      });
      return;
    }
    addExpenseMutation.mutate(data);
  };

  const onSetBudget = (data: BudgetFormData) => {
    setBudgetMutation.mutate(data);
  };

  // 計算本月統計
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthExpenses = Array.isArray(dailyExpenses) 
    ? dailyExpenses.filter(expense => expense.date?.startsWith(currentMonth))
    : [];
  
  const totalSpent = thisMonthExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount?.toString() || '0'), 0);
  const budgetAmount = parseFloat(monthlyBudget?.amount?.toString() || '0');
  const remaining = budgetAmount - totalSpent;
  const spentPercentage = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;

  if (isLoadingBudget || isLoadingExpenses || isLoadingStats) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">家用記帳</h1>
          <p className="text-muted-foreground">簡單記錄，輕鬆管理每月預算</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                快速記帳
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>快速記帳</DialogTitle>
                <DialogDescription>
                  快速記錄今天的支出
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={quickAddForm.handleSubmit(onQuickAdd)} className="space-y-4">
                <div>
                  <Label htmlFor="amount">金額</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="輸入金額"
                    {...quickAddForm.register("amount", { required: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="categoryId">分類</Label>
                  <Select onValueChange={(value: string) => quickAddForm.setValue("categoryId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇分類" />
                    </SelectTrigger>
                    <SelectContent>
                      {householdCategories.map((category: HouseholdCategory) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          <span className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.categoryName}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">備註（可選）</Label>
                  <Textarea
                    id="description"
                    placeholder="簡單備註"
                    {...quickAddForm.register("description")}
                  />
                </div>
                <div>
                  <Label htmlFor="paymentMethod">付款方式</Label>
                  <Select onValueChange={(value: string) => quickAddForm.setValue("paymentMethod", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇付款方式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">現金</SelectItem>
                      <SelectItem value="card">信用卡</SelectItem>
                      <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                      <SelectItem value="mobile_payment">行動支付</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="date">日期</Label>
                  <Input
                    id="date"
                    type="date"
                    {...quickAddForm.register("date", { required: true })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    拍照存證
                  </Button>
                  <span className="text-sm text-muted-foreground">有空再整理</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowQuickAdd(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={addExpenseMutation.isPending}>
                    記錄
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showBudgetSetup} onOpenChange={setShowBudgetSetup}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                設定預算
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>設定每月預算</DialogTitle>
                <DialogDescription>
                  設定每月生活費預算，建立預算概念
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={budgetForm.handleSubmit(onSetBudget)} className="space-y-4">
                <div>
                  <Label htmlFor="monthlyBudget">每月預算</Label>
                  <Input
                    id="monthlyBudget"
                    type="number"
                    step="0.01"
                    placeholder="輸入每月預算"
                    {...budgetForm.register("monthlyBudget", { required: true })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowBudgetSetup(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={setBudgetMutation.isPending}>
                    設定
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 本月預算概況 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">每月預算</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">NT$ {budgetAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已花費</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">NT$ {totalSpent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {spentPercentage.toFixed(1)}% 的預算
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">剩餘預算</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              NT$ {remaining.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {remaining >= 0 ? '還可以花' : '已超支'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">記帳次數</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{thisMonthExpenses.length}</div>
            <p className="text-xs text-muted-foreground">
              本月記錄
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 預算進度條 */}
      {budgetAmount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>本月預算使用狀況</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className={`h-4 rounded-full transition-all duration-300 ${
                  spentPercentage > 100 ? 'bg-red-500' : 
                  spentPercentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(spentPercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>已使用 {spentPercentage.toFixed(1)}%</span>
              <span>{remaining >= 0 ? `還有 NT$ ${remaining.toLocaleString()}` : `超支 NT$ ${Math.abs(remaining).toLocaleString()}`}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 最近記錄 */}
      <Card>
        <CardHeader>
          <CardTitle>最近記錄</CardTitle>
          <CardDescription>
            本月已記錄 {thisMonthExpenses.length} 筆支出
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {thisMonthExpenses.length > 0 ? thisMonthExpenses.slice(0, 10).map((expense: ExpenseWithCategory, index: number) => {
              const category = householdCategories.find((cat: HouseholdCategory) => cat.id === expense.categoryId);
              return (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category?.color || '#gray' }}
                    />
                    <div>
                      <div className="font-medium">{category?.categoryName || expense.categoryName || '其他'}</div>
                      <div className="text-sm text-muted-foreground">{expense.date}</div>
                      {expense.description && (
                        <div className="text-sm text-muted-foreground">{expense.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-red-600">-NT$ {parseInt(expense.amount?.toString() || '0').toLocaleString()}</div>
                    {expense.receiptPhoto && (
                      <Badge variant="outline" className="text-xs">有發票</Badge>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-6 text-muted-foreground">
                還沒有記錄，點擊"快速記帳"開始記錄支出
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
