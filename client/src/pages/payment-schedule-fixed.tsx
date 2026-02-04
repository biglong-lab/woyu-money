import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, ChevronLeft, ChevronRight, CreditCard, Eye, Edit, ArrowLeft } from 'lucide-react';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PaymentItem {
  id: number;
  itemName: string;
  totalAmount: string;
  priority: number;
  dueDate?: string;
  description?: string;
  categoryName?: string;
  projectName?: string;
  scheduledAmount?: string; // 已排程金額
  remainingAmount?: string; // 剩餘可排程金額
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

const createScheduleSchema = z.object({
  scheduledAmount: z.string().min(1, '請輸入金額'),
  notes: z.string().optional(),
});

const paymentSchema = z.object({
  amountPaid: z.string().min(1, '請輸入付款金額'),
  paymentMethod: z.string().min(1, '請選擇付款方式'),
  receiptText: z.string().optional(),
  notes: z.string().optional(),
});

export default function PaymentSchedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PaymentItem | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<PaymentSchedule | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // 查詢當月付款計劃
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['/api/payment/schedule', year, month],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/payment/schedule/${year}/${month}`);
      return response || [];
    },
  });

  // 查詢統計資料
  const { data: stats } = useQuery<ScheduleStats>({
    queryKey: ['/api/payment/schedule/stats', year, month],
  });

  // 查詢未排程項目  
  const { data: allUnscheduledItems = [], isLoading: itemsLoading } = useQuery<PaymentItem[]>({
    queryKey: [`/api/payment/schedule/items/${year}/${month}`],
  });

  // 查詢所有逾期項目（包含本月之前的）
  const { data: overdueData = [] } = useQuery<PaymentItem[]>({
    queryKey: [`/api/payment/items/overdue`],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/payment/items/overdue');
      return response || [];
    },
  });

  // 過濾已排程項目，避免重複顯示
  const unscheduledItems = allUnscheduledItems.filter(item => 
    !schedules.some((schedule: PaymentSchedule) => schedule.paymentItemId === item.id)
  );

  // 過濾已排程的逾期項目
  const unscheduledOverdueItems = overdueData.filter(item => 
    !schedules.some((schedule: PaymentSchedule) => schedule.paymentItemId === item.id)
  );

  // 從逾期數據中區分當月逾期和歷史逾期
  const currentMonthOverdueItems = unscheduledOverdueItems.filter(item => 
    item.isCurrentMonthOverdue
  );
  
  const previousMonthsOverdueItems = unscheduledOverdueItems.filter(item => 
    item.isPreviousMonthsOverdue
  );

  // 當月正常項目（未逾期）
  const currentMonthItems = unscheduledItems.filter(item => 
    !item.dueDate || new Date(item.dueDate) >= new Date()
  );



  // 查詢所有付款項目（用於查找已排程項目的詳細信息）
  const { data: allPaymentItems = [] } = useQuery<PaymentItem[]>({
    queryKey: ['/api/payment/items', 'all'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/payment/items?includeAll=true');
      return response?.items || response || [];
    },
  });

  // 合併所有項目供拖拽使用（去重並包括已排程項目的詳細信息）
  const allItemsMap = new Map();
  
  // 添加所有付款項目作為基礎數據源
  allPaymentItems.forEach(item => allItemsMap.set(item.id, item));
  
  // 更新或添加未排程項目（覆蓋可能過時的數據）
  allUnscheduledItems.forEach(item => allItemsMap.set(item.id, item));
  
  // 更新或添加逾期項目（覆蓋可能過時的數據）
  overdueData.forEach(item => allItemsMap.set(item.id, item));
  
  const allItemsForDrag = Array.from(allItemsMap.values());

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
    },
    onError: (error: any) => {
      toast({ 
        title: '錯誤', 
        description: error.message || '重新排程失敗',
        variant: 'destructive' 
      });
    },
  });

  // 生成日曆日期 - 包含完整的週格子
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  // 生成完整的日曆格子，從該月第一週的星期日開始到最後一週的星期六結束
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // 星期日開始
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // 拖拽處理
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    if ((source.droppableId === 'unscheduled' || 
         source.droppableId === 'current-overdue' || 
         source.droppableId === 'historical-overdue') && 
        destination.droppableId.startsWith('day-')) {
      // 從未排程拖到日期
      const targetDate = destination.droppableId.replace('day-', '');
      
      // 正確解析項目ID
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
        console.log('找到項目:', item.itemName);
        setSelectedItem(item);
        setSelectedDate(targetDate);
        setShowScheduleDialog(true);
      } else {
        console.log('找不到項目，所有可用項目:', [...allUnscheduledItems, ...overdueData].map(i => `${i.id}: ${i.itemName}`));
      }
    } else if (source.droppableId.startsWith('day-') && destination.droppableId.startsWith('day-')) {
      // 在日期間拖拽 - 重新排程
      const newDate = destination.droppableId.replace('day-', '');
      const schedule = schedules.find((s: PaymentSchedule) => s.id.toString() === draggableId);
      
      if (schedule && newDate !== schedule.scheduledDate) {
        rescheduleMutation.mutate({
          id: schedule.id,
          newDate,
          notes: `從 ${schedule.scheduledDate} 重新排程至 ${newDate}`,
        });
      }
    }
  };

  // 獲取特定日期的計劃
  const getSchedulesForDate = (date: string) => {
    if (!schedules || schedules.length === 0) {
      return [];
    }
    return schedules.filter((schedule: PaymentSchedule) => schedule.scheduledDate === date);
  };

  // 計算日期統計
  const getDateStats = (date: string) => {
    return stats?.dailyStats[date] || { amount: 0, count: 0 };
  };

  // 刪除排程 mutation (退回項目列表)
  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      return await apiRequest('DELETE', `/api/payment/schedule/${scheduleId}`);
    },
    onSuccess: () => {
      toast({ title: '成功', description: '排程已刪除，項目已退回列表' });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items'] });
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

  // 付款 mutation
  const paymentMutation = useMutation({
    mutationFn: async (data: {
      itemId: number;
      amountPaid: string;
      paymentMethod: string;
      receiptText?: string;
      notes?: string;
    }) => {
      return await apiRequest('POST', '/api/payment/records', {
        ...data,
        paymentDate: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      toast({ title: '成功', description: '付款記錄已建立' });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items'] });
      setShowPaymentDialog(false);
      setSelectedItem(null);
    },
    onError: (error: any) => {
      toast({ 
        title: '錯誤', 
        description: error.message || '建立付款記錄失敗',
        variant: 'destructive' 
      });
    },
  });

  // 創建付款計劃
  const handleCreateSchedule = (data: { scheduledAmount: string; notes?: string }) => {
    if (!selectedItem) return;
    if (!selectedDate) {
      toast({ 
        title: '錯誤', 
        description: '請選擇計劃日期',
        variant: 'destructive' 
      });
      return;
    }

    // 移除千分位分隔符並確保是數字格式
    const cleanAmount = data.scheduledAmount.replace(/,/g, '');

    console.log('建立付款計劃請求:', {
      paymentItemId: selectedItem.id,
      scheduledDate: selectedDate,
      scheduledAmount: cleanAmount,
      notes: data.notes,
    });

    createScheduleMutation.mutate({
      paymentItemId: selectedItem.id,
      scheduledDate: selectedDate,
      scheduledAmount: cleanAmount,
      notes: data.notes,
    });
  };

  // 處理付款
  const handlePayment = (data: { amountPaid: string; paymentMethod: string; receiptText?: string; notes?: string }) => {
    if (!selectedItem) return;

    paymentMutation.mutate({
      itemId: selectedItem.id,
      ...data,
    });
  };

  const form = useForm({
    resolver: zodResolver(createScheduleSchema),
    defaultValues: {
      scheduledAmount: '',
      notes: '',
    },
  });

  // 當選中項目改變時重置表單並設定預設值
  useEffect(() => {
    if (selectedItem) {
      // 使用剩餘可排程金額作為預設值，如果沒有則使用總金額
      const defaultAmount = selectedItem.remainingAmount || selectedItem.totalAmount;
      const cleanAmount = defaultAmount.replace(/,/g, ''); // 移除千分位符
      form.reset({
        scheduledAmount: cleanAmount,
        notes: ''
      });
    }
  }, [selectedItem, form]);

  const paymentForm = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amountPaid: '',
      paymentMethod: '',
      receiptText: '',
      notes: '',
    },
  });

  // 當選中項目改變時重置付款表單並設定預設值  
  useEffect(() => {
    if (selectedItem) {
      // 使用剩餘可排程金額作為預設值，如果沒有則使用總金額
      const defaultAmount = selectedItem.remainingAmount || selectedItem.totalAmount;
      const cleanAmount = defaultAmount.replace(/,/g, ''); // 移除千分位符
      paymentForm.reset({
        amountPaid: cleanAmount,
        paymentMethod: '',
        receiptText: '',
        notes: ''
      });
    }
  }, [selectedItem, paymentForm]);



  return (
    <div className="space-y-6 p-6">
      {/* 標題與控制區 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">給付款項時間計劃</h1>
          <p className="text-gray-600 mt-2">拖拉付款項目到預計給付日期，管理現金流時間安排</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[120px] text-center">
            {format(currentDate, 'yyyy年MM月')}
          </span>
          <Button
            variant="outline"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 統計卡片 */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">本月排程項目</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalScheduled}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">本月排程金額</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${stats.totalAmount?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">待排程項目</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {unscheduledItems.length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-12 gap-6">
          {/* 左側：日曆 */}
          <div className="col-span-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  付款時間計劃
                </CardTitle>
              </CardHeader>
              <CardContent>
                {schedulesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-2">
                    {/* 星期標題 */}
                    {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                      <div key={day} className="p-2 text-center font-medium text-gray-500 border-b">
                        {day}
                      </div>
                    ))}
                    
                    {/* 日期格子 */}
                    {calendarDays.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const daySchedules = schedulesLoading ? [] : getSchedulesForDate(dateStr);
                      const dateStats = getDateStats(dateStr);
                      const isToday = isSameDay(day, new Date());
                      const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                      
                      return (
                        <Droppable key={dateStr} droppableId={`day-${dateStr}`}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`
                                min-h-[120px] p-2 border rounded-lg transition-colors
                                ${snapshot.isDraggingOver ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}
                                ${isToday ? 'ring-2 ring-blue-500' : ''}
                                ${!isCurrentMonth ? 'bg-gray-50 opacity-50' : ''}
                              `}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className={`text-sm font-medium ${
                                  isToday ? 'text-blue-600' : 
                                  !isCurrentMonth ? 'text-gray-400' : 'text-gray-700'
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
                                <div className="text-xs text-green-600 font-medium mb-2">
                                  ${dateStats.amount.toLocaleString()}
                                </div>
                              )}
                              
                              <div className="space-y-1">
                                {daySchedules.map((schedule: PaymentSchedule, index: number) => {
                                  const relatedItem = allItemsForDrag.find(item => item.id === schedule.paymentItemId);

                                  return (
                                    <Draggable
                                      key={schedule.id}
                                      draggableId={schedule.id.toString()}
                                      index={index}
                                    >
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`
                                            p-2 text-xs rounded border cursor-move
                                            ${snapshot.isDragging ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 border-gray-200'}
                                            hover:bg-gray-100 transition-colors
                                            ${schedule.isOverdue ? 'bg-red-100 border-red-200' : ''}
                                          `}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (relatedItem) {
                                              setSelectedItem(relatedItem);
                                              setSelectedSchedule(schedule);
                                              setShowDetailDialog(true);
                                            }
                                          }}
                                        >
                                          <div className="font-medium text-gray-700 truncate" title={relatedItem?.itemName}>
                                            {relatedItem?.itemName || `項目 #${schedule.paymentItemId}`}
                                          </div>
                                          <div className="text-green-600 font-medium">
                                            ${Number(schedule.scheduledAmount).toLocaleString()}
                                          </div>
                                          {schedule.notes && (
                                            <div className="text-gray-500 text-xs mt-1 truncate">
                                              {schedule.notes}
                                            </div>
                                          )}
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
          </div>

          {/* 右側：未排程項目 */}
          <div className="col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  待排程項目
                </CardTitle>
              </CardHeader>
              <CardContent>
                {itemsLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 當月正常項目區塊 */}
                    {currentMonthItems.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-blue-600 mb-2">當月項目 ({currentMonthItems.length})</h3>
                        <Droppable droppableId="unscheduled">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`
                                space-y-2 min-h-[200px] p-2 rounded border-2 border-dashed border-blue-300
                                ${snapshot.isDraggingOver ? 'border-blue-400 bg-blue-50' : ''}
                              `}
                            >
                              {currentMonthItems.map((item, index) => (
                                <Draggable
                                  key={`unscheduled-${item.id}`}
                                  draggableId={`unscheduled-${item.id}`}
                                  index={index}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`
                                        p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-move transition-shadow
                                        ${snapshot.isDragging ? 'shadow-lg bg-white' : 'hover:shadow-md'}
                                      `}
                                      onClick={() => {
                                        setSelectedItem(item);
                                        setSelectedSchedule(null);
                                        setShowDetailDialog(true);
                                      }}
                                    >
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="font-medium text-sm text-blue-800 truncate" title={item.itemName}>
                                            {item.itemName}
                                          </div>
                                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                            當月
                                          </Badge>
                                        </div>
                                        
                                        <div className="flex items-center justify-between text-xs">
                                          <div className="flex flex-col">
                                            <span className="text-green-600 font-medium">
                                              ${parseFloat(item.remainingAmount || item.totalAmount).toLocaleString()}
                                            </span>
                                            {item.scheduledAmount && parseFloat(item.scheduledAmount) > 0 && (
                                              <span className="text-gray-500 text-xs">
                                                總計: ${parseFloat(item.totalAmount).toLocaleString()}
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-blue-600">
                                            {item.categoryName}
                                          </span>
                                        </div>
                                        
                                        {item.description && (
                                          <div className="text-xs text-gray-600 truncate" title={item.description}>
                                            {item.description}
                                          </div>
                                        )}
                                      </div>
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

                    {/* 當月逾期項目區塊（紅色） */}
                    {currentMonthOverdueItems.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-red-600 mb-2">當月逾期項目 ({currentMonthOverdueItems.length})</h3>
                        <Droppable droppableId="current-overdue">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`
                                space-y-2 min-h-[150px] p-2 rounded border-2 border-dashed border-red-300
                                ${snapshot.isDraggingOver ? 'border-red-400 bg-red-50' : ''}
                              `}
                            >
                              {currentMonthOverdueItems.map((item, index) => (
                                <Draggable
                                  key={`current-overdue-${item.id}`}
                                  draggableId={`current-overdue-${item.id}`}
                                  index={index}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`
                                        p-3 bg-red-50 border border-red-200 rounded-lg cursor-move transition-shadow
                                        ${snapshot.isDragging ? 'shadow-lg bg-white' : 'hover:shadow-md'}
                                      `}
                                      onClick={() => {
                                        setSelectedItem(item);
                                        setSelectedSchedule(null);
                                        setShowDetailDialog(true);
                                      }}
                                    >
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="font-medium text-sm text-red-800 truncate" title={item.itemName}>
                                            {item.itemName}
                                          </div>
                                          <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                                            當月逾期
                                          </Badge>
                                        </div>
                                        
                                        <div className="flex items-center justify-between text-xs">
                                          <div className="flex flex-col">
                                            <span className="text-green-600 font-medium">
                                              ${parseFloat(item.remainingAmount || item.totalAmount).toLocaleString()}
                                            </span>
                                            {item.scheduledAmount && parseFloat(item.scheduledAmount) > 0 && (
                                              <span className="text-gray-500 text-xs">
                                                總計: ${parseFloat(item.totalAmount).toLocaleString()}
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-red-600">
                                            {item.dueDate && `${Math.ceil((new Date().getTime() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24))} 天`}
                                          </span>
                                        </div>
                                        
                                        {item.description && (
                                          <div className="text-xs text-gray-600 truncate" title={item.description}>
                                            {item.description}
                                          </div>
                                        )}
                                      </div>
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

                    {/* 本月之前逾期項目區塊 */}
                    {previousMonthsOverdueItems.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-purple-600 mb-2">歷史逾期項目 ({previousMonthsOverdueItems.length})</h3>
                        <Droppable droppableId="historical-overdue">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`
                                space-y-2 min-h-[150px] p-2 rounded border-2 border-dashed border-purple-300
                                ${snapshot.isDraggingOver ? 'border-purple-400 bg-purple-50' : ''}
                              `}
                            >
                              {previousMonthsOverdueItems.map((item, index) => (
                                <Draggable
                                  key={`historical-${item.id}`}
                                  draggableId={`historical-${item.id}`}
                                  index={index}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`
                                        p-3 bg-purple-50 border border-purple-200 rounded-lg cursor-move transition-shadow
                                        ${snapshot.isDragging ? 'shadow-lg bg-white' : 'hover:shadow-md'}
                                      `}
                                      onClick={() => {
                                        setSelectedItem(item);
                                        setShowScheduleDialog(true);
                                      }}
                                    >
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="font-medium text-sm text-purple-800 truncate" title={item.itemName}>
                                            {item.itemName}
                                          </div>
                                          <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                                            歷史逾期
                                          </Badge>
                                        </div>
                                        
                                        <div className="flex items-center justify-between text-xs">
                                          <div className="flex flex-col">
                                            <span className="text-green-600 font-medium">
                                              ${parseFloat(item.remainingAmount || item.totalAmount).toLocaleString()}
                                            </span>
                                            {item.scheduledAmount && parseFloat(item.scheduledAmount) > 0 && (
                                              <span className="text-gray-500 text-xs">
                                                總計: ${parseFloat(item.totalAmount).toLocaleString()}
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-purple-600">
                                            {item.dueDate && `${Math.ceil((new Date().getTime() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24))} 天`}
                                          </span>
                                        </div>
                                        
                                        {item.description && (
                                          <div className="text-xs text-gray-600 truncate" title={item.description}>
                                            {item.description}
                                          </div>
                                        )}
                                      </div>
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



                    {/* 提示信息 */}
                    {unscheduledItems.length === 0 && currentMonthOverdueItems.length === 0 && previousMonthsOverdueItems.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        <Clock className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p>本月暫無待排程項目</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DragDropContext>

      {/* 建立計劃對話框 */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>建立付款計劃</DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium">{selectedItem.itemName}</h3>
                <p className="text-sm text-gray-600">總金額: ${parseFloat(selectedItem.totalAmount).toLocaleString()}</p>
                {selectedItem.scheduledAmount && parseFloat(selectedItem.scheduledAmount) > 0 && (
                  <>
                    <p className="text-sm text-blue-600">已排程: ${parseFloat(selectedItem.scheduledAmount).toLocaleString()}</p>
                    <p className="text-sm text-green-600 font-medium">可排程: ${parseFloat(selectedItem.remainingAmount || selectedItem.totalAmount).toLocaleString()}</p>
                  </>
                )}
                <p className="text-sm text-gray-600">計劃日期: {selectedDate}</p>
              </div>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateSchedule)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="scheduledAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>計劃付款金額 *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="輸入金額"
                            {...field}
                            onChange={(e) => {
                              // 確保輸入的是純數字格式
                              const value = e.target.value.replace(/,/g, '');
                              field.onChange(value);
                            }}
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
                            placeholder="新增計劃備註..."
                            {...field}
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
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      disabled={createScheduleMutation.isPending}
                    >
                      建立計劃
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 付款詳細對話框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Eye className="mr-2 h-5 w-5" />
              項目詳細資訊
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">{selectedItem.itemName}</h3>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 font-medium">總金額：</span>
                    <span className="text-green-600 font-semibold">${parseFloat(selectedItem.totalAmount).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 font-medium">優先級：</span>
                    <Badge variant={(selectedItem.priority || 1) >= 3 ? 'destructive' : 'secondary'}>
                      {selectedItem.priority || 1}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-600 font-medium">專案：</span>
                    <span className="text-gray-800">{selectedItem.projectName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 font-medium">分類：</span>
                    <span className="text-gray-800">{selectedItem.categoryName}</span>
                  </div>
                  {selectedItem.dueDate && (
                    <>
                      <div>
                        <span className="text-gray-600 font-medium">到期日：</span>
                        <span className="text-gray-800">{new Date(selectedItem.dueDate).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 font-medium">逾期天數：</span>
                        <span className={new Date(selectedItem.dueDate) < new Date() ? 'text-red-600 font-semibold' : 'text-green-600'}>
                          {new Date(selectedItem.dueDate) < new Date() 
                            ? `${Math.ceil((new Date().getTime() - new Date(selectedItem.dueDate).getTime()) / (1000 * 60 * 60 * 24))} 天`
                            : '未逾期'
                          }
                        </span>
                      </div>
                    </>
                  )}
                </div>
                
                {selectedItem.description && (
                  <div className="mt-3">
                    <span className="text-gray-600 font-medium">描述：</span>
                    <p className="text-gray-800 mt-1">{selectedItem.description}</p>
                  </div>
                )}

                {selectedSchedule && (
                  <div className="mt-4 p-3 bg-blue-50 rounded border">
                    <h4 className="font-medium text-blue-800 mb-2">排程資訊</h4>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="text-blue-600 font-medium">排程日期：</span>
                        <span className="text-blue-800">{selectedSchedule.scheduledDate}</span>
                      </div>
                      <div>
                        <span className="text-blue-600 font-medium">排程金額：</span>
                        <span className="text-green-600 font-semibold">${Number(selectedSchedule.scheduledAmount).toLocaleString()}</span>
                      </div>
                      {selectedSchedule.notes && (
                        <div>
                          <span className="text-blue-600 font-medium">備註：</span>
                          <span className="text-blue-800">{selectedSchedule.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailDialog(false)}
                >
                  關閉
                </Button>
                <div className="space-x-2">
                  {selectedSchedule && (
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => {
                        if (confirm('確定要將此項目退回項目列表嗎？這將刪除現有的排程安排。')) {
                          deleteScheduleMutation.mutate(selectedSchedule.id);
                        }
                      }}
                      disabled={deleteScheduleMutation.isPending}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      退回項目列表
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDetailDialog(false);
                      setShowEditDialog(true);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    編輯項目
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDetailDialog(false);
                      setShowScheduleDialog(true);
                    }}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedSchedule ? '重新排程' : '建立排程'}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDetailDialog(false);
                      setShowPaymentDialog(true);
                    }}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    立即付款
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 付款對話框 */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <CreditCard className="mr-2 h-5 w-5" />
              建立付款記錄
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium">{selectedItem.itemName}</h3>
                <p className="text-sm text-gray-600">總金額: ${parseFloat(selectedItem.totalAmount).toLocaleString()}</p>
                {selectedItem.scheduledAmount && parseFloat(selectedItem.scheduledAmount) > 0 && (
                  <>
                    <p className="text-sm text-blue-600">已排程: ${parseFloat(selectedItem.scheduledAmount).toLocaleString()}</p>
                    <p className="text-sm text-green-600 font-medium">可排程: ${parseFloat(selectedItem.remainingAmount || selectedItem.totalAmount).toLocaleString()}</p>
                  </>
                )}
              </div>
              
              <Form {...paymentForm}>
                <form onSubmit={paymentForm.handleSubmit(handlePayment)} className="space-y-4">
                  <FormField
                    control={paymentForm.control}
                    name="amountPaid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>付款金額 *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="輸入付款金額"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={paymentForm.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>付款方式 *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="選擇付款方式" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                            <SelectItem value="credit_card">信用卡</SelectItem>
                            <SelectItem value="cash">現金</SelectItem>
                            <SelectItem value="check">支票</SelectItem>
                            <SelectItem value="other">其他</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={paymentForm.control}
                    name="receiptText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>收據資訊</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="收據號碼或參考資訊"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={paymentForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>備註</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="付款備註..."
                            {...field}
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
                      onClick={() => setShowPaymentDialog(false)}
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      disabled={paymentMutation.isPending}
                    >
                      確認付款
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 編輯項目對話框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Edit className="mr-2 h-5 w-5" />
              編輯付款項目
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <EditItemForm 
              item={selectedItem}
              onSave={(updatedItem) => {
                // 更新項目後刷新數據
                queryClient.invalidateQueries({ queryKey: ['/api/payment/schedule'] });
                queryClient.invalidateQueries({ queryKey: ['/api/payment/items'] });
                setShowEditDialog(false);
                toast({ title: '成功', description: '項目已更新' });
              }}
              onCancel={() => setShowEditDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 編輯項目表單組件
function EditItemForm({ 
  item, 
  onSave, 
  onCancel 
}: {
  item: PaymentItem;
  onSave: (updatedItem: PaymentItem) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  
  const editSchema = z.object({
    itemName: z.string().min(1, '項目名稱為必填'),
    totalAmount: z.string().min(1, '總金額為必填'),
    description: z.string().optional(),
    priority: z.number().min(1).max(10),
    dueDate: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(editSchema),
    defaultValues: {
      itemName: item.itemName,
      totalAmount: item.totalAmount.replace(/,/g, ''),
      description: item.description || '',
      priority: item.priority || 5,
      dueDate: item.dueDate || '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editSchema>) => {
      return await apiRequest('PUT', `/api/payment/items/${item.id}`, {
        ...data,
        totalAmount: data.totalAmount.replace(/,/g, ''),
      });
    },
    onSuccess: (updatedItem) => {
      onSave(updatedItem);
    },
    onError: (error: any) => {
      toast({
        title: '錯誤',
        description: error.message || '更新項目失敗',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (data: z.infer<typeof editSchema>) => {
    updateMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="itemName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>項目名稱 *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="totalAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>總金額 *</FormLabel>
              <FormControl>
                <Input 
                  {...field}
                  placeholder="輸入總金額"
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d.]/g, '');
                    const formatted = value ? Number(value).toLocaleString() : '';
                    field.onChange(formatted);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>描述</FormLabel>
              <FormControl>
                <Textarea 
                  {...field}
                  placeholder="項目描述..."
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>優先級 (1-10)</FormLabel>
                <FormControl>
                  <Input 
                    type="number"
                    min="1"
                    max="10"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>到期日</FormLabel>
                <FormControl>
                  <Input 
                    type="date"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? '更新中...' : '保存更改'}
          </Button>
        </div>
      </form>
    </Form>
  );
}