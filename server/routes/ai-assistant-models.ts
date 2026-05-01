/**
 * OpenRouter 可用模型清單
 *
 * 抽出獨立檔案：避免測試（如 ai-assistant-extended.test.ts）
 * 在只想驗證模型常數時被迫 import 整個 ai-assistant.ts
 *（會 transitively import db.ts，無 DATABASE_URL 時崩潰）
 */

export interface AvailableModel {
  id: string
  name: string
  free: boolean
}

export const AVAILABLE_MODELS: AvailableModel[] = [
  // 付費模型（Function Calling 穩定，推薦）
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini（推薦，最划算）", free: false },
  { id: "deepseek/deepseek-chat", name: "DeepSeek Chat（便宜）", free: false },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku（快速）", free: false },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet（最強）", free: false },
  { id: "openai/gpt-4o", name: "GPT-4o（旗艦）", free: false },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", free: false },
  // 免費模型（Function Calling 較不穩定）
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B（免費，不穩定）",
    free: true,
  },
  { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B（免費，不穩定）", free: true },
]
