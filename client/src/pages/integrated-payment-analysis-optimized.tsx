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
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  CalendarIcon, AlertTriangleIcon, CheckCircleIcon, ClockIcon, CreditCard, 
  Plus, Building2, BarChart3, TrendingUp, DollarSign, AlertCircle, 
  CheckCircle2, Clock, Search, Filter, ChevronLeft, ChevronRight,
  Edit, Trash2, RotateCcw, History, Eye, PieChart as PieChartIcon,
  Target, Activity, Calendar
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

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  partial: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", 
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
};

const statusIcons = {
  pending: Clock,
  partial: AlertCircle,
  paid: CheckCircle2,
  overdue: AlertCircle
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function IntegratedPaymentAnalysisOptimized() {
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

  // 資料查詢 - 獲取所有數據用於完整分析
  const { data: paymentItems = [] } = useQuery({
    queryKey: [`/api/payment/items?includeDeleted=${showDeletedItems}&includeAll=true`],
  });

  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories/project"],
  });

  // Mutations
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

  // 篩選付款項目
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
    
    // 已付金額計算：優先使用 paidAmount，若無則根據 status 判斷
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
      
      // 使用與主要統計相同的已付金額計算邏輯
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
      completionRate: data.planned > 0 ? (data.paid / data.planned * 100) : 0
    }));
  }, [filteredItems]);

  // 表單提交處理
  const handleSubmit = (data: any) => {
    const formData = {
      ...data,
      categoryId: parseInt(data.categoryId.toString()),
      projectId: parseInt(data.projectId.toString()),
      installmentCount: data.paymentType === 'installment' ? parseInt(data.installmentCount?.toString() || '1') : null,
    };

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
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="選擇專案類型" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">一般</SelectItem>
                                <SelectItem value="business">商業</SelectItem>
                                <SelectItem value="personal">個人</SelectItem>
                                <SelectItem value="investment">投資</SelectItem>
                              </SelectContent>
                            </Select>
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
                itemForm.reset();
              }
              setIsItemDialogOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingItem(null);
                  itemForm.reset();
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增付款項目
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "編輯付款項目" : "建立付款項目"}</DialogTitle>
                  <DialogDescription>
                    {editingItem ? "編輯現有的付款項目資訊" : "建立新的付款項目並設定相關資訊"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...itemForm}>
                  <form onSubmit={itemForm.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={itemForm.control}
                        name="projectId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>專案 *</FormLabel>
                            <FormControl>
                              <Select 
                                onValueChange={(value) => field.onChange(parseInt(value))}
                                value={field.value?.toString()}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="選擇專案" />
                                </SelectTrigger>
                                <SelectContent>
                                  {projects.map((project) => (
                                    <SelectItem key={project.id} value={project.id.toString()}>
                                      {project.projectName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
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
                            <FormControl>
                              <Select 
                                onValueChange={(value) => field.onChange(parseInt(value))}
                                value={field.value?.toString()}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="選擇分類" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((category: any) => (
                                    <SelectItem key={category.id} value={category.id.toString()}>
                                      {category.categoryName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
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

                    <FormField
                      control={itemForm.control}
                      name="totalAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>總金額 *</FormLabel>
                          <FormControl>
                            <Input placeholder="輸入總金額" {...field} />
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
                            <FormLabel>付款類型 *</FormLabel>
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                  <SelectValue placeholder="選擇付款類型" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="single">一次性付款</SelectItem>
                                  <SelectItem value="recurring">定期付款</SelectItem>
                                  <SelectItem value="installment">分期付款</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
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
                            <FormControl>
                              <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                                <SelectTrigger>
                                  <SelectValue placeholder="選擇優先級" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">高</SelectItem>
                                  <SelectItem value="2">中</SelectItem>
                                  <SelectItem value="3">低</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>結束日期</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={itemForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>備註</FormLabel>
                          <FormControl>
                            <Textarea placeholder="輸入備註資訊（選填）" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="submit" disabled={createItemMutation.isPending || updateItemMutation.isPending}>
                        {createItemMutation.isPending || updateItemMutation.isPending 
                          ? "處理中..." 
                          : editingItem ? "更新項目" : "建立項目"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 關鍵指標卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">總計劃金額</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                NT$ {keyMetrics.totalPlanned.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                共 {keyMetrics.totalItems} 項目
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已付金額</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                NT$ {keyMetrics.totalPaid.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                完成率 {keyMetrics.completionRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待付金額</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                NT$ {keyMetrics.totalPending.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {keyMetrics.pendingItems} 項待付款
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">逾期項目</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {keyMetrics.overdueItems}
              </div>
              <p className="text-xs text-muted-foreground">
                需要立即處理
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 增強的篩選面板 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              篩選和搜尋
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">搜尋關鍵字</Label>
                <Input
                  id="search"
                  placeholder="項目名稱、專案、分類..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="project">專案篩選</Label>
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
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">狀態篩選</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有狀態</SelectItem>
                    <SelectItem value="pending">待付款</SelectItem>
                    <SelectItem value="partial">部分付款</SelectItem>
                    <SelectItem value="paid">已付款</SelectItem>
                    <SelectItem value="overdue">逾期</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="range">日期範圍</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇範圍" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_month">本月</SelectItem>
                    <SelectItem value="last_month">上月</SelectItem>
                    <SelectItem value="quarter">本季</SelectItem>
                    <SelectItem value="year">本年</SelectItem>
                    <SelectItem value="all">全部</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showDeleted"
                    checked={showDeletedItems}
                    onCheckedChange={(checked) => setShowDeletedItems(!!checked)}
                  />
                  <Label htmlFor="showDeleted" className="text-sm">顯示已刪除項目</Label>
                </div>
                
                {selectedItems.length > 0 && (
                  <Badge variant="secondary">
                    已選擇 {selectedItems.length} 項
                  </Badge>
                )}
              </div>
              
              <div className="flex gap-2">
                {searchTerm || selectedProject !== "all" || selectedStatus !== "all" ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedProject("all");
                      setSelectedStatus("all");
                      setDateRange("current_month");
                    }}
                  >
                    清除篩選
                  </Button>
                ) : null}
                
                {selectedItems.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowBatchActions(!showBatchActions)}
                  >
                    批量操作
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 標籤選擇 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard">儀表板</TabsTrigger>
            <TabsTrigger value="projects">專案分析</TabsTrigger>
            <TabsTrigger value="management">項目管理</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 專案進度圖表 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    專案完成進度
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={projectBreakdown}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => [
                          `NT$ ${Number(value).toLocaleString()}`,
                          name === 'paid' ? '已付' : '計劃'
                        ]}
                      />
                      <Bar dataKey="planned" fill="#e5e7eb" name="planned" />
                      <Bar dataKey="paid" fill="#10b981" name="paid" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 狀態分布圓餅圖 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    付款狀態分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: '已付款', value: keyMetrics.paidItems, fill: '#10b981' },
                          { name: '待付款', value: keyMetrics.pendingItems, fill: '#f59e0b' },
                          { name: '逾期', value: keyMetrics.overdueItems, fill: '#ef4444' }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {[
                          { name: '已付款', value: keyMetrics.paidItems, fill: '#10b981' },
                          { name: '待付款', value: keyMetrics.pendingItems, fill: '#f59e0b' },
                          { name: '逾期', value: keyMetrics.overdueItems, fill: '#ef4444' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <div className="grid gap-4">
              {projectBreakdown.map((project, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <Badge variant={project.completionRate > 80 ? "default" : project.completionRate > 50 ? "secondary" : "destructive"}>
                        {project.completionRate.toFixed(1)}% 完成
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">計劃金額</p>
                        <p className="text-xl font-bold">NT$ {project.planned.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">已付金額</p>
                        <p className="text-xl font-bold text-green-600">NT$ {project.paid.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">項目數量</p>
                        <p className="text-xl font-bold">{project.count} 項</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${Math.min(project.completionRate, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="management" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>付款項目列表</CardTitle>
                <CardDescription>
                  顯示 {filteredItems.length} 項結果，共 {paymentItems.length} 項記錄
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium">{item.itemName}</h3>
                          {getStatusBadge(item.status)}
                          {item.isDeleted && (
                            <Badge variant="destructive">已刪除</Badge>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          <span>{item.projectName} • {item.categoryName}</span>
                          <span className="ml-4">NT$ {parseFloat(item.paidAmount || "0").toLocaleString()} / {parseFloat(item.totalAmount).toLocaleString()}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.startDate} {item.endDate && `- ${item.endDate}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditItem(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>確認刪除</AlertDialogTitle>
                              <AlertDialogDescription>
                                確定要刪除項目「{item.itemName}」嗎？此操作無法撤銷。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteItemMutation.mutate({ id: item.id, reason: "手動刪除項目" })}
                              >
                                確認刪除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                  
                  {filteredItems.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>沒有找到符合條件的項目</p>
                      <p className="text-sm">請調整篩選條件或新增付款項目</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}