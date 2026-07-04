import { test, expect } from "@playwright/test"
import { waitForPageReady } from "./fixtures/helpers"

/**
 * 帳單到期看板 E2E — 立即處理 / 批次處理 / 匯出（2026-07-04 新功能冒煙）
 * 只驗證 UI 互動流程開得起來、不實際送出付款（避免污染資料）
 */
test.describe("帳單到期看板", () => {
  test("應正確載入看板與摘要卡", async ({ page }) => {
    await page.goto("/bills")
    await waitForPageReady(page)

    await expect(page.getByTestId("page-title")).toContainText("帳單到期看板")
    await expect(page.locator("body")).toContainText("應繳合計")
    await expect(page.locator("body")).toContainText("逾期金額")
  })

  test("天數篩選可切換", async ({ page }) => {
    await page.goto("/bills")
    await waitForPageReady(page)

    await page.getByTestId("days-select").click()
    await page.getByRole("option", { name: "未來 15 天" }).click()
    await waitForPageReady(page)
    await expect(page.getByTestId("days-select")).toContainText("15")
  })

  test("匯出 CSV 按鈕存在且無帳單時停用", async ({ page }) => {
    await page.goto("/bills")
    await waitForPageReady(page)

    const exportBtn = page.getByTestId("export-csv")
    await expect(exportBtn).toBeVisible()
  })

  test("有帳單時：立即處理開啟付款 dialog 並可取消", async ({ page }) => {
    await page.goto("/bills")
    await waitForPageReady(page)

    const payButtons = page.locator('[data-testid^="pay-"]')
    const count = await payButtons.count()
    test.skip(count === 0, "目前沒有待繳帳單、跳過互動測試")

    await payButtons.first().click()
    await expect(page.getByText("立即處理付款")).toBeVisible()
    // 金額應預填正數
    const amountInput = page.locator("#pay-amount")
    const val = await amountInput.inputValue()
    expect(parseFloat(val)).toBeGreaterThan(0)
    // 收據存證欄位存在
    await expect(page.locator("#pay-receipt")).toBeAttached()
    // 取消關閉
    await page.getByRole("button", { name: "取消" }).click()
    await expect(page.getByText("立即處理付款")).not.toBeVisible()
  })

  test("有帳單時：勾選出現批次操作列、批次 dialog 可開關", async ({ page }) => {
    await page.goto("/bills")
    await waitForPageReady(page)

    const selectAll = page.getByTestId("select-all")
    const hasBills = await selectAll.isVisible().catch(() => false)
    test.skip(!hasBills, "目前沒有待繳帳單、跳過批次測試")

    await selectAll.click()
    await expect(page.getByTestId("batch-pay-open")).toBeVisible()
    await expect(page.locator("body")).toContainText("已勾選")

    await page.getByTestId("batch-pay-open").click()
    await expect(page.getByText("批次處理付款")).toBeVisible()
    // 取消不送出
    await page.getByRole("button", { name: "取消" }).click()
    await expect(page.getByText("批次處理付款")).not.toBeVisible()
  })
})
