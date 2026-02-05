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
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar, Plus, Edit, Trash2, CreditCard, Search, Filter, X, ChevronDown, ChevronUp, AlertTriangle, Star, Clock, RotateCcw, CheckSquare, Square, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import CategorySelector from "@/components/category-selector";

type PaymentItem = {
  id: number;
  itemName: string;
  totalAmount: string;
  categoryId: number;
  projectId: number;
  paymentType: "monthly" | "installment" | "single";
  startDate: string;
  endDate?: string;
  paidAmount: string;
  status: string;
  notes?: string;
  fixedCategoryId?: number;
  priority: number;
  createdAt: string;
  updatedAt: string;
  // Join fields
  categoryName?: string;
  projectName?: string;
  projectType?: string;
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

type ProjectCategoryTemplate = {
  id: number;
  projectId: number;
  categoryId: number;
  templateName: string;
  accountInfo: string;
  notes: string;
};

type FixedCategorySubOption = {
  id: number;
  fixedCategoryId: number;
  projectId: number;
  subOptionName: string;
  displayName: string;
  categoryType: string;
};

export default function MonthlyPaymentManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentItem | null>(null);
  const [isEditUnlocked, setIsEditUnlocked] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedFixedCategoryId, setSelectedFixedCategoryId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectCategoryTemplate | FixedCategorySubOption | null>(null);

  // 搜尋與篩選狀態
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>("startDate");
  const [sortOrder, setSortOrder] = useState<string>("asc");

  // 批量選擇狀態
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [showBatchPayConfirm, setShowBatchPayConfirm] = useState(false);

  // Queries - 獲取所有付款項目數據用於月付款管理
  const { data: paymentItemsResponse, isLoading } = useQuery<any>({
    queryKey: ["/api/payment/items", { includeAll: true }],
    queryFn: () => fetch("/api/payment/items?includeAll=true").then(res => res.json()),
  });

  const paymentItems: PaymentItem[] = Array.isArray(paymentItemsResponse) ? paymentItemsResponse : (paymentItemsResponse?.items || []);

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories/project"],
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/payment/projects"],
  });

  const { data: fixedCategories = [] } = useQuery<any[]>({
    queryKey: ["/api/fixed-categories"],
  });

  // Fetch project templates when project is selected
  const { data: projectTemplates = [] } = useQuery({
    queryKey: [`/api/project-category-templates/${selectedProjectId}`],
    enabled: !!selectedProjectId,
  });

  const { data: fixedSubOptions = [] } = useQuery({
    queryKey: [`/api/fixed-category-sub-options/${selectedProjectId}`],
    enabled: !!selectedProjectId,
  });

  // 調試用 - 檢查資料狀態
  console.log("月付款管理 - 原始回應:", paymentItemsResponse);
  console.log("月付款管理 - 處理後項目:", paymentItems);
  console.log("月付款管理 - 項目數量:", paymentItems.length);
  console.log("月付款管理 - 篩選前總項目:", paymentItems.length);
  console.log("月付款管理 - 項目類型分佈:", paymentItems.reduce((acc: any, item: PaymentItem) => {
    acc[item.paymentType] = (acc[item.paymentType] || 0) + 1;
    return acc;
  }, {}));

  // Filter and sort monthly payment items
  const filteredAndSortedItems = paymentItems.filter((item: PaymentItem) => {
    // Only show monthly payment items
    if (item.paymentType !== "monthly") return false;
    
    // Search filter
    const matchesSearch = searchTerm === "" || 
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (item.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    // Project filter
    const matchesProject = filterProject === "all" || 
      item.projectName === projects.find((p: PaymentProject) => p.id.toString() === filterProject)?.projectName;
    
    // Status filter
    let matchesStatus = true;
    if (filterStatus === "paid") {
      matchesStatus = item.status === "paid";
    } else if (filterStatus === "unpaid") {
      matchesStatus = item.status !== "paid";
    } else if (filterStatus === "overdue") {
      const itemDate = new Date(item.endDate || item.startDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      matchesStatus = itemDate < today && item.status !== "paid";
    } else if (filterStatus !== "all") {
      matchesStatus = item.status === filterStatus;
    }
    
    // Category filter
    let matchesCategory = true;
    if (filterCategory !== "all") {
      const [categoryType, categoryId] = filterCategory.split(":");
      if (categoryType === "fixed") {
        matchesCategory = item.fixedCategoryId === parseInt(categoryId);
      } else if (categoryType === "project") {
        matchesCategory = item.categoryId === parseInt(categoryId);
      }
    }
    
    return matchesSearch && matchesProject && matchesStatus && matchesCategory;
  }).sort((a: PaymentItem, b: PaymentItem) => {
    let comparison = 0;
    
    switch (sortBy) {
      case "startDate":
        comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        break;
      case "amount":
        comparison = parseFloat(a.totalAmount) - parseFloat(b.totalAmount);
        break;
      case "name":
        comparison = a.itemName.localeCompare(b.itemName);
        break;
      case "project":
        comparison = (a.projectName || "").localeCompare(b.projectName || "");
        break;
      case "status":
        comparison = a.status.localeCompare(b.status);
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
      amount: "",
      categoryId: "",
      projectId: "",
      dueDate: "",
      paymentDate: "",
      notes: "",
      fixedCategoryId: "",
      categoryType: "",
      totalAmount: "",
      installments: "",
      paymentType: "",
      extraFirstPayment: "",
      extraLastPayment: "",
    }
  });

  const editForm = useForm({
    defaultValues: {
      itemName: "",
      amount: "",
      categoryId: "",
      projectId: "",
      startDate: "",
      endDate: "",
      notes: "",
      fixedCategoryId: "",
      categoryType: "",
      status: "",
    }
  });

  // Watch form values for calculations
  const watchTotalAmount = createForm.watch("totalAmount");
  const watchInstallments = createForm.watch("installments");
  const watchPaymentType = createForm.watch("paymentType");
  const watchExtraFirstPayment = createForm.watch("extraFirstPayment");
  const watchExtraLastPayment = createForm.watch("extraLastPayment");

  // Calculate installment payments
  const calculateInstallments = () => {
    const total = parseFloat(watchTotalAmount) || 0;
    const installments = parseInt(watchInstallments) || 1;
    const extraFirst = parseFloat(watchExtraFirstPayment) || 0;
    const extraLast = parseFloat(watchExtraLastPayment) || 0;
    
    if (total <= 0 || installments <= 0) return { monthlyAmount: 0, calculations: [] };
    
    if (watchPaymentType === "installment" && installments > 1) {
      // Calculate remaining amount after extra payments
      const remainingAmount = total - extraFirst - extraLast;
      const regularInstallments = installments - (extraFirst > 0 ? 1 : 0) - (extraLast > 0 ? 1 : 0);
      
      if (regularInstallments <= 0) {
        return { monthlyAmount: total / installments, calculations: [] };
      }
      
      const baseAmount = Math.floor(remainingAmount / regularInstallments);
      const remainder = remainingAmount - (baseAmount * regularInstallments);
      
      const calculations = [];
      
      // First payment (if extra)
      if (extraFirst > 0) {
        calculations.push({ period: 1, amount: extraFirst, type: "首期加付" });
      }
      
      // Regular payments
      for (let i = 0; i < regularInstallments; i++) {
        const periodNumber = (extraFirst > 0 ? 1 : 0) + i + 1;
        const amount = i === 0 ? baseAmount + remainder : baseAmount;
        calculations.push({ period: periodNumber, amount, type: "定期付款" });
      }
      
      // Last payment (if extra)
      if (extraLast > 0) {
        calculations.push({ period: installments, amount: extraLast, type: "期末加付" });
      }
      
      return { monthlyAmount: baseAmount, calculations };
    } else {
      // Monthly payment
      const monthlyAmount = total / installments;
      return { monthlyAmount, calculations: [{ period: 1, amount: monthlyAmount, type: "月付" }] };
    }
  };

  const paymentCalculation = calculateInstallments();

  // Auto-populate item name for fixed categories
  useEffect(() => {
    if (selectedFixedCategoryId) {
      const selectedCategory = fixedCategories.find((cat: FixedCategory) => cat.id === parseInt(selectedFixedCategoryId));
      if (selectedCategory) {
        createForm.setValue("itemName", selectedCategory.categoryName);
      }
      createForm.setValue("categoryId", "");
      setSelectedCategoryId("");
    } else if (selectedCategoryId) {
      createForm.setValue("itemName", "");
    }
  }, [selectedFixedCategoryId, selectedCategoryId, fixedCategories, createForm]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("API request data:", data);
      const response = await apiRequest("/api/payment/items", "POST", data);
      console.log("API response:", response);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      setSelectedCategoryId("");
      setSelectedFixedCategoryId("");
      toast({
        title: "月付項目建立成功",
        description: "新的月付項目已成功新增",
      });
    },
    onError: (error: any) => {
      console.error("Create mutation error:", error);
      toast({
        title: "建立失敗",
        description: error.message || "建立月付項目時發生錯誤",
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
        title: "月付項目更新成功",
        description: "月付項目資訊已成功更新",
      });
    },
    onError: (error: any) => {
      toast({
        title: "更新失敗",
        description: error.message || "更新月付項目時發生錯誤",
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
        title: "月付項目已移至回收站",
        description: "月付項目已成功移至回收站",
      });
    },
    onError: (error: any) => {
      toast({
        title: "刪除失敗",
        description: error.message || "刪除月付項目時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // 批量刪除 mutation
  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.all(
        ids.map(id => apiRequest("DELETE", `/api/payment/items/${id}`))
      );
      return results;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setSelectedIds(new Set());
      setIsBatchMode(false);
      setShowBatchDeleteConfirm(false);
      toast({
        title: "批量刪除成功",
        description: `已將 ${ids.length} 個項目移至回收站`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "批量刪除失敗",
        description: error.message || "批量刪除時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // 批量標記已付款 mutation
  const batchMarkPaidMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const today = new Date().toISOString().split('T')[0];
      const results = await Promise.all(
        ids.map(id => apiRequest("PUT", `/api/payment/items/${id}`, {
          status: "paid",
          endDate: today,
          paidAmount: paymentItems.find((item: PaymentItem) => item.id === id)?.totalAmount || "0"
        }))
      );
      return results;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setSelectedIds(new Set());
      setIsBatchMode(false);
      setShowBatchPayConfirm(false);
      toast({
        title: "批量付款成功",
        description: `已將 ${ids.length} 個項目標記為已付款`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "批量付款失敗",
        description: error.message || "批量更新付款狀態時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // 批量選擇處理函數
  const handleSelectItem = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredAndSortedItems.map((item: PaymentItem) => item.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleBatchMode = () => {
    if (isBatchMode) {
      setSelectedIds(new Set());
    }
    setIsBatchMode(!isBatchMode);
  };

  // 計算選中項目的總金額
  const selectedItemsTotal = useMemo(() => {
    let total = 0;
    selectedIds.forEach(id => {
      const item = paymentItems.find((item: PaymentItem) => item.id === id);
      if (item) {
        total += parseFloat(item.totalAmount) || 0;
      }
    });
    return total;
  }, [selectedIds, paymentItems]);

  // 獲取選中的未付款項目數量
  const selectedUnpaidCount = useMemo(() => {
    let count = 0;
    selectedIds.forEach(id => {
      const item = paymentItems.find((item: PaymentItem) => item.id === id);
      if (item && item.status !== "paid") {
        count++;
      }
    });
    return count;
  }, [selectedIds, paymentItems]);

  // Event handlers
  const handleCreateSubmit = async (data: any) => {
    console.log("Form data received:", data);
    console.log("Form errors:", createForm.formState.errors);
    
    const installments = data.installments || 1;
    const startDate = new Date(data.dueDate);
    
    // Create array of payment items for each installment
    const paymentItems = [];
    
    for (let i = 0; i < installments; i++) {
      const currentDate = new Date(startDate);
      currentDate.setMonth(startDate.getMonth() + i);
      
      const itemName = installments > 1 
        ? `${data.itemName} (第${i + 1}期/共${installments}期)`
        : data.itemName;
      
      // Calculate total cost for notes
      const monthlyAmount = parseFloat(data.amount);
      const totalCost = monthlyAmount * installments;
      const calculationNote = `總費用 = ${monthlyAmount.toLocaleString()} × ${installments}期 = ${totalCost.toLocaleString()}`;
      const finalNotes = data.notes ? `${data.notes}\n${calculationNote}` : calculationNote;

      const processedData = {
        ...data,
        itemName: itemName,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        projectId: parseInt(data.projectId),
        fixedCategoryId: data.fixedCategoryId ? parseInt(data.fixedCategoryId) : null,
        amount: data.amount.toString(),
        totalAmount: data.amount.toString(),
        paymentType: "monthly",
        startDate: currentDate.toISOString().split('T')[0],
        endDate: data.paymentDate || null,
        notes: finalNotes,
        itemType: data.fixedCategoryId ? "project" : "home", // 固定分類項目設為專案類型
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
      setSelectedFixedCategoryId("");
      
      toast({
        title: "月付項目建立成功",
        description: `已成功建立 ${installments} 期付款項目`,
      });
    } catch (error: any) {
      console.error("Create installment error:", error);
      toast({
        title: "建立失敗",
        description: error.message || "建立月付項目時發生錯誤",
        variant: "destructive",
      });
    }
  };

  const handleEditSubmit = (data: any) => {
    if (!editingItem) return;
    
    const processedData = {
      ...data,
      categoryId: parseInt(data.categoryId),
      projectId: parseInt(data.projectId),
      fixedCategoryId: data.fixedCategoryId ? parseInt(data.fixedCategoryId) : null,
      amount: data.amount.toString(),
      totalAmount: data.amount.toString(),
      paymentType: "monthly",
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      dueDate: data.startDate,
      itemType: data.fixedCategoryId ? "project" : "home", // 固定分類項目設為專案類型
    };
    updateMutation.mutate({ id: editingItem.id, data: processedData });
  };

  const handleEdit = (item: PaymentItem) => {
    setEditingItem(item);
    setIsEditUnlocked(false); // 預設鎖定
    
    // Determine category type and set appropriate fields
    const categoryType = item.fixedCategoryId ? "fixed" : "project";
    
    editForm.reset({
      itemName: item.itemName,
      amount: item.totalAmount,
      categoryId: item.categoryId ? item.categoryId.toString() : "",
      projectId: item.projectId.toString(),
      startDate: item.startDate,
      endDate: item.endDate || "",
      notes: item.notes || "",
      fixedCategoryId: item.fixedCategoryId?.toString() || "",
      categoryType: categoryType,
      status: item.status || "pending"
    });
    setIsEditDialogOpen(true);
  };

  const toggleEditLock = () => {
    setIsEditUnlocked(!isEditUnlocked);
    toast({
      title: isEditUnlocked ? "編輯已鎖定" : "編輯已解鎖",
      description: isEditUnlocked 
        ? "項目資訊已恢復為唯讀狀態，僅能修改付款狀態和備註"
        : "現在可以編輯所有項目資訊，請謹慎修改",
      variant: isEditUnlocked ? "default" : "destructive"
    });
  };

  const getPriorityBadge = (item: PaymentItem) => {
    const amount = parseFloat(item.totalAmount);
    if (amount >= 50000) return <Badge variant="destructive">高額</Badge>;
    if (amount >= 20000) return <Badge variant="outline">中額</Badge>;
    return <Badge variant="secondary">一般</Badge>;
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
            <Calendar className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
            月付管理
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2 leading-relaxed">
            管理所有月付項目，定期付款的追蹤與管理
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              <span className="text-sm sm:text-base">新增月付項目</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新增月付項目</DialogTitle>
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                <p className="font-medium text-blue-800 mb-1">月付分期說明：</p>
                <p>• 設定期數、開始付款日期、月付金額，系統將自動創建連續月份的付款項目</p>
                <p>• 例如：4期、2025/04/01開始、每月10000元 → 自動創建 04/01、05/01、06/01、07/01 四個付款項目</p>
              </div>
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
                            placeholder="輸入付款項目名稱"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={createForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>月付金額</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="每月應付金額" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={createForm.control}
                    name="dueDate"
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
                  <FormField
                    control={createForm.control}
                    name="installments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>幾個月</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            min="1" 
                            max="60" 
                            placeholder="期數"
                            defaultValue="1"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>實際付款日期（選填）</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Detailed Payment Calculation */}
                {watchTotalAmount && watchInstallments && parseFloat(watchTotalAmount) > 0 && parseInt(watchInstallments) > 0 && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg space-y-3">
                    <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      費用計算明細
                    </h4>
                    
                    {(() => {
                      const monthlyAmount = parseFloat(watchTotalAmount) || 0;
                      const installments = parseInt(watchInstallments) || 1;
                      const totalCost = monthlyAmount * installments;
                      const startDate = new Date(createForm.watch("dueDate") || new Date());
                      
                      return (
                        <div className="space-y-3">
                          {/* Basic Calculation */}
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="bg-white p-2 rounded border">
                              <div className="text-gray-600 text-xs">每月金額</div>
                              <div className="font-bold text-blue-900">NT$ {monthlyAmount.toLocaleString()}</div>
                            </div>
                            <div className="bg-white p-2 rounded border">
                              <div className="text-gray-600 text-xs">付款期數</div>
                              <div className="font-bold text-blue-900">{installments} 個月</div>
                            </div>
                            <div className="bg-white p-2 rounded border">
                              <div className="text-gray-600 text-xs">總計費用</div>
                              <div className="font-bold text-green-700">NT$ {totalCost.toLocaleString()}</div>
                            </div>
                          </div>
                          
                          {/* Payment Schedule Preview */}
                          <div className="bg-white p-3 rounded border">
                            <div className="text-xs text-gray-600 mb-2">付款時程預覽 (前3期)</div>
                            <div className="space-y-1 text-xs">
                              {Array.from({ length: Math.min(3, installments) }, (_, i) => {
                                const paymentDate = new Date(startDate);
                                paymentDate.setMonth(startDate.getMonth() + i);
                                return (
                                  <div key={i} className="flex justify-between">
                                    <span className="text-gray-600">第 {i + 1} 期:</span>
                                    <span className="font-medium">{paymentDate.toLocaleDateString()} - NT$ {monthlyAmount.toLocaleString()}</span>
                                  </div>
                                );
                              })}
                              {installments > 3 && (
                                <div className="text-gray-500 text-center">... 共 {installments} 期</div>
                              )}
                            </div>
                          </div>
                          
                          {/* Calculation Formula */}
                          <div className="bg-amber-50 border border-amber-200 p-2 rounded text-xs">
                            <span className="text-amber-800">
                              <strong>計算公式:</strong> NT$ {monthlyAmount.toLocaleString()} × {installments} 期 = NT$ {totalCost.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <FormField
                  control={createForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>備註</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="付款備註..." rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "建立中..." : "建立月付項目"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜尋與篩選區域 */}
      <div className="space-y-4">
        {/* 搜尋列 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="搜尋項目名稱、分類或專案..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* 基本篩選與排序 */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* 專案篩選 */}
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="所有專案" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有專案</SelectItem>
              {projects.map((project: PaymentProject) => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 狀態篩選 */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="所有狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有狀態</SelectItem>
              <SelectItem value="paid">已付清</SelectItem>
              <SelectItem value="unpaid">未付清</SelectItem>
              <SelectItem value="overdue">已逾期</SelectItem>
            </SelectContent>
          </Select>

          {/* 排序 */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="排序方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="startDate">開始日期</SelectItem>
              <SelectItem value="amount">金額</SelectItem>
              <SelectItem value="name">名稱</SelectItem>
              <SelectItem value="project">專案</SelectItem>
              <SelectItem value="status">狀態</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          >
            {sortOrder === "asc" ? "升序" : "降序"}
          </Button>

          {/* 進階篩選按鈕 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            進階篩選
            {showAdvancedFilters ? (
              <ChevronUp className="w-4 h-4 ml-1" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-1" />
            )}
          </Button>

          {/* 重置篩選 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setFilterProject("all");
              setFilterStatus("all");
              setFilterCategory("all");
              setSortBy("startDate");
              setSortOrder("asc");
            }}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            重置
          </Button>
        </div>

        {/* 進階篩選面板 */}
        {showAdvancedFilters && (
          <Card className="p-4 bg-gray-50">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">進階篩選選項</h4>
              
              {/* 分類篩選 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  分類篩選
                </label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="所有分類" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有分類</SelectItem>
                    {/* 固定分類 */}
                    {fixedCategories.length > 0 && (
                      <>
                        <SelectItem value="fixed-header" disabled>
                          固定分類
                        </SelectItem>
                        {fixedCategories.map((category: FixedCategory) => (
                          <SelectItem 
                            key={`fixed-${category.id}`} 
                            value={`fixed:${category.id}`}
                            className="pl-6"
                          >
                            {category.categoryName}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {/* 專案分類 */}
                    {categories.length > 0 && (
                      <>
                        <SelectItem value="project-header" disabled>
                          專案分類
                        </SelectItem>
                        {categories.map((category: DebtCategory) => (
                          <SelectItem 
                            key={`project-${category.id}`} 
                            value={`project:${category.id}`}
                            className="pl-6"
                          >
                            {category.categoryName}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        )}

        {/* 篩選結果統計 */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <span>
              顯示 {filteredAndSortedItems.length} 個項目
              {paymentItems.filter((item: PaymentItem) => item.paymentType === "monthly").length !== filteredAndSortedItems.length && 
                ` (共 ${paymentItems.filter((item: PaymentItem) => item.paymentType === "monthly").length} 個)`
              }
            </span>
            <Button
              variant={isBatchMode ? "default" : "outline"}
              size="sm"
              onClick={toggleBatchMode}
              className="h-7 text-xs"
              data-testid="toggle-batch-mode"
            >
              <CheckSquare className="w-3 h-3 mr-1" />
              {isBatchMode ? "退出批量模式" : "批量管理"}
            </Button>
          </div>
          
          {/* 快捷篩選按鈕 */}
          <div className="flex gap-2">
            <Button
              variant={filterStatus === "overdue" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(filterStatus === "overdue" ? "all" : "overdue")}
              className="h-7 text-xs"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              逾期項目
            </Button>
            <Button
              variant={sortBy === "amount" && sortOrder === "desc" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSortBy("amount");
                setSortOrder("desc");
              }}
              className="h-7 text-xs"
            >
              <Star className="w-3 h-3 mr-1" />
              高金額優先
            </Button>
            <Button
              variant={sortBy === "startDate" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSortBy("startDate");
                setSortOrder("asc");
              }}
              className="h-7 text-xs"
            >
              <Clock className="w-3 h-3 mr-1" />
              按日期排序
            </Button>
          </div>
        </div>

        {/* 批量操作工具列 */}
        {isBatchMode && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.size === filteredAndSortedItems.length && filteredAndSortedItems.length > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="select-all-checkbox"
                  />
                  <span className="text-sm font-medium text-blue-800">全選</span>
                </div>
                <div className="text-sm text-blue-700">
                  已選擇 <span className="font-bold">{selectedIds.size}</span> 個項目
                  {selectedIds.size > 0 && (
                    <span className="ml-2">
                      (總金額: NT$ <span className="font-bold">{selectedItemsTotal.toLocaleString()}</span>)
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBatchPayConfirm(true)}
                  disabled={selectedUnpaidCount === 0 || batchMarkPaidMutation.isPending}
                  className="bg-white hover:bg-green-50 text-green-700 border-green-300"
                  data-testid="batch-mark-paid-btn"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  批量標記已付 ({selectedUnpaidCount})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBatchDeleteConfirm(true)}
                  disabled={selectedIds.size === 0 || batchDeleteMutation.isPending}
                  className="bg-white hover:bg-red-50 text-red-700 border-red-300"
                  data-testid="batch-delete-btn"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  批量刪除 ({selectedIds.size})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={selectedIds.size === 0}
                  data-testid="clear-selection-btn"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  清除選擇
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Payment Items List */}
      <div className="grid gap-4">
        {filteredAndSortedItems.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <Calendar className="w-12 h-12 text-gray-400" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">還沒有月付項目</h3>
                <p className="text-gray-500 mt-1">建立您的第一個月付項目來開始管理定期付款</p>
              </div>
            </div>
          </Card>
        ) : (
          filteredAndSortedItems.map((item: PaymentItem) => (
            <Card 
              key={item.id} 
              className={`p-4 transition-all ${
                isBatchMode && selectedIds.has(item.id) 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : ''
              }`}
              data-testid={`payment-item-${item.id}`}
            >
              <div className="flex items-center justify-between">
                {/* 批量模式下顯示複選框 */}
                {isBatchMode && (
                  <div className="mr-4">
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                      data-testid={`checkbox-item-${item.id}`}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{item.itemName}</h3>
                    {getPriorityBadge(item)}
                    <Badge variant={item.status === "paid" ? "default" : "secondary"}>
                      {item.status === "paid" ? "已付款" : "待付款"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>金額: NT$ {item.totalAmount ? parseFloat(item.totalAmount).toLocaleString() : '0'}</div>
                    <div>付款日: {item.startDate || '未設定'}</div>
                    <div>專案: {projects.find(p => p.id === item.projectId)?.projectName}</div>
                    <div>分類: {categories.find(c => c.id === item.categoryId)?.categoryName || fixedCategories.find(c => c.id === item.fixedCategoryId)?.categoryName}</div>
                  </div>
                  {item.notes && (
                    <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">{item.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(item)}
                    data-testid={`edit-item-${item.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMutation.mutate(item.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`delete-item-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>編輯月付項目</span>
              <Button
                type="button"
                variant={isEditUnlocked ? "destructive" : "outline"}
                size="sm"
                onClick={toggleEditLock}
                className="text-xs"
              >
                {isEditUnlocked ? "🔓 鎖定編輯" : "🔒 解鎖編輯"}
              </Button>
            </DialogTitle>
            <div className={`text-sm p-3 rounded-lg ${isEditUnlocked ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
              <p className={`font-medium mb-1 ${isEditUnlocked ? 'text-red-800' : 'text-blue-800'}`}>
                {isEditUnlocked ? '⚠️ 編輯模式已解鎖' : '🔒 編輯模式已鎖定'}
              </p>
              <p className={isEditUnlocked ? 'text-red-700' : 'text-blue-700'}>
                {isEditUnlocked 
                  ? '現在可以編輯所有項目資訊，請謹慎修改以避免數據不一致'
                  : '預設僅能修改付款狀態、實際付款日期和備註，其他欄位為唯讀'
                }
              </p>
            </div>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              {/* 顯示分類資訊（唯讀） */}
              <div className="p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-medium text-gray-700 mb-2">分類資訊（不可編輯）</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">分類類型: </span>
                    <span className="font-medium">
                      {editingItem?.fixedCategoryId ? "固定分類" : "專案分類"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">專案: </span>
                    <span className="font-medium">
                      {projects.find(p => p.id === editingItem?.projectId)?.projectName || "未設定"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">分類: </span>
                    <span className="font-medium">
                      {editingItem?.fixedCategoryId 
                        ? fixedCategories.find(c => c.id === editingItem.fixedCategoryId)?.categoryName
                        : categories.find(c => c.id === editingItem?.categoryId)?.categoryName
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* 項目基本資訊 */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="itemName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        項目名稱{!isEditUnlocked && "（鎖定）"}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          readOnly={!isEditUnlocked}
                          className={!isEditUnlocked ? "bg-gray-50" : ""} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        月付金額{!isEditUnlocked && "（鎖定）"}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          readOnly={!isEditUnlocked}
                          className={!isEditUnlocked ? "bg-gray-50" : ""} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        預計付款日期{!isEditUnlocked && "（鎖定）"}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="date" 
                          readOnly={!isEditUnlocked}
                          className={!isEditUnlocked ? "bg-gray-50" : ""} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>實際付款日期</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 付款狀態選擇 */}
              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>付款狀態</FormLabel>
                    <FormControl>
                      <select 
                        {...field} 
                        className="w-full p-2 border border-input rounded-md bg-background"
                      >
                        <option value="pending">待付款</option>
                        <option value="paid">已付款</option>
                        <option value="overdue">逾期</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="付款備註..." rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "更新中..." : "更新月付項目"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 批量刪除確認對話框 */}
      <AlertDialog open={showBatchDeleteConfirm} onOpenChange={setShowBatchDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認批量刪除</AlertDialogTitle>
            <AlertDialogDescription>
              您確定要將 <span className="font-bold text-red-600">{selectedIds.size}</span> 個項目移至回收站嗎？
              <br />
              <span className="text-sm text-gray-500">
                總金額: NT$ {selectedItemsTotal.toLocaleString()}
              </span>
              <br />
              <span className="text-sm text-gray-500">
                已刪除的項目可從回收站恢復。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => batchDeleteMutation.mutate(Array.from(selectedIds))}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-batch-delete"
            >
              {batchDeleteMutation.isPending ? "刪除中..." : "確認刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量付款確認對話框 */}
      <AlertDialog open={showBatchPayConfirm} onOpenChange={setShowBatchPayConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認批量付款</AlertDialogTitle>
            <AlertDialogDescription>
              您確定要將 <span className="font-bold text-green-600">{selectedUnpaidCount}</span> 個未付款項目標記為已付款嗎？
              <br />
              <span className="text-sm text-gray-500">
                付款日期將設為今天
              </span>
              <br />
              <span className="text-sm text-gray-500">
                注意：已付款的項目不會受影響。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const unpaidIds = Array.from(selectedIds).filter(id => {
                  const item = paymentItems.find((item: PaymentItem) => item.id === id);
                  return item && item.status !== "paid";
                });
                batchMarkPaidMutation.mutate(unpaidIds);
              }}
              className="bg-green-600 hover:bg-green-700"
              data-testid="confirm-batch-pay"
            >
              {batchMarkPaidMutation.isPending ? "處理中..." : "確認付款"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}