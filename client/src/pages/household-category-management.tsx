import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// 子元件與型別
import {
  CategoryListPanel,
  CategoryFormDialog,
  CategoryOverviewTab,
  BudgetTab,
  ExpenseTab,
  AnalyticsTab,
  EmptyState,
  categorySchema,
  budgetSchema,
  expenseSchema,
  type CategoryFormData,
  type BudgetFormData,
  type ExpenseFormData,
  type ExpenseFilter,
  type CategoryStats,
} from "@/components/household-category";

// ============================================================
// 家用分類管理主頁面
// 職責：狀態管理 + mutations + 子元件組合
// ============================================================

export default function HouseholdCategoryManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ---- 狀態 ----
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  );
  const [selectedMonth, setSelectedMonth] = useState(
    (new Date().getMonth() + 1).toString().padStart(2, "0")
  );
  const [expenseFilter, setExpenseFilter] = useState<ExpenseFilter>({
    dateRange: "current_month",
    paymentMethod: "all",
    search: "",
  });

  // ---- 資料查詢 ----
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<
    any[]
  >({
    queryKey: ["/api/categories/household"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: budgets = [], isLoading: isLoadingBudgets } = useQuery<any[]>({
    queryKey: [
      `/api/household/budgets?year=${selectedYear}&month=${selectedMonth}`,
    ],
    enabled: !!selectedCategory,
  });

  const { data: expenses = [], isLoading: isLoadingExpenses } = useQuery<
    any[]
  >({
    queryKey: [
      `/api/household/expenses?categoryId=${selectedCategory?.id}&year=${selectedYear}&month=${selectedMonth}`,
    ],
    enabled: !!selectedCategory,
  });

  const { data: categoryStats } = useQuery<CategoryStats>({
    queryKey: [
      `/api/household/category-stats/${selectedCategory?.id}?year=${selectedYear}&month=${selectedMonth}`,
    ],
    enabled: !!selectedCategory,
  });

  // ---- 表單 ----
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
      date: new Date().toISOString().split("T")[0],
      description: "",
      paymentMethod: "cash",
      tags: [],
    },
  });

  // ---- Mutations ----
  const createCategoryMutation = useMutation({
    mutationFn: (data: CategoryFormData) =>
      apiRequest("/api/categories/household", "POST", data),
    onSuccess: () => {
      toast({ title: "成功", description: "分類已新增" });
      queryClient.invalidateQueries({
        queryKey: ["/api/categories/household"],
      });
      setShowCategoryDialog(false);
      categoryForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CategoryFormData }) =>
      apiRequest(`/api/categories/household/${id}`, "PUT", data),
    onSuccess: () => {
      toast({ title: "成功", description: "分類已更新" });
      queryClient.invalidateQueries({
        queryKey: ["/api/categories/household"],
      });
      setEditingCategory(null);
      setShowCategoryDialog(false);
      categoryForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/categories/household/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "成功", description: "分類已刪除" });
      queryClient.invalidateQueries({
        queryKey: ["/api/categories/household"],
      });
      setSelectedCategory(null);
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createBudgetMutation = useMutation({
    mutationFn: (data: BudgetFormData & { categoryId: number }) =>
      apiRequest("/api/household/budgets", "POST", data),
    onSuccess: () => {
      toast({ title: "成功", description: "預算已設定" });
      queryClient.invalidateQueries({
        queryKey: [`/api/household/budgets`],
      });
      setShowBudgetDialog(false);
      budgetForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data: ExpenseFormData & { categoryId: number }) =>
      apiRequest("/api/household/expenses", "POST", data),
    onSuccess: () => {
      toast({ title: "成功", description: "支出已新增" });
      queryClient.invalidateQueries({
        queryKey: [`/api/household/expenses`],
      });
      setShowExpenseDialog(false);
      expenseForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ---- 事件處理 ----
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

  /** 篩選支出記錄 */
  const filteredExpenses = expenses.filter((expense: any) => {
    const searchMatch =
      !expenseFilter.search ||
      expense.description
        ?.toLowerCase()
        .includes(expenseFilter.search.toLowerCase());
    const methodMatch =
      expenseFilter.paymentMethod === "all" ||
      expense.paymentMethod === expenseFilter.paymentMethod;
    return searchMatch && methodMatch;
  });

  // ---- 渲染 ----
  return (
    <div className="space-y-6 p-6">
      {/* 頁面標題列 + 新增分類按鈕 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">家用分類管理</h1>
          <p className="text-gray-600 mt-2">
            管理家用記帳分類、預算設定和支出記錄
          </p>
        </div>
        <CategoryFormDialog
          open={showCategoryDialog}
          onOpenChange={setShowCategoryDialog}
          form={categoryForm}
          editingCategory={editingCategory}
          onSubmit={handleCategorySubmit}
          isPending={
            createCategoryMutation.isPending ||
            updateCategoryMutation.isPending
          }
          onResetEditing={() => setEditingCategory(null)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側分類列表 */}
        <CategoryListPanel
          categories={categories}
          isLoading={isLoadingCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onEditCategory={handleEditCategory}
          onDeleteCategory={(id) => deleteCategoryMutation.mutate(id)}
        />

        {/* 右側詳情區域 */}
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
                <CategoryOverviewTab
                  selectedCategory={selectedCategory}
                  categoryStats={categoryStats}
                />
              </TabsContent>

              <TabsContent value="budget">
                <BudgetTab
                  selectedCategory={selectedCategory}
                  budgets={budgets}
                  isLoadingBudgets={isLoadingBudgets}
                  showBudgetDialog={showBudgetDialog}
                  onShowBudgetDialogChange={setShowBudgetDialog}
                  budgetForm={budgetForm}
                  onBudgetSubmit={handleBudgetSubmit}
                  isBudgetPending={createBudgetMutation.isPending}
                  selectedYear={selectedYear}
                  onYearChange={setSelectedYear}
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                />
              </TabsContent>

              <TabsContent value="expenses">
                <ExpenseTab
                  selectedCategory={selectedCategory}
                  filteredExpenses={filteredExpenses}
                  isLoadingExpenses={isLoadingExpenses}
                  showExpenseDialog={showExpenseDialog}
                  onShowExpenseDialogChange={setShowExpenseDialog}
                  expenseForm={expenseForm}
                  onExpenseSubmit={handleExpenseSubmit}
                  isExpensePending={createExpenseMutation.isPending}
                  expenseFilter={expenseFilter}
                  onFilterChange={setExpenseFilter}
                />
              </TabsContent>

              <TabsContent value="analytics">
                <AnalyticsTab />
              </TabsContent>
            </Tabs>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}
