# UX 細部優化連續 loop — 2026-05-19

> 範圍：前端 UI / UX 細部優化（無 schema / 部署相關變動）
> 狀態：✅ 已上線（main）、待 SSH 部署生產
> commit 範圍：`c7a7a61` ~ `7ca2d46`（共 5 個 squash commit）

---

## 背景

5/18 收入預測 + 沙盤推演 + 滯納金規則編輯 + 全域 Cmd+K 等大型 feature 上線後（2026-05-18-forecasting-engine.md），進入細部打磨期。使用者明確指示「dynamic loop、2 分鐘節奏」、每輪推進一兩個小優化、tsc + tests 全綠才推送。

5 輪累積完成的細部優化。

---

## 影響範圍

| 區塊 | 檔案 |
|------|------|
| 共用元件 | `client/src/components/back-to-top.tsx`（新）|
| 共用元件 | `client/src/components/command-palette.tsx`（擴增 3 區）|
| 頁面 | `client/src/pages/scenario-simulator.tsx`（場景儲存 + CSV 匯出）|
| 頁面 | `client/src/pages/recurring-expenses.tsx`（月份快速跳轉）|
| 頁面 | `client/src/pages/late-fee-settings.tsx`（法規建議 dialog）|
| 頁面 × 24 | useDocumentTitle 全覆蓋（auth / settings / reports / loan / project / 等）|
| 頁面 | `client/src/pages/revenue-forecast.tsx`（RWD + 資料新鮮度標示）|
| 頁面 | `client/src/pages/financial-dashboard.tsx`（套用 BackToTop）|

---

## 解決方案

### Phase 1（commit `c7a7a61`）— 浮動 BackToTop + 場景儲存

- 新元件 `<BackToTop>`：滾動超過 400px 才出現、右下浮動、平滑回頂、手機/桌面定位皆調適
- 套用至 `/financial-dashboard` `/revenue-forecast` `/scenario-simulator`
- `/scenario-simulator` 加 localStorage 場景儲存（上限 20、可命名 / 套用 / 刪除、覆蓋確認）

### Phase 2（commit `5646506`）— useDocumentTitle 10 頁

- 補登入 / 系統設定 / 使用者管理 / 回收筒 / 三個報表 / 進帳收件箱 / 租金管理 / 月度付款分析

### Phase 3（commit `59e92f4`）— useDocumentTitle 全覆蓋 + 月份快速跳轉

- 用 node script 一次補完剩 14 個次常用頁（loan-investment / project-* / subcategory / 等）
- 覆蓋率：**60/60 = 100%**
- `/recurring-expenses` 月份切換加「上月 / 本月 / 下月」三鍵組（單擊切換、保留完整下拉）

### Phase 4（commit `c204a6a`）— 法規建議 Dialog + Command-Palette Quick Actions

- `/late-fee-settings` 套用法規建議改造：
  - 從直接 toast 改為 Dialog 預覽
  - 每項變更顯示「當前值 → 法規建議值」對照（啟用 / 費率 / 寬限期）
  - 按變更類型上色（🟢 啟用 / ⚪ 停用 / 🟡 調整）
  - 確認後才預載到 state、使用者仍需逐項按「儲存此項」生效
- `/command-palette` 加「➕ 快速動作」分類 6 項：
  - 新增付款項目 / 新增收入紀錄 / 新增週期模板 / 新增租約 / 收據對應 / 沙盤推演

### Phase 5（commit `7ca2d46`）— 最近訪問 + CSV 匯出

- `/command-palette` 加「🕘 最近訪問」分類：
  - localStorage 上限 6、去重、過濾 nav 內項目、排除當前頁
  - 每次 location 變化自動記錄
- `/scenario-simulator` 加「匯出 CSV」按鈕：
  - BOM + UTF-8 編碼（Excel 開不亂碼）
  - 內容：參數 / 收支淨利對比 / 模板覆寫明細
  - 檔名：`沙盤推演_<targetMonth>_<today>.csv`

