/**
 * AI 助手設定 Storage
 * 單行全域設定表（id=1），使用 upsert 確保只有一筆
 */
import { db } from "../db"
import { aiSettings } from "../../shared/schema/ai"
import { eq } from "drizzle-orm"
import type { AiSettings, InsertAiSettings } from "../../shared/schema/ai"

const SETTINGS_ID = 1

/** 取得 AI 設定（不存在則回傳預設值） */
export async function getAiSettings(): Promise<AiSettings> {
  const rows = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.id, SETTINGS_ID))
    .limit(1)

  if (rows.length > 0) return rows[0]

  // 初始化預設設定
  const inserted = await db
    .insert(aiSettings)
    .values({
      id: SETTINGS_ID,
      apiProvider: "openrouter",
      apiKey: null,
      selectedModel: "google/gemini-2.0-flash-exp:free",
      isEnabled: true,
      systemPromptExtra: null,
    })
    .returning()

  return inserted[0]
}

/** 更新 AI 設定（upsert） */
export async function updateAiSettings(
  data: Partial<InsertAiSettings>
): Promise<AiSettings> {
  // 確保記錄存在
  await getAiSettings()

  const updated = await db
    .update(aiSettings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(aiSettings.id, SETTINGS_ID))
    .returning()

  return updated[0]
}

/** 取得 AI 設定（API Key 遮蔽版，用於前端顯示） */
export async function getAiSettingsMasked(): Promise<
  Omit<AiSettings, "apiKey"> & { apiKeyMasked: string | null }
> {
  const settings = await getAiSettings()
  const { apiKey, ...rest } = settings

  let apiKeyMasked: string | null = null
  if (apiKey && apiKey.length > 8) {
    apiKeyMasked = apiKey.substring(0, 8) + "••••••••" + apiKey.slice(-4)
  } else if (apiKey) {
    apiKeyMasked = "••••••••"
  }

  return { ...rest, apiKeyMasked }
}
