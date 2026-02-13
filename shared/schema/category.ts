import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// 分類表 - 統一分類系統（含模板支援）
export const debtCategories = pgTable("debt_categories", {
  id: serial("id").primaryKey(),
  categoryName: varchar("category_name", { length: 255 }).notNull(),
  categoryType: varchar("category_type", { length: 20 }).notNull().default("project"),
  description: text("description"),
  isTemplate: boolean("is_template").default(false),
  accountInfo: text("account_info"),
  templateNotes: text("template_notes"),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 付款專案表
export const paymentProjects = pgTable("payment_projects", {
  id: serial("id").primaryKey(),
  projectName: varchar("project_name", { length: 255 }).notNull(),
  projectType: varchar("project_type", { length: 50 }).notNull().default("general"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 固定分類表（電話費、電費、水費等）
export const fixedCategories = pgTable("fixed_categories", {
  id: serial("id").primaryKey(),
  categoryName: varchar("category_name", { length: 100 }).notNull(),
  categoryType: varchar("category_type", { length: 50 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// 固定分類子選項表（電話號碼、電號、水號等）
export const fixedCategorySubOptions = pgTable("fixed_category_sub_options", {
  id: serial("id").primaryKey(),
  fixedCategoryId: integer("fixed_category_id").notNull().references(() => fixedCategories.id),
  projectId: integer("project_id").notNull().references(() => paymentProjects.id),
  subOptionName: varchar("sub_option_name", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 專案分類模板表
export const projectCategoryTemplates = pgTable("project_category_templates", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => paymentProjects.id),
  categoryId: integer("category_id").references(() => debtCategories.id),
  templateName: varchar("template_name", { length: 255 }).notNull(),
  accountInfo: text("account_info"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 驗證 Schema
export const insertDebtCategorySchema = createInsertSchema(debtCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentProjectSchema = createInsertSchema(paymentProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFixedCategorySchema = createInsertSchema(fixedCategories).omit({
  id: true,
  createdAt: true,
});

export const insertFixedCategorySubOptionSchema = createInsertSchema(fixedCategorySubOptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectCategoryTemplateSchema = createInsertSchema(projectCategoryTemplates);

// 型別匯出
export type DebtCategory = typeof debtCategories.$inferSelect;
export type InsertDebtCategory = z.infer<typeof insertDebtCategorySchema>;
export type PaymentProject = typeof paymentProjects.$inferSelect;
export type InsertPaymentProject = z.infer<typeof insertPaymentProjectSchema>;
export type FixedCategory = typeof fixedCategories.$inferSelect;
export type InsertFixedCategory = z.infer<typeof insertFixedCategorySchema>;
export type FixedCategorySubOption = typeof fixedCategorySubOptions.$inferSelect;
export type InsertFixedCategorySubOption = z.infer<typeof insertFixedCategorySubOptionSchema>;
export type ProjectCategoryTemplate = typeof projectCategoryTemplates.$inferSelect;
export type InsertProjectCategoryTemplate = z.infer<typeof insertProjectCategoryTemplateSchema>;
