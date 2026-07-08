# 統一現金流匯總層（閉環階段 1）— 2026-07-08

> 範圍：後端匯總層 + 三個報表消費端 + 前端口徑標示
> 狀態：✅ 已部署（2026-07-08 11:33 GMT、容器重建、網站/API 驗證正常）
> Commit：`1eb2190`

## 背景

全站功能分析（2026-07-08）發現：系統有四套獨立帳本，只有 `payment_records` 進統一財報——

| 帳本 | 現金流意義 | 原本狀態 |
|------|-----------|---------|
| `payment_records` | 主付款流出 | ✅ 進財報 |
| `enforcement_installment_payments` | 強執分期繳款（真實流出） | 🔴 只在強執模組內 |
| `legacy_debt_payments` | 歷史欠款還款（真實流出） | 🔴 只在欠款模組內 |
| `card_claims` settled | 刷卡請款到帳（流入） | 🔴 純登記工具 |

後果：現金流量表/儀表板 YTD/現金流預測 系統性低估流出；「本月總共付出多少」要自己心算三塊加總。

## 解決方案

唯讀聚合層（仿 `bills.ts` UNION 模式），**不落表、無 migration、不動原模組**：

- `server/services/unified-cashflow.service.ts` — 純函式：強執分期未來月投影（`projectEnforcementMonthly`）、多來源月度合併（`mergeMonthlyAmounts`）、營業活動組裝（`buildUnifiedOperating`）
- `server/storage/unified-cashflow.ts` — SQL 聚合查詢（期間合計、月度彙總、active 分期投影輸入）

### 三個消費端接入

1. **現金流量表** `getCashFlowStatement`：營業活動加「強制執行繳款」「歷史欠款還款」獨立負項（計入總計）；卡請款到帳放 `reference` 欄位**不入總計**
2. **儀表板 YTD** `/api/dashboard/ytd`：兩帳本月度實付併入 `expenseActual` 與 breakdown 新分類；`month-detail` 新增兩個特殊分類可點開看逐筆（駕駛艙同吃此 API 自動受惠）
3. **現金流預測** `/api/cashflow/forecast`：active 強執分期投影進未來月支出、缺口分析涵蓋強執

### 防雙算設計（關鍵決策）

- 卡請款到帳可能與 PM 收入（`income_webhooks` 以訂單付款日計價）是**同一筆錢的兩個時點** → 只列參考、不併入任何總計
- 強執分流靠 `payment_items.enforcement_case_id`（bills 已排除）、分期繳款走獨立表 → 與 payment_records 無重疊
- 歷史欠款設計上即不進 payment_items → 無重疊

## 影響範圍

- 後端：`financial-reports.ts` / `dashboard.ts` / `cashflow-forecast.ts` + 2 新檔
- 前端：`financial-statements.tsx`（口徑標示+卡請款參考卡）、`financial-cockpit.tsx`（本月成本註記）、`financial-dashboard.tsx`（明細來源提示）
- ⚠️ 報表數字會變（變得更真實）：有強執/欠款繳款的月份，支出↑、淨利↓

## 驗證

- 單元測試 10 筆（`tests/unit/unified-cashflow-service.test.ts`：投影期數/跨年/未來起始/合併）
- 整合測試 4 筆（`tests/integration/unified-cashflow.test.ts`：三消費端 + month-detail 逐筆）
- 全套 2366 tests 通過、tsc/lint 乾淨（income.test ECONNRESET 為連線抖動、單獨重跑 48/48 過）

## 已知限制 / 後續

- 歷史欠款「未來還款計畫」無排程欄位 → 預測只投影強執，欠款餘額未投影
- 卡請款結算自動建進帳（可選開關）未做 — 待確認與 PM 收入的對帳關係後再議
- 閉環階段 2（去重整併）、階段 3（介面）、階段 4（技術債）尚未開始

## 相關文件

- 全站分析與四階段計畫：見本次對話規劃（儀表板×4 / 排程×2 / 沙盤×2 / 付款報表×3 重疊群）
- `docs/changes/2026-07-04-convenience-loop.md`（前一輪閉環收尾）
