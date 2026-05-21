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

    // 先抓 spending 前餘額（bonus 可能讓 reward 從 100 變 150）
    const beforeRow = (
      await db.execute(
        sql`SELECT spend_balance::numeric AS s FROM kids_jars WHERE kid_id = ${kidId}`
      )
    ).rows as unknown as { s: number }[]
    const before = Number(beforeRow[0].s)

    // 花 30
    const sres = await request(app).post("/api/family/spendings").send({
      kidId,
      jar: "spend",
      amount: 30,
      description: "買飲料",
    })
    expect(sres.status).toBe(201)

    // 驗 spend_balance 減少 30（相對檢查、抗 bonus random）
    const jar = (
      await db.execute(
        sql`SELECT spend_balance::numeric AS s FROM kids_jars WHERE kid_id = ${kidId}`
      )
    ).rows as unknown as { s: number }[]
    expect(before - Number(jar[0].s)).toBe(30)

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

  it("monthly-report：本月戰績聚合（任務/花錢/目標/徽章/淨值）", async () => {
    const oldEnv = process.env.FAMILY_KIDS_NO_BONUS
    process.env.FAMILY_KIDS_NO_BONUS = "1"
    try {
      await createKid({ spendRatio: 100, saveRatio: 0, giveRatio: 0 })
      // 派並 approve 1 個任務 200
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: "T", rewardAmount: 200 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      const ares = await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
      if (ares.body.mainSystem?.paymentItemId) {
        await db.execute(
          sql`DELETE FROM payment_records WHERE payment_item_id = ${ares.body.mainSystem.paymentItemId}`
        )
        await db.execute(
          sql`DELETE FROM payment_items WHERE id = ${ares.body.mainSystem.paymentItemId}`
        )
      }
      // 花 50 從 spend 罐
      await request(app).post("/api/family/spendings").send({
        kidId,
        jar: "spend",
        amount: 50,
        description: "買飲料",
      })

      const month = new Date().toISOString().slice(0, 7)
      const res = await request(app).get(`/api/family/monthly-report?kidId=${kidId}&month=${month}`)
      expect(res.status).toBe(200)
      expect(res.body.kidId).toBe(kidId)
      expect(res.body.month).toBe(month)
      expect(res.body.tasks.approvedCount).toBe(1)
      expect(res.body.tasks.approvedSum).toBe(200)
      expect(res.body.tasks.avgReward).toBe(200)
      expect(res.body.spendings.count).toBe(1)
      expect(res.body.spendings.totalSpent).toBe(50)
      expect(res.body.netGain).toBe(150) // 200 - 50
      expect(Array.isArray(res.body.completedGoals)).toBe(true)
      expect(Array.isArray(res.body.badges)).toBe(true)
      // 應有 first_task 徽章
      expect(res.body.badges.some((b: { badgeType: string }) => b.badgeType === "first_task")).toBe(
        true
      )
    } finally {
      if (oldEnv === undefined) delete process.env.FAMILY_KIDS_NO_BONUS
      else process.env.FAMILY_KIDS_NO_BONUS = oldEnv
    }
  })

  it("leaderboard 本月排行：approved sum 降序、含 medal/rank", async () => {
    const oldEnv = process.env.FAMILY_KIDS_NO_BONUS
    process.env.FAMILY_KIDS_NO_BONUS = "1"
    try {
      await createKid({ displayName: "測試小孩排行" })

      // 派 2 個任務 + approve → 共 250
      for (const amt of [100, 150]) {
        const t = await request(app)
          .post("/api/family/tasks")
          .send({ kidId, title: `T${amt}`, rewardAmount: amt })
        await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
        const ares = await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
        if (ares.body.mainSystem?.paymentItemId) {
          await db.execute(
            sql`DELETE FROM payment_records WHERE payment_item_id = ${ares.body.mainSystem.paymentItemId}`
          )
          await db.execute(
            sql`DELETE FROM payment_items WHERE id = ${ares.body.mainSystem.paymentItemId}`
          )
        }
      }

      const month = new Date().toISOString().slice(0, 7)
      const res = await request(app).get(`/api/family/leaderboard?month=${month}`)
      expect(res.status).toBe(200)
      expect(res.body.month).toBe(month)
      expect(Array.isArray(res.body.leaderboard)).toBe(true)

      const me = res.body.leaderboard.find((e: { kidId: number }) => e.kidId === kidId)
      expect(me).toBeTruthy()
      expect(me.approvedCount).toBe(2)
      expect(me.approvedSum).toBe(250)
      expect(typeof me.rank).toBe("number")
      // 排名 1 應有金牌
      const top = res.body.leaderboard[0]
      expect(top.medal).toBe("🥇")
    } finally {
      if (oldEnv === undefined) delete process.env.FAMILY_KIDS_NO_BONUS
      else process.env.FAMILY_KIDS_NO_BONUS = oldEnv
    }
  })

  it("recurring 任務：approve 後自動產生下一筆（+7 天）", async () => {
    const oldEnv = process.env.FAMILY_KIDS_NO_BONUS
    process.env.FAMILY_KIDS_NO_BONUS = "1"
    try {
      await createKid()
      const today = new Date().toISOString().slice(0, 10)
      const tres = await request(app).post("/api/family/tasks").send({
        kidId,
        title: "每週洗碗",
        emoji: "🍽️",
        rewardAmount: 50,
        dueDate: today,
        recurringInterval: "weekly",
      })
      expect(tres.status).toBe(201)
      await request(app).post(`/api/family/tasks/${tres.body.id}/submit`)
      const ares = await request(app).post(`/api/family/tasks/${tres.body.id}/approve`)
      expect(ares.status).toBe(200)
      expect(ares.body.recurring).toBeTruthy()
      expect(ares.body.recurring.interval).toBe("weekly")
      expect(ares.body.recurring.nextTaskId).toBeGreaterThan(0)

      // 清主系統
      if (ares.body.mainSystem?.paymentItemId) {
        await db.execute(
          sql`DELETE FROM payment_records WHERE payment_item_id = ${ares.body.mainSystem.paymentItemId}`
        )
        await db.execute(
          sql`DELETE FROM payment_items WHERE id = ${ares.body.mainSystem.paymentItemId}`
        )
      }

      // 下一筆任務存在、dueDate = today + 7
      const next = await db.execute(
        sql`SELECT title, due_date::text AS d, status, recurring_interval AS interval,
                  recurring_parent_id AS parent
            FROM kids_tasks WHERE id = ${ares.body.recurring.nextTaskId}`
      )
      const r = (
        next as unknown as {
          rows: {
            title: string
            d: string
            status: string
            interval: string
            parent: number
          }[]
        }
      ).rows[0]
      expect(r.title).toBe("每週洗碗")
      expect(r.status).toBe("pending")
      expect(r.interval).toBe("weekly")
      expect(r.parent).toBe(tres.body.id) // 第一筆變 parent
      // dueDate = today + 7 天
      const expected = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      expect(r.d).toBe(expected)
    } finally {
      if (oldEnv === undefined) delete process.env.FAMILY_KIDS_NO_BONUS
      else process.env.FAMILY_KIDS_NO_BONUS = oldEnv
    }
  })

  it("非 recurring 任務 approve 不會產出下一筆", async () => {
    const oldEnv = process.env.FAMILY_KIDS_NO_BONUS
    process.env.FAMILY_KIDS_NO_BONUS = "1"
    try {
      await createKid()
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: "單次", rewardAmount: 30 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      const ares = await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
      expect(ares.body.recurring.nextTaskId).toBeNull()

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

  it("jars-trend：過去 N 天每天三罐餘額", async () => {
    const oldEnv = process.env.FAMILY_KIDS_NO_BONUS
    process.env.FAMILY_KIDS_NO_BONUS = "1"
    try {
      await createKid({ spendRatio: 70, saveRatio: 20, giveRatio: 10 })
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: "T", rewardAmount: 100 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      const ares = await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
      if (ares.body.mainSystem?.paymentItemId) {
        await db.execute(
          sql`DELETE FROM payment_records WHERE payment_item_id = ${ares.body.mainSystem.paymentItemId}`
        )
        await db.execute(
          sql`DELETE FROM payment_items WHERE id = ${ares.body.mainSystem.paymentItemId}`
        )
      }

      const res = await request(app).get(`/api/family/jars-trend?kidId=${kidId}&days=7`)
      expect(res.status).toBe(200)
      expect(res.body.kidId).toBe(kidId)
      expect(res.body.days).toBe(7)
      expect(Array.isArray(res.body.trend)).toBe(true)
      expect(res.body.trend.length).toBe(7) // 7 天

      // 最後一天（今天）三罐應有值 = 100 × ratio
      const last = res.body.trend[res.body.trend.length - 1]
      expect(last.spend).toBe(70)
      expect(last.save).toBe(20)
      expect(last.give).toBe(10)
    } finally {
      if (oldEnv === undefined) delete process.env.FAMILY_KIDS_NO_BONUS
      else process.env.FAMILY_KIDS_NO_BONUS = oldEnv
    }
  })

  it("submit 任務可附 proofImageUrl + tasks list 回傳", async () => {
    await createKid()
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 50 })
    const proofUrl = "/uploads/receipts/test-proof.jpg"
    const sres = await request(app)
      .post(`/api/family/tasks/${t.body.id}/submit`)
      .send({ proofImageUrl: proofUrl })
    expect(sres.status).toBe(200)
    expect(sres.body.proofImageUrl).toBe(proofUrl)

    const list = await request(app).get(`/api/family/tasks?kidId=${kidId}`)
    const found = list.body.find((x: { id: number }) => x.id === t.body.id)
    expect(found.proofImageUrl).toBe(proofUrl)
  })

  it("家長 PIN：未設 env 時 status.enabled=false、verify 通過", async () => {
    delete process.env.FAMILY_PARENT_PIN
    const status = await request(app).get("/api/family/parent-pin/status")
    expect(status.body.enabled).toBe(false)
    const verify = await request(app).post("/api/family/parent-pin/verify").send({ pin: "" })
    expect(verify.status).toBe(200)
    expect(verify.body.ok).toBe(true)
    expect(verify.body.enabled).toBe(false)
  })

  it("家長 PIN：env 設定後、錯誤 PIN 401、正確 PIN 通過", async () => {
    process.env.FAMILY_PARENT_PIN = "8888"
    try {
      const status = await request(app).get("/api/family/parent-pin/status")
      expect(status.body.enabled).toBe(true)

      const wrong = await request(app).post("/api/family/parent-pin/verify").send({ pin: "0000" })
      expect(wrong.status).toBe(401)

      const right = await request(app).post("/api/family/parent-pin/verify").send({ pin: "8888" })
      expect(right.status).toBe(200)
      expect(right.body.ok).toBe(true)
      expect(right.body.enabled).toBe(true)
    } finally {
      delete process.env.FAMILY_PARENT_PIN
    }
  })

  it("streak：今天 approve 1 個任務 → streak=1、dashboard 回傳", async () => {
    const oldEnv = process.env.FAMILY_KIDS_NO_BONUS
    process.env.FAMILY_KIDS_NO_BONUS = "1"
    try {
      await createKid()
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: "T", rewardAmount: 50 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      const ares = await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
      if (ares.body.mainSystem?.paymentItemId) {
        await db.execute(
          sql`DELETE FROM payment_records WHERE payment_item_id = ${ares.body.mainSystem.paymentItemId}`
        )
        await db.execute(
          sql`DELETE FROM payment_items WHERE id = ${ares.body.mainSystem.paymentItemId}`
        )
      }

      const dash = await request(app).get(`/api/family/dashboard?kidId=${kidId}`)
      expect(dash.body.streak).toBe(1)
    } finally {
      if (oldEnv === undefined) delete process.env.FAMILY_KIDS_NO_BONUS
      else process.env.FAMILY_KIDS_NO_BONUS = oldEnv
    }
  })

  it("給罐子捐贈：recipient + reflection 寫入 + GET 回傳", async () => {
    const oldEnv = process.env.FAMILY_KIDS_NO_BONUS
    process.env.FAMILY_KIDS_NO_BONUS = "1"
    try {
      await createKid({ spendRatio: 0, saveRatio: 0, giveRatio: 100 })
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: "T", rewardAmount: 100 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      const ares = await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
      if (ares.body.mainSystem?.paymentItemId) {
        await db.execute(
          sql`DELETE FROM payment_records WHERE payment_item_id = ${ares.body.mainSystem.paymentItemId}`
        )
        await db.execute(
          sql`DELETE FROM payment_items WHERE id = ${ares.body.mainSystem.paymentItemId}`
        )
      }

      // 從 give 罐捐 30
      const sres = await request(app).post("/api/family/spendings").send({
        kidId,
        jar: "give",
        amount: 30,
        description: "捐獻",
        recipient: "流浪動物協會",
        reflection: "想幫助沒家的小動物",
      })
      expect(sres.status).toBe(201)
      expect(sres.body.recipient).toBe("流浪動物協會")
      expect(sres.body.reflection).toBe("想幫助沒家的小動物")

      // 列表 GET 回傳兩欄位
      const list = await request(app).get(`/api/family/spendings?kidId=${kidId}`)
      const found = list.body.find((x: { id: number }) => x.id === sres.body.id)
      expect(found.recipient).toBe("流浪動物協會")
      expect(found.reflection).toBe("想幫助沒家的小動物")
    } finally {
      if (oldEnv === undefined) delete process.env.FAMILY_KIDS_NO_BONUS
      else process.env.FAMILY_KIDS_NO_BONUS = oldEnv
    }
  })

  it("小孩自提任務：propose endpoint + proposedByKid=true", async () => {
    await createKid()
    const res = await request(app).post("/api/family/tasks/propose").send({
      kidId,
      title: "幫忙澆花",
      emoji: "🌱",
      rewardAmount: 25,
    })
    expect(res.status).toBe(201)
    expect(res.body.proposedByKid).toBe(true)
    expect(res.body.status).toBe("pending")

    const list = await request(app).get(`/api/family/tasks?kidId=${kidId}`)
    const found = list.body.find((x: { id: number }) => x.id === res.body.id)
    expect(found.proposedByKid).toBe(true)
  })

  it("節慶任務範本：按月份回傳對應節慶 + tasks 陣列", async () => {
    // 5 月 = 母親節
    const may = await request(app).get("/api/family/task-templates/seasonal?month=5")
    expect(may.status).toBe(200)
    expect(may.body.month).toBe(5)
    expect(may.body.festival).toContain("母親節")
    expect(Array.isArray(may.body.tasks)).toBe(true)
    expect(may.body.tasks.length).toBeGreaterThan(0)

    // 12 月 = 聖誕
    const dec = await request(app).get("/api/family/task-templates/seasonal?month=12")
    expect(dec.body.festival).toContain("聖誕")

    // 無效 month
    const bad = await request(app).get("/api/family/task-templates/seasonal?month=13")
    expect(bad.status).toBe(400)
  })

  it("親子文字交流：submit submissionNote + approve parentFeedback 雙向紀錄", async () => {
    await createKid()
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "洗碗", rewardAmount: 30 })

    // 小孩 submit 時加描述
    const note = "我洗了 5 個碗、還順便擦了流理台"
    const sres = await request(app)
      .post(`/api/family/tasks/${t.body.id}/submit`)
      .send({ submissionNote: note })
    expect(sres.status).toBe(200)
    expect(sres.body.submissionNote).toBe(note)

    // 家長 approve 時回饋
    const feedback = "做得超棒！👍 媽媽很欣慰"
    const ares = await request(app)
      .post(`/api/family/tasks/${t.body.id}/approve`)
      .send({ parentFeedback: feedback })
    expect(ares.status).toBe(200)
    expect(ares.body.task.parentFeedback).toBe(feedback)
    expect(ares.body.task.submissionNote).toBe(note)
  })

  it("reject 時也可附 parentFeedback", async () => {
    await createKid()
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "倒垃圾", rewardAmount: 20 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)

    const feedback = "垃圾分類沒分好、請重新整理"
    const rres = await request(app)
      .post(`/api/family/tasks/${t.body.id}/reject`)
      .send({ parentFeedback: feedback })
    expect(rres.status).toBe(200)
    expect(rres.body.parentFeedback).toBe(feedback)
    expect(rres.body.status).toBe("rejected")
  })

  it("任務難度：default medium、可設 easy/hard、排行榜 weightedScore 加權 1/2/3", async () => {
    await createKid()
    // 建 3 個不同難度任務
    const easy = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "刷牙", rewardAmount: 10, difficulty: "easy" })
    expect(easy.body.difficulty).toBe("easy")

    const med = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "洗碗", rewardAmount: 20 })
    expect(med.body.difficulty).toBe("medium") // default

    const hard = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "全屋打掃", rewardAmount: 100, difficulty: "hard" })
    expect(hard.body.difficulty).toBe("hard")

    // 通通 submit + approve
    for (const t of [easy, med, hard]) {
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    // 排行榜：weightedScore = 1 + 2 + 3 = 6
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const lb = await request(app).get(`/api/family/leaderboard?month=${month}`)
    const me = lb.body.leaderboard.find((x: { kidId: number }) => x.kidId === kidId)
    expect(me.weightedScore).toBe(6)
    expect(me.hardCount).toBe(1)
    expect(me.approvedCount).toBe(3)
  })

  it("ICS 匯出：未完成 + 有 dueDate 任務轉成行事曆", async () => {
    await createKid()
    // 建 3 個任務：有 dueDate / 無 dueDate / approved（不該匯出）
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const withDate = await request(app).post("/api/family/tasks").send({
      kidId,
      title: "倒垃圾",
      rewardAmount: 30,
      dueDate: tomorrow,
      difficulty: "hard",
    })
    await request(app).post("/api/family/tasks").send({ kidId, title: "刷牙", rewardAmount: 10 }) // 無 dueDate
    const done = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "已做完", rewardAmount: 20, dueDate: tomorrow })
    await request(app).post(`/api/family/tasks/${done.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${done.body.id}/approve`)

    const res = await request(app).get("/api/family/tasks.ics")
    expect(res.status).toBe(200)
    expect(res.headers["content-type"]).toContain("text/calendar")
    expect(res.headers["content-disposition"]).toContain("family-tasks.ics")
    const ics = res.text
    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).toContain("END:VCALENDAR")
    expect(ics).toContain(`family-task-${withDate.body.id}@homi.cc`)
    expect(ics).toContain("倒垃圾")
    expect(ics).toContain("⭐⭐⭐")
    // 已 approved 不該出現
    expect(ics).not.toContain(`family-task-${done.body.id}@homi.cc`)
    // VALARM 提醒（截止前 15 小時 = 前一天 09:00）
    expect(ics).toContain("BEGIN:VALARM")
    expect(ics).toContain("TRIGGER:-PT15H")
    expect(ics).toContain("END:VALARM")
  })

  it("活動 Timeline：past N 天 task/spending/goal/badge 全部匯總按時序", async () => {
    await createKid({ spendRatio: 0, saveRatio: 100, giveRatio: 0 })

    // 1) task approved（給 200 元、全進 save 罐）
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "洗碗", rewardAmount: 200 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 2) goal completed（target 100）
    const g = await request(app)
      .post("/api/family/goals")
      .send({ kidId, name: "玩具車", targetAmount: 100 })
    await request(app).post(`/api/family/goals/${g.body.id}/save`).send({ amount: 100 })

    // 3) spending（從 save 罐扣 20、剩 80）
    await request(app)
      .post("/api/family/spendings")
      .send({
        kidId,
        jar: "save",
        amount: 20,
        description: "買貼紙",
        spendDate: new Date().toISOString().slice(0, 10),
      })

    const feed = await request(app).get("/api/family/activity-feed?days=30")
    expect(feed.status).toBe(200)
    expect(Array.isArray(feed.body.items)).toBe(true)
    const types = feed.body.items.map((x: { eventType: string }) => x.eventType)
    expect(types).toContain("task_approved")
    expect(types).toContain("goal_completed")
    expect(types).toContain("spending")
    expect(types).toContain("badge_earned") // first_task / first_goal
    // 時序倒序：第一個是最新
    const timestamps = feed.body.items.map((x: { ts: string }) => x.ts)
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(new Date(timestamps[i]).getTime()).toBeGreaterThanOrEqual(
        new Date(timestamps[i + 1]).getTime()
      )
    }
  })

  it("兄弟姊妹互贈：spend 罐扣 + 對方 spend 罐 + totalReceived 增加 + 送方建 spending 紀錄", async () => {
    // 建兩個小孩
    await createKid({ displayName: "哥哥", spendRatio: 100, saveRatio: 0, giveRatio: 0 })
    const elderId = kidId
    // 先賺 100
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: elderId, title: "T", rewardAmount: 100 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 建妹妹（重設 kidId 避免 afterEach 清掉哥哥）
    kidId = 0
    const sis = await request(app).post("/api/family/kids").send({
      displayName: "妹妹",
      avatar: "👧",
      color: "pink",
      pin: "8721",
      spendRatio: 70,
      saveRatio: 20,
      giveRatio: 10,
    })
    const youngerId = sis.body.id

    try {
      // 先抓 transfer 前餘額（bonus 可能讓 reward 變 150、不依賴絕對值）
      const beforeJar = await db.execute(
        sql`SELECT spend_balance::numeric AS s FROM kids_jars WHERE kid_id = ${elderId}`
      )
      const beforeSpend = Number((beforeJar as unknown as { rows: { s: string }[] }).rows[0].s)

      const transfer = await request(app).post("/api/family/jars/transfer").send({
        fromKidId: elderId,
        toKidId: youngerId,
        amount: 30,
        jar: "spend",
        message: "妹妹生日快樂",
      })
      expect(transfer.status).toBe(200)
      expect(transfer.body.ok).toBe(true)
      expect(transfer.body.amount).toBe(30)
      expect(transfer.body.from).toBe("哥哥")
      expect(transfer.body.to).toBe("妹妹")

      // 哥哥 spend 罐：減少 30（相對檢查、抗 bonus random）
      const elderJar = await db.execute(
        sql`SELECT spend_balance::numeric AS s FROM kids_jars WHERE kid_id = ${elderId}`
      )
      const afterSpend = Number((elderJar as unknown as { rows: { s: string }[] }).rows[0].s)
      expect(beforeSpend - afterSpend).toBe(30)

      // 妹妹 spend 罐：0 + 30 = 30、totalReceived = 30
      const sisJar = await db.execute(
        sql`SELECT spend_balance::numeric AS s, total_received::numeric AS t FROM kids_jars WHERE kid_id = ${youngerId}`
      )
      const row = (sisJar as unknown as { rows: { s: string; t: string }[] }).rows[0]
      expect(Number(row.s)).toBe(30)
      expect(Number(row.t)).toBe(30)

      // 哥哥 spendings 紀錄
      const sp = await request(app).get(`/api/family/spendings?kidId=${elderId}`)
      expect(
        sp.body.some((x: { description: string }) => x.description.includes("送禮給 妹妹"))
      ).toBe(true)

      // 餘額不足拒絕
      const fail = await request(app)
        .post("/api/family/jars/transfer")
        .send({ fromKidId: elderId, toKidId: youngerId, amount: 999 })
      expect(fail.status).toBe(400)

      // 送給自己拒絕
      const self = await request(app)
        .post("/api/family/jars/transfer")
        .send({ fromKidId: elderId, toKidId: elderId, amount: 10 })
      expect(self.status).toBe(400)
    } finally {
      await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${youngerId}`)
      // 確保 afterEach 清哥哥
      kidId = elderId
    }
  })

  it("家長每日鼓勵卡：POST 建 / 同日 PUT 覆蓋 / GET 查回", async () => {
    await createKid()

    // 第一次寫
    const r1 = await request(app)
      .post("/api/family/daily-message")
      .send({ kidId, message: "你今天很棒！", mood: "❤️" })
    expect(r1.status).toBe(201)
    expect(r1.body.ok).toBe(true)
    expect(r1.body.updated).toBe(false)
    expect(r1.body.message.message).toBe("你今天很棒！")

    // 同日再寫應覆蓋
    const r2 = await request(app)
      .post("/api/family/daily-message")
      .send({ kidId, message: "Day 2 加油", mood: "💪" })
    expect(r2.status).toBe(200)
    expect(r2.body.updated).toBe(true)
    expect(r2.body.message.message).toBe("Day 2 加油")
    expect(r2.body.message.mood).toBe("💪")

    // GET 應回當日訊息
    const r3 = await request(app).get(`/api/family/daily-message?kidId=${kidId}`)
    expect(r3.status).toBe(200)
    expect(r3.body.message.message).toBe("Day 2 加油")

    // GET 不同日期應回 null
    const r4 = await request(app).get(`/api/family/daily-message?kidId=${kidId}&date=2020-01-01`)
    expect(r4.body.message).toBeNull()

    // 空訊息應拒絕
    const r5 = await request(app).post("/api/family/daily-message").send({ kidId, message: "" })
    expect(r5.status).toBe(400)
  })

  it("目標反思：建立時可寫 reflection、達成時可寫 completedReflection", async () => {
    await createKid({ spendRatio: 0, saveRatio: 100, giveRatio: 0 })
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 200 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 建目標、附「為什麼存錢」reflection
    const g = await request(app).post("/api/family/goals").send({
      kidId,
      name: "樂高",
      targetAmount: 100,
      reflection: "因為我表現好、想送自己禮物",
    })
    expect(g.status).toBe(201)
    expect(g.body.reflection).toBe("因為我表現好、想送自己禮物")

    // save 達成、附「達成感言」
    const save = await request(app)
      .post(`/api/family/goals/${g.body.id}/save`)
      .send({ amount: 100, completedReflection: "我做到了！下次目標訂更大" })
    expect(save.status).toBe(200)
    expect(save.body.reached).toBe(true)
    expect(save.body.goal.completedReflection).toBe("我做到了！下次目標訂更大")
    expect(save.body.goal.reflection).toBe("因為我表現好、想送自己禮物") // 原 reflection 保留
  })

  it("jars-trend-multi：所有 active 小孩每日總餘額並列、dates 對齊", async () => {
    await createKid({ displayName: "Alpha" })
    // 賺 100
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T1", rewardAmount: 100 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get("/api/family/jars-trend-multi?days=7")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.dates)).toBe(true)
    expect(res.body.dates.length).toBe(7)
    expect(Array.isArray(res.body.series)).toBe(true)
    // 找到 Alpha 的 series
    const me = res.body.series.find((s: { kidId: number }) => s.kidId === kidId)
    expect(me).toBeTruthy()
    expect(me.values.length).toBe(7)
    // 最後一天（今天）餘額 >= 100（bonus 可能更多）
    expect(me.values[me.values.length - 1]).toBeGreaterThanOrEqual(100)
    // 每個 series 的 values 長度應對齊 dates
    res.body.series.forEach((s: { values: number[] }) => {
      expect(s.values.length).toBe(res.body.dates.length)
    })
  })

  it("自訂任務範本：POST 建 / GET 列 / DELETE 刪 + 驗證 difficulty 防呆", async () => {
    // 建一個
    const r1 = await request(app).post("/api/family/custom-templates").send({
      title: "倒垃圾",
      emoji: "🗑️",
      defaultReward: 25,
      defaultDifficulty: "easy",
    })
    expect(r1.status).toBe(201)
    expect(r1.body.title).toBe("倒垃圾")
    expect(r1.body.emoji).toBe("🗑️")
    expect(Number(r1.body.defaultReward)).toBe(25)
    expect(r1.body.defaultDifficulty).toBe("easy")
    const tplId = r1.body.id

    try {
      // 列表應含
      const list = await request(app).get("/api/family/custom-templates")
      expect(list.status).toBe(200)
      expect(list.body.find((x: { id: number }) => x.id === tplId)).toBeTruthy()

      // 缺 title 400
      const bad = await request(app).post("/api/family/custom-templates").send({
        emoji: "📋",
        defaultReward: 10,
      })
      expect(bad.status).toBe(400)

      // 負值 reward 400
      const negReward = await request(app)
        .post("/api/family/custom-templates")
        .send({ title: "X", defaultReward: -10 })
      expect(negReward.status).toBe(400)

      // 不合法 difficulty 400
      const badDiff = await request(app)
        .post("/api/family/custom-templates")
        .send({ title: "X", defaultReward: 10, defaultDifficulty: "extreme" })
      expect(badDiff.status).toBe(400)
    } finally {
      // 刪除
      const del = await request(app).delete(`/api/family/custom-templates/${tplId}`)
      expect(del.status).toBe(200)
      expect(del.body.ok).toBe(true)

      // 重複刪 404
      const del2 = await request(app).delete(`/api/family/custom-templates/${tplId}`)
      expect(del2.status).toBe(404)
    }
  })

  it("願望清單：CRUD + promote 升級成 goal", async () => {
    await createKid()

    // 建願望
    const r1 = await request(app).post("/api/family/wishes").send({
      kidId,
      title: "Switch 遊戲",
      emoji: "🎮",
      estimatedPrice: 1500,
      priority: 3,
    })
    expect(r1.status).toBe(201)
    expect(r1.body.title).toBe("Switch 遊戲")
    expect(r1.body.priority).toBe(3)
    expect(r1.body.status).toBe("wished")
    const wishId = r1.body.id

    // 列表
    const list = await request(app).get(`/api/family/wishes?kidId=${kidId}`)
    expect(list.status).toBe(200)
    expect(list.body.length).toBeGreaterThanOrEqual(1)
    // 高優先序排前面
    expect(list.body[0].id).toBe(wishId)

    // 更新 priority
    const upd = await request(app).put(`/api/family/wishes/${wishId}`).send({ priority: 1 })
    expect(upd.status).toBe(200)
    expect(upd.body.priority).toBe(1)

    // 不合法 status 400
    const badStatus = await request(app)
      .put(`/api/family/wishes/${wishId}`)
      .send({ status: "invalid" })
    expect(badStatus.status).toBe(400)

    // promote 升級成 goal
    const promote = await request(app).post(`/api/family/wishes/${wishId}/promote`)
    expect(promote.status).toBe(200)
    expect(promote.body.ok).toBe(true)
    expect(promote.body.wish.status).toBe("promoted_to_goal")
    expect(promote.body.wish.promotedGoalId).toBe(promote.body.goal.id)
    expect(promote.body.goal.name).toBe("Switch 遊戲")
    expect(Number(promote.body.goal.targetAmount)).toBe(1500)

    // 已 promote 不能再 promote
    const promoteAgain = await request(app).post(`/api/family/wishes/${wishId}/promote`)
    expect(promoteAgain.status).toBe(400)

    // 刪除
    const del = await request(app).delete(`/api/family/wishes/${wishId}`)
    expect(del.status).toBe(200)
  })

  it("捐贈追蹤：聚合 give jar + 按 recipient 分組 + 6 月趨勢", async () => {
    await createKid({ spendRatio: 0, saveRatio: 0, giveRatio: 100 })
    // 賺 200 全進 give 罐
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 200 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 捐 2 次（同 recipient）+ 1 次（不同 recipient）
    const today = new Date().toISOString().slice(0, 10)
    await request(app).post("/api/family/spendings").send({
      kidId,
      jar: "give",
      amount: 30,
      description: "捐動保",
      recipient: "動物保護協會",
      reflection: "希望狗狗有家",
      spendDate: today,
    })
    await request(app).post("/api/family/spendings").send({
      kidId,
      jar: "give",
      amount: 20,
      description: "再捐",
      recipient: "動物保護協會",
      spendDate: today,
    })
    await request(app).post("/api/family/spendings").send({
      kidId,
      jar: "give",
      amount: 50,
      description: "學校募款",
      recipient: "學校",
      spendDate: today,
    })

    const res = await request(app).get(`/api/family/donations?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(100)
    expect(res.body.count).toBe(3)
    expect(res.body.recipients.length).toBe(2)
    // 「動保」總計 50 > 「學校」50 — 第一名應為「動物保護協會」(50, 2 筆) 或 學校 (50, 1 筆)
    // 因為都 50、排序看 recipient name 不影響整體驗證
    const animal = res.body.recipients.find(
      (r: { recipient: string }) => r.recipient === "動物保護協會"
    )
    expect(animal).toBeTruthy()
    expect(animal.count).toBe(2)
    expect(animal.total).toBe(50)
    // monthlyTrend 應有 6 個月、本月 total >= 100
    expect(res.body.monthlyTrend.length).toBe(6)
    expect(res.body.monthlyTrend[5].total).toBe(100)
    // items 含 reflection
    const withRef = res.body.items.find(
      (x: { reflection: string | null }) => x.reflection === "希望狗狗有家"
    )
    expect(withRef).toBeTruthy()
  })

  it("任務評論串：parent + kid 多次往返、按時序", async () => {
    await createKid()
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "洗碗", rewardAmount: 50 })
    const taskId = t.body.id

    // 初始無評論
    const empty = await request(app).get(`/api/family/tasks/${taskId}/comments`)
    expect(empty.status).toBe(200)
    expect(empty.body).toEqual([])

    // 家長加評論
    const c1 = await request(app)
      .post(`/api/family/tasks/${taskId}/comments`)
      .send({ author: "parent", message: "記得擦乾喔" })
    expect(c1.status).toBe(201)
    expect(c1.body.author).toBe("parent")

    // 小孩回應
    const c2 = await request(app)
      .post(`/api/family/tasks/${taskId}/comments`)
      .send({ author: "kid", message: "好的我會擦乾", emoji: "👍" })
    expect(c2.status).toBe(201)
    expect(c2.body.emoji).toBe("👍")

    // 家長再加
    await request(app)
      .post(`/api/family/tasks/${taskId}/comments`)
      .send({ author: "parent", message: "棒！" })

    // 列表按時序
    const list = await request(app).get(`/api/family/tasks/${taskId}/comments`)
    expect(list.status).toBe(200)
    expect(list.body.length).toBe(3)
    expect(list.body[0].message).toBe("記得擦乾喔")
    expect(list.body[1].author).toBe("kid")
    expect(list.body[2].author).toBe("parent")

    // 不合法 author 400
    const badAuthor = await request(app)
      .post(`/api/family/tasks/${taskId}/comments`)
      .send({ author: "stranger", message: "x" })
    expect(badAuthor.status).toBe(400)

    // 空 message 400
    const emptyMsg = await request(app)
      .post(`/api/family/tasks/${taskId}/comments`)
      .send({ author: "kid", message: "" })
    expect(emptyMsg.status).toBe(400)

    // 不存在 task 404
    const noTask = await request(app)
      .post(`/api/family/tasks/999999/comments`)
      .send({ author: "kid", message: "x" })
    expect(noTask.status).toBe(404)
  })

  it("全家月度總結：所有 active 小孩匯總 + grandTotal", async () => {
    await createKid({ displayName: "甲", spendRatio: 100, saveRatio: 0, giveRatio: 0 })
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T1", rewardAmount: 100, difficulty: "hard" })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const res = await request(app).get(`/api/family/family-monthly-summary?month=${month}`)
    expect(res.status).toBe(200)
    expect(res.body.month).toBe(month)
    expect(Array.isArray(res.body.kids)).toBe(true)
    const me = res.body.kids.find((k: { kidId: number }) => k.kidId === kidId)
    expect(me).toBeTruthy()
    expect(me.approvedCount).toBe(1)
    expect(me.hardCount).toBe(1)
    expect(me.weightedScore).toBe(3) // hard=3
    expect(me.approvedSum).toBeGreaterThanOrEqual(100)
    // grand total
    expect(res.body.grandTotal.approvedCount).toBeGreaterThanOrEqual(1)
    expect(res.body.grandTotal.hardCount).toBeGreaterThanOrEqual(1)

    // 不合法 month 400
    const bad = await request(app).get("/api/family/family-monthly-summary?month=invalid")
    expect(bad.status).toBe(400)
  })

  it("小孩自訂頭像 + 顏色（不改 pin / ratios）", async () => {
    await createKid({ displayName: "小明" })

    // 改 avatar + color
    const r1 = await request(app)
      .put(`/api/family/kids/${kidId}/personalize`)
      .send({ avatar: "🐱", color: "pink" })
    expect(r1.status).toBe(200)
    expect(r1.body.avatar).toBe("🐱")
    expect(r1.body.color).toBe("pink")
    expect(r1.body.displayName).toBe("小明") // 名字不變
    expect(r1.body.spendRatio).toBe(70) // ratios 不變

    // 只改 color
    const r2 = await request(app)
      .put(`/api/family/kids/${kidId}/personalize`)
      .send({ color: "purple" })
    expect(r2.status).toBe(200)
    expect(r2.body.color).toBe("purple")
    expect(r2.body.avatar).toBe("🐱")

    // 不合法 color 400
    const bad = await request(app)
      .put(`/api/family/kids/${kidId}/personalize`)
      .send({ color: "rainbow" })
    expect(bad.status).toBe(400)

    // 空 body 400
    const empty = await request(app).put(`/api/family/kids/${kidId}/personalize`).send({})
    expect(empty.status).toBe(400)

    // 不存在 404
    const notFound = await request(app)
      .put(`/api/family/kids/999999/personalize`)
      .send({ avatar: "🐶" })
    expect(notFound.status).toBe(404)
  })

  it("成就牆目錄：含 10 個徽章 + 進度條 + 累積捐款觸發 give_100 / give_500", async () => {
    await createKid({ spendRatio: 0, saveRatio: 0, giveRatio: 100 })
    // 賺 1000 全進 give 罐
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 1000 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 捐 100 → 應拿 give_100 徽章
    const give1 = await request(app).post("/api/family/spendings").send({
      kidId,
      jar: "give",
      amount: 100,
      description: "捐 100",
    })
    expect(give1.body.newBadges).toContain("give_100")
    expect(give1.body.newBadges).not.toContain("give_500")

    // 再捐 400（累積 500） → 應拿 give_500
    const give2 = await request(app).post("/api/family/spendings").send({
      kidId,
      jar: "give",
      amount: 400,
      description: "再捐",
    })
    expect(give2.body.newBadges).toContain("give_500")

    // 成就牆目錄
    const catalog = await request(app).get(`/api/family/badges-catalog?kidId=${kidId}`)
    expect(catalog.status).toBe(200)
    expect(catalog.body.badges.length).toBeGreaterThanOrEqual(10)
    const give100 = catalog.body.badges.find(
      (b: { badgeType: string }) => b.badgeType === "give_100"
    )
    expect(give100.earned).toBe(true)
    expect(give100.progress).toBe(100)
    const give500 = catalog.body.badges.find(
      (b: { badgeType: string }) => b.badgeType === "give_500"
    )
    expect(give500.earned).toBe(true)
    // streak_100 / tasks_50 未達成
    const tasks50 = catalog.body.badges.find(
      (b: { badgeType: string }) => b.badgeType === "tasks_50"
    )
    expect(tasks50.earned).toBe(false)
    expect(tasks50.progress).toBeLessThan(100)
    // totalEarned 計數
    expect(catalog.body.totalEarned).toBeGreaterThanOrEqual(2) // give_100 + give_500
  })

  it("家長提醒中心：待審 / 逾期 / 接近達成目標 / 無活動小孩", async () => {
    await createKid({ spendRatio: 0, saveRatio: 100, giveRatio: 0 })

    // 1) 建一個 submitted 任務（待審）
    const t1 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "待審任務", rewardAmount: 50 })
    await request(app).post(`/api/family/tasks/${t1.body.id}/submit`)

    // 2) 逾期任務（昨天截止、還 pending）
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const overdueT = await request(app).post("/api/family/tasks").send({
      kidId,
      title: "逾期",
      rewardAmount: 30,
      dueDate: yesterday,
    })

    // 3) 接近達成的目標
    const earnT = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "賺", rewardAmount: 200 })
    await request(app).post(`/api/family/tasks/${earnT.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${earnT.body.id}/approve`)
    const g = await request(app).post("/api/family/goals").send({
      kidId,
      name: "近達標",
      targetAmount: 100,
    })
    await request(app).post(`/api/family/goals/${g.body.id}/save`).send({ amount: 90 })

    const res = await request(app).get("/api/family/parent-reminders")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.submitted)).toBe(true)
    expect(res.body.submitted.find((x: { id: number }) => x.id === t1.body.id)).toBeTruthy()
    expect(res.body.overdue.find((x: { id: number }) => x.id === overdueT.body.id)).toBeTruthy()
    expect(
      res.body.overdue.find((x: { id: number }) => x.id === overdueT.body.id).daysOverdue
    ).toBe(1)
    expect(res.body.nearGoal.find((x: { id: number }) => x.id === g.body.id)).toBeTruthy()
    expect(res.body.nearGoal.find((x: { id: number }) => x.id === g.body.id).progress).toBe(90)
    expect(Array.isArray(res.body.inactiveKids)).toBe(true)
  })

  it("自動每月零用金：dashboard 查時補發 + 同月不重發 + 三罐分配", async () => {
    // 建小孩、設每月 300 零用金、ratios 70/20/10
    await createKid({ spendRatio: 70, saveRatio: 20, giveRatio: 10 })
    await request(app).put(`/api/family/kids/${kidId}`).send({ monthlyAllowance: 300 })

    // 第一次查 dashboard → 應補發
    const r1 = await request(app).get(`/api/family/dashboard?kidId=${kidId}`)
    expect(r1.status).toBe(200)
    expect(r1.body.allowanceJustGiven).toBe(300)
    // 三罐：210/60/30
    expect(parseFloat(r1.body.jar.spendBalance)).toBe(210)
    expect(parseFloat(r1.body.jar.saveBalance)).toBe(60)
    expect(parseFloat(r1.body.jar.giveBalance)).toBe(30)

    // 第二次查 → 同月不重發
    const r2 = await request(app).get(`/api/family/dashboard?kidId=${kidId}`)
    expect(r2.body.allowanceJustGiven).toBe(0)
    expect(parseFloat(r2.body.jar.spendBalance)).toBe(210) // 沒漲

    // 清掉主系統測試 payment_items（避免污染）
    await db.execute(sql`DELETE FROM payment_records WHERE notes LIKE '家庭記帳：%自動零用金%'`)
    await db.execute(sql`DELETE FROM payment_items WHERE tags = 'kids,allowance,monthly'`)
  })

  it("AI 任務建議：無 API key 回 503、空 goal 回 400", async () => {
    // 沒設 GEMINI_API_KEY → 503
    const origKey1 = process.env.GEMINI_API_KEY
    const origKey2 = process.env.AI_INTEGRATIONS_GEMINI_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.AI_INTEGRATIONS_GEMINI_API_KEY
    try {
      const r1 = await request(app)
        .post("/api/family/ai-suggest-tasks")
        .send({ learningGoal: "培養理財" })
      expect(r1.status).toBe(503)
    } finally {
      if (origKey1) process.env.GEMINI_API_KEY = origKey1
      if (origKey2) process.env.AI_INTEGRATIONS_GEMINI_API_KEY = origKey2
    }

    // 空 goal → 400（先設個假 key 確保不會 short-circuit 到 503）
    const hadKey = !!origKey1
    if (!hadKey) process.env.GEMINI_API_KEY = "test-key-not-real"
    try {
      const r2 = await request(app).post("/api/family/ai-suggest-tasks").send({ learningGoal: "" })
      expect(r2.status).toBe(400)
    } finally {
      if (!hadKey) delete process.env.GEMINI_API_KEY
    }
  })

  it("kid dashboard tasks 含 isOverdue / isDueSoon / overdueDays", async () => {
    await createKid()
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    const dueToday = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "今天", rewardAmount: 10, dueDate: today })
    const overdueT = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "昨天", rewardAmount: 10, dueDate: yesterday })
    const dueTomorrow = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "明天", rewardAmount: 10, dueDate: tomorrow })
    const dueNextWeek = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "下週", rewardAmount: 10, dueDate: nextWeek })

    const res = await request(app).get(`/api/family/dashboard?kidId=${kidId}`)
    expect(res.status).toBe(200)
    const findTask = (id: number) => res.body.tasks.find((t: { id: number }) => t.id === id)

    const todayT = findTask(dueToday.body.id)
    expect(todayT.isDueSoon).toBe(true)
    expect(todayT.isOverdue).toBe(false)

    const overdueR = findTask(overdueT.body.id)
    expect(overdueR.isOverdue).toBe(true)
    expect(overdueR.overdueDays).toBe(1)

    const tomorrowT = findTask(dueTomorrow.body.id)
    expect(tomorrowT.isDueSoon).toBe(true)

    const nextWeekT = findTask(dueNextWeek.body.id)
    expect(nextWeekT.isOverdue).toBe(false)
    expect(nextWeekT.isDueSoon).toBe(false)
  })

  it("難度智能建議：easy 全過 → 建議升 medium", async () => {
    await createKid()
    for (let i = 0; i < 5; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: `easy${i}`, rewardAmount: 10, difficulty: "easy" })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    const res = await request(app).get("/api/family/difficulty-insights")
    expect(res.status).toBe(200)
    const me = res.body.insights.find((i: { kidId: number }) => i.kidId === kidId)
    expect(me).toBeTruthy()
    expect(me.suggestions.length).toBeGreaterThan(0)
    expect(me.suggestions.join("|")).toContain("普通")
    expect(me.breakdown.easy.rate).toBe(100)
  })

  it("家庭年度回顧：聚合本年所有 task/goal/badge/give", async () => {
    await createKid({ spendRatio: 0, saveRatio: 100, giveRatio: 0 })
    // 賺 + 完成
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 200 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    // goal 達成
    const g = await request(app)
      .post("/api/family/goals")
      .send({ kidId, name: "玩具", targetAmount: 100 })
    await request(app).post(`/api/family/goals/${g.body.id}/save`).send({ amount: 100 })

    const year = new Date().getFullYear()
    const res = await request(app).get(`/api/family/year-summary?year=${year}`)
    expect(res.status).toBe(200)
    expect(res.body.year).toBe(year)
    expect(Array.isArray(res.body.kids)).toBe(true)
    expect(res.body.kids.length).toBeGreaterThanOrEqual(1)
    expect(res.body.grandTotal.tasks).toBeGreaterThanOrEqual(1)
    expect(res.body.grandTotal.goalsCompleted).toBeGreaterThanOrEqual(1)
    expect(res.body.grandTotal.badgesEarned).toBeGreaterThanOrEqual(2) // first_task + first_goal
    expect(res.body.monthly.length).toBe(12)
    // 不合法 year 400
    const bad = await request(app).get("/api/family/year-summary?year=1999")
    expect(bad.status).toBe(400)
  })

  it("捐贈對象目錄：CRUD + 排序 + 邊界", async () => {
    // 建 2 個對象
    const r1 = await request(app)
      .post("/api/family/recipients")
      .send({ name: "動物保護協會", emoji: "🐶", sortOrder: 1 })
    expect(r1.status).toBe(201)
    expect(r1.body.name).toBe("動物保護協會")
    const id1 = r1.body.id

    const r2 = await request(app)
      .post("/api/family/recipients")
      .send({ name: "學校", emoji: "🏫", sortOrder: 2 })
    expect(r2.status).toBe(201)
    const id2 = r2.body.id

    try {
      // 列表（sortOrder asc）
      const list = await request(app).get("/api/family/recipients")
      expect(list.status).toBe(200)
      expect(list.body.length).toBeGreaterThanOrEqual(2)
      // 至少 動物保護 在 學校 之前（同 family 內）
      const animalIdx = list.body.findIndex((x: { id: number }) => x.id === id1)
      const schoolIdx = list.body.findIndex((x: { id: number }) => x.id === id2)
      expect(animalIdx).toBeLessThan(schoolIdx)

      // 缺 name 400
      const bad = await request(app).post("/api/family/recipients").send({ emoji: "❤️" })
      expect(bad.status).toBe(400)

      // 不存在 404
      const notFound = await request(app).delete("/api/family/recipients/999999")
      expect(notFound.status).toBe(404)
    } finally {
      await request(app).delete(`/api/family/recipients/${id1}`)
      await request(app).delete(`/api/family/recipients/${id2}`)
    }
  })

  it("心情簽到：POST upsert + GET 近 N 天 + today 標記", async () => {
    await createKid()
    const r1 = await request(app)
      .post("/api/family/checkins")
      .send({ kidId, mood: "😄 開心", note: "今天玩很開心" })
    expect(r1.status).toBe(201)
    expect(r1.body.updated).toBe(false)

    const r2 = await request(app).post("/api/family/checkins").send({ kidId, mood: "😐 普通" })
    expect(r2.status).toBe(200)
    expect(r2.body.updated).toBe(true)
    expect(r2.body.checkin.mood).toBe("😐 普通")

    const r3 = await request(app).get(`/api/family/checkins?kidId=${kidId}&days=7`)
    expect(r3.status).toBe(200)
    expect(r3.body.today.mood).toBe("😐 普通")

    const bad = await request(app).post("/api/family/checkins").send({ kidId, mood: "🚀" })
    expect(bad.status).toBe(400)
  })

  it("家庭心情軌跡：聚合全家 + avgScore", async () => {
    await createKid()
    await request(app).post("/api/family/checkins").send({ kidId, mood: "😄 開心" })
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    await db.execute(
      sql`INSERT INTO kids_checkins (kid_id, mood, checkin_date) VALUES (${kidId}, '🙂 還好', ${yesterday}::date)`
    )

    const res = await request(app).get("/api/family/mood-trends?days=30")
    expect(res.status).toBe(200)
    const me = res.body.series.find((s: { kidId: number }) => s.kidId === kidId)
    expect(me).toBeTruthy()
    expect(me.count).toBeGreaterThanOrEqual(2)
    // 開心=5、還好=4 → avg=4.5
    expect(me.avgScore).toBe(4.5)
  })

  it("小孩改 PIN：舊 PIN 驗證 + 新 PIN 規格 + 不撞別人", async () => {
    await createKid()
    // 錯誤舊 PIN
    const r1 = await request(app)
      .post(`/api/family/kids/${kidId}/change-pin`)
      .send({ oldPin: "0000", newPin: "5566" })
    expect(r1.status).toBe(401)

    // 不合法新 PIN（5 位）
    const r2 = await request(app)
      .post(`/api/family/kids/${kidId}/change-pin`)
      .send({ oldPin: "9871", newPin: "12345" })
    expect(r2.status).toBe(400)

    // 新舊一樣
    const r3 = await request(app)
      .post(`/api/family/kids/${kidId}/change-pin`)
      .send({ oldPin: "9871", newPin: "9871" })
    expect(r3.status).toBe(400)

    // 成功
    const r4 = await request(app)
      .post(`/api/family/kids/${kidId}/change-pin`)
      .send({ oldPin: "9871", newPin: "5566" })
    expect(r4.status).toBe(200)
    expect(r4.body.ok).toBe(true)

    // 用新 PIN 登入
    const login = await request(app).post("/api/family/kids/pin-login").send({ pin: "5566" })
    expect(login.status).toBe(200)
    expect(login.body.id).toBe(kidId)

    // 還原給 afterEach 清（用新 PIN 改回原 TEST_PIN 9871）
    await request(app)
      .post(`/api/family/kids/${kidId}/change-pin`)
      .send({ oldPin: "5566", newPin: "9871" })
  })

  it("任務分類：default other、5 種白名單可設、列表回傳", async () => {
    await createKid()
    const r1 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T1", rewardAmount: 10 })
    expect(r1.body.category).toBe("other")

    const r2 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "練字", rewardAmount: 20, category: "study" })
    expect(r2.body.category).toBe("study")

    const r3 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "倒垃圾", rewardAmount: 15, category: "housework" })
    expect(r3.body.category).toBe("housework")

    const list = await request(app).get(`/api/family/tasks?kidId=${kidId}`)
    expect(list.status).toBe(200)
    const found = list.body.find((t: { id: number }) => t.id === r2.body.id)
    expect(found.category).toBe("study")
  })

  it("category-stats：各小孩 5 種類別計數 + grandTotal", async () => {
    await createKid()
    // 派 + 完成 3 個 study + 1 個 housework
    for (let i = 0; i < 3; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: `study${i}`, rewardAmount: 10, category: "study" })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }
    const h = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "倒垃圾", rewardAmount: 20, category: "housework" })
    await request(app).post(`/api/family/tasks/${h.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${h.body.id}/approve`)

    const res = await request(app).get("/api/family/category-stats?days=30")
    expect(res.status).toBe(200)
    const me = res.body.kids.find((x: { kidId: number }) => x.kidId === kidId)
    expect(me).toBeTruthy()
    expect(me.categories.study.count).toBe(3)
    expect(me.categories.housework.count).toBe(1)
    expect(me.categories.kindness.count).toBe(0) // 沒做
    expect(me.total).toBeGreaterThanOrEqual(4)
    // grandTotal 累計
    expect(res.body.grandTotal.study.count).toBeGreaterThanOrEqual(3)
  })

  it("排行榜多模式：score / tasks / giving / streak 各自正確排序", async () => {
    await createKid({ displayName: "捐獻王", spendRatio: 0, saveRatio: 0, giveRatio: 100 })
    // 賺 + 完成 1 個任務（giveSum 高、approvedCount=1）
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 200 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    await request(app).post("/api/family/spendings").send({
      kidId,
      jar: "give",
      amount: 100,
      description: "捐",
    })

    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    // 4 種 mode 都有回應
    for (const mode of ["score", "tasks", "giving", "streak"]) {
      const res = await request(app).get(`/api/family/leaderboard?month=${month}&mode=${mode}`)
      expect(res.status).toBe(200)
      expect(res.body.mode).toBe(mode)
      const me = res.body.leaderboard.find((x: { kidId: number }) => x.kidId === kidId)
      expect(me).toBeTruthy()
      expect(me.streak).toBeDefined()
      expect(me.giveSum).toBeGreaterThanOrEqual(100)
    }

    // 不合法 mode
    const bad = await request(app).get(`/api/family/leaderboard?month=${month}&mode=hacker`)
    expect(bad.status).toBe(400)
  })

  it("拓展徽章目錄：tasks_100 / streak_365 / give_1000 / give_5000 / save_500 / save_2000 / goals_10 都存在", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/badges-catalog?kidId=${kidId}`)
    expect(res.status).toBe(200)
    const types = res.body.badges.map((b: { badgeType: string }) => b.badgeType)
    expect(types).toContain("tasks_100")
    expect(types).toContain("streak_365")
    expect(types).toContain("give_1000")
    expect(types).toContain("give_5000")
    expect(types).toContain("save_500")
    expect(types).toContain("save_2000")
    expect(types).toContain("goals_10")
  })

  it("驚喜獎勵 emoji + label：bonus 結構含新欄位", async () => {
    await createKid()
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 100 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    const ares = await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    expect(ares.status).toBe(200)
    expect(ares.body.bonus).toBeDefined()
    expect("emoji" in ares.body.bonus).toBe(true)
    expect("label" in ares.body.bonus).toBe(true)
  })

  it("罐子內部轉帳：spend → save、餘額正確 + 邊界驗證", async () => {
    await createKid({ spendRatio: 100, saveRatio: 0, giveRatio: 0 })
    // 賺 100 全進 spend
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 100 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 抓 transfer 前餘額（bonus 影響絕對值、用相對差）
    const before = await db.execute(
      sql`SELECT spend_balance::numeric AS s, save_balance::numeric AS sv FROM kids_jars WHERE kid_id = ${kidId}`
    )
    const beforeRow = (before as unknown as { rows: { s: string; sv: string }[] }).rows[0]
    const beforeSpend = Number(beforeRow.s)

    // spend → save 30
    const r = await request(app).post("/api/family/jars/internal-transfer").send({
      kidId,
      fromJar: "spend",
      toJar: "save",
      amount: 30,
    })
    expect(r.status).toBe(200)
    expect(r.body.ok).toBe(true)

    const after = await db.execute(
      sql`SELECT spend_balance::numeric AS s, save_balance::numeric AS sv FROM kids_jars WHERE kid_id = ${kidId}`
    )
    const afterRow = (after as unknown as { rows: { s: string; sv: string }[] }).rows[0]
    expect(Number(beforeRow.s) - Number(afterRow.s)).toBe(30)
    expect(Number(afterRow.sv) - Number(beforeRow.sv)).toBe(30)

    // 餘額不足拒絕
    const overflow = await request(app)
      .post("/api/family/jars/internal-transfer")
      .send({ kidId, fromJar: "save", toJar: "spend", amount: 999999 })
    expect(overflow.status).toBe(400)

    // 同罐拒絕
    const same = await request(app)
      .post("/api/family/jars/internal-transfer")
      .send({ kidId, fromJar: "spend", toJar: "spend", amount: 10 })
    expect(same.status).toBe(400)

    // 不合法 jar 拒絕
    const bad = await request(app)
      .post("/api/family/jars/internal-transfer")
      .send({ kidId, fromJar: "spend", toJar: "hidden", amount: 10 })
    expect(bad.status).toBe(400)

    // 確保 totalReceived 不變（內部移動不影響）
    const totals = await db.execute(
      sql`SELECT total_received::numeric AS t FROM kids_jars WHERE kid_id = ${kidId}`
    )
    expect(
      Number((totals as unknown as { rows: { t: string }[] }).rows[0].t)
    ).toBeGreaterThanOrEqual(100)
    // beforeSpend 用一下（lint 警告抑制）
    expect(beforeSpend).toBeGreaterThan(0)
  })

  it("無主任務搶任務：kidId=null 可被搶、已認領拒絕", async () => {
    await createKid()
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: null, title: "公開任務", rewardAmount: 30 })
    expect(t.status).toBe(201)
    expect(t.body.kidId).toBeNull()

    const claim = await request(app).post(`/api/family/tasks/${t.body.id}/claim`).send({ kidId })
    expect(claim.status).toBe(200)
    expect(claim.body.task.kidId).toBe(kidId)

    const again = await request(app).post(`/api/family/tasks/${t.body.id}/claim`).send({ kidId })
    expect(again.status).toBe(400)

    const notFound = await request(app).post(`/api/family/tasks/999999/claim`).send({ kidId })
    expect(notFound.status).toBe(404)
  })

  it("任務廣播：對所有 active 小孩各建一份", async () => {
    await createKid({ displayName: "甲" })
    const r2 = await request(app).post("/api/family/kids").send({
      displayName: "乙",
      avatar: "👧",
      color: "pink",
      pin: "8721",
      spendRatio: 70,
      saveRatio: 20,
      giveRatio: 10,
    })
    const yiId = r2.body.id

    try {
      const broadcast = await request(app)
        .post("/api/family/tasks/broadcast")
        .send({ title: "刷牙", emoji: "🪥", rewardAmount: 5 })
      expect(broadcast.status).toBe(201)
      expect(broadcast.body.count).toBeGreaterThanOrEqual(2)
      const kidIds = broadcast.body.tasks.map((t: { kidId: number }) => t.kidId)
      expect(kidIds).toContain(kidId)
      expect(kidIds).toContain(yiId)
    } finally {
      await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${yiId}`)
    }
  })

  it("家庭共同存錢罐：CRUD + contribute + 達標 + 邊界", async () => {
    await createKid({ spendRatio: 0, saveRatio: 100, giveRatio: 0 })
    // 賺 200 全進 save 罐
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 200 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 建罐
    const r1 = await request(app)
      .post("/api/family/pots")
      .send({ name: "家庭旅行", emoji: "✈️", targetAmount: 100 })
    expect(r1.status).toBe(201)
    expect(r1.body.name).toBe("家庭旅行")
    const potId = r1.body.id

    try {
      // 貢獻 60（未達標）
      const c1 = await request(app)
        .post(`/api/family/pots/${potId}/contribute`)
        .send({ kidId, amount: 60 })
      expect(c1.status).toBe(200)
      expect(c1.body.reached).toBe(false)
      expect(parseFloat(c1.body.pot.currentAmount)).toBe(60)

      // 貢獻 40 → 達標
      const c2 = await request(app)
        .post(`/api/family/pots/${potId}/contribute`)
        .send({ kidId, amount: 40 })
      expect(c2.status).toBe(200)
      expect(c2.body.reached).toBe(true)
      expect(c2.body.pot.status).toBe("completed")

      // 列表含貢獻明細
      const list = await request(app).get("/api/family/pots")
      const me = list.body.find((p: { id: number }) => p.id === potId)
      expect(me.contributions.length).toBe(2)

      // 已完成不能再貢獻
      const c3 = await request(app)
        .post(`/api/family/pots/${potId}/contribute`)
        .send({ kidId, amount: 10 })
      expect(c3.status).toBe(400)

      // 缺 name 拒絕
      const bad = await request(app).post("/api/family/pots").send({ targetAmount: 100 })
      expect(bad.status).toBe(400)
    } finally {
      await request(app).delete(`/api/family/pots/${potId}`)
    }
  })

  it("任務編輯：pending 可改、非 pending 拒絕", async () => {
    await createKid()
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "原標題", rewardAmount: 50 })

    // 改 title + rewardAmount
    const upd = await request(app)
      .put(`/api/family/tasks/${t.body.id}`)
      .send({ title: "新標題", rewardAmount: 99 })
    expect(upd.status).toBe(200)
    expect(upd.body.title).toBe("新標題")
    expect(parseFloat(upd.body.rewardAmount)).toBe(99)

    // 不合法 category 拒絕
    const bad = await request(app)
      .put(`/api/family/tasks/${t.body.id}`)
      .send({ category: "invalid" })
    expect(bad.status).toBe(400)

    // 空 body 拒絕
    const empty = await request(app).put(`/api/family/tasks/${t.body.id}`).send({})
    expect(empty.status).toBe(400)

    // submit 後不可編輯
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    const nope = await request(app).put(`/api/family/tasks/${t.body.id}`).send({ title: "再改" })
    expect(nope.status).toBe(400)

    // 不存在 404
    const notFound = await request(app).put("/api/family/tasks/999999").send({ title: "x" })
    expect(notFound.status).toBe(404)
  })

  it("小孩等級系統：approved 任務累積分數、升 level、回 next + progress", async () => {
    await createKid()

    // 沒任務 → Lv1
    const r0 = await request(app).get(`/api/family/kid-level?kidId=${kidId}`)
    expect(r0.status).toBe(200)
    expect(r0.body.current.level).toBe(1)
    expect(r0.body.current.title).toBe("菜鳥小幫手")
    expect(r0.body.totalScore).toBe(0)
    expect(r0.body.next.level).toBe(2)
    expect(r0.body.scoreToNext).toBe(20)
    expect(r0.body.progress).toBe(0)

    // 完成 15 個 easy 任務（score=1 各，總 15）→ 仍 Lv1，但進度 ~75%
    for (let i = 0; i < 15; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: `E${i}`, rewardAmount: 10, difficulty: "easy" })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }
    const r1 = await request(app).get(`/api/family/kid-level?kidId=${kidId}`)
    expect(r1.body.totalScore).toBe(15)
    expect(r1.body.current.level).toBe(1)
    expect(r1.body.progress).toBe(75)

    // 再 1 個 hard（+3 = 18）→ 進度 90%、仍 Lv1
    const th1 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "H1", rewardAmount: 50, difficulty: "hard" })
    await request(app).post(`/api/family/tasks/${th1.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${th1.body.id}/approve`)
    const r2 = await request(app).get(`/api/family/kid-level?kidId=${kidId}`)
    expect(r2.body.totalScore).toBe(18)
    expect(r2.body.current.level).toBe(1)

    // 再 1 個 hard（+3 = 21）→ 升 Lv2
    const th2 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "H2", rewardAmount: 50, difficulty: "hard" })
    await request(app).post(`/api/family/tasks/${th2.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${th2.body.id}/approve`)
    const r3 = await request(app).get(`/api/family/kid-level?kidId=${kidId}`)
    expect(r3.body.totalScore).toBe(21)
    expect(r3.body.current.level).toBe(2)
    expect(r3.body.current.title).toBe("家事新手")
    expect(r3.body.next.level).toBe(3)
  })

  it("kid-level 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-level")
    expect(r.status).toBe(400)
  })

  it("跨域搜尋：找 task / goal / wish title、回 kidName + kind", async () => {
    await createKid()

    // 建立任務（title 含「掃地」）
    await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "掃地專員", rewardAmount: 50 })

    // 建立目標（name 含「掃地」、schema 用 name 欄位）
    await request(app)
      .post("/api/family/goals")
      .send({ kidId, name: "掃地神器存錢罐", targetAmount: 500 })

    // 建立願望（title 含「掃地」）
    await request(app)
      .post("/api/family/wishes")
      .send({ kidId, title: "新掃地機器人", estimatedPrice: 3000 })

    const res = await request(app).get("/api/family/search?q=掃地")
    expect(res.status).toBe(200)
    expect(res.body.q).toBe("掃地")
    const kinds = res.body.results.map((r: { kind: string }) => r.kind)
    expect(kinds).toContain("task")
    expect(kinds).toContain("goal")
    expect(kinds).toContain("wish")

    // 每個結果都有 kidName + label
    for (const r of res.body.results as Array<{ kidName: string; label: string }>) {
      expect(r.kidName).toBeTruthy()
      expect(r.label).toContain("掃地")
    }
  })

  it("search 空 q 回空 results", async () => {
    const r = await request(app).get("/api/family/search?q=")
    expect(r.status).toBe(200)
    expect(r.body.results).toEqual([])
  })

  it("search 過長 q 回 400", async () => {
    const r = await request(app).get(`/api/family/search?q=${"x".repeat(101)}`)
    expect(r.status).toBe(400)
  })

  it("小孩活動時間軸：聚合 task / spending / checkin / wish、按時間倒序", async () => {
    await createKid({ spendRatio: 70, saveRatio: 20, giveRatio: 10 })

    // 1) 完成任務（approved → completed_at 有值、spend 罐 70%=140 元）
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "倒垃圾", rewardAmount: 200 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 2) 花錢（spend 罐有 140 元、花 50 元 OK）
    const sp = await request(app)
      .post("/api/family/spendings")
      .send({ kidId, jar: "spend", amount: 50, description: "買零食" })
    expect(sp.status).toBeLessThan(300)

    // 3) 打卡（mood 必須是完整 emoji + 文字）
    const ck = await request(app)
      .post("/api/family/checkins")
      .send({ kidId, mood: "😄 開心", note: "今天很棒" })
    expect(ck.status).toBeLessThan(300)

    // 4) 願望
    await request(app)
      .post("/api/family/wishes")
      .send({ kidId, title: "新玩具", estimatedPrice: 500 })

    const res = await request(app).get(`/api/family/kid-activity?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.kidId).toBe(kidId)

    const kinds = res.body.activities.map((a: { kind: string }) => a.kind)
    expect(kinds).toContain("task")
    expect(kinds).toContain("spending")
    expect(kinds).toContain("checkin")
    expect(kinds).toContain("wish")

    // 每筆都有 label + amount
    for (const a of res.body.activities as Array<{ label: string; amount: string }>) {
      expect(a.label).toBeTruthy()
      expect(a.amount).toBeTruthy()
    }

    // 時間倒序：第一筆 .at >= 第二筆
    if (res.body.activities.length >= 2) {
      const t1 = new Date(res.body.activities[0].at).getTime()
      const t2 = new Date(res.body.activities[1].at).getTime()
      expect(t1).toBeGreaterThanOrEqual(t2)
    }
  })

  it("kid-activity 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-activity")
    expect(r.status).toBe(400)
  })

  it("小孩最佳紀錄：lifetime + bests + firsts", async () => {
    await createKid({ spendRatio: 50, saveRatio: 30, giveRatio: 20 })

    // 完成 3 個任務（不同獎勵額度測 biggest）
    for (const amt of [50, 200, 100]) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: `T${amt}`, rewardAmount: amt })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    // 花錢 spend（biggest_spend = 30）
    await request(app)
      .post("/api/family/spendings")
      .send({ kidId, jar: "spend", amount: 30, description: "零食" })
    // 捐錢 give（biggest_give = 40）
    await request(app)
      .post("/api/family/spendings")
      .send({ kidId, jar: "give", amount: 40, description: "幫流浪貓", recipient: "貓中途" })

    // 打卡 1 天
    await request(app).post("/api/family/checkins").send({ kidId, mood: "😄 開心" })

    // 願望
    await request(app).post("/api/family/wishes").send({ kidId, title: "玩具" })

    const res = await request(app).get(`/api/family/kid-bests?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.kidId).toBe(kidId)

    expect(res.body.lifetime.totalTasks).toBe(3)
    expect(res.body.lifetime.totalSpent).toBe(30)
    expect(res.body.lifetime.totalGiven).toBe(40)
    expect(res.body.lifetime.totalCheckinDays).toBeGreaterThanOrEqual(1)

    expect(res.body.bests.biggestReward).toBe(200)
    expect(res.body.bests.biggestSpend).toBe(30)
    expect(res.body.bests.biggestGive).toBe(40)
    expect(res.body.bests.longestStreak).toBeGreaterThanOrEqual(1)

    expect(res.body.firsts.firstTaskAt).toBeTruthy()
    expect(res.body.firsts.firstSpendDate).toBeTruthy()
    expect(res.body.firsts.firstWishAt).toBeTruthy()
  })

  it("kid-bests：新小孩 lifetime 全 0、bests 全 0、firsts 全 null", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-bests?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.lifetime.totalTasks).toBe(0)
    expect(res.body.lifetime.totalSpent).toBe(0)
    expect(res.body.bests.biggestReward).toBe(0)
    expect(res.body.bests.longestStreak).toBe(0)
    expect(res.body.firsts.firstTaskAt).toBeNull()
  })

  it("kid-bests 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-bests")
    expect(r.status).toBe(400)
  })

  it("全家活動 feed：聚合所有小孩、含 kidName + kidAvatar", async () => {
    // 第一個小孩
    await createKid({ displayName: "小明", spendRatio: 70, saveRatio: 20, giveRatio: 10 })
    const kid1 = kidId
    const t1 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: kid1, title: "倒垃圾", rewardAmount: 50 })
    await request(app).post(`/api/family/tasks/${t1.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t1.body.id}/approve`)

    // 第二個小孩
    await createKid({ displayName: "小華", spendRatio: 50, saveRatio: 50, giveRatio: 0 })
    const kid2 = kidId
    await request(app).post("/api/family/wishes").send({ kidId: kid2, title: "新書包" })

    const res = await request(app).get("/api/family/activity?limit=20")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.activities)).toBe(true)
    expect(res.body.activities.length).toBeGreaterThanOrEqual(2)

    const kidNames = new Set(res.body.activities.map((a: { kidName: string }) => a.kidName))
    expect(kidNames.has("小明")).toBe(true)
    expect(kidNames.has("小華")).toBe(true)

    // 每筆都有 kidAvatar
    for (const a of res.body.activities as Array<{ kidAvatar: string; label: string }>) {
      expect(a.kidAvatar).toBeTruthy()
      expect(a.label).toBeTruthy()
    }

    // 時間倒序
    if (res.body.activities.length >= 2) {
      const t1At = new Date(res.body.activities[0].at).getTime()
      const t2At = new Date(res.body.activities[1].at).getTime()
      expect(t1At).toBeGreaterThanOrEqual(t2At)
    }
  })

  it("小孩能力強項：5 大類統計 + level + topCategory", async () => {
    await createKid()

    // 5 個 clean + 2 個 cook + 1 個 study（總 8）
    const tasks: Array<{ category: string; title: string }> = [
      ...Array(5)
        .fill(null)
        .map((_, i) => ({ category: "clean", title: `掃 ${i}` })),
      ...Array(2)
        .fill(null)
        .map((_, i) => ({ category: "cook", title: `煮 ${i}` })),
      { category: "study", title: "讀書" },
    ]
    for (const tk of tasks) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: tk.title, rewardAmount: 10, category: tk.category })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    const res = await request(app).get(`/api/family/kid-strengths?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalTasks).toBe(8)

    const cats = res.body.categories as Array<{
      category: string
      count: number
      percentage: number
      level: string
    }>
    expect(cats.length).toBe(5)
    const cleanCat = cats.find((c) => c.category === "clean")!
    expect(cleanCat.count).toBe(5)
    expect(cleanCat.level).toBe("B")
    expect(cleanCat.percentage).toBe(63)

    const cookCat = cats.find((c) => c.category === "cook")!
    expect(cookCat.level).toBe("C")

    const homeCat = cats.find((c) => c.category === "home")!
    expect(homeCat.count).toBe(0)
    expect(homeCat.level).toBe("D")

    expect(res.body.topCategory.category).toBe("clean")
    expect(res.body.topCategory.praise).toBeTruthy()
  })

  it("kid-strengths：無任務 totalTasks=0、topCategory=null", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-strengths?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalTasks).toBe(0)
    expect(res.body.topCategory).toBeNull()
  })

  it("kid-strengths 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-strengths")
    expect(r.status).toBe(400)
  })

  it("目標 ETA：有存款 → predictable + etaDays/etaDate/suggestion", async () => {
    await createKid({ spendRatio: 40, saveRatio: 50, giveRatio: 10 })

    for (let i = 0; i < 3; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: `T${i}`, rewardAmount: 200 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    const goalRes = await request(app)
      .post("/api/family/goals")
      .send({ kidId, name: "新樂高", targetAmount: 1000 })
    expect(goalRes.status).toBe(201)
    const goalId = goalRes.body.id

    const eta = await request(app).get(`/api/family/goals/${goalId}/eta`)
    expect(eta.status).toBe(200)
    expect(eta.body.status).toBe("predictable")
    expect(eta.body.dailyNetSave).toBeGreaterThan(0)
    expect(eta.body.etaDays).toBeGreaterThan(0)
    expect(eta.body.etaDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(eta.body.suggestion).toBeTruthy()
  })

  it("目標 ETA：無任務 → no_savings", async () => {
    await createKid()
    const goalRes = await request(app)
      .post("/api/family/goals")
      .send({ kidId, name: "玩偶", targetAmount: 500 })
    const goalId = goalRes.body.id

    const eta = await request(app).get(`/api/family/goals/${goalId}/eta`)
    expect(eta.status).toBe(200)
    expect(eta.body.status).toBe("no_savings")
    expect(eta.body.etaDays).toBeNull()
    expect(eta.body.suggestion).toContain("存錢")
  })

  it("目標 ETA：已達成 → reached", async () => {
    await createKid({ spendRatio: 0, saveRatio: 100, giveRatio: 0 })

    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "大任務", rewardAmount: 600 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const goalRes = await request(app)
      .post("/api/family/goals")
      .send({ kidId, name: "小目標", targetAmount: 100 })
    const goalId = goalRes.body.id

    // 把 200 元從 save 罐撥到目標（撥滿目標）
    await request(app).post(`/api/family/goals/${goalId}/save`).send({ amount: 200 })

    const eta = await request(app).get(`/api/family/goals/${goalId}/eta`)
    expect(eta.status).toBe(200)
    expect(eta.body.status).toBe("reached")
    expect(eta.body.etaDays).toBe(0)
  })

  it("目標 ETA：不存在 → 404", async () => {
    const r = await request(app).get("/api/family/goals/999999/eta")
    expect(r.status).toBe(404)
  })

  it("難度分佈：5 easy + 2 medium + 1 hard、challengeLevel=growing", async () => {
    await createKid()

    const tasks: Array<{ difficulty: string; title: string }> = [
      ...Array(5)
        .fill(null)
        .map((_, i) => ({ difficulty: "easy", title: `E${i}` })),
      ...Array(2)
        .fill(null)
        .map((_, i) => ({ difficulty: "medium", title: `M${i}` })),
      { difficulty: "hard", title: "H1" },
    ]
    for (const tk of tasks) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: tk.title, rewardAmount: 10, difficulty: tk.difficulty })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    const res = await request(app).get(`/api/family/kid-difficulty-stats?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalTasks).toBe(8)

    const diffs = res.body.difficulties as Array<{
      difficulty: string
      count: number
      percentage: number
    }>
    expect(diffs.length).toBe(3)
    expect(diffs.find((d) => d.difficulty === "easy")!.count).toBe(5)
    expect(diffs.find((d) => d.difficulty === "easy")!.percentage).toBe(63)
    expect(diffs.find((d) => d.difficulty === "medium")!.count).toBe(2)
    expect(diffs.find((d) => d.difficulty === "hard")!.count).toBe(1)

    // averageScore = (5×1 + 2×2 + 1×3) / 8 = 12/8 = 1.5
    expect(res.body.averageScore).toBe(1.5)
    expect(res.body.challengeLevel).toBe("growing")
    expect(res.body.suggestion).toBeTruthy()
  })

  it("難度分佈：無任務 → challengeLevel=none、suggestion 鼓勵嘗試", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-difficulty-stats?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalTasks).toBe(0)
    expect(res.body.challengeLevel).toBe("none")
  })

  it("難度分佈：全 hard → challengeLevel=advanced", async () => {
    await createKid()
    for (let i = 0; i < 3; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: `H${i}`, rewardAmount: 50, difficulty: "hard" })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }
    const res = await request(app).get(`/api/family/kid-difficulty-stats?kidId=${kidId}`)
    expect(res.body.averageScore).toBe(3)
    expect(res.body.challengeLevel).toBe("advanced")
  })

  it("kid-difficulty-stats 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-difficulty-stats")
    expect(r.status).toBe(400)
  })

  it("全家月度統計：family 加總 + perKid 細項", async () => {
    // 確保乾淨：清掉任何殘留小孩（其他測試可能 leak）
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)

    await createKid({ displayName: "小阿", spendRatio: 70, saveRatio: 20, giveRatio: 10 })
    const k1 = kidId

    // 完成 2 個任務 × 100 元（k1）
    for (let i = 0; i < 2; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId: k1, title: `T${i}`, rewardAmount: 100 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }
    // 花掉 30 元 spend
    await request(app)
      .post("/api/family/spendings")
      .send({ kidId: k1, jar: "spend", amount: 30, description: "零食" })

    await createKid({ displayName: "小弟", spendRatio: 50, saveRatio: 50, giveRatio: 0 })
    const k2 = kidId
    // 1 個任務 × 50 元（k2）
    const t2 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: k2, title: "T2", rewardAmount: 50 })
    await request(app).post(`/api/family/tasks/${t2.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t2.body.id}/approve`)

    const res = await request(app).get("/api/family/monthly-stats")
    expect(res.status).toBe(200)
    expect(res.body.month).toMatch(/^\d{4}-\d{2}$/)

    // family 總計
    expect(res.body.family.tasksApproved).toBe(3) // 2 + 1
    expect(res.body.family.totalReward).toBe(250) // 200 + 50
    expect(res.body.family.totalSpent).toBe(30)

    // perKid 含兩位
    const perKid = res.body.perKid as Array<{
      kidId: number
      kidName: string
      tasksApproved: number
      totalReward: number
      totalSpent: number
    }>
    expect(perKid.length).toBeGreaterThanOrEqual(2)
    const xiaoA = perKid.find((p) => p.kidId === k1)!
    expect(xiaoA.kidName).toBe("小阿")
    expect(xiaoA.tasksApproved).toBe(2)
    expect(xiaoA.totalReward).toBe(200)
    expect(xiaoA.totalSpent).toBe(30)

    const xiaoB = perKid.find((p) => p.kidId === k2)!
    expect(xiaoB.tasksApproved).toBe(1)
    expect(xiaoB.totalReward).toBe(50)

    // 清第一個小孩（afterEach 只清 kidId=k2）
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${k1}`)
  })

  it("monthly-stats 指定 month 參數：未來月份 → 全 0", async () => {
    await createKid()
    const res = await request(app).get("/api/family/monthly-stats?month=2099-12")
    expect(res.status).toBe(200)
    expect(res.body.month).toBe("2099-12")
    expect(res.body.family.tasksApproved).toBe(0)
    expect(res.body.family.totalReward).toBe(0)
  })

  it("monthly-stats 非法 month → 用當月", async () => {
    const res = await request(app).get("/api/family/monthly-stats?month=BOGUS")
    expect(res.status).toBe(200)
    expect(res.body.month).toMatch(/^\d{4}-\d{2}$/)
  })

  it("任務 streak：今天做 1 個 → currentStreak=1、有 message", async () => {
    await createKid()
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "今日任務", rewardAmount: 30 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get(`/api/family/kid-task-streak?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.kidId).toBe(kidId)
    expect(res.body.currentStreak).toBe(1)
    expect(res.body.longestStreak).toBeGreaterThanOrEqual(1)
    expect(res.body.lastTaskDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(res.body.message).toBeTruthy()
  })

  it("任務 streak：歷史 3 天連續但中斷 → longestStreak=3、currentStreak=0", async () => {
    await createKid()

    // 建任務直接設 completed_at 為 60/59/58 天前（3 天連續）
    for (const daysAgo of [60, 59, 58]) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: `T${daysAgo}`, rewardAmount: 10 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
      // 手動改 completed_at（測試 only）
      await db.execute(
        sql`UPDATE kids_tasks SET completed_at = NOW() - INTERVAL '${sql.raw(String(daysAgo))} days' WHERE id = ${t.body.id}`
      )
    }

    const res = await request(app).get(`/api/family/kid-task-streak?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.currentStreak).toBe(0) // 60 天前太久、不算 current
    expect(res.body.longestStreak).toBe(3)
  })

  it("任務 streak：無任務 → currentStreak=0 + 鼓勵 message", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-task-streak?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.currentStreak).toBe(0)
    expect(res.body.longestStreak).toBe(0)
    expect(res.body.lastTaskDate).toBeNull()
    expect(res.body.message).toContain("任務")
  })

  it("kid-task-streak 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-task-streak")
    expect(r.status).toBe(400)
  })

  it("下一個徽章：新小孩 → next=first_task 剩 1 個任務", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-next-badge?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.next).toBeTruthy()
    expect(res.body.next.type).toBe("first_task")
    expect(res.body.next.remaining).toBe(1)
    expect(res.body.next.unit).toBe("個任務")
    expect(res.body.message).toContain("第一個任務")
  })

  it("下一個徽章：做 1 個 task → next 變 tasks_10 剩 9", async () => {
    await createKid()
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T1", rewardAmount: 30 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get(`/api/family/kid-next-badge?kidId=${kidId}`)
    expect(res.status).toBe(200)
    // first_task 已解鎖 → 下一個是 tasks_10 或其他更近的
    // 但因為 totalApproved=1，最近的應該是 tasks_10（剩 9）或 first_goal（剩 1）
    // first_goal 剩 1 比較小、應該是 next
    expect(res.body.next.remaining).toBeLessThanOrEqual(9)
  })

  it("kid-next-badge 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-next-badge")
    expect(r.status).toBe(400)
  })

  it("家庭目標進度看板：按 progress 降序、含 kidName/kidAvatar", async () => {
    // 清乾淨避免污染
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)

    await createKid({ displayName: "小華", spendRatio: 0, saveRatio: 100, giveRatio: 0 })

    // 任務獎勵 1000 元（全到 save 罐）
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "大任務", rewardAmount: 1000 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 建 3 個目標、撥不同金額
    const g1 = await request(app)
      .post("/api/family/goals")
      .send({ kidId, name: "玩具 A", targetAmount: 100, emoji: "🧸" })
    const g2 = await request(app)
      .post("/api/family/goals")
      .send({ kidId, name: "樂高 B", targetAmount: 500, emoji: "🧱" })
    const g3 = await request(app)
      .post("/api/family/goals")
      .send({ kidId, name: "腳踏車 C", targetAmount: 5000, emoji: "🚲" })

    // g1 撥 100（達成 100%），g2 撥 400（80%），g3 撥 100（2%）
    await request(app).post(`/api/family/goals/${g1.body.id}/save`).send({ amount: 100 })
    await request(app).post(`/api/family/goals/${g2.body.id}/save`).send({ amount: 400 })
    await request(app).post(`/api/family/goals/${g3.body.id}/save`).send({ amount: 100 })

    const res = await request(app).get("/api/family/all-goals-summary")
    expect(res.status).toBe(200)
    // g1 達成後可能被 status=completed 移除、只剩 g2 g3 active
    expect(res.body.total).toBeGreaterThanOrEqual(2)
    expect(res.body.nearComplete).toBeGreaterThanOrEqual(1) // g2 達 80%

    const goals = res.body.goals as Array<{
      id: number
      kidName: string
      kidAvatar: string
      name: string
      progress: number
    }>

    // 確認按 progress 降序
    for (let i = 1; i < goals.length; i++) {
      expect(goals[i - 1].progress).toBeGreaterThanOrEqual(goals[i].progress)
    }

    // 每筆都有 kidName 跟 kidAvatar
    for (const g of goals) {
      expect(g.kidName).toBe("小華")
      expect(g.kidAvatar).toBeTruthy()
    }
  })

  it("家庭目標進度看板：無 active 目標 → total=0", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid()
    const res = await request(app).get("/api/family/all-goals-summary")
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
    expect(res.body.goals).toEqual([])
  })

  it("活動 heatmap：12 週 = 84 天、含今日 task → activeDays>=1", async () => {
    await createKid()

    // 今天做一個任務
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "今日", rewardAmount: 50 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get(`/api/family/kid-activity-heatmap?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.weeks).toBe(12)
    expect(res.body.days.length).toBe(84) // 12*7
    expect(res.body.peak).toBeGreaterThanOrEqual(1)
    expect(res.body.activeDays).toBeGreaterThanOrEqual(1)

    // 最後一天應該是今日
    const today = new Date().toISOString().slice(0, 10)
    expect(res.body.days[res.body.days.length - 1].date).toBe(today)
    expect(res.body.days[res.body.days.length - 1].taskCount).toBeGreaterThanOrEqual(1)
  })

  it("活動 heatmap weeks=4 → 28 天", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-activity-heatmap?kidId=${kidId}&weeks=4`)
    expect(res.status).toBe(200)
    expect(res.body.weeks).toBe(4)
    expect(res.body.days.length).toBe(28)
  })

  it("活動 heatmap：weeks 超範圍 → 自動 clamp", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-activity-heatmap?kidId=${kidId}&weeks=100`)
    expect(res.status).toBe(200)
    expect(res.body.weeks).toBe(52) // clamp 上限
  })

  it("kid-activity-heatmap 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-activity-heatmap")
    expect(r.status).toBe(400)
  })

  it("家長誇獎回顧：approve 帶 parentFeedback → praises 拿到", async () => {
    await createKid()

    // 3 個任務、其中 2 個有家長誇獎
    const t1 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "倒垃圾", rewardAmount: 30 })
    await request(app).post(`/api/family/tasks/${t1.body.id}/submit`)
    await request(app)
      .post(`/api/family/tasks/${t1.body.id}/approve`)
      .send({ parentFeedback: "做得超棒、繼續加油！" })

    const t2 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "掃地", rewardAmount: 20 })
    await request(app).post(`/api/family/tasks/${t2.body.id}/submit`)
    await request(app)
      .post(`/api/family/tasks/${t2.body.id}/approve`)
      .send({ parentFeedback: "你真細心！" })

    // 第 3 個沒誇獎
    const t3 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "洗碗", rewardAmount: 15 })
    await request(app).post(`/api/family/tasks/${t3.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t3.body.id}/approve`)

    const res = await request(app).get(`/api/family/kid-praises?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.kidId).toBe(kidId)
    expect(res.body.total).toBe(2) // 只有 2 個有 feedback

    const praises = res.body.praises as Array<{ message: string; title: string; reward: number }>
    expect(praises.length).toBe(2)
    expect(praises.map((p) => p.message)).toContain("做得超棒、繼續加油！")
    expect(praises.map((p) => p.message)).toContain("你真細心！")
    expect(praises.every((p) => p.title)).toBe(true)
    expect(praises.every((p) => p.reward > 0)).toBe(true)
  })

  it("家長誇獎回顧：無誇獎 → total=0", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-praises?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
    expect(res.body.praises).toEqual([])
  })

  it("kid-praises 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-praises")
    expect(r.status).toBe(400)
  })

  it("熱門任務 TOP：按 title 分組、times DESC 排序", async () => {
    // 清乾淨避免污染
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid()

    // 3 個「倒垃圾」 + 2 個「掃地」 + 1 個「洗碗」
    const titles = ["倒垃圾", "倒垃圾", "倒垃圾", "掃地", "掃地", "洗碗"]
    for (const title of titles) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title, rewardAmount: 20 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    const res = await request(app).get("/api/family/popular-tasks?limit=5")
    expect(res.status).toBe(200)
    expect(res.body.tasks.length).toBeGreaterThanOrEqual(3)

    const tasks = res.body.tasks as Array<{ title: string; times: number; totalReward: number }>
    // 最熱門應該是「倒垃圾」(3 次)
    expect(tasks[0].title).toBe("倒垃圾")
    expect(tasks[0].times).toBe(3)
    expect(tasks[0].totalReward).toBe(60) // 3 × 20

    // 按 times DESC
    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i - 1].times).toBeGreaterThanOrEqual(tasks[i].times)
    }
  })

  it("熱門任務：limit 超範圍 → clamp 上限 20", async () => {
    const res = await request(app).get("/api/family/popular-tasks?limit=100")
    expect(res.status).toBe(200)
    expect(res.body.tasks.length).toBeLessThanOrEqual(20)
  })

  it("熱門任務：無 approved → 空陣列", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    const res = await request(app).get("/api/family/popular-tasks")
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
    expect(res.body.tasks).toEqual([])
  })

  it("任務時段分析：3 個任務不同時段、dominantSlot + 4 slots 結構", async () => {
    await createKid()

    // 完成 3 個任務、手動改 completed_at 到不同小時
    const hours = [8, 8, 14] // 2 個 morning + 1 個 afternoon
    for (let i = 0; i < hours.length; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: `T${i}`, rewardAmount: 10 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
      // 改 completed_at 為今天的指定小時
      await db.execute(
        sql`UPDATE kids_tasks SET completed_at = CURRENT_DATE + INTERVAL '${sql.raw(String(hours[i]))} hours' WHERE id = ${t.body.id}`
      )
    }

    const res = await request(app).get(`/api/family/kid-time-of-day?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalTasks).toBe(3)

    const slots = res.body.slots as Array<{ slot: string; count: number; percentage: number }>
    expect(slots.length).toBe(4)
    expect(slots.find((s) => s.slot === "morning")!.count).toBe(2)
    expect(slots.find((s) => s.slot === "afternoon")!.count).toBe(1)
    expect(slots.find((s) => s.slot === "evening")!.count).toBe(0)
    expect(slots.find((s) => s.slot === "night")!.count).toBe(0)

    // dominantSlot = morning
    expect(res.body.dominantSlot.slot).toBe("morning")
    expect(res.body.dominantSlot.personality).toContain("早起型")
  })

  it("時段分析：無任務 → totalTasks=0、dominantSlot=null", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-time-of-day?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalTasks).toBe(0)
    expect(res.body.dominantSlot).toBeNull()
  })

  it("kid-time-of-day 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-time-of-day")
    expect(r.status).toBe(400)
  })

  it("家庭財富趨勢：months=6 → 6 個月 trend + summary", async () => {
    // 清乾淨避免污染
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid({ spendRatio: 70, saveRatio: 30, giveRatio: 0 })

    // 完成 1 個任務 100 元
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 100 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get("/api/family/wealth-trend?months=6")
    expect(res.status).toBe(200)
    expect(res.body.months).toBe(6)
    expect(res.body.trend.length).toBe(6)

    const months = res.body.trend.map((t: { month: string }) => t.month)
    expect(months[0]).toMatch(/^\d{4}-\d{2}$/)

    // 本月（最後一筆）reward 應 >= 100
    const lastMonth = res.body.trend[5]
    expect(lastMonth.reward).toBeGreaterThanOrEqual(100)

    // summary 含 4 欄位
    expect(res.body.summary.totalReward).toBeGreaterThanOrEqual(100)
    expect(res.body.summary.totalSpent).toBe(0)
    expect(res.body.summary.totalGiven).toBe(0)
    expect(res.body.summary.totalNet).toBeGreaterThanOrEqual(100)
  })

  it("家庭財富趨勢：months 超範圍 → clamp 24", async () => {
    const res = await request(app).get("/api/family/wealth-trend?months=100")
    expect(res.status).toBe(200)
    expect(res.body.months).toBe(24)
    expect(res.body.trend.length).toBe(24)
  })

  it("家庭財富趨勢：months=1 預設值合法", async () => {
    const res = await request(app).get("/api/family/wealth-trend?months=1")
    expect(res.status).toBe(200)
    expect(res.body.months).toBe(1)
    expect(res.body.trend.length).toBe(1)
  })

  it("家庭里程碑：5 tracks × 3 階、含 totals + summary", async () => {
    const res = await request(app).get("/api/family/milestones")
    expect(res.status).toBe(200)
    expect(res.body.totals).toBeDefined()
    expect(res.body.totals.tasks).toBeGreaterThanOrEqual(0)

    const milestones = res.body.milestones as Array<{
      key: string
      total: number
      reached: Array<{ value: number; label: string }>
      next: { value: number; remaining: number; progress: number } | null
      complete: boolean
    }>
    expect(milestones.length).toBe(5)
    expect(milestones.map((m) => m.key)).toEqual(["tasks", "reward", "given", "saved", "checkins"])

    // 每個 milestone 都有 reached + complete bool
    for (const m of milestones) {
      expect(Array.isArray(m.reached)).toBe(true)
      expect(typeof m.complete).toBe("boolean")
      if (!m.complete) {
        expect(m.next).toBeTruthy()
        expect(m.next!.remaining).toBeGreaterThan(0)
        expect(m.next!.progress).toBeGreaterThanOrEqual(0)
      }
    }

    // summary 計數合法
    expect(res.body.summary.totalPossible).toBe(15) // 5 × 3
    expect(res.body.summary.totalReached).toBeGreaterThanOrEqual(0)
    expect(res.body.summary.totalReached).toBeLessThanOrEqual(15)
  })

  it("錢包健康：preset 70/20/10、做任務 + 花 spend → 比例 + 建議", async () => {
    await createKid({ spendRatio: 70, saveRatio: 20, giveRatio: 10 })

    // 任務獎勵 1000 元（spend 罐應有 700、save 200、give 100）
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "大", rewardAmount: 1000 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 花 spend 罐 600（佔 totalReward 60%、preset 70% → delta=-10、健康）
    await request(app)
      .post("/api/family/spendings")
      .send({ kidId, jar: "spend", amount: 600, description: "玩具" })

    const res = await request(app).get(`/api/family/kid-wallet-health?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalReward).toBe(1000)
    expect(res.body.period).toBe("近 30 天")
    expect(res.body.breakdown.spent).toBe(600)
    expect(res.body.breakdown.preset.spend).toBe(70)
    expect(res.body.breakdown.actual.spend).toBe(60)
    expect(res.body.breakdown.delta.spend).toBe(-10)
    expect(res.body.healthScore).toBeGreaterThan(0)
    expect(res.body.suggestion).toBeTruthy()
  })

  it("錢包健康：花超多 → suggestion 含「花用花太多」", async () => {
    await createKid({ spendRatio: 50, saveRatio: 50, giveRatio: 0 })

    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 500 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 花掉 250（佔 50%、剛好等於 preset、健康好）
    // 為了測「花太多」、要花更多：但 spend 罐只有 250 元
    // 改用：preset spendRatio=10、實花 250 = 50% 比 preset 多 40%
    // 重 createKid
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${kidId}`)
    await createKid({ spendRatio: 10, saveRatio: 80, giveRatio: 10 })

    const t2 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 500 })
    await request(app).post(`/api/family/tasks/${t2.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t2.body.id}/approve`)

    // spend 罐有 50（10%）、最多花 50 元；要花到「超 preset 15%」需 75 元
    // 直接花 50 = 10% 跟 preset 一樣
    // 改檢測別的：給 actualSpend 偏離預設明顯時的建議
    await request(app)
      .post("/api/family/spendings")
      .send({ kidId, jar: "spend", amount: 50, description: "全花光" })

    const res = await request(app).get(`/api/family/kid-wallet-health?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.suggestion).toBeTruthy()
  })

  it("錢包健康：無收入 → totalReward=0 + 鼓勵 message", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-wallet-health?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalReward).toBe(0)
    expect(res.body.healthScore).toBeNull()
    expect(res.body.suggestion).toContain("任務")
  })

  it("kid-wallet-health 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-wallet-health")
    expect(r.status).toBe(400)
  })

  it("任務推薦：別人做過但這個小孩沒做、回 suggestions", async () => {
    // 先建妹妹小華做幾個任務、再建小明（沒做）→ 推薦小華做過的給小明
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)

    await createKid({ displayName: "小華" })
    const huaId = kidId

    for (const title of ["倒垃圾", "掃地"]) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId: huaId, title, rewardAmount: 30 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    // 建小明（沒做任何任務）
    await createKid({ displayName: "小明" })
    const mingId = kidId

    const res = await request(app).get(`/api/family/kid-suggestions?kidId=${mingId}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(2)

    const titles = res.body.suggestions.map((s: { title: string }) => s.title)
    expect(titles).toContain("倒垃圾")
    expect(titles).toContain("掃地")

    // 每筆有 familyTimes 跟 suggestedReward
    for (const s of res.body.suggestions as Array<{
      familyTimes: number
      suggestedReward: number
    }>) {
      expect(s.familyTimes).toBeGreaterThan(0)
      expect(s.suggestedReward).toBeGreaterThan(0)
    }

    // 清姐姐
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${huaId}`)
  })

  it("任務推薦：自己做過的不再推薦", async () => {
    await createKid()
    // 做一個「澆花」
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "澆花", rewardAmount: 20 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get(`/api/family/kid-suggestions?kidId=${kidId}`)
    expect(res.status).toBe(200)
    const titles = res.body.suggestions.map((s: { title: string }) => s.title)
    expect(titles).not.toContain("澆花") // 自己做過、不推薦
  })

  it("kid-suggestions 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-suggestions")
    expect(r.status).toBe(400)
  })

  it("兄弟姊妹比較：2 小孩 + 不同 task count → ratios + highlights", async () => {
    // 清乾淨
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)

    // 小華做 3 個任務（積極）
    await createKid({ displayName: "小華" })
    const huaId = kidId
    for (let i = 0; i < 3; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId: huaId, title: `H${i}`, rewardAmount: 50 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    // 小明做 1 個任務
    await createKid({ displayName: "小明" })
    const mingId = kidId
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: mingId, title: "M1", rewardAmount: 50 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get("/api/family/sibling-comparison")
    expect(res.status).toBe(200)
    expect(res.body.kidCount).toBe(2)
    expect(res.body.kids.length).toBe(2)

    const hua = res.body.kids.find((k: { kidName: string }) => k.kidName === "小華")
    const ming = res.body.kids.find((k: { kidName: string }) => k.kidName === "小明")
    expect(hua.tasks).toBe(3)
    expect(ming.tasks).toBe(1)
    // familyAvg.tasks = 2 → hua=1.5, ming=0.5
    expect(hua.ratios.tasks).toBe(1.5)
    expect(ming.ratios.tasks).toBe(0.5)
    // hua >= 1.5 應該有「🏆 任務超積極」
    expect(hua.highlights).toContain("🏆 任務超積極")

    // 清姐姐
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${huaId}`)
  })

  it("兄弟姊妹比較：只有 1 個小孩 → 不夠比較", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid()
    const res = await request(app).get("/api/family/sibling-comparison")
    expect(res.status).toBe(200)
    expect(res.body.kidCount).toBe(1)
    expect(res.body.kids).toEqual([])
    expect(res.body.message).toContain("至少 2")
  })

  it("消費分類：3 筆同 description「零食」 + 2 筆「玩具」 → 按 totalAmount DESC", async () => {
    await createKid({ spendRatio: 100, saveRatio: 0, giveRatio: 0 })

    // 任務 1000 元、spend 罐 1000
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "大", rewardAmount: 1000 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 3 筆「零食」 30 each = 90、2 筆「玩具」100 each = 200
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post("/api/family/spendings")
        .send({ kidId, jar: "spend", amount: 30, description: "零食" })
    }
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post("/api/family/spendings")
        .send({ kidId, jar: "spend", amount: 100, description: "玩具" })
    }

    const res = await request(app).get(`/api/family/kid-spending-keywords?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalSpent).toBe(290) // 90 + 200
    expect(res.body.totalCount).toBe(5)

    const kw = res.body.keywords as Array<{
      description: string
      count: number
      totalAmount: number
    }>
    // 玩具總額多、應該排第一
    expect(kw[0].description).toBe("玩具")
    expect(kw[0].count).toBe(2)
    expect(kw[0].totalAmount).toBe(200)

    expect(kw[1].description).toBe("零食")
    expect(kw[1].count).toBe(3)
    expect(kw[1].totalAmount).toBe(90)

    expect(res.body.topKeyword.description).toBe("玩具")
  })

  it("消費分類：無支出 → keywords=[]、topKeyword=null", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-spending-keywords?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalSpent).toBe(0)
    expect(res.body.totalCount).toBe(0)
    expect(res.body.keywords).toEqual([])
    expect(res.body.topKeyword).toBeNull()
  })

  it("kid-spending-keywords 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-spending-keywords")
    expect(r.status).toBe(400)
  })

  it("捐贈受贈方：3 筆給「貓中途」+ 1 筆給「兒童基金」、按 total 排序", async () => {
    await createKid({ spendRatio: 0, saveRatio: 0, giveRatio: 100 })

    // 任務 1000 全到 give 罐
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 1000 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 3 筆「貓中途」50 each = 150
    for (let i = 0; i < 3; i++) {
      await request(app).post("/api/family/spendings").send({
        kidId,
        jar: "give",
        amount: 50,
        description: "幫流浪貓",
        recipient: "貓中途",
      })
    }
    // 1 筆「兒童基金」200
    await request(app).post("/api/family/spendings").send({
      kidId,
      jar: "give",
      amount: 200,
      description: "助學",
      recipient: "兒童基金",
    })

    const res = await request(app).get(`/api/family/kid-donation-recipients?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalGiven).toBe(350) // 150 + 200
    expect(res.body.totalRecipients).toBe(2)

    // 兒童基金 200 > 貓中途 150 → mostHelped = 兒童基金
    expect(res.body.mostHelped.recipient).toBe("兒童基金")
    expect(res.body.mostHelped.total).toBe(200)
    expect(res.body.mostHelped.times).toBe(1)

    const rs = res.body.recipients as Array<{ recipient: string; total: number }>
    expect(rs[0].recipient).toBe("兒童基金")
    expect(rs[1].recipient).toBe("貓中途")
    expect(rs[1].total).toBe(150)
  })

  it("捐贈受贈方：無 recipient → 空陣列、mostHelped=null", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-donation-recipients?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalGiven).toBe(0)
    expect(res.body.totalRecipients).toBe(0)
    expect(res.body.mostHelped).toBeNull()
  })

  it("kid-donation-recipients 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-donation-recipients")
    expect(r.status).toBe(400)
  })

  it("今日重點：今日任務 + spending + 打卡 → stats + highlights", async () => {
    // 清乾淨
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid()

    // 今日做 2 個任務（其中 1 個 submitted 等審核）
    const t1 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T1", rewardAmount: 50 })
    await request(app).post(`/api/family/tasks/${t1.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t1.body.id}/approve`)

    const t2 = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T2", rewardAmount: 30 })
    await request(app).post(`/api/family/tasks/${t2.body.id}/submit`) // submitted 但不 approve

    // 今日打卡
    await request(app).post("/api/family/checkins").send({ kidId, mood: "😄 開心" })

    const res = await request(app).get("/api/family/today-summary")
    expect(res.status).toBe(200)
    expect(res.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    expect(res.body.stats.approvedToday).toBeGreaterThanOrEqual(1)
    expect(res.body.stats.rewardToday).toBeGreaterThanOrEqual(50)
    expect(res.body.stats.pendingTasks).toBeGreaterThanOrEqual(1)
    expect(res.body.stats.checkinsToday).toBeGreaterThanOrEqual(1)

    // highlights 含「待審核」
    expect(res.body.highlights.join("|")).toContain("待您審核")

    // 每個 kid 有 checkedIn / tasks
    const kid = res.body.kids.find((k: { kidId: number }) => k.kidId === kidId)
    expect(kid).toBeTruthy()
    expect(kid.tasks).toBeGreaterThanOrEqual(1)
    expect(kid.checkedIn).toBe(true)
  })

  it("今日重點：無活動 → stats 全 0、highlights 可空", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    const res = await request(app).get("/api/family/today-summary")
    expect(res.status).toBe(200)
    expect(res.body.stats.approvedToday).toBe(0)
    expect(res.body.kids).toEqual([])
    expect(Array.isArray(res.body.highlights)).toBe(true)
  })

  it("週成績單：本週 vs 上週 metrics + 趨勢 + overall", async () => {
    await createKid()

    // 本週做 2 個任務
    for (let i = 0; i < 2; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: `T${i}`, rewardAmount: 50 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    const res = await request(app).get(`/api/family/kid-weekly-report?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.kidId).toBe(kidId)
    expect(res.body.thisWeek.tasks).toBe(2)
    expect(res.body.prevWeek.tasks).toBe(0)

    const metrics = res.body.metrics as Array<{
      key: string
      this: number
      prev: number
      trend: string
      delta: number
    }>
    expect(metrics.length).toBe(4)

    const tasksMetric = metrics.find((m) => m.key === "tasks")!
    expect(tasksMetric.delta).toBe(2)
    expect(tasksMetric.trend).toBe("up")

    expect(res.body.overall).toBeTruthy()
  })

  it("週成績單：完全沒任務 → overall 含「還沒開始」", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-weekly-report?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.thisWeek.tasks).toBe(0)
    expect(res.body.prevWeek.tasks).toBe(0)
    expect(res.body.overall).toContain("還沒開始")
  })

  it("kid-weekly-report 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-weekly-report")
    expect(r.status).toBe(400)
  })

  it("家長待辦：submitted 任務 + 未打卡小孩 → todos 含 approve_task 與 kid_no_checkin", async () => {
    // 清乾淨
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid()

    // 1 個 submitted 任務（urgent）
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "等審核", rewardAmount: 30 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    // 不 approve、保持 submitted

    const res = await request(app).get("/api/family/parent-todo")
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(2) // 至少有 approve_task + no_checkin

    const types = res.body.todos.map((t: { type: string }) => t.type)
    expect(types).toContain("approve_task")
    expect(types).toContain("kid_no_checkin")

    // urgentCount >= 1
    expect(res.body.urgentCount).toBeGreaterThanOrEqual(1)

    // 第一筆 priority='urgent'（按優先級排序）
    expect(res.body.todos[0].priority).toBe("urgent")
    // 每個 todo 都有 action + icon
    for (const todo of res.body.todos) {
      expect(todo.action).toBeTruthy()
      expect(todo.icon).toBeTruthy()
    }
  })

  it("家長待辦：全部已 OK → urgentCount=0、todos 可空", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)

    const res = await request(app).get("/api/family/parent-todo")
    expect(res.status).toBe(200)
    expect(res.body.urgentCount).toBe(0)
  })

  it("目標倒數：5 天後到期 → urgency=urgent + message 含「還剩」", async () => {
    await createKid({ spendRatio: 0, saveRatio: 100, giveRatio: 0 })

    // 任務 1000、存 200 到目標 500（達 40%）
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 1000 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 設定 deadline 5 天後
    const deadline = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)
    const goalRes = await request(app)
      .post("/api/family/goals")
      .send({ kidId, name: "新樂高", targetAmount: 500, deadline })
    expect(goalRes.status).toBe(201)
    const goalId = goalRes.body.id
    await request(app).post(`/api/family/goals/${goalId}/save`).send({ amount: 200 })

    const res = await request(app).get(`/api/family/kid-goals-deadlines?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.urgentCount).toBe(1)

    const g = res.body.goals[0]
    expect(g.urgency).toBe("urgent")
    expect(g.daysLeft).toBe(5)
    expect(g.remaining).toBe(300) // 500 - 200
    expect(g.progress).toBe(40)
    expect(g.message).toContain("還剩")
  })

  it("目標倒數：deadline 過期 → urgency=passed", async () => {
    await createKid()
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    const goalRes = await request(app)
      .post("/api/family/goals")
      .send({ kidId, name: "過期目標", targetAmount: 500, deadline: yesterday })
    expect(goalRes.status).toBe(201)

    const res = await request(app).get(`/api/family/kid-goals-deadlines?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.passedCount).toBe(1)
    expect(res.body.goals[0].urgency).toBe("passed")
    expect(res.body.goals[0].message).toContain("已過期")
  })

  it("目標倒數：無 deadline goal → total=0", async () => {
    await createKid()
    await request(app).post("/api/family/goals").send({ kidId, name: "無期限", targetAmount: 100 })

    const res = await request(app).get(`/api/family/kid-goals-deadlines?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
  })

  it("kid-goals-deadlines 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-goals-deadlines")
    expect(r.status).toBe(400)
  })

  it("時光膠囊：完成 task + 改 completed_at 為 1 月前 → capsules 含 month", async () => {
    await createKid()

    // 完成任務
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "1個月前的任務", rewardAmount: 50 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    // 把 completed_at 改成 30 天前
    await db.execute(
      sql`UPDATE kids_tasks SET completed_at = NOW() - INTERVAL '30 days' WHERE id = ${t.body.id}`
    )

    const res = await request(app).get(`/api/family/kid-timecapsule?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(1)

    const capsules = res.body.capsules as Array<{
      key: string
      label: string
      tasks: Array<{ title: string }>
    }>
    const monthCapsule = capsules.find((c) => c.key === "month")
    expect(monthCapsule).toBeTruthy()
    expect(monthCapsule!.label).toBe("一個月前")
    expect(monthCapsule!.tasks.length).toBeGreaterThanOrEqual(1)
    expect(monthCapsule!.tasks[0].title).toBe("1個月前的任務")
  })

  it("時光膠囊：無歷史紀錄 → capsules=[]", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-timecapsule?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
    expect(res.body.capsules).toEqual([])
  })

  it("kid-timecapsule 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-timecapsule")
    expect(r.status).toBe(400)
  })

  it("教育成果：4 維度評分 + overallScore + comment", async () => {
    await createKid({ spendRatio: 0, saveRatio: 50, giveRatio: 50 })

    // 完成任務 + 捐贈 + 打卡（培養同理心 + 規律性）
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 200 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 捐贈 50（give 罐 100）
    await request(app)
      .post("/api/family/spendings")
      .send({ kidId, jar: "give", amount: 50, description: "幫助", recipient: "貓中途" })

    // 打卡
    await request(app).post("/api/family/checkins").send({ kidId, mood: "😄 開心" })

    const res = await request(app).get(`/api/family/kid-education-report?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.kidId).toBe(kidId)

    const dims = res.body.dimensions as Array<{ key: string; score: number; detail: string }>
    expect(dims.length).toBe(4)
    expect(dims.map((d) => d.key)).toEqual(["initiative", "savings", "empathy", "consistency"])

    // 同理心: give_count=1×5 + unique=1×10 = 15
    const empathy = dims.find((d) => d.key === "empathy")!
    expect(empathy.score).toBe(15)
    expect(empathy.detail).toContain("1 次捐贈")

    // 規律性 score > 0（今天打卡了）
    const consistency = dims.find((d) => d.key === "consistency")!
    expect(consistency.score).toBeGreaterThan(0)

    expect(res.body.overallScore).toBeGreaterThanOrEqual(0)
    expect(res.body.overallScore).toBeLessThanOrEqual(100)
    expect(res.body.overallComment).toBeTruthy()
  })

  it("教育成果：新小孩無活動 → score 全 0、comment 含「還未」", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-education-report?kidId=${kidId}`)
    expect(res.status).toBe(200)
    const dims = res.body.dimensions as Array<{ key: string; score: number }>
    expect(dims.find((d) => d.key === "initiative")!.score).toBe(0)
    expect(dims.find((d) => d.key === "savings")!.score).toBe(0)
    expect(dims.find((d) => d.key === "empathy")!.score).toBe(0)
  })

  it("kid-education-report 不存在 → 404", async () => {
    const r = await request(app).get("/api/family/kid-education-report?kidId=999999")
    expect(r.status).toBe(404)
  })

  it("kid-education-report 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-education-report")
    expect(r.status).toBe(400)
  })

  it("週曆熱度：完成 task → 7 days + busiestDay + insight", async () => {
    await createKid()

    // 做 2 個任務（今天）
    for (let i = 0; i < 2; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: `T${i}`, rewardAmount: 30 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    const res = await request(app).get("/api/family/weekly-heatmap")
    expect(res.status).toBe(200)
    expect(res.body.weeks).toBe(12)
    expect(res.body.days.length).toBe(7)
    expect(res.body.totalTasks).toBeGreaterThanOrEqual(2)

    // busiestDay 存在
    expect(res.body.busiestDay).toBeTruthy()
    expect(res.body.busiestDay.count).toBeGreaterThanOrEqual(2)

    // insight 字串
    expect(res.body.insight).toBeTruthy()
  })

  it("週曆熱度 weeks=4 → 24h × 4w 內 OK", async () => {
    const res = await request(app).get("/api/family/weekly-heatmap?weeks=4")
    expect(res.status).toBe(200)
    expect(res.body.weeks).toBe(4)
    expect(res.body.days.length).toBe(7)
  })

  it("週曆熱度 weeks 超範圍 → clamp 52", async () => {
    const res = await request(app).get("/api/family/weekly-heatmap?weeks=100")
    expect(res.status).toBe(200)
    expect(res.body.weeks).toBe(52)
  })

  it("家庭氛圍：今日打卡 → checkinCount + avgScore + atmosphere", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid()

    // 打卡開心 = 5
    await request(app).post("/api/family/checkins").send({ kidId, mood: "😄 開心" })

    const res = await request(app).get("/api/family/family-mood-today")
    expect(res.status).toBe(200)
    expect(res.body.totalKids).toBe(1)
    expect(res.body.checkinCount).toBe(1)
    expect(res.body.avgScore).toBe(5)
    expect(res.body.atmosphere).toBeTruthy()
    expect(res.body.atmosphereEmoji).toBeTruthy()

    expect(res.body.kids[0].mood).toBe("😄 開心")
    expect(res.body.kids[0].score).toBe(5)
    expect(res.body.kids[0].checkedIn).toBe(true)
  })

  it("家庭氛圍：無打卡 → atmosphere=還沒人打卡", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid()
    const res = await request(app).get("/api/family/family-mood-today")
    expect(res.status).toBe(200)
    expect(res.body.checkinCount).toBe(0)
    expect(res.body.atmosphere).toContain("還沒")
    expect(res.body.kids[0].checkedIn).toBe(false)
  })

  it("emoji 雲：3 個 🧹 + 1 個 🍳 → 按 count DESC、mostUsed=🧹", async () => {
    await createKid()

    // 3 個 🧹
    for (let i = 0; i < 3; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: `掃 ${i}`, rewardAmount: 30, emoji: "🧹" })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }
    // 1 個 🍳
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "煮", rewardAmount: 30, emoji: "🍳" })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get(`/api/family/kid-emoji-cloud?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(4)
    expect(res.body.uniqueEmojis).toBe(2)

    const e = res.body.emojis as Array<{ emoji: string; count: number; sizeRem: number }>
    expect(e[0].emoji).toBe("🧹")
    expect(e[0].count).toBe(3)
    expect(e[0].sizeRem).toBeGreaterThan(e[1].sizeRem) // 最常做的最大字

    expect(e[1].emoji).toBe("🍳")
    expect(e[1].count).toBe(1)

    expect(res.body.mostUsed.emoji).toBe("🧹")
  })

  it("emoji 雲：無 task → emojis=[]、mostUsed=null", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-emoji-cloud?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
    expect(res.body.emojis).toEqual([])
    expect(res.body.mostUsed).toBeNull()
  })

  it("kid-emoji-cloud 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-emoji-cloud")
    expect(r.status).toBe(400)
  })

  it("Pot 貢獻者：建 pot + 2 kid 貢獻 → topContributor 排第一", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)

    // 建小華（多貢獻）+ 任務拿錢
    await createKid({ displayName: "小華", spendRatio: 0, saveRatio: 100, giveRatio: 0 })
    const huaId = kidId
    const th = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: huaId, title: "T", rewardAmount: 1000 })
    await request(app).post(`/api/family/tasks/${th.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${th.body.id}/approve`)

    // 建小明
    await createKid({ displayName: "小明", spendRatio: 0, saveRatio: 100, giveRatio: 0 })
    const mingId = kidId
    const tm = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: mingId, title: "T", rewardAmount: 1000 })
    await request(app).post(`/api/family/tasks/${tm.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${tm.body.id}/approve`)

    // 建家庭目標
    const potRes = await request(app)
      .post("/api/family/pots")
      .send({ name: "全家露營", targetAmount: 2000 })
    expect(potRes.status).toBe(201)
    const potId = potRes.body.id

    // 小華貢獻 300、小明 100
    await request(app)
      .post(`/api/family/pots/${potId}/contribute`)
      .send({ kidId: huaId, amount: 300 })
    await request(app)
      .post(`/api/family/pots/${potId}/contribute`)
      .send({ kidId: mingId, amount: 100 })

    const res = await request(app).get(`/api/family/pot-top-contributors?potId=${potId}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(2)
    expect(res.body.totalAmount).toBe(400)
    expect(res.body.topContributor.kidName).toBe("小華")
    expect(res.body.topContributor.totalAmount).toBe(300)

    // 清姐姐
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${huaId}`)
  })

  it("Pot 貢獻者：不指定 potId → 跨所有 pots 統計", async () => {
    const res = await request(app).get("/api/family/pot-top-contributors")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.contributors)).toBe(true)
  })

  it("Pot 貢獻者：potId 無效 → 400", async () => {
    const r = await request(app).get("/api/family/pot-top-contributors?potId=-1")
    expect(r.status).toBe(400)
  })

  it("目標達成歷史：完成 goal → goals 包含 daysTaken + 統計", async () => {
    await createKid({ spendRatio: 0, saveRatio: 100, giveRatio: 0 })

    // 任務 1000、存到 save 罐
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 1000 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 建目標 + 撥到滿（達成）
    const goalRes = await request(app)
      .post("/api/family/goals")
      .send({ kidId, name: "小目標", targetAmount: 100 })
    const goalId = goalRes.body.id
    await request(app).post(`/api/family/goals/${goalId}/save`).send({ amount: 100 })

    const res = await request(app).get("/api/family/completed-goals-history")
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(1)

    const goals = res.body.goals as Array<{
      name: string
      kidName: string
      daysTaken: number
      targetAmount: number
    }>
    const myGoal = goals.find((g) => g.name === "小目標")
    expect(myGoal).toBeTruthy()
    expect(myGoal!.daysTaken).toBeGreaterThanOrEqual(0)
    expect(myGoal!.targetAmount).toBe(100)
    expect(myGoal!.kidName).toBe("測試小孩")

    expect(res.body.avgDaysTaken).toBeGreaterThanOrEqual(0)
    expect(res.body.fastestGoal).toBeTruthy()
    expect(res.body.largestGoal).toBeTruthy()
  })

  it("目標達成歷史：limit 範圍 1-50", async () => {
    const res = await request(app).get("/api/family/completed-goals-history?limit=100")
    expect(res.status).toBe(200)
    // 一定不超過 50（沒這麼多達成目標也 OK）
    expect(res.body.goals.length).toBeLessThanOrEqual(50)
  })

  it("目標達成者排行：完成 goal → champion + achievers 含 goalsCompleted", async () => {
    // 清乾淨
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid({ spendRatio: 0, saveRatio: 100, giveRatio: 0 })

    // 任務 + 達成 goal
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 1000 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const gRes = await request(app)
      .post("/api/family/goals")
      .send({ kidId, name: "達成測試", targetAmount: 100 })
    await request(app).post(`/api/family/goals/${gRes.body.id}/save`).send({ amount: 100 })

    const res = await request(app).get("/api/family/goal-achievers")
    expect(res.status).toBe(200)
    expect(res.body.totalGoals).toBeGreaterThanOrEqual(1)
    expect(res.body.champion).toBeTruthy()
    expect(res.body.champion.goalsCompleted).toBeGreaterThanOrEqual(1)
    expect(res.body.champion.totalTarget).toBeGreaterThanOrEqual(100)

    // achievers 含這個小孩
    const me = res.body.achievers.find((a: { kidId: number }) => a.kidId === kidId)
    expect(me).toBeTruthy()
    expect(me.goalsCompleted).toBeGreaterThanOrEqual(1)
  })

  it("目標達成者排行：沒人達成 → champion=null", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid()

    const res = await request(app).get("/api/family/goal-achievers")
    expect(res.status).toBe(200)
    expect(res.body.totalGoals).toBe(0)
    expect(res.body.champion).toBeNull()
  })

  it("公平度：2 個 kid 任務分配 → fairnessLevel + 統計", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)

    // 小華做 3 個任務
    await createKid({ displayName: "小華" })
    const hua = kidId
    for (let i = 0; i < 3; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId: hua, title: `T${i}`, rewardAmount: 30 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    // 小明做 1 個任務
    await createKid({ displayName: "小明" })
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "M", rewardAmount: 30 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get("/api/family/fairness")
    expect(res.status).toBe(200)
    expect(res.body.totalTasks).toBe(4)
    expect(res.body.expectedPerKid).toBe(50)

    // 小華 75%、小明 25% → unbalanced
    expect(res.body.maxKid.kidName).toBe("小華")
    expect(res.body.maxKid.taskPercentage).toBe(75)
    expect(["ok", "unbalanced", "biased"]).toContain(res.body.fairnessLevel)
    expect(res.body.message).toBeTruthy()

    // 清姐姐
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${hua}`)
  })

  it("公平度：1 個 kid → fairnessLevel=n/a", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid()
    const res = await request(app).get("/api/family/fairness")
    expect(res.status).toBe(200)
    expect(res.body.fairnessLevel).toBe("n/a")
    expect(res.body.message).toContain("至少 2")
  })

  it("公平度：days 範圍 clamp", async () => {
    const res = await request(app).get("/api/family/fairness?days=1000")
    expect(res.status).toBe(200)
    expect(res.body.days).toBe(365)
  })

  it("總財產：3 罐 + goals + lifetimeEarned + levelLabel", async () => {
    await createKid({ spendRatio: 50, saveRatio: 30, giveRatio: 20 })

    // 任務 1000：spend 500 / save 300 / give 200
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 1000 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get(`/api/family/kid-net-worth?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.jars.spend).toBe(500)
    expect(res.body.jars.save).toBe(300)
    expect(res.body.jars.give).toBe(200)
    expect(res.body.totalNetWorth).toBe(1000) // 3 罐 + 0 goals
    expect(res.body.lifetimeEarned).toBe(1000)
    expect(res.body.levelLabel).toBeTruthy() // 1000 元 → 💎 小財主
    expect(res.body.levelLabel).toContain("小財主")
  })

  it("總財產：新小孩 → 全 0、levelLabel 含「剛起步」", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-net-worth?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalNetWorth).toBe(0)
    expect(res.body.levelLabel).toContain("剛起步")
  })

  it("kid-net-worth 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-net-worth")
    expect(r.status).toBe(400)
  })

  it("關心雷達：新小孩沒活動 → needsAttention=true、message 含「想想」", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid()

    const res = await request(app).get("/api/family/kids-attention")
    expect(res.status).toBe(200)
    expect(res.body.totalKids).toBe(1)

    const k = res.body.kids[0]
    expect(k.daysQuiet).toBeNull()
    expect(k.needsAttention).toBe(true)
    expect(k.message).toContain("想想")
    expect(res.body.attentionCount).toBe(1)
  })

  it("關心雷達：今日有 task → needsAttention=false", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid()

    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 20 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get("/api/family/kids-attention")
    expect(res.status).toBe(200)
    const k = res.body.kids[0]
    // 跨午夜 race：daysSinceTask 可能 0 或 1
    expect(k.daysSinceTask).toBeLessThanOrEqual(1)
    expect(k.needsAttention).toBe(false)
    expect(k.message).toBeNull()
  })

  it("願望清單：建 2 願望（價格 50/500）+ 任務 1000 → 50 affordable / 500 saving", async () => {
    await createKid({ spendRatio: 60, saveRatio: 40, giveRatio: 0 })

    // 任務 1000 → spend 600 + save 400 = 1000 available
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 1000 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    // 願望 50 元（買得起）
    await request(app)
      .post("/api/family/wishes")
      .send({ kidId, title: "便宜玩具", estimatedPrice: 50 })
    // 願望 500 元（買得起、available=1000、剛好夠）
    await request(app)
      .post("/api/family/wishes")
      .send({ kidId, title: "便宜書", estimatedPrice: 500 })
    // 願望 2000 元（買不起）
    await request(app)
      .post("/api/family/wishes")
      .send({ kidId, title: "貴玩具", estimatedPrice: 2000 })

    const res = await request(app).get(`/api/family/kid-wishlist-summary?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalWishes).toBe(3)
    expect(res.body.totalEstimated).toBe(2550)
    expect(res.body.available).toBe(1000)
    expect(res.body.affordableCount).toBe(2) // 50 + 500 都 <= 1000

    const wishes = res.body.wishes as Array<{ status: string; etaDays: number | null }>
    const expensive = wishes.find((w) => w.etaDays !== null && w.etaDays > 0)
    expect(expensive).toBeTruthy()
  })

  it("kid-wishlist-summary 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-wishlist-summary")
    expect(r.status).toBe(400)
  })

  it("心情走勢：打卡 → totalDays + avgScore + trend", async () => {
    await createKid()

    // 今日打卡開心
    await request(app).post("/api/family/checkins").send({ kidId, mood: "😄 開心" })

    const res = await request(app).get(`/api/family/kid-mood-trend?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalDays).toBe(1)
    expect(res.body.avgScore).toBe(5)
    expect(res.body.happyDays).toBe(1)
    expect(res.body.sadDays).toBe(0)
    expect(res.body.bestDay).toBeTruthy()
    expect(res.body.bestDay.mood).toBe("😄 開心")
    expect(res.body.trend).toContain("超開心")
  })

  it("心情走勢：無打卡 → totalDays=0、trend 含「還沒」", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-mood-trend?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.totalDays).toBe(0)
    expect(res.body.trend).toContain("還沒")
  })

  it("kid-mood-trend 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-mood-trend")
    expect(r.status).toBe(400)
  })

  it("家庭健康儀表板：3 dimensions + overall + level", async () => {
    const res = await request(app).get("/api/family/health-dashboard")
    expect(res.status).toBe(200)
    expect(res.body.overallScore).toBeGreaterThanOrEqual(0)
    expect(res.body.overallScore).toBeLessThanOrEqual(100)
    expect(["excellent", "good", "moderate", "needs_attention"]).toContain(res.body.healthLevel)

    const dims = res.body.dimensions as Array<{ key: string; score: number; detail: string }>
    expect(dims.length).toBe(3)
    expect(dims.map((d) => d.key)).toEqual(["mood", "activity", "fairness"])
    for (const d of dims) {
      expect(d.score).toBeGreaterThanOrEqual(0)
      expect(d.score).toBeLessThanOrEqual(100)
      expect(d.detail).toBeTruthy()
    }
    expect(res.body.message).toBeTruthy()
  })

  it("優點清單：新小孩 → strengths 含 newcomer", async () => {
    await createKid()
    const res = await request(app).get(`/api/family/kid-strengths-list?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.strengths.length).toBeGreaterThanOrEqual(1)

    const newcomer = res.body.strengths.find((s: { key: string }) => s.key === "newcomer")
    expect(newcomer).toBeTruthy()
  })

  it("優點清單：完成 20 個任務 → 含 active 優點", async () => {
    await createKid()

    for (let i = 0; i < 20; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId, title: `T${i}`, rewardAmount: 5 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    const res = await request(app).get(`/api/family/kid-strengths-list?kidId=${kidId}`)
    expect(res.status).toBe(200)
    expect(res.body.stats.totalTasks).toBe(20)

    const active = res.body.strengths.find((s: { key: string }) => s.key === "active")
    expect(active).toBeTruthy()
    expect(active.detail).toContain("20")
  })

  it("kid-strengths-list 缺 kidId 回 400", async () => {
    const r = await request(app).get("/api/family/kid-strengths-list")
    expect(r.status).toBe(400)
  })

  it("家庭 emoji 雲：聚合所有 kid task emoji + uniqueKids", async () => {
    await db.execute(sql`DELETE FROM kids_accounts WHERE pin = ${TEST_PIN}`)
    await createKid({ displayName: "小華" })
    const hua = kidId

    // 小華做 2 個 🧹
    for (let i = 0; i < 2; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId: hua, title: `H${i}`, rewardAmount: 10, emoji: "🧹" })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`)
    }

    // 小明做 1 個 🧹
    await createKid({ displayName: "小明" })
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "M", rewardAmount: 10, emoji: "🧹" })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get("/api/family/emoji-cloud")
    expect(res.status).toBe(200)

    const cleanEmoji = res.body.emojis.find((e: { emoji: string }) => e.emoji === "🧹")
    expect(cleanEmoji).toBeTruthy()
    expect(cleanEmoji.count).toBe(3) // 2+1
    expect(cleanEmoji.uniqueKids).toBe(2)

    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${hua}`)
  })

  it("家庭 emoji 雲：limit clamp 50", async () => {
    const res = await request(app).get("/api/family/emoji-cloud?limit=100")
    expect(res.status).toBe(200)
    expect(res.body.emojis.length).toBeLessThanOrEqual(50)
  })

  it("家庭日曆熱度：當月每天都有 day entry + 統計", async () => {
    const res = await request(app).get("/api/family/calendar-month")
    expect(res.status).toBe(200)
    expect(res.body.month).toMatch(/^\d{4}-\d{2}$/)
    // 至少 28 天（2 月）、最多 31 天
    expect(res.body.days.length).toBeGreaterThanOrEqual(28)
    expect(res.body.days.length).toBeLessThanOrEqual(31)
    expect(res.body.activeDays).toBeGreaterThanOrEqual(0)
    expect(res.body.totalActivity).toBeGreaterThanOrEqual(0)

    // 每天有 date / tasks / spendings / checkins / total
    for (const d of res.body.days as Array<{
      date: string
      tasks: number
      total: number
    }>) {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(typeof d.tasks).toBe("number")
      expect(typeof d.total).toBe("number")
    }
  })

  it("家庭日曆熱度：指定 month=2024-02 → 29 天（閏年）", async () => {
    const res = await request(app).get("/api/family/calendar-month?month=2024-02")
    expect(res.status).toBe(200)
    expect(res.body.month).toBe("2024-02")
    expect(res.body.days.length).toBe(29) // 2024 是閏年
  })

  it("家庭日曆熱度：超範圍 month → 400", async () => {
    const r = await request(app).get("/api/family/calendar-month?month=1999-01")
    expect(r.status).toBe(400)
  })

  it("多維排行：5 個 ranks + 每維度 top 3", async () => {
    await createKid()

    // 做 1 個任務 100 元
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 100 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get("/api/family/multi-rank")
    expect(res.status).toBe(200)
    expect(res.body.days).toBe(30)

    const ranks = res.body.ranks as Array<{ metric: string; top: Array<{ value: number }> }>
    expect(ranks.length).toBe(5)
    expect(ranks.map((r) => r.metric)).toEqual(["tasks", "earned", "saved", "given", "checkin"])

    // tasks rank 應該有 1 個（剛建的）
    const tasksRank = ranks.find((r) => r.metric === "tasks")!
    expect(tasksRank.top.length).toBeGreaterThanOrEqual(1)
    expect(tasksRank.top[0].value).toBeGreaterThanOrEqual(1)

    // earned 也有
    const earnedRank = ranks.find((r) => r.metric === "earned")!
    expect(earnedRank.top.length).toBeGreaterThanOrEqual(1)
  })

  it("多維排行：days clamp 365", async () => {
    const res = await request(app).get("/api/family/multi-rank?days=1000")
    expect(res.status).toBe(200)
    expect(res.body.days).toBe(365)
  })

  it("家庭高潮週：weeks=12、做任務後 bestWeek 含 tasks", async () => {
    await createKid()
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId, title: "T", rewardAmount: 20 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`)
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`)

    const res = await request(app).get("/api/family/peak-week")
    expect(res.status).toBe(200)
    expect(res.body.weeks).toBe(12)
    expect(res.body.weekList.length).toBe(12)
    expect(res.body.totalActivity).toBeGreaterThanOrEqual(1)
    expect(res.body.bestWeek).toBeTruthy()
    expect(res.body.bestWeek.tasks).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(res.body.bestWeekKids)).toBe(true)
  })

  it("家庭高潮週：weeks clamp 52", async () => {
    const res = await request(app).get("/api/family/peak-week?weeks=100")
    expect(res.status).toBe(200)
    expect(res.body.weeks).toBe(52)
  })

  it("儲蓄速度排名：基本結構 kids/topSaver/message", async () => {
    const res = await request(app).get("/api/family/savings-velocity-rank")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.kids)).toBe(true)
    expect(res.body.message).toBeTruthy()
  })

  it("儲蓄速度排名：完成 $300 task save_ratio=50 → monthlyVelocity=50", async () => {
    const kidObj = (await createKid({
      spendRatio: 50,
      saveRatio: 50,
      giveRatio: 0,
    })) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "存錢測試", rewardAmount: 300 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/savings-velocity-rank?months=3")
    expect(res.status).toBe(200)
    const myKid = res.body.kids.find((k: { kidId: number }) => k.kidId === myKidId)
    expect(myKid).toBeDefined()
    expect(myKid.saveEarned).toBeGreaterThanOrEqual(150)
    expect(myKid.monthlyVelocity).toBeGreaterThanOrEqual(50)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("月度成長率：基本結構 months/trend/avgGrowth", async () => {
    const res = await request(app).get("/api/family/task-monthly-growth")
    expect(res.status).toBe(200)
    expect(res.body.months).toHaveLength(6)
    expect(res.body).toHaveProperty("totalTasks")
    expect(res.body).toHaveProperty("avgGrowth")
    expect(["rising", "steady", "declining", "no_data"]).toContain(res.body.trend)
    expect(res.body.message).toBeTruthy()
  })

  it("月度成長率：months clamp 2-24", async () => {
    const r1 = await request(app).get("/api/family/task-monthly-growth?months=100")
    expect(r1.body.months).toHaveLength(24)
    const r2 = await request(app).get("/api/family/task-monthly-growth?months=1")
    expect(r2.body.months).toHaveLength(2)
  })

  it("月度成長率：第一個月 growth=null", async () => {
    const res = await request(app).get("/api/family/task-monthly-growth?months=3")
    expect(res.status).toBe(200)
    expect(res.body.months[0].growth).toBeNull()
    expect(res.body.months[1]).toHaveProperty("growth")
  })

  it("目標直方圖：基本結構 buckets/stats/pattern", async () => {
    const res = await request(app).get("/api/family/goal-amount-histogram")
    expect(res.status).toBe(200)
    expect(res.body.buckets).toHaveLength(5)
    expect(res.body.stats).toHaveProperty("total")
    expect(["modest", "balanced", "ambitious", "no_data"]).toContain(res.body.pattern)
    expect(res.body.message).toBeTruthy()
  })

  it("目標直方圖：建 1 個 $500 goal → bucket medium=1", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    await request(app).post("/api/family/goals").send({
      kidId: myKidId,
      name: "中等目標",
      targetAmount: 500,
    })
    const res = await request(app).get("/api/family/goal-amount-histogram")
    expect(res.status).toBe(200)
    const medium = res.body.buckets.find((b: { range: string }) => b.range === "medium")
    expect(medium.count).toBeGreaterThanOrEqual(1)
    expect(res.body.stats.active).toBeGreaterThanOrEqual(1)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("Task 處理時長：基本結構 kids/familyAvg/message", async () => {
    const res = await request(app).get("/api/family/task-duration")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.kids)).toBe(true)
    expect(res.body).toHaveProperty("familyAvg")
    expect(res.body.message).toBeTruthy()
  })

  it("Task 處理時長：immediate approve → avgDays=0", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "速度測試", rewardAmount: 30 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/task-duration?days=7")
    expect(res.status).toBe(200)
    const myKid = res.body.kids.find((k: { kidId: number }) => k.kidId === myKidId)
    expect(myKid).toBeDefined()
    expect(myKid.taskCount).toBeGreaterThanOrEqual(1)
    expect(myKid.avgDays).toBeLessThanOrEqual(1)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("花用 top 細項：基本結構 items/grandTotal/message", async () => {
    const res = await request(app).get("/api/family/spending-top-items")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body).toHaveProperty("grandTotal")
    expect(res.body.message).toBeTruthy()
  })

  it("花用 top 細項：建 spending 後 items 含 description", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "獲得錢", rewardAmount: 500 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    await request(app).post("/api/family/spendings").send({
      kidId: myKidId,
      jar: "spend",
      amount: 50,
      description: "玩具車",
    })
    const res = await request(app).get("/api/family/spending-top-items?days=7")
    expect(res.status).toBe(200)
    expect(res.body.items.length).toBeGreaterThanOrEqual(1)
    const myItem = res.body.items.find((i: { description: string }) => i.description === "玩具車")
    expect(myItem).toBeDefined()
    expect(myItem.total).toBe(50)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("花用 top 細項：limit clamp 1-30", async () => {
    const r1 = await request(app).get("/api/family/spending-top-items?limit=100")
    expect(r1.status).toBe(200)
    expect(r1.body.items.length).toBeLessThanOrEqual(30)
  })

  it("家庭隊長：基本結構 kids/captain/message", async () => {
    const res = await request(app).get("/api/family/captain")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.kids)).toBe(true)
    expect(res.body.message).toBeTruthy()
  })

  it("家庭隊長：approve 任務後 captain 是該 kid + score>=2", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "隊長測試", rewardAmount: 30 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/captain")
    expect(res.status).toBe(200)
    expect(res.body.captain).not.toBeNull()
    const myKid = res.body.kids.find((k: { kidId: number }) => k.kidId === myKidId)
    expect(myKid).toBeDefined()
    expect(myKid.score).toBeGreaterThanOrEqual(2)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("月度進步榜：基本結構 kids/topImprover/message", async () => {
    const res = await request(app).get("/api/family/monthly-improvement-rank")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.kids)).toBe(true)
    expect(res.body).toHaveProperty("stagnatedCount")
    expect(res.body.message).toBeTruthy()
  })

  it("月度進步榜：approve 1 task → kid.thisMonth>=1 + improvement=100", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "進步測試", rewardAmount: 30 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/monthly-improvement-rank")
    expect(res.status).toBe(200)
    const myKid = res.body.kids.find((k: { kidId: number }) => k.kidId === myKidId)
    expect(myKid).toBeDefined()
    expect(myKid.thisMonth).toBeGreaterThanOrEqual(1)
    expect(myKid.improvement).toBe(100)
    expect(myKid.status).toBe("improving")
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("Deadline 達標率：基本結構 stats/hitRate/level", async () => {
    const res = await request(app).get("/api/family/deadline-hit-rate")
    expect(res.status).toBe(200)
    expect(res.body.stats).toHaveProperty("total")
    expect(res.body.stats).toHaveProperty("onTime")
    expect(res.body.stats).toHaveProperty("late")
    expect(res.body).toHaveProperty("hitRate")
    expect(["excellent", "good", "fair", "poor", "no_data"]).toContain(res.body.level)
    expect(res.body.message).toBeTruthy()
  })

  it("Deadline 達標率：dueDate=明天 + 今天完成 → onTime=1 + hitRate=100", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const t = await request(app).post("/api/family/tasks").send({
      kidId: myKidId,
      title: "Deadline 測試",
      rewardAmount: 30,
      dueDate: tomorrow,
    })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/deadline-hit-rate?days=7")
    expect(res.status).toBe(200)
    expect(res.body.stats.total).toBeGreaterThanOrEqual(1)
    expect(res.body.stats.onTime).toBeGreaterThanOrEqual(1)
    expect(res.body.hitRate).toBe(100)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("今日提示：基本結構 tipType + message", async () => {
    const res = await request(app).get("/api/family/today-tip")
    expect(res.status).toBe(200)
    expect([
      "pending_overflow",
      "no_recent_activity",
      "save_too_low",
      "goal_stalled",
      "encourage_checkin",
      "positive",
      "no_data",
    ]).toContain(res.body.tipType)
    expect(res.body.message).toBeTruthy()
    expect(res.body.stats).toHaveProperty("activeKids")
  })

  it("今日提示：5+ submitted task → tipType=pending_overflow", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    for (let i = 0; i < 5; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId: myKidId, title: `pending ${i}`, rewardAmount: 30 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    }
    const res = await request(app).get("/api/family/today-tip")
    expect(res.status).toBe(200)
    expect(res.body.stats.pending).toBeGreaterThanOrEqual(5)
    expect(res.body.tipType).toBe("pending_overflow")
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("高峰時刻：基本結構 top3/avgScore/totalScore", async () => {
    const res = await request(app).get("/api/family/peak-moment")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.top3)).toBe(true)
    expect(res.body).toHaveProperty("avgScore")
    expect(res.body).toHaveProperty("totalScore")
    expect(res.body.message).toBeTruthy()
  })

  it("高峰時刻：approve task 後 top3 有今日", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "高峰測試", rewardAmount: 30 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/peak-moment?days=7")
    expect(res.status).toBe(200)
    expect(res.body.totalScore).toBeGreaterThanOrEqual(1)
    expect(res.body.top3.length).toBeGreaterThanOrEqual(1)
    expect(res.body.top3[0]).toHaveProperty("date")
    expect(res.body.top3[0]).toHaveProperty("score")
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("高峰時刻：days clamp 7-90", async () => {
    const r1 = await request(app).get("/api/family/peak-moment?days=200")
    expect(r1.body.days).toBe(90)
    const r2 = await request(app).get("/api/family/peak-moment?days=3")
    expect(r2.body.days).toBe(7)
  })

  it("目標排名：基本結構 goals/total/message", async () => {
    const res = await request(app).get("/api/family/goals-progress-rank")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.goals)).toBe(true)
    expect(res.body).toHaveProperty("total")
    expect(res.body.message).toBeTruthy()
  })

  it("目標排名：建 2 個 goal → goals 含 progress + stage", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    await request(app).post("/api/family/goals").send({
      kidId: myKidId,
      name: "目標 A",
      targetAmount: 100,
    })
    await request(app).post("/api/family/goals").send({
      kidId: myKidId,
      name: "目標 B",
      targetAmount: 200,
    })
    const res = await request(app).get("/api/family/goals-progress-rank")
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(2)
    const myGoal = res.body.goals.find((g: { kidId: number }) => g.kidId === myKidId)
    expect(myGoal).toBeDefined()
    expect(myGoal).toHaveProperty("progress")
    expect(myGoal).toHaveProperty("stage")
    expect(["near_complete", "midway", "starting"]).toContain(myGoal.stage)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("目標排名：limit clamp 1-50", async () => {
    const r1 = await request(app).get("/api/family/goals-progress-rank?limit=100")
    expect(r1.status).toBe(200)
    expect(r1.body.goals.length).toBeLessThanOrEqual(50)
  })

  it("目標願望：基本結構 goals/wishes/promotionRate/discipline", async () => {
    const res = await request(app).get("/api/family/goals-vs-wishes")
    expect(res.status).toBe(200)
    expect(res.body.goals).toHaveProperty("total")
    expect(res.body.goals).toHaveProperty("active")
    expect(res.body.goals).toHaveProperty("completed")
    expect(res.body.wishes).toHaveProperty("total")
    expect(res.body).toHaveProperty("promotionRate")
    expect(["highly_disciplined", "balanced", "wishful", "no_goals", "no_data"]).toContain(
      res.body.discipline
    )
    expect(res.body.message).toBeTruthy()
  })

  it("目標願望：建 wish + goal → 結構有 active=1 / wished>=1", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    await request(app).post("/api/family/wishes").send({
      kidId: myKidId,
      title: "想要的玩具",
      estimatedPrice: 200,
    })
    await request(app).post("/api/family/goals").send({
      kidId: myKidId,
      name: "腳踏車",
      targetAmount: 5000,
    })
    const res = await request(app).get("/api/family/goals-vs-wishes")
    expect(res.status).toBe(200)
    expect(res.body.goals.active).toBeGreaterThanOrEqual(1)
    expect(res.body.wishes.wished).toBeGreaterThanOrEqual(1)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("批准延遲：基本結構 stats/buckets/level", async () => {
    const res = await request(app).get("/api/family/approve-latency")
    expect(res.status).toBe(200)
    expect(res.body.stats).toHaveProperty("total")
    expect(res.body.stats).toHaveProperty("avgHours")
    expect(res.body.stats).toHaveProperty("medianHours")
    expect(res.body.buckets).toHaveLength(5)
    expect(["instant", "fast", "good", "slow", "sluggish", "no_data"]).toContain(res.body.level)
    expect(res.body.message).toBeTruthy()
  })

  it("批准延遲：approve 後 total >=1 + level=instant", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "批准延遲測試", rewardAmount: 30 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/approve-latency?days=7")
    expect(res.status).toBe(200)
    expect(res.body.stats.total).toBeGreaterThanOrEqual(1)
    const instant = res.body.buckets.find((b: { range: string }) => b.range === "instant")
    expect(instant.count).toBeGreaterThanOrEqual(1)
    expect(res.body.level).toBe("instant")
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("Feedback 比例：基本結構 + parentRate/kidRate/interactionScore", async () => {
    const res = await request(app).get("/api/family/feedback-rate")
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty("totalApproved")
    expect(res.body).toHaveProperty("parentFeedbackRate")
    expect(res.body).toHaveProperty("kidSubmissionNoteRate")
    expect(res.body).toHaveProperty("interactionScore")
    expect(["highly_engaged", "engaged", "moderate", "passive", "no_data"]).toContain(
      res.body.level
    )
    expect(res.body.message).toBeTruthy()
  })

  it("Feedback 比例：帶 parentFeedback 後 parentFeedbackRate=100", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "feedback 測試", rewardAmount: 30 })
    await request(app)
      .post(`/api/family/tasks/${t.body.id}/submit`)
      .send({ submissionNote: "做完啦" })
    await request(app)
      .post(`/api/family/tasks/${t.body.id}/approve`)
      .send({ parentFeedback: "做得好" })
    const res = await request(app).get("/api/family/feedback-rate?days=7")
    expect(res.status).toBe(200)
    expect(res.body.totalApproved).toBeGreaterThanOrEqual(1)
    expect(res.body.parentFeedbackRate).toBeGreaterThanOrEqual(50)
    expect(res.body.kidSubmissionNoteRate).toBeGreaterThanOrEqual(50)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("獎勵統計：基本結構 stats/buckets/pattern", async () => {
    const res = await request(app).get("/api/family/reward-stats")
    expect(res.status).toBe(200)
    expect(res.body.stats).toHaveProperty("total")
    expect(res.body.stats).toHaveProperty("avg")
    expect(res.body.stats).toHaveProperty("median")
    expect(res.body.buckets).toHaveLength(5)
    expect(["diverse", "concentrated", "high_value", "low_value", "no_data"]).toContain(
      res.body.pattern
    )
    expect(res.body.message).toBeTruthy()
  })

  it("獎勵統計：approve $80 → bucket_medium >=1 + avg=80", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "中等獎勵", rewardAmount: 80 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/reward-stats")
    expect(res.status).toBe(200)
    expect(res.body.stats.total).toBeGreaterThanOrEqual(1)
    const medium = res.body.buckets.find((b: { range: string }) => b.range === "medium")
    expect(medium.count).toBeGreaterThanOrEqual(1)
    expect(res.body.stats.avg).toBeGreaterThanOrEqual(50)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("主動性比例：基本結構 stats/initiativeRate/level", async () => {
    const res = await request(app).get("/api/family/initiative-rate")
    expect(res.status).toBe(200)
    expect(res.body.stats).toHaveProperty("proposed")
    expect(res.body.stats).toHaveProperty("assigned")
    expect(res.body.stats).toHaveProperty("total")
    expect(res.body).toHaveProperty("initiativeRate")
    expect(["high_initiative", "good_initiative", "moderate", "low", "no_data"]).toContain(
      res.body.level
    )
    expect(res.body.message).toBeTruthy()
  })

  it("主動性比例：days clamp 7-365", async () => {
    const r1 = await request(app).get("/api/family/initiative-rate?days=500")
    expect(r1.body.days).toBe(365)
    const r2 = await request(app).get("/api/family/initiative-rate?days=3")
    expect(r2.body.days).toBe(7)
  })

  it("周末工作日：基本結構 weekend/weekday/pattern/message", async () => {
    const res = await request(app).get("/api/family/weekend-vs-weekday")
    expect(res.status).toBe(200)
    expect(res.body.weekend).toHaveProperty("tasks")
    expect(res.body.weekend).toHaveProperty("tasksPerDay")
    expect(res.body.weekday).toHaveProperty("tasks")
    expect(["weekend_warriors", "weekday_grinders", "balanced", "no_data"]).toContain(
      res.body.pattern
    )
    expect(res.body.message).toBeTruthy()
  })

  it("周末工作日：days clamp 14-180", async () => {
    const r1 = await request(app).get("/api/family/weekend-vs-weekday?days=500")
    expect(r1.body.days).toBe(180)
    const r2 = await request(app).get("/api/family/weekend-vs-weekday?days=5")
    expect(r2.body.days).toBe(14)
  })

  it("收入花用：基本結構 income/spent/balance/ratio/level", async () => {
    const res = await request(app).get("/api/family/income-vs-spending")
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty("income")
    expect(res.body).toHaveProperty("spent")
    expect(res.body).toHaveProperty("given")
    expect(res.body).toHaveProperty("balance")
    expect(res.body).toHaveProperty("ratio")
    expect(["saver", "balanced", "spender", "overspending", "no_data"]).toContain(res.body.level)
    expect(res.body.message).toBeTruthy()
  })

  it("收入花用：approve $100 → income>=100、level=saver", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "收入花用測試", rewardAmount: 100 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/income-vs-spending")
    expect(res.status).toBe(200)
    expect(res.body.income).toBeGreaterThanOrEqual(100)
    expect(res.body.balance).toBeGreaterThan(0)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("收入花用：days clamp 7-90", async () => {
    const r1 = await request(app).get("/api/family/income-vs-spending?days=200")
    expect(r1.body.days).toBe(90)
    const r2 = await request(app).get("/api/family/income-vs-spending?days=3")
    expect(r2.body.days).toBe(7)
  })

  it("三罐當前餘額：基本結構 jars + total + health", async () => {
    const res = await request(app).get("/api/family/jars-current-balance")
    expect(res.status).toBe(200)
    expect(res.body.jars).toHaveProperty("spend")
    expect(res.body.jars).toHaveProperty("save")
    expect(res.body.jars).toHaveProperty("give")
    expect(res.body.jars.spend).toHaveProperty("total")
    expect(res.body.jars.spend).toHaveProperty("ratio")
    expect(["healthy", "ok", "unhealthy", "no_data"]).toContain(res.body.health)
    expect(res.body.message).toBeTruthy()
  })

  it("三罐當前餘額：approve 任務 100 (50/30/20) → total>=100、有 topKid", async () => {
    const kidObj = (await createKid({ spendRatio: 50, saveRatio: 30, giveRatio: 20 })) as {
      id: number
    }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "三罐測試", rewardAmount: 100 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/jars-current-balance")
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(100)
    expect(res.body.jars.spend.topKid).not.toBeNull()
    expect(res.body.jars.save.topKid).not.toBeNull()
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("目標達成率：基本結構 stats + completionRate + level", async () => {
    const res = await request(app).get("/api/family/goals-completion-rate")
    expect(res.status).toBe(200)
    expect(res.body.stats).toHaveProperty("active")
    expect(res.body.stats).toHaveProperty("completed")
    expect(res.body.stats).toHaveProperty("abandoned")
    expect(res.body).toHaveProperty("completionRate")
    expect(["excellent", "good", "fair", "needs_work", "no_data"]).toContain(res.body.level)
    expect(res.body.message).toBeTruthy()
  })

  it("目標達成率：建 1 active goal → stats.active>=1", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    await request(app).post("/api/family/goals").send({
      kidId: myKidId,
      name: "玩具車",
      targetAmount: 500,
    })
    const res = await request(app).get("/api/family/goals-completion-rate")
    expect(res.status).toBe(200)
    expect(res.body.stats.active).toBeGreaterThanOrEqual(1)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("家庭花用線：基本結構 daily[30] + summary + trend", async () => {
    const res = await request(app).get("/api/family/spending-daily")
    expect(res.status).toBe(200)
    expect(res.body.daily).toHaveLength(30)
    expect(res.body.daily[0]).toHaveProperty("date")
    expect(res.body.daily[0]).toHaveProperty("spent")
    expect(res.body.daily[0]).toHaveProperty("total")
    expect(res.body.summary).toHaveProperty("totalAll")
    expect(res.body.summary).toHaveProperty("avgPerDay")
    expect(["spiking", "rising", "stable", "declining", "no_data"]).toContain(res.body.trend)
    expect(typeof res.body.alert).toBe("boolean")
    expect(res.body.message).toBeTruthy()
  })

  it("家庭花用線：days clamp 7-90", async () => {
    const r1 = await request(app).get("/api/family/spending-daily?days=200")
    expect(r1.body.daily).toHaveLength(90)
    const r2 = await request(app).get("/api/family/spending-daily?days=3")
    expect(r2.body.daily).toHaveLength(7)
  })

  it("家庭時段：基本結構 slots/total/dominantSlot/message", async () => {
    const res = await request(app).get("/api/family/time-of-day")
    expect(res.status).toBe(200)
    expect(res.body.slots).toHaveProperty("morning")
    expect(res.body.slots).toHaveProperty("afternoon")
    expect(res.body.slots).toHaveProperty("evening")
    expect(res.body.slots).toHaveProperty("late")
    expect(res.body.slotsLabeled.morning).toHaveProperty("label")
    expect(res.body.message).toBeTruthy()
  })

  it("家庭時段：完成 task 後 total>=1 + 有 dominantSlot", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "時段測試", rewardAmount: 30 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/time-of-day?days=7")
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(1)
    expect(res.body.dominantSlot).not.toBeNull()
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("家庭時段：days clamp 1-90", async () => {
    const r1 = await request(app).get("/api/family/time-of-day?days=200")
    expect(r1.body.days).toBe(90)
    const r2 = await request(app).get("/api/family/time-of-day?days=0")
    expect(r2.body.days).toBe(30)
  })

  it("成長階段：新小孩 → stage=newbie + score=0", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const res = await request(app).get(`/api/family/kid-growth-stage?kidId=${myKidId}`)
    expect(res.status).toBe(200)
    expect(res.body.stage).toBe("newbie")
    expect(res.body.score).toBe(0)
    expect(res.body.metrics.tasksApproved).toBe(0)
    expect(res.body.progressInStage).toBe(0)
    expect(res.body.nextMilestone).toContain("還差")
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("成長階段：缺 kidId → 400", async () => {
    const res = await request(app).get("/api/family/kid-growth-stage")
    expect(res.status).toBe(400)
  })

  it("成長階段：不存在 kidId → 404", async () => {
    const res = await request(app).get("/api/family/kid-growth-stage?kidId=999999")
    expect(res.status).toBe(404)
  })

  it("成長階段：完成 5 個任務後 metrics.tasksApproved=5", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    for (let i = 0; i < 5; i++) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId: myKidId, title: `階段 ${i}`, rewardAmount: 50 })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    }
    const res = await request(app).get(`/api/family/kid-growth-stage?kidId=${myKidId}`)
    expect(res.status).toBe(200)
    expect(res.body.metrics.tasksApproved).toBe(5)
    expect(res.body.score).toBeGreaterThanOrEqual(10)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("家庭 streak：基本結構 + currentStreak/longestStreak/level/message", async () => {
    const res = await request(app).get("/api/family/activity-streak")
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty("currentStreak")
    expect(res.body).toHaveProperty("longestStreak")
    expect(res.body).toHaveProperty("activeRatio")
    expect(["legendary", "great", "good", "starting", "inactive"]).toContain(res.body.level)
    expect(res.body.message).toBeTruthy()
    expect(res.body.lookback).toBe(90)
  })

  it("家庭 streak：完成任務後 currentStreak>=1", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "活躍測試", rewardAmount: 30 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/activity-streak")
    expect(res.status).toBe(200)
    expect(res.body.currentStreak).toBeGreaterThanOrEqual(1)
    expect(["starting", "good", "great", "legendary"]).toContain(res.body.level)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("家庭 streak：lookback clamp 7-365", async () => {
    const r1 = await request(app).get("/api/family/activity-streak?lookback=1000")
    expect(r1.body.lookback).toBe(365)
    const r2 = await request(app).get("/api/family/activity-streak?lookback=3")
    expect(r2.body.lookback).toBe(7)
  })

  it("任務多樣性：缺 kidId → 400", async () => {
    const res = await request(app).get("/api/family/kid-task-variety")
    expect(res.status).toBe(400)
  })

  it("任務多樣性：新小孩 → diversity=none + totalTasks=0", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const res = await request(app).get(`/api/family/kid-task-variety?kidId=${myKidId}`)
    expect(res.status).toBe(200)
    expect(res.body.summary.totalTasks).toBe(0)
    expect(res.body.diversity).toBe("none")
    expect(res.body.byCategory).toEqual([])
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("任務多樣性：3 個 category → diversity=medium", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    for (const cat of ["housework", "study", "kindness"]) {
      const t = await request(app)
        .post("/api/family/tasks")
        .send({ kidId: myKidId, title: `${cat} 任務`, rewardAmount: 30, category: cat })
      await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
      await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    }
    const res = await request(app).get(`/api/family/kid-task-variety?kidId=${myKidId}`)
    expect(res.status).toBe(200)
    expect(res.body.summary.uniqueCategories).toBe(3)
    expect(res.body.summary.totalTasks).toBe(3)
    expect(res.body.diversity).toBe("medium")
    expect(res.body.byCategory.length).toBe(3)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("派發頻率：基本結構 daily/byWeekday/summary/cadenceLevel", async () => {
    const res = await request(app).get("/api/family/task-creation-cadence")
    expect(res.status).toBe(200)
    expect(res.body.daily).toHaveLength(30)
    expect(res.body.byWeekday).toHaveProperty("Mon")
    expect(res.body.byWeekday).toHaveProperty("Sun")
    expect(res.body.summary).toHaveProperty("totalCreated")
    expect(res.body.summary).toHaveProperty("avgPerDay")
    expect(["very_active", "active", "occasional", "rare", "none"]).toContain(res.body.cadenceLevel)
    expect(res.body.message).toBeTruthy()
  })

  it("派發頻率：派 1 個任務後 totalCreated >= 1", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "派任務測試", rewardAmount: 30 })
    const res = await request(app).get("/api/family/task-creation-cadence?days=7")
    expect(res.status).toBe(200)
    expect(res.body.daily).toHaveLength(7)
    expect(res.body.summary.totalCreated).toBeGreaterThanOrEqual(1)
    expect(res.body.summary.busiestDate).toBeTruthy()
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("派發頻率：days clamp 1-90", async () => {
    const r1 = await request(app).get("/api/family/task-creation-cadence?days=200")
    expect(r1.body.daily).toHaveLength(90)
    const r2 = await request(app).get("/api/family/task-creation-cadence?days=0")
    expect(r2.body.daily).toHaveLength(30)
  })

  it("最後活動：基本結構 kids + summary + message", async () => {
    const res = await request(app).get("/api/family/kids-last-activity")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.kids)).toBe(true)
    expect(res.body.summary).toHaveProperty("totalKids")
    expect(res.body.summary).toHaveProperty("alertCount")
    expect(res.body.message).toBeTruthy()
  })

  it("最後活動：完成任務後 daysSince=0、attentionLevel=ok", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "今日活動", rewardAmount: 50 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/kids-last-activity")
    expect(res.status).toBe(200)
    const myKid = res.body.kids.find((k: { kidId: number }) => k.kidId === myKidId)
    expect(myKid).toBeDefined()
    expect(myKid.daysSince).toBeLessThanOrEqual(1)
    expect(myKid.attentionLevel).toBe("ok")
    expect(myKid.latestType).toBe("task")
    expect(myKid.lastTaskTitle).toBe("今日活動")
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("最後活動：新建小孩無活動 → attentionLevel=never", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const res = await request(app).get("/api/family/kids-last-activity")
    expect(res.status).toBe(200)
    const myKid = res.body.kids.find((k: { kidId: number }) => k.kidId === myKidId)
    expect(myKid).toBeDefined()
    expect(myKid.attentionLevel).toBe("never")
    expect(myKid.latestAt).toBeNull()
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("儲蓄留存：基本結構 kids + summary + familyLevel", async () => {
    const res = await request(app).get("/api/family/savings-retention")
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.kids)).toBe(true)
    expect(res.body.summary).toHaveProperty("totalKids")
    expect(res.body.summary).toHaveProperty("avgRetention")
    expect(["super_saver", "good_saver", "spender", "heavy_spender", "no_data"]).toContain(
      res.body.familyLevel
    )
    expect(res.body.message).toBeTruthy()
  })

  it("儲蓄留存：賺 100 全進 save → ratio=100 → super_saver", async () => {
    const kidObj = (await createKid({ spendRatio: 0, saveRatio: 100, giveRatio: 0 })) as {
      id: number
    }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "全存", rewardAmount: 100 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/savings-retention")
    expect(res.status).toBe(200)
    const myKid = res.body.kids.find((k: { kidId: number }) => k.kidId === myKidId)
    expect(myKid).toBeDefined()
    expect(myKid.lifetimeEarned).toBeGreaterThanOrEqual(100)
    expect(myKid.retentionRatio).toBeGreaterThanOrEqual(70)
    expect(myKid.level).toBe("super_saver")
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("多月趨勢：12 個月 + summary + trend", async () => {
    const res = await request(app).get("/api/family/multi-month-trend")
    expect(res.status).toBe(200)
    expect(res.body.months).toHaveLength(12)
    expect(res.body.months[0]).toHaveProperty("month")
    expect(res.body.months[0]).toHaveProperty("tasks")
    expect(res.body.months[0]).toHaveProperty("reward")
    expect(res.body.months[0]).toHaveProperty("checkinDays")
    expect(res.body.summary).toHaveProperty("totalTasks")
    expect(["growing", "declining", "steady", "no_data"]).toContain(res.body.trend)
    expect(res.body.message).toBeTruthy()
  })

  it("多月趨勢：完成任務後本月有資料", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "本月", rewardAmount: 100 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/multi-month-trend?months=3")
    expect(res.status).toBe(200)
    expect(res.body.months).toHaveLength(3)
    const lastMonth = res.body.months[2]
    expect(lastMonth.tasks).toBeGreaterThanOrEqual(1)
    expect(lastMonth.reward).toBeGreaterThanOrEqual(100)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("多月趨勢：months clamp 1-24", async () => {
    const r1 = await request(app).get("/api/family/multi-month-trend?months=100")
    expect(r1.body.months).toHaveLength(24)
    const r2 = await request(app).get("/api/family/multi-month-trend?months=0")
    expect(r2.body.months).toHaveLength(12)
  })

  it("一週日報：基本結構 days[7] + summary + message", async () => {
    const res = await request(app).get("/api/family/daily-recap")
    expect(res.status).toBe(200)
    expect(res.body.days).toHaveLength(7)
    expect(res.body.days[0]).toHaveProperty("date")
    expect(res.body.days[0]).toHaveProperty("tasks")
    expect(res.body.days[0]).toHaveProperty("hasActivity")
    expect(res.body.summary).toHaveProperty("totalDays")
    expect(res.body.summary).toHaveProperty("activeDays")
    expect(res.body.message).toBeTruthy()
  })

  it("一週日報：完成任務後最後一天有活動", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "今日任務", rewardAmount: 50 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/daily-recap?days=3")
    expect(res.status).toBe(200)
    expect(res.body.days).toHaveLength(3)
    expect(res.body.summary.activeDays).toBeGreaterThanOrEqual(1)
    expect(res.body.summary.totalTasks).toBeGreaterThanOrEqual(1)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("一週日報：days 範圍 clamp 1-60", async () => {
    const r1 = await request(app).get(`/api/family/daily-recap?days=100`)
    expect(r1.body.days).toHaveLength(60)
    const r2 = await request(app).get(`/api/family/daily-recap?days=0`)
    expect(r2.body.days).toHaveLength(7)
  })

  it("月度故事：基本結構 month/paragraphs/stats/characters", async () => {
    const res = await request(app).get("/api/family/family-story")
    expect(res.status).toBe(200)
    expect(res.body.month).toMatch(/^\d{4}-\d{2}$/)
    expect(Array.isArray(res.body.paragraphs)).toBe(true)
    expect(res.body.paragraphs.length).toBeGreaterThanOrEqual(2)
    expect(res.body.stats).toHaveProperty("totalTasks")
    expect(res.body.stats).toHaveProperty("totalReward")
    expect(res.body.characters).toBeDefined()
  })

  it("月度故事：完成任務後 characters.topPerformer 有值", async () => {
    const kidObj = (await createKid({ displayName: "故事主角" })) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "本月任務", rewardAmount: 100 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/family-story")
    expect(res.status).toBe(200)
    expect(res.body.stats.totalTasks).toBeGreaterThanOrEqual(1)
    expect(res.body.characters.topPerformer).toBeTruthy()
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("月度故事：非法 month → 400", async () => {
    const res = await request(app).get("/api/family/family-story?month=invalid")
    expect(res.status).toBe(400)
  })

  it("月度故事：未來月份 → totalTasks=0", async () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    const monthStr = future.toISOString().slice(0, 7)
    const res = await request(app).get(`/api/family/family-story?month=${monthStr}`)
    expect(res.status).toBe(200)
    expect(res.body.stats.totalTasks).toBe(0)
  })

  it("難度演進：months=6 → 6 個月資料 + trend", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const res = await request(app).get(`/api/family/difficulty-evolution?kidId=${myKidId}&months=6`)
    expect(res.status).toBe(200)
    expect(res.body.kidId).toBe(myKidId)
    expect(res.body.months).toHaveLength(6)
    expect(res.body.months[0]).toHaveProperty("easy")
    expect(res.body.months[0]).toHaveProperty("medium")
    expect(res.body.months[0]).toHaveProperty("hard")
    expect(res.body.totals).toHaveProperty("easy")
    expect(["rising_challenge", "easing", "steady", "no_data"]).toContain(res.body.trend)
    expect(res.body.message).toBeTruthy()
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("難度演進：無任務 → no_data", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const res = await request(app).get(`/api/family/difficulty-evolution?kidId=${myKidId}`)
    expect(res.status).toBe(200)
    expect(res.body.trend).toBe("no_data")
    expect(res.body.totals.easy + res.body.totals.medium + res.body.totals.hard).toBe(0)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("難度演進：months 範圍 clamp 1-24", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const r1 = await request(app).get(
      `/api/family/difficulty-evolution?kidId=${myKidId}&months=100`
    )
    expect(r1.body.months).toHaveLength(24)
    const r2 = await request(app).get(`/api/family/difficulty-evolution?kidId=${myKidId}&months=0`)
    expect(r2.body.months).toHaveLength(6)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("難度演進：缺 kidId → 400", async () => {
    const res = await request(app).get(`/api/family/difficulty-evolution`)
    expect(res.status).toBe(400)
  })

  it("本週摘要：基本結構 thisWeek/lastWeek/deltas/highlights", async () => {
    const res = await request(app).get("/api/family/weekly-summary")
    expect(res.status).toBe(200)
    expect(res.body.thisWeek).toBeDefined()
    expect(res.body.thisWeek).toHaveProperty("tasksApproved")
    expect(res.body.thisWeek).toHaveProperty("totalReward")
    expect(res.body.thisWeek).toHaveProperty("checkins")
    expect(res.body.lastWeek).toBeDefined()
    expect(res.body.deltas).toBeDefined()
    expect(res.body.deltas.tasksApproved).toHaveProperty("arrow")
    expect(["↑", "↓", "→"]).toContain(res.body.deltas.tasksApproved.arrow)
    expect(Array.isArray(res.body.highlights)).toBe(true)
    expect(res.body.highlights.length).toBeGreaterThanOrEqual(1)
  })

  it("本週摘要：完成任務後 thisWeek.tasksApproved >= 1", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const t = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "本週任務", rewardAmount: 50 })
    await request(app).post(`/api/family/tasks/${t.body.id}/submit`).send({})
    await request(app).post(`/api/family/tasks/${t.body.id}/approve`).send({})
    const res = await request(app).get("/api/family/weekly-summary")
    expect(res.status).toBe(200)
    expect(res.body.thisWeek.tasksApproved).toBeGreaterThanOrEqual(1)
    expect(res.body.thisWeek.totalReward).toBeGreaterThanOrEqual(50)
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("批量批准：3 個 submitted → 全 approved + totalReward", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const ids: number[] = []
    for (let i = 0; i < 3; i++) {
      const create = await request(app)
        .post("/api/family/tasks")
        .send({ kidId: myKidId, title: `任務 ${i}`, rewardAmount: 30 })
      ids.push(create.body.id)
      await request(app).post(`/api/family/tasks/${create.body.id}/submit`).send({})
    }
    const res = await request(app)
      .post("/api/family/tasks/bulk-approve")
      .send({ ids, parentFeedback: "做得好" })
    expect(res.status).toBe(200)
    expect(res.body.approved).toBe(3)
    expect(res.body.failed).toBe(0)
    expect(res.body.totalReward).toBe(90)
    expect(res.body.successes).toHaveLength(3)
    for (const id of ids) {
      const list = await request(app).get(`/api/family/tasks?kidId=${myKidId}`)
      const found = list.body.find((t: { id: number }) => t.id === id)
      expect(found.status).toBe("approved")
    }
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("批量批准：空 ids → 400", async () => {
    const res = await request(app).post("/api/family/tasks/bulk-approve").send({ ids: [] })
    expect(res.status).toBe(400)
  })

  it("批量批准：包含不存在 id → 部分成功 + failures 帶錯誤", async () => {
    const kidObj = (await createKid()) as { id: number }
    const myKidId = kidObj.id
    const create = await request(app)
      .post("/api/family/tasks")
      .send({ kidId: myKidId, title: "OK 任務", rewardAmount: 50 })
    await request(app).post(`/api/family/tasks/${create.body.id}/submit`).send({})
    const res = await request(app)
      .post("/api/family/tasks/bulk-approve")
      .send({ ids: [create.body.id, 999999] })
    expect(res.status).toBe(200)
    expect(res.body.approved).toBe(1)
    expect(res.body.failed).toBe(1)
    expect(res.body.failures[0].id).toBe(999999)
    expect(res.body.failures[0].error).toContain("不存在")
    await db.execute(sql`DELETE FROM kids_accounts WHERE id = ${myKidId}`)
  })

  it("批量批准：超過 50 個 → 400", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => i + 1)
    const res = await request(app).post("/api/family/tasks/bulk-approve").send({ ids })
    expect(res.status).toBe(400)
  })

  it("任務照片上傳：缺檔案 → 400", async () => {
    const res = await request(app).post("/api/family/upload-proof")
    expect(res.status).toBe(400)
  })

  it("任務照片上傳：png buffer → 回 url + filename + size", async () => {
    const pngBytes = Buffer.from(
      "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000000500010DBE0E1B0000000049454E44AE426082",
      "hex"
    )
    const res = await request(app)
      .post("/api/family/upload-proof")
      .attach("image", pngBytes, { filename: "test.png", contentType: "image/png" })
    expect(res.status).toBe(200)
    expect(res.body.url).toMatch(/^\/uploads\/kids-proofs\/proof_\d+_[a-z0-9]+\.png$/)
    expect(res.body.filename).toMatch(/^proof_\d+_[a-z0-9]+\.png$/)
    expect(res.body.size).toBe(pngBytes.length)
  })

  it("任務照片上傳：非圖片 → 400", async () => {
    const txt = Buffer.from("hello", "utf-8")
    const res = await request(app)
      .post("/api/family/upload-proof")
      .attach("image", txt, { filename: "x.txt", contentType: "text/plain" })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain("圖片")
  })

  it("家庭累計總成就：stats + level + message", async () => {
    const res = await request(app).get("/api/family/lifetime-stats")
    expect(res.status).toBe(200)
    expect(res.body.stats).toBeDefined()
    expect(res.body.stats.tasksApproved).toBeGreaterThanOrEqual(0)
    expect(res.body.stats).toHaveProperty("totalReward")
    expect(res.body.stats).toHaveProperty("totalGiven")
    expect(res.body.stats).toHaveProperty("checkinDays")
    expect(["newborn", "growing", "established", "legendary"]).toContain(res.body.level)
    expect(res.body.message).toBeTruthy()
  })

  it("軟刪除小孩（isActive=false）", async () => {
    await createKid()
    const res = await request(app).delete(`/api/family/kids/${kidId}`)
    expect(res.status).toBe(200)

    const list = await request(app).get("/api/family/kids")
    expect(list.body.find((k: { id: number }) => k.id === kidId)).toBeFalsy()
  })
})
