import { defineConfig, devices } from "@playwright/test"
import path from "path"
import { fileURLToPath } from "url"

/**
 * Playwright E2E 測試配置
 * 使用 Chromium 進行關鍵流程端對端測試
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE_STATE = path.join(__dirname, "e2e", ".auth-state.json")

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [["html", { outputFolder: "e2e-report" }], ["list"]],
  timeout: 30000,

  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL: "http://localhost:5001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // 未認證測試（登入頁面、未登入重導等）
    {
      name: "unauthenticated",
      testMatch: /auth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // 已認證測試（使用全局登入狀態）
    {
      name: "authenticated",
      testIgnore: /auth\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:5001",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      NODE_ENV: "development",
    },
  },
})
