# 通用 API 整合嫁接規範 — 2026-05-16

> 範圍：integration_events 通用 log 表、expense webhook 全套、整合中心 UI、串接測試工具、規範文件 v2.0
> 狀態：✅ 已部署
> 部署 commit：待 push
> 總工時：實際約 4-5 小時（規劃預估 28-40h，因有 income 框架可複用、UI 採務實版）

---

## 背景

使用者反映：「我需要一個 API 規範，提供其他系統來跟我們嫁接 — 收入（PM 每天收入、POS）、支出（待付款項目）。需要規範文件給對接人或 AI 看、整合設定 UI、串接測試、拋接資訊紀錄。」

盤點現況發現：
- **收入端 90% 已實作**：`income_sources` + `income_webhooks` 表、HMAC/Token 雙驗證、JSONPath 對應、人工確認流程、`docs/income-webhook-api.md` v1.0
- **支出端 0%**：`payment_items.source` 預留 "manual" 但無 webhook 機制
- **拋接紀錄分散**：income 端記在 `income_webhooks`，缺通用查詢
- **無串接測試**：對接方上線前無法用 UI 測試

---

## 設計決策（4 個選項，使用者選 C/A/B/B）

| 維度 | 選擇 | 理由 |
|------|------|------|
| 資料表架構 | **C. 混合** | income 既有資料不動，新建 expense 對稱表，**共用 `integration_events` 通用 log** |
| 雙向範圍 | **A. 只做入站** | 先穩定收進來的功能，出站留下版 |
| 規範文件 | **B. md + OpenAPI** | 升級 `integration-api.md` v2.0 + `openapi.yaml` |
| 測試深度 | **B. Test Payload Generator** | UI 可產含正確簽章的 sample payload + Replay |

---

## 5 Phase 實作

### Phase 1：`integration_events` 通用拋接紀錄表

- 新建 `shared/schema/integration.ts`：通用 events 表（跨 income/expense）
  - 欄位：`integrationType`、`sourceId`、`sourceKey`、`direction`、`httpMethod`、`statusCode`、`requestPayload`、`responseBody`、`outcome`、`errorMessage`、`latencyMs`、`attempt`、`parentEventId`、`linkedWebhookId`、`requestIp`
  - 4 個 index：(type, source)、outcome、createdAt、direction
- 新建 `server/storage/integration-events.ts`：`logEvent` / `queryEvents` / `getSourceHealth` / `getEventById`
- 新建 `server/routes/integrations.ts`：`GET /api/integrations/events` + `GET .../health`
- 改 `server/routes/income.ts`：webhook 處理完寫入 events（保留 income_webhooks 業務狀態）
- drizzle-kit push 套用

### Phase 2：expense webhook 端（鏡像 income）

- 新建 `shared/schema/expense.ts`：`expense_sources` + `expense_webhooks`，**差異欄位**：
  - `webhookMode`（as_pending / as_paid）
  - `parsedVendor`、`parsedInvoiceNumber`、`parsedCategoryHint`、`parsedTags`
  - `defaultVendor`、`defaultTags`
- 新建 `server/storage/expense-webhooks.ts`：`receiveExpenseWebhook` + helpers
  - 複用 income 的 `verifyHmacSignature` / `verifyBearerToken` / `verifyIpAllowlist`
  - `parseExpensePayload` 支援 vendor / invoiceNumber / categoryHint / tags / dueAt
  - `autoConfirm` + `webhookMode=as_paid`：自動建 payment_items + payment_records
  - `autoConfirm` + `webhookMode=as_pending`：自動建 payment_items（pending）
- 新建 `server/routes/expense.ts`：完整 CRUD + webhook + 對帳列表
- 改 `server/routes/index.ts`：webhook 路徑豁免清單加 `/expense/webhook/`
- 新測試 `tests/integration/expense-webhook.test.ts`：9 個測試覆蓋 CRUD、token 驗證、HMAC、idempotency

### Phase 3：整合中心 UI `/integrations`

