import { relations } from "drizzle-orm";
import { users } from "./base";
import { fixedCategories, fixedCategorySubOptions, paymentProjects } from "./category";
import { paymentItems, paymentRecords, installmentPlans, paymentItemNotes } from "./payment";
import { rentalContracts, contractDocuments, rentalPriceTiers } from "./rental";
import { loanInvestmentRecords, loanPaymentSchedule, loanPaymentHistory, fileAttachments } from "./loan";
import { employees, monthlyHrCosts } from "./hr";
import { debtCategories } from "./category";

// 固定分類關聯
export const fixedCategoriesRelations = relations(fixedCategories, ({ many }) => ({
  subOptions: many(fixedCategorySubOptions),
  paymentItems: many(paymentItems),
}));

export const fixedCategorySubOptionsRelations = relations(fixedCategorySubOptions, ({ one, many }) => ({
  fixedCategory: one(fixedCategories, {
    fields: [fixedCategorySubOptions.fixedCategoryId],
    references: [fixedCategories.id],
  }),
  project: one(paymentProjects, {
    fields: [fixedCategorySubOptions.projectId],
    references: [paymentProjects.id],
  }),
  paymentItems: many(paymentItems),
}));

// 付款項目關聯
export const paymentItemsRelations = relations(paymentItems, ({ one, many }) => ({
  category: one(debtCategories, {
    fields: [paymentItems.categoryId],
    references: [debtCategories.id],
  }),
  fixedCategory: one(fixedCategories, {
    fields: [paymentItems.fixedCategoryId],
    references: [fixedCategories.id],
  }),
  fixedSubOption: one(fixedCategorySubOptions, {
    fields: [paymentItems.fixedSubOptionId],
    references: [fixedCategorySubOptions.id],
  }),
  project: one(paymentProjects, {
    fields: [paymentItems.projectId],
    references: [paymentProjects.id],
  }),
  records: many(paymentRecords),
  notes: many(paymentItemNotes),
  installmentPlan: one(installmentPlans),
}));

export const paymentRecordsRelations = relations(paymentRecords, ({ one }) => ({
  item: one(paymentItems, {
    fields: [paymentRecords.itemId],
    references: [paymentItems.id],
  }),
}));

export const paymentProjectsRelations = relations(paymentProjects, ({ many }) => ({
  items: many(paymentItems),
  rentalContracts: many(rentalContracts),
}));

// 租約關聯
export const rentalContractsRelations = relations(rentalContracts, ({ one, many }) => ({
  project: one(paymentProjects, {
    fields: [rentalContracts.projectId],
    references: [paymentProjects.id],
  }),
  priceTiers: many(rentalPriceTiers),
  documents: many(contractDocuments),
}));

export const contractDocumentsRelations = relations(contractDocuments, ({ one }) => ({
  contract: one(rentalContracts, {
    fields: [contractDocuments.contractId],
    references: [rentalContracts.id],
  }),
}));

export const rentalPriceTiersRelations = relations(rentalPriceTiers, ({ one }) => ({
  contract: one(rentalContracts, {
    fields: [rentalPriceTiers.contractId],
    references: [rentalContracts.id],
  }),
}));

// 分期付款關聯
export const installmentPlansRelations = relations(installmentPlans, ({ one }) => ({
  item: one(paymentItems, {
    fields: [installmentPlans.itemId],
    references: [paymentItems.id],
  }),
}));

// 備註關聯
export const paymentItemNotesRelations = relations(paymentItemNotes, ({ one }) => ({
  item: one(paymentItems, {
    fields: [paymentItemNotes.itemId],
    references: [paymentItems.id],
  }),
  user: one(users, {
    fields: [paymentItemNotes.userId],
    references: [users.id],
  }),
}));

// 借貸關聯
export const loanInvestmentRelations = relations(loanInvestmentRecords, ({ many }) => ({
  paymentSchedule: many(loanPaymentSchedule),
  paymentHistory: many(loanPaymentHistory),
  attachments: many(fileAttachments),
}));

export const fileAttachmentsRelations = relations(fileAttachments, ({ one }) => ({
  loanRecord: one(loanInvestmentRecords, {
    fields: [fileAttachments.entityId],
    references: [loanInvestmentRecords.id],
  }),
}));

export const loanPaymentScheduleRelations = relations(loanPaymentSchedule, ({ one, many }) => ({
  record: one(loanInvestmentRecords, {
    fields: [loanPaymentSchedule.recordId],
    references: [loanInvestmentRecords.id],
  }),
  payments: many(loanPaymentHistory),
}));

export const loanPaymentHistoryRelations = relations(loanPaymentHistory, ({ one }) => ({
  record: one(loanInvestmentRecords, {
    fields: [loanPaymentHistory.recordId],
    references: [loanInvestmentRecords.id],
  }),
  schedule: one(loanPaymentSchedule, {
    fields: [loanPaymentHistory.scheduleId],
    references: [loanPaymentSchedule.id],
  }),
}));

// 人事費關聯
export const employeesRelations = relations(employees, ({ many }) => ({
  monthlyCosts: many(monthlyHrCosts),
}));

export const monthlyHrCostsRelations = relations(monthlyHrCosts, ({ one }) => ({
  employee: one(employees, {
    fields: [monthlyHrCosts.employeeId],
    references: [employees.id],
  }),
}));
