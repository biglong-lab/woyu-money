// 專案付款管理 - 統計面板元件
import { TrendingUp, Clock, DollarSign, AlertTriangle, Calendar, Receipt, Building2, Tag, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { PaymentItem, PaymentStats } from "./payment-project-types";

// 現金流統計型別
interface CashflowStats {
  recordCount: number;
  totalCashOutflow: number;
}

// 現金流項目型別
interface CashflowItem {
  recordId: number;
  itemId: number;
  itemName: string;
  projectName: string;
  categoryName?: string;
  paymentDate: string;
  amount: number;
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  notes?: string;
}

// 現金流詳情型別
interface CashflowDetails {
  summary?: {
    totalRecords: number;
    totalAmount: number;
  };
  items: CashflowItem[];
}

export interface PaymentProjectStatsProps {
  stats: PaymentStats;
  filteredAndSortedItems: PaymentItem[];
  statisticsMode: 'expense' | 'cashflow';
  cashflowStats: CashflowStats | null;
  cashflowDetails: CashflowDetails | null;
  cashflowDetailsLoading: boolean;
  selectedYear: number;
  selectedMonth: number;
}

export default function PaymentProjectStats({
  stats,
  filteredAndSortedItems,
  statisticsMode,
  cashflowStats,
  cashflowDetails,
  cashflowDetailsLoading,
  selectedYear,
  selectedMonth,
}: PaymentProjectStatsProps) {
  return (
    <>
      {/* 分期付款專屬統計面板 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Card className="border-purple-100 bg-purple-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">分期項目</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-purple-600">
                {stats.installment.total}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              進行中: {stats.installment.inProgress}
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">
                  {statisticsMode === 'expense' ? '本月到期' : '現金流項目'}
                </span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-blue-600">
                {(() => {
                  if (statisticsMode === 'cashflow' && cashflowStats) {
                    return cashflowStats.recordCount || 0;
                  } else {
                    return stats.installment.dueThisMonth;
                  }
                })()}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {statisticsMode === 'expense' ? '需要關注' : '實際付款記錄'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-100 bg-green-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">
                  {statisticsMode === 'expense' ? '完成率' : '現金流出'}
                </span>
              </div>
              <div className="text-sm sm:text-lg font-bold text-green-600">
                {(() => {
                  if (statisticsMode === 'cashflow' && cashflowStats) {
                    return new Intl.NumberFormat('zh-TW', {
                      style: 'currency',
                      currency: 'TWD',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    }).format(cashflowStats.totalCashOutflow || 0);
                  } else {
                    return `${stats.installment.completionRate}%`;
                  }
                })()}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {statisticsMode === 'expense'
                ? `已完成: ${stats.installment.paid}`
                : `${selectedYear}年${selectedMonth + 1}月`
              }
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-100 bg-red-50/50 card-interactive">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">逾期</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-red-600">
                {filteredAndSortedItems.filter(item => {
                  const itemDate = new Date(item.paymentType === "single" ? item.startDate : (item.endDate || item.startDate));
                  const today = new Date();
                  today.setHours(23, 59, 59, 999);
                  return itemDate < today && item.status !== "paid";
                }).length}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              需立即處理
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-100 bg-orange-50/50 card-interactive">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4 text-orange-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">本月</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-orange-600">
                {filteredAndSortedItems.filter(item => {
                  const itemDate = new Date(item.paymentType === "single" ? item.startDate : (item.endDate || item.startDate));
                  return itemDate.getMonth() === new Date().getMonth() &&
                         itemDate.getFullYear() === new Date().getFullYear() &&
                         item.status !== "paid";
                }).length}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-blue-50/50 col-span-2 sm:col-span-1 card-interactive">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4 text-blue-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">待付</span>
              </div>
              <div className="text-sm sm:text-lg font-bold text-blue-600">
                {new Intl.NumberFormat('zh-TW', {
                  style: 'currency',
                  currency: 'TWD',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(stats.unpaidAmount)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-100 bg-green-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-600">完成</span>
              </div>
              <div className="text-lg sm:text-2xl font-bold text-green-600">
                {stats.paidCount}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 現金流詳細項目列表 */}
      {statisticsMode === 'cashflow' && cashflowDetails && (
        <Card className="bg-blue-50/30 border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">
                  {selectedYear}年{selectedMonth + 1}月 現金流項目詳情
                </h3>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {cashflowDetails.summary?.totalRecords || 0} 筆記錄
              </Badge>
            </div>
            <p className="text-sm text-blue-700">
              總支出: {new Intl.NumberFormat('zh-TW', {
                style: 'currency',
                currency: 'TWD',
                minimumFractionDigits: 0
              }).format(cashflowDetails.summary?.totalAmount || 0)}
            </p>
          </CardHeader>
          <CardContent>
            {cashflowDetailsLoading ? (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <LoadingSpinner className="h-4 w-4" />
                <span>正在載入現金流項目詳情...</span>
              </div>
            ) : cashflowDetails.items && cashflowDetails.items.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {cashflowDetails.items.map((item) => (
                  <div key={`${item.recordId}-${item.itemId}`} className="border rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 text-sm">{item.itemName}</h4>
                          {item.status === 'paid' && (
                            <Badge className="bg-green-100 text-green-700 text-xs">已完成</Badge>
                          )}
                          {item.status === 'pending' && (
                            <Badge className="bg-yellow-100 text-yellow-700 text-xs">進行中</Badge>
                          )}
                          {item.status === 'overdue' && (
                            <Badge className="bg-red-100 text-red-700 text-xs">逾期</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            <span>{item.projectName}</span>
                          </div>
                          {item.categoryName && (
                            <div className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              <span>{item.categoryName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(item.paymentDate).toLocaleDateString('zh-TW')}</span>
                          </div>
                          {item.paymentMethod && (
                            <div className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              <span>{
                                item.paymentMethod === 'credit_card' ? '信用卡' :
                                item.paymentMethod === 'bank_transfer' ? '銀行轉帳' :
                                item.paymentMethod === 'cash' ? '現金' :
                                item.paymentMethod === 'check' ? '支票' :
                                item.paymentMethod
                              }</span>
                            </div>
                          )}
                        </div>

                        {item.notes && (
                          <div className="mt-1 text-xs text-gray-500 italic">
                            {item.notes}
                          </div>
                        )}
                      </div>

                      <div className="text-right ml-3">
                        <div className="font-semibold text-blue-600">
                          {new Intl.NumberFormat('zh-TW', {
                            style: 'currency',
                            currency: 'TWD',
                            minimumFractionDigits: 0
                          }).format(item.amount)}
                        </div>
                        {item.totalAmount > item.amount && (
                          <div className="text-xs text-gray-500">
                            總額: {new Intl.NumberFormat('zh-TW', {
                              style: 'currency',
                              currency: 'TWD',
                              minimumFractionDigits: 0
                            }).format(item.totalAmount)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>本期間沒有現金流記錄</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
