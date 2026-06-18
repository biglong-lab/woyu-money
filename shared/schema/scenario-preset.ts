import { pgTable, serial, varchar, jsonb, timestamp } from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

// 沙盤推演情境（存後端、跨裝置；levers 為三軸調整參數）
export const scenarioPresets = pgTable("scenario_presets", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 60 }).notNull(),
  levers: jsonb("levers").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const insertScenarioPresetSchema = createInsertSchema(scenarioPresets)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    name: z.string().trim().min(1, "情境名稱不可空白").max(60),
    levers: z.record(z.unknown()),
  })

export type ScenarioPreset = typeof scenarioPresets.$inferSelect
export type InsertScenarioPreset = z.infer<typeof insertScenarioPresetSchema>
