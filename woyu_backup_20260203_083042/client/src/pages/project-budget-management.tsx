import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, Search, Filter, Calendar, DollarSign, TrendingUp, 
  AlertTriangle, RefreshCw, ChevronDown, ChevronUp, 
  Wallet, Target, ClipboardList, ArrowRight, Check, X,
  Edit, Trash2, Eye, FileText, Clock, PieChart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

type BudgetPlan = {
  id: number;
  planName: string;
  planType: string;
  projectId: number | null;
  budgetPeriod: string;
  startDate: string;
  endDate: string;
  totalBudget: string;
  actualSpent: string;
  status: string;
  tags: any[];
  createdAt: string;
  items?: BudgetItem[];
};

type BudgetItem = {
  id: number;
  budgetPlanId: number;
  categoryId: number | null;
  fixedCategoryId: number | null;
  itemName: string;
  description: string | null;
  paymentType: string;
  plannedAmount: string;
  actualAmount: string | null;
  installmentCount: number | null;
  installmentAmount: string | null;
  monthlyAmount: string | null;
  monthCount: number | null;
  startDate: string | null;
  endDate: string | null;
  priority: number;
  convertedToPayment: boolean;
  linkedPaymentItemId: number | null;
  conversionDate: string | null;
  variance: string | null;
  variancePercentage: string | null;
  notes: string | null;
};

type Project = {
  id: number;
  projectName: string;
  projectType: string;
};

type Category = {
  id: number;
  categoryName: string;
};

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

