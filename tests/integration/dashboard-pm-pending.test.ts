/**
 * Dashboard — PM-bridge 待確認 webhook 統計
 * 解釋為何 dashboard ytd 收入 vs PM 累積有差距（待人工確認的 webhook）
 */
import { describe, it, expect, beforeAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

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
  const routes = (await import("../../server/routes/dashboard")).default
  app.use(routes)
  const { globalErrorHandler } = await import("../../server/middleware/error-handler")
  app.use(globalErrorHandler)
  return app
}

describe.skipIf(skipIfNoDb)("Dashboard — PM pending summary", () => {
  let app: Express
  beforeAll(async () => {
    app = await createTestApp()
  })

  it("回傳基本結構 pendingCount/pendingAmount/severity/message", async () => {
    const res = await request(app).get("/api/dashboard/pm-pending-summary").expect(200)
    expect(res.body).toHaveProperty("pendingCount")
    expect(res.body).toHaveProperty("pendingAmount")
    expect(res.body).toHaveProperty("oldestPendingDate")
    expect(res.body).toHaveProperty("latestPendingDate")
    expect(["ok", "warn", "alert"]).toContain(res.body.severity)
    expect(res.body.message).toBeTruthy()
    expect(typeof res.body.pendingCount).toBe("number")
    expect(typeof res.body.pendingAmount).toBe("number")
  })

  it("severity 分級：≥20 筆或 ≥$100,000 為 alert，其他有筆數為 warn，0 為 ok", async () => {
    const res = await request(app).get("/api/dashboard/pm-pending-summary").expect(200)
    if (res.body.pendingCount === 0) {
      expect(res.body.severity).toBe("ok")
    } else if (res.body.pendingCount >= 20 || res.body.pendingAmount >= 100000) {
      expect(res.body.severity).toBe("alert")
    } else {
      expect(res.body.severity).toBe("warn")
    }
  })
})
