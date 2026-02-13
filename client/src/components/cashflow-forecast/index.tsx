// 現金流預測 - 主元件
import { useState } from 'react';
import { TrendingUp, TrendingDown, Calendar, DollarSign, AlertTriangle, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { CashflowForecastProps, CategoryVisibility } from './types';
import { CATEGORY_COLORS, CATEGORY_LABELS, formatCurrency } from './types';
import { useCashflowData } from './use-cashflow-data';
import { DetailPopover, PaidDetailPopover } from './detail-popovers';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: ${entry.value.toLocaleString()}
          </p>
        ))}
        <p className="text-sm font-medium mt-1 pt-1 border-t">
          總計: ${payload.reduce((sum: number, p) => sum + p.value, 0).toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export default function CashflowForecast({
  items,
  schedules = [],
  budgetPlans = [],
  paymentRecords = [],
  monthsToForecast = 6,
  className = '',
}: CashflowForecastProps) {
  const [visibility, setVisibility] = useState<CategoryVisibility>({
    budget: true, scheduled: true, estimated: true, recurring: true, paid: true,
  });

  const toggleCategory = (category: keyof CategoryVisibility) => {
    setVisibility(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const { forecastData, stats } = useCashflowData({
    items, schedules, budgetPlans, paymentRecords, monthsToForecast, visibility,
  });

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 類別篩選 */}
      <Card className="bg-gradient-to-r from-gray-50 to-white" data-testid="card-category-filter">
        <CardContent className="p-3 sm:pt-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-700">
              <Settings2 className="h-4 w-4" />
              顯示類別
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              {(Object.keys(visibility) as Array<keyof CategoryVisibility>).map((category) => (
                <div key={category} className="flex items-center space-x-1.5 sm:space-x-2">
                  <Checkbox
                    id={`toggle-${category}`}
                    checked={visibility[category]}
                    onCheckedChange={() => toggleCategory(category)}
                    data-testid={`checkbox-${category}`}
                  />
                  <Label htmlFor={`toggle-${category}`} className="flex items-center gap-1 sm:gap-1.5 cursor-pointer text-xs sm:text-sm">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[category] }} />
                    <span className="whitespace-nowrap">{CATEGORY_LABELS[category]}</span>
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card data-testid="card-forecast-total">
          <CardContent className="p-3 sm:pt-4 sm:px-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">未來{monthsToForecast}個月</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">${stats.totalForecast.toLocaleString()}</p>
              </div>
              <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-forecast-avg">
          <CardContent className="p-3 sm:pt-4 sm:px-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">月均支出</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">${Math.round(stats.avgMonthly).toLocaleString()}</p>
              </div>
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-forecast-peak">
          <CardContent className="p-3 sm:pt-4 sm:px-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">支出高峰</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-600">{stats.maxMonth?.monthLabel}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 truncate">${stats.maxMonth?.total.toLocaleString()}</p>
              </div>
              <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-forecast-trend">
          <CardContent className="p-3 sm:pt-4 sm:px-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">下月趨勢</p>
                <p className={`text-lg sm:text-2xl font-bold ${stats.trend >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.trend >= 0 ? '+' : ''}{stats.trendPercent.toFixed(0)}%
                </p>
              </div>
              {stats.trend >= 0
                ? <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 flex-shrink-0" />
                : <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 flex-shrink-0" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 圖表 */}
      <Card data-testid="card-forecast-chart">
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
          <CardTitle className="flex items-center text-base sm:text-lg">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            現金流預測圖表
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="h-[200px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {visibility.paid && <Bar dataKey="paid" name="已付款" stackId="a" fill={CATEGORY_COLORS.paid} />}
                {visibility.budget && <Bar dataKey="budget" name="預算" stackId="a" fill={CATEGORY_COLORS.budget} />}
                {visibility.scheduled && <Bar dataKey="scheduled" name="已排程" stackId="a" fill={CATEGORY_COLORS.scheduled} />}
                {visibility.estimated && <Bar dataKey="estimated" name="預估到期" stackId="a" fill={CATEGORY_COLORS.estimated} />}
                {visibility.recurring && <Bar dataKey="recurring" name="月付固定" stackId="a" fill={CATEGORY_COLORS.recurring} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 月度明細表 */}
      <Card data-testid="card-forecast-table">
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-base sm:text-lg">
            <span>月度明細</span>
            <span className="text-xs sm:text-sm font-normal text-gray-500">點擊金額查看詳細項目</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 w-24">月份</th>
                  {visibility.paid && <th className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.paid }}>已付款</th>}
                  {visibility.budget && <th className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.budget }}>預算</th>}
                  {visibility.scheduled && <th className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.scheduled }}>已排程</th>}
                  {visibility.estimated && <th className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.estimated }}>預估到期</th>}
                  {visibility.recurring && <th className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.recurring }}>月付固定</th>}
                  <th className="text-right py-2 px-3 w-28 font-bold">總計</th>
                </tr>
              </thead>
              <tbody>
                {forecastData.map((month, index) => (
                  <tr key={month.month} className={`border-b hover:bg-gray-50 ${index === 0 ? 'bg-blue-50' : ''}`}>
                    <td className="py-2 px-3 font-medium w-24">
                      <div className="flex items-center gap-1">
                        {month.monthLabel}
                        {index === 0 && <Badge className="text-xs" variant="outline">本月</Badge>}
                      </div>
                    </td>
                    {visibility.paid && (
                      <td className="text-right py-2 px-3 w-28">
                        <PaidDetailPopover paidCurrent={month.details.paidCurrent} paidCarryOver={month.details.paidCarryOver} totalAmount={month.paid} />
                      </td>
                    )}
                    {visibility.budget && <td className="text-right py-2 px-3 w-28"><DetailPopover details={month.details.budget} category="budget" amount={month.budget} /></td>}
                    {visibility.scheduled && <td className="text-right py-2 px-3 w-28"><DetailPopover details={month.details.scheduled} category="scheduled" amount={month.scheduled} /></td>}
                    {visibility.estimated && <td className="text-right py-2 px-3 w-28"><DetailPopover details={month.details.estimated} category="estimated" amount={month.estimated} /></td>}
                    {visibility.recurring && <td className="text-right py-2 px-3 w-28"><DetailPopover details={month.details.recurring} category="recurring" amount={month.recurring} /></td>}
                    <td className="text-right py-2 px-3 w-28 font-bold">${month.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="py-2 px-3 w-24">合計</td>
                  {visibility.paid && <td className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.paid }}>${forecastData.reduce((sum, m) => sum + m.paid, 0).toLocaleString()}</td>}
                  {visibility.budget && <td className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.budget }}>${forecastData.reduce((sum, m) => sum + m.budget, 0).toLocaleString()}</td>}
                  {visibility.scheduled && <td className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.scheduled }}>${forecastData.reduce((sum, m) => sum + m.scheduled, 0).toLocaleString()}</td>}
                  {visibility.estimated && <td className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.estimated }}>${forecastData.reduce((sum, m) => sum + m.estimated, 0).toLocaleString()}</td>}
                  {visibility.recurring && <td className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.recurring }}>${forecastData.reduce((sum, m) => sum + m.recurring, 0).toLocaleString()}</td>}
                  <td className="text-right py-2 px-3 w-28">${stats.totalForecast.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
