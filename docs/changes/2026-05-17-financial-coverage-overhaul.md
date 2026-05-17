# 財務涵蓋全面盤點與修補 — 2026-05-17

> 範圍：收入接入修重疊、支出 6 家館 API、HR 補齊、雜項採購評估
> 狀態：✅ 全部完成
> 部署：commit `6351ec0`(收入 source) → `102ca77`(收入入帳) → `9552fdb`(HR)

## 背景

使用者反饋系統已逐步建置完整收入/支出/人力成本/雜項，請做全面盤點：
1. 接入資訊是否有重疊
2. 資料精準度是否完備
3. 缺口在哪

盤點發現 6 項重大問題，全部一次性修補完畢。

---

## 修補前狀態（盤點發現）

### 收入端嚴重重疊
| Source | 筆數 | 涵蓋 | 問題 |
|---|---:|---|---|
| `pm-bridge` | 3,893 | 浯島文旅+輕旅+大號 | 與 wdhotelin 完全重疊 |
| `wdhotelin` | 1,554 | 只有浯島文旅 | PM 推兩遍 |
| `pms-bridge` | 0（停用） | - | 廢棄 |
| `my-platform` | 1 | 自研測試 | - |
| `pmwdhotel`/`pmwdhotelpay` | 0/2 | 廢棄 | - |

**致命問題**：5,476 筆 webhook 全部 `pending`，**過去 10 個月收入零進帳**。

### 支出端只接 1 家
- `wdhotelpay`（浯島文旅）402 筆
- 其他 5 家館完全沒接入

### HR 嚴重不完整
- monthly_hr_costs 只有 3 筆，且**無對應 payment_item**（不會出現在付款項目列表）

---

## 修補成果

### 1. 收入端重疊修正（Step 1）
- 5 個新 income_sources：`pm-wdql-in / pm-xllc-in / pm-zbzds-in / pm-kxbbz-in / pm-dhwc-in`（鏡像支出端命名）
- pm-bridge 浯島文旅 1,547 筆 → 標 `rejected`（避免誤確認入帳）
- pm-bridge 浯島輕旅 2,344 筆 → 遷移到 pm-wdql-in
- pm-bridge 大號文創 1 筆 → 遷移到 pm-dhwc-in
- pm-bridge `is_active=false` 停用

### 2. 批次確認 3,894 筆歷史收入（Step 2）
- 補 5 個新 source 的 `default_project_id`
- PL/pgSQL 一次性處理：建 payment_item + payment_record + 更新 webhook
- 過去 10 個月收入入帳

| 月份 | 入帳金額 |
|---|---:|
| 2025-08 | 1,335,817 |
| 2025-09 | 887,855 |
| 2025-10 | 1,389,361 |
| 2025-11 | 1,022,178 |
| 2025-12 | 909,113 |
| 2026-01 | 843,617 |
| 2026-02 | 789,690 |
| 2026-03 | 713,732 |
| 2026-04 | 1,015,058 |
| 2026-05 | 727,168 |

### 3. HR 月成本對應 payment_items（Step 3）
- 新建「人力成本」payment_project（type=hr）
- 3 筆 monthly_hr_costs → 3 筆 payment_item（status=unpaid, $38,470/月/人）
- source='hr'，tags='HR成本,薪資,勞健保'
- UI 加 👤 HR 琥珀色徽章

### 4. 支出端 6 家館 API（已於前次完成）
| pmCompanyId | 館別 | sourceKey | 狀態 |
|:-:|---|---|---|
| 1 | 浯島文旅 | wdhotelpay | 運作中 305 pending |
| 2 | 浯島輕旅 | pm-wdql | 等 PM 推 |
| 3 | 小六路厝 | pm-xllc | 等 PM 推 |
| 4 | 總兵招待所 | pm-zbzds | 等 PM 推 |
| 5 | 魁星背包棧 | pm-kxbbz | 等 PM 推 |
| 6 | 大號文創 | pm-dhwc | 等 PM 推 |

---

## 修補後財務全貌（過去 10 個月）