export default function ProjectBudgetManagement() {
  const [activeTab, setActiveTab] = useState("plans");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BudgetPlan | null>(null);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [deletePlan, setDeletePlan] = useState<BudgetPlan | null>(null);
  const [deleteItem, setDeleteItem] = useState<BudgetItem | null>(null);
  const [convertItem, setConvertItem] = useState<BudgetItem | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const { data: planSummary } = useQuery<any>({
    queryKey: ["/api/budget/plans", selectedPlanId, "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/budget/plans/${selectedPlanId}/summary`);
      if (!res.ok) throw new Error("Failed to fetch budget summary");
      return res.json();
    },
    enabled: !!selectedPlanId,
  });

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

  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
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
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message || "建立失敗", variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
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
    onError: (error: any) => {
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
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message || "刪除失敗", variant: "destructive" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: any) => {
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
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message || "建立失敗", variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
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
    onError: (error: any) => {
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
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message || "刪除失敗", variant: "destructive" });
    },
  });

  const convertItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/budget/items/${id}/convert`);
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "成功", 
        description: `預算項目已轉換為付款項目 (ID: ${data.paymentItem.id})` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans", selectedPlanId] });
      queryClient.invalidateQueries({ queryKey: ["/api/budget/plans", selectedPlanId, "summary"] });
      setConvertItem(null);
    },
    onError: (error: any) => {
      toast({ title: "錯誤", description: error.message || "轉換失敗", variant: "destructive" });
    },
  });

  const filteredPlans = useMemo(() => {
    let filtered = budgetPlans;
    if (searchTerm) {
      filtered = filtered.filter(plan => 
        plan.planName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered;
  }, [budgetPlans, searchTerm]);

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

  const onPlanSubmit = (data: any) => {
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data });
    } else {
      createPlanMutation.mutate(data);
    }
  };

  const onItemSubmit = (data: any) => {
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate(data);
    }
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "completed": return "bg-blue-100 text-blue-800";
      case "over_budget": return "bg-red-100 text-red-800";
      case "cancelled": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "進行中";
      case "completed": return "已完成";
      case "over_budget": return "超出預算";
      case "cancelled": return "已取消";
      default: return status;
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return "bg-red-100 text-red-800";
      case 2: return "bg-yellow-100 text-yellow-800";
      case 3: return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return "高";
      case 2: return "中";
      case 3: return "低";
      default: return "中";
    }
  };

  const paymentType = itemForm.watch("paymentType");

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">專案預算管理</h1>
          <p className="text-gray-500">管理專案預算規劃、追蹤預估與實際支出差異</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
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
            }}
            data-testid="button-create-plan"
          >
            <Plus className="w-4 h-4 mr-2" />
            新增預算計劃
          </Button>
        </div>
      </div>

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
          {isLoadingPlans ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : filteredPlans.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>尚無預算計劃</p>
                <Button
                  variant="link"
                  onClick={() => setIsPlanDialogOpen(true)}
                  className="mt-2"
                >
                  建立第一個預算計劃
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPlans.map((plan: any) => {
                // 使用計算後的項目總額（根據付款類型計算）
                const budget = plan.calculatedTotal || 0;
                const spent = parseFloat(plan.actualSpent) || 0;
                const progress = budget > 0 ? (spent / budget) * 100 : 0;
                const projectName = projects.find(p => p.id === plan.projectId)?.projectName || "未指定專案";

                return (
                  <Card 
                    key={plan.id} 
                    className={`cursor-pointer transition-shadow hover:shadow-md ${selectedPlanId === plan.id ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => {
                      setSelectedPlanId(plan.id);
                      setActiveTab("detail");
                    }}
                    data-testid={`card-plan-${plan.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{plan.planName}</CardTitle>
                          <CardDescription>{projectName}</CardDescription>
                        </div>
                        <Badge className={getStatusColor(plan.status || "active")}>
                          {getStatusLabel(plan.status || "active")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">預算總額</span>
                        <span className="font-medium">{formatCurrency(budget)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">已使用</span>
                        <span className={`font-medium ${progress > 100 ? 'text-red-600' : ''}`}>
                          {formatCurrency(spent)}
                        </span>
                      </div>
                      <Progress value={Math.min(progress, 100)} className="h-2" />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{plan.startDate} ~ {plan.endDate}</span>
                        <span>{progress.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-end gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditPlan(plan)}
                          data-testid={`button-edit-plan-${plan.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletePlan(plan)}
                          data-testid={`button-delete-plan-${plan.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="detail" className="space-y-4">
          {isLoadingPlanDetail ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : selectedPlanDetail ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{selectedPlanDetail.planName}</CardTitle>
                      <CardDescription>
                        {selectedPlanDetail.startDate} ~ {selectedPlanDetail.endDate}
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => {
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
                      }}
                      data-testid="button-add-item"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      新增預算項目
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {!selectedPlanDetail.items || selectedPlanDetail.items.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>尚無預算項目</p>
                    <Button
                      variant="link"
                      onClick={() => setIsItemDialogOpen(true)}
                      className="mt-2"
                    >
                      新增第一個預算項目
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {selectedPlanDetail.items.map((item) => {
                    const planned = parseFloat(item.plannedAmount) || 0;
                    const actual = parseFloat(item.actualAmount || "0") || 0;
                    const variance = planned - actual;

                    return (
                      <Card key={item.id} data-testid={`card-item-${item.id}`}>
                        <CardContent className="py-4">
                          <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium truncate">{item.itemName}</h3>
                                <Badge className={getPriorityColor(item.priority)}>
                                  {getPriorityLabel(item.priority)}
                                </Badge>
                                {item.convertedToPayment && (
                                  <Badge className="bg-blue-100 text-blue-800">
                                    <Check className="w-3 h-3 mr-1" />
                                    已轉換
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{item.description || "無描述"}</p>
                              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                                <span className="text-gray-500">
                                  預估: <span className="font-medium text-gray-900">{formatCurrency(planned)}</span>
                                </span>
                                {actual > 0 && (
                                  <span className="text-gray-500">
                                    實際: <span className="font-medium text-gray-900">{formatCurrency(actual)}</span>
                                  </span>
                                )}
                                {actual > 0 && (
                                  <span className={variance >= 0 ? "text-green-600" : "text-red-600"}>
                                    差異: {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {!item.convertedToPayment && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setConvertItem(item)}
                                  data-testid={`button-convert-item-${item.id}`}
                                >
                                  <ArrowRight className="w-4 h-4 mr-1" />
                                  轉為付款
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditItem(item)}
                                data-testid={`button-edit-item-${item.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteItem(item)}
                                data-testid={`button-delete-item-${item.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                請先選擇一個預算計劃
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          {planSummary ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">預算總額</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(planSummary.summary.totalBudget)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">已規劃金額</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(planSummary.summary.totalPlanned)}</div>
                  <p className="text-sm text-gray-500">
                    使用率: {planSummary.summary.utilizationRate}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">實際支出</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(planSummary.summary.totalActual)}</div>
                  <p className={`text-sm ${planSummary.summary.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    差異: {planSummary.summary.variance >= 0 ? "+" : ""}{formatCurrency(planSummary.summary.variance)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">轉換進度</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{planSummary.summary.conversionRate}%</div>
                  <p className="text-sm text-gray-500">
                    {planSummary.summary.convertedCount} / {planSummary.summary.itemCount} 項目
                  </p>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">預算使用狀況</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>已規劃</span>
                        <span>{planSummary.summary.utilizationRate}%</span>
                      </div>
                      <Progress value={parseFloat(planSummary.summary.utilizationRate)} className="h-3" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{planSummary.summary.byPaymentType.single}</div>
                        <div className="text-xs text-gray-500">一般付款</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{planSummary.summary.byPaymentType.installment}</div>
                        <div className="text-xs text-gray-500">分期付款</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{planSummary.summary.byPaymentType.monthly}</div>
                        <div className="text-xs text-gray-500">月付款項</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">項目狀態</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                      <div className="text-2xl font-bold text-yellow-600">{planSummary.summary.pendingCount}</div>
                      <div className="text-sm text-yellow-600">待轉換項目</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <Check className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <div className="text-2xl font-bold text-green-600">{planSummary.summary.convertedCount}</div>
                      <div className="text-sm text-green-600">已轉換項目</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                請先選擇一個預算計劃查看統計
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "編輯預算計劃" : "新增預算計劃"}</DialogTitle>
            <DialogDescription>
              {editingPlan ? "修改預算計劃的詳細資訊" : "建立一個新的預算計劃來規劃支出"}
            </DialogDescription>
          </DialogHeader>
          <Form {...planForm}>
            <form onSubmit={planForm.handleSubmit(onPlanSubmit)} className="space-y-4">
              <FormField
                control={planForm.control}
                name="planName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>計劃名稱</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例：2025年Q1營運預算" data-testid="input-plan-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={planForm.control}
                  name="planType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>計劃類型</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-plan-type">
                            <SelectValue placeholder="選擇類型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="project">專案預算</SelectItem>
                          <SelectItem value="department">部門預算</SelectItem>
                          <SelectItem value="event">活動預算</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={planForm.control}
                  name="budgetPeriod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>預算週期</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-budget-period">
                            <SelectValue placeholder="選擇週期" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">月度</SelectItem>
                          <SelectItem value="quarterly">季度</SelectItem>
                          <SelectItem value="yearly">年度</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={planForm.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>關聯專案</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-plan-project">
                          <SelectValue placeholder="選擇專案（選填）" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">不指定專案</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.projectName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={planForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>開始日期</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-plan-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={planForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>結束日期</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-plan-end-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={planForm.control}
                name="totalBudget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>預算總額</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        placeholder="請輸入預算總額" 
                        data-testid="input-plan-budget"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPlanDialogOpen(false)}>
                  取消
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
                  data-testid="button-submit-plan"
                >
                  {(createPlanMutation.isPending || updatePlanMutation.isPending) && (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingPlan ? "更新" : "建立"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "編輯預算項目" : "新增預算項目"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "修改預算項目的詳細資訊" : "為預算計劃新增一個預算項目"}
            </DialogDescription>
          </DialogHeader>
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-4">
              <FormField
                control={itemForm.control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>項目名稱</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例：辦公室租金" data-testid="input-item-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={itemForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="項目描述（選填）" data-testid="input-item-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                  name="paymentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>付款類型</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-item-payment-type">
                            <SelectValue placeholder="選擇類型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single">一次性付款</SelectItem>
                          <SelectItem value="installment">分期付款</SelectItem>
                          <SelectItem value="monthly">月付款項</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>優先級</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-item-priority">
                            <SelectValue placeholder="選擇優先級" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">高</SelectItem>
                          <SelectItem value="2">中</SelectItem>
                          <SelectItem value="3">低</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                  name="plannedAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>預估金額</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="0" data-testid="input-item-planned-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="actualAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>實際金額（選填）</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="0" data-testid="input-item-actual-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {paymentType === "installment" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={itemForm.control}
                    name="installmentCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>分期期數</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} placeholder="12" data-testid="input-installment-count" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={itemForm.control}
                    name="installmentAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>每期金額</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} placeholder="0" data-testid="input-installment-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {paymentType === "monthly" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={itemForm.control}
                    name="monthlyAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>月付金額</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} placeholder="0" data-testid="input-monthly-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={itemForm.control}
                    name="monthCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>月數</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} placeholder="12" data-testid="input-month-count" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>開始日期（選填）</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-item-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>結束日期（選填）</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-item-end-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={itemForm.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分類（選填）</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-item-category">
                          <SelectValue placeholder="選擇分類" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">不指定分類</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.categoryName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={itemForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註（選填）</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="其他備註" data-testid="input-item-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)}>
                  取消
                </Button>
                <Button 
                  type="submit" 
                  disabled={createItemMutation.isPending || updateItemMutation.isPending}
                  data-testid="button-submit-item"
                >
                  {(createItemMutation.isPending || updateItemMutation.isPending) && (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingItem ? "更新" : "建立"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePlan} onOpenChange={() => setDeletePlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除預算計劃？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作將永久刪除預算計劃「{deletePlan?.planName}」及其所有預算項目，無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePlan && deletePlanMutation.mutate(deletePlan.id)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-plan"
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除預算項目？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作將刪除預算項目「{deleteItem?.itemName}」。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteItemMutation.mutate(deleteItem.id)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-item"
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!convertItem} onOpenChange={() => setConvertItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認轉換為付款項目？</AlertDialogTitle>
            <AlertDialogDescription>
              將預算項目「{convertItem?.itemName}」轉換為實際付款項目。
              轉換後將建立新的付款項目，預算項目保持原狀並標記為已轉換。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => convertItem && convertItemMutation.mutate(convertItem.id)}
              data-testid="button-confirm-convert-item"
            >
              確認轉換
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
