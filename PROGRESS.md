# 浯島財務管理系統 - 開發進度

## 專案狀態：開發中

**最後更新**: 2026-04-25
**最新提交**: `a7bb6db` — 已推送至 GitHub

---

## 🎯 當前階段：財務決策助理改造（Loop 推進中）

**核心目標**：把系統從「讓人焦慮的記帳工具」改造為「主動幫我省力的財務決策助理」。

### 10 步實施計畫進度

- [x] **第 1 步：優先付款清單 CLI 腳本**（今日止血工具）
  - 新增 `shared/payment-priority.ts` — 5 維度優先級演算法（495 行）
  - 新增 `scripts/priority-payment-list.ts` — CLI 腳本（205 行）
  - 新增 `tests/unit/payment-priority.test.ts` — 43 個單元測試（462 行）
  - 9 種分類規則：勞健保/稅/銀行貸款/信用卡/水電/保險/租金/廠商/其他
  - 每類別自帶：滯納金率、違約後果權重、彈性空間
  - 輸出 Markdown：critical/high/medium/low 分群 + 預算缺口計算
  - **覆蓋率：97.87% (Stmts) / 84.37% (Branch) / 100% (Funcs)**
  - 使用：`npx tsx scripts/priority-payment-list.ts --budget 300000`
- [x] **第 2 步：智能優先級演算法 Service 層**（server/services/payment-priority.service.ts）
  - 新增 `server/services/payment-priority.service.ts`（268 行）
  - 新增 `tests/unit/payment-priority-service.test.ts`（24 個單元測試，402 行）
  - 純函式：`buildPriorityReport`、`buildAllocation`、`mapRawRowsToInputs`
  - 依賴注入：`getPriorityReportWith(fetcher, opts)`、`suggestAllocationWith(fetcher, input)`
  - 公開 API：`getPriorityReport()`、`suggestAllocation({ availableBudget })`
  - 現金分配演算法：critical/high 強制 suggested，medium/low 依預算決定，含 shortage/surplus
  - DB 查詢延遲載入（`await import("../db")`），單元測試不觸發連線
  - **覆蓋率：100% (Stmts/Branch/Funcs/Lines 全滿)**
- [x] **第 3 步：現金分配引擎（全部完成）**
  - **後端 API**：
    - `server/routes/payment-allocation.ts`（72 行）
    - `tests/integration/payment-allocation.test.ts`（14 個整合測試，252 行）
    - Endpoints：
      - `GET /api/payment/priority-report?includeLow=true`
      - `POST /api/payment/allocation-suggest`（body: `{ availableBudget, asOf? }`）
    - Zod 驗證 + 整合測試使用 `vi.mock` 隔離 service，不依賴 DB
    - 路由覆蓋率 100% (Stmts/Funcs/Lines)
  - **前端頁面** `/cash-allocation`：
    - `client/src/pages/cash-allocation.tsx`（383 行）
    - 表單輸入可動用金額 → 呼叫 `POST /api/payment/allocation-suggest`
    - 摘要卡：可動用金額 / 必須支付 / 可延後 + 缺口/餘額警示
    - 依 urgency 分 4 群顯示（critical/high/medium/low）
    - 每筆項目顯示：到期日、滯納金累積、每日新增滯納金、原因說明
    - 響應式設計（手機 + 桌面）
    - 掛載至 App.tsx 路由 `/cash-allocation`
- [x] **第 4 步：首頁今日焦點改版（破解逃避心理）**
  - 新增 `client/src/components/today-focus-card.tsx`（473 行，獨立可重用元件）
  - 嵌入 `client/src/pages/payment-home.tsx` 頂部（「快速動作區」之後）
  - 核心互動：
    - 預設只顯示 1 件事（最該付的）
    - 「✅ 已付款」→ Dialog 確認日期 → 標記為已付 → 自動顯示下一件
    - 「⏰ 晚點再看」→ 本 session 內跳過，可復原
    - 漸進揭露：本日（critical）→ 本週（+high）→ 本月（+medium）→ 全部（+low）
  - 明示拖延成本：每筆顯示「已產生滯納金 + 每拖一天再多 $XXX」
  - 呼叫既有 API：`POST /api/payment/records`（和 quick-payment 相同模式）
  - 空狀態：逐層顯示成就感文案
