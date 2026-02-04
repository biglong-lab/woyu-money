import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PaymentItem {
  id: number;
  itemName: string;
  totalAmount: string;
  paidAmount?: string;
  dueDate: string;
  projectName: string;
  categoryName: string;
  status: string;
  priority: number | null;
}

interface PaymentSchedule {
  id: number;
  paymentItemId: number;
  scheduledDate: string;
  originalDueDate: string;
  rescheduleCount: number;
  isOverdue: boolean;
  overdueDays: number;
  scheduledAmount: string;
  status: string;
  notes?: string;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface DailyStats {
  amount: number;
  count: number;
}

interface ScheduleStats {
  year: number;
  month: number;
  totalAmount: number;
  totalCount: number;
  overdueCount: number;
  dailyStats: Record<string, DailyStats>;
}

export default function PaymentSchedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PaymentItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // 查詢當月付款計劃
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['/api/payment/schedule', year, month],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/payment/schedule/${year}/${month}`);
      const data = await response;
      console.log('付款計劃查詢結果:', data);
      console.log('已排程項目數量:', data?.length || 0);
      return data || [];
    },
  });

  // 查詢統計資料
  const { data: stats } = useQuery<ScheduleStats>({
    queryKey: ['/api/payment/schedule/stats', year, month],
    queryFn: () => apiRequest('GET', `/api/payment/schedule/stats/${year}/${month}`).then(res => res.json()),
  });

  // 查詢未排程項目  
  const { data: allUnscheduledItems = [], isLoading: itemsLoading, error: itemsError } = useQuery<PaymentItem[]>({
    queryKey: [`/api/payment/schedule/items/${year}/${month}`],
  });

  // 過濾已排程項目，避免重複顯示
  const unscheduledItems = allUnscheduledItems.filter(item => 
    !schedules.some((schedule: PaymentSchedule) => schedule.paymentItemId === item.id)
  );

  // 區分逾期和當月項目
  const today = new Date();
  const overdueItems = unscheduledItems.filter(item => 
    item.dueDate && new Date(item.dueDate) < today
  );
  const currentMonthItems = unscheduledItems.filter(item => 
    !item.dueDate || new Date(item.dueDate) >= today
  );

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
      const response = await apiRequest('POST', `/api/payment/reschedule/${id}`, { newDate, notes });
      return response;
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

  // 生成日曆日期
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // 拖拽處理
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    if (source.droppableId === 'unscheduled' && destination.droppableId.startsWith('day-')) {
      // 從未排程拖到日期
      const targetDate = destination.droppableId.replace('day-', '');
      const item = unscheduledItems.find(item => item.id.toString() === draggableId);
      
      if (item) {
        setSelectedItem(item);
        setSelectedDate(targetDate);
        setShowScheduleDialog(true);
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
    const filtered = schedules.filter((schedule: PaymentSchedule) => schedule.scheduledDate === date);
    if (filtered.length > 0) {
      console.log(`找到日期 ${date} 的排程:`, filtered.length, '個項目');
    }
    return filtered;
  };

  // 計算日期統計
  const getDateStats = (date: string) => {
    return stats?.dailyStats[date] || { amount: 0, count: 0 };
  };

  // 創建付款計劃
  const handleCreateSchedule = (data: { scheduledAmount: string; notes?: string }) => {
    if (!selectedItem) return;

    createScheduleMutation.mutate({
      paymentItemId: selectedItem.id,
      scheduledDate: selectedDate,
      scheduledAmount: data.scheduledAmount,
      notes: data.notes,
    });
  };

  console.log('PaymentSchedule 渲染:', { 
    unscheduledItems: unscheduledItems.length, 
    itemsLoading, 
    itemsError: itemsError?.message 
  });

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
            onClick={() => setCurrentDate(new Date(year, month - 2, 1))}
          >
            上個月
          </Button>
          <span className="text-lg font-semibold min-w-[120px] text-center">
            {format(currentDate, 'yyyy年 MM月', { locale: zhTW })}
          </span>
          <Button
            variant="outline"
            onClick={() => setCurrentDate(new Date(year, month, 1))}
          >
            下個月
          </Button>
        </div>
      </div>

      {/* 統計卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">總金額</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                ${stats.totalAmount.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">項目數量</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.totalCount}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">逾期項目</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.overdueCount}
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
                              `}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
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
                                  const relatedItem = allUnscheduledItems.find(item => item.id === schedule.paymentItemId);
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
                                          onClick={() => {
                                            if (relatedItem) {
                                              setSelectedItem(relatedItem);
                                              setShowScheduleDialog(true);
                                            }
                                          }}
                                      >
                                          <div className="font-medium text-gray-700">
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
                                ))}
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
                  <Droppable droppableId="unscheduled">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`
                          space-y-2 min-h-[400px] p-2 rounded border-2 border-dashed
                          ${snapshot.isDraggingOver ? 'border-blue-300 bg-blue-50' : 'border-gray-300'}
                        `}
                      >
{/* 渲染未排程項目 */}
                        {unscheduledItems.map((item, index) => (
                          <Draggable
                            key={item.id}
                            draggableId={item.id.toString()}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`
                                  p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-move transition-shadow
                                  ${snapshot.isDragging ? 'shadow-lg bg-white' : 'hover:shadow-md'}
                                `}
                              >
                                <div className="space-y-2">
                                  <div className="font-medium text-sm text-gray-900 truncate" title={item.itemName}>
                                    {item.itemName}
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-green-600 font-medium">
                                      ${parseFloat(item.totalAmount).toLocaleString()}
                                    </span>
                                    <Badge 
                                      variant={(item.priority || 1) >= 3 ? 'destructive' : 'secondary'}
                                      className="text-xs"
                                    >
                                      優先級 {item.priority || 1}
                                    </Badge>
                                  </div>
                                  
                                  {item.dueDate && (
                                    <div className="text-xs text-gray-500">
                                      到期: {new Date(item.dueDate).toLocaleDateString()}
                                    </div>
                                  )}
                                  
                                  {item.description && (
                                    <div className="text-xs text-gray-600 truncate" title={item.description}>
                                      {item.description}
                                    </div>
                                  )}
                                      {(item.priority || 1) >= 3 ? '高' : (item.priority || 1) >= 2 ? '中' : '低'}
                                    </Badge>
                                  </div>
                                  
                                  <div className="text-xs text-gray-500">
                                    {item.projectName} · {item.categoryName}
                                  </div>
                                  
                                  {item.dueDate && (
                                    <div className="text-xs text-orange-600">
                                      到期：{format(new Date(item.dueDate), 'MM/dd')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        
                        {unscheduledItems.length === 0 && !itemsLoading && (
                          <div className="text-center py-8 text-gray-500">
                            <Clock className="mx-auto h-8 w-8 mb-2 opacity-50" />
                            <p>本月無待排程項目</p>
                            {itemsError && (
                              <p className="text-red-500 text-sm mt-2">
                                錯誤: {itemsError.message}
                              </p>
                            )}
                          </div>
                        )}
                        
                        {itemsLoading && (
                          <div className="text-center py-8 text-gray-500">
                            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                            <p>載入中...</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
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
            <ScheduleForm
              item={selectedItem}
              scheduledDate={selectedDate}
              onSubmit={handleCreateSchedule}
              isLoading={createScheduleMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 計劃表單組件
function ScheduleForm({
  item,
  scheduledDate,
  onSubmit,
  isLoading,
}: {
  item: PaymentItem;
  scheduledDate: string;
  onSubmit: (data: { scheduledAmount: string; notes?: string }) => void;
  isLoading: boolean;
}) {
  const [amount, setAmount] = useState(item.totalAmount);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ scheduledAmount: amount, notes });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>付款項目</Label>
        <div className="p-3 bg-gray-50 rounded border">
          <div className="font-medium">{item.itemName}</div>
          <div className="text-sm text-gray-600">
            {item.projectName} · {item.categoryName}
          </div>
          <div className="text-sm text-green-600 mt-1">
            總金額：${parseFloat(item.totalAmount).toLocaleString()}
          </div>
        </div>
      </div>

      <div>
        <Label>排程日期</Label>
        <Input 
          value={format(new Date(scheduledDate), 'yyyy年MM月dd日', { locale: zhTW })}
          disabled
          className="bg-gray-50"
        />
      </div>

      <div>
        <Label htmlFor="amount">計劃付款金額 *</Label>
        <Input
          id="amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="0"
          step="0.01"
        />
      </div>

      <div>
        <Label htmlFor="notes">備註</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="新增計劃備註..."
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={() => {}}>
          取消
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? '建立中...' : '建立計劃'}
        </Button>
      </div>
    </form>
  );
}