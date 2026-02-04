// 完整的通知系統實作
import { db } from "./db";
import { sql } from "drizzle-orm";

export interface NotificationData {
  userId: number;
  type: string;
  title: string;
  message: string;
  priority?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  actionUrl?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  readAt?: Date;
  expiresAt?: Date;
}

export class NotificationSystem {
  // 創建通知
  async createNotification(data: NotificationData): Promise<Notification> {
    try {
      const result = await db.execute(sql`
        INSERT INTO notifications (user_id, type, title, message, priority, action_url, metadata)
        VALUES (${data.userId}, ${data.type}, ${data.title}, ${data.message}, 
                ${data.priority || 'medium'}, ${data.actionUrl || null}, 
                ${JSON.stringify(data.metadata || {})})
        RETURNING *
      `);
      
      const row = result.rows[0];
      return {
        id: row.id as number,
        userId: row.user_id as number,
        type: row.type as string,
        title: row.title as string,
        message: row.message as string,
        priority: row.priority as string,
        isRead: row.is_read as boolean,
        actionUrl: row.action_url as string,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        createdAt: new Date(row.created_at as string),
        readAt: row.read_at ? new Date(row.read_at as string) : undefined,
        expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // 獲取用戶通知
  async getUserNotifications(userId: number, limit: number = 50): Promise<Notification[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM notifications 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      
      return result.rows.map(row => ({
        id: row.id as number,
        userId: row.user_id as number,
        type: row.type as string,
        title: row.title as string,
        message: row.message as string,
        priority: row.priority as string,
        isRead: row.is_read as boolean,
        actionUrl: row.action_url as string,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        createdAt: new Date(row.created_at as string),
        readAt: row.read_at ? new Date(row.read_at as string) : undefined,
        expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined
      }));
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  // 標記通知為已讀
  async markAsRead(notificationId: number): Promise<boolean> {
    try {
      await db.execute(sql`
        UPDATE notifications 
        SET is_read = true, read_at = NOW()
        WHERE id = ${notificationId}
      `);
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  // 標記所有通知為已讀
  async markAllAsRead(userId: number): Promise<boolean> {
    try {
      await db.execute(sql`
        UPDATE notifications 
        SET is_read = true, read_at = NOW()
        WHERE user_id = ${userId} AND is_read = false
      `);
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  // 獲取未讀通知數量
  async getUnreadCount(userId: number): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE user_id = ${userId} AND is_read = false
      `);
      
      return result.rows[0]?.count as number || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // 獲取通知設定
  async getNotificationSettings(userId: number): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM notification_settings 
        WHERE user_id = ${userId}
      `);
      
      if (result.rows.length === 0) {
        // 創建預設設定
        await db.execute(sql`
          INSERT INTO notification_settings (user_id) VALUES (${userId})
        `);
        return this.getDefaultSettings();
      }
      
      const row = result.rows[0];
      return {
        emailEnabled: row.email_enabled,
        lineEnabled: row.line_enabled,
        browserEnabled: row.browser_enabled,
        paymentDueReminder: row.payment_due_reminder,
        paymentOverdueAlert: row.payment_overdue_alert,
        systemUpdates: row.system_updates,
        weeklyReport: row.weekly_report,
        dailyDigestTime: row.daily_digest_time,
        weeklyReportDay: row.weekly_report_day,
        advanceWarningDays: row.advance_warning_days
      };
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      return this.getDefaultSettings();
    }
  }

  // 更新通知設定
  async updateNotificationSettings(userId: number, settings: any): Promise<boolean> {
    try {
      await db.execute(sql`
        UPDATE notification_settings SET
          email_enabled = ${settings.emailEnabled},
          line_enabled = ${settings.lineEnabled},
          browser_enabled = ${settings.browserEnabled},
          payment_due_reminder = ${settings.paymentDueReminder},
          payment_overdue_alert = ${settings.paymentOverdueAlert},
          system_updates = ${settings.systemUpdates},
          weekly_report = ${settings.weeklyReport},
          daily_digest_time = ${settings.dailyDigestTime},
          weekly_report_day = ${settings.weeklyReportDay},
          advance_warning_days = ${settings.advanceWarningDays},
          updated_at = NOW()
        WHERE user_id = ${userId}
      `);
      return true;
    } catch (error) {
      console.error('Error updating notification settings:', error);
      return false;
    }
  }

  // 生成付款提醒通知
  async generatePaymentReminders(): Promise<number> {
    try {
      let createdCount = 0;

      // 獲取一些付款項目進行測試通知生成
      const result = await db.execute(sql`
        SELECT id, item_name, total_amount 
        FROM payment_items 
        WHERE is_deleted = false 
        LIMIT 3
      `);

      console.log(`找到 ${result.rows.length} 個付款項目可生成通知`);

      // 為用戶ID=1創建測試通知
      for (const row of result.rows) {
        await this.createNotification({
          userId: 1,
          type: 'payment_reminder',
          title: '自動付款提醒',
          message: `項目 "${row.item_name}" 需要關注，金額 NT$ ${row.total_amount}`,
          priority: 'medium',
          metadata: { 
            paymentId: row.id, 
            generatedAt: new Date().toISOString(),
            autoGenerated: true
          }
        });
        createdCount++;
      }

      console.log(`成功生成 ${createdCount} 個付款提醒通知`);
      return createdCount;
    } catch (error) {
      console.error('Error generating payment reminders:', error);
      throw error;
    }
  }

  private getDefaultSettings() {
    return {
      emailEnabled: true,
      lineEnabled: false,
      browserEnabled: true,
      paymentDueReminder: true,
      paymentOverdueAlert: true,
      systemUpdates: false,
      weeklyReport: true,
      dailyDigestTime: '09:00',
      weeklyReportDay: 'monday',
      advanceWarningDays: 3
    };
  }
}

export const notificationSystem = new NotificationSystem();