- [x] **第 5 步：勞健保滯納金監控（全部完成）**
  - 5a：`shared/late-fee-tracker.ts`（229 行）+ 35 個單元測試
    - `isLaborInsurance`、`calculateUnpaidLateFee`、`calculatePaidLateFee`
    - `aggregateAnnualLoss`、`getReminderLevel`（20/25/28 三層）
  - 5a：`server/services/late-fee.service.ts`（247 行，DI）
    - 純函式 + 注入式 + 公開 API
  - 5b：**`server/routes/late-fee.ts`**（65 行，API endpoints）
    - `GET /api/late-fee/annual-loss?year=YYYY` — 年度損失報告
    - `GET /api/late-fee/reminder-status` — 今日提醒狀態
    - Zod 驗證 year 範圍 2000-2100
  - 5b：`tests/integration/late-fee.test.ts`（12 個整合測試）
  - 5b：掛載至 `server/routes/index.ts`
  - 5c：`client/src/pages/labor-insurance-watch.tsx`（前端儀表頁）+ App.tsx 路由 → **第 5 步全部完成**
- [~] **第 6 步：LINE 雙向互動（純函式完成，webhook 待 token）**
  - `shared/line-bot-utils.ts`：每日推播訊息建構 + 回覆解析（1 / 1 延 3 / help）
  - 21 個單元測試全通過
  - webhook route 需 `LINE_BOT_CHANNEL_ACCESS_TOKEN`，等使用者提供後補上
- [ ] 第 7 步：租金月度矩陣視圖
- [ ] 第 8 步：批次建立與複製
- [ ] 第 9 步：現金流決策中心（加入收入預估）
- [ ] 第 10 步：收據 AI 自動對應（改為匹配既有項目）

---

## 先前階段：手機端 UX 優化

### 已完成
- [x] Replit → 本地環境遷移（PostgreSQL、檔案儲存、Vite 設定）
- [x] server/routes.ts (5,186 行) 拆分為 19 個路由模組
- [x] server/storage.ts (5,940 行) 拆分為 22 個儲存模組
- [x] 605 個 TypeScript 錯誤修復
- [x] CSS @import 順序修正
- [x] 手機版 Tab Bar 優化
- [x] 測試框架建立（Vitest）
- [x] 快速付款搜尋修復
- [x] Git 遠端倉庫設定 (github.com/biglong-lab/woyu-money.git)
- [x] **P0: 拆分 shared/schema.ts** (1,195 行 → 10 個模組: base, category, payment, rental, loan, household, document, hr, relations, index)
- [x] **P0: 拆分 cashflow-forecast.tsx** (933 行 → 4 個模組: types, use-cashflow-data, detail-popovers, index)
- [x] **P0: 移除 console.log 殘留** (清除 35 處，含密碼洩露風險修復)
- [x] **P1: 修復 SQL 注入漏洞** (payment-items.ts, payment-records.ts, rental.ts 全部改為參數化查詢)
- [x] **P1: 建立核心測試** (61 個測試通過: constants 14, schema-validation 21, schedule-utils 17, insurance-utils 9)
- [x] **P1: 安裝覆蓋率工具** (@vitest/coverage-v8, shared/ 模組覆蓋率: constants 100%, schedule-utils 84%)
- [x] **P2: 消除 any 類型 - 核心路由** (129+ 個: auth, categories, payment-records, payment-items, admin, budget)
- [x] **P2: 建立 GitHub Actions CI** (.github/workflows/ci.yml)
- [x] **P2: 消除 any 類型 - routes 批次** (10 檔案完全清除: rental, reports, document-inbox, analytics, payment-schedule, loans, hr-costs, household, notifications, invoice)
- [x] **P2: 消除 any 類型 - storage 批次** (18 檔案完全清除: household, payment-items, statistics, rental, payment-records, loans 等)
- [x] **P2: 消除 any 類型 - server 根目錄** (9 檔案 29 個 any 清除: db, index, vite, line-auth, document-ai, notification-system, notification-routes, security, batch-import-processor)
- [x] **提升測試覆蓋率** (89 測試通過，shared/ 100% 覆蓋率: insurance-utils 34 測試、schedule-utils 20 測試、constants 14 測試、schema-validation 21 測試)

