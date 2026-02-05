/**
 * 財務三表頁面
 * 損益表、資產負債表、現金流量表
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Banknote,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const fmt = (n: number) => Math.round(n).toLocaleString();

interface ReportItem {
  category: string;
  amount: number;
}

interface IncomeStatementData {
  year: number;
  month: number;
  income: { items: ReportItem[]; total: number };
  expense: { items: ReportItem[]; total: number };
  netIncome: number;
}

interface BalanceSheetData {
  year: number;
  month: number;
  assets: { items: ReportItem[]; total: number };
  liabilities: { items: ReportItem[]; total: number };
  netWorth: number;
}

interface CashFlowData {
  year: number;
  month: number;
  operating: { items: ReportItem[]; total: number };
  investing: { items: ReportItem[]; total: number };
  financing: { items: ReportItem[]; total: number };
  netCashFlow: number;
}

export default function FinancialStatements() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const prevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const nextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  // 損益表
  const { data: incomeStatement, isLoading: isLoadingIncome } = useQuery<IncomeStatementData>({
    queryKey: ['/api/reports/income-statement', year, month],
    queryFn: () => apiRequest('GET', `/api/reports/income-statement?year=${year}&month=${month}`) as Promise<IncomeStatementData>,
  });

  // 資產負債表
  const { data: balanceSheet, isLoading: isLoadingBalance } = useQuery<BalanceSheetData>({
    queryKey: ['/api/reports/balance-sheet', year, month],
    queryFn: () => apiRequest('GET', `/api/reports/balance-sheet?year=${year}&month=${month}`) as Promise<BalanceSheetData>,
  });

  // 現金流量表
  const { data: cashFlow, isLoading: isLoadingCashFlow } = useQuery<CashFlowData>({
    queryKey: ['/api/reports/cash-flow', year, month],
    queryFn: () => apiRequest('GET', `/api/reports/cash-flow?year=${year}&month=${month}`) as Promise<CashFlowData>,
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 標題和月份控制 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
            財務三表
          </h1>
          <p className="text-sm text-gray-500 mt-1">損益表、資產負債表、現金流量表</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm sm:text-lg font-semibold min-w-[100px] text-center">
            {year}年{String(month).padStart(2, '0')}月
          </span>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="income-statement" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="income-statement">損益表</TabsTrigger>
          <TabsTrigger value="balance-sheet">資產負債表</TabsTrigger>
          <TabsTrigger value="cash-flow">現金流量表</TabsTrigger>
        </TabsList>

        {/* 損益表 */}
        <TabsContent value="income-statement" className="space-y-4 mt-4">
          {isLoadingIncome ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : incomeStatement ? (
            <>
              {/* 摘要卡片 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4 text-center">
                    <TrendingUp className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <p className="text-xs text-green-600">營業收入</p>
                    <p className="text-xl font-bold text-green-800">${fmt(incomeStatement.income.total)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4 text-center">
                    <TrendingDown className="h-5 w-5 text-red-600 mx-auto mb-1" />
                    <p className="text-xs text-red-600">營業支出</p>
                    <p className="text-xl font-bold text-red-800">${fmt(incomeStatement.expense.total)}</p>
                  </CardContent>
                </Card>
                <Card className={incomeStatement.netIncome >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}>
                  <CardContent className="pt-4 text-center">
                    <DollarSign className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                    <p className="text-xs text-blue-600">本期損益</p>
                    <p className={`text-xl font-bold ${incomeStatement.netIncome >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                      {incomeStatement.netIncome >= 0 ? '' : '-'}${fmt(Math.abs(incomeStatement.netIncome))}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* 收入明細 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-green-700">
                    <TrendingUp className="h-4 w-4" />
                    營業收入
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>項目</TableHead>
                        <TableHead className="text-right">金額</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomeStatement.income.items.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>{item.category}</TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            ${fmt(item.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {incomeStatement.income.items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-gray-400">本月無收入</TableCell>
                        </TableRow>
                      )}
                      <TableRow className="bg-green-50 font-bold">
                        <TableCell>收入合計</TableCell>
                        <TableCell className="text-right text-green-700">${fmt(incomeStatement.income.total)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* 支出明細 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-red-700">
                    <TrendingDown className="h-4 w-4" />
                    營業支出
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>項目</TableHead>
                        <TableHead className="text-right">金額</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomeStatement.expense.items.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>{item.category}</TableCell>
                          <TableCell className="text-right text-red-600 font-medium">
                            ${fmt(item.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {incomeStatement.expense.items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-gray-400">本月無支出</TableCell>
                        </TableRow>
                      )}
                      <TableRow className="bg-red-50 font-bold">
                        <TableCell>支出合計</TableCell>
                        <TableCell className="text-right text-red-700">${fmt(incomeStatement.expense.total)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* 損益合計 */}
              <Card className={incomeStatement.netIncome >= 0 ? 'border-blue-300 bg-blue-50' : 'border-orange-300 bg-orange-50'}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">本期損益</span>
                    <span className={`text-2xl font-bold ${incomeStatement.netIncome >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                      {incomeStatement.netIncome >= 0 ? '+' : '-'}${fmt(Math.abs(incomeStatement.netIncome))}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* 資產負債表 */}
        <TabsContent value="balance-sheet" className="space-y-4 mt-4">
          {isLoadingBalance ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : balanceSheet ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4 text-center">
                    <Building2 className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                    <p className="text-xs text-blue-600">資產總額</p>
                    <p className="text-xl font-bold text-blue-800">${fmt(balanceSheet.assets.total)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4 text-center">
                    <Banknote className="h-5 w-5 text-red-600 mx-auto mb-1" />
                    <p className="text-xs text-red-600">負債總額</p>
                    <p className="text-xl font-bold text-red-800">${fmt(balanceSheet.liabilities.total)}</p>
                  </CardContent>
                </Card>
                <Card className={balanceSheet.netWorth >= 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}>
                  <CardContent className="pt-4 text-center">
                    <DollarSign className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <p className="text-xs text-green-600">淨值</p>
                    <p className={`text-xl font-bold ${balanceSheet.netWorth >= 0 ? 'text-green-800' : 'text-orange-800'}`}>
                      ${fmt(balanceSheet.netWorth)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 資產 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-blue-700">
                      <Building2 className="h-4 w-4" />
                      資產
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>項目</TableHead>
                          <TableHead className="text-right">金額</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {balanceSheet.assets.items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell>{item.category}</TableCell>
                            <TableCell className="text-right font-medium">${fmt(item.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-blue-50 font-bold">
                          <TableCell>資產合計</TableCell>
                          <TableCell className="text-right text-blue-700">${fmt(balanceSheet.assets.total)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* 負債 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-red-700">
                      <Banknote className="h-4 w-4" />
                      負債
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>項目</TableHead>
                          <TableHead className="text-right">金額</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {balanceSheet.liabilities.items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell>{item.category}</TableCell>
                            <TableCell className="text-right font-medium text-red-600">${fmt(item.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-red-50 font-bold">
                          <TableCell>負債合計</TableCell>
                          <TableCell className="text-right text-red-700">${fmt(balanceSheet.liabilities.total)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <Card className={balanceSheet.netWorth >= 0 ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">淨值（資產 - 負債）</span>
                    <span className={`text-2xl font-bold ${balanceSheet.netWorth >= 0 ? 'text-green-700' : 'text-orange-700'}`}>
                      ${fmt(balanceSheet.netWorth)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* 現金流量表 */}
        <TabsContent value="cash-flow" className="space-y-4 mt-4">
          {isLoadingCashFlow ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : cashFlow ? (
            <>
              {/* 淨現金流摘要 */}
              <Card className={cashFlow.netCashFlow >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-gray-600">本月淨現金流</p>
                  <p className={`text-3xl font-bold mt-1 ${cashFlow.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {cashFlow.netCashFlow >= 0 ? '+' : ''}${fmt(cashFlow.netCashFlow)}
                  </p>
                </CardContent>
              </Card>

              {/* 三區塊 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 營業現金流 */}
                <CashFlowSection
                  title="營業活動"
                  icon={<DollarSign className="h-4 w-4" />}
                  items={cashFlow.operating.items}
                  total={cashFlow.operating.total}
                  color="blue"
                />

                {/* 投資現金流 */}
                <CashFlowSection
                  title="投資活動"
                  icon={<TrendingUp className="h-4 w-4" />}
                  items={cashFlow.investing.items}
                  total={cashFlow.investing.total}
                  color="purple"
                />

                {/* 融資現金流 */}
                <CashFlowSection
                  title="融資活動"
                  icon={<Banknote className="h-4 w-4" />}
                  items={cashFlow.financing.items}
                  total={cashFlow.financing.total}
                  color="orange"
                />
              </div>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// 現金流量子區塊
function CashFlowSection({
  title,
  icon,
  items,
  total,
  color,
}: {
  title: string;
  icon: React.ReactNode;
  items: ReportItem[];
  total: number;
  color: 'blue' | 'purple' | 'orange';
}) {
  const colorMap = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', totalBg: 'bg-blue-100' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', totalBg: 'bg-purple-100' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', totalBg: 'bg-orange-100' },
  };
  const c = colorMap[color];

  return (
    <Card className={`${c.border}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm flex items-center gap-2 ${c.text}`}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-gray-600">{item.category}</span>
            <span className={item.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
              {item.amount >= 0 ? '+' : ''}${fmt(item.amount)}
            </span>
          </div>
        ))}
        <Separator />
        <div className={`flex justify-between font-bold text-sm p-2 rounded ${c.totalBg}`}>
          <span>小計</span>
          <span className={total >= 0 ? 'text-green-700' : 'text-red-700'}>
            {total >= 0 ? '+' : ''}${fmt(total)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
