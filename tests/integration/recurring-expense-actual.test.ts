/**
 * 階段 4：模板占位 → 實際金額（replaceScheduledWithActual）
 *
 * 測試重點：
 * - 占位項可成功更新為 paid + 新增 payment_record
 * - 一般項目（非 template_scheduled）拒絕
 * - 金額 / 日期格式驗證
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest"
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
  const routes = (await import("../../server/routes/recurring-expense-templates")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Recurring Expense — 占位 → 實際", () => {
  let app: Express
  let templateId: number
  let scheduledItemId: number
  let normalItemId: number

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterEach(async () => {
    // 清測試資料
    if (scheduledItemId) {
      await db.execute(sql`DELETE FROM payment_records WHERE payment_item_id = ${scheduledItemId}`)
      await db.execute(sql`DELETE FROM payment_items WHERE id = ${scheduledItemId}`)
    }
    if (normalItemId) {
      await db.execute(sql`DELETE FROM payment_items WHERE id = ${normalItemId}`)
    }
    if (templateId) {
      await db.execute(sql`DELETE FROM recurring_expense_templates WHERE id = ${templateId}`)
    }
  })

  async function setup() {
    const [tpl] = (
      await db.execute(sql`
        INSERT INTO recurring_expense_templates
          (template_name, estimated_amount, day_of_month, active_months, is_active, created_at, updated_at)
        VALUES ('測試模板', 10000, 10, '*', true, NOW(), NOW())
        RETURNING id
      `)
    ).rows as unknown as { id: number }[]
    templateId = tpl.id

    const [sch] = (
      await db.execute(sql`
        INSERT INTO payment_items
          (item_name, total_amount, item_type, payment_type, start_date,
           status, paid_amount, source, recurring_template_id, created_at, updated_at)
        VALUES ('測試占位 2099-12', 10000, 'project', 'single', '2099-12-10',
                'unpaid', 0, 'template_scheduled', ${templateId}, NOW(), NOW())
        RETURNING id
      `)
    ).rows as unknown as { id: number }[]
    scheduledItemId = sch.id

    const [norm] = (
      await db.execute(sql`
        INSERT INTO payment_items
          (item_name, total_amount, item_type, payment_type, start_date,
           status, paid_amount, source, created_at, updated_at)
        VALUES ('測試一般 2099-12', 5000, 'project', 'single', '2099-12-10',
                'unpaid', 0, 'manual', NOW(), NOW())
        RETURNING id
      `)
    ).rows as unknown as { id: number }[]
    normalItemId = norm.id
  }

  it("成功取代占位 → 實際金額", async () => {
    await setup()
    const res = await request(app)
      .post(`/api/recurring-expense-templates/replace-with-actual/${scheduledItemId}`)
      .send({ actualAmount: 12500, paymentDate: "2099-12-15", paymentMethod: "轉帳" })
    expect(res.status).toBe(200)
    expect(res.body.itemId).toBe(scheduledItemId)
    expect(res.body.estimatedAmount).toBe(10000)
    expect(res.body.diff).toBe(2500)
    expect(res.body.recordId).toBeGreaterThan(0)

    // 驗證 DB：item 變 paid + amount 改成 12500
    const rows = (
      await db.execute(
        sql`SELECT status, total_amount::numeric AS amt, paid_amount::numeric AS paid
            FROM payment_items WHERE id = ${scheduledItemId}`
      )
    ).rows as unknown as { status: string; amt: number; paid: number }[]
    expect(rows[0].status).toBe("paid")
    expect(Number(rows[0].amt)).toBe(12500)
    expect(Number(rows[0].paid)).toBe(12500)

    const recs = (
      await db.execute(
        sql`SELECT amount_paid::numeric AS amt, payment_date::text AS d, payment_method
            FROM payment_records WHERE payment_item_id = ${scheduledItemId}`
      )
    ).rows as unknown as { amt: number; d: string; payment_method: string }[]
    expect(recs.length).toBe(1)
    expect(Number(recs[0].amt)).toBe(12500)
    expect(recs[0].d).toBe("2099-12-15")
    expect(recs[0].payment_method).toBe("轉帳")
  })

  it("拒絕 source ≠ template_scheduled 的項目", async () => {
    await setup()
    const res = await request(app)
      .post(`/api/recurring-expense-templates/replace-with-actual/${normalItemId}`)
      .send({ actualAmount: 5000, paymentDate: "2099-12-15" })
    expect(res.status).toBe(400)
    expect(res.body.message || res.body.error).toMatch(/模板/)
  })

  it("拒絕無效金額", async () => {
    await setup()
    const res = await request(app)
      .post(`/api/recurring-expense-templates/replace-with-actual/${scheduledItemId}`)
      .send({ actualAmount: 0, paymentDate: "2099-12-15" })
    expect(res.status).toBe(400)
  })

  it("拒絕錯誤的日期格式", async () => {
    await setup()
    const res = await request(app)
      .post(`/api/recurring-expense-templates/replace-with-actual/${scheduledItemId}`)
      .send({ actualAmount: 10000, paymentDate: "2099/12/15" })
    expect(res.status).toBe(400)
  })

  it("link-item：把既有 payment_item 連結到模板（不改金額、可選 markPaid）", async () => {
    await setup()
    // 用 normalItem 模擬「未分類項目歸到模板」場景
    const res = await request(app)
      .post(`/api/recurring-expense-templates/${templateId}/link-item/${normalItemId}`)
      .send({ markPaid: true })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.templateName).toBe("測試模板")

    const rows = (
      await db.execute(
        sql`SELECT recurring_template_id AS tid, status, paid_amount::numeric AS paid,
                   total_amount::numeric AS amt, notes
            FROM payment_items WHERE id = ${normalItemId}`
      )
    ).rows as unknown as {
      tid: number
      status: string
      paid: number
      amt: number
      notes: string
    }[]
    expect(rows[0].tid).toBe(templateId)
    expect(rows[0].status).toBe("paid")
    expect(Number(rows[0].paid)).toBe(Number(rows[0].amt)) // markPaid → paidAmount = totalAmount
    expect(rows[0].notes).toContain("已連結模板")
  })

  it("link-item：不傳 markPaid 應保留原狀態", async () => {
    await setup()
    const res = await request(app)
      .post(`/api/recurring-expense-templates/${templateId}/link-item/${normalItemId}`)
      .send({})
    expect(res.status).toBe(200)

    const rows = (
      await db.execute(
        sql`SELECT status, paid_amount::numeric AS paid FROM payment_items WHERE id = ${normalItemId}`
      )
    ).rows as unknown as { status: string; paid: number }[]
    expect(rows[0].status).toBe("unpaid") // 原狀態保留
    expect(Number(rows[0].paid)).toBe(0)
  })

  it("link-item：模板不存在應 400", async () => {
    await setup()
    const res = await request(app)
      .post(`/api/recurring-expense-templates/999999/link-item/${normalItemId}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it("list scheduled items 可回傳占位項", async () => {
    await setup()
    const res = await request(app).get(
      `/api/recurring-expense-templates/scheduled-items?month=2099-12`
    )
    expect(res.status).toBe(200)
    expect(res.body.month).toBe("2099-12")
    const ours = res.body.items.find((it: { id: number }) => it.id === scheduledItemId)
    expect(ours).toBeTruthy()
    expect(ours.templateId).toBe(templateId)
    expect(ours.templateName).toBe("測試模板")
  })
})
