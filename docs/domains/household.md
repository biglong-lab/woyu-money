# 家用領域

> 家庭日常收支 + 預算規劃、跟商用 payment_items 分離
> 主要 UI：`/household-budget`（一頁式記帳 + 預算 + 看板）

## 主要表

| 表 | 用途 | 關鍵欄位 |
|----|------|---------|
| `household_budgets` | 月度預算（含總預算 + 各分類） | category_id, year, month, budget_amount, **is_total_budget** |
| `household_expenses` | 日常支出明細 | category_id, amount, date, payment_method, tags, is_deleted |
| `household_incomes` | 日常收入明細 | source_label, amount, date |
| `household_expense_templates` | 常用模板（一鍵新增） | name, category_id, default_amount |
| `household_budget_changes` | 預算變更歷程 | old_amount, new_amount, changed_by_user_id, action |

## 核心概念：is_total_budget（2026-05-24 audit P3）

- 「總預算」 row 有 `is_total_budget = true`、額外 `category_id = 0`（backward compat）
- 各分類預算 row：`is_total_budget = false`、`category_id` 指實際 category
- 查總預算：`WHERE is_total_budget = true`（不再用 magic number 0）
- 詳：[../changes/2026-05-24-household-budget-is-total-flag.md](../changes/2026-05-24-household-budget-is-total-flag.md)

## 主要 endpoint

- `GET /api/household/budget?month=YYYY-MM` — 取月度總預算
- `POST /api/household/budget` — 設總預算（含 change log）
- `GET /api/household/expenses` — 列支出（含分頁）
- `POST /api/household/expenses` — 新增支出（支援多 tag、receipt 圖片）
- `DELETE /api/household/expenses/:id` — soft delete

## 軟刪除（2026-05-24 audit P0）

- `household_expenses.is_deleted` + `deleted_at` + `deleted_by_user_id`
- 22 處 SELECT 已自動補 `NOT is_deleted` filter
- DELETE 走 storage.deleteHouseholdExpense（內部 UPDATE、非真刪）

## UX 進化記錄

詳 [../changes/2026-05-23-household-budget-overhaul.md](../changes/2026-05-23-household-budget-overhaul.md)：
- amount keypad、voice input、swipeable row、模板、搜尋、收入 tab、收支平衡卡

## 相關文件

- changes：is_total_budget、household-budget-overhaul、document-inbox-upload-fix
