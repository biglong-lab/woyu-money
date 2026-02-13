import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Calendar, Eye, TrendingUp, AlertTriangle, CheckCircle, Clock, FileText } from "lucide-react";
import { Link } from "wouter";
import type { PaymentProject, RentalPriceTier } from "@shared/schema";

/** 租約列表項目（對應 API GET /api/rental/contracts 回傳） */
interface RentalContractListItem {
  id: number;
  projectId: number;
  contractName: string;
  startDate: string;
  endDate: string;
  totalYears: number;
  baseAmount: string;
  isActive: boolean | null;
  notes: string | null;
  projectName: string | null;
  createdAt: Date | null;
}

/** 租約詳情（對應 API GET /api/rental/contracts/:id 回傳） */
interface RentalContractDetail extends RentalContractListItem {
  hasBufferPeriod: boolean | null;
  bufferMonths: number | null;
  bufferIncludedInTerm: boolean | null;
  payeeName: string | null;
  payeeUnit: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  contractPaymentDay: number | null;
  updatedAt: Date | null;
  priceTiers: RentalPriceTier[];
}

/** 租約付款明細（對應 API GET /api/rental/contracts/:id/payments 回傳） */
interface ContractPaymentItem {
  id: number;
  itemName: string;
  totalAmount: string;
  paidAmount: string | null;
  startDate: string;
  endDate: string | null;
  status: string | null;
  notes: string | null;
  projectId: number | null;
  categoryId: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  projectName: string | null;
  categoryName: string | null;
}

interface RentalContractDetailsDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly viewingContract: RentalContractListItem | null;
  readonly viewingContractDetails: RentalContractDetail | null;
  readonly isLoading: boolean;
  readonly projects: PaymentProject[];
  readonly contractPaymentItems: ContractPaymentItem[];
  readonly contractDetailsTab: string;
  readonly onContractDetailsTabChange: (tab: string) => void;
  readonly monthlyPaymentYear: number;
  readonly onMonthlyPaymentYearChange: (year: number) => void;
  readonly onEditContract: (contract: RentalContractListItem) => void;
}

