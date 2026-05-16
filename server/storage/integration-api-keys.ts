/**
 * Integration API Keys 儲存層
 * 包含：生成、驗證、列出、撤銷 + Express middleware
 */
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { Request, Response, NextFunction } from "express"
import { db } from "../db"
import { integrationApiKeys, type IntegrationApiKey } from "@shared/schema"
import { eq, and, sql } from "drizzle-orm"

const KEY_PREFIX = "moneykey_"
const KEY_BODY_LENGTH = 32
const PREFIX_DISPLAY_LENGTH = 8 // 前 8 碼供 UI 辨識（不含 KEY_PREFIX 本身）
const BCRYPT_ROUNDS = 10

/**
 * 產生隨機 base62 字串（避免特殊字元）
 */
function randomBase62(length: number): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const bytes = crypto.randomBytes(length)
  let result = ""
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length]
  }
  return result
}

/**
 * 產生新 API Key 並寫入 DB
 *
 * @returns 完整 key（**只回傳一次**，之後 DB 只存 hash）+ 新建的 row（無 hash）
 */
export async function generateApiKey(input: {
  name: string
  description?: string | null
  expiresAt?: Date | null
  createdByUserId?: number | null
  scope?: string
}): Promise<{ key: string; row: Omit<IntegrationApiKey, "keyHash"> }> {
  const body = randomBase62(KEY_BODY_LENGTH)
  const fullKey = `${KEY_PREFIX}${body}`
  const keyPrefix = `${KEY_PREFIX}${body.slice(0, PREFIX_DISPLAY_LENGTH)}` // moneykey_aB3xK7mP
  const keyHash = await bcrypt.hash(fullKey, BCRYPT_ROUNDS)

  const [row] = await db
    .insert(integrationApiKeys)
    .values({
      name: input.name,
      description: input.description ?? null,
      expiresAt: input.expiresAt ?? null,
      createdByUserId: input.createdByUserId ?? null,
      scope: input.scope ?? "spec:read",
      keyPrefix,
      keyHash,
    })
    .returning()

  // 不回傳 hash
  const { keyHash: _h, ...rowWithoutHash } = row
  void _h
  return { key: fullKey, row: rowWithoutHash }
}

/**
 * 列出所有 keys（不含 hash）
 */
export async function listApiKeys(): Promise<Omit<IntegrationApiKey, "keyHash">[]> {
  const rows = await db.select().from(integrationApiKeys).orderBy(integrationApiKeys.createdAt)
  return rows.map(({ keyHash: _h, ...r }) => {
    void _h
    return r
  })
}

/**
 * 撤銷 key（軟刪除：isActive=false）
 */
export async function revokeApiKey(id: number): Promise<boolean> {
  const result = await db
    .update(integrationApiKeys)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(integrationApiKeys.id, id))
    .returning({ id: integrationApiKeys.id })
  return result.length > 0
}

/**
 * 驗證提供的 key 是否有效
 *
 * 兼顧效能：先用 prefix 縮小範圍（O(1) index lookup），再 bcrypt.compare
 */
export async function verifyApiKey(
  providedKey: string,
  requiredScope = "spec:read"
): Promise<{ valid: boolean; reason?: string; row?: IntegrationApiKey }> {
  if (!providedKey || !providedKey.startsWith(KEY_PREFIX)) {
    return { valid: false, reason: "格式錯誤（應為 moneykey_ 開頭）" }
  }

  // 從 providedKey 抽 prefix
  const body = providedKey.slice(KEY_PREFIX.length)
  if (body.length < PREFIX_DISPLAY_LENGTH) {
    return { valid: false, reason: "Key 長度不正確" }
  }
  const prefix = `${KEY_PREFIX}${body.slice(0, PREFIX_DISPLAY_LENGTH)}`

  // 用 prefix 找候選（理論上只會有一筆、但用 prefix unique 已保證）
  const candidates = await db
    .select()
    .from(integrationApiKeys)
    .where(and(eq(integrationApiKeys.keyPrefix, prefix), eq(integrationApiKeys.isActive, true)))
    .limit(5) // 防禦：理論上 1 筆，多查幾筆避免 silent miss

  if (candidates.length === 0) {
    return { valid: false, reason: "Key 不存在或已撤銷" }
  }

  // bcrypt 比對
  for (const cand of candidates) {
    const match = await bcrypt.compare(providedKey, cand.keyHash)
    if (!match) continue

    // scope 檢查
    if (cand.scope !== requiredScope && cand.scope !== "*") {
      return {
        valid: false,
        reason: `Scope 不足（需要 ${requiredScope}，此 key 是 ${cand.scope}）`,
      }
    }

    // 過期檢查
    if (cand.expiresAt && new Date(cand.expiresAt) < new Date()) {
      return { valid: false, reason: "Key 已過期" }
    }

    return { valid: true, row: cand }
  }

  return { valid: false, reason: "Key 不正確" }
}

/**
 * 更新使用紀錄（fire-and-forget、失敗不影響主流程）
 */
export async function recordApiKeyUsage(id: number, ip: string | null): Promise<void> {
  try {
    await db
      .update(integrationApiKeys)
      .set({
        lastUsedAt: new Date(),
        lastUsedIp: ip,
        usageCount: sql`${integrationApiKeys.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(integrationApiKeys.id, id))
  } catch (err) {
    console.error("[api-keys] recordApiKeyUsage failed:", err)
  }
}

// ─────────────────────────────────────────────
// Express middleware：要求帶有效 API Key
// 接受 Header：
//   - Authorization: Bearer <key>
//   - X-API-Key: <key>
// ─────────────────────────────────────────────
export function requireApiKey(requiredScope = "spec:read") {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 從 header 取 key
    let providedKey: string | undefined

    const authHeader = req.headers["authorization"]
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      providedKey = authHeader.slice(7).trim()
    }

    const xApiKey = req.headers["x-api-key"]
    if (!providedKey && typeof xApiKey === "string") {
      providedKey = xApiKey.trim()
    }

    if (!providedKey) {
      return res.status(401).json({
        error: "Missing API Key",
        hint: "請帶 Authorization: Bearer <api-key> 或 X-API-Key: <api-key> header",
      })
    }

    const result = await verifyApiKey(providedKey, requiredScope)
    if (!result.valid) {
      return res.status(401).json({ error: "Invalid API Key", reason: result.reason })
    }

    // 記錄使用（不阻塞）
    if (result.row) {
      const ip =
        String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "")
          .split(",")[0]
          .trim() || null
      void recordApiKeyUsage(result.row.id, ip)
      // 把 key info 掛進 req 供後續使用
      ;(req as Request & { apiKey?: IntegrationApiKey }).apiKey = result.row
    }

    next()
  }
}
