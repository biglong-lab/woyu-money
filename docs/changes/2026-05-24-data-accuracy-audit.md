# 全面盤點：數據完備性 + 計算精準度 — 2026-05-24

> 觸發：使用者反映 PM 收入數字在多個頁面不一致（已陸續修 3 個 commit 對齊 PM snapshot）
> 結論：根本問題不只在 PM 對齊、整個系統有 15+ 個「數字源不一致 / 推估算法 / 時區 / 軟刪除」風險點
> 由 3 個 Explore agent 並行分析後彙整

---

## 一、🔴 P0 — 影響數字準確度（必修）

### 1. Dashboard YTD「收入」漏掉 `household_incomes`

**位置**：`server/routes/dashboard.ts:14-432` `/api/dashboard/ytd`

**問題**：YTD 收入只算 `payment_items income`、不含家用收入（薪資/獎金/投資）。家裡有額外收入時、首頁顯示的「今年收入」會低估。

**修法**：
```typescript
// dashboard.ts:39-131 income_split CTE 後加 household_incomes 合併
SELECT TO_CHAR(date, 'YYYY-MM'),
       SUM(CASE WHEN date <= today THEN amount ELSE 0 END) AS actual,
       SUM(CASE WHEN date > today THEN amount ELSE 0 END) AS planned
FROM household_incomes
WHERE date BETWEEN yearStart AND lookaheadEnd
```

**預估時間**：30 分鐘

---

### 2. 館別損益表漏掉 `income_webhooks`（PM/PMS 訂單收入）

**位置**：`server/routes/property-pl.ts:68-200` `/api/reports/property-pl`

**問題**：館別損益表「收入」只查 `daily_revenues`（手動輸入）、漏掉 PM-bridge / PMS-bridge 推進來的 9 成訂單收入。淨利率大幅低估。

**修法**：加 LEFT JOIN `income_webhooks` + `income_sources.default_project_id`、把 webhook 收入歸到對應專案。

**預估時間**：1 小時（含對應 project mapping）

---

### 3. UTC vs UTC+8 時區邏輯不一致

**位置**：多處
- `server/storage/forecast-snapshots.ts:109` `captureFromPM` 用 `new Date().toISOString().slice(0,10)`（UTC 日期）
- `server/storage/pms-forecast-sync.ts:38` 同上
- `client/src/pages/revenue-forecast.tsx:283` 前端用 `new Date().getFullYear()`
- `server/routes/dashboard.ts:17-24` `yearStart` 用 `new Date()` 無 TZ 處理

**問題**：若 Docker container TZ=UTC（沒設 TZ env）、`new Date()` 取 UTC、台灣早上 0-8 點會用「前一天」日期、導致快照存錯日期、查詢時也錯日期。生產 server 的 `date` 命令需驗證。

**修法**：
```bash
# 1. 檢查生產 TZ
ssh prod 'docker exec woyu-money date'

# 2. 若是 UTC、在 docker-compose.yml 加 TZ=Asia/Taipei
environment:
  - TZ=Asia/Taipei

# 3. 改 forecast-snapshots.ts captureFromPM 用台灣時區
const now = new Date()
const tw = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000)
const todayStr = tw.toISOString().slice(0, 10)
```

**預估時間**：1 小時（含驗證）

---

### 4. `household_expenses` 無軟刪除機制

**位置**：`shared/schema/household.ts`、`server/routes/household.ts` 所有 expenses query

**問題**：household_expenses 直接 DELETE、無 audit trail、誤刪無法復原。所有支出 query 也沒 `WHERE NOT is_deleted` filter（因為欄位不存在）。

**修法**：
```sql
ALTER TABLE household_expenses ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE household_expenses ADD COLUMN deleted_at timestamp;
ALTER TABLE household_expenses ADD COLUMN deleted_by_user_id integer REFERENCES users(id);
```

DELETE endpoint 改 UPDATE、所有 SELECT 加 `WHERE NOT is_deleted`。

**預估時間**：1 小時

---

### 5. `forecast/seasonal` 用 `payment_items` 但 `forecast/trend` 用 PM snapshot

**位置**：
- `server/storage/forecast-snapshots.ts:443` (seasonal) 用 `payment_items income`
- `server/storage/forecast-snapshots.ts` getMonthlyTrend 用 `revenue_forecast_snapshots`

**問題**：同一頁的兩個卡用不同 source、會看到「PM 當下 $1,061,578 / 季節預估 $300K」這種詭異組合。剛修了 PM-vs-PMS / latestAmount、但 seasonal 沒改。

**修法**：把 seasonal 內部「歷史月份累積」也改從 `revenue_forecast_snapshots` 取（每月最後一日的 PM snapshot）。

