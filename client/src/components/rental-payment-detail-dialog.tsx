import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, DollarSign, Calendar, TrendingUp, CheckCircle, Clock, FileText } from "lucide-react";
import { Link } from "wouter";

interface RentalPaymentDetailDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly viewingPayment: any | null;
}

// 租金付款項目詳細資訊對話框
export function RentalPaymentDetailDialog({
  isOpen,
  onOpenChange,
  viewingPayment,
}: RentalPaymentDetailDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>租金付款項目詳細資訊</DialogTitle>
          <DialogDescription>
            查看租金付款項目的完整狀態和付款記錄
          </DialogDescription>
        </DialogHeader>

        {viewingPayment && (
          <div className="space-y-6">
            {/* 基本資訊卡片 */}
            <PaymentBasicInfo payment={viewingPayment} />

            {/* 付款記錄預覽 */}
            <PaymentRecordPreview payment={viewingPayment} />
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/payment-records?search=${viewingPayment?.itemName || ''}`}>
                查看完整記錄
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/payment-project-fixed">
                前往付款管理
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 付款基本資訊
function PaymentBasicInfo({ payment }: { readonly payment: any }) {
  const totalAmount = payment.totalAmount ? parseFloat(payment.totalAmount) : 0;
  const paidAmount = payment.paidAmount ? parseFloat(payment.paidAmount) : 0;
  const isPaid = payment.status === 'paid' || paidAmount >= totalAmount;
  const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          基本資訊
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm text-gray-600">租約名稱</Label>
            <p className="font-medium">{payment.itemName || '未命名租約'}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-600">付款期間</Label>
            <p className="font-medium">{payment.notes || '租金付款'}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-600">應付金額</Label>
            <p className="font-medium text-lg">NT${totalAmount.toLocaleString()}</p>
          </div>
          <div>
            <Label className="text-sm text-gray-600">已付金額</Label>
            <p className="font-medium text-lg text-green-600">NT${paidAmount.toLocaleString()}</p>
          </div>
        </div>

        {/* 付款進度條 */}
        <div className="space-y-2">
          <Label className="text-sm text-gray-600">付款進度</Label>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>已完成 {Math.round(progress)}%</span>
              <span>剩餘 NT${(totalAmount - paidAmount).toLocaleString()}</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </div>

        {/* 狀態徽章 */}
        <div>
          <Label className="text-sm text-gray-600">付款狀態</Label>
          <div className="mt-1">
            {isPaid ? (
              <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                <CheckCircle className="w-4 h-4 mr-2" />
                已完成付款
              </Badge>
            ) : paidAmount > 0 ? (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                <TrendingUp className="w-4 h-4 mr-2" />
                部分付款 ({Math.round((paidAmount / totalAmount) * 100)}%)
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                <Clock className="w-4 h-4 mr-2" />
                待付款
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 付款記錄預覽
function PaymentRecordPreview({ payment }: { readonly payment: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          付款記錄概覽
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 付款摘要 */}
        <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">累計已付款</span>
            <span className="font-bold text-green-600">
              NT${parseFloat(payment.paidAmount || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">待付金額</span>
            <span className="font-bold text-orange-600">
              NT${(parseFloat(payment.totalAmount || 0) - parseFloat(payment.paidAmount || 0)).toLocaleString()}
            </span>
          </div>
        </div>

        {/* 詳細付款記錄列表 */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            付款詳細記錄
          </h4>

          {payment.paidAmount && parseFloat(payment.paidAmount) > 0 ? (
            <ScrollArea className="h-[280px]">
              <div className="space-y-3 pr-3">
                <div className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          已付款
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {payment.updatedAt
                            ? new Date(payment.updatedAt).toLocaleDateString('zh-TW', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '日期未知'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">付款金額：</span>
                          <span className="font-medium text-green-600">
                            NT${parseFloat(payment.paidAmount || 0).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">付款方式：</span>
                          <span className="font-medium">銀行轉帳</span>
                        </div>
                      </div>

                      {payment.notes && (
                        <div className="mt-2 p-2 bg-gray-100 rounded text-sm">
                          <span className="text-gray-500 flex items-center gap-1 mb-1">
                            <FileText className="w-3 h-3" />
                            備註：
                          </span>
                          <p className="text-gray-700">{payment.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* 收據/附件區域 */}
                    <div className="ml-4 flex-shrink-0">
                      {payment.receiptImageUrl ? (
                        <div
                          className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                          onClick={() => {
                            window.open(payment.receiptImageUrl, '_blank');
                          }}
                        >
                          <img
                            src={payment.receiptImageUrl}
                            alt="收據附件"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400"><svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300">
                          <FileText className="w-8 h-8" />
                        </div>
                      )}
                      <p className="text-xs text-center text-gray-400 mt-1">
                        {payment.receiptImageUrl ? '點擊查看' : '無附件'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center py-2">
                  <p className="text-xs text-gray-500">
                    查看完整付款歷史記錄請點擊下方「查看完整記錄」按鈕
                  </p>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">尚無付款記錄</p>
              <p className="text-sm">此項目尚未有任何付款記錄</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
