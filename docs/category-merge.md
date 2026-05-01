# 分類系統合併計畫（2026-04 ~ 2026-05）

## 背景

舊系統有 5 頁分散的分類管理，實務上根本沒用到，造成：

- `fixed_categories`（固定分類，10 筆，僅 2 個被使用）
- `debt_categories`（債務分類，55 筆，僅 20 個被使用）
- `fixed_category_sub_options`（固定子選項，0 筆，廢表）
- `project_category_templates`（專案模板，0 筆，廢表）
- 「固定 vs 專案」雙軌制 → 程式碼到處重複判斷

## 完成內容（4 個 PR）

### PR-1：資料層遷移 (commit `3cc9f16` + `75293bf`)

**Migration `0010_merge_fixed_to_debt_categories.sql`**

1. 把 `fixed_categories.管理費` INSERT 到 `debt_categories`
2. UPDATE `payment_items.category_id` ← 從 `fixed_category_id` 對應
3. UPDATE `budget_items.category_id`（預期 0 筆，預留邏輯）
4. 標記 `fixed_categories` 表 / `fixed_category_id` 欄位 `@deprecated 30 天`

**Migration `0011_fix_borrowing_category_merge.sql`**

修補：原 `debt.借貸` (id=36) 是 `is_deleted=true` 導致 sub-query 過濾掉。

1. INSERT 新的未刪除「借貸」分類
2. 重跑 UPDATE 補配 4 筆借貸 payment_items
3. 清掉 `payment_items.fixed_category_id`（既已遷移就斷連結）

**結果**：3 筆借貸 payment_items + 1 筆管理費成功遷移。1 筆軟刪除狀態的孤兒（不影響線上）。

### PR-2：後端統一 API + 簡化 reconcile (commit `fa01839`)

**新檔 `server/routes/categories-unified.ts`**

| Method | Endpoint | 用途 |
|--------|----------|------|
| GET | `/api/categories/unified` | 列出所有分類含 `usedCount` / `lastUsedAt` / `budgetCount` / `isInUse` |
| POST | `/api/categories/:id/merge` | Transaction 合併 from→to，重定向 `payment_items` + `budget_items` 後軟刪除來源 |
| POST | `/api/categories/archive-unused` | 批次軟刪除「90 天前建立、無使用」分類（預設 `dryRun=true`） |

**簡化 `shared/budget-reconcile.ts`**

從 3 級配對降為 2 級（`fixedCategoryId` 路徑已死）：

- 優先級 1：`projectId + categoryId + month`（priority="category"）
- 優先級 2：`projectId + month` 且唯一一筆無分類（priority="project_month"）

連動更新 `server/storage/budget-reconcile-hook.ts` 的 SQL 查詢與 candidate 組裝。

### PR-3：前端統一管理頁 (commit `d6f66cf`)

**新頁 `client/src/pages/categories-unified.tsx` → `/categories`**

- 5 卡統計（總/啟用/使用中/未使用/已刪除）
- **重複偵測面板**：同名分類（不分大小寫）自動列出，建議保留 `usedCount` 高者，一鍵合併
- 搜尋 + 類型/狀態雙篩選
- 左列表（含 badge）+ 右詳細
- 動作：編輯、合併、軟刪除
- 合併對話框：來源/目標選擇 + 影響範圍預覽 + 跨類型警示
- 「清理長期未用」按鈕（dryRun 預覽）

**導航整合（`client/src/config/navigation.ts`）**

「分類管理」`/categories` 顯眼置於「系統管理」首位，隱藏 5 個舊項目（路徑保留可訪問供 30 天回滾）：

| 舊項目（隱藏） | 路徑 |
|--------------|------|
| 固定分類管理 | `/category-management` |
| 專案專屬項目管理 | `/project-specific-items` |
| 統一專案模板管理 | `/unified-project-template-management` |
| 專案分類模板管理 | `/project-template-management` |
| 家庭分類管理 | `/household-category-management` |
| 舊版三 tab 分類頁 | `/categories-legacy` |

### PR-4：清理 + 文件（本次）

- 本文件
- E2E 唯讀驗證
- `migrations/0012_drop_legacy_category_tables.sql.draft`（30 天後啟用）

## API 用法範例

### 列出所有分類含使用統計

```bash
curl -X GET https://money.homi.cc/api/categories/unified \
  -H "Cookie: connect.sid=..."
```

