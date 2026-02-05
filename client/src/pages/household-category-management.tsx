import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Edit,
  Plus,
  Trash2,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  Receipt,
  Target,
  BarChart3,
  Filter,
  Search,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Form schemas
const categorySchema = z.object({
  categoryName: z.string().min(1, "分類名稱為必填"),
  categoryType: z.string().min(1, "分類類型為必填"),
  description: z.string().optional(),
});

const budgetSchema = z.object({
  month: z.string().min(1, "月份為必填"),
  budgetAmount: z.string().min(1, "預算金額為必填"),
  notes: z.string().optional(),
});

const expenseSchema = z.object({
  amount: z.string().min(1, "金額為必填"),
  date: z.string().min(1, "日期為必填"),
  description: z.string().optional(),
  paymentMethod: z.string().min(1, "付款方式為必填"),
  tags: z.array(z.string()).optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;
type BudgetFormData = z.infer<typeof budgetSchema>;
type ExpenseFormData = z.infer<typeof expenseSchema>;

export default function HouseholdCategoryManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [expenseFilter, setExpenseFilter] = useState({
    dateRange: "current_month",
    paymentMethod: "all",
    search: "",
  });

  // Data queries
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<any[]>({
    queryKey: ["/api/categories/household"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: budgets = [], isLoading: isLoadingBudgets } = useQuery<any[]>({
    queryKey: [`/api/household/budgets?year=${selectedYear}&month=${selectedMonth}`],
    enabled: !!selectedCategory,
  });

  const { data: expenses = [], isLoading: isLoadingExpenses } = useQuery<any[]>({
    queryKey: [`/api/household/expenses?categoryId=${selectedCategory?.id}&year=${selectedYear}&month=${selectedMonth}`],
    enabled: !!selectedCategory,
  });

  const { data: categoryStats } = useQuery<any>({
    queryKey: [`/api/household/category-stats/${selectedCategory?.id}?year=${selectedYear}&month=${selectedMonth}`],
    enabled: !!selectedCategory,
  });

  // Forms
  const categoryForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      categoryName: "",
      categoryType: "household",
      description: "",
    },
  });

  const budgetForm = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      month: `${selectedYear}-${selectedMonth}`,
      budgetAmount: "",
      notes: "",
    },
  });

  const expenseForm = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: "",
      date: new Date().toISOString().split('T')[0],
      description: "",
      paymentMethod: "cash",
      tags: [],
    },
  });

  // Mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data: CategoryFormData) => apiRequest("/api/categories/household", "POST", data),
    onSuccess: () => {
      toast({ title: "成功", description: "分類已新增" });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/household"] });
      setShowCategoryDialog(false);
      categoryForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message, variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CategoryFormData }) =>
      apiRequest(`/api/categories/household/${id}`, "PUT", data),
    onSuccess: () => {
      toast({ title: "成功", description: "分類已更新" });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/household"] });
      setEditingCategory(null);
      setShowCategoryDialog(false);
      categoryForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message, variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/categories/household/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "成功", description: "分類已刪除" });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/household"] });
      setSelectedCategory(null);
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message, variant: "destructive" });
    },
  });

  const createBudgetMutation = useMutation({
    mutationFn: (data: BudgetFormData & { categoryId: number }) =>
      apiRequest("/api/household/budgets", "POST", data),
    onSuccess: () => {
      toast({ title: "成功", description: "預算已設定" });
      queryClient.invalidateQueries({ queryKey: [`/api/household/budgets`] });
      setShowBudgetDialog(false);
      budgetForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message, variant: "destructive" });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data: ExpenseFormData & { categoryId: number }) =>
      apiRequest("/api/household/expenses", "POST", data),
    onSuccess: () => {
      toast({ title: "成功", description: "支出已新增" });
      queryClient.invalidateQueries({ queryKey: [`/api/household/expenses`] });
      setShowExpenseDialog(false);
      expenseForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message, variant: "destructive" });
    },
  });

  // Handlers
  const handleCategorySubmit = (data: CategoryFormData) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data });
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const handleBudgetSubmit = (data: BudgetFormData) => {
    if (!selectedCategory) return;
    createBudgetMutation.mutate({ ...data, categoryId: selectedCategory.id });
  };

  const handleExpenseSubmit = (data: ExpenseFormData) => {
    if (!selectedCategory) return;
    createExpenseMutation.mutate({ ...data, categoryId: selectedCategory.id });
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    categoryForm.reset({
      categoryName: category.categoryName,
      categoryType: category.categoryType,
      description: category.description || "",
    });
    setShowCategoryDialog(true);
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return isNaN(num) ? "0" : num.toLocaleString();
  };

  const getBudgetProgress = () => {
    if (!categoryStats || !categoryStats.currentBudget) return 0;
    const spent = parseFloat(categoryStats.totalExpenses || "0");
    const budget = parseFloat(categoryStats.currentBudget || "0");
    return budget > 0 ? (spent / budget) * 100 : 0;
  };

  const filteredExpenses = expenses.filter((expense: any) => {
    const searchMatch = !expenseFilter.search || 
      expense.description?.toLowerCase().includes(expenseFilter.search.toLowerCase());
    const methodMatch = expenseFilter.paymentMethod === "all" || 
      expense.paymentMethod === expenseFilter.paymentMethod;
    return searchMatch && methodMatch;
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">家用分類管理</h1>
          <p className="text-gray-600 mt-2">管理家用記帳分類、預算設定和支出記錄</p>
        </div>
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingCategory(null);
              categoryForm.reset();
            }}>
              <Plus className="h-4 w-4 mr-2" />
              新增分類
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? "編輯分類" : "新增分類"}</DialogTitle>
              <DialogDescription>
                {editingCategory ? "修改分類資訊" : "建立新的家用記帳分類"}
              </DialogDescription>
            </DialogHeader>
            <Form {...categoryForm}>
              <form onSubmit={categoryForm.handleSubmit(handleCategorySubmit)} className="space-y-4">
                <FormField
                  control={categoryForm.control}
                  name="categoryName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>分類名稱</FormLabel>
                      <FormControl>
                        <Input placeholder="例：食物、交通、娛樂" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={categoryForm.control}
                  name="categoryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>分類類型</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <FormField
                  control={categoryForm.control}
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
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCategoryDialog(false)}
                  >
                    取消
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                  >
                    {editingCategory ? "更新" : "新增"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Categories List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              分類列表
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {isLoadingCategories ? (
                <div className="text-center py-4">載入中...</div>
              ) : categories.length === 0 ? (
                <div className="text-center py-4 text-gray-500">暫無分類</div>
              ) : (
                categories.map((category: any) => (
                  <div
                    key={category.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCategory?.id === category.id
                        ? "bg-blue-50 border-blue-200"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{category.categoryName}</h3>
                        <p className="text-sm text-gray-500">{category.categoryType}</p>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCategory(category);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("確定要刪除此分類嗎？")) {
                              deleteCategoryMutation.mutate(category.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category Details */}
        <div className="lg:col-span-2">
          {selectedCategory ? (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">概覽</TabsTrigger>
                <TabsTrigger value="budget">預算管理</TabsTrigger>
                <TabsTrigger value="expenses">支出記錄</TabsTrigger>
                <TabsTrigger value="analytics">分析報告</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Eye className="h-5 w-5 mr-2" />
                      {selectedCategory.categoryName} - 概覽
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Category Info */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">分類資訊</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">分類名稱</p>
                          <p className="font-medium">{selectedCategory.categoryName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">分類類型</p>
                          <Badge variant="outline">{selectedCategory.categoryType}</Badge>
                        </div>
                      </div>
                      {selectedCategory.description && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-500">描述</p>
                          <p className="text-sm">{selectedCategory.description}</p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Current Month Stats */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-4">本月統計</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <Target className="h-6 w-6 mx-auto text-blue-600 mb-2" />
                          <p className="text-sm text-gray-600">預算金額</p>
                          <p className="text-xl font-bold text-blue-600">
                            NT$ {formatCurrency(categoryStats?.currentBudget || "0")}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <DollarSign className="h-6 w-6 mx-auto text-green-600 mb-2" />
                          <p className="text-sm text-gray-600">總支出</p>
                          <p className="text-xl font-bold text-green-600">
                            NT$ {formatCurrency(categoryStats?.totalExpenses || "0")}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg">
                          <TrendingUp className="h-6 w-6 mx-auto text-orange-600 mb-2" />
                          <p className="text-sm text-gray-600">剩餘預算</p>
                          <p className="text-xl font-bold text-orange-600">
                            NT$ {formatCurrency(
                              (parseFloat(categoryStats?.currentBudget || "0") - 
                               parseFloat(categoryStats?.totalExpenses || "0")).toString()
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Budget Progress */}
                      {categoryStats?.currentBudget && (
                        <div className="mt-4">
                          <div className="flex justify-between text-sm text-gray-600 mb-2">
                            <span>預算使用率</span>
                            <span>{getBudgetProgress().toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                getBudgetProgress() > 100 ? "bg-red-500" : 
                                getBudgetProgress() > 80 ? "bg-orange-500" : "bg-green-500"
                              }`}
                              style={{ width: `${Math.min(getBudgetProgress(), 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="budget">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center">
                        <Target className="h-5 w-5 mr-2" />
                        預算管理
                      </span>
                      <Dialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
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
                            <form onSubmit={budgetForm.handleSubmit(handleBudgetSubmit)} className="space-y-4">
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
                              <div className="flex justify-end space-x-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setShowBudgetDialog(false)}
                                >
                                  取消
                                </Button>
                                <Button 
                                  type="submit"
                                  disabled={createBudgetMutation.isPending}
                                >
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
                      {/* Month Selector */}
                      <div className="flex space-x-4">
                        <div>
                          <label className="text-sm font-medium">年份</label>
                          <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">月份</label>
                          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(month => (
                                <SelectItem key={month} value={month}>{month}月</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Budget List */}
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
                                  <TableCell>NT$ {formatCurrency(budget.budgetAmount)}</TableCell>
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
              </TabsContent>

              <TabsContent value="expenses">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center">
                        <Receipt className="h-5 w-5 mr-2" />
                        支出記錄
                      </span>
                      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
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
                            <form onSubmit={expenseForm.handleSubmit(handleExpenseSubmit)} className="space-y-4">
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
                              <FormField
                                control={expenseForm.control}
                                name="paymentMethod"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>付款方式</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="cash">現金</SelectItem>
                                        <SelectItem value="credit_card">信用卡</SelectItem>
                                        <SelectItem value="debit_card">金融卡</SelectItem>
                                        <SelectItem value="transfer">轉帳</SelectItem>
                                        <SelectItem value="mobile_payment">行動支付</SelectItem>
                                        <SelectItem value="other">其他</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
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
                              <div className="flex justify-end space-x-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setShowExpenseDialog(false)}
                                >
                                  取消
                                </Button>
                                <Button 
                                  type="submit"
                                  disabled={createExpenseMutation.isPending}
                                >
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
                      {/* Filters */}
                      <div className="flex space-x-4">
                        <div className="flex-1">
                          <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                              placeholder="搜尋支出記錄..."
                              className="pl-10"
                              value={expenseFilter.search}
                              onChange={(e) => setExpenseFilter(prev => ({ ...prev, search: e.target.value }))}
                            />
                          </div>
                        </div>
                        <Select 
                          value={expenseFilter.paymentMethod} 
                          onValueChange={(value) => setExpenseFilter(prev => ({ ...prev, paymentMethod: value }))}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">所有付款方式</SelectItem>
                            <SelectItem value="cash">現金</SelectItem>
                            <SelectItem value="credit_card">信用卡</SelectItem>
                            <SelectItem value="debit_card">金融卡</SelectItem>
                            <SelectItem value="transfer">轉帳</SelectItem>
                            <SelectItem value="mobile_payment">行動支付</SelectItem>
                            <SelectItem value="other">其他</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Expense List */}
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
                                  <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                                  <TableCell>NT$ {formatCurrency(expense.amount)}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{expense.paymentMethod}</Badge>
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
              </TabsContent>

              <TabsContent value="analytics">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2" />
                      分析報告
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-gray-500">
                      分析報告功能開發中...
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">選擇分類</h3>
                  <p className="text-gray-500">請從左側選擇一個分類來查看詳細資訊</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}