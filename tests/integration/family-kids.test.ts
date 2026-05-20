/**
 * 家庭記帳「小孩模式」API 測試
 * 涵蓋：accounts CRUD + PIN 登入 + 任務 approve 三罐分配 + 目標 + 徽章
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
  const routes = (await import("../../server/routes/family-kids")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Family Kids API", () => {
  let app: Express
  let kidId: number
  const TEST_PIN = "9871" // 不易撞到生產資料

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterEach(async () => {
    // 每個 test 後清測試小孩（cascade 會清 jars/tasks/goals/badges）
    if (kidId) {
      await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${kidId}`)
      kidId = 0
    }
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
  })

  async function createKid(
    overrides: Partial<{
      displayName: string
      spendRatio: number
      saveRatio: number
      giveRatio: number
    }> = {}
  ) {
    const res = await request(app)
      .post("/api/family/kids")
      .send({
        displayName: overrides.displayName ?? "測試小孩",
        avatar: "🧒",
        color: "blue",
        pin: TEST_PIN,
        spendRatio: overrides.spendRatio ?? 70,
        saveRatio: overrides.saveRatio ?? 20,
        giveRatio: overrides.giveRatio ?? 10,
      })
    expect(res.status).toBe(201)
    kidId = res.body.id
    return res.body
  }

  it("新增小孩 + 自動建 jars row + PIN 登入", async () => {
    await createKid()

    // jars 應該自動建立
    const jars = await db.execute(sql`SELECT * FROM kids_jars WHERE kid_id = ${kidId}`)
    expect((jars as unknown as { rows: unknown[] }).rows.length).toBe(1)

    // PIN 登入應成功
    const login = await request(app).post("/api/family/kids/pin-login").send({ pin: TEST_PIN })
    expect(login.status).toBe(200)
    expect(login.body.id).toBe(kidId)
    expect(login.body.displayName).toBe("測試小孩")
  })

  it("三罐比例總和非 100 應拒絕", async () => {
    const res = await request(app).post("/api/family/kids").send({
      displayName: "X",
      avatar: "🧒",
      color: "blue",
      pin: "9999",
      spendRatio: 50,
      saveRatio: 30,
      giveRatio: 30,
    })
    expect(res.status).toBe(400)
  })

  it("錯誤 PIN 登入回 404", async () => {
    await createKid()
    const res = await request(app).post("/api/family/kids/pin-login").send({ pin: "0000" })
    expect(res.status).toBe(404)
  })

  it("派任務 + 小孩 submit + 家長 approve 自動三罐分配", async () => {
    await createKid({ spendRatio: 70, saveRatio: 20, giveRatio: 10 })

    // 派任務
    const tres = await request(app).post("/api/family/tasks").send({
      kidId,
      title: "洗碗",
      emoji: "🍽️",
      rewardAmount: 100,
    })
    expect(tres.status).toBe(201)
    const taskId = tres.body.id

    // submit
    const sres = await request(app).post(`/api/family/tasks/${taskId}/submit`)
    expect(sres.status).toBe(200)
    expect(sres.body.status).toBe("submitted")

    // approve → 三罐分配 70/20/10 = 70 / 20 / 10
    const ares = await request(app).post(`/api/family/tasks/${taskId}/approve`)
    expect(ares.status).toBe(200)
    expect(ares.body.task.status).toBe("approved")
    expect(ares.body.jars.spendAdd).toBe(70)
    expect(ares.body.jars.saveAdd).toBe(20)
    expect(ares.body.jars.giveAdd).toBe(10)
    expect(ares.body.newBadges).toContain("first_task")

    // jars DB 驗證
    const jar = (
      await db.execute(sql`
        SELECT spend_balance::numeric AS s, save_balance::numeric AS sv,
               give_balance::numeric AS g, total_received::numeric AS t
        FROM kids_jars WHERE kid_id = ${kidId}
      `)
    ).rows as unknown as { s: number; sv: number; g: number; t: number }[]
    expect(Number(jar[0].s)).toBe(70)
    expect(Number(jar[0].sv)).toBe(20)
    expect(Number(jar[0].g)).toBe(10)
    expect(Number(jar[0].t)).toBe(100)
  })

  it("駁回任務", async () => {
    await createKid()
    const tres = await request(app).post("/api/family/tasks").send({
      kidId,
      title: "測試",
      rewardAmount: 50,
    })
    await request(app).post(`/api/family/tasks/${tres.body.id}/submit`)
    const rres = await request(app)
      .post(`/api/family/tasks/${tres.body.id}/reject`)
      .send({ notes: "做得不好" })
    expect(rres.status).toBe(200)
    expect(rres.body.status).toBe("rejected")
  })

  it("存錢目標：建立 + 從 save 罐撥錢 + 達成觸發徽章", async () => {
    await createKid({ spendRatio: 0, saveRatio: 100, giveRatio: 0 })

    // 先派任務入帳 200（全進 save 罐）
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 200 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 建目標 150
    const g = await request(app).post("/api/family/goals").send({
      kidId,
      name: "玩具車",
      emoji: "🚗",
      targetAmount: 150,
    })
    expect(g.status).toBe(201)
    const goalId = g.body.id

    // 撥 100 進去（不達標）
    const s1 = await request(app).post(`/api/family/goals/${goalId}/save`).send({ amount: 100 })
    expect(s1.status).toBe(200)
    expect(s1.body.reached).toBe(false)

    // 撥剩 50（達標）
    const s2 = await request(app).post(`/api/family/goals/${goalId}/save`).send({ amount: 50 })
    expect(s2.status).toBe(200)
    expect(s2.body.reached).toBe(true)
    expect(s2.body.newBadges).toContain("first_goal")
  })

  it("save 餘額不足拒絕", async () => {
    await createKid({ spendRatio: 100, saveRatio: 0, giveRatio: 0 })
    const g = await request(app).post("/api/family/goals").send({
      kidId,
      name: "test",
      targetAmount: 100,
    })
    const res = await request(app).post(`/api/family/goals/${g.body.id}/save`).send({ amount: 50 })
    expect(res.status).toBe(400)
  })

  it("Dashboard 全家總覽 + 個別 kid 都正常", async () => {
    await createKid()
    const family = await request(app).get("/api/family/dashboard")
    expect(family.status).toBe(200)
    expect(family.body.scope).toBe("family")
    expect(Array.isArray(family.body.kids)).toBe(true)

    const kid = await request(app).get(`/api/family/dashboard?kidId=${kidId}`)
    expect(kid.status).toBe(200)
    expect(kid.body.scope).toBe("kid")
    expect(kid.body.kid.id).toBe(kidId)
    expect(kid.body.jar).toBeTruthy()
    expect(Array.isArray(kid.body.tasks)).toBe(true)
    expect(Array.isArray(kid.body.goals)).toBe(true)
    expect(Array.isArray(kid.body.badges)).toBe(true)
  })

  it("任務範本 + batch 一鍵派", async () => {
    await createKid()
    const tpls = await request(app).get("/api/family/task-templates")
    expect(tpls.status).toBe(200)
    expect(Array.isArray(tpls.body)).toBe(true)
    expect(tpls.body.length).toBeGreaterThanOrEqual(5)

    const batch = await request(app)
      .post("/api/family/tasks/batch")
      .send({
        kidIds: [kidId],
        tasks: [
          { title: "洗碗", emoji: "🍽️", rewardAmount: 50 },
          { title: "倒垃圾", emoji: "🗑️", rewardAmount: 30 },
        ],
      })
    expect(batch.status).toBe(201)
    expect(batch.body.count).toBe(2)
  })

  it("approve 任務同時寫進主系統 payment_records", async () => {
    await createKid()
    const t = await request(app).post("/api/family/tasks").send({
      kidId,
      title: "測試入帳",
      rewardAmount: 80,
    })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    const ares = await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    expect(ares.status).toBe(200)
    expect(ares.body.mainSystem).toBeTruthy()
    expect(ares.body.mainSystem.synced).toBe(true)
    expect(ares.body.mainSystem.paymentItemId).toBeGreaterThan(0)
    expect(ares.body.mainSystem.paymentRecordId).toBeGreaterThan(0)

    // 清理測試寫入的 payment_items
    if (ares.body.mainSystem.paymentItemId) {
      await db.execute(
        sql`DELETE FROM payment_records WHERE payment_item_id = ${ares.body.mainSystem.paymentItemId}`
      )
      await db.execute(
        sql`DELETE FROM payment_items WHERE id = ${ares.body.mainSystem.paymentItemId}`
      )
    }
  })

  it("花錢紀錄 CRUD + 餘額扣除 / 退回", async () => {
    await createKid({ spendRatio: 100, saveRatio: 0, giveRatio: 0 })
    // 先派任務入 100 進 spend 罐
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "test", rewardAmount: 100 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    const ares = await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    // 清掉主系統測試資料
    if (ares.body.mainSystem?.paymentItemId) {
      await db.execute(
        sql`DELETE FROM payment_records WHERE payment_item_id = ${ares.body.mainSystem.paymentItemId}`
      )
      await db.execute(
        sql`DELETE FROM payment_items WHERE id = ${ares.body.mainSystem.paymentItemId}`
      )
    }

    // 花 30
    const sres = await request(app).post("/api/family/spendings").send({
      kidId,
      jar: "spend",
      amount: 30,
      description: "買飲料",
    })
    expect(sres.status).toBe(201)

    // 驗 spend_balance = 70
    const jar = (
      await db.execute(
        sql`SELECT spend_balance::numeric AS s FROM kids_jars WHERE kid_id = ${kidId}`
      )
    ).rows as unknown as { s: number }[]
    expect(Number(jar[0].s)).toBe(70)

    // 列表應該有
    const list = await request(app).get(`/api/family/spendings?kidId=${kidId}`)
    expect(list.status).toBe(200)
    expect(list.body.find((x: { id: number }) => x.id === sres.body.id)).toBeTruthy()

    // 餘額不足拒絕
    const overspend = await request(app).post("/api/family/spendings").send({
      kidId,
      jar: "spend",
      amount: 999,
      description: "貴的",
    })
    expect(overspend.status).toBe(400)

    // 刪除 → 退回
    await request(app).delete(`/api/family/spendings/${sres.body.id}`)
    const jar2 = (
      await db.execute(
        sql`SELECT spend_balance::numeric AS s FROM kids_jars WHERE kid_id = ${kidId}`
      )
    ).rows as unknown as { s: number }[]
    expect(Number(jar2[0].s)).toBe(100)
  })

  it("approve 任務時 bonus 欄位永遠存在（triggered 隨機）", async () => {
    // 設 env 關 bonus 確保不會 random fail
    const oldEnv = process.env.FAMILY_KIDS_NO_BONUS
    process.env.FAMILY_KIDS_NO_BONUS = "1"
    try {
      await createKid()
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: "T", rewardAmount: 100 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      const ares = await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
      expect(ares.status).toBe(200)
      expect(ares.body.bonus).toBeTruthy()
      expect(ares.body.bonus.triggered).toBe(false) // env 強制關
      expect(ares.body.bonus.baseAmount).toBe(100)
      expect(ares.body.bonus.bonusAmount).toBe(0)
      expect(ares.body.bonus.totalAmount).toBe(100)

      // 清主系統測試資料
      if (ares.body.mainSystem?.paymentItemId) {
        await db.execute(
          sql`DELETE FROM payment_records WHERE payment_item_id = ${ares.body.mainSystem.paymentItemId}`
        )
        await db.execute(
          sql`DELETE FROM payment_items WHERE id = ${ares.body.mainSystem.paymentItemId}`
        )
      }
    } finally {
      if (oldEnv === undefined) delete process.env.FAMILY_KIDS_NO_BONUS
      else process.env.FAMILY_KIDS_NO_BONUS = oldEnv
    }
  })

  it("逾期任務自動標 isOverdue + overdueDays + 排前面", async () => {
    await createKid()
    // 建一個 5 天前到期的任務
    const past = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)
    await request(app).post("/api/family/tasks").send({
      kidId,
      title: "已逾期任務",
      rewardAmount: 50,
      dueDate: past,
    })
    // 建一個未來才到期的任務
    const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    await request(app).post("/api/family/tasks").send({
      kidId,
      title: "未來任務",
      rewardAmount: 50,
      dueDate: future,
    })
    const list = await request(app).get(`/api/family/tasks?kidId=${kidId}`)
    expect(list.status).toBe(200)
    const overdue = list.body.find((t: { title: string }) => t.title === "已逾期任務")
    const futureT = list.body.find((t: { title: string }) => t.title === "未來任務")
    expect(overdue.isOverdue).toBe(true)
    expect(overdue.overdueDays).toBe(5)
    expect(futureT.isOverdue).toBe(false)
    // 逾期應排前面
    const idxOverdue = list.body.findIndex((t: { title: string }) => t.title === "已逾期任務")
    const idxFuture = list.body.findIndex((t: { title: string }) => t.title === "未來任務")
    expect(idxOverdue).toBeLessThan(idxFuture)
  })

  it("已 approve 的逾期任務不算 isOverdue", async () => {
    await createKid()
    const past = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "已完成", rewardAmount: 30, dueDate: past })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    const ares = await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    // 清測試
    if (ares.body.mainSystem?.paymentItemId) {
      await db.execute(
        sql`DELETE FROM payment_records WHERE payment_item_id = ${ares.body.mainSystem.paymentItemId}`
      )
      await db.execute(
        sql`DELETE FROM payment_items WHERE id = ${ares.body.mainSystem.paymentItemId}`
      )
    }
    const list = await request(app).get(`/api/family/tasks?kidId=${kidId}`)
    const done = list.body.find((t: { title: string }) => t.title === "已完成")
    expect(done.isOverdue).toBe(false)
  })

  it("軟刪除小孩（isActive=false）", async () => {
    await createKid()
    const res = await request(app).delete(`/api/family/kids/${kidId}`)
    expect(res.status).toBe(200)

    const list = await request(app).get("/api/family/kids")
    expect(list.body.find((k: { id: number }) => k.id === kidId)).toBeFalsy()
  })
})
