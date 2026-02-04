import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, ChevronLeft, ChevronRight, CreditCard, Eye, Edit, ArrowLeft, LayoutGrid, LayoutList, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface PaymentItem {
  id: number;
  itemName: string;
  totalAmount: string;
  priority: number;
  dueDate?: string;
  description?: string;
  categoryName?: string;
  projectName?: string;
  scheduledAmount?: string;
  remainingAmount?: string;
  isCurrentMonthOverdue?: boolean;
  isPreviousMonthsOverdue?: boolean;
}

interface PaymentSchedule {
  id: number;
  paymentItemId: number;
  scheduledDate: string;
  scheduledAmount: string;
  status: string;
  notes: string;
  isOverdue: boolean;
  overdueDays: number;
}

interface ScheduleStats {
  totalScheduled: number;
  totalAmount: number;
  dailyStats: Record<string, { amount: number; count: number }>;
}

interface MonthBudget {
  month: string;
  budgetAmount: number;
  scheduledAmount: number;
  remainingAmount: number;
  usagePercentage: number;
}

const createScheduleSchema = z.object({
  scheduledAmount: z.string().min(1, '請輸入金額'),
  notes: z.string().optional(),
});

const budgetSchema = z.object({
  month: z.string(),
  budgetAmount: z.string().min(1, '請輸入預算金額'),
});

type ViewMode = 'single' | 'multi';

