/**
 * 排程日曆元件
 * 以月曆格式顯示每日排程，支援拖放操作
 */

import { Calendar } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IntegratedPaymentItem, MonthSchedule } from './types';

interface ScheduleCalendarProps {
  /** 當前選擇的日期 */
  currentDate: Date;
  /** 日曆顯示的所有日期 */
  calendarDays: Date[];
  /** 當月排程列表 */
  monthSchedules: MonthSchedule[];
  /** 整合項目列表（用於查詢項目名稱） */
  integratedItems: IntegratedPaymentItem[];
  /** 點擊排程卡片的回呼 */
  onScheduleClick: (schedule: MonthSchedule, item: IntegratedPaymentItem | null) => void;
}

/** 星期標題 */
const weekDayHeaders = ['日', '一', '二', '三', '四', '五', '六'];

export function ScheduleCalendar({
  currentDate,
  calendarDays,
  monthSchedules,
  integratedItems,
  onScheduleClick,
}: ScheduleCalendarProps) {
  /** 取得指定日期的排程列表 */
  const getSchedulesForDate = (date: string) => {
    return monthSchedules.filter(s => s.scheduledDate === date);
  };

  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-4">
        <CardTitle className="flex items-center text-base sm:text-lg">
          <Calendar className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
          <span className="truncate">{format(currentDate, 'yyyy年MM月')} 付款計劃</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-6">
        {/* 響應式日曆網格 */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* 星期標題列 */}
          {weekDayHeaders.map(day => (
            <div key={day} className="p-1 sm:p-2 text-center text-xs sm:text-sm font-medium text-gray-500 border-b">
              {day}
            </div>
          ))}

          {/* 日期格子 */}
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
                      min-h-[60px] sm:min-h-[100px] p-1 sm:p-2 border rounded-md sm:rounded-lg transition-colors
                      ${isToday ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}
                      ${!isCurrentMonth ? 'opacity-40' : ''}
                      ${snapshot.isDraggingOver ? 'bg-blue-100 border-blue-400' : ''}
                    `}
                    data-testid={`day-${dateStr}`}
                  >
                    <div className={`text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
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
                                onClick={() => onScheduleClick(schedule, item || null)}
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
  );
}
