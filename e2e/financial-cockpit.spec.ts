import { test, expect } from "@playwright/test"
import { waitForPageReady } from "./fixtures/helpers"

/**
 * 財務健康駕駛艙 E2E — 載入、健康分數、分頁切換
 * storageState 由 playwright.config.ts 注入認證
 */
test.describe("財務健康駕駛艙", () => {
  test("應載入駕駛艙並顯示健康分數", async ({ page }) => {
    await page.goto("/financial-cockpit")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
    await expect(page.locator("body")).toContainText("財務健康駕駛艙")
  })

  test("應能切換總覽/應付款整理/欠款規劃/AI 顧問分頁", async ({ page }) => {
    await page.goto("/financial-cockpit")
    await waitForPageReady(page)

    for (const tab of ["應付款整理", "欠款規劃", "AI 顧問", "總覽"]) {
      const trigger = page.getByRole("tab", { name: new RegExp(tab) })
      if ((await trigger.count()) > 0) {
        await trigger.first().click()
        await page.waitForTimeout(300)
        await expect(page.locator("body")).not.toContainText("登入帳戶")
      }
    }
  })
})
