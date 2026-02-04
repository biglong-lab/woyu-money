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

function PaymentProjectEnhanced() {
  // 時間導航狀態
  const currentDate = new Date();
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
  const [includeRentalItems, setIncludeRentalItems] = useState(true);

  const [useFixedCategory, setUseFixedCategory] = useState(false);
  const [selectedFixedCategory, setSelectedFixedCategory] = useState<number | null>(null);
  const [dialogSelectedProject, setDialogSelectedProject] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { toast } = useToast();

  // 時間導航輔助函數
  const navigateToMonth = (direction: 'prev' | 'next' | 'current') => {
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

  // 生成年份選項
  const yearOptions = Array.from({ length: 10 }, (_, i) => currentDate.getFullYear() - 5 + i);
  
  // 月份名稱
  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/payment/projects"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: paymentItemsResponse, isLoading: itemsLoading } = useQuery({
    queryKey: ["/api/payment/items", selectedProject, selectedYear, selectedMonth],
    staleTime: 2 * 60 * 1000,
  });

  const paymentItems = Array.isArray(paymentItemsResponse) 
    ? paymentItemsResponse 
    : ((paymentItemsResponse as any)?.items || []);

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories/project"],
    staleTime: 10 * 60 * 1000,
  });

  const filteredAndSortedItems = useMemo(() => {
    let filtered = paymentItems.filter((item: PaymentItem) => {
      // 時間篩選：檢查項目名稱或實際日期
      const itemDate = new Date(item.startDate);
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth() + 1;
      
      // 檢查項目名稱是否包含目標年月格式
      const yearMonthStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
      const nameContainsYearMonth = item.itemName.includes(yearMonthStr);
      
      // 如果項目名稱包含年月或實際日期匹配，則通過時間篩選
      const matchesTimeRange = nameContainsYearMonth || (itemYear === selectedYear && itemMonth === selectedMonth);
      
      const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProject = !filterProject || item.projectName === filterProject;
      const matchesCategory = !filterCategory || item.categoryName === filterCategory;
      const matchesStatus = !filterStatus || item.status === filterStatus;
      const matchesDateRange = (!startDate || item.startDate >= startDate) &&
        (!endDate || item.startDate <= endDate);
      
      // 租約項目篩選控制
      const isRentalItem = item.itemName.includes('租約') || 
                          item.itemName.includes('租金') || 
                          item.categoryName === '租金' ||
                          (item as any).projectType === 'rental';
      const includeItem = includeRentalItems || !isRentalItem;
      
      return includeItem && matchesTimeRange && matchesSearch && matchesProject && matchesCategory && 
             matchesStatus && matchesDateRange;
    });



    filtered.sort((a: PaymentItem, b: PaymentItem) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        case "oldest":
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        case "amount-high":
          return parseFloat(b.totalAmount) - parseFloat(a.totalAmount);
        case "amount-low":
          return parseFloat(a.totalAmount) - parseFloat(b.totalAmount);
        case "priority":
          return b.priority - a.priority;
        default:
          return 0;
      }
    });

    return filtered;
  }, [paymentItems, searchTerm, filterProject, filterCategory, filterStatus, 
      startDate, endDate, sortBy, selectedYear, selectedMonth]);

  // 月份統計數據
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
      pendingItems,
      overdueItems,
      totalItems: currentMonthItems.length
    };
  }, [paymentItems, selectedYear, selectedMonth]);

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterProject(null);
    setFilterCategory(null);
    setFilterStatus(null);
    setStartDate("");
    setEndDate("");
    setSortBy("newest");
  };

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

  const createItemMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        ...data,
        categoryId: useFixedCategory ? null : data.categoryId || null,
        fixedCategoryId: useFixedCategory ? selectedFixedCategory : null,
        fixedSubOptionId: useFixedCategory ? data.fixedSubOptionId || null : null,
      };
      return apiRequest("/api/payment/items", "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items", selectedProject] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project/stats"] });
      setIsItemDialogOpen(false);
      setDialogSelectedProject(null);
      setSelectedFixedCategory(null);
      setUseFixedCategory(false);
      itemForm.reset();
      toast({
        title: "付款項目創建成功",
        description: "新的付款項目已成功創建",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => {
      const payload = {
        ...data,
        categoryId: useFixedCategory ? null : data.categoryId || null,
        fixedCategoryId: useFixedCategory ? selectedFixedCategory : null,
        fixedSubOptionId: useFixedCategory ? data.fixedSubOptionId || null : null,
      };
      return apiRequest(`/api/payment/items/${id}`, "PATCH", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items", selectedProject] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project/stats"] });
      setIsItemDialogOpen(false);
      setEditingItem(null);
      setDialogSelectedProject(null);
      setSelectedFixedCategory(null);
      setUseFixedCategory(false);
      itemForm.reset();
      toast({
        title: "付款項目更新成功",
        description: "項目信息已成功更新",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/payment/items/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project/stats"] });
      toast({
        title: "項目已刪除",
        description: "付款項目已永久刪除",
      });
    },
  });

  const handleEditItem = (item: PaymentItem) => {
    setEditingItem(item);
    setIsItemDialogOpen(true);
  };

  const handleDeleteItem = (item: PaymentItem) => {
    if (confirm("確定要刪除此項目嗎？此操作無法撤銷。")) {
      deleteItemMutation.mutate(item.id);
    }
  };

  const getStatusBadge = (item: PaymentItem) => {
    const statusMap = {
      pending: { label: "待付款", variant: "destructive" as const },
      partial: { label: "部分付款", variant: "secondary" as const },
      completed: { label: "已完成", variant: "default" as const },
    };
    const status = statusMap[item.status as keyof typeof statusMap] || 
      { label: item.status, variant: "outline" as const };
    return <Badge variant={status.variant}>{status.label}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">付款專案管理 - 增強版</h1>
          <p className="text-gray-600 mt-1">
            {selectedProject === "all" ? 
              `所有專案 - ${filteredAndSortedItems.length} 個項目` :
              `${(projects as PaymentProject[]).find((p: PaymentProject) => p.id.toString() === selectedProject)?.projectName || '選定專案'} - ${filteredAndSortedItems.length} 個項目`}
          </p>
        </div>
        <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新增項目
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "編輯付款項目" : "新增付款項目"}
              </DialogTitle>
            </DialogHeader>
            <Form {...itemForm}>
              <form onSubmit={itemForm.handleSubmit((data: any) => {
                if (editingItem) {
                  updateItemMutation.mutate({ id: editingItem.id, data });
                } else {
                  createItemMutation.mutate(data);
                }
              })} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={itemForm.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>專案</FormLabel>
                        <Select
                          value={field.value?.toString() || ""}
                          onValueChange={(value) => {
                            field.onChange(parseInt(value));
                            setDialogSelectedProject(value);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="選擇專案" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(projects as PaymentProject[]).map((project) => (
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={itemForm.control}
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
                    control={itemForm.control}
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
                            <SelectItem value="single">一次性</SelectItem>
                            <SelectItem value="installment">分期付款</SelectItem>
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
                    control={itemForm.control}
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
                            <SelectItem value="1">低</SelectItem>
                            <SelectItem value="2">普通</SelectItem>
                            <SelectItem value="3">中等</SelectItem>
                            <SelectItem value="4">高</SelectItem>
                            <SelectItem value="5">緊急</SelectItem>
                          </SelectContent>
                        </Select>
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
                        <Textarea placeholder="輸入備註..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsItemDialogOpen(false);
                      setEditingItem(null);
                      setDialogSelectedProject(null);
                      setSelectedFixedCategory(null);
                      setUseFixedCategory(false);
                      itemForm.reset();
                    }}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={createItemMutation.isPending || updateItemMutation.isPending}>
                    {editingItem ? "更新" : "創建"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 年份+月份時間導航 */}
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Calendar className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">時間導航</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToMonth('prev')}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                上月
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToMonth('current')}
                className="gap-1"
              >
                當月
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToMonth('next')}
                className="gap-1"
              >
                下月
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">年份:</label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">月份:</label>
              <div className="flex gap-1">
                {monthNames.map((month, index) => (
                  <Button
                    key={index + 1}
                    variant={selectedMonth === index + 1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedMonth(index + 1)}
                    className="min-w-12"
                  >
                    {index + 1}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeRental"
                checked={includeRentalItems}
                onChange={(e) => setIncludeRentalItems(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="includeRental" className="text-sm font-medium text-gray-700">
                包含租約項目
              </label>
            </div>
            <div className="text-sm text-gray-500">
              當前顯示 {filteredAndSortedItems.length} / {paymentItems.length} 個項目
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 月份統計總覽 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">當月應付總額</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${monthlyStats.totalPayable.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">當月已付總額</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${monthlyStats.totalPaid.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">待付項目</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {monthlyStats.pendingItems}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">逾期項目</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {monthlyStats.overdueItems}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">總項目數</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-700">
              {monthlyStats.totalItems}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 篩選控制區 */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="搜尋項目名稱..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="選擇專案" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有專案</SelectItem>
              {(projects as PaymentProject[]).map((project) => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus || "all"} onValueChange={(value) => setFilterStatus(value === "all" ? null : value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有狀態</SelectItem>
              <SelectItem value="pending">待付款</SelectItem>
              <SelectItem value="partial">部分付款</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="排序" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">最新</SelectItem>
              <SelectItem value="oldest">最舊</SelectItem>
              <SelectItem value="amount-high">金額高到低</SelectItem>
              <SelectItem value="amount-low">金額低到高</SelectItem>
              <SelectItem value="priority">優先級</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={clearAllFilters}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            清除篩選
          </Button>
        </div>
      </div>

      {/* 項目列表 */}
      <div className="grid gap-4">
        {filteredAndSortedItems.map((item: PaymentItem) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold">{item.itemName}</h3>
                    {getStatusBadge(item)}
                    <Badge variant="outline" className="text-xs">
                      優先級 {item.priority}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">總金額:</span>
                      <div className="text-lg font-bold text-blue-600">
                        ${parseFloat(item.totalAmount).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">已付金額:</span>
                      <div className="text-lg font-bold text-green-600">
                        ${parseFloat(item.paidAmount).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">開始日期:</span>
                      <div>{item.startDate}</div>
                    </div>
                    <div>
                      <span className="font-medium">專案:</span>
                      <div>{item.projectName}</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
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
      </div>

      {itemsLoading && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">載入付款項目中</h3>
            <p className="text-gray-600">請稍候...</p>
          </CardContent>
        </Card>
      )}

      {!itemsLoading && filteredAndSortedItems.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">沒有找到付款項目</h3>
            <p className="text-gray-600 mb-4">
              {selectedYear && selectedMonth ? 
                `${selectedYear}年${selectedMonth}月沒有符合條件的項目，請嘗試調整篩選條件` :
                "嘗試調整篩選條件或新增項目"
              }
            </p>
            <p className="text-sm text-gray-500 mb-4">
              載入了 {paymentItems.length} 個項目，篩選後顯示 {filteredAndSortedItems.length} 個
            </p>
            <Button onClick={clearAllFilters}>清除篩選條件</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PaymentProjectEnhancedPage() {
  return <PaymentProjectEnhanced />;
}