import { 
  users, debts, debtCategories, vendors, debtPayments, debtsSchedule, dailyRecords,
  familyMembers, familyExpenseCategories, familyExpenses, familyBudgets, familyGoals, familyIncome,
  kidsWishlist, kidsSavings, kidsLoans, kidsSchedule, childAccounts,
  allowanceManagement, allowancePayments, loanRequests, achievements, kidsAchievements, parentApprovals,
  projects, projectTasks, projectBudgetItems, projectNotes, projectComments,
  paymentProjects, paymentItems, paymentRecords, paymentTags, paymentItemTags, budgetPlans, budgetItems,
  householdBudgets, householdExpenses,
  type User, type InsertUser, type Debt, type InsertDebt, type DebtCategory, 
  type InsertDebtCategory, type Vendor, type InsertVendor, type DebtPayment, 
  type InsertDebtPayment, type DebtsSchedule, type InsertDebtsSchedule,
  type DailyRecord, type InsertDailyRecord, type FamilyMember, type InsertFamilyMember,
  type FamilyExpenseCategory, type InsertFamilyExpenseCategory, type FamilyExpense, type InsertFamilyExpense,
  type FamilyBudget, type InsertFamilyBudget, type FamilyGoal, type InsertFamilyGoal,
  type FamilyIncome, type InsertFamilyIncome,
  type KidsWishlist, type InsertKidsWishlist, type KidsSaving, type InsertKidsSaving,
  type KidsLoan, type InsertKidsLoan, type KidsSchedule, type InsertKidsSchedule,
  type AllowanceManagement, type InsertAllowanceManagement, type AllowancePayment, type InsertAllowancePayment,
  type LoanRequest, type InsertLoanRequest, type Achievement, type InsertAchievement,
  type KidsAchievement, type InsertKidsAchievement, type ParentApproval, type InsertParentApproval,
  type Project, type InsertProject, type ProjectTask, type InsertProjectTask,
  type ProjectBudgetItem, type InsertProjectBudgetItem, type ProjectNote, type InsertProjectNote,
  type ProjectComment, type InsertProjectComment,
  type PaymentProject, type InsertPaymentProject, type PaymentItem, type InsertPaymentItem,
  type PaymentRecord, type InsertPaymentRecord, type PaymentTag, type InsertPaymentTag,
  type BudgetPlan, type InsertBudgetPlan, type BudgetItem, type InsertBudgetItem,
  type HouseholdBudget, type InsertHouseholdBudget, type HouseholdExpense, type InsertHouseholdExpense
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, gte, lte, sum, count, inArray, ne } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Debt Category methods - 支援階層分類
  getCategories(): Promise<DebtCategory[]>;
  getCategoriesHierarchy(): Promise<any[]>; // 獲取階層結構的分類
  getMainCategories(): Promise<DebtCategory[]>; // 獲取主分類
  getSubCategories(parentId: number): Promise<DebtCategory[]>; // 獲取子分類
  getCategoryById(id: number): Promise<DebtCategory | undefined>;
  createCategory(category: InsertDebtCategory): Promise<DebtCategory>;
  updateCategory(id: number, category: Partial<InsertDebtCategory>): Promise<DebtCategory>;
  deleteCategory(id: number): Promise<void>;

  // Vendor methods
  getVendors(): Promise<Vendor[]>;
  getVendorById(id: number): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: number, vendor: Partial<InsertVendor>): Promise<Vendor>;
  deleteVendor(id: number): Promise<void>;

  // Debt methods
  getDebts(): Promise<Debt[]>;
  getDebtById(id: number): Promise<Debt | undefined>;
  createDebt(debt: InsertDebt): Promise<Debt>;
  updateDebt(id: number, debt: Partial<InsertDebt>): Promise<Debt>;
  deleteDebt(id: number): Promise<void>;
  getDebtsByCategory(categoryId: number): Promise<Debt[]>;
  getDebtsByVendor(vendorId: number): Promise<Debt[]>;

  // Debt Payment methods
  getPayments(): Promise<DebtPayment[]>;
  getPaymentById(id: number): Promise<DebtPayment | undefined>;
  createPayment(payment: InsertDebtPayment): Promise<DebtPayment>;
  updatePayment(id: number, payment: Partial<InsertDebtPayment>): Promise<DebtPayment>;
  deletePayment(id: number): Promise<void>;
  getPaymentsByDebt(debtId: number): Promise<DebtPayment[]>;
  getDebtPayments(debtId: number): Promise<DebtPayment[]>;
  createDebtPayment(payment: InsertDebtPayment): Promise<DebtPayment>;
  getAllPayments(): Promise<DebtPayment[]>;
  getDailyRecords(): Promise<DailyRecord[]>;
  getStatistics(): Promise<any>;

  // Statistics methods
  getMonthlyStats(): Promise<{
    monthlyIncome: number;
    monthlyExpense: number;
    netBalance: number;
    totalRecords: number;
  }>;

  // Debt statistics methods
  getDebtStats(): Promise<{
    thisMonthDue: number;
    thisMonthPaid: number;
    thisMonthUnpaid: number;
    priorUnpaid: number;
    totalUnpaid: number;
  }>;

  // Migration methods
  getMigrationStatus(): Promise<{
    debtsCount: number;
    categoriesCount: number;
    vendorsCount: number;
    paymentsCount: number;
  }>;

  // Family Member methods
  getFamilyMembers(): Promise<FamilyMember[]>;
  getFamilyMemberById(id: number): Promise<FamilyMember | undefined>;
  createFamilyMember(member: InsertFamilyMember): Promise<FamilyMember>;
  updateFamilyMember(id: number, member: Partial<InsertFamilyMember>): Promise<FamilyMember>;
  deleteFamilyMember(id: number): Promise<void>;

  // Kids Wishlist methods
  getKidsWishlist(childId?: number): Promise<KidsWishlist[]>;
  getKidsWishlistById(id: number): Promise<KidsWishlist | undefined>;
  createKidsWishlist(wishlist: InsertKidsWishlist): Promise<KidsWishlist>;
  updateKidsWishlist(id: number, wishlist: Partial<InsertKidsWishlist>): Promise<KidsWishlist>;
  deleteKidsWishlist(id: number): Promise<void>;

  // Kids Savings methods
  getKidsSavings(childId?: number): Promise<KidsSaving[]>;
  getKidsSavingsById(id: number): Promise<KidsSaving | undefined>;
  createKidsSavings(savings: InsertKidsSaving): Promise<KidsSaving>;
  updateKidsSavings(id: number, savings: Partial<InsertKidsSaving>): Promise<KidsSaving>;
  deleteKidsSavings(id: number): Promise<void>;

  // Kids Loans methods
  getKidsLoans(childId?: number): Promise<KidsLoan[]>;
  getKidsLoansById(id: number): Promise<KidsLoan | undefined>;
  createKidsLoans(loan: InsertKidsLoan): Promise<KidsLoan>;
  updateKidsLoans(id: number, loan: Partial<InsertKidsLoan>): Promise<KidsLoan>;
  deleteKidsLoans(id: number): Promise<void>;

  // Kids Schedule methods
  getKidsSchedule(childId?: number): Promise<KidsSchedule[]>;
  getKidsScheduleById(id: number): Promise<KidsSchedule | undefined>;
  createKidsSchedule(schedule: InsertKidsSchedule): Promise<KidsSchedule>;
  updateKidsSchedule(id: number, schedule: Partial<InsertKidsSchedule>): Promise<KidsSchedule>;
  deleteKidsSchedule(id: number): Promise<void>;

  // Parent Management - Allowance methods
  getAllowanceSettings(parentId: number): Promise<AllowanceManagement[]>;
  getAllowanceSettingById(id: number): Promise<AllowanceManagement | undefined>;
  createAllowanceSetting(allowance: InsertAllowanceManagement): Promise<AllowanceManagement>;
  updateAllowanceSetting(id: number, allowance: Partial<InsertAllowanceManagement>): Promise<AllowanceManagement>;
  deleteAllowanceSetting(id: number): Promise<void>;

  // Allowance Payment methods
  getAllowancePayments(childId?: number): Promise<AllowancePayment[]>;
  createAllowancePayment(payment: InsertAllowancePayment): Promise<AllowancePayment>;

  // Loan Request methods
  getLoanRequests(childId?: number, parentId?: number): Promise<LoanRequest[]>;
  getLoanRequestById(id: number): Promise<LoanRequest | undefined>;
  createLoanRequest(loanRequest: InsertLoanRequest): Promise<LoanRequest>;
  updateLoanRequest(id: number, loanRequest: Partial<InsertLoanRequest>): Promise<LoanRequest>;
  deleteLoanRequest(id: number): Promise<void>;

  // Achievement methods
  getAchievements(): Promise<Achievement[]>;
  getAchievementById(id: number): Promise<Achievement | undefined>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  updateAchievement(id: number, achievement: Partial<InsertAchievement>): Promise<Achievement>;

  // Kids Achievement methods
  getKidsAchievements(childId?: number): Promise<KidsAchievement[]>;
  createKidsAchievement(kidsAchievement: InsertKidsAchievement): Promise<KidsAchievement>;

  // Parent Approval methods
  getParentApprovals(parentId?: number, childId?: number): Promise<ParentApproval[]>;
  createParentApproval(approval: InsertParentApproval): Promise<ParentApproval>;
  updateParentApproval(id: number, approval: Partial<InsertParentApproval>): Promise<ParentApproval>;

  // Child Account methods - 兒童個別登入系統
  getChildAccounts(): Promise<any[]>;
  getChildAccountByChildId(childId: number): Promise<any | undefined>;
  createChildAccount(account: any): Promise<any>;
  authenticateChild(childId: number, pinCode: string): Promise<any | null>;
  updateChildSession(accountId: number, sessionToken: string, expiresAt: Date): Promise<void>;
  validateChildSession(sessionToken: string): Promise<any | null>;

  // Dashboard stats for parents
  getParentDashboardStats(parentId: number): Promise<{
    totalChildren: number;
    pendingApprovals: number;
    thisMonthAllowances: number;
    activeLoanRequests: number;
  }>;

  // Family Finance methods
  getFamilyExpenseCategories(): Promise<FamilyExpenseCategory[]>;
  getFamilyExpenseCategoryById(id: number): Promise<FamilyExpenseCategory | undefined>;
  createFamilyExpenseCategory(category: InsertFamilyExpenseCategory): Promise<FamilyExpenseCategory>;
  updateFamilyExpenseCategory(id: number, category: Partial<InsertFamilyExpenseCategory>): Promise<FamilyExpenseCategory>;
  deleteFamilyExpenseCategory(id: number): Promise<void>;

  getFamilyExpenses(): Promise<FamilyExpense[]>;
  getFamilyExpenseById(id: number): Promise<FamilyExpense | undefined>;
  createFamilyExpense(expense: InsertFamilyExpense): Promise<FamilyExpense>;
  updateFamilyExpense(id: number, expense: Partial<InsertFamilyExpense>): Promise<FamilyExpense>;
  deleteFamilyExpense(id: number): Promise<void>;

  getFamilyBudgets(): Promise<FamilyBudget[]>;
  getFamilyBudgetById(id: number): Promise<FamilyBudget | undefined>;
  createFamilyBudget(budget: InsertFamilyBudget): Promise<FamilyBudget>;
  updateFamilyBudget(id: number, budget: Partial<InsertFamilyBudget>): Promise<FamilyBudget>;
  deleteFamilyBudget(id: number): Promise<void>;

  getFamilyGoals(): Promise<FamilyGoal[]>;
  getFamilyGoalById(id: number): Promise<FamilyGoal | undefined>;
  createFamilyGoal(goal: InsertFamilyGoal): Promise<FamilyGoal>;
  updateFamilyGoal(id: number, goal: Partial<InsertFamilyGoal>): Promise<FamilyGoal>;
  deleteFamilyGoal(id: number): Promise<void>;

  getFamilyIncome(): Promise<FamilyIncome[]>;
  getFamilyIncomeById(id: number): Promise<FamilyIncome | undefined>;
  createFamilyIncome(income: InsertFamilyIncome): Promise<FamilyIncome>;
  updateFamilyIncome(id: number, income: Partial<InsertFamilyIncome>): Promise<FamilyIncome>;
  deleteFamilyIncome(id: number): Promise<void>;

  getFamilyFinanceStats(): Promise<{
    monthlyIncome: number;
    monthlyExpenses: number;
    budgetUtilization: number;
    savingsRate: number;
    topExpenseCategories: Array<{categoryName: string; amount: number; percentage: number}>;
  }>;

  // Project Management methods
  getProjects(): Promise<Project[]>;
  getProjectById(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  // Project Tasks methods
  getProjectTasks(projectId: number): Promise<ProjectTask[]>;
  getProjectTaskById(id: number): Promise<ProjectTask | undefined>;
  createProjectTask(task: InsertProjectTask): Promise<ProjectTask>;
  updateProjectTask(id: number, task: Partial<InsertProjectTask>): Promise<ProjectTask>;
  deleteProjectTask(id: number): Promise<void>;

  // Project Budget Items methods
  getProjectBudgetItems(projectId: number): Promise<ProjectBudgetItem[]>;
  getProjectBudgetItemById(id: number): Promise<ProjectBudgetItem | undefined>;
  createProjectBudgetItem(item: InsertProjectBudgetItem): Promise<ProjectBudgetItem>;
  updateProjectBudgetItem(id: number, item: Partial<InsertProjectBudgetItem>): Promise<ProjectBudgetItem>;
  deleteProjectBudgetItem(id: number): Promise<void>;

  // Project Notes methods
  getProjectNotes(projectId: number): Promise<ProjectNote[]>;
  getProjectNoteById(id: number): Promise<ProjectNote | undefined>;
  createProjectNote(note: InsertProjectNote): Promise<ProjectNote>;
  updateProjectNote(id: number, note: Partial<InsertProjectNote>): Promise<ProjectNote>;
  deleteProjectNote(id: number): Promise<void>;

  // Project Comments methods
  getProjectComments(projectId: number): Promise<ProjectComment[]>;
  getProjectCommentById(id: number): Promise<ProjectComment | undefined>;
  createProjectComment(comment: InsertProjectComment): Promise<ProjectComment>;
  updateProjectComment(id: number, comment: Partial<InsertProjectComment>): Promise<ProjectComment>;
  deleteProjectComment(id: number): Promise<void>;

  // 付款規劃系統方法
  // Payment Projects methods
  getPaymentProjects(): Promise<PaymentProject[]>;
  getPaymentProjectById(id: number): Promise<PaymentProject | undefined>;
  createPaymentProject(project: InsertPaymentProject): Promise<PaymentProject>;
  updatePaymentProject(id: number, project: Partial<InsertPaymentProject>): Promise<PaymentProject>;

  // Payment Items methods
  getPaymentItems(filters?: {
    type?: string;
    projectId?: number;
    status?: string;
  }): Promise<PaymentItem[]>;
  getPaymentItemById(id: number): Promise<PaymentItem | undefined>;
  createPaymentItem(item: InsertPaymentItem): Promise<PaymentItem>;
  updatePaymentItem(id: number, item: Partial<InsertPaymentItem>): Promise<PaymentItem>;

  // Payment Records methods
  getPaymentRecords(itemId: number): Promise<PaymentRecord[]>;
  getAllPaymentRecords(): Promise<any[]>;
  createPaymentRecord(record: InsertPaymentRecord): Promise<PaymentRecord>;

  // Payment Tags methods
  getPaymentTags(): Promise<PaymentTag[]>;
  createPaymentTag(tag: InsertPaymentTag): Promise<PaymentTag>;

  // Reports and Statistics methods
  getMonthlyPaymentTrend(period: string): Promise<any[]>;
  getPaymentMethodStats(): Promise<any[]>;
  getTopCategoriesStats(): Promise<any[]>;

  // Budget Plans methods
  getBudgetPlans(filters?: {
    type?: string;
    projectId?: number;
  }): Promise<BudgetPlan[]>;
  createBudgetPlan(plan: InsertBudgetPlan): Promise<BudgetPlan>;

  // Statistics methods
  getHomePaymentStats(filters?: {
    month?: number;
    year?: number;
  }): Promise<{
    totalPlanned: number;
    totalPaid: number;
    totalPending: number;
    itemsByCategory: Array<{
      categoryName: string;
      totalAmount: number;
      paidAmount: number;
    }>;
  }>;

  getProjectPaymentStats(filters?: {
    projectId?: number;
    period?: string;
  }): Promise<{
    totalPlanned: number;
    totalPaid: number;
    totalPending: number;
    projectBreakdown: Array<{
      projectName: string;
      totalAmount: number;
      paidAmount: number;
    }>;
  }>;

  // 家用財務管理方法
  // Household Budget methods
  getHouseholdBudgets(month?: string): Promise<HouseholdBudget[]>;
  getHouseholdBudgetById(id: number): Promise<HouseholdBudget | undefined>;
  createHouseholdBudget(budget: InsertHouseholdBudget): Promise<HouseholdBudget>;
  updateHouseholdBudget(id: number, budget: Partial<InsertHouseholdBudget>): Promise<HouseholdBudget>;
  deleteHouseholdBudget(id: number): Promise<void>;

  // Household Expense methods
  getHouseholdExpenses(filters?: {
    month?: string;
    categoryId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<HouseholdExpense[]>;
  getHouseholdExpenseById(id: number): Promise<HouseholdExpense | undefined>;
  createHouseholdExpense(expense: InsertHouseholdExpense): Promise<HouseholdExpense>;
  updateHouseholdExpense(id: number, expense: Partial<InsertHouseholdExpense>): Promise<HouseholdExpense>;
  deleteHouseholdExpense(id: number): Promise<void>;

  // Household Finance Statistics
  getHouseholdMonthlyData(month: string): Promise<{
    budgets: HouseholdBudget[];
    expenses: HouseholdExpense[];
    summary: {
      totalBudget: number;
      totalExpenses: number;
      variance: number;
      categoryBreakdown: Array<{
        categoryId: number;
        categoryName: string;
        budgetAmount: number;
        actualAmount: number;
        variance: number;
      }>;
    };
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getCategories(): Promise<DebtCategory[]> {
    return await db.select().from(debtCategories).where(eq(debtCategories.isDeleted, false)).orderBy(desc(debtCategories.createdAt));
  }

  async getCategoryById(id: number): Promise<DebtCategory | undefined> {
    const [category] = await db.select().from(debtCategories).where(eq(debtCategories.id, id));
    return category || undefined;
  }

  async createCategory(category: InsertDebtCategory): Promise<DebtCategory> {
    const [newCategory] = await db.insert(debtCategories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: number, category: Partial<InsertDebtCategory>): Promise<DebtCategory> {
    const [updatedCategory] = await db.update(debtCategories)
      .set({ ...category, updatedAt: new Date() })
      .where(eq(debtCategories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.update(debtCategories)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(debtCategories.id, id));
  }

  // 階層分類支援方法
  async getCategoriesHierarchy(): Promise<any[]> {
    const allCategories = await db.select().from(debtCategories)
      .where(eq(debtCategories.isDeleted, false))
      .orderBy(debtCategories.level, debtCategories.categoryName);
    
    // 建立階層結構
    const mainCategories = allCategories.filter(cat => cat.level === 1);
    const subCategories = allCategories.filter(cat => cat.level === 2);
    
    return mainCategories.map(main => ({
      ...main,
      children: subCategories.filter(sub => sub.parentId === main.id)
    }));
  }

  async getMainCategories(): Promise<DebtCategory[]> {
    return await db.select().from(debtCategories)
      .where(and(
        eq(debtCategories.isDeleted, false),
        eq(debtCategories.level, 1)
      ))
      .orderBy(debtCategories.categoryName);
  }

  async getSubCategories(parentId: number): Promise<DebtCategory[]> {
    return await db.select().from(debtCategories)
      .where(and(
        eq(debtCategories.isDeleted, false),
        eq(debtCategories.parentId, parentId),
        eq(debtCategories.level, 2)
      ))
      .orderBy(debtCategories.categoryName);
  }

  async getVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors).where(eq(vendors.isDeleted, false)).orderBy(desc(vendors.createdAt));
  }

  async getVendorById(id: number): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor || undefined;
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [newVendor] = await db.insert(vendors).values(vendor).returning();
    return newVendor;
  }

  async updateVendor(id: number, vendor: Partial<InsertVendor>): Promise<Vendor> {
    const [updatedVendor] = await db.update(vendors)
      .set({ ...vendor, updatedAt: new Date() })
      .where(eq(vendors.id, id))
      .returning();
    return updatedVendor;
  }

  async deleteVendor(id: number): Promise<void> {
    await db.update(vendors)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(vendors.id, id));
  }

  async getDebts(): Promise<Debt[]> {
    return await db.select().from(debts).where(eq(debts.isDeleted, false)).orderBy(desc(debts.createdAt));
  }

  async getDebtById(id: number): Promise<Debt | undefined> {
    const [debt] = await db.select().from(debts).where(eq(debts.id, id));
    return debt || undefined;
  }

  async createDebt(debt: InsertDebt): Promise<Debt> {
    const [newDebt] = await db.insert(debts).values(debt).returning();
    return newDebt;
  }

  async updateDebt(id: number, debt: Partial<InsertDebt>): Promise<Debt> {
    const [updatedDebt] = await db.update(debts)
      .set({ ...debt, updatedAt: new Date() })
      .where(eq(debts.id, id))
      .returning();
    return updatedDebt;
  }

  async deleteDebt(id: number): Promise<void> {
    await db.update(debts)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(debts.id, id));
  }

  async getDebtsByCategory(categoryId: number): Promise<Debt[]> {
    return await db.select().from(debts)
      .where(and(eq(debts.categoryId, categoryId), eq(debts.isDeleted, false)))
      .orderBy(desc(debts.createdAt));
  }

  async getDebtsByVendor(vendorId: number): Promise<Debt[]> {
    return await db.select().from(debts)
      .where(and(eq(debts.vendorId, vendorId), eq(debts.isDeleted, false)))
      .orderBy(desc(debts.createdAt));
  }

  async getPayments(): Promise<DebtPayment[]> {
    return await db.select().from(debtPayments).orderBy(desc(debtPayments.paymentDate));
  }

  async getPaymentById(id: number): Promise<DebtPayment | undefined> {
    const [payment] = await db.select().from(debtPayments).where(eq(debtPayments.id, id));
    return payment || undefined;
  }

  async createPayment(payment: InsertDebtPayment): Promise<DebtPayment> {
    const [newPayment] = await db.insert(debtPayments).values(payment).returning();
    
    // Update debt paid amount and status
    const debt = await this.getDebtById(payment.debtId);
    if (debt) {
      const currentPaid = parseFloat(debt.paidAmount || "0");
      const newPaidAmount = currentPaid + parseFloat(payment.amountPaid);
      const totalAmount = parseFloat(debt.totalAmount);
      
      let status = "pending";
      if (newPaidAmount >= totalAmount) {
        status = "paid";
      } else if (newPaidAmount > 0) {
        status = "partial";
      }
      
      await db.update(debts)
        .set({ 
          paidAmount: newPaidAmount.toString(),
          status,
          updatedAt: new Date()
        })
        .where(eq(debts.id, payment.debtId));
    }
    
    return newPayment;
  }

  async updatePayment(id: number, payment: Partial<InsertDebtPayment>): Promise<DebtPayment> {
    const [updatedPayment] = await db.update(debtPayments)
      .set({ ...payment, updatedAt: new Date() })
      .where(eq(debtPayments.id, id))
      .returning();
    return updatedPayment;
  }

  async deletePayment(id: number): Promise<void> {
    await db.delete(debtPayments).where(eq(debtPayments.id, id));
  }

  async getPaymentsByDebt(debtId: number): Promise<DebtPayment[]> {
    return await db.select().from(debtPayments)
      .where(eq(debtPayments.debtId, debtId))
      .orderBy(desc(debtPayments.paymentDate));
  }

  async getMonthlyStats(): Promise<{
    monthlyIncome: number;
    monthlyExpense: number;
    netBalance: number;
    totalRecords: number;
  }> {
    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    // Get income from daily records
    const incomeResult = await db.select({
      total: sum(dailyRecords.price)
    }).from(dailyRecords)
      .where(and(
        eq(dailyRecords.recordType, "income"),
        gte(dailyRecords.recordDate, startOfMonth.toISOString().split('T')[0]),
        lte(dailyRecords.recordDate, endOfMonth.toISOString().split('T')[0])
      ));

    // Get expenses from daily records
    const expenseResult = await db.select({
      total: sum(dailyRecords.price)
    }).from(dailyRecords)
      .where(and(
        eq(dailyRecords.recordType, "expense"),
        gte(dailyRecords.recordDate, startOfMonth.toISOString().split('T')[0]),
        lte(dailyRecords.recordDate, endOfMonth.toISOString().split('T')[0])
      ));

    // Get total records count
    const recordsResult = await db.select({
      count: sql<number>`count(*)`
    }).from(dailyRecords);

    const monthlyIncome = parseFloat(incomeResult[0]?.total || "0");
    const monthlyExpense = parseFloat(expenseResult[0]?.total || "0");
    const netBalance = monthlyIncome - monthlyExpense;
    const totalRecords = recordsResult[0]?.count || 0;

    return {
      monthlyIncome,
      monthlyExpense,
      netBalance,
      totalRecords,
    };
  }

  async getDebtStats(): Promise<{
    thisMonthDue: number;
    thisMonthPaid: number;
    thisMonthUnpaid: number;
    priorUnpaid: number;
    totalUnpaid: number;
  }> {
    const currentDate = new Date();
    const thisMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const thisMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const thisMonthStartStr = thisMonthStart.toISOString().split('T')[0];
    const thisMonthEndStr = thisMonthEnd.toISOString().split('T')[0];

    // 獲取所有真實債務記錄
    const allDebts = await db.select().from(debts).where(eq(debts.isDeleted, false));
    const allPayments = await db.select().from(debtPayments);

    // 計算本月應付金額 - 6月份到期的所有債務
    let thisMonthDue = 0;
    let priorDue = 0;
    let priorPaidTotal = 0;

    for (const debt of allDebts) {
      const dueDate = new Date(debt.firstDueDate);
      const totalAmount = parseFloat(debt.totalAmount);
      const paidAmount = parseFloat(debt.paidAmount);
      
      if (dueDate >= thisMonthStart && dueDate <= thisMonthEnd) {
        thisMonthDue += totalAmount;
      } else if (dueDate < thisMonthStart) {
        // 本月之前到期的債務
        priorDue += totalAmount;
        // 本月之前已付的金額（通過debt.paidAmount和status=paid來判斷）
        if (debt.status === "paid") {
          priorPaidTotal += totalAmount;
        } else {
          priorPaidTotal += paidAmount;
        }
      }
    }

    // 計算本月已付金額
    const [thisMonthPaidResult] = await db.select({
      total: sum(debtPayments.amountPaid)
    }).from(debtPayments)
      .where(and(
        gte(debtPayments.paymentDate, thisMonthStartStr),
        lte(debtPayments.paymentDate, thisMonthEndStr)
      ));

    const thisMonthPaid = parseFloat(thisMonthPaidResult?.total || "0");

    // 計算本月未付和本月之前未付
    const thisMonthUnpaid = Math.max(0, thisMonthDue - thisMonthPaid);
    const priorUnpaid = Math.max(0, priorDue - priorPaidTotal);
    const totalUnpaid = thisMonthUnpaid + priorUnpaid;

    return {
      thisMonthDue,
      thisMonthPaid,
      thisMonthUnpaid,
      priorUnpaid,
      totalUnpaid,
    };
  }

  async getMigrationStatus(): Promise<{
    debtsCount: number;
    categoriesCount: number;
    vendorsCount: number;
    paymentsCount: number;
  }> {
    const [debtsResult] = await db.select({
      count: sql<number>`count(*)`
    }).from(debts).where(eq(debts.isDeleted, false));

    const [categoriesResult] = await db.select({
      count: sql<number>`count(*)`
    }).from(debtCategories).where(eq(debtCategories.isDeleted, false));

    const [vendorsResult] = await db.select({
      count: sql<number>`count(*)`
    }).from(vendors).where(eq(vendors.isDeleted, false));

    const [paymentsResult] = await db.select({
      count: sql<number>`count(*)`
    }).from(debtPayments);

    return {
      debtsCount: debtsResult?.count || 0,
      categoriesCount: categoriesResult?.count || 0,
      vendorsCount: vendorsResult?.count || 0,
      paymentsCount: paymentsResult?.count || 0,
    };
  }

  // Family Member methods
  async getFamilyMembers(): Promise<FamilyMember[]> {
    return await db.select().from(familyMembers).where(eq(familyMembers.isActive, true)).orderBy(desc(familyMembers.createdAt));
  }

  async getFamilyMemberById(id: number): Promise<FamilyMember | undefined> {
    const [member] = await db.select().from(familyMembers).where(eq(familyMembers.id, id));
    return member || undefined;
  }

  async createFamilyMember(member: InsertFamilyMember): Promise<FamilyMember> {
    const [newMember] = await db.insert(familyMembers).values(member).returning();
    return newMember;
  }

  async updateFamilyMember(id: number, member: Partial<InsertFamilyMember>): Promise<FamilyMember> {
    const [updatedMember] = await db.update(familyMembers).set(member).where(eq(familyMembers.id, id)).returning();
    return updatedMember;
  }

  async deleteFamilyMember(id: number): Promise<void> {
    await db.update(familyMembers).set({ isActive: false }).where(eq(familyMembers.id, id));
  }

  // Kids Wishlist methods
  async getKidsWishlist(childId?: number): Promise<KidsWishlist[]> {
    const query = db.select().from(kidsWishlist);
    if (childId) {
      return await query.where(eq(kidsWishlist.childId, childId)).orderBy(desc(kidsWishlist.createdAt));
    }
    return await query.orderBy(desc(kidsWishlist.createdAt));
  }

  async getKidsWishlistById(id: number): Promise<KidsWishlist | undefined> {
    const [item] = await db.select().from(kidsWishlist).where(eq(kidsWishlist.id, id));
    return item || undefined;
  }

  async createKidsWishlist(wishlist: InsertKidsWishlist): Promise<KidsWishlist> {
    const [newItem] = await db.insert(kidsWishlist).values(wishlist).returning();
    return newItem;
  }

  async updateKidsWishlist(id: number, wishlist: Partial<InsertKidsWishlist>): Promise<KidsWishlist> {
    const [updatedItem] = await db.update(kidsWishlist).set(wishlist).where(eq(kidsWishlist.id, id)).returning();
    return updatedItem;
  }

  async deleteKidsWishlist(id: number): Promise<void> {
    await db.delete(kidsWishlist).where(eq(kidsWishlist.id, id));
  }

  // Kids Savings methods
  async getKidsSavings(childId?: number): Promise<KidsSaving[]> {
    const query = db.select().from(kidsSavings);
    if (childId) {
      return await query.where(eq(kidsSavings.childId, childId)).orderBy(desc(kidsSavings.createdAt));
    }
    return await query.orderBy(desc(kidsSavings.createdAt));
  }

  async getKidsSavingsById(id: number): Promise<KidsSaving | undefined> {
    const [saving] = await db.select().from(kidsSavings).where(eq(kidsSavings.id, id));
    return saving || undefined;
  }

  async createKidsSavings(savings: InsertKidsSaving): Promise<KidsSaving> {
    const [newSaving] = await db.insert(kidsSavings).values(savings).returning();
    return newSaving;
  }

  async updateKidsSavings(id: number, savings: Partial<InsertKidsSaving>): Promise<KidsSaving> {
    const [updatedSaving] = await db.update(kidsSavings).set(savings).where(eq(kidsSavings.id, id)).returning();
    return updatedSaving;
  }

  async deleteKidsSavings(id: number): Promise<void> {
    await db.delete(kidsSavings).where(eq(kidsSavings.id, id));
  }

  // Kids Loans methods
  async getKidsLoans(childId?: number): Promise<KidsLoan[]> {
    const query = db.select().from(kidsLoans);
    if (childId) {
      return await query.where(eq(kidsLoans.childId, childId)).orderBy(desc(kidsLoans.createdAt));
    }
    return await query.orderBy(desc(kidsLoans.createdAt));
  }

  async getKidsLoansById(id: number): Promise<KidsLoan | undefined> {
    const [loan] = await db.select().from(kidsLoans).where(eq(kidsLoans.id, id));
    return loan || undefined;
  }

  async createKidsLoans(loan: InsertKidsLoan): Promise<KidsLoan> {
    const [newLoan] = await db.insert(kidsLoans).values(loan).returning();
    return newLoan;
  }

  async updateKidsLoans(id: number, loan: Partial<InsertKidsLoan>): Promise<KidsLoan> {
    const [updatedLoan] = await db.update(kidsLoans).set(loan).where(eq(kidsLoans.id, id)).returning();
    return updatedLoan;
  }

  async deleteKidsLoans(id: number): Promise<void> {
    await db.delete(kidsLoans).where(eq(kidsLoans.id, id));
  }

  // Kids Schedule methods
  async getKidsSchedule(childId?: number): Promise<KidsSchedule[]> {
    const query = db.select().from(kidsSchedule);
    if (childId) {
      return await query.where(eq(kidsSchedule.childId, childId)).orderBy(desc(kidsSchedule.createdAt));
    }
    return await query.orderBy(desc(kidsSchedule.createdAt));
  }

  async getKidsScheduleById(id: number): Promise<KidsSchedule | undefined> {
    const [schedule] = await db.select().from(kidsSchedule).where(eq(kidsSchedule.id, id));
    return schedule || undefined;
  }

  async createKidsSchedule(schedule: InsertKidsSchedule): Promise<KidsSchedule> {
    const [newSchedule] = await db.insert(kidsSchedule).values(schedule).returning();
    return newSchedule;
  }

  async updateKidsSchedule(id: number, schedule: Partial<InsertKidsSchedule>): Promise<KidsSchedule> {
    const [updatedSchedule] = await db.update(kidsSchedule).set(schedule).where(eq(kidsSchedule.id, id)).returning();
    return updatedSchedule;
  }

  async deleteKidsSchedule(id: number): Promise<void> {
    await db.delete(kidsSchedule).where(eq(kidsSchedule.id, id));
  }

  // Parent Management - Allowance methods
  async getAllowanceSettings(parentId: number): Promise<AllowanceManagement[]> {
    return await db.select().from(allowanceManagement).where(eq(allowanceManagement.parentId, parentId));
  }

  async getAllowanceSettingById(id: number): Promise<AllowanceManagement | undefined> {
    const [allowance] = await db.select().from(allowanceManagement).where(eq(allowanceManagement.id, id));
    return allowance;
  }

  async createAllowanceSetting(allowance: InsertAllowanceManagement): Promise<AllowanceManagement> {
    const [newAllowance] = await db.insert(allowanceManagement).values(allowance).returning();
    return newAllowance;
  }

  async updateAllowanceSetting(id: number, allowance: Partial<InsertAllowanceManagement>): Promise<AllowanceManagement> {
    const [updatedAllowance] = await db.update(allowanceManagement).set(allowance).where(eq(allowanceManagement.id, id)).returning();
    return updatedAllowance;
  }

  async deleteAllowanceSetting(id: number): Promise<void> {
    await db.delete(allowanceManagement).where(eq(allowanceManagement.id, id));
  }

  // Allowance Payment methods
  async getAllowancePayments(childId?: number): Promise<AllowancePayment[]> {
    if (childId) {
      return await db.select().from(allowancePayments).where(eq(allowancePayments.childId, childId));
    }
    return await db.select().from(allowancePayments);
  }

  async createAllowancePayment(payment: InsertAllowancePayment): Promise<AllowancePayment> {
    const [newPayment] = await db.insert(allowancePayments).values(payment).returning();
    return newPayment;
  }

  // Loan Request methods
  async getLoanRequests(childId?: number, parentId?: number): Promise<LoanRequest[]> {
    let query = db.select().from(loanRequests);
    
    if (childId && parentId) {
      return await query.where(and(eq(loanRequests.childId, childId), eq(loanRequests.parentId, parentId)));
    } else if (childId) {
      return await query.where(eq(loanRequests.childId, childId));
    } else if (parentId) {
      return await query.where(eq(loanRequests.parentId, parentId));
    }
    
    return await query;
  }

  async getLoanRequestById(id: number): Promise<LoanRequest | undefined> {
    const [loanRequest] = await db.select().from(loanRequests).where(eq(loanRequests.id, id));
    return loanRequest;
  }

  async createLoanRequest(loanRequest: InsertLoanRequest): Promise<LoanRequest> {
    const [newLoanRequest] = await db.insert(loanRequests).values(loanRequest).returning();
    return newLoanRequest;
  }

  async updateLoanRequest(id: number, loanRequest: Partial<InsertLoanRequest>): Promise<LoanRequest> {
    const [updatedLoanRequest] = await db.update(loanRequests).set(loanRequest).where(eq(loanRequests.id, id)).returning();
    return updatedLoanRequest;
  }

  async deleteLoanRequest(id: number): Promise<void> {
    await db.delete(loanRequests).where(eq(loanRequests.id, id));
  }

  // Achievement methods
  async getAchievements(): Promise<Achievement[]> {
    return await db.select().from(achievements).where(eq(achievements.isActive, true));
  }

  async getAchievementById(id: number): Promise<Achievement | undefined> {
    const [achievement] = await db.select().from(achievements).where(eq(achievements.id, id));
    return achievement;
  }

  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const [newAchievement] = await db.insert(achievements).values(achievement).returning();
    return newAchievement;
  }

  async updateAchievement(id: number, achievement: Partial<InsertAchievement>): Promise<Achievement> {
    const [updatedAchievement] = await db.update(achievements).set(achievement).where(eq(achievements.id, id)).returning();
    return updatedAchievement;
  }

  // Kids Achievement methods
  async getKidsAchievements(childId?: number): Promise<KidsAchievement[]> {
    if (childId) {
      return await db.select().from(kidsAchievements).where(eq(kidsAchievements.childId, childId));
    }
    return await db.select().from(kidsAchievements);
  }

  async createKidsAchievement(kidsAchievement: InsertKidsAchievement): Promise<KidsAchievement> {
    const [newKidsAchievement] = await db.insert(kidsAchievements).values(kidsAchievement).returning();
    return newKidsAchievement;
  }

  // Parent Approval methods
  async getParentApprovals(parentId?: number, childId?: number): Promise<ParentApproval[]> {
    let query = db.select().from(parentApprovals);
    
    if (parentId && childId) {
      return await query.where(and(eq(parentApprovals.parentId, parentId), eq(parentApprovals.childId, childId)));
    } else if (parentId) {
      return await query.where(eq(parentApprovals.parentId, parentId));
    } else if (childId) {
      return await query.where(eq(parentApprovals.childId, childId));
    }
    
    return await query;
  }

  async createParentApproval(approval: InsertParentApproval): Promise<ParentApproval> {
    const [newApproval] = await db.insert(parentApprovals).values(approval).returning();
    return newApproval;
  }

  async updateParentApproval(id: number, approval: Partial<InsertParentApproval>): Promise<ParentApproval> {
    const [updatedApproval] = await db.update(parentApprovals).set(approval).where(eq(parentApprovals.id, id)).returning();
    return updatedApproval;
  }

  // Dashboard stats for parents
  async getParentDashboardStats(parentId: number): Promise<{
    totalChildren: number;
    pendingApprovals: number;
    thisMonthAllowances: number;
    activeLoanRequests: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Count children managed by this parent
    const children = await db.select().from(familyMembers).where(eq(familyMembers.memberType, 'child'));
    const totalChildren = children.length;

    // Count pending approvals
    const pendingApprovals = await db.select({ count: count() })
      .from(parentApprovals)
      .where(and(
        eq(parentApprovals.parentId, parentId),
        eq(parentApprovals.action, 'pending')
      ));

    // Count this month's allowances
    const thisMonthAllowances = await db.select({ total: sum(allowancePayments.amount) })
      .from(allowancePayments)
      .where(and(
        eq(allowancePayments.parentId, parentId),
        gte(allowancePayments.paymentDate, startOfMonth)
      ));

    // Count active loan requests
    const activeLoanRequests = await db.select({ count: count() })
      .from(loanRequests)
      .where(and(
        eq(loanRequests.parentId, parentId),
        inArray(loanRequests.status, ['pending', 'approved'])
      ));

    return {
      totalChildren,
      pendingApprovals: pendingApprovals[0]?.count || 0,
      thisMonthAllowances: Number(thisMonthAllowances[0]?.total || 0),
      activeLoanRequests: activeLoanRequests[0]?.count || 0,
    };
  }

  // Additional missing methods
  async getDebtPayments(debtId: number): Promise<DebtPayment[]> {
    return await this.getPaymentsByDebt(debtId);
  }

  async createDebtPayment(payment: InsertDebtPayment): Promise<DebtPayment> {
    return await this.createPayment(payment);
  }

  async getAllPayments(): Promise<DebtPayment[]> {
    return await this.getPayments();
  }

  async getDailyRecords(): Promise<DailyRecord[]> {
    return await db.select().from(dailyRecords).orderBy(desc(dailyRecords.recordDate));
  }

  async getStatistics(): Promise<any> {
    const debtStats = await this.getDebtStats();
    const monthlyStats = await this.getMonthlyStats();
    return {
      ...debtStats,
      ...monthlyStats
    };
  }

  async createKidsSaving(saving: InsertKidsSaving): Promise<KidsSaving> {
    return await this.createKidsSavings(saving);
  }

  async createKidsLoan(loan: InsertKidsLoan): Promise<KidsLoan> {
    return await this.createKidsLoans(loan);
  }

  // Child Account methods - 兒童個別登入系統實現
  async getChildAccounts(): Promise<any[]> {
    const accounts = await db.select({
      id: childAccounts.id,
      childId: childAccounts.childId,
      username: childAccounts.username,
      isActive: childAccounts.isActive,
      childName: familyMembers.name,
      childAge: familyMembers.age,
      avatarUrl: familyMembers.avatar,
      memberType: familyMembers.memberType
    })
    .from(childAccounts)
    .innerJoin(familyMembers, eq(childAccounts.childId, familyMembers.id))
    .where(and(
      eq(childAccounts.isActive, true),
      eq(familyMembers.memberType, 'child')
    ));
    
    return accounts;
  }

  async getChildAccountByChildId(childId: number): Promise<any | undefined> {
    const [account] = await db.select()
      .from(childAccounts)
      .where(and(
        eq(childAccounts.childId, childId),
        eq(childAccounts.isActive, true)
      ));
    return account;
  }

  async createChildAccount(account: any): Promise<any> {
    const [newAccount] = await db.insert(childAccounts)
      .values(account)
      .returning();
    return newAccount;
  }

  async authenticateChild(childId: number, pinCode: string): Promise<any | null> {
    const [account] = await db.select()
      .from(childAccounts)
      .where(and(
        eq(childAccounts.childId, childId),
        eq(childAccounts.pinCode, pinCode),
        eq(childAccounts.isActive, true),
        eq(childAccounts.isLocked, false)
      ));

    if (!account) {
      // 增加登入失敗次數
      await db.update(childAccounts)
        .set({ 
          loginAttempts: sql`${childAccounts.loginAttempts} + 1`,
          updatedAt: new Date()
        })
        .where(eq(childAccounts.childId, childId));

      // 檢查是否需要鎖定帳戶（超過5次失敗）
      const [updatedAccount] = await db.select()
        .from(childAccounts)
        .where(eq(childAccounts.childId, childId));
      
      if (updatedAccount && updatedAccount.loginAttempts >= 5) {
        await db.update(childAccounts)
          .set({ isLocked: true, updatedAt: new Date() })
          .where(eq(childAccounts.childId, childId));
      }
      
      return null;
    }

    // 登入成功，重置失敗次數並更新最後登入時間
    await db.update(childAccounts)
      .set({ 
        loginAttempts: 0,
        lastLoginAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(childAccounts.id, account.id));

    return account;
  }

  async updateChildSession(accountId: number, sessionToken: string, expiresAt: Date): Promise<void> {
    await db.update(childAccounts)
      .set({ 
        sessionToken,
        sessionExpiresAt: expiresAt,
        updatedAt: new Date()
      })
      .where(eq(childAccounts.id, accountId));
  }

  async validateChildSession(sessionToken: string): Promise<any | null> {
    const [account] = await db.select({
      id: childAccounts.id,
      childId: childAccounts.childId,
      sessionToken: childAccounts.sessionToken,
      sessionExpiresAt: childAccounts.sessionExpiresAt,
      childName: familyMembers.name,
      childAge: familyMembers.age
    })
    .from(childAccounts)
    .innerJoin(familyMembers, eq(childAccounts.childId, familyMembers.id))
    .where(and(
      eq(childAccounts.sessionToken, sessionToken),
      eq(childAccounts.isActive, true),
      sql`${childAccounts.sessionExpiresAt} > NOW()`
    ));

    return account || null;
  }

  async updateChildPin(childId: number, newPinCode: string): Promise<boolean> {
    try {
      const result = await db.update(childAccounts)
        .set({ 
          pinCode: newPinCode,
          loginAttempts: 0,
          isLocked: false,
          updatedAt: new Date()
        })
        .where(and(
          eq(childAccounts.childId, childId),
          eq(childAccounts.isActive, true)
        ));

      return true;
    } catch (error) {
      console.error("Error updating child PIN:", error);
      return false;
    }
  }

  async unlockChildAccount(childId: number): Promise<boolean> {
    try {
      const result = await db.update(childAccounts)
        .set({ 
          loginAttempts: 0,
          isLocked: false,
          updatedAt: new Date()
        })
        .where(and(
          eq(childAccounts.childId, childId),
          eq(childAccounts.isActive, true)
        ));

      return true;
    } catch (error) {
      console.error("Error unlocking child account:", error);
      return false;
    }
  }

  // Family Finance implementation
  async getFamilyExpenseCategories(): Promise<FamilyExpenseCategory[]> {
    return await db.select().from(familyExpenseCategories).where(eq(familyExpenseCategories.isActive, true));
  }

  async getFamilyExpenseCategoryById(id: number): Promise<FamilyExpenseCategory | undefined> {
    const [category] = await db.select().from(familyExpenseCategories).where(eq(familyExpenseCategories.id, id));
    return category;
  }

  async createFamilyExpenseCategory(category: InsertFamilyExpenseCategory): Promise<FamilyExpenseCategory> {
    const [newCategory] = await db.insert(familyExpenseCategories).values(category).returning();
    return newCategory;
  }

  async updateFamilyExpenseCategory(id: number, category: Partial<InsertFamilyExpenseCategory>): Promise<FamilyExpenseCategory> {
    const [updatedCategory] = await db.update(familyExpenseCategories)
      .set(category)
      .where(eq(familyExpenseCategories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteFamilyExpenseCategory(id: number): Promise<void> {
    await db.update(familyExpenseCategories)
      .set({ isActive: false })
      .where(eq(familyExpenseCategories.id, id));
  }

  async getFamilyExpenses(): Promise<FamilyExpense[]> {
    return await db.select().from(familyExpenses).where(eq(familyExpenses.isDeleted, false));
  }

  async getFamilyExpenseById(id: number): Promise<FamilyExpense | undefined> {
    const [expense] = await db.select().from(familyExpenses).where(eq(familyExpenses.id, id));
    return expense;
  }

  async createFamilyExpense(expense: InsertFamilyExpense): Promise<FamilyExpense> {
    const [newExpense] = await db.insert(familyExpenses).values(expense).returning();
    return newExpense;
  }

  async updateFamilyExpense(id: number, expense: Partial<InsertFamilyExpense>): Promise<FamilyExpense> {
    const [updatedExpense] = await db.update(familyExpenses)
      .set(expense)
      .where(eq(familyExpenses.id, id))
      .returning();
    return updatedExpense;
  }

  async deleteFamilyExpense(id: number): Promise<void> {
    await db.update(familyExpenses)
      .set({ isDeleted: true })
      .where(eq(familyExpenses.id, id));
  }

  async getFamilyBudgets(): Promise<FamilyBudget[]> {
    return await db.select().from(familyBudgets).where(eq(familyBudgets.isActive, true));
  }

  async getFamilyBudgetById(id: number): Promise<FamilyBudget | undefined> {
    const [budget] = await db.select().from(familyBudgets).where(eq(familyBudgets.id, id));
    return budget;
  }

  async createFamilyBudget(budget: InsertFamilyBudget): Promise<FamilyBudget> {
    const [newBudget] = await db.insert(familyBudgets).values(budget).returning();
    return newBudget;
  }

  async updateFamilyBudget(id: number, budget: Partial<InsertFamilyBudget>): Promise<FamilyBudget> {
    const [updatedBudget] = await db.update(familyBudgets)
      .set(budget)
      .where(eq(familyBudgets.id, id))
      .returning();
    return updatedBudget;
  }

  async deleteFamilyBudget(id: number): Promise<void> {
    await db.update(familyBudgets)
      .set({ isActive: false })
      .where(eq(familyBudgets.id, id));
  }

  async getFamilyGoals(): Promise<FamilyGoal[]> {
    return await db.select().from(familyGoals).where(ne(familyGoals.status, 'cancelled'));
  }

  async getFamilyGoalById(id: number): Promise<FamilyGoal | undefined> {
    const [goal] = await db.select().from(familyGoals).where(eq(familyGoals.id, id));
    return goal;
  }

  async createFamilyGoal(goal: InsertFamilyGoal): Promise<FamilyGoal> {
    const [newGoal] = await db.insert(familyGoals).values(goal).returning();
    return newGoal;
  }

  async updateFamilyGoal(id: number, goal: Partial<InsertFamilyGoal>): Promise<FamilyGoal> {
    const [updatedGoal] = await db.update(familyGoals)
      .set(goal)
      .where(eq(familyGoals.id, id))
      .returning();
    return updatedGoal;
  }

  async deleteFamilyGoal(id: number): Promise<void> {
    await db.update(familyGoals)
      .set({ status: 'cancelled' })
      .where(eq(familyGoals.id, id));
  }

  async getFamilyIncome(): Promise<FamilyIncome[]> {
    return await db.select().from(familyIncome).where(eq(familyIncome.isDeleted, false));
  }

  async getFamilyIncomeById(id: number): Promise<FamilyIncome | undefined> {
    const [income] = await db.select().from(familyIncome).where(eq(familyIncome.id, id));
    return income;
  }

  async createFamilyIncome(income: InsertFamilyIncome): Promise<FamilyIncome> {
    const [newIncome] = await db.insert(familyIncome).values(income).returning();
    return newIncome;
  }

  async updateFamilyIncome(id: number, income: Partial<InsertFamilyIncome>): Promise<FamilyIncome> {
    const [updatedIncome] = await db.update(familyIncome)
      .set(income)
      .where(eq(familyIncome.id, id))
      .returning();
    return updatedIncome;
  }

  async deleteFamilyIncome(id: number): Promise<void> {
    await db.update(familyIncome)
      .set({ isDeleted: true })
      .where(eq(familyIncome.id, id));
  }

  async getFamilyFinanceStats(): Promise<{
    monthlyIncome: number;
    monthlyExpenses: number;
    budgetUtilization: number;
    savingsRate: number;
    topExpenseCategories: Array<{categoryName: string; amount: number; percentage: number}>;
  }> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 計算月收入
    const monthlyIncomeResult = await db.select({
      total: sql<number>`sum(${familyIncome.netAmount})`
    }).from(familyIncome)
      .where(
        and(
          gte(familyIncome.incomeDate, firstDayOfMonth.toISOString().split('T')[0]),
          lte(familyIncome.incomeDate, lastDayOfMonth.toISOString().split('T')[0]),
          eq(familyIncome.isDeleted, false)
        )
      );

    // 計算月支出
    const monthlyExpensesResult = await db.select({
      total: sql<number>`sum(${familyExpenses.amount})`
    }).from(familyExpenses)
      .where(
        and(
          gte(familyExpenses.expenseDate, firstDayOfMonth.toISOString().split('T')[0]),
          lte(familyExpenses.expenseDate, lastDayOfMonth.toISOString().split('T')[0]),
          eq(familyExpenses.isDeleted, false)
        )
      );

    const monthlyIncomeTotal = monthlyIncomeResult[0]?.total || 0;
    const monthlyExpensesTotal = monthlyExpensesResult[0]?.total || 0;
    const savingsRate = monthlyIncomeTotal > 0 ? ((monthlyIncomeTotal - monthlyExpensesTotal) / monthlyIncomeTotal) * 100 : 0;

    return {
      monthlyIncome: monthlyIncomeTotal,
      monthlyExpenses: monthlyExpensesTotal,
      budgetUtilization: 75, // 預設值
      savingsRate,
      topExpenseCategories: [] // 預設空陣列
    };
  }

  // Project Management Methods Implementation
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProjectById(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project> {
    const [updatedProject] = await db.update(projects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Project Tasks Methods
  async getProjectTasks(projectId: number): Promise<ProjectTask[]> {
    return await db.select().from(projectTasks)
      .where(eq(projectTasks.projectId, projectId))
      .orderBy(desc(projectTasks.createdAt));
  }

  async getProjectTaskById(id: number): Promise<ProjectTask | undefined> {
    const [task] = await db.select().from(projectTasks).where(eq(projectTasks.id, id));
    return task || undefined;
  }

  async createProjectTask(task: InsertProjectTask): Promise<ProjectTask> {
    const [newTask] = await db.insert(projectTasks).values(task).returning();
    return newTask;
  }

  async updateProjectTask(id: number, task: Partial<InsertProjectTask>): Promise<ProjectTask> {
    const [updatedTask] = await db.update(projectTasks)
      .set({ ...task, updatedAt: new Date() })
      .where(eq(projectTasks.id, id))
      .returning();
    return updatedTask;
  }

  async deleteProjectTask(id: number): Promise<void> {
    await db.delete(projectTasks).where(eq(projectTasks.id, id));
  }

  // Project Budget Items Methods
  async getProjectBudgetItems(projectId: number): Promise<ProjectBudgetItem[]> {
    return await db.select().from(projectBudgetItems)
      .where(eq(projectBudgetItems.projectId, projectId))
      .orderBy(desc(projectBudgetItems.createdAt));
  }

  async getProjectBudgetItemById(id: number): Promise<ProjectBudgetItem | undefined> {
    const [item] = await db.select().from(projectBudgetItems).where(eq(projectBudgetItems.id, id));
    return item || undefined;
  }

  async createProjectBudgetItem(item: InsertProjectBudgetItem): Promise<ProjectBudgetItem> {
    const [newItem] = await db.insert(projectBudgetItems).values(item).returning();
    return newItem;
  }

  async updateProjectBudgetItem(id: number, item: Partial<InsertProjectBudgetItem>): Promise<ProjectBudgetItem> {
    const [updatedItem] = await db.update(projectBudgetItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(projectBudgetItems.id, id))
      .returning();
    return updatedItem;
  }

  async deleteProjectBudgetItem(id: number): Promise<void> {
    await db.delete(projectBudgetItems).where(eq(projectBudgetItems.id, id));
  }

  // Project Notes Methods
  async getProjectNotes(projectId: number): Promise<ProjectNote[]> {
    return await db.select().from(projectNotes)
      .where(eq(projectNotes.projectId, projectId))
      .orderBy(desc(projectNotes.createdAt));
  }

  async getProjectNoteById(id: number): Promise<ProjectNote | undefined> {
    const [note] = await db.select().from(projectNotes).where(eq(projectNotes.id, id));
    return note || undefined;
  }

  async createProjectNote(note: InsertProjectNote): Promise<ProjectNote> {
    const [newNote] = await db.insert(projectNotes).values(note).returning();
    return newNote;
  }

  async updateProjectNote(id: number, note: Partial<InsertProjectNote>): Promise<ProjectNote> {
    const [updatedNote] = await db.update(projectNotes)
      .set({ ...note, updatedAt: new Date() })
      .where(eq(projectNotes.id, id))
      .returning();
    return updatedNote;
  }

  async deleteProjectNote(id: number): Promise<void> {
    await db.delete(projectNotes).where(eq(projectNotes.id, id));
  }

  // Project Comments Methods
  async getProjectComments(projectId: number): Promise<ProjectComment[]> {
    return await db.select().from(projectComments)
      .where(eq(projectComments.projectId, projectId))
      .orderBy(desc(projectComments.createdAt));
  }

  async getProjectCommentById(id: number): Promise<ProjectComment | undefined> {
    const [comment] = await db.select().from(projectComments).where(eq(projectComments.id, id));
    return comment || undefined;
  }

  async createProjectComment(comment: InsertProjectComment): Promise<ProjectComment> {
    const [newComment] = await db.insert(projectComments).values(comment).returning();
    return newComment;
  }

  async updateProjectComment(id: number, comment: Partial<InsertProjectComment>): Promise<ProjectComment> {
    const [updatedComment] = await db.update(projectComments)
      .set({ ...comment, updatedAt: new Date() })
      .where(eq(projectComments.id, id))
      .returning();
    return updatedComment;
  }

  async deleteProjectComment(id: number): Promise<void> {
    await db.delete(projectComments).where(eq(projectComments.id, id));
  }

  // 付款規劃系統方法實現
  // Payment Projects Methods
  async getPaymentProjects(): Promise<PaymentProject[]> {
    return await db.select().from(paymentProjects)
      .where(eq(paymentProjects.isDeleted, false))
      .orderBy(desc(paymentProjects.createdAt));
  }

  async getPaymentProjectById(id: number): Promise<PaymentProject | undefined> {
    const [project] = await db.select().from(paymentProjects).where(eq(paymentProjects.id, id));
    return project || undefined;
  }

  async createPaymentProject(project: InsertPaymentProject): Promise<PaymentProject> {
    const [newProject] = await db.insert(paymentProjects).values(project).returning();
    return newProject;
  }

  async updatePaymentProject(id: number, project: Partial<InsertPaymentProject>): Promise<PaymentProject> {
    const [updatedProject] = await db.update(paymentProjects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(paymentProjects.id, id))
      .returning();
    return updatedProject;
  }

  // Payment Items Methods
  async getPaymentItems(filters?: {
    type?: string;
    projectId?: number;
    status?: string;
  }): Promise<PaymentItem[]> {
    let conditions = [eq(paymentItems.isDeleted, false)];

    if (filters?.type) {
      conditions.push(eq(paymentItems.itemType, filters.type));
    }
    if (filters?.projectId) {
      conditions.push(eq(paymentItems.projectId, filters.projectId));
    }
    if (filters?.status) {
      conditions.push(eq(paymentItems.status, filters.status));
    }

    return await db.select().from(paymentItems)
      .where(and(...conditions))
      .orderBy(desc(paymentItems.createdAt));
  }

  async getPaymentItemById(id: number): Promise<PaymentItem | undefined> {
    const [item] = await db.select().from(paymentItems).where(eq(paymentItems.id, id));
    return item || undefined;
  }

  async createPaymentItem(item: InsertPaymentItem): Promise<PaymentItem> {
    const [newItem] = await db.insert(paymentItems).values(item).returning();
    return newItem;
  }

  async updatePaymentItem(id: number, item: Partial<InsertPaymentItem>): Promise<PaymentItem> {
    const [updatedItem] = await db.update(paymentItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(paymentItems.id, id))
      .returning();
    return updatedItem;
  }

  // Payment Records Methods
  async getPaymentRecords(itemId: number): Promise<PaymentRecord[]> {
    return await db.select().from(paymentRecords)
      .where(eq(paymentRecords.paymentItemId, itemId))
      .orderBy(desc(paymentRecords.paymentDate));
  }

  async getAllPaymentRecords(): Promise<any[]> {
    return await db
      .select({
        id: paymentRecords.id,
        paymentItemId: paymentRecords.paymentItemId,
        amountPaid: paymentRecords.amountPaid,
        paymentDate: paymentRecords.paymentDate,
        paymentMethod: paymentRecords.paymentMethod,
        receiptImageUrl: paymentRecords.receiptImageUrl,
        receiptText: paymentRecords.receiptText,
        isPartialPayment: paymentRecords.isPartialPayment,
        notes: paymentRecords.notes,
        createdAt: paymentRecords.createdAt,
        itemName: paymentItems.itemName,
        projectName: paymentProjects.projectName,
        categoryName: debtCategories.categoryName,
      })
      .from(paymentRecords)
      .leftJoin(paymentItems, eq(paymentRecords.paymentItemId, paymentItems.id))
      .leftJoin(paymentProjects, eq(paymentItems.projectId, paymentProjects.id))
      .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
      .orderBy(desc(paymentRecords.createdAt));
  }

  async createPaymentRecord(record: InsertPaymentRecord): Promise<PaymentRecord> {
    const [newRecord] = await db.insert(paymentRecords).values(record).returning();
    return newRecord;
  }

  // Reports and Statistics Methods
  async getMonthlyPaymentTrend(period: string): Promise<any[]> {
    const months = period === "3months" ? 3 : period === "6months" ? 6 : period === "1year" ? 12 : 24;
    
    const result = await db
      .select({
        month: sql<string>`TO_CHAR(${paymentRecords.paymentDate}, 'YYYY-MM')`,
        paid: sql<number>`COALESCE(SUM(${paymentRecords.amountPaid}), 0)`,
        planned: sql<number>`COALESCE(SUM(${paymentItems.totalAmount}), 0)`,
      })
      .from(paymentRecords)
      .leftJoin(paymentItems, eq(paymentRecords.paymentItemId, paymentItems.id))
      .where(
        sql`${paymentRecords.paymentDate} >= CURRENT_DATE - INTERVAL '${sql.raw(months.toString())} months'`
      )
      .groupBy(sql`TO_CHAR(${paymentRecords.paymentDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${paymentRecords.paymentDate}, 'YYYY-MM')`);

    return result;
  }

  async getPaymentMethodStats(): Promise<any[]> {
    const result = await db
      .select({
        name: paymentRecords.paymentMethod,
        count: sql<number>`COUNT(*)`,
      })
      .from(paymentRecords)
      .groupBy(paymentRecords.paymentMethod)
      .orderBy(desc(sql<number>`COUNT(*)`));

    return result;
  }

  async getTopCategoriesStats(): Promise<any[]> {
    const result = await db
      .select({
        categoryName: debtCategories.categoryName,
        totalAmount: sql<number>`SUM(${paymentRecords.amountPaid})`,
      })
      .from(paymentRecords)
      .leftJoin(paymentItems, eq(paymentRecords.paymentItemId, paymentItems.id))
      .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
      .groupBy(debtCategories.categoryName)
      .orderBy(desc(sql<number>`SUM(${paymentRecords.amountPaid})`))
      .limit(10);

    return result;
  }

  // Payment Tags Methods
  async getPaymentTags(): Promise<PaymentTag[]> {
    return await db.select().from(paymentTags)
      .where(eq(paymentTags.isActive, true));
  }

  async createPaymentTag(tag: InsertPaymentTag): Promise<PaymentTag> {
    const [newTag] = await db.insert(paymentTags).values(tag).returning();
    return newTag;
  }

  // Budget Plans Methods
  async getBudgetPlans(filters?: {
    type?: string;
    projectId?: number;
  }): Promise<BudgetPlan[]> {
    let conditions = [];

    if (filters?.type) {
      conditions.push(eq(budgetPlans.planType, filters.type));
    }
    if (filters?.projectId) {
      conditions.push(eq(budgetPlans.projectId, filters.projectId));
    }

    if (conditions.length > 0) {
      return await db.select().from(budgetPlans)
        .where(and(...conditions))
        .orderBy(desc(budgetPlans.createdAt));
    }

    return await db.select().from(budgetPlans)
      .orderBy(desc(budgetPlans.createdAt));
  }

  async createBudgetPlan(plan: InsertBudgetPlan): Promise<BudgetPlan> {
    const [newPlan] = await db.insert(budgetPlans).values(plan).returning();
    return newPlan;
  }

  // Statistics Methods
  async getHomePaymentStats(filters?: {
    month?: number;
    year?: number;
  }): Promise<{
    totalPlanned: number;
    totalPaid: number;
    totalPending: number;
    itemsByCategory: Array<{
      categoryName: string;
      totalAmount: number;
      paidAmount: number;
    }>;
  }> {
    // 查詢家用付款項目
    let conditions = [
      eq(paymentItems.itemType, "home"),
      eq(paymentItems.isDeleted, false)
    ];

    if (filters?.year) {
      const startDate = new Date(filters.year, filters.month ? filters.month - 1 : 0, 1);
      const endDate = filters.month 
        ? new Date(filters.year, filters.month, 0)
        : new Date(filters.year + 1, 0, 0);
      
      conditions.push(gte(paymentItems.startDate, startDate.toISOString().split('T')[0]));
      conditions.push(lte(paymentItems.startDate, endDate.toISOString().split('T')[0]));
    }

    const items = await db.select({
      totalAmount: paymentItems.totalAmount,
      paidAmount: paymentItems.paidAmount,
      categoryName: debtCategories.categoryName,
    })
    .from(paymentItems)
    .leftJoin(debtCategories, eq(paymentItems.categoryId, debtCategories.id))
    .where(and(...conditions));

    const totalPlanned = items.reduce((sum, item) => sum + parseFloat(item.totalAmount?.toString() || "0"), 0);
    const totalPaid = items.reduce((sum, item) => sum + parseFloat(item.paidAmount?.toString() || "0"), 0);
    const totalPending = totalPlanned - totalPaid;

    // 按分類統計
    const categoryStats = items.reduce((acc, item) => {
      const categoryName = item.categoryName || "未分類";
      if (!acc[categoryName]) {
        acc[categoryName] = { totalAmount: 0, paidAmount: 0 };
      }
      acc[categoryName].totalAmount += parseFloat(item.totalAmount?.toString() || "0");
      acc[categoryName].paidAmount += parseFloat(item.paidAmount?.toString() || "0");
      return acc;
    }, {} as Record<string, { totalAmount: number; paidAmount: number }>);

    const itemsByCategory = Object.entries(categoryStats).map(([categoryName, stats]) => ({
      categoryName,
      totalAmount: stats.totalAmount,
      paidAmount: stats.paidAmount
    }));

    return {
      totalPlanned,
      totalPaid,
      totalPending,
      itemsByCategory
    };
  }

  async getProjectPaymentStats(filters?: {
    projectId?: number;
    period?: string;
  }): Promise<{
    totalPlanned: number;
    totalPaid: number;
    totalPending: number;
    projectBreakdown: Array<{
      projectName: string;
      totalAmount: number;
      paidAmount: number;
    }>;
  }> {
    // 查詢專案付款項目
    let conditions = [
      eq(paymentItems.itemType, "project"),
      eq(paymentItems.isDeleted, false)
    ];

    if (filters?.projectId) {
      conditions.push(eq(paymentItems.projectId, filters.projectId));
    }

    const items = await db.select({
      totalAmount: paymentItems.totalAmount,
      paidAmount: paymentItems.paidAmount,
      projectName: paymentProjects.projectName,
    })
    .from(paymentItems)
    .leftJoin(paymentProjects, eq(paymentItems.projectId, paymentProjects.id))
    .where(and(...conditions));

    const totalPlanned = items.reduce((sum, item) => sum + parseFloat(item.totalAmount?.toString() || "0"), 0);
    const totalPaid = items.reduce((sum, item) => sum + parseFloat(item.paidAmount?.toString() || "0"), 0);
    const totalPending = totalPlanned - totalPaid;

    // 按專案統計
    const projectStats = items.reduce((acc, item) => {
      const projectName = item.projectName || "未分類";
      if (!acc[projectName]) {
        acc[projectName] = { totalAmount: 0, paidAmount: 0 };
      }
      acc[projectName].totalAmount += parseFloat(item.totalAmount?.toString() || "0");
      acc[projectName].paidAmount += parseFloat(item.paidAmount?.toString() || "0");
      return acc;
    }, {} as Record<string, { totalAmount: number; paidAmount: number }>);

    const projectBreakdown = Object.entries(projectStats).map(([projectName, stats]) => ({
      projectName,
      totalAmount: stats.totalAmount,
      paidAmount: stats.paidAmount
    }));

    return {
      totalPlanned,
      totalPaid,
      totalPending,
      projectBreakdown
    };
  }

  // 家用財務管理方法實現
  async getHouseholdBudgets(month?: string): Promise<HouseholdBudget[]> {
    const query = db.select().from(householdBudgets);
    
    if (month) {
      query.where(eq(householdBudgets.month, month));
    }
    
    return await query.orderBy(desc(householdBudgets.createdAt));
  }

  async getHouseholdBudgetById(id: number): Promise<HouseholdBudget | undefined> {
    const [budget] = await db.select().from(householdBudgets).where(eq(householdBudgets.id, id));
    return budget || undefined;
  }

  async createHouseholdBudget(budget: InsertHouseholdBudget): Promise<HouseholdBudget> {
    const [newBudget] = await db.insert(householdBudgets).values(budget).returning();
    return newBudget;
  }

  async updateHouseholdBudget(id: number, budget: Partial<InsertHouseholdBudget>): Promise<HouseholdBudget> {
    const [updatedBudget] = await db.update(householdBudgets)
      .set({ ...budget, updatedAt: new Date() })
      .where(eq(householdBudgets.id, id))
      .returning();
    return updatedBudget;
  }

  async deleteHouseholdBudget(id: number): Promise<void> {
    await db.delete(householdBudgets).where(eq(householdBudgets.id, id));
  }

  async getHouseholdExpenses(filters?: {
    month?: string;
    categoryId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<HouseholdExpense[]> {
    const query = db.select().from(householdExpenses);
    const conditions = [];

    if (filters?.month) {
      const monthStart = `${filters.month}-01`;
      const monthEnd = `${filters.month}-31`;
      conditions.push(gte(householdExpenses.date, monthStart));
      conditions.push(lte(householdExpenses.date, monthEnd));
    }

    if (filters?.categoryId) {
      conditions.push(eq(householdExpenses.categoryId, filters.categoryId));
    }

    if (filters?.startDate) {
      conditions.push(gte(householdExpenses.date, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(lte(householdExpenses.date, filters.endDate));
    }

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return await query.orderBy(desc(householdExpenses.date));
  }

  async getHouseholdExpenseById(id: number): Promise<HouseholdExpense | undefined> {
    const [expense] = await db.select().from(householdExpenses).where(eq(householdExpenses.id, id));
    return expense || undefined;
  }

  async createHouseholdExpense(expense: InsertHouseholdExpense): Promise<HouseholdExpense> {
    const [newExpense] = await db.insert(householdExpenses).values(expense).returning();
    return newExpense;
  }

  async updateHouseholdExpense(id: number, expense: Partial<InsertHouseholdExpense>): Promise<HouseholdExpense> {
    const [updatedExpense] = await db.update(householdExpenses)
      .set({ ...expense, updatedAt: new Date() })
      .where(eq(householdExpenses.id, id))
      .returning();
    return updatedExpense;
  }

  async deleteHouseholdExpense(id: number): Promise<void> {
    await db.delete(householdExpenses).where(eq(householdExpenses.id, id));
  }

  async getHouseholdMonthlyData(month: string): Promise<{
    budgets: HouseholdBudget[];
    expenses: HouseholdExpense[];
    summary: {
      totalBudget: number;
      totalExpenses: number;
      variance: number;
      categoryBreakdown: Array<{
        categoryId: number;
        categoryName: string;
        budgetAmount: number;
        actualAmount: number;
        variance: number;
      }>;
    };
  }> {
    // 獲取指定月份的預算和花費
    const budgets = await this.getHouseholdBudgets(month);
    const expenses = await this.getHouseholdExpenses({ month });

    // 計算總計
    const totalBudget = budgets.reduce((sum, budget) => sum + parseFloat(budget.budgetAmount), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
    const variance = totalBudget - totalExpenses;

    // 按類別分解
    const categoryBreakdown = [];
    const categories = await this.getCategories();

    for (const category of categories) {
      const categoryBudgets = budgets.filter(b => b.categoryId === category.id);
      const categoryExpenses = expenses.filter(e => e.categoryId === category.id);
      
      const budgetAmount = categoryBudgets.reduce((sum, budget) => sum + parseFloat(budget.budgetAmount), 0);
      const actualAmount = categoryExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
      
      if (budgetAmount > 0 || actualAmount > 0) {
        categoryBreakdown.push({
          categoryId: category.id,
          categoryName: category.categoryName,
          budgetAmount,
          actualAmount,
          variance: budgetAmount - actualAmount
        });
      }
    }

    return {
      budgets,
      expenses,
      summary: {
        totalBudget,
        totalExpenses,
        variance,
        categoryBreakdown
      }
    };
  }

  // 家用分類管理方法
  async getHouseholdCategories(): Promise<DebtCategory[]> {
    return await db.select().from(debtCategories)
      .where(eq(debtCategories.isDeleted, false))
      .orderBy(debtCategories.categoryName);
  }

  async createHouseholdCategory(categoryData: any): Promise<DebtCategory> {
    const [newCategory] = await db.insert(debtCategories).values({
      ...categoryData,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return newCategory;
  }

  async updateHouseholdCategory(id: number, categoryData: any): Promise<DebtCategory> {
    const [updatedCategory] = await db.update(debtCategories)
      .set({
        ...categoryData,
        updatedAt: new Date()
      })
      .where(eq(debtCategories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteHouseholdCategory(id: number): Promise<void> {
    await db.update(debtCategories)
      .set({ 
        isDeleted: true,
        updatedAt: new Date()
      })
      .where(eq(debtCategories.id, id));
  }

  async initializeHouseholdCategories(): Promise<void> {
    const householdCategories = [
      { categoryName: '食物費用', description: '餐飲、食材、零食等費用' },
      { categoryName: '交通費用', description: '交通工具、汽油、停車等費用' },
      { categoryName: '服裝費用', description: '衣服、鞋子、配件等費用' },
      { categoryName: '居住費用', description: '房租、水電、網路等住宿費用' },
      { categoryName: '醫療費用', description: '醫療、保健、藥品等費用' },
      { categoryName: '教育費用', description: '學費、補習、書籍等教育費用' },
      { categoryName: '娛樂費用', description: '電影、旅遊、運動等娛樂費用' },
      { categoryName: '保險費用', description: '健保、勞保、意外險等保險費用' },
      { categoryName: '儲蓄投資', description: '定期存款、投資理財等費用' },
      { categoryName: '日用品費用', description: '清潔用品、生活用品等費用' },
      { categoryName: '通訊費用', description: '電話、網路、手機等通訊費用' },
      { categoryName: '其他費用', description: '其他未分類的生活支出' }
    ];

    // 檢查是否已經初始化過
    const existingCategories = await this.getHouseholdCategories();
    if (existingCategories.length === 0) {
      for (const category of householdCategories) {
        await this.createHouseholdCategory(category);
      }
    }
  }

  // 專案分類管理方法
  async getProjectCategories(): Promise<DebtCategory[]> {
    return await db.select().from(debtCategories)
      .where(and(
        eq(debtCategories.isDeleted, false),
        ne(debtCategories.categoryName, '食物費用'), // 排除家用分類
        ne(debtCategories.categoryName, '交通費用'),
        ne(debtCategories.categoryName, '服裝費用'),
        ne(debtCategories.categoryName, '居住費用'),
        ne(debtCategories.categoryName, '醫療費用'),
        ne(debtCategories.categoryName, '教育費用'),
        ne(debtCategories.categoryName, '娛樂費用'),
        ne(debtCategories.categoryName, '保險費用'),
        ne(debtCategories.categoryName, '儲蓄投資'),
        ne(debtCategories.categoryName, '日用品費用'),
        ne(debtCategories.categoryName, '通訊費用'),
        ne(debtCategories.categoryName, '其他費用')
      ))
      .orderBy(debtCategories.categoryName);
  }

  async createProjectCategory(categoryData: any): Promise<DebtCategory> {
    const [newCategory] = await db.insert(debtCategories).values({
      ...categoryData,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return newCategory;
  }

  async updateProjectCategory(id: number, categoryData: any): Promise<DebtCategory> {
    const [updatedCategory] = await db.update(debtCategories)
      .set({
        ...categoryData,
        updatedAt: new Date()
      })
      .where(eq(debtCategories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteProjectCategory(id: number): Promise<void> {
    await db.update(debtCategories)
      .set({ 
        isDeleted: true,
        updatedAt: new Date()
      })
      .where(eq(debtCategories.id, id));
  }

  async initializeProjectCategories(): Promise<void> {
    const projectCategories = [
      { categoryName: '人事費用', description: '員工薪資、福利、保險等費用' },
      { categoryName: '行銷推廣', description: '廣告投放、促銷活動、宣傳費用' },
      { categoryName: '營運成本', description: '日常營運所需的各項費用' },
      { categoryName: '設備採購', description: '設備購買、維護、升級費用' },
      { categoryName: '租金物業', description: '辦公室、店面租金及相關費用' },
      { categoryName: '專業服務', description: '法律、會計、顧問等專業服務費' },
      { categoryName: '技術開發', description: '軟體開發、系統建置費用' },
      { categoryName: '差旅費用', description: '出差、交通、住宿等費用' },
      { categoryName: '保險稅務', description: '各項保險費及稅務支出' },
      { categoryName: '其他支出', description: '其他未分類的專案支出' }
    ];

    // 檢查是否已經初始化過
    const existingCategories = await this.getProjectCategories();
    if (existingCategories.length === 0) {
      for (const category of projectCategories) {
        await this.createProjectCategory(category);
      }
    }
  }
}

export const storage = new DatabaseStorage();
