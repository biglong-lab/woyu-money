/**
 * 館別共用組（PR-1）
 *
 * 用途：
 * - 定義哪些 payment_projects 共用某些費用（例如「輕旅櫃台組」共用人事/洗滌）
 * - 提供分攤計算需要的權重（房數）
 * - 給 budget_items.attribution='shared' 時 reference
 */

import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  decimal,
  index,
  unique,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"
import { paymentProjects } from "./category"
import { budgetItems } from "./payment"

export const propertyGroups = pgTable("property_groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const propertyGroupMembers = pgTable(
  "property_group_members",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => propertyGroups.id, { onDelete: "cascade" }),
    projectId: integer("project_id")
      .notNull()
      .references(() => paymentProjects.id),
    // 房數比例分攤用（同時也用於 manual 規則的相對權重）
    weight: decimal("weight", { precision: 5, scale: 2 }).default("1.00"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    groupIdIdx: index("idx_property_group_members_group_id").on(table.groupId),
    projectIdIdx: index("idx_property_group_members_project_id").on(table.projectId),
    uniqueGroupProject: unique().on(table.groupId, table.projectId),
  })
)

// 共用費用攤提紀錄（每筆 shared budget_item 拆成 N 筆）
export const budgetItemAllocations = pgTable(
  "budget_item_allocations",
  {
    id: serial("id").primaryKey(),
    budgetItemId: integer("budget_item_id")
      .notNull()
      .references(() => budgetItems.id, { onDelete: "cascade" }),
    projectId: integer("project_id")
      .notNull()
      .references(() => paymentProjects.id),
    allocatedAmount: decimal("allocated_amount", { precision: 10, scale: 2 }).notNull(),
    // 紀錄當下用什麼規則算的（用於審計與重算追溯）
    allocationBasis: varchar("allocation_basis", { length: 50 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    budgetItemIdIdx: index("idx_budget_item_allocations_budget_item_id").on(table.budgetItemId),
    projectIdIdx: index("idx_budget_item_allocations_project_id").on(table.projectId),
  })
)

// ── Zod schemas ─────────────────────────────────────────────

export const insertPropertyGroupSchema = createInsertSchema(propertyGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const insertPropertyGroupMemberSchema = createInsertSchema(propertyGroupMembers).omit({
  id: true,
  createdAt: true,
})

export const insertBudgetItemAllocationSchema = createInsertSchema(budgetItemAllocations).omit({
  id: true,
  createdAt: true,
})

// ── Types ───────────────────────────────────────────────────

export type PropertyGroup = typeof propertyGroups.$inferSelect
export type InsertPropertyGroup = z.infer<typeof insertPropertyGroupSchema>
export type PropertyGroupMember = typeof propertyGroupMembers.$inferSelect
export type InsertPropertyGroupMember = z.infer<typeof insertPropertyGroupMemberSchema>
export type BudgetItemAllocation = typeof budgetItemAllocations.$inferSelect
export type InsertBudgetItemAllocation = z.infer<typeof insertBudgetItemAllocationSchema>
