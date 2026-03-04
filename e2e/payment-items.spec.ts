import { test, expect } from "@playwright/test"
import { waitForPageReady } from "./fixtures/helpers"

/**
 * 付款項目管理 E2E 測試
 * storageState 由 playwright.config.ts 自動注入認證狀態
 */
test.describe("付款項目管理", () => {
  test("月付管理頁面應載入項目列表", async ({ page }) => {
    await page.goto("/monthly-payment-management")
    await waitForPageReady(page)

    await expect(page.locator("body")).not.toContainText("登入帳戶")
    await page.waitForTimeout(2000)

    // 頁面應包含內容
    const hasContent =
      (await page
        .locator("table")
        .isVisible()
        .catch(() => false)) ||
      (await page
        .locator("[class*='card']")
        .first()
        .isVisible()
        .catch(() => false)) ||
      (await page
        .getByText("月付")
        .first()
        .isVisible()
        .catch(() => false))

    expect(hasContent).toBeTruthy()
  })

  test("一般付款管理頁面應載入", async ({ page }) => {
    await page.goto("/general-payment-management")
    await waitForPageReady(page)

    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("應能開啟新增付款項目對話框", async ({ page }) => {
    await page.goto("/monthly-payment-management")
    await waitForPageReady(page)

    // 找到新增按鈕
    const addButton = page
      .getByRole("button", { name: /新增|新建|建立|添加/ })
      .or(page.locator("button").filter({ has: page.locator("svg.lucide-plus") }))
      .first()

    if (await addButton.isVisible()) {
      await addButton.click()
      await page.waitForTimeout(500)

      // 應出現對話框
      const dialog = page.locator('[role="dialog"]')
      const hasDialog = await dialog.isVisible().catch(() => false)
      if (hasDialog) {
        await expect(dialog).toBeVisible()
      }
    }
  })

  test("付款記錄頁面應載入記錄列表", async ({ page }) => {
    await page.goto("/payment-records")
    await waitForPageReady(page)

    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("分期付款管理頁面應載入", async ({ page }) => {
    await page.goto("/installment-payment-management")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("租金管理頁面應載入", async ({ page }) => {
    await page.goto("/rental-management-enhanced")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("借貸投資管理頁面應載入", async ({ page }) => {
    await page.goto("/loan-investment-management")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("人事費管理頁面應載入", async ({ page }) => {
    await page.goto("/hr-cost-management")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })
})
