# API Types 使用指南

## ⚠️ 重要說明

這是一個**初始版本**的 API 類型系統，旨在逐步替代 `any` 類型。當前實現提供了基本的類型安全，但仍需進一步完善。

**已知限制：**
- 類型定義基於推測，未完全審計所有 API 端點
- 缺少運行時驗證和數據轉換
- Decimal 字段使用 `string | number` 聯合類型（臨時方案）
- Date 字段在 API 響應中是字符串，但部分類型定義為 Date

**使用建議：**
在生產環境使用前，請驗證實際 API 響應是否與類型定義匹配。

## 概述

`shared/api-types.ts` 提供了系統 API 響應的類型定義，作為從 `any` 遷移到強類型的起點。

## 當前狀態

### ✅ 基礎框架已建立
- 創建了主要 API 響應類型接口
- `apiRequest` 函數支持泛型，可指定返回類型
- 定義了常用響應類型：
  - `PaymentStats` - 付款統計
  - `ProjectStats` - 專案統計  
  - `PaymentItemWithDetails` - 帶詳情的付款項目
  - `PaginatedResponse<T>` - 分頁響應
  - `BatchImportResult` - 批次導入結果
  - `AuthResponse` - 認證響應
  - 等等

### 🚧 需要改進
- 審計所有 API 端點，確保類型定義準確
- 實施運行時驗證（Zod schemas）
- 統一 decimal/Date 類型的序列化處理
- 創建數據轉換層

### ⚠️ 數字類型處理
由於數據庫的 `decimal` 類型在 JSON 序列化後返回字符串，所有可能包含 decimal 值的字段都定義為 `string | number` 聯合類型。

**示例：**
```typescript
export interface PaymentStats {
  totalPlanned: string | number;  // 可能是 "1000.00" 或 1000
  totalPaid: string | number;
  pendingItems: string | number;
  overdueItems: string | number;
}
```

## 使用方法

### 在查詢中使用類型

```typescript
import { PaymentStats } from '@shared/api-types';

// 使用 useQuery 時指定類型
const { data } = useQuery<PaymentStats>({
  queryKey: ['/api/payment/stats']
});
```

### 在 mutation 中使用類型

```typescript
import { apiRequest } from '@/lib/queryClient';
import { AuthResponse } from '@shared/api-types';

const loginMutation = useMutation({
  mutationFn: (credentials) => 
    apiRequest<AuthResponse>('POST', '/api/login', credentials)
});
```

## 未來改進方向

### 1. 運行時驗證
添加 Zod schema 進行運行時類型驗證和轉換：

```typescript
// 未來實現
export async function apiRequest<T>(
  method: string,
  url: string,
  data?: unknown,
  schema?: z.ZodType<T>
): Promise<T> {
  const response = await fetch(url, {...});
  const json = await response.json();
  
  if (schema) {
    return schema.parse(json); // 驗證並轉換
  }
  
  return json;
}
```

### 2. 數據轉換層
創建轉換函數統一處理 decimal 字符串：

```typescript
export function normalizePaymentStats(raw: any): PaymentStats {
  return {
    totalPlanned: parseFloat(raw.totalPlanned),
    totalPaid: parseFloat(raw.totalPaid),
    // ...
  };
}
```

### 3. 精確類型匹配
審計所有 API 端點，確保類型定義精確匹配實際響應結構。

## 注意事項

1. **數字類型**：當使用帶有 `string | number` 類型的字段時，建議先轉換為數字：
   ```typescript
   const total = parseFloat(String(data.totalPlanned));
   ```

2. **可選字段**：許多字段標記為可選（`?`），使用前檢查：
   ```typescript
   if (data.categoryName) {
     // 安全使用
   }
   ```

3. **漸進式遷移**：從 `any` 遷移到強類型時，建議：
   - 先確認實際 API 響應格式
   - 選擇或創建合適的類型
   - 逐個文件進行遷移

## 貢獻指南

添加新的 API 響應類型時：

1. 在 `shared/api-types.ts` 中定義接口
2. 使用 `string | number` 處理 decimal 字段
3. 將所有可空字段標記為可選
4. 避免使用 `extends` 繼承數據庫表類型（會導致類型衝突）
5. 更新本文檔的類型列表
