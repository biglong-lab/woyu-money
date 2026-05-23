# 系統架構全面盤點 + 整合設計對照表 — 2026-05-24

> 範圍：前端頁面、後端 endpoints、資料表、共用元件 完整盤點
> 目的：找出重疊 / 冗餘 / 設計不一致、給優化整合方案
> 由 3 個 Explore agent 並行盤點後彙整

---

## 一、系統規模統計

| 項目 | 數量 | 備註 |
|------|------|------|
| 前端頁面（ProtectedRoute）| **63** | 含 11 個已廢棄 / 隱藏 |
| API endpoints | **571** | 含 family-kids 207 個（36%）|
| 資料表 | **70+** | 26 個 schema 檔 |
| 共用元件 | **234** | 9 個家用 / 7 個家庭 / 14 個核心 |
| Hooks | **16** | use-auth / use-mobile / use-voice-input… |
| Utility lib | **7** | utils / category-emoji / queryClient… |
| Schema 行數 | 4000+ | payment.ts 最大（406 行）|

---

## 二、功能領域對照表

### A. 家用記帳領域 🏠

| 子系統 | 表 | Endpoints | 頁面 / 元件 | 狀態 |
|-------|-----|----------|-----------|------|
| 支出 | `household_expenses` | 37（含搜尋/篩選/匯出）| /household-budget | 🟢 完整、軟刪除已加 |
| 收入 | `household_incomes` | 4 | quick-add 收入 tab | 🟡 未整合進主 dashboard |
| 預算 | `household_budgets` + `_changes` | 6 | /household-budget | 🟡 catId=0 哨兵值 |
| 範本 | `household_expense_templates` | 4 | /household-budget | 🟢 完整 |
| 分類 | （無獨立表）| 8 | /household-category-management | 🟡 用 fixed_categories、需獨立化 |

### B. 民宿 / 物業領域 🏨

| 子系統 | 表 | Endpoints | 頁面 / 元件 | 狀態 |
|-------|-----|----------|-----------|------|
| 物業專案 | `payment_projects` | 14 | /payment-project | 🟢 完整 |
| 租約 | `rental_contracts` + `_documents` + `_price_tiers` | 8 | /rental-management-enhanced | 🟢 完整 |
| 房租收入 | `daily_revenues` | 4 | /revenue/reports | 🟡 跟 income_webhooks 邊界模糊 |
| PM 橋接 | `income_webhooks` (source=pm-bridge) | 11 | /income/sources、/income/inbox | 🟢 修過 auto-confirm |
| PMS 預測 | `revenue_forecast_snapshots` | 14 | /revenue-forecast | 🟢 剛修對齊 PM revenues |
| 館別損益 | （多表 JOIN）| 1 | /property-pl | 🟢 剛補 income_webhooks |

### C. 付款 / 預算領域 💰

| 子系統 | 表 | Endpoints | 頁面 / 元件 | 狀態 |
|-------|-----|----------|-----------|------|
| 付款項目 | `payment_items` | 13 | /monthly-payment、/general-payment、/installment | 🟢 完整 |
| 付款紀錄 | `payment_records` | 6 | /payment-records | 🟡 沒軟刪除 |
| 排程 | `payment_schedules` | 5 | /payment-schedule | 🟢 |
| 分期 | `installment_plans` | 4 | /installment-payment | 🟢 |
| 預算 | `budget_plans` + `budget_items` | 8 | /project-budget、/budget-estimates | 🟢 |
| 模板 | `recurring_expense_templates` | 5 | /recurring-expenses | 🟢 |
| 滯納金 | `late_fee_policies` | 4 | /late-fee-settings、/labor-insurance-watch | 🟢 |

### D. 收入 / 整合領域 📥

| 子系統 | 表 | Endpoints | 頁面 / 元件 | 狀態 |
|-------|-----|----------|-----------|------|
| 進帳來源 | `income_sources` | 6 | /income/sources | 🟢 |
| 進帳 webhook | `income_webhooks` | 11 | /income/inbox | 🟢 |
| 支出來源 | `expense_sources` | 5 | /expense/inbox | 🟢 |
| 支出 webhook | `expense_webhooks` | 5 | /expense/inbox | 🟢 |
| 整合中心 | `integrations` + API keys | 8 | /integrations | 🟢 |

### E. 家庭 / 小孩領域 👨‍👩‍👧

| 子系統 | 表 | Endpoints | 頁面 / 元件 | 狀態 |
|-------|-----|----------|-----------|------|
| 家庭成員 | `family_members` | 3 | /family（卡片）| 🟢 |
| 小孩帳戶 | `kids_accounts` + `kids_jars` + `_tasks` + `_goals` + `_badges` + `_spendings` + `_wishes` + `_checkins` + `_comments` | **207** | /family、/family/kid/:id | 🔴 單檔 538 KB、9524 行 |
| 家庭存錢 | `family_savings_goals` + `_contributions` | 5 | /family（卡片）| 🟢 |
| 家庭共罐 | `family_pots` + `_contributions` | 5 | /family | 🟡 缺三罐分類 |
| 預算變更 | `household_budget_changes` | 3 | /household-budget | 🟢 |

