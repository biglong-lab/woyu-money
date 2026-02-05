import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Download, FileText, TrendingUp, Info } from "lucide-react";

interface AnnualStatsReportProps {
  readonly rentalPayments: any[];
  readonly monthlyPaymentYear: number;
  readonly onMonthlyPaymentYearChange: (year: number) => void;
  readonly onExportPayments: (format: 'excel' | 'csv') => void;
}

// 年度統計報表元件
export function AnnualStatsReport({
  rentalPayments,
  monthlyPaymentYear,
  onMonthlyPaymentYearChange,
  onExportPayments,
}: AnnualStatsReportProps) {
  const yearPayments = rentalPayments.filter((item: any) => {
    if (!item.startDate) return false;
    const itemDate = new Date(item.startDate);
    return itemDate.getFullYear() === monthlyPaymentYear;
  });

  const totalAmount = yearPayments.reduce((sum: number, item: any) =>
    sum + (parseFloat(item.totalAmount) || 0), 0);
  const paidAmount = yearPayments.reduce((sum: number, item: any) =>
    sum + (parseFloat(item.paidAmount) || 0), 0);
  const paidCount = yearPayments.filter((item: any) =>
    parseFloat(item.paidAmount || 0) >= parseFloat(item.totalAmount || 0)).length;
  const completionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  const monthlyStats = Array.from({ length: 12 }, (_, month) => {
    const monthPayments = yearPayments.filter((item: any) => {
      const itemDate = new Date(item.startDate);
      return itemDate.getMonth() === month;
    });
    const monthTotal = monthPayments.reduce((s: number, i: any) => s + (parseFloat(i.totalAmount) || 0), 0);
    const monthPaid = monthPayments.reduce((s: number, i: any) => s + (parseFloat(i.paidAmount) || 0), 0);
    const monthPaidCount = monthPayments.filter((i: any) =>
      parseFloat(i.paidAmount || 0) >= parseFloat(i.totalAmount || 0)).length;
    return {
      month: month + 1,
      count: monthPayments.length,
      total: monthTotal,
      paid: monthPaid,
      paidCount: monthPaidCount,
      rate: monthTotal > 0 ? (monthPaid / monthTotal) * 100 : 0,
      items: monthPayments
    };
  });

  const quarterlyStats = [0, 1, 2, 3].map(q => {
    const quarterMonths = monthlyStats.slice(q * 3, q * 3 + 3);
    const quarterItems = yearPayments.filter((item: any) => {
      const itemDate = new Date(item.startDate);
      const itemMonth = itemDate.getMonth();
      return itemMonth >= q * 3 && itemMonth < (q + 1) * 3;
    });
    const qTotal = quarterMonths.reduce((s, m) => s + m.total, 0);
    const qPaid = quarterMonths.reduce((s, m) => s + m.paid, 0);
    return {
      quarter: q + 1,
      count: quarterMonths.reduce((s, m) => s + m.count, 0),
      total: qTotal,
      paid: qPaid,
      paidCount: quarterMonths.reduce((s, m) => s + m.paidCount, 0),
      rate: qTotal > 0 ? (qPaid / qTotal) * 100 : 0,
      items: quarterItems
    };
  });

  return (
    <Card className="border-2 border-blue-100" data-testid="annual-stats-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            年度統計報表
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">年度:</Label>
              <Select
                value={monthlyPaymentYear.toString()}
                onValueChange={(value) => onMonthlyPaymentYearChange(parseInt(value))}
              >
                <SelectTrigger className="w-24" data-testid="select-year-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <SelectItem key={year} value={year.toString()} data-testid={`select-year-${year}`}>
                        {year}年
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExportPayments('excel')}
                className="flex items-center gap-1 text-green-600 border-green-300 hover:bg-green-50"
                data-testid="btn-export-excel"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExportPayments('csv')}
                className="flex items-center gap-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                data-testid="btn-export-csv"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 年度總覽 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="annual-overview-grid">
          <div className="p-3 bg-blue-50 rounded-lg text-center" data-testid="stat-total-periods">
            <div className="text-xl md:text-2xl font-bold text-blue-600">{yearPayments.length}</div>
            <div className="text-xs text-gray-600">總期數</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center" data-testid="stat-paid-count">
            <div className="text-xl md:text-2xl font-bold text-green-600">{paidCount}</div>
            <div className="text-xs text-gray-600">已付清</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg text-center" data-testid="stat-total-amount">
            <div className="text-xl md:text-2xl font-bold text-blue-700">NT${(totalAmount/10000).toFixed(1)}萬</div>
            <div className="text-xs text-gray-600">應付總額</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center" data-testid="stat-paid-amount">
            <div className="text-xl md:text-2xl font-bold text-green-700">NT${(paidAmount/10000).toFixed(1)}萬</div>
            <div className="text-xs text-gray-600">已付金額</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-center col-span-2 md:col-span-1" data-testid="stat-completion-rate">
            <div className="text-xl md:text-2xl font-bold text-purple-600">{completionRate.toFixed(0)}%</div>
            <div className="text-xs text-gray-600">完成率</div>
          </div>
        </div>

        {/* 進度條 */}
        <div data-testid="annual-progress-section">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">年度付款進度</span>
            <span className="font-medium" data-testid="progress-percentage">{completionRate.toFixed(1)}%</span>
          </div>
          <Progress value={completionRate} className="h-3" data-testid="progress-bar" />
        </div>

        {/* 季度統計表格 */}
        <QuarterlyStatsTable
          quarterlyStats={quarterlyStats}
          yearPayments={yearPayments}
          paidCount={paidCount}
          totalAmount={totalAmount}
          paidAmount={paidAmount}
          completionRate={completionRate}
        />

        {/* 月度統計矩陣 */}
        <MonthlyStatsGrid monthlyStats={monthlyStats} />
      </CardContent>
    </Card>
  );
}

