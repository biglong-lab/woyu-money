import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { 
  LayoutDashboard, FileText, CreditCard, TrendingUp, 
  Download, RefreshCw, Settings 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import UnifiedSearchFilter, { ActiveFilters, applyFilters } from '@/components/unified-search-filter';
import DueDateDashboard from '@/components/due-date-dashboard';
import CashflowForecast from '@/components/cashflow-forecast';
import FinancialHealthDashboard from '@/components/financial-health-dashboard';

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
  projectId?: number;
  categoryId?: number;
  paymentType?: string;
  priority?: number;
  notes?: string;
}

interface PaymentProject {
  id: number;
  projectName: string;
  projectType: string;
}

interface DebtCategory {
  id: number;
  categoryName: string;
  categoryType: string;
}

interface Schedule {
  id: number;
  paymentItemId: number;
  scheduledDate: string;
  scheduledAmount: string;
  status?: string;
}

interface BudgetItem {
  id: number;
  itemName: string;
  plannedAmount: string;
  actualAmount?: string | null;
  paymentType?: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  isConverted?: boolean;
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

export default function FinancialOverview() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    search: '',
    projects: [],
    categories: [],
    statuses: [],
    priorities: [],
    dueDateRange: 'all',
  });
  const [activeTab, setActiveTab] = useState('overview');

  const { data: paymentItemsResponse, isLoading: itemsLoading, refetch } = useQuery({
    queryKey: ['/api/payment/items', { includeAll: true }],
    queryFn: () => fetch('/api/payment/items?includeAll=true').then(res => res.json()),
  });

  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ['/api/payment/projects'],
  });

  const { data: categories = [] } = useQuery<DebtCategory[]>({
    queryKey: ['/api/categories/project'],
  });

  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ['/api/payment/schedule'],
  });

  const { data: budgetPlansResponse = [] } = useQuery<BudgetPlan[]>({
    queryKey: ['/api/budget/plans', { includeItems: true }],
    queryFn: () => fetch('/api/budget/plans?includeItems=true').then(res => res.json()),
  });

  const { data: paymentRecords = [] } = useQuery<CashflowPaymentRecord[]>({
    queryKey: ['/api/payment/records/cashflow'],
    queryFn: () => fetch('/api/payment/records/cashflow?monthsBack=12').then(res => res.json()),
  });

  const budgetPlansWithItems = useMemo(() => {
    return budgetPlansResponse.map(plan => ({
      ...plan,
      items: plan.items || [],
    }));
  }, [budgetPlansResponse]);

  const paymentItems: PaymentItem[] = useMemo(() => {
    if (Array.isArray(paymentItemsResponse)) return paymentItemsResponse;
    return paymentItemsResponse?.items || [];
  }, [paymentItemsResponse]);

  const filteredItems = useMemo(() => {
    return applyFilters(paymentItems, activeFilters);
  }, [paymentItems, activeFilters]);

  const filterConfig = useMemo(() => ({
    projects: projects.map(p => ({ id: p.id, projectName: p.projectName })),
    categories: categories.map(c => ({ id: c.id, categoryName: c.categoryName })),
  }), [projects, categories]);

  const handleFilterChange = useCallback((filters: ActiveFilters) => {
    setActiveFilters(filters);
  }, []);

  const handleItemClick = useCallback((item: PaymentItem) => {
    setLocation(`/payment/items/${item.id}`);
  }, [setLocation]);

  const handleQuickPay = useCallback((item: PaymentItem) => {
    const pendingAmount = parseFloat(item.totalAmount || '0') - parseFloat(item.paidAmount || '0');
    setLocation(`/payment-project?pay=${item.id}&amount=${pendingAmount}`);
  }, [setLocation]);

  const handleExport = useCallback(() => {
    toast({
      title: '匯出中...',
      description: '正在準備您的報表資料',
    });
    
    const csvContent = [
      ['項目名稱', '專案', '分類', '總金額', '已付金額', '待付金額', '狀態', '到期日'].join(','),
      ...filteredItems.map(item => [
        item.itemName,
        item.projectName || '',
        item.categoryName || '',
        item.totalAmount,
        item.paidAmount || '0',
        (parseFloat(item.totalAmount || '0') - parseFloat(item.paidAmount || '0')).toString(),
        item.status || '',
        item.endDate || item.startDate || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `財務報表_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: '匯出成功',
      description: `已匯出 ${filteredItems.length} 筆資料`,
    });
  }, [filteredItems, toast]);

  const handleRefresh = useCallback(() => {
    refetch();
    toast({
      title: '資料已更新',
      description: '已重新載入最新資料',
    });
  }, [refetch, toast]);

  if (itemsLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* 響應式標題和操作區 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold truncate" data-testid="page-title">財務總覽</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">統一查看、管理、追蹤所有財務資訊</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handleRefresh} data-testid="btn-refresh">
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">更新</span>
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={handleExport} data-testid="btn-export">
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">匯出報表</span>
          </Button>
        </div>
      </div>

      <UnifiedSearchFilter
        config={filterConfig}
        onFilterChange={handleFilterChange}
        placeholder="搜尋項目名稱、專案、分類、備註..."
        showDueDateFilter={true}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* 響應式 Tab 列表 - 手機版 2x2 網格，桌面版 1x4 */}
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="flex items-center justify-center gap-1 sm:gap-2 py-2 text-xs sm:text-sm" data-testid="tab-overview">
            <LayoutDashboard className="h-4 w-4" />
            <span>總覽</span>
          </TabsTrigger>
          <TabsTrigger value="due" className="flex items-center justify-center gap-1 sm:gap-2 py-2 text-xs sm:text-sm" data-testid="tab-due">
            <CreditCard className="h-4 w-4" />
            <span>應付款</span>
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex items-center justify-center gap-1 sm:gap-2 py-2 text-xs sm:text-sm" data-testid="tab-forecast">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">現金流</span>
            <span className="sm:hidden">預測</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center justify-center gap-1 sm:gap-2 py-2 text-xs sm:text-sm" data-testid="tab-health">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">財務健康</span>
            <span className="sm:hidden">健康</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 sm:mt-6">
          <div className="space-y-4 sm:space-y-6">
            <FinancialHealthDashboard items={filteredItems} />

            {/* 響應式網格：手機版單欄，平板以上雙欄 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card>
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="text-base sm:text-lg">即將到期提醒</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <DueDateDashboard
                    items={filteredItems.slice(0, 10)}
                    onItemClick={handleItemClick}
                    onQuickPay={handleQuickPay}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="text-base sm:text-lg">未來3個月預測</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CashflowForecast
                    items={filteredItems}
                    schedules={schedules}
                    budgetPlans={budgetPlansWithItems}
                    paymentRecords={paymentRecords}
                    monthsToForecast={3}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="due" className="mt-4 sm:mt-6">
          <DueDateDashboard
            items={filteredItems}
            onItemClick={handleItemClick}
            onQuickPay={handleQuickPay}
          />
        </TabsContent>

        <TabsContent value="forecast" className="mt-4 sm:mt-6">
          <CashflowForecast
            items={filteredItems}
            schedules={schedules}
            budgetPlans={budgetPlansWithItems}
            paymentRecords={paymentRecords}
            monthsToForecast={6}
          />
        </TabsContent>

        <TabsContent value="health" className="mt-4 sm:mt-6">
          <FinancialHealthDashboard items={filteredItems} />
        </TabsContent>
      </Tabs>

      {/* 響應式摘要卡片 */}
      <Card className="bg-gray-50" data-testid="card-summary">
        <CardContent className="py-3 sm:pt-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm text-gray-600">
            <span>
              共 {paymentItems.length} 個項目
              {activeFilters.search || activeFilters.projects.length > 0 || activeFilters.categories.length > 0 ||
               activeFilters.statuses.length > 0 || activeFilters.priorities.length > 0 || activeFilters.dueDateRange !== 'all'
                ? ` · 篩選後顯示 ${filteredItems.length} 個`
                : ''}
            </span>
            <span className="text-xs">
              最後更新: {new Date().toLocaleString('zh-TW')}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