### F. HR / 人力領域 👤

| 子系統 | 表 | Endpoints | 頁面 / 元件 | 狀態 |
|-------|-----|----------|-----------|------|
| 員工 | `employees` | 5 | /hr-cost-management | 🟢 |
| 月度 HR 成本 | `monthly_hr_costs` | 6 | /hr-cost-reports | 🟢 |

### G. 借貸 / 投資領域 📈

| 子系統 | 表 | Endpoints | 頁面 / 元件 | 狀態 |
|-------|-----|----------|-----------|------|
| 借貸紀錄 | `loan_investment_records` + `_payment_schedule` + `_payment_history` | 14 | /loan-investment-management | 🟢 |
| 附件 | `file_attachments` | 6 | （共用）| 🟢 |

### H. 預估 / 推估領域 🔮

| 子系統 | 用途 | Endpoints | 頁面 | 狀態 |
|-------|------|----------|------|------|
| Snapshot 累積 | revenue_forecast_snapshots | 4 | /revenue-forecast | 🟢 剛重 backfill |
| 季節預估 | seasonal | 1 | （內嵌）| 🟢 剛改用 PM snapshot |
| 線性推估 | simple | 1 | （內嵌）| 🟡 月初極端高估 |
| PMS 校準 | calibration | 2 | /revenue-forecast | 🟡 hardcoded mapping |
| PM vs PMS | comparison | 1 | /revenue-forecast | 🟢 剛改本月/過去月分支 |
| 現金流 | shared/revenue-forecaster.ts | 2 | /cashflow-decision-center | 🟡 簡單成長率外推 |
| 沙盤 | （前端純計算）| 0 | /scenario-simulator | 🟢 |

### I. 報表 / 分析領域 📊

| 報表 | 路徑 | 角色 | 狀態 |
|------|------|------|------|
| 財務三表 | /financial-statements | 老闆、會計 | 🟢 |
| 稅務報表 | /tax-reports | 會計、稅務顧問 | 🟢 |
| 人事費報表 | /hr-cost-reports | HR | 🟢 |
| 付款報表 | /payment-reports | 營運 | 🟢 |
| 收入分析 | /revenue/reports | 業務 | 🟢 |
| 館別損益 | /property-pl | 老闆 | 🟢 剛補 income_webhooks |
| 變動報告 | /variance-report | 財務 | 🟢 |
| 綜合儀表板 | /financial-dashboard | 全員 | 🟡 漏 household_incomes（剛補）|
| 成本總覽 | /cost-overview | 財務 | 🟢 |

### J. 系統 / 管理領域 ⚙️

| 子系統 | 表 | 頁面 | 狀態 |
|-------|-----|------|------|
| 認證 | users + sessions | /auth、/user-management | 🟢 |
| 通知 | notifications + notification_settings | 全域 | 🟢 |
| Audit Log | audit_logs | （無頁面、自動）| 🟢 |
| LINE 設定 | line_configs | /settings | 🟢 |
| Push 訂閱 | push_subscriptions | /settings | 🟢 |
| 回收站 | （多表 JOIN）| /recycle-bin | 🟢 |
| 文件 | documents | /document-inbox | 🟢 |
| 資料品質 | （邏輯）| /settings/data-quality | 🟢 |
| Cron 健康 | （memory log）| /admin/cron-health | 🟢 |

---

## 三、🔴 嚴重重疊與設計問題

### 1. 收入記錄 4 套平行（最嚴重）

| 表 | 用途 | 觸發方式 |
|----|------|---------|
| `household_incomes` | 家庭薪資 / 獎金 / 投資 | UI 手動 |
| `income_webhooks` → `payment_items(income)` | PM/PMS/外部支付 | Webhook + auto-confirm |
| `daily_revenues` | 民宿每日收款 | 手動或 PM 同步 |
| `payment_items(itemType='income')` | 統一進帳項目 | 多 source |

**問題**：
- Dashboard YTD 收入要從 4 個表合併（剛修 #1 加 household_incomes）
- 報表口徑不一致（有的算 webhook、有的算 payment_items）
- daily_revenues 跟 income_webhooks 都是「實際收入」、何時用哪個？

**整合建議**：
- L1（原始層）：`income_webhooks` 收所有自動進帳
- L2（事實層）：`payment_items(itemType='income')` confirm 後寫入（已實作）
- L3（家用層）：`household_incomes` 保留為「個人 / 家庭」收入、不歸專案
- 廢棄 `daily_revenues`、改用 `payment_records` 聚合 view

