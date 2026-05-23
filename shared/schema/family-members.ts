/**
 * 家庭成員 schema — 階段 4.1 多人協作起步
 *
 * 設計重點：
 *  - family_id 預設 1（單家庭、之後 SaaS 切租戶用）
 *  - userId nullable：pending 邀請尚未綁定 user 帳號時、用 email + inviteToken
 *  - 接受邀請後綁定 userId、status 改 active
 *  - role: owner / parent / kid / viewer
 *  - 此階段先做骨架、不影響現有權限系統（menu_permissions 仍用 users.role）
 *
 * 未來階段：
 *  - 家庭預算共決：呼叫此表確認誰可改預算
 *  - 跨領域整合視圖：依 role 過濾可見範圍
 */
import { pgTable, serial, integer, varchar, timestamp, text, index } from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"
import { users } from "./base"

export const familyMembers = pgTable(
  "family_members",
  {
    id: serial("id").primaryKey(),
    familyId: integer("family_id").notNull().default(1),
    userId: integer("user_id").references(() => users.id),
    email: varchar("email", { length: 100 }),
    displayName: varchar("display_name", { length: 100 }),
    role: varchar("role", { length: 20 }).notNull().default("parent"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    inviteToken: varchar("invite_token", { length: 64 }),
    invitedByUserId: integer("invited_by_user_id").references(() => users.id),
    inviteNote: text("invite_note"),
    invitedAt: timestamp("invited_at").defaultNow().notNull(),
    joinedAt: timestamp("joined_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    familyIdx: index("family_members_family_idx").on(table.familyId),
    userIdx: index("family_members_user_idx").on(table.userId),
    tokenIdx: index("family_members_token_idx").on(table.inviteToken),
  })
)

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  invitedAt: true,
})

export const inviteFamilyMemberSchema = z.object({
  email: z.string().email("請輸入有效 email"),
  displayName: z.string().min(1).max(100).optional(),
  role: z.enum(["owner", "parent", "kid", "viewer"]).default("parent"),
  inviteNote: z.string().max(500).optional(),
})

export type FamilyMember = typeof familyMembers.$inferSelect
export type InsertFamilyMember = typeof familyMembers.$inferInsert
export type InviteFamilyMemberInput = z.infer<typeof inviteFamilyMemberSchema>
