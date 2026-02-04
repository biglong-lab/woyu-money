import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

// 增強的連線錯誤處理和重試機制
export const handleDatabaseError = (error: any, operation = 'unknown') => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] Database error in ${operation}:`, {
    message: error.message,
    code: error.code,
    stack: error.stack?.split('\n')[0]
  });

  if (error.message?.includes('too many clients') || error.message?.includes('timeout')) {
    console.warn(`[${timestamp}] Connection issue during ${operation}, backing off`);
    return new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  }

  if (error.message?.includes('terminating connection')) {
    console.warn(`[${timestamp}] Connection terminated during ${operation}, waiting for reconnection`);
    return new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.error(`[${timestamp}] Unhandled database error in ${operation}:`, error);
  return Promise.resolve();
};

// 連線健康檢查
export const checkDatabaseHealth = async () => {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const duration = Date.now() - start;
    console.log(`Database health check passed (${duration}ms)`);
    return { healthy: true, responseTime: duration };
  } catch (error: any) {
    console.error('Database health check failed:', error);
    return { healthy: false, error: error.message };
  }
};

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 15000,
});

export const db = drizzle(pool, { schema });
