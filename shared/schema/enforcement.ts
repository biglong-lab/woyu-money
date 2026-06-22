/**
 * 強制執行管理（執行處公文 / 圈存 / 分期）
 *
 * 對帳核心：強執總額(多筆 cases) ≈ 圈存(多筆 seizures) + 分期(多筆 installments)
 * - 圈存：銀行被凍結的錢（時間/銀行/金額/截圖）
 * - 分期：執行處同意分期，逐月付掉（每月一筆付款可上傳截圖）
 * - caseId 可空：允許未歸類，對帳表顯示差異即可（不強制綁公文）
 */
import {
  pgTable,
  serial,
  integer,
  varchar,
  decimal,
  date,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

// ── 強執公文/案件 ──
export const enforcementCases = pgTable(
  "enforcement_cases",
  {
    id: serial("id").primaryKey(),
    caseNumber: varchar("case_number", { length: 100 }), // 公文文號（可空）
    agency: varchar("agency", { length: 255 }), // 執行處/機關
    contactPhone: varchar("contact_phone", { length: 50 }), // 窗口電話
    contactInfo: text("contact_info"), // 其他窗口資訊
    subject: text("subject"), // 案由/內容
    totalAmount: decimal("total_amount", { precision: 14, scale: 2 }).notNull(), // 強執總額
    issuedDate: date("issued_date"), // 公文日期
    status: varchar("status", { length: 20 }).notNull().default("active"), // active/partial/cleared
    attachmentUrl: varchar("attachment_url", { length: 500 }), // 主公文截圖（相容）
    attachments: jsonb("attachments").default([]), // 多附件 [{url, ocrText}]（OCR 來源存查）
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    statusIdx: index("enforcement_cases_status_idx").on(t.status),
    issuedIdx: index("enforcement_cases_issued_idx").on(t.issuedDate),
  })
)

// ── 圈存紀錄 ──
export const enforcementSeizures = pgTable(
  "enforcement_seizures",
  {
    id: serial("id").primaryKey(),
    caseId: integer("case_id"), // 可空：未歸類
    bankName: varchar("bank_name", { length: 100 }),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    seizureDate: date("seizure_date"),
    status: varchar("status", { length: 20 }).notNull().default("frozen"), // frozen/released
    receiptImageUrl: varchar("receipt_image_url", { length: 500 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    caseIdx: index("enforcement_seizures_case_idx").on(t.caseId),
  })
)

// ── 分期計畫 ──
export const enforcementInstallments = pgTable(
  "enforcement_installments",
  {
    id: serial("id").primaryKey(),
    caseId: integer("case_id"), // 可空：未歸類
    planName: varchar("plan_name", { length: 255 }),
    startDate: date("start_date"), // 開始時間（哪個時間點起每月付）
    monthlyAmount: decimal("monthly_amount", { precision: 14, scale: 2 }).notNull(),
    periods: integer("periods"), // 期數（可空＝未定）
    dayOfMonth: integer("day_of_month").notNull().default(10),
    totalAmount: decimal("total_amount", { precision: 14, scale: 2 }), // 分期總額（可空）
    status: varchar("status", { length: 20 }).notNull().default("active"), // active/done
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    caseIdx: index("enforcement_installments_case_idx").on(t.caseId),
  })
)

// ── 分期每月實付 ──
export const enforcementInstallmentPayments = pgTable(
  "enforcement_installment_payments",
  {
    id: serial("id").primaryKey(),
    installmentId: integer("installment_id").notNull(),
    paymentDate: date("payment_date").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    receiptImageUrl: varchar("receipt_image_url", { length: 500 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    installmentIdx: index("enforcement_inst_pay_installment_idx").on(t.installmentId),
  })
)

// ── Insert schemas ──
const amount = z
  .union([z.string(), z.number()])
  .transform((v) => v.toString())
  .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "金額需為非負數字")
const optDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式需為 YYYY-MM-DD")
  .optional()
  .nullable()

export const insertEnforcementCaseSchema = createInsertSchema(enforcementCases)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    totalAmount: amount,
    issuedDate: optDate,
    status: z.enum(["active", "partial", "cleared"]).optional(),
    attachments: z.array(z.object({ url: z.string(), ocrText: z.string().optional() })).optional(),
  })

export const insertEnforcementSeizureSchema = createInsertSchema(enforcementSeizures)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    caseId: z.number().int().positive().optional().nullable(),
    amount,
    seizureDate: optDate,
    status: z.enum(["frozen", "released"]).optional(),
  })

export const insertEnforcementInstallmentSchema = createInsertSchema(enforcementInstallments)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    caseId: z.number().int().positive().optional().nullable(),
    monthlyAmount: amount,
    totalAmount: amount.optional().nullable(),
    startDate: optDate,
    periods: z.number().int().positive().optional().nullable(),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    status: z.enum(["active", "done"]).optional(),
  })

export const insertEnforcementInstallmentPaymentSchema = createInsertSchema(
  enforcementInstallmentPayments
)
  .omit({ id: true, createdAt: true })
  .extend({
    installmentId: z.number().int().positive(),
    amount,
    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式需為 YYYY-MM-DD"),
  })

export type EnforcementCase = typeof enforcementCases.$inferSelect
export type EnforcementSeizure = typeof enforcementSeizures.$inferSelect
export type EnforcementInstallment = typeof enforcementInstallments.$inferSelect
export type EnforcementInstallmentPayment = typeof enforcementInstallmentPayments.$inferSelect
export type InsertEnforcementCase = z.infer<typeof insertEnforcementCaseSchema>
export type InsertEnforcementSeizure = z.infer<typeof insertEnforcementSeizureSchema>
export type InsertEnforcementInstallment = z.infer<typeof insertEnforcementInstallmentSchema>
export type InsertEnforcementInstallmentPayment = z.infer<
  typeof insertEnforcementInstallmentPaymentSchema
>
