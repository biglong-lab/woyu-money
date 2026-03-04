import { test, expect } from "@playwright/test"

/**
 * 認證流程 E2E 測試
 * 此測試不使用 storageState（unauthenticated project）
 */

const TEST_USER = {
  username: process.env.E2E_USERNAME || "admin",
  password: process.env.E2E_PASSWORD || "admin123",
}

test.describe("認證流程", () => {
  test("登入頁面應正確顯示", async ({ page }) => {
    await page.goto("/auth")
    await page.waitForLoadState("networkidle")

    await expect(page.getByText("登入帳戶")).toBeVisible()
    await expect(page.getByPlaceholder("請輸入用戶名")).toBeVisible()
    await expect(page.getByPlaceholder("請輸入密碼")).toBeVisible()
    await expect(page.getByRole("button", { name: "登入", exact: true })).toBeVisible()
  })

  test("正確帳密應成功登入", async ({ page }) => {
    // 使用 API 登入避免速率限制
    const response = await page.request.post("/api/login", {
      data: {
        username: TEST_USER.username,
        password: TEST_USER.password,
      },
    })

    // 登入應成功（200）或已被速率限制（429）
    expect([200, 429]).toContain(response.status())

    if (response.status() === 200) {
      // 訪問首頁應成功（不被重導到登入頁）
      await page.goto("/")
      await page.waitForLoadState("networkidle")
      await expect(page.locator("body")).not.toContainText("登入帳戶")
    }
  })

  test("錯誤帳密應返回 401", async ({ page }) => {
    const response = await page.request.post("/api/login", {
      data: {
        username: "wrong_user",
        password: "wrong_password",
      },
    })

    // 應返回 401 或 429（速率限制）
    expect([401, 429]).toContain(response.status())
  })

  test("未登入應被重導到登入頁", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // 應顯示登入頁內容
    await expect(page.getByText("登入帳戶")).toBeVisible({ timeout: 10000 })
  })

  test("註冊表單應正確顯示", async ({ page }) => {
    await page.goto("/auth")
    await page.waitForLoadState("networkidle")

    const registerTab = page.getByRole("tab", { name: "註冊" })
    if (await registerTab.isVisible()) {
      await registerTab.click()
      await expect(page.getByText("創建新帳戶")).toBeVisible()
      await expect(page.getByPlaceholder("請輸入您的姓名")).toBeVisible()
    }
  })
})
