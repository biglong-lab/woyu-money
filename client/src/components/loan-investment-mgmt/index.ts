/**
 * 借貸投資管理 -- 子元件匯出入口
 */

export { default as StatCards } from "./stat-cards";
export { default as RecordTable } from "./record-table";
export { default as RecordCardList } from "./record-card-list";
export { default as RecordFormDialog } from "./record-form-dialog";
export { getStatusBadge, getRiskBadge, getRecordTypeBadge } from "./badge-helpers";
export { loanInvestmentSchema } from "./types";
export type { LoanInvestmentFormData, LoanInvestmentRecord, LoanInvestmentStats } from "./types";
