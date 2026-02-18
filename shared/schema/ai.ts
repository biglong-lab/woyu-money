import {
  pgTable, text, serial, boolean, varchar, timestamp,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

// AI 助手設定表（單行全域設定，id 永遠為 1）
export const aiSettings = pgTable("ai_settings", {
  id: serial("id").primaryKey(),
  // API 提供商（預設 openrouter）
  apiProvider: varchar("api_provider", { length: 50 }).default("openrouter"),
  // API Key（明文存 DB，生產環境應考慮加密）
  apiKey: text("api_key"),
  // 選用的模型（OpenRouter model ID）
  selectedModel: varchar("selected_model", { length: 150 })
    .default("google/gemini-2.0-flash-exp:free"),
  // 是否啟用 AI 助手浮動按鈕
  isEnabled: boolean("is_enabled").default(true),
  // 自訂系統提示詞補充（可選）
  systemPromptExtra: text("system_prompt_extra"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const insertAiSettingsSchema = createInsertSchema(aiSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const updateAiSettingsSchema = insertAiSettingsSchema.partial()

export type AiSettings = typeof aiSettings.$inferSelect
export type InsertAiSettings = z.infer<typeof insertAiSettingsSchema>