### 2. 支出記錄 3 套平行

| 表 | 用途 | 邊界 |
|----|------|------|
| `household_expenses` | 家庭日常 | 家用、跟專案無關 |
| `payment_items(itemType='expense')` | 商業 / 專案支出 | 含 project_id |
| `expense_webhooks` → `payment_items` | 外部對接 | 自動 |

**現狀**：邊界明確（家用 vs 商業）、但概念重疊。
**建議**：保持分離、加 docs 說明邊界。

### 3. 預算系統 2 套

| 表 | 用途 | 設計問題 |
|----|------|---------|
| `household_budgets` | 家用月度預算 | catId=0 哨兵值 |
| `budget_plans` + `budget_items` | 商業多專案預算 | 完整、可分攤 |

**建議**：
- `household_budgets.categoryId` 改 NULL 表示總預算（不再 0 哨兵）
- 兩套保留、各自獨立用途

### 4. 分類系統 5 張表

| 表 | 用途 | 評估 |
|----|------|------|
| `debt_categories` | 通用分類 | 模糊 |
| `fixed_categories` | 固定費用 | OK |
| `fixed_category_sub_options` | 子選項 + project | 複雜 |
| `project_category_templates` | 專案模板 | 幾乎不用 ❌ |
| household_expenses.categoryId | 家用分類 | 無 FK |

**整合建議（3 層）**：
- L1: category_master（big bucket）
- L2: category_option（細項 + project/family scope）
- L3: project_category_mapping（專案專用、含 default）

### 5. family-kids.ts 單檔 538 KB / 9524 行 / 207 endpoints

**問題**：占全站 endpoints 36%、檔案無法維護。

**建議拆分**：
```
server/routes/family-kids/
├── core.ts        - 帳戶 / PIN（10 endpoints）
├── tasks.ts       - 任務派發 / 審核（40 endpoints）
├── finance.ts     - 三罐 / 入帳 / 花費（30 endpoints）
├── goals.ts       - 目標 / 願望（20 endpoints）
├── gamification.ts - 徽章 / 連續打卡 / 排行（30 endpoints）
├── analytics.ts   - 統計 / leaderboard（40 endpoints）
└── settings.ts    - 簽到 / 心情 / 評論（37 endpoints）
```

`client/src/pages/family.tsx` (9524 行) 也應拆分為多個子頁。

### 6. 單複數路徑混亂

| 舊（複數）| 新（單數命名空間）|
|----------|-----------------|
| `/api/household-budgets` | `/api/household/budget` ✅ |
| `/api/household-expenses` | `/api/household/expenses` ✅ |
| 兩者同時存在 | 移除舊複數 endpoint |

### 7. PM company_id → project_id mapping hardcoded

3 處 hardcoded `{1:3, 2:4, 3:9, 4:10, 5:20, 6:26}`：
- server/storage/pms-calibration.ts:98-104
- server/storage/forecast-snapshots.ts:430
- server/routes/property-pl.ts（剛加）

**建議**：建 `project_company_mapping` 表、API 改 JOIN。

### 8. 軟刪除策略不一致

| 表 | 策略 | 修法 |
|----|------|------|
| payment_items | ✅ 軟 | - |
| household_expenses | ✅ 軟（剛加）| - |
| budget_items | ✅ 軟 | - |
| household_budgets | ❌ 無 | UPDATE only、OK |
| payment_records | ❌ 硬 | 改軟（影響審計）|
| kids_tasks | ❌ 用 status | OK |

### 9. 隱藏 / 廢棄頁面累積（11 個）

需清理：
- /financial-overview（v1）
- /forecast-input（PMS 已自動）
- /unified-payment（舊）
- /categories-legacy、/category-management、/household-category-management、/project-specific-items、/unified-project-template-management、/project-template-management（5 個舊分類頁）
- /features（dev tool）

### 10. 預估算法缺 confidence 標示

| 算法 | 月初極端 | confidence |
|------|---------|-----------|
| Linear projection | ❌ 高估 ×30 | ❌ 無 |
| Seasonal | ⚠️ insufficient 仍給數字 | ✅ 4 級 |
| PMS Calibration | ⚠️ 無 outlier 過濾 | ✅ 4 級 |
| Cashflow forecaster | 簡單成長率 | ⚠️ 低 |

---

## 四、🟡 中度問題（可改進）

### 11. 導航 14 項「財務助理」過深

建議扁平化：
- **3 主頁**（常用）：綜合儀表板 / 成本結構 / 現金流決策中心
- **工具箱**（可收合 8 項）：收入預測 / 沙盤 / 月度預估 / 館別損益 / 變動報告 / 勞健保 / 租金矩陣 / 收據對應

### 12. 報表名稱模糊

