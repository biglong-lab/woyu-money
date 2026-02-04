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
import { CalendarIcon, Plus, Search, Filter, Edit2, Trash2, AlertCircle, RefreshCw, X, Calendar, FileText, RotateCcw } from "lucide-react";
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

function PaymentProjectContent() {
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

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/payment/projects"],
    staleTime: 5 * 60 * 1000, // 5分鐘緩存
  });

  const { data: paymentItems = [] } = useQuery({
    queryKey: ["/api/payment/items", selectedProject],
    queryFn: () => {
      const params = new URLSearchParams({ type: "project" });
      if (selectedProject && selectedProject !== "all") {
        params.append("projectId", selectedProject);
      }
      return apiRequest(`/api/payment/items?${params}`);
    },
    staleTime: 2 * 60 * 1000, // 2分鐘緩存
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories/project"],
    staleTime: 10 * 60 * 1000, // 10分鐘緩存
  });

  const { data: fixedCategories = [] } = useQuery({
    queryKey: ["/api/fixed-categories"],
    staleTime: 10 * 60 * 1000, // 10分鐘緩存
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
      return apiRequest(`/api/fixed-categories/sub-options?${params}`);
    },
    enabled: useFixedCategory && selectedFixedCategory !== null,
    staleTime: 5 * 60 * 1000,
  });

  const filteredAndSortedItems = useMemo(() => {
    let filtered = paymentItems.filter((item: PaymentItem) => {
      const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProject = !filterProject || item.projectName === filterProject;
      const matchesCategory = !filterCategory || item.categoryName === filterCategory;
      const matchesStatus = !filterStatus || item.status === filterStatus;
      const matchesDateRange = (!startDate || item.startDate >= startDate) &&
        (!endDate || item.startDate <= endDate);
      
      return matchesSearch && matchesProject && matchesCategory && 
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
      startDate, endDate, sortBy]);

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
      startDate: "",
      endDate: "",
      priority: 3,
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
        itemType: "project",
      };
      return apiRequest("/api/payment/items", "POST", payload);
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
          <h1 className="text-3xl font-bold">付款專案管理</h1>
          <p className="text-gray-600 mt-1">
            {selectedProject === "all" ? 
              `所有專案 - ${filteredAndSortedItems.length} 個項目` :
              `${(projects as PaymentProject[]).find((p: PaymentProject) => p.id.toString() === selectedProject)?.projectName || '選定專案'} - ${filteredAndSortedItems.length} 個項目`}
          </p>
        </div>
        <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="mr-2 h-4 w-4" />
              新增付款項目
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "編輯付款項目" : "新增付款項目"}
              </DialogTitle>
            </DialogHeader>
            <Form {...itemForm}>
              <form onSubmit={itemForm.handleSubmit((data) => {
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

                <div className="flex items-center space-x-2 mb-4">
                  <Switch
                    checked={useFixedCategory}
                    onCheckedChange={(checked) => {
                      setUseFixedCategory(checked);
                      setSelectedFixedCategory(null);
                      if (!checked) {
                        itemForm.setValue("categoryId", 0);
                      }
                    }}
                  />
                  <label className="text-sm font-medium">使用固定分類</label>
                </div>

                {useFixedCategory ? (
                  <div className="space-y-4">
                    <FormField
                      control={itemForm.control}
                      name="fixedCategoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>固定分類</FormLabel>
                          <Select
                            value={selectedFixedCategory?.toString() || ""}
                            onValueChange={(value) => {
                              const categoryId = parseInt(value);
                              setSelectedFixedCategory(categoryId);
                              field.onChange(categoryId);
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="選擇固定分類" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(fixedCategories as any[]).map((category) => (
                                <SelectItem key={category.id} value={category.id.toString()}>
                                  {category.categoryName} ({category.categoryType})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedFixedCategory && (
                      <FormField
                        control={itemForm.control}
                        name="fixedSubOptionId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>子選項</FormLabel>
                            <Select
                              value={field.value?.toString() || ""}
                              onValueChange={(value) => field.onChange(parseInt(value))}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="選擇子選項" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(fixedSubOptions as any[]).map((option) => (
                                  <SelectItem key={option.id} value={option.id.toString()}>
                                    {option.displayName || option.subOptionName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                ) : (
                  <FormField
                    control={itemForm.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>傳統分類</FormLabel>
                        <Select
                          value={field.value?.toString() || ""}
                          onValueChange={(value) => field.onChange(parseInt(value))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="選擇分類" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(categories as any[]).map((category) => (
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
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={itemForm.control}
                    name="totalAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>總金額</FormLabel>
                        <FormControl>
                          <Input placeholder="0.00" {...field} />
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
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
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
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>優先級 (1-5)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={5} 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
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
                        <Textarea placeholder="輸入備註..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsItemDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    disabled={createItemMutation.isPending || updateItemMutation.isPending}
                  >
                    {createItemMutation.isPending || updateItemMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        處理中...
                      </>
                    ) : (
                      editingItem ? "更新項目" : "創建項目"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">搜尋與篩選</h2>
              <Button variant="outline" size="sm" onClick={clearAllFilters}>
                <X className="mr-2 h-4 w-4" />
                清除篩選
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="搜尋項目名稱..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
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

              <Select value={filterCategory || ""} onValueChange={(value) => setFilterCategory(value || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="篩選分類" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">所有分類</SelectItem>
                  {Array.from(new Set(paymentItems.map((item: PaymentItem) => item.categoryName).filter(Boolean))).map((category) => (
                    <SelectItem key={category} value={category as string}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus || ""} onValueChange={(value) => setFilterStatus(value || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="篩選狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">所有狀態</SelectItem>
                  <SelectItem value="pending">待付款</SelectItem>
                  <SelectItem value="partial">部分付款</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">最新優先</SelectItem>
                  <SelectItem value="oldest">最舊優先</SelectItem>
                  <SelectItem value="amount-high">金額高到低</SelectItem>
                  <SelectItem value="amount-low">金額低到高</SelectItem>
                  <SelectItem value="priority">優先級排序</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex space-x-2">
                <Input
                  type="date"
                  placeholder="開始日期"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="date"
                  placeholder="結束日期"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {filteredAndSortedItems.map((item: PaymentItem) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{item.itemName}</h3>
                    {getStatusBadge(item)}
                    <Badge variant="outline">優先級 {item.priority}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
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
                  {item.categoryName && (
                    <div className="mt-2">
                      <Badge variant="secondary">{item.categoryName}</Badge>
                    </div>
                  )}
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

      {filteredAndSortedItems.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">沒有找到付款項目</h3>
            <p className="text-gray-600 mb-4">嘗試調整篩選條件或新增項目</p>
            <Button onClick={clearAllFilters}>清除篩選條件</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PaymentProject() {
  return <PaymentProjectContent />;
}