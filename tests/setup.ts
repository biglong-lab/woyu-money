/**
 * 測試環境設定
 * 在所有測試前執行
 */
import dotenv from "dotenv"

// 立即載入環境變數（在模組頂層，不在 beforeAll 裡）
dotenv.config()

// 測試決定性（2026-07-04）：關閉 family-kids approve 的 15% 隨機驚喜獎勵。
// 沒有這個，斷言固定三罐分配（70/20/10）的測試每輪 ~15% 機率翻倍失敗 —
// 這就是全套/pre-push 偶發紅燈的真根因（105=+50%、210=+200% 皆為 bonus tier）。
process.env.FAMILY_KIDS_NO_BONUS = "1"
