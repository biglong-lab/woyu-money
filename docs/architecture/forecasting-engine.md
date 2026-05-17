# 營運預測引擎 — 架構藍圖

> 從「會計記錄工具」升級為「未來預測 + 沙盤推演」工具
> 狀態：規劃中
> 日期：2026-05-18

## 核心願景

> 「**會計往往是過去的事實；營運更重要的是透過紀錄推演未來**」 — 使用者原話

紀錄資訊不只是統計，更要能：
- **分析、調整、預估、優化**
- **動態模擬可能情境**
- **提前 60 天知道資金狀況**，可加碼推進或預警調整
- **150 萬月收入模型長怎樣？** 從歷史資料反推營運參數

---

## 5 階段 Roadmap

### Phase 0 — 週期性支出可設定（眼前痛點，1 天可做完）

**問題**：目前 `recurring-expense-scheduler.ts` 邏輯硬編寫於程式碼，使用者沒法設定。

**解法**：
- 新表 `recurring_expense_templates`
  ```ts
  {
    id, templateName, projectId, categoryId, fixedCategoryId,
    estimatedAmount,        // 估算金額（可隨時改）
    dayOfMonth,             // 每月幾號到期
    activeMonths,           // ['*'] 或 [3,6,9,12] 季度
    isActive, notes,
    lastGeneratedMonth,     // YYYY-MM
    createdAt, updatedAt
  }
  ```
- UI：`/recurring-expenses` 管理頁
  - CRUD 模板
  - 「立即產出當月」按鈕（不用等 1 號）
  - 「跳過下月」開關
- Scheduler 改用 templates 表，不再依歷史平均推算

### Phase 1 — 預測資料快照收集（建設地基）

**核心概念**：每日對「本月、下月、下下月」拍快照，累積 1-2 年後建模型。

**新表**：`revenue_forecast_snapshots`
```ts
{
  id,
  snapshotDate,          // YYYY-MM-DD 拍快照那天
  companyId,             // PM 公司 ID（哪家館）
  targetMonth,           // YYYY-MM 預測目標月
  daysAheadOfTarget,     // 距離目標月底還幾天
  accumulatedRevenue,    // 當下該月累積已實現收入
  bookedRevenue,         // 未來預訂金額（如 PMS 提供）
  source,                // pm-snapshot / pms-bridge / manual
  createdAt
}
```

**資料來源**：
1. **PM `daily_revenue_snapshots`**（已存在 339 筆，2026-02 起）→ 每日已實現
2. **PMS 系統未來預訂**（待對接、使用者 https://pms.homi.cc）
3. **手動輸入**（使用者可隨時 push 一筆預估）

**Cron**：每日台北 23:00 跑
- 對每家館 + 本月/下月/下下月 各拍 1 筆快照
- 累積資料

### Phase 2 — 預測模型（資料夠後）

**Linear 預測（基準版）**：
```
給定當前日期 D、本月累積已實現 R、本月剩餘天數 N
查歷史相同 D（同期）的最終實現 vs 累積比率 K
本月預測 = R + (R / D前累積) × (D後實際 / D前實際) × N
```

**進階模型**：
- 季節性調整（暑假、過年、假日季）
- 渠道 mix 變化偵測
- 行銷活動效應分析

**輸出**：
- 點估計 + 信心區間（80%、95%）
- 比較「上個月同期累積 / 上上月同期累積」走勢

### Phase 3 — 沙盤推演 UI

**場景模擬器**：
- 「假設行銷預算 +20% → 預估收入 / 利潤」
- 「假設取消 XX 固定支出 → 現金流」
- 「假設 OTA 價格 +5% → 占房率 -8% → 淨收入」
- 滑桿即時調參、結果即時更新

### Phase 4 — 智慧資金調度

結合：預測收入 + 已知固定支出 + 估算支出
- 提前 60 天 / 30 天 / 7 天分級警示
  - 🔴 資金不足 — 該標的需提前募集
  - 🟡 緊張 — 該停止可選支出
  - 🟢 寬裕 — 可加碼行銷或投資
- 自動建議行銷預算（依預測 vs 目標差距）
- 整合通知系統 / LINE Bot 推送

---

## 立刻能做的

| 階段 | 子任務 | 可獨立完成 |
|---|---|:-:|
| Phase 0 | 建表 + UI + scheduler 改造 | ✅ |
| Phase 1a | 建 revenue_forecast_snapshots 表 | ✅ |
| Phase 1b | 每日 cron 從 PM daily_revenue_snapshots 拉本月+下月+下下月 | ✅ |
| Phase 1c | 對接 PMS https://pms.homi.cc | ⚠️ 需 PMS 端配合 |
| Phase 1d | 手動 push 預估 API + UI | ✅ |
| Phase 2 | 預測引擎 | 需 Phase 1 累積資料 3+ 個月 |
| Phase 3 | 沙盤推演 UI | 需 Phase 2 |
| Phase 4 | 智慧建議 | 需 Phase 3 |

## 為什麼這樣設計

1. **快照優於聚合**：每天拍照 + 不可變（append-only），未來想做任何分析都能反查；如果直接算「當下預估」、明天就被覆蓋、沒法回溯。
2. **目標月 × 快照日 的矩陣**：可以畫「離月底 N 天 vs 最終實現 / 當下累積」的散布圖，這是預測模型的基礎。
3. **多 source 統一表**：PM / PMS / 使用者手動 / OTA 平台、全部統一進 forecast_snapshots，比較容易做混合預測。
4. **預估值與實際值分離**：實際收入仍走 `payment_items`（webhook 已上線），forecast 是預測 layer，不互干擾。

## 預期效益

- **資金調度**：提前 2 個月知道下下月可能短缺、可預先安排借貸或調整支出
- **行銷投放決策**：若 1/11 看下月累積已超過上月同期 30%、可放心減少行銷預算；若落後、加碼推
- **季節性掌握**：暑假、過年的「N 天前累積比例」差很大，模型自動學
- **多館比較**：哪一家館預訂走勢最快、哪家落後

---

## 相關文件

- 既有支出 scheduler：[`server/recurring-expense-scheduler.ts`](../../server/recurring-expense-scheduler.ts)
- 既有 PM 對接：[`docs/integration-api.md`](../integration-api.md)
- 全盤點報告：[`docs/changes/2026-05-17-financial-coverage-overhaul.md`](../changes/2026-05-17-financial-coverage-overhaul.md)
