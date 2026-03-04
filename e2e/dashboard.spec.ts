import { test, expect } from "@playwright/test"
import { waitForPageReady } from "./fixtures/helpers"

/**
 * 付款首頁（儀表板）E2E 測試
 * storageState 由 playwright.config.ts 自動注入認證狀態
 */
test.describe("付款首頁", () => {
  test("應正確載入首頁內容", async ({ page }) => {
    await page.goto("/")
    await waitForPageReady(page)

    // 首頁應顯示主要內容區塊（非登入頁）
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("頂部導航列應正確顯示", async ({ page }) => {
    await page.goto("/")
    await waitForPageReady(page)

    // 導航列應存在
    const nav = page.locator("nav").first()
    await expect(nav).toBeVisible()
  })

  test("應能導航到主要功能頁面", async ({ page }) => {
    // 測試導航到付款記錄頁
    await page.goto("/payment-records")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")

    // 測試導航到分類管理頁
    await page.goto("/categories")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("搜尋功能應可操作", async ({ page }) => {
    await page.goto("/")
    await waitForPageReady(page)

    const searchInput = page.getByPlaceholder("搜尋").first()
    if (await searchInput.isVisible()) {
      await searchInput.fill("測試")
      await page.waitForTimeout(500)
      await expect(searchInput).toHaveValue("測試")
    }
  })
})
