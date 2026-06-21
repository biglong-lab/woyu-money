/**
 * 今日財務提醒 service — getTodayAlerts
 * 驗證請款逾期未到帳 / 排程到期 訊號
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { db } from "../../server/db"
import { sql } from "drizzle-orm"

const skipIfNoDb = !process.env.DATABASE_URL

describe.skipIf(skipIfNoDb)("alerts.service getTodayAlerts", () => {
  let claimId: number
  let itemId: number

  beforeAll(async () => {
    // 逾 14 天未到帳的請款
    const c = await db.execute(sql`
      INSERT INTO card_claims (amount, swipe_date, status)
      VALUES ('9999', CURRENT_DATE - INTERVAL '30 days', 'pending')
      RETURNING id
    `)
    claimId = (c as unknown as { rows: Array<{ id: number }> }).rows[0].id

    // 今天到期的排程
    const i = await db.execute(sql`
      INSERT INTO payment_items (item_name, total_amount, item_type, payment_type, start_date, status)
      VALUES ('__alert_test', '5000', 'project', 'single', CURRENT_DATE, 'pending')
      RETURNING id
    `)
    itemId = (i as unknown as { rows: Array<{ id: number }> }).rows[0].id
    await db.execute(sql`
      INSERT INTO payment_schedules (payment_item_id, scheduled_date, scheduled_amount, status)
      VALUES (${itemId}, CURRENT_DATE, '5000', 'scheduled')
    `)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM payment_schedules WHERE payment_item_id = ${itemId}`)
    await db.execute(sql`DELETE FROM payment_items WHERE id = ${itemId}`)
    await db.execute(sql`DELETE FROM card_claims WHERE id = ${claimId}`)
  })

  it("聚合出請款逾期未到帳與排程到期提醒", async () => {
    const { getTodayAlerts } = await import("../../server/services/alerts.service")
    const alerts = await getTodayAlerts()
    expect(alerts.some((a) => a.type === "claim_unsettled")).toBe(true)
    expect(alerts.some((a) => a.type === "schedule_due")).toBe(true)
    // 嚴重度排序：critical 在前
    const order = { critical: 0, warn: 1, info: 2 } as const
    for (let i = 1; i < alerts.length; i++) {
      expect(order[alerts[i].severity]).toBeGreaterThanOrEqual(order[alerts[i - 1].severity])
    }
  })
})
