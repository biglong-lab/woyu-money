import { test, expect } from "@playwright/test"
import { waitForPageReady } from "./fixtures/helpers"

/**
 * 沙盤推演 2.0 E2E — 載入、情境調整存在
 */
test.describe("沙盤推演 2.0", () => {
  test("應載入沙盤並顯示情境調整", async ({ page }) => {
    await page.goto("/scenario-planner")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
    await expect(page.locator("body")).toContainText("情境調整")
  })
})