回應：
```json
[
  {
    "id": 36,
    "categoryName": "借貸",
    "categoryType": "project",
    "description": null,
    "isDeleted": true,
    "createdAt": "2025-08-01T00:00:00Z",
    "usedCount": 0,
    "lastUsedAt": null,
    "budgetCount": 0,
    "isInUse": false
  },
  // ...
]
```

### 合併兩個分類

```bash
curl -X POST https://money.homi.cc/api/categories/123/merge \
  -H "Content-Type: application/json" \
  -d '{"targetId": 456}'
```

回應：
```json
{
  "success": true,
  "sourceId": 123,
  "targetId": 456,
  "paymentItemsMoved": 7,
  "budgetItemsMoved": 2,
  "message": "合併完成：7 筆付款項目、2 筆預估項目改至 #456，#123 已軟刪除"
}
```

### 批次軟刪除未使用分類

```bash
# 1. 預覽（dryRun）
curl -X POST https://money.homi.cc/api/categories/archive-unused \
  -H "Content-Type: application/json" \
  -d '{}'

# 2. 真執行
curl -X POST https://money.homi.cc/api/categories/archive-unused \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

## UI 操作流程

### 一般管理

1. 訪問 `/categories`
2. 上方 5 卡看統計
3. 左側列表挑選分類 → 右側看詳細 → 編輯/合併/軟刪除

### 合併重複分類

1. 上方琥珀色「重複名稱」面板自動偵測
2. 點「合併 #X → #Y」一鍵處理
3. 或從右側選分類 → 點「合併」按鈕 → 選目標 → 看預覽 → 確認

### 清理長期未用

1. 點上方「清理長期未用（預覽）」按鈕
2. 看 toast 顯示「dryRun: N 筆可清理」
3. 若確認要刪，呼叫 API：`POST /api/categories/archive-unused` body=`{"dryRun":false}`

## 回滾方式（30 天內）

### 完全回滾到 PR-3 前

```bash
# 程式碼回滾
git revert d6f66cf  # PR-3 前端
git revert fa01839  # PR-2 後端
git revert 75293bf  # PR-1 修補
git revert 3cc9f16  # PR-1 主 migration
git push origin main

# DB 回滾（手動，因為 migration 是 ALTER 不可自動 revert）
psql $DATABASE_URL <<'SQL'
BEGIN;
-- 1. 把 payment_items 的 category_id 還原到對應 fixed_category_id（從名稱反查）
UPDATE payment_items pi
SET fixed_category_id = (
  SELECT fc.id FROM fixed_categories fc
  JOIN debt_categories dc ON fc.category_name = dc.category_name
  WHERE dc.id = pi.category_id
  LIMIT 1
),
category_id = NULL
WHERE pi.fixed_category_id IS NULL
  AND pi.category_id IS NOT NULL;
-- 注意：這只還原由 PR-1 遷移的資料，新建立的記錄不可回滾

-- 2. 移除 PR-1 新建的「借貸」debt_categories（檢查 id 後再刪）
-- DELETE FROM debt_categories WHERE category_name = '借貸' AND created_at > '2026-04-23';

COMMIT;
SQL
```

### 只回滾前端（保留資料層整合）

```bash
git revert d6f66cf
git push origin main
# 訪問 /categories-legacy 仍可用舊頁
```

### 啟用舊導航項目

編輯 `client/src/config/navigation.ts`，把註解掉的 5 項還原。

## 30 天清理計畫（2026-06）

執行 `migrations/0012_drop_legacy_category_tables.sql`：

- DROP `fixed_categories`
- DROP `fixed_category_sub_options`
- DROP `project_category_templates`
- ALTER `payment_items` DROP COLUMN `fixed_category_id`
- ALTER `budget_items` DROP COLUMN `fixed_category_id`

執行前必做：

1. ✅ 確認 `payment_items.fixed_category_id IS NULL` 對所有未軟刪資料
2. ✅ 確認程式碼搜尋無 `fixed_category_id` / `fixedCategoryId` 引用（schema 除外）
3. ✅ 完整 DB 備份（pg_dump）
4. ✅ 通知所有使用者（30 天觀察期已過）

## 影響評估

| 指標 | 數值 |
|------|------|
| 移除頁面 | 5 頁 → 1 頁 |
| 移除導航項目 | 5 項 → 1 項 |
| 簡化配對邏輯 | 3 級 → 2 級 |
| 預期移除程式碼（30 天後） | ~600 行 |
| 預期移除 DB 表 | 3 張 + 2 個欄位 |
| 對使用者影響 | 唯一可見：分類管理入口從 5 個變 1 個（更清晰） |
