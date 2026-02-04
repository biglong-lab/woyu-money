import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  PiggyBank, 
  TrendingDown, 
  TrendingUp, 
  MoreVertical, 
  Plus, 
  AlertTriangle, 
  Coffee,
  Home,
  Car,
  ShoppingCart,
  Heart,
  Gamepad2,
  Calendar,
  Target,
  CheckCircle,
  Camera,
  Image,
  X,
  Upload,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function HouseholdBudgetLifestyle() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [budgetDialogOpen, setBudgetDialogOpen] = useState({ open: false, categoryId: 0 });
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [quickExpenseDialogOpen, setQuickExpenseDialogOpen] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<{url: string, note?: string}[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [categoryDetailOpen, setCategoryDetailOpen] = useState({ open: false, categoryId: 0, categoryName: '' });
  const [budgetPlanOpen, setBudgetPlanOpen] = useState(false);

  // Data queries
  const { data: householdCategories = [] } = useQuery({
    queryKey: ["/api/categories/household"],
    staleTime: 10 * 60 * 1000,
  });

  const { data: categoryBudgets = [] } = useQuery({
    queryKey: [`/api/household/budgets?year=${selectedYear}&month=${selectedMonth}`],
  });

  const { data: expenses = [] } = useQuery({
    queryKey: [`/api/household/expenses?year=${selectedYear}&month=${selectedMonth}`],
  });

  // Mutations
  const updateBudgetMutation = useMutation({
    mutationFn: async (data: { categoryId: number; month: string; budgetAmount: string }) => {
      return await apiRequest(`/api/household/budgets`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/household/budgets"] });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/household/budgets?year=${selectedYear}&month=${selectedMonth}`] 
      });
      queryClient.refetchQueries({ 
        queryKey: [`/api/household/budgets?year=${selectedYear}&month=${selectedMonth}`] 
      });
      setBudgetDialogOpen({ open: false, categoryId: 0 });
      toast({
        title: "🎯 預算調整完成",
        description: "新的預算目標已設定",
      });
    },
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/household/expenses`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/household/expenses"] });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/household/expenses?year=${selectedYear}&month=${selectedMonth}`] 
      });
      queryClient.refetchQueries({ 
        queryKey: [`/api/household/expenses?year=${selectedYear}&month=${selectedMonth}`] 
      });
      setExpenseDialogOpen(false);
      setQuickExpenseDialogOpen(false);
      setUploadedImages([]);
      toast({
        title: "💰 記帳完成",
        description: "新的支出已記錄",
      });
    },
  });

  // Image upload functions
  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('images', file);
      });

      const response = await fetch('/api/upload/receipt-images', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('上傳失敗');
      }

      const result = await response.json();
      const newImages = result.imageUrls.map((url: string) => ({ url, note: '' }));
      setUploadedImages(prev => [...prev, ...newImages]);
      
      toast({
        title: "📸 照片上傳成功",
        description: `已上傳 ${result.imageUrls.length} 張圖片`,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "上傳失敗",
        description: error.message || "請重試",
        variant: "destructive",
      });
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (imageUrl: string) => {
    setUploadedImages(prev => prev.filter(img => img.url !== imageUrl));
  };

  const updateImageNote = (imageUrl: string, note: string) => {
    setUploadedImages(prev => 
      prev.map(img => img.url === imageUrl ? { ...img, note } : img)
    );
  };

  // Helper functions
  const getCategoryStats = (categoryId: number) => {
    const budgetRecord = categoryBudgets.find((b: any) => b.categoryId === categoryId);
    const budget = budgetRecord?.budgetAmount || 0;
    const spent = expenses
      .filter((e: any) => e.categoryId === categoryId)
      .reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0);
    
    // 如果沒有設定預算但有支出，餘額應該顯示負數
    const remaining = budget === 0 && spent > 0 ? -spent : budget - spent;
    const spentPercentage = budget > 0 ? (spent / budget) * 100 : 0;
    const isOverBudget = spent > budget && budget > 0;

    return {
      budget: parseFloat(budget.toString()),
      spent,
      remaining,
      spentPercentage,
      isOverBudget,
      hasNoBudget: budget === 0 && spent > 0
    };
  };

  // Overall statistics
  const getOverallStats = () => {
    const totalBudget = categoryBudgets.reduce((sum: number, b: any) => sum + parseFloat(b.budgetAmount || 0), 0);
    const totalSpent = expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0);
    const remaining = totalBudget - totalSpent;
    const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    
    const categoriesWithBudget = householdCategories.filter((cat: any) => 
      categoryBudgets.some((b: any) => b.categoryId === cat.id)
    ).length;
    
    const overBudgetCategories = householdCategories.filter((cat: any) => {
      const stats = getCategoryStats(cat.id);
      return stats.isOverBudget;
    }).length;

    return {
      totalBudget,
      totalSpent,
      remaining,
      spentPercentage,
      categoriesWithBudget,
      overBudgetCategories,
      isOverBudget: totalSpent > totalBudget && totalBudget > 0
    };
  };

  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('食') || name.includes('餐') || name.includes('飲')) return Coffee;
    if (name.includes('房') || name.includes('租') || name.includes('水電')) return Home;
    if (name.includes('交通') || name.includes('車') || name.includes('油')) return Car;
    if (name.includes('購物') || name.includes('衣') || name.includes('生活')) return ShoppingCart;
    if (name.includes('醫療') || name.includes('健康') || name.includes('保險')) return Heart;
    if (name.includes('娛樂') || name.includes('遊戲') || name.includes('休閒')) return Gamepad2;
    return PiggyBank;
  };

  // Get categories that should be displayed (have budget OR have expenses)
  const getDisplayCategories = () => {
    return householdCategories.filter((category: any) => {
      const budget = categoryBudgets.find((b: any) => b.categoryId === category.id);
      const hasExpenses = expenses.some((expense: any) => expense.categoryId === category.id);
      return (budget && budget.budgetAmount > 0) || hasExpenses;
    });
  };

  // Get categories with budgets for budget plan dialog
  const getCategoriesWithBudgets = () => {
    return householdCategories.filter((category: any) => {
      const budget = categoryBudgets.find((b: any) => b.categoryId === category.id);
      return budget && budget.budgetAmount > 0;
    });
  };

  // Get recent expenses (latest 10)
  const getRecentExpenses = () => {
    return expenses
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString().padStart(2, '0'),
    label: `${i + 1}月`
  }));

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - 2 + i;
    return { value: year.toString(), label: `${year}年` };
  });

  const overallStats = getOverallStats();

  return (
    <div className="container mx-auto p-6 space-y-6 bg-gradient-to-br from-blue-50 to-purple-50 min-h-screen">
      {/* Header with Fun Title */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-3">
          <PiggyBank className="w-8 h-8 text-pink-500" />
          我的小金庫
          <PiggyBank className="w-8 h-8 text-pink-500" />
        </h1>
        <p className="text-gray-600">輕鬆管理生活開支，讓每一分錢都花得有意義</p>
      </div>

      {/* Quick Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-green-400 to-green-500 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">本月預算</p>
                <p className="text-2xl font-bold">NT$ {overallStats.totalBudget.toLocaleString()}</p>
              </div>
              <Target className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-400 to-blue-500 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">已花費</p>
                <p className="text-2xl font-bold">NT$ {overallStats.totalSpent.toLocaleString()}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-r ${overallStats.isOverBudget ? 'from-red-400 to-red-500' : 'from-purple-400 to-purple-500'} text-white`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">
                  {overallStats.isOverBudget ? "超支金額" : "剩餘預算"}
                </p>
                <p className="text-2xl font-bold">NT$ {Math.abs(overallStats.remaining).toLocaleString()}</p>
              </div>
              {overallStats.isOverBudget ? 
                <AlertTriangle className="w-8 h-8 text-red-200" /> :
                <TrendingUp className="w-8 h-8 text-purple-200" />
              }
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-400 to-orange-500 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">使用率</p>
                <p className="text-2xl font-bold">{overallStats.spentPercentage.toFixed(1)}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fun Progress Bar */}
      {overallStats.totalBudget > 0 && (
        <Card className="bg-white/80 backdrop-blur">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-700">本月預算執行進度</h3>
                <Badge variant={overallStats.isOverBudget ? "destructive" : "default"} className="text-sm">
                  {overallStats.isOverBudget ? "超支警告" : "預算控制中"}
                </Badge>
              </div>
              <Progress 
                value={Math.min(overallStats.spentPercentage, 100)} 
                className="h-4"
              />
              <div className="flex justify-between text-sm text-gray-600">
                <span>預算運用: {overallStats.spentPercentage.toFixed(1)}%</span>
                <span>
                  {overallStats.overBudgetCategories > 0 
                    ? `${overallStats.overBudgetCategories} 個分類超支`
                    : "所有分類在預算內"
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month/Year Selection */}
      <Card className="bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              查看月份
            </div>
            <Button
              onClick={() => setBudgetPlanOpen(true)}
              variant="outline"
              size="sm"
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
            >
              <Target className="w-4 h-4 mr-2" />
              預算設定
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Label>年份：</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>月份：</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Add Expense Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Dialog open={quickExpenseDialogOpen} onOpenChange={setQuickExpenseDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              size="lg" 
              className="rounded-full w-16 h-16 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Plus className="w-8 h-8" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-pink-500" />
                快速記帳
              </DialogTitle>
              <DialogDescription>
                記錄您的日常開支
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const data = {
                categoryId: formData.get('categoryId') as string,
                amount: formData.get('amount') as string,
                date: formData.get('date') as string,
                description: formData.get('description') as string,
                paymentMethod: formData.get('paymentMethod') as string || 'cash',
                receiptImages: uploadedImages.length > 0 ? uploadedImages : undefined
              };
              addExpenseMutation.mutate(data);
            }} className="space-y-4">
              <div>
                <Label htmlFor="categoryId">支出分類</Label>
                <Select name="categoryId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇分類" />
                  </SelectTrigger>
                  <SelectContent>
                    {householdCategories.map((category: any) => {
                      const IconComponent = getCategoryIcon(category.categoryName);
                      return (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="w-4 h-4" style={{ color: category.color }} />
                            {category.categoryName}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="amount">金額</Label>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="輸入金額"
                  required
                />
              </div>

              <div>
                <Label htmlFor="date">日期</Label>
                <Input
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">說明 (選填)</Label>
                <Input
                  name="description"
                  placeholder="例如：午餐、加油、購物等"
                />
              </div>

              <div>
                <Label htmlFor="paymentMethod">付款方式</Label>
                <Select name="paymentMethod" defaultValue="cash">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">💵 現金</SelectItem>
                    <SelectItem value="credit_card">💳 信用卡</SelectItem>
                    <SelectItem value="debit_card">🏧 金融卡</SelectItem>
                    <SelectItem value="transfer">🏦 轉帳</SelectItem>
                    <SelectItem value="mobile_payment">📱 行動支付</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload Section */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  上傳發票或照片 (選填)
                </Label>
                
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleImageUpload(e.target.files)}
                    className="hidden"
                    id="image-upload"
                    disabled={uploadingImages}
                  />
                  <label
                    htmlFor="image-upload"
                    className={`flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      uploadingImages 
                        ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                        : 'border-pink-300 bg-pink-50 hover:border-pink-400 hover:bg-pink-100'
                    }`}
                  >
                    {uploadingImages ? (
                      <>
                        <Upload className="w-5 h-5 text-gray-400 animate-spin" />
                        <span className="text-gray-500">上傳中...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-5 h-5 text-pink-500" />
                        <span className="text-pink-600">點擊上傳圖片</span>
                      </>
                    )}
                  </label>
                </div>

                {/* Display uploaded images */}
                {uploadedImages.length > 0 && (
                  <div className="space-y-3">
                    {uploadedImages.map((image, index) => (
                      <div key={index} className="relative group border rounded-lg p-3 bg-gray-50">
                        <div className="flex gap-3">
                          <img
                            src={image.url}
                            alt={`Receipt ${index + 1}`}
                            className="w-16 h-16 object-cover rounded border"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">
                                圖片 {index + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeImage(image.url)}
                                className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <input
                              type="text"
                              placeholder="為此照片添加備註..."
                              value={image.note || ''}
                              onChange={(e) => updateImageNote(image.url, e.target.value)}
                              className="w-full px-2 py-1 text-sm border rounded bg-white focus:ring-1 focus:ring-pink-300 focus:border-pink-300"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  📸 支援 JPG、PNG 格式，最多上傳 5 張圖片
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setQuickExpenseDialogOpen(false)}
                >
                  取消
                </Button>
                <Button 
                  type="submit" 
                  disabled={addExpenseMutation.isPending}
                  className="bg-gradient-to-r from-pink-500 to-rose-500"
                >
                  {addExpenseMutation.isPending ? "記錄中..." : "記帳完成"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category Budget Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {getDisplayCategories().map((category: any) => {
          const stats = getCategoryStats(category.id);
          const IconComponent = getCategoryIcon(category.categoryName);
          
          return (
            <Card 
              key={category.id} 
              className="bg-white/80 backdrop-blur hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
              onClick={() => setCategoryDetailOpen({ open: true, categoryId: category.id, categoryName: category.categoryName })}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full" style={{ backgroundColor: `${category.color}20` }}>
                      <IconComponent className="w-5 h-5" style={{ color: category.color }} />
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{category.categoryName}</p>
                      <p className="text-sm text-gray-500">
                        {stats.budget > 0 ? `預算 NT$ ${stats.budget.toLocaleString()}` : "未設定預算"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {(stats.isOverBudget || stats.hasNoBudget) && (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setBudgetDialogOpen({ open: true, categoryId: category.id });
                        }}>
                          <Target className="w-4 h-4 mr-2" />
                          調整預算
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setCategoryDetailOpen({ open: true, categoryId: category.id, categoryName: category.categoryName });
                        }}>
                          <FileText className="w-4 h-4 mr-2" />
                          查看明細
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-600 mb-1">已花費</p>
                      <p className="text-lg font-bold text-red-700">
                        NT$ {stats.spent.toLocaleString()}
                      </p>
                    </div>
                    <div className={`text-center p-3 rounded-lg ${(stats.isOverBudget || stats.hasNoBudget) ? 'bg-red-100' : 'bg-green-50'}`}>
                      <p className={`text-xs mb-1 ${(stats.isOverBudget || stats.hasNoBudget) ? 'text-red-600' : 'text-green-600'}`}>
                        {stats.hasNoBudget ? "無預算支出" : stats.isOverBudget ? "超支" : "剩餘"}
                      </p>
                      <p className={`text-lg font-bold ${(stats.isOverBudget || stats.hasNoBudget) ? 'text-red-700' : 'text-green-700'}`}>
                        NT$ {Math.abs(stats.remaining).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {stats.budget > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>使用率</span>
                        <span className={stats.spentPercentage > 100 ? "text-red-600 font-semibold" : ""}>
                          {stats.spentPercentage.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(stats.spentPercentage, 100)} 
                        className="h-3"
                      />
                      {stats.spentPercentage > 100 && (
                        <p className="text-xs text-red-600 text-center font-medium">
                          已超出預算 {(stats.spentPercentage - 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Budget Adjustment Dialog */}
      <Dialog open={budgetDialogOpen.open} onOpenChange={(open) => setBudgetDialogOpen({ ...budgetDialogOpen, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              調整預算目標
            </DialogTitle>
            <DialogDescription>
              為 {selectedYear}年{selectedMonth}月 設定新的預算額度
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            const amount = formData.get('budgetAmount') as string;
            
            if (!amount || parseFloat(amount) <= 0) {
              toast({
                title: "請輸入有效金額",
                description: "預算金額必須大於0",
                variant: "destructive",
              });
              return;
            }
            
            await updateBudgetMutation.mutateAsync({
              categoryId: budgetDialogOpen.categoryId,
              month: `${selectedYear}-${selectedMonth}`,
              budgetAmount: amount
            });
          }} className="space-y-4">
            <div>
              <Label htmlFor="budgetAmount">預算金額 (NT$)</Label>
              <Input
                name="budgetAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="輸入預算金額"
                required
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setBudgetDialogOpen({ open: false, categoryId: 0 })}
              >
                取消
              </Button>
              <Button 
                type="submit" 
                disabled={updateBudgetMutation.isPending}
                className="bg-gradient-to-r from-blue-500 to-purple-500"
              >
                {updateBudgetMutation.isPending ? "設定中..." : "確認設定"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Detail Dialog */}
      <Dialog open={categoryDetailOpen.open} onOpenChange={(open) => setCategoryDetailOpen({ ...categoryDetailOpen, open })}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              {categoryDetailOpen.categoryName} 支出明細
            </DialogTitle>
            <DialogDescription>
              查看 {selectedYear}年{selectedMonth}月 的所有支出記錄
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {(() => {
              const categoryExpenses = expenses.filter((expense: any) => 
                expense.categoryId === categoryDetailOpen.categoryId
              );

              if (categoryExpenses.length === 0) {
                return (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">
                      <FileText className="w-12 h-12 mx-auto" />
                    </div>
                    <p className="text-gray-500">本月尚未有支出記錄</p>
                  </div>
                );
              }

              return categoryExpenses.map((expense: any) => (
                <Card key={expense.id} className="bg-gray-50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="font-semibold text-lg text-gray-800">
                            NT$ {parseFloat(expense.amount).toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(expense.date).toLocaleDateString('zh-TW')}
                          </div>
                        </div>
                        
                        {expense.description && (
                          <p className="text-gray-600 mb-2">{expense.description}</p>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>付款方式: {
                            expense.paymentMethod === 'cash' ? '💵 現金' :
                            expense.paymentMethod === 'credit_card' ? '💳 信用卡' :
                            expense.paymentMethod === 'debit_card' ? '🏧 金融卡' :
                            expense.paymentMethod === 'transfer' ? '🏦 轉帳' :
                            expense.paymentMethod === 'mobile_payment' ? '📱 行動支付' :
                            expense.paymentMethod
                          }</span>
                        </div>

                        {/* Receipt Images */}
                        {expense.receiptImages && expense.receiptImages.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm text-gray-600 mb-2">附件圖片:</p>
                            <div className="grid grid-cols-4 gap-2">
                              {expense.receiptImages.map((image: any, index: number) => (
                                <div key={index} className="relative group">
                                  <img
                                    src={typeof image === 'string' ? image : image.url}
                                    alt={`Receipt ${index + 1}`}
                                    className="w-full h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                                    onClick={() => window.open(typeof image === 'string' ? image : image.url, '_blank')}
                                  />
                                  {typeof image === 'object' && image.note && (
                                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <p className="text-white text-xs text-center p-1">{image.note}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ));
            })()}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={() => setCategoryDetailOpen({ open: false, categoryId: 0, categoryName: '' })}
              variant="outline"
            >
              關閉
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recent Expenses Section */}
      <Card className="bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-purple-500" />
            最近支出記錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(() => {
              const recentExpenses = getRecentExpenses();
              
              if (recentExpenses.length === 0) {
                return (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">
                      <TrendingDown className="w-12 h-12 mx-auto" />
                    </div>
                    <p className="text-gray-500">尚未有支出記錄</p>
                  </div>
                );
              }

              return recentExpenses.map((expense: any) => {
                const category = householdCategories.find((c: any) => c.id === expense.categoryId);
                const IconComponent = getCategoryIcon(category?.categoryName || '');
                
                return (
                  <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full" style={{ backgroundColor: `${category?.color || '#6366f1'}20` }}>
                        <IconComponent className="w-4 h-4" style={{ color: category?.color || '#6366f1' }} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{category?.categoryName || '未知分類'}</p>
                        <p className="text-sm text-gray-500">{expense.description || '無描述'}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(expense.date).toLocaleDateString('zh-TW')} • {
                            expense.paymentMethod === 'cash' ? '💵 現金' :
                            expense.paymentMethod === 'credit_card' ? '💳 信用卡' :
                            expense.paymentMethod === 'debit_card' ? '🏧 金融卡' :
                            expense.paymentMethod === 'transfer' ? '🏦 轉帳' :
                            expense.paymentMethod === 'mobile_payment' ? '📱 行動支付' :
                            expense.paymentMethod
                          }
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-800">NT$ {parseFloat(expense.amount).toLocaleString()}</p>
                      {expense.receiptImages && expense.receiptImages.length > 0 && (
                        <p className="text-xs text-blue-500">{expense.receiptImages.length} 張附件</p>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Budget Setting Dialog */}
      <Dialog open={budgetPlanOpen} onOpenChange={setBudgetPlanOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              預算設定
            </DialogTitle>
            <DialogDescription>
              為 {selectedYear}年{selectedMonth}月 設定各分類預算
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {householdCategories.map((category: any) => {
              const stats = getCategoryStats(category.id);
              const IconComponent = getCategoryIcon(category.categoryName);
              const currentBudget = categoryBudgets.find((b: any) => b.categoryId === category.id);
              
              return (
                <Card key={category.id} className="bg-gray-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="p-2 rounded-full" style={{ backgroundColor: `${category.color}20` }}>
                          <IconComponent className="w-5 h-5" style={{ color: category.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{category.categoryName}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`budget-${category.id}`} className="text-sm text-gray-600">預算：</Label>
                              <Input
                                id={`budget-${category.id}`}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0"
                                defaultValue={currentBudget?.budgetAmount || ""}
                                className="w-32 h-8"
                                onBlur={async (e) => {
                                  const amount = e.target.value;
                                  if (amount && parseFloat(amount) >= 0) {
                                    await updateBudgetMutation.mutateAsync({
                                      categoryId: category.id,
                                      month: `${selectedYear}-${selectedMonth}`,
                                      budgetAmount: amount
                                    });
                                  }
                                }}
                              />
                            </div>
                            {stats.spent > 0 && (
                              <div className="text-sm text-gray-500">
                                已用 NT$ {stats.spent.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress Bar for categories with budget */}
                    {stats.budget > 0 && (
                      <div className="mt-3">
                        <Progress 
                          value={Math.min(stats.spentPercentage, 100)} 
                          className="h-2"
                        />
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-xs text-gray-500">
                            預算使用率: {stats.spentPercentage.toFixed(1)}%
                          </p>
                          <p className={`text-xs ${stats.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                            {stats.isOverBudget ? '超支' : '剩餘'} NT$ {Math.abs(stats.remaining).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={() => setBudgetPlanOpen(false)}
              variant="outline"
            >
              關閉
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}