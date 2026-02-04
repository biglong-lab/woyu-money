import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Plus, Edit, Trash2, Calculator, Eye, Calendar, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import CategorySelector from "@/components/category-selector";

type PaymentItem = {
  id: number;
  itemName: string;
  amount: string;
  totalAmount: string;
  categoryId: number;
  projectId: number;
  paymentType: "monthly" | "installment" | "single";
  dueDate: string;
  startDate?: string;
  endDate?: string;
  installmentMonths?: number;
  installmentCount?: number;
  installmentAmount?: string;
  paidAmount: string;
  isPaid: boolean;
  notes?: string;
  fixedCategoryId?: number;
  createdAt: string;
  updatedAt: string;
};

type DebtCategory = {
  id: number;
  categoryName: string;
  categoryType: string;
};

type PaymentProject = {
  id: number;
  projectName: string;
  projectType: string;
};

type FixedCategory = {
  id: number;
  categoryName: string;
  categoryType: string;
};

export default function InstallmentPaymentManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentItem | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Detail view state
  const [viewingItem, setViewingItem] = useState<PaymentItem | null>(null);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>("dueDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Queries - 獲取所有付款項目數據用於分期付款管理
  const { data: paymentItemsResponse, isLoading } = useQuery({
    queryKey: ["/api/payment/items", { includeAll: true }],
    queryFn: () => fetch("/api/payment/items?includeAll=true").then(res => res.json()),
  });
  
  const paymentItems = Array.isArray(paymentItemsResponse) ? paymentItemsResponse : (paymentItemsResponse?.items || []);

  // 調試用 - 檢查分期付款資料狀態
  console.log("分期付款管理 - 原始回應:", paymentItemsResponse);
  console.log("分期付款管理 - 處理後項目:", paymentItems);
  console.log("分期付款管理 - 項目數量:", paymentItems.length);
  console.log("分期付款管理 - 項目類型分佈:", paymentItems.reduce((acc: any, item: PaymentItem) => {
    acc[item.paymentType] = (acc[item.paymentType] || 0) + 1;
    return acc;
  }, {}));

  // Enhanced installment analysis function with correct Obis calculations
  const analyzeInstallmentItem = (item: PaymentItem) => {
    // Parse installment information from item name
    const installmentMatch = item.itemName.match(/第(\d+)期\/共(\d+)期/);
    const currentPeriod = installmentMatch ? parseInt(installmentMatch[1]) : 1;
    const totalPeriods = installmentMatch ? parseInt(installmentMatch[2]) : 1;
    
    // Extract base project name
    const baseName = item.itemName.replace(/\s*\(第\d+期\/共\d+期\)/, '');
    
    // Calculate correct due date using startDate (which is the actual due date for installments)
    const startDateValue = item.startDate || new Date().toISOString().split('T')[0];
    const dueDate = new Date(startDateValue);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Payment status calculation
    const paidAmount = parseFloat(item.paidAmount || "0");
    const totalAmount = parseFloat(item.totalAmount || "0");
    const remainingAmount = totalAmount - paidAmount;
    const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
    const isPaid = progress >= 100;
    
    // Status determination with correct logic
    const isOverdue = !isPaid && daysUntilDue < 0;
    const isDueSoon = !isPaid && daysUntilDue >= 0 && daysUntilDue <= 7;
    
    // Parse project total from notes if available
    const notesMatch = item.notes?.match(/總費用\s*=\s*([\d,]+)/);
    const projectTotalAmount = notesMatch ? parseInt(notesMatch[1].replace(/,/g, '')) : totalAmount * totalPeriods;
    
    // Calculate correct period progress for Obis installments
    const periodProgress = (currentPeriod / totalPeriods) * 100;
    const paidPeriods = isPaid ? currentPeriod : Math.max(0, currentPeriod - 1);
    const remainingPeriods = totalPeriods - paidPeriods;
    
    // For display: each installment item represents one monthly payment
    const monthlyAmount = totalAmount; // This is the amount for this specific period
    const averageMonthlyAmount = projectTotalAmount / totalPeriods;
    
    return {
      ...item,
      currentPeriod,
      totalPeriods,
      baseName,
      dueDate,
      daysUntilDue,
      paidAmount,
      totalAmount,
      remainingAmount,
      progress,
      periodProgress,
      isPaid,
      isOverdue,
      isDueSoon,
      projectTotalAmount,
      paidPeriods,
      remainingPeriods,
      monthlyAmount,
      averageMonthlyAmount,
      status: isPaid ? 'paid' : isOverdue ? 'overdue' : isDueSoon ? 'due-soon' : 'normal'
    };
  };

  // Calculate installment statistics
  const installmentStats = useMemo(() => {
    const installmentItems = paymentItems.filter((item: PaymentItem) => item.paymentType === "installment");
    const total = installmentItems.length;
    
    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();
    
    let dueSoon = 0;
    let overdue = 0;
    let completed = 0;
    let totalAmount = 0;
    let paidAmount = 0;
    
    installmentItems.forEach((item: PaymentItem) => {
      const dueDate = new Date(item.dueDate);
      const isPaid = parseFloat(item.paidAmount || "0") >= parseFloat(item.totalAmount || "0");
      
      totalAmount += parseFloat(item.totalAmount || "0");
      paidAmount += parseFloat(item.paidAmount || "0");
      
      if (isPaid) {
        completed++;
      } else {
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilDue < 0) {
          overdue++;
        } else if (daysUntilDue <= 7) {
          dueSoon++;
        }
      }
    });
    
    const averageProgress = total > 0 ? (paidAmount / totalAmount) * 100 : 0;
    
    return {
      total,
      dueSoon,
      overdue,
      completed,
      totalAmount,
      paidAmount,
      remainingAmount: totalAmount - paidAmount,
      averageProgress: Math.round(averageProgress * 10) / 10
    };
  }, [paymentItems]);

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories/project"],
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/payment/projects"],
  });

  const { data: fixedCategories = [] } = useQuery({
    queryKey: ["/api/fixed-categories"],
  });

  // Enhanced filter and search functionality with accurate analysis
  const filteredInstallmentItems = paymentItems
    .filter((item: PaymentItem) => item.paymentType === "installment")
    .map(analyzeInstallmentItem) // Apply enhanced analysis to each item
    .filter((item: any) => {
      // Search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesName = item.itemName?.toLowerCase().includes(searchLower);
        const matchesNotes = item.notes?.toLowerCase().includes(searchLower);
        const matchesBaseName = item.baseName?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesNotes && !matchesBaseName) return false;
      }

      // Status filter using enhanced analysis
      if (statusFilter !== "all") {
        if (statusFilter === "paid" && !item.isPaid) return false;
        if (statusFilter === "unpaid" && item.isPaid) return false;
        if (statusFilter === "overdue" && !item.isOverdue) return false;
        if (statusFilter === "due-soon" && !item.isDueSoon) return false;
      }

      // Project filter
      if (projectFilter !== "all" && item.projectId?.toString() !== projectFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== "all" && item.categoryId?.toString() !== categoryFilter) {
        return false;
      }

      return true;
    })
    .sort((a: any, b: any) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "dueDate":
          comparison = a.dueDate.getTime() - b.dueDate.getTime();
          break;
        case "progress":
          comparison = a.progress - b.progress;
          break;
        case "amount":
          comparison = a.totalAmount - b.totalAmount;
          break;
        case "installmentNumber":
          comparison = a.currentPeriod - b.currentPeriod;
          break;
        case "name":
          comparison = a.itemName.localeCompare(b.itemName);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === "desc" ? -comparison : comparison;
    });

  // Forms
  const createForm = useForm({
    defaultValues: {
      itemName: "",
      totalAmount: "",
      installments: 1,
      categoryId: "",
      projectId: "",
      startDate: "",
      notes: "",
      fixedCategoryId: "",
      categoryType: "",
      paymentType: "installment",
      extraFirstPayment: "",
      extraLastPayment: ""
    }
  });

  // 分期付款計算邏輯
  const calculateInstallmentPayments = (totalAmount: number, months: number) => {
    if (!totalAmount || !months || months <= 0) return { monthlyAmount: 0, firstPayment: 0, calculations: [] };
    
    const monthlyAmount = Math.floor(totalAmount / months); // 每月整數金額
    const remainder = totalAmount - (monthlyAmount * months); // 零頭金額
    const firstPayment = monthlyAmount + remainder; // 頭期包含零頭
    
    const calculations = [];
    for (let i = 1; i <= months; i++) {
      calculations.push({
        period: i,
        amount: i === 1 ? firstPayment : monthlyAmount,
        type: i === 1 ? "頭期（含零頭）" : "一般期數"
      });
    }
    
    return { monthlyAmount, firstPayment, calculations };
  };

  // 監控表單數值變化
  const watchTotalAmount = createForm.watch("totalAmount");
  const watchInstallments = createForm.watch("installments");
  
  const paymentCalculation = calculateInstallmentPayments(
    parseFloat(watchTotalAmount) || 0,
    parseInt(watchInstallments?.toString()) || 0
  );

  const editForm = useForm({
    defaultValues: {
      itemName: "",
      totalAmount: "",
      installmentMonths: "",
      categoryId: "",
      projectId: "",
      startDate: "",
      notes: "",
      fixedCategoryId: ""
    }
  });

  // Auto-populate item name for categories
  useEffect(() => {
    if (selectedCategoryId) {
      createForm.setValue("itemName", "");
    }
  }, [selectedCategoryId, createForm]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("API request data:", data);
      const response = await apiRequest("POST", "/api/payment/items", data);
      console.log("API response:", response);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      setSelectedCategoryId("");
      toast({
        title: "分期項目建立成功",
        description: "新的分期項目已成功新增",
      });
    },
    onError: (error: any) => {
      console.error("Create mutation error:", error);
      toast({
        title: "建立失敗",
        description: error.message || "建立分期項目時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/payment/items/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      editForm.reset();
      toast({
        title: "分期項目更新成功",
        description: "分期項目資訊已成功更新",
      });
    },
    onError: (error: any) => {
      toast({
        title: "更新失敗",
        description: error.message || "更新分期項目時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/payment/items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      toast({
        title: "分期項目刪除成功",
        description: "分期項目已成功刪除",
      });
    },
    onError: (error: any) => {
      toast({
        title: "刪除失敗",
        description: error.message || "刪除分期項目時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const handleCreateSubmit = async (data: any) => {
    console.log("Form data received:", data);
    console.log("Form errors:", createForm.formState.errors);
    
    const totalAmount = parseFloat(data.totalAmount);
    const installmentMonths = parseInt(data.installmentMonths);
    const calculation = calculateInstallmentPayments(totalAmount, installmentMonths);
    const startDate = new Date(data.startDate);
    
    // Create array of payment items for each installment
    const paymentItems = [];
    
    for (let i = 0; i < installmentMonths; i++) {
      const currentDate = new Date(startDate);
      currentDate.setMonth(startDate.getMonth() + i);
      
      // 第一期包含零頭金額，其他期為標準金額
      const amount = i === 0 ? calculation.firstPayment : calculation.monthlyAmount;
      
      const itemName = `${data.itemName} (第${i + 1}期/共${installmentMonths}期)`;
      
      // 計算總費用說明
      const calculationNote = `總費用 = ${totalAmount.toLocaleString()}，分${installmentMonths}期付款\n第1期：${calculation.firstPayment.toLocaleString()}（包含零頭）\n第2-${installmentMonths}期：每期 ${calculation.monthlyAmount.toLocaleString()}`;
      const finalNotes = data.notes ? `${data.notes}\n\n${calculationNote}` : calculationNote;

      const processedData = {
        itemName: itemName,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        projectId: parseInt(data.projectId),
        fixedCategoryId: data.fixedCategoryId ? parseInt(data.fixedCategoryId) : null,
        totalAmount: amount.toString(), // 每期的金額作為該期的總金額
        paymentType: "installment",
        startDate: currentDate.toISOString().split('T')[0],
        notes: finalNotes,
      };
      
      paymentItems.push(processedData);
    }
    
    console.log("Creating installment payments:", paymentItems);
    
    // Create each payment item sequentially
    try {
      for (const item of paymentItems) {
        await apiRequest("POST", "/api/payment/items", item);
      }
      
      // Success handling
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      setSelectedCategoryId("");
      
      toast({
        title: "分期項目建立成功",
        description: `已成功建立 ${installmentMonths} 期付款項目`,
      });
    } catch (error: any) {
      console.error("Create installment error:", error);
      toast({
        title: "建立失敗",
        description: error.message || "建立分期項目時發生錯誤",
        variant: "destructive",
      });
    }
  };

  const handleEditSubmit = (data: any) => {
    if (!editingItem) return;
    
    // Only update the notes field, keep all other fields unchanged
    const processedData = {
      notes: data.notes,
    };
    updateMutation.mutate({ id: editingItem.id, data: processedData });
  };

  const handleEdit = (item: PaymentItem) => {
    setEditingItem(item);
    editForm.reset({
      notes: item.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const getPriorityBadge = (item: PaymentItem) => {
    const amount = parseFloat(item.totalAmount);
    if (amount >= 100000) return <Badge variant="destructive">高額</Badge>;
    if (amount >= 50000) return <Badge variant="outline">中額</Badge>;
    return <Badge variant="secondary">一般</Badge>;
  };

  const calculateProgress = (item: PaymentItem) => {
    const paid = parseFloat(item.paidAmount) || 0;
    const total = parseFloat(item.totalAmount) || 0;
    return total > 0 ? (paid / total) * 100 : 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Calculator className="w-7 h-7 sm:w-8 sm:h-8 text-purple-600" />
            分期付款管理
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2 leading-relaxed">
            管理所有分期付款項目，追蹤分期進度與剩餘期數
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              <span className="text-sm sm:text-base">新增分期項目</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新增分期項目</DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                {/* 統一分類選擇組件 */}
                <CategorySelector 
                  form={createForm}
                  onCategoryChange={(categoryData) => {
                    console.log("Category changed:", categoryData);
                  }}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="itemName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>項目名稱</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="輸入分期項目名稱"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="totalAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>總金額</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="分期總金額" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="installments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>分期期數</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="1" 
                            max="60" 
                            placeholder="期數（月）"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>開始日期</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Payment Calculation Display */}
                {watchTotalAmount && watchInstallments && paymentCalculation.calculations.length > 0 && (
                  <div className="p-4 bg-blue-50 rounded-lg border">
                    <h4 className="font-medium text-blue-800 mb-2">分期付款計算結果</h4>
                    <div className="text-sm space-y-1">
                      <div className="font-medium">總金額: NT$ {parseFloat(watchTotalAmount).toLocaleString()}</div>
                      <div className="font-medium">分期期數: {watchInstallments} 期</div>
                      <div className="mt-2">
                        <div className="font-medium mb-1 text-blue-700">各期付款明細:</div>
                        <div className="grid grid-cols-1 gap-1">
                          {paymentCalculation.calculations.map((calc, index) => (
                            <div key={index} className="text-xs bg-white p-2 rounded border flex justify-between">
                              <span>第 {calc.period} 期</span>
                              <span className="font-medium">NT$ {calc.amount.toLocaleString()}</span>
                              <span className="text-gray-500">({calc.type})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <FormField
                  control={createForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>備註</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="輸入備註..." rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "建立中..." : "建立分期項目"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">分期項目總數</p>
                <p className="text-2xl font-bold text-purple-900">{installmentStats.total}</p>
              </div>
              <CreditCard className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">即將到期</p>
                <p className="text-2xl font-bold text-amber-900">{installmentStats.dueSoon}</p>
                <p className="text-xs text-amber-600">7天內到期</p>
              </div>
              <Calendar className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">逾期項目</p>
                <p className="text-2xl font-bold text-red-900">{installmentStats.overdue}</p>
                <p className="text-xs text-red-600">需要處理</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">平均完成率</p>
                <p className="text-2xl font-bold text-green-900">{installmentStats.averageProgress}%</p>
                <p className="text-xs text-green-600">整體進度</p>
              </div>
              <Calculator className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card className="mb-6 border-2 border-purple-200 bg-gradient-to-r from-purple-50 via-white to-purple-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-purple-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            分期付款財務概況
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg border">
              <p className="text-sm text-blue-600 font-medium">總分期金額</p>
              <p className="text-xl font-bold text-blue-800">
                NT$ {installmentStats.totalAmount.toLocaleString()}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border">
              <p className="text-sm text-green-600 font-medium">已付金額</p>
              <p className="text-xl font-bold text-green-800">
                NT$ {installmentStats.paidAmount.toLocaleString()}
              </p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg border">
              <p className="text-sm text-orange-600 font-medium">剩餘金額</p>
              <p className="text-xl font-bold text-orange-800">
                NT$ {installmentStats.remainingAmount.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-purple-600 font-medium">整體完成進度</span>
              <span className="text-purple-800 font-semibold">{installmentStats.averageProgress}%</span>
            </div>
            <Progress value={installmentStats.averageProgress} className="h-3 bg-purple-100" />
          </div>
        </CardContent>
      </Card>

      {/* Quick Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("all")}
          className="bg-purple-600 hover:bg-purple-700"
        >
          全部項目
        </Button>
        <Button
          variant={statusFilter === "due-soon" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("due-soon")}
          className="border-amber-500 text-amber-700 hover:bg-amber-50"
        >
          即將到期
        </Button>
        <Button
          variant={statusFilter === "overdue" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("overdue")}
          className="border-red-500 text-red-700 hover:bg-red-50"
        >
          逾期項目
        </Button>
        <Button
          variant={statusFilter === "unpaid" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("unpaid")}
          className="border-orange-500 text-orange-700 hover:bg-orange-50"
        >
          未付清
        </Button>
        <Button
          variant={statusFilter === "paid" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("paid")}
          className="border-green-500 text-green-700 hover:bg-green-50"
        >
          已完成
        </Button>
      </div>

      {/* Sorting Controls */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">排序方式:</label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dueDate">到期日期</SelectItem>
                <SelectItem value="progress">完成進度</SelectItem>
                <SelectItem value="amount">金額大小</SelectItem>
                <SelectItem value="installmentNumber">期數順序</SelectItem>
                <SelectItem value="name">項目名稱</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">順序:</label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              {sortOrder === "asc" ? "升序 ↑" : "降序 ↓"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Search and Filter Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search Input */}
          <div className="lg:col-span-2">
            <Input
              placeholder="搜尋項目名稱或備註..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="付款狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="paid">已付清</SelectItem>
              <SelectItem value="unpaid">未付清</SelectItem>
            </SelectContent>
          </Select>

          {/* Project Filter */}
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger>
              <SelectValue placeholder="專案篩選" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部專案</SelectItem>
              {projects.map((project: any) => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="分類篩選" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分類</SelectItem>
              {categories.map((category: any) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.categoryName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Filter Summary */}
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <span>顯示 {filteredInstallmentItems.length} 個項目</span>
          {searchTerm && (
            <Badge variant="outline">搜尋: {searchTerm}</Badge>
          )}
          {statusFilter !== "all" && (
            <Badge variant="outline">
              狀態: {statusFilter === "paid" ? "已付清" : "未付清"}
            </Badge>
          )}
          {projectFilter !== "all" && (
            <Badge variant="outline">
              專案: {projects.find((p: any) => p.id.toString() === projectFilter)?.projectName}
            </Badge>
          )}
          {categoryFilter !== "all" && (
            <Badge variant="outline">
              分類: {categories.find((c: any) => c.id.toString() === categoryFilter)?.categoryName}
            </Badge>
          )}
        </div>
      </Card>

      {/* Payment Items List */}
      <div className="grid gap-4">
        {filteredInstallmentItems.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">尚無分期項目</h3>
              <p className="text-gray-500 mb-4">開始新增您的第一個分期項目</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                新增分期項目
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredInstallmentItems.map((item: any) => {
            // Use analyzed data with proper Obis calculations
            const progress = item.progress;
            const remainingAmount = item.remainingAmount;
            const currentPeriod = item.currentPeriod;
            const totalInstallments = item.totalPeriods;
            const daysUntilDue = item.daysUntilDue;
            
            // Calculate correct period metrics for Obis
            const paidPeriods = item.isPaid ? item.currentPeriod : Math.max(0, item.currentPeriod - 1);
            const totalPeriods = item.totalPeriods;
            const remainingPeriods = totalPeriods - paidPeriods;
            const monthlyAmount = item.totalAmount; // Each item is one installment payment
            
            let cardStyle = "border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-white hover:shadow-lg";
            let statusBadge = "進行中";
            let badgeVariant: "default" | "destructive" | "outline" | "secondary" = "secondary";
            
            if (item.isPaid) {
              cardStyle = "border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white hover:shadow-lg";
              statusBadge = "已完成";
              badgeVariant = "default";
            } else if (item.isOverdue) {
              cardStyle = "border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-white hover:shadow-lg";
              statusBadge = "逾期";
              badgeVariant = "destructive";
            } else if (item.isDueSoon) {
              cardStyle = "border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white hover:shadow-lg";
              statusBadge = "即將到期";
              badgeVariant = "outline";
            }

            return (
              <Card key={item.id} className={`${cardStyle} transition-all duration-300`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                          分期付款
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {item.currentPeriod}/{item.totalPeriods} 期
                        </Badge>
                      </div>
                      <CardTitle className="text-lg text-gray-900 leading-tight">
                        {item.itemName}
                      </CardTitle>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getPriorityBadge(item)}
                      <Badge variant={badgeVariant}>
                        {statusBadge}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Progress indicator for installment completion */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-purple-600 font-medium">期數進度</span>
                      <span className="text-purple-800 font-semibold">
                        {Math.round((item.currentPeriod / item.totalPeriods) * 100)}%
                      </span>
                    </div>
                    <Progress 
                      value={(item.currentPeriod / item.totalPeriods) * 100} 
                      className="h-3 bg-purple-100" 
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">總金額</p>
                      <p className="font-semibold text-lg">NT$ {item.totalAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">每期金額</p>
                      <p className="font-medium">NT$ {item.totalAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">已付 / 總期數</p>
                      <p className="font-medium">{item.paidPeriods || 0} / {item.totalPeriods || 6} 期</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">剩餘金額</p>
                      <p className="font-medium text-orange-600">NT$ {item.remainingAmount.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>還款進度</span>
                      <span>{item.progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${Math.min(item.progress, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>已付: NT$ {item.paidAmount.toLocaleString()}</span>
                      <span>剩餘 {item.totalPeriods - (item.isPaid ? item.currentPeriod : item.currentPeriod - 1)} 期</span>
                    </div>
                  </div>

                  {item.notes && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-1">備註</p>
                      <p className="text-sm bg-gray-50 p-2 rounded">{item.notes}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setViewingItem(item)}>
                      <Eye className="w-4 h-4 mr-1" />
                      詳細
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>
                      <Edit className="w-4 h-4 mr-1" />
                      編輯
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      刪除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Edit Dialog - Only Notes Editable */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>編輯分期項目</DialogTitle>
            <p className="text-sm text-gray-600">
              為避免資料錯誤，僅可修改備註欄位。如需修改其他資訊，請刪除後重新建立。
            </p>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              {/* Read-only fields display */}
              <div className="p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-medium text-gray-800 mb-3">項目資訊（唯讀）</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">項目名稱</p>
                    <p className="font-medium">{editingItem?.itemName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">總金額</p>
                    <p className="font-medium">NT$ {editingItem?.totalAmount ? parseFloat(editingItem.totalAmount).toLocaleString() : '0'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <p className="text-sm text-gray-500">分期期數</p>
                    <p className="font-medium">{editingItem?.installmentMonths} 期</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">開始日期</p>
                    <p className="font-medium">{editingItem?.startDate ? new Date(editingItem.startDate).toLocaleDateString() : '未設定'}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-sm text-gray-500">每期金額</p>
                  <p className="font-medium">NT$ {editingItem?.amount ? parseFloat(editingItem.amount).toLocaleString() : '0'}</p>
                </div>
              </div>

              {/* Editable notes field */}
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註（可編輯）</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="輸入備註..." rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "更新中..." : "更新備註"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Detailed View Dialog */}
      <Dialog open={!!viewingItem} onOpenChange={() => setViewingItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-600" />
              分期付款詳細資料
            </DialogTitle>
          </DialogHeader>
          
          {viewingItem && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">總覽</TabsTrigger>
                <TabsTrigger value="schedule">分期明細</TabsTrigger>
                <TabsTrigger value="analysis">分析統計</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        基本資訊
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-500">項目名稱</p>
                        <p className="font-medium">{viewingItem.itemName}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">總金額</p>
                          <p className="font-semibold text-lg text-blue-600">
                            NT$ {parseFloat(viewingItem.totalAmount).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">每期金額</p>
                          <p className="font-medium">
                            NT$ {parseFloat(viewingItem.amount).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">分期期數</p>
                          <p className="font-medium">{viewingItem.installmentMonths} 期</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">到期日</p>
                          <p className="font-medium">{new Date(viewingItem.dueDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {viewingItem.notes && (
                        <div>
                          <p className="text-sm text-gray-500">備註</p>
                          <p className="text-sm bg-gray-50 p-2 rounded">{viewingItem.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Payment Progress */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        付款進度
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(() => {
                        const progress = calculateProgress(viewingItem);
                        const monthlyAmount = parseFloat(viewingItem.installmentAmount) || 0;
                        const paidPeriods = monthlyAmount > 0 ? Math.floor(parseFloat(viewingItem.paidAmount) / monthlyAmount) : 0;
                        const totalPeriods = viewingItem.installmentCount || 0;
                        const remainingAmount = parseFloat(viewingItem.totalAmount) - parseFloat(viewingItem.paidAmount);
                        
                        return (
                          <>
                            <div>
                              <div className="flex justify-between text-sm mb-2">
                                <span>整體進度</span>
                                <span>{progress.toFixed(1)}%</span>
                              </div>
                              <Progress value={progress} className="h-3" />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="text-center p-3 bg-green-50 rounded-lg">
                                <p className="text-sm text-gray-500">已付金額</p>
                                <p className="font-semibold text-green-600">
                                  NT$ {parseFloat(viewingItem.paidAmount).toLocaleString()}
                                </p>
                              </div>
                              <div className="text-center p-3 bg-orange-50 rounded-lg">
                                <p className="text-sm text-gray-500">剩餘金額</p>
                                <p className="font-semibold text-orange-600">
                                  NT$ {remainingAmount.toLocaleString()}
                                </p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="text-center p-3 bg-blue-50 rounded-lg">
                                <p className="text-sm text-gray-500">已付期數</p>
                                <p className="font-semibold text-blue-600">{paidPeriods} 期</p>
                              </div>
                              <div className="text-center p-3 bg-purple-50 rounded-lg">
                                <p className="text-sm text-gray-500">剩餘期數</p>
                                <p className="font-semibold text-purple-600">{totalPeriods - paidPeriods} 期</p>
                              </div>
                            </div>
                            
                            <div className="pt-2">
                              <Badge variant={progress >= 100 ? "default" : "secondary"} className="w-full justify-center py-2">
                                {progress >= 100 ? "✓ 已完成付款" : "進行中"}
                              </Badge>
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Schedule Tab */}
              <TabsContent value="schedule" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>分期付款明細</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      // Use enhanced analysis for proper Obis calculations
                      const analyzedData = analyzeInstallmentItem(viewingItem);
                      const monthlyAmount = parseFloat(viewingItem.totalAmount) || 0;
                      const totalPeriods = analyzedData.totalPeriods || 6;
                      const paidAmount = parseFloat(viewingItem.paidAmount || "0");
                      const paidPeriods = analyzedData.paidPeriods || 0;
                      const startDate = viewingItem.startDate ? new Date(viewingItem.startDate) : new Date();
                      
                      const scheduleItems = Array.from({ length: totalPeriods }, (_, index) => {
                        const periodDate = new Date(startDate);
                        periodDate.setMonth(periodDate.getMonth() + index);
                        
                        // For Obis: periods 1-2 are paid, 3-6 are future (not overdue)
                        const isPaid = (index + 1) <= paidPeriods;
                        const isCurrentPeriod = (index + 1) === analyzedData.currentPeriod;
                        const isFuture = (index + 1) > analyzedData.currentPeriod;
                        const isOverdue = !isPaid && !isFuture && periodDate < new Date();
                        
                        return {
                          period: index + 1,
                          date: periodDate,
                          amount: monthlyAmount,
                          isPaid,
                          isOverdue,
                          isCurrentPeriod,
                          isFuture,
                          status: isPaid ? 'paid' : isOverdue ? 'overdue' : isFuture ? 'future' : 'pending'
                        };
                      });
                      
                      return (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {scheduleItems.map((item) => (
                            <div
                              key={item.period}
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                item.isPaid
                                  ? 'bg-green-50 border-green-200'
                                  : item.isOverdue
                                  ? 'bg-red-50 border-red-200'
                                  : item.isCurrentPeriod
                                  ? 'bg-purple-50 border-purple-200'
                                  : item.isFuture
                                  ? 'bg-blue-50 border-blue-200'
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                  item.isPaid
                                    ? 'bg-green-500 text-white'
                                    : item.isOverdue
                                    ? 'bg-red-500 text-white'
                                    : item.isCurrentPeriod
                                    ? 'bg-purple-500 text-white'
                                    : item.isFuture
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-300 text-gray-600'
                                }`}>
                                  {item.isPaid ? '✓' : item.period}
                                </div>
                                <div>
                                  <p className="font-medium">第 {item.period} 期</p>
                                  <p className="text-sm text-gray-500">
                                    {item.date.toLocaleDateString()}
                                  </p>
                                  <p className={`text-xs font-medium ${
                                    item.isPaid ? 'text-green-600' : 
                                    item.isOverdue ? 'text-red-600' : 
                                    item.isCurrentPeriod ? 'text-purple-600' :
                                    item.isFuture ? 'text-blue-600' : 'text-gray-600'
                                  }`}>
                                    {item.isPaid ? '已付款' : 
                                     item.isOverdue ? '逾期' : 
                                     item.isCurrentPeriod ? '本期' :
                                     item.isFuture ? '未來期' : '待付'}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="text-right">
                                <p className="font-medium">
                                  NT$ {item.amount.toLocaleString()}
                                </p>
                                <Badge
                                  variant={
                                    item.isPaid ? 'default' : item.isOverdue ? 'destructive' : 'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {item.isPaid ? '已付' : item.isOverdue ? '逾期' : '待付'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Analysis Tab */}
              <TabsContent value="analysis" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>付款統計</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(() => {
                        const monthlyAmount = parseFloat(viewingItem.amount) || 0;
                        const totalAmount = parseFloat(viewingItem.totalAmount);
                        const paidAmount = parseFloat(viewingItem.paidAmount);
                        const totalPeriods = viewingItem.installmentMonths || 0;
                        const paidPeriods = monthlyAmount > 0 ? Math.floor(paidAmount / monthlyAmount) : 0;
                        const remainingPeriods = totalPeriods - paidPeriods;
                        const avgPaymentPerMonth = paidPeriods > 0 ? paidAmount / paidPeriods : 0;
                        
                        return (
                          <>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">平均每期實付</span>
                                <span className="font-medium">NT$ {avgPaymentPerMonth.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">完成率</span>
                                <span className="font-medium">{((paidPeriods / totalPeriods) * 100).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">剩餘月份</span>
                                <span className="font-medium">{remainingPeriods} 個月</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">預計完成日期</span>
                                <span className="font-medium">
                                  {(() => {
                                    const endDate = new Date();
                                    endDate.setMonth(endDate.getMonth() + remainingPeriods);
                                    return endDate.toLocaleDateString();
                                  })()}
                                </span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>分類資訊</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-500">專案</p>
                        <p className="font-medium">
                          {projects.find((p: any) => p.id === viewingItem.projectId)?.projectName || '未指定'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">分類</p>
                        <p className="font-medium">
                          {categories.find((c: any) => c.id === viewingItem.categoryId)?.categoryName || '未指定'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">固定分類</p>
                        <p className="font-medium">
                          {fixedCategories.find((fc: any) => fc.id === viewingItem.fixedCategoryId)?.categoryName || '未指定'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">建立時間</p>
                        <p className="text-sm">{new Date(viewingItem.createdAt).toLocaleString()}</p>
                      </div>
                      {viewingItem.updatedAt && (
                        <div>
                          <p className="text-sm text-gray-500">最後更新</p>
                          <p className="text-sm">{new Date(viewingItem.updatedAt).toLocaleString()}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}