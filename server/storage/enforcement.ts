/**
 * 強制執行 Storage（公文/圈存/分期/分期實付 + 對帳）
 */
import { db } from "../db"
import {
  enforcementCases,
  enforcementSeizures,
  enforcementInstallments,
  enforcementInstallmentPayments,
  type InsertEnforcementCase,
  type InsertEnforcementSeizure,
  type InsertEnforcementInstallment,
  type InsertEnforcementInstallmentPayment,
} from "@shared/schema"
import { eq, desc, sql } from "drizzle-orm"

// ── Cases ──
export async function listCases() {
  return db
    .select()
    .from(enforcementCases)
    .orderBy(desc(enforcementCases.issuedDate), desc(enforcementCases.id))
}
export async function getCase(id: number) {
  const [r] = await db.select().from(enforcementCases).where(eq(enforcementCases.id, id))
  return r
}
export async function createCase(data: InsertEnforcementCase) {
  const [r] = await db.insert(enforcementCases).values(data).returning()
  return r
}
export async function updateCase(id: number, data: Partial<InsertEnforcementCase>) {
  const [r] = await db
    .update(enforcementCases)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(enforcementCases.id, id))
    .returning()
  return r
}
export async function deleteCase(id: number) {
  await db.delete(enforcementCases).where(eq(enforcementCases.id, id))
}

// ── Seizures ──
export async function listSeizures() {
  return db
    .select()
    .from(enforcementSeizures)
    .orderBy(desc(enforcementSeizures.seizureDate), desc(enforcementSeizures.id))
}
export async function createSeizure(data: InsertEnforcementSeizure) {
  const [r] = await db.insert(enforcementSeizures).values(data).returning()
  return r
}
export async function updateSeizure(id: number, data: Partial<InsertEnforcementSeizure>) {
  const [r] = await db
    .update(enforcementSeizures)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(enforcementSeizures.id, id))
    .returning()
  return r
}
export async function deleteSeizure(id: number) {
  await db.delete(enforcementSeizures).where(eq(enforcementSeizures.id, id))
}

// ── Installments ──
export async function listInstallments() {
  return db.select().from(enforcementInstallments).orderBy(desc(enforcementInstallments.id))
}
export async function createInstallment(data: InsertEnforcementInstallment) {
  const [r] = await db.insert(enforcementInstallments).values(data).returning()
  return r
}
export async function updateInstallment(id: number, data: Partial<InsertEnforcementInstallment>) {
  const [r] = await db
    .update(enforcementInstallments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(enforcementInstallments.id, id))
    .returning()
  return r
}
export async function deleteInstallment(id: number) {
  await db
    .delete(enforcementInstallmentPayments)
    .where(eq(enforcementInstallmentPayments.installmentId, id))
  await db.delete(enforcementInstallments).where(eq(enforcementInstallments.id, id))
}

// ── Installment payments ──
export async function listInstallmentPayments(installmentId: number) {
  return db
    .select()
    .from(enforcementInstallmentPayments)
    .where(eq(enforcementInstallmentPayments.installmentId, installmentId))
    .orderBy(desc(enforcementInstallmentPayments.paymentDate))
}
export async function createInstallmentPayment(data: InsertEnforcementInstallmentPayment) {
  const [r] = await db.insert(enforcementInstallmentPayments).values(data).returning()
  return r
}
export async function deleteInstallmentPayment(id: number) {
  await db.delete(enforcementInstallmentPayments).where(eq(enforcementInstallmentPayments.id, id))
}

// ── 對帳：強執總額 ≈ 圈存 + 分期(已付+排定) ──
export interface ReconcileSummary {
  enforcedTotal: number // 公文總額加總
  seizedTotal: number // 圈存中（frozen）加總
  seizedReleasedTotal: number // 已解除
  installmentPlanTotal: number // 分期計畫總額加總
  installmentPaidTotal: number // 分期已實付加總
  coveredTotal: number // 圈存(frozen)+分期已付
  unclassifiedSeized: number // 未綁公文的圈存
  unclassifiedInstallment: number // 未綁公文的分期
  diff: number // 強執總額 − (圈存+分期計畫)
  caseCount: number
}

export async function getReconcileSummary(): Promise<ReconcileSummary> {
  const [caseAgg] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${enforcementCases.totalAmount}), 0)`,
      cnt: sql<number>`COUNT(*)::int`,
    })
    .from(enforcementCases)

  const [seizeAgg] = await db
    .select({
      frozen: sql<string>`COALESCE(SUM(${enforcementSeizures.amount}) FILTER (WHERE ${enforcementSeizures.status} = 'frozen'), 0)`,
      released: sql<string>`COALESCE(SUM(${enforcementSeizures.amount}) FILTER (WHERE ${enforcementSeizures.status} = 'released'), 0)`,
      unclassified: sql<string>`COALESCE(SUM(${enforcementSeizures.amount}) FILTER (WHERE ${enforcementSeizures.caseId} IS NULL), 0)`,
    })
    .from(enforcementSeizures)

  const [instAgg] = await db
    .select({
      plan: sql<string>`COALESCE(SUM(${enforcementInstallments.totalAmount}), 0)`,
      unclassified: sql<string>`COALESCE(SUM(${enforcementInstallments.totalAmount}) FILTER (WHERE ${enforcementInstallments.caseId} IS NULL), 0)`,
    })
    .from(enforcementInstallments)

  const [payAgg] = await db
    .select({
      paid: sql<string>`COALESCE(SUM(${enforcementInstallmentPayments.amount}), 0)`,
    })
    .from(enforcementInstallmentPayments)

  const enforcedTotal = Number(caseAgg.total)
  const seizedTotal = Number(seizeAgg.frozen)
  const installmentPlanTotal = Number(instAgg.plan)
  const installmentPaidTotal = Number(payAgg.paid)

  return {
    enforcedTotal,
    seizedTotal,
    seizedReleasedTotal: Number(seizeAgg.released),
    installmentPlanTotal,
    installmentPaidTotal,
    coveredTotal: seizedTotal + installmentPaidTotal,
    unclassifiedSeized: Number(seizeAgg.unclassified),
    unclassifiedInstallment: Number(instAgg.unclassified),
    diff: enforcedTotal - (seizedTotal + installmentPlanTotal),
    caseCount: caseAgg.cnt,
  }
}
