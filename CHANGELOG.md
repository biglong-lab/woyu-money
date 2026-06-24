# 更新紀錄 (CHANGELOG)

所有重要的變更都會記錄在此檔案中。

格式基於 [Keep a Changelog](https://keepachangelog.com/)，版本編號遵循 [語義化版本](https://semver.org/)。

---

## [1.1.0] - 2026-06-25

### 新功能 — 財務收斂、三大成本矩陣、成本中樞、強制執行 + 帳單時間（opt3 + opt4）

詳見 `docs/changes/2026-06-25-cost-enforcement-bills.md`。部署範圍 `050056c` → `f3a8b9e`。

- **開銷流水帳**（`expense_ledger`，migration 0025）：先記錄後分帳，整合進記帳窗口
- **三大成本矩陣**：固定開銷 `/fixed-expense-matrix`（預算vs實際、點格記付款含收據）、勞健保 `/labor-insurance-matrix`（勞保/健保/勞退×12月）、租金（既有）
- **成本結構中樞** `/cost-overview`：年度五桶 × 12 月、組成占比（月/季/年切換）、`GET /api/dashboard/cost-structure/annual`
- **強制執行管理** `/enforcement`：公文/圈存/分期對帳（強執≈圈存+分期）、公文多檔 OCR 自動帶入、被強執款項分流
- **帳單到期看板** `/bills`：通盤應繳（法定付款日 + 強執分期投影）、最終必繳日 + 罰款風險分級（migration 0028）
- **強執/帳單欄位**：payment_items 加 bill_issued/legal_due/final_due/penalty/enforcement_case；templates 加 bill/legal/final day（migration 0026~0028）

### 改善

- **成本結構**：流水帳併入（第 6 桶）、年度視圖下鑽三大矩陣
- **固定開銷模板頁**：月份範圍放寬（過去36月~未來12月）、修 UTC 偏移；雙段釐清（本月待辦／模板設定）、立即產出降級為補產本月、修待填列表刷新
- **專案系統請款嫁接**：`/integrations` 一鍵樣板 + runbook

### SSH 部署備註

- 生產 SSH 埠改為 `52099`（非 22）；容器 app=`woyu-money` / db=`woyu-money-db`
- migration 用 `docker exec -i woyu-money-db psql < migrations/*.sql`

---

## [1.0.5] - 2026-05-19

### 改善 — UX 細部優化連續 loop（12 phase、38 commit）

**Phase 1-5 (`c7a7a61` ~ `7ca2d46`) — 元件 / 功能**
- **共用 BackToTop 按鈕**：滾動 400px+ 顯示、右下浮動、套用至 dashboard / forecast / scenario
- **場景儲存（沙盤推演）**：localStorage、上限 20、可命名 / 套用 / 刪除 / 覆蓋
- **useDocumentTitle 全頁覆蓋**：60/60 = 100%（24 頁批次補完、瀏覽器分頁可區分 + 緊急數量前綴）
- **recurring-expenses 月份快速跳轉**：上月 / 本月 / 下月 三鍵組（單擊切換）
- **late-fee 法規建議改 Dialog**：顯示「當前 → 建議值」對照（🟢 啟用 / ⚪ 停用 / 🟡 調整）
- **command-palette 擴增**：加「➕ 快速動作」6 項 + 「🕘 最近訪問」（localStorage 上限 6）
- **scenario-simulator 匯出 CSV**：BOM + UTF-8、含參數 / 對比 / 模板覆寫

**Phase 6 (`c6d2856`) — 跨裝置與多館**
- **dashboard 單館切換**：合計 + 各館按鈕（影響未來 3 月 forecast、YTD 維持合計並標示）
- **scenario JSON 匯出 / 匯入**：純前端跨裝置遷移、merge by name、檔案格式驗證

**Phase 7-9 (`1af3323` ~ `e3b2fec`) — 無障礙系統補完**
- **icon-only Button aria-label** × 9（ai-chat-input / ai-assistant / unified-search-filter）
- **TopNavigation aria** × 4（主導航 / 使用者選單 / 完整選單 / hamburger）
- **mobile-tab-bar aria 系統**：TabItem role + aria-label（含 badge）+ aria-current + 鍵盤支援、+ 按鈕 aria-expanded、X 關閉、底部 nav landmark
- **DialogDescription** × 30（pages 6 個 + components 24 個、sr-only fallback、消除全站 Radix a11y warning）
- **SheetDescription**：ai-assistant-sheet

**Phase 10 (`e0536f8` ~ `d869c61`) — 🎯 BackToTop 全站擴散完成**
- 從 Phase 1 的 3 頁、擴散至 **35 個 500 行+ 長頁面**（覆蓋率 **100%**）
- 漸進式：4 → 8 → 12 → 20 → 32 → **35**
- 純 main 元件用 batch script、含 helper functions 手動處理
- 涵蓋：儀表板 / 列表頁 / 管理頁 / 報表頁 / 設定頁

**Phase 12 (`026dd50` ~ `78e1085`) — ✨ 細節打磨（9 commit）**
- BackToTop 加滾動進度環（SVG 0~100% 平滑動畫）+ 觸覺回饋
- command-palette：清除最近訪問、快捷鍵 footer、當前頁徽章
- scenario：場景顯示日期、按時間排序、字數計數、重置模板按鈕
- 金額可複製按鈕：/receipt-match-helper、/cash-allocation
- 全部基於既有 hooks（useCopyAmount）、一致 UX 模式

**Phase 11 (`9a9dff1` ~ `8316879`) — 🎯 confirm() → AlertDialog 改造（100%）**
- 將 **18 處** `window.confirm()` 全數替換為 Radix AlertDialog（覆蓋率 **100%**、18/18）
- Pages 改造 12 處 + Components 改造 6 處
- 統一模式：`setDeleteTarget` state + AlertDialog + 紅色 destructive 樣式
- 特殊處理：scenario-simulator 覆寫場景用 `commitSaveScenario` helper 拆分流程
- a11y 提升：Tab/Esc/Enter 鍵盤、aria-modal、具名提示「將刪除 X」、不再阻斷主執行緒

完整紀錄：[`docs/changes/2026-05-19-ux-detail-optimization-loop.md`](docs/changes/2026-05-19-ux-detail-optimization-loop.md)

### 仍待做（follow-up）
- dashboard YTD 加 project→company mapping（徹底支援單館切換）
- /scenario-simulator 比較模式（對比 2 個場景）

### Commit 範圍（38 commits、跨 38 輪 dynamic loop）
- Phase 1-9：`c7a7a61` → `5646506` → `59e92f4` → `c204a6a` → `7ca2d46` → `c6d2856` → `1af3323` → `95f376c` → `a3231a1` → `c9ec014` → `e3b2fec` → `79b2ac2` → `a31df19` → `5694d93`
- Phase 10：`e0536f8` → `5a90da1` → `bdbb7af` → `5f251c2` → `d869c61` → `47b0e79`
- Phase 11：`9a9dff1` → `eb71934` → `8172790` → `be6d8b9` → `81d2416` → `2e495b1` → `061a920` → `8316879`
- Phase 12：`026dd50` → `4dfd885` → `c3dda8a` → `804ead2` → `3c54e37` → `b46a467` → `3b07446` → `78e1085`

---

## [1.0.4] - 2026-05-16

### 新功能 / 對外 API
- **通用整合 API 框架（5 phase）**：擴展原本的 income webhook 為通用「integration」框架
  - Phase 1：新建 `integration_events` 通用拋接紀錄表（跨 income/expense）
  - Phase 2：新建 `/api/expense/webhook/:sourceKey` 端點 + `expense_sources` / `expense_webhooks` 表（鏡像 income 架構）
  - Phase 3：新建「整合中心」UI `/integrations`（3 tab：進帳 / 支出 / 拋接紀錄）
  - Phase 4：串接測試工具 — 後端可產含正確簽章的 sample payload + Replay 功能
  - Phase 5：規範文件 `docs/integration-api.md` v2.0 + `docs/openapi.yaml`

### 規範文件
- 新增 [`docs/integration-api.md`](docs/integration-api.md) — 通用 API 對接規範（給對接人 / AI 看）
- 新增 [`docs/openapi.yaml`](docs/openapi.yaml) — OpenAPI 3.0 spec（可導入 Swagger UI / Postman / openapi-generator）
- 完整變動紀錄：[`docs/changes/2026-05-16-integration-api-spec.md`](docs/changes/2026-05-16-integration-api-spec.md)

### 影響
- DB：新增 3 張表（`integration_events`、`expense_sources`、`expense_webhooks`）
- 既有 `/api/income/webhook/*` 完全相容、無 breaking change
- 「整合中心」入口已加入導航「系統管理」區

---

## [1.0.3] - 2026-05-14

### 新功能 / UX
- 新增 Cmd+K 全域快速跳轉（CommandPalette）(b7dd915)
  - 桌面 TopNavigation 加搜尋按鈕，含快捷鍵提示
  - 模糊搜尋所有導航項目、按分類顯示
  - 「/」鍵也能在非編輯狀態觸發

### 重構 / 對焦
- 網站工具聚焦優化（5 phase）(6b7e097)
  - 首頁 TodayFocusCard 推到第 1 位（原排第 3）
  - 手機「更多」popup 從 22 項 flat 改為 3 分區（助理/查看/系統）
  - 「統一查看」12 項重排序：直達 → 報表 → 分析 → 預算（emoji 視覺分群）
  - 清理舊頁面導航入口（/financial-overview 舊版、5 個舊分類管理頁、雙路徑別名）
  - 路由全部保留供深度連結

### 文件
- 新增 [docs/changes/2026-05-14-navigation-focus-optimization.md](docs/changes/2026-05-14-navigation-focus-optimization.md)

---

## [1.0.2] - 2026-05-14

### 修復
- 修復文件收件箱多檔上傳「未預期的檔案欄位」誤導性錯誤 (f817490)
  - 一次上傳上限 10 → 20 個
  - 超過上限的錯誤訊息改為「一次最多上傳 20 個檔案，請分批上傳」
  - 前端 handleUpload 加入 files.length > 20 預檢
- 修復 `/api/budget/plans/:id` 無效 ID 回 404 而非 400 (5dce558)
  - 移除過度防禦的 regex 限制（`:id(\\d+)`），讓 isNaN 檢查生效

### 維運 / 文件
- 補齊 `docs/` 骨架（architecture / domains / decisions / runbooks / changes / archive）
- 新增 [部署 SOP](docs/runbooks/deploy.md)（SSH 連線、一鍵部署、驗證、回滾、踩坑）
- 新增 [DB Schema 同步 SOP](docs/runbooks/db-migration.md)（drizzle-kit push、生產紀律）
- 新增 [Git 分叉處理 SOP](docs/runbooks/git-divergence.md)（auto-save hook 配 reset --hard 流程）
- 完整變動紀錄：[docs/changes/2026-05-14-document-inbox-upload-fix.md](docs/changes/2026-05-14-document-inbox-upload-fix.md)

### 工程紀律
- 本地 DB 跑 `drizzle-kit push --force` 補齊與 origin/main 漂移的 schema（budget_items.attribution 等）

---

## [1.0.1] - 2026-03-03

### 新功能
- 建立完整版本管理與安全部署工作流程 (00c959a)
- 新增生產環境同步與開發啟動腳本 (afc68bb)
- 優化手機版 Tab Bar 與新增家庭財務路由 (ce21275)
- 建立測試框架與核心單元測試 (ee01bb6)
- 全面優化功能架構 — 導航重組、人事費管理、智慧排程、財務報表 (dde40dd)
- 整合專案結構並遷移至本地開發環境 (6e539b5)

### 修復
- 修復 admin.test.ts 在無 DATABASE_URL 時載入失敗 (c75ba4d)
- 修復快速付款搜尋無法顯示項目的問題 (44eb58f)
- 修正 CSS @import 順序避免 Vite 編譯錯誤 (586e13b)
- 清理舊檔案並修復全部 605 個 TypeScript 錯誤 (0bbb379)
- 修復報表 API 並新增稅務報表功能 (712783f)

### 重構
- 拆分 storage/admin.ts 為 8 個模組化檔案 (78da74a)
- 拆分所有超過 800 行的前端頁面為模組化子組件 (312f56c)
- 重構伺服器架構為模組化設計 (4cca5c2)

### 文件
- 新增全面優化報告文件 (1ef62ab)

### 雜項
- 初始化浯島財務管理系統備份倉庫 (97b7e66)---

## [未發布] - 2026-03-03

### 新功能
- 新增生產環境同步與開發啟動腳本 (afc68bb)
- 優化手機版 Tab Bar 與新增家庭財務路由 (ce21275)
- 建立測試框架與核心單元測試 (ee01bb6)
- 全面優化功能架構 — 導航重組、人事費管理、智慧排程、財務報表 (dde40dd)
- 整合專案結構並遷移至本地開發環境 (6e539b5)

### 修復
- 修復快速付款搜尋無法顯示項目的問題 (44eb58f)
- 修正 CSS @import 順序避免 Vite 編譯錯誤 (586e13b)
- 清理舊檔案並修復全部 605 個 TypeScript 錯誤 (0bbb379)
- 修復報表 API 並新增稅務報表功能 (712783f)

### 重構
- 拆分 storage/admin.ts 為 8 個模組化檔案 (78da74a)
- 拆分所有超過 800 行的前端頁面為模組化子組件 (312f56c)
- 重構伺服器架構為模組化設計 (4cca5c2)

### 文件
- 新增全面優化報告文件 (1ef62ab)

### 雜項
- 初始化浯島財務管理系統備份倉庫 (97b7e66)
