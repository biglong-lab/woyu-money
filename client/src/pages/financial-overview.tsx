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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">財務總覽</h1>
          <p className="text-gray-600 mt-1">統一查看、管理、追蹤所有財務資訊</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} data-testid="btn-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            更新
          </Button>
          <Button variant="outline" onClick={handleExport} data-testid="btn-export">
            <Download className="h-4 w-4 mr-2" />
            匯出報表
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
            <LayoutDashboard className="h-4 w-4" />
            總覽
          </TabsTrigger>
          <TabsTrigger value="due" className="flex items-center gap-2" data-testid="tab-due">
            <CreditCard className="h-4 w-4" />
            應付款
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex items-center gap-2" data-testid="tab-forecast">
            <TrendingUp className="h-4 w-4" />
            現金流預測
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-2" data-testid="tab-health">
            <FileText className="h-4 w-4" />
            財務健康
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="space-y-6">
            <FinancialHealthDashboard items={filteredItems} />
            
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">即將到期提醒</CardTitle>
                </CardHeader>
                <CardContent>
                  <DueDateDashboard
                    items={filteredItems.slice(0, 10)}
                    onItemClick={handleItemClick}
                    onQuickPay={handleQuickPay}
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">未來3個月預測</CardTitle>
                </CardHeader>
                <CardContent>
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

        <TabsContent value="due" className="mt-6">
          <DueDateDashboard
            items={filteredItems}
            onItemClick={handleItemClick}
            onQuickPay={handleQuickPay}
          />
        </TabsContent>

        <TabsContent value="forecast" className="mt-6">
          <CashflowForecast
            items={filteredItems}
            schedules={schedules}
            budgetPlans={budgetPlansWithItems}
            paymentRecords={paymentRecords}
            monthsToForecast={6}
          />
        </TabsContent>

        <TabsContent value="health" className="mt-6">
          <FinancialHealthDashboard items={filteredItems} />
        </TabsContent>
      </Tabs>

      <Card className="bg-gray-50" data-testid="card-summary">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              共 {paymentItems.length} 個項目
              {activeFilters.search || activeFilters.projects.length > 0 || activeFilters.categories.length > 0 || 
               activeFilters.statuses.length > 0 || activeFilters.priorities.length > 0 || activeFilters.dueDateRange !== 'all'
                ? ` · 篩選後顯示 ${filteredItems.length} 個`
                : ''}
            </span>
            <span>
              最後更新: {new Date().toLocaleString('zh-TW')}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