| 現名 | 建議改 |
|------|--------|
| /revenue-forecast | /revenue-trend（短期）|
| /scenario-simulator | /scenario-planning（中期）|
| /financial-dashboard | /financial-control-center（全局）|
| /cost-overview | /cost-breakdown（細分）|

### 13. docs/domains/ 空目錄

無領域文件。應建：
```
docs/domains/
├── payment.md
├── household.md
├── kids.md
├── webhook.md
├── rental.md
├── budget.md
├── forecast.md
└── ERD.md
```

### 14. 預測路徑散亂

| 現有 | 建議 |
|------|------|
| /api/cashflow/forecast | /api/forecast/cashflow ✅ |
| /api/forecast/{trend,simple,seasonal,pms-prediction,calibration} | 統一前綴 ✅ |

### 15. family_pots 缺三罐 / 期限

`family_pots.contributions` 沒記從 spend/save/give 哪罐扣。建議加 `source_jar` 欄位。

---

## 五、🟢 設計良好（不需改）

- 認證 / requireAuth 中央化（auth.ts）
- audit_logs 完整追蹤
- 軟刪除（已有部分表）
- shadcn/ui 元件統一
- React Query 統一 staleTime
- Dialog max-h overflow（剛修）
- Schema ADD only（從不 DROP）
- Drizzle ORM 型別安全
- 家用記帳體驗強化（19 個迭代）
- Income webhook auto-confirm（剛修）
- PMS snapshot 對齊 PM revenues（剛修）

---

## 六、整合路線圖建議

### 短期 P0（1-2 週、低風險）

| 任務 | 時間 | 風險 |
|------|------|------|
| 1. 刪除 11 個廢棄頁面（PR-3 回滾期滿）| 1h | 低 |
| 2. /api/household-* 單複數統一（舊路徑加 deprecation header）| 1d | 低 |
| 3. household_budgets catId=0 → IS NULL or isTotalBudget | 2h | 中 |
| 4. project_company_mapping 表 + 3 處 hardcoded 改 JOIN | 2h | 低 |
| 5. 建 docs/domains/* skeleton（7 個檔）| 2h | 低 |

### 中期 P1（3-6 週）

| 任務 | 時間 | 風險 |
|------|------|------|
| 6. family-kids.ts 拆 6-7 個子檔 | 1 週 | 低 |
| 7. family.tsx (9524 行) 拆子頁 / 子元件 | 1 週 | 中 |
| 8. household_categories 獨立表（取代自由文字）+ 遷移 | 3d | 中 |
| 9. payment_records 加軟刪除 | 1d | 低 |
| 10. Linear projection 月初 confidence 警告 | 2h | 低 |
| 11. 導航扁平化（14 項 → 3 主 + 工具箱）| 3d | 中 |
| 12. 統一預測路徑 /api/forecast/* | 2d | 中 |

### 長期 P2（1-3 月、評估）

| 任務 | 時間 | 風險 |
|------|------|------|
| 13. 廢棄 daily_revenues、改用 view | 2d | 中 |
| 14. 分類系統 L1/L2/L3 重構 | 2 週 | **高** |
| 15. household_expenses ↔ payment_items 統一視圖 | 1 週 | 高 |
| 16. family_pots 加 pot_type + source_jar | 3d | 低 |
| 17. PMS Calibration outlier IQR 過濾 | 1d | 低 |
| 18. Cashflow forecaster 改 EMA + 季節因子 | 1 週 | 中 |

---

## 七、優先級總結

### 🔴 高優先級（影響數字正確性、用戶體驗）
1. 收入記錄 4 套統一（部分完成、漸進）
2. family-kids.ts 拆檔
3. PM company → project mapping 改表

### 🟡 中優先級（改善維護性）
4. 分類系統重構
5. 廢棄頁面清理
6. 軟刪除策略統一
7. 預測 confidence 警告

### 🟢 低優先級（長期改善）
8. 路徑單複數統一
9. 導航扁平化
10. docs/domains/ 內容

---

## 八、結論

**系統整體健康度**：8/10

✅ **優點**：
- 領域邊界清楚（家用 / 民宿 / 家庭 / 付款）
- 大部分模組功能完整
- 認證 / audit / soft delete 機制成熟
- 最近 audit 已修主要數字一致性問題

❌ **缺點**：
- family-kids 過度膨脹（單檔 538 KB）
- 部分平行系統（收入 4 套、分類 5 表）
- 11 個廢棄頁面累積
- 預測算法缺 confidence 標示

**建議路徑**：
- **本月**做 P0（1-2 週、5 項）
- **下月**做 P1 部分（family-kids 拆檔、軟刪除統一）
- **長期**評估 P2（分類重構、daily_revenues 廢棄）

整合後預期：
- 頁面數 63 → 52（-11 廢棄）
- family-kids 單檔 → 6-7 個子檔
- 收入口徑統一
- 預測有 confidence 標示
