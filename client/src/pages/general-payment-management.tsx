// 一般付款管理 - 主頁面（重構後）
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, type UseFormReturn, type FieldValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BatchImportWizard } from "@/components/batch-import-wizard";

// 子元件
import { MonthlyStatsCards, OverviewStatsCards } from "@/components/general-payment-stats-cards";
import { GeneralPaymentFilterPanel } from "@/components/general-payment-filter-panel";
import { GeneralPaymentItemList } from "@/components/general-payment-item-list";
import { GeneralPaymentCreateDialog } from "@/components/general-payment-create-dialog";
import { GeneralPaymentEditDialog } from "@/components/general-payment-edit-dialog";
import { GeneralPaymentPaymentDialog } from "@/components/general-payment-payment-dialog";
import { GeneralPaymentDetailDialog } from "@/components/general-payment-detail-dialog";
import { GeneralPaymentDeleteDialog } from "@/components/general-payment-delete-dialog";

// 型別
import type {
  PaymentItem,
  PaymentProject,
  DebtCategory,
  FixedCategory,
  GeneralPaymentStatistics,
  CategoryWithSource,
} from "@/components/general-payment-types";

// API 回應型別
interface PaymentItemsResponse {
  items: PaymentItem[];
}

// 表單資料型別
interface CreateFormData {
  itemName: string;
  amount: string;
  categoryId: string;
  projectId: string;
  fixedCategoryId: string;
  dueDate: string;
  paymentDate: string;
  notes: string;
  categoryType: string;
}

interface EditFormData {
  itemName: string;
  totalAmount: string;
  startDate: string;
  notes: string;
}

interface PaymentFormData {
  paymentAmount: string;
  paymentDate: string;
  notes: string;
}

// API 錯誤型別
interface ApiError {
  message: string;
}

