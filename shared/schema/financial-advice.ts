import { pgTable, serial, text, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core"

// AI 財務顧問建議歷史（每次產生存一筆，供回顧比對）
export const financialAdviceLog = pgTable(
  "financial_advice_log",
  {
    id: serial("id").primaryKey(),
    advice: text("advice").notNull(),
    model: varchar("model", { length: 100 }),
    snapshot: jsonb("snapshot"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    createdIdx: index("financial_advice_log_created_idx").on(table.createdAt),
  })
)

export type FinancialAdviceLog = typeof financialAdviceLog.$inferSelect
