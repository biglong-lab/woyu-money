import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";

// 子組件匯入
import {
  KeyMetricsCards,
  FilterPanel,
  DashboardCharts,
  ProjectAnalysisList,
  PaymentItemList,
  ProjectDialog,
  PaymentItemDialog,
  paymentItemSchema,
  projectSchema,
} from "@/components/integrated-payment-analysis";
import type { PaymentItem, PaymentProject } from "@/components/integrated-payment-analysis";

// ========================================
// 付款分析與專案管理 - 主頁面
// 職責：狀態管理、資料查詢、組合子組件
// ========================================

export default function IntegratedPaymentAnalysisOptimized() {
  // 頁面狀態
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("current_month");
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentItem | null>(null);
  const [showDeletedItems, setShowDeletedItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ========================================
  // 表單設定
  // ========================================

  const itemForm = useForm({
    resolver: zodResolver(paymentItemSchema),
    defaultValues: {
      categoryId: 0,
      projectId: 0,
      itemName: "",
      totalAmount: "",
      paymentType: "single" as const,
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
      priority: 1,
      notes: "",
    },
  });

  const projectForm = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      projectName: "",
      projectType: "general",
      description: "",
    },
  });

  // ========================================
  // 資料查詢
  // ========================================

  const { data: paymentItems = [] } = useQuery<PaymentItem[]>({
    queryKey: [`/api/payment/items?includeDeleted=${showDeletedItems}&includeAll=true`],
  });

  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories/project"],
  });

  // ========================================
  // Mutations
  // ========================================

  const createItemMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payment/items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsItemDialogOpen(false);
      setEditingItem(null);
      itemForm.reset();
      toast({ title: "成功", description: "付款項目已建立" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data, reason }: { id: number; data: any; reason?: string }) =>
      apiRequest("PUT", `/api/payment/items/${id}`, { ...data, changeReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsItemDialogOpen(false);
      setEditingItem(null);
      itemForm.reset();
      toast({ title: "成功", description: "付款項目已更新" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      apiRequest("DELETE", `/api/payment/items/${id}`, { changeReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      toast({ title: "成功", description: "付款項目已刪除" });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/payment/projects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/projects"] });
      setIsProjectDialogOpen(false);
      projectForm.reset();
      toast({ title: "成功", description: "專案已建立" });
    },
  });

  // ========================================
  // 篩選與計算邏輯
  // ========================================

  /** 篩選後的付款項目 */
  const filteredItems = useMemo(() => {
    return paymentItems.filter((item) => {
      // 搜尋條件
      if (
        searchTerm &&
        !item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !item.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !item.categoryName?.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      // 專案篩選
      if (selectedProject !== "all" && item.projectId !== parseInt(selectedProject)) {
        return false;
      }
      // 狀態篩選
      if (selectedStatus !== "all" && item.status !== selectedStatus) {
        return false;
      }
      // 刪除狀態篩選
      if (!showDeletedItems && item.isDeleted) {
        return false;
      }
      return true;
    });
  }, [paymentItems, searchTerm, selectedProject, selectedStatus, showDeletedItems]);

  /** 關鍵指標計算 */
  const keyMetrics = useMemo(() => {
    const totalPlanned = filteredItems.reduce(
      (sum, item) => sum + parseFloat(item.totalAmount || "0"), 0
    );
    const totalPaid = filteredItems.reduce((sum, item) => {
      if (item.status === "paid") {
        return sum + parseFloat(item.paidAmount || item.totalAmount || "0");
      } else if (item.paidAmount && parseFloat(item.paidAmount) > 0) {
        return sum + parseFloat(item.paidAmount);
      }
      return sum;
    }, 0);
    const completionRate = totalPlanned > 0 ? (totalPaid / totalPlanned * 100) : 0;
    const statusCounts = filteredItems.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPlanned,
      totalPaid,
      totalPending: totalPlanned - totalPaid,
      completionRate,
      totalItems: filteredItems.length,
      overdueItems: statusCounts.overdue || 0,
      pendingItems: statusCounts.pending || 0,
      paidItems: statusCounts.paid || 0,
    };
  }, [filteredItems]);

  /** 專案統計資料 */
  const projectBreakdown = useMemo(() => {
    const breakdown = filteredItems.reduce((acc, item) => {
      const projectName = item.projectName || "未分類";
      if (!acc[projectName]) {
        acc[projectName] = { planned: 0, paid: 0, count: 0 };
      }
      acc[projectName].planned += parseFloat(item.totalAmount || "0");
      if (item.status === "paid") {
        acc[projectName].paid += parseFloat(item.paidAmount || item.totalAmount || "0");
      } else if (item.paidAmount && parseFloat(item.paidAmount) > 0) {
        acc[projectName].paid += parseFloat(item.paidAmount);
      }
      acc[projectName].count += 1;
      return acc;
    }, {} as Record<string, { planned: number; paid: number; count: number }>);

    return Object.entries(breakdown).map(([name, data]) => ({
      name,
      planned: data.planned,
      paid: data.paid,
      pending: data.planned - data.paid,
      count: data.count,
      completionRate: data.planned > 0 ? (data.paid / data.planned * 100) : 0,
    }));
  }, [filteredItems]);

  // ========================================
  // 事件處理
  // ========================================

  /** 表單提交處理 */
  const handleSubmit = (data: any) => {
    const formData = {
      ...data,
      categoryId: parseInt(data.categoryId.toString()),
      projectId: parseInt(data.projectId.toString()),
      installmentCount:
        data.paymentType === 'installment'
          ? parseInt(data.installmentCount?.toString() || '1')
          : null,
    };

    if (editingItem) {
      updateItemMutation.mutate({
        id: editingItem.id,
        data: formData,
        reason: "更新項目資訊",
      });
    } else {
      createItemMutation.mutate(formData);
    }
  };

  /** 編輯項目處理 */
  const handleEditItem = (item: PaymentItem) => {
    setEditingItem(item);
    itemForm.reset({
      categoryId: item.categoryId || 0,
      projectId: item.projectId || 0,
      itemName: item.itemName,
      totalAmount: item.totalAmount,
      paymentType: item.paymentType as any,
      startDate: item.startDate,
      endDate: item.endDate || "",
      priority: item.priority,
      notes: item.notes || "",
    });
    setIsItemDialogOpen(true);
  };

  /** 重置編輯狀態 */
  const handleResetEditing = () => {
    setEditingItem(null);
    itemForm.reset();
  };

  /** 刪除項目處理 */
  const handleDeleteItem = (id: number, reason: string) => {
    deleteItemMutation.mutate({ id, reason });
  };

  // ========================================
  // 渲染
  // ========================================

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        {/* 頁面標題與操作按鈕 */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
              付款分析與專案管理
            </h1>
            <p className="text-muted-foreground">
              綜合付款分析、專案管理與統計報告
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <ProjectDialog
              open={isProjectDialogOpen}
              onOpenChange={setIsProjectDialogOpen}
              form={projectForm}
              onSubmit={(data) => createProjectMutation.mutate(data)}
              isPending={createProjectMutation.isPending}
            />
            <PaymentItemDialog
              open={isItemDialogOpen}
              onOpenChange={setIsItemDialogOpen}
              editingItem={editingItem}
              form={itemForm}
              onSubmit={handleSubmit}
              onResetEditing={handleResetEditing}
              isPending={createItemMutation.isPending || updateItemMutation.isPending}
              projects={projects}
              categories={categories}
            />
          </div>
        </div>

        {/* 關鍵指標卡片 */}
        <KeyMetricsCards metrics={keyMetrics} />

        {/* 篩選面板 */}
        <FilterPanel
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          selectedProject={selectedProject}
          onSelectedProjectChange={setSelectedProject}
          selectedStatus={selectedStatus}
          onSelectedStatusChange={setSelectedStatus}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          showDeletedItems={showDeletedItems}
          onShowDeletedItemsChange={setShowDeletedItems}
          selectedItemsCount={selectedItems.length}
          showBatchActions={showBatchActions}
          onShowBatchActionsToggle={() => setShowBatchActions(!showBatchActions)}
          projects={projects}
        />

        {/* 頁籤切換 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard">儀表板</TabsTrigger>
            <TabsTrigger value="projects">專案分析</TabsTrigger>
            <TabsTrigger value="management">項目管理</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <DashboardCharts
              projectBreakdown={projectBreakdown}
              keyMetrics={keyMetrics}
            />
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <ProjectAnalysisList projectBreakdown={projectBreakdown} />
          </TabsContent>

          <TabsContent value="management" className="space-y-4">
            <PaymentItemList
              filteredItems={filteredItems}
              totalItemsCount={paymentItems.length}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
