/**
 * 成本結構總覽 — /api/dashboard/cost-structure
 * 驗證 4 大區塊聚合與「不雙算」邏輯
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"
import { db } from "../../server/db"
import { sql } from "drizzle-orm"

const skipIfNoDb = !process.env.DATABASE_URL

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
  const routes = (await import("../../server/routes/cost-structure")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

const TEST_MONTH = "2099-10"
const TEST_YEAR = 2099
const TEST_MONTH_NUM = 10

describe.skipIf(skipIfNoDb)("Cost Structure API", () => {
  let app: Express
  let testEmployeeId: number
  const cleanupIds: { paymentItems: number[]; templates: number[] } = {
    paymentItems: [],
    templates: [],
  }

  beforeAll(async () => {
    app = await createTestApp()
    // 建一個測試員工（HR 測試會用）
    const emp = (
      await db.execute(sql`
        INSERT INTO employees
          (employee_name, position, monthly_salary, insured_salary, hire_date, is_active, created_at, updated_at)
        VALUES ('測試員工', '測試職位', 30000, 30000, '2099-01-01', true, NOW(), NOW())
        RETURNING id
      `)
    ).rows as unknown as { id: number }[]
    testEmployeeId = emp[0].id
  })

  afterEach(async () => {
    for (const id of cleanupIds.paymentItems) {
      await db.execute(sql`DELETE FROM payment_items WHERE id = ${id}`)
    }
    cleanupIds.paymentItems = []
    for (const id of cleanupIds.templates) {
      await db.execute(sql`DELETE FROM recurring_expense_templates WHERE id = ${id}`)
    }
    cleanupIds.templates = []
    await db.execute(
      sql`DELETE FROM monthly_hr_costs WHERE year = ${TEST_YEAR} AND month = ${TEST_MONTH_NUM}`
    )
  })

  afterAll(async () => {
    if (testEmployeeId) {
      await db.execute(sql`DELETE FROM employees WHERE id = ${testEmployeeId}`)
    }
  })

  it("回傳結構正確、含 4 區塊 + alerts + grand totals", async () => {
    const res = await request(app).get(`/api/dashboard/cost-structure?month=${TEST_MONTH}`)
    expect(res.status).toBe(200)
    expect(res.body.month).toBe(TEST_MONTH)
    expect(res.body).toHaveProperty("rental")
    expect(res.body).toHaveProperty("hr")
    expect(res.body).toHaveProperty("template")
    expect(res.body).toHaveProperty("manual")
    expect(res.body).toHaveProperty("alerts")
    expect(typeof res.body.grandTotal).toBe("number")
    expect(typeof res.body.grandActual).toBe("number")
    expect(typeof res.body.grandPlanned).toBe("number")
  })

  it("manual 區塊排除 template_scheduled / hr / 自動補建 / 含「租金」字樣", async () => {
    // 建一筆「乾淨的」manual 支出 + 兩筆「應被排除」的對照組
    const ins = (
      await db.execute(sql`
        INSERT INTO payment_items
          (item_name, total_amount, item_type, payment_type, start_date,
           status, paid_amount, source, created_at, updated_at)
        VALUES
          ('測試一般支出', 1500, 'project', 'single', ${`${TEST_MONTH}-10`}::date,
           'unpaid', 0, 'manual', NOW(), NOW()),
          ('測試模板占位', 9999, 'project', 'single', ${`${TEST_MONTH}-15`}::date,
           'unpaid', 0, 'template_scheduled', NOW(), NOW()),
          ('測試租金 2099-10', 8888, 'project', 'single', ${`${TEST_MONTH}-20`}::date,
           'unpaid', 0, 'manual', NOW(), NOW()),
          ('測試薪資', 7777, 'project', 'single', ${`${TEST_MONTH}-25`}::date,
           'unpaid', 0, 'manual', NOW(), NOW())
        RETURNING id
      `)
    ).rows as unknown as { id: number }[]
    cleanupIds.paymentItems.push(...ins.map((i) => i.id))

    const res = await request(app).get(`/api/dashboard/cost-structure?month=${TEST_MONTH}`)
    expect(res.status).toBe(200)
    // manual 只有「測試一般支出」$1500
    const manualNames = res.body.manual.items.map((i: { itemName: string }) => i.itemName)
    expect(manualNames).toContain("測試一般支出")
    expect(manualNames).not.toContain("測試模板占位")
    expect(manualNames).not.toContain("測試租金 2099-10")
    expect(manualNames).not.toContain("測試薪資")
  })

  it("template 區塊：active 模板列出該月應產 + 已產出 = generatedItems", async () => {
    // 建一個 active 模板（active_months='*'）
    const tpl = (
      await db.execute(sql`
        INSERT INTO recurring_expense_templates
          (template_name, estimated_amount, day_of_month, active_months, is_active, created_at, updated_at)
        VALUES ('測試水電模板', 3000, 10, '*', true, NOW(), NOW())
        RETURNING id
      `)
    ).rows as unknown as { id: number }[]
    cleanupIds.templates.push(tpl[0].id)

    // 該月「未產出占位」應出現在 notGenerated
    const res1 = await request(app).get(`/api/dashboard/cost-structure?month=${TEST_MONTH}`)
    const found = res1.body.template.notGenerated.find(
      (t: { templateId: number }) => t.templateId === tpl[0].id
    )
    expect(found).toBeTruthy()
    expect(found.estimatedAmount).toBe(3000)

    // 建一筆已產出占位
    const generated = (
      await db.execute(sql`
        INSERT INTO payment_items
          (item_name, total_amount, item_type, payment_type, start_date,
           status, paid_amount, source, recurring_template_id, created_at, updated_at)
        VALUES ('測試水電 占位', 3200, 'project', 'single', ${`${TEST_MONTH}-10`}::date,
                'unpaid', 0, 'template_scheduled', ${tpl[0].id}, NOW(), NOW())
        RETURNING id
      `)
    ).rows as unknown as { id: number }[]
    cleanupIds.paymentItems.push(generated[0].id)

    const res2 = await request(app).get(`/api/dashboard/cost-structure?month=${TEST_MONTH}`)
    // 已產出 → 該模板不再列在 notGenerated
    const stillNotGen = res2.body.template.notGenerated.find(
      (t: { templateId: number }) => t.templateId === tpl[0].id
    )
    expect(stillNotGen).toBeFalsy()
    // 而是在 generatedItems
    const inGen = res2.body.template.generatedItems.find(
      (g: { itemId: number }) => g.itemId === generated[0].id
    )
    expect(inGen).toBeTruthy()
    expect(inGen.templateId).toBe(tpl[0].id)
    expect(inGen.estimatedAmount).toBe(3200)
  })

  it("hr 區塊：monthly_hr_costs 該月紀錄會被聚合", async () => {
    await db.execute(sql`
      INSERT INTO monthly_hr_costs
        (year, month, employee_id, base_salary, insured_salary,
         employer_labor_insurance, employer_health_insurance, employer_pension,
         employer_employment_insurance, employer_accident_insurance, employer_total,
         employee_labor_insurance, employee_health_insurance, employee_pension, employee_total,
         net_salary, total_cost, is_paid)
      VALUES (${TEST_YEAR}, ${TEST_MONTH_NUM}, ${testEmployeeId}, 30000, 30000,
              0, 0, 0, 0, 0, 0,
              0, 0, 0, 0,
              30000, 30000, false)
    `)
    const res = await request(app).get(`/api/dashboard/cost-structure?month=${TEST_MONTH}`)
    expect(res.body.hr.total).toBeGreaterThanOrEqual(30000)
    expect(res.body.hr.unpaidCount).toBeGreaterThanOrEqual(1)
    expect(
      res.body.hr.items.find((h: { employeeId: number }) => h.employeeId === testEmployeeId)
    ).toBeTruthy()
  })

  it("alerts：HR 未發放會產生警示", async () => {
    await db.execute(sql`
      INSERT INTO monthly_hr_costs
        (year, month, employee_id, base_salary, insured_salary,
         employer_labor_insurance, employer_health_insurance, employer_pension,
         employer_employment_insurance, employer_accident_insurance, employer_total,
         employee_labor_insurance, employee_health_insurance, employee_pension, employee_total,
         net_salary, total_cost, is_paid)
      VALUES (${TEST_YEAR}, ${TEST_MONTH_NUM}, ${testEmployeeId}, 25000, 25000,
              0, 0, 0, 0, 0, 0,
              0, 0, 0, 0,
              25000, 25000, false)
    `)
    const res = await request(app).get(`/api/dashboard/cost-structure?month=${TEST_MONTH}`)
    const hrAlert = res.body.alerts.find((a: { type: string }) => a.type === "hr_unpaid")
    expect(hrAlert).toBeTruthy()
  })

  it("grandTotal = rental + hr + template + manual", async () => {
    const res = await request(app).get(`/api/dashboard/cost-structure?month=${TEST_MONTH}`)
    expect(res.body.grandTotal).toBe(
      res.body.rental.total + res.body.hr.total + res.body.template.total + res.body.manual.total
    )
  })

  it("rental matching：tenantName 空字串不該誤匹配所有合約（避免 .includes('') = true bug）", async () => {
    // 模擬：建一筆「2026-10 浯島文旅租約 $999999」，tenantName=空
    // 期望：合約金額用合約本身 base_amount、不被誤改成 $999999
    const ins = (
      await db.execute(sql`
        INSERT INTO payment_items
          (item_name, total_amount, item_type, payment_type, start_date,
           status, paid_amount, source, created_at, updated_at)
        VALUES ('2099-10-測試獨特租約 ' || ${Date.now()}, 999999, 'project', 'single',
                ${`${TEST_MONTH}-15`}::date, 'unpaid', 0, 'manual', NOW(), NOW())
        RETURNING id
      `)
    ).rows as unknown as { id: number }[]
    cleanupIds.paymentItems.push(ins[0].id)

    const res = await request(app).get(`/api/dashboard/cost-structure?month=${TEST_MONTH}`)
    // 任何合約（即使 tenantName 為空）都不該 match 到「測試獨特租約」這個無關項
    const inflated = res.body.rental.items.filter((r: { amount: number }) => r.amount === 999999)
    expect(inflated.length).toBe(0)
  })

  it("manual 排除：含「租金」分類 (category_id IN (2,28)) 即使 item_name 不含「租金」也排除", async () => {
    // 建一筆「2026-05-總兵招待所-軍友社 $57750」、category_id=2（租金）
    const ins = (
      await db.execute(sql`
        INSERT INTO payment_items
          (item_name, total_amount, item_type, payment_type, start_date,
           status, paid_amount, source, category_id, created_at, updated_at)
        VALUES ('2099-10-測試館租金歸入 ' || ${Date.now()}, 12345, 'project', 'single',
                ${`${TEST_MONTH}-10`}::date, 'unpaid', 0, 'manual', 2, NOW(), NOW())
        RETURNING id
      `)
    ).rows as unknown as { id: number }[]
    cleanupIds.paymentItems.push(ins[0].id)

    const res = await request(app).get(`/api/dashboard/cost-structure?month=${TEST_MONTH}`)
    const inManual = res.body.manual.items.find((m: { id: number }) => m.id === ins[0].id)
    expect(inManual).toBeFalsy() // 不該在 manual（因為 category_id=2=租金）
  })

  it("無 month 參數 fallback 本月（不會 500）", async () => {
    const res = await request(app).get("/api/dashboard/cost-structure")
    expect(res.status).toBe(200)
    expect(res.body.month).toMatch(/^\d{4}-\d{2}$/)
  })
})
