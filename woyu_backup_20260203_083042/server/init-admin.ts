import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";

async function initializeAdminUser() {
  try {
    console.log("正在初始化管理員帳戶...");
    
    // Check if admin user already exists
    const existingAdmin = await db.select().from(users).where(eq(users.username, "ru03bjo4f"));
    
    if (existingAdmin.length > 0) {
      console.log("管理員帳戶已存在");
      return;
    }

    // Create admin user with hashed password
    const hashedPassword = await hashPassword("rh750920@@!!");
    
    await db.insert(users).values({
      username: "ru03bjo4f",
      password: hashedPassword,
      email: "admin@system.local",
      fullName: "系統管理員",
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("管理員帳戶創建成功");
    console.log("用戶名: ru03bjo4f");
    console.log("密碼: rh750920@@!!");
    
  } catch (error) {
    console.error("初始化管理員帳戶失敗:", error);
  } finally {
    process.exit(0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeAdminUser();
}

export { initializeAdminUser };