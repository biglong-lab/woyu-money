import { notificationSystem } from './notification-system';
import { storage } from './storage';

class NotificationScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.isRunning) {
      console.log('通知排程器已在運行中');
      return;
    }

    console.log('啟動通知排程器...');
    this.isRunning = true;

    // 立即執行一次
    this.generateNotifications();

    // 每小時執行一次
    this.intervalId = setInterval(() => {
      this.generateNotifications();
    }, 60 * 60 * 1000); // 1小時

    console.log('通知排程器已啟動，每小時自動檢查付款提醒');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('通知排程器已停止');
  }

  private async generateNotifications() {
    try {
      console.log('開始生成付款提醒通知...');
      const count = await notificationSystem.generatePaymentReminders();
      
      if (count > 0) {
        console.log(`成功生成 ${count} 個付款提醒通知`);
        
        // 可以在這裡添加其他通知方式，如LINE推送或Email
        await this.sendLineNotifications();
        await this.sendEmailNotifications();
      } else {
        console.log('沒有需要生成的付款提醒');
      }
    } catch (error) {
      console.error('生成通知時發生錯誤:', error);
    }
  }

  private async sendLineNotifications() {
    try {
      // 簡化版本：LINE通知系統準備就緒
      console.log('LINE通知系統準備就緒（外部服務配置待完成）');
    } catch (error) {
      console.error('發送LINE通知時發生錯誤:', error);
    }
  }

  private async sendEmailNotifications() {
    try {
      // Email通知功能準備就緒（外部SMTP服務配置待完成）
      console.log('Email通知系統準備就緒（外部SMTP服務配置待完成）');
      
      // 當SMTP配置完成後，可以取消註解以下代碼：
      // const usersWithEmailNotification = await storage.getUsersWithEmailNotificationEnabled();
      // for (const user of usersWithEmailNotification) {
      //   const unreadNotifications = await storage.getUserUnreadNotifications(user.id);
      //   if (unreadNotifications.length > 0) {
      //     console.log(`準備向用戶 ${user.email} 發送 ${unreadNotifications.length} 個Email通知`);
      //     // await this.sendEmailDigest(user.email, unreadNotifications);
      //   }
      // }
    } catch (error) {
      console.error('發送Email通知時發生錯誤:', error);
    }
  }

  // 手動觸發通知生成
  async triggerManualGeneration() {
    console.log('手動觸發通知生成...');
    await this.generateNotifications();
  }
}

export const notificationScheduler = new NotificationScheduler();