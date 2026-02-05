// 專案付款管理 - 主頁面（協調器）
// 負責：組合 hooks 與子元件，渲染頁面佈局
import { useState } from "react";
import PaymentItemDetails from "@/components/payment-item-details";
import ProjectCategoryDialog from "@/components/project-category-dialog";

// 子元件
import PaymentProjectStats from "@/components/payment-project-stats";
import PaymentProjectFilters from "@/components/payment-project-filters";
import PaymentProjectItemList from "@/components/payment-project-item-list";
import PaymentProjectPaymentDialog from "@/components/payment-project-payment-dialog";
import { PaymentProjectEditDialog, PaymentProjectDeleteDialog } from "@/components/payment-project-edit-dialog";

// 共用型別
import { type PaymentProject as PaymentProjectType } from "@/components/payment-project-types";

// 自訂 Hooks
import { usePaymentProjectFilters } from "@/hooks/use-payment-project-filters";
import { usePaymentProjectQueries } from "@/hooks/use-payment-project-queries";
import { useFilteredPaymentItems } from "@/hooks/use-filtered-payment-items";
import { usePaymentProjectMutations } from "@/hooks/use-payment-project-mutations";
import { useVirtualScroll } from "@/hooks/use-virtual-scroll";

function PaymentProjectContent() {
  const [activeTab, setActiveTab] = useState("items");

  // 篩選狀態管理
  const filters = usePaymentProjectFilters();

  // 資料查詢
  const queries = usePaymentProjectQueries({
    statisticsMode: filters.statisticsMode,
    selectedYear: filters.selectedYear,
    selectedMonth: filters.selectedMonth,
    selectedProject: filters.selectedProject,
  });

  // 篩選排序與統計
  const { filteredAndSortedItems, stats } = useFilteredPaymentItems({
    paymentItems: queries.paymentItems,
    searchTerm: filters.searchTerm,
    selectedProject: filters.selectedProject,
    selectedCategory: filters.selectedCategory,
    selectedStatus: filters.selectedStatus,
    selectedPaymentType: filters.selectedPaymentType,
    dateRange: filters.dateRange,
    priorityFilter: filters.priorityFilter,
    showPaidItems: filters.showPaidItems,
    startDate: filters.startDate,
    endDate: filters.endDate,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    projects: queries.projects,
    paymentRecords: queries.paymentRecords,
    selectedMonth: filters.selectedMonth,
    selectedYear: filters.selectedYear,
    showDeleted: filters.showDeleted,
  });

  // Mutations 與事件處理
  const mutations = usePaymentProjectMutations({
    paymentItems: queries.paymentItems,
  });

  // 虛擬滾動
  const virtualScroll = useVirtualScroll({
    totalItems: filteredAndSortedItems.length,
  });

  return (
    <div className="space-y-4 px-2 sm:px-0">
      {/* 統計卡片 */}
      <PaymentProjectStats
        stats={stats}
        filteredAndSortedItems={filteredAndSortedItems}
        statisticsMode={filters.statisticsMode}
        cashflowStats={queries.cashflowStats}
        cashflowDetails={queries.cashflowDetails}
        cashflowDetailsLoading={queries.cashflowDetailsLoading}
        selectedYear={filters.selectedYear}
        selectedMonth={filters.selectedMonth}
      />

      {/* 篩選工具列 */}
      <PaymentProjectFilters
        statisticsMode={filters.statisticsMode}
        setStatisticsMode={filters.setStatisticsMode}
        onOpenProjectCategoryDialog={() => mutations.setIsProjectCategoryDialogOpen(true)}
        filteredItemsCount={filteredAndSortedItems.length}
        isLoadingMore={virtualScroll.isLoadingMore}
        selectedItemsCount={mutations.selectedItems.size}
        searchTerm={filters.searchTerm}
        setSearchTerm={filters.setSearchTerm}
        debouncedSearchTerm={filters.debouncedSearchTerm}
        setDebouncedSearchTerm={filters.setDebouncedSearchTerm}
        searchInputRef={filters.searchInputRef}
        selectedProject={filters.selectedProject}
        setSelectedProject={filters.setSelectedProject}
        selectedCategory={filters.selectedCategory}
        setSelectedCategory={filters.setSelectedCategory}
        selectedStatus={filters.selectedStatus}
        setSelectedStatus={filters.setSelectedStatus}
        selectedPaymentType={filters.selectedPaymentType}
        setSelectedPaymentType={filters.setSelectedPaymentType}
        dateRange={filters.dateRange}
        setDateRange={filters.setDateRange}
        priorityFilter={filters.priorityFilter}
        setPriorityFilter={filters.setPriorityFilter}
        showPaidItems={filters.showPaidItems}
        setShowPaidItems={filters.setShowPaidItems}
        sortBy={filters.sortBy}
        setSortBy={filters.setSortBy}
        sortOrder={filters.sortOrder}
        setSortOrder={filters.setSortOrder}
        showAdvancedFilters={filters.showAdvancedFilters}
        setShowAdvancedFilters={filters.setShowAdvancedFilters}
        selectedYear={filters.selectedYear}
        setSelectedYear={filters.setSelectedYear}
        selectedMonth={filters.selectedMonth}
        setSelectedMonth={filters.setSelectedMonth}
        startDate={filters.startDate}
        setStartDate={filters.setStartDate}
        endDate={filters.endDate}
        setEndDate={filters.setEndDate}
        resetFilters={filters.resetFilters}
        applySmartFilter={filters.applySmartFilter}
        projects={queries.projects as PaymentProjectType[] | undefined}
        fixedCategoriesData={queries.fixedCategoriesData}
        projectCategoriesData={queries.projectCategoriesData}
      />

      {/* 項目列表 */}
      <PaymentProjectItemList
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        filteredAndSortedItems={filteredAndSortedItems}
        stats={stats}
        itemsLoading={queries.itemsLoading}
        isLoadingMore={virtualScroll.isLoadingMore}
        selectedItems={mutations.selectedItems}
        isAllSelected={mutations.isAllSelected}
        toggleItemSelection={mutations.toggleItemSelection}
        toggleSelectAll={mutations.toggleSelectAll}
        handleBatchStatusUpdate={mutations.handleBatchStatusUpdate}
        setSelectedItems={mutations.setSelectedItems}
        setIsAllSelected={mutations.setIsAllSelected}
        showPaidItems={filters.showPaidItems}
        setShowPaidItems={filters.setShowPaidItems}
        onItemClick={mutations.setSelectedItem}
        onPaymentClick={mutations.handlePaymentClick}
        onEditClick={mutations.openEditDialog}
        onDeleteClick={mutations.handleDeleteClick}
        searchTerm={filters.searchTerm}
        selectedStatus={filters.selectedStatus}
        selectedProject={filters.selectedProject}
        setSearchTerm={filters.setSearchTerm}
        setSelectedStatus={filters.setSelectedStatus}
        setSelectedProject={filters.setSelectedProject}
      />

      {/* 項目詳情對話框 */}
      <PaymentItemDetails
        item={mutations.selectedItem}
        open={!!mutations.selectedItem}
        onOpenChange={(open) => !open && mutations.setSelectedItem(null)}
      />

      {/* 付款對話框 */}
      <PaymentProjectPaymentDialog
        isOpen={mutations.isPaymentDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            mutations.setPaymentItem(null);
          }
          mutations.setIsPaymentDialogOpen(open);
        }}
        paymentItem={mutations.paymentItem}
        paymentForm={mutations.paymentForm}
        onSubmit={mutations.handlePayment}
        isPending={mutations.paymentMutation.isPending}
        selectedImage={mutations.selectedImage}
        imagePreview={mutations.imagePreview}
        onImageSelect={mutations.handleImageSelect}
        onRemoveImage={mutations.removeImage}
      />

      {/* 專案分類管理對話框 */}
      <ProjectCategoryDialog
        open={mutations.isProjectCategoryDialogOpen}
        onOpenChange={mutations.setIsProjectCategoryDialogOpen}
      />

      {/* 編輯項目對話框 */}
      <PaymentProjectEditDialog
        isOpen={mutations.isEditDialogOpen}
        onOpenChange={mutations.setIsEditDialogOpen}
        editForm={mutations.editForm}
        onSubmit={mutations.handleEditItem}
        isPending={mutations.editItemMutation.isPending}
      />

      {/* 刪除確認對話框 */}
      <PaymentProjectDeleteDialog
        isOpen={mutations.isDeleteDialogOpen}
        onOpenChange={mutations.setIsDeleteDialogOpen}
        deleteItem={mutations.deleteItem}
        onConfirm={mutations.handleDeleteConfirm}
        isPending={mutations.deleteMutation.isPending}
      />
    </div>
  );
}

export default function PaymentProject() {
  return <PaymentProjectContent />;
}
