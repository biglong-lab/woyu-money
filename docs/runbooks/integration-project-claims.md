# Runbook：嫁接專案系統請款

> 用既有 expense webhook 框架，把「專案系統」的請款資料接進浯島財務做**彙整分析**。
> 設計原則同 PM bridge：**只接收、只彙整**，核銷與執行留在來源（專案）系統。

相關：完整對接契約見 [`docs/integration-api.md`](../integration-api.md)（§1、§2、支出端點）。

---

## 架構（與 PM bridge 一致）

```
專案系統（請款發生、核銷在此）
   │  POST /api/expense/webhook/project_claims
   ▼
expense_webhooks（待確認區）── 浯島只讀彙整、不回寫專案系統
   │  管理員在 /integrations 確認
   ▼
payment_items（待付）  ← webhookMode = as_pending
```

- **as_pending**：每筆請款建一筆「待付 payment_item」，浯島端只做付款規劃 / 成本彙整。
- 核銷、撥款、作廢等狀態變更**一律在專案系統操作**，不在浯島。浯島只是匯總視圖。

---

## 一次性設定（管理員，約 3 分鐘）

1. 進 `/integrations` →「支出來源」→「新增支出來源」。
2. 點最上方 **⚡ 套用「專案系統請款」樣板**，自動帶入：
   - `sourceName = 專案系統請款`、`sourceKey = project_claims`
   - `sourceType = pm_expense`、`webhookMode = as_pending`、`autoConfirm = false`
3. 視需要調整 `sourceKey`（URL 識別碼，僅小寫英數與底線）。
4. 選驗證方式並填憑證：
   - 建議 `token`（Bearer），API Token ≥ 16 字元；對外網路可用 `both`（Token+HMAC）。
5. （選填）設預設歸類 `defaultProjectId` / `defaultCategoryId`，省去每筆手動指定。
6. 儲存。把 `sourceKey` + 憑證透過安全管道交給專案系統對接方。

> autoConfirm 維持 **關閉**：請款先進待確認區、人工核對後再彙整，避免髒資料直接變應付款。

---

## 對接方推送格式（專案系統工程師）

```bash
curl -X POST https://money.homi.cc/api/expense/webhook/project_claims \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "CLAIM-2026-000123",   // 專案系統請款單號（去重用、必帶）
    "amount": 18500,
    "currency": "TWD",
    "description": "A 專案-設計外包請款",
    "dueAt": "2026-07-10",                    // 請款到期/期望付款日
    "vendor": "某設計工作室",
    "categoryHint": "外包",                    // 浯島端可據此建議分類
    "tags": ["專案A", "Q3"]
  }'
```

回應：
- `200 + { "received": true, "id": <n> }`：已收，進待確認區。
- `200 + { "received": true }`（無 id）：sourceKey 不存在（防探測），聯繫管理員。
- `4xx`：驗證失敗 / 欄位錯誤，見 body `error`。

> `transactionId` 必帶且唯一：同單號重送會標 `duplicate` 不重複建項目，專案系統可安全重試。

欄位對應（fieldMapping）若來源 JSON 結構不同，可在來源設定用 JSONPath 對應；
標準欄位見 `expenseFieldMappingSchema`（amount / transactionId / paidAt / dueAt / description / vendor / invoiceNumber / categoryHint / tags）。

---

## 日常操作（浯島端）

1. `/integrations` →「Webhook 紀錄」看 `pending` 請款。
2. 逐筆或批次「確認」→ 指定 `projectId`（+ 可選 `categoryId`）→ 生 `payment_items`（待付）。
3. 之後在「排程分配規劃台」「現金流決策中心」「固定開銷矩陣」等彙整分析。
4. 不符的請款「拒絕」，不影響專案系統（浯島單向）。

---

## 驗證對接成功

```bash
# 推一筆測試請款後，確認待確認區有資料
curl -s https://money.homi.cc/api/expense/webhooks?status=pending \
  -H "Cookie: <admin session>" | head
```

或直接 `/integrations` →「Webhook 紀錄」看到該 `transactionId` 即成功。

---

## 已知邊界

- 浯島**不回寫**專案系統：核銷狀態以專案系統為準，浯島僅彙整視圖。
- 幣別換算預設關閉（`defaultCurrency=TWD`）；跨幣需在來源開 `currencyConversionEnabled`。
- 大量推送請走批次或加 IP 白名單；webhook 接收端點已在認證豁免清單（靠 token/HMAC 驗證）。
