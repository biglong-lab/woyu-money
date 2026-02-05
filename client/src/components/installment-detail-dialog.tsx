// 分期付款詳細檢視對話框元件

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Calendar, TrendingUp } from "lucide-react";
import type { PaymentItem } from "./installment-types";
import { analyzeInstallmentItem, calculateProgress } from "./installment-utils";

export interface InstallmentDetailDialogProps {
  item: PaymentItem | null;
  onClose: () => void;
  projects: Array<{ id: number; projectName: string }>;
  categories: Array<{ id: number; categoryName: string }>;
  fixedCategories: Array<{ id: number; categoryName: string }>;
}

export default function InstallmentDetailDialog({
  item,
  onClose,
  projects,
  categories,
  fixedCategories,
}: InstallmentDetailDialogProps) {
  return (
    <Dialog open={!!item} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-600" />
            分期付款詳細資料
          </DialogTitle>
        </DialogHeader>

        {item && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">總覽</TabsTrigger>
              <TabsTrigger value="schedule">分期明細</TabsTrigger>
              <TabsTrigger value="analysis">分析統計</TabsTrigger>
            </TabsList>

            {/* 總覽頁籤 */}
            <TabsContent value="overview" className="space-y-4">
              <OverviewTab item={item} />
            </TabsContent>

            {/* 分期明細頁籤 */}
            <TabsContent value="schedule" className="space-y-4">
              <ScheduleTab item={item} />
            </TabsContent>

            {/* 分析統計頁籤 */}
            <TabsContent value="analysis" className="space-y-4">
              <AnalysisTab
                item={item}
                projects={projects}
                categories={categories}
                fixedCategories={fixedCategories}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// 總覽頁籤
function OverviewTab({ item }: { item: PaymentItem }) {
  const progress = calculateProgress(item);
  const monthlyAmount = parseFloat(item.installmentAmount || "0") || 0;
  const paidPeriods =
    monthlyAmount > 0 ? Math.floor(parseFloat(item.paidAmount) / monthlyAmount) : 0;
  const totalPeriods = item.installmentCount || 0;
  const remainingAmount = parseFloat(item.totalAmount) - parseFloat(item.paidAmount);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 基本資訊 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            基本資訊
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-gray-500">項目名稱</p>
            <p className="font-medium">{item.itemName}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">總金額</p>
              <p className="font-semibold text-lg text-blue-600">
                NT$ {parseFloat(item.totalAmount).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">每期金額</p>
              <p className="font-medium">NT$ {parseFloat(item.amount).toLocaleString()}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">分期期數</p>
              <p className="font-medium">{item.installmentMonths} 期</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">到期日</p>
              <p className="font-medium">
                {new Date(item.dueDate).toLocaleDateString()}
              </p>
            </div>
          </div>
          {item.notes && (
            <div>
              <p className="text-sm text-gray-500">備註</p>
              <p className="text-sm bg-gray-50 p-2 rounded">{item.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 付款進度 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            付款進度
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>整體進度</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-500">已付金額</p>
              <p className="font-semibold text-green-600">
                NT$ {parseFloat(item.paidAmount).toLocaleString()}
              </p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-500">剩餘金額</p>
              <p className="font-semibold text-orange-600">
                NT$ {remainingAmount.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-500">已付期數</p>
              <p className="font-semibold text-blue-600">{paidPeriods} 期</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-500">剩餘期數</p>
              <p className="font-semibold text-purple-600">
                {totalPeriods - paidPeriods} 期
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Badge
              variant={progress >= 100 ? "default" : "secondary"}
              className="w-full justify-center py-2"
            >
              {progress >= 100 ? "✓ 已完成付款" : "進行中"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 分期明細頁籤
function ScheduleTab({ item }: { item: PaymentItem }) {
  const analyzedData = analyzeInstallmentItem(item);
  const monthlyAmount = parseFloat(item.totalAmount) || 0;
  const totalPeriods = analyzedData.totalPeriods || 6;
  const paidPeriods = analyzedData.paidPeriods || 0;
  const startDate = item.startDate ? new Date(item.startDate) : new Date();

  const scheduleItems = Array.from({ length: totalPeriods }, (_, index) => {
    const periodDate = new Date(startDate);
    periodDate.setMonth(periodDate.getMonth() + index);

    const isPaid = index + 1 <= paidPeriods;
    const isCurrentPeriod = index + 1 === analyzedData.currentPeriod;
    const isFuture = index + 1 > analyzedData.currentPeriod;
    const isOverdue = !isPaid && !isFuture && periodDate < new Date();

    return {
      period: index + 1,
      date: periodDate,
      amount: monthlyAmount,
      isPaid,
      isOverdue,
      isCurrentPeriod,
      isFuture,
      status: isPaid
        ? "paid"
        : isOverdue
          ? "overdue"
          : isFuture
            ? "future"
            : "pending",
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>分期付款明細</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {scheduleItems.map((scheduleItem) => (
            <div
              key={scheduleItem.period}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                scheduleItem.isPaid
                  ? "bg-green-50 border-green-200"
                  : scheduleItem.isOverdue
                    ? "bg-red-50 border-red-200"
                    : scheduleItem.isCurrentPeriod
                      ? "bg-purple-50 border-purple-200"
                      : scheduleItem.isFuture
                        ? "bg-blue-50 border-blue-200"
                        : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    scheduleItem.isPaid
                      ? "bg-green-500 text-white"
                      : scheduleItem.isOverdue
                        ? "bg-red-500 text-white"
                        : scheduleItem.isCurrentPeriod
                          ? "bg-purple-500 text-white"
                          : scheduleItem.isFuture
                            ? "bg-blue-500 text-white"
                            : "bg-gray-300 text-gray-600"
                  }`}
                >
                  {scheduleItem.isPaid ? "✓" : scheduleItem.period}
                </div>
                <div>
                  <p className="font-medium">第 {scheduleItem.period} 期</p>
                  <p className="text-sm text-gray-500">
                    {scheduleItem.date.toLocaleDateString()}
                  </p>
                  <p
                    className={`text-xs font-medium ${
                      scheduleItem.isPaid
                        ? "text-green-600"
                        : scheduleItem.isOverdue
                          ? "text-red-600"
                          : scheduleItem.isCurrentPeriod
                            ? "text-purple-600"
                            : scheduleItem.isFuture
                              ? "text-blue-600"
                              : "text-gray-600"
                    }`}
                  >
                    {scheduleItem.isPaid
                      ? "已付款"
                      : scheduleItem.isOverdue
                        ? "逾期"
                        : scheduleItem.isCurrentPeriod
                          ? "本期"
                          : scheduleItem.isFuture
                            ? "未來期"
                            : "待付"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="font-medium">
                  NT$ {scheduleItem.amount.toLocaleString()}
                </p>
                <Badge
                  variant={
                    scheduleItem.isPaid
                      ? "default"
                      : scheduleItem.isOverdue
                        ? "destructive"
                        : "secondary"
                  }
                  className="text-xs"
                >
                  {scheduleItem.isPaid
                    ? "已付"
                    : scheduleItem.isOverdue
                      ? "逾期"
                      : "待付"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// 分析統計頁籤
function AnalysisTab({
  item,
  projects,
  categories,
  fixedCategories,
}: {
  item: PaymentItem;
  projects: Array<{ id: number; projectName: string }>;
  categories: Array<{ id: number; categoryName: string }>;
  fixedCategories: Array<{ id: number; categoryName: string }>;
}) {
  const monthlyAmount = parseFloat(item.amount) || 0;
  const totalAmount = parseFloat(item.totalAmount);
  const paidAmount = parseFloat(item.paidAmount);
  const totalPeriods = item.installmentMonths || 0;
  const paidPeriods =
    monthlyAmount > 0 ? Math.floor(paidAmount / monthlyAmount) : 0;
  const remainingPeriods = totalPeriods - paidPeriods;
  const avgPaymentPerMonth =
    paidPeriods > 0 ? paidAmount / paidPeriods : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>付款統計</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">平均每期實付</span>
              <span className="font-medium">
                NT$ {avgPaymentPerMonth.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">完成率</span>
              <span className="font-medium">
                {((paidPeriods / totalPeriods) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">剩餘月份</span>
              <span className="font-medium">{remainingPeriods} 個月</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">預計完成日期</span>
              <span className="font-medium">
                {(() => {
                  const endDate = new Date();
                  endDate.setMonth(endDate.getMonth() + remainingPeriods);
                  return endDate.toLocaleDateString();
                })()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>分類資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-gray-500">專案</p>
            <p className="font-medium">
              {projects.find((p) => p.id === item.projectId)?.projectName || "未指定"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">分類</p>
            <p className="font-medium">
              {categories.find((c) => c.id === item.categoryId)?.categoryName || "未指定"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">固定分類</p>
            <p className="font-medium">
              {fixedCategories.find((fc) => fc.id === item.fixedCategoryId)
                ?.categoryName || "未指定"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">建立時間</p>
            <p className="text-sm">{new Date(item.createdAt).toLocaleString()}</p>
          </div>
          {item.updatedAt && (
            <div>
              <p className="text-sm text-gray-500">最後更新</p>
              <p className="text-sm">{new Date(item.updatedAt).toLocaleString()}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
