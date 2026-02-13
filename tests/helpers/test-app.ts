/**
 * 測試用 Express app 工廠
 *
 * 建立完整的 Express app（含 auth、session、所有路由）供整合測試使用。
 * 不啟動 HTTP server，直接透過 supertest 發送請求。
 */
import express from "express"
import type { Express } from "express"
import request from "supertest"

/**
 * 建立完整測試用 Express app
 *
 * registerRoutes 內部已包含：
 * - setupAuth（session + passport + 登入/註冊路由）
 * - setupLineAuth（LINE 登入）
 * - setupNotificationRoutes（通知）
 * - 所有領域路由模組
 */
export async function createTestApp(): Promise<Express> {
  const app = express()
  app.use(express.json())

  // registerRoutes 會建立 httpServer，但測試只需要 app
  const { registerRoutes } = await import("../../server/routes/index")
  await registerRoutes(app)

  // 全域錯誤處理（需在路由之後掛載）
  const { globalErrorHandler } = await import(
    "../../server/middleware/error-handler"
  )
  app.use(globalErrorHandler)

  return app
}

/**
 * 建立已登入的 supertest agent（自動保持 cookie/session）
 *
 * @param app - Express app 實例
 * @param username - 登入帳號（預設 admin）
 * @param password - 登入密碼（預設 admin123）
 * @returns 已通過身份驗證的 supertest agent
 */
export async function createAuthenticatedAgent(
  app: Express,
  username = "admin",
  password = "admin123"
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app)

  const loginRes = await agent
    .post("/api/login")
    .send({ username, password })

  if (loginRes.status !== 200) {
    throw new Error(
      `登入失敗: ${loginRes.status} ${JSON.stringify(loginRes.body)}`
    )
  }

  return agent
}