// ==========================================
// 季度統計表格
// ==========================================
function QuarterlyStatsTable({
  quarterlyStats,
  yearPayments,
  paidCount,
  totalAmount,
  paidAmount,
  completionRate,
}: {
  readonly quarterlyStats: any[];
  readonly yearPayments: any[];
  readonly paidCount: number;
  readonly totalAmount: number;
  readonly paidAmount: number;
  readonly completionRate: number;
}) {
  return (
    <div data-testid="quarterly-stats-section">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        季度統計
      </h4>
      <div className="overflow-x-auto">
        <Table data-testid="quarterly-stats-table">
          <TableHeader>
            <TableRow>
              <TableHead>季度</TableHead>
              <TableHead className="text-center">期數</TableHead>
              <TableHead className="text-right">應付金額</TableHead>
              <TableHead className="text-right">已付金額</TableHead>
              <TableHead className="text-center">完成率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quarterlyStats.map((q) => (
              <TableRow key={q.quarter} data-testid={`quarter-row-${q.quarter}`}>
                <TableCell className="font-medium">Q{q.quarter}</TableCell>
                <TableCell className="text-center">
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <button className="inline-flex items-center gap-1 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors">
                        <span className="text-green-600">{q.paidCount}</span>
                        <span className="text-gray-400">/</span>
                        <span>{q.count}</span>
                        <Info className="w-3 h-3 text-gray-400 ml-1" />
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" align="start">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Q{q.quarter} 付款項目明細</h4>
                        {q.items.length === 0 ? (
                          <p className="text-xs text-gray-500">本季無付款項目</p>
                        ) : (
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-2 pr-3">
                              {q.items.map((item: any) => {
                                const isPaid = parseFloat(item.paidAmount || 0) >= parseFloat(item.totalAmount || 0);
                                const isPartial = parseFloat(item.paidAmount || 0) > 0 && parseFloat(item.paidAmount || 0) < parseFloat(item.totalAmount || 0);
                                return (
                                  <div key={item.id} className="flex items-center justify-between text-xs border-b pb-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium truncate">{item.itemName}</div>
                                      <div className="text-gray-500">{new Date(item.startDate).toLocaleDateString('zh-TW')}</div>
                                    </div>
                                    <div className="text-right ml-2">
                                      <div className="font-medium">NT${parseFloat(item.totalAmount || 0).toLocaleString()}</div>
                                      <div className={isPaid ? "text-green-600" : isPartial ? "text-yellow-600" : "text-red-600"}>
                                        {isPaid ? "已付清" : isPartial ? `已付 ${((parseFloat(item.paidAmount || 0) / parseFloat(item.totalAmount || 0)) * 100).toFixed(0)}%` : "待付款"}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </TableCell>
                <TableCell className="text-right">NT${q.total.toLocaleString()}</TableCell>
                <TableCell className="text-right text-green-600">NT${q.paid.toLocaleString()}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, q.rate)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-12">{q.rate.toFixed(0)}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-gray-50 font-medium">
              <TableCell>年度合計</TableCell>
              <TableCell className="text-center">
                <span className="text-green-600">{paidCount}</span>
                <span className="text-gray-400">/</span>
                <span>{yearPayments.length}</span>
              </TableCell>
              <TableCell className="text-right">NT${totalAmount.toLocaleString()}</TableCell>
              <TableCell className="text-right text-green-600">NT${paidAmount.toLocaleString()}</TableCell>
              <TableCell className="text-center">
                <Badge className={completionRate >= 80 ? "bg-green-100 text-green-700" : completionRate >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                  {completionRate.toFixed(0)}%
                </Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ==========================================
// 月度統計矩陣
// ==========================================
function MonthlyStatsGrid({ monthlyStats }: { readonly monthlyStats: any[] }) {
  return (
    <div data-testid="monthly-stats-section">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        月度付款狀況
      </h4>
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2" data-testid="monthly-stats-grid">
        {monthlyStats.map((m) => {
          const isComplete = m.rate >= 100;
          const isPartial = m.rate > 0 && m.rate < 100;
          const statusColor = isComplete ? 'bg-green-100 border-green-300 text-green-700'
            : isPartial ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
            : m.count > 0 ? 'bg-red-100 border-red-300 text-red-700'
            : 'bg-gray-50 border-gray-200 text-gray-400';

          return (
            <HoverCard key={m.month}>
              <HoverCardTrigger asChild>
                <div
                  className={`p-2 rounded-lg border text-center cursor-pointer hover:shadow-md transition-shadow ${statusColor}`}
                  data-testid={`month-stat-${m.month}`}
                >
                  <div className="font-semibold text-sm">{m.month}月</div>
                  {m.count > 0 ? (
                    <>
                      <div className="text-xs mt-1">{m.paidCount}/{m.count}期</div>
                      <div className="text-xs font-medium">{m.rate.toFixed(0)}%</div>
                    </>
                  ) : (
                    <div className="text-xs mt-1">無資料</div>
                  )}
                </div>
              </HoverCardTrigger>
              <HoverCardContent className="w-72" align="center">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">{m.month}月 付款項目明細</h4>
                  <div className="flex justify-between text-xs text-gray-500 pb-2 border-b">
                    <span>應付：NT${m.total.toLocaleString()}</span>
                    <span>已付：NT${m.paid.toLocaleString()}</span>
                  </div>
                  {m.items.length === 0 ? (
                    <p className="text-xs text-gray-500 py-2">本月無付款項目</p>
                  ) : (
                    <ScrollArea className="h-[180px]">
                      <div className="space-y-2 pr-3">
                        {m.items.map((item: any) => {
                          const isPaid = parseFloat(item.paidAmount || 0) >= parseFloat(item.totalAmount || 0);
                          const isItemPartial = parseFloat(item.paidAmount || 0) > 0 && parseFloat(item.paidAmount || 0) < parseFloat(item.totalAmount || 0);
                          return (
                            <div key={item.id} className="flex items-center justify-between text-xs border-b pb-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{item.itemName}</div>
                                <div className="text-gray-500">{new Date(item.startDate).toLocaleDateString('zh-TW')}</div>
                              </div>
                              <div className="text-right ml-2">
                                <div className="font-medium">NT${parseFloat(item.totalAmount || 0).toLocaleString()}</div>
                                <div className={isPaid ? "text-green-600" : isItemPartial ? "text-yellow-600" : "text-red-600"}>
                                  {isPaid ? "已付清" : isItemPartial ? `已付 ${((parseFloat(item.paidAmount || 0) / parseFloat(item.totalAmount || 0)) * 100).toFixed(0)}%` : "待付款"}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-xs mt-3">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
          <span>已付清</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
          <span>部分付款</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
          <span>未付款</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
          <span>無資料</span>
        </div>
      </div>
    </div>
  );
}
