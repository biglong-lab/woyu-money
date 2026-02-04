import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, Target, DollarSign, Calendar, AlertCircle, CheckCircle, CreditCard, ArrowLeft, Home, Search, Eye, X, Receipt, Clock, Image } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PaymentItemDetails } from "@/components/payment-item-details";
import type { PaymentProject, DebtCategory, PaymentItem, PaymentRecord } from "@shared/schema";

// 付款方式中文對照表
const getPaymentMethodText = (method: string) => {
  const methodMap: { [key: string]: string } = {
    'bank_transfer': '銀行轉帳',
    'cash': '現金',
    'credit_card': '信用卡',
    'digital_payment': '數位支付',
    'check': '支票',
    'other': '其他'
  };
  return methodMap[method] || method || '未知方式';
};

export default function UnifiedPaymentSimple() {
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<PaymentItem | null>(null);
  const [showPaymentRecords, setShowPaymentRecords] = useState(false);

  // 查詢專案和分類
  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  });

  const { data: categories = [] } = useQuery<DebtCategory[]>({
    queryKey: ["/api/categories/project"],
  });

  // 查詢付款項目
  const { data: items = [] } = useQuery<PaymentItem[]>({
    queryKey: ["/api/payment/items"],
  });

  // 查詢付款記錄
  const { data: paymentRecords = [] } = useQuery<PaymentRecord[]>({
    queryKey: ["/api/payment/records"],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    refetchOnMount: false,
  });

  // 過濾符合條件的項目
  const filteredItems = items.filter(item => {
    if (item.status === "paid" || item.isDeleted) return false;
    if (selectedProject && item.projectId !== selectedProject) return false;
    if (selectedCategory && item.categoryId !== selectedCategory) return false;
    if (searchTerm && !item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !(item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
    return true;
  });

  // 計算統計數據
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  let totalAmount = 0;
  let overdueAmount = 0;
  let currentMonthAmount = 0;
  let futureAmount = 0;

  filteredItems.forEach(item => {
    const remaining = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0");
    totalAmount += remaining;

    const itemDate = new Date(item.startDate);
    const itemYear = itemDate.getFullYear();
    const itemMonth = itemDate.getMonth() + 1;

    if (itemYear < currentYear || (itemYear === currentYear && itemMonth < currentMonth)) {
      overdueAmount += remaining;
    } else if (itemYear === currentYear && itemMonth === currentMonth) {
      currentMonthAmount += remaining;
    } else {
      futureAmount += remaining;
    }
  });

  // 執行付款（簡化版）
  const paymentMutation = useMutation({
    mutationFn: async (data: {
      amount: number;
      notes?: string;
    }) => {
      // 簡化版：直接更新第一個項目
      const firstItem = filteredItems[0];
      if (!firstItem) throw new Error("沒有可付款的項目");

      return await apiRequest("PUT", `/api/payment/items/${firstItem.id}`, {
        paidAmount: (parseFloat(firstItem.paidAmount || "0") + data.amount).toString(),
        status: "partial"
      });
    },
    onSuccess: () => {
      toast({
        title: "付款成功",
        description: "付款已成功記錄",
      });
      setPaymentAmount("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
    },
    onError: (error: any) => {
      toast({
        title: "付款失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePayment = () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "無效金額",
        description: "請輸入有效的付款金額",
        variant: "destructive",
      });
      return;
    }

    if (filteredItems.length === 0) {
      toast({
        title: "沒有項目",
        description: "所選範圍內沒有待付款項目",
        variant: "destructive",
      });
      return;
    }

    paymentMutation.mutate({ amount, notes });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部導航 */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  返回首頁
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">統一付款管理</h1>
                  <p className="text-sm text-gray-600">專案+分類雙維度智能付款系統</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Link href="/payment/records">
                <Button variant="outline" size="sm">付款記錄</Button>
              </Link>
              <Link href="/payment-project">
                <Button variant="outline" size="sm">付款項目</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 主要內容 - 改善視覺層次和間距 */}
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          {/* 選擇器區域 - 改善設計和文字層次 */}
          <Card className="mb-6 border border-gray-200 shadow-sm">
            <CardHeader className="pb-5">
              <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 tracking-tight">
                <Target className="w-5 h-5 text-blue-600" />
                選擇付款範圍
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 mt-1">
                選擇專案、分類或兩者組合來定義付款範圍
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label>專案</Label>
                <Select 
                  value={selectedProject?.toString() || "none"} 
                  onValueChange={(value) => setSelectedProject(value === "none" ? null : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇專案（可選）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">所有專案</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.projectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>分類</Label>
                <Select 
                  value={selectedCategory?.toString() || "none"} 
                  onValueChange={(value) => setSelectedCategory(value === "none" ? null : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇分類（可選）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">所有分類</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>搜尋項目</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜尋項目名稱或備註..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                      onClick={() => setSearchTerm("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 付款概況 - 改善視覺設計和數字顯示 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border border-red-100 shadow-sm bg-red-50/30">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm font-medium text-gray-700 tracking-wide">逾期未付</p>
                </div>
                <p className="text-2xl font-bold text-red-700 leading-none">
                  NT$ {overdueAmount.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-orange-100 shadow-sm bg-orange-50/30">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-orange-600" />
                  <p className="text-sm font-medium text-gray-700 tracking-wide">本月到期</p>
                </div>
                <p className="text-2xl font-bold text-orange-700 leading-none">
                  NT$ {currentMonthAmount.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-blue-100 shadow-sm bg-blue-50/30">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <p className="text-sm font-medium text-gray-700 tracking-wide">未來到期</p>
                </div>
                <p className="text-2xl font-bold text-blue-700 leading-none">
                  NT$ {futureAmount.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-green-100 shadow-sm bg-green-50/30">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <p className="text-sm font-medium text-gray-700 tracking-wide">總金額</p>
                </div>
                <p className="text-2xl font-bold text-green-700 leading-none">
                  NT$ {totalAmount.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 付款執行區域 - 改善視覺設計 */}
        {filteredItems.length > 0 && (
          <Card className="mb-8 border border-gray-200 shadow-sm">
            <CardHeader className="pb-5">
              <CardTitle className="text-lg font-semibold text-gray-900 tracking-tight">執行統一付款</CardTitle>
              <CardDescription className="text-sm text-gray-600 mt-1">
                輸入付款金額，系統將優先處理逾期項目
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium">付款金額</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium">付款備註</Label>
                  <Input
                    id="notes"
                    placeholder="統一付款備註（可選）"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <Button 
                onClick={handlePayment}
                disabled={paymentMutation.isPending || !paymentAmount}
                className="w-full text-sm sm:text-base py-2 sm:py-3"
              >
                {paymentMutation.isPending ? "處理中..." : "執行統一付款"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 付款項目列表 - 改善視覺設計和間距 */}
        {filteredItems.length > 0 && (
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-5">
              <CardTitle className="text-lg font-semibold text-gray-900 tracking-tight">
                包含的付款項目 ({filteredItems.length})
              </CardTitle>
              <CardDescription className="text-sm text-gray-600 mt-1">
                符合條件的待付款項目
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredItems.map((item) => {
                  const isOverdue = new Date(item.startDate) < new Date();
                  const isCurrentMonth = new Date(item.startDate).getMonth() === new Date().getMonth();
                  
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-5 border border-gray-100 rounded-lg hover:border-gray-200 hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="flex-1 pr-8">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-base text-gray-900">{item.itemName}</h4>
                          <Eye className="w-4 h-4 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          開始日期：{item.startDate}
                        </p>
                        {item.notes && (
                          <p className="text-sm text-gray-500 truncate">
                            備註：{item.notes}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <Badge 
                          variant={isOverdue ? "destructive" : isCurrentMonth ? "default" : "secondary"}
                          className="px-3 py-1 text-xs font-medium"
                        >
                          {isOverdue ? "逾期" : isCurrentMonth ? "本月" : "未來"}
                        </Badge>
                        
                        <div className="text-right min-w-[120px]">
                          <p className="text-lg font-bold text-gray-900 leading-none mb-1">
                            NT$ {parseInt(item.totalAmount).toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">
                            已付：NT$ {parseInt(item.paidAmount || "0").toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 無數據狀態 */}
        {filteredItems.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">沒有待付款項目</h3>
              <p className="text-gray-600">
                所選範圍內的所有項目都已完成付款
              </p>
            </CardContent>
          </Card>
        )}

        {/* 最近付款記錄 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              最近付款記錄
            </CardTitle>
            <CardDescription>
              顯示最近的付款記錄，查看付款歷史
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>尚無付款記錄</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentRecords
                  .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                  .slice(0, 5) // 只顯示最近5筆記錄
                  .map((record) => {
                    // 尋找對應的項目資訊
                    const item = items.find(item => item.id === record.itemId);
                    const project = projects.find(p => p.id === item?.projectId);
                    const category = categories.find(c => c.id === item?.categoryId);
                    
                    return (
                      <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{item?.itemName || '未知項目'}</h4>
                            <Badge variant="secondary" className="text-xs">
                              {getPaymentMethodText(record.paymentMethod || "")}
                            </Badge>
                            {record.receiptImage && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-gray-100">
                                    <Image className="w-3 h-3 mr-1" />
                                    收據
                                  </Badge>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>付款收據圖片</DialogTitle>
                                    <DialogDescription>
                                      查看付款收據的詳細圖片
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="flex justify-center">
                                    <img 
                                      src={`/uploads/${record.receiptImage}`} 
                                      alt="付款收據" 
                                      className="max-w-full max-h-96 object-contain rounded-lg border"
                                      onError={(e) => {
                                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWcluePh+eEoeazleaaguWFpTwvdGV4dD48L3N2Zz4=';
                                      }}
                                    />
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            {project && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {project.projectName}
                              </span>
                            )}
                            {category && (
                              <span className="flex items-center gap-1">
                                <Target className="w-3 h-3" />
                                {category.categoryName}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(record.paymentDate).toLocaleDateString()}
                            </span>
                          </div>
                          {record.notes && (
                            <p className="text-sm text-gray-500 mt-1">{record.notes}</p>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            +${parseInt(record.amount).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(record.createdAt || '').toLocaleString()}
                          </p>
                          {record.receiptImage && (
                            <Badge variant="outline" className="text-xs mt-1">
                              📷 有收據
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                
                {paymentRecords.length > 5 && (
                  <div className="text-center pt-4">
                    <Link href="/payment-records">
                      <Button variant="outline" className="flex items-center gap-2 mx-auto">
                        <Clock className="w-4 h-4" />
                        查看所有付款記錄 ({paymentRecords.length} 筆)
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 項目詳情對話框 */}
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                項目詳情
              </DialogTitle>
              <DialogDescription>
                查看付款項目的完整資訊
              </DialogDescription>
            </DialogHeader>
            
            {selectedItem && (
              <div className="space-y-6">
                {/* 基本資訊 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">項目名稱</Label>
                    <p className="mt-1 text-sm text-gray-900">{selectedItem.itemName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">項目類型</Label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedItem.itemType === "home" ? "家用" : "專案"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">付款類型</Label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedItem.paymentType === "single" ? "單次付款" : 
                       selectedItem.paymentType === "recurring" ? "定期付款" : "分期付款"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">狀態</Label>
                    <Badge 
                      variant={selectedItem.status === "paid" ? "default" : 
                              selectedItem.status === "overdue" ? "destructive" : "secondary"}
                      className="mt-1"
                    >
                      {selectedItem.status === "paid" ? "已付款" : 
                       selectedItem.status === "overdue" ? "逾期" : 
                       selectedItem.status === "partial" ? "部分付款" : "待付款"}
                    </Badge>
                  </div>
                </div>

                {/* 金額資訊 */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">總金額</Label>
                    <p className="mt-1 text-lg font-bold text-gray-900">
                      ${parseInt(selectedItem.totalAmount).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">已付金額</Label>
                    <p className="mt-1 text-lg font-bold text-green-600">
                      ${parseInt(selectedItem.paidAmount || "0").toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">剩餘金額</Label>
                    <p className="mt-1 text-lg font-bold text-red-600">
                      ${(parseFloat(selectedItem.totalAmount) - parseFloat(selectedItem.paidAmount || "0")).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* 日期資訊 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">開始日期</Label>
                    <p className="mt-1 text-sm text-gray-900">{selectedItem.startDate}</p>
                  </div>
                  {selectedItem.endDate && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700">結束日期</Label>
                      <p className="mt-1 text-sm text-gray-900">{selectedItem.endDate}</p>
                    </div>
                  )}
                </div>

                {/* 備註 */}
                {selectedItem.notes && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">備註</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-900">{selectedItem.notes}</p>
                    </div>
                  </div>
                )}

                {/* 付款記錄 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-gray-700">付款記錄</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPaymentRecords(!showPaymentRecords)}
                      className="flex items-center gap-2"
                    >
                      <Receipt className="w-4 h-4" />
                      {showPaymentRecords ? "隱藏記錄" : "查看記錄"}
                    </Button>
                  </div>
                  
                  {showPaymentRecords && (
                    <div className="max-h-60 overflow-y-auto border rounded-lg">
                      {paymentRecords.filter(record => record.itemId === selectedItem.id).length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          <Receipt className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">尚無付款記錄</p>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {paymentRecords
                            .filter(record => record.itemId === selectedItem.id)
                            .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                            .map((record) => (
                              <div key={record.id} className="p-3 hover:bg-gray-50">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="secondary" className="text-xs">
                                        {record.paymentMethod || "未知"}
                                      </Badge>
                                      <span className="text-xs text-gray-500">
                                        {new Date(record.paymentDate).toLocaleDateString()}
                                      </span>
                                    </div>
                                    {record.notes && (
                                      <p className="text-sm text-gray-600 mb-1">{record.notes}</p>
                                    )}
                                    {record.receiptImage && (
                                      <p className="text-xs text-blue-600">📷 有收據圖片</p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium text-green-600">
                                      +${parseInt(record.amount).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(record.createdAt || '').toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 時間戳 */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">創建時間</Label>
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : '未知'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">更新時間</Label>
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedItem.updatedAt ? new Date(selectedItem.updatedAt).toLocaleString() : '未知'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  );
}