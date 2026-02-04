import { useMemo, useState } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Calendar, DollarSign, AlertTriangle, Settings2, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface PaymentItem {
  id: number;
  itemName: string;
  totalAmount: string;
  paidAmount?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  projectName?: string;
  paymentType?: string;
}

interface Schedule {
  id: number;
  paymentItemId: number;
  scheduledDate: string;
  scheduledAmount: string;
  status?: string;
  itemName?: string;
}

interface CashflowPaymentRecord {
  id: number;
  itemId: number;
  itemName: string;
  amountPaid: string;
  paymentDate: string;
  paymentMonth: string;
  dueDate: string | null;
  dueMonth: string;
  isCurrentMonthItem: boolean;
  originLabel: string;
  projectName: string | null;
  paymentMethod: string | null;
}

interface BudgetItem {
  id: number;
  itemName: string;
  plannedAmount: string;
  actualAmount?: string | null;
  paymentType?: string;
  monthlyAmount?: string | null;
  monthCount?: string | null;
  installmentCount?: string | null;
  installmentAmount?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  isConverted?: boolean;
  budgetPlanName?: string;
}

interface BudgetPlan {
  id: number;
  planName: string;
  budgetPeriod: string;
  startDate: string;
  endDate: string;
  totalBudget: string;
  items?: BudgetItem[];
}

interface CashflowForecastProps {
  items: PaymentItem[];
  schedules?: Schedule[];
  budgetPlans?: BudgetPlan[];
  paymentRecords?: CashflowPaymentRecord[];
  monthsToForecast?: number;
  className?: string;
}

interface DetailItem {
  id: number;
  name: string;
  amount: number;
  date?: string;
  project?: string;
}

interface PaidDetailItem extends DetailItem {
  isCurrentMonthItem: boolean;
  originLabel: string;
}

interface MonthlyDetails {
  budget: DetailItem[];
  scheduled: DetailItem[];
  estimated: DetailItem[];
  recurring: DetailItem[];
  paidCurrent: PaidDetailItem[];
  paidCarryOver: PaidDetailItem[];
}

interface MonthlyForecast {
  month: string;
  monthLabel: string;
  budget: number;
  scheduled: number;
  estimated: number;
  recurring: number;
  paidCurrent: number;
  paidCarryOver: number;
  paid: number;
  total: number;
  details: MonthlyDetails;
}

interface CategoryVisibility {
  budget: boolean;
  scheduled: boolean;
  estimated: boolean;
  recurring: boolean;
  paid: boolean;
}

const CATEGORY_COLORS = {
  budget: '#8B5CF6',
  scheduled: '#3B82F6',
  estimated: '#F59E0B',
  recurring: '#10B981',
  paid: '#6B7280',
};

const CATEGORY_LABELS = {
  budget: '預算',
  scheduled: '已排程',
  estimated: '預估到期',
  recurring: '月付固定',
  paid: '已付款',
};

const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
};

