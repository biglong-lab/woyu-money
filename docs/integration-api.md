# 通用整合 API 規範（Integration API Spec）

**版本**: v2.0
**日期**: 2026-05-16
**適用系統**: 浯島財務管理系統（Money）
**取代**: `docs/income-webhook-api.md`（v1.0，僅含收入端）

---

## 0. 給對接方的快速 Onboarding

> 你是要把資料推進浯島財務管理系統的工程師 / AI 助手嗎？看這節 3 分鐘就懂。

1. **拿到 sourceKey 和憑證**：聯繫管理員，他會在系統建一筆「來源」設定，給你：
   - `sourceKey`（URL 識別碼，例：`pm_revenue`）
   - `apiToken` 或 `webhookSecret`（依驗證方式）
   - 你資料的「欄位對應規則」（fieldMapping，告訴系統怎麼從你 payload 抽欄位）
2. **找對端點**：
   - 推**收入** → `POST /api/income/webhook/{sourceKey}`
   - 推**支出 / 待付款項** → `POST /api/expense/webhook/{sourceKey}`
3. **加驗證 header**：
   - Token 模式：`Authorization: Bearer <apiToken>`
   - HMAC 模式：`X-Signature: sha256=<hex>`（用 webhookSecret 對 raw body 做 HMAC-SHA256）
   - Both 模式：兩者都加
4. **送 JSON**：依管理員給你的 fieldMapping，把對應欄位填入即可。**強烈建議帶 transactionId 防重複**。
5. **檢查回應**：
   - `200 + {"received": true, "id": N}` → 成功進待確認區
   - `200 + {"received": true, "duplicate": true}` → 已重複，不會重複建立
   - `200 + {"received": true}`（無 id）→ sourceKey 不存在（避免探測），請聯繫管理員
   - `401` → 驗證失敗，檢查 token / 簽章
6. **用「整合中心」測試**：管理員在 `/integrations` 頁面點「實際送一筆」按鈕，可在不需要你動手的情況下測試端點是否正常。

---

## 1. 兩個端點，一個架構

| 模組 | URL | 用途 | 進入後的歸宿 |
|------|-----|------|---------------|
| **收入** | `POST /api/income/webhook/:sourceKey` | PM 系統、POS、金流推進帳 | `income_webhooks`（待確認）→ 確認後生 `payment_records` 或對應 income 物件 |
| **支出** | `POST /api/expense/webhook/:sourceKey` | PM 系統、ERP、會計系統推支出 / 待付款 | `expense_webhooks`（待確認）→ 確認後生 `payment_items`（待付）或 `payment_records`（已付） |

兩個端點的**設計鏡像**：驗證方式、JSONPath 對應、防重複、回應格式都一致，差別只在欄位語義（payerName↔vendor、orderId↔invoiceNumber）。

---

## 2. 驗證方式（三選一）

每個來源在後台建立時設定 `authType`：

### 2.1 Bearer Token（authType=`token`）

```
Authorization: Bearer <apiToken>
```

- 簡單、適合內部信任系統
- Token 建議 ≥ 16 字元、隨機生成

### 2.2 HMAC-SHA256（authType=`hmac`）

```
X-Signature: sha256=<hex>
```

計算方式（Node.js）：

```js
const sig = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex")
// Header: X-Signature: sha256=<sig>
```

Python：

```python
import hmac, hashlib
sig = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
# Header: X-Signature: sha256={sig}
```

PHP：

```php
$sig = hash_hmac("sha256", $rawBody, $webhookSecret);
// Header: X-Signature: sha256={$sig}
```

curl 範例：

```bash
SECRET="my_secret"
BODY='{"amount":1000,"tx_id":"abc"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST https://money.homi.cc/api/expense/webhook/pm_expense \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=$SIG" \
  -d "$BODY"
```

- 不需公開 secret，適合對外開放
- 系統用 raw body 比對，所以**對接方傳送的 JSON 字串必須與計算簽章時的 byte-for-byte 一致**（不要 reformat）

### 2.3 雙重（authType=`both`）

`Authorization` 與 `X-Signature` 兩個 header 都必須提供且皆需通過。

### 2.4 IP 白名單（可選）

每個來源可設 `allowedIps` 陣列（例：`["1.2.3.4","10.0.0.0/24"]`）。空陣列表示不限制。

