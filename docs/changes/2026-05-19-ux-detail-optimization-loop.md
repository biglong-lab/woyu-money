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

---

## 實作步驟

| Phase | Commit | 主要檔案 |
|-------|--------|----------|
| 1 | `c7a7a61` | `back-to-top.tsx`、`scenario-simulator.tsx` |
| 2 | `5646506` | 10 個頁面 useDocumentTitle |
| 3 | `59e92f4` | 14 個頁面 useDocumentTitle + `recurring-expenses.tsx` |
| 4 | `c204a6a` | `late-fee-settings.tsx`、`command-palette.tsx` |
| 5 | `7ca2d46` | `command-palette.tsx`、`scenario-simulator.tsx` |

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

### 🔍 已研究、未做（資源 / 範圍考量）

| 項目 | 狀態 | 備註 |
|------|------|------|
| `/financial-dashboard` 單館切換 | ⚠️ 部分可行 | `/api/forecast/*` 全支援 companyId、但 `/api/dashboard/ytd` 沒（payment_items 無 company_id 欄位、需 join project→company mapping）。若做、forecast 切館可立刻、YTD 維持合計 |
| 全站常用按鈕 aria-label / title 補齊 | TODO | 範圍大、需 audit |
| `/home` 主頁 RWD 微調 | TODO | 待具體場景反饋 |
| 場景 / 最近訪問 export / import | TODO | localStorage 跨裝置遷移用 |

### 📦 follow-up 建議實作順序

1. 加 `/api/dashboard/ytd?companyId=` 支援（先建 project↔company mapping table）
2. dashboard 加 companyId 切換器（state + UI + 各 query 傳參）
3. aria-label 全站 audit
4. 場景匯出 / 匯入 JSON（純前端、`localStorage` ↔ `<input type="file">`）

---

## 相關文件

- `docs/changes/2026-05-18-forecasting-engine.md` — 預測引擎主架構（這次優化的基底）
- `docs/changes/2026-05-14-navigation-focus-optimization.md` — 導航重整（Cmd+K 從這次開始）
- `docs/runbooks/deploy.md` — SSH 部署 SOP（5 commit squash 上線）