export default function CashflowForecast({
  items,
  schedules = [],
  budgetPlans = [],
  paymentRecords = [],
  monthsToForecast = 6,
  className = '',
}: CashflowForecastProps) {
  const today = new Date();
  
  const [visibility, setVisibility] = useState<CategoryVisibility>({
    budget: true,
    scheduled: true,
    estimated: true,
    recurring: true,
    paid: true,
  });

  const toggleCategory = (category: keyof CategoryVisibility) => {
    setVisibility(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const forecastData = useMemo<MonthlyForecast[]>(() => {
    const months: MonthlyForecast[] = [];
    
    for (let i = 0; i < monthsToForecast; i++) {
      const monthDate = addMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, 'M月', { locale: zhTW });

      let budget = 0;
      let scheduled = 0;
      let estimated = 0;
      let recurring = 0;
      let paidCurrent = 0;
      let paidCarryOver = 0;
      
      const details: MonthlyDetails = {
        budget: [],
        scheduled: [],
        estimated: [],
        recurring: [],
        paidCurrent: [],
        paidCarryOver: [],
      };

      budgetPlans.forEach(plan => {
        const planItems = plan.items || [];
        planItems.forEach(item => {
          if (item.isConverted || item.status === 'converted') return;
          
          const paymentType = item.paymentType || 'single';
          const itemStartDate = item.startDate ? new Date(item.startDate) : null;
          const itemEndDate = item.endDate ? new Date(item.endDate) : null;
          
          if (paymentType === 'monthly') {
            // 月付款項：月付金額 × 月數，分配到各月
            const monthlyAmt = safeParseFloat(item.monthlyAmount);
            const monthCnt = parseInt(item.monthCount || '1') || 1;
            if (monthlyAmt <= 0) return;
            
            const startMonth = itemStartDate ? startOfMonth(itemStartDate) : startOfMonth(new Date(plan.startDate));
            
            // 檢查當前月份是否在付款範圍內
            let monthIndex = 0;
            let tempMonth = new Date(startMonth);
            while (monthIndex < monthCnt) {
              if (format(tempMonth, 'yyyy-MM') === monthKey) {
                budget += monthlyAmt;
                details.budget.push({
                  id: item.id,
                  name: `${item.itemName} (月付 ${monthIndex + 1}/${monthCnt})`,
                  amount: monthlyAmt,
                  date: format(endOfMonth(tempMonth), 'yyyy-MM-dd'),
                  project: plan.planName,
                });
                break;
              }
              monthIndex++;
              tempMonth = addMonths(tempMonth, 1);
            }
          } else if (paymentType === 'installment') {
            // 分期付款：總金額 ÷ 期數，分配到各期
            const totalAmount = safeParseFloat(item.plannedAmount);
            const installCnt = parseInt(item.installmentCount || '1') || 1;
            const installAmt = safeParseFloat(item.installmentAmount) || (totalAmount / installCnt);
            if (installAmt <= 0) return;
            
            const startMonth = itemStartDate ? startOfMonth(itemStartDate) : startOfMonth(new Date(plan.startDate));
            
            // 檢查當前月份是否在付款範圍內
            for (let inst = 0; inst < installCnt; inst++) {
              const installMonth = addMonths(startMonth, inst);
              if (format(installMonth, 'yyyy-MM') === monthKey) {
                budget += installAmt;
                details.budget.push({
                  id: item.id,
                  name: `${item.itemName} (第${inst + 1}期/${installCnt}期)`,
                  amount: installAmt,
                  date: format(endOfMonth(installMonth), 'yyyy-MM-dd'),
                  project: plan.planName,
                });
                break;
              }
            }
          } else {
            // 一次性付款：在預計付款日期顯示
            const totalAmount = safeParseFloat(item.plannedAmount);
            if (totalAmount <= 0) return;
            
            const targetDate = itemEndDate || itemStartDate;
            if (targetDate && isWithinInterval(targetDate, { start: monthStart, end: monthEnd })) {
              budget += totalAmount;
              details.budget.push({
                id: item.id,
                name: `${item.itemName} (一次性)`,
                amount: totalAmount,
                date: format(targetDate, 'yyyy-MM-dd'),
                project: plan.planName,
              });
            }
          }
        });
      });

      schedules.forEach(schedule => {
        if (schedule.status === 'completed') return;
        const scheduleDate = new Date(schedule.scheduledDate);
        if (isWithinInterval(scheduleDate, { start: monthStart, end: monthEnd })) {
          const amount = safeParseFloat(schedule.scheduledAmount);
          scheduled += amount;
          details.scheduled.push({
            id: schedule.id,
            name: schedule.itemName || `排程 #${schedule.paymentItemId}`,
            amount,
            date: schedule.scheduledDate,
          });
        }
      });

      // 處理未完成的付款項目（預估到期/月付固定）
      items.forEach(item => {
        if (item.status === 'paid') return;
        
        const dueDate = item.endDate ? new Date(item.endDate) : item.startDate ? new Date(item.startDate) : null;

        if (dueDate && isWithinInterval(dueDate, { start: monthStart, end: monthEnd })) {
          const total = safeParseFloat(item.totalAmount);
          const paidAmt = safeParseFloat(item.paidAmount);
          const pending = total - paidAmt;
          if (pending > 0) {
            if (item.paymentType === 'monthly') {
              recurring += pending;
              details.recurring.push({
                id: item.id,
                name: item.itemName,
                amount: pending,
                date: item.endDate || item.startDate,
                project: item.projectName,
              });
            } else {
              estimated += pending;
              details.estimated.push({
                id: item.id,
                name: item.itemName,
                amount: pending,
                date: item.endDate || item.startDate,
                project: item.projectName,
              });
            }
          }
        }
      });

      // 從付款記錄取得已付款資料（分為本月項目和他月項目）
      paymentRecords.forEach(record => {
        if (record.paymentMonth !== monthKey) return;
        
        const amount = safeParseFloat(record.amountPaid);
        if (amount <= 0) return;
        
        const paidItem: PaidDetailItem = {
          id: record.id,
          name: record.itemName,
          amount,
          date: record.paymentDate,
          project: record.projectName || undefined,
          isCurrentMonthItem: record.isCurrentMonthItem,
          originLabel: record.originLabel,
        };
        
        if (record.isCurrentMonthItem) {
          paidCurrent += amount;
          details.paidCurrent.push(paidItem);
        } else {
          paidCarryOver += amount;
          details.paidCarryOver.push(paidItem);
        }
      });

      const paid = paidCurrent + paidCarryOver;

      const visibleTotal = 
        (visibility.budget ? budget : 0) +
        (visibility.scheduled ? scheduled : 0) +
        (visibility.estimated ? estimated : 0) +
        (visibility.recurring ? recurring : 0) +
        (visibility.paid ? paid : 0);

      months.push({
        month: monthKey,
        monthLabel,
        budget,
        scheduled,
        estimated,
        recurring,
        paidCurrent,
        paidCarryOver,
        paid,
        total: visibleTotal,
        details,
      });
    }

    return months;
  }, [items, schedules, budgetPlans, paymentRecords, monthsToForecast, today, visibility]);

  const stats = useMemo(() => {
    const totalForecast = forecastData.reduce((sum, m) => sum + m.total, 0);
    const avgMonthly = totalForecast / monthsToForecast;
    const maxMonth = forecastData.reduce((max, m) => m.total > max.total ? m : max, forecastData[0]);
    const minMonth = forecastData.reduce((min, m) => m.total < min.total ? m : min, forecastData[0]);
    
    const currentMonthTotal = forecastData[0]?.total || 0;
    const nextMonthTotal = forecastData[1]?.total || 0;
    const trend = nextMonthTotal - currentMonthTotal;
    const trendPercent = currentMonthTotal > 0 ? (trend / currentMonthTotal) * 100 : 0;

    return {
      totalForecast,
      avgMonthly,
      maxMonth,
      minMonth,
      trend,
      trendPercent,
    };
  }, [forecastData, monthsToForecast]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toFixed(0);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: ${entry.value.toLocaleString()}
            </p>
          ))}
          <p className="text-sm font-medium mt-1 pt-1 border-t">
            總計: ${payload.reduce((sum: number, p: any) => sum + p.value, 0).toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  const DetailPopover = ({ details, category, amount }: { 
    details: DetailItem[], 
    category: keyof typeof CATEGORY_LABELS,
    amount: number 
  }) => {
    if (details.length === 0 || amount === 0) {
      return <span>${amount.toLocaleString()}</span>;
    }

    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button 
            className="text-left hover:underline cursor-pointer flex items-center gap-1"
            style={{ color: CATEGORY_COLORS[category] }}
            data-testid={`hover-${category}`}
          >
            ${amount.toLocaleString()}
            <Info className="h-3 w-3 opacity-50" />
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80" align="start">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: CATEGORY_COLORS[category] }}
              />
              <h4 className="font-semibold text-sm">{CATEGORY_LABELS[category]} 明細</h4>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {details.map((item, idx) => (
                <div 
                  key={`${item.id}-${idx}`} 
                  className="flex justify-between items-start text-sm p-2 bg-gray-50 rounded"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    {item.project && (
                      <p className="text-xs text-gray-500 truncate">{item.project}</p>
                    )}
                    {item.date && (
                      <p className="text-xs text-gray-400">
                        {format(new Date(item.date), 'MM/dd')}
                      </p>
                    )}
                  </div>
                  <span className="font-medium ml-2" style={{ color: CATEGORY_COLORS[category] }}>
                    ${item.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t flex justify-between text-sm font-medium">
              <span>小計 ({details.length} 項)</span>
              <span style={{ color: CATEGORY_COLORS[category] }}>
                ${amount.toLocaleString()}
              </span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  // 已付款專用的明細彈出視窗（分本月/他月項目）
  const PaidDetailPopover = ({ 
    paidCurrent, 
    paidCarryOver, 
    totalAmount 
  }: { 
    paidCurrent: PaidDetailItem[];
    paidCarryOver: PaidDetailItem[];
    totalAmount: number;
  }) => {
    const totalItems = paidCurrent.length + paidCarryOver.length;
    
    if (totalItems === 0 || totalAmount === 0) {
      return <span>${totalAmount.toLocaleString()}</span>;
    }

    const currentTotal = paidCurrent.reduce((sum, item) => sum + item.amount, 0);
    const carryOverTotal = paidCarryOver.reduce((sum, item) => sum + item.amount, 0);

    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button 
            className="text-left hover:underline cursor-pointer flex items-center gap-1"
            style={{ color: CATEGORY_COLORS.paid }}
            data-testid="hover-paid"
          >
            ${totalAmount.toLocaleString()}
            <Info className="h-3 w-3 opacity-50" />
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-96" align="start">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: CATEGORY_COLORS.paid }}
              />
              <h4 className="font-semibold text-sm">已付款 明細</h4>
            </div>
            
            {/* 本月項目區塊 */}
            {paidCurrent.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                  本月項目
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1 pl-4">
                  {paidCurrent.map((item, idx) => (
                    <div 
                      key={`current-${item.id}-${idx}`} 
                      className="flex justify-between items-start text-sm p-2 bg-gray-50 rounded"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        {item.project && (
                          <p className="text-xs text-gray-500 truncate">{item.project}</p>
                        )}
                        {item.date && (
                          <p className="text-xs text-gray-400">
                            {format(new Date(item.date), 'MM/dd')}
                          </p>
                        )}
                      </div>
                      <span className="font-medium ml-2 text-gray-600">
                        ${item.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 pl-4">
                  <span>小計 ({paidCurrent.length} 項)</span>
                  <span>${currentTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
            
            {/* 他月項目區塊（延遲付款） */}
            {paidCarryOver.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  他月項目 (延遲付款)
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1 pl-4">
                  {paidCarryOver.map((item, idx) => (
                    <div 
                      key={`carryover-${item.id}-${idx}`} 
                      className="flex justify-between items-start text-sm p-2 bg-orange-50 rounded border-l-2 border-orange-300"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {item.name}
                          <span className="ml-1 text-xs text-orange-500">({item.originLabel})</span>
                        </p>
                        {item.project && (
                          <p className="text-xs text-gray-500 truncate">{item.project}</p>
                        )}
                        {item.date && (
                          <p className="text-xs text-gray-400">
                            付款: {format(new Date(item.date), 'MM/dd')}
                          </p>
                        )}
                      </div>
                      <span className="font-medium ml-2 text-orange-600">
                        ${item.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-orange-500 pl-4">
                  <span>小計 ({paidCarryOver.length} 項)</span>
                  <span>${carryOverTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
            
            <div className="pt-2 border-t flex justify-between text-sm font-medium">
              <span>總計 ({totalItems} 項)</span>
              <span style={{ color: CATEGORY_COLORS.paid }}>
                ${totalAmount.toLocaleString()}
              </span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  const visibleCategories = Object.entries(visibility)
    .filter(([_, v]) => v)
    .map(([k]) => k as keyof CategoryVisibility);

  return (
    <div className={`space-y-4 ${className}`}>
      <Card className="bg-gradient-to-r from-gray-50 to-white" data-testid="card-category-filter">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Settings2 className="h-4 w-4" />
              顯示類別
            </div>
            <div className="flex items-center gap-6">
              {(Object.keys(visibility) as Array<keyof CategoryVisibility>).map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={`toggle-${category}`}
                    checked={visibility[category]}
                    onCheckedChange={() => toggleCategory(category)}
                    data-testid={`checkbox-${category}`}
                  />
                  <Label
                    htmlFor={`toggle-${category}`}
                    className="flex items-center gap-1.5 cursor-pointer text-sm"
                  >
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: CATEGORY_COLORS[category] }}
                    />
                    {CATEGORY_LABELS[category]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-4">
        <Card data-testid="card-forecast-total">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">未來{monthsToForecast}個月預估支出</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.totalForecast.toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-forecast-avg">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">月均支出</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${Math.round(stats.avgMonthly).toLocaleString()}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-forecast-peak">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">支出高峰</p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.maxMonth?.monthLabel}
                </p>
                <p className="text-xs text-gray-500">
                  ${stats.maxMonth?.total.toLocaleString()}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-forecast-trend">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">下月趨勢</p>
                <div className="flex items-center">
                  <p className={`text-2xl font-bold ${stats.trend >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {stats.trend >= 0 ? '+' : ''}{stats.trendPercent.toFixed(0)}%
                  </p>
                </div>
              </div>
              {stats.trend >= 0 ? (
                <TrendingUp className="h-8 w-8 text-red-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-green-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-forecast-chart">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <TrendingUp className="h-5 w-5 mr-2" />
            現金流預測圖表
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthLabel" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {visibility.paid && (
                  <Bar dataKey="paid" name="已付款" stackId="a" fill={CATEGORY_COLORS.paid} />
                )}
                {visibility.budget && (
                  <Bar dataKey="budget" name="預算" stackId="a" fill={CATEGORY_COLORS.budget} />
                )}
                {visibility.scheduled && (
                  <Bar dataKey="scheduled" name="已排程" stackId="a" fill={CATEGORY_COLORS.scheduled} />
                )}
                {visibility.estimated && (
                  <Bar dataKey="estimated" name="預估到期" stackId="a" fill={CATEGORY_COLORS.estimated} />
                )}
                {visibility.recurring && (
                  <Bar dataKey="recurring" name="月付固定" stackId="a" fill={CATEGORY_COLORS.recurring} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-forecast-table">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span>月度明細</span>
            <span className="text-sm font-normal text-gray-500">
              滑鼠移至金額可查看詳細項目
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 w-24">月份</th>
                  {visibility.paid && (
                    <th className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.paid }}>
                      已付款
                    </th>
                  )}
                  {visibility.budget && (
                    <th className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.budget }}>
                      預算
                    </th>
                  )}
                  {visibility.scheduled && (
                    <th className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.scheduled }}>
                      已排程
                    </th>
                  )}
                  {visibility.estimated && (
                    <th className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.estimated }}>
                      預估到期
                    </th>
                  )}
                  {visibility.recurring && (
                    <th className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.recurring }}>
                      月付固定
                    </th>
                  )}
                  <th className="text-right py-2 px-3 w-28 font-bold">總計</th>
                </tr>
              </thead>
              <tbody>
                {forecastData.map((month, index) => (
                  <tr 
                    key={month.month} 
                    className={`border-b hover:bg-gray-50 ${index === 0 ? 'bg-blue-50' : ''}`}
                  >
                    <td className="py-2 px-3 font-medium w-24">
                      <div className="flex items-center gap-1">
                        {month.monthLabel}
                        {index === 0 && <Badge className="text-xs" variant="outline">本月</Badge>}
                      </div>
                    </td>
                    {visibility.paid && (
                      <td className="text-right py-2 px-3 w-28">
                        <PaidDetailPopover 
                          paidCurrent={month.details.paidCurrent}
                          paidCarryOver={month.details.paidCarryOver}
                          totalAmount={month.paid}
                        />
                      </td>
                    )}
                    {visibility.budget && (
                      <td className="text-right py-2 px-3 w-28">
                        <DetailPopover 
                          details={month.details.budget} 
                          category="budget"
                          amount={month.budget}
                        />
                      </td>
                    )}
                    {visibility.scheduled && (
                      <td className="text-right py-2 px-3 w-28">
                        <DetailPopover 
                          details={month.details.scheduled} 
                          category="scheduled"
                          amount={month.scheduled}
                        />
                      </td>
                    )}
                    {visibility.estimated && (
                      <td className="text-right py-2 px-3 w-28">
                        <DetailPopover 
                          details={month.details.estimated} 
                          category="estimated"
                          amount={month.estimated}
                        />
                      </td>
                    )}
                    {visibility.recurring && (
                      <td className="text-right py-2 px-3 w-28">
                        <DetailPopover 
                          details={month.details.recurring} 
                          category="recurring"
                          amount={month.recurring}
                        />
                      </td>
                    )}
                    <td className="text-right py-2 px-3 w-28 font-bold">
                      ${month.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="py-2 px-3 w-24">合計</td>
                  {visibility.paid && (
                    <td className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.paid }}>
                      ${forecastData.reduce((sum, m) => sum + m.paid, 0).toLocaleString()}
                    </td>
                  )}
                  {visibility.budget && (
                    <td className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.budget }}>
                      ${forecastData.reduce((sum, m) => sum + m.budget, 0).toLocaleString()}
                    </td>
                  )}
                  {visibility.scheduled && (
                    <td className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.scheduled }}>
                      ${forecastData.reduce((sum, m) => sum + m.scheduled, 0).toLocaleString()}
                    </td>
                  )}
                  {visibility.estimated && (
                    <td className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.estimated }}>
                      ${forecastData.reduce((sum, m) => sum + m.estimated, 0).toLocaleString()}
                    </td>
                  )}
                  {visibility.recurring && (
                    <td className="text-right py-2 px-3 w-28" style={{ color: CATEGORY_COLORS.recurring }}>
                      ${forecastData.reduce((sum, m) => sum + m.recurring, 0).toLocaleString()}
                    </td>
                  )}
                  <td className="text-right py-2 px-3 w-28">
                    ${stats.totalForecast.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
