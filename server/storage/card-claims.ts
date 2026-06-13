/**
 * 信用卡請款紀錄 Storage 層
 * 獨立模組：CRUD + 標籤/館別管理 + 區間查詢 + 月度統計
 */
import { db } from "../db"
import {
  cardClaims,
  cardClaimTags,
  cardClaimProperties,
  type CardClaim,
  type InsertCardClaim,
  type CardClaimTag,
  type InsertCardClaimTag,
  type CardClaimProperty,
  type InsertCardClaimProperty,
} from "@shared/schema"
import { eq, and, gte, lte, asc, desc, sql } from "drizzle-orm"

// ─────────────────────────────────────────────
// 請款標籤
// ─────────────────────────────────────────────

export async function getTags(includeInactive = false): Promise<CardClaimTag[]> {
  const where = includeInactive ? undefined : eq(cardClaimTags.isActive, true)
  return db
    .select()
    .from(cardClaimTags)
    .where(where)
    .orderBy(asc(cardClaimTags.sortOrder), asc(cardClaimTags.id))
}

export async function createTag(data: InsertCardClaimTag): Promise<CardClaimTag> {
  const [row] = await db.insert(cardClaimTags).values(data).returning()
  return row
}

export async function updateTag(
  id: number,
  data: Partial<InsertCardClaimTag>
): Promise<CardClaimTag | undefined> {
  const [row] = await db.update(cardClaimTags).set(data).where(eq(cardClaimTags.id, id)).returning()
  return row
}

export async function deleteTag(id: number): Promise<void> {
  // 軟停用（避免破壞既有紀錄的 FK）
  await db.update(cardClaimTags).set({ isActive: false }).where(eq(cardClaimTags.id, id))
}

// ─────────────────────────────────────────────
// 館別
// ─────────────────────────────────────────────

export async function getProperties(includeInactive = false): Promise<CardClaimProperty[]> {
  const where = includeInactive ? undefined : eq(cardClaimProperties.isActive, true)
  return db
    .select()
    .from(cardClaimProperties)
    .where(where)
    .orderBy(asc(cardClaimProperties.sortOrder), asc(cardClaimProperties.id))
}

export async function createProperty(data: InsertCardClaimProperty): Promise<CardClaimProperty> {
  const [row] = await db.insert(cardClaimProperties).values(data).returning()
  return row
}

export async function updateProperty(
  id: number,
  data: Partial<InsertCardClaimProperty>
): Promise<CardClaimProperty | undefined> {
  const [row] = await db
    .update(cardClaimProperties)
    .set(data)
    .where(eq(cardClaimProperties.id, id))
    .returning()
  return row
}

export async function deleteProperty(id: number): Promise<void> {
  await db
    .update(cardClaimProperties)
    .set({ isActive: false })
    .where(eq(cardClaimProperties.id, id))
}

// ─────────────────────────────────────────────
// 請款紀錄
// ─────────────────────────────────────────────

export interface CardClaimFilters {
  startDate?: string // YYYY-MM-DD（含）
  endDate?: string // YYYY-MM-DD（含）
  status?: string
  tagId?: number
  propertyId?: number
}

/** 帶標籤/館別名稱的請款紀錄 */
export interface CardClaimWithRefs extends CardClaim {
  tagName: string | null
  propertyName: string | null
}

function buildConditions(filters: CardClaimFilters) {
  const conditions = []
  if (filters.startDate) conditions.push(gte(cardClaims.swipeDate, filters.startDate))
  if (filters.endDate) conditions.push(lte(cardClaims.swipeDate, filters.endDate))
  if (filters.status) conditions.push(eq(cardClaims.status, filters.status))
  if (filters.tagId) conditions.push(eq(cardClaims.tagId, filters.tagId))
  if (filters.propertyId) conditions.push(eq(cardClaims.propertyId, filters.propertyId))
  return conditions.length > 0 ? and(...conditions) : undefined
}

export async function listClaims(filters: CardClaimFilters = {}): Promise<CardClaimWithRefs[]> {
  const rows = await db
    .select({
      id: cardClaims.id,
      amount: cardClaims.amount,
      swipeDate: cardClaims.swipeDate,
      bank: cardClaims.bank,
      tagId: cardClaims.tagId,
      propertyId: cardClaims.propertyId,
      status: cardClaims.status,
      receiptImageUrl: cardClaims.receiptImageUrl,
      notes: cardClaims.notes,
      createdAt: cardClaims.createdAt,
      updatedAt: cardClaims.updatedAt,
      tagName: cardClaimTags.name,
      propertyName: cardClaimProperties.name,
    })
    .from(cardClaims)
    .leftJoin(cardClaimTags, eq(cardClaims.tagId, cardClaimTags.id))
    .leftJoin(cardClaimProperties, eq(cardClaims.propertyId, cardClaimProperties.id))
    .where(buildConditions(filters))
    .orderBy(desc(cardClaims.swipeDate), desc(cardClaims.id))
  return rows
}

