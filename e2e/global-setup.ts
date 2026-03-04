import { chromium, type FullConfig } from "@playwright/test"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 全局設定：登入一次並儲存認證狀態
 * 所有需要認證的測試共用此狀態，避免重複登入觸發速率限制
 */

const TEST_USER = {
  username: process.env.E2E_USERNAME || "admin",
  password: process.env.E2E_PASSWORD || "admin123",
}

export const STORAGE_STATE_PATH = path.join(__dirname, ".auth-state.json")

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  // 直接呼叫 API 登入（避免 UI 和速率限制問題）
  const response = await page.request.post(`${baseURL}/api/login`, {
    data: {
      username: TEST_USER.username,
      password: TEST_USER.password,
    },
  })

  if (!response.ok()) {
    // 如果 API 也被限制，嘗試透過 UI 登入
    await page.goto(`${baseURL}/auth`)
    await page.waitForLoadState("networkidle")
    await page.getByPlaceholder("請輸入用戶名").fill(TEST_USER.username)
    await page.getByPlaceholder("請輸入密碼").fill(TEST_USER.password)
    await page.getByRole("button", { name: "登入", exact: true }).click()

    // 等待離開登入頁
    await page.waitForTimeout(3000)
  }

  // 儲存認證狀態（cookies + localStorage）
  await context.storageState({ path: STORAGE_STATE_PATH })

  await browser.close()
}

export default globalSetup
