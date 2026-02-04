export const PaymentStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  PARTIAL: 'partial',
  OVERDUE: 'overdue',
  UNPAID: 'unpaid',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  PROCESSING: 'processing',
  FAILED: 'failed',
  APPROVED: 'approved',
} as const;

export const ScheduleStatus = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
  RESCHEDULED: 'rescheduled',
} as const;

export const ProjectStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PLANNING: 'planning',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const LoanStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const PaymentHistoryStatus = {
  COMPLETED: 'completed',
  PENDING: 'pending',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export const ItemType = {
  PROJECT: 'project',
  HOUSEHOLD: 'household',
  HOME: 'home',
} as const;

export const PaymentType = {
  SINGLE: 'single',
  RECURRING: 'recurring',
  INSTALLMENT: 'installment',
  MONTHLY: 'monthly',
} as const;

export const ProjectType = {
  GENERAL: 'general',
  BUSINESS: 'business',
  RENTAL: 'rental',
  REVENUE: 'revenue',
} as const;

export const RecordType = {
  LOAN: 'loan',
  INVESTMENT: 'investment',
} as const;

export const PaymentMethod = {
  CASH: 'cash',
  BANK_TRANSFER: 'bank_transfer',
  CHECK: 'check',
  MOBILE_PAYMENT: 'mobile_payment',
} as const;

export const LoanPaymentType = {
  INTEREST: 'interest',
  PRINCIPAL: 'principal',
  FULL_REPAYMENT: 'full_repayment',
  PARTIAL_PAYMENT: 'partial_payment',
} as const;

export const InterestPaymentMethod = {
  YEARLY: 'yearly',
  MONTHLY: 'monthly',
  AGREED_DATE: 'agreed_date',
} as const;

export const ReturnMethod = {
  LUMP_SUM: 'lump_sum',
  INSTALLMENT: 'installment',
} as const;

export const AuthProvider = {
  LOCAL: 'local',
  LINE: 'line',
} as const;

export const UserRole = {
  ADMIN: 'admin',
  USER1: 'user1',
  USER2: 'user2',
  CHILD: 'child',
} as const;

export const AuditAction = {
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  RESTORE: 'RESTORE',
} as const;

export const NotificationType = {
  PAYMENT_DUE: 'payment_due',
  PAYMENT_OVERDUE: 'payment_overdue',
  SYSTEM: 'system',
  REMINDER: 'reminder',
} as const;

export const NotificationPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export const FileType = {
  DOCUMENT: 'document',
  IMAGE: 'image',
  CONTRACT: 'contract',
} as const;

export const EntityType = {
  LOAN_INVESTMENT: 'loan_investment',
  RENTAL: 'rental',
  PAYMENT: 'payment',
} as const;

export const CategoryType = {
  PROJECT: 'project',
  HOUSEHOLD: 'household',
} as const;

export const RecurringInterval = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
} as const;

export const FixedCategoryType = {
  PHONE: 'phone',
  ELECTRICITY: 'electricity',
  WATER: 'water',
  INTERNET: 'internet',
  GAS: 'gas',
  MANAGEMENT: 'management',
  INSURANCE: 'insurance',
  TAX: 'tax',
  OTHER: 'other',
} as const;

export const DailyRecordType = {
  INCOME: 'income',
  EXPENSE: 'expense',
} as const;

export const Theme = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;

export const ScheduleType = {
  INTEREST: 'interest',
  PRINCIPAL: 'principal',
  INSTALLMENT: 'installment',
} as const;

export const TaskStatus = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const CommentType = {
  COMMENT: 'comment',
  SUGGESTION: 'suggestion',
  CONCERN: 'concern',
  APPROVAL: 'approval',
} as const;

export const WishlistStatus = {
  SAVING: 'saving',
  COMPLETED: 'completed',
} as const;

export const LoanType = {
  BORROWING: 'borrowing',
} as const;

export const ContractType = {
  MAINTENANCE: 'maintenance',
  RENT: 'rent',
} as const;

export const Gender = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
} as const;

export const MemberStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export const DocumentVersion = {
  ORIGINAL: 'original',
} as const;

export const Priority = {
  LOWEST: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  HIGHEST: 5,
} as const;

export const RetryConfig = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000,
  MAX_DELAY: 30000,
} as const;