- [x] **第一波安全基礎 (P0)** — 全部完成
  - [x] 啟用安全中間件（securityHeaders、validateInput、rateLimits 掛載至 index.ts）
  - [x] 全域 API 認證保護（/api 路由全域 requireAuth，白名單排除 login/register/user/line）
  - [x] 修復 Session 設定（sameSite: lax、生產環境強制 SESSION_SECRET、body size 10kb 限制）
  - [x] 密碼強度驗證（至少 8 字元，需含字母和數字）
  - [x] requireAuth 加入 isActive 帳號停用檢查
  - [x] 移除 init-admin.ts 硬編碼密碼（改用環境變數 ADMIN_USERNAME/ADMIN_PASSWORD）
  - [x] 檔案上傳加認證（/uploads、/objects 靜態路由加 requireAuth）
  - [x] 修復 objectStorage.ts 路徑穿越漏洞（path.resolve + startsWith 驗證）
  - [x] fileUpload、paymentFileUpload 加檔案類型過濾

- [x] **第二波穩定性與錯誤處理 (P1)** — 全部完成
  - [x] 採用錯誤處理框架（asyncHandler + globalErrorHandler 套用至 15 個路由、196+ handler）
  - [x] 修復 7 個路由 Storage 層繞過（新建 5 個 storage 模組: budget、hr-costs、document-inbox、invoice、financial-reports，擴充 payment-records 3 個方法）
  - [x] npm audit 漏洞評估（esbuild dev-only 低風險、xlsx 無修復方案，記錄待後續遷移 exceljs）

- [x] **第三波程式碼品質 (P2)** — 全部完成
  - [x] ESLint + Prettier 設定（eslint v9 flat config、typescript-eslint、react-hooks、prettier 整合）
  - [x] 18 個 ESLint errors 修復（prefer-const、no-case-declarations、no-useless-assignment 等）
  - [x] 前端元件拆分：3 個最大元件拆分為模組化目錄
    - hr-cost-management.tsx (751 行 → 6 個檔案)
    - unified-payment-simple.tsx (755 行 → 7 個檔案)
    - contract-detail.tsx (713 行 → 10 個檔案)
  - [x] 剩餘 21 個 500-776 行檔案均在 800 行上限內，標記為可接受

- [x] **第四波測試與 CI/CD (P2)** — 全部完成
  - [x] husky + lint-staged 設定（pre-commit: prettier + eslint 自動檢查）
  - [x] API 整合測試建立：4 個測試檔案，67 個新測試
    - auth.test.ts: 15 測試（登入/登出/session/註冊/認證保護）
    - payment-items.test.ts: 22 測試（CRUD/分頁/篩選/統計）
    - categories.test.ts: 18 測試（分類/專案 CRUD/各類查詢）
    - payment-records.test.ts: 12 測試（記錄 CRUD/現金流/備註）
  - [x] 測試基礎設施（tests/helpers/test-app.ts: createTestApp + createAuthenticatedAgent）
  - [x] **總測試: 156 個通過**（單元 89 + 整合 67）
  - [x] 覆蓋率: 25.14%（核心路由已覆蓋，需繼續提升至 80%）

- [x] **第五波測試擴展 (P2)** — 全部完成
  - [x] 新增 9 個整合測試檔案，107 個新測試
    - rental.test.ts: 11 測試（租約 CRUD/價格層級/付款/統計）
    - loans.test.ts: 19 測試（借貸 CRUD/還款/驗證/統計/利息計算）
    - household.test.ts: 13 測試（分類/預算/支出 CRUD）
    - budget.test.ts: 16 測試（預算計劃/項目 CRUD/摘要）
    - notifications.test.ts: 7 測試（通知列表/已讀/設定）
    - hr-costs.test.ts: 14 測試（員工 CRUD/薪資計算/月度人事費/彙總）
    - reports.test.ts: 9 測試（損益表/資產負債表/現金流/稅務報表）
    - analytics.test.ts: 4 測試（專案統計/現金流統計）
    - payment-schedule.test.ts: 14 測試（排程 CRUD/逾期/智慧排程/整合資料）
  - [x] **修復 2 個生產 bug**:
    - loans.ts: `interest_rate` 欄位不存在 → 改為 `annual_interest_rate`
    - loans.ts: 月份溢出 bug（12 月時 month+2=14）→ 改用 Date 物件自動處理
  - [x] **總測試: 263 個通過**（單元 89 + 整合 174）
  - [x] 覆蓋率: 42.44%（從 4.66% 提升至 42.44%）

- [x] **前端 any 類型消除（第一批）** — 10 個檔案完成
  - [x] 消除 197 個 `@typescript-eslint/no-explicit-any` warnings（762 → 565）
  - [x] 修復 23 個引入的 TypeScript 編譯錯誤（型別不匹配、null 處理等）

