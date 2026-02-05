/**
 * 稅務報表頁面
 * 營業稅申報表、薪資扣繳表、二代健保補充保費試算
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
import { Receipt, FileText, Users, AlertTriangle, Info } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const fmt = (n: number) => Math.round(n).toLocaleString();

// === 型別定義 ===

interface BusinessTaxItem {
  category: string;
  invoiceCount: number;
  amount: number;
}

interface BusinessTaxData {
  year: number;
  period: number;
  periodLabel: string;
  sales: { items: BusinessTaxItem[]; total: number; tax: number };
  purchases: { items: BusinessTaxItem[]; total: number; tax: number };
  taxPayable: number;
  taxRate: number;
}

interface WithholdingEmployee {
  employeeName: string;
  idNumber: string;
  totalSalary: number;
  totalLaborInsurance: number;
  totalHealthInsurance: number;
  totalPension: number;
  totalDeduction: number;
  totalNetSalary: number;
  monthsWorked: number;
}

interface WithholdingData {
  year: number;
  employees: WithholdingEmployee[];
  totals: { totalSalary: number; totalDeduction: number; totalNetSalary: number };
}

interface SupplementaryEmployee {
  employeeName: string;
  avgMonthlySalary: number;
  estimatedBonus: number;
  taxableAmount: number;
  supplementaryPremium: number;
}

interface SupplementaryData {
  year: number;
  supplementaryRate: number;
  baseWageThreshold: number;
  employees: SupplementaryEmployee[];
  totalPremium: number;
  note: string;
}

export default function TaxReports() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedPeriod, setSelectedPeriod] = useState('1');

  const year = parseInt(selectedYear);
  const period = parseInt(selectedPeriod);
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  // 營業稅
  const { data: businessTax, isLoading: isLoadingBT } = useQuery<BusinessTaxData>({
    queryKey: ['/api/reports/tax/business-tax', year, period],
    queryFn: () =>
      apiRequest('GET', `/api/reports/tax/business-tax?year=${year}&period=${period}`) as Promise<BusinessTaxData>,
  });

  // 薪資扣繳
  const { data: withholding, isLoading: isLoadingWH } = useQuery<WithholdingData>({
    queryKey: ['/api/reports/tax/salary-withholding', year],
    queryFn: () =>
      apiRequest('GET', `/api/reports/tax/salary-withholding?year=${year}`) as Promise<WithholdingData>,
  });

  // 二代健保
  const { data: supplementary, isLoading: isLoadingSH } = useQuery<SupplementaryData>({
    queryKey: ['/api/reports/tax/supplementary-health', year],
    queryFn: () =>
      apiRequest('GET', `/api/reports/tax/supplementary-health?year=${year}`) as Promise<SupplementaryData>,
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 標題 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
            稅務報表
          </h1>
          <p className="text-sm text-gray-500 mt-1">營業稅、薪資扣繳、二代健保試算</p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}年</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 提示卡片 */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">注意事項</p>
            <p className="mt-1">
              本報表為試算參考，實際申報金額請依政府規定和會計師建議為準。
              營業稅稅率以 5% 計算，二代健保補充保費費率以 2.11% 計算。
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="business-tax" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="business-tax">營業稅申報</TabsTrigger>
          <TabsTrigger value="withholding">薪資扣繳</TabsTrigger>
          <TabsTrigger value="supplementary">二代健保</TabsTrigger>
        </TabsList>

        {/* 營業稅申報表 */}
        <TabsContent value="business-tax" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">申報期別：</span>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">第1期（1-2月）</SelectItem>
                <SelectItem value="2">第2期（3-4月）</SelectItem>
                <SelectItem value="3">第3期（5-6月）</SelectItem>
                <SelectItem value="4">第4期（7-8月）</SelectItem>
                <SelectItem value="5">第5期（9-10月）</SelectItem>
                <SelectItem value="6">第6期（11-12月）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoadingBT ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : businessTax ? (
            <>
              {/* 應繳稅額摘要 */}
              <Card className={businessTax.taxPayable >= 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}>
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-gray-600">
                    {year}年 第{period}期（{businessTax.periodLabel}）應繳營業稅
                  </p>
                  <p className={`text-3xl font-bold mt-1 ${businessTax.taxPayable >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                    ${fmt(Math.abs(businessTax.taxPayable))}
                  </p>
                  {businessTax.taxPayable < 0 && (
                    <p className="text-sm text-green-600 mt-1">可退稅或留抵</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 銷項 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-green-700 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      銷項（收入）
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>類別</TableHead>
                          <TableHead className="text-right">筆數</TableHead>
                          <TableHead className="text-right">金額</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {businessTax.sales.items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell>{item.category}</TableCell>
                            <TableCell className="text-right">{item.invoiceCount}</TableCell>
                            <TableCell className="text-right">${fmt(item.amount)}</TableCell>
                          </TableRow>
                        ))}
                        {businessTax.sales.items.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-gray-400">無銷項資料</TableCell>
                          </TableRow>
                        )}
                        <TableRow className="bg-green-50 font-bold">
                          <TableCell>合計</TableCell>
                          <TableCell className="text-right">
                            {businessTax.sales.items.reduce((s, i) => s + i.invoiceCount, 0)}
                          </TableCell>
                          <TableCell className="text-right">${fmt(businessTax.sales.total)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-green-100">
                          <TableCell colSpan={2}>銷項稅額（5%）</TableCell>
                          <TableCell className="text-right font-bold">${fmt(businessTax.sales.tax)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* 進項 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-red-700 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      進項（支出）
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>類別</TableHead>
                          <TableHead className="text-right">筆數</TableHead>
                          <TableHead className="text-right">金額</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {businessTax.purchases.items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell>{item.category}</TableCell>
                            <TableCell className="text-right">{item.invoiceCount}</TableCell>
                            <TableCell className="text-right">${fmt(item.amount)}</TableCell>
                          </TableRow>
                        ))}
                        {businessTax.purchases.items.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-gray-400">無進項資料</TableCell>
                          </TableRow>
                        )}
                        <TableRow className="bg-red-50 font-bold">
                          <TableCell>合計</TableCell>
                          <TableCell className="text-right">
                            {businessTax.purchases.items.reduce((s, i) => s + i.invoiceCount, 0)}
                          </TableCell>
                          <TableCell className="text-right">${fmt(businessTax.purchases.total)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-red-100">
                          <TableCell colSpan={2}>進項稅額（5%）</TableCell>
                          <TableCell className="text-right font-bold">${fmt(businessTax.purchases.tax)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        {/* 薪資扣繳表 */}
        <TabsContent value="withholding" className="space-y-4 mt-4">
          {isLoadingWH ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : withholding ? (
            <>
              {/* 年度彙總 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-blue-600">年度薪資總額</p>
                    <p className="text-xl font-bold text-blue-800">${fmt(withholding.totals.totalSalary)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-orange-600">年度扣繳總額</p>
                    <p className="text-xl font-bold text-orange-800">${fmt(withholding.totals.totalDeduction)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4 text-center">
                    <p className="text-xs text-green-600">年度實發總額</p>
                    <p className="text-xl font-bold text-green-800">${fmt(withholding.totals.totalNetSalary)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* 員工明細 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {year}年度 各類所得扣繳暨免扣繳憑單彙總
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>員工姓名</TableHead>
                          <TableHead className="text-right">身分證</TableHead>
                          <TableHead className="text-right">在職月數</TableHead>
                          <TableHead className="text-right">年度薪資</TableHead>
                          <TableHead className="text-right">勞保扣繳</TableHead>
                          <TableHead className="text-right">健保扣繳</TableHead>
                          <TableHead className="text-right">自提勞退</TableHead>
                          <TableHead className="text-right">扣繳合計</TableHead>
                          <TableHead className="text-right">實發金額</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withholding.employees.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{e.employeeName}</TableCell>
                            <TableCell className="text-right text-gray-400 text-xs">{e.idNumber || '-'}</TableCell>
                            <TableCell className="text-right">{e.monthsWorked}</TableCell>
                            <TableCell className="text-right">${fmt(e.totalSalary)}</TableCell>
                            <TableCell className="text-right text-orange-600">${fmt(e.totalLaborInsurance)}</TableCell>
                            <TableCell className="text-right text-orange-600">${fmt(e.totalHealthInsurance)}</TableCell>
                            <TableCell className="text-right text-purple-600">${fmt(e.totalPension)}</TableCell>
                            <TableCell className="text-right font-medium text-red-600">${fmt(e.totalDeduction)}</TableCell>
                            <TableCell className="text-right font-medium text-green-600">${fmt(e.totalNetSalary)}</TableCell>
                          </TableRow>
                        ))}
                        {withholding.employees.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center text-gray-400 py-8">
                              {year}年度尚無薪資資料
                            </TableCell>
                          </TableRow>
                        )}
                        {withholding.employees.length > 0 && (
                          <TableRow className="bg-gray-100 font-bold">
                            <TableCell>合計 ({withholding.employees.length} 人)</TableCell>
                            <TableCell />
                            <TableCell />
                            <TableCell className="text-right">${fmt(withholding.totals.totalSalary)}</TableCell>
                            <TableCell className="text-right" colSpan={3}>-</TableCell>
                            <TableCell className="text-right text-red-700">${fmt(withholding.totals.totalDeduction)}</TableCell>
                            <TableCell className="text-right text-green-700">${fmt(withholding.totals.totalNetSalary)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* 二代健保補充保費 */}
        <TabsContent value="supplementary" className="space-y-4 mt-4">
          {isLoadingSH ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : supplementary ? (
            <>
              {/* 說明 */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4 flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">二代健保補充保費說明</p>
                    <p className="mt-1">
                      費率：{(supplementary.supplementaryRate * 100).toFixed(2)}% ｜
                      起扣門檻：${fmt(supplementary.baseWageThreshold)}（基本工資）
                    </p>
                    <p className="mt-1 text-blue-600">{supplementary.note}</p>
                  </div>
                </CardContent>
              </Card>

              {/* 預估總額 */}
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-purple-600">預估年度補充保費</p>
                  <p className="text-3xl font-bold text-purple-800 mt-1">
                    ${fmt(supplementary.totalPremium)}
                  </p>
                </CardContent>
              </Card>

              {/* 員工明細 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{year}年度 補充保費試算明細</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>員工姓名</TableHead>
                          <TableHead className="text-right">平均月薪</TableHead>
                          <TableHead className="text-right">估計年終</TableHead>
                          <TableHead className="text-right">課稅金額</TableHead>
                          <TableHead className="text-right">補充保費</TableHead>
                          <TableHead className="text-center">狀態</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplementary.employees.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{e.employeeName}</TableCell>
                            <TableCell className="text-right">${fmt(e.avgMonthlySalary)}</TableCell>
                            <TableCell className="text-right">${fmt(e.estimatedBonus)}</TableCell>
                            <TableCell className="text-right">
                              {e.taxableAmount > 0 ? `$${fmt(e.taxableAmount)}` : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-purple-600">
                              {e.supplementaryPremium > 0 ? `$${fmt(e.supplementaryPremium)}` : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={e.taxableAmount > 0 ? 'destructive' : 'secondary'} className="text-xs">
                                {e.taxableAmount > 0 ? '需扣繳' : '免扣繳'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {supplementary.employees.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                              {year}年度尚無員工資料
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
