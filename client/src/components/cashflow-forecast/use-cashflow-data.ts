// 現金流預測 - 資料計算 Hook
import { useMemo } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import type {
  PaymentItem, Schedule, BudgetPlan, CashflowPaymentRecord,
  CategoryVisibility, MonthlyForecast, MonthlyDetails, PaidDetailItem,
} from './types';
import { safeParseFloat } from './types';

interface UseCashflowDataParams {
  items: PaymentItem[];
  schedules: Schedule[];
  budgetPlans: BudgetPlan[];
  paymentRecords: CashflowPaymentRecord[];
  monthsToForecast: number;
  visibility: CategoryVisibility;
}

function processBudgetPlans(
  budgetPlans: BudgetPlan[],
  monthKey: string,
  monthStart: Date,
  monthEnd: Date,
): { amount: number; details: MonthlyForecast['details']['budget'] } {
  let amount = 0;
  const details: MonthlyForecast['details']['budget'] = [];

  budgetPlans.forEach(plan => {
    const planItems = plan.items || [];
    planItems.forEach(item => {
      if (item.isConverted || item.status === 'converted') return;

      const paymentType = item.paymentType || 'single';
      const itemStartDate = item.startDate ? new Date(item.startDate) : null;
      const itemEndDate = item.endDate ? new Date(item.endDate) : null;

      if (paymentType === 'monthly') {
        const monthlyAmt = safeParseFloat(item.monthlyAmount);
        const monthCnt = parseInt(item.monthCount || '1') || 1;
        if (monthlyAmt <= 0) return;

        const startMonth = itemStartDate ? startOfMonth(itemStartDate) : startOfMonth(new Date(plan.startDate));
        let monthIndex = 0;
        let tempMonth = new Date(startMonth);
        while (monthIndex < monthCnt) {
          if (format(tempMonth, 'yyyy-MM') === monthKey) {
            amount += monthlyAmt;
            details.push({
              id: item.id,
              name: `${item.itemName} (月付 ${monthIndex + 1}/${monthCnt})`,
              amount: monthlyAmt,
              date: format(endOfMonth(tempMonth), 'yyyy-MM-dd'),
              project: plan.planName,
            });
            break;
          }
          monthIndex++;
          tempMonth = addMonths(tempMonth, 1);
        }
      } else if (paymentType === 'installment') {
        const totalAmount = safeParseFloat(item.plannedAmount);
        const installCnt = parseInt(item.installmentCount || '1') || 1;
        const installAmt = safeParseFloat(item.installmentAmount) || (totalAmount / installCnt);
        if (installAmt <= 0) return;

        const startMonth = itemStartDate ? startOfMonth(itemStartDate) : startOfMonth(new Date(plan.startDate));
        for (let inst = 0; inst < installCnt; inst++) {
          const installMonth = addMonths(startMonth, inst);
          if (format(installMonth, 'yyyy-MM') === monthKey) {
            amount += installAmt;
            details.push({
              id: item.id,
              name: `${item.itemName} (第${inst + 1}期/${installCnt}期)`,
              amount: installAmt,
              date: format(endOfMonth(installMonth), 'yyyy-MM-dd'),
              project: plan.planName,
            });
            break;
          }
        }
      } else {
        const totalAmount = safeParseFloat(item.plannedAmount);
        if (totalAmount <= 0) return;

        const targetDate = itemEndDate || itemStartDate;
        if (targetDate && isWithinInterval(targetDate, { start: monthStart, end: monthEnd })) {
          amount += totalAmount;
          details.push({
            id: item.id,
            name: `${item.itemName} (一次性)`,
            amount: totalAmount,
            date: format(targetDate, 'yyyy-MM-dd'),
            project: plan.planName,
          });
        }
      }
    });
  });

  return { amount, details };
}

