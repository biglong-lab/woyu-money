// 月付管理 - 主頁面（重構後）
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, type UseFormReturn, type FieldValues } from "react-hook-form";
import { Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// 子元件
import { MonthlyPaymentFilterPanel, FilterStatsBar } from "@/components/monthly-payment-filter-panel";
import { MonthlyPaymentItemList } from "@/components/monthly-payment-item-list";
import { MonthlyPaymentCreateDialog } from "@/components/monthly-payment-create-dialog";
import { MonthlyPaymentEditDialog } from "@/components/monthly-payment-edit-dialog";
import { MonthlyPaymentBatchToolbar } from "@/components/monthly-payment-batch-toolbar";
import { BatchDeleteDialog, BatchPayDialog } from "@/components/monthly-payment-batch-dialogs";

// 型別
import type {
  PaymentItem,
  PaymentProject,
  DebtCategory,
  FixedCategory,
} from "@/components/monthly-payment-types";

// API 回應型別
interface PaymentItemsResponse {
  items?: PaymentItem[];
}

// 建立付款項目資料型別
interface CreatePaymentItemData {
  itemName: string;
  amount: string;
  categoryId: string;
  projectId: string;
  dueDate: string;
  paymentDate: string;
  notes: string;
  fixedCategoryId: string;
  categoryType: string;
  totalAmount: string;
  installments: string;
  paymentType: string;
  extraFirstPayment: string;
  extraLastPayment: string;
}

// 更新付款項目資料型別
interface UpdatePaymentItemData {
  itemName: string;
  amount: string;
  categoryId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  notes: string;
  fixedCategoryId: string;
  categoryType: string;
  status: string;
}

// 表單提交資料型別（擴展版）
interface CreateFormSubmitData extends CreatePaymentItemData {
  [key: string]: string;
}

interface UpdateFormSubmitData extends UpdatePaymentItemData {
  [key: string]: string | number | null;
}

export default function MonthlyPaymentManagement() {
  const { toast } = useToast();

  // =========== 狀態管理 ===========

  // 對話框狀態
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentItem | null>(null);
  const [isEditUnlocked, setIsEditUnlocked] = useState(false);

  // 分類選擇器
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedFixedCategoryId, setSelectedFixedCategoryId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  // 篩選狀態
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>("startDate");
  const [sortOrder, setSortOrder] = useState<string>("asc");

  // 批量選擇
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [showBatchPayConfirm, setShowBatchPayConfirm] = useState(false);

  // =========== 資料查詢 ===========

  const { data: paymentItemsResponse, isLoading } = useQuery<PaymentItem[] | PaymentItemsResponse>({
    queryKey: ["/api/payment/items", { includeAll: true }],
    queryFn: () => fetch("/api/payment/items?includeAll=true").then(res => res.json()),
  });

  const paymentItems: PaymentItem[] = Array.isArray(paymentItemsResponse)
    ? paymentItemsResponse
    : (paymentItemsResponse?.items || []);

  const { data: categories = [] } = useQuery<DebtCategory[]>({
    queryKey: ["/api/categories/project"],
  });

  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  });

  const { data: fixedCategories = [] } = useQuery<FixedCategory[]>({
    queryKey: ["/api/fixed-categories"],
  });

  // =========== 篩選與排序 ===========

  const filteredAndSortedItems = useMemo(() => {
    return paymentItems.filter((item) => {
      if (item.paymentType !== "monthly") return false;

      const matchesSearch = searchTerm === "" ||
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        (item.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

      const matchesProject = filterProject === "all" ||
        item.projectName === projects.find((p) => p.id.toString() === filterProject)?.projectName;

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
    }).sort((a, b) => {
      let comparison: number;
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
  }, [paymentItems, searchTerm, filterProject, filterStatus, filterCategory, sortBy, sortOrder, projects]);

  const totalMonthlyCount = paymentItems.filter((item) => item.paymentType === "monthly").length;

  // =========== 表單 ===========

  const createForm = useForm<CreatePaymentItemData>({
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

  const editForm = useForm<UpdatePaymentItemData>({
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

  // 固定分類自動填入
  useEffect(() => {
    if (selectedFixedCategoryId) {
      const selectedCategory = fixedCategories.find((cat) => cat.id === parseInt(selectedFixedCategoryId));
      if (selectedCategory) {
        createForm.setValue("itemName", selectedCategory.categoryName);
      }
      createForm.setValue("categoryId", "");
      setSelectedCategoryId("");
    } else if (selectedCategoryId) {
      createForm.setValue("itemName", "");
    }
  }, [selectedFixedCategoryId, selectedCategoryId, fixedCategories, createForm]);

  // =========== Mutations ===========

  const createMutation = useMutation({
    mutationFn: async (data: CreateFormSubmitData) => {
      return apiRequest("/api/payment/items", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      setSelectedCategoryId("");
      setSelectedFixedCategoryId("");
      toast({ title: "月付項目建立成功", description: "新的月付項目已成功新增" });
    },
    onError: (error: Error) => {
      toast({ title: "建立失敗", description: error.message || "建立月付項目時發生錯誤", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateFormSubmitData }) => {
      return apiRequest("PUT", `/api/payment/items/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      editForm.reset();
      toast({ title: "月付項目更新成功", description: "月付項目資訊已成功更新" });
    },
    onError: (error: Error) => {
      toast({ title: "更新失敗", description: error.message || "更新月付項目時發生錯誤", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/payment/items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      toast({ title: "月付項目已移至回收站", description: "月付項目已成功移至回收站" });
    },
    onError: (error: Error) => {
      toast({ title: "刪除失敗", description: error.message || "刪除月付項目時發生錯誤", variant: "destructive" });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      return Promise.all(ids.map(id => apiRequest("DELETE", `/api/payment/items/${id}`)));
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setSelectedIds(new Set());
      setIsBatchMode(false);
      setShowBatchDeleteConfirm(false);
      toast({ title: "批量刪除成功", description: `已將 ${ids.length} 個項目移至回收站` });
    },
    onError: (error: Error) => {
      toast({ title: "批量刪除失敗", description: error.message || "批量刪除時發生錯誤", variant: "destructive" });
    },
  });

  const batchMarkPaidMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const today = new Date().toISOString().split('T')[0];
      return Promise.all(
        ids.map(id => apiRequest("PUT", `/api/payment/items/${id}`, {
          status: "paid",
          endDate: today,
          paidAmount: paymentItems.find((item) => item.id === id)?.totalAmount || "0"
        }))
      );
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setSelectedIds(new Set());
      setIsBatchMode(false);
      setShowBatchPayConfirm(false);
      toast({ title: "批量付款成功", description: `已將 ${ids.length} 個項目標記為已付款` });
    },
    onError: (error: Error) => {
      toast({ title: "批量付款失敗", description: error.message || "批量更新付款狀態時發生錯誤", variant: "destructive" });
    },
  });

  // =========== 批量選擇 ===========

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
      setSelectedIds(new Set(filteredAndSortedItems.map((item) => item.id)));
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

  const selectedItemsTotal = useMemo(() => {
    let total = 0;
    selectedIds.forEach(id => {
      const item = paymentItems.find((i) => i.id === id);
      if (item) total += parseFloat(item.totalAmount) || 0;
    });
    return total;
  }, [selectedIds, paymentItems]);

  const selectedUnpaidCount = useMemo(() => {
    let count = 0;
    selectedIds.forEach(id => {
      const item = paymentItems.find((i) => i.id === id);
      if (item && item.status !== "paid") count++;
    });
    return count;
  }, [selectedIds, paymentItems]);

  // =========== 事件處理 ===========

  const handleCreateSubmit = async (data: CreateFormSubmitData) => {
    const installments = parseInt(data.installments) || 1;
    const startDate = new Date(data.dueDate);
    const items = [];

    for (let i = 0; i < installments; i++) {
      const currentDate = new Date(startDate);
      currentDate.setMonth(startDate.getMonth() + i);

      const itemName = installments > 1
        ? `${data.itemName} (第${i + 1}期/共${installments}期)`
        : data.itemName;

      const monthlyAmount = parseFloat(data.amount);
      const totalCost = monthlyAmount * installments;
      const calculationNote = `總費用 = ${monthlyAmount.toLocaleString()} x ${installments}期 = ${totalCost.toLocaleString()}`;
      const finalNotes = data.notes ? `${data.notes}\n${calculationNote}` : calculationNote;

      items.push({
        ...data,
        itemName,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        projectId: parseInt(data.projectId),
        fixedCategoryId: data.fixedCategoryId ? parseInt(data.fixedCategoryId) : null,
        amount: data.amount.toString(),
        totalAmount: data.amount.toString(),
        paymentType: "monthly",
        startDate: currentDate.toISOString().split('T')[0],
        endDate: data.paymentDate || null,
        notes: finalNotes,
        itemType: data.fixedCategoryId ? "project" : "home",
      });
    }

    try {
      for (const item of items) {
        await apiRequest("POST", "/api/payment/items", item);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      setSelectedCategoryId("");
      setSelectedFixedCategoryId("");
      toast({ title: "月付項目建立成功", description: `已成功建立 ${installments} 期付款項目` });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "建立月付項目時發生錯誤";
      toast({ title: "建立失敗", description: errorMessage, variant: "destructive" });
    }
  };

  const handleEditSubmit = (data: UpdateFormSubmitData) => {
    if (!editingItem) return;
    const processedData: UpdateFormSubmitData = {
      ...data,
      categoryId: parseInt(data.categoryId).toString(),
      projectId: parseInt(data.projectId).toString(),
      fixedCategoryId: data.fixedCategoryId ? parseInt(data.fixedCategoryId).toString() : "",
      amount: data.amount.toString(),
      totalAmount: data.amount.toString(),
      paymentType: "monthly",
      startDate: data.startDate || "",
      endDate: data.endDate || "",
      dueDate: data.startDate,
      itemType: data.fixedCategoryId ? "project" : "home",
    };
    updateMutation.mutate({ id: editingItem.id, data: processedData });
  };

  const handleEdit = (item: PaymentItem) => {
    setEditingItem(item);
    setIsEditUnlocked(false);
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
      categoryType,
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

  const resetFilters = () => {
    setSearchTerm("");
    setFilterProject("all");
    setFilterStatus("all");
    setFilterCategory("all");
    setSortBy("startDate");
    setSortOrder("asc");
  };

  const handleBatchDeleteConfirm = () => {
    batchDeleteMutation.mutate(Array.from(selectedIds));
  };

  const handleBatchPayConfirm = () => {
    const unpaidIds = Array.from(selectedIds).filter(id => {
      const item = paymentItems.find((i) => i.id === id);
      return item && item.status !== "paid";
    });
    batchMarkPaidMutation.mutate(unpaidIds);
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
      {/* 頁面標題 */}
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
        <MonthlyPaymentCreateDialog
          isOpen={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          createForm={createForm as unknown as UseFormReturn<FieldValues>}
          onSubmit={handleCreateSubmit as unknown as (data: FieldValues) => Promise<void>}
          isPending={createMutation.isPending}
        />
      </div>

      {/* 搜尋與篩選 */}
      <MonthlyPaymentFilterPanel
        searchTerm={searchTerm}
        filterProject={filterProject}
        filterStatus={filterStatus}
        filterCategory={filterCategory}
        sortBy={sortBy}
        sortOrder={sortOrder}
        showAdvancedFilters={showAdvancedFilters}
        projects={projects}
        categories={categories}
        fixedCategories={fixedCategories}
        onSearchTermChange={setSearchTerm}
        onFilterProjectChange={setFilterProject}
        onFilterStatusChange={setFilterStatus}
        onFilterCategoryChange={setFilterCategory}
        onSortByChange={setSortBy}
        onSortOrderChange={setSortOrder}
        onShowAdvancedFiltersChange={setShowAdvancedFilters}
        onResetFilters={resetFilters}
      />

      {/* 篩選結果統計 */}
      <FilterStatsBar
        filteredCount={filteredAndSortedItems.length}
        totalMonthlyCount={totalMonthlyCount}
        isBatchMode={isBatchMode}
        filterStatus={filterStatus}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onToggleBatchMode={toggleBatchMode}
        onFilterStatusChange={setFilterStatus}
        onSortByChange={setSortBy}
        onSortOrderChange={setSortOrder}
      />

      {/* 批量操作工具列 */}
      {isBatchMode && (
        <MonthlyPaymentBatchToolbar
          selectedCount={selectedIds.size}
          totalCount={filteredAndSortedItems.length}
          selectedItemsTotal={selectedItemsTotal}
          selectedUnpaidCount={selectedUnpaidCount}
          isBatchDeletePending={batchDeleteMutation.isPending}
          isBatchPayPending={batchMarkPaidMutation.isPending}
          onSelectAll={handleSelectAll}
          onClearSelection={() => setSelectedIds(new Set())}
          onBatchDelete={() => setShowBatchDeleteConfirm(true)}
          onBatchMarkPaid={() => setShowBatchPayConfirm(true)}
        />
      )}

      {/* 項目列表 */}
      <MonthlyPaymentItemList
        items={filteredAndSortedItems}
        projects={projects}
        categories={categories}
        fixedCategories={fixedCategories}
        isBatchMode={isBatchMode}
        selectedIds={selectedIds}
        onSelectItem={handleSelectItem}
        onEdit={handleEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
        isDeletePending={deleteMutation.isPending}
      />

      {/* 編輯對話框 */}
      <MonthlyPaymentEditDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        editForm={editForm as unknown as UseFormReturn<FieldValues>}
        editingItem={editingItem}
        isEditUnlocked={isEditUnlocked}
        onToggleEditLock={toggleEditLock}
        onSubmit={handleEditSubmit as unknown as (data: FieldValues) => void}
        isPending={updateMutation.isPending}
        projects={projects}
        categories={categories}
        fixedCategories={fixedCategories}
      />

      {/* 批量刪除確認 */}
      <BatchDeleteDialog
        isOpen={showBatchDeleteConfirm}
        onOpenChange={setShowBatchDeleteConfirm}
        selectedCount={selectedIds.size}
        selectedItemsTotal={selectedItemsTotal}
        onConfirm={handleBatchDeleteConfirm}
        isPending={batchDeleteMutation.isPending}
      />

      {/* 批量付款確認 */}
      <BatchPayDialog
        isOpen={showBatchPayConfirm}
        onOpenChange={setShowBatchPayConfirm}
        selectedUnpaidCount={selectedUnpaidCount}
        onConfirm={handleBatchPayConfirm}
        isPending={batchMarkPaidMutation.isPending}
      />
    </div>
  );
}
