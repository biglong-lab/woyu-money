// 專案付款管理 - 付款項目列表元件
import { DollarSign, TrendingUp, AlertTriangle, Calendar, Star, Clock, ChevronDown, ChevronUp, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveLayout, ResponsiveGrid, ResponsiveCard } from "@/components/responsive-layout";
import { SkeletonLoader } from "@/components/enhanced-responsive-components";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import IntelligentAnalytics from "@/components/intelligent-analytics";
import type { PaymentItem, PaymentStats } from "./payment-project-types";
import { getStatusBadgeConfig } from "./payment-project-types";

const PaymentItemsSkeleton = ({ items }: { items: number }) => (
  <SkeletonLoader type="list" count={items} />
);

export interface PaymentProjectItemListProps {
  // 頁籤
  activeTab: string;
  setActiveTab: (tab: string) => void;
  // 資料
  filteredAndSortedItems: PaymentItem[];
  stats: PaymentStats;
  itemsLoading: boolean;
  isLoadingMore: boolean;
  // 選取狀態
  selectedItems: Set<number>;
  isAllSelected: boolean;
  toggleItemSelection: (itemId: number) => void;
  toggleSelectAll: (items: PaymentItem[]) => void;
  handleBatchStatusUpdate: (status: string) => void;
  setSelectedItems: (items: Set<number>) => void;
  setIsAllSelected: (value: boolean) => void;
  // 展開/收合
  showPaidItems: boolean;
  setShowPaidItems: (value: boolean) => void;
  // 操作
  onItemClick: (item: PaymentItem) => void;
  onPaymentClick: (item: PaymentItem) => void;
  onEditClick: (item: PaymentItem) => void;
  onDeleteClick: (item: PaymentItem) => void;
  // 篩選
  searchTerm: string;
  selectedStatus: string;
  selectedProject: string;
  setSearchTerm: (term: string) => void;
  setSelectedStatus: (status: string) => void;
  setSelectedProject: (project: string) => void;
}

function StatusBadge({ item }: { item: PaymentItem }) {
  const config = getStatusBadgeConfig(item);
  return (
    <Badge variant={config.variant} className={`${config.className} font-medium`}>
      {config.label}
    </Badge>
  );
}

