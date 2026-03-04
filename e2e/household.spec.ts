import { test, expect } from "@playwright/test"
import { waitForPageReady } from "./fixtures/helpers"

/**
 * 家庭預算 E2E 測試
 * storageState 由 playwright.config.ts 自動注入認證狀態
 */
test.describe("家庭預算", () => {
  test("家庭預算頁面應載入", async ({ page }) => {
    await page.goto("/household-budget")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("家庭分類管理頁面應載入", async ({ page }) => {
    await page.goto("/household-category-management")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })
})
