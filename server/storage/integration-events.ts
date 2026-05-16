/**
 * Integration Events 儲存層
 * 通用拋接紀錄 — 不分 income/expense，統一寫入/查詢
 */
import { db } from "../db"
import { integrationEvents } from "@shared/schema"
import type { InsertIntegrationEvent, IntegrationEvent, EventQuery } from "@shared/schema"
import { and, eq, gte, lte, desc, sql } from "drizzle-orm"

/** 寫入單筆事件（不應拋錯、紀錄失敗只 log 不阻塞主流程）*/
export async function logEvent(input: InsertIntegrationEvent): Promise<IntegrationEvent | null> {
  try {
    const [row] = await db.insert(integrationEvents).values(input).returning()
    return row
  } catch (err) {
    console.error("[integration-events] log failed:", err)
    return null
  }
}

/** 查詢事件（含分頁、篩選）*/
export async function queryEvents(query: EventQuery): Promise<{
  data: IntegrationEvent[]
  total: number
  page: number
  pageSize: number
}> {
  const conditions = []

  if (query.integrationType) {
    conditions.push(eq(integrationEvents.integrationType, query.integrationType))
  }
  if (query.sourceId) {
    conditions.push(eq(integrationEvents.sourceId, query.sourceId))
  }
  if (query.sourceKey) {
    conditions.push(eq(integrationEvents.sourceKey, query.sourceKey))
  }
  if (query.direction) {
    conditions.push(eq(integrationEvents.direction, query.direction))
  }
  if (query.outcome) {
    conditions.push(eq(integrationEvents.outcome, query.outcome))
  }
  if (query.since) {
    conditions.push(gte(integrationEvents.createdAt, new Date(query.since)))
  }
  if (query.until) {
    conditions.push(lte(integrationEvents.createdAt, new Date(query.until)))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const offset = (query.page - 1) * query.pageSize

  const [data, [{ count }]] = await Promise.all([
    db
      .select()
      .from(integrationEvents)
      .where(whereClause)
      .orderBy(desc(integrationEvents.createdAt))
      .limit(query.pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(integrationEvents)
      .where(whereClause),
  ])

  return {
    data,
    total: count,
    page: query.page,
    pageSize: query.pageSize,
  }
}

/** 取得單一 source 的健康指標（24h 內成功率、平均延遲、最近成功/失敗時間）*/
export async function getSourceHealth(
  integrationType: "income" | "expense",
  sourceId: number
): Promise<{
  last24hTotal: number
  last24hSuccess: number
  last24hFailure: number
  successRate: number // 0-1
  avgLatencyMs: number | null
  lastSuccessAt: Date | null
  lastFailureAt: Date | null
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const base = and(
    eq(integrationEvents.integrationType, integrationType),
    eq(integrationEvents.sourceId, sourceId),
    gte(integrationEvents.createdAt, since)
  )

  const [stats] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      success: sql<number>`cast(count(*) filter (where outcome = 'success') as int)`,
      failure: sql<number>`cast(count(*) filter (where outcome in ('auth_failed','validation_failed','error')) as int)`,
      avgLatency: sql<number | null>`avg(latency_ms)`,
    })
    .from(integrationEvents)
    .where(base)

  const [lastSuccess] = await db
    .select({ createdAt: integrationEvents.createdAt })
    .from(integrationEvents)
    .where(
      and(
        eq(integrationEvents.integrationType, integrationType),
        eq(integrationEvents.sourceId, sourceId),
        eq(integrationEvents.outcome, "success")
      )
    )
    .orderBy(desc(integrationEvents.createdAt))
    .limit(1)

  const [lastFailure] = await db
    .select({ createdAt: integrationEvents.createdAt })
    .from(integrationEvents)
    .where(
      and(
        eq(integrationEvents.integrationType, integrationType),
        eq(integrationEvents.sourceId, sourceId),
        sql`${integrationEvents.outcome} in ('auth_failed','validation_failed','error')`
      )
    )
    .orderBy(desc(integrationEvents.createdAt))
    .limit(1)

  const total = stats?.total ?? 0
  const success = stats?.success ?? 0
  const failure = stats?.failure ?? 0

  return {
    last24hTotal: total,
    last24hSuccess: success,
    last24hFailure: failure,
    successRate: total > 0 ? success / total : 0,
    avgLatencyMs: stats?.avgLatency ? Math.round(Number(stats.avgLatency)) : null,
    lastSuccessAt: lastSuccess?.createdAt ?? null,
    lastFailureAt: lastFailure?.createdAt ?? null,
  }
}

/** 取得單筆事件（給 Replay 用）*/
export async function getEventById(id: number): Promise<IntegrationEvent | null> {
  const [row] = await db
    .select()
    .from(integrationEvents)
    .where(eq(integrationEvents.id, id))
    .limit(1)
  return row ?? null
}
