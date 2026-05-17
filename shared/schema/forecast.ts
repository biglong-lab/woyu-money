/**
 * 收入預測資料快照（revenue_forecast_snapshots）
 *
 * 每天對「本月 / 下月 / 下下月」拍一張快照，記錄當下累積已實現 + 未來預訂金額。
 * 累積資料後可訓練「離月底 N 天 vs 最終實現」預測模型。
 *
 * 來源：
 * - pm-daily-snapshot：PM 的 daily_revenue_snapshots（已實現）
 * - pms-booking：PMS 系統未來預訂（待對接）
 * - manual：使用者手動 push
 */
import {
  pgTable,
  serial,
  integer,
  varchar,
  decimal,
  date,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

export const revenueForecastSnapshots = pgTable(
  "revenue_forecast_snapshots",
  {
    id: serial("id").primaryKey(),

    snapshotDate: date("snapshot_date").notNull(), // YYYY-MM-DD 拍快照那天
    companyId: integer("company_id"), // PM company_id（NULL = 合計）

    targetMonth: varchar("target_month", { length: 7 }).notNull(), // YYYY-MM

    // 累積金額
    accumulatedRevenue: decimal("accumulated_revenue", { precision: 14, scale: 2 })
      .notNull()
      .default("0"), // 該月已實現累積
    bookedRevenue: decimal("booked_revenue", { precision: 14, scale: 2 }).notNull().default("0"), // 該月未來預訂

    // 統計
    daysAheadOfTarget: integer("days_ahead_of_target"), // 距離 targetMonth 月底還幾天

    source: varchar("source", { length: 30 }).notNull(), // pm-daily-snapshot / pms-booking / manual
    notes: varchar("notes", { length: 500 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // 同一日 + 同公司 + 同目標月 + 同 source 只能一筆（避免重複拍）
    snapshotUniq: unique("forecast_snap_uniq_idx").on(
      table.snapshotDate,
      table.companyId,
      table.targetMonth,
      table.source
    ),
    targetIdx: index("forecast_snap_target_idx").on(table.targetMonth),
    snapshotDateIdx: index("forecast_snap_date_idx").on(table.snapshotDate),
  })
)

export const insertRevenueForecastSnapshotSchema = createInsertSchema(
  revenueForecastSnapshots
).omit({
  id: true,
  createdAt: true,
})

export type RevenueForecastSnapshot = typeof revenueForecastSnapshots.$inferSelect
export type InsertRevenueForecastSnapshot = z.infer<typeof insertRevenueForecastSnapshotSchema>
