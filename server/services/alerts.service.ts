/**
 * 今日財務提醒聚合 service（route + scheduler 共用）
 * 訊號：勞健保到期 / 請款逾 N 天未到帳 / 應付排程到期(含逾期)
 */
import { sql } from "drizzle-orm"
import { db } from "../db"
import { getTodayReminderStatus } from "./late-fee.service"

const SETTLE_OVERDUE_DAYS = 14

export interface TodayAlert {
  type: "labor_insurance" | "claim_unsettled" | "schedule_due"
  severity: "critical" | "warn" | "info"
  title: string
  detail: string
  count?: number
  amount?: number
  link: string
}

export async function getTodayAlerts(): Promise<TodayAlert[]> {
  const alerts: TodayAlert[] = []

  // 1. 勞健保到期
  try {
    const reminder = (await getTodayReminderStatus()) as {
      level?: string
      message?: string
      pendingCount?: number
    }
    const level = reminder?.level
    if (level && level !== "none") {
      alerts.push({
        type: "labor_insurance",
        severity: level === "final" ? "critical" : level === "warning" ? "warn" : "info",
        title: "勞健保提醒",
        detail: reminder.message || "接近勞健保截止日（每月 25 日）",
        count: reminder.pendingCount,
        link: "/labor-insurance-watch",
      })
    }
  } catch {
    /* 略過 */
  }

  // 2. 請款逾 N 天未到帳
  const claimRows = await db.execute<{ cnt: number; total: string }>(sql`
    SELECT COUNT(*)::int AS cnt,
           COALESCE(SUM(amount::numeric), 0)::text AS total
    FROM card_claims
    WHERE status NOT IN ('settled', 'cancelled')
      AND settled_amount IS NULL
      AND swipe_date <= CURRENT_DATE - INTERVAL '14 days'
  `)
  const claim = (claimRows as unknown as { rows: Array<{ cnt: number; total: string }> }).rows[0]
  if (claim && claim.cnt > 0) {
    alerts.push({
      type: "claim_unsettled",
      severity: "warn",
      title: "請款逾期未到帳",
      detail: `${claim.cnt} 筆請款已超過 ${SETTLE_OVERDUE_DAYS} 天未記錄到帳，請確認款項是否入帳`,
      count: claim.cnt,
      amount: Number(claim.total),
      link: "/card-claims",
    })
  }

  // 3. 應付排程到期/逾期（3 日內或已過）
  const schedRows = await db.execute<{ cnt: number; total: string; overdue: number }>(sql`
    SELECT COUNT(*)::int AS cnt,
           COALESCE(SUM(ps.scheduled_amount::numeric), 0)::text AS total,
           COUNT(*) FILTER (WHERE ps.scheduled_date < CURRENT_DATE)::int AS overdue
    FROM payment_schedules ps
    JOIN payment_items pi ON pi.id = ps.payment_item_id
    WHERE ps.status NOT IN ('completed', 'cancelled')
      AND pi.is_deleted = false
      AND ps.scheduled_date <= CURRENT_DATE + INTERVAL '3 days'
  `)
  const sched = (
    schedRows as unknown as { rows: Array<{ cnt: number; total: string; overdue: number }> }
  ).rows[0]
  if (sched && sched.cnt > 0) {
    alerts.push({
      type: "schedule_due",
      severity: sched.overdue > 0 ? "critical" : "warn",
      title: "付款排程到期",
      detail:
        sched.overdue > 0
          ? `${sched.overdue} 筆已逾期、共 ${sched.cnt} 筆 3 日內到期`
          : `${sched.cnt} 筆排程 3 日內到期`,
      count: sched.cnt,
      amount: Number(sched.total),
      link: "/payment-schedule",
    })
  }

  const order = { critical: 0, warn: 1, info: 2 }
  alerts.sort((a, b) => order[a.severity] - order[b.severity])
  return alerts
}
