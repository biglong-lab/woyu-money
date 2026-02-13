import pg from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "@shared/schema"

const { Pool } = pg

// 資料庫錯誤型別（包含常見的 pg 錯誤屬性）
interface DatabaseError {
  message: string
  code?: string
  stack?: string
}

// 將 unknown 錯誤轉換為 DatabaseError
function toDatabaseError(error: unknown): DatabaseError {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as NodeJS.ErrnoException).code,
      stack: error.stack,
    }
  }
  return { message: String(error) }
}

// 增強的連線錯誤處理和重試機制
export const handleDatabaseError = (error: unknown, operation = "unknown") => {
  const dbError = toDatabaseError(error)
  const timestamp = new Date().toISOString()
  console.error(`[${timestamp}] Database error in ${operation}:`, {
    message: dbError.message,
    code: dbError.code,
    stack: dbError.stack?.split("\n")[0],
  })

  if (dbError.message?.includes("too many clients") || dbError.message?.includes("timeout")) {
    console.warn(`[${timestamp}] Connection issue during ${operation}, backing off`)
    return new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000))
  }

  if (dbError.message?.includes("terminating connection")) {
    console.warn(
      `[${timestamp}] Connection terminated during ${operation}, waiting for reconnection`
    )
    return new Promise((resolve) => setTimeout(resolve, 2000))
  }

  console.error(`[${timestamp}] Unhandled database error in ${operation}:`, error)
  return Promise.resolve()
}

// 連線健康檢查
export const checkDatabaseHealth = async () => {
  try {
    const start = Date.now()
    await pool.query("SELECT 1")
    const duration = Date.now() - start
    return { healthy: true, responseTime: duration }
  } catch (error: unknown) {
    console.error("Database health check failed:", error)
    return { healthy: false, error: error instanceof Error ? error.message : String(error) }
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?")
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 15000,
})

export const db = drizzle(pool, { schema })
