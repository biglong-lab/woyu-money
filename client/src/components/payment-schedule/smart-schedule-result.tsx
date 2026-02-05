/**
 * 智慧排程建議結果面板
 * 顯示預算摘要、分頁標籤（建議排入/關鍵項目/建議延後）
 */

import { Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SmartScheduleItemCard } from './smart-schedule-item-card';
import type { SmartScheduleResult, PrioritizedItem } from './types';

interface SmartScheduleResultPanelProps {
  /** 智慧排程結果資料 */
  result: SmartScheduleResult;
  /** 關閉結果面板 */
  onClose: () => void;
  /** 確認套用建議排程 */
  onApply: (items: PrioritizedItem[]) => void;
}

export function SmartScheduleResultPanel({
  result,
  onClose,
  onApply,
}: SmartScheduleResultPanelProps) {
  return (
    <Card className="border-purple-300 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-base sm:text-lg">
            <Zap className="h-5 w-5 mr-2 text-purple-600" />
            排程建議結果
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            關閉
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 預算摘要 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <div className="text-xs text-gray-500">可用預算</div>
            <div className="text-lg font-bold">${result.budget.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg text-center">
            <div className="text-xs text-orange-600">總需求金額</div>
            <div className="text-lg font-bold text-orange-700">${result.totalNeeded.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <div className="text-xs text-green-600">建議排入</div>
            <div className="text-lg font-bold text-green-700">${result.scheduledTotal.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <div className="text-xs text-blue-600">剩餘預算</div>
            <div className="text-lg font-bold text-blue-700">${result.remainingBudget.toLocaleString()}</div>
          </div>
        </div>

        {/* 預算不足警示 */}
        {result.isOverBudget && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            預算不足！總需求 ${result.totalNeeded.toLocaleString()} 超過預算 ${result.budget.toLocaleString()}，
            以下按優先級排入預算內項目。
          </div>
        )}

        {/* 分頁標籤 */}
        <Tabs defaultValue="scheduled" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scheduled">
              建議排入 ({result.scheduledItems.length})
            </TabsTrigger>
            <TabsTrigger value="critical">
              關鍵項目 ({result.criticalItems.length})
            </TabsTrigger>
            <TabsTrigger value="deferred">
              建議延後 ({result.deferredItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled" className="space-y-2 mt-3">
            {result.scheduledItems.map((item) => (
              <SmartScheduleItemCard key={item.id} item={item} />
            ))}
            {result.scheduledItems.length > 0 && (
              <Button
                className="w-full mt-3 bg-purple-600 hover:bg-purple-700"
                onClick={() => onApply(result.scheduledItems)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                確認排入 {result.scheduledItems.length} 筆（共 ${result.scheduledTotal.toLocaleString()}）
              </Button>
            )}
          </TabsContent>

          <TabsContent value="critical" className="space-y-2 mt-3">
            {result.criticalItems.map((item) => (
              <SmartScheduleItemCard key={item.id} item={item} />
            ))}
            {result.criticalItems.length === 0 && (
              <div className="text-center text-gray-500 py-6">目前沒有關鍵緊急項目</div>
            )}
          </TabsContent>

          <TabsContent value="deferred" className="space-y-2 mt-3">
            {result.deferredItems.map((item) => (
              <SmartScheduleItemCard key={item.id} item={item} />
            ))}
            {result.deferredItems.length === 0 && (
              <div className="text-center text-gray-500 py-6">所有項目都已排入預算</div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
