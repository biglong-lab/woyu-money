/**
 * Web Push Subscriptions 儲存層
 * 包含：訂閱（upsert by endpoint）、取消訂閱、查詢、發送 helper
 */
import webpush from "web-push"
import { db } from "../db"
import { pushSubscriptions, type PushSubscriptionRow } from "@shared/schema"
import { and, eq, sql } from "drizzle-orm"

// 初始化 VAPID
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || ""
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ""
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@homi.cc"

let vapidConfigured = false
try {
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
    vapidConfigured = true
  }
} catch (err) {
  console.warn("[push] VAPID setup failed:", err)
}

export function isPushConfigured(): boolean {
  return vapidConfigured
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC
}

/**
 * 訂閱（upsert by endpoint — 同 endpoint 重複訂閱會覆蓋）
 */
export async function subscribePush(input: {
  userId: number
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string | null
}): Promise<PushSubscriptionRow> {
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, input.endpoint))
    .limit(1)

  if (existing.length > 0) {
    // upsert
    const [updated] = await db
      .update(pushSubscriptions)
      .set({
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        isActive: true,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pushSubscriptions.id, existing[0].id))
      .returning()
    return updated
  }

  const [row] = await db
    .insert(pushSubscriptions)
    .values({
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    })
    .returning()
  return row
}

/**
 * 取消訂閱
 */
export async function unsubscribePush(endpoint: string): Promise<boolean> {
  const result = await db
    .update(pushSubscriptions)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .returning({ id: pushSubscriptions.id })
  return result.length > 0
}

/**
 * 列出 user 所有啟用中訂閱（多裝置場景）
 */
export async function getActiveSubscriptions(userId: number): Promise<PushSubscriptionRow[]> {
  return db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.isActive, true)))
}

/**
 * 發送推播給某 user 所有裝置
 *
 * 失效的 subscription（410 Gone）會自動標記 inactive
 */
export interface PushPayload {
  title: string
  body?: string
  url?: string
  tag?: string
  icon?: string
  data?: Record<string, unknown>
}

export async function sendPushToUser(
  userId: number,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!vapidConfigured) {
    console.warn("[push] VAPID not configured, skip send")
    return { sent: 0, failed: 0 }
  }

  const subs = await getActiveSubscriptions(userId)
  let sent = 0
  let failed = 0

  const payloadStr = JSON.stringify(payload)

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payloadStr,
        { TTL: 60 * 60 } // 1 小時內試送
      )
      sent++
      // 更新 lastUsedAt
      await db
        .update(pushSubscriptions)
        .set({ lastUsedAt: new Date() })
        .where(eq(pushSubscriptions.id, sub.id))
        .catch(() => {})
    } catch (err) {
      failed++
      const code = (err as { statusCode?: number }).statusCode
      // 410 Gone / 404 Not Found → 訂閱已失效、標記 inactive
      if (code === 410 || code === 404) {
        await db
          .update(pushSubscriptions)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(pushSubscriptions.id, sub.id))
          .catch(() => {})
        console.info(`[push] subscription ${sub.id} expired, marked inactive`)
      } else {
        console.error("[push] send failed:", err)
      }
    }
  }

  return { sent, failed }
}

/**
 * 廣播給所有 active 訂閱（管理員用）
 */
export async function broadcastPush(
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!vapidConfigured) return { sent: 0, failed: 0 }

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.isActive, true))

  if (count === 0) return { sent: 0, failed: 0 }

  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.isActive, true))

  let sent = 0
  let failed = 0
  const payloadStr = JSON.stringify(payload)

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payloadStr,
        { TTL: 60 * 60 }
      )
      sent++
    } catch (err) {
      failed++
      const code = (err as { statusCode?: number }).statusCode
      if (code === 410 || code === 404) {
        await db
          .update(pushSubscriptions)
          .set({ isActive: false })
          .where(eq(pushSubscriptions.id, sub.id))
          .catch(() => {})
      }
    }
  }

  return { sent, failed }
}