// 租約詳情對話框
export function RentalContractDetailsDialog({
  isOpen,
  onOpenChange,
  viewingContract,
  viewingContractDetails,
  isLoading,
  projects,
  contractPaymentItems,
  contractDetailsTab,
  onContractDetailsTabChange,
  monthlyPaymentYear,
  onMonthlyPaymentYearChange,
  onEditContract,
}: RentalContractDetailsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>租約詳情 - {viewingContractDetails?.contractName || "載入中..."}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            <span className="ml-2">載入租約詳情中...</span>
          </div>
        ) : viewingContractDetails ? (
          <Tabs value={contractDetailsTab} onValueChange={onContractDetailsTabChange}>
            <TabsList>
              <TabsTrigger value="details">租約詳情</TabsTrigger>
              <TabsTrigger value="monthly-payments">月付記錄</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
              <ContractDetailsTab
                details={viewingContractDetails}
                projects={projects}
              />
            </TabsContent>

            <TabsContent value="monthly-payments" className="space-y-6">
              <ContractMonthlyPaymentsTab
                details={viewingContractDetails}
                contractPaymentItems={contractPaymentItems}
                monthlyPaymentYear={monthlyPaymentYear}
                onMonthlyPaymentYearChange={onMonthlyPaymentYearChange}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center text-gray-500">
            無法載入租約詳情
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
          <Button onClick={() => {
            onOpenChange(false);
            if (viewingContract) onEditContract(viewingContract);
          }}>
            編輯租約
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 租約詳情 Tab（基本資訊 + 價格階層 + 進度）
// ==========================================
function ContractDetailsTab({
  details,
  projects,
}: {
  readonly details: RentalContractDetail;
  readonly projects: PaymentProject[];
}) {
  return (
    <div className="space-y-6">
      {/* 基本資訊 */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">基本資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <strong>租約名稱：</strong>{details.contractName}
            </div>
            <div>
              <strong>專案：</strong>{projects?.find((p) => p.id === details.projectId)?.projectName || "未知"}
            </div>
            <div>
              <strong>合約期間：</strong>
              {details.startDate ? new Date(details.startDate).toLocaleDateString('zh-TW') : '未設定'} - {details.endDate ? new Date(details.endDate).toLocaleDateString('zh-TW') : '未設定'}
            </div>
            <div>
              <strong>總年數：</strong>{details.totalYears || 0}年
            </div>
            <div>
              <strong>基礎金額：</strong>NT${parseFloat(String(details.baseAmount || 0)).toLocaleString()}
            </div>
            {details.hasBufferPeriod && (
              <div className="bg-blue-50 p-3 rounded">
                <strong>緩衝期設定：</strong>
                <div className="text-sm mt-1">
                  緩衝期月數：{details.bufferMonths}個月<br/>
                  計入合約期間：{details.bufferIncludedInTerm ? "是" : "否"}
                </div>
              </div>
            )}
            <div className="bg-green-50 p-3 rounded border-l-4 border-green-400">
              <strong>租金起算月份：</strong>
              <span className="text-green-700 font-medium">
                {(() => {
                  if (!details.startDate) return '未設定';

                  const startDate = new Date(details.startDate);
                  const hasBuffer = details.hasBufferPeriod;
                  const bufferMonths = details.bufferMonths || 0;
                  const bufferIncluded = details.bufferIncludedInTerm;

                  const paymentStartDate = new Date(startDate);

                  if (hasBuffer && !bufferIncluded) {
                    paymentStartDate.setMonth(paymentStartDate.getMonth() + bufferMonths);
                  }

                  return paymentStartDate.toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: 'long'
                  });
                })()}
              </span>
              {details.hasBufferPeriod && !details.bufferIncludedInTerm && (
                <div className="text-xs text-green-600 mt-1">
                  (合約開始日期 + {details.bufferMonths}個月緩衝期)
                </div>
              )}
            </div>
            {details.notes && (
              <div>
                <strong>備註：</strong>
                <div className="bg-gray-50 p-2 rounded text-sm mt-1">
                  {details.notes}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">合約狀態</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <strong>建立時間：</strong>
              {details.createdAt ? new Date(details.createdAt).toLocaleString('zh-TW') : '未設定'}
            </div>
            <div>
              <strong>更新時間：</strong>
              {details.updatedAt ? new Date(details.updatedAt).toLocaleString('zh-TW') : '未設定'}
            </div>
            <div>
              <strong>合約狀態：</strong>
              <Badge variant="outline" className="ml-2">
                {details.isActive ? '進行中' : '已結束'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 價格階層 */}
      {details.priceTiers && details.priceTiers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">價格階層設定</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>階層</TableHead>
                    <TableHead>年份範圍</TableHead>
                    <TableHead>月租金</TableHead>
                    <TableHead>年租金總額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.priceTiers.map((tier: RentalPriceTier, index: number) => (
                    <TableRow key={index}>
                      <TableCell>第 {index + 1} 階層</TableCell>
                      <TableCell>第 {tier.yearStart} - {tier.yearEnd} 年</TableCell>
                      <TableCell>NT${parseFloat(String(tier.monthlyAmount || 0)).toLocaleString()}</TableCell>
                      <TableCell>NT${(parseFloat(String(tier.monthlyAmount || 0)) * 12).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 合約進度 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">合約進度</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            if (!details.startDate || !details.endDate) {
              return (
                <div className="text-gray-500">
                  合約日期資訊不完整，無法計算進度
                </div>
              );
            }

            const startDate = new Date(details.startDate);
            const endDate = new Date(details.endDate);
            const currentDate = new Date();

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              return (
                <div className="text-gray-500">
                  合約日期格式錯誤，無法計算進度
                </div>
              );
            }

            const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const passedDays = Math.ceil((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const progress = totalDays > 0 ? Math.max(0, Math.min(100, (passedDays / totalDays) * 100)) : 0;

            return (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>合約進度</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-3" />
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <strong>已過天數：</strong>{Math.max(0, passedDays)}天
                  </div>
                  <div>
                    <strong>總天數：</strong>{totalDays}天
                  </div>
                  <div>
                    <strong>剩餘天數：</strong>{Math.max(0, totalDays - passedDays)}天
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================================
// 月付記錄 Tab（月份矩陣 + 年度統計 + 付款表格）
// ==========================================
function ContractMonthlyPaymentsTab({
  details,
  contractPaymentItems,
  monthlyPaymentYear,
  onMonthlyPaymentYearChange,
}: {
  readonly details: RentalContractDetail;
  readonly contractPaymentItems: ContractPaymentItem[];
  readonly monthlyPaymentYear: number;
  readonly onMonthlyPaymentYearChange: (year: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* 年份選擇器 */}
      <div className="flex items-center gap-4">
        <Label className="text-sm font-medium">查看年份</Label>
        <Select value={monthlyPaymentYear.toString()} onValueChange={(value) => onMonthlyPaymentYearChange(parseInt(value))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(() => {
              if (!details?.startDate || !details?.endDate) {
                return Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - 2 + i;
                  return (
                    <SelectItem key={year} value={year.toString()}>
                      {year}年
                    </SelectItem>
                  );
                });
              }

              const startYear = new Date(details.startDate).getFullYear();
              const endYear = new Date(details.endDate).getFullYear();
              const yearRange = endYear - startYear + 1;

              return Array.from({ length: yearRange }, (_, i) => {
                const year = startYear + i;
                return (
                  <SelectItem key={year} value={year.toString()}>
                    {year}年
                  </SelectItem>
                );
              });
            })()}
          </SelectContent>
        </Select>
      </div>

      {/* 年度月份矩陣視圖 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {monthlyPaymentYear}年度房租付款概覽
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-2 mb-4">
            {Array.from({ length: 12 }, (_, index) => {
              const month = index + 1;
              const monthName = `${month}月`;

              const monthlyPayments = contractPaymentItems.filter((item) => {
                if (!item.startDate) return false;
                const itemDate = new Date(item.startDate);
                return itemDate.getFullYear() === monthlyPaymentYear &&
                       itemDate.getMonth() + 1 === month;
              });

              let statusColor = 'bg-gray-100 text-gray-600';
              let paymentStatus = 'not-due';

              if (monthlyPayments.length > 0) {
                const totalAmount = monthlyPayments.reduce((sum: number, item: ContractPaymentItem) =>
                  sum + (parseFloat(item.totalAmount) || 0), 0);
                const paidAmount = monthlyPayments.reduce((sum: number, item: ContractPaymentItem) =>
                  sum + (parseFloat(item.paidAmount || "0") || 0), 0);

                if (paidAmount >= totalAmount) {
                  paymentStatus = 'paid';
                  statusColor = 'bg-green-100 text-green-700 border-green-200';
                } else if (paidAmount > 0) {
                  paymentStatus = 'partial';
                  statusColor = 'bg-yellow-100 text-yellow-700 border-yellow-200';
                } else {
                  const currentDate = new Date();
                  const monthDate = new Date(monthlyPaymentYear, month - 1, 1);
                  if (monthDate <= currentDate) {
                    paymentStatus = 'unpaid';
                    statusColor = 'bg-red-100 text-red-700 border-red-200';
                  }
                }
              }

              return (
                <div
                  key={month}
                  className={`p-3 rounded-lg border text-center text-sm font-medium ${statusColor}`}
                >
                  <div className="font-semibold">{monthName}</div>
                  <div className="text-xs mt-1">
                    {paymentStatus === 'paid' && '已付清'}
                    {paymentStatus === 'partial' && '部分付款'}
                    {paymentStatus === 'unpaid' && '未付款'}
                    {paymentStatus === 'not-due' && '未到期'}
                  </div>
                  {monthlyPayments.length > 0 && (
                    <div className="text-xs mt-1">
                      NT${monthlyPayments.reduce((sum: number, item: ContractPaymentItem) =>
                        sum + (parseFloat(item.totalAmount) || 0), 0).toLocaleString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 狀態說明 */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
              <span>已付清</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded"></div>
              <span>部分付款</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
              <span>未付款</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
              <span>未到期</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 年度統計摘要 */}
      <YearlyStatsSummary
        contractPaymentItems={contractPaymentItems}
        monthlyPaymentYear={monthlyPaymentYear}
      />

      {/* 付款進度總覽 */}
      <ContractPaymentProgress contractPaymentItems={contractPaymentItems} />

      {/* 付款記錄詳細表格 */}
      <ContractPaymentTable
        contractPaymentItems={contractPaymentItems}
        monthlyPaymentYear={monthlyPaymentYear}
      />
    </div>
  );
}

// 年度統計摘要
function YearlyStatsSummary({
  contractPaymentItems,
  monthlyPaymentYear,
}: {
  readonly contractPaymentItems: ContractPaymentItem[];
  readonly monthlyPaymentYear: number;
}) {
  const yearPayments = contractPaymentItems.filter((item) => {
    if (!item.startDate) return false;
    const itemDate = new Date(item.startDate);
    return itemDate.getFullYear() === monthlyPaymentYear;
  });

  const totalAmount = yearPayments.reduce((sum: number, item: ContractPaymentItem) =>
    sum + (parseFloat(item.totalAmount) || 0), 0);
  const paidAmount = yearPayments.reduce((sum: number, item: ContractPaymentItem) =>
    sum + (parseFloat(item.paidAmount || "0") || 0), 0);
  const unpaidAmount = totalAmount - paidAmount;
  const completionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
  const paidCount = yearPayments.filter((item) =>
    parseFloat(item.paidAmount || "0") >= parseFloat(item.totalAmount || "0")).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-blue-600">
            NT${totalAmount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">年度總金額</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-green-600">
            NT${paidAmount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">已付金額</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-red-600">
            NT${unpaidAmount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">未付金額</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-purple-600">
            {paidCount}/{yearPayments.length}期
          </div>
          <div className="text-sm text-gray-600">已付期數 ({completionRate.toFixed(0)}%)</div>
        </CardContent>
      </Card>
    </div>
  );
}

// 付款進度總覽
function ContractPaymentProgress({
  contractPaymentItems,
}: {
  readonly contractPaymentItems: ContractPaymentItem[];
}) {
  const allPayments = contractPaymentItems || [];
  const totalCount = allPayments.length;
  const paidCount = allPayments.filter((item) =>
    parseFloat(item.paidAmount || "0") >= parseFloat(item.totalAmount || "0")).length;
  const partialCount = allPayments.filter((item) => {
    const paid = parseFloat(item.paidAmount || "0");
    const total = parseFloat(item.totalAmount || "0");
    return paid > 0 && paid < total;
  }).length;
  const unpaidCount = totalCount - paidCount - partialCount;

  const totalAmount = allPayments.reduce((sum: number, item: ContractPaymentItem) =>
    sum + (parseFloat(item.totalAmount) || 0), 0);
  const paidAmount = allPayments.reduce((sum: number, item: ContractPaymentItem) =>
    sum + (parseFloat(item.paidAmount || "0") || 0), 0);
  const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          租約總進度統計
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between text-sm mb-2">
            <span>付款進度</span>
            <span className="font-medium">{progress.toFixed(1)}%</span>
          </div>
          <Progress value={progress} className="h-3" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="p-3 bg-blue-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{totalCount}</div>
              <div className="text-sm text-gray-600">總期數</div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{paidCount}</div>
              <div className="text-sm text-gray-600">已付清</div>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{partialCount}</div>
              <div className="text-sm text-gray-600">部分付款</div>
            </div>
            <div className="p-3 bg-red-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{unpaidCount}</div>
              <div className="text-sm text-gray-600">未付款</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm mt-4 pt-4 border-t">
            <div>
              <span className="text-gray-600">總應付金額：</span>
              <span className="font-bold text-blue-600">NT${totalAmount.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600">已付金額：</span>
              <span className="font-bold text-green-600">NT${paidAmount.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600">待付金額：</span>
              <span className="font-bold text-red-600">NT${(totalAmount - paidAmount).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 付款記錄表格
function ContractPaymentTable({
  contractPaymentItems,
  monthlyPaymentYear,
}: {
  readonly contractPaymentItems: ContractPaymentItem[];
  readonly monthlyPaymentYear: number;
}) {
  const yearPayments = contractPaymentItems.filter((item) => {
    if (!item.startDate) return false;
    const itemDate = new Date(item.startDate);
    return itemDate.getFullYear() === monthlyPaymentYear;
  }).sort((a, b) => {
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {monthlyPaymentYear}年度付款記錄
        </CardTitle>
      </CardHeader>
      <CardContent>
        {yearPayments.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>{monthlyPaymentYear}年度暫無付款記錄</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>期別</TableHead>
                  <TableHead>付款日期</TableHead>
                  <TableHead className="text-right">應付金額</TableHead>
                  <TableHead className="text-right">已付金額</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearPayments.map((item) => {
                  const paid = parseFloat(item.paidAmount || "0");
                  const total = parseFloat(item.totalAmount || "0");
                  const isPaid = paid >= total;
                  const isPartial = paid > 0 && paid < total;
                  const itemDate = new Date(item.startDate);
                  const currentDate = new Date();
                  const isOverdue = !isPaid && itemDate < currentDate;

                  return (
                    <TableRow key={item.id} data-testid={`payment-row-${item.id}`}>
                      <TableCell className="font-medium">
                        {itemDate.getMonth() + 1}月
                      </TableCell>
                      <TableCell>
                        {itemDate.toLocaleDateString('zh-TW')}
                      </TableCell>
                      <TableCell className="text-right">
                        NT${total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={isPaid ? 'text-green-600 font-medium' : isPartial ? 'text-yellow-600' : ''}>
                          NT${paid.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isPaid ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            已付清
                          </Badge>
                        ) : isPartial ? (
                          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                            <Clock className="w-3 h-3 mr-1" />
                            部分付款
                          </Badge>
                        ) : isOverdue ? (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            逾期未付
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                            <Clock className="w-3 h-3 mr-1" />
                            待付款
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/general-payment-management?itemId=${item.id}`}>
                          <Button variant="outline" size="sm" data-testid={`btn-view-payment-${item.id}`}>
                            <Eye className="w-4 h-4 mr-1" />
                            查看
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
