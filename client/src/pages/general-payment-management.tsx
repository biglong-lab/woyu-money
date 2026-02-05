import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Filter, SortAsc, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Calendar, Clock, DollarSign, FileText, CreditCard, Upload, X, FileSpreadsheet, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import CategorySelector from "@/components/category-selector";
import { BatchImportWizard } from "@/components/batch-import-wizard";

type PaymentItem = {
  id: number;
  itemName: string;
  totalAmount: string;
  categoryId?: number;
  projectId: number;
  paymentType: "monthly" | "installment" | "single";
  startDate: string;
  endDate?: string;
  installmentMonths?: number;
  paidAmount: string;
  status: string;
  notes?: string;
  fixedCategoryId?: number;
  createdAt: string;
  updatedAt: string;
  // 項目來源追蹤
  source?: 'manual' | 'ai_scan';
  sourceDocumentId?: number;
  documentUploadedAt?: string;
  documentUploadedByUserId?: number;
  documentUploadedByUsername?: string;
  archivedByUserId?: number;
  archivedByUsername?: string;
  archivedAt?: string;
  // Computed properties
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

export default function GeneralPaymentManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // 核心狀態管理 - 統一整理
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number | null>(null); // 預設顯示所有年份
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // 預設顯示所有月份
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showPaidItems, setShowPaidItems] = useState(true);
  const [sortBy, setSortBy] = useState<string>("dueDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc"); // 預設最新在前

  // 操作狀態管理
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [paymentItem, setPaymentItem] = useState<PaymentItem | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  
  // 篩選器展開狀態 - 時間範圍保持展開，優先級可收納
  const [isPriorityFilterOpen, setIsPriorityFilterOpen] = useState(false);

  // 分類選擇器狀態
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  // 圖片上傳狀態
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  // 表單定義
  const createForm = useForm({
    defaultValues: {
      itemName: "",
      amount: "",
      categoryId: "",
      projectId: "",
      fixedCategoryId: "",
      dueDate: "",
      paymentDate: "",
      notes: "",
      categoryType: "",
    },
  });

  const editForm = useForm({
    defaultValues: {
      itemName: "",
      totalAmount: "",
      startDate: "",
      notes: "",
    },
  });

  const paymentForm = useForm({
    defaultValues: {
      paymentAmount: "",
      paymentDate: "",
      notes: "",
    },
  });

  // 圖片上傳處理
  const handleReceiptUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "文件過大",
          description: "請選擇小於5MB的圖片文件",
          variant: "destructive",
        });
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: "文件格式錯誤",
          description: "請選擇圖片文件",
          variant: "destructive",
        });
        return;
      }

      setReceiptFile(file);
      
      // 創建預覽
      const reader = new FileReader();
      reader.onload = (e) => {
        setReceiptPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReceiptFile = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  // 詳細檢視處理
  const [detailItem, setDetailItem] = useState<PaymentItem | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [showAuditHistory, setShowAuditHistory] = useState(false);

  const handleViewDetails = (item: PaymentItem) => {
    setDetailItem(item);
    setShowAuditHistory(false);
    setIsDetailDialogOpen(true);
  };

  // 獲取審計日誌
  const { data: auditLogs = [], isLoading: isLoadingAuditLogs } = useQuery({
    queryKey: [`/api/payment/items/${detailItem?.id}/audit-logs`],
    enabled: !!detailItem && showAuditHistory,
  });

  // 編輯處理
  const [editItem, setEditItem] = useState<PaymentItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Edit form state
  const [editSelectedCategoryId, setEditSelectedCategoryId] = useState("");
  const [editSelectedProjectId, setEditSelectedProjectId] = useState("");

  const handleEdit = (item: PaymentItem) => {
    setEditItem(item);
    setIsEditDialogOpen(true);
    
    // 填充編輯表單
    editForm.reset({
      itemName: item.itemName,
      totalAmount: item.totalAmount,
      startDate: item.startDate,
      notes: item.notes || "",
    });
    
    // 設置分類選擇器狀態
    if (item.fixedCategoryId) {
      setEditSelectedCategoryId(item.fixedCategoryId.toString());
    } else if (item.categoryId) {
      setEditSelectedCategoryId(item.categoryId.toString());
    }
    
    if (item.projectId) {
      setEditSelectedProjectId(item.projectId.toString());
    }
  };

  // 刪除處理
  const [deleteItem, setDeleteItem] = useState<PaymentItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDelete = (item: PaymentItem) => {
    setDeleteItem(item);
    setIsDeleteDialogOpen(true);
  };


  // 統一數據刷新處理
  const handleRefreshData = async () => {
    try {
      await Promise.all([
        refetchItems(),
        refetchProjects(),
        refetchCategories(),
        refetchFixed()
      ]);
      toast({
        title: "數據更新完成",
        description: "所有付款項目數據已同步更新",
      });
    } catch (error) {
      toast({
        title: "數據更新失敗",
        description: "請稍後重試或檢查網絡連接",
        variant: "destructive",
      });
    }
  };

  // 清除所有篩選條件
  const handleClearAllFilters = () => {
    setSearchTerm("");
    setSelectedProject("all");
    setSelectedCategory("all");
    setSelectedStatus("unpaid");
    setSelectedPaymentType("all");
    setDateRange("all");
    setSelectedYear(null);
    setSelectedMonth(null);
    setStartDate("");
    setEndDate("");
    setPriorityFilter("all");
    setShowPaidItems(false);
    setSortBy("dueDate");
    setSortOrder("asc");
    
    toast({
      title: "篩選已重置",
      description: "所有篩選條件已清除並重置為預設值",
    });
  };

  // 核心數據查詢 - 一般付款管理專用API調用，排除租約資料
  const { data: paymentItemsResponse, isLoading, refetch: refetchItems } = useQuery<any>({
    queryKey: ["/api/payment/items?limit=500&itemType=general"],
    staleTime: 30000, // 30秒緩存
    refetchOnWindowFocus: false,
  });

  // 處理API響應格式：可能是數組或包含items的對象
  const paymentItems: PaymentItem[] = Array.isArray(paymentItemsResponse)
    ? paymentItemsResponse
    : (paymentItemsResponse?.items || []);

  // 調試信息
  console.log('一般付款管理 - 原始回應:', paymentItemsResponse);
  console.log('一般付款管理 - 處理後項目:', paymentItems);
  console.log('一般付款管理 - 項目數量:', paymentItems.length);

  const { data: projects = [], refetch: refetchProjects } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
    staleTime: 60000, // 1分鐘緩存
    refetchOnWindowFocus: false,
  });

  const { data: projectCategories = [], refetch: refetchCategories } = useQuery<DebtCategory[]>({
    queryKey: ["/api/categories/project"],
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: fixedCategories = [], refetch: refetchFixed } = useQuery<FixedCategory[]>({
    queryKey: ["/api/fixed-categories"],
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // 合併所有分類
  const allCategories = [
    ...fixedCategories.map((cat: any) => ({ ...cat, categoryType: 'fixed', source: '固定分類' })),
    ...projectCategories.map((cat: any) => ({ ...cat, categoryType: 'project', source: '專案分類' }))
  ];

  // Show all general payment items (already filtered by server)
  const generalItems = useMemo(() => {
    console.log('一般付款管理 - 篩選前總項目:', paymentItems.length);
    console.log('一般付款管理 - 項目類型分佈:', paymentItems?.reduce((acc: any, item: any) => {
      acc[item.paymentType] = (acc[item.paymentType] || 0) + 1;
      return acc;
    }, {}) || {});
    
    // 查找木工隔間項目並debug
    const mokongItem = paymentItems?.find((item: any) => item.itemName?.includes('木工隔間'));
    if (mokongItem) {
      console.log('一般付款管理 - 找到木工隔間項目:', {
        id: mokongItem.id,
        itemName: mokongItem.itemName,
        totalAmount: mokongItem.totalAmount,
        paidAmount: mokongItem.paidAmount,
        status: mokongItem.status
      });
    }
    
    // Server has already filtered for general items, return all
    return paymentItems;
  }, [paymentItems]);

  // 一鍵重置所有篩選
  const resetAllFilters = () => {
    setSearchTerm("");
    setSelectedProject("all");
    setSelectedCategory("all");
    setSelectedStatus("all");
    setSelectedPaymentType("all");
    setDateRange("all");
    setSelectedYear(null);
    setSelectedMonth(null);
    setStartDate("");
    setEndDate("");
    setPriorityFilter("all");
    setShowPaidItems(true);
  };

  // 快速篩選預設 - 保留專案和分類篩選，只調整時間/狀態篩選
  const applyQuickFilter = (filterType: string) => {
    const today = new Date();
    
    // 重置時間和狀態相關篩選，但保留專案/分類篩選
    setSelectedStatus("all");
    setSelectedPaymentType("all");
    setDateRange("all");
    setSelectedYear(null);
    setSelectedMonth(null);
    setStartDate("");
    setEndDate("");
    setPriorityFilter("all");
    setShowPaidItems(true);
    setSearchTerm("");
    
    switch (filterType) {
      case "pending":
        setSelectedStatus("pending");
        setShowPaidItems(false);
        break;
      case "overdue":
        setPriorityFilter("overdue");
        setShowPaidItems(false);
        break;
      case "thisMonth":
        setSelectedYear(today.getFullYear());
        setSelectedMonth(today.getMonth() + 1);
        break;
      case "unpaid":
        setShowPaidItems(false);
        break;
    }
  };

  // 計算各狀態數量
  const statusCounts = useMemo(() => {
    const today = new Date();
    return {
      pending: generalItems.filter((item: PaymentItem) => item.status === "pending").length,
      paid: generalItems.filter((item: PaymentItem) => item.status === "paid").length,
      overdue: generalItems.filter((item: PaymentItem) => 
        item.status !== "paid" && new Date(item.startDate) < today
      ).length,
      thisMonth: generalItems.filter((item: PaymentItem) => {
        const itemDate = new Date(item.startDate);
        return itemDate.getMonth() === today.getMonth() && 
               itemDate.getFullYear() === today.getFullYear();
      }).length,
    };
  }, [generalItems]);

  // Enhanced filtering logic from payment-records
  const filteredItems = useMemo(() => {
    const filtered = generalItems.filter((item: PaymentItem) => {
      // Search filter
      const matchesSearch = !searchTerm || 
        item.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.categoryName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Project filter - 使用 projectId 直接比對
      const matchesProject = selectedProject === "all" || 
        item.projectId?.toString() === selectedProject;
      
      // Category filter - 使用 categoryId 或 fixedCategoryId 直接比對
      const matchesCategory = selectedCategory === "all" || 
        item.categoryId?.toString() === selectedCategory ||
        item.fixedCategoryId?.toString() === selectedCategory;

      // Status filter
      const matchesStatus = selectedStatus === "all" || item.status === selectedStatus;

      // Payment type filter
      const matchesPaymentType = selectedPaymentType === "all" || item.paymentType === selectedPaymentType;

      // Show/hide paid items
      const showItem = showPaidItems || item.status !== "paid";

      // Date range filtering
      let matchesDate = true;
      const itemDate = new Date(item.startDate);
      
      // Year filtering
      if (selectedYear !== null && itemDate.getFullYear() !== selectedYear) {
        matchesDate = false;
      }
      
      // Month filtering (selectedMonth is 1-12, getMonth() returns 0-11)
      if (selectedMonth !== null && itemDate.getMonth() !== (selectedMonth - 1)) {
        matchesDate = false;
      }
      
      // Custom date range filtering
      if (startDate && itemDate < new Date(startDate)) {
        matchesDate = false;
      }
      if (endDate && itemDate > new Date(endDate)) {
        matchesDate = false;
      }
      
      // Preset time range filtering
      if (dateRange !== "all" && !startDate && !endDate) {
        const today = new Date();
        
        switch (dateRange) {
          case "today":
            matchesDate = itemDate.toDateString() === today.toDateString();
            break;
          case "week":
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = itemDate >= weekAgo;
            break;
          case "month":
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            matchesDate = itemDate >= monthAgo;
            break;
          case "quarter":
            const quarterAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
            matchesDate = itemDate >= quarterAgo;
            break;
          case "current-month":
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            matchesDate = itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
            break;
        }
      }

      // Priority filter (legacy support)
      let matchesPriority = true;
      if (priorityFilter !== "all") {
        const today = new Date();
        if (priorityFilter === "urgent") {
          const urgentDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          matchesPriority = item.status !== "paid" && new Date(item.startDate) <= urgentDate;
        } else if (priorityFilter === "overdue") {
          matchesPriority = item.status !== "paid" && new Date(item.startDate) < today;
        }
      }

      return matchesSearch && matchesProject && matchesCategory && matchesStatus && 
             matchesPaymentType && showItem && matchesDate && matchesPriority;
    }).sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "dueDate":
          comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case "amount":
          comparison = parseFloat(a.totalAmount) - parseFloat(b.totalAmount);
          break;
        case "itemName":
          comparison = a.itemName.localeCompare(b.itemName);
          break;
        case "projectName":
          comparison = (a.projectName || "").localeCompare(b.projectName || "");
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "");
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        default:
          comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    console.log('一般付款管理 - 最終篩選結果:', filtered.length);
    console.log('一般付款管理 - 篩選條件狀態:', {
      searchTerm,
      selectedProject,
      selectedCategory,
      selectedStatus,
      selectedPaymentType,
      showPaidItems,
      selectedYear,
      selectedMonth,
      startDate,
      endDate,
      dateRange,
      priorityFilter
    });
    
    return filtered;
  }, [generalItems, searchTerm, selectedProject, selectedCategory, selectedStatus, 
      selectedPaymentType, showPaidItems, selectedYear, selectedMonth, startDate, 
      endDate, dateRange, priorityFilter, projects, allCategories, sortBy, sortOrder]);

  // Statistics calculation
  const totalAmount = filteredItems.reduce((sum, item) => sum + parseFloat(item.totalAmount), 0);
  const totalPaidAmount = filteredItems.reduce((sum, item) => sum + parseFloat(item.paidAmount || '0'), 0);
  const totalRecords = filteredItems.length;

  // Enhanced Statistics with Monthly Data
  const statistics = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Filter items for current month
    const currentMonthItems = generalItems.filter(item => {
      const startDate = new Date(item.startDate);
      return startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear;
    });
    
    // Filter items before current month (overdue)
    const pastDueItems = generalItems.filter(item => {
      const startDate = new Date(item.startDate);
      return startDate < new Date(currentYear, currentMonth, 1) && item.status !== "paid";
    });
    
    const totalItems = filteredItems.length;
    const totalAmount = filteredItems.reduce((sum, item) => {
      const amount = parseFloat(item.totalAmount || "0");
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    
    const paidAmount = filteredItems.reduce((sum, item) => {
      const paid = parseFloat(item.paidAmount || "0");
      return sum + (isNaN(paid) ? 0 : paid);
    }, 0);
    
    const unpaidItems = filteredItems.filter(item => item.status !== "paid").length;
    

    
    // Monthly statistics
    const monthlyDue = currentMonthItems.reduce((sum, item) => sum + parseFloat(item.totalAmount || "0"), 0);
    const monthlyPaid = currentMonthItems.reduce((sum, item) => sum + parseFloat(item.paidAmount || "0"), 0);
    const monthlyUnpaid = monthlyDue - monthlyPaid;
    const overdueUnpaid = pastDueItems.reduce((sum, item) => sum + (parseFloat(item.totalAmount || "0") - parseFloat(item.paidAmount || "0")), 0);
    
    const urgentDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const urgentItems = filteredItems.filter(item => {
      return item.status !== "paid" && new Date(item.startDate) <= urgentDate && new Date(item.startDate) >= today;
    }).length;

    return {
      totalItems,
      totalAmount,
      paidAmount,
      unpaidAmount: totalAmount - paidAmount,
      unpaidItems,
      urgentItems,
      overdueItems: pastDueItems.length,
      // Monthly statistics
      monthlyDue,
      monthlyPaid,
      monthlyUnpaid,
      overdueUnpaid
    };
  }, [filteredItems, generalItems]);



  // Form schema and setup - already defined above

  // Watch for fixed category selection to auto-populate item name
  const watchedFixedCategoryId = createForm.watch("fixedCategoryId");
  const watchedCategoryId = createForm.watch("categoryId");
  
  useEffect(() => {
    if (watchedFixedCategoryId && fixedCategories) {
      const selectedFixedCategory = fixedCategories.find(cat => cat.id === parseInt(watchedFixedCategoryId));
      if (selectedFixedCategory) {
        createForm.setValue("itemName", selectedFixedCategory.categoryName);
      }
    } else if (watchedCategoryId && !watchedFixedCategoryId) {
      // For project categories, allow custom input - clear the field to allow editing
      createForm.setValue("itemName", "");
    }
  }, [watchedFixedCategoryId, watchedCategoryId, fixedCategories, createForm]);

  // Forms already defined above - avoiding duplicates

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Sending data to API:", data);
      const response = await apiRequest("POST", "/api/payment/items", data);
      console.log("API response:", response);
      return response;
    },
    onSuccess: (response) => {
      console.log("Creation successful:", response);
      // 無效化所有相關的查詢快取
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/records"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project"], refetchType: "all" });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "一般付款項目建立成功",
        description: "新的付款項目已成功建立",
      });
    },
    onError: (error: any) => {
      console.error("Creation failed:", error);
      toast({
        title: "建立失敗",
        description: error.message || "建立付款項目時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PUT", `/api/payment/items/${id}`, data);
    },
    onSuccess: () => {
      // 更新所有相關的查詢快取
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items?limit=500&itemType=general"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project"] });
      setIsEditDialogOpen(false);
      setEditItem(null);
      editForm.reset();
      toast({
        title: "付款項目更新成功",
        description: "付款項目資訊已成功更新",
      });
    },
    onError: (error: any) => {
      toast({
        title: "更新失敗",
        description: error.message || "更新付款項目時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: { itemId: number; paymentAmount: string; paymentDate: string; notes?: string; receiptFile?: File }) => {
      const formData = new FormData();
      formData.append('amount', data.paymentAmount);
      formData.append('paymentDate', data.paymentDate);
      if (data.notes) formData.append('notes', data.notes);
      if (data.receiptFile) formData.append('receiptFile', data.receiptFile);

      return fetch(`/api/payment/items/${data.itemId}/payments`, {
        method: 'POST',
        body: formData,
      }).then(res => {
        if (!res.ok) throw new Error('上傳失敗');
        return res.json();
      });
    },
    onSuccess: () => {
      // 更新所有相關的查詢快取
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items?limit=500&itemType=general"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project"] });
      setIsPaymentDialogOpen(false);
      paymentForm.reset();
      removeReceiptFile();
      toast({
        title: "付款成功",
        description: "付款記錄已成功添加",
      });
    },
    onError: (error: any) => {
      toast({
        title: "付款失敗",
        description: error.message || "添加付款記錄時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const handleCreateSubmit = (data: any) => {
    console.log("Form data received:", data);
    console.log("Form errors:", createForm.formState.errors);
    
    // 驗證必填欄位
    if (!data.itemName) {
      createForm.setError("itemName", { 
        type: "manual", 
        message: "項目名稱為必填欄位" 
      });
      return;
    }
    
    if (!data.categoryType) {
      createForm.setError("categoryType", { 
        type: "manual", 
        message: "請選擇分類類型" 
      });
      return;
    }
    
    if (data.categoryType === "project" && !data.categoryId) {
      createForm.setError("categoryId", { 
        type: "manual", 
        message: "請選擇專案分類" 
      });
      return;
    }
    
    if (data.categoryType === "fixed" && !data.fixedCategoryId) {
      createForm.setError("fixedCategoryId", { 
        type: "manual", 
        message: "請選擇固定分類" 
      });
      return;
    }
    
    if (!data.projectId) {
      createForm.setError("projectId", { 
        type: "manual", 
        message: "請選擇專案" 
      });
      return;
    }
    
    if (!data.amount || parseFloat(data.amount) <= 0) {
      createForm.setError("amount", { 
        type: "manual", 
        message: "請輸入有效的付款金額" 
      });
      return;
    }
    
    const processedData = {
      itemName: data.itemName,
      categoryId: data.categoryId ? parseInt(data.categoryId) : null,
      projectId: parseInt(data.projectId),
      fixedCategoryId: data.fixedCategoryId ? parseInt(data.fixedCategoryId) : null,
      totalAmount: data.amount.toString(),
      paymentType: "single", // 一般付款管理專門處理一次性付款
      startDate: data.dueDate, // 將 dueDate 對應到資料庫的 startDate 欄位
      notes: data.notes || null,
    };
    
    console.log("Processed data for API:", processedData);
    createMutation.mutate(processedData);
  };

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!editItem?.id) throw new Error("無效的項目ID");
      
      const updateData = {
        itemName: data.itemName,
        totalAmount: data.totalAmount,
        startDate: data.startDate,
        notes: data.notes,
        categoryId: editSelectedCategoryId ? parseInt(editSelectedCategoryId) : null,
        fixedCategoryId: editSelectedCategoryId && fixedCategories.find(c => c.id === parseInt(editSelectedCategoryId)) 
          ? parseInt(editSelectedCategoryId) : null,
        projectId: editSelectedProjectId ? parseInt(editSelectedProjectId) : null,
      };
      
      return apiRequest("PUT", `/api/payment/items/${editItem.id}`, updateData);
    },
    onSuccess: () => {
      // 無效化所有相關的查詢快取
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/records"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project"], refetchType: "all" });
      setIsEditDialogOpen(false);
      editForm.reset();
      setSelectedCategoryId("");
      setSelectedProjectId("");
      toast({
        title: "更新成功",
        description: "付款項目已成功更新",
      });
    },
    onError: (error: any) => {
      toast({
        title: "更新失敗",
        description: error.message || "更新付款項目時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return apiRequest("DELETE", `/api/payment/items/${itemId}`);
    },
    onSuccess: () => {
      // 無效化所有相關的查詢快取
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/records"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project"], refetchType: "all" });
      setIsDeleteDialogOpen(false);
      toast({
        title: "刪除成功",
        description: "付款項目已成功刪除",
      });
    },
    onError: (error: any) => {
      toast({
        title: "刪除失敗",
        description: error.message || "刪除付款項目時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const handleEditSubmit = (data: any) => {
    if (!editItem) return;
    editMutation.mutate(data);
  };

  const handleDeleteConfirm = () => {
    if (!deleteItem) return;
    deleteMutation.mutate(deleteItem.id);
  };

  const handlePayment = (item: PaymentItem) => {
    setPaymentItem(item);
    const remainingAmount = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0");
    paymentForm.reset({
      paymentAmount: remainingAmount.toString(),
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ""
    });
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = (data: any) => {
    if (!paymentItem) return;
    
    paymentMutation.mutate({
      itemId: paymentItem.id,
      paymentAmount: data.paymentAmount,
      paymentDate: data.paymentDate,
      notes: data.notes,
      receiptFile: receiptFile || undefined
    });
  };

  const getPriorityBadge = (item: PaymentItem) => {
    // 已付款項目不顯示優先級標籤
    if (item.status === "paid") return null;
    
    const today = new Date();
    const startDate = new Date(item.startDate);
    const daysDiff = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 0) {
      return <Badge variant="destructive">逾期 {Math.abs(daysDiff)} 天</Badge>;
    } else if (daysDiff <= 7) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">急迫 {daysDiff} 天內</Badge>;
    }
    return null;
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
      {/* Header - 改善標題設計和文字層次 */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" />
            一般付款管理
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2 leading-relaxed">
            管理所有一次性付款項目，簡單快速的付款處理流程
          </p>
          
          {/* 篩選狀態提示和重置按鈕 */}
          {(selectedYear !== null || selectedMonth !== null || selectedStatus !== "all" || selectedProject !== "all" || selectedCategory !== "all" || searchTerm !== "") && (
            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-sm text-orange-700 font-medium">
                    已套用篩選條件 - 顯示 {filteredItems.length} 項結果
                  </span>
                </div>
                <Button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedProject("all");
                    setSelectedCategory("all");
                    setSelectedStatus("all");
                    setSelectedPaymentType("all");
                    setSelectedYear(null);
                    setSelectedMonth(null);
                    setDateRange("all");
                    setStartDate("");
                    setEndDate("");
                    setPriorityFilter("all");
                    setShowPaidItems(false);
                  }}
                  variant="outline"
                  size="sm"
                  className="text-orange-700 border-orange-300 hover:bg-orange-100"
                >
                  顯示所有資料
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span className="text-sm sm:text-base">新增付款項目</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="create-payment-description">
            <DialogHeader>
              <DialogTitle>新增一般付款項目</DialogTitle>
            </DialogHeader>
            <div id="create-payment-description" className="sr-only">
              建立新的一般付款項目，設定分類、專案、金額及付款日期
            </div>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                {/* 使用 CategorySelector 組件 */}
                <CategorySelector 
                  form={createForm}
                  onCategoryChange={(categoryData) => {
                    // 處理分類變更
                    if (categoryData.itemName) {
                      createForm.setValue("itemName", categoryData.itemName);
                    }
                  }}
                />

                {/* 第三行：項目名稱和付款金額 */}
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
                            placeholder="輸入付款項目名稱（可自定義專案專屬項目）"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>金額</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="輸入金額" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 第四行：日期欄位 */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>預計付款日期</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
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

                {/* 第五行：備註 */}
                <FormField
                  control={createForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>備註</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="付款項目相關備註" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "建立中..." : "建立付款項目"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        <Button 
          onClick={() => setIsBatchImportOpen(true)}
          variant="outline" 
          className="flex items-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span className="text-sm sm:text-base">批量導入</span>
        </Button>
      </div>
      </div>

      {/* Monthly Statistics Cards - 改善視覺設計和文字對比度 */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="p-4 border border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-0">
            <CardTitle className="text-sm font-medium text-gray-700 tracking-wide">本月應付</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="px-0">
            <div className="text-xl font-bold text-blue-700 leading-none">NT$ {statistics.monthlyDue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="p-4 border border-green-100 shadow-sm bg-green-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-0">
            <CardTitle className="text-sm font-medium text-gray-700 tracking-wide">本月已付</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="px-0">
            <div className="text-xl font-bold text-green-700 leading-none">NT$ {statistics.monthlyPaid.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="p-4 border border-orange-100 shadow-sm bg-orange-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-0">
            <CardTitle className="text-sm font-medium text-gray-700 tracking-wide">本月未付</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent className="px-0">
            <div className="text-xl font-bold text-orange-700 leading-none">NT$ {statistics.monthlyUnpaid.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="p-4 border border-red-100 shadow-sm bg-red-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-0">
            <CardTitle className="text-sm font-medium text-gray-700 tracking-wide">應付未付（本月之前）</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent className="px-0">
            <div className="text-xl font-bold text-red-700 leading-none">NT$ {statistics.overdueUnpaid.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Filters - 完整兩行式篩選介面 */}
      <Card className="mb-6 border-2 border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800">進階篩選與搜尋</span>
              <span className="text-sm font-normal text-gray-500">
                (顯示 {filteredItems.length} / {generalItems.length} 筆)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={resetAllFilters}
                className="flex items-center gap-2 hover:bg-red-50 text-red-600 border-red-200"
                data-testid="btn-reset-filters"
              >
                <X className="w-4 h-4" />
                重置篩選
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRefreshData}
                className="flex items-center gap-2 hover:bg-blue-100"
              >
                <RefreshCw className="w-4 h-4" />
                刷新數據
              </Button>
            </div>
          </CardTitle>
          
          {/* 快速篩選按鈕 */}
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge 
              variant="outline"
              className="cursor-pointer px-3 py-1 hover:bg-orange-100 border-orange-300 text-orange-700"
              onClick={() => applyQuickFilter("pending")}
              data-testid="quick-filter-pending"
            >
              待付款 ({statusCounts.pending})
            </Badge>
            <Badge 
              variant="outline"
              className="cursor-pointer px-3 py-1 hover:bg-red-100 border-red-300 text-red-700"
              onClick={() => applyQuickFilter("overdue")}
              data-testid="quick-filter-overdue"
            >
              已逾期 ({statusCounts.overdue})
            </Badge>
            <Badge 
              variant="outline"
              className="cursor-pointer px-3 py-1 hover:bg-blue-100 border-blue-300 text-blue-700"
              onClick={() => applyQuickFilter("thisMonth")}
              data-testid="quick-filter-thismonth"
            >
              本月 ({statusCounts.thisMonth})
            </Badge>
            <Badge 
              variant="outline"
              className="cursor-pointer px-3 py-1 hover:bg-gray-100 border-gray-300 text-gray-700"
              onClick={() => applyQuickFilter("unpaid")}
              data-testid="quick-filter-unpaid"
            >
              所有未付
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 第一行：搜尋和基本篩選 */}
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">第一行</span>
              基本搜尋與篩選
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="搜尋項目名稱或備註..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="選擇專案" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有專案</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="選擇分類" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有分類</SelectItem>
                {allCategories.map((category) => (
                  <SelectItem key={`${category.categoryType}-${category.id}`} value={category.id.toString()}>
                    <div className="flex items-center justify-between w-full">
                      <span>{category.categoryName}</span>
                      <span className="text-xs text-gray-500 ml-2">{category.source}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="付款狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有狀態</SelectItem>
                <SelectItem value="unpaid">未付款</SelectItem>
                <SelectItem value="partial">部分付款</SelectItem>
                <SelectItem value="paid">已付款</SelectItem>
                <SelectItem value="overdue">逾期</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue placeholder="時間範圍" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有時間</SelectItem>
                <SelectItem value="today">今日</SelectItem>
                <SelectItem value="week">近7天</SelectItem>
                <SelectItem value="month">近30天</SelectItem>
                <SelectItem value="current-month">本月</SelectItem>
                <SelectItem value="quarter">近90天</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={handleClearAllFilters}
            >
              清除篩選
            </Button>
            </div>
          </div>

          {/* 第二行：時間範圍篩選 - 始終展開 */}
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">第二行</span>
              時間範圍篩選
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-8 items-end">
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium">年份</label>
              <Select value={selectedYear?.toString() || "all"} onValueChange={(value) => setSelectedYear(value === "all" ? null : parseInt(value))}>
                <SelectTrigger className="bg-blue-50 border-blue-200">
                  <SelectValue placeholder="選擇年份" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有年份</SelectItem>
                  {Array.from({length: 12}, (_, i) => new Date().getFullYear() - 2 + i).map(year => {
                    const currentYear = new Date().getFullYear();
                    const isCurrentYear = year === currentYear;
                    return (
                      <SelectItem 
                        key={year} 
                        value={year.toString()}
                        className={isCurrentYear ? "bg-blue-100 font-semibold text-blue-800" : ""}
                      >
                        {year}年 {isCurrentYear && "本年"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium">月份</label>
              <Select 
                value={selectedMonth !== null ? selectedMonth.toString() : "all"} 
                onValueChange={(value) => setSelectedMonth(value === "all" ? null : parseInt(value))}
              >
                <SelectTrigger className="bg-green-50 border-green-200">
                  <SelectValue placeholder="選擇月份" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有月份</SelectItem>
                  {Array.from({length: 12}, (_, i) => i + 1).map(month => {
                    const currentMonth = new Date().getMonth() + 1;
                    const isCurrentMonth = month === currentMonth;
                    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
                    return (
                      <SelectItem 
                        key={month} 
                        value={month.toString()}
                        className={isCurrentMonth ? "bg-green-100 font-semibold text-green-800" : ""}
                      >
                        {monthNames[month - 1]} {isCurrentMonth && "本月"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium">排序方式</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-purple-50 border-purple-200">
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dueDate">到期日期</SelectItem>
                  <SelectItem value="amount">金額大小</SelectItem>
                  <SelectItem value="itemName">項目名稱</SelectItem>
                  <SelectItem value="projectName">專案名稱</SelectItem>
                  <SelectItem value="status">付款狀態</SelectItem>
                  <SelectItem value="createdAt">建立時間</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium">排序順序</label>
              <Select value={sortOrder} onValueChange={(value: "asc" | "desc") => setSortOrder(value)}>
                <SelectTrigger className="bg-purple-50 border-purple-200">
                  <SelectValue placeholder="排序順序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">升序 ↑</SelectItem>
                  <SelectItem value="desc">降序 ↓</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium">開始日期</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium">結束日期</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            </div>
          </div>

          {/* 第三行：優先級篩選 - 可收納 */}
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div 
              className="text-sm font-medium text-gray-700 mb-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded"
              onClick={() => setIsPriorityFilterOpen(!isPriorityFilterOpen)}
            >
              <div className="flex items-center gap-2">
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">第三行</span>
                優先級與進階篩選
              </div>
              {isPriorityFilterOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            
            {isPriorityFilterOpen && (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 items-end">
                <div className="flex flex-col space-y-1">
                  <label className="text-sm font-medium">優先順序</label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="優先順序" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有項目</SelectItem>
                      <SelectItem value="overdue">逾期項目</SelectItem>
                      <SelectItem value="urgent">急迫項目</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="show-paid"
                    checked={showPaidItems}
                    onCheckedChange={setShowPaidItems}
                  />
                  <label htmlFor="show-paid" className="text-sm">顯示已付款</label>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 統計概覽 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">總項目數</p>
                <p className="text-2xl font-bold text-blue-600">{statistics.totalItems}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">總金額</p>
                <p className="text-2xl font-bold text-green-600">
                  ${statistics.totalAmount.toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">已付金額</p>
                <p className="text-2xl font-bold text-green-600">
                  ${statistics.paidAmount.toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">待付金額</p>
                <p className="text-2xl font-bold text-orange-600">
                  ${(statistics.totalAmount - statistics.paidAmount).toLocaleString()}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Items List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>一般付款項目列表</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              顯示 {filteredItems.length} / {generalItems.length} 項目
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefreshData}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              重新載入
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredItems.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2 text-gray-600">
                  {generalItems.length === 0 ? "尚無付款項目" : "找不到符合條件的項目"}
                </p>
                <p className="text-gray-500 mb-4">
                  {generalItems.length === 0 
                    ? "點擊右上角「新增付款項目」開始建立您的付款項目" 
                    : `共有 ${generalItems.length} 筆付款項目，但目前篩選條件沒有匹配結果`}
                </p>
                {generalItems.length > 0 && (
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetAllFilters}
                      className="flex items-center gap-2"
                      data-testid="btn-reset-filters-empty"
                    >
                      <RefreshCw className="w-4 h-4" />
                      重置所有篩選
                    </Button>
                    <span className="text-sm text-gray-400">或</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyQuickFilter("pending")}
                      className="flex items-center gap-2"
                      data-testid="btn-quick-pending-empty"
                    >
                      查看待付款項目
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              filteredItems.map((item) => {
                const project = projects.find(p => p.id === item.projectId);
                const category = allCategories.find(c => c.id === item.categoryId || c.id === item.fixedCategoryId);
                const isPaid = item.status === "paid";
                const isOverdue = !isPaid && item.startDate && new Date(item.startDate) < new Date();

                return (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${
                      isPaid ? "border-green-200 bg-green-50" : 
                      isOverdue ? "border-red-200 bg-red-50" : "border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-lg">{item.itemName}</h3>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">一般付款</Badge>
                          {item.source === 'ai_scan' ? (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800 border border-purple-300">
                              <span className="mr-1">🤖</span>AI掃描
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                              手動新增
                            </Badge>
                          )}
                          {isPaid && <Badge variant="default" className="bg-green-600">已付款</Badge>}
                          {getPriorityBadge(item)}
                        </div>
                        
                        <div className="grid md:grid-cols-4 gap-4 text-sm text-gray-600 mb-2">
                          <div>
                            <span className="font-medium">專案：</span>
                            {project?.projectName || "無"}
                          </div>
                          <div>
                            <span className="font-medium">分類：</span>
                            {category ? `${category.categoryName} (${category.source})` : "無"}
                          </div>
                          <div>
                            <span className="font-medium">到期日：</span>
                            {item.startDate ? new Date(item.startDate).toLocaleDateString('zh-TW') : '未設定'}
                          </div>
                        </div>

                        {item.notes && (
                          <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded mt-2">
                            <strong>備註：</strong>{item.notes}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right ml-4 min-w-[200px]">
                        <div className="space-y-1 mb-3">
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">應付總額：</span>NT${parseFloat(item.totalAmount).toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">應付餘款：</span>NT${(parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0")).toLocaleString()}
                          </div>
                          <div className="text-sm text-red-600">
                            <span className="font-medium">累積應付未付：</span>NT${(parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0")).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(item)}
                              className="flex-1"
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              詳細
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(item)}
                              className="flex-1"
                            >
                              編輯
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handlePayment(item)}
                              className="bg-green-600 hover:bg-green-700 text-white flex-1"
                              disabled={isPaid}
                            >
                              <DollarSign className="w-4 h-4 mr-1" />
                              {isPaid ? "已付款" : "付款"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(item)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              刪除
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>付款記錄</DialogTitle>
            {paymentItem && (
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>項目：</strong>{paymentItem.itemName}</p>
                <p><strong>總金額：</strong>NT$ {parseFloat(paymentItem.totalAmount).toLocaleString()}</p>
                <p><strong>已付金額：</strong>NT$ {parseFloat(paymentItem.paidAmount || "0").toLocaleString()}</p>
                <p><strong>待付金額：</strong>NT$ {(parseFloat(paymentItem.totalAmount) - parseFloat(paymentItem.paidAmount || "0")).toLocaleString()}</p>
              </div>
            )}
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(handlePaymentSubmit)} className="space-y-4">
              <FormField
                control={paymentForm.control}
                name="paymentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>付款金額</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" placeholder="輸入付款金額" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>付款日期</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註（選填）</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="付款相關備註" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* 圖片上傳欄位 */}
              <div className="space-y-3">
                <Label>付款單據（選填）</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptUpload}
                      className="file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700"
                    />
                    {receiptFile && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removeReceiptFile}
                        className="text-red-600 hover:text-red-700"
                      >
                        移除
                      </Button>
                    )}
                  </div>
                  
                  {receiptPreview && (
                    <div className="mt-2">
                      <img
                        src={receiptPreview}
                        alt="付款單據預覽"
                        className="max-w-full h-32 object-cover rounded border"
                      />
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500">
                    支援格式：JPG, PNG, GIF（最大 5MB）
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPaymentDialogOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={paymentMutation.isPending}>
                  {paymentMutation.isPending ? "處理中..." : "確認付款"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>編輯付款項目</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>項目名稱</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="輸入項目名稱" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>總金額</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" placeholder="輸入總金額" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>預計付款日期</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
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
                      <Textarea {...field} placeholder="備註內容" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending ? "更新中..." : "更新"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-amber-500" />
              刪除付款項目
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-3">
              確定要刪除付款項目「<span className="font-medium">{deleteItem?.itemName}</span>」嗎？
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
              <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <span className="text-base">ℹ️</span>
                此項目將被移至回收站，您可以隨時恢復。
              </p>
            </div>
            <div className="text-xs text-gray-500">
              金額：NT$ {deleteItem ? parseFloat(deleteItem.totalAmount).toLocaleString() : 0}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "刪除中..." : "移至回收站"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>付款項目詳細資訊</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">項目名稱</Label>
                  <p className="text-lg font-medium">{detailItem.itemName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">總金額</Label>
                  <p className="text-lg font-medium">NT$ {parseFloat(detailItem.totalAmount).toLocaleString()}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">已付金額</Label>
                  <p className="text-lg">NT$ {parseFloat(detailItem.paidAmount || "0").toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">待付金額</Label>
                  <p className="text-lg text-red-600">
                    NT$ {(parseFloat(detailItem.totalAmount) - parseFloat(detailItem.paidAmount || "0")).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">專案</Label>
                  <p>{detailItem.projectName || "無"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">分類</Label>
                  <p>{detailItem.categoryName || "無"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">預計付款日期</Label>
                  <p>{detailItem.startDate ? new Date(detailItem.startDate).toLocaleDateString('zh-TW') : '未設定'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">付款狀態</Label>
                  <Badge variant={detailItem.status === "paid" ? "default" : "secondary"}>
                    {detailItem.status === "paid" ? "已付款" : "未付款"}
                  </Badge>
                </div>
              </div>

              {detailItem.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">備註</Label>
                  <p className="mt-1 p-3 bg-gray-50 rounded whitespace-pre-wrap">{detailItem.notes}</p>
                </div>
              )}

              {/* 項目來源追蹤區塊 */}
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-medium text-gray-500 block mb-2">項目來源</Label>
                <div className="p-3 bg-gray-50 rounded space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">來源類型：</span>
                    {detailItem.source === 'ai_scan' ? (
                      <Badge className="bg-purple-100 text-purple-800 border border-purple-300">
                        <span className="mr-1">🤖</span>AI掃描歸檔
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-700">手動新增</Badge>
                    )}
                  </div>
                  {detailItem.source === 'ai_scan' && (
                    <>
                      {detailItem.documentUploadedByUsername && (
                        <div className="text-sm">
                          <span className="font-medium">單據上傳者：</span>
                          <span>{detailItem.documentUploadedByUsername}</span>
                          {detailItem.documentUploadedAt && (
                            <span className="text-gray-500 ml-2">
                              ({new Date(detailItem.documentUploadedAt).toLocaleString('zh-TW')})
                            </span>
                          )}
                        </div>
                      )}
                      {detailItem.archivedByUsername && (
                        <div className="text-sm">
                          <span className="font-medium">歸檔操作者：</span>
                          <span>{detailItem.archivedByUsername}</span>
                          {detailItem.archivedAt && (
                            <span className="text-gray-500 ml-2">
                              ({new Date(detailItem.archivedAt).toLocaleString('zh-TW')})
                            </span>
                          )}
                        </div>
                      )}
                      {detailItem.sourceDocumentId && (
                        <div className="text-sm text-gray-500">
                          <span className="font-medium">來源單據ID：</span>#{detailItem.sourceDocumentId}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 操作歷史記錄區塊 */}
              <div className="border-t pt-4 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAuditHistory(!showAuditHistory)}
                  className="w-full justify-between"
                  data-testid="button-toggle-audit-history"
                >
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    操作歷史記錄
                  </span>
                  {showAuditHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
                
                {showAuditHistory && (
                  <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                    {isLoadingAuditLogs ? (
                      <div className="flex items-center justify-center py-4">
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        <span className="text-sm text-gray-500">載入中...</span>
                      </div>
                    ) : !Array.isArray(auditLogs) || (auditLogs as any[]).length === 0 ? (
                      <div className="text-center py-4 text-sm text-gray-500">
                        暫無操作記錄
                      </div>
                    ) : (
                      (auditLogs as any[]).map((log: any) => (
                        <div key={log.id} className="border rounded-lg p-3 text-sm bg-gray-50 dark:bg-gray-800">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant={
                              log.action === "CREATE" ? "default" :
                              log.action === "UPDATE" ? "secondary" :
                              log.action === "DELETE" ? "destructive" :
                              log.action === "RESTORE" ? "default" : "outline"
                            }>
                              {log.action === "CREATE" ? "建立" :
                               log.action === "UPDATE" ? "更新" :
                               log.action === "DELETE" ? "刪除" :
                               log.action === "RESTORE" ? "恢復" :
                               log.action === "PERMANENT_DELETE" ? "永久刪除" : log.action}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {new Date(log.createdAt).toLocaleString('zh-TW')}
                            </span>
                          </div>
                          <div className="text-gray-600 dark:text-gray-300">
                            <span className="font-medium">{log.userInfo}</span>
                            {log.changeReason && <span> - {log.changeReason}</span>}
                          </div>
                          {log.changedFields && log.changedFields.length > 0 && (
                            <div className="text-xs text-gray-400 mt-1">
                              變更欄位: {log.changedFields.join(", ")}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setIsDetailDialogOpen(false)}>
              關閉
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 批量導入精靈 */}
      <BatchImportWizard 
        isOpen={isBatchImportOpen} 
        onClose={() => setIsBatchImportOpen(false)} 
      />
    </div>
  );
}