/**
 * 週期性支出 + 收入預測 scheduler
 *
 * 兩個工作：
 *  1. 每月 1-3 號台北時間 9:00 自動產出 unpaid payment_items（依 recurring_expense_templates）
 *  2. 每日台北時間 23:00 對「本月/下月/下下月」拍 forecast snapshot
 *
 * 每 6 小時檢查（容錯）
 */
import { generateItemsForMonth } from "./storage/recurring-expense-templates"
import { captureFromPM } from "./storage/forecast-snapshots"
import { syncFromPMS } from "./storage/pms-forecast-sync"
import { log } from "./vite"

class RecurringExpenseScheduler {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private lastGeneratedMonth: string | null = null
  private lastSnapshotDate: string | null = null

  start() {
    if (this.isRunning) return
    this.isRunning = true

    // 啟動時跑一次
    this.tick()

    // 每 6 小時檢查
    this.intervalId = setInterval(() => this.tick(), 6 * 60 * 60 * 1000)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
  }

  private async tick() {
    await this.checkMonthlyGeneration()
    await this.checkDailySnapshot()
    await this.checkPmsSync()
  }

  /** 每日從 PMS pull performance_entries（不定期填入的 N 個月預估）*/
  private async checkPmsSync() {
    try {
      const tpe = new Date(Date.now() + 8 * 60 * 60 * 1000)
      const today = tpe.toISOString().slice(0, 10)
      // 用獨立 flag 避免和 forecast snapshot 共用 lastSnapshotDate
      if ((this as unknown as { lastPmsSyncDate?: string }).lastPmsSyncDate === today) return

      const result = await syncFromPMS(14) // 拉最近 14 天（防 PMS 補填）
      ;(this as unknown as { lastPmsSyncDate?: string }).lastPmsSyncDate = today
      if (result.ok) {
        log(`pms sync ${today}: 新增 ${result.inserted}、更新 ${result.skipped}`)
      } else {
        log(`pms sync ${today} 失敗: ${result.error}`)
      }
    } catch (err) {
      console.error("[RecurringExpenseScheduler] pms sync 失敗:", err)
    }
  }

  /** 每月 1-3 號跑當月產出（依 templates）*/
  private async checkMonthlyGeneration() {
    try {
      const tpe = new Date(Date.now() + 8 * 60 * 60 * 1000)
      const day = tpe.getUTCDate()
      const month = tpe.toISOString().slice(0, 7)

      if (day > 3) return
      if (this.lastGeneratedMonth === month) return

      const result = await generateItemsForMonth(month)
      this.lastGeneratedMonth = month
      log(
        `recurring-expense ${month} 產出 ${result.generated.length} 筆、跳過 ${result.skipped.length}`
      )
    } catch (err) {
      console.error("[RecurringExpenseScheduler] monthly gen 失敗:", err)
    }
  }

  /** 每日拍 forecast snapshot（同日不重複）*/
  private async checkDailySnapshot() {
    try {
      const tpe = new Date(Date.now() + 8 * 60 * 60 * 1000)
      const today = tpe.toISOString().slice(0, 10)

      if (this.lastSnapshotDate === today) return

      const result = await captureFromPM()
      this.lastSnapshotDate = today
      if (result.ok) {
        log(`forecast capture ${today}: 新增 ${result.inserted}、跳過 ${result.skipped}`)
      } else {
        log(`forecast capture ${today} 失敗: ${result.error}`)
      }
    } catch (err) {
      console.error("[RecurringExpenseScheduler] daily snapshot 失敗:", err)
    }
  }

  /** 對外暴露：手動觸發 */
  async generateNow(targetMonth: string) {
    return generateItemsForMonth(targetMonth)
  }

  async captureNow() {
    return captureFromPM()
  }
}

export const recurringExpenseScheduler = new RecurringExpenseScheduler()
