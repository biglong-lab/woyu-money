// 分期付款管理主頁面

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, type UseFormReturn, type FieldValues } from "react-hook-form";
import { Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// 子元件
import InstallmentStatsPanel from "@/components/installment-stats-panel";
import InstallmentFilterBar from "@/components/installment-filter-bar";
import InstallmentItemCard, { InstallmentEmptyState } from "@/components/installment-item-card";
import InstallmentCreateDialog from "@/components/installment-create-dialog";
import InstallmentEditDialog from "@/components/installment-edit-dialog";
import InstallmentDetailDialog from "@/components/installment-detail-dialog";

// 型別與工具函式
import type { PaymentItem, AnalyzedInstallmentItem } from "@/components/installment-types";
import type { DebtCategory, PaymentProject, FixedCategory } from "@/../../shared/schema/category";
import {
  analyzeInstallmentItem,
  calculateInstallmentStats,
  calculateInstallmentPayments,
} from "@/components/installment-utils";

// 表單資料型別定義
interface CreateFormData {
  itemName: string;
  totalAmount: string;
  installments: number;
  categoryId: string;
  projectId: string;
  startDate: string;
  notes: string;
  fixedCategoryId: string;
  categoryType: string;
  paymentType: string;
  extraFirstPayment: string;
  extraLastPayment: string;
  installmentMonths: string;
}

interface EditFormData {
  notes: string;
}

export default function InstallmentPaymentManagement() {
  const { toast } = useToast();

  // Dialog 狀態
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentItem | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [viewingItem, setViewingItem] = useState<PaymentItem | null>(null);

  // 搜尋與篩選狀態
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("dueDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // 查詢資料
  const { data: paymentItemsResponse, isLoading } = useQuery({
    queryKey: ["/api/payment/items", { includeAll: true }],
    queryFn: () => fetch("/api/payment/items?includeAll=true").then((res) => res.json()),
  });

  const paymentItems = Array.isArray(paymentItemsResponse)
    ? paymentItemsResponse
    : paymentItemsResponse?.items || [];

  const { data: categories = [] } = useQuery<DebtCategory[]>({
    queryKey: ["/api/categories/project"],
  });

  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  });

  const { data: fixedCategories = [] } = useQuery<FixedCategory[]>({
    queryKey: ["/api/fixed-categories"],
  });

  // 統計計算
  const installmentStats = useMemo(
    () => calculateInstallmentStats(paymentItems),
    [paymentItems]
  );

  // 篩選、分析、排序
  const filteredInstallmentItems = useMemo(() => {
    return paymentItems
      .filter((item: PaymentItem) => item.paymentType === "installment")
      .map(analyzeInstallmentItem)
      .filter((item: AnalyzedInstallmentItem) => {
        // 搜尋關鍵字
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const matchesName = item.itemName?.toLowerCase().includes(searchLower);
          const matchesNotes = item.notes?.toLowerCase().includes(searchLower);
          const matchesBaseName = item.baseName?.toLowerCase().includes(searchLower);
          if (!matchesName && !matchesNotes && !matchesBaseName) return false;
        }
        // 狀態篩選
        if (statusFilter !== "all") {
          if (statusFilter === "paid" && !item.isPaid) return false;
          if (statusFilter === "unpaid" && item.isPaid) return false;
          if (statusFilter === "overdue" && !item.isOverdue) return false;
          if (statusFilter === "due-soon" && !item.isDueSoon) return false;
        }
        // 專案篩選
        if (projectFilter !== "all" && item.projectId?.toString() !== projectFilter) {
          return false;
        }
        // 分類篩選
        if (categoryFilter !== "all" && item.categoryId?.toString() !== categoryFilter) {
          return false;
        }
        return true;
      })
      .sort((a: AnalyzedInstallmentItem, b: AnalyzedInstallmentItem) => {
        let comparison: number;
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
  }, [paymentItems, searchTerm, statusFilter, projectFilter, categoryFilter, sortBy, sortOrder]);

  // 表單
  const createForm = useForm<CreateFormData>({
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
      extraLastPayment: "",
      installmentMonths: "",
    },
  });

  const editForm = useForm<EditFormData>({
    defaultValues: {
      notes: "",
    },
  });

  // 分期計算即時預覽
  const watchTotalAmount = createForm.watch("totalAmount");
  const watchInstallments = createForm.watch("installments");
  const paymentCalculation = calculateInstallmentPayments(
    parseFloat(watchTotalAmount) || 0,
    parseInt(watchInstallments?.toString()) || 0
  );

  // 分類選擇聯動
  useEffect(() => {
    if (selectedCategoryId) {
      createForm.setValue("itemName", "");
    }
  }, [selectedCategoryId, createForm]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateFormData) => {
      const response = await apiRequest("POST", "/api/payment/items", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      setSelectedCategoryId("");
      toast({ title: "分期項目建立成功", description: "新的分期項目已成功新增" });
    },
    onError: (error: Error) => {
      toast({
        title: "建立失敗",
        description: error.message || "建立分期項目時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EditFormData }) => {
      return apiRequest("PUT", `/api/payment/items/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      editForm.reset();
      toast({ title: "分期項目更新成功", description: "分期項目資訊已成功更新" });
    },
    onError: (error: Error) => {
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
      toast({ title: "分期項目刪除成功", description: "分期項目已成功刪除" });
    },
    onError: (error: Error) => {
      toast({
        title: "刪除失敗",
        description: error.message || "刪除分期項目時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // 事件處理
  const handleCreateSubmit = async (data: CreateFormData) => {
    const totalAmount = parseFloat(data.totalAmount);
    const installmentMonths = parseInt(data.installmentMonths);
    const calculation = calculateInstallmentPayments(totalAmount, installmentMonths);
    const startDate = new Date(data.startDate);

    try {
      for (let i = 0; i < installmentMonths; i++) {
        const currentDate = new Date(startDate);
        currentDate.setMonth(startDate.getMonth() + i);
        const amount = i === 0 ? calculation.firstPayment : calculation.monthlyAmount;
        const itemName = `${data.itemName} (第${i + 1}期/共${installmentMonths}期)`;
        const calculationNote = `總費用 = ${totalAmount.toLocaleString()}，分${installmentMonths}期付款\n第1期：${calculation.firstPayment.toLocaleString()}（包含零頭）\n第2-${installmentMonths}期：每期 ${calculation.monthlyAmount.toLocaleString()}`;
        const finalNotes = data.notes ? `${data.notes}\n\n${calculationNote}` : calculationNote;

        await apiRequest("POST", "/api/payment/items", {
          itemName,
          categoryId: data.categoryId ? parseInt(data.categoryId) : null,
          projectId: parseInt(data.projectId),
          fixedCategoryId: data.fixedCategoryId ? parseInt(data.fixedCategoryId) : null,
          totalAmount: amount.toString(),
          paymentType: "installment",
          startDate: currentDate.toISOString().split("T")[0],
          notes: finalNotes,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      setSelectedCategoryId("");
      toast({
        title: "分期項目建立成功",
        description: `已成功建立 ${installmentMonths} 期付款項目`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "建立分期項目時發生錯誤";
      toast({
        title: "建立失敗",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleEditSubmit = (data: EditFormData) => {
    if (!editingItem) return;
    updateMutation.mutate({ id: editingItem.id, data: { notes: data.notes } });
  };

  const handleEdit = (item: PaymentItem) => {
    setEditingItem(item);
    editForm.reset({ notes: item.notes || "" });
    setIsEditDialogOpen(true);
  };

  // 載入狀態
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* 頁面標題與建立按鈕 */}
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
        <InstallmentCreateDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          form={createForm as unknown as UseFormReturn<FieldValues>}
          onSubmit={handleCreateSubmit as unknown as (data: FieldValues) => Promise<void>}
          isPending={createMutation.isPending}
          paymentCalculation={paymentCalculation}
          watchTotalAmount={watchTotalAmount}
          watchInstallments={watchInstallments}
        />
      </div>

      {/* 統計面板 */}
      <InstallmentStatsPanel stats={installmentStats} />

      {/* 篩選與排序 */}
      <InstallmentFilterBar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        projects={projects}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categories={categories}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderToggle={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
        resultCount={filteredInstallmentItems.length}
      />

      {/* 項目列表 */}
      <div className="grid gap-4">
        {filteredInstallmentItems.length === 0 ? (
          <InstallmentEmptyState onCreateClick={() => setIsCreateDialogOpen(true)} />
        ) : (
          filteredInstallmentItems.map((item: AnalyzedInstallmentItem) => (
            <InstallmentItemCard
              key={item.id}
              item={item}
              onView={(viewItem) => setViewingItem(viewItem as unknown as PaymentItem)}
              onEdit={handleEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              isDeletePending={deleteMutation.isPending}
            />
          ))
        )}
      </div>

      {/* 編輯對話框 */}
      <InstallmentEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        form={editForm as unknown as UseFormReturn<FieldValues>}
        onSubmit={handleEditSubmit as unknown as (data: FieldValues) => void}
        isPending={updateMutation.isPending}
        editingItem={editingItem}
      />

      {/* 詳細檢視對話框 */}
      <InstallmentDetailDialog
        item={viewingItem}
        onClose={() => setViewingItem(null)}
        projects={projects}
        categories={categories}
        fixedCategories={fixedCategories}
      />
    </div>
  );
}
