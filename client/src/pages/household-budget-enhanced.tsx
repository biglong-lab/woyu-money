import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Plus,
  MoreVertical,
  Wallet,
  AlertTriangle,
  Target,
  PieChart,
  Home,
  Car,
  ShoppingCart,
  Utensils,
  Gamepad2,
  Phone,
  Heart,
  GraduationCap,
  Shield,
  Coins,
  Package,
  Receipt,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit3,
  Trash2
} from "lucide-react";

interface HouseholdCategory {
  id: number;
  categoryName: string;
  budget: number;
  spent: number;
}

interface HouseholdExpense {
  id: number;
  categoryId: number;
  amount: string;
  description: string;
  date: string;
  paymentMethod: string;
}

// 生活化的分類圖示映射
const getCategoryIcon = (categoryName: string) => {
  const iconMap: { [key: string]: any } = {
    '食物費用': Utensils,
    '交通費用': Car,
    '服裝費用': ShoppingCart,
    '居住費用': Home,
    '醫療費用': Heart,
    '教育費用': GraduationCap,
    '娛樂費用': Gamepad2,
    '保險費用': Shield,
    '儲蓄投資': Coins,
    '日用品費用': Package,
    '通訊費用': Phone,
    '其他費用': Receipt
  };
  return iconMap[categoryName] || Receipt;
};

// 生活化的分類顏色映射
const getCategoryColor = (categoryName: string) => {
  const colorMap: { [key: string]: string } = {
    '食物費用': 'bg-orange-100 text-orange-800 border-orange-200',
    '交通費用': 'bg-blue-100 text-blue-800 border-blue-200',
    '服裝費用': 'bg-pink-100 text-pink-800 border-pink-200',
    '居住費用': 'bg-green-100 text-green-800 border-green-200',
    '醫療費用': 'bg-red-100 text-red-800 border-red-200',
    '教育費用': 'bg-purple-100 text-purple-800 border-purple-200',
    '娛樂費用': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    '保險費用': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    '儲蓄投資': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    '日用品費用': 'bg-gray-100 text-gray-800 border-gray-200',
    '通訊費用': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    '其他費用': 'bg-slate-100 text-slate-800 border-slate-200'
  };
  return colorMap[categoryName] || 'bg-gray-100 text-gray-800 border-gray-200';
};

