import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CalendarIcon, Plus, Search, Filter, Edit2, Trash2, AlertCircle, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const paymentItemSchema = z.object({
  categoryId: z.number().optional(),
  fixedCategoryId: z.number().optional(),
  fixedSubOptionId: z.number().optional(),
  projectId: z.number().min(1, "請選擇專案"),
  itemName: z.string().min(1, "請輸入項目名稱"),
  totalAmount: z.string().min(1, "請輸入總金額"),
  paymentType: z.enum(["single", "installment"]),
  startDate: z.string().min(1, "請選擇開始日期"),
  endDate: z.string().optional(),
  priority: z.number().min(1).max(5),
  notes: z.string().optional(),
});

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
};

type PaymentProject = {
  id: number;
  projectName: string;
  projectType: string;
  description?: string;
  isActive: boolean;
};

function PaymentProjectEnhancedV2() {
  // 時間導航狀態 - 設置預設值為數據實際存在的年月
  const [selectedYear, setSelectedYear] = useState<number>(2033);
  const [selectedMonth, setSelectedMonth] = useState<number>(5);
  
  // 原有狀態保持不變
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProject, setFilterProject] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [editingItem, setEditingItem] = useState<PaymentItem | null>(null);

  const [useFixedCategory, setUseFixedCategory] = useState(false);
  const [selectedFixedCategory, setSelectedFixedCategory] = useState<number | null>(null);
  const [dialogSelectedProject, setDialogSelectedProject] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { toast } = useToast();

  // 時間導航輔助函數
  const navigateToMonth = (direction: 'prev' | 'next' | 'current') => {
    const currentDate = new Date();
    if (direction === 'current') {
      setSelectedYear(currentDate.getFullYear());
      setSelectedMonth(currentDate.getMonth() + 1);
    } else if (direction === 'prev') {
      if (selectedMonth === 1) {
        setSelectedYear(selectedYear - 1);
        setSelectedMonth(12);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else if (direction === 'next') {
      if (selectedMonth === 12) {
        setSelectedYear(selectedYear + 1);
        setSelectedMonth(1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  // 格式化月份名稱
  const getMonthName = (month: number) => {
    const months = [
      "1月", "2月", "3月", "4月", "5月", "6月",
      "7月", "8月", "9月", "10月", "11月", "12月"
    ];
    return months[month - 1];
  };

  // API 查詢
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/payment/projects"],
    staleTime: 10 * 60 * 1000,
  });

  const { data: paymentItemsData, isLoading } = useQuery({
    queryKey: ["/api/payment/items", selectedProject],
    staleTime: 2 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories/project"],
    staleTime: 10 * 60 * 1000,
  });

  const { data: fixedCategories = [] } = useQuery({
    queryKey: ["/api/fixed-categories"],
    staleTime: 10 * 60 * 1000,
  });

  const { data: fixedSubOptions = [] } = useQuery({
    queryKey: ["/api/fixed-categories/sub-options"],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedFixedCategory) {
        params.append("fixedCategoryId", selectedFixedCategory.toString());
      }
      if (dialogSelectedProject) {
        params.append("projectId", dialogSelectedProject);
      }
      return apiRequest("GET", `/api/fixed-categories/sub-options?${params}`);
    },
    enabled: useFixedCategory && selectedFixedCategory !== null,
    staleTime: 5 * 60 * 1000,
  });

  const paymentItems = paymentItemsData?.items || [];

  const filteredAndSortedItems = useMemo(() => {
    let filtered = paymentItems.filter((item: PaymentItem) => {
      // 時間篩選：根據選定的年月篩選
      const itemDate = new Date(item.startDate);
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      const matchesTimeRange = itemYear === selectedYear && itemMonth === selectedMonth;
      
      const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProject = !filterProject || item.projectName === filterProject;
      const matchesCategory = !filterCategory || item.categoryName === filterCategory;
      const matchesStatus = !filterStatus || item.status === filterStatus;
      const matchesDateRange = (!startDate || item.startDate >= startDate) &&
        (!endDate || item.startDate <= endDate);
      
      return matchesTimeRange && matchesSearch && matchesProject && matchesCategory && 
             matchesStatus && matchesDateRange;
    });

    filtered.sort((a: PaymentItem, b: PaymentItem) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        case "oldest":
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        case "amount":
          return parseFloat(b.totalAmount) - parseFloat(a.totalAmount);
        case "priority":
          return a.priority - b.priority;
        default:
          return 0;
      }
    });

    return filtered;
  }, [paymentItems, searchTerm, filterProject, filterCategory, filterStatus, sortBy, startDate, endDate, selectedYear, selectedMonth]);

  // 月度統計數據
  const monthlyStats = useMemo(() => {
    const currentMonthItems = paymentItems.filter((item: PaymentItem) => {
      const itemDate = new Date(item.startDate);
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      return itemYear === selectedYear && itemMonth === selectedMonth;
    });

    const totalPayable = currentMonthItems.reduce((sum: number, item: PaymentItem) => 
      sum + parseFloat(item.totalAmount || '0'), 0);
    
    const totalPaid = currentMonthItems.reduce((sum: number, item: PaymentItem) => 
      sum + parseFloat(item.paidAmount || '0'), 0);
    
    const pendingItems = currentMonthItems.filter((item: PaymentItem) => item.status === 'pending').length;
    
    const overdueItems = currentMonthItems.filter((item: PaymentItem) => {
      if (item.status !== 'pending') return false;
      const endDate = item.endDate || item.startDate;
      return new Date(endDate) < new Date();
    }).length;

    return {
      totalPayable,
      totalPaid,
      balance: totalPayable - totalPaid,
      pendingItems,
      overdueItems,
      totalItems: currentMonthItems.length
    };
  }, [paymentItems, selectedYear, selectedMonth]);

  const form = useForm({
    resolver: zodResolver(paymentItemSchema),
    defaultValues: {
      categoryId: undefined,
      fixedCategoryId: undefined,
      fixedSubOptionId: undefined,
      projectId: 1,
      itemName: "",
      totalAmount: "",
      paymentType: "single" as const,
      startDate: "",
      endDate: "",
      priority: 3,
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingItem ? `/api/payment/items/${editingItem.id}` : "/api/payment/items";
      const method = editingItem ? "PUT" : "POST";
      return apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsItemDialogOpen(false);
      setEditingItem(null);
      form.reset();
      toast({
        title: editingItem ? "項目更新成功" : "項目創建成功",
        description: editingItem ? "付款項目已成功更新" : "新的付款項目已成功創建",
      });
    },
    onError: (error: any) => {
      toast({
        title: "操作失敗",
        description: error.message || "操作過程中發生錯誤",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/payment/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      toast({
        title: "項目刪除成功",
        description: "付款項目已成功刪除",
      });
    },
    onError: (error: any) => {
      toast({
        title: "刪除失敗",
        description: error.message || "刪除過程中發生錯誤",
        variant: "destructive",
      });
    },
  });

  const handleEditItem = (item: PaymentItem) => {
    setEditingItem(item);
    form.reset({
      categoryId: undefined,
      fixedCategoryId: undefined,
      fixedSubOptionId: undefined,
      projectId: 1,
      itemName: item.itemName,
      totalAmount: item.totalAmount,
      paymentType: (item.paymentType as "single" | "installment") || "single",
      startDate: item.startDate,
      endDate: item.endDate || "",
      priority: item.priority,
      notes: "",
    });
    setIsItemDialogOpen(true);
  };

  const handleDeleteItem = (item: PaymentItem) => {
    if (confirm(`確定要刪除 "${item.itemName}" 嗎？`)) {
      deleteMutation.mutate(item.id);
    }
  };

  const getStatusBadge = (item: PaymentItem) => {
    const statusConfig = {
      paid: { label: "已付", variant: "default" as const },
      pending: { label: "待付", variant: "secondary" as const },
      overdue: { label: "逾期", variant: "destructive" as const },
      unpaid: { label: "未付", variant: "outline" as const },
    };

    const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.unpaid;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: number) => {
    const priorityConfig = {
      1: { label: "很高", variant: "destructive" as const },
      2: { label: "高", variant: "secondary" as const },
      3: { label: "中", variant: "outline" as const },
      4: { label: "低", variant: "secondary" as const },
      5: { label: "很低", variant: "outline" as const },
    };

    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig[3];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 時間導航 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Calendar className="h-5 w-5" />
              <CardTitle>時間導航</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToMonth('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center space-x-2 px-3 py-1 bg-primary/10 rounded-md">
                <span className="font-semibold text-lg">
                  {selectedYear}年 {getMonthName(selectedMonth)}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToMonth('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToMonth('current')}
              >
                今月
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 月度統計 */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">應付總額</div>
            <div className="text-2xl font-bold">
              NT$ {monthlyStats.totalPayable.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">已付總額</div>
            <div className="text-2xl font-bold text-green-600">
              NT$ {monthlyStats.totalPaid.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">餘額</div>
            <div className="text-2xl font-bold text-blue-600">
              NT$ {monthlyStats.balance.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">項目總數</div>
            <div className="text-2xl font-bold">{monthlyStats.totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">待付項目</div>
            <div className="text-2xl font-bold text-yellow-600">{monthlyStats.pendingItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">逾期項目</div>
            <div className="text-2xl font-bold text-red-600">{monthlyStats.overdueItems}</div>
          </CardContent>
        </Card>
      </div>

      {/* 主要內容區 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>
                {`${(projects as PaymentProject[]).find((p: PaymentProject) => p.id.toString() === selectedProject)?.projectName || '選定專案'} - ${filteredAndSortedItems.length} 個項目`}
              </CardTitle>
              <CardDescription>
                管理您的付款項目和追蹤付款狀態
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingItem(null);
                    form.reset();
                  }}>
                    <Plus className="mr-2 h-4 w-4" />
                    新增項目
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? "編輯項目" : "新增付款項目"}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="projectId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>專案</FormLabel>
                              <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="選擇專案" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {(projects as PaymentProject[]).map((project: PaymentProject) => (
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
                          control={form.control}
                          name="itemName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>項目名稱</FormLabel>
                              <FormControl>
                                <Input placeholder="輸入項目名稱" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="totalAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>總金額</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="0" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="paymentType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>付款類型</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="選擇付款類型" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="single">一次性付款</SelectItem>
                                  <SelectItem value="installment">分期付款</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>開始日期</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>優先級</FormLabel>
                              <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="選擇優先級" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="1">很高</SelectItem>
                                  <SelectItem value="2">高</SelectItem>
                                  <SelectItem value="3">中</SelectItem>
                                  <SelectItem value="4">低</SelectItem>
                                  <SelectItem value="5">很低</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>備註</FormLabel>
                            <FormControl>
                              <Textarea placeholder="輸入備註（可選）" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)}>
                          取消
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                          {createMutation.isPending ? "處理中..." : editingItem ? "更新" : "創建"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* 篩選區域 */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋項目名稱..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="選擇專案" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有專案</SelectItem>
                {(projects as PaymentProject[]).map((project: PaymentProject) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">最新優先</SelectItem>
                <SelectItem value="oldest">最舊優先</SelectItem>
                <SelectItem value="amount">金額排序</SelectItem>
                <SelectItem value="priority">優先級排序</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 項目列表 */}
          <div className="space-y-4">
            {filteredAndSortedItems.map((item: PaymentItem) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{item.itemName}</h3>
                        {getStatusBadge(item)}
                        {getPriorityBadge(item.priority)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">專案：</span>
                          {item.projectName}
                        </div>
                        <div>
                          <span className="font-medium">金額：</span>
                          NT$ {parseFloat(item.totalAmount).toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">已付：</span>
                          NT$ {parseFloat(item.paidAmount || '0').toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">日期：</span>
                          {new Date(item.startDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditItem(item)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteItem(item)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredAndSortedItems.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">沒有找到付款項目</h3>
                <p className="text-muted-foreground mb-4">
                  目前選定的時間範圍內沒有付款項目，請嘗試調整時間或篩選條件。
                </p>
                <Button onClick={() => navigateToMonth('current')}>
                  <Calendar className="mr-2 h-4 w-4" />
                  回到當前月份
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentProjectEnhancedV2Page() {
  return <PaymentProjectEnhancedV2 />;
}