export async function createClaim(data: InsertCardClaim): Promise<CardClaim> {
  const [row] = await db.insert(cardClaims).values(data).returning()
  return row
}

export async function updateClaim(
  id: number,
  data: Partial<InsertCardClaim>
): Promise<CardClaim | undefined> {
  const [row] = await db
    .update(cardClaims)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(cardClaims.id, id))
    .returning()
  return row
}

export async function deleteClaim(id: number): Promise<void> {
  await db.delete(cardClaims).where(eq(cardClaims.id, id))
}

// ─────────────────────────────────────────────
// 統計
// ─────────────────────────────────────────────

export interface CardClaimSummary {
  totalAmount: number
  totalCount: number
  byStatus: Array<{ status: string; count: number; amount: number }>
  byMonth: Array<{ month: string; count: number; amount: number }>
  byTag: Array<{ tagId: number | null; tagName: string | null; count: number; amount: number }>
  byProperty: Array<{
    propertyId: number | null
    propertyName: string | null
    count: number
    amount: number
  }>
}

/** 區間統計（含總額、依狀態/月份/標籤/館別彙總） */
export async function getSummary(filters: CardClaimFilters = {}): Promise<CardClaimSummary> {
  const where = buildConditions(filters)

  const [totals] = await db
    .select({
      totalAmount: sql<string>`COALESCE(SUM(${cardClaims.amount}), 0)`,
      totalCount: sql<number>`COUNT(*)::int`,
    })
    .from(cardClaims)
    .where(where)

  const byStatus = await db
    .select({
      status: cardClaims.status,
      count: sql<number>`COUNT(*)::int`,
      amount: sql<string>`COALESCE(SUM(${cardClaims.amount}), 0)`,
    })
    .from(cardClaims)
    .where(where)
    .groupBy(cardClaims.status)

  const byMonth = await db
    .select({
      month: sql<string>`TO_CHAR(${cardClaims.swipeDate}, 'YYYY-MM')`,
      count: sql<number>`COUNT(*)::int`,
      amount: sql<string>`COALESCE(SUM(${cardClaims.amount}), 0)`,
    })
    .from(cardClaims)
    .where(where)
    .groupBy(sql`TO_CHAR(${cardClaims.swipeDate}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${cardClaims.swipeDate}, 'YYYY-MM')`)

  const byTag = await db
    .select({
      tagId: cardClaims.tagId,
      tagName: cardClaimTags.name,
      count: sql<number>`COUNT(*)::int`,
      amount: sql<string>`COALESCE(SUM(${cardClaims.amount}), 0)`,
    })
    .from(cardClaims)
    .leftJoin(cardClaimTags, eq(cardClaims.tagId, cardClaimTags.id))
    .where(where)
    .groupBy(cardClaims.tagId, cardClaimTags.name)

  const byProperty = await db
    .select({
      propertyId: cardClaims.propertyId,
      propertyName: cardClaimProperties.name,
      count: sql<number>`COUNT(*)::int`,
      amount: sql<string>`COALESCE(SUM(${cardClaims.amount}), 0)`,
    })
    .from(cardClaims)
    .leftJoin(cardClaimProperties, eq(cardClaims.propertyId, cardClaimProperties.id))
    .where(where)
    .groupBy(cardClaims.propertyId, cardClaimProperties.name)

  const num = (v: string | number) => Number(v) || 0

  return {
    totalAmount: num(totals.totalAmount),
    totalCount: totals.totalCount,
    byStatus: byStatus.map((r) => ({ status: r.status, count: r.count, amount: num(r.amount) })),
    byMonth: byMonth.map((r) => ({ month: r.month, count: r.count, amount: num(r.amount) })),
    byTag: byTag.map((r) => ({
      tagId: r.tagId,
      tagName: r.tagName,
      count: r.count,
      amount: num(r.amount),
    })),
    byProperty: byProperty.map((r) => ({
      propertyId: r.propertyId,
      propertyName: r.propertyName,
      count: r.count,
      amount: num(r.amount),
    })),
  }
}
