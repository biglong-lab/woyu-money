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

  it("軟刪除小孩（isActive=false）", async () => {
    await createKid()
    const res = await request(app).delete(`/api/family/kids/${kidId}`)
    expect(res.status).toBe(200)

    const list = await request(app).get("/api/family/kids")
    expect(list.body.find((k: { id: number }) => k.id === kidId)).toBeFalsy()
  })
})