export function useCashflowData({
  items, schedules, budgetPlans, paymentRecords, monthsToForecast, visibility,
}: UseCashflowDataParams) {
  const today = new Date();

  const forecastData = useMemo<MonthlyForecast[]>(() => {
    const months: MonthlyForecast[] = [];

    for (let i = 0; i < monthsToForecast; i++) {
      const monthDate = addMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, 'M月', { locale: zhTW });

      const details: MonthlyDetails = {
        budget: [], scheduled: [], estimated: [],
        recurring: [], paidCurrent: [], paidCarryOver: [],
      };

      // 預算
      const budgetResult = processBudgetPlans(budgetPlans, monthKey, monthStart, monthEnd);
      details.budget = budgetResult.details;

      // 排程
      let scheduled = 0;
      schedules.forEach(schedule => {
        if (schedule.status === 'completed') return;
        const scheduleDate = new Date(schedule.scheduledDate);
        if (isWithinInterval(scheduleDate, { start: monthStart, end: monthEnd })) {
          const amount = safeParseFloat(schedule.scheduledAmount);
          scheduled += amount;
          details.scheduled.push({
            id: schedule.id,
            name: schedule.itemName || `排程 #${schedule.paymentItemId}`,
            amount,
            date: schedule.scheduledDate,
          });
        }
      });

      // 預估到期 / 月付固定
      let estimated = 0;
      let recurring = 0;
      items.forEach(item => {
        if (item.status === 'paid') return;
        const dueDate = item.endDate ? new Date(item.endDate) : item.startDate ? new Date(item.startDate) : null;
        if (dueDate && isWithinInterval(dueDate, { start: monthStart, end: monthEnd })) {
          const pending = safeParseFloat(item.totalAmount) - safeParseFloat(item.paidAmount);
          if (pending > 0) {
            const detail = {
              id: item.id, name: item.itemName, amount: pending,
              date: item.endDate || item.startDate, project: item.projectName,
            };
            if (item.paymentType === 'monthly') {
              recurring += pending;
              details.recurring.push(detail);
            } else {
              estimated += pending;
              details.estimated.push(detail);
            }
          }
        }
      });

      // 已付款
      let paidCurrent = 0;
      let paidCarryOver = 0;
      paymentRecords.forEach(record => {
        if (record.paymentMonth !== monthKey) return;
        const amount = safeParseFloat(record.amountPaid);
        if (amount <= 0) return;

        const paidItem: PaidDetailItem = {
          id: record.id, name: record.itemName, amount,
          date: record.paymentDate, project: record.projectName || undefined,
          isCurrentMonthItem: record.isCurrentMonthItem, originLabel: record.originLabel,
        };
        if (record.isCurrentMonthItem) {
          paidCurrent += amount;
          details.paidCurrent.push(paidItem);
        } else {
          paidCarryOver += amount;
          details.paidCarryOver.push(paidItem);
        }
      });

      const paid = paidCurrent + paidCarryOver;
      const visibleTotal =
        (visibility.budget ? budgetResult.amount : 0) +
        (visibility.scheduled ? scheduled : 0) +
        (visibility.estimated ? estimated : 0) +
        (visibility.recurring ? recurring : 0) +
        (visibility.paid ? paid : 0);

      months.push({
        month: monthKey, monthLabel,
        budget: budgetResult.amount, scheduled, estimated, recurring,
        paidCurrent, paidCarryOver, paid,
        total: visibleTotal, details,
      });
    }
    return months;
  }, [items, schedules, budgetPlans, paymentRecords, monthsToForecast, today, visibility]);

  const stats = useMemo(() => {
    const totalForecast = forecastData.reduce((sum, m) => sum + m.total, 0);
    const avgMonthly = totalForecast / monthsToForecast;
    const maxMonth = forecastData.reduce((max, m) => m.total > max.total ? m : max, forecastData[0]);
    const minMonth = forecastData.reduce((min, m) => m.total < min.total ? m : min, forecastData[0]);
    const currentMonthTotal = forecastData[0]?.total || 0;
    const nextMonthTotal = forecastData[1]?.total || 0;
    const trend = nextMonthTotal - currentMonthTotal;
    const trendPercent = currentMonthTotal > 0 ? (trend / currentMonthTotal) * 100 : 0;
    return { totalForecast, avgMonthly, maxMonth, minMonth, trend, trendPercent };
  }, [forecastData, monthsToForecast]);

  return { forecastData, stats };
}
