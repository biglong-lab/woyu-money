import { useMemo } from 'react';
import { format, differenceInDays, isAfter, isBefore, addDays } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { AlertTriangle, Clock, Calendar, CheckCircle, CreditCard, ChevronRight, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface PaymentItem {
  id: number;
  itemName: string;
  totalAmount: string;
  paidAmount?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  projectName?: string;
  categoryName?: string;
  priority?: number;
}

interface DueDateDashboardProps {
  items: PaymentItem[];
  onItemClick?: (item: PaymentItem) => void;
  onQuickPay?: (item: PaymentItem) => void;
  className?: string;
}

interface CategorizedItems {
  overdue: PaymentItem[];
  urgent: PaymentItem[];
  upcoming: PaymentItem[];
  normal: PaymentItem[];
}

const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
};

export default function DueDateDashboard({
  items,
  onItemClick,
  onQuickPay,
  className = '',
}: DueDateDashboardProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const categorizedItems = useMemo<CategorizedItems>(() => {
    const result: CategorizedItems = {
      overdue: [],
      urgent: [],
      upcoming: [],
      normal: [],
    };

    items.forEach(item => {
      if (item.status === 'paid') return;
      
      const dueDate = item.endDate ? new Date(item.endDate) : item.startDate ? new Date(item.startDate) : null;
      if (!dueDate) {
        result.normal.push(item);
        return;
      }
      
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = differenceInDays(dueDate, today);

      if (daysUntilDue < 0) {
        result.overdue.push(item);
      } else if (daysUntilDue <= 7) {
        result.urgent.push(item);
      } else if (daysUntilDue <= 30) {
        result.upcoming.push(item);
      } else {
        result.normal.push(item);
      }
    });

    const sortByDueDate = (a: PaymentItem, b: PaymentItem) => {
      const dateA = new Date(a.endDate || a.startDate || '');
      const dateB = new Date(b.endDate || b.startDate || '');
      return dateA.getTime() - dateB.getTime();
    };

    result.overdue.sort(sortByDueDate);
    result.urgent.sort(sortByDueDate);
    result.upcoming.sort(sortByDueDate);

    return result;
  }, [items, today]);

  const stats = useMemo(() => {
    const pendingItems = items.filter(i => i.status !== 'paid');
    const totalPending = pendingItems.reduce((sum, item) => {
      const total = safeParseFloat(item.totalAmount);
      const paid = safeParseFloat(item.paidAmount);
      return sum + (total - paid);
    }, 0);
    
    const overdueAmount = categorizedItems.overdue.reduce((sum, item) => {
      const total = safeParseFloat(item.totalAmount);
      const paid = safeParseFloat(item.paidAmount);
      return sum + (total - paid);
    }, 0);

    const urgentAmount = categorizedItems.urgent.reduce((sum, item) => {
      const total = safeParseFloat(item.totalAmount);
      const paid = safeParseFloat(item.paidAmount);
      return sum + (total - paid);
    }, 0);

    return {
      totalPending,
      overdueCount: categorizedItems.overdue.length,
      overdueAmount,
      urgentCount: categorizedItems.urgent.length,
      urgentAmount,
      upcomingCount: categorizedItems.upcoming.length,
    };
  }, [items, categorizedItems]);

  const getDaysText = (item: PaymentItem) => {
    const dueDate = item.endDate ? new Date(item.endDate) : item.startDate ? new Date(item.startDate) : null;
    if (!dueDate) return '';
    dueDate.setHours(0, 0, 0, 0);
    const days = differenceInDays(dueDate, today);
    if (days < 0) return `逾期 ${Math.abs(days)} 天`;
    if (days === 0) return '今天到期';
    if (days === 1) return '明天到期';
    return `${days} 天後到期`;
  };

  const getPendingAmount = (item: PaymentItem) => {
    const total = safeParseFloat(item.totalAmount);
    const paid = safeParseFloat(item.paidAmount);
    return total - paid;
  };

  const ItemCard = ({ item, urgency }: { item: PaymentItem; urgency: 'overdue' | 'urgent' | 'upcoming' | 'normal' }) => {
    const pendingAmount = getPendingAmount(item);
    const daysText = getDaysText(item);
    
    const urgencyStyles = {
      overdue: 'border-l-4 border-l-red-500 bg-red-50',
      urgent: 'border-l-4 border-l-orange-500 bg-orange-50',
      upcoming: 'border-l-4 border-l-yellow-500 bg-yellow-50',
      normal: 'border-l-4 border-l-gray-300',
    };

    return (
      <div
        className={`p-3 sm:p-4 rounded-lg ${urgencyStyles[urgency]} cursor-pointer hover:shadow-md transition-shadow touch-target`}
        onClick={() => onItemClick?.(item)}
        data-testid={`due-item-${item.id}`}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm sm:text-base truncate">{item.itemName}</h4>
            {item.projectName && (
              <p className="text-xs text-gray-500 truncate">{item.projectName}</p>
            )}
          </div>
          <Badge
            variant={urgency === 'overdue' ? 'destructive' : urgency === 'urgent' ? 'default' : 'secondary'}
            className="ml-2 text-[10px] sm:text-xs flex-shrink-0"
          >
            {daysText}
          </Badge>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <span className="text-base sm:text-lg font-bold text-gray-900">
            ${pendingAmount.toLocaleString()}
          </span>
          {onQuickPay && (
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto min-h-[36px]"
              onClick={(e) => {
                e.stopPropagation();
                onQuickPay(item);
              }}
              data-testid={`btn-quick-pay-${item.id}`}
            >
              <CreditCard className="h-3 w-3 mr-1" />
              快速付款
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 響應式統計卡片：手機 2x2，桌面 4x1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className={stats.overdueCount > 0 ? 'border-red-200 bg-red-50' : ''} data-testid="card-overdue-summary">
          <CardContent className="p-3 sm:pt-4 sm:px-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">逾期項目</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.overdueCount}</p>
                <p className="text-[10px] sm:text-xs text-red-500 truncate">${stats.overdueAmount.toLocaleString()}</p>
              </div>
              <AlertTriangle className={`h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0 ${stats.overdueCount > 0 ? 'text-red-500' : 'text-gray-300'}`} />
            </div>
          </CardContent>
        </Card>

        <Card className={stats.urgentCount > 0 ? 'border-orange-200 bg-orange-50' : ''} data-testid="card-urgent-summary">
          <CardContent className="p-3 sm:pt-4 sm:px-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">7天內到期</p>
                <p className="text-xl sm:text-2xl font-bold text-orange-600">{stats.urgentCount}</p>
                <p className="text-[10px] sm:text-xs text-orange-500 truncate">${stats.urgentAmount.toLocaleString()}</p>
              </div>
              <Clock className={`h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0 ${stats.urgentCount > 0 ? 'text-orange-500' : 'text-gray-300'}`} />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-upcoming-summary">
          <CardContent className="p-3 sm:pt-4 sm:px-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">30天內到期</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.upcomingCount}</p>
              </div>
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-pending">
          <CardContent className="p-3 sm:pt-4 sm:px-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">待付總額</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">${stats.totalPending.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 響應式分類清單：手機單欄，桌面三欄 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {categorizedItems.overdue.length > 0 && (
          <Card className="border-red-200" data-testid="card-overdue-list">
            <CardHeader className="pb-2 bg-red-50 px-3 sm:px-6">
              <CardTitle className="text-xs sm:text-sm flex items-center text-red-700">
                <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                逾期未付 ({categorizedItems.overdue.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 px-3 sm:px-6">
              <ScrollArea className="h-[200px] sm:h-[300px]">
                <div className="space-y-2">
                  {categorizedItems.overdue.map(item => (
                    <ItemCard key={item.id} item={item} urgency="overdue" />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {categorizedItems.urgent.length > 0 && (
          <Card className="border-orange-200" data-testid="card-urgent-list">
            <CardHeader className="pb-2 bg-orange-50 px-3 sm:px-6">
              <CardTitle className="text-xs sm:text-sm flex items-center text-orange-700">
                <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                7天內到期 ({categorizedItems.urgent.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 px-3 sm:px-6">
              <ScrollArea className="h-[200px] sm:h-[300px]">
                <div className="space-y-2">
                  {categorizedItems.urgent.map(item => (
                    <ItemCard key={item.id} item={item} urgency="urgent" />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {categorizedItems.upcoming.length > 0 && (
          <Card className="border-yellow-200" data-testid="card-upcoming-list">
            <CardHeader className="pb-2 bg-yellow-50 px-3 sm:px-6">
              <CardTitle className="text-xs sm:text-sm flex items-center text-yellow-700">
                <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                30天內到期 ({categorizedItems.upcoming.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 px-3 sm:px-6">
              <ScrollArea className="h-[200px] sm:h-[300px]">
                <div className="space-y-2">
                  {categorizedItems.upcoming.map(item => (
                    <ItemCard key={item.id} item={item} urgency="upcoming" />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {categorizedItems.overdue.length === 0 && categorizedItems.urgent.length === 0 && categorizedItems.upcoming.length === 0 && (
          <Card className="col-span-1 lg:col-span-3 border-green-200 bg-green-50" data-testid="card-no-urgent">
            <CardContent className="py-6 sm:pt-6 text-center">
              <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-green-500 mx-auto mb-2" />
              <h3 className="text-base sm:text-lg font-medium text-green-700">太棒了！</h3>
              <p className="text-xs sm:text-sm text-green-600">目前沒有緊急需要處理的付款項目</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
