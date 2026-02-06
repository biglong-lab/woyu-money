/**
 * 測試環境設定
 * 在所有測試前執行
 */
import { beforeAll } from "vitest"
import dotenv from "dotenv"

// 載入環境變數
beforeAll(() => {
  dotenv.config()
})
