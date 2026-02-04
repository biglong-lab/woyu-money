import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Calendar, DollarSign, TrendingUp, AlertCircle, Clock, CheckCircle, XCircle, Eye, CreditCard, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface IntegratedPaymentItem {
  id: number;
  itemName: string;
  totalAmount: string;
  actualPaid: string;
  scheduledTotal: string;
  pendingAmount: string;
  priority: number;
  startDate?: string;
  categoryName?: string;
  projectName?: string;
  paymentRecords: PaymentRecord[];
  schedules: Schedule[]; // 所有排程記錄
  monthSchedules: Schedule[]; // 當月排程記錄
  scheduleCount: number;
  recordCount: number;
  hasOverdueSchedule: boolean; // 是否有逾期未執行的排程
}

interface PaymentRecord {
  id: number;
  itemId: number;
  amount: string;
  paymentDate: string;
  paymentMethod?: string;
  notes?: string;
}

interface Schedule {
  id: number;
  paymentItemId: number;
  scheduledDate: string;
  scheduledAmount: string;
  status: string;
  notes?: string;
  isOverdue: boolean;
}

interface MonthSchedule {
  id: number;
  paymentItemId: number;
  scheduledDate: string;
  scheduledAmount: string;
  status: string;
  notes?: string;
  isOverdue: boolean;
}

const scheduleFormSchema = z.object({
  scheduledAmount: z.string().min(1, '請輸入金額'),
  notes: z.string().optional(),
});

