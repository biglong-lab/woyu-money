import type {
  User,
  DebtCategory,
  PaymentProject,
  PaymentItem,
  PaymentRecord,
  PaymentSchedule,
  RentalContract,
  RentalPriceTier,
  ContractDocument,
  InstallmentPlan,
  HouseholdBudget,
  HouseholdExpense,
  LoanInvestmentRecord,
  LoanPaymentSchedule,
  LoanPaymentHistory,
  FileAttachment,
  AuditLog,
  Notification,
} from './schema';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaymentStats {
  totalPlanned: string | number;
  totalPaid: string | number;
  pendingItems: string | number;
  overdueItems: string | number;
}

export interface ProjectStats {
  id: number;
  projectName: string;
  projectType?: string;
  description?: string;
  isActive?: boolean;
  itemCount: string | number;
  totalAmount: string | number;
  paidAmount: string | number;
  pendingAmount: string | number;
}

export interface CategoryStats {
  id: number;
  categoryName: string;
  categoryType?: string;
  itemCount: string | number;
  totalAmount: string | number;
  paidAmount: string | number;
}

export interface PaymentItemWithDetails {
  id: number;
  categoryId?: number | null;
  projectId?: number | null;
  itemName: string;
  totalAmount: string;
  paidAmount?: string | null;
  status?: string;
  startDate?: string;
  endDate?: string | null;
  categoryName?: string;
  projectName?: string;
  projectType?: string;
}

export interface RentalContractWithDetails {
  id: number;
  contractName: string;
  landlordName?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  monthlyRent?: string;
  status?: string;
  priceTiers?: RentalPriceTier[];
  documents?: ContractDocument[];
  installmentPlans?: InstallmentPlan[];
}

export interface LoanInvestmentWithDetails {
  id: number;
  itemName: string;
  recordType: string;
  partyName: string;
  principalAmount: string;
  annualInterestRate: string;
  startDate: string;
  endDate?: string | null;
  status: string;
  paymentSchedules?: LoanPaymentSchedule[];
  paymentHistory?: LoanPaymentHistory[];
  attachments?: FileAttachment[];
}

export interface DashboardStats {
  totalRevenue: string | number;
  totalExpense: string | number;
  netProfit: string | number;
  pendingPayments: string | number;
  overduePayments: string | number;
  activeProjects: string | number;
  activeContracts: string | number;
}

export interface MonthlyStatistics {
  month: string;
  totalAmount: string | number;
  paidAmount: string | number;
  pendingAmount: string | number;
  itemCount: string | number;
}

export interface CategoryHierarchy {
  id: number;
  categoryName: string;
  categoryType?: string;
  description?: string | null;
  isTemplate?: boolean;
  children?: CategoryHierarchy[];
  subCategories?: CategoryHierarchy[];
}

export interface UnifiedPaymentResult {
  allocatedPayments: Array<{
    itemId: number;
    itemName: string;
    allocatedAmount: number;
    isFullyPaid: boolean;
  }>;
  remainingAmount: number;
}

export interface BatchImportResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  errors: Array<{
    row: number;
    field?: string;
    message: string;
  }>;
  details?: unknown[];
}

export interface OverdueItemsResponse {
  items: PaymentItemWithDetails[];
  totalOverdue: number;
  overdueCount: number;
}

export interface SystemHealth {
  healthy: boolean;
  responseTime?: number;
  error?: string;
}

export interface UserSession {
  userId: number;
  username: string;
  role: string;
  menuPermissions?: Record<string, boolean>;
}

export interface AuthResponse {
  success: boolean;
  user?: UserSession;
  message?: string;
}

export interface FileUploadResponse {
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  message?: string;
}

export interface AuditLogQuery {
  tableName?: string;
  recordId?: number;
  action?: string;
  userId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface NotificationQuery {
  userId?: number;
  type?: string;
  isRead?: boolean;
  priority?: string;
  page?: number;
  limit?: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ErrorResponse {
  message: string;
  errors?: ValidationError[];
  code?: string;
}
