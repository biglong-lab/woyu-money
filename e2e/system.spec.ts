import { test, expect } from "@playwright/test"
import { waitForPageReady } from "./fixtures/helpers"

/**
 * 系統管理 E2E 測試
 * storageState 由 playwright.config.ts 自動注入認證狀態
 */
test.describe("系統管理", () => {
  test("使用者管理頁面應載入（管理員）", async ({ page }) => {
    await page.goto("/user-management")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("回收站頁面應載入", async ({ page }) => {
    await page.goto("/recycle-bin")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("設定頁面應載入", async ({ page }) => {
    await page.goto("/settings")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("帳號設定頁面應載入", async ({ page }) => {
    await page.goto("/account")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("付款時間計劃頁面應載入", async ({ page }) => {
    await page.goto("/payment-schedule")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })

  test("單據收件箱頁面應載入", async ({ page }) => {
    await page.goto("/document-inbox")
    await waitForPageReady(page)
    await expect(page.locator("body")).not.toContainText("登入帳戶")
  })
})
