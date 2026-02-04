import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon with error handling
try {
  neonConfig.webSocketConstructor = ws;
  neonConfig.poolQueryViaFetch = true;
} catch (error) {
  console.warn('Neon configuration warning:', error);
}

// 增強的連線錯誤處理和重試機制
export const handleDatabaseError = (error: any, operation = 'unknown') => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] Database error in ${operation}:`, {
    message: error.message,
    code: error.code,
    stack: error.stack?.split('\n')[0]
  });
  
  // 記錄錯誤類型以進行監控
  if (error.message?.includes('Too many database connection attempts')) {
    console.warn(`[${timestamp}] Connection pool exhausted during ${operation}, implementing exponential backoff`);
    return new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  }
  
  if (error.message?.includes('timeout')) {
    console.warn(`[${timestamp}] Database timeout in ${operation}, retrying with delay`);
    return new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
  }
  
  if (error.message?.includes('terminating connection')) {
    console.warn(`[${timestamp}] Connection terminated during ${operation}, waiting for reconnection`);
    return new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 記錄未知錯誤以便分析
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
  } catch (error) {
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
  max: 8, // 增加最大連線數但保持合理
  idleTimeoutMillis: 60000, // 延長閒置超時
  connectionTimeoutMillis: 15000, // 延長連線超時
});

export const db = drizzle({ client: pool, schema });