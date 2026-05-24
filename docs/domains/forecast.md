# 預測領域

> 未來收支預估 + PMS 校準曲線 + 沙盤推演
> 主要 UI：`/forecast`（收入預測）、`/scenario`（沙盤推演）、`/cashflow-decision-center`

## 主要表

| 表 | 用途 |
|----|------|
| `revenue_forecast_snapshots` | 各日 snapshot（source: pm-bridge / pms-bridge） |
| 借用 PM `revenues` | PM 系統累計實際收入（4048 rows、2025-07~） |

## 核心邏輯

### PMS booked_revenue 雙語意（重要）

同欄位但兩種意思：
- **過去月**：full total（整月已實現總額）
- **本月**：unrealized remainder（剩餘未實現）

→ 圖表線 = booked + PM accumulated（保 monotonic 增長）

詳：[../changes/2026-05-24-data-accuracy-audit.md](../changes/2026-05-24-data-accuracy-audit.md)

### 資料源選擇

- **2026-02 以後** PM 用 `revenue_forecast_snapshots` 的 pm snapshot
- **2026-02 之前** PM 沒 snapshot、用 `payment_items` fallback（item_type='income' + source='webhook'）
- PMS 永遠用 `revenue_forecast_snapshots` source='pms-bridge'

### PMS 校準（pms-calibration.ts）

- 拿過去配對：PMS 預估 vs 實際 PM 收入
- 計算 ratio = actual / estimate
- 對應 `days_ahead_of_target` 算校準曲線（不同提前天數有不同準確度）
- JOIN `pm_company_mapping` 取代舊 CASE hardcoded

## 主要 endpoint

- `GET /api/forecast` — 未來收入預測
- `POST /api/scenario` — 沙盤推演（給條件試算）
- `GET /api/cashflow/forecast` — 3-6 月現金流

## 純函式 shared 模組

- [`shared/revenue-forecaster.ts`](../../shared/revenue-forecaster.ts)：歷史推算 + 缺口分析

## 相關文件

- changes：data-accuracy-audit、pm-company-mapping、financial-decision-helpers
