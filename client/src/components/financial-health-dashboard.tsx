import { useMemo } from 'react';
import { format, subMonths, differenceInDays } from 'date-fns';
import { 
  TrendingUp, TrendingDown, CheckCircle, AlertTriangle, Clock, 
  Target, DollarSign, Activity, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
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
  categoryName?: string;
  paymentType?: string;
  priority?: number;
}

interface FinancialHealthDashboardProps {
  items: PaymentItem[];
  className?: string;
}

interface HealthMetric {
  label: string;
  value: number;
  target?: number;
  status: 'good' | 'warning' | 'danger';
  icon: any;
  description: string;
}

const COLORS = {
  good: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  neutral: '#6B7280',
};

const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
};

export default function FinancialHealthDashboard({
  items,
  className = '',
}: FinancialHealthDashboardProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const metrics = useMemo(() => {
    const totalItems = items.length;
    const paidItems = items.filter(i => i.status === 'paid');
    const pendingItems = items.filter(i => i.status !== 'paid');
    
    const totalPlanned = items.reduce((sum, i) => sum + safeParseFloat(i.totalAmount), 0);
    const totalPaid = items.reduce((sum, i) => sum + safeParseFloat(i.paidAmount), 0);
    const totalPending = totalPlanned - totalPaid;

    const overdueItems = pendingItems.filter(item => {
      const dueDate = item.endDate ? new Date(item.endDate) : item.startDate ? new Date(item.startDate) : null;
      if (!dueDate) return false;
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    });

    const completionRate = totalItems > 0 ? (paidItems.length / totalItems) * 100 : 0;
    const overdueRate = pendingItems.length > 0 ? (overdueItems.length / pendingItems.length) * 100 : 0;
    const paymentProgress = totalPlanned > 0 ? (totalPaid / totalPlanned) * 100 : 0;

    const avgDaysToComplete = paidItems.reduce((sum, item) => {
      if (!item.startDate) return sum;
      const start = new Date(item.startDate);
      const end = item.endDate ? new Date(item.endDate) : new Date();
      return sum + differenceInDays(end, start);
    }, 0) / (paidItems.length || 1);

    const highPriorityPending = pendingItems.filter(i => (i.priority || 3) >= 4).length;

    const monthlyItems = items.filter(i => i.paymentType === 'monthly');
    const monthlyTotal = monthlyItems.reduce((sum, i) => sum + safeParseFloat(i.totalAmount), 0);

    return {
      totalItems,
      paidItems: paidItems.length,
      pendingItems: pendingItems.length,
      overdueItems: overdueItems.length,
      totalPlanned,
      totalPaid,
      totalPending,
      completionRate,
      overdueRate,
      paymentProgress,
      avgDaysToComplete,
      highPriorityPending,
      monthlyTotal,
    };
  }, [items, today]);

  const healthScore = useMemo(() => {
    let score = 100;
    
    if (metrics.overdueRate > 0) score -= metrics.overdueRate * 0.5;
    if (metrics.completionRate < 50) score -= (50 - metrics.completionRate) * 0.3;
    if (metrics.highPriorityPending > 0) score -= metrics.highPriorityPending * 5;
    
    return Math.max(0, Math.min(100, score));
  }, [metrics]);

  const getScoreStatus = (score: number): 'good' | 'warning' | 'danger' => {
    if (score >= 80) return 'good';
    if (score >= 60) return 'warning';
    return 'danger';
  };

  const statusDistribution = useMemo(() => [
    { name: '已付款', value: metrics.paidItems, color: COLORS.good },
    { name: '待付款', value: metrics.pendingItems - metrics.overdueItems, color: COLORS.warning },
    { name: '已逾期', value: metrics.overdueItems, color: COLORS.danger },
  ].filter(d => d.value > 0), [metrics]);

  const healthMetrics: HealthMetric[] = [
    {
      label: '完成率',
      value: metrics.completionRate,
      target: 80,
      status: metrics.completionRate >= 80 ? 'good' : metrics.completionRate >= 50 ? 'warning' : 'danger',
      icon: CheckCircle,
      description: `${metrics.paidItems}/${metrics.totalItems} 項目已完成付款`,
    },
    {
      label: '逾期率',
      value: metrics.overdueRate,
      target: 10,
      status: metrics.overdueRate <= 10 ? 'good' : metrics.overdueRate <= 30 ? 'warning' : 'danger',
      icon: AlertTriangle,
      description: `${metrics.overdueItems} 個項目已逾期`,
    },
    {
      label: '付款進度',
      value: metrics.paymentProgress,
      target: 70,
      status: metrics.paymentProgress >= 70 ? 'good' : metrics.paymentProgress >= 40 ? 'warning' : 'danger',
      icon: Target,
      description: `$${metrics.totalPaid.toLocaleString()} / $${metrics.totalPlanned.toLocaleString()}`,
    },
    {
      label: '高優先待處理',
      value: metrics.highPriorityPending,
      status: metrics.highPriorityPending === 0 ? 'good' : metrics.highPriorityPending <= 3 ? 'warning' : 'danger',
      icon: Clock,
      description: `${metrics.highPriorityPending} 個高優先項目待付款`,
    },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 border rounded shadow-lg text-sm">
          <p className="font-medium">{data.name}</p>
          <p>{data.value} 項目</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 響應式網格：手機單欄，平板雙欄，桌面三欄 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card data-testid="card-health-score">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              財務健康評分
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-2 sm:py-4">
              <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                {/* 響應式圓形圖表 - 使用 viewBox 保持比例 */}
                <svg viewBox="0 0 128 128" className="w-full h-full">
                  <circle
                    className="text-gray-200"
                    strokeWidth="10"
                    stroke="currentColor"
                    fill="transparent"
                    r="56"
                    cx="64"
                    cy="64"
                  />
                  <circle
                    className={`${
                      getScoreStatus(healthScore) === 'good' ? 'text-green-500' :
                      getScoreStatus(healthScore) === 'warning' ? 'text-yellow-500' : 'text-red-500'
                    }`}
                    strokeWidth="10"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="56"
                    cx="64"
                    cy="64"
                    strokeDasharray={`${healthScore * 3.52} 352`}
                    transform="rotate(-90 64 64)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl sm:text-3xl font-bold ${
                    getScoreStatus(healthScore) === 'good' ? 'text-green-600' :
                    getScoreStatus(healthScore) === 'warning' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {healthScore.toFixed(0)}
                  </span>
                  <span className="text-xs sm:text-sm text-gray-500">分</span>
                </div>
              </div>
            </div>
            <div className="text-center">
              <Badge variant={
                getScoreStatus(healthScore) === 'good' ? 'default' :
                getScoreStatus(healthScore) === 'warning' ? 'secondary' : 'destructive'
              }>
                {getScoreStatus(healthScore) === 'good' ? '健康' :
                 getScoreStatus(healthScore) === 'warning' ? '需關注' : '需改善'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-status-distribution">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">狀態分佈</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[120px] sm:h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-2">
              {statusDistribution.map((item) => (
                <div key={item.name} className="flex items-center text-xs">
                  <div
                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full mr-1"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-key-stats">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">關鍵數據</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">待付總額</span>
              <span className="font-bold text-orange-600 text-sm sm:text-base">
                ${metrics.totalPending.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">月付固定支出</span>
              <span className="font-bold text-blue-600 text-sm sm:text-base">
                ${metrics.monthlyTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">平均處理天數</span>
              <span className="font-bold text-sm sm:text-base">
                {metrics.avgDaysToComplete.toFixed(0)} 天
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">項目總數</span>
              <span className="font-bold text-sm sm:text-base">{metrics.totalItems}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 響應式健康指標網格：手機 2x2，桌面 4x1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {healthMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card
              key={metric.label}
              className={`${
                metric.status === 'danger' ? 'border-red-200 bg-red-50' :
                metric.status === 'warning' ? 'border-yellow-200 bg-yellow-50' : ''
              }`}
              data-testid={`card-metric-${metric.label}`}
            >
              <CardContent className="p-3 sm:pt-4 sm:px-4">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-xs sm:text-sm text-gray-600 truncate">{metric.label}</span>
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${
                    metric.status === 'good' ? 'text-green-500' :
                    metric.status === 'warning' ? 'text-yellow-500' : 'text-red-500'
                  }`} />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                  <span className={`text-xl sm:text-2xl font-bold ${
                    metric.status === 'good' ? 'text-green-600' :
                    metric.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {metric.label === '高優先待處理' ? metric.value : `${metric.value.toFixed(0)}%`}
                  </span>
                  {metric.target !== undefined && (
                    <span className="text-[10px] sm:text-xs text-gray-500">
                      目標: {metric.label === '逾期率' ? `≤${metric.target}%` : `≥${metric.target}%`}
                    </span>
                  )}
                </div>
                {metric.target !== undefined && (
                  <Progress
                    value={metric.label === '逾期率' ? 100 - metric.value : metric.value}
                    className="h-1 sm:h-1.5 mt-1 sm:mt-2"
                  />
                )}
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1 sm:mt-2 line-clamp-2">{metric.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
