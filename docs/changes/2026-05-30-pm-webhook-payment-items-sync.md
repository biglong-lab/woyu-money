# PM webhook 沒建 payment_items 的 bug + backfill — 2026-05-30

> 範圍：server/storage/pm-bridge.ts + income.ts + migration backfill
> 狀態：已上線
> 部署 commit：由部署時補

## 背景

用戶反映：收入預測頁顯示 PM 累積 $1,382,415（2026-05-30）、財務綜合儀表板 2026-05 收入只 ~$866K。差距 ~$500K。

## 根因

`server/storage/pm-bridge.ts:230` 同步 PM 資料時、直接 `db.insert(incomeWebhooks)`、繞過 `processWebhook()`、結果：
- ❌ 沒呼叫 `_createPaymentFromWebhook()`
- ❌ payment_items / payment_records 不會建
- ✅ income_webhooks 表有資料（收入預測頁用）

Dashboard 用 payment_items 算收入、導致顯示缺漏。

## 影響範圍

- 2026-04：$90K 缺
- 2026-05：$632K 缺（截至 5/30、265 筆）
- 5/17 起完全沒同步（payment_items.start_date 最後只到 5/16）

## 修法

1. `server/storage/income.ts` — export `_createPaymentFromWebhook`
2. `server/storage/pm-bridge.ts` — INSERT incomeWebhooks 後立即用 pm_company_mapping 查 project_id、呼叫 `_createPaymentFromWebhook()`
3. `migrations/0015_backfill_pm_webhook_payment_items.sql` — backfill 既有缺漏

## 驗證

- 生產 DRY RUN：265 筆 $632,686 待補
- backfill 後 2026-05 payment_items income webhook 應達 ~$1,383K、對齊收入預測頁 PM 累積

## 相關文件

- [Phase 4 PM mapping 表](2026-05-24-pm-company-mapping-table.md)
- [財務助理整合](2026-05-24-system-architecture-audit.md)
