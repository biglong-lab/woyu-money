import { test as base, expect, type Page } from "@playwright/test"

/**
 * 認證相關的測試 fixture
 * 提供已登入狀態的 page 供測試使用
 */

/** 預設測試帳號 */
const TEST_USER = {
  username: process.env.E2E_USERNAME || "admin",
  password: process.env.E2E_PASSWORD || "admin123",
}

/** 登入輔助函式 */
async function login(page: Page, username?: string, password?: string) {
  await page.goto("/auth")
  await page.waitForLoadState("networkidle")

  // 填入帳號密碼
  await page.getByPlaceholder("請輸入用戶名").fill(username || TEST_USER.username)
  await page.getByPlaceholder("請輸入密碼").fill(password || TEST_USER.password)

  // 點擊登入
  await page.getByRole("button", { name: "登入", exact: true }).click()

  // 等待 SPA 路由離開 /auth（等待登入表單消失）
  await expect(page.getByText("登入帳戶")).not.toBeVisible({ timeout: 15000 })

  // 等待頁面載入完成
  await page.waitForLoadState("networkidle")
}

/** 擴展 test fixture，提供已登入的 page */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, run) => {
    await login(page)
    await run(page)
  },
})

export { login, TEST_USER }
export { expect } from "@playwright/test"
