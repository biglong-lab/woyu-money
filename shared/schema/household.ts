import { pgTable, text, serial, integer, boolean, decimal, timestamp, date, varchar, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// 家用預算表
export const householdBudgets = pgTable("household_budgets", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  budgetAmount: decimal("budget_amount", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 家用支出表
export const householdExpenses = pgTable("household_expenses", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  tags: jsonb("tags"),
  paymentMethod: varchar("payment_method", { length: 50 }),
  description: varchar("description", { length: 255 }),
  receiptImages: jsonb("receipt_images"),
  receiptText: text("receipt_text"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 驗證 Schema
export const insertHouseholdBudgetSchema = createInsertSchema(householdBudgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHouseholdExpenseSchema = createInsertSchema(householdExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 型別匯出
export type HouseholdBudget = typeof householdBudgets.$inferSelect;
export type InsertHouseholdBudget = z.infer<typeof insertHouseholdBudgetSchema>;
export type HouseholdExpense = typeof householdExpenses.$inferSelect;
export type InsertHouseholdExpense = z.infer<typeof insertHouseholdExpenseSchema>;
