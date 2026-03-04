/**
 * Financial Reports API 整合測試
 *
 * 覆蓋範圍：
 *  - server/storage/financial-reports.ts（損益表、資產負債表、現金流量表、人事費報表、稅務報表）
 *  - server/storage/reports.ts（智慧報表、報表匯出）
 *  - server/routes/reports.ts（財務三表 + 人事費 + 稅務路由）
 *  - server/routes/analytics.ts 中的 /api/reports/intelligent、/api/reports/export
 */
import { describe, it, expect, beforeAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const skipIfNoDb = !process.env.DATABASE_URL

// ── 建立測試用 App（包含 reports + analytics 路由） ──────────

async function createTestApp(): Promise<Express> {
  const express = (await import("express")).default
  const app = express()
  app.use(express.json())

  // 模擬已登入使用者
  app.use((req, _res, next) => {
    const reqWithAuth = req as typeof req & {
      user: { id: number; username: string; isActive: boolean }
      isAuthenticated: () => boolean
      session: Record<string, unknown>
    }
    reqWithAuth.user = { id: 1, username: "admin", isActive: true }
    reqWithAuth.isAuthenticated = () => true
    reqWithAuth.session = { userId: 1, isAuthenticated: true }
    next()
  })

  // 掛載報表路由
  const reportRoutes = (await import("../../server/routes/reports")).default
  app.use(reportRoutes)

  // 掛載分析路由（包含智慧報表、匯出報表端點）
  const analyticsRoutes = (await import("../../server/routes/analytics")).default
  app.use(analyticsRoutes)

  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

// ================================================================
// 損益表
// ================================================================

describe.skipIf(skipIfNoDb)("Financial Reports API", () => {
  let app: Express

  beforeAll(async () => {
    app = await createTestApp()
  })

  // ── 損益表 ────────────────────────────────────────────────────

  describe("GET /api/reports/income-statement - 損益表", () => {
    it("帶 year/month 參數應回傳指定月份損益表", async () => {
      const res = await request(app)
        .get("/api/reports/income-statement?year=2026&month=1")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("year", 2026)
      expect(res.body).toHaveProperty("month", 1)
      expect(res.body).toHaveProperty("income")
      expect(res.body).toHaveProperty("expense")
      expect(res.body).toHaveProperty("netIncome")
    })

    it("income / expense 結構應包含 items 陣列與 total", async () => {
      const res = await request(app)
        .get("/api/reports/income-statement?year=2026&month=2")
        .expect(200)

      expect(res.body.income).toHaveProperty("items")
      expect(res.body.income).toHaveProperty("total")
      expect(Array.isArray(res.body.income.items)).toBe(true)

      expect(res.body.expense).toHaveProperty("items")
      expect(res.body.expense).toHaveProperty("total")
      expect(Array.isArray(res.body.expense.items)).toBe(true)
    })

    it("netIncome 應等於收入減支出", async () => {
      const res = await request(app)
        .get("/api/reports/income-statement?year=2026&month=3")
        .expect(200)

      const expected = res.body.income.total - res.body.expense.total
      expect(res.body.netIncome).toBeCloseTo(expected, 2)
    })

    it("不帶參數應使用當前年月", async () => {
      const res = await request(app).get("/api/reports/income-statement").expect(200)

      const now = new Date()
      expect(res.body.year).toBe(now.getFullYear())
      expect(res.body.month).toBe(now.getMonth() + 1)
    })

    it("收入項目應包含 category 與 amount", async () => {
      const res = await request(app)
        .get("/api/reports/income-statement?year=2025&month=6")
        .expect(200)

      for (const item of res.body.income.items) {
        expect(item).toHaveProperty("category")
        expect(item).toHaveProperty("amount")
        expect(typeof item.amount).toBe("number")
      }
    })

    it("不同月份的數據應可能不同", async () => {
      const res1 = await request(app)
        .get("/api/reports/income-statement?year=2026&month=1")
        .expect(200)
      const res2 = await request(app)
        .get("/api/reports/income-statement?year=2026&month=6")
        .expect(200)

      // 兩個月份的結構相同，但年月欄位不同
      expect(res1.body.month).toBe(1)
      expect(res2.body.month).toBe(6)
    })
  })

  // ── 資產負債表 ────────────────────────────────────────────────

  describe("GET /api/reports/balance-sheet - 資產負債表", () => {
    it("帶 year/month 應回傳資產負債表", async () => {
      const res = await request(app)
        .get("/api/reports/balance-sheet?year=2026&month=1")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("year", 2026)
      expect(res.body).toHaveProperty("month", 1)
      expect(res.body).toHaveProperty("assets")
      expect(res.body).toHaveProperty("liabilities")
      expect(res.body).toHaveProperty("netWorth")
    })

    it("assets 應包含 items 陣列與 total", async () => {
      const res = await request(app).get("/api/reports/balance-sheet?year=2026&month=2").expect(200)

      expect(res.body.assets).toHaveProperty("items")
      expect(res.body.assets).toHaveProperty("total")
      expect(Array.isArray(res.body.assets.items)).toBe(true)
    })

    it("liabilities 應包含 items 陣列與 total", async () => {
      const res = await request(app).get("/api/reports/balance-sheet?year=2026&month=2").expect(200)

      expect(res.body.liabilities).toHaveProperty("items")
      expect(res.body.liabilities).toHaveProperty("total")
      expect(Array.isArray(res.body.liabilities.items)).toBe(true)
    })

    it("netWorth 應等於資產減負債", async () => {
      const res = await request(app).get("/api/reports/balance-sheet?year=2026&month=1").expect(200)

      const expected = res.body.assets.total - res.body.liabilities.total
      expect(res.body.netWorth).toBeCloseTo(expected, 2)
    })

    it("不帶參數應使用當前年月", async () => {
      const res = await request(app).get("/api/reports/balance-sheet").expect(200)

      const now = new Date()
      expect(res.body.year).toBe(now.getFullYear())
      expect(res.body.month).toBe(now.getMonth() + 1)
    })

    it("assets items 應包含累計現金淨額和應收帳款", async () => {
      const res = await request(app).get("/api/reports/balance-sheet?year=2026&month=1").expect(200)

      const categories = res.body.assets.items.map((i: { category: string }) => i.category)
      expect(categories).toContain("累計現金淨額")
      expect(categories).toContain("應收帳款（租金）")
    })

    it("liabilities items 應包含應付帳款、借入款項、未付人事費", async () => {
      const res = await request(app).get("/api/reports/balance-sheet?year=2026&month=1").expect(200)

      const categories = res.body.liabilities.items.map((i: { category: string }) => i.category)
      expect(categories).toContain("應付帳款")
      expect(categories).toContain("借入款項")
      expect(categories).toContain("未付人事費")
    })
  })

  // ── 現金流量表 ────────────────────────────────────────────────

  describe("GET /api/reports/cash-flow - 現金流量表", () => {
    it("帶 year/month 應回傳現金流量表", async () => {
      const res = await request(app)
        .get("/api/reports/cash-flow?year=2026&month=1")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("year", 2026)
      expect(res.body).toHaveProperty("month", 1)
      expect(res.body).toHaveProperty("operating")
      expect(res.body).toHaveProperty("investing")
      expect(res.body).toHaveProperty("financing")
      expect(res.body).toHaveProperty("netCashFlow")
    })

    it("operating 應包含營業收入與營業支出", async () => {
      const res = await request(app).get("/api/reports/cash-flow?year=2026&month=2").expect(200)

      expect(res.body.operating).toHaveProperty("items")
      expect(res.body.operating).toHaveProperty("total")
      const categories = res.body.operating.items.map((i: { category: string }) => i.category)
      expect(categories).toContain("營業收入")
      expect(categories).toContain("營業支出")
    })

    it("investing 應包含投資收回與新增投資", async () => {
      const res = await request(app).get("/api/reports/cash-flow?year=2026&month=2").expect(200)

      expect(res.body.investing).toHaveProperty("items")
      expect(res.body.investing).toHaveProperty("total")
      const categories = res.body.investing.items.map((i: { category: string }) => i.category)
      expect(categories).toContain("投資收回")
      expect(categories).toContain("新增投資")
    })

    it("financing 應包含借入款項與償還借款", async () => {
      const res = await request(app).get("/api/reports/cash-flow?year=2026&month=2").expect(200)

      expect(res.body.financing).toHaveProperty("items")
      expect(res.body.financing).toHaveProperty("total")
      const categories = res.body.financing.items.map((i: { category: string }) => i.category)
      expect(categories).toContain("借入款項")
      expect(categories).toContain("償還借款")
    })

    it("netCashFlow 應等於三大活動加總", async () => {
      const res = await request(app).get("/api/reports/cash-flow?year=2026&month=1").expect(200)

      const expected =
        res.body.operating.total + res.body.investing.total + res.body.financing.total
      expect(res.body.netCashFlow).toBeCloseTo(expected, 2)
    })

    it("不帶參數應使用當前年月", async () => {
      const res = await request(app).get("/api/reports/cash-flow").expect(200)

      const now = new Date()
      expect(res.body.year).toBe(now.getFullYear())
      expect(res.body.month).toBe(now.getMonth() + 1)
    })
  })

  // ── 人事費年度報表 ────────────────────────────────────────────

  describe("GET /api/reports/hr-cost-report - 人事費年度報表", () => {
    it("應回傳年度報表結構", async () => {
      const res = await request(app)
        .get("/api/reports/hr-cost-report?year=2026")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("year", 2026)
      expect(res.body).toHaveProperty("monthlyBreakdown")
      expect(res.body).toHaveProperty("yearTotal")
      expect(Array.isArray(res.body.monthlyBreakdown)).toBe(true)
    })

    it("yearTotal 應包含薪資、保費、退休金、總成本", async () => {
      const res = await request(app).get("/api/reports/hr-cost-report?year=2026").expect(200)

      const { yearTotal } = res.body
      expect(yearTotal).toHaveProperty("salaryTotal")
      expect(yearTotal).toHaveProperty("insuranceTotal")
      expect(yearTotal).toHaveProperty("pensionTotal")
      expect(yearTotal).toHaveProperty("totalCost")
    })

    it("monthlyBreakdown 各月份應包含必要欄位", async () => {
      const res = await request(app).get("/api/reports/hr-cost-report?year=2026").expect(200)

      for (const monthData of res.body.monthlyBreakdown) {
        expect(monthData).toHaveProperty("month")
        expect(monthData).toHaveProperty("employeeCount")
        expect(monthData).toHaveProperty("salaryTotal")
        expect(monthData).toHaveProperty("insuranceTotal")
        expect(monthData).toHaveProperty("pensionTotal")
        expect(monthData).toHaveProperty("totalCost")
        expect(typeof monthData.month).toBe("number")
      }
    })

    it("yearTotal.totalCost 應等於各月 totalCost 加總", async () => {
      const res = await request(app).get("/api/reports/hr-cost-report?year=2026").expect(200)

      const sumFromMonths = res.body.monthlyBreakdown.reduce(
        (sum: number, m: { totalCost: number }) => sum + m.totalCost,
        0
      )
      expect(res.body.yearTotal.totalCost).toBeCloseTo(sumFromMonths, 2)
    })

    it("不帶參數應使用當前年份", async () => {
      const res = await request(app).get("/api/reports/hr-cost-report").expect(200)

      expect(res.body.year).toBe(new Date().getFullYear())
    })
  })

  // ── 人事費月度明細 ────────────────────────────────────────────

  describe("GET /api/reports/hr-cost-report/:year/:month - 人事費月度明細", () => {
    it("應回傳月度明細陣列", async () => {
      const res = await request(app)
        .get("/api/reports/hr-cost-report/2026/1")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(Array.isArray(res.body)).toBe(true)
    })

    it("每筆明細應包含員工薪資與保費欄位", async () => {
      const res = await request(app).get("/api/reports/hr-cost-report/2026/2").expect(200)

      for (const detail of res.body) {
        expect(detail).toHaveProperty("employeeName")
        expect(detail).toHaveProperty("baseSalary")
        expect(detail).toHaveProperty("insuredSalary")
        expect(detail).toHaveProperty("employerLaborInsurance")
        expect(detail).toHaveProperty("employerHealthInsurance")
        expect(detail).toHaveProperty("employerPension")
        expect(detail).toHaveProperty("employerTotal")
        expect(detail).toHaveProperty("employeeTotal")
        expect(detail).toHaveProperty("netSalary")
        expect(detail).toHaveProperty("totalCost")
        expect(detail).toHaveProperty("isPaid")
      }
    })

    it("不同月份的資料應可獨立查詢", async () => {
      const [res1, res2] = await Promise.all([
        request(app).get("/api/reports/hr-cost-report/2026/1").expect(200),
        request(app).get("/api/reports/hr-cost-report/2026/3").expect(200),
      ])

      expect(Array.isArray(res1.body)).toBe(true)
      expect(Array.isArray(res2.body)).toBe(true)
    })
  })

  // ── 營業稅彙總 ───────────────────────────────────────────────

  describe("GET /api/reports/tax/business-tax - 營業稅彙總", () => {
    it("應回傳營業稅報表結構", async () => {
      const res = await request(app)
        .get("/api/reports/tax/business-tax?year=2026&period=1")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("year", 2026)
      expect(res.body).toHaveProperty("period", 1)
      expect(res.body).toHaveProperty("periodLabel")
      expect(res.body).toHaveProperty("sales")
      expect(res.body).toHaveProperty("purchases")
      expect(res.body).toHaveProperty("taxPayable")
      expect(res.body).toHaveProperty("taxRate", 0.05)
    })

    it("sales 應包含 items、total、tax", async () => {
      const res = await request(app)
        .get("/api/reports/tax/business-tax?year=2026&period=1")
        .expect(200)

      expect(res.body.sales).toHaveProperty("items")
      expect(res.body.sales).toHaveProperty("total")
      expect(res.body.sales).toHaveProperty("tax")
      expect(Array.isArray(res.body.sales.items)).toBe(true)
    })

    it("purchases 應包含 items、total、tax", async () => {
      const res = await request(app)
        .get("/api/reports/tax/business-tax?year=2026&period=1")
        .expect(200)

      expect(res.body.purchases).toHaveProperty("items")
      expect(res.body.purchases).toHaveProperty("total")
      expect(res.body.purchases).toHaveProperty("tax")
      expect(Array.isArray(res.body.purchases.items)).toBe(true)
    })

    it("taxPayable 應等於銷項稅減進項稅", async () => {
      const res = await request(app)
        .get("/api/reports/tax/business-tax?year=2026&period=2")
        .expect(200)

      const expected = res.body.sales.tax - res.body.purchases.tax
      expect(res.body.taxPayable).toBe(expected)
    })

    it("period 1 的 periodLabel 應為 1-2月", async () => {
      const res = await request(app)
        .get("/api/reports/tax/business-tax?year=2026&period=1")
        .expect(200)

      expect(res.body.periodLabel).toBe("1-2月")
    })

    it("period 6 的 periodLabel 應為 11-12月", async () => {
      const res = await request(app)
        .get("/api/reports/tax/business-tax?year=2026&period=6")
        .expect(200)

      expect(res.body.periodLabel).toBe("11-12月")
    })

    it("不帶 period 應預設為 1", async () => {
      const res = await request(app).get("/api/reports/tax/business-tax?year=2026").expect(200)

      expect(res.body.period).toBe(1)
    })

    it("sales items 項目應包含 category、invoiceCount、amount", async () => {
      const res = await request(app)
        .get("/api/reports/tax/business-tax?year=2026&period=1")
        .expect(200)

      for (const item of res.body.sales.items) {
        expect(item).toHaveProperty("category")
        expect(item).toHaveProperty("invoiceCount")
        expect(item).toHaveProperty("amount")
        expect(typeof item.invoiceCount).toBe("number")
        expect(typeof item.amount).toBe("number")
      }
    })
  })

  // ── 薪資扣繳彙總 ─────────────────────────────────────────────

  describe("GET /api/reports/tax/salary-withholding - 薪資扣繳彙總", () => {
    it("應回傳薪資扣繳報表結構", async () => {
      const res = await request(app)
        .get("/api/reports/tax/salary-withholding?year=2026")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("year", 2026)
      expect(res.body).toHaveProperty("employees")
      expect(res.body).toHaveProperty("totals")
      expect(Array.isArray(res.body.employees)).toBe(true)
    })

    it("employees 每筆應包含扣繳相關欄位", async () => {
      const res = await request(app)
        .get("/api/reports/tax/salary-withholding?year=2026")
        .expect(200)

      for (const emp of res.body.employees) {
        expect(emp).toHaveProperty("employeeName")
        expect(emp).toHaveProperty("totalSalary")
        expect(emp).toHaveProperty("totalLaborInsurance")
        expect(emp).toHaveProperty("totalHealthInsurance")
        expect(emp).toHaveProperty("totalPension")
        expect(emp).toHaveProperty("totalDeduction")
        expect(emp).toHaveProperty("totalNetSalary")
        expect(emp).toHaveProperty("monthsWorked")
      }
    })

    it("totals 應包含合計欄位", async () => {
      const res = await request(app)
        .get("/api/reports/tax/salary-withholding?year=2026")
        .expect(200)

      expect(res.body.totals).toHaveProperty("totalSalary")
      expect(res.body.totals).toHaveProperty("totalDeduction")
      expect(res.body.totals).toHaveProperty("totalNetSalary")
    })

    it("totals.totalSalary 應等於所有員工 totalSalary 加總", async () => {
      const res = await request(app)
        .get("/api/reports/tax/salary-withholding?year=2026")
        .expect(200)

      const sumFromEmployees = res.body.employees.reduce(
        (sum: number, e: { totalSalary: number }) => sum + e.totalSalary,
        0
      )
      expect(res.body.totals.totalSalary).toBeCloseTo(sumFromEmployees, 2)
    })

    it("不帶參數應使用當前年份", async () => {
      const res = await request(app).get("/api/reports/tax/salary-withholding").expect(200)

      expect(res.body.year).toBe(new Date().getFullYear())
    })
  })

  // ── 二代健保補充保費試算 ──────────────────────────────────────

  describe("GET /api/reports/tax/supplementary-health - 二代健保補充保費", () => {
    it("應回傳二代健保報表結構", async () => {
      const res = await request(app)
        .get("/api/reports/tax/supplementary-health?year=2026")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("year", 2026)
      expect(res.body).toHaveProperty("supplementaryRate", 0.0211)
      expect(res.body).toHaveProperty("baseWageThreshold", 27470)
      expect(res.body).toHaveProperty("employees")
      expect(res.body).toHaveProperty("totalPremium")
      expect(res.body).toHaveProperty("note")
      expect(Array.isArray(res.body.employees)).toBe(true)
    })

    it("employees 每筆應包含試算欄位", async () => {
      const res = await request(app)
        .get("/api/reports/tax/supplementary-health?year=2026")
        .expect(200)

      for (const emp of res.body.employees) {
        expect(emp).toHaveProperty("employeeName")
        expect(emp).toHaveProperty("avgMonthlySalary")
        expect(emp).toHaveProperty("estimatedBonus")
        expect(emp).toHaveProperty("taxableAmount")
        expect(emp).toHaveProperty("supplementaryPremium")
        expect(typeof emp.supplementaryPremium).toBe("number")
      }
    })

    it("totalPremium 應等於所有員工 supplementaryPremium 加總", async () => {
      const res = await request(app)
        .get("/api/reports/tax/supplementary-health?year=2026")
        .expect(200)

      const sumFromEmployees = res.body.employees.reduce(
        (sum: number, e: { supplementaryPremium: number }) => sum + e.supplementaryPremium,
        0
      )
      expect(res.body.totalPremium).toBe(sumFromEmployees)
    })

    it("taxableAmount 不應為負數", async () => {
      const res = await request(app)
        .get("/api/reports/tax/supplementary-health?year=2026")
        .expect(200)

      for (const emp of res.body.employees) {
        expect(emp.taxableAmount).toBeGreaterThanOrEqual(0)
      }
    })

    it("不帶參數應使用當前年份", async () => {
      const res = await request(app).get("/api/reports/tax/supplementary-health").expect(200)

      expect(res.body.year).toBe(new Date().getFullYear())
    })
  })

  // ── 智慧報表 ─────────────────────────────────────────────────

  describe("GET /api/reports/intelligent - 智慧報表", () => {
    it("應回傳智慧報表結構", async () => {
      const res = await request(app)
        .get("/api/reports/intelligent")
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("monthlyTrends")
      expect(res.body).toHaveProperty("categoryBreakdown")
      expect(res.body).toHaveProperty("cashFlowForecast")
      expect(res.body).toHaveProperty("kpis")
    })

    it("monthlyTrends 應為陣列且每項包含 month/planned/actual/variance", async () => {
      const res = await request(app)
        .get("/api/reports/intelligent?period=monthly&reportType=overview")
        .expect(200)

      expect(Array.isArray(res.body.monthlyTrends)).toBe(true)
      for (const trend of res.body.monthlyTrends) {
        expect(trend).toHaveProperty("month")
        expect(trend).toHaveProperty("planned")
        expect(trend).toHaveProperty("actual")
        expect(trend).toHaveProperty("variance")
      }
    })

    it("categoryBreakdown 每項應包含 name/value/percentage/color", async () => {
      const res = await request(app).get("/api/reports/intelligent").expect(200)

      expect(Array.isArray(res.body.categoryBreakdown)).toBe(true)
      for (const cat of res.body.categoryBreakdown) {
        expect(cat).toHaveProperty("name")
        expect(cat).toHaveProperty("value")
        expect(cat).toHaveProperty("percentage")
        expect(cat).toHaveProperty("color")
      }
    })

    it("cashFlowForecast 每項應包含 date/projected/confidence", async () => {
      const res = await request(app).get("/api/reports/intelligent").expect(200)

      expect(Array.isArray(res.body.cashFlowForecast)).toBe(true)
      for (const forecast of res.body.cashFlowForecast) {
        expect(forecast).toHaveProperty("date")
        expect(forecast).toHaveProperty("projected")
        expect(forecast).toHaveProperty("confidence")
      }
    })

    it("kpis 應包含全部績效指標", async () => {
      const res = await request(app).get("/api/reports/intelligent").expect(200)

      const { kpis } = res.body
      expect(kpis).toHaveProperty("totalPlanned")
      expect(kpis).toHaveProperty("totalPaid")
      expect(kpis).toHaveProperty("completionRate")
      expect(kpis).toHaveProperty("averageAmount")
      expect(kpis).toHaveProperty("overdueItems")
      expect(kpis).toHaveProperty("monthlyVariance")
    })

    it("帶 period=quarterly 參數也應正常回傳", async () => {
      const res = await request(app).get("/api/reports/intelligent?period=quarterly").expect(200)

      expect(res.body).toHaveProperty("kpis")
    })
  })

  // ── 報表匯出 ─────────────────────────────────────────────────

  describe("POST /api/reports/export - 報表匯出", () => {
    it("應回傳匯出結果", async () => {
      const res = await request(app)
        .post("/api/reports/export")
        .send({
          format: "csv",
          reportType: "income-statement",
          filters: { year: 2026, month: 1 },
        })
        .expect("Content-Type", /json/)
        .expect(200)

      expect(res.body).toHaveProperty("filename")
      expect(res.body).toHaveProperty("downloadUrl")
      expect(res.body).toHaveProperty("size")
      expect(res.body).toHaveProperty("format", "csv")
    })

    it("filename 應包含 reportType", async () => {
      const res = await request(app)
        .post("/api/reports/export")
        .send({
          format: "xlsx",
          reportType: "balance-sheet",
          filters: {},
        })
        .expect(200)

      expect(res.body.filename).toContain("balance-sheet")
    })

    it("downloadUrl 應以 /api/downloads/ 開頭", async () => {
      const res = await request(app)
        .post("/api/reports/export")
        .send({
          format: "pdf",
          reportType: "cash-flow",
          filters: {},
        })
        .expect(200)

      expect(res.body.downloadUrl).toMatch(/^\/api\/downloads\//)
    })

    it("匯出格式應與 request 一致", async () => {
      const formats = ["csv", "xlsx", "pdf"]

      for (const format of formats) {
        const res = await request(app)
          .post("/api/reports/export")
          .send({ format, reportType: "test", filters: {} })
          .expect(200)

        expect(res.body.format).toBe(format)
        expect(res.body.filename).toContain(`.${format}`)
      }
    })
  })

  // ── 邊界情境：跨年、特殊月份 ──────────────────────────────────

  describe("邊界情境測試", () => {
    it("損益表查詢 12 月應正確處理跨年", async () => {
      const res = await request(app)
        .get("/api/reports/income-statement?year=2025&month=12")
        .expect(200)

      expect(res.body.year).toBe(2025)
      expect(res.body.month).toBe(12)
    })

    it("現金流量表查詢 12 月應正確處理跨年", async () => {
      const res = await request(app).get("/api/reports/cash-flow?year=2025&month=12").expect(200)

      expect(res.body.year).toBe(2025)
      expect(res.body.month).toBe(12)
    })

    it("資產負債表查詢 12 月應正確處理跨年", async () => {
      const res = await request(app)
        .get("/api/reports/balance-sheet?year=2025&month=12")
        .expect(200)

      expect(res.body.year).toBe(2025)
      expect(res.body.month).toBe(12)
    })

    it("營業稅第 6 期（11-12月）應正確處理", async () => {
      const res = await request(app)
        .get("/api/reports/tax/business-tax?year=2025&period=6")
        .expect(200)

      expect(res.body.period).toBe(6)
      expect(res.body.periodLabel).toBe("11-12月")
    })

    it("遠未來的年份也應正常回傳（空資料）", async () => {
      const res = await request(app)
        .get("/api/reports/income-statement?year=2099&month=1")
        .expect(200)

      expect(res.body.year).toBe(2099)
      // 遠未來可能仍有固定費用記錄，只驗證結構正確
      expect(typeof res.body.income.total).toBe("number")
      expect(typeof res.body.expense.total).toBe("number")
    })

    it("過去的年份也應正常回傳", async () => {
      const res = await request(app).get("/api/reports/hr-cost-report?year=2020").expect(200)

      expect(res.body.year).toBe(2020)
      expect(Array.isArray(res.body.monthlyBreakdown)).toBe(true)
    })
  })
})
