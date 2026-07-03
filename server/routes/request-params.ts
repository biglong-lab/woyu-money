/**
 * 共用請求參數解析（Phase 2.2 統一雙標準）
 *
 * 來源：debts.ts 的嚴謹模式抽出，讓 payment-records / payment-schedule 等
 * 舊路由一併採用，消除同 codebase「有的防 NaN、有的不防」的雙標準。
 */
import { AppError } from "../middleware/error-handler"
import { ZodError } from "zod"

/** 必填正整數（路徑參數 :id 等），無效丟 400 */
export function parseId(raw: unknown, fieldName = "ID"): number {
  const id = parseInt(String(raw), 10)
  if (isNaN(id) || id <= 0) throw new AppError(400, `無效的 ${fieldName}`)
  return id
}

/** 選填整數（query 參數），無效或空值視為未提供 */
export function optionalInt(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined
  const n = parseInt(String(raw), 10)
  return isNaN(n) ? undefined : n
}

/** 選填整數但帶預設值與上下限（分頁 page/limit 用） */
export function intWithDefault(raw: unknown, def: number, min = 1, max = 1000): number {
  const n = optionalInt(raw)
  if (n === undefined) return def
  return Math.min(Math.max(n, min), max)
}

/** 選填日期（YYYY-MM-DD），格式錯誤丟 400；空值回 undefined */
export function optionalDateStr(raw: unknown, fieldName = "日期"): string | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined
  const str = String(raw)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    throw new AppError(400, `${fieldName} 格式錯誤，需為 YYYY-MM-DD`)
  }
  const d = new Date(str)
  if (isNaN(d.getTime())) throw new AppError(400, `${fieldName} 不是有效日期`)
  return str
}

/** Zod 錯誤轉 400 中文訊息（其餘原樣拋出） */
export function handleZod(error: unknown): never {
  if (error instanceof ZodError) {
    throw new AppError(400, "資料驗證失敗：" + error.errors.map((e) => e.message).join("、"))
  }
  throw error
}