**預估時間**：1.5 小時

---

## 二、🟡 P1 — 影響推估精度（建議修）

### 6. Linear Projection 月初極端高估、無 confidence 標示

**位置**：`server/storage/forecast-snapshots.ts:567`、`client/src/pages/revenue-forecast.tsx:307`

**問題**：5/1 早上有 $100K 入帳、推估月底會算成 $3M（×30 倍）、誤導決策。

**修法**：daysElapsed < 5 時加 `confidence: 'insufficient'` + 前端紅色警告「月初數據不足」。

---

### 7. Seasonal forecast 樣本 < 2 時 fallback 給 linear、但 confidence='insufficient' 仍給數字

**位置**：`server/storage/forecast-snapshots.ts:481`

**問題**：使用者看到「insufficient」+ 數字 $500K、會誤以為是事實。

**修法**：insufficient 時數字回 null、前端顯示「資料不足、無法推估」、不給誤導數字。

---

### 8. PMS Calibration 無 outlier 過濾

**位置**：`server/storage/pms-calibration.ts:148-164`

**問題**：某月 PMS 預估 $100K、實際只收 $1K（ratio 0.01）這種極端值會拉低中位數、模型失準。

**修法**：用 IQR 過濾異常值（`r >= Q1 - 1.5×IQR AND r <= Q3 + 1.5×IQR`）再算中位數。

---

### 9. PMS Calibration 用 hardcoded project_id → company_id mapping

**位置**：`server/storage/pms-calibration.ts:98-104`

**問題**：寫死 `WHEN 3 THEN 1 WHEN 4 THEN 2 ...`、新增第 7 個館（project_id 27+）會漏算。

**修法**：建 `project_company_mapping` 表、API 改 JOIN。

---

### 10. 下月預估卡無 confidence badge

**位置**：`client/src/components/next-month-forecast-card.tsx`

**問題**：使用者看到「下月預估收入 $500K」沒附 confidence、把推估當事實。

**修法**：加 `<Badge>{confidence}</Badge>`、low/insufficient 用紅色。

---

## 三、🟠 P2 — 改善 / 完整性（可選）

### 11. `/api/budget/overrun-alerts` 已實作但前端未整合
**位置**：`server/routes/budget.ts:338-430` (API 完整、前端零引用)
**修法**：household-budget 頁加 warn card 整合。

### 12. `revenue-forecaster.ts` 簡單成長率外推、無基數效應
**位置**：`shared/revenue-forecaster.ts:81-91`
**問題**：過去 4 月 +10%/月、推未來 6 月都 +10%、實際 exp 增長會誤估。
**修法**：用移動平均 + 平滑（EMA）。

### 13. `payment_items.itemType='expense'` 業務含義模糊
**位置**：`server/routes/analytics.ts` 多個統計未過濾 itemType
**問題**：民宿經營支出可能誤算進「家用支出」或「現金流」報表。
**修法**：明確定義 'project'/'expense'/'home' 的邊界、所有報表加明確 filter。

### 14. `forecast/trend` companyId=null 同時取 pm-daily-snapshot + pms-bridge 混在一起
**位置**：`server/storage/forecast-snapshots.ts:60-75`
**問題**：前端 `trend[trend.length - 1]` 可能取到 pms-bridge 的 $0 列、不是合計列。**剛部分修好（filter pm-daily-snapshot）、但 backend 應該分流回傳乾淨**。

### 15. 缺 edge case 單元測試
**位置**：`tests/integration/revenue-forecaster.test.ts` 有基本測試
**問題**：閏年、月初 < 5 天、UTC 邊界、跨年（12→1）、空快照無單元測試。

---

## 四、修復順序建議

| 順位 | 項目 | 影響範圍 | 預估時間 |
|------|------|---------|---------|
| 1 | UTC 時區（#3）| 全系統日期 | 1h |
| 2 | Dashboard YTD 漏 household_incomes（#1）| 首頁數字 | 30m |
| 3 | 館別損益表漏 income_webhooks（#2）| 報表決策 | 1h |
| 4 | household_expenses 軟刪除（#4）| 資料安全 | 1h |
| 5 | Seasonal forecast 對齊 PM snapshot（#5）| forecast 頁一致 | 1.5h |
| 6 | Linear 月初 confidence（#6）| 推估誤導 | 30m |
| 7 | Seasonal insufficient 不給數字（#7）| 推估誤導 | 30m |
| 8 | PMS Calibration outlier 過濾（#8）| 模型準度 | 30m |
| 9 | project_company mapping 表（#9）| 新館擴充 | 1h |
| 10 | 下月預估卡 confidence badge（#10）| UX | 20m |