export default function PaymentScheduleEnhanced() {
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PaymentItem | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<PaymentSchedule | null>(null);
  const [selectedBudgetMonth, setSelectedBudgetMonth] = useState<string>('');
  const { toast } = useToast();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // 計算三個月份的年月
  const month1Date = currentDate;
  const month2Date = addMonths(currentDate, 1);
  const month3Date = addMonths(currentDate, 2);
  
  const month1 = { year: month1Date.getFullYear(), month: month1Date.getMonth() + 1 };
  const month2 = { year: month2Date.getFullYear(), month: month2Date.getMonth() + 1 };
  const month3 = { year: month3Date.getFullYear(), month: month3Date.getMonth() + 1 };

  // 查詢第一個月
  const schedules1 = useQuery<PaymentSchedule[]>({
    queryKey: ['/api/payment/schedule', month1.year, month1.month],
    queryFn: async (): Promise<PaymentSchedule[]> => {
      const response = await apiRequest('GET', `/api/payment/schedule/${month1.year}/${month1.month}`);
      return (response || []) as PaymentSchedule[];
    },
  });
  
  const stats1 = useQuery<ScheduleStats>({
    queryKey: ['/api/payment/schedule/stats', month1.year, month1.month],
    queryFn: async (): Promise<ScheduleStats> => {
      const response = await apiRequest('GET', `/api/payment/schedule/stats/${month1.year}/${month1.month}`);
      return response as ScheduleStats;
    },
  });

  // 查詢第二個月（僅在多月視圖時）
  const schedules2 = useQuery<PaymentSchedule[]>({
    queryKey: ['/api/payment/schedule', month2.year, month2.month],
    enabled: viewMode === 'multi',
    queryFn: async (): Promise<PaymentSchedule[]> => {
      const response = await apiRequest('GET', `/api/payment/schedule/${month2.year}/${month2.month}`);
      return (response || []) as PaymentSchedule[];
    },
  });
  
  const stats2 = useQuery<ScheduleStats>({
    queryKey: ['/api/payment/schedule/stats', month2.year, month2.month],
    enabled: viewMode === 'multi',
    queryFn: async (): Promise<ScheduleStats> => {
      const response = await apiRequest('GET', `/api/payment/schedule/stats/${month2.year}/${month2.month}`);
      return response as ScheduleStats;
    },
  });

  // 查詢第三個月（僅在多月視圖時）
  const schedules3 = useQuery<PaymentSchedule[]>({
    queryKey: ['/api/payment/schedule', month3.year, month3.month],
    enabled: viewMode === 'multi',
    queryFn: async (): Promise<PaymentSchedule[]> => {
      const response = await apiRequest('GET', `/api/payment/schedule/${month3.year}/${month3.month}`);
      return (response || []) as PaymentSchedule[];
    },
  });
  
  const stats3 = useQuery<ScheduleStats>({
    queryKey: ['/api/payment/schedule/stats', month3.year, month3.month],
    enabled: viewMode === 'multi',
    queryFn: async (): Promise<ScheduleStats> => {
      const response = await apiRequest('GET', `/api/payment/schedule/stats/${month3.year}/${month3.month}`);
      return response as ScheduleStats;
    },
  });

  // 組合月份查詢結果
  const months = viewMode === 'multi'
    ? [month1Date, month2Date, month3Date]
    : [month1Date];
    
  const monthQueries = viewMode === 'multi'
    ? [
        { schedules: schedules1, stats: stats1, monthKey: `${month1.year}-${String(month1.month).padStart(2, '0')}` },
        { schedules: schedules2, stats: stats2, monthKey: `${month2.year}-${String(month2.month).padStart(2, '0')}` },
        { schedules: schedules3, stats: stats3, monthKey: `${month3.year}-${String(month3.month).padStart(2, '0')}` },
      ]
    : [
        { schedules: schedules1, stats: stats1, monthKey: `${month1.year}-${String(month1.month).padStart(2, '0')}` },
      ];

  // 查詢未排程項目
  const { data: allUnscheduledItems = [], isLoading: itemsLoading } = useQuery<PaymentItem[]>({
    queryKey: ['/api/payment/schedule/items', year, month],
  });

  // 查詢逾期項目
  const { data: overdueData = [] } = useQuery<PaymentItem[]>({
    queryKey: [`/api/payment/items/overdue`],
    queryFn: async (): Promise<PaymentItem[]> => {
      const response = await apiRequest('GET', '/api/payment/items/overdue');
      return (response || []) as PaymentItem[];
    },
  });

  // 查詢所有付款項目
  const { data: allPaymentItems = [] } = useQuery<PaymentItem[]>({
    queryKey: ['/api/payment/items', 'all'],
    queryFn: async (): Promise<PaymentItem[]> => {
      const response = await apiRequest('GET', '/api/payment/items?includeAll=true');
      const data = response?.items || response || [];
      return data as PaymentItem[];
    },
  });

  // 合併項目數據
  const allItemsMap = new Map<number, PaymentItem>();
  allPaymentItems.forEach((item: PaymentItem) => allItemsMap.set(item.id, item));
  allUnscheduledItems.forEach((item: PaymentItem) => allItemsMap.set(item.id, item));
  overdueData.forEach((item: PaymentItem) => allItemsMap.set(item.id, item));
  const allItemsForDrag = Array.from(allItemsMap.values());

  // 計算未排程項目（排除已排程的）
  const getAllSchedules = () => {
    return monthQueries.flatMap(q => q.schedules.data || []);
  };

  const unscheduledItems = allUnscheduledItems.filter(item => 
    !getAllSchedules().some((schedule: PaymentSchedule) => schedule.paymentItemId === item.id)
  );

  const unscheduledOverdueItems = overdueData.filter(item => 
    !getAllSchedules().some((schedule: PaymentSchedule) => schedule.paymentItemId === item.id)
  );

  const currentMonthOverdueItems = unscheduledOverdueItems.filter(item => item.isCurrentMonthOverdue);
  const previousMonthsOverdueItems = unscheduledOverdueItems.filter(item => item.isPreviousMonthsOverdue);
  const currentMonthItems = unscheduledItems.filter(item => !item.dueDate || new Date(item.dueDate) >= new Date());

  // 建立計劃 mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (data: {
      paymentItemId: number;
      scheduledDate: string;
      scheduledAmount: string;
      notes?: string;
    }) => {
      return await apiRequest('POST', '/api/payment/schedule', data);
    },
    onSuccess: () => {
      toast({ title: '成功', description: '付款計劃已建立' });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items/overdue'] });
      setShowScheduleDialog(false);
      setSelectedItem(null);
    },
    onError: (error: any) => {
      toast({ 
        title: '錯誤', 
        description: error.message || '建立付款計劃失敗',
        variant: 'destructive' 
      });
    },
  });

  // 重新排程 mutation
  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, newDate, notes }: { id: number; newDate: string; notes?: string }) => {
      return await apiRequest('POST', `/api/payment/reschedule/${id}`, { newDate, notes });
    },
    onSuccess: () => {
      toast({ title: '成功', description: '付款已重新排程' });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items/overdue'] });
    },
    onError: (error: any) => {
      toast({ 
        title: '錯誤', 
        description: error.message || '重新排程失敗',
        variant: 'destructive' 
      });
    },
  });

  // 刪除排程 mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      return await apiRequest('DELETE', `/api/payment/schedule/${scheduleId}`);
    },
    onSuccess: () => {
      toast({ title: '成功', description: '排程已刪除，項目已退回列表' });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items/overdue'] });
      setShowDetailDialog(false);
      setSelectedSchedule(null);
    },
    onError: (error: any) => {
      toast({ 
        title: '錯誤', 
        description: error.message || '刪除排程失敗',
        variant: 'destructive' 
      });
    },
  });

  // 拖拽處理
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    if ((source.droppableId === 'unscheduled' || 
         source.droppableId === 'current-overdue' || 
         source.droppableId === 'historical-overdue') && 
        destination.droppableId.startsWith('day-')) {
      const targetDate = destination.droppableId.replace('day-', '');
      
      let itemId: string;
      if (draggableId.startsWith('current-overdue-')) {
        itemId = draggableId.replace('current-overdue-', '');
      } else if (draggableId.startsWith('historical-')) {
        itemId = draggableId.replace('historical-', '');
      } else if (draggableId.startsWith('unscheduled-')) {
        itemId = draggableId.replace('unscheduled-', '');
      } else {
        itemId = draggableId;
      }
      
      const item = [...allUnscheduledItems, ...overdueData].find(item => item.id.toString() === itemId);
      
      if (item) {
        setSelectedItem(item);
        setSelectedDate(targetDate);
        setShowScheduleDialog(true);
      }
    } else if (source.droppableId.startsWith('day-') && destination.droppableId.startsWith('day-')) {
      const newDate = destination.droppableId.replace('day-', '');
      const allSchedules = getAllSchedules();
      const schedule = allSchedules.find((s: PaymentSchedule) => s.id.toString() === draggableId);
      
      if (schedule && newDate !== schedule.scheduledDate) {
        rescheduleMutation.mutate({
          id: schedule.id,
          newDate,
          notes: `從 ${schedule.scheduledDate} 重新排程至 ${newDate}`,
        });
      }
    }
  };

  const form = useForm({
    resolver: zodResolver(createScheduleSchema),
    defaultValues: {
      scheduledAmount: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (selectedItem) {
      const defaultAmount = selectedItem.remainingAmount || selectedItem.totalAmount;
      const cleanAmount = defaultAmount.replace(/,/g, '');
      form.reset({
        scheduledAmount: cleanAmount,
        notes: ''
      });
    }
  }, [selectedItem, form]);

  const handleCreateSchedule = (data: { scheduledAmount: string; notes?: string }) => {
    if (!selectedItem || !selectedDate) {
      toast({ 
        title: '錯誤', 
        description: '請選擇計劃日期',
        variant: 'destructive' 
      });
      return;
    }

    const cleanAmount = data.scheduledAmount.replace(/,/g, '');
    createScheduleMutation.mutate({
      paymentItemId: selectedItem.id,
      scheduledDate: selectedDate,
      scheduledAmount: cleanAmount,
      notes: data.notes,
    });
  };

  // 計算總體統計
  const totalStats = {
    totalScheduled: monthQueries.reduce((sum, q) => sum + (q.stats.data?.totalScheduled || 0), 0),
    totalAmount: monthQueries.reduce((sum, q) => sum + (q.stats.data?.totalAmount || 0), 0),
    overdueCount: previousMonthsOverdueItems.length + currentMonthOverdueItems.length,
  };

  return (
    <div className="space-y-6 p-6">
      {/* 標題與控制區 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">給付款項時間計劃</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">智能規劃預算與給付安排，輕鬆管理現金流</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* 視圖模式切換 */}
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <Button
              variant={viewMode === 'single' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('single')}
              data-testid="view-mode-single"
            >
              <LayoutList className="h-4 w-4 mr-1" />
              單月
            </Button>
            <Button
              variant={viewMode === 'multi' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('multi')}
              data-testid="view-mode-multi"
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              多月
            </Button>
          </div>

          {/* 月份導航 */}
          <Button
            variant="outline"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            data-testid="btn-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[120px] text-center" data-testid="text-current-month">
            {format(currentDate, 'yyyy年MM月')}
          </span>
          <Button
            variant="outline"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            data-testid="btn-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card data-testid="card-total-scheduled">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              {viewMode === 'multi' ? '總排程項目' : '本月排程項目'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalStats.totalScheduled}
            </div>
          </CardContent>
        </Card>
        
        <Card data-testid="card-total-amount">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
              <DollarSign className="h-4 w-4 mr-1" />
              {viewMode === 'multi' ? '總排程金額' : '本月排程金額'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${totalStats.totalAmount?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card data-testid="card-unscheduled">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              待排程項目
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {unscheduledItems.length}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-overdue">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              逾期項目
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {totalStats.overdueCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-12 gap-6">
          {/* 日曆視圖區域 */}
          <div className={viewMode === 'multi' ? 'col-span-9' : 'col-span-8'}>
            <Tabs defaultValue={months[0] && format(months[0], 'yyyy-MM')} className="space-y-4">
              {viewMode === 'multi' && (
                <TabsList className="grid w-full grid-cols-3" data-testid="tabs-months">
                  {months.map((monthDate) => (
                    <TabsTrigger key={format(monthDate, 'yyyy-MM')} value={format(monthDate, 'yyyy-MM')}>
                      {format(monthDate, 'yyyy年MM月')}
                    </TabsTrigger>
                  ))}
                </TabsList>
              )}
              
              {monthQueries.map((monthQuery, index) => {
                const monthDate = months[index];
                if (!monthDate) return null;
                
                const monthStart = startOfMonth(monthDate);
                const monthEnd = endOfMonth(monthDate);
                const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
                const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
                const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
                
                const getSchedulesForDate = (date: string) => {
                  if (!monthQuery.schedules.data || monthQuery.schedules.data.length === 0) return [];
                  return monthQuery.schedules.data.filter((schedule: PaymentSchedule) => schedule.scheduledDate === date);
                };
                
                const getDateStats = (date: string) => {
                  return monthQuery.stats.data?.dailyStats[date] || { amount: 0, count: 0 };
                };

                return (
                  <TabsContent key={monthQuery.monthKey} value={format(monthDate, 'yyyy-MM')} className="mt-0">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center">
                            <Calendar className="mr-2 h-5 w-5" />
                            {format(monthDate, 'yyyy年MM月')} 付款時間計劃
                          </span>
                          {monthQuery.stats.data && (
                            <span className="text-sm font-normal text-gray-500">
                              排程 {monthQuery.stats.data.totalScheduled} 項 · $
                              {monthQuery.stats.data.totalAmount?.toLocaleString() || 0}
                            </span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {monthQuery.schedules.isLoading ? (
                          <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-7 gap-2">
                            {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                              <div key={day} className="p-2 text-center font-medium text-gray-500 border-b">
                                {day}
                              </div>
                            ))}
                            
                            {calendarDays.map(day => {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const daySchedules = getSchedulesForDate(dateStr);
                              const dateStats = getDateStats(dateStr);
                              const isToday = isSameDay(day, new Date());
                              const isCurrentMonth = day.getMonth() === monthDate.getMonth();
                              
                              return (
                                <Droppable key={dateStr} droppableId={`day-${dateStr}`}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.droppableProps}
                                      className={`
                                        min-h-[120px] p-2 border rounded-lg transition-colors
                                        ${snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}
                                        ${isToday ? 'ring-2 ring-blue-500' : ''}
                                        ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900 opacity-50' : ''}
                                      `}
                                      data-testid={`calendar-day-${dateStr}`}
                                    >
                                      <div className="flex justify-between items-center mb-1">
                                        <span className={`text-sm font-medium ${
                                          isToday ? 'text-blue-600 dark:text-blue-400' : 
                                          !isCurrentMonth ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'
                                        }`}>
                                          {format(day, 'd')}
                                        </span>
                                        {dateStats.count > 0 && (
                                          <Badge variant="secondary" className="text-xs">
                                            {dateStats.count}
                                          </Badge>
                                        )}
                                      </div>
                                      
                                      {dateStats.amount > 0 && (
                                        <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-2">
                                          ${dateStats.amount.toLocaleString()}
                                        </div>
                                      )}
                                      
                                      <div className="space-y-1">
                                        {daySchedules.map((schedule: PaymentSchedule, idx: number) => {
                                          const relatedItem = allItemsForDrag.find(item => item.id === schedule.paymentItemId);
                                          return (
                                            <Draggable
                                              key={schedule.id}
                                              draggableId={schedule.id.toString()}
                                              index={idx}
                                            >
                                              {(provided, snapshot) => (
                                                <div
                                                  ref={provided.innerRef}
                                                  {...provided.draggableProps}
                                                  {...provided.dragHandleProps}
                                                  className={`
                                                    p-2 text-xs rounded border cursor-move
                                                    ${snapshot.isDragging ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-300' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'}
                                                    hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors
                                                    ${schedule.isOverdue ? 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-600' : ''}
                                                  `}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (relatedItem) {
                                                      setSelectedItem(relatedItem);
                                                      setSelectedSchedule(schedule);
                                                      setShowDetailDialog(true);
                                                    }
                                                  }}
                                                  data-testid={`schedule-item-${schedule.id}`}
                                                >
                                                  <div className="font-medium text-gray-700 dark:text-gray-200 truncate" title={relatedItem?.itemName}>
                                                    {relatedItem?.itemName || `項目 #${schedule.paymentItemId}`}
                                                  </div>
                                                  <div className="text-green-600 dark:text-green-400 font-medium">
                                                    ${Number(schedule.scheduledAmount).toLocaleString()}
                                                  </div>
                                                  {schedule.isOverdue && (
                                                    <Badge variant="destructive" className="text-xs mt-1">
                                                      逾期 {schedule.overdueDays} 天
                                                    </Badge>
                                                  )}
                                                </div>
                                              )}
                                            </Draggable>
                                          );
                                        })}
                                      </div>
                                      
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>

          {/* 右側：項目列表 */}
          <div className={viewMode === 'multi' ? 'col-span-3' : 'col-span-4'}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  待排程項目
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 歷史逾期項目 */}
                {previousMonthsOverdueItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      歷史逾期 ({previousMonthsOverdueItems.length})
                    </h3>
                    <Droppable droppableId="historical-overdue">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                          {previousMonthsOverdueItems.map((item, index) => (
                            <Draggable
                              key={item.id}
                              draggableId={`historical-${item.id}`}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`
                                    p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg cursor-move
                                    ${snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'}
                                  `}
                                  data-testid={`overdue-item-${item.id}`}
                                >
                                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                    {item.itemName}
                                  </div>
                                  <div className="text-green-600 dark:text-green-400 font-medium text-sm">
                                    ${parseFloat(item.totalAmount).toLocaleString()}
                                  </div>
                                  <Badge variant="destructive" className="text-xs mt-1">
                                    優先級 {item.priority || 1}
                                  </Badge>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )}

                {/* 當月逾期項目 */}
                {currentMonthOverdueItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-2">
                      本月逾期 ({currentMonthOverdueItems.length})
                    </h3>
                    <Droppable droppableId="current-overdue">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                          {currentMonthOverdueItems.map((item, index) => (
                            <Draggable
                              key={item.id}
                              draggableId={`current-overdue-${item.id}`}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`
                                    p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg cursor-move
                                    ${snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'}
                                  `}
                                >
                                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                    {item.itemName}
                                  </div>
                                  <div className="text-green-600 dark:text-green-400 font-medium text-sm">
                                    ${parseFloat(item.totalAmount).toLocaleString()}
                                  </div>
                                  <Badge variant="secondary" className="text-xs mt-1">
                                    優先級 {item.priority || 1}
                                  </Badge>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )}

                {/* 當月正常項目 */}
                {currentMonthItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">
                      本月項目 ({currentMonthItems.length})
                    </h3>
                    <Droppable droppableId="unscheduled">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`
                            space-y-2 min-h-[200px] p-2 rounded border-2 border-dashed
                            ${snapshot.isDraggingOver ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}
                          `}
                        >
                          {currentMonthItems.map((item, index) => (
                            <Draggable
                              key={item.id}
                              draggableId={`unscheduled-${item.id}`}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`
                                    p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg cursor-move
                                    ${snapshot.isDragging ? 'shadow-lg bg-white dark:bg-gray-600' : 'hover:shadow-md'}
                                  `}
                                  data-testid={`unscheduled-item-${item.id}`}
                                >
                                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                    {item.itemName}
                                  </div>
                                  <div className="text-green-600 dark:text-green-400 font-medium text-sm">
                                    ${parseFloat(item.totalAmount).toLocaleString()}
                                  </div>
                                  <Badge 
                                    variant={(item.priority || 1) >= 3 ? 'destructive' : 'secondary'}
                                    className="text-xs mt-1"
                                  >
                                    優先級 {item.priority || 1}
                                  </Badge>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          
                          {currentMonthItems.length === 0 && !itemsLoading && (
                            <div className="text-center py-8 text-gray-500">
                              <Clock className="mx-auto h-8 w-8 mb-2 opacity-50" />
                              <p>無待排程項目</p>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DragDropContext>

      {/* 建立排程對話框 */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              建立付款計劃
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">{selectedItem.itemName}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">總金額: ${parseFloat(selectedItem.totalAmount).toLocaleString()}</p>
                {selectedItem.scheduledAmount && parseFloat(selectedItem.scheduledAmount) > 0 && (
                  <>
                    <p className="text-sm text-blue-600 dark:text-blue-400">已排程: ${parseFloat(selectedItem.scheduledAmount).toLocaleString()}</p>
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">可排程: ${parseFloat(selectedItem.remainingAmount || selectedItem.totalAmount).toLocaleString()}</p>
                  </>
                )}
                {selectedDate && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 font-medium">排程日期: {selectedDate}</p>
                )}
              </div>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateSchedule)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="scheduledAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>排程金額 *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="輸入排程金額"
                            {...field}
                            data-testid="input-schedule-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>備註</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="排程備註..."
                            {...field}
                            data-testid="input-schedule-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowScheduleDialog(false)}
                      data-testid="btn-cancel-schedule"
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      disabled={createScheduleMutation.isPending}
                      data-testid="btn-confirm-schedule"
                    >
                      確認排程
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 詳情對話框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Eye className="mr-2 h-5 w-5" />
              付款項目詳情
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600 dark:text-gray-400 font-medium">項目名稱：</span>
                  <span className="text-gray-900 dark:text-gray-100">{selectedItem.itemName}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400 font-medium">總金額：</span>
                  <span className="text-green-600 dark:text-green-400 font-semibold">${parseFloat(selectedItem.totalAmount).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400 font-medium">專案：</span>
                  <span className="text-gray-800 dark:text-gray-200">{selectedItem.projectName}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400 font-medium">分類：</span>
                  <span className="text-gray-800 dark:text-gray-200">{selectedItem.categoryName}</span>
                </div>
              </div>

              {selectedSchedule && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">排程資訊</h4>
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="text-blue-600 dark:text-blue-400 font-medium">排程日期：</span>
                      <span className="text-blue-800 dark:text-blue-300">{selectedSchedule.scheduledDate}</span>
                    </div>
                    <div>
                      <span className="text-blue-600 dark:text-blue-400 font-medium">排程金額：</span>
                      <span className="text-green-600 dark:text-green-400 font-semibold">${Number(selectedSchedule.scheduledAmount).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailDialog(false)}
                  data-testid="btn-close-detail"
                >
                  關閉
                </Button>
                {selectedSchedule && (
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                    onClick={() => {
                      if (confirm('確定要將此項目退回項目列表嗎？')) {
                        deleteScheduleMutation.mutate(selectedSchedule.id);
                      }
                    }}
                    disabled={deleteScheduleMutation.isPending}
                    data-testid="btn-delete-schedule"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    退回項目列表
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
