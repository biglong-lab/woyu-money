import type { Page } from "@playwright/test"

/**
 * E2E 測試共用輔助函式
 */

/** 等待 API 回應完成 */
export async function waitForApi(page: Page, urlPattern: string) {
  return page.waitForResponse((resp) => resp.url().includes(urlPattern) && resp.status() === 200, {
    timeout: 10000,
  })
}

/** 等待頁面載入完成（含 API 資料） */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState("networkidle")
}

/** 檢查 toast 通知訊息 */
export async function expectToast(page: Page, text: string) {
  const toast = page.locator("[data-sonner-toast]", { hasText: text })
  await toast.waitFor({ timeout: 5000 })
}

/** 關閉所有對話框 */
export async function closeDialogs(page: Page) {
  const closeButton = page.locator('[data-state="open"] button[aria-label="Close"]')
  while ((await closeButton.count()) > 0) {
    await closeButton.first().click()
    await page.waitForTimeout(300)
  }
}
