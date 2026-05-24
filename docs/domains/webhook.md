# Webhook / 整合領域

> 外部系統把資料推進本系統 — PM、PMS、一般支出 webhook
> 共用基礎：`integration_events` 通用拋接 log

## 主要表

| 表 | 用途 |
|----|------|
| `integration_events` | 通用拋接 log（所有 webhook 都進這） |
| `income_sources` | 收入來源定義（pm-bridge、pms-bridge） |
| `income_webhooks` | 收入 webhook 紀錄、parsed 結果 |
| `expense_sources` | 支出來源定義（外部對接 partner） |
| `expense_webhooks` | 支出 webhook 紀錄 |
| `integration_api_keys` | partner API key + scope |

## 主要 endpoint

- `POST /api/income-webhook/:sourceKey` — 收入推送（pm-bridge / pms-bridge）
- `POST /api/expense/webhook/:sourceKey` — 支出推送
- `/integrations` — 管理 UI（含 Test/Replay）

## 兩種運作模式

- `as_pending`：建 payment_items（待付）
- `as_paid`：建 payment_items + payment_records（已付）

## PM bridge 特殊處理

- PM company_id ↔ project_id 對應走 `pm_company_mapping` 表（[改寫紀錄](../changes/2026-05-24-pm-company-mapping-table.md)）
- PM webhook 進來 status 預設 `confirmed`（不需逐筆人工確認、2026-04 改）
- 校準曲線 pms-calibration 用同一張表 JOIN

## 規範文件

- [../integration-api.md](../integration-api.md) — 對接規範 v2.0
- [../openapi.yaml](../openapi.yaml) — OpenAPI 定義

## 已知地雷

- `router.use(requireAuth)` 不能掛在 root path（會擋 SPA fallback） — 2026-05-16 hotfix
- webhook 端點必須在 auth middleware 豁免清單
