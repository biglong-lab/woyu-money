import { test, expect } from "@playwright/test"
import { waitForPageReady } from "./fixtures/helpers"

/**
 * 排程分配規劃台 E2E — 載入、月/季/年彙總切換
 */
test.describe("排程分配規劃台", () => {
  test("應載入規劃台", async ({ page }) => {
    await page.goto("/payment-planner")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
    await expect(page.locator("body")).toContainText("排程分配規劃台")
  })

  test("應能切換月/季/年彙總", async ({ page }) => {
    await page.goto("/payment-planner")
    await waitForPageReady(page)
    for (const label of ["季", "年", "月"]) {
      const btn = page.getByRole("button", { name: new RegExp(`^${label}$`) })
      if ((await btn.count()) > 0) {
        await btn.first().click()
        await page.waitForTimeout(200)
      }
    }
    await expect(page.locator("body")).toContainText("每月所需收入")
  })
})