- 新建 `client/src/pages/integrations-center.tsx`：含 3 個 tab
  - **進帳來源**：列出既有 sources、健康指標卡片、跳轉到既有 `/income/sources` 詳細編輯
  - **支出來源**：列出、健康指標、「+ 新增支出來源」inline dialog
  - **拋接紀錄**：表格 + 篩選（類型 / outcome）+ 分頁 + Replay 按鈕
- 每張 source 卡：24h 總數 / 成功率（含顏色） / 平均延遲 / 最後失敗時間 / 「產生測試 payload」+「實際送一筆」按鈕
- 加入 navigation `systemNavItems`（系統管理區）
- 加 breadcrumb config

### Phase 4：測試工具（已併入 Phase 1 integrations.ts）

- `POST /api/integrations/sources/:type/:id/test`：依 fieldMapping 自動產 sample payload + 正確簽章 + curl 指令；可選實際執行
- `POST /api/integrations/events/:id/replay`：用原 payload 重新送、新 event 連到原 event（parentEventId）

### Phase 5：規範文件 + OpenAPI

- 新建 `docs/integration-api.md` v2.0（含 Onboarding、雙端點、3 種驗證、JSONPath、Idempotency、Test/Replay、Checklist、Node.js 串接範例）
- 新建 `docs/openapi.yaml`（OpenAPI 3.0 spec，可導入 Swagger UI / Postman / openapi-generator）
- 保留 v1.0 `docs/income-webhook-api.md`（v2.0 文件聲明取代它）

---

## 影響範圍

| 檔案類型 | 新建 | 修改 |
|----------|------|------|
| Schema | `shared/schema/integration.ts`、`shared/schema/expense.ts` | `shared/schema/index.ts` |
| Storage | `server/storage/integration-events.ts`、`server/storage/expense-webhooks.ts` | `server/routes/income.ts`（加 logEvent）|
| Routes | `server/routes/integrations.ts`、`server/routes/expense.ts` | `server/routes/index.ts`（掛載 + webhook 豁免）|
| UI | `client/src/pages/integrations-center.tsx` | `client/src/App.tsx`、`client/src/config/navigation.ts` |
| Tests | `tests/integration/expense-webhook.test.ts` | — |
| Docs | `docs/integration-api.md`、`docs/openapi.yaml`、`docs/changes/2026-05-16-*.md` | `CHANGELOG.md` |
| DB | 新表 `integration_events`、`expense_sources`、`expense_webhooks` | — |

---

## 驗證

| 項目 | 結果 |
|------|------|
| `npx tsc --noEmit` | 0 errors |
| Expense webhook 測試 | 9/9 全綠 |
| drizzle-kit push（3 張新表）| 成功套用 |

---

## 已知限制 / Follow-up

- **出站 webhook**：暫不實作（使用者選 A）。下版可加 `outbound_webhooks` config + retry queue
- **欄位對應視覺編輯器**：本版用 JSON 文字框，未來可做 drag-drop visual editor
- **events 表 retention**：未實作自動歸檔，10 source × 100 筆/天 × 365 天 = 36 萬筆/年，建議 90 天後 archive 到冷儲存
- **getValueByPath 重複實作**：income.ts 與 expense-webhooks.ts 各有一份，未來抽 `server/services/webhook-utils.ts` 共用
- **Sandbox 環境**：暫不實作（使用者選 B 而非 C）。下版可加 `source.environment` 欄位區分 production / sandbox

---

## 給對接方（重要）

新對接系統前請先讀：[`docs/integration-api.md`](../integration-api.md)

關鍵改變（vs v1.0）：
- 收入端 URL 與 v1.0 完全相容，**無 breaking change**
- 新增 `/api/expense/webhook/:sourceKey` 端點
- 拋接紀錄整合到 `/integrations` 統一檢視（取代分散的 `/income/inbox`）

---

## 相關文件

- 完整規範：[`docs/integration-api.md`](../integration-api.md)
- OpenAPI Spec：[`docs/openapi.yaml`](../openapi.yaml)
- v1.0 舊規範（保留）：[`docs/income-webhook-api.md`](../income-webhook-api.md)
- 部署 SOP：[`docs/runbooks/deploy.md`](../runbooks/deploy.md)
