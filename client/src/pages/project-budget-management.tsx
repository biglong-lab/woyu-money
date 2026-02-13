// 專案預算管理主頁面

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, type UseFormReturn, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, ClipboardList, FileText, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// 子元件
import ProjectBudgetPlanList from "@/components/project-budget-plan-list";
import ProjectBudgetPlanDetail from "@/components/project-budget-plan-detail";
import ProjectBudgetDashboard from "@/components/project-budget-dashboard";
import ProjectBudgetPlanDialog from "@/components/project-budget-plan-dialog";
import ProjectBudgetItemDialog from "@/components/project-budget-item-dialog";
import {
  DeletePlanDialog,
  DeleteItemDialog,
  ConvertItemDialog,
} from "@/components/project-budget-confirm-dialogs";

// 型別
import type { BudgetPlan, BudgetItem, Project, Category } from "@/components/project-budget-types";

// 預算計劃摘要 API 回傳型別
interface PaymentTypeStat {
  count: number;
  total: number;
}

interface BudgetSummary {
  totalBudget: number;
  calculatedTotal: number;
  totalPlanned?: number;
  totalActual: number;
  variance: number;
  utilizationRate: string | number;
  conversionRate: string | number;
  itemCount: number;
  convertedCount: number;
  pendingCount: number;
  byPaymentType: {
    single: PaymentTypeStat;
    installment: PaymentTypeStat;
    monthly: PaymentTypeStat;
  };
}

interface BudgetPlanSummaryResponse {
  plan: BudgetPlan;
  summary: BudgetSummary;
}

// 轉換預算項目為付款項目的 API 回傳型別
interface ConvertItemResponse {
  message: string;
  paymentItem: { id: number };
  budgetItemId: number;
}

// Zod 驗證 Schema
const budgetPlanSchema = z.object({
  planName: z.string().min(1, "請輸入預算計劃名稱"),
  planType: z.string().min(1, "請選擇計劃類型"),
  projectId: z.string().optional(),
  budgetPeriod: z.string().min(1, "請選擇預算週期"),
  startDate: z.string().min(1, "請選擇開始日期"),
  endDate: z.string().min(1, "請選擇結束日期"),
  totalBudget: z.string().min(1, "請輸入預算總額"),
});

const budgetItemSchema = z.object({
  itemName: z.string().min(1, "請輸入項目名稱"),
  description: z.string().optional(),
  paymentType: z.string().min(1, "請選擇付款類型"),
  plannedAmount: z.string().min(1, "請輸入預估金額"),
  actualAmount: z.string().optional(),
  installmentCount: z.string().optional(),
  installmentAmount: z.string().optional(),
  monthlyAmount: z.string().optional(),
  monthCount: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  priority: z.string().min(1, "請選擇優先級"),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
});

// 表單資料型別（由 Zod schema 推導）
type BudgetPlanFormData = z.infer<typeof budgetPlanSchema>;
type BudgetItemFormData = z.infer<typeof budgetItemSchema>;

