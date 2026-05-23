# Schema 使用率報告

> 生成時間：2026-05-23T10:38:59.545Z
> 總表數：64 張 · 由 scripts/schema-usage-report.ts 產生

## 狀態分類

| 狀態 | 圖示 | 定義 |
|------|------|------|
| active | 🟢 | 30 天內有 INSERT |
| dormant | 🟡 | 有資料、無 created_at 欄位（無法判斷新鮮度）|
| cold | 🟠 | 30 天內 0 INSERT、但有歷史資料 |
| empty | ⚪ | 完全沒資料、dead schema 候選 |

## 統計

- 🟢 active：**34** 張
- 🟡 dormant：**1** 張
- 🟠 cold：**5** 張（可考慮歸檔）
- ⚪ empty：**24** 張（dead schema 候選、評估後可移除）

## 明細

| 狀態 | 表名 | 總筆數 | 30 天 INSERT |
|------|------|--------|-------------|
| 🟢 active | `payment_items` | 162,729 | 152,099 |
| 🟢 active | `payment_records` | 105,564 | 103,650 |
| 🟢 active | `audit_logs` | 93,888 | 81,110 |
| 🟢 active | `debt_categories` | 13,469 | 11,238 |
| 🟢 active | `integration_events` | 13,005 | 13,005 |
| 🟢 active | `notifications` | 12,032 | 8,421 |
| 🟢 active | `loan_payment_schedule` | 11,102 | 9,672 |
| 🟢 active | `loan_investment_records` | 9,445 | 8,181 |
| 🟢 active | `income_webhooks` | 8,272 | 4,614 |
| 🟢 active | `income_sources` | 7,944 | 6,712 |
| 🟢 active | `payment_projects` | 5,338 | 4,492 |
| 🟢 active | `employees` | 3,402 | 2,968 |
| 🟢 active | `project_category_templates` | 2,698 | 2,247 |
| 🟢 active | `document_inbox` | 2,694 | 2,251 |
| 🟢 active | `fixed_category_sub_options` | 2,676 | 2,244 |
| 🟢 active | `invoice_records` | 2,649 | 2,240 |
| 🟢 active | `expense_sources` | 2,053 | 2,053 |
| 🟢 active | `expense_webhooks` | 2,051 | 2,051 |
| 🟢 active | `payment_schedules` | 1,735 | 1,482 |
| 🟢 active | `payment_item_notes` | 1,712 | 1,488 |
| 🟢 active | `rental_price_tiers` | 1,710 | 1,485 |
| 🟢 active | `fixed_categories` | 905 | 751 |
| 🟢 active | `rental_contracts` | 861 | 749 |
| 🟢 active | `installment_plans` | 851 | 742 |
| 🟢 active | `family_pots` | 387 | 387 |
| 🟢 active | `monthly_hr_costs` | 25 | 25 |
| 🟢 active | `household_expenses` | 7 | 3 |
| 🟢 active | `recurring_expense_templates` | 6 | 6 |
| 🟢 active | `loan_payment_history` | 5 | 3 |
| 🟢 active | `budget_plans` | 4 | 1 |
| 🟢 active | `daily_revenues` | 4 | 3 |
| 🟢 active | `budget_items` | 3 | 2 |
| 🟢 active | `family_recipients` | 1 | 1 |
| 🟢 active | `line_configs` | 1 | 1 |
| 🟡 dormant | `sessions` | 12,593 | — |
| 🟠 cold | `users` | 14 | 0 |
| 🟠 cold | `household_budgets` | 8 | 0 |
| 🟠 cold | `notification_settings` | 2 | 0 |
| 🟠 cold | `ai_settings` | 1 | 0 |
| 🟠 cold | `file_attachments` | 1 | 0 |
| ⚪ empty | `budget_item_allocations` | 0 | 0 |
| ⚪ empty | `contract_documents` | 0 | — |
| ⚪ empty | `family_members` | 0 | 0 |
| ⚪ empty | `family_pot_contributions` | 0 | 0 |
| ⚪ empty | `family_savings_contributions` | 0 | 0 |
| ⚪ empty | `family_savings_goals` | 0 | 0 |
| ⚪ empty | `family_task_templates` | 0 | 0 |
| ⚪ empty | `household_budget_changes` | 0 | 0 |
| ⚪ empty | `integration_api_keys` | 0 | 0 |
| ⚪ empty | `kids_accounts` | 0 | 0 |
| ⚪ empty | `kids_badges` | 0 | — |
| ⚪ empty | `kids_checkins` | 0 | 0 |
| ⚪ empty | `kids_daily_messages` | 0 | 0 |
| ⚪ empty | `kids_goals` | 0 | 0 |
| ⚪ empty | `kids_jars` | 0 | — |
| ⚪ empty | `kids_spendings` | 0 | 0 |
| ⚪ empty | `kids_task_comments` | 0 | 0 |
| ⚪ empty | `kids_tasks` | 0 | 0 |
| ⚪ empty | `kids_wishes` | 0 | 0 |
| ⚪ empty | `late_fee_policies` | 0 | 0 |
| ⚪ empty | `property_group_members` | 0 | 0 |
| ⚪ empty | `property_groups` | 0 | 0 |
| ⚪ empty | `push_subscriptions` | 0 | 0 |
| ⚪ empty | `revenue_forecast_snapshots` | 0 | 0 |

---

## 處理建議

### empty（⚪）— 完全沒資料
**步驟**：
1. grep `tableName` in `server/` `client/` `shared/` — 確認程式碼有沒有引用
2. 若有引用 → 評估是否為 unused feature、考慮刪 feature + drop table
3. 若無引用 → 直接 drop（但先寫進 ADR 紀錄、保留 schema snapshot）

### cold（🟠）— 30 天無 INSERT
**步驟**：
1. 確認是不是一次性 seed 表（如 fixed_categories）→ 標 `seed-only` 不動
2. 不是 seed → 看歷史最後 INSERT 時間（`SELECT MAX(created_at) FROM xxx`）
3. 超過 90 天 → 考慮歸檔（rename to `archive_xxx_YYYY` 或 export to S3）

### dormant（🟡）— 無 created_at
**步驟**：
1. 加 created_at 欄位（ADD COLUMN with DEFAULT NOW()、不破壞既有資料）
2. 下次 report 即可分類為 active / cold

---

**重要：本報告僅供評估、不執行任何刪除動作。實際刪除需另外寫 migration + ADR。**