function ItemCard({
  item,
  isSelected,
  onToggleSelect,
  onItemClick,
  onPaymentClick,
  onEditClick,
  onDeleteClick,
}: {
  item: PaymentItem;
  isSelected: boolean;
  onToggleSelect: (itemId: number) => void;
  onItemClick: (item: PaymentItem) => void;
  onPaymentClick: (item: PaymentItem) => void;
  onEditClick: (item: PaymentItem) => void;
  onDeleteClick: (item: PaymentItem) => void;
}) {
  return (
    <Card
      className={`transition-all hover:shadow-md border-l-4 ${
        item.paymentType === "installment"
          ? "border-l-purple-500 bg-purple-50/30 ring-1 ring-purple-200"
          : item.status === "partial"
          ? "border-l-yellow-500 bg-yellow-50/50"
          : new Date(item.paymentType === "single" ? item.startDate : (item.endDate || item.startDate)) < new Date()
          ? "border-l-red-500 bg-red-50/50"
          : "border-l-blue-500"
      } ${(item as any).isDeleted ? 'opacity-60' : ''} ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {/* 選擇框 */}
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect(item.id);
              }}
              className="mt-1 rounded border-gray-300"
            />

            <div className="flex-1 min-w-0 space-y-3" onClick={() => onItemClick(item)}>
              <div className="space-y-2 cursor-pointer">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900 text-lg leading-tight flex-1">{item.itemName}</h3>
                  {item.paymentType === "installment" && (
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 ml-2 flex-shrink-0">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      分期付款
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <StatusBadge item={item} />
                  {item.paymentType === "installment" && (
                    <div className="text-xs text-purple-600 font-medium">
                      {item.itemName.includes('第') && item.itemName.includes('期') ? (
                        (() => {
                          const match = item.itemName.match(/第(\d+)期.*共(\d+)期/);
                          if (match) {
                            const current = parseInt(match[1]);
                            const total = parseInt(match[2]);
                            return `${current}/${total} 期`;
                          }
                          return '分期中';
                        })()
                      ) : '分期中'}
                    </div>
                  )}
                </div>
              </div>

              {/* 金額信息 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">總金額:</span>
                  <span className="font-medium text-blue-600">
                    {new Intl.NumberFormat('zh-TW', {
                      style: 'currency',
                      currency: 'TWD',
                      minimumFractionDigits: 0
                    }).format(parseFloat(item.totalAmount))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">已付款:</span>
                  <span className="font-medium text-green-600">
                    {new Intl.NumberFormat('zh-TW', {
                      style: 'currency',
                      currency: 'TWD',
                      minimumFractionDigits: 0
                    }).format(parseFloat(item.paidAmount || "0"))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">待付款:</span>
                  <span className={`font-medium ${
                    parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0") > 0
                      ? "text-red-600"
                      : "text-green-600"
                  }`}>
                    {new Intl.NumberFormat('zh-TW', {
                      style: 'currency',
                      currency: 'TWD',
                      minimumFractionDigits: 0
                    }).format(parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0"))}
                  </span>
                </div>
              </div>

              {/* 付款進度條 */}
              {item.status === "partial" && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>付款進度</span>
                    <span>
                      {Math.round((parseFloat(item.paidAmount || "0") / parseFloat(item.totalAmount)) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all bg-yellow-500"
                      style={{
                        width: `${Math.min(100, (parseFloat(item.paidAmount || "0") / parseFloat(item.totalAmount)) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 項目詳情 */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                {item.categoryName && (
                  <span className="bg-gray-100 px-2 py-1 rounded">
                    分類: {item.categoryName}
                  </span>
                )}
                {item.projectName && (
                  <span className="bg-blue-100 px-2 py-1 rounded">
                    專案: {item.projectName}
                  </span>
                )}
                <span className="bg-gray-100 px-2 py-1 rounded">
                  到期: {new Date(item.paymentType === "single" ? item.startDate : (item.endDate || item.startDate)).toLocaleDateString('zh-TW')}
                </span>
                {item.priority && item.priority > 1 && (
                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded flex items-center">
                    <Star className="h-3 w-3 mr-1" />
                    高優先級
                  </span>
                )}
              </div>

              {/* 操作按鈕區域 */}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditClick(item);
                  }}
                  className="border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg"
                  data-testid={`button-edit-${item.id}`}
                >
                  <MoreHorizontal className="h-4 w-4 mr-1" />
                  修改
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteClick(item);
                  }}
                  className="border-red-300 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg"
                  data-testid={`button-delete-${item.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  刪除
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPaymentClick(item);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                  data-testid={`button-pay-${item.id}`}
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  付款
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PaidItemCard({
  item,
  onItemClick,
}: {
  item: PaymentItem;
  onItemClick: (item: PaymentItem) => void;
}) {
  return (
    <Card
      className={`transition-all cursor-pointer hover:shadow-md border-l-4 ${
        item.paymentType === "installment"
          ? "border-l-purple-500 bg-purple-50/30 ring-1 ring-purple-200"
          : "border-l-green-500 bg-green-50/50"
      } ${(item as any).isDeleted ? 'opacity-60' : ''}`}
      onClick={() => onItemClick(item)}
    >
      <CardContent className="p-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-gray-900 text-lg leading-tight flex-1">{item.itemName}</h3>
              {item.paymentType === "installment" && (
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 ml-2 flex-shrink-0">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  分期付款
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <StatusBadge item={item} />
              {item.paymentType === "installment" && (
                <div className="text-xs text-purple-600 font-medium">
                  {item.itemName.includes('第') && item.itemName.includes('期') ? (
                    (() => {
                      const match = item.itemName.match(/第(\d+)期.*共(\d+)期/);
                      if (match) {
                        const current = parseInt(match[1]);
                        const total = parseInt(match[2]);
                        return `${current}/${total} 期`;
                      }
                      return '分期完成';
                    })()
                  ) : '分期完成'}
                </div>
              )}
            </div>
          </div>

          {/* 金額信息 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">總金額:</span>
              <span className="font-medium text-blue-600">
                {new Intl.NumberFormat('zh-TW', {
                  style: 'currency',
                  currency: 'TWD',
                  minimumFractionDigits: 0
                }).format(parseFloat(item.totalAmount))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">已付款:</span>
              <span className="font-medium text-green-600">
                {new Intl.NumberFormat('zh-TW', {
                  style: 'currency',
                  currency: 'TWD',
                  minimumFractionDigits: 0
                }).format(parseFloat(item.paidAmount || "0"))}
              </span>
            </div>
          </div>

          {/* 項目詳情 */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {item.categoryName && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                分類: {item.categoryName}
              </span>
            )}
            {item.projectName && (
              <span className="bg-blue-100 px-2 py-1 rounded">
                專案: {item.projectName}
              </span>
            )}
            <span className="bg-gray-100 px-2 py-1 rounded">
              到期: {new Date(item.paymentType === "single" ? item.startDate : (item.endDate || item.startDate)).toLocaleDateString('zh-TW')}
            </span>
            {item.priority && item.priority > 1 && (
              <span className="bg-red-100 text-red-700 px-2 py-1 rounded flex items-center">
                <Star className="h-3 w-3 mr-1" />
                高優先級
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PaymentProjectItemList({
  activeTab,
  setActiveTab,
  filteredAndSortedItems,
  stats,
  itemsLoading,
  isLoadingMore,
  selectedItems,
  isAllSelected,
  toggleItemSelection,
  toggleSelectAll,
  handleBatchStatusUpdate,
  setSelectedItems,
  setIsAllSelected,
  showPaidItems,
  setShowPaidItems,
  onItemClick,
  onPaymentClick,
  onEditClick,
  onDeleteClick,
  searchTerm,
  selectedStatus,
  selectedProject,
  setSearchTerm,
  setSelectedStatus,
  setSelectedProject,
}: PaymentProjectItemListProps) {
  return (
    <>
      {/* 頁籤導航 */}
      <div className="border-b">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("items")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "items"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            付款項目
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "analytics"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            智能分析
          </button>
        </nav>
      </div>

      {/* 頁籤內容 */}
      {activeTab === "items" ? (
        <ResponsiveLayout maxWidth="7xl" padding="md">
          {/* 專案選擇和統計概覽 */}
          <ResponsiveGrid
            cols={{ default: 1, md: 4 }}
            gap="md"
            className="mb-6"
          >
            <ResponsiveCard padding="md">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">總付款金額</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${stats.totalAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </ResponsiveCard>

            <ResponsiveCard padding="md">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">已付金額</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${stats.paidAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </ResponsiveCard>

            <ResponsiveCard padding="md">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">未付金額</p>
                  <p className="text-2xl font-bold text-orange-600">
                    ${stats.unpaidAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </ResponsiveCard>

            <ResponsiveCard padding="md">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">項目總數</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {filteredAndSortedItems.length}
                  </p>
                </div>
              </div>
            </ResponsiveCard>
          </ResponsiveGrid>

          {/* 付款項目列表 */}
          <div className="space-y-6">
            {itemsLoading ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                  <LoadingSpinner className="h-4 w-4" />
                  <span>正在載入付款項目數據...</span>
                </div>
                <PaymentItemsSkeleton items={8} />
              </div>
            ) : (
              <>
                {/* 未付款項目 */}
                {(() => {
                  const unpaidItems = filteredAndSortedItems.filter(item => item.status !== "paid");
                  return unpaidItems.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <h3 className="text-lg font-medium text-gray-900">
                            待付款項目 ({unpaidItems.length})
                          </h3>
                        </div>

                        {/* 批量操作工具列 */}
                        {selectedItems.size > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              已選擇 {selectedItems.size} 個項目
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleBatchStatusUpdate("paid")}
                              className="h-7 text-xs"
                            >
                              標記為已付清
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleBatchStatusUpdate("partial")}
                              className="h-7 text-xs"
                            >
                              標記為部分付款
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedItems(new Set());
                                setIsAllSelected(false);
                              }}
                              className="h-7 text-xs"
                            >
                              取消選擇
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* 全選/取消全選 */}
                      <div className="flex items-center gap-2 px-1">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={() => toggleSelectAll(unpaidItems)}
                          className="rounded border-gray-300"
                        />
                        <label className="text-sm text-gray-600 cursor-pointer">
                          全選/取消全選
                        </label>
                      </div>

                      {/* 虛擬滾動載入指示器 */}
                      {isLoadingMore && (
                        <div className="flex items-center justify-center py-4">
                          <div className="flex items-center gap-2 text-sm text-blue-600">
                            <LoadingSpinner className="h-4 w-4" />
                            <span>正在載入更多付款項目...</span>
                          </div>
                        </div>
                      )}

                      {unpaidItems.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          isSelected={selectedItems.has(item.id)}
                          onToggleSelect={toggleItemSelection}
                          onItemClick={onItemClick}
                          onPaymentClick={onPaymentClick}
                          onEditClick={onEditClick}
                          onDeleteClick={onDeleteClick}
                        />
                      ))}
                    </div>
                  );
                })()}

                {/* 已付款項目 - 可摺疊區域 */}
                {(() => {
                  const paidItems = filteredAndSortedItems.filter(item => {
                    const paidAmount = parseFloat(item.paidAmount || "0");
                    return paidAmount > 0;
                  });
                  return paidItems.length > 0 && (
                    <Card className="border-green-200 bg-green-50/30">
                      <CardContent className="p-4">
                        <Button
                          variant="ghost"
                          onClick={() => setShowPaidItems(!showPaidItems)}
                          className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <h3 className="text-lg font-medium text-gray-900">
                              已付款項目 ({paidItems.length})
                            </h3>
                          </div>
                          {showPaidItems ? (
                            <ChevronUp className="h-5 w-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-500" />
                          )}
                        </Button>

                        {showPaidItems && (
                          <div className="mt-4 space-y-3">
                            {paidItems.map((item) => (
                              <PaidItemCard
                                key={item.id}
                                item={item}
                                onItemClick={onItemClick}
                              />
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
              </>
            )}

            {!itemsLoading && filteredAndSortedItems.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">
                  {searchTerm || selectedStatus !== "all" || selectedProject !== "all" ? (
                    <div className="space-y-2">
                      <p>沒有找到符合條件的付款項目</p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchTerm("");
                          setSelectedStatus("all");
                          setSelectedProject("all");
                        }}
                      >
                        清除所有篩選
                      </Button>
                    </div>
                  ) : (
                    selectedProject ? '此專案還沒有付款項目，點擊上方按鈕新增第一個項目' : '還沒有專案付款項目，點擊上方按鈕新增第一個項目'
                  )}
                </div>
              </div>
            )}
          </div>
        </ResponsiveLayout>
      ) : (
        <div className="space-y-6">
          <IntelligentAnalytics
            projectId={selectedProject !== "all" ? parseInt(selectedProject) : undefined}
            timeRange="month"
          />
        </div>
      )}
    </>
  );
}
