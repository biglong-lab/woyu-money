# 業務領域文件（domains/）

> 每個檔案是該領域的 single source of truth — 寫實作 / 改 schema 前先讀
> 寫不下時超過 800 行請拆子檔（依 audit 規範）

| 領域 | 主檔 | 涵蓋 |
|------|------|------|
| 付款 | [payment.md](payment.md) | payment_items / payment_records / 月付 / 分期 / 一般付款 |
| 家用 | [household.md](household.md) | household_budgets / expenses / incomes / templates |
| 親子 | [kids.md](kids.md) | family-kids（任務、零用金、三罐、徽章） |
| Webhook | [webhook.md](webhook.md) | PM bridge / PMS bridge / income_webhooks / integration_events |
| 租金 | [rental.md](rental.md) | rental_contracts / 月度矩陣 / 批次標記 |
| 預算 | [budget.md](budget.md) | budget_items / allocations / 月度預估 / 差異對賬 |
| 預測 | [forecast.md](forecast.md) | revenue_forecast_snapshots / pms-calibration / 沙盤推演 |

## 全域 ERD

[erd-overview.md](erd-overview.md) — 跨領域關鍵 FK 關係
