import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  CalendarIcon, AlertTriangleIcon, CheckCircleIcon, ClockIcon, CreditCard, 
  Plus, Building2, BarChart3, TrendingUp, DollarSign, AlertCircle, 
  CheckCircle2, Clock, Search, Filter, ChevronLeft, ChevronRight,
  Edit, Trash2, RotateCcw, History, Eye
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line } from "recharts";

import { useToast } from "@/hooks/use-toast";

// Schema定義
const paymentItemSchema = z.object({
  categoryId: z.number(),
  projectId: z.number(),
  itemName: z.string().min(1, "項目名稱為必填"),
  totalAmount: z.string().min(1, "金額為必填"),
  paymentType: z.enum(["single", "recurring", "installment"]),
  startDate: z.string().min(1, "開始日期為必填"),
  endDate: z.string().optional(),
  recurringInterval: z.string().optional(),
  installmentCount: z.number().optional(),
  priority: z.number().default(1),
  notes: z.string().optional(),
});

const projectSchema = z.object({
  projectName: z.string().min(1, "專案名稱為必填"),
  projectType: z.enum(["general", "business", "personal", "investment"]),
  description: z.string().optional(),
});

// 類型定義
type PaymentItem = {
  id: number;
  itemName: string;
  totalAmount: string;
  paidAmount: string;
  status: string;
  paymentType: string;
  startDate: string;
  endDate?: string;
  priority: number;
  categoryName?: string;
  projectName?: string;
  projectId?: number;
  categoryId?: number;
  notes?: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type PaymentProject = {
  id: number;
  projectName: string;
  projectType: string;
  description?: string;
  isActive: boolean;
};

interface AuditLog {
  id: number;
  tableName: string;
  recordId: number;
  action: string;
  oldValues: any;
  newValues: any;
  changedFields: string[];
  userId?: number;
  userInfo?: string;
  changeReason?: string;
  createdAt: string;
}

interface MonthlyAnalysis {
  currentMonth: {
    year: number;
    month: number;
    due: {
      count: number;
      totalAmount: string;
      items: PaymentItem[];
    };
    paid: {
      count: number;
      totalAmount: string;
      items: PaymentItem[];
    };
    pending: {
      count: number;
      totalAmount: string;
      items: PaymentItem[];
    };
    overdue: {
      count: number;
      totalAmount: string;
      items: PaymentItem[];
    };
  };
  trends: {
    monthly: Array<{
      month: string;
      planned: number;
      paid: number;
    }>;
    categories: Array<{
      name: string;
      amount: number;
      color: string;
    }>;
  };
}

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800", 
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800"
};