export default function GeneralPaymentManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // =========== 狀態管理 ===========

  // 篩選狀態
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showPaidItems, setShowPaidItems] = useState(true);
  const [sortBy, setSortBy] = useState<string>("dueDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isPriorityFilterOpen, setIsPriorityFilterOpen] = useState(false);

  // 操作狀態
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);

  // 選中項目
  const [paymentItem, setPaymentItem] = useState<PaymentItem | null>(null);
  const [editItem, setEditItem] = useState<PaymentItem | null>(null);
  const [detailItem, setDetailItem] = useState<PaymentItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<PaymentItem | null>(null);

  // 編輯分類選擇器
  const [editSelectedCategoryId, setEditSelectedCategoryId] = useState("");
  const [editSelectedProjectId, setEditSelectedProjectId] = useState("");

  // =========== 表單 ===========

  const createForm = useForm<CreateFormData>({
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

  const editForm = useForm<EditFormData>({
    defaultValues: {
      itemName: "",
      totalAmount: "",
      startDate: "",
      notes: "",
    },
  });

  const paymentForm = useForm<PaymentFormData>({
    defaultValues: {
      paymentAmount: "",
      paymentDate: "",
      notes: "",
    },
  });

  // =========== 資料查詢 ===========

  const { data: paymentItemsResponse, isLoading, refetch: refetchItems } = useQuery<PaymentItem[] | PaymentItemsResponse>({
    queryKey: ["/api/payment/items?limit=500&itemType=general"],
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const paymentItems: PaymentItem[] = Array.isArray(paymentItemsResponse)
    ? paymentItemsResponse
    : (paymentItemsResponse?.items || []);

  const { data: projects = [], refetch: refetchProjects } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
    staleTime: 60000,
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
  const allCategories: CategoryWithSource[] = [
    ...fixedCategories.map((cat: FixedCategory) => ({ ...cat, categoryType: 'fixed', source: '固定分類' })),
    ...projectCategories.map((cat: DebtCategory) => ({ ...cat, categoryType: 'project', source: '專案分類' }))
  ];

  // 伺服器已篩選一般付款項目
  const generalItems = useMemo(() => paymentItems, [paymentItems]);

  // =========== 固定分類自動填入 ===========

  const watchedFixedCategoryId = createForm.watch("fixedCategoryId");
  const watchedCategoryId = createForm.watch("categoryId");

  useEffect(() => {
    if (watchedFixedCategoryId && fixedCategories) {
      const selectedFixedCategory = fixedCategories.find(cat => cat.id === parseInt(watchedFixedCategoryId));
      if (selectedFixedCategory) {
        createForm.setValue("itemName", selectedFixedCategory.categoryName);
      }
    } else if (watchedCategoryId && !watchedFixedCategoryId) {
      createForm.setValue("itemName", "");
    }
  }, [watchedFixedCategoryId, watchedCategoryId, fixedCategories, createForm]);

  // =========== 篩選邏輯 ===========

  const statusCounts = useMemo(() => {
    const today = new Date();
    return {
      pending: generalItems.filter((item) => item.status === "pending").length,
      paid: generalItems.filter((item) => item.status === "paid").length,
      overdue: generalItems.filter((item) =>
        item.status !== "paid" && new Date(item.startDate) < today
      ).length,
      thisMonth: generalItems.filter((item) => {
        const itemDate = new Date(item.startDate);
        return itemDate.getMonth() === today.getMonth() &&
               itemDate.getFullYear() === today.getFullYear();
      }).length,
    };
  }, [generalItems]);

  const filteredItems = useMemo(() => {
    return generalItems.filter((item) => {
      const matchesSearch = !searchTerm ||
        item.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.categoryName?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesProject = selectedProject === "all" ||
        item.projectId?.toString() === selectedProject;

      const matchesCategory = selectedCategory === "all" ||
        item.categoryId?.toString() === selectedCategory ||
        item.fixedCategoryId?.toString() === selectedCategory;

      const matchesStatus = selectedStatus === "all" || item.status === selectedStatus;
      const matchesPaymentType = selectedPaymentType === "all" || item.paymentType === selectedPaymentType;
      const showItem = showPaidItems || item.status !== "paid";

      let matchesDate = true;
      const itemDate = new Date(item.startDate);

      if (selectedYear !== null && itemDate.getFullYear() !== selectedYear) {
        matchesDate = false;
      }
      if (selectedMonth !== null && itemDate.getMonth() !== (selectedMonth - 1)) {
        matchesDate = false;
      }
      if (startDate && itemDate < new Date(startDate)) {
        matchesDate = false;
      }
      if (endDate && itemDate > new Date(endDate)) {
        matchesDate = false;
      }

      if (dateRange !== "all" && !startDate && !endDate) {
        const today = new Date();
        switch (dateRange) {
          case "today":
            matchesDate = itemDate.toDateString() === today.toDateString();
            break;
          case "week": {
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = itemDate >= weekAgo;
            break;
          }
          case "month": {
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            matchesDate = itemDate >= monthAgo;
            break;
          }
          case "quarter": {
            const quarterAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
            matchesDate = itemDate >= quarterAgo;
            break;
          }
          case "current-month": {
            matchesDate = itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
            break;
          }
        }
      }

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
      let comparison: number;
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
  }, [generalItems, searchTerm, selectedProject, selectedCategory, selectedStatus,
      selectedPaymentType, showPaidItems, selectedYear, selectedMonth, startDate,
      endDate, dateRange, priorityFilter, sortBy, sortOrder]);

  // =========== 統計計算 ===========

  const statistics: GeneralPaymentStatistics = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const currentMonthItems = generalItems.filter(item => {
      const sd = new Date(item.startDate);
      return sd.getMonth() === currentMonth && sd.getFullYear() === currentYear;
    });

    const pastDueItems = generalItems.filter(item => {
      const sd = new Date(item.startDate);
      return sd < new Date(currentYear, currentMonth, 1) && item.status !== "paid";
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
    const monthlyDue = currentMonthItems.reduce((sum, item) => sum + parseFloat(item.totalAmount || "0"), 0);
    const monthlyPaid = currentMonthItems.reduce((sum, item) => sum + parseFloat(item.paidAmount || "0"), 0);
    const overdueUnpaid = pastDueItems.reduce((sum, item) => sum + (parseFloat(item.totalAmount || "0") - parseFloat(item.paidAmount || "0")), 0);

    const urgentDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const urgentItems = filteredItems.filter(item =>
      item.status !== "paid" && new Date(item.startDate) <= urgentDate && new Date(item.startDate) >= today
    ).length;

    return {
      totalItems,
      totalAmount,
      paidAmount,
      unpaidAmount: totalAmount - paidAmount,
      unpaidItems,
      urgentItems,
      overdueItems: pastDueItems.length,
      monthlyDue,
      monthlyPaid,
      monthlyUnpaid: monthlyDue - monthlyPaid,
      overdueUnpaid,
    };
  }, [filteredItems, generalItems]);

  // =========== Mutations ===========

  const createMutation = useMutation({
    mutationFn: async (data: {
      itemName: string;
      categoryId: number | null;
      projectId: number;
      fixedCategoryId: number | null;
      totalAmount: string;
      paymentType: string;
      startDate: string;
      notes: string | null;
    }) => {
      return apiRequest("POST", "/api/payment/items", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/records"], refetchType: "all" });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({ title: "一般付款項目建立成功", description: "新的付款項目已成功建立" });
    },
    onError: (error: Error | ApiError) => {
      const message = 'message' in error ? error.message : '建立付款項目時發生錯誤';
      toast({ title: "建立失敗", description: message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: {
      itemName: string;
      totalAmount: string;
      startDate: string;
      notes: string;
      categoryId: number | null;
      fixedCategoryId: number | null;
      projectId: number | null;
    }) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"], refetchType: "all" });
      setIsEditDialogOpen(false);
      editForm.reset();
      setEditSelectedCategoryId("");
      setEditSelectedProjectId("");
      toast({ title: "更新成功", description: "付款項目已成功更新" });
    },
    onError: (error: Error | ApiError) => {
      const message = 'message' in error ? error.message : '更新付款項目時發生錯誤';
      toast({ title: "更新失敗", description: message, variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"], refetchType: "all" });
      setIsPaymentDialogOpen(false);
      paymentForm.reset();
      toast({ title: "付款成功", description: "付款記錄已成功添加" });
    },
    onError: (error: Error | ApiError) => {
      const message = 'message' in error ? error.message : '添加付款記錄時發生錯誤';
      toast({ title: "付款失敗", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return apiRequest("DELETE", `/api/payment/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"], refetchType: "all" });
      setIsDeleteDialogOpen(false);
      toast({ title: "刪除成功", description: "付款項目已成功刪除" });
    },
    onError: (error: Error | ApiError) => {
      const message = 'message' in error ? error.message : '刪除付款項目時發生錯誤';
      toast({ title: "刪除失敗", description: message, variant: "destructive" });
    },
  });

  // =========== 事件處理 ===========

  const handleCreateSubmit = (data: CreateFormData) => {
    if (!data.itemName) {
      createForm.setError("itemName", { type: "manual", message: "項目名稱為必填欄位" });
      return;
    }
    if (!data.categoryType) {
      createForm.setError("categoryType", { type: "manual", message: "請選擇分類類型" });
      return;
    }
    if (data.categoryType === "project" && !data.categoryId) {
      createForm.setError("categoryId", { type: "manual", message: "請選擇專案分類" });
      return;
    }
    if (data.categoryType === "fixed" && !data.fixedCategoryId) {
      createForm.setError("fixedCategoryId", { type: "manual", message: "請選擇固定分類" });
      return;
    }
    if (!data.projectId) {
      createForm.setError("projectId", { type: "manual", message: "請選擇專案" });
      return;
    }
    if (!data.amount || parseFloat(data.amount) <= 0) {
      createForm.setError("amount", { type: "manual", message: "請輸入有效的付款金額" });
      return;
    }

    const processedData = {
      itemName: data.itemName,
      categoryId: data.categoryId ? parseInt(data.categoryId) : null,
      projectId: parseInt(data.projectId),
      fixedCategoryId: data.fixedCategoryId ? parseInt(data.fixedCategoryId) : null,
      totalAmount: data.amount.toString(),
      paymentType: "single",
      startDate: data.dueDate,
      notes: data.notes || null,
    };
    createMutation.mutate(processedData);
  };

  const handleEditSubmit = (data: EditFormData) => {
    if (!editItem) return;
    editMutation.mutate({
      ...data,
      categoryId: editSelectedCategoryId ? parseInt(editSelectedCategoryId) : null,
      fixedCategoryId: editSelectedCategoryId && fixedCategories.find(c => c.id === parseInt(editSelectedCategoryId))
        ? parseInt(editSelectedCategoryId) : null,
      projectId: editSelectedProjectId ? parseInt(editSelectedProjectId) : null,
    });
  };

  const handleEdit = (item: PaymentItem) => {
    setEditItem(item);
    setIsEditDialogOpen(true);
    editForm.reset({
      itemName: item.itemName,
      totalAmount: item.totalAmount,
      startDate: item.startDate,
      notes: item.notes || "",
    });
    if (item.fixedCategoryId) {
      setEditSelectedCategoryId(item.fixedCategoryId.toString());
    } else if (item.categoryId) {
      setEditSelectedCategoryId(item.categoryId.toString());
    }
    if (item.projectId) {
      setEditSelectedProjectId(item.projectId.toString());
    }
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

  const handlePaymentSubmit = (data: PaymentFormData, receiptFile: File | null) => {
    if (!paymentItem) return;
    paymentMutation.mutate({
      itemId: paymentItem.id,
      paymentAmount: data.paymentAmount,
      paymentDate: data.paymentDate,
      notes: data.notes,
      receiptFile: receiptFile || undefined
    });
  };

  const handleViewDetails = (item: PaymentItem) => {
    setDetailItem(item);
    setIsDetailDialogOpen(true);
  };

  const handleDelete = (item: PaymentItem) => {
    setDeleteItem(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deleteItem) return;
    deleteMutation.mutate(deleteItem.id);
  };

  const handleRefreshData = async () => {
    try {
      await Promise.all([refetchItems(), refetchProjects(), refetchCategories(), refetchFixed()]);
      toast({ title: "數據更新完成", description: "所有付款項目數據已同步更新" });
    } catch {
      toast({ title: "數據更新失敗", description: "請稍後重試或檢查網絡連接", variant: "destructive" });
    }
  };

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
    toast({ title: "篩選已重置", description: "所有篩選條件已清除並重置為預設值" });
  };

  const applyQuickFilter = (filterType: string) => {
    const today = new Date();
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

  // =========== 載入狀態 ===========

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // =========== 渲染 ===========

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* 頁面標題與操作按鈕 */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" />
            一般付款管理
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2 leading-relaxed">
            管理所有一次性付款項目，簡單快速的付款處理流程
          </p>

          {/* 篩選狀態提示 */}
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

        <GeneralPaymentCreateDialog
          isOpen={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          createForm={createForm as unknown as UseFormReturn<FieldValues>}
          onSubmit={handleCreateSubmit as unknown as (data: FieldValues) => void}
          isPending={createMutation.isPending}
          onBatchImportOpen={() => setIsBatchImportOpen(true)}
        />
      </div>

      {/* 月度統計卡片 */}
      <MonthlyStatsCards statistics={statistics} />

      {/* 篩選面板 */}
      <GeneralPaymentFilterPanel
        searchTerm={searchTerm}
        selectedProject={selectedProject}
        selectedCategory={selectedCategory}
        selectedStatus={selectedStatus}
        selectedPaymentType={selectedPaymentType}
        dateRange={dateRange}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        startDate={startDate}
        endDate={endDate}
        priorityFilter={priorityFilter}
        showPaidItems={showPaidItems}
        sortBy={sortBy}
        sortOrder={sortOrder}
        isPriorityFilterOpen={isPriorityFilterOpen}
        projects={projects}
        allCategories={allCategories}
        filteredCount={filteredItems.length}
        totalCount={generalItems.length}
        statusCounts={statusCounts}
        onSearchTermChange={setSearchTerm}
        onSelectedProjectChange={setSelectedProject}
        onSelectedCategoryChange={setSelectedCategory}
        onSelectedStatusChange={setSelectedStatus}
        onSelectedPaymentTypeChange={setSelectedPaymentType}
        onDateRangeChange={setDateRange}
        onSelectedYearChange={setSelectedYear}
        onSelectedMonthChange={setSelectedMonth}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onPriorityFilterChange={setPriorityFilter}
        onShowPaidItemsChange={setShowPaidItems}
        onSortByChange={setSortBy}
        onSortOrderChange={setSortOrder}
        onIsPriorityFilterOpenChange={setIsPriorityFilterOpen}
        onResetAllFilters={resetAllFilters}
        onClearAllFilters={handleClearAllFilters}
        onRefreshData={handleRefreshData}
        onApplyQuickFilter={applyQuickFilter}
      />

      {/* 總覽統計卡片 */}
      <OverviewStatsCards statistics={statistics} />

      {/* 項目列表 */}
      <GeneralPaymentItemList
        filteredItems={filteredItems}
        generalItems={generalItems}
        projects={projects}
        allCategories={allCategories}
        onViewDetails={handleViewDetails}
        onEdit={handleEdit}
        onPayment={handlePayment}
        onDelete={handleDelete}
        onRefreshData={handleRefreshData}
        onResetAllFilters={resetAllFilters}
        onApplyQuickFilter={applyQuickFilter}
      />

      {/* 付款對話框 */}
      <GeneralPaymentPaymentDialog
        isOpen={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        paymentForm={paymentForm as unknown as UseFormReturn<FieldValues>}
        paymentItem={paymentItem}
        onSubmit={handlePaymentSubmit as unknown as (data: FieldValues, receiptFile: File | null) => void}
        isPending={paymentMutation.isPending}
      />

      {/* 編輯對話框 */}
      <GeneralPaymentEditDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        editForm={editForm as unknown as UseFormReturn<FieldValues>}
        onSubmit={handleEditSubmit as unknown as (data: FieldValues) => void}
        isPending={editMutation.isPending}
      />

      {/* 刪除確認對話框 */}
      <GeneralPaymentDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        deleteItem={deleteItem}
        onConfirm={handleDeleteConfirm}
        isPending={deleteMutation.isPending}
      />

      {/* 詳情對話框 */}
      <GeneralPaymentDetailDialog
        isOpen={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        detailItem={detailItem}
      />

      {/* 批量導入精靈 */}
      <BatchImportWizard
        isOpen={isBatchImportOpen}
        onClose={() => setIsBatchImportOpen(false)}
      />
    </div>
  );
}