### Phase 6（commit `c6d2856`）— Dashboard 單館切換 + 場景 JSON 匯出入

- `/financial-dashboard` 標題下加單館切換器（合計 + 各館按鈕、影響未來 3 月 forecast）
- YTD 維持合計（限制標示 amber badge）
- `/scenario-simulator` 場景區加「匯出 / 匯入 JSON」按鈕（merge by name、檔案格式驗證、上限 20）

### Phase 11（commit `9a9dff1` ~ next）— ✅ confirm() → AlertDialog 改造

從原生 `window.confirm()` 改造為 Radix AlertDialog、提升 a11y 與一致性：

- ✅ Pages 改造（11 處）：user-management / category-management / simple-category /
  project-template / loan-investment / project-specific-items /
  rental-management（刪租約 + 刪文件） / account-settings（LINE 解綁） /
  expense-webhooks（拒絕單筆） / integrations-center（撤銷 API key） /
  property-groups（刪群組 + 移除成員）
- ✅ Components 改造（4 處）：household-category-dialog / project-category-dialog /
  active-rentals-card（批量標記已付） / household-category/category-list-panel

🎯 進度：17 / 18 處（94%）

統一改造模式：
- `confirm()` → `setDeleteTarget(item)` 開 Dialog
- `<AlertDialog>` 顯示具名提示「將刪除 X」、紅色 destructive 樣式
- 鍵盤可用：Tab/Esc/Enter
- 螢幕閱讀器：aria-modal、aria-describedby 內建

剩 1 處保留 confirm（scenario-simulator × 2、純前端、純資料覆寫場景）

### Phase 10（commit `e0536f8` ~ `d869c61`）— ✅ BackToTop 全站擴散完成

從 Phase 1 的 3 頁、擴散至 **35 個 500 行+ 長頁面**（覆蓋率 **100%**）：
- 進度：4 頁 → 8 頁 → 12 頁 → 20 頁 → 32 頁 → **35 頁 ✓**
- batch script 自動處理（純 main component 結尾）
- 含 helper functions 的檔案手動處理（避免插到 helper 內）
- 最後完成：financial-statements / recurring-expenses / property-groups-management

涵蓋頁面類型：
- 儀表板（dashboard / overview / scenario / forecast）
- 列表頁（payment-projects / general-payment / payment-records / income-webhooks）
- 管理頁（user / category / project / rental / loan）
- 報表頁（payment-reports / revenue-reports / tax-reports / hr-cost-reports）
- 設定頁（settings / late-fee-settings / recurring-expenses）

### Phase 7-9（commit `1af3323` ~ `e3b2fec`）— 無障礙（a11y）系統補完

**Phase 7（`1af3323`）— icon-only Button aria-label**：補 9 個（ai-chat-input × 2、ai-assistant-sheet × 1、unified-search-filter × 6）

**Phase 8（`95f376c`、`a3231a1`）— TopNavigation / mobile-tab-bar**：
- top-navigation：4 處（主導航 / 使用者選單 / 完整選單 / hamburger）
- mobile-tab-bar：TabItem 加 role + aria-label（含 badge 數）+ aria-current + 鍵盤支援、中間 + 按鈕 aria-expanded、X 關閉、底部 nav aria-label

**Phase 9（`c9ec014`、`e3b2fec`）— Dialog / Sheet Description**：
- pages（6 個）：loan-investment / simple-category / user-management
- components（24 個）：batch / document-inbox / file-upload / general-payment 系列 / installment 系列 / loan 系列 / monthly-payment / quick-payment / rental-contract
- ai-assistant-sheet：SheetDescription（sr-only）

合計修補 30+ 個元件、消除全站 Radix UI a11y warning。

---

## 實作步驟

