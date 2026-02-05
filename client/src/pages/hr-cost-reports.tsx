/**
 * 人事費報表頁面
 * 年度總覽、月度明細、趨勢分析
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const fmt = (n: number) => Math.round(n).toLocaleString();

interface MonthlyBreakdown {
  month: number;
  employeeCount: number;
  salaryTotal: number;
  insuranceTotal: number;
  pensionTotal: number;
  totalCost: number;
}

interface YearTotal {
  salaryTotal: number;
  insuranceTotal: number;
  pensionTotal: number;
  totalCost: number;
}

interface HRYearReport {
  year: number;
  monthlyBreakdown: MonthlyBreakdown[];
  yearTotal: YearTotal;
}

interface MonthDetail {
  employeeName: string;
  baseSalary: number;
  insuredSalary: number;
  employerLaborInsurance: number;
  employerHealthInsurance: number;
  employerPension: number;
  employerEmploymentInsurance: number;
  employerAccidentInsurance: number;
  employerTotal: number;
  employeeTotal: number;
  netSalary: number;
  totalCost: number;
  isPaid: boolean;
  insurancePaid: boolean;
}

export default function HRCostReports() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));

  const year = parseInt(selectedYear);
  const month = parseInt(selectedMonth);

  // 年度報表
  const { data: yearReport, isLoading: isLoadingYear } = useQuery<HRYearReport>({
    queryKey: ['/api/reports/hr-cost-report', year],
    queryFn: () => apiRequest('GET', `/api/reports/hr-cost-report?year=${year}`) as Promise<HRYearReport>,
  });

  // 月度明細
  const { data: monthDetails = [], isLoading: isLoadingMonth } = useQuery<MonthDetail[]>({
    queryKey: ['/api/reports/hr-cost-report', year, month],
    queryFn: () => apiRequest('GET', `/api/reports/hr-cost-report/${year}/${month}`) as Promise<MonthDetail[]>,
  });

  // 趨勢計算
  const trendData = yearReport?.monthlyBreakdown || [];
  const maxMonth = trendData.reduce<MonthlyBreakdown | null>(
    (max, m) => (!max || m.totalCost > max.totalCost ? m : max),
    null
  );
  const minMonth = trendData.filter(m => m.totalCost > 0).reduce<MonthlyBreakdown | null>(
    (min, m) => (!min || m.totalCost < min.totalCost ? m : min),
    null
  );
  const avgCost = trendData.length > 0
    ? trendData.reduce((sum, m) => sum + m.totalCost, 0) / trendData.filter(m => m.totalCost > 0).length
    : 0;
  const avgPerPerson = trendData.length > 0
    ? trendData.reduce((sum, m) => sum + (m.employeeCount > 0 ? m.totalCost / m.employeeCount : 0), 0) / trendData.filter(m => m.employeeCount > 0).length
    : 0;

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 標題 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 sm:h-6 sm:w-6" />
            人事費報表
          </h1>
          <p className="text-sm text-gray-500 mt-1">薪資、保費、勞退費用分析</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y}>{y}年</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 年度摘要卡片 */}
      {yearReport && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4 text-center">
              <DollarSign className="h-5 w-5 text-blue-600 mx-auto mb-1" />
              <p className="text-xs text-blue-600">年度薪資</p>
              <p className="text-lg font-bold text-blue-800">${fmt(yearReport.yearTotal.salaryTotal)}</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="pt-4 text-center">
              <Users className="h-5 w-5 text-orange-600 mx-auto mb-1" />
              <p className="text-xs text-orange-600">年度保費</p>
              <p className="text-lg font-bold text-orange-800">${fmt(yearReport.yearTotal.insuranceTotal)}</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="pt-4 text-center">
              <TrendingUp className="h-5 w-5 text-purple-600 mx-auto mb-1" />
              <p className="text-xs text-purple-600">年度勞退</p>
              <p className="text-lg font-bold text-purple-800">${fmt(yearReport.yearTotal.pensionTotal)}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4 text-center">
              <DollarSign className="h-5 w-5 text-green-600 mx-auto mb-1" />
              <p className="text-xs text-green-600">年度總成本</p>
              <p className="text-lg font-bold text-green-800">${fmt(yearReport.yearTotal.totalCost)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="yearly" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="yearly">年度總覽</TabsTrigger>
          <TabsTrigger value="monthly">月度明細</TabsTrigger>
          <TabsTrigger value="trend">趨勢分析</TabsTrigger>
        </TabsList>

        {/* 年度總覽 */}
        <TabsContent value="yearly" className="mt-4">
          {isLoadingYear ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{year}年 月度人事費彙總</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>月份</TableHead>
                        <TableHead className="text-right">員工數</TableHead>
                        <TableHead className="text-right">薪資</TableHead>
                        <TableHead className="text-right">保費</TableHead>
                        <TableHead className="text-right">勞退</TableHead>
                        <TableHead className="text-right">總成本</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                        const data = trendData.find(d => d.month === m);
                        return (
                          <TableRow key={m} className={data ? '' : 'text-gray-300'}>
                            <TableCell>{m}月</TableCell>
                            <TableCell className="text-right">{data?.employeeCount || '-'}</TableCell>
                            <TableCell className="text-right">{data ? `$${fmt(data.salaryTotal)}` : '-'}</TableCell>
                            <TableCell className="text-right">{data ? `$${fmt(data.insuranceTotal)}` : '-'}</TableCell>
                            <TableCell className="text-right">{data ? `$${fmt(data.pensionTotal)}` : '-'}</TableCell>
                            <TableCell className="text-right font-medium">
                              {data ? `$${fmt(data.totalCost)}` : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {yearReport && (
                        <TableRow className="bg-gray-100 font-bold">
                          <TableCell>年度合計</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">${fmt(yearReport.yearTotal.salaryTotal)}</TableCell>
                          <TableCell className="text-right">${fmt(yearReport.yearTotal.insuranceTotal)}</TableCell>
                          <TableCell className="text-right">${fmt(yearReport.yearTotal.pensionTotal)}</TableCell>
                          <TableCell className="text-right">${fmt(yearReport.yearTotal.totalCost)}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 月度明細 */}
        <TabsContent value="monthly" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m} value={m}>{m}月</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-500">月度員工人事費明細</span>
          </div>

          {isLoadingMonth ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : monthDetails.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-400">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {year}年{month}月尚無人事費資料
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>員工</TableHead>
                        <TableHead className="text-right">底薪</TableHead>
                        <TableHead className="text-right">雇主保費</TableHead>
                        <TableHead className="text-right">雇主勞退</TableHead>
                        <TableHead className="text-right">雇主合計</TableHead>
                        <TableHead className="text-right">員工負擔</TableHead>
                        <TableHead className="text-right">實領</TableHead>
                        <TableHead className="text-right">公司成本</TableHead>
                        <TableHead className="text-center">繳費狀態</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthDetails.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{d.employeeName}</TableCell>
                          <TableCell className="text-right">${fmt(d.baseSalary)}</TableCell>
                          <TableCell className="text-right text-orange-600">
                            ${fmt(d.employerLaborInsurance + d.employerHealthInsurance + d.employerEmploymentInsurance + d.employerAccidentInsurance)}
                          </TableCell>
                          <TableCell className="text-right text-purple-600">${fmt(d.employerPension)}</TableCell>
                          <TableCell className="text-right font-medium text-orange-700">${fmt(d.employerTotal)}</TableCell>
                          <TableCell className="text-right text-blue-600">${fmt(d.employeeTotal)}</TableCell>
                          <TableCell className="text-right text-green-600">${fmt(d.netSalary)}</TableCell>
                          <TableCell className="text-right font-bold">${fmt(d.totalCost)}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Badge variant={d.isPaid ? 'default' : 'destructive'} className="text-xs">
                                {d.isPaid ? '薪已付' : '薪未付'}
                              </Badge>
                              <Badge variant={d.insurancePaid ? 'default' : 'destructive'} className="text-xs">
                                {d.insurancePaid ? '保已繳' : '保未繳'}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* 合計行 */}
                      <TableRow className="bg-gray-100 font-bold">
                        <TableCell>合計 ({monthDetails.length} 人)</TableCell>
                        <TableCell className="text-right">
                          ${fmt(monthDetails.reduce((s, d) => s + d.baseSalary, 0))}
                        </TableCell>
                        <TableCell className="text-right text-orange-700">
                          ${fmt(monthDetails.reduce((s, d) => s + d.employerLaborInsurance + d.employerHealthInsurance + d.employerEmploymentInsurance + d.employerAccidentInsurance, 0))}
                        </TableCell>
                        <TableCell className="text-right text-purple-700">
                          ${fmt(monthDetails.reduce((s, d) => s + d.employerPension, 0))}
                        </TableCell>
                        <TableCell className="text-right text-orange-700">
                          ${fmt(monthDetails.reduce((s, d) => s + d.employerTotal, 0))}
                        </TableCell>
                        <TableCell className="text-right text-blue-700">
                          ${fmt(monthDetails.reduce((s, d) => s + d.employeeTotal, 0))}
                        </TableCell>
                        <TableCell className="text-right text-green-700">
                          ${fmt(monthDetails.reduce((s, d) => s + d.netSalary, 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          ${fmt(monthDetails.reduce((s, d) => s + d.totalCost, 0))}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 趨勢分析 */}
        <TabsContent value="trend" className="space-y-4 mt-4">
          {/* 摘要卡片 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-gray-500">月均成本</p>
                <p className="text-lg font-bold">${fmt(avgCost)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-gray-500">人均月成本</p>
                <p className="text-lg font-bold">${fmt(avgPerPerson)}</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-4 text-center">
                <TrendingUp className="h-4 w-4 text-red-600 mx-auto mb-1" />
                <p className="text-xs text-red-600">最高月份</p>
                <p className="text-lg font-bold text-red-800">
                  {maxMonth ? `${maxMonth.month}月 $${fmt(maxMonth.totalCost)}` : '-'}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-4 text-center">
                <TrendingDown className="h-4 w-4 text-green-600 mx-auto mb-1" />
                <p className="text-xs text-green-600">最低月份</p>
                <p className="text-lg font-bold text-green-800">
                  {minMonth ? `${minMonth.month}月 $${fmt(minMonth.totalCost)}` : '-'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 月度趨勢卡片 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">月度成本趨勢</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                  const data = trendData.find(d => d.month === m);
                  const isMax = maxMonth?.month === m;
                  const isMin = minMonth?.month === m;
                  const prevData = trendData.find(d => d.month === m - 1);
                  const change = prevData && data
                    ? ((data.totalCost - prevData.totalCost) / prevData.totalCost * 100)
                    : null;

                  return (
                    <Card
                      key={m}
                      className={`${isMax ? 'border-red-300 bg-red-50' : isMin ? 'border-green-300 bg-green-50' : ''}`}
                    >
                      <CardContent className="pt-3 pb-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-sm font-medium">{m}月</span>
                          {isMax && <Badge variant="destructive" className="text-xs">最高</Badge>}
                          {isMin && <Badge className="text-xs bg-green-600">最低</Badge>}
                        </div>
                        <p className="text-lg font-bold">
                          {data ? `$${fmt(data.totalCost)}` : '-'}
                        </p>
                        {data && (
                          <p className="text-xs text-gray-500">{data.employeeCount} 人</p>
                        )}
                        {change !== null && !isNaN(change) && (
                          <p className={`text-xs mt-1 ${change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