const statusIcons = {
  pending: Clock,
  partial: AlertCircle,
  paid: CheckCircle2,
  overdue: AlertCircle
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function IntegratedPaymentAnalysis() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("current_month");
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentItem | null>(null);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [selectedItemForAudit, setSelectedItemForAudit] = useState<number | null>(null);
  const [showDeletedItems, setShowDeletedItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [useFixedCategory, setUseFixedCategory] = useState(false);
  const [selectedFixedCategory, setSelectedFixedCategory] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 表單設定
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

  // 資料查詢
  const { data: monthlyAnalysis } = useQuery<MonthlyAnalysis>({
    queryKey: ["/api/payment/monthly-analysis", selectedYear, selectedMonth],
    queryFn: () => apiRequest("GET", `/api/payment/monthly-analysis?year=${selectedYear}&month=${selectedMonth}`),
  });

  const { data: paymentItems = [] } = useQuery<PaymentItem[]>({
    queryKey: ["/api/payment/items", showDeletedItems],
    queryFn: () => apiRequest("GET", `/api/payment/items?includeDeleted=${showDeletedItems}`),
  });

  const { data: auditLogs = [] } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs", selectedItemForAudit],
    queryFn: () => selectedItemForAudit ? apiRequest("GET", `/api/audit-logs/payment_items/${selectedItemForAudit}`) : Promise.resolve([]),
    enabled: !!selectedItemForAudit,
  });

  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
    queryFn: () => apiRequest("/api/payment/projects"),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories/project"],
    queryFn: () => apiRequest("/api/categories/project"),
  });

  // 移除有問題的API查詢，使用本地計算的統計數據

  // 查詢固定分類
  const { data: fixedCategories = [] } = useQuery({
    queryKey: ["/api/fixed-categories"],
  });

  // 查詢固定分類子選項
  const { data: fixedSubOptions = [] } = useQuery({
    queryKey: ["/api/fixed-categories/sub-options", selectedFixedCategory],
    enabled: !!selectedFixedCategory,
  });

  // Mutations
  const createItemMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/payment/items", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/monthly-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project/stats"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/payment/monthly-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project/stats"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/payment/monthly-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project/stats"] });
      toast({ title: "成功", description: "付款項目已刪除" });
    },
  });

  const restoreItemMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => 
      apiRequest("POST", `/api/payment/items/${id}/restore`, { changeReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/monthly-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project/stats"] });
      toast({ title: "成功", description: "付款項目已恢復" });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/payment/projects", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/projects"] });
      setIsProjectDialogOpen(false);
      projectForm.reset();
      toast({ title: "成功", description: "專案已建立" });
    },
  });

  // Handler functions for enhanced CRUD operations
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

  const handleDeleteItem = (id: number, reason = "刪除項目") => {
    deleteItemMutation.mutate({ id, reason });
  };

  const handleRestoreItem = (id: number, reason = "恢復項目") => {
    restoreItemMutation.mutate({ id, reason });
  };

  const handleViewAuditHistory = (itemId: number) => {
    setSelectedItemForAudit(itemId);
    setAuditDialogOpen(true);
  };

  const handleSubmitItem = (data: any) => {
    const formData = {
      ...data,
      totalAmount: parseFloat(data.totalAmount),
    };

    // Add fixed category information if using fixed categories
    if (useFixedCategory && selectedFixedCategory) {
      formData.fixedCategoryId = selectedFixedCategory;
      formData.isFixedCategory = true;
    }

    if (editingItem) {
      updateItemMutation.mutate({ 
        id: editingItem.id, 
        data: formData, 
        reason: "更新項目資訊" 
      });
    } else {
      createItemMutation.mutate(formData);
    }
  };

  // 篩選付款項目 - 增強版
  const filteredItems = useMemo(() => {
    return paymentItems.filter(item => {
      // 搜尋條件
      if (searchTerm && !item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !item.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !item.categoryName?.toLowerCase().includes(searchTerm.toLowerCase())) {
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

  // 計算關鍵指標
  const keyMetrics = useMemo(() => {
    const totalPlanned = filteredItems.reduce((sum, item) => sum + parseFloat(item.totalAmount || "0"), 0);
    const totalPaid = filteredItems.reduce((sum, item) => sum + parseFloat(item.paidAmount || "0"), 0);
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
      paidItems: statusCounts.paid || 0
    };
  }, [filteredItems]);

  // 專案統計
  const projectBreakdown = useMemo(() => {
    const breakdown = filteredItems.reduce((acc, item) => {
      const projectName = item.projectName || "未分類";
      if (!acc[projectName]) {
        acc[projectName] = { planned: 0, paid: 0, count: 0 };
      }
      acc[projectName].planned += parseFloat(item.totalAmount || "0");
      acc[projectName].paid += parseFloat(item.paidAmount || "0");
      acc[projectName].count += 1;
      return acc;
    }, {} as Record<string, { planned: number; paid: number; count: number }>);

    return Object.entries(breakdown).map(([name, data]) => ({
      name,
      planned: data.planned,
      paid: data.paid,
      pending: data.planned - data.paid,
      count: data.count,
      completionRate: data.planned > 0 ? (data.paid / data.planned * 100) : 0
    }));
  }, [filteredItems]);

  // 生成年份選項
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const getStatusBadge = (status: string) => {
    const Icon = statusIcons[status as keyof typeof statusIcons] || Clock;
    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || statusColors.pending}>
        <Icon className="w-3 h-3 mr-1" />
        {status === 'pending' ? '待付款' : 
         status === 'partial' ? '部分付款' :
         status === 'paid' ? '已付款' : '逾期'}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        {/* 頁面標題 */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">付款分析與專案管理</h1>
            <p className="text-muted-foreground">
              綜合付款分析、專案管理與統計報告
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Building2 className="w-4 h-4 mr-2" />
                  新增專案
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>建立新專案</DialogTitle>
                  <DialogDescription>建立新的付款專案分類</DialogDescription>
                </DialogHeader>
                <Form {...projectForm}>
                  <form onSubmit={projectForm.handleSubmit((data) => createProjectMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={projectForm.control}
                      name="projectName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>專案名稱 *</FormLabel>
                          <FormControl>
                            <Input placeholder="輸入專案名稱" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={projectForm.control}
                      name="projectType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>專案類型 *</FormLabel>
                          <FormControl>
                            <Input placeholder="例如：general、business、fixed、rental" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={projectForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>專案描述</FormLabel>
                          <FormControl>
                            <Textarea placeholder="專案描述（選填）" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createProjectMutation.isPending}>
                        {createProjectMutation.isPending ? "建立中..." : "建立專案"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={isItemDialogOpen} onOpenChange={(open) => {
              if (!open) {
                setEditingItem(null);
                setUseFixedCategory(false);
                setSelectedFixedCategory(null);
                itemForm.reset({
                  categoryId: 0,
                  projectId: 0,
                  itemName: "",
                  totalAmount: "",
                  paymentType: "single" as const,
                  startDate: new Date().toISOString().split('T')[0],
                  endDate: "",
                  priority: 1,
                  notes: "",
                });
              }
              setIsItemDialogOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingItem(null);
                  itemForm.reset({
                    categoryId: 0,
                    projectId: 0,
                    itemName: "",
                    totalAmount: "",
                    paymentType: "single" as const,
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: "",
                    priority: 1,
                    notes: "",
                  });
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增付款項目
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "編輯付款項目" : "建立付款項目"}</DialogTitle>
                  <DialogDescription>
                    {editingItem ? "修改付款項目資訊" : "新增付款項目到指定專案"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...itemForm}>
                  <form onSubmit={itemForm.handleSubmit(handleSubmitItem)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={itemForm.control}
                        name="projectId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>專案 *</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              value={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="選擇專案" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {projects
                                  .filter(project => project.id && project.projectName && project.id.toString().trim() !== '')
                                  .map((project) => (
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
                      <FormField
                        control={itemForm.control}
                        name="categoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>分類 *</FormLabel>
                            <div className="space-y-3">
                              <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded-md">
                                <Checkbox
                                  id="useFixedCategory"
                                  checked={useFixedCategory}
                                  onCheckedChange={(checked) => {
                                    setUseFixedCategory(!!checked);
                                    if (checked) {
                                      field.onChange(0);
                                      setSelectedFixedCategory(null);
                                    }
                                  }}
                                />
                                <label htmlFor="useFixedCategory" className="text-sm cursor-pointer font-medium">
                                  📌 使用固定分類 (電話費、水費、電費等)
                                </label>
                              </div>
                              
                              {useFixedCategory ? (
                                <div className="space-y-2">
                                  <Select 
                                    onValueChange={(value) => {
                                      setSelectedFixedCategory(parseInt(value));
                                    }} 
                                    value={selectedFixedCategory?.toString() || ""}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="選擇固定分類" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(fixedCategories as any[]).map((category: any) => (
                                        <SelectItem key={category.id} value={category.id.toString()}>
                                          {category.categoryName} ({category.categoryType})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  
                                  {selectedFixedCategory && (fixedSubOptions as any[]).length > 0 && (
                                    <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="選擇具體項目" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(fixedSubOptions as any[]).map((option: any) => (
                                          <SelectItem key={option.id} value={option.id.toString()}>
                                            {option.subOptionName} - {option.displayName}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              ) : (
                                <Select 
                                  onValueChange={(value) => field.onChange(parseInt(value))}
                                  value={field.value?.toString()}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="選擇分類" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories
                                      .filter((category: any) => category.id && category.categoryName && category.id.toString().trim() !== '')
                                      .map((category: any) => (
                                        <SelectItem key={category.id} value={category.id.toString()}>
                                          {category.categoryName}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={itemForm.control}
                      name="itemName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>項目名稱 *</FormLabel>
                          <FormControl>
                            <Input placeholder="輸入項目名稱" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={itemForm.control}
                        name="totalAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>總金額 *</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="0.00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={itemForm.control}
                        name="paymentType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>付款類型</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="選擇付款類型" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="single">單次付款</SelectItem>
                                <SelectItem value="recurring">定期付款</SelectItem>
                                <SelectItem value="installment">分期付款</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={itemForm.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>開始日期 *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={itemForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>備註</FormLabel>
                          <FormControl>
                            <Textarea placeholder="項目備註（選填）" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="submit" disabled={createItemMutation.isPending}>
                        {createItemMutation.isPending ? "建立中..." : "建立項目"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 主要內容區域 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="analysis">月度分析</TabsTrigger>
            <TabsTrigger value="projects">專案管理</TabsTrigger>
            <TabsTrigger value="trends">趨勢報告</TabsTrigger>
          </TabsList>

          {/* 月度分析標籤 */}
          <TabsContent value="analysis" className="space-y-6">
            {/* 月份選擇器 */}
            <Card>
              <CardHeader>
                <CardTitle>分析設定</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>年</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map(month => (
                          <SelectItem key={month} value={month.toString()}>{month}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>月</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 月度統計卡片 */}
            {monthlyAnalysis && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">本月應付款</CardTitle>
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">NT$ {parseInt(monthlyAnalysis.currentMonth?.due?.totalAmount || "0").toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">{monthlyAnalysis.currentMonth?.due?.count || 0} 項目</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">已付款</CardTitle>
                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">NT$ {parseInt(monthlyAnalysis.currentMonth?.paid?.totalAmount || "0").toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">{monthlyAnalysis.currentMonth?.paid?.count || 0} 項目</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">待付款</CardTitle>
                    <ClockIcon className="h-4 w-4 text-yellow-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">NT$ {parseInt(monthlyAnalysis.currentMonth?.pending?.totalAmount || "0").toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">{monthlyAnalysis.currentMonth?.pending?.count || 0} 項目</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">逾期</CardTitle>
                    <AlertTriangleIcon className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">NT$ {parseInt(monthlyAnalysis.currentMonth?.overdue?.totalAmount || "0").toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">{monthlyAnalysis.currentMonth?.overdue?.count || 0} 項目</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 月度項目列表 */}
            {monthlyAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle>本月付款項目</CardTitle>
                  <CardDescription>
                    {selectedYear}年{selectedMonth}月的付款項目明細
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      ...(monthlyAnalysis.currentMonth?.due?.items || []), 
                      ...(monthlyAnalysis.currentMonth?.pending?.items || []), 
                      ...(monthlyAnalysis.currentMonth?.overdue?.items || [])
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-medium">{item.itemName}</span>
                            {getStatusBadge(item.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.projectName} • {item.categoryName} • NT$ {parseInt(item.totalAmount).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 專案管理標籤 */}
          <TabsContent value="projects" className="space-y-6">
            {/* 專案統計 */}
            {projectStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">總計畫金額</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">NT$ {parseInt(projectStats.totalPlanned || "0").toLocaleString()}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">已付款金額</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">NT$ {parseInt(projectStats.totalPaid || "0").toLocaleString()}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">待付款項目</CardTitle>
                    <Clock className="h-4 w-4 text-yellow-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{projectStats.pendingItems || 0}</div>
                    <p className="text-xs text-muted-foreground">項目</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">逾期項目</CardTitle>
                    <AlertTriangleIcon className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{projectStats.overdueItems || 0}</div>
                    <p className="text-xs text-muted-foreground">項目</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 專案篩選 */}
            <Card>
              <CardHeader>
                <CardTitle>專案篩選</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="選擇專案" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有專案</SelectItem>
                    {projects
                      .filter(project => project.id && project.projectName && project.id.toString().trim() !== '')
                      .map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.projectName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* 付款項目列表 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>付款項目</CardTitle>
                    <CardDescription>
                      {selectedProject === "all" ? "所有專案" : projects.find(p => p.id.toString() === selectedProject)?.projectName} 的付款項目
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="搜尋付款項目..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeletedItems(!showDeletedItems)}
                    >
                      {showDeletedItems ? "隱藏已刪除" : "顯示已刪除"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredItems.map((item) => (
                    <div key={item.id} className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 ${item.isDeleted ? 'opacity-50 border-dashed' : ''}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-medium">{item.itemName}</span>
                          {getStatusBadge(item.status)}
                          <Badge variant="outline">
                            優先級 {item.priority}
                          </Badge>
                          {item.isDeleted && (
                            <Badge variant="outline" className="text-xs text-destructive">已刪除</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.projectName} • {item.categoryName} • 
                          NT$ {parseInt(item.totalAmount).toLocaleString()} 
                          (已付: NT$ {parseInt(item.paidAmount).toLocaleString()})
                          {item.notes && <span> • {item.notes}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewAuditHistory(item.id)}
                        >
                          <History className="w-4 h-4 mr-1" />
                          歷史
                        </Button>
                        {item.isDeleted ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestoreItem(item.id)}
                            className="text-green-600"
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            恢復
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditItem(item)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              編輯
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-destructive">
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  刪除
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>確認刪除</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    您確定要刪除「{item.itemName}」嗎？此操作可以稍後恢復。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    確認刪除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredItems.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>此專案暫無付款項目</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 趨勢報告標籤 */}
          <TabsContent value="trends" className="space-y-6">
            {monthlyAnalysis?.trends && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 月度趨勢圖 */}
                <Card>
                  <CardHeader>
                    <CardTitle>月度付款趨勢</CardTitle>
                    <CardDescription>計畫金額 vs 實際付款</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthlyAnalysis.trends?.monthly || []}>
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`NT$ ${Number(value).toLocaleString()}`, '']} />
                        <Bar dataKey="planned" fill="#8884d8" name="計畫" />
                        <Bar dataKey="paid" fill="#82ca9d" name="已付" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* 分類分布圓餅圖 */}
                <Card>
                  <CardHeader>
                    <CardTitle>分類分布</CardTitle>
                    <CardDescription>付款金額按分類分布</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={monthlyAnalysis.trends?.categories || []}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="amount"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {(monthlyAnalysis.trends?.categories || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`NT$ ${Number(value).toLocaleString()}`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}
            {!monthlyAnalysis?.trends && (
              <Card>
                <CardContent className="text-center py-8">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">暫無趨勢數據</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* 審計歷史對話框 */}
        <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
          <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
              <DialogTitle>修改歷史記錄</DialogTitle>
              <DialogDescription>
                查看付款項目的所有變更歷史
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[500px] overflow-y-auto">
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>暫無修改記錄</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <Card key={log.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            log.action === "INSERT" ? "default" :
                            log.action === "UPDATE" ? "secondary" :
                            log.action === "DELETE" ? "destructive" : "outline"
                          }>
                            {log.action === "INSERT" ? "新增" :
                             log.action === "UPDATE" ? "更新" :
                             log.action === "DELETE" ? "刪除" : "恢復"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {log.userInfo || "系統"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString('zh-TW')}
                        </span>
                      </div>
                      
                      {log.changeReason && (
                        <div className="mb-2 text-sm">
                          <strong>原因：</strong> {log.changeReason}
                        </div>
                      )}
                      
                      {log.changedFields && log.changedFields.length > 0 && (
                        <div className="text-sm">
                          <strong>變更欄位：</strong> {log.changedFields.join(", ")}
                        </div>
                      )}
                      
                      {(log.oldValues || log.newValues) && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {log.oldValues && (
                            <div>
                              <div className="font-medium text-red-600 mb-1">變更前：</div>
                              <pre className="bg-red-50 p-2 rounded text-red-800 overflow-x-auto">
                                {JSON.stringify(log.oldValues, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.newValues && (
                            <div>
                              <div className="font-medium text-green-600 mb-1">變更後：</div>
                              <pre className="bg-green-50 p-2 rounded text-green-800 overflow-x-auto">
                                {JSON.stringify(log.newValues, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAuditDialogOpen(false)}>
                關閉
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    
  );
}