# 資料正確性修復 + 測試/CI 治理 + 生產巡檢（自我節奏循環後半）— 2026-07-04

> 範圍：/loop 循環後半、commit `2433cbe` → `ead0aec`（1.3.4）
> 主軸：清償 PROGRESS 正確性欠債 + 把開發體質（測試/CI/lint）修好 + 生產日誌獵 bug
> 部署：2026-07-06 14:37 GMT（`ead0aec`、隨 1.3.3 便利性套件一併上線、驗證全綠）

## 背景

便利性套件（1.3.3、見 [convenience-loop](2026-07-04-convenience-loop.md)）完成後，循環轉向
PROGRESS 長期掛起的正確性欠債與開發體質問題，最後進入生產巡檢模式獵真 bug。

## 一、資料正確性修復

### payment_records 軟刪除過濾補齊 8 處（task #338、`2433cbe`）

migration 0016 加了軟刪除、但多處統計 SELECT 未過濾 `is_deleted` → 已刪付款仍被計入：

- financial-reports ×6：收入/支出分類、現金累計、月度損益、發票統計
- getPaymentRecords 列表基底、by-itemId 列表、cashflow 查詢
- **關鍵**：`updatePaymentItemAmounts` — 已刪記錄原本仍算進項目 `paidAmount`、刪了狀態不回退
- data-quality 殭屍偵測、late-fee.service、property-pl 補 pr 端過濾
- **順手獵獲**：ai-assistant 用不存在的欄位 `pr.item_id`（應為 `payment_item_id`）— 一執行就炸
- 查證更正：原估 20 處、實查 8 處（fixed-expense-matrix 等已有過濾）

### family-kids 跨日 timing bug 27 處（task #339、`42c6117`）

台北 00:00~08:00 之間 `toISOString().slice(0,10)` 取到 UTC 前一天 → 簽到/任務/花費/
統計全記錯日：

- 22 處機械替換 `new Date().toISOString()` / `Date.now()±N天` → `localDateTPE()`
- 5 處判讀修復：月零用金入帳日、time-of-day 今日判斷、recurring 無 dueDate 分支
  （TPE 錨定）、兩處存錢目標 ETA → `localDateTPE(etaDays)`
- 8 處刻意保留並註記：DB date 欄位轉字串（UTC 容器下本來就對）、純日期字串運算（時區中性）

### fc.color 欄位不存在 500（`3635f31`、生產巡檢獵獲）

`fixed_categories` 從無 `color` 欄位、兩查詢寫了 `COALESCE(fc.color,...)`：
`/api/household/top-categories`（快速記帳常用分類 chips）與家用支出列表**自撰寫以來一直 500**
（生產 7 天日誌 2 次）。改常數色 `#9CA3AF`、回傳形狀不變、前端零改動；本地起 server 實測 500→200。

## 二、測試/CI 治理

### 根治 family-kids 測試 flaky（`1c4d14c`）

**真根因不是資料污染**（長期誤判、清表重推只是巧合讓下輪重抽隨機數）：approve 端點有
15% 機率隨機驚喜獎勵（+20%~+200%），測試斷言固定三罐分配 → 每輪 ~15% 紅燈。
修法：`tests/setup.ts` 設 `FAMILY_KIDS_NO_BONUS=1`（程式內建開關、測試從未啟用）+
beforeAll 清同 PIN 殘留。連 5 輪 411/411 驗證。

### CI 歷史首次全綠（`23f903e` → `da31d4a`）

CI 自 family-kids 拆檔起數十筆全 failure、從未綠過。逐一修復：

- ESLint 644 → 94（清 169 個未用 import、基線 314→100 鎖住）
- admin 帳號種子（drizzle-kit push 後無 user、整合測試登入 401 連鎖失敗）
- projectId=1 測試專案種子（多測試硬編、CI 空庫 FK 違反 500）
- 租金分類種子（generate-payments 需 debt_categories(租金,project)）
- 數百失敗 → 0，CI 首次全綠

## 三、安全 Headers 補齊（`ead0aec`）

生產 header 檢查 6 項缺 2：Referrer-Policy、Permissions-Policy。加在 Express
securityHeaders 中介層、不動 nginx；部署後驗證 6/6 齊全。

## 驗證

- 每輪 tsc + 相關測試 + build；全套 2,377 測試綠；CI 全綠
- 部署後六項驗證：網站 200 / API 401 / 新 headers 生效 / fc.color 端點 200 /
  重啟後日誌 0 次 fc.color / cron 四項綠 + 補 12 筆收入 / 關鍵表筆數無異動

## 已知限制 / 後續

- 兩個內聚大元件（KidDashboard 1,025 行、HouseholdBudget ~1,190 行）手工拆分未做
  （工程大、效益低）
- PMS 2、3 月資料待對方補登；39 筆 PMS 月度累計 pending 待決定是否整批拒絕

## 相關文件

- 前半便利性套件：[convenience-loop](2026-07-04-convenience-loop.md)
- 更前批：[pm-schema/選單 IA/帳單可操作化](2026-07-04-pm-schema-nav-ia-bills-actions.md)
- 記憶：`family-kids-test-flaky-root-cause`、`pm-multitenant-schema`
