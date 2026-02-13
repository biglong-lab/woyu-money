import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { 
  Building2, CreditCard, DollarSign, Calendar, 
  TrendingUp, Clock, Target
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PaymentProject, DebtCategory } from "@shared/schema";


// 類型定義
type SubcategoryStatus = {
  subcategoryId: number;
  subcategoryName: string;
  currentMonth: {
    totalDue: string;
    totalPaid: string;
    unpaidItems: number;
  };
  accumulated: {
    totalUnpaid: string;
    overdueItems: number;
  };
  installments: {
    totalInstallments: number;
    completedInstallments: number;
    nextDueDate?: string;
  };
  remainingAmount: string;
};

// 子分類付款表單 Schema
const subcategoryPaymentSchema = z.object({
  subcategoryId: z.number().min(1, "請選擇子分類"),
  amount: z.string().min(1, "付款金額為必填"),
  paymentDate: z.string().min(1, "付款日期為必填"),
  userInfo: z.string().optional(),
});

type SubcategoryPaymentFormData = z.infer<typeof subcategoryPaymentSchema>;

interface ProcessPaymentResult {
  allocatedPayments: unknown[];
  remainingAmount: string;
}

export default function ProjectSubcategoryManagement() {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedParentCategory, setSelectedParentCategory] = useState<number | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null);
  const { toast } = useToast();

  // 表單設定
  const paymentForm = useForm<SubcategoryPaymentFormData>({
    resolver: zodResolver(subcategoryPaymentSchema),
    defaultValues: {
      subcategoryId: 0,
      amount: "",
      paymentDate: new Date().toISOString().split('T')[0],
      userInfo: "系統管理員",
    },
  });

  // 資料查詢
  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
    queryFn: () => apiRequest("GET", "/api/payment/projects"),
  });

  const { data: categories = [] } = useQuery<DebtCategory[]>({
    queryKey: ["/api/categories/project"],
    queryFn: () => apiRequest("GET", "/api/categories/project"),
  });

  const { data: subcategoryStatuses = [] } = useQuery<SubcategoryStatus[]>({
    queryKey: ["/api/subcategory/status", selectedParentCategory, selectedProject],
    queryFn: () =>
      selectedParentCategory
        ? apiRequest("GET", `/api/subcategory/status/${selectedParentCategory}${selectedProject ? `?projectId=${selectedProject}` : ''}`)
        : Promise.resolve([]),
    enabled: !!selectedParentCategory,
  });

  // 子分類付款處理
  const processPaymentMutation = useMutation<ProcessPaymentResult, Error, SubcategoryPaymentFormData>({
    mutationFn: async (data) => {
      const response = await apiRequest("POST", "/api/subcategory/process-payment", data);
      return response as ProcessPaymentResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subcategory/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsPaymentDialogOpen(false);
      paymentForm.reset();
      
      // 顯示分配結果
      const allocatedCount = result.allocatedPayments.length;
      const remainingAmount = parseFloat(result.remainingAmount);
      
      toast({
        title: "付款處理完成",
        description: `成功分配到 ${allocatedCount} 個項目${remainingAmount > 0 ? `，剩餘金額：NT$ ${remainingAmount.toLocaleString()}` : ''}`,
      });
    },
    onError: (error) => {
      toast({
        title: "付款處理失敗",
        description: error.message || "處理付款時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // 獲取主分類（父分類）
  const parentCategories = categories.filter(cat => !cat.isDeleted);

  // 處理付款提交
  const handlePaymentSubmit = (data: SubcategoryPaymentFormData) => {
    const submitData = {
      ...data,
      subcategoryId: selectedSubcategory || 0,
    };
    processPaymentMutation.mutate(submitData);
  };

  // 計算進度百分比
  const calculateProgress = (paid: string, total: string) => {
    const paidAmount = parseFloat(paid);
    const totalAmount = parseFloat(total);
    if (totalAmount === 0) return 0;
    return Math.min((paidAmount / totalAmount) * 100, 100);
  };

  // 獲取狀態顏色
  const getStatusColor = (status: SubcategoryStatus) => {
    const overdueItems = status.accumulated.overdueItems;
    const unpaidItems = status.currentMonth.unpaidItems;
    
    if (overdueItems > 0) return "border-red-500 bg-red-50";
    if (unpaidItems > 0) return "border-yellow-500 bg-yellow-50";
    return "border-green-500 bg-green-50";
  };

  return (
    
      <div className="space-y-8">
        {/* 頁面標題 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">專案子分類管理</h1>
              <p className="text-lg text-gray-600 mt-1">
                監控和管理各專案下子分類的付款狀況，支援統一付款分配
              </p>
            </div>
            
            {/* 篩選器 */}
            <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-600" />
                <Select value={selectedProject?.toString() || "all"} onValueChange={(value) => setSelectedProject(value === "all" ? null : parseInt(value))}>
                  <SelectTrigger className="w-48">
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
              
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-gray-600" />
                <Select value={selectedParentCategory?.toString() || "none"} onValueChange={(value) => setSelectedParentCategory(value === "none" ? null : parseInt(value))}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="選擇主分類" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">選擇主分類</SelectItem>
                    {parentCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* 子分類狀態卡片 */}
        {selectedParentCategory && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subcategoryStatuses.map((status) => (
              <Card key={status.subcategoryId} className={`relative ${getStatusColor(status)}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{status.subcategoryName}</CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSubcategory(status.subcategoryId);
                        paymentForm.setValue('subcategoryId', status.subcategoryId);
                        setIsPaymentDialogOpen(true);
                      }}
                    >
                      <CreditCard className="w-4 h-4 mr-1" />
                      付款
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* 本月狀況 */}
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-sm">本月狀況</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>應付金額：</span>
                        <span className="font-medium">NT$ {parseInt(status.currentMonth.totalDue).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>已付金額：</span>
                        <span className="font-medium text-green-600">NT$ {parseInt(status.currentMonth.totalPaid).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>未付項目：</span>
                        <Badge variant={status.currentMonth.unpaidItems > 0 ? "destructive" : "secondary"}>
                          {status.currentMonth.unpaidItems} 項
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* 累積狀況 */}
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-orange-600" />
                      <span className="font-medium text-sm">累積狀況</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>累積未付：</span>
                        <span className="font-medium text-red-600">NT$ {parseInt(status.accumulated.totalUnpaid).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>逾期項目：</span>
                        <Badge variant={status.accumulated.overdueItems > 0 ? "destructive" : "secondary"}>
                          {status.accumulated.overdueItems} 項
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* 分期狀況 */}
                  {status.installments.totalInstallments > 0 && (
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-purple-600" />
                        <span className="font-medium text-sm">分期狀況</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>總期數：</span>
                          <span className="font-medium">{status.installments.totalInstallments} 期</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>已完成：</span>
                          <span className="font-medium text-green-600">{status.installments.completedInstallments} 期</span>
                        </div>
                        <Progress 
                          value={(status.installments.completedInstallments / status.installments.totalInstallments) * 100} 
                          className="h-2"
                        />
                        {status.installments.nextDueDate && (
                          <div className="flex justify-between text-sm">
                            <span>下次到期：</span>
                            <span className="font-medium">{format(new Date(status.installments.nextDueDate), 'yyyy/MM/dd', { locale: zhTW })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 剩餘金額 */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-sm">剩餘金額</span>
                      </div>
                      <span className="font-bold text-lg text-blue-700">
                        NT$ {parseInt(status.remainingAmount).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 沒有選擇主分類時的提示 */}
        {!selectedParentCategory && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Target className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">選擇主分類開始管理</h3>
              <p className="text-gray-500 text-center max-w-md">
                請先選擇一個主分類，系統將顯示該分類下所有子分類的付款狀況，
                並支援統一付款分配到各個未付項目中。
              </p>
            </CardContent>
          </Card>
        )}

        {/* 子分類付款對話框 */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>子分類統一付款</DialogTitle>
              <DialogDescription>
                輸入付款金額，系統將自動按優先順序分配到該子分類的未付項目中
              </DialogDescription>
            </DialogHeader>
            
            <Form {...paymentForm}>
              <form onSubmit={paymentForm.handleSubmit(handlePaymentSubmit)} className="space-y-4">
                <FormField
                  control={paymentForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>付款金額 *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="請輸入付款金額" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={paymentForm.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>付款日期 *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={paymentForm.control}
                  name="userInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>操作者</FormLabel>
                      <FormControl>
                        <Input placeholder="操作者資訊" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={processPaymentMutation.isPending}>
                    {processPaymentMutation.isPending ? "處理中..." : "確認付款"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    
  );
}
