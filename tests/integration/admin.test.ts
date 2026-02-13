/**
 * Admin API 整合測試
 * 測試系統管理、用戶管理、資料備份等管理功能
 *
 * 需要 PostgreSQL 連線（Docker port 5434）
 * 執行方式：npm run test:integration
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest"
import type { Express } from "express"
import { createTestApp, createAuthenticatedAgent } from "../helpers/test-app"
import { storage } from "../../server/storage"

// 檢查是否有資料庫連線
const skipIfNoDb = !process.env.DATABASE_URL

describe.skipIf(skipIfNoDb)("Admin API 整合測試", () => {
  let app: Express
  let adminAgent: ReturnType<typeof createAuthenticatedAgent> extends Promise<infer T> ? T : never

  beforeAll(async () => {
    app = await createTestApp()
    adminAgent = await createAuthenticatedAgent(app, "admin", "admin123")
  })

  // 清理測試資料
  afterEach(async () => {
    // 刪除測試建立的用戶
    const users = await storage.getAllUsers()
    for (const user of users) {
      if (user.username.startsWith("test_")) {
        await storage.deleteUser(user.id)
      }
    }
  })

  // --- 系統狀態 ---
  describe("GET /api/admin/system-status", () => {
    it("應返回系統健康狀態與統計資料", async () => {
      const res = await adminAgent.get("/api/admin/system-status")

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("health")
      expect(res.body).toHaveProperty("statistics")

      // 驗證健康檢查資料
      expect(res.body.health).toHaveProperty("database", true)
      expect(res.body.health).toHaveProperty("server", true)
      expect(res.body.health).toHaveProperty("timestamp")
      expect(res.body.health).toHaveProperty("uptime")
      expect(res.body.health).toHaveProperty("memoryUsage")
      expect(res.body.health).toHaveProperty("nodeVersion")

      // 驗證統計資料
      expect(res.body.statistics).toBeDefined()
    })

    it("非管理員應返回 403", async () => {
      // 建立非管理員用戶
      const testAgent = await createAuthenticatedAgent(app, "admin", "admin123")
      
      // 先建立測試用戶
      await adminAgent
        .post("/api/admin/users")
        .send({
          username: "test_user_non_admin",
          password: "testpass123",
          role: "user2"
        })

      // 用一般用戶登入
      const normalAgent = await createAuthenticatedAgent(app, "test_user_non_admin", "testpass123")
      const res = await normalAgent.get("/api/admin/system-status")

      expect(res.status).toBe(403)
      expect(res.body).toHaveProperty("message")
    })
  })

  // --- 用戶管理 ---
  describe("GET /api/admin/users", () => {
    it("應返回所有用戶列表", async () => {
      const res = await adminAgent.get("/api/admin/users")

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      
      // 至少應有 admin 用戶
      expect(res.body.length).toBeGreaterThan(0)
      
      // 驗證用戶資料結構（不應包含密碼）
      const firstUser = res.body[0]
      expect(firstUser).toHaveProperty("id")
      expect(firstUser).toHaveProperty("username")
      expect(firstUser).toHaveProperty("role")
      expect(firstUser).toHaveProperty("isActive")
      expect(firstUser).not.toHaveProperty("password")
    })

    it("非管理員應返回 403", async () => {
      // 建立並登入非管理員用戶
      await adminAgent
        .post("/api/admin/users")
        .send({
          username: "test_user_list",
          password: "testpass123",
          role: "user2"
        })

      const normalAgent = await createAuthenticatedAgent(app, "test_user_list", "testpass123")
      const res = await normalAgent.get("/api/admin/users")

      expect(res.status).toBe(403)
    })
  })

  describe("POST /api/admin/users", () => {
    it("應成功建立新用戶", async () => {
      const newUser = {
        username: "test_new_user",
        password: "password123",
        email: "test@example.com",
        fullName: "測試用戶",
        role: "user2"
      }

      const res = await adminAgent.post("/api/admin/users").send(newUser)

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty("id")
      expect(res.body).toHaveProperty("username", newUser.username)
      expect(res.body).toHaveProperty("email", newUser.email)
      expect(res.body).toHaveProperty("fullName", newUser.fullName)
      expect(res.body).toHaveProperty("role", newUser.role)
      expect(res.body).toHaveProperty("isActive", true)
      expect(res.body).toHaveProperty("menuPermissions")
      expect(res.body).not.toHaveProperty("password")
    })

    it("缺少必填欄位應返回 400", async () => {
      const res = await adminAgent
        .post("/api/admin/users")
        .send({ username: "test_incomplete" })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("message")
      expect(res.body.message).toContain("必填")
    })

    it("重複用戶名應返回 400", async () => {
      const res = await adminAgent
        .post("/api/admin/users")
        .send({
          username: "admin",
          password: "testpass123",
          role: "user2"
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("已存在")
    })
  })

  describe("PUT /api/admin/users/:id/role", () => {
    it("應成功更新用戶角色", async () => {
      // 先建立用戶
      const createRes = await adminAgent
        .post("/api/admin/users")
        .send({
          username: "test_role_update",
          password: "testpass123",
          role: "user2"
        })

      const userId = createRes.body.id

      // 更新角色
      const res = await adminAgent
        .put(`/api/admin/users/${userId}/role`)
        .send({ role: "user1" })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("id", userId)
      expect(res.body).toHaveProperty("role", "user1")
      expect(res.body).toHaveProperty("menuPermissions")
    })

    it("無效角色應返回 400", async () => {
      const res = await adminAgent
        .put("/api/admin/users/999/role")
        .send({ role: "invalid_role" })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("無效")
    })
  })

  describe("PUT /api/admin/users/:id/permissions", () => {
    it("應成功更新用戶權限", async () => {
      // 先建立用戶
      const createRes = await adminAgent
        .post("/api/admin/users")
        .send({
          username: "test_perm_update",
          password: "testpass123",
          role: "user2"
        })

      const userId = createRes.body.id
      const newPermissions = ["dashboard", "payments"]

      // 更新權限
      const res = await adminAgent
        .put(`/api/admin/users/${userId}/permissions`)
        .send({ permissions: newPermissions })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("id", userId)
      expect(res.body).toHaveProperty("menuPermissions")
      expect(res.body.menuPermissions).toEqual(newPermissions)
    })
  })

  describe("PUT /api/admin/users/:id/password", () => {
    it("應成功重置用戶密碼", async () => {
      // 先建立用戶
      const createRes = await adminAgent
        .post("/api/admin/users")
        .send({
          username: "test_pwd_reset",
          password: "testpass123",
          role: "user2"
        })

      const userId = createRes.body.id

      // 重置密碼
      const res = await adminAgent
        .put(`/api/admin/users/${userId}/password`)
        .send({ newPassword: "newpass12345" })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("message")
    })

    it("密碼太短應返回 400", async () => {
      const res = await adminAgent
        .put("/api/admin/users/1/password")
        .send({ newPassword: "short1" })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("8個字符")
    })
  })

  describe("PUT /api/admin/users/:id/status", () => {
    it("應成功切換用戶狀態", async () => {
      // 先建立用戶
      const createRes = await adminAgent
        .post("/api/admin/users")
        .send({
          username: "test_status_toggle",
          password: "testpass123",
          role: "user2"
        })

      const userId = createRes.body.id

      // 停用用戶
      const res = await adminAgent
        .put(`/api/admin/users/${userId}/status`)
        .send({ isActive: false })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("id", userId)
      expect(res.body).toHaveProperty("isActive", false)
    })
  })

  describe("PUT /api/admin/users/:id/toggle-status", () => {
    it("應成功切換用戶狀態", async () => {
      // 先建立用戶
      const createRes = await adminAgent
        .post("/api/admin/users")
        .send({
          username: "test_toggle",
          password: "testpass123",
          role: "user2"
        })

      const userId = createRes.body.id

      // 切換狀態
      const res = await adminAgent.put(`/api/admin/users/${userId}/toggle-status`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("message")
      expect(res.body).toHaveProperty("user")
      expect(res.body.user).toHaveProperty("id", userId)
      expect(res.body.user).toHaveProperty("isActive")
    })
  })

  describe("DELETE /api/admin/users/:id", () => {
    it("應成功刪除用戶", async () => {
      // 先建立用戶
      const createRes = await adminAgent
        .post("/api/admin/users")
        .send({
          username: "test_delete",
          password: "testpass123",
          role: "user2"
        })

      const userId = createRes.body.id

      // 刪除用戶
      const res = await adminAgent.delete(`/api/admin/users/${userId}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("message")

      // 驗證用戶已刪除
      const users = await storage.getAllUsers()
      const deletedUser = users.find(u => u.id === userId)
      expect(deletedUser).toBeUndefined()
    })

    it("不能刪除自己的帳戶", async () => {
      // 獲取 admin 用戶 ID
      const users = await storage.getAllUsers()
      const adminUser = users.find(u => u.username === "admin")

      const res = await adminAgent.delete(`/api/admin/users/${adminUser!.id}`)

      expect(res.status).toBe(400)
      expect(res.body.message).toContain("不能刪除自己")
    })
  })

  // --- 資料管理 ---
  describe("POST /api/admin/backup", () => {
    it("應成功建立資料備份", async () => {
      const res = await adminAgent.post("/api/admin/backup")

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("message")
      expect(res.body).toHaveProperty("timestamp")
      expect(res.body).toHaveProperty("recordCount")
      expect(res.body).toHaveProperty("fileSize")
    })

    it("非管理員應返回 403", async () => {
      await adminAgent
        .post("/api/admin/users")
        .send({
          username: "test_backup_user",
          password: "testpass123",
          role: "user2"
        })

      const normalAgent = await createAuthenticatedAgent(app, "test_backup_user", "testpass123")
      const res = await normalAgent.post("/api/admin/backup")

      expect(res.status).toBe(403)
    })
  })

  describe("POST /api/admin/clear-cache", () => {
    it("應成功清理快取", async () => {
      const res = await adminAgent.post("/api/admin/clear-cache")

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("message")
      expect(res.body).toHaveProperty("clearedItems")
      expect(typeof res.body.clearedItems).toBe("number")
    })
  })

  describe("POST /api/admin/validate-data", () => {
    it("應成功驗證資料完整性", async () => {
      const res = await adminAgent.post("/api/admin/validate-data")

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("message")
      expect(res.body).toHaveProperty("results")
      expect(typeof res.body.results).toBe("object")
    })
  })

  // --- LINE 配置管理 ---
  describe("LINE Config API", () => {
    it("GET /api/line-config 應返回配置或 null", async () => {
      const res = await adminAgent.get("/api/line-config")

      expect(res.status).toBe(200)
      // 可能是 null 或配置物件
      if (res.body) {
        expect(res.body).toHaveProperty("channelId")
      }
    })

    it("GET /api/line-config/generate-callback 應返回回調 URL", async () => {
      const res = await adminAgent.get("/api/line-config/generate-callback")

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("callbackUrl")
      expect(res.body.callbackUrl).toContain("/api/line/callback")
    })

    it("非管理員存取 LINE 配置應返回 403", async () => {
      await adminAgent
        .post("/api/admin/users")
        .send({
          username: "test_line_user",
          password: "testpass123",
          role: "user2"
        })

      const normalAgent = await createAuthenticatedAgent(app, "test_line_user", "testpass123")
      const res = await normalAgent.get("/api/line-config")

      expect(res.status).toBe(403)
    })
  })

  // --- 錯誤處理 ---
  describe("錯誤處理", () => {
    it("不存在的用戶 ID 應正確處理錯誤", async () => {
      const res = await adminAgent.put("/api/admin/users/99999/role").send({ role: "user1" })

      expect([400, 404, 500]).toContain(res.status)
    })

    it("無效的 ID 格式應返回錯誤", async () => {
      const res = await adminAgent.put("/api/admin/users/invalid/role").send({ role: "user1" })

      expect([400, 404, 500]).toContain(res.status)
    })
  })
})
