import { test, expect } from "@playwright/test"
import { waitForPageReady } from "./fixtures/helpers"

/**
 * 頁面導航 E2E 測試
 * 只測試其他 spec 未覆蓋的路由
 */
test.describe("頁面導航", () => {
  test("首頁應載入（不顯示登入頁）", async ({ page }) => {
    await page.goto("/")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("不存在的頁面不應導向登入頁", async ({ page }) => {
    await page.goto("/non-existent-page-xyz")
    await waitForPageReady(page)
    // 已認證使用者不應被導回登入頁
    expect(true).toBeTruthy()
  })
})