**P0 全部修完 ≈ 5 小時、P1 全部 ≈ 3 小時、P2 全部 ≈ 4 小時。**

---

## 五、各報表「收入 / 支出」資料源完備性矩陣

| 報表 / 頁面 | payment_items income | income_webhooks | household_incomes | revenue_forecast_snapshots | 完備性 |
|-----------|---------------------|-----------------|------------------|--------------------------|-------|
| Dashboard YTD | ✅ | ⚠️ pending only | ❌ 漏 | ❌ | 🔴 |
| 首頁 HouseholdQuickSnapshot | ❌ | ❌ | ✅ | ❌ | 🟡 (家用 only) |
| Revenue Forecast 頁 | ❌ (剛改掉) | ❌ | ❌ | ✅ | 🟢 (已對齊 PM) |
| Revenue Reports | ✅ daily_revenues | ✅ pending+confirmed | ❌ 漏 | ❌ | 🟡 |
| Property PL（館別損益）| ✅ daily_revenues | ❌ **嚴重漏** | ❌ | ❌ | 🔴 |
| Income Statement（損益表）| ✅ payment_records | ✅ | ❌ 漏 | ❌ | 🟡 |
| Family Cross-Domain Overview | ❌ | ✅ confirmed | ❌ 漏（小孩任務支出有）| ❌ | 🟡 |
| Tax Reports | ✅ | ✅ | ❌ 漏 | ❌ | 🟡 |

---

## 六、推估算法完備性矩陣

| 算法 | 樣本門檻 | 信心度標示 | 邊界處理 | 完備性 |
|------|---------|-----------|---------|-------|
| Linear Projection | 無 | ❌ 無 | ❌ 月初無防護 | 🔴 |
| Seasonal Forecast | ≥2 月 | ✅ 4 級 | ⚠️ insufficient 仍給數字 | 🟡 |
| PMS Calibration | ≥3 bucket | ✅ 4 級 | ❌ 無 outlier 過濾 | 🟡 |
| Cashflow Revenue Forecaster | 6-24 月 | ⚠️ 低等級 | ❌ 無 exp 處理 | 🟡 |
| Budget Reconcile（配對）| N/A | N/A | ✅ 完整 | 🟢 |

---

## 七、緊急建議的 SQL 健檢

定期跑這幾個 SQL 確認資料一致：

```sql
-- 1. PM 入帳 vs PM 快照 累積差距（每月）
WITH pm_paid AS (
  SELECT TO_CHAR(start_date, 'YYYY-MM') AS month, SUM(total_amount::numeric) AS paid
  FROM payment_items WHERE item_type='income' AND NOT is_deleted AND source='webhook'
  GROUP BY 1
), pm_snapshot AS (
  SELECT DISTINCT ON (target_month) target_month, accumulated_revenue::numeric AS acc
  FROM revenue_forecast_snapshots
  WHERE source='pm-daily-snapshot' AND company_id IS NULL
  ORDER BY target_month, snapshot_date DESC
)
SELECT s.target_month, s.acc AS pm_snapshot, p.paid, (s.acc - COALESCE(p.paid, 0)) AS gap
FROM pm_snapshot s LEFT JOIN pm_paid p ON p.month = s.target_month
ORDER BY 1 DESC;

-- 2. income_webhooks status 分布
SELECT s.source_key, w.status, COUNT(*), SUM(parsed_amount_twd::numeric) AS total
FROM income_webhooks w JOIN income_sources s ON s.id = w.source_id
GROUP BY 1, 2 ORDER BY 1, 2;

-- 3. household 雙計風險（家用支出可能也在 payment_items？）
SELECT 'household' AS src, COUNT(*) FROM household_expenses
UNION ALL
SELECT 'payment_items home_expense', COUNT(*) FROM payment_items WHERE item_type='home' AND NOT is_deleted;

-- 4. PMS company mapping 漏網之魚
SELECT DISTINCT project_id FROM payment_items
WHERE item_type='income' AND NOT is_deleted AND source='webhook'
AND project_id NOT IN (3, 4, 9, 10, 20, 26);
-- 預期空：若有 row、表示新增的館未在 hardcoded mapping
```

---

## 八、決定要修什麼？

**建議路徑 A（最務實）**：先修 P0 #1-5（≈5h）、其餘逐步處理。
**建議路徑 B（最徹底）**：全部 P0+P1+P2、約 12 小時、做完數字準度可達 95%+。
**建議路徑 C（最緊急）**：只修 #3 時區 + #1 dashboard 漏 household_incomes + #4 軟刪除（≈2.5h）。

由使用者決定要哪條路徑、開始實作。
