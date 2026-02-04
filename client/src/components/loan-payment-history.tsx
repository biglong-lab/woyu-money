import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Check, X, Upload, Download, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { PaymentFileUpload } from "./payment-file-upload";

interface LoanPaymentHistory {
  id: number;
  recordId: number;
  scheduleId?: number;
  paymentType: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  paymentStatus: string;
  isEarlyPayment: boolean;
  isLatePayment: boolean;
  receiptFileUrl?: string;
  hasReceipt: boolean;
  receiptNotes?: string;
  notes?: string;
  communicationNotes?: string;
  riskNotes?: string;
  remainingPrincipal?: string;
  remainingInterest?: string;
  recordedBy?: string;
  verifiedBy?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaymentStatistics {
  totalPayments: number;
  totalAmount: string;
  verifiedPayments: number;
  pendingVerification: number;
  latePayments: number;
  earlyPayments: number;
  paymentMethods: Array<{ method: string; count: number; amount: string }>;
}

interface LoanPaymentHistoryProps {
  recordId: number;
  recordTitle: string;
}

export default function LoanPaymentHistory({ recordId, recordTitle }: LoanPaymentHistoryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<LoanPaymentHistory | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentType: "interest",
    amount: "",
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: "bank_transfer",
    paymentStatus: "completed",
    notes: "",
    communicationNotes: "",
    riskNotes: "",
    receiptNotes: "",
    recordedBy: "系統管理員"
  });

  // 查詢還款歷史
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: [`/api/loan-investment/records/${recordId}/payments`],
  });

  // 查詢還款統計
  const { data: stats = {} as PaymentStatistics, isLoading: statsLoading } = useQuery({
    queryKey: [`/api/loan-investment/records/${recordId}/payment-stats`],
  });

  // 新增還款記錄
  const addPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      return await apiRequest("POST", `/api/loan-investment/records/${recordId}/payments`, paymentData);
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "還款記錄已新增",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/loan-investment/records/${recordId}/payments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/loan-investment/records/${recordId}/payment-stats`] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      setAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "新增還款記錄失敗",
        variant: "destructive",
      });
    },
  });

  // 更新還款記錄
  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PUT", `/api/loan-investment/payments/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "還款記錄已更新",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/loan-investment/records/${recordId}/payments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/loan-investment/records/${recordId}/payment-stats`] });
      setEditDialogOpen(false);
      setSelectedPayment(null);
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "更新還款記錄失敗",
        variant: "destructive",
      });
    },
  });

  // 刪除還款記錄
  const deletePaymentMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/loan-investment/payments/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "還款記錄已刪除",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/loan-investment/records/${recordId}/payments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/loan-investment/records/${recordId}/payment-stats`] });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "刪除還款記錄失敗",
        variant: "destructive",
      });
    },
  });

  // 驗證還款記錄
  const verifyPaymentMutation = useMutation({
    mutationFn: async ({ id, verifiedBy, notes }: { id: number; verifiedBy: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/loan-investment/payments/${id}/verify`, { verifiedBy, notes });
    },
    onSuccess: () => {
      toast({
        title: "成功",
        description: "還款記錄已驗證",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/loan-investment/records/${recordId}/payments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/loan-investment/records/${recordId}/payment-stats`] });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "驗證還款記錄失敗",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setPaymentForm({
      paymentType: "interest",
      amount: "",
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: "bank_transfer",
      paymentStatus: "completed",
      notes: "",
      communicationNotes: "",
      riskNotes: "",
      receiptNotes: "",
      recordedBy: "系統管理員"
    });
  };

  const handleAddPayment = () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast({
        title: "錯誤",
        description: "請輸入有效的還款金額",
        variant: "destructive",
      });
      return;
    }

    addPaymentMutation.mutate(paymentForm);
  };

  const handleEditPayment = (payment: LoanPaymentHistory) => {
    setSelectedPayment(payment);
    setPaymentForm({
      paymentType: payment.paymentType,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.paymentStatus,
      notes: payment.notes || "",
      communicationNotes: payment.communicationNotes || "",
      riskNotes: payment.riskNotes || "",
      receiptNotes: payment.receiptNotes || "",
      recordedBy: payment.recordedBy || "系統管理員"
    });
    setEditDialogOpen(true);
  };

  const handleUpdatePayment = () => {
    if (!selectedPayment) return;

    updatePaymentMutation.mutate({
      id: selectedPayment.id,
      data: paymentForm
    });
  };

  const handleVerifyPayment = (payment: LoanPaymentHistory) => {
    verifyPaymentMutation.mutate({
      id: payment.id,
      verifiedBy: "系統管理員",
      notes: "手動驗證"
    });
  };

  const getPaymentTypeLabel = (type: string) => {
    const types = {
      interest: "利息",
      principal: "本金",
      full_repayment: "全額還款",
      partial_payment: "部分還款"
    };
    return types[type] || type;
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods = {
      cash: "現金",
      bank_transfer: "銀行轉帳",
      check: "支票",
      mobile_payment: "行動支付"
    };
    return methods[method] || method;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "failed": return "bg-red-100 text-red-800";
      case "cancelled": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (paymentsLoading || statsLoading) {
    return <div className="flex items-center justify-center p-8">載入中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 標題和新增按鈕 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{recordTitle} - 還款紀錄</h3>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              新增還款記錄
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="add-payment-description">
            <DialogHeader>
              <DialogTitle>新增還款記錄</DialogTitle>
              <p id="add-payment-description" className="text-sm text-gray-600">
                為 {recordTitle} 記錄還款資訊和上傳相關證明文件
              </p>
            </DialogHeader>
            
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">基本資訊</TabsTrigger>
                <TabsTrigger value="files">匯款截圖</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paymentType">還款類型</Label>
                    <Select value={paymentForm.paymentType} onValueChange={(value) => 
                      setPaymentForm(prev => ({ ...prev, paymentType: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interest">利息</SelectItem>
                        <SelectItem value="principal">本金</SelectItem>
                        <SelectItem value="full_repayment">全額還款</SelectItem>
                        <SelectItem value="partial_payment">部分還款</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="amount">還款金額</Label>
                    <Input
                      type="number"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="請輸入還款金額"
                    />
                  </div>

                  <div>
                    <Label htmlFor="paymentDate">還款日期</Label>
                    <Input
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="paymentMethod">付款方式</Label>
                    <Select value={paymentForm.paymentMethod} onValueChange={(value) => 
                      setPaymentForm(prev => ({ ...prev, paymentMethod: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                        <SelectItem value="cash">現金</SelectItem>
                        <SelectItem value="check">支票</SelectItem>
                        <SelectItem value="mobile_payment">行動支付</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="notes">一般備註</Label>
                    <Textarea
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="請輸入備註"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="communicationNotes">溝通記錄</Label>
                    <Textarea
                      value={paymentForm.communicationNotes}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, communicationNotes: e.target.value }))}
                      placeholder="與借款人的溝通記錄"
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="files" className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4">
                  上傳匯款截圖、轉帳憑證或相關證明文件
                </div>
                {/* PaymentFileUpload component will be added after payment creation */}
                <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
                  請先保存還款記錄，然後可在記錄詳情中上傳檔案
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                取消
              </Button>
              <Button 
                onClick={handleAddPayment} 
                disabled={addPaymentMutation.isPending}
              >
                {addPaymentMutation.isPending ? "新增中..." : "新增還款記錄"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="payments" className="w-full">
        <TabsList>
          <TabsTrigger value="payments">還款記錄</TabsTrigger>
          <TabsTrigger value="statistics">統計分析</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-4">
          {/* 還款記錄列表 */}
          <div className="space-y-3">
            {payments.map((payment: LoanPaymentHistory) => (
              <Card key={payment.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(payment.paymentStatus)}>
                        {payment.paymentStatus === "completed" ? "已完成" : 
                         payment.paymentStatus === "pending" ? "待處理" : 
                         payment.paymentStatus === "failed" ? "失敗" : "已取消"}
                      </Badge>
                      
                      <span className="font-medium">
                        {getPaymentTypeLabel(payment.paymentType)}
                      </span>
                      
                      <span className="text-lg font-bold text-green-600">
                        NT$ {parseFloat(payment.amount).toLocaleString()}
                      </span>
                      
                      {payment.isEarlyPayment && (
                        <Badge variant="outline" className="text-blue-600">
                          提前還款
                        </Badge>
                      )}
                      
                      {payment.isLatePayment && (
                        <Badge variant="outline" className="text-red-600">
                          延遲還款
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                      <div>日期: {format(new Date(payment.paymentDate), 'yyyy/MM/dd')}</div>
                      <div>方式: {getPaymentMethodLabel(payment.paymentMethod)}</div>
                      <div>記錄人: {payment.recordedBy || "系統"}</div>
                      <div className="flex items-center gap-1">
                        驗證狀態: 
                        {payment.isVerified ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                        {payment.isVerified ? "已驗證" : "待驗證"}
                      </div>
                    </div>

                    {payment.notes && (
                      <div className="text-sm text-gray-600">
                        <strong>備註:</strong> {payment.notes}
                      </div>
                    )}

                    {payment.communicationNotes && (
                      <div className="text-sm text-blue-600">
                        <strong>溝通記錄:</strong> {payment.communicationNotes}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600"
                        >
                          <Upload className="h-4 w-4" />
                          檔案
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl" aria-describedby="file-upload-description">
                        <DialogHeader>
                          <DialogTitle>匯款截圖管理</DialogTitle>
                          <p id="file-upload-description" className="text-sm text-gray-600">
                            上傳、查看和管理此筆還款的相關證明文件
                          </p>
                        </DialogHeader>
                        <PaymentFileUpload 
                          paymentId={payment.id}
                          onUploadComplete={() => {
                            // Refresh payment data if needed
                          }}
                        />
                      </DialogContent>
                    </Dialog>

                    {!payment.isVerified && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVerifyPayment(payment)}
                        disabled={verifyPaymentMutation.isPending}
                        className="text-green-600"
                      >
                        <Check className="h-4 w-4" />
                        驗證
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditPayment(payment)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deletePaymentMutation.mutate(payment.id)}
                      disabled={deletePaymentMutation.isPending}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {payments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                尚無還款記錄
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="statistics">
          {/* 統計分析 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">總還款次數</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalPayments}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">總還款金額</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  NT$ {parseFloat(stats.totalAmount || "0").toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">已驗證</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.verifiedPayments}</div>
                <div className="text-xs text-gray-500">
                  待驗證: {stats.pendingVerification}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">延遲還款</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.latePayments}</div>
                <div className="text-xs text-gray-500">
                  提前: {stats.earlyPayments}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 付款方式統計 */}
          {stats.paymentMethods && stats.paymentMethods.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>付款方式統計</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.paymentMethods.map((method, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span>{getPaymentMethodLabel(method.method)}</span>
                      <div className="text-right">
                        <div className="font-semibold">
                          NT$ {parseFloat(method.amount).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {method.count} 次
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* 編輯對話框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>編輯還款記錄</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="paymentType">還款類型</Label>
              <Select value={paymentForm.paymentType} onValueChange={(value) => 
                setPaymentForm(prev => ({ ...prev, paymentType: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interest">利息</SelectItem>
                  <SelectItem value="principal">本金</SelectItem>
                  <SelectItem value="full_repayment">全額還款</SelectItem>
                  <SelectItem value="partial_payment">部分還款</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="amount">還款金額</Label>
              <Input
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="paymentDate">還款日期</Label>
              <Input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="paymentMethod">付款方式</Label>
              <Select value={paymentForm.paymentMethod} onValueChange={(value) => 
                setPaymentForm(prev => ({ ...prev, paymentMethod: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                  <SelectItem value="cash">現金</SelectItem>
                  <SelectItem value="check">支票</SelectItem>
                  <SelectItem value="mobile_payment">行動支付</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="notes">一般備註</Label>
              <Textarea
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="communicationNotes">溝通記錄</Label>
              <Textarea
                value={paymentForm.communicationNotes}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, communicationNotes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleUpdatePayment} 
              disabled={updatePaymentMutation.isPending}
            >
              {updatePaymentMutation.isPending ? "更新中..." : "更新"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}