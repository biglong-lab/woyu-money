# 介面整併與功能閉環（階段 2）— 2026-07-08

> 範圍：純前端（tab 列整併 + 資料檢視動線 + 死碼清理），零後端/schema 變更
> 狀態：已完成、待部署
> 前情：階段 1 見 [2026-07-08-unified-cashflow.md](2026-07-08-unified-cashflow.md)

## 背景

全站功能分析找出 7 組重疊頁面群。1.3.0 已用「連結式 tab 列」（OverviewTabs 模式：
頁面保持獨立 lazy 路由、視覺上像同一區）整併了總覽群與收入群，本階段把同樣模式
補到剩下的群組，並修復資料檢視斷點。

## 解決方案

### 新泛用元件 `client/src/components/link-tabs.tsx`

overview/revenue/payment-report tabs 原本各自複製相同 markup，抽出泛用 LinkTabs
（tabs + accent 色、支援舊路由 alias 高亮），新 tab 列全部基於它。

### 三條新 tab 列

| 元件 | 串起的頁面 | 解決 |
|------|-----------|------|
| `payment-action-tabs` | /bills、/cash-allocation、/enforcement | 「現在該付什麼」三頁互達 |
| `scenario-tabs` | /scenario-planner、/scenario-simulator | 兩個沙盤互不知道對方存在 |
| `schedule-tabs` | /payment-planner、/payment-schedule | 月份規劃 vs 日期計劃分界模糊 |

### 其他閉環

- **孤兒頁救回**：`payment-report-tabs` 加第三 tab /payment-project-stats（原本
  任何選單/搜尋都到不了）；navigation.ts tabPages 群補條目 → Cmd+K 可搜
- **駕駛艙 StatCard 可點擊**：收入/成本/淨利 → /financial-dashboard、
  待付總額 → /bills（看到數字能點開明細）
- **欠款雙頁交叉連結**：/debts ↔ /enforcement 頁首互相指引
- **死碼清理**：navigation.ts `mobileTabItems` 移除（href 指向 3 個不存在路由、
  無人 import、誤用即 404）
- **導航補漏**：/admin/cron-health 掛進系統管理群（原僅深連結可達）

## 影響範圍

- 新增：link-tabs / payment-action-tabs / scenario-tabs / schedule-tabs（4 元件）
- 修改：payment-report-tabs（改用 LinkTabs + 第三 tab）、navigation.ts、
  8 個頁面插入 tab 列、financial-cockpit（StatCard href）、debts/enforcement（交叉連結）
- 零後端變更、零路由變更（只加導覽、不改 URL）

## 驗證

- tsc 乾淨、eslint 無新增警告（僅既有基線）
- 全套 2391/2391 通過
- 期間排除兩個環境問題（與程式碼無關）：
  1. 本地 DB 測試殘留 21.6 萬筆（測試小孩零用金 12.4 萬筆等）→ 清理 + VACUUM，
     subcategory 測試 15s timeout 消失；殘餘 9.2 萬筆有 FK 擋、留待 sync:prod 重建
  2. OrbStack（Docker daemon）崩潰造成 ECONNREFUSED 亂序失敗 → 重啟後全綠

## 已知限制 / 後續（階段 3、4）

- 前端 14 個巨檔 >800 行未拆（最大 family.tsx 1335）
- `t_wodao` search_path 硬編 4 檔待抽常數
- `installment_plans` 殘留表待評估
- 儀表板內容級去重（cockpit 與 financial-dashboard 的重疊區塊）未做 —
  tab 列已讓互達成本降到最低，內容合併留待真實痛點出現再做

## 相關文件

- [2026-07-08-unified-cashflow.md](2026-07-08-unified-cashflow.md)（階段 1 + 四階段計畫）
- CHANGELOG 1.4.1
