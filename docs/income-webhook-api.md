# 進帳 Webhook API 規範

**版本**: v1.0
**日期**: 2026-02-18
**適用系統**: 浯島財務管理系統（Money）

---

## 概述

本系統提供統一的進帳 Webhook 接收端點，任何外部系統（自研平台、POS、金流服務）只需 POST 一個 JSON 到指定 URL，即可自動將收款資訊推送進來。

收到後由人工在「進帳收件箱」批次確認，確認後自動建立收入記錄。

---

## 接收端點

```
POST /api/income/webhook/:sourceKey
```

- `:sourceKey` 由管理員在後台設定，例如 `my-platform`、`pos-system`
- 此端點**不需 session 認證**，改用 Secret / Token 驗證
- 回傳 `200` 表示已收到（不論是否重複），**不會回傳 4xx 給外部系統**（防止探測）

---

## 驗證方式

依後台設定的 `authType` 而定：

### Bearer Token（推薦）

```http
Authorization: Bearer YOUR_SECRET_TOKEN
```

### HMAC-SHA256 簽名

```http
X-Signature: sha256=<hex_digest>
```

計算方式：

```
HMAC_SHA256(key=webhookSecret, message=rawRequestBody)
```

### 兩者皆需（最嚴格）

同時帶上 `Authorization` 與 `X-Signature` header。

---

## 請求格式

**Content-Type**: `application/json`

可以是**任意 JSON 結構**，系統透過「欄位對應設定」（JSONPath）自動解析。

### 最小範例（推薦自研系統使用此結構）

```json
{
  "transaction_id": "TXN_20260218_001",
  "amount": 5000,
  "currency": "TWD",
  "paid_at": "2026-02-18T14:30:00+08:00",
  "description": "訂金 - 2026年3月旅遊團",
  "payer_name": "王小明",
  "payer_contact": "0912345678",
  "order_id": "ORD-2026-0301"
}
```

### 欄位對應設定（在後台填寫 JSONPath）

| 系統欄位 | JSONPath 範例 | 說明 |
|---------|------------|------|
| 金額 | `$.amount` | **必填**，純數字 |
| 幣別 | `$.currency` | 選填，預設 TWD |
| 交易 ID | `$.transaction_id` | 防重複用，建議填寫 |
| 收款時間 | `$.paid_at` | ISO 8601 格式 |
| 說明 | `$.description` | 顯示在收件箱 |
| 付款方名稱 | `$.payer_name` | |
| 付款方聯絡 | `$.payer_contact` | email 或電話 |
| 訂單號 | `$.order_id` | |

支援多層路徑，例如：`$.transaction.amount`、`$.data.buyer.name`

---

## 回應格式

### 成功接收

```json
{
  "received": true,
  "id": 42
}
```

### 重複交易（已收過）

```json
{
  "received": true,
  "duplicate": true,
  "id": 38
}
```

### 驗證失敗

```http
HTTP 401

{
  "error": "Token 驗證失敗"
}
```

---

## 完整串接範例（Node.js）

```javascript
const crypto = require('crypto')

async function notifyIncome(data) {
  const payload = JSON.stringify(data)

  // 計算 HMAC（若使用 hmac 或 both 模式）
  const signature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')

  const response = await fetch('https://your-domain.com/api/income/webhook/my-platform', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.WEBHOOK_TOKEN}`,
      'X-Signature': `sha256=${signature}`,
    },
    body: payload,
  })

  const result = await response.json()
  console.log('推送結果：', result)
}

// 當有收款時呼叫
await notifyIncome({
  transaction_id: `TXN_${Date.now()}`,
  amount: 5000,
  currency: 'TWD',
  paid_at: new Date().toISOString(),
  description: '訂金 - 3月旅遊',
  payer_name: '王小明',
  order_id: 'ORD-2026-0301',
})
```

---

## 完整串接範例（Python）

```python
import hmac
import hashlib
import json
import requests
from datetime import datetime

WEBHOOK_URL = "https://your-domain.com/api/income/webhook/my-platform"
WEBHOOK_TOKEN = "your-secret-token"
WEBHOOK_SECRET = "your-hmac-secret"

def notify_income(data: dict):
    payload = json.dumps(data, ensure_ascii=False)

    # 計算 HMAC 簽名
    signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

    response = requests.post(
        WEBHOOK_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {WEBHOOK_TOKEN}",
            "X-Signature": f"sha256={signature}",
        }
    )
    return response.json()

# 呼叫
result = notify_income({
    "transaction_id": f"TXN_{int(datetime.now().timestamp())}",
    "amount": 5000,
    "currency": "TWD",
    "paid_at": datetime.now().isoformat(),
    "description": "訂金 - 3月旅遊",
    "payer_name": "王小明",
    "order_id": "ORD-2026-0301",
})
print(result)
```

---

## 管理 API（需登入）

以下 API 需要 session 認證（使用系統帳號登入後操作）。

### 來源管理

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/income/sources` | 列出所有來源 |
| GET | `/api/income/sources/:id` | 取得來源詳情 |
| POST | `/api/income/sources` | 新增來源 |
| PUT | `/api/income/sources/:id` | 更新來源 |
| DELETE | `/api/income/sources/:id` | 停用來源 |

### 進帳收件箱

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/income/webhooks` | 列出進帳紀錄（支援分頁、篩選） |
| GET | `/api/income/webhooks/pending-count` | 待確認筆數 |
| GET | `/api/income/webhooks/:id` | 取得單筆詳情 |
| POST | `/api/income/webhooks/:id/confirm` | 確認入帳 |
| POST | `/api/income/webhooks/batch-confirm` | 批次確認 |
| POST | `/api/income/webhooks/:id/reject` | 拒絕 |
| POST | `/api/income/webhooks/:id/reprocess` | 重新放回待確認 |

### 確認入帳請求格式

```json
POST /api/income/webhooks/42/confirm
{
  "projectId": 3,
  "categoryId": 5,
  "itemName": "旅遊訂金（可覆蓋預設名稱）",
  "reviewNote": "已核對銀行入帳"
}
```

### 批次確認請求格式

```json
POST /api/income/webhooks/batch-confirm
{
  "ids": [40, 41, 42, 43],
  "projectId": 3,
  "reviewNote": "2月份批次確認"
}
```

---

## 安全建議

1. **Token 長度**：建議 32+ 字元隨機字串
2. **定期輪換**：每季更換 Token 和 Secret
3. **IP 白名單**：在來源設定中填入外部系統的固定 IP
4. **HTTPS 必須**：正式環境必須使用 HTTPS，否則 Token 會明文傳輸
5. **防重複**：外部系統每筆交易帶唯一 `transaction_id`，系統自動去重

---

## 欄位對應快速範例

### 若你的系統回傳這種結構

```json
{
  "order": {
    "id": "ORD-001",
    "total": 3500,
    "created_at": "2026-02-18T10:00:00Z"
  },
  "customer": {
    "name": "陳大文"
  },
  "payment": {
    "tx_id": "PAY_ABC123",
    "note": "旅遊費用"
  }
}
```

### 則欄位對應設定如下

| 欄位 | JSONPath |
|------|---------|
| 金額 | `$.order.total` |
| 交易 ID | `$.payment.tx_id` |
| 收款時間 | `$.order.created_at` |
| 說明 | `$.payment.note` |
| 付款方名稱 | `$.customer.name` |
| 訂單號 | `$.order.id` |