---

## 3. JSONPath 欄位對應（fieldMapping）

對接方的 payload 結構由對接方決定，後台用 **JSONPath** 抽出標準欄位。

### 3.1 收入端欄位

| 標準欄位 | 必要？ | 說明 |
|----------|-------|------|
| `amount` | ✅ 強烈建議 | 金額（數字） |
| `currency` | | 幣別 ISO 代碼（預設 TWD） |
| `transactionId` | ✅ 強烈建議 | 外部交易唯一 ID（防重複） |
| `paidAt` | | 付款時間（ISO 8601） |
| `description` | | 說明 / 摘要 |
| `payerName` | | 付款方名稱 |
| `payerContact` | | 付款方聯絡（email / 電話） |
| `orderId` | | 訂單號 |

### 3.2 支出端欄位

| 標準欄位 | 必要？ | 說明 |
|----------|-------|------|
| `amount` | ✅ 強烈建議 | 金額（數字） |
| `currency` | | 幣別 ISO 代碼（預設 TWD） |
| `transactionId` | ✅ 強烈建議 | 外部交易唯一 ID（防重複） |
| `paidAt` | | 付款時間（若已付） |
| `dueAt` | | 應付截止日（若未付） |
| `description` | | 說明 / 摘要 |
| `vendor` | | 廠商 / 供應商名稱 |
| `invoiceNumber` | | 發票 / 帳單號 |
| `categoryHint` | | 分類提示（文字，給系統 fuzzy match） |
| `tags` | | 標籤（陣列字串，會與 source 預設 tag 合併） |

### 3.3 JSONPath 範例

對接方 payload：

```json
{
  "transaction": {
    "id": "TX-12345",
    "amount": 1500,
    "currency": "TWD"
  },
  "completedAt": "2026-05-16T14:30:00+08:00",
  "supplier": { "name": "中華電信" }
}
```

對應的 fieldMapping（支出端）：

```json
{
  "amount": "$.transaction.amount",
  "currency": "$.transaction.currency",
  "transactionId": "$.transaction.id",
  "paidAt": "$.completedAt",
  "vendor": "$.supplier.name"
}
```

> 支援的語法：`$.a.b.c` / `$a.b.c` / `a.b.c`（不支援陣列下標、filter expression — 對接方需保證來源就是扁平結構或單層 nesting）

---

## 4. 設定模式（webhookMode，支出端專用）

| 模式 | 含義 | 自動建立 |
|------|------|---------|
| `as_pending`（預設） | 「我有一筆待付款」 | `payment_items`（status=pending） |
| `as_paid` | 「我已經扣款了，幫我記一筆」 | `payment_items` + `payment_records`（status=paid） |

需配合 `autoConfirm=true` 才會自動建立。否則一律進「待確認區」由人工檢視。

---

## 5. 防重複（Idempotency）

系統用 `(sourceId, externalTransactionId)` 組合做 UNIQUE constraint：
- 對接方多次推送同一個 `transactionId` 都會回 `{"received": true, "duplicate": true, "id": <原 ID>}`
- 強烈建議對接方務必傳 `transactionId`，否則無法防重（重啟重送 → 系統會建兩筆）

---

## 6. 回應格式

成功：
```json
{ "received": true, "id": 1234 }
```

重複：
```json
{ "received": true, "duplicate": true, "id": 1234 }
```

未知 sourceKey（避免探測）：
```json
{ "received": true }
```
（但 HTTP status 仍是 200）

驗證失敗：
```json
{ "error": "Token 驗證失敗" }
```
HTTP 401

---

## 7. 拋接紀錄與監控

系統有「整合中心」UI：`/integrations`（管理員可看）。

對接方可請管理員提供：
1. **24h 健康指標**：成功率 / 平均延遲 / 最後成功 / 最後失敗時間
2. **拋接歷史**：每一次 HTTP 請求的 raw payload、status code、結果、錯誤訊息
3. **Replay**：管理員可對失敗紀錄按鈕一鍵重送（不需對接方重做）
4. **Send Test Payload**：管理員可直接送一筆測試資料看是否正常

### 通用查詢 API（管理者用）

```
GET  /api/integrations/events?integrationType=expense&outcome=auth_failed&page=1
GET  /api/integrations/events/:id
GET  /api/integrations/sources/:type/:id/health
POST /api/integrations/sources/:type/:id/test       { executeForReal?: boolean }
POST /api/integrations/events/:id/replay
```

---

## 8. 對接 Checklist（給對接方逐項勾）

- [ ] 已從管理員取得 `sourceKey`、`apiToken` / `webhookSecret`、`fieldMapping` 確認
- [ ] payload 結構符合管理員給的 fieldMapping
- [ ] 每筆都帶 `transactionId`（防重複）
- [ ] HTTPS 連線（生產環境不可走 http）
- [ ] HMAC 模式：簽章是用 **raw byte body** 計算（非 pretty-print 後的字串）
- [ ] 處理 `200 + duplicate=true` 為「已處理過、不算錯」
- [ ] 處理 `200 + 無 id`（sourceKey 不存在）回報給管理員
- [ ] 失敗時實作重試機制（建議：1s / 5s / 30s 三階段 retry）
- [ ] 上線前請管理員在 `/integrations` 「實際送一筆」測試

---

## 9. 常見問題

### Q1：管理員建好設定後，多久能用？
立刻可用，沒有快取。

### Q2：可以同一個 sourceKey 同時推進帳和支出嗎？
不行。`income_sources.sourceKey` 與 `expense_sources.sourceKey` 各自獨立，但 URL 端點不同，避免衝突。

### Q3：HMAC 簽章不過怎麼除錯？
- 確認 secret 字串一致（沒多空白、沒換行）
- 確認 raw body 跟 send 出去的 byte-for-byte 一致
- 在 `/integrations` 看「拋接紀錄」會看到完整 request payload，可比對

### Q4：欄位對應規則建好之後想改怎麼辦？
管理員到 `/integrations` 編輯該 source 即可。**已收進來的紀錄不會重新解析**，新規則只影響未來進來的。

### Q5：可不可以做反向通知（我們→對接方）？
v2.0 暫不支援出站 webhook。若有需求請告知，會排進下一版規劃。

---

## 10. 完整 Node.js 串接範例（支出端）

```js
import crypto from "crypto"

const SOURCE_KEY = "pm_expense"
const SECRET = process.env.WEBHOOK_SECRET
const TOKEN = process.env.WEBHOOK_TOKEN
const ENDPOINT = `https://money.homi.cc/api/expense/webhook/${SOURCE_KEY}`

async function pushExpense(expense) {
  const payload = {
    tx_id: expense.id,           // 必要：防重複
    amount: expense.amount,
    currency: "TWD",
    vendor: expense.vendor,
    invoice: expense.invoiceNumber,
    due_date: expense.dueAt,
    notes: expense.description,
  }

  const rawBody = JSON.stringify(payload)
  const sig = crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex")

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TOKEN}`,    // authType=both 時加
      "X-Signature": `sha256=${sig}`,
    },
    body: rawBody,
  })

  const data = await res.json()
  if (data.duplicate) {
    console.log(`✓ 已存在（系統 ID ${data.id}），不重複建立`)
    return
  }
  if (!res.ok) {
    console.error(`✗ 推送失敗:`, data.error)
    // TODO: 重試 / 通知對接者
    return
  }
  console.log(`✓ 已送入待確認區（系統 ID ${data.id}）`)
}
```

---

## 11. OpenAPI Spec

完整 OpenAPI 3.0 spec 見：[`docs/openapi.yaml`](openapi.yaml)

可導入：
- **Swagger UI**：互動式 API explorer
- **Postman**：自動生成 collection
- **openapi-generator**：自動產 client SDK（Node/Python/Java/...）

---

## 12. 變更歷史

| 版本 | 日期 | 變更 |
|------|------|------|
| v1.0 | 2026-02-18 | 初版（僅收入端） |
| v2.0 | 2026-05-16 | 擴展為通用 integration spec（含支出端、通用拋接紀錄、Replay、Test Payload）|

---

## 13. 相關文件

- 變動紀錄：[`docs/changes/2026-05-16-integration-api-spec.md`](changes/2026-05-16-integration-api-spec.md)
- 部署 SOP：[`docs/runbooks/deploy.md`](runbooks/deploy.md)
- DB Schema 同步：[`docs/runbooks/db-migration.md`](runbooks/db-migration.md)