export default function ProjectBudgetManagement() {
  // 頁面狀態
  const [activeTab, setActiveTab] = useState("plans");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog 狀態
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BudgetPlan | null>(null);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [deletePlan, setDeletePlan] = useState<BudgetPlan | null>(null);
  const [deleteItem, setDeleteItem] = useState<BudgetItem | null>(null);
  const [convertItem, setConvertItem] = useState<BudgetItem | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 查詢資料
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/payment/projects"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/debt-categories"],
  });

  const { data: budgetPlans = [], isLoading: isLoadingPlans } = useQuery<BudgetPlan[]>({
    queryKey: ["/api/budget/plans", selectedProject],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProject !== "all") {
        params.append("projectId", selectedProject);
      }
      const res = await fetch(`/api/budget/plans?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch budget plans");
      return res.json();
    },
  });

  const { data: selectedPlanDetail, isLoading: isLoadingPlanDetail } = useQuery<BudgetPlan>({
    queryKey: ["/api/budget/plans", selectedPlanId],
    queryFn: async () => {
      const res = await fetch(`/api/budget/plans/${selectedPlanId}`);
      if (!res.ok) throw new Error("Failed to fetch budget plan detail");
      return res.json();
    },
    enabled: !!selectedPlanId,
  });

  const { data: planSummary } = useQuery<BudgetPlanSummaryResponse>({
    queryKey: ["/api/budget/plans", selectedPlanId, "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/budget/plans/${selectedPlanId}/summary`);
      if (!res.ok) throw new Error("Failed to fetch budget summary");
      return res.json();
    },
    enabled: !!selectedPlanId,
  });

  // 篩選
  const filteredPlans = useMemo(() => {
    if (!searchTerm) return budgetPlans;
    return budgetPlans.filter((plan) =>
      plan.planName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [budgetPlans, searchTerm]);

  // 表單
  const planForm = useForm({
    resolver: zodResolver(budgetPlanSchema),
    defaultValues: {
      planName: "",
      planType: "project",
      projectId: "",
      budgetPeriod: "monthly",
      startDate: "",
      endDate: "",
      totalBudget: "",
    },
  });

  const itemForm = useForm({
    resolver: zodResolver(budgetItemSchema),
    defaultValues: {
      itemName: "",
      description: "",
      paymentType: "single",
      plannedAmount: "",
      actualAmount: "",
      installmentCount: "",
      installmentAmount: "",
      monthlyAmount: "",
      monthCount: "",
      startDate: "",
      endDate: "",
      priority: "2",
      categoryId: "",
      notes: "",
    },
  });

  const paymentType = itemForm.watch("paymentType");

  // Mutations
  const createPlanMutation = useMutation({
    mutationFn: async (data: BudgetPlanFormData) => {
      const payload = {
        ...data,
        projectId: data.projectId && data.projectId !== "none" ? parseInt(data.projectId) : null,
      };
      return apiRequest("POST", "/api/budget/plans", payload);
    },
    onSuccess: () => {
      toast({ title: "成功", description: "預算計劃已建立" });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans"] });
      setIsPlanDialogOpen(false);
      planForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "錯誤", description: error.message || "建立失敗", variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: BudgetPlanFormData }) => {
      const payload = {
        ...data,
        projectId: data.projectId && data.projectId !== "none" ? parseInt(data.projectId) : null,
      };
      return apiRequest("PATCH", `/api/budget/plans/${id}`, payload);
    },
    onSuccess: () => {
      toast({ title: "成功", description: "預算計劃已更新" });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans"] });
      setIsPlanDialogOpen(false);
      setEditingPlan(null);
      planForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "錯誤", description: error.message || "更新失敗", variant: "destructive" });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/budget/plans/${id}`);
    },
    onSuccess: () => {
      toast({ title: "成功", description: "預算計劃已刪除" });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans"] });
      setDeletePlan(null);
      if (selectedPlanId === deletePlan?.id) {
        setSelectedPlanId(null);
      }
    },
    onError: (error: Error) => {
      toast({ title: "錯誤", description: error.message || "刪除失敗", variant: "destructive" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: BudgetItemFormData) => {
      const payload = {
        itemName: data.itemName,
        description: data.description || null,
        paymentType: data.paymentType,
        plannedAmount: data.plannedAmount,
        actualAmount: data.actualAmount && data.actualAmount.trim() !== "" ? data.actualAmount : null,
        budgetPlanId: selectedPlanId,
        categoryId: data.categoryId && data.categoryId !== "none" ? parseInt(data.categoryId) : null,
        priority: parseInt(data.priority),
        installmentCount: data.installmentCount && data.installmentCount.trim() !== "" ? parseInt(data.installmentCount) : null,
        installmentAmount: data.installmentAmount && data.installmentAmount.trim() !== "" ? data.installmentAmount : null,
        monthlyAmount: data.monthlyAmount && data.monthlyAmount.trim() !== "" ? data.monthlyAmount : null,
        monthCount: data.monthCount && data.monthCount.trim() !== "" ? parseInt(data.monthCount) : null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        notes: data.notes || null,
      };
      return apiRequest("POST", "/api/budget/items", payload);
    },
    onSuccess: () => {
      toast({ title: "成功", description: "預算項目已建立" });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans", selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans", selectedPlanId, "summary"] });
      setIsItemDialogOpen(false);
      itemForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "錯誤", description: error.message || "建立失敗", variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: BudgetItemFormData }) => {
      const payload = {
        itemName: data.itemName,
        description: data.description || null,
        paymentType: data.paymentType,
        plannedAmount: data.plannedAmount,
        actualAmount: data.actualAmount && data.actualAmount.trim() !== "" ? data.actualAmount : null,
        categoryId: data.categoryId && data.categoryId !== "none" ? parseInt(data.categoryId) : null,
        priority: parseInt(data.priority),
        installmentCount: data.installmentCount && data.installmentCount.trim() !== "" ? parseInt(data.installmentCount) : null,
        installmentAmount: data.installmentAmount && data.installmentAmount.trim() !== "" ? data.installmentAmount : null,
        monthlyAmount: data.monthlyAmount && data.monthlyAmount.trim() !== "" ? data.monthlyAmount : null,
        monthCount: data.monthCount && data.monthCount.trim() !== "" ? parseInt(data.monthCount) : null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        notes: data.notes || null,
      };
      return apiRequest("PATCH", `/api/budget/items/${id}`, payload);
    },
    onSuccess: () => {
      toast({ title: "成功", description: "預算項目已更新" });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans", selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans", selectedPlanId, "summary"] });
      setIsItemDialogOpen(false);
      setEditingItem(null);
      itemForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "錯誤", description: error.message || "更新失敗", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/budget/items/${id}`);
    },
    onSuccess: () => {
      toast({ title: "成功", description: "預算項目已刪除" });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans", selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans", selectedPlanId, "summary"] });
      setDeleteItem(null);
    },
    onError: (error: Error) => {
      toast({ title: "錯誤", description: error.message || "刪除失敗", variant: "destructive" });
    },
  });

  const convertItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest<ConvertItemResponse>("POST", `/api/budget/items/${id}/convert`);
    },
    onSuccess: (data: ConvertItemResponse) => {
      toast({
        title: "成功",
        description: `預算項目已轉換為付款項目 (ID: ${data.paymentItem.id})`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans", selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans", selectedPlanId, "summary"] });
      setConvertItem(null);
    },
    onError: (error: Error) => {
      toast({ title: "錯誤", description: error.message || "轉換失敗", variant: "destructive" });
    },
  });

  // 事件處理
  const openEditPlan = (plan: BudgetPlan) => {
    setEditingPlan(plan);
    planForm.reset({
      planName: plan.planName,
      planType: plan.planType,
      projectId: plan.projectId?.toString() || "",
      budgetPeriod: plan.budgetPeriod,
      startDate: plan.startDate,
      endDate: plan.endDate,
      totalBudget: plan.totalBudget,
    });
    setIsPlanDialogOpen(true);
  };

  const openEditItem = (item: BudgetItem) => {
    setEditingItem(item);
    itemForm.reset({
      itemName: item.itemName,
      description: item.description || "",
      paymentType: item.paymentType,
      plannedAmount: item.plannedAmount,
      actualAmount: item.actualAmount || "",
      installmentCount: item.installmentCount?.toString() || "",
      installmentAmount: item.installmentAmount || "",
      monthlyAmount: item.monthlyAmount || "",
      monthCount: item.monthCount?.toString() || "",
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      priority: item.priority.toString(),
      categoryId: item.categoryId?.toString() || "",
      notes: item.notes || "",
    });
    setIsItemDialogOpen(true);
  };

  const onPlanSubmit = (data: BudgetPlanFormData) => {
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data });
    } else {
      createPlanMutation.mutate(data);
    }
  };

  const onItemSubmit = (data: BudgetItemFormData) => {
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate(data);
    }
  };

  const handleSelectPlan = (planId: number) => {
    setSelectedPlanId(planId);
    setActiveTab("detail");
  };

  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    planForm.reset({
      planName: "",
      planType: "project",
      projectId: "",
      budgetPeriod: "monthly",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      totalBudget: "",
    });
    setIsPlanDialogOpen(true);
  };

  const handleOpenCreateItem = () => {
    setEditingItem(null);
    itemForm.reset({
      itemName: "",
      description: "",
      paymentType: "single",
      plannedAmount: "",
      actualAmount: "",
      installmentCount: "",
      installmentAmount: "",
      monthlyAmount: "",
      monthCount: "",
      startDate: "",
      endDate: "",
      priority: "2",
      categoryId: "",
      notes: "",
    });
    setIsItemDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
            專案預算管理
          </h1>
          <p className="text-gray-500">管理專案預算規劃、追蹤預估與實際支出差異</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOpenCreatePlan} data-testid="button-create-plan">
            <Plus className="w-4 h-4 mr-2" />
            新增預算計劃
          </Button>
        </div>
      </div>

      {/* 搜尋與專案篩選 */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="搜尋預算計劃..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </div>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-full md:w-[200px]" data-testid="select-project">
            <SelectValue placeholder="選擇專案" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部專案</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id.toString()}>
                {project.projectName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 頁籤切換 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans" data-testid="tab-plans">
            <ClipboardList className="w-4 h-4 mr-2" />
            預算計劃
          </TabsTrigger>
          <TabsTrigger value="detail" disabled={!selectedPlanId} data-testid="tab-detail">
            <FileText className="w-4 h-4 mr-2" />
            預算詳情
          </TabsTrigger>
          <TabsTrigger value="dashboard" disabled={!selectedPlanId} data-testid="tab-dashboard">
            <PieChart className="w-4 h-4 mr-2" />
            預算儀表板
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <ProjectBudgetPlanList
            plans={filteredPlans}
            projects={projects}
            isLoading={isLoadingPlans}
            selectedPlanId={selectedPlanId}
            onSelectPlan={handleSelectPlan}
            onEditPlan={openEditPlan}
            onDeletePlan={setDeletePlan}
            onCreatePlan={handleOpenCreatePlan}
          />
        </TabsContent>

        <TabsContent value="detail" className="space-y-4">
          <ProjectBudgetPlanDetail
            planDetail={selectedPlanDetail}
            isLoading={isLoadingPlanDetail}
            onAddItem={handleOpenCreateItem}
            onEditItem={openEditItem}
            onDeleteItem={setDeleteItem}
            onConvertItem={setConvertItem}
          />
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <ProjectBudgetDashboard planSummary={planSummary as unknown as import("@/components/project-budget-dashboard").PlanSummary | null} />
        </TabsContent>
      </Tabs>

      {/* 對話框群組 */}
      <ProjectBudgetPlanDialog
        open={isPlanDialogOpen}
        onOpenChange={setIsPlanDialogOpen}
        form={planForm as unknown as UseFormReturn<FieldValues>}
        onSubmit={onPlanSubmit as unknown as (data: FieldValues) => void}
        isPending={createPlanMutation.isPending || updatePlanMutation.isPending}
        editingPlan={editingPlan}
        projects={projects}
      />

      <ProjectBudgetItemDialog
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        form={itemForm as unknown as UseFormReturn<FieldValues>}
        onSubmit={onItemSubmit as unknown as (data: FieldValues) => void}
        isPending={createItemMutation.isPending || updateItemMutation.isPending}
        editingItem={editingItem}
        categories={categories}
        paymentType={paymentType}
      />

      <DeletePlanDialog
        plan={deletePlan}
        onClose={() => setDeletePlan(null)}
        onConfirm={(id) => deletePlanMutation.mutate(id)}
      />

      <DeleteItemDialog
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={(id) => deleteItemMutation.mutate(id)}
      />

      <ConvertItemDialog
        item={convertItem}
        onClose={() => setConvertItem(null)}
        onConfirm={(id) => convertItemMutation.mutate(id)}
      />
    </div>
  );
}
