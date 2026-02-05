import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Eye, Receipt, Calendar, Building2, Target, DollarSign, Image, Edit3, Save, X, Clock, FileText, Plus, TrendingUp, AlertTriangle } from "lucide-react";
import PaymentItemNotes from "./payment-item-notes";

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

interface PaymentItemDetailsProps {
  item: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentItemDetails({ item, open, onOpenChange }: PaymentItemDetailsProps) {
  const [showPaymentRecords, setShowPaymentRecords] = useState(true);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState(item?.notes || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 查詢付款記錄 - 僅在需要時啟用
  const { data: paymentRecords = [] } = useQuery({
    queryKey: ["/api/payment/items", item?.id, "records"],
    queryFn: async () => {
      if (!item?.id) return [];
      const response = await fetch(`/api/payment/items/${item.id}/records`);
      if (!response.ok) throw new Error('Failed to fetch payment records');
      return response.json();
    },
    enabled: showPaymentRecords && !!item?.id,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    refetchOnMount: false,
  });

  // 查詢備註記錄 - 用於顯示數量
  const { data: itemNotes = [] } = useQuery<any[]>({
    queryKey: ["/api/payment-items", item?.id, "notes"],
    queryFn: async () => {
      if (!item?.id) return [];
      return await apiRequest("GET", `/api/payment-items/${item.id}/notes`);
    },
    enabled: !!item?.id,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // 同步備註狀態當項目改變時
  useEffect(() => {
    setNotes(item?.notes || "");
  }, [item?.notes]);

  // 更新備註的 mutation
  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const response: any = await apiRequest("PUT", `/api/payment/items/${item.id}`, {
        notes: newNotes,
        changeReason: "更新備註"
      });
      return response;
    },
    onSuccess: (_response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      setIsEditingNotes(false);
      toast({
        title: "成功",
        description: "備註已更新",
      });
    },
    onError: (error: any) => {
      toast({
        title: "更新失敗",
        description: error.message || "備註更新時發生錯誤",
        variant: "destructive",
      });
    },
  });

  if (!item) return null;

  // 計算實際已付金額
  const actualPaidAmount = paymentRecords.reduce((total: number, record: any) => {
    return total + parseFloat(record.amount || record.amountPaid || "0");
  }, 0);

  // 計算剩餘金額和進度
  const totalAmount = parseFloat(item.totalAmount || "0");
  const remainingAmount = totalAmount - actualPaidAmount;
  const paymentProgress = totalAmount > 0 ? (actualPaidAmount / totalAmount) * 100 : 0;

  // 保存備註
  const handleSaveNotes = () => {
    updateNotesMutation.mutate(notes);
  };

  // 取消編輯備註
  const handleCancelEdit = () => {
    setNotes(item?.notes || "");
    setIsEditingNotes(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Eye className="w-5 h-5" />
            {item.itemName}
          </DialogTitle>
          <DialogDescription>
            項目詳情與付款狀況管理
          </DialogDescription>
        </DialogHeader>
        
        {/* 付款進度指示器 - 顯著位置 */}
        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-transparent">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-sm">付款進度</span>
                </div>
                <Badge 
                  variant={item.status === "paid" ? "default" : 
                          item.status === "overdue" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {item.status === "paid" ? "已付清" : 
                   item.status === "overdue" ? "逾期" : 
                   item.status === "partial" ? "部分付款" : "待付款"}
                </Badge>
              </div>
              
              <Progress value={paymentProgress} className="h-2" />
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
                    <DollarSign className="w-3 h-3" />
                    總金額
                  </div>
                  <p className="font-bold text-gray-900">
                    NT${totalAmount.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-green-600 mb-1">
                    <TrendingUp className="w-3 h-3" />
                    已付款
                  </div>
                  <p className="font-bold text-green-600">
                    NT${actualPaidAmount.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-red-600 mb-1">
                    <AlertTriangle className="w-3 h-3" />
                    待付款
                  </div>
                  <p className="font-bold text-red-600">
                    NT${Math.max(0, remainingAmount).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="h-full overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              基本資訊
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              付款記錄 {paymentRecords.length > 0 && `(${paymentRecords.length})`}
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              備註管理 {itemNotes.length > 0 && `(${itemNotes.length})`}
            </TabsTrigger>
          </TabsList>

          <div className="overflow-y-auto max-h-[calc(95vh-280px)]">
            <TabsContent value="overview" className="space-y-4 p-1">
              {/* 基本資訊網格 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Building2 className="w-4 h-4" />
                      項目資訊
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">項目類型</span>
                        <span>{item.itemType === "home" ? "家用" : "專案"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">付款類型</span>
                        <span>
                          {item.paymentType === "single" ? "單次付款" : 
                           item.paymentType === "recurring" ? "定期付款" : "分期付款"}
                        </span>
                      </div>
                      {item.projectName && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">所屬專案</span>
                          <span>{item.projectName}</span>
                        </div>
                      )}
                      {item.categoryName && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">分類</span>
                          <span>{item.categoryName}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Calendar className="w-4 h-4" />
                      時間資訊
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">開始日期</span>
                        <span>{item.startDate}</span>
                      </div>
                      {item.endDate && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">結束日期</span>
                          <span>{item.endDate}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">創建時間</span>
                        <span className="text-xs">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : '未知'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">更新時間</span>
                        <span className="text-xs">
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '未知'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4 p-1">
              {paymentRecords.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-gray-500">
                    <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">尚無付款記錄</p>
                    <p className="text-sm">付款記錄將會顯示在這裡</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {paymentRecords
                    .sort((a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                    .map((record: any) => (
                      <Card key={record.id} className="hover:shadow-sm transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {getPaymentMethodText(record.paymentMethod)}
                                </Badge>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(record.paymentDate).toLocaleDateString()}
                                </div>
                                {record.receiptImageUrl && (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="text-xs h-6 px-2 hover:bg-blue-50">
                                        <Image className="w-3 h-3 mr-1" />
                                        查看收據
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl">
                                      <DialogHeader>
                                        <DialogTitle>付款收據</DialogTitle>
                                      </DialogHeader>
                                      <div className="flex justify-center">
                                        <img 
                                          src={record.receiptImageUrl} 
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
                              {record.notes && (
                                <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                  {record.notes}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-600 text-lg">
                                +NT${parseInt(record.amount || record.amountPaid || "0").toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500 flex items-center gap-1 justify-end mt-1">
                                <Clock className="w-3 h-3" />
                                {new Date(record.createdAt || '').toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 p-1">
              <PaymentItemNotes 
                itemId={item.id} 
                itemName={item.itemName || '未命名項目'} 
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentItemDetails;