import { test, expect } from "@playwright/test"
import { waitForPageReady } from "./fixtures/helpers"

/**
 * 報表與分析 E2E 測試
 * storageState 由 playwright.config.ts 自動注入認證狀態
 */
test.describe("報表與分析", () => {
  test("財務總覽頁面應載入統計資料", async ({ page }) => {
    await page.goto("/financial-overview")
    await waitForPageReady(page)

    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("財務三表頁面應載入", async ({ page }) => {
    await page.goto("/financial-statements")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("稅務報表頁面應載入", async ({ page }) => {
    await page.goto("/tax-reports")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("人事費報表頁面應載入", async ({ page }) => {
    await page.goto("/hr-cost-reports")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("付款報表頁面應載入", async ({ page }) => {
    await page.goto("/payment/reports")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("收入分析頁面應載入", async ({ page }) => {
    await page.goto("/revenue/reports")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("付款分析頁面應載入", async ({ page }) => {
    await page.goto("/payment-analysis")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("專案預算管理頁面應載入", async ({ page }) => {
    await page.goto("/project-budget")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })
})
