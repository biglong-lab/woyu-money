/**
 * 項目列表面板
 * 按狀態分組顯示項目（逾期/已計劃/未排程），支援拖放至日曆
 */

import { XCircle, Clock, AlertCircle } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { PaymentItemStatusCard } from './payment-item-status-card';
import type { IntegratedPaymentItem, CategorizedItems } from './types';

interface ItemListPanelProps {
  /** 分類後的項目 */
  categories: CategorizedItems;
  /** 點擊詳情的回呼 */
  onViewDetail: (item: IntegratedPaymentItem) => void;
}

export function ItemListPanel({ categories, onViewDetail }: ItemListPanelProps) {
  return (
    <div className="lg:col-span-4 space-y-4 order-1 lg:order-2">
      {/* 逾期未執行 */}
      {categories.overdueUnexecuted.length > 0 && (
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-red-600 mb-2 sm:mb-3 flex items-center">
            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            逾期未執行 ({categories.overdueUnexecuted.length})
          </h3>
          <Droppable droppableId="item-list-overdue">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {categories.overdueUnexecuted.map((item, index) => (
                  <Draggable key={item.id} draggableId={`item-${item.id}`} index={index}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                        <PaymentItemStatusCard item={item} status="overdue" onViewDetail={onViewDetail} />
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
          <h3 className="text-base sm:text-lg font-semibold text-yellow-600 mb-2 sm:mb-3 flex items-center">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            已計劃待執行 ({categories.scheduledPending.length})
          </h3>
          <Droppable droppableId="item-list-scheduled">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {categories.scheduledPending.map((item, index) => (
                  <Draggable key={item.id} draggableId={`item-${item.id}`} index={index}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                        <PaymentItemStatusCard item={item} status="scheduled" onViewDetail={onViewDetail} />
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
          <h3 className="text-base sm:text-lg font-semibold text-gray-600 mb-2 sm:mb-3 flex items-center">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            未排程項目 ({categories.unscheduled.length})
          </h3>
          <Droppable droppableId="item-list-unscheduled">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {categories.unscheduled.map((item, index) => (
                  <Draggable key={item.id} draggableId={`item-${item.id}`} index={index}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                        <PaymentItemStatusCard item={item} status="unscheduled" onViewDetail={onViewDetail} />
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
  );
}
