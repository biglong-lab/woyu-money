import { db } from "./db"
import { users } from "@shared/schema"
import { eq } from "drizzle-orm"
import { hashPassword } from "./auth"

async function initializeAdminUser() {
  const adminUsername = process.env.ADMIN_USERNAME
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminUsername || !adminPassword) {
    console.error("請設定 ADMIN_USERNAME 和 ADMIN_PASSWORD 環境變數")
    process.exit(1)
  }

  if (adminPassword.length < 8) {
    console.error("管理員密碼至少需要 8 個字元")
    process.exit(1)
  }

  try {
    // Check if admin user already exists
    const existingAdmin = await db.select().from(users).where(eq(users.username, adminUsername))

    if (existingAdmin.length > 0) {
      console.log("管理員帳戶已存在，跳過建立")
      return
    }

    // Create admin user with hashed password
    const hashedPassword = await hashPassword(adminPassword)

    await db.insert(users).values({
      username: adminUsername,
      password: hashedPassword,
      email: "admin@system.local",
      fullName: "系統管理員",
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log("管理員帳戶建立成功")
  } catch (error) {
    console.error("初始化管理員帳戶失敗:", error)
  } finally {
    process.exit(0)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeAdminUser()
}

export { initializeAdminUser }