| 月份 | 收入 | 支出 | 淨利 |
|---|---:|---:|---:|
| 2026-05 | 727,168 | 368,654 | +358,514 |
| 2026-04 | 1,015,058 | 446,522 | +568,536 |
| 2026-03 | 713,732 | 387,750 | +325,982 |
| 2026-02 | 789,690 | 387,750 | +401,940 |
| 2026-01 | 843,617 | 377,750 | +465,867 |
| 2025-12 | 909,113 | 447,604 | +461,509 |
| 2025-11 | 1,022,178 | 613,312 | +408,866 |
| 2025-10 | 1,389,361 | 459,740 | +929,621 |
| 2025-09 | 887,855 | 845,621 | +42,234 |
| 2025-08 | 1,335,817 | 1,306,432 | +29,385 |

### payment_items 來源分佈
| source | 筆數 | 金額 |
|---|---:|---:|
| manual | 613 | 4,303 萬 |
| webhook (income) | 3,894 | 964 萬 |
| pm | 89 | 12 萬 |
| ai_scan | 13 | 30 萬 |
| hr | 3 | 12 萬 |

### manual 613 筆類別分佈（TOP 10）
| 類別 | 筆數 | 金額 |
|---|---:|---:|
| 租金 | 386 | 3,812 萬（佔 89%） |
| (未分類) | 34 | 105 萬 ← 多為租金分期未歸類 |
| 洗滌費 | 41 | 90 萬 |
| 設備採購 | 36 | 74 萬 |
| 裝修費用 | 20 | 62 萬 |
| 人事費用 | 30 | 33 萬 ← 與新 HR 機制可能重疊 |
| 營運成本 | 14 | 18 萬 |
| 水費 | 9 | 15 萬 |
| 保險稅務 | 5 | 11 萬 |
| OTA佣金 | 3 | 3 萬 |

---

## 剩餘缺口與建議

### A. 等 PM 工程師配置（5 家館的 webhook 推送）
拿 token 清單給 PM 開發者照 `docs/integration-api.md §10.1` 設定。

### B. 浯島文旅 305 筆 pending 支出待確認
使用者透過 `/expense/inbox` 批次確認入帳。

### C. 2025-06、2025-07 兩個月收入未推
PM 那邊歷史回推範圍只到 2025-08。是否需要請 PM 補推這兩個月？

### D. 「人事費用」類別 30 筆 / 33 萬與新 HR 機制重疊
應該逐筆判斷：歷史薪資→保留為 manual（已成本記過）；新月份統一走 HR 自動產出。
建議：在「人事費用」manual items 加 readonly 標記、避免重複輸入。

### E. HR 自動產出 cron 未實作
目前需手動執行 `scripts/backfill-hr-payment-items.sql`。
建議：每月 1 號自動跑（用 node-cron 或 GitHub Actions schedule）。

### F. 雜項採購無專屬通道
613 筆 manual 中：設備採購 36/74萬、裝修費用 20/62萬、耗材 6/2.7萬、辦公用品 2/0.6萬。
建議：維持「手動輸入 + AI 單據掃描」雙通道、無須額外建表。

### G. 33 筆「未分類」實為租金分期未歸類
建議：寫一個一次性 SQL 把這 33 筆改 category_id=租金。

---

## 影響範圍

### 新增檔案
- `scripts/setup-pm-hotel-income-sources.mjs`（收入 source 設定）
- `scripts/setup-pm-hotel-sources.mjs`（支出 source 設定，前次完成）
- `scripts/backfill-confirm-income-webhooks.sql`（批次確認）
- `scripts/backfill-hr-payment-items.sql`（HR 補建）
- `scripts/backfill-pm-source-tags.sql`（PM source 標籤，前次）

### 修改檔案
- `client/src/components/general-payment-types.ts`（PaymentItem source 加 hr）
- `client/src/components/general-payment-item-list.tsx`（HR 徽章）
- `client/src/components/general-payment-detail-dialog.tsx`（HR 區塊）

### DB 變動
- income_sources：新增 5 筆
- payment_projects：新增「人力成本」（id=27）
- payment_items：新增 3,897 筆（3,894 收入 + 3 HR）
- income_webhooks：3,894 筆從 pending → confirmed、1,547 筆從 pending → rejected、2,345 筆 source_id 遷移

---

## 相關文件

- API 規範與 6 家館對接清單：[`docs/integration-api.md`](../integration-api.md) §10.1
- 部署紀錄：[`CHANGELOG.md`](../../CHANGELOG.md)
- 前次大型變動：[`2026-05-16-integration-api-spec.md`](2026-05-16-integration-api-spec.md)
