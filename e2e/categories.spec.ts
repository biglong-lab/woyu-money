import { test, expect } from "@playwright/test"
import { waitForPageReady } from "./fixtures/helpers"

/**
 * 分類管理 E2E 測試
 * storageState 由 playwright.config.ts 自動注入認證狀態
 */
test.describe("分類管理", () => {
  test("分類頁面應載入分類列表", async ({ page }) => {
    await page.goto("/categories")
    await waitForPageReady(page)

    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("固定分類管理頁面應載入", async ({ page }) => {
    await page.goto("/category-management")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("專案模板管理頁面應載入", async ({ page }) => {
    await page.goto("/unified-project-template-management")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("專案付款管理頁面應載入", async ({ page }) => {
    await page.goto("/payment-project")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })
})