export const FileUploadConfig = {
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf'],
  ALLOWED_EXTENSIONS: /\.(jpeg|jpg|png|gif|pdf)$/i,
} as const;

export const QueryConfig = {
  STALE_TIME: 10 * 60 * 1000,
  GC_TIME: 30 * 60 * 1000,
  REFETCH_ON_WINDOW_FOCUS: false,
  REFETCH_ON_MOUNT: false,
  REFETCH_INTERVAL: false,
} as const;

export const DatabaseConfig = {
  MAX_CONNECTIONS: 8,
  IDLE_TIMEOUT: 60000,
  CONNECTION_TIMEOUT: 15000,
} as const;

export const SessionConfig = {
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000,
  COOKIE_NAME: 'payment_system_session',
} as const;

export const SecurityConfig = {
  MAX_LOGIN_ATTEMPTS: 5,
  ACCOUNT_LOCK_DURATION: 30 * 60 * 1000,
  PASSWORD_MIN_LENGTH: 8,
} as const;

export const UIConfig = {
  MOBILE_BREAKPOINT: 768,
  SIDEBAR_WIDTH: '16rem',
  SIDEBAR_WIDTH_MOBILE: '18rem',
  SIDEBAR_WIDTH_ICON: '3rem',
  TOAST_LIMIT: 1,
  TOAST_REMOVE_DELAY: 1000000,
} as const;

export type PaymentStatusType = typeof PaymentStatus[keyof typeof PaymentStatus];
export type ScheduleStatusType = typeof ScheduleStatus[keyof typeof ScheduleStatus];
export type ProjectStatusType = typeof ProjectStatus[keyof typeof ProjectStatus];
export type LoanStatusType = typeof LoanStatus[keyof typeof LoanStatus];
export type PaymentHistoryStatusType = typeof PaymentHistoryStatus[keyof typeof PaymentHistoryStatus];
export type ItemTypeType = typeof ItemType[keyof typeof ItemType];
export type PaymentTypeType = typeof PaymentType[keyof typeof PaymentType];
export type ProjectTypeType = typeof ProjectType[keyof typeof ProjectType];
export type RecordTypeType = typeof RecordType[keyof typeof RecordType];
export type PaymentMethodType = typeof PaymentMethod[keyof typeof PaymentMethod];
export type LoanPaymentTypeType = typeof LoanPaymentType[keyof typeof LoanPaymentType];
export type InterestPaymentMethodType = typeof InterestPaymentMethod[keyof typeof InterestPaymentMethod];
export type ReturnMethodType = typeof ReturnMethod[keyof typeof ReturnMethod];
export type AuthProviderType = typeof AuthProvider[keyof typeof AuthProvider];
export type UserRoleType = typeof UserRole[keyof typeof UserRole];
export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];
export type NotificationTypeType = typeof NotificationType[keyof typeof NotificationType];
export type NotificationPriorityType = typeof NotificationPriority[keyof typeof NotificationPriority];
export type FileTypeType = typeof FileType[keyof typeof FileType];
export type EntityTypeType = typeof EntityType[keyof typeof EntityType];
export type CategoryTypeType = typeof CategoryType[keyof typeof CategoryType];
export type RecurringIntervalType = typeof RecurringInterval[keyof typeof RecurringInterval];
export type FixedCategoryTypeType = typeof FixedCategoryType[keyof typeof FixedCategoryType];
export type DailyRecordTypeType = typeof DailyRecordType[keyof typeof DailyRecordType];
export type ThemeType = typeof Theme[keyof typeof Theme];
export type ScheduleTypeType = typeof ScheduleType[keyof typeof ScheduleType];
export type TaskStatusType = typeof TaskStatus[keyof typeof TaskStatus];
export type CommentTypeType = typeof CommentType[keyof typeof CommentType];
export type WishlistStatusType = typeof WishlistStatus[keyof typeof WishlistStatus];
export type LoanTypeType = typeof LoanType[keyof typeof LoanType];
export type ContractTypeType = typeof ContractType[keyof typeof ContractType];
export type GenderType = typeof Gender[keyof typeof Gender];
export type MemberStatusType = typeof MemberStatus[keyof typeof MemberStatus];
export type DocumentVersionType = typeof DocumentVersion[keyof typeof DocumentVersion];