| Phase | Commit | 主要檔案 |
|-------|--------|----------|
| 1 | `c7a7a61` | `back-to-top.tsx`、`scenario-simulator.tsx` |
| 2 | `5646506` | 10 個頁面 useDocumentTitle |
| 3 | `59e92f4` | 14 個頁面 useDocumentTitle + `recurring-expenses.tsx` |
| 4 | `c204a6a` | `late-fee-settings.tsx`、`command-palette.tsx` |
| 5 | `7ca2d46` | `command-palette.tsx`、`scenario-simulator.tsx` |
| 6 | `c6d2856` | `financial-dashboard.tsx`、`scenario-simulator.tsx` |
| 7 | `1af3323` | `ai-chat-input.tsx`、`ai-assistant-sheet.tsx`、`unified-search-filter.tsx` |
| 8a | `95f376c` | `top-navigation.tsx` |
| 8b | `a3231a1` | `mobile-tab-bar.tsx` |
| 9a | `c9ec014` | 3 個 pages × DialogDescription |
| 9b | `e3b2fec` | 20 個 components × DialogDescription（24 dialogs） |
| 9c | `79b2ac2` | ai-assistant-sheet SheetDescription + docs/CHANGELOG |
| 9d | `a31df19` | /receipt-match-helper 清除按鈕 + BackToTop |
| 9e | `5694d93` | /receipt-match-helper amountInputRef 連續處理 |
| 10a | `e0536f8` | BackToTop 擴增 4 頁（payment-home / cash-allocation / integrations / income-webhooks）|
| 10b | `5a90da1` | BackToTop 再 4 頁（budget / expense-webhooks / general-payment / payment-records） |
| 10c | `bdbb7af` | BackToTop 再 8 頁（categories / rental-management / overview-v2 / 等）|
| 10d | `5f251c2` | BackToTop 再 12 頁（project-budget / payment-stats / 等）|
| 10e | `d869c61` | BackToTop 最後 3 頁（financial-statements / recurring-expenses / property-groups）|

---

## 驗證

- ✅ tsc --noEmit 全綠（每輪皆驗證）
- ✅ 1846 unit / integration tests 全綠（每輪 pre-push）
- ✅ 75 test files
- ✅ ESLint + Prettier 自動格式化通過

手動驗證：
- 在開發環境驗 Cmd+K 開 palette、看到「最近訪問」「快速動作」分組
- 沙盤推演填參數、按匯出 CSV、用 Excel 開沒亂碼
- 滯納金規則按「套用法規建議」、Dialog 顯示對照、按取消能關閉
- /recurring-expenses 點「上月 / 本月 / 下月」按鈕能切換 + 顏色 active 正確
- 長頁面滾下後右下出現 BackToTop 按鈕

---

## 已知限制 / 後續優化

### ✅ 已於後續輪次完成（移出 follow-up）

- ✅ `/financial-dashboard` 單館切換（Phase 6、forecast 部分）
- ✅ 場景匯出 / 匯入 JSON（Phase 6、純前端 + merge by name）
- ✅ 全站 a11y audit + 補完（Phase 7-9、30+ 元件）

### 🔍 仍待做

| 項目 | 狀態 | 備註 |
|------|------|------|
| dashboard YTD 加 companyId 支援 | TODO | 需建 project↔company mapping table |
| `/scenario-simulator` 比較模式 | TODO | 同時對比 2 個場景的差異 |
| `/home` 主頁 RWD 微調 | TODO | payment-home 已 mobile-first、待具體場景反饋 |
| `/receipt-match-helper` 細部優化 | TODO | 待 audit |

---

## 相關文件

- `docs/changes/2026-05-18-forecasting-engine.md` — 預測引擎主架構（這次優化的基底）
- `docs/changes/2026-05-14-navigation-focus-optimization.md` — 導航重整（Cmd+K 從這次開始）
- `docs/runbooks/deploy.md` — SSH 部署 SOP（5 commit squash 上線）
