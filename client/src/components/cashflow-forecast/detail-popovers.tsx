// 現金流預測 - 明細彈出視窗元件
import { format } from 'date-fns';
import { Info } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type { DetailItem, PaidDetailItem, CategoryVisibility } from './types';
import { CATEGORY_COLORS, CATEGORY_LABELS } from './types';

// 一般分類明細
export function DetailPopover({ details, category, amount }: {
  details: DetailItem[];
  category: keyof typeof CATEGORY_LABELS;
  amount: number;
}) {
  if (details.length === 0 || amount === 0) {
    return <span>${amount.toLocaleString()}</span>;
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          className="text-left hover:underline cursor-pointer flex items-center gap-1"
          style={{ color: CATEGORY_COLORS[category] }}
          data-testid={`hover-${category}`}
        >
          ${amount.toLocaleString()}
          <Info className="h-3 w-3 opacity-50" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[category] }} />
            <h4 className="font-semibold text-sm">{CATEGORY_LABELS[category]} 明細</h4>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {details.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className="flex justify-between items-start text-sm p-2 bg-gray-50 rounded">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  {item.project && <p className="text-xs text-gray-500 truncate">{item.project}</p>}
                  {item.date && <p className="text-xs text-gray-400">{format(new Date(item.date), 'MM/dd')}</p>}
                </div>
                <span className="font-medium ml-2" style={{ color: CATEGORY_COLORS[category] }}>
                  ${item.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t flex justify-between text-sm font-medium">
            <span>小計 ({details.length} 項)</span>
            <span style={{ color: CATEGORY_COLORS[category] }}>${amount.toLocaleString()}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// 已付款明細（分本月/他月項目）
export function PaidDetailPopover({ paidCurrent, paidCarryOver, totalAmount }: {
  paidCurrent: PaidDetailItem[];
  paidCarryOver: PaidDetailItem[];
  totalAmount: number;
}) {
  const totalItems = paidCurrent.length + paidCarryOver.length;
  if (totalItems === 0 || totalAmount === 0) {
    return <span>${totalAmount.toLocaleString()}</span>;
  }

  const currentTotal = paidCurrent.reduce((sum, item) => sum + item.amount, 0);
  const carryOverTotal = paidCarryOver.reduce((sum, item) => sum + item.amount, 0);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          className="text-left hover:underline cursor-pointer flex items-center gap-1"
          style={{ color: CATEGORY_COLORS.paid }}
          data-testid="hover-paid"
        >
          ${totalAmount.toLocaleString()}
          <Info className="h-3 w-3 opacity-50" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-96" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.paid }} />
            <h4 className="font-semibold text-sm">已付款 明細</h4>
          </div>

          {paidCurrent.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span className="w-2 h-2 rounded-full bg-gray-500" />
                本月項目
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1 pl-4">
                {paidCurrent.map((item, idx) => (
                  <div key={`current-${item.id}-${idx}`} className="flex justify-between items-start text-sm p-2 bg-gray-50 rounded">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      {item.project && <p className="text-xs text-gray-500 truncate">{item.project}</p>}
                      {item.date && <p className="text-xs text-gray-400">{format(new Date(item.date), 'MM/dd')}</p>}
                    </div>
                    <span className="font-medium ml-2 text-gray-600">${item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 pl-4">
                <span>小計 ({paidCurrent.length} 項)</span>
                <span>${currentTotal.toLocaleString()}</span>
              </div>
            </div>
          )}

          {paidCarryOver.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                他月項目 (延遲付款)
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1 pl-4">
                {paidCarryOver.map((item, idx) => (
                  <div key={`carryover-${item.id}-${idx}`} className="flex justify-between items-start text-sm p-2 bg-orange-50 rounded border-l-2 border-orange-300">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {item.name}
                        <span className="ml-1 text-xs text-orange-500">({item.originLabel})</span>
                      </p>
                      {item.project && <p className="text-xs text-gray-500 truncate">{item.project}</p>}
                      {item.date && <p className="text-xs text-gray-400">付款: {format(new Date(item.date), 'MM/dd')}</p>}
                    </div>
                    <span className="font-medium ml-2 text-orange-600">${item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-orange-500 pl-4">
                <span>小計 ({paidCarryOver.length} 項)</span>
                <span>${carryOverTotal.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="pt-2 border-t flex justify-between text-sm font-medium">
            <span>總計 ({totalItems} 項)</span>
            <span style={{ color: CATEGORY_COLORS.paid }}>${totalAmount.toLocaleString()}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
