/**
 * Session store（自 storage/index.ts 的 DatabaseStorage 抽出，2026-07-03 Phase 4.1）
 * PostgreSQL-backed express-session store（sessions 表自動建立）
 */
import connectPg from "connect-pg-simple"
import session from "express-session"
import { pool } from "./db"

const PostgresSessionStore = connectPg(session)

export const sessionStore = new PostgresSessionStore({
  pool: pool,
  createTableIfMissing: true,
  tableName: "sessions",
})
