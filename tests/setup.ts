/**
 * 測試環境設定
 * 在所有測試前執行
 */
import dotenv from "dotenv"

// 立即載入環境變數（在模組頂層，不在 beforeAll 裡）
dotenv.config()