export default function PaymentScheduleOptimized() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<IntegratedPaymentItem | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [viewSchedule, setViewSchedule] = useState<Schedule | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // 獲取整合項目數據
  const { data: integratedItems = [], isLoading } = useQuery<IntegratedPaymentItem[]>({
    queryKey: ['/api/payment/items/integrated', year, month],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/payment/items/integrated?year=${year}&month=${month}`);
      return response as IntegratedPaymentItem[];
    },
  });

  // 獲取當月排程（明確傳遞年月參數）
  const { data: allSchedules = [] } = useQuery<MonthSchedule[]>({
    queryKey: ['/api/payment/schedule'],
  });

  // 客戶端過濾當月排程
  const monthSchedules = allSchedules.filter(schedule => {
    const scheduleDate = new Date(schedule.scheduledDate);
    return scheduleDate.getMonth() === (month - 1) && scheduleDate.getFullYear() === year;
  });

  // 項目分類邏輯
  const categorizeItems = () => {
    const today = new Date();
    const scheduledItemIds = new Set(monthSchedules.map(s => s.paymentItemId));

    // 已完成（實際付款完成）
    const completed = integratedItems.filter(item => {
      const pending = parseFloat(item.pendingAmount);
      return pending <= 0;
    });

    // 逾期未執行（有任何逾期未完成的排程）
    const overdueUnexecuted = integratedItems.filter(item => {
      const isPending = parseFloat(item.pendingAmount) > 0;
      // 檢查是否有逾期排程（所有排程記錄，不只當月）
      const hasOverdue = item.schedules.some(s => {
        const scheduleDate = new Date(s.scheduledDate);
        return scheduleDate < today && s.status !== 'completed';
      });
      return hasOverdue && isPending;
    });

    // 已計劃待執行（本月有排程且未完成，且不在逾期列表中）
    const scheduledPending = integratedItems.filter(item => {
      const hasMonthSchedule = scheduledItemIds.has(item.id);
      const isPending = parseFloat(item.pendingAmount) > 0;
      const notOverdue = !overdueUnexecuted.includes(item);
      return hasMonthSchedule && isPending && notOverdue;
    });

    // 未排程（沒有任何排程且未完成）
    const unscheduled = integratedItems.filter(item => {
      const hasNoSchedule = item.schedules.length === 0;
      const isPending = parseFloat(item.pendingAmount) > 0;
      return hasNoSchedule && isPending;
    });

    return {
      completed,
      overdueUnexecuted,
      scheduledPending,
      unscheduled,
    };
  };

  const categories = categorizeItems();

  // 計算統計
  const stats = {
    totalScheduled: monthSchedules.length,
    scheduledAmount: monthSchedules.reduce((sum, s) => sum + parseFloat(s.scheduledAmount || '0'), 0),
    totalPending: integratedItems.reduce((sum, item) => sum + parseFloat(item.pendingAmount || '0'), 0),
    overdueCount: categories.overdueUnexecuted.length,
  };

  // 計算當月實際付款金額
  const currentMonthPaid = integratedItems.reduce((sum, item) => {
    const monthRecords = item.paymentRecords.filter(r => {
      const recordDate = new Date(r.paymentDate);
      return recordDate.getMonth() === (month - 1) && recordDate.getFullYear() === year;
    });
    return sum + monthRecords.reduce((s, r) => s + parseFloat(r.amount || '0'), 0);
  }, 0);

  // 月度預算邏輯：
  // - 月度預算 = 當月排程金額（代表本月計劃支付的金額）
  // - 預算使用率 = 當月已付 / 當月排程（已執行多少計劃）
  // - 可用額度 = 當月排程 - 當月已付（還有多少計劃未執行）
  const monthlyBudget = stats.scheduledAmount;
  const budgetUsageRate = monthlyBudget > 0 ? (currentMonthPaid / monthlyBudget) * 100 : 0;
  const scheduleExecutionRate = stats.scheduledAmount > 0 ? (currentMonthPaid / stats.scheduledAmount) * 100 : 0;
  const availableBudget = monthlyBudget - currentMonthPaid;

  // 建立排程
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
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items/integrated'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule'] });
      setShowScheduleDialog(false);
      setSelectedItem(null);
    },
    onError: (error: any) => {
      toast({
        title: '錯誤',
        description: error.message || '建立付款計劃失敗',
        variant: 'destructive',
      });
    },
  });

  // 重新排程
  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, newDate, notes }: { id: number; newDate: string; notes?: string }) => {
      return await apiRequest('POST', `/api/payment/reschedule/${id}`, { newDate, notes });
    },
    onSuccess: () => {
      toast({ title: '成功', description: '已重新排程' });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items/integrated'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule'] });
    },
    onError: (error: any) => {
      toast({
        title: '錯誤',
        description: error.message || '重新排程失敗',
        variant: 'destructive',
      });
    },
  });

  const form = useForm({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      scheduledAmount: '',
      notes: '',
    },
  });

  const handleCreateSchedule = (data: { scheduledAmount: string; notes?: string }) => {
    if (!selectedItem || !selectedDate) {
      toast({
        title: '錯誤',
        description: '請選擇計劃日期',
        variant: 'destructive',
      });
      return;
    }

    createScheduleMutation.mutate({
      paymentItemId: selectedItem.id,
      scheduledDate: selectedDate,
      scheduledAmount: data.scheduledAmount.replace(/,/g, ''),
      notes: data.notes,
    });
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId.startsWith('item-list') && destination.droppableId.startsWith('day-')) {
      const targetDate = destination.droppableId.replace('day-', '');
      const itemId = parseInt(draggableId.replace('item-', ''));
      const item = integratedItems.find(i => i.id === itemId);

      if (item) {
        setSelectedItem(item);
        setSelectedDate(targetDate);
        form.reset({
          scheduledAmount: item.pendingAmount,
          notes: '',
        });
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

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getSchedulesForDate = (date: string) => {
    return monthSchedules.filter(s => s.scheduledDate === date);
  };

  // 快速執行付款
  const handleQuickPayment = (item: IntegratedPaymentItem, schedule?: Schedule) => {
    setLocation(`/payment-records?itemId=${item.id}&amount=${schedule?.scheduledAmount || item.pendingAmount}&date=${schedule?.scheduledDate || ''}`);
  };

  const renderItemCard = (item: IntegratedPaymentItem, status: 'overdue' | 'scheduled' | 'unscheduled' | 'completed') => {
    const totalAmount = parseFloat(item.totalAmount);
    const actualPaid = parseFloat(item.actualPaid);
    const scheduledTotal = parseFloat(item.scheduledTotal);
    const pending = parseFloat(item.pendingAmount);
    const paymentProgress = totalAmount > 0 ? (actualPaid / totalAmount) * 100 : 0;

    const statusConfig = {
      overdue: { color: 'bg-red-50 border-red-200', badge: 'destructive', icon: XCircle, label: '逾期未付' },
      scheduled: { color: 'bg-yellow-50 border-yellow-200', badge: 'default', icon: Clock, label: '已計劃' },
      unscheduled: { color: 'bg-gray-50 border-gray-200', badge: 'secondary', icon: AlertCircle, label: '未排程' },
      completed: { color: 'bg-green-50 border-green-200', badge: 'default', icon: CheckCircle, label: '已完成' },
    };

    const config = statusConfig[status];
    const StatusIcon = config.icon;

    return (
      <Card className={`${config.color} border-2 cursor-move hover:shadow-md transition-shadow`} data-testid={`item-card-${item.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <StatusIcon className="h-4 w-4" />
                {item.itemName}
              </CardTitle>
              <div className="text-xs text-gray-500 mt-1">
                {item.projectName && <span className="mr-2">📁 {item.projectName}</span>}
                {item.categoryName && <span>🏷️ {item.categoryName}</span>}
              </div>
            </div>
            <Badge variant={config.badge as any} className="ml-2">{config.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 三維金額顯示 */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-gray-500">應付總額</div>
              <div className="font-semibold text-gray-900">${totalAmount.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-500">實際已付</div>
              <div className="font-semibold text-green-600">${actualPaid.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-500">計劃金額</div>
              <div className="font-semibold text-blue-600">${scheduledTotal.toLocaleString()}</div>
            </div>
          </div>

          {/* 付款進度條 */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">付款進度</span>
              <span className="font-medium">{paymentProgress.toFixed(0)}%</span>
            </div>
            <Progress value={paymentProgress} className="h-2" />
          </div>

          {/* 待付金額 */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <div className="text-xs text-gray-500">待付金額</div>
              <div className="text-lg font-bold text-orange-600">${pending.toLocaleString()}</div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedItem(item);
                  setShowDetailDialog(true);
                }}
                data-testid={`btn-view-detail-${item.id}`}
              >
                <Eye className="h-3 w-3 mr-1" />
                詳情
              </Button>
            </div>
          </div>

          {/* 排程記錄提示 */}
          {item.scheduleCount > 0 && (
            <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
              📅 已安排 {item.scheduleCount} 次排程
              {item.recordCount > 0 && ` · ✅ 已付款 ${item.recordCount} 次`}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* 標題與控制 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">給付款項時間計劃</h1>
          <p className="text-gray-600 mt-2">預算規劃與執行追蹤系統</p>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setCurrentDate(subMonths(currentDate, 1))} data-testid="btn-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[120px] text-center" data-testid="text-current-month">
            {format(currentDate, 'yyyy年MM月')}
          </span>
          <Button variant="outline" onClick={() => setCurrentDate(addMonths(currentDate, 1))} data-testid="btn-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 預算概覽面板 */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200" data-testid="card-budget-overview">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
            {format(currentDate, 'yyyy年MM月')} 預算概覽與執行追蹤
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-6">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">月度預算</div>
              <div className="text-2xl font-bold text-gray-900">${monthlyBudget.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">已排程金額</div>
              <div className="text-2xl font-bold text-blue-600">${stats.scheduledAmount.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">{stats.totalScheduled} 筆排程</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">已執行付款</div>
              <div className="text-2xl font-bold text-green-600">${currentMonthPaid.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">實際已付款</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">可用額度</div>
              <div className="text-2xl font-bold text-orange-600">${availableBudget.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">剩餘可規劃</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">計劃執行率</div>
              <div className={`text-2xl font-bold ${scheduleExecutionRate >= 80 ? 'text-green-600' : scheduleExecutionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {scheduleExecutionRate.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">已付/已排程</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">預算使用進度</span>
                <span className="font-medium">{budgetUsageRate.toFixed(1)}%</span>
              </div>
              <Progress value={budgetUsageRate} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">排程執行進度</span>
                <span className="font-medium">{scheduleExecutionRate.toFixed(1)}%</span>
              </div>
              <Progress value={scheduleExecutionRate} className={`h-2`} />
            </div>
          </div>
          <div className="mt-4 flex items-start gap-3 text-sm">
            {scheduleExecutionRate < 50 && stats.scheduledAmount > 0 && (
              <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center text-yellow-800">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span className="font-medium">執行率偏低</span>
                </div>
                <div className="text-yellow-700 mt-1">
                  本月已排程 ${stats.scheduledAmount.toLocaleString()}，但僅執行 ${currentMonthPaid.toLocaleString()}，請加快付款進度
                </div>
              </div>
            )}
            {stats.overdueCount > 0 && (
              <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center text-red-800">
                  <XCircle className="h-4 w-4 mr-2" />
                  <span className="font-medium">逾期提醒</span>
                </div>
                <div className="text-red-700 mt-1">
                  有 {stats.overdueCount} 個項目逾期未執行，請盡快處理
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 統計卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card data-testid="card-scheduled">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              本月排程
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalScheduled}</div>
            <div className="text-xs text-gray-500">${stats.scheduledAmount.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-pending">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <DollarSign className="h-4 w-4 mr-1" />
              總待付金額
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">${stats.totalPending.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-unscheduled">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              未排程項目
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{categories.unscheduled.length}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-overdue">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              逾期未執行
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdueCount}</div>
          </CardContent>
        </Card>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-12 gap-6">
          {/* 日曆區域 */}
          <div className="col-span-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  {format(currentDate, 'yyyy年MM月')} 付款時間計劃
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                    <div key={day} className="p-2 text-center font-medium text-gray-500 border-b">
                      {day}
                    </div>
                  ))}

                  {calendarDays.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const daySchedules = getSchedulesForDate(dateStr);
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const totalAmount = daySchedules.reduce((sum, s) => sum + parseFloat(s.scheduledAmount || '0'), 0);

                    return (
                      <Droppable key={dateStr} droppableId={`day-${dateStr}`}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`
                              min-h-[100px] p-2 border rounded-lg transition-colors
                              ${isToday ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}
                              ${!isCurrentMonth ? 'opacity-40' : ''}
                              ${snapshot.isDraggingOver ? 'bg-blue-100 border-blue-400' : ''}
                            `}
                            data-testid={`day-${dateStr}`}
                          >
                            <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                              {format(day, 'd')}
                            </div>

                            <div className="space-y-1">
                              {daySchedules.map((schedule, index) => {
                                const item = integratedItems.find(i => i.id === schedule.paymentItemId);
                                return (
                                  <Draggable key={schedule.id} draggableId={`schedule-${schedule.id}`} index={index}>
                                    {(provided) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`
                                          p-1 rounded text-xs cursor-move
                                          ${schedule.isOverdue ? 'bg-red-100 border border-red-300' : 'bg-green-100 border border-green-300'}
                                        `}
                                        onClick={() => {
                                          setViewSchedule(schedule);
                                          setSelectedItem(item || null);
                                          setShowDetailDialog(true);
                                        }}
                                        data-testid={`schedule-${schedule.id}`}
                                      >
                                        <div className="font-medium truncate">{item?.itemName || '未知項目'}</div>
                                        <div className="text-gray-600">${parseFloat(schedule.scheduledAmount).toLocaleString()}</div>
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                            </div>

                            {daySchedules.length > 0 && (
                              <div className="mt-2 pt-1 border-t text-xs font-medium text-gray-600">
                                ${totalAmount.toLocaleString()}
                              </div>
                            )}

                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 項目列表區域 */}
          <div className="col-span-4 space-y-4">
            {/* 逾期未執行 */}
            {categories.overdueUnexecuted.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-red-600 mb-3 flex items-center">
                  <XCircle className="h-5 w-5 mr-2" />
                  逾期未執行 ({categories.overdueUnexecuted.length})
                </h3>
                <Droppable droppableId="item-list-overdue">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {categories.overdueUnexecuted.map((item, index) => (
                        <Draggable key={item.id} draggableId={`item-${item.id}`} index={index}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                              {renderItemCard(item, 'overdue')}
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

            {/* 已計劃待執行 */}
            {categories.scheduledPending.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-yellow-600 mb-3 flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  已計劃待執行 ({categories.scheduledPending.length})
                </h3>
                <Droppable droppableId="item-list-scheduled">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {categories.scheduledPending.map((item, index) => (
                        <Draggable key={item.id} draggableId={`item-${item.id}`} index={index}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                              {renderItemCard(item, 'scheduled')}
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

            {/* 未排程 */}
            {categories.unscheduled.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-600 mb-3 flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  未排程項目 ({categories.unscheduled.length})
                </h3>
                <Droppable droppableId="item-list-unscheduled">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {categories.unscheduled.map((item, index) => (
                        <Draggable key={item.id} draggableId={`item-${item.id}`} index={index}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                              {renderItemCard(item, 'unscheduled')}
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
          </div>
        </div>
      </DragDropContext>

      {/* 建立排程對話框 */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent data-testid="dialog-create-schedule">
          <DialogHeader>
            <DialogTitle>建立付款計劃</DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="font-semibold">{selectedItem.itemName}</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-gray-500">應付總額</div>
                    <div className="font-medium">${parseFloat(selectedItem.totalAmount).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">實際已付</div>
                    <div className="font-medium text-green-600">${parseFloat(selectedItem.actualPaid).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">待付金額</div>
                    <div className="font-medium text-orange-600">${parseFloat(selectedItem.pendingAmount).toLocaleString()}</div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  計劃日期：{selectedDate}
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateSchedule)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="scheduledAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>計劃金額</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="請輸入計劃金額" data-testid="input-scheduled-amount" />
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
                          <Textarea {...field} placeholder="選填" rows={3} data-testid="textarea-notes" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowScheduleDialog(false)}>
                      取消
                    </Button>
                    <Button type="submit" disabled={createScheduleMutation.isPending} data-testid="btn-submit-schedule">
                      {createScheduleMutation.isPending ? '建立中...' : '建立計劃'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 項目詳情對話框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl" data-testid="dialog-item-detail">
          <DialogHeader>
            <DialogTitle>項目詳情與排程歷史</DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-6">
              {/* 項目基本信息 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-3">{selectedItem.itemName}</h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">應付總額</div>
                    <div className="text-xl font-bold">${parseFloat(selectedItem.totalAmount).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">實際已付</div>
                    <div className="text-xl font-bold text-green-600">${parseFloat(selectedItem.actualPaid).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">計劃金額</div>
                    <div className="text-xl font-bold text-blue-600">${parseFloat(selectedItem.scheduledTotal).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">待付金額</div>
                    <div className="text-xl font-bold text-orange-600">${parseFloat(selectedItem.pendingAmount).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 排程歷史 */}
              <div>
                <h4 className="font-semibold mb-3">排程歷史記錄 ({selectedItem.scheduleCount})</h4>
                {selectedItem.schedules.length > 0 ? (
                  <div className="space-y-2">
                    {selectedItem.schedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className={`p-3 rounded-lg border ${
                          schedule.isOverdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {schedule.scheduledDate}
                              {schedule.isOverdue && <Badge variant="destructive" className="ml-2">逾期</Badge>}
                              {schedule.status === 'completed' && <Badge className="ml-2">已完成</Badge>}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              計劃金額：${parseFloat(schedule.scheduledAmount).toLocaleString()}
                            </div>
                            {schedule.notes && (
                              <div className="text-sm text-gray-500 mt-1">備註：{schedule.notes}</div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleQuickPayment(selectedItem, schedule)}
                            data-testid={`btn-quick-pay-${schedule.id}`}
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            立即付款
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">尚無排程記錄</div>
                )}
              </div>

              <Separator />

              {/* 付款記錄 */}
              <div>
                <h4 className="font-semibold mb-3">實際付款記錄 ({selectedItem.recordCount})</h4>
                {selectedItem.paymentRecords.length > 0 ? (
                  <div className="space-y-2">
                    {selectedItem.paymentRecords.map((record) => (
                      <div key={record.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{record.paymentDate}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              付款金額：${parseFloat(record.amount).toLocaleString()}
                              {record.paymentMethod && ` · ${record.paymentMethod}`}
                            </div>
                            {record.notes && (
                              <div className="text-sm text-gray-500 mt-1">{record.notes}</div>
                            )}
                          </div>
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">尚無付款記錄</div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                  關閉
                </Button>
                <Button onClick={() => handleQuickPayment(selectedItem)} data-testid="btn-quick-payment">
                  <CreditCard className="h-4 w-4 mr-2" />
                  執行付款
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
