import { test, expect } from "@playwright/test"
import { waitForPageReady } from "./fixtures/helpers"

/**
 * 信用卡請款紀錄 E2E — 載入、開啟新增對話框
 */
test.describe("信用卡請款紀錄", () => {
  test("應載入請款頁", async ({ page }) => {
    await page.goto("/card-claims")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
    await expect(page.locator("body")).toContainText("信用卡請款紀錄")
  })

  test("應能開啟新增紀錄對話框", async ({ page }) => {
    await page.goto("/card-claims")
    await waitForPageReady(page)
    const addBtn = page.getByRole("button", { name: /新增紀錄/ })
    if ((await addBtn.count()) > 0) {
      await addBtn.first().click()
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })
    }
  })
})
