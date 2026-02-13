/**
 * 給付款項時間計劃頁面
 * 主要負責狀態管理、API 呼叫和子組件組合
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

import {
  type IntegratedPaymentItem,
  type MonthSchedule,
  type Schedule,
  type SmartScheduleResult,
  type PrioritizedItem,
  type CategorizedItems,
  type ScheduleStats,
  type ScheduleFormData,
  scheduleFormSchema,
} from '@/components/payment-schedule/types';

import { BudgetOverviewPanel } from '@/components/payment-schedule/budget-overview-panel';
import { SmartScheduleToolbar } from '@/components/payment-schedule/smart-schedule-toolbar';
import { SmartScheduleResultPanel } from '@/components/payment-schedule/smart-schedule-result';
import { ScheduleStatsCards } from '@/components/payment-schedule/schedule-stats-cards';
import { ScheduleCalendar } from '@/components/payment-schedule/schedule-calendar';
import { ItemListPanel } from '@/components/payment-schedule/item-list-panel';
import { CreateScheduleDialog } from '@/components/payment-schedule/create-schedule-dialog';
import { ItemDetailDialog } from '@/components/payment-schedule/item-detail-dialog';

// API 回應型別
interface ApiError {
  message: string;
  code?: string;
}

interface AutoRescheduleResponse {
  message: string;
  rescheduled: number;
  total: number;
}

export default function PaymentScheduleOptimized() {
  // ========== 狀態 ==========
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<IntegratedPaymentItem | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showSmartSchedule, setShowSmartSchedule] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [smartResult, setSmartResult] = useState<SmartScheduleResult | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // ========== 資料查詢 ==========
  const { data: integratedItems = [], isLoading } = useQuery<IntegratedPaymentItem[]>({
    queryKey: ['/api/payment/items/integrated', year, month],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/payment/items/integrated?year=${year}&month=${month}`);
      return response as IntegratedPaymentItem[];
    },
  });

  const { data: allSchedules = [] } = useQuery<MonthSchedule[]>({
    queryKey: ['/api/payment/schedule'],
  });

  // 客戶端過濾當月排程
  const monthSchedules = allSchedules.filter(schedule => {
    const scheduleDate = new Date(schedule.scheduledDate);
    return scheduleDate.getMonth() === (month - 1) && scheduleDate.getFullYear() === year;
  });

  // ========== 項目分類 ==========
  const categorizeItems = (): CategorizedItems => {
    const today = new Date();
    const scheduledItemIds = new Set(monthSchedules.map(s => s.paymentItemId));

    const completed = integratedItems.filter(item => parseFloat(item.pendingAmount) <= 0);

    const overdueUnexecuted = integratedItems.filter(item => {
      const isPending = parseFloat(item.pendingAmount) > 0;
      const hasOverdue = item.schedules.some(s => {
        const scheduleDate = new Date(s.scheduledDate);
        return scheduleDate < today && s.status !== 'completed';
      });
      return hasOverdue && isPending;
    });

    const scheduledPending = integratedItems.filter(item => {
      const hasMonthSchedule = scheduledItemIds.has(item.id);
      const isPending = parseFloat(item.pendingAmount) > 0;
      const notOverdue = !overdueUnexecuted.includes(item);
      return hasMonthSchedule && isPending && notOverdue;
    });

    const unscheduled = integratedItems.filter(item => {
      const hasNoSchedule = item.schedules.length === 0;
      const isPending = parseFloat(item.pendingAmount) > 0;
      return hasNoSchedule && isPending;
    });

    return { completed, overdueUnexecuted, scheduledPending, unscheduled };
  };

  const categories = categorizeItems();

  // ========== 統計計算 ==========
  const stats: ScheduleStats = {
    totalScheduled: monthSchedules.length,
    scheduledAmount: monthSchedules.reduce((sum, s) => sum + parseFloat(s.scheduledAmount || '0'), 0),
    totalPending: integratedItems.reduce((sum, item) => sum + parseFloat(item.pendingAmount || '0'), 0),
    overdueCount: categories.overdueUnexecuted.length,
  };

  const currentMonthPaid = integratedItems.reduce((sum, item) => {
    const monthRecords = item.paymentRecords.filter(r => {
      const recordDate = new Date(r.paymentDate);
      return recordDate.getMonth() === (month - 1) && recordDate.getFullYear() === year;
    });
    return sum + monthRecords.reduce((s, r) => s + parseFloat(r.amount || '0'), 0);
  }, 0);

  const monthlyBudget = stats.scheduledAmount;
  const budgetUsageRate = monthlyBudget > 0 ? (currentMonthPaid / monthlyBudget) * 100 : 0;
  const scheduleExecutionRate = stats.scheduledAmount > 0 ? (currentMonthPaid / stats.scheduledAmount) * 100 : 0;
  const availableBudget = monthlyBudget - currentMonthPaid;

  // ========== Mutations ==========
  const createScheduleMutation = useMutation({
    mutationFn: async (data: { paymentItemId: number; scheduledDate: string; scheduledAmount: string; notes?: string }) => {
      return await apiRequest('POST', '/api/payment/schedule', data);
    },
    onSuccess: () => {
      toast({ title: '成功', description: '付款計劃已建立' });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items/integrated'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule'] });
      setShowScheduleDialog(false);
      setSelectedItem(null);
    },
    onError: (error: ApiError) => {
      toast({ title: '錯誤', description: error.message || '建立付款計劃失敗', variant: 'destructive' });
    },
  });

  const smartScheduleMutation = useMutation({
    mutationFn: async (data: { year: number; month: number; budget: number }) => {
      return await apiRequest('POST', '/api/payment/schedule/smart-suggest', data) as SmartScheduleResult;
    },
    onSuccess: (data) => {
      setSmartResult(data);
      setShowSmartSchedule(true);
    },
    onError: (error: ApiError) => {
      toast({ title: '錯誤', description: error.message || '智慧排程建議產生失敗', variant: 'destructive' });
    },
  });

  const autoRescheduleMutation = useMutation<AutoRescheduleResponse, ApiError, { targetYear: number; targetMonth: number }>({
    mutationFn: async (data: { targetYear: number; targetMonth: number }) => {
      return await apiRequest('POST', '/api/payment/schedule/auto-reschedule', data) as AutoRescheduleResponse;
    },
    onSuccess: (data) => {
      toast({ title: '成功', description: data.message });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items/integrated'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule'] });
    },
    onError: (error: ApiError) => {
      toast({ title: '錯誤', description: error.message || '自動重排失敗', variant: 'destructive' });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, newDate, notes }: { id: number; newDate: string; notes?: string }) => {
      return await apiRequest('POST', `/api/payment/reschedule/${id}`, { newDate, notes });
    },
    onSuccess: () => {
      toast({ title: '成功', description: '已重新排程' });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items/integrated'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule'] });
    },
    onError: (error: ApiError) => {
      toast({ title: '錯誤', description: error.message || '重新排程失敗', variant: 'destructive' });
    },
  });

  // ========== 表單 ==========
  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: { scheduledAmount: '', notes: '' },
  });

  // ========== 事件處理 ==========
  const handleCreateSchedule = (data: ScheduleFormData) => {
    if (!selectedItem || !selectedDate) {
      toast({ title: '錯誤', description: '請選擇計劃日期', variant: 'destructive' });
      return;
    }
    createScheduleMutation.mutate({
      paymentItemId: selectedItem.id,
      scheduledDate: selectedDate,
      scheduledAmount: data.scheduledAmount.replace(/,/g, ''),
      notes: data.notes,
    });
  };

  const handleSmartSchedule = () => {
    const budget = parseFloat(budgetInput);
    if (!budget || budget <= 0) {
      toast({ title: '提示', description: '請輸入有效的月度預算金額', variant: 'destructive' });
      return;
    }
    smartScheduleMutation.mutate({ year, month, budget });
  };

  const handleAutoReschedule = () => {
    autoRescheduleMutation.mutate({ targetYear: year, targetMonth: month });
  };

  const handleApplySmartSchedule = async (items: PrioritizedItem[]) => {
    let successCount = 0;
    for (const item of items) {
      try {
        const scheduledDate = `${year}-${String(month).padStart(2, '0')}-01`;
        await apiRequest('POST', '/api/payment/schedule', {
          paymentItemId: item.id,
          scheduledDate,
          scheduledAmount: item.remainingAmount.toString(),
          notes: `智慧排程建議：${item.reason}`,
        });
        successCount++;
      } catch {
        // 單筆失敗不中斷
      }
    }
    toast({ title: '成功', description: `已建立 ${successCount} 筆排程計劃` });
    queryClient.invalidateQueries({ queryKey: ['/api/payment/items/integrated'] });
    queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule'] });
    setShowSmartSchedule(false);
    setSmartResult(null);
  };

  const handleQuickPayment = (item: IntegratedPaymentItem, schedule?: Schedule) => {
    setLocation(`/payment-records?itemId=${item.id}&amount=${schedule?.scheduledAmount || item.pendingAmount}&date=${schedule?.scheduledDate || ''}`);
  };

  const handleViewDetail = (item: IntegratedPaymentItem) => {
    setSelectedItem(item);
    setShowDetailDialog(true);
  };

  const handleScheduleClick = (schedule: MonthSchedule, item: IntegratedPaymentItem | null) => {
    setSelectedItem(item);
    setShowDetailDialog(true);
  };

  // ========== 拖放處理 ==========
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId.startsWith('item-list') && destination.droppableId.startsWith('day-')) {
      const targetDate = destination.droppableId.replace('day-', '');
      const itemId = parseInt(draggableId.replace('item-', ''));
      const item = integratedItems.find(i => i.id === itemId);
      if (item) {
        setSelectedItem(item);
        setSelectedDate(targetDate);
        form.reset({ scheduledAmount: item.pendingAmount, notes: '' });
        setShowScheduleDialog(true);
      }
    } else if (source.droppableId.startsWith('day-') && destination.droppableId.startsWith('day-')) {
      const newDate = destination.droppableId.replace('day-', '');
      const scheduleId = parseInt(draggableId.replace('schedule-', ''));
      const schedule = monthSchedules.find(s => s.id === scheduleId);
      if (schedule && newDate !== schedule.scheduledDate) {
        rescheduleMutation.mutate({
          id: schedule.id,
          newDate,
          notes: `從 ${schedule.scheduledDate} 重新排程至 ${newDate}`,
        });
      }
    }
  };

  // ========== 日曆日期計算 ==========
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // ========== 載入中 ==========
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // ========== 渲染 ==========
  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* 標題與月份控制 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">給付款項時間計劃</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">預算規劃與執行追蹤系統</p>
        </div>
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))} data-testid="btn-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm sm:text-lg font-semibold min-w-[100px] sm:min-w-[120px] text-center" data-testid="text-current-month">
            {format(currentDate, 'yyyy年MM月')}
          </span>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))} data-testid="btn-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 預算概覽 */}
      <BudgetOverviewPanel
        currentDate={currentDate}
        monthlyBudget={monthlyBudget}
        scheduledAmount={stats.scheduledAmount}
        totalScheduled={stats.totalScheduled}
        currentMonthPaid={currentMonthPaid}
        availableBudget={availableBudget}
        budgetUsageRate={budgetUsageRate}
        scheduleExecutionRate={scheduleExecutionRate}
        overdueCount={stats.overdueCount}
      />

      {/* 智慧排程工具列 */}
      <SmartScheduleToolbar
        budgetInput={budgetInput}
        onBudgetInputChange={setBudgetInput}
        onSmartSchedule={handleSmartSchedule}
        isSmartSchedulePending={smartScheduleMutation.isPending}
        overdueCount={categories.overdueUnexecuted.length}
        onAutoReschedule={handleAutoReschedule}
        isAutoReschedulePending={autoRescheduleMutation.isPending}
      />

      {/* 智慧排程結果 */}
      {showSmartSchedule && smartResult && (
        <SmartScheduleResultPanel
          result={smartResult}
          onClose={() => { setShowSmartSchedule(false); setSmartResult(null); }}
          onApply={handleApplySmartSchedule}
        />
      )}

      {/* 統計卡片 */}
      <ScheduleStatsCards stats={stats} unscheduledCount={categories.unscheduled.length} />

      {/* 日曆 + 項目列表（拖放區域） */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-8 order-2 lg:order-1">
            <ScheduleCalendar
              currentDate={currentDate}
              calendarDays={calendarDays}
              monthSchedules={monthSchedules}
              integratedItems={integratedItems}
              onScheduleClick={handleScheduleClick}
            />
          </div>
          <ItemListPanel categories={categories} onViewDetail={handleViewDetail} />
        </div>
      </DragDropContext>

      {/* 建立排程對話框 */}
      <CreateScheduleDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        selectedItem={selectedItem}
        selectedDate={selectedDate}
        form={form}
        onSubmit={handleCreateSchedule}
        isPending={createScheduleMutation.isPending}
      />

      {/* 項目詳情對話框 */}
      <ItemDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        selectedItem={selectedItem}
        onQuickPayment={handleQuickPayment}
      />
    </div>
  );
}
