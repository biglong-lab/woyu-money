import { pgTable, text, serial, integer, boolean, decimal, timestamp, date, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// 員工資料表
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeName: varchar("employee_name", { length: 100 }).notNull(),
  position: varchar("position", { length: 100 }),
  monthlySalary: decimal("monthly_salary", { precision: 10, scale: 2 }).notNull(),
  insuredSalary: decimal("insured_salary", { precision: 10, scale: 2 }),
  hireDate: date("hire_date").notNull(),
  terminationDate: date("termination_date"),
  dependentsCount: integer("dependents_count").default(0),
  voluntaryPensionRate: decimal("voluntary_pension_rate", { precision: 3, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 月度人事費彙總表
export const monthlyHrCosts = pgTable("monthly_hr_costs", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  baseSalary: decimal("base_salary", { precision: 10, scale: 2 }),
  insuredSalary: decimal("insured_salary", { precision: 10, scale: 2 }),
  employerLaborInsurance: decimal("employer_labor_insurance", { precision: 10, scale: 2 }),
  employerHealthInsurance: decimal("employer_health_insurance", { precision: 10, scale: 2 }),
  employerPension: decimal("employer_pension", { precision: 10, scale: 2 }),
  employerEmploymentInsurance: decimal("employer_employment_insurance", { precision: 10, scale: 2 }),
  employerAccidentInsurance: decimal("employer_accident_insurance", { precision: 10, scale: 2 }),
  employerTotal: decimal("employer_total", { precision: 10, scale: 2 }),
  employeeLaborInsurance: decimal("employee_labor_insurance", { precision: 10, scale: 2 }),
  employeeHealthInsurance: decimal("employee_health_insurance", { precision: 10, scale: 2 }),
  employeePension: decimal("employee_pension", { precision: 10, scale: 2 }),
  employeeTotal: decimal("employee_total", { precision: 10, scale: 2 }),
  netSalary: decimal("net_salary", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  isPaid: boolean("is_paid").default(false),
  insurancePaid: boolean("insurance_paid").default(false),
  paymentRecordId: integer("payment_record_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueYearMonthEmployee: index("monthly_hr_costs_unique_idx").on(table.year, table.month, table.employeeId),
  yearMonthIdx: index("monthly_hr_costs_year_month_idx").on(table.year, table.month),
}));

// 驗證 Schema
export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  monthlySalary: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  insuredSalary: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  voluntaryPensionRate: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  dependentsCount: z.union([z.string(), z.number()]).transform((val) => parseInt(val.toString())).optional(),
});

export const insertMonthlyHrCostSchema = createInsertSchema(monthlyHrCosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 型別匯出
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type MonthlyHrCost = typeof monthlyHrCosts.$inferSelect;
export type InsertMonthlyHrCost = z.infer<typeof insertMonthlyHrCostSchema>;