export default function HouseholdBudgetEnhanced() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [budgetDialogOpen, setBudgetDialogOpen] = useState<{open: boolean, categoryId?: number}>({open: false});
  const [expenseDialogOpen, setExpenseDialogOpen] = useState<{open: boolean, categoryId?: number}>({open: false});
  const [categoryDetailOpen, setCategoryDetailOpen] = useState<{open: boolean, categoryId?: number}>({open: false});

  // Fetch household budget data
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<HouseholdCategory[]>({
    queryKey: ['/api/household/categories'],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch household expenses
  const { data: expenses = [], isLoading: expensesLoading } = useQuery<HouseholdExpense[]>({
    queryKey: ['/api/household/expenses'],
    staleTime: 5 * 60 * 1000,
  });

  // Add expense mutation
  const addExpenseMutation = useMutation({
    mutationFn: async (expenseData: any) => {
      const response = await apiRequest("POST", "/api/household/expenses", expenseData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/household/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/household/categories'] });
      setExpenseDialogOpen({open: false});
      toast({
        title: "支出新增成功",
        description: "支出記錄已成功新增到系統中",
      });
    },
    onError: (error: any) => {
      toast({
        title: "新增失敗",
        description: error.message || "無法新增支出記錄",
        variant: "destructive",
      });
    },
  });

  // Calculate overall statistics
  const overallStats = {
    totalBudget: categories.reduce((sum, cat) => sum + cat.budget, 0),
    totalSpent: categories.reduce((sum, cat) => sum + cat.spent, 0),
    categoriesCount: categories.length,
    overBudgetCount: categories.filter(cat => cat.spent > cat.budget).length,
  };

  const overallProgress = overallStats.totalBudget > 0 
    ? (overallStats.totalSpent / overallStats.totalBudget) * 100 
    : 0;

  if (categoriesLoading || expensesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="w-8 h-8 text-blue-600" />
            家用預算管理
          </h1>
          <p className="text-gray-600 mt-1">
            管理家庭支出預算，追蹤各項開支
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={() => setExpenseDialogOpen({open: true})}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新增支出
          </Button>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">總預算</p>
                <p className="text-2xl font-bold">NT$ {overallStats.totalBudget.toLocaleString()}</p>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">已支出</p>
                <p className="text-2xl font-bold text-red-600">NT$ {overallStats.totalSpent.toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">使用率</p>
                <p className="text-2xl font-bold">{overallProgress.toFixed(1)}%</p>
              </div>
              <PieChart className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">超支分類</p>
                <p className="text-2xl font-bold text-orange-600">{overallStats.overBudgetCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            總體預算概況
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>預算執行進度</span>
              <span>{overallProgress.toFixed(1)}% 已使用</span>
            </div>
            <Progress value={Math.min(overallProgress, 100)} className="h-3" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>NT$ 0</span>
              <span>NT$ {overallStats.totalBudget.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => {
          const IconComponent = getCategoryIcon(category.categoryName);
          const progress = category.budget > 0 ? (category.spent / category.budget) * 100 : 0;
          const isOverBudget = category.spent > category.budget;
          const remaining = category.budget - category.spent;

          return (
            <Card key={category.id} className={`transition-all hover:shadow-lg ${isOverBudget ? 'border-red-200 bg-red-50/30' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getCategoryColor(category.categoryName)}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{category.categoryName}</CardTitle>
                      <p className="text-sm text-gray-500">
                        {remaining >= 0 ? `剩餘 NT$ ${remaining.toLocaleString()}` : `超支 NT$ ${Math.abs(remaining).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setExpenseDialogOpen({open: true, categoryId: category.id})}>
                        <Plus className="w-4 h-4 mr-2" />
                        新增支出
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCategoryDetailOpen({open: true, categoryId: category.id})}>
                        <Eye className="w-4 h-4 mr-2" />
                        查看詳情
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setBudgetDialogOpen({open: true, categoryId: category.id})}>
                        <Edit3 className="w-4 h-4 mr-2" />
                        調整預算
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">已支出</span>
                    <span className={`font-semibold ${isOverBudget ? 'text-red-600' : 'text-gray-900'}`}>
                      NT$ {category.spent.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">預算</span>
                    <span className="font-semibold text-gray-900">
                      NT$ {category.budget.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>進度</span>
                      <span className={progress > 100 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                        {progress.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(progress, 100)} 
                      className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : ''}`}
                    />
                    {isOverBudget && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        超出預算
                      </Badge>
                    )}
                  </div>

                  <Button 
                    onClick={() => setExpenseDialogOpen({open: true, categoryId: category.id})}
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    快速新增支出
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={expenseDialogOpen.open} onOpenChange={(open) => setExpenseDialogOpen({open})}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              新增支出記錄
            </DialogTitle>
            <DialogDescription>
              新增一筆家庭支出記錄到指定分類
            </DialogDescription>
          </DialogHeader>
          
          <AddExpenseForm 
            categories={categories}
            selectedCategoryId={expenseDialogOpen.categoryId}
            onSubmit={(data) => addExpenseMutation.mutate(data)}
            isLoading={addExpenseMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Category Detail Dialog */}
      <Dialog open={categoryDetailOpen.open} onOpenChange={(open) => setCategoryDetailOpen({open})}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              分類詳情
            </DialogTitle>
          </DialogHeader>
          
          {categoryDetailOpen.categoryId && (
            <CategoryDetailView 
              categoryId={categoryDetailOpen.categoryId}
              expenses={expenses.filter(exp => exp.categoryId === categoryDetailOpen.categoryId)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Quick Add Expense Form Component
function AddExpenseForm({ 
  categories, 
  selectedCategoryId, 
  onSubmit, 
  isLoading 
}: {
  categories: HouseholdCategory[];
  selectedCategoryId?: number;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    categoryId: selectedCategoryId || '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: '現金'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryId || !formData.amount) return;
    
    onSubmit({
      categoryId: parseInt(formData.categoryId.toString()),
      amount: formData.amount,
      description: formData.description || '日常支出',
      date: formData.date,
      paymentMethod: formData.paymentMethod
    });
  };

  const selectedCategory = categories.find(cat => cat.id === parseInt(formData.categoryId.toString()));
  const IconComponent = selectedCategory ? getCategoryIcon(selectedCategory.categoryName) : Receipt;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category">支出分類</Label>
        <Select 
          value={formData.categoryId.toString()} 
          onValueChange={(value) => setFormData(prev => ({...prev, categoryId: value}))}
        >
          <SelectTrigger>
            <SelectValue placeholder="選擇支出分類" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(category => {
              const Icon = getCategoryIcon(category.categoryName);
              return (
                <SelectItem key={category.id} value={category.id.toString()}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {category.categoryName}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {selectedCategory && (
        <div className={`p-3 rounded-lg border ${getCategoryColor(selectedCategory.categoryName)}`}>
          <div className="flex items-center gap-2 mb-2">
            <IconComponent className="w-4 h-4" />
            <span className="font-medium">{selectedCategory.categoryName}</span>
          </div>
          <div className="text-sm">
            <span>預算餘額: NT$ {(selectedCategory.budget - selectedCategory.spent).toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">支出金額</Label>
          <Input
            id="amount"
            type="number"
            placeholder="輸入金額"
            value={formData.amount}
            onChange={(e) => setFormData(prev => ({...prev, amount: e.target.value}))}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">支出日期</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({...prev, date: e.target.value}))}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">支出說明 (選填)</Label>
        <Input
          id="description"
          placeholder="例如：午餐、油錢、買菜..."
          value={formData.description}
          onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="paymentMethod">付款方式</Label>
        <Select 
          value={formData.paymentMethod} 
          onValueChange={(value) => setFormData(prev => ({...prev, paymentMethod: value}))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="現金">💵 現金</SelectItem>
            <SelectItem value="信用卡">💳 信用卡</SelectItem>
            <SelectItem value="金融卡">🏧 金融卡</SelectItem>
            <SelectItem value="電子支付">📱 電子支付</SelectItem>
            <SelectItem value="轉帳">🏦 轉帳</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading || !formData.categoryId || !formData.amount}>
          {isLoading ? (
            <>
              <Clock className="w-4 h-4 mr-2 animate-spin" />
              新增中...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              新增支出
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Category Detail View Component
function CategoryDetailView({ categoryId, expenses }: { categoryId: number; expenses: HouseholdExpense[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>本月支出記錄</Label>
          <div className="text-2xl font-bold">
            {expenses.length} 筆
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>總支出金額</Label>
          <div className="text-2xl font-bold">
            NT$ {expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || '0'), 0).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label>最近支出記錄</Label>
        <div className="max-h-60 overflow-y-auto space-y-2">
          {expenses.slice(0, 10).map(expense => (
            <div key={expense.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">{expense.description || '支出'}</div>
                <div className="text-sm text-gray-500">{expense.date} · {expense.paymentMethod}</div>
              </div>
              <div className="font-semibold">
                NT$ {parseFloat(expense.amount || '0').toLocaleString()}
              </div>
            </div>
          ))}
          
          {expenses.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              此分類暫無支出記錄
            </div>
          )}
        </div>
      </div>
    </div>
  );
}