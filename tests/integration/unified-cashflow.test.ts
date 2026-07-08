/**
 * 統一現金流匯總層 — 整合測試
 *
 * 驗證三個消費端把 強執繳款 / 歷史欠款還款 / 卡請款到帳 接進統一報表：
 * - GET /api/reports/cash-flow   營業活動含兩個獨立負項 + 卡請款參考欄位
 * - GET /api/dashboard/ytd       月度 breakdown 含兩個新分類（actual）
 * - GET /api/dashboard/month-detail  兩個新分類可點開看逐筆
 * - GET /api/cashflow/forecast   缺口分析含強執分期未來投影
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"
import { db } from "../../server/db"
import { sql } from "drizzle-orm"
import {
  ENFORCEMENT_CATEGORY,
  LEGACY_DEBT_CATEGORY,
} from "../../server/services/unified-cashflow.service"

const skipIfNoDb = !process.env.DATABASE_URL

const MARK = "__unified_cf_test_" + Date.now()
const ENF_AMOUNT = 4321
const DEBT_AMOUNT = 1234
const CARD_AMOUNT = 777
const MONTHLY = 5000

async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    const r = req as typeof req & {
      user: { id: number; username: string; isActive: boolean }
      isAuthenticated: () => boolean
      session: Record<string, unknown>
    }
    r.user = { id: 1, username: "admin", isActive: true }
    r.isAuthenticated = () => true
    r.session = { userId: 1, isAuthenticated: true }
    next()
  })
  const reportRoutes = (await import("../../server/routes/reports")).default
  const dashboardRoutes = (await import("../../server/routes/dashboard")).default
  const cashflowRoutes = (await import("../../server/routes/cashflow-forecast")).default
  app.use(reportRoutes)
  app.use(dashboardRoutes)
  app.use(cashflowRoutes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("統一現金流匯總層", () => {
  let app: Express
  let installmentId: number
  let debtId: number

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const currentMonth = `${year}-${String(month).padStart(2, "0")}`
  const payDate = `${currentMonth}-05`

  beforeAll(async () => {
    app = await createTestApp()

    // 強執分期（active、無期數上限）+ 本月一筆實繳
    const inst = await db.execute(sql`
      INSERT INTO enforcement_installments (plan_name, monthly_amount, day_of_month, status, notes)
      VALUES (${MARK}, ${MONTHLY}, 10, 'active', ${MARK})
      RETURNING id
    `)
    installmentId = Number((inst as unknown as { rows: { id: number }[] }).rows[0].id)
    await db.execute(sql`
      INSERT INTO enforcement_installment_payments (installment_id, payment_date, amount, notes)
      VALUES (${installmentId}, ${payDate}, ${ENF_AMOUNT}, ${MARK})
    `)

    // 歷史欠款 + 本月一筆還款
    const debt = await db.execute(sql`
      INSERT INTO legacy_debts (amount, creditor, status, note)
      VALUES (99999, ${MARK}, 'open', ${MARK})
      RETURNING id
    `)
    debtId = Number((debt as unknown as { rows: { id: number }[] }).rows[0].id)
    await db.execute(sql`
      INSERT INTO legacy_debt_payments (debt_id, amount, pay_date, note)
      VALUES (${debtId}, ${DEBT_AMOUNT}, ${payDate}, ${MARK})
    `)

    // 信用卡請款（本月已到帳）
    await db.execute(sql`
      INSERT INTO card_claims (amount, swipe_date, status, settled_amount, settled_date, notes)
      VALUES (${CARD_AMOUNT + 100}, ${payDate}, 'settled', ${CARD_AMOUNT}, ${payDate}, ${MARK})
    `)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM enforcement_installment_payments WHERE notes = ${MARK}`)
    await db.execute(sql`DELETE FROM enforcement_installments WHERE notes = ${MARK}`)
    await db.execute(sql`DELETE FROM legacy_debt_payments WHERE note = ${MARK}`)
    await db.execute(sql`DELETE FROM legacy_debts WHERE note = ${MARK}`)
    await db.execute(sql`DELETE FROM card_claims WHERE notes = ${MARK}`)
  })

  it("現金流量表：營業活動含強執/欠款負項、卡請款列參考不入總計", async () => {
    const res = await request(app).get(`/api/reports/cash-flow?year=${year}&month=${month}`)
    expect(res.status).toBe(200)

    const items = res.body.operating.items as Array<{ category: string; amount: number }>
    const enf = items.find((i) => i.category === ENFORCEMENT_CATEGORY)
    const debt = items.find((i) => i.category === LEGACY_DEBT_CATEGORY)
    expect(enf).toBeDefined()
    expect(enf!.amount).toBeLessThanOrEqual(-ENF_AMOUNT)
    expect(debt).toBeDefined()
    expect(debt!.amount).toBeLessThanOrEqual(-DEBT_AMOUNT)

    // 總計 = 各項相加（強執/欠款已扣進去）
    const sum = items.reduce((s, i) => s + i.amount, 0)
    expect(res.body.operating.total).toBeCloseTo(sum, 1)

    // 卡請款到帳只在 reference、不影響 netCashFlow 組成
    expect(res.body.reference.cardClaimSettled).toBeGreaterThanOrEqual(CARD_AMOUNT)
    expect(res.body.netCashFlow).toBeCloseTo(
      res.body.operating.total + res.body.investing.total + res.body.financing.total,
      1
    )
  })

  it("儀表板 YTD：本月 breakdown 含兩個新分類（actual）", async () => {
    const res = await request(app).get("/api/dashboard/ytd")
    expect(res.status).toBe(200)

    const monthBreakdown = res.body.breakdown[currentMonth]
    expect(monthBreakdown).toBeDefined()
    const expenseCategories = monthBreakdown.expense as Array<{
      category: string
      actual: number
    }>
    const enf = expenseCategories.find((c) => c.category === ENFORCEMENT_CATEGORY)
    const debt = expenseCategories.find((c) => c.category === LEGACY_DEBT_CATEGORY)
    expect(enf).toBeDefined()
    expect(enf!.actual).toBeGreaterThanOrEqual(ENF_AMOUNT)
    expect(debt).toBeDefined()
    expect(debt!.actual).toBeGreaterThanOrEqual(DEBT_AMOUNT)

    // 月度 expenseActual 也要涵蓋（不只 breakdown）
    const monthRow = (res.body.months as Array<{ month: string; expenseActual: number }>).find(
      (m) => m.month === currentMonth
    )
    expect(monthRow).toBeDefined()
    expect(monthRow!.expenseActual).toBeGreaterThanOrEqual(ENF_AMOUNT + DEBT_AMOUNT)
  })

  it("month-detail：兩個新分類可點開看逐筆", async () => {
    const enfRes = await request(app).get(
      `/api/dashboard/month-detail?month=${currentMonth}&category=${encodeURIComponent(ENFORCEMENT_CATEGORY)}`
    )
    expect(enfRes.status).toBe(200)
    expect(enfRes.body.source).toBe("enforcement_installment_payments")
    const enfItems = enfRes.body.items as Array<{ notes: string | null; amount: string }>
    expect(enfItems.some((i) => i.notes === MARK && Number(i.amount) === ENF_AMOUNT)).toBe(true)

    const debtRes = await request(app).get(
      `/api/dashboard/month-detail?month=${currentMonth}&category=${encodeURIComponent(LEGACY_DEBT_CATEGORY)}`
    )
    expect(debtRes.status).toBe(200)
    expect(debtRes.body.source).toBe("legacy_debt_payments")
    const debtItems = debtRes.body.items as Array<{ notes: string | null; amount: string }>
    expect(debtItems.some((i) => i.notes === MARK && Number(i.amount) === DEBT_AMOUNT)).toBe(true)
  })

  it("現金流預測：強執分期投影進未來月支出（移除後總支出下降 >= 月付額×剩餘月數）", async () => {
    const before = await request(app).get("/api/cashflow/forecast?monthsAhead=6")
    expect(before.status).toBe(200)

    // 停掉分期 → 投影消失
    await db.execute(
      sql`UPDATE enforcement_installments SET status = 'done' WHERE id = ${installmentId}`
    )
    const after = await request(app).get("/api/cashflow/forecast?monthsAhead=6")
    expect(after.status).toBe(200)
    // 還原（afterAll 才刪）
    await db.execute(
      sql`UPDATE enforcement_installments SET status = 'active' WHERE id = ${installmentId}`
    )

    type Gap = { year: number; month: number; estimatedExpense: number }
    const sumExpense = (gaps: Gap[]) => gaps.reduce((s, g) => s + g.estimatedExpense, 0)
    const diff = sumExpense(before.body.gapAnalysis) - sumExpense(after.body.gapAnalysis)
    // 視窗 6 個月每月投影 MONTHLY → 差額應為 6 × MONTHLY
    expect(diff).toBeGreaterThanOrEqual(MONTHLY * 6 - 1)
  })
})