- [x] **前端 any 類型消除（全部完成）** — 83 個檔案，565 → 0
  - [x] 第二批：10 檔案消除 108 個（quick-payment-dialog, loan-payment-history, rental-contract-dialog/list, use-filtered-payment-items, document-inbox, user-management, batch-import-wizard, daily-revenue-dialog, responsive-chart）
  - [x] 第三批：14 檔案消除 69 個（use-payment-project-mutations, integrated-payment-analysis-optimized, recycle-bin, category-list-panel, loan-document-export, payment-schedule-optimized, 6×4-any 檔案, 3×4-any 檔案）
  - [x] 第四批：48 檔案消除剩餘 90 個（transaction-form, project-subcategory-management 等 9 個 3-4 any 檔案 + 30 個 1-2 any 檔案）
  - [x] 最終清理：修復 build-error-resolver 引入的 `as any`，全部改為 `FieldValues`/`as unknown as` 等正確型別
  - [x] **最終結果：762 → 0 個 any warnings，83 個檔案全部清除**

- [x] **版本管理與安全部署工作流程** — 全部完成
  - [x] commit-msg hook：驗證 Conventional Commits 格式（feat/fix/refactor/...）
  - [x] CHANGELOG 自動產生：依 commit type 分類、markdown 格式化
  - [x] release 腳本：語義化版本遞增、自動測試、CHANGELOG 產生、git tag
  - [x] pre-push hook：TypeScript 檢查 + console.log 掃描 + 測試 + 推送摘要
  - [x] dev-start.sh 整合版本號與 CHANGELOG 顯示
  - [x] package.json 新增 release:patch/minor/major、changelog 指令

- [x] **第六波測試覆蓋率提升至 80%** — 全部完成
  - [x] 修復 dotenv 載入時序問題（setup.ts 模組頂層載入，解決 285 個測試被跳過）
  - [x] 修復 admin 角色、categories categoryType、rental 驗證等測試失敗
  - [x] 設定 fileParallelism: false 避免 DB 競爭條件
  - [x] 排除非核心檔案（pm-bridge、pms-bridge、vite.ts）
  - [x] 批次新增 60 個測試檔案、1559 個測試
    - 整合測試: income, daily-revenues, document-inbox-crud/archive, statistics, analytics-extended, financial-reports, rental-extended, loans-extended, payment-extended, household-extended, notifications-extended, admin-extended, ai-assistant/extended, subcategory-payments, statistics-extended, overdue-batch, hr-costs, upload-config
    - 單元測試: security, routes-helpers, file-upload-utils/extended, error-handler, storage-helpers/extended, batch-import-processor, notification-system, object-storage, schema-extended, auth, document-ai, init-admin, db, storage-household, storage-notifications, storage-hr-costs, storage-admin, storage-invoice, storage-project-stats, storage-users
  - [x] **最終結果: 60 個測試檔案、1559 個測試全部通過**
  - [x] **覆蓋率: 80.45% (Stmts) / 66.11% (Branch) / 82.73% (Funcs) / 81.04% (Lines)**
  - [x] 覆蓋率歷程: 4.12% → 46.2% → 54.66% → 62.22% → 66.3% → 76.22% → 80.45%

- [x] **文件上傳 500 錯誤修復** (2026-04-09) — 全部完成
  - [x] 新增 multer 錯誤處理中間件（檔案過大、格式不支援等返回明確 400 錯誤訊息）
  - [x] 上傳前驗證 uploads/inbox 目錄存在且可寫入
  - [x] 多檔上傳改為個別檔案獨立 try-catch（單一檔案失敗不影響其他）
  - [x] 改善全域錯誤處理器：記錄完整請求路徑和錯誤堆疊
  - [x] 新增 Docker entrypoint 腳本（docker-entrypoint.sh）解決 volume 權限問題
  - [x] 啟動時驗證上傳目錄可寫入並記錄日誌
  - [x] 修改檔案：server/routes/document-inbox.ts、upload-config.ts、middleware/error-handler.ts、Dockerfile、新增 docker-entrypoint.sh
  - [x] 本地測試：單張/多張上傳、格式驗證、無檔案、整合測試全部通過
  - [x] **提交 `a7bb6db`** 已推送至 GitHub main，Coolify 自動部署

