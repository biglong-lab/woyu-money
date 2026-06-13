import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  decimal,
  timestamp,
  date,
  varchar,
  index,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

// ─────────────────────────────────────────────
// 信用卡請款紀錄（獨立模組、暫不與其他財務數據對應）
// 用途：記錄不定期刷卡請款的結算金額、銀行、標籤、館別、狀態
// ─────────────────────────────────────────────

// 請款標籤（可自訂、依需求新增，如 Booking / Agoda / Trip）
export const cardClaimTags = pgTable("card_claim_tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
})

// 館別（可自訂、依需求新增）
export const cardClaimProperties = pgTable("card_claim_properties", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
})

// 狀態：pending 待請款 / claimed 已請款 / settled 已入帳 / cancelled 已取消
export const CARD_CLAIM_STATUSES = ["pending", "claimed", "settled", "cancelled"] as const
export type CardClaimStatus = (typeof CARD_CLAIM_STATUSES)[number]

// 信用卡請款紀錄主表
export const cardClaims = pgTable(
  "card_claims",
  {
    id: serial("id").primaryKey(),
    // 結算金額
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    // 刷卡時間（日期）
    swipeDate: date("swipe_date").notNull(),
    // 刷卡銀行（自由輸入）
    bank: varchar("bank", { length: 100 }),
    // 請款標籤（選填、關聯 card_claim_tags）
    tagId: integer("tag_id").references(() => cardClaimTags.id),
    // 館別（選填、關聯 card_claim_properties）
    propertyId: integer("property_id").references(() => cardClaimProperties.id),
    // 狀態
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    // 備註
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    swipeDateIdx: index("card_claims_swipe_date_idx").on(table.swipeDate),
    statusIdx: index("card_claims_status_idx").on(table.status),
    tagIdx: index("card_claims_tag_idx").on(table.tagId),
    propertyIdx: index("card_claims_property_idx").on(table.propertyId),
  })
)

// ─────────────────────────────────────────────
// 驗證 Schema
// ─────────────────────────────────────────────

export const insertCardClaimTagSchema = createInsertSchema(cardClaimTags)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().trim().min(1, "標籤名稱不可空白").max(50),
  })

export const insertCardClaimPropertySchema = createInsertSchema(cardClaimProperties)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().trim().min(1, "館別名稱不可空白").max(50),
  })

export const insertCardClaimSchema = createInsertSchema(cardClaims)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    amount: z
      .union([z.string(), z.number()])
      .transform((val) => val.toString())
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "金額需為非負數字"),
    swipeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "刷卡日期格式需為 YYYY-MM-DD"),
    bank: z.string().trim().max(100).optional().nullable(),
    tagId: z.number().int().positive().optional().nullable(),
    propertyId: z.number().int().positive().optional().nullable(),
    status: z.enum(CARD_CLAIM_STATUSES).default("pending"),
    notes: z.string().max(1000).optional().nullable(),
  })

// ─────────────────────────────────────────────
// 型別匯出
// ─────────────────────────────────────────────

export type CardClaimTag = typeof cardClaimTags.$inferSelect
export type InsertCardClaimTag = z.infer<typeof insertCardClaimTagSchema>
export type CardClaimProperty = typeof cardClaimProperties.$inferSelect
export type InsertCardClaimProperty = z.infer<typeof insertCardClaimPropertySchema>
export type CardClaim = typeof cardClaims.$inferSelect
export type InsertCardClaim = z.infer<typeof insertCardClaimSchema>
