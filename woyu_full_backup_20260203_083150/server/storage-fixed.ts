import {
  debtCategories,
  paymentProjects,
  paymentItems,
  paymentRecords,
  rentalContracts,
  rentalPriceTiers,
  contractDocuments,
  installmentPlans,
  householdBudgets,
  householdExpenses,
  auditLogs,
  fixedCategories,
  fixedCategorySubOptions,

  type DebtCategory,
  type InsertDebtCategory,
  type PaymentProject,
  type InsertPaymentProject,
  type PaymentItem,
  type InsertPaymentItem,
  type PaymentRecord,
  type InsertPaymentRecord,
  type RentalContract,
  type InsertRentalContract,
  type RentalPriceTier,
  type InsertRentalPriceTier,
  type ContractDocument,
  type InsertContractDocument,
  type InstallmentPlan,
  type InsertInstallmentPlan,
  type AuditLog,
  type InsertAuditLog,
  type HouseholdBudget,
  type InsertHouseholdBudget,
  type HouseholdExpense,
  type InsertHouseholdExpense,
  type FixedCategory,
  type InsertFixedCategory,
  type FixedCategorySubOption,
  type InsertFixedCategorySubOption,
} from "@shared/schema";

import { db } from "./db";
import { and, eq, desc, ne, sql, gte, lte, like, isNull, or } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // Categories - Complete CRUD
  getCategories(): Promise<DebtCategory[]>;
  getProjectCategories(): Promise<DebtCategory[]>;
  createCategory(category: InsertDebtCategory): Promise<DebtCategory>;
  updateCategory(id: number, category: InsertDebtCategory): Promise<DebtCategory>;
  deleteCategory(id: number): Promise<void>;
  getCategoryUsageCount(categoryId: number): Promise<number>;

  // Payment Projects - Complete CRUD
  getPaymentProjects(): Promise<PaymentProject[]>;
  createPaymentProject(project: InsertPaymentProject): Promise<PaymentProject>;
  updatePaymentProject(id: number, project: InsertPaymentProject): Promise<PaymentProject>;
  deletePaymentProject(id: number): Promise<void>;

  // Payment Items - Enhanced CRUD with audit logging
  getPaymentItems(includeDeleted?: boolean): Promise<PaymentItem[]>;
  getPaymentItem(id: number): Promise<PaymentItem | undefined>;
  createPaymentItem(item: InsertPaymentItem, userInfo?: string): Promise<PaymentItem>;
  updatePaymentItem(id: number, item: InsertPaymentItem, userInfo?: string, reason?: string): Promise<PaymentItem>;
  deletePaymentItem(id: number, userInfo?: string, reason?: string): Promise<void>;
  restorePaymentItem(id: number, userInfo?: string, reason?: string): Promise<PaymentItem>;

  // Payment Records - Complete CRUD
  getPaymentRecords(): Promise<PaymentRecord[]>;
  createPaymentRecord(record: InsertPaymentRecord): Promise<PaymentRecord>;
  updatePaymentRecord(id: number, record: InsertPaymentRecord): Promise<PaymentRecord>;
  deletePaymentRecord(id: number): Promise<void>;

  // Fixed Categories - 固定分類管理
  getFixedCategories(): Promise<FixedCategory[]>;
  getFixedCategorySubOptions(projectId: number, fixedCategoryId?: number): Promise<FixedCategorySubOption[]>;
  createFixedCategorySubOption(subOption: InsertFixedCategorySubOption): Promise<FixedCategorySubOption>;
  updateFixedCategorySubOption(id: number, subOption: Partial<InsertFixedCategorySubOption>): Promise<FixedCategorySubOption>;
  deleteFixedCategorySubOption(id: number): Promise<void>;

  // Audit logging
  getAuditLogs(tableName: string, recordId: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Rental Management
  getRentalContracts(): Promise<any[]>;
  createRentalContract(contract: InsertRentalContract, priceTiers: any[]): Promise<RentalContract>;
  updateRentalContract(contractId: number, contract: Partial<InsertRentalContract>, priceTiers?: any[]): Promise<RentalContract>;
  deleteRentalContract(contractId: number): Promise<void>;
  getRentalPriceTiers(contractId: number): Promise<any[]>;
  generateRentalPayments(contractId: number): Promise<{ generatedCount: number }>;
  getRentalStats(): Promise<any>;
  getRentalPaymentItems(): Promise<any[]>;

  // Contract Document Management
  getContractDocuments(contractId: number): Promise<ContractDocument[]>;
  getContractDocument(documentId: number): Promise<ContractDocument | undefined>;
  createContractDocument(document: InsertContractDocument): Promise<ContractDocument>;
  deleteContractDocument(documentId: number): Promise<void>;
  updateContractPaymentInfo(contractId: number, paymentInfo: {
    payeeName?: string;
    payeeUnit?: string;
    bankCode?: string;
    accountNumber?: string;
    contractPaymentDay?: number;
  }): Promise<RentalContract>;

  // Installment Plans
  createInstallmentPlan(plan: InsertInstallmentPlan): Promise<InstallmentPlan>;
  generateInstallmentPayments(planId: number): Promise<{ generatedCount: number }>;

  // Statistics
  getPaymentHomeStats(): Promise<any>;
  getPaymentProjectStats(): Promise<any>;
  getProjectsWithStats(): Promise<any[]>;
  getMonthlyPaymentTrend(): Promise<any>;
  getTopPaymentCategories(): Promise<any>;
  getPaymentMethodsReport(): Promise<any>;
  getMonthlyPaymentAnalysis(year: number, month: number): Promise<any>;
  
  // Household budget
  getHouseholdBudget(month: string): Promise<HouseholdBudget | undefined>;
  setHouseholdBudget(budget: InsertHouseholdBudget): Promise<HouseholdBudget>;
  getHouseholdExpenses(): Promise<HouseholdExpense[]>;
  createHouseholdExpense(expense: InsertHouseholdExpense): Promise<HouseholdExpense>;
  getHouseholdStats(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getCategories(): Promise<DebtCategory[]> {
    try {
      return await db
        .select()
        .from(debtCategories)
        .where(eq(debtCategories.isDeleted, false))
        .orderBy(debtCategories.categoryName);
    } catch (error) {
      console.error("Error fetching categories:", error);
      throw error;
    }
  }

  async getProjectCategories(): Promise<DebtCategory[]> {
    try {
      return await db
        .select()
        .from(debtCategories)
        .where(and(
          eq(debtCategories.categoryType, "project"),
          eq(debtCategories.isDeleted, false)
        ))
        .orderBy(debtCategories.categoryName);
    } catch (error) {
      console.error("Error fetching project categories:", error);
      throw error;
    }
  }

  async createCategory(categoryData: InsertDebtCategory): Promise<DebtCategory> {
    try {
      const [category] = await db
        .insert(debtCategories)
        .values(categoryData)
        .returning();
      return category;
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  }

  async updateCategory(id: number, categoryData: InsertDebtCategory): Promise<DebtCategory> {
    try {
      const [category] = await db
        .update(debtCategories)
        .set(categoryData)
        .where(eq(debtCategories.id, id))
        .returning();
      return category;
    } catch (error) {
      console.error("Error updating category:", error);
      throw error;
    }
  }

  async deleteCategory(id: number): Promise<void> {
    try {
      await db
        .update(debtCategories)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(eq(debtCategories.id, id));
    } catch (error) {
      console.error("Error deleting category:", error);
      throw error;
    }
  }

  async getCategoryUsageCount(categoryId: number): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(paymentItems)
        .where(and(
          eq(paymentItems.categoryId, categoryId),
          eq(paymentItems.isDeleted, false)
        ));
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error getting category usage count:", error);
      throw error;
    }
  }

  // Payment Projects
  async getPaymentProjects(): Promise<PaymentProject[]> {
    try {
      return await db.select().from(paymentProjects);
    } catch (error) {
      console.error("Error fetching payment projects:", error);
      throw error;
    }
  }

  async createPaymentProject(projectData: InsertPaymentProject): Promise<PaymentProject> {
    try {
      const [project] = await db
        .insert(paymentProjects)
        .values(projectData)
        .returning();
      return project;
    } catch (error) {
      console.error("Error creating payment project:", error);
      throw error;
    }
  }

  async updatePaymentProject(id: number, projectData: InsertPaymentProject): Promise<PaymentProject> {
    try {
      const [project] = await db
        .update(paymentProjects)
        .set(projectData)
        .where(eq(paymentProjects.id, id))
        .returning();
      return project;
    } catch (error) {
      console.error("Error updating payment project:", error);
      throw error;
    }
  }

  async deletePaymentProject(id: number): Promise<void> {
    try {
      await db.delete(paymentProjects).where(eq(paymentProjects.id, id));
    } catch (error) {
      console.error("Error deleting payment project:", error);
      throw error;
    }
  }

  // Payment Items
  async getPaymentItems(includeDeleted = false): Promise<PaymentItem[]> {
    try {
      const conditions = includeDeleted ? [] : [eq(paymentItems.isDeleted, false)];
      
      return await db
        .select()
        .from(paymentItems)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(paymentItems.startDate);
    } catch (error) {
      console.error("Error fetching payment items:", error);
      throw error;
    }
  }

  async getPaymentItem(id: number): Promise<PaymentItem | undefined> {
    try {
      const [item] = await db
        .select()
        .from(paymentItems)
        .where(eq(paymentItems.id, id));
      return item;
    } catch (error) {
      console.error("Error fetching payment item:", error);
      throw error;
    }
  }

  async createPaymentItem(itemData: InsertPaymentItem, userInfo = "系統管理員"): Promise<PaymentItem> {
    try {
      const [item] = await db
        .insert(paymentItems)
        .values(itemData)
        .returning();

      await this.createAuditLog({
        tableName: 'payment_items',
        recordId: item.id,
        action: 'CREATE',
        oldValues: null,
        newValues: itemData,
        changedFields: Object.keys(itemData),
        userInfo,
        changeReason: '創建新項目'
      });

      return item;
    } catch (error) {
      console.error("Error creating payment item:", error);
      throw error;
    }
  }

  async updatePaymentItem(id: number, itemData: InsertPaymentItem, userInfo = "系統管理員", reason = "更新項目資訊"): Promise<PaymentItem> {
    try {
      const [oldItem] = await db.select().from(paymentItems).where(eq(paymentItems.id, id));
      
      const [item] = await db
        .update(paymentItems)
        .set(itemData)
        .where(eq(paymentItems.id, id))
        .returning();

      await this.createAuditLog({
        tableName: 'payment_items',
        recordId: id,
        action: 'UPDATE',
        oldValues: oldItem,
        newValues: itemData,
        changedFields: Object.keys(itemData),
        userInfo,
        changeReason: reason
      });

      return item;
    } catch (error) {
      console.error("Error updating payment item:", error);
      throw error;
    }
  }

  async deletePaymentItem(id: number, userInfo = "系統管理員", reason = "刪除項目"): Promise<void> {
    try {
      const [oldItem] = await db.select().from(paymentItems).where(eq(paymentItems.id, id));
      
      await db
        .update(paymentItems)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(eq(paymentItems.id, id));

      await this.createAuditLog({
        tableName: 'payment_items',
        recordId: id,
        action: 'DELETE',
        oldValues: oldItem,
        newValues: { isDeleted: true },
        changedFields: ['isDeleted'],
        userInfo,
        changeReason: reason
      });
    } catch (error) {
      console.error("Error deleting payment item:", error);
      throw error;
    }
  }

  async restorePaymentItem(id: number, userInfo = "系統管理員", reason = "恢復項目"): Promise<PaymentItem> {
    try {
      const [item] = await db
        .update(paymentItems)
        .set({ isDeleted: false, updatedAt: new Date() })
        .where(eq(paymentItems.id, id))
        .returning();

      await this.createAuditLog({
        tableName: 'payment_items',
        recordId: id,
        action: 'RESTORE',
        oldValues: { isDeleted: true },
        newValues: { isDeleted: false },
        changedFields: ['isDeleted'],
        userInfo,
        changeReason: reason
      });

      return item;
    } catch (error) {
      console.error("Error restoring payment item:", error);
      throw error;
    }
  }

  // Audit logging
  async getAuditLogs(tableName: string, recordId: number): Promise<AuditLog[]> {
    try {
      return await db
        .select()
        .from(auditLogs)
        .where(and(
          eq(auditLogs.tableName, tableName),
          eq(auditLogs.recordId, recordId)
        ))
        .orderBy(desc(auditLogs.createdAt));
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      throw error;
    }
  }

  async createAuditLog(logData: InsertAuditLog): Promise<AuditLog> {
    try {
      const [log] = await db
        .insert(auditLogs)
        .values(logData)
        .returning();
      return log;
    } catch (error) {
      console.error("Error creating audit log:", error);
      throw error;
    }
  }

  // Payment Records
  async getPaymentRecords(): Promise<any[]> {
    try {
      return await db
        .select({
          id: paymentRecords.id,
          itemId: paymentRecords.itemId,
          amount: paymentRecords.amount,
          paymentDate: paymentRecords.paymentDate,
          paymentMethod: paymentRecords.paymentMethod,
          notes: paymentRecords.notes,
          createdAt: paymentRecords.createdAt,
          updatedAt: paymentRecords.updatedAt,
          itemName: paymentItems.itemName,
          categoryName: debtCategories.categoryName,
          projectName: paymentProjects.projectName,
        })
        .from(paymentRecords)
        .leftJoin(paymentItems, eq(paymentRecords.itemId, paymentItems.id))
        .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
        .leftJoin(paymentProjects, eq(paymentItems.projectId, paymentProjects.id))
        .orderBy(desc(paymentRecords.paymentDate));
    } catch (error) {
      console.error("Error fetching payment records:", error);
      throw error;
    }
  }

  async createPaymentRecord(recordData: InsertPaymentRecord): Promise<PaymentRecord> {
    try {
      const [record] = await db
        .insert(paymentRecords)
        .values(recordData)
        .returning();
      return record;
    } catch (error) {
      console.error("Error creating payment record:", error);
      throw error;
    }
  }

  async updatePaymentRecord(id: number, recordData: InsertPaymentRecord): Promise<PaymentRecord> {
    try {
      const [record] = await db
        .update(paymentRecords)
        .set(recordData)
        .where(eq(paymentRecords.id, id))
        .returning();
      return record;
    } catch (error) {
      console.error("Error updating payment record:", error);
      throw error;
    }
  }

  async deletePaymentRecord(id: number): Promise<void> {
    try {
      await db.delete(paymentRecords).where(eq(paymentRecords.id, id));
    } catch (error) {
      console.error("Error deleting payment record:", error);
      throw error;
    }
  }

  // Fixed Categories Implementation - 固定分類管理
  async getFixedCategories(): Promise<FixedCategory[]> {
    try {
      return await db
        .select()
        .from(fixedCategories)
        .where(eq(fixedCategories.isActive, true))
        .orderBy(fixedCategories.sortOrder, fixedCategories.categoryName);
    } catch (error) {
      console.error("Error fetching fixed categories:", error);
      throw error;
    }
  }

  async getFixedCategorySubOptions(projectId: number, fixedCategoryId?: number): Promise<FixedCategorySubOption[]> {
    try {
      const conditions = [
        eq(fixedCategorySubOptions.projectId, projectId),
        eq(fixedCategorySubOptions.isActive, true)
      ];

      if (fixedCategoryId) {
        conditions.push(eq(fixedCategorySubOptions.fixedCategoryId, fixedCategoryId));
      }

      return await db
        .select({
          id: fixedCategorySubOptions.id,
          fixedCategoryId: fixedCategorySubOptions.fixedCategoryId,
          projectId: fixedCategorySubOptions.projectId,
          subOptionName: fixedCategorySubOptions.subOptionName,
          displayName: fixedCategorySubOptions.displayName,
          isActive: fixedCategorySubOptions.isActive,
          createdAt: fixedCategorySubOptions.createdAt,
          updatedAt: fixedCategorySubOptions.updatedAt,
          categoryName: fixedCategories.categoryName,
          categoryType: fixedCategories.categoryType,
        })
        .from(fixedCategorySubOptions)
        .leftJoin(fixedCategories, eq(fixedCategorySubOptions.fixedCategoryId, fixedCategories.id))
        .where(and(...conditions))
        .orderBy(fixedCategories.sortOrder, fixedCategorySubOptions.subOptionName);
    } catch (error) {
      console.error("Error fetching fixed category sub options:", error);
      throw error;
    }
  }

  async createFixedCategorySubOption(subOption: InsertFixedCategorySubOption): Promise<FixedCategorySubOption> {
    try {
      const [newSubOption] = await db
        .insert(fixedCategorySubOptions)
        .values(subOption)
        .returning();
      return newSubOption;
    } catch (error) {
      console.error("Error creating fixed category sub option:", error);
      throw error;
    }
  }

  async updateFixedCategorySubOption(id: number, subOption: Partial<InsertFixedCategorySubOption>): Promise<FixedCategorySubOption> {
    try {
      const [updatedSubOption] = await db
        .update(fixedCategorySubOptions)
        .set({ ...subOption, updatedAt: new Date() })
        .where(eq(fixedCategorySubOptions.id, id))
        .returning();
      return updatedSubOption;
    } catch (error) {
      console.error("Error updating fixed category sub option:", error);
      throw error;
    }
  }

  async deleteFixedCategorySubOption(id: number): Promise<void> {
    try {
      await db
        .update(fixedCategorySubOptions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(fixedCategorySubOptions.id, id));
    } catch (error) {
      console.error("Error deleting fixed category sub option:", error);
      throw error;
    }
  }

  // Placeholder methods for other functionality
  async getPaymentHomeStats(): Promise<any> {
    return {};
  }

  async getPaymentProjectStats(): Promise<any> {
    return {};
  }

  async getProjectsWithStats(): Promise<any[]> {
    return [];
  }

  async getMonthlyPaymentTrend(): Promise<any> {
    return {};
  }

  async getTopPaymentCategories(): Promise<any> {
    return {};
  }

  async getPaymentMethodsReport(): Promise<any> {
    return {};
  }

  async getMonthlyPaymentAnalysis(year: number, month: number): Promise<any> {
    return {};
  }

  async getHouseholdBudget(month: string): Promise<HouseholdBudget | undefined> {
    try {
      const [budget] = await db
        .select()
        .from(householdBudgets)
        .where(eq(householdBudgets.month, month));
      return budget;
    } catch (error) {
      console.error("Error fetching household budget:", error);
      throw error;
    }
  }

  async setHouseholdBudget(budgetData: InsertHouseholdBudget): Promise<HouseholdBudget> {
    try {
      const [budget] = await db
        .insert(householdBudgets)
        .values(budgetData)
        .onConflictDoUpdate({
          target: householdBudgets.month,
          set: budgetData,
        })
        .returning();
      return budget;
    } catch (error) {
      console.error("Error setting household budget:", error);
      throw error;
    }
  }

  async getHouseholdExpenses(): Promise<HouseholdExpense[]> {
    try {
      return await db
        .select()
        .from(householdExpenses)
        .orderBy(desc(householdExpenses.expenseDate));
    } catch (error) {
      console.error("Error fetching household expenses:", error);
      throw error;
    }
  }

  async createHouseholdExpense(expenseData: InsertHouseholdExpense): Promise<HouseholdExpense> {
    try {
      const [expense] = await db
        .insert(householdExpenses)
        .values(expenseData)
        .returning();
      return expense;
    } catch (error) {
      console.error("Error creating household expense:", error);
      throw error;
    }
  }

  async getHouseholdStats(): Promise<any> {
    return {};
  }

  // Rental management placeholder methods
  async getRentalContracts(): Promise<any[]> {
    return [];
  }

  async createRentalContract(contract: InsertRentalContract, priceTiers: any[]): Promise<RentalContract> {
    const [newContract] = await db.insert(rentalContracts).values(contract).returning();
    return newContract;
  }

  async updateRentalContract(contractId: number, contract: Partial<InsertRentalContract>, priceTiers?: any[]): Promise<RentalContract> {
    const [updated] = await db.update(rentalContracts).set(contract).where(eq(rentalContracts.id, contractId)).returning();
    return updated;
  }

  async deleteRentalContract(contractId: number): Promise<void> {
    await db.delete(rentalContracts).where(eq(rentalContracts.id, contractId));
  }

  async getRentalPriceTiers(contractId: number): Promise<any[]> {
    return [];
  }

  async generateRentalPayments(contractId: number): Promise<{ generatedCount: number }> {
    return { generatedCount: 0 };
  }

  async getRentalStats(): Promise<any> {
    return {};
  }

  async getRentalPaymentItems(): Promise<any[]> {
    return [];
  }

  async getContractDocuments(contractId: number): Promise<ContractDocument[]> {
    return [];
  }

  async getContractDocument(documentId: number): Promise<ContractDocument | undefined> {
    const [doc] = await db.select().from(contractDocuments).where(eq(contractDocuments.id, documentId));
    return doc;
  }

  async createContractDocument(document: InsertContractDocument): Promise<ContractDocument> {
    const [newDoc] = await db.insert(contractDocuments).values(document).returning();
    return newDoc;
  }

  async deleteContractDocument(documentId: number): Promise<void> {
    await db.delete(contractDocuments).where(eq(contractDocuments.id, documentId));
  }

  async updateContractPaymentInfo(contractId: number, paymentInfo: any): Promise<RentalContract> {
    const [updated] = await db.update(rentalContracts).set(paymentInfo).where(eq(rentalContracts.id, contractId)).returning();
    return updated;
  }

  async createInstallmentPlan(plan: InsertInstallmentPlan): Promise<InstallmentPlan> {
    const [newPlan] = await db.insert(installmentPlans).values(plan).returning();
    return newPlan;
  }

  async generateInstallmentPayments(planId: number): Promise<{ generatedCount: number }> {
    return { generatedCount: 0 };
  }
}

export const storage = new DatabaseStorage();