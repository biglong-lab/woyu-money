# 浯島財務管理系統 - 開發進度

## 專案狀態：開發中

**最後更新**: 2026-02-07

---

## 目前階段：系統規範合規修正

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

### 進行中
（無）

### 待處理 — 依優先級排列

#### 持續改善
- [ ] 測試覆蓋率提升至 80%（目前 42.44%，需增加更多路由和 storage 層測試）
- [ ] E2E 測試（Playwright 關鍵流程）
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