- [x] **E2E 測試（Playwright 關鍵流程）** — 全部完成
  - [x] Playwright 1.58.2 安裝與配置
  - [x] 全局認證設定（storageState 模式，避免重複登入觸發速率限制）
  - [x] 8 個 E2E 測試檔案、39 個端對端測試全部通過
    - auth.spec.ts: 5 測試（登入頁面、API 登入、錯誤帳密、未授權保護、註冊表單）
    - dashboard.spec.ts: 4 測試（首頁內容、導航列、頁面導航、搜尋功能）
    - navigation.spec.ts: 2 測試（首頁載入、404 頁面處理）
    - payment-items.spec.ts: 8 測試（月付/一般/分期/租金/借貸/人事費管理、新增對話框、付款記錄）
    - categories.spec.ts: 4 測試（分類列表、固定分類、專案模板、專案付款）
    - reports.spec.ts: 8 測試（財務總覽/三表、稅務/人事費/付款/收入/付款分析報表、專案預算）
    - household.spec.ts: 2 測試（家庭預算、家庭分類管理）
    - system.spec.ts: 6 測試（使用者管理、回收站、設定、帳號、付款計劃、單據收件箱）
  - [x] 開發環境速率限制調整（auth 50次/15分鐘、general 1000次/分鐘，生產環境不變）
  - [x] npm scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:report`

- [x] **手機端 UX 優化（Phase 1-5）** (2026-04-12) — 全部完成
  - [x] Phase 2: 快取策略修復 — 資料即時性
    - refetchOnWindowFocus: true（切回自動刷新）
    - staleTime: 30 秒（從 10 分鐘降低）
    - refetchOnMount: true（進頁面自動刷新）
    - gcTime: 5 分鐘（從 30 分鐘降低）
  - [x] Phase 1A: 首頁快速記帳入口
    - 新增 quick-add-drawer.tsx：底部抽屜式快速記帳（項目名+金額+專案+到期日+拍照）
    - 新增 useQuickCameraUpload hook：一鍵開相機上傳到單據收件箱
    - 首頁置頂兩大按鈕：「拍單據」+「手動記帳」
    - 新增「記錄已付款」快速入口
  - [x] Phase 3A: 首頁重設計為行動中心
    - 快速動作區（置頂）：拍單據 + 手動記帳 + 記錄付款
    - 待處理區：待歸檔單據提示 + 緊急付款項目（可直接點擊付款）
    - 精簡統計卡片、排程和最近記錄
  - [x] Phase 5A: 簡化單據上傳流程
    - 快速拍照不需選擇文件類型（自動為 bill）
    - 不需填備註即可上傳
  - [x] Phase 4A: Tab Bar 導航精簡
    - 重新設計：首頁 | 項目 | (+記帳) | 單據 | 更多
    - 中間大圓按鈕：展開拍單據/手動記帳/記錄付款三選項
    - 單據 Tab 加未處理數量徽章（10 秒更新）
    - QuickActionFAB 改為僅桌面版顯示
  - [x] 修改檔案：queryClient.ts, payment-home.tsx, mobile-tab-bar.tsx, App.tsx, 新增 quick-add-drawer.tsx

### 進行中
（無）

### 待處理 — 依優先級排列

#### 持續改善
- [x] ~~測試覆蓋率提升至 80%~~ ✅ 完成（42.44% → 80.45%，1559 個測試）
- [x] ~~E2E 測試（Playwright 關鍵流程）~~ ✅ 完成（39 個端對端測試）
- [ ] 前端元件目錄重組（80+ 元件按功能分類）[已延遲，等測試安全網完善後再執行]
- [x] ~~漸進消除前端 any 類型~~ ✅ 全部完成（762 → 0）

#### 第五波：進階優化 (P3)
- [ ] PWA 支援（manifest.json + Service Worker）
- [ ] 無障礙改善（aria labels、鍵盤導航）
- [ ] Docker 容器化（Dockerfile + docker-compose）
- [ ] 資料匯入失敗項修復（payment_items 5 筆 FK、rental_contracts 2 筆 NOT NULL）
- [ ] API 文件

---

## 資料庫狀態

| 表格 | 筆數 | 備註 |
|------|------|------|
| users | 12 | 含 admin |
| payment_projects | 10 | |
| payment_items | 1,469 | 5 筆 FK 失敗 |
| payment_records | 336 | 2 筆 FK 失敗 |
| document_inbox | 27 | |
| rental_contracts | 3 | 2 筆 NOT NULL 失敗 |
| debt_categories | 55 | |
| budget_plans | 3 | |
| household_budgets | 4 | |

---

## 環境資訊

- **PostgreSQL**: Docker `woyu-postgres`，port 5434
- **開發 Port**: 5001
- **預設帳號**: admin / admin123
