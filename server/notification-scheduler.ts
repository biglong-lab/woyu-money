import { notificationSystem } from "./notification-system"

import { broadcastPush } from "./storage/push-subscriptions"
import { db } from "./db"
import { paymentItems } from "@shared/schema"
import { and, eq, lte, gte, sql } from "drizzle-orm"
import { getTodayReminderStatusWith, fetchUnpaidFromDb } from "./services/late-fee.service"
import {
  getUserUnreadNotifications,
  getUsersWithEmailNotificationEnabled,
} from "./storage/notifications"

class NotificationScheduler {
  private intervalId: NodeJS.Timeout | null = null
  private pushIntervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private lastPushDate: string | null = null // 防同一天重複推送

  start() {
    if (this.isRunning) {
      return
    }

    this.isRunning = true

    // 立即執行一次
    this.generateNotifications()
    this.checkAndSendDuePush()

    // 每小時執行一次（in-app notifications）
    this.intervalId = setInterval(
      () => {
        this.generateNotifications()
      },
      60 * 60 * 1000
    ) // 1小時

    // 每 30 分鐘檢查一次「是否該送每日 push」（只在固定時段 fire）
    this.pushIntervalId = setInterval(
      () => {
        this.checkAndSendDuePush()
      },
      30 * 60 * 1000
    )
  }

  /**
   * 每日推播提醒（接近到期的付款）
   * - 固定每天早上 9 點台北時間 fire 一次
   * - 撈未來 7 天內到期且未付的項目
   * - 用 broadcastPush 推給所有訂閱者（不分 user，因為通常單戶使用）
   * - 同日內不重複推送（用 lastPushDate）
   */
  private async checkAndSendDuePush() {
    try {
      const now = new Date()
      // 台北時間（UTC+8）
      const tpe = new Date(now.getTime() + 8 * 60 * 60 * 1000)
      const hour = tpe.getUTCHours()
      const today = tpe.toISOString().split("T")[0]

      // 只在台北 9-10 點 fire（避免半夜送通知）
      if (hour < 9 || hour > 10) return
      // 同一天不重複
      if (this.lastPushDate === today) return

      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]
      const todayStr = now.toISOString().split("T")[0]

      // 撈 7 天內到期且未付的項目（用 end_date 當到期日）
      const dueItems = await db
        .select({
          id: paymentItems.id,
          itemName: paymentItems.itemName,
          totalAmount: paymentItems.totalAmount,
          paidAmount: paymentItems.paidAmount,
          endDate: paymentItems.endDate,
        })
        .from(paymentItems)
        .where(
          and(
            eq(paymentItems.isDeleted, false),
            sql`${paymentItems.status} IN ('unpaid', 'partial', 'pending')`,
            sql`${paymentItems.endDate} IS NOT NULL`,
            gte(paymentItems.endDate, todayStr),
            lte(paymentItems.endDate, sevenDaysLater)
          )
        )
        .limit(20)

      if (dueItems.length === 0) {
        this.lastPushDate = today
        return
      }

      // 構造摘要訊息
      const totalUnpaid = dueItems.reduce((sum, it) => {
        const remaining = parseFloat(it.totalAmount) - parseFloat(it.paidAmount || "0")
        return sum + (remaining > 0 ? remaining : 0)
      }, 0)
      const firstItem = dueItems[0]
      const moreCount = dueItems.length - 1

      const body =
        dueItems.length === 1
          ? `「${firstItem.itemName}」$${Math.round(parseFloat(firstItem.totalAmount)).toLocaleString()}，${firstItem.endDate} 到期`
          : `${dueItems.length} 筆待付（含「${firstItem.itemName}」+${moreCount} 筆）共 $${Math.round(totalUnpaid).toLocaleString()}`

      const result = await broadcastPush({
        title: `🔔 ${dueItems.length === 1 ? "1 筆" : `${dueItems.length} 筆`} 7 天內到期`,
        body,
        url: "/",
        tag: "daily-due-reminder",
      })

      console.info(`[push] 每日到期提醒：${result.sent} 成功 / ${result.failed} 失敗`)

      // 同時：勞健保滯納警示（每月 20/25/28 觸發）
      await this.sendLaborInsurancePushIfNeeded()

      this.lastPushDate = today
    } catch (err) {
      console.error("[push] 每日提醒失敗:", err)
    }
  }

  /**
   * 勞健保滯納警示推播
   * - 每月 20 號（提醒）/ 25 號（警告）/ 28 號（緊急）
   * - 用 late-fee.service 的 reminderLevel + items
   */
  private async sendLaborInsurancePushIfNeeded() {
    try {
      const status = await getTodayReminderStatusWith(fetchUnpaidFromDb)
      if (!status.shouldRemind || status.pendingCount === 0) return

      const levelEmoji = status.level === "final" ? "🚨" : status.level === "warning" ? "⚠️" : "🔔"
      const levelLabel =
        status.level === "final" ? "最終警告" : status.level === "warning" ? "警告" : "提醒"

      const result = await broadcastPush({
        title: `${levelEmoji} 勞健保${levelLabel} — ${status.pendingCount} 筆未付`,
        body: `共 $${Math.round(status.pendingTotalAmount).toLocaleString()} 應付，預估滯納金已累積 $${Math.round(status.pendingTotalLateFee).toLocaleString()}`,
        url: "/labor-insurance-watch",
        tag: "labor-insurance-alert",
      })

      console.info(
        `[push] 勞健保 ${status.level} 警示：${result.sent} 成功 / ${result.failed} 失敗`
      )
    } catch (err) {
      console.error("[push] 勞健保警示失敗:", err)
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    if (this.pushIntervalId) {
      clearInterval(this.pushIntervalId)
      this.pushIntervalId = null
    }
    this.isRunning = false
  }

  private async generateNotifications() {
    try {
      const count = await notificationSystem.generatePaymentReminders()

      if (count > 0) {
        // 可以在這裡添加其他通知方式，如LINE推送或Email
        await this.sendLineNotifications()
        await this.sendEmailNotifications()
      }
    } catch (error) {
      console.error("生成通知時發生錯誤:", error)
    }
  }

  private async sendLineNotifications() {
    try {
      // 簡化版本：LINE通知系統準備就緒
    } catch (error) {
      console.error("發送LINE通知時發生錯誤:", error)
    }
  }

  private async sendEmailNotifications() {
    try {
      // Email通知功能準備就緒（外部SMTP服務配置待完成）
      // 當SMTP配置完成後，可以取消註解以下代碼：
      // const usersWithEmailNotification = await getUsersWithEmailNotificationEnabled();
      // for (const user of usersWithEmailNotification) {
      //   const unreadNotifications = await getUserUnreadNotifications(user.id);
      //   if (unreadNotifications.length > 0) {
      //     await this.sendEmailDigest(user.email, unreadNotifications);
      //   }
      // }
    } catch (error) {
      console.error("發送Email通知時發生錯誤:", error)
    }
  }

  // 手動觸發通知生成
  async triggerManualGeneration() {
    await this.generateNotifications()
  }
}

export const notificationScheduler = new NotificationScheduler()
