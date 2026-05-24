import { pgTable, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core"

// PM company_id ↔ project_id 對應表
// 2026-05-24 audit P4：取代 server/routes/property-pl.ts + pms-calibration.ts 兩處 hardcoded
export const pmCompanyMapping = pgTable(
  "pm_company_mapping",
  {
    projectId: integer("project_id").primaryKey(),
    companyId: integer("company_id").notNull().unique(),
    hotelName: text("hotel_name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("pm_company_mapping_company_idx").on(table.companyId),
  })
)

export type PmCompanyMapping = typeof pmCompanyMapping.$inferSelect
