# 全系統分析與五階段優化推行 — 2026-07-03

> 範圍：導航整併 / API 品質 / 巨檔拆分 / 架構收尾（Phase 0~4、20 子項全數完成）
> 狀態：✅ 完成（commit `493816a` → `fcec3e9`，已推送 GitHub、未部署）
> 前置分析：3 個並行 agent（架構技術債 / 功能重疊 / DB 與 API 品質）+ 既有稽核（2026-05-23/24）

## 背景

使用者要求「針對系統做完整分析並提出提升功能使用的規劃」後下令全部推行。
分析發現三大問題群：6 個儀表板頁互相重疊且兩頁互稱主入口、
family-kids 技術債持續惡化（route 檔 16,363 行）、API 驗證與治理缺口。

## Phase 0 — 快贏清理

- 刪 4 死頁（forecast-input、3 個 project-template 頁）+ 5 個零引用死導航元件
- `getDebt` 全表載入 → 單筆 where 查詢（storage/debts.ts）
- 查證更正：payment_items 複合索引已存在、enforcement_installment_payments 無 status 欄位
  →「補索引」實為誤報、無需 migration
- Migration 治理文件化（runbooks/db-migration.md）：drizzle journal 凍結、
  禁用 generate、斷號說明、0012 .draft 屬使用者決策
- 孤兒路由補入口：進帳收件箱 / 收入來源 / 收入比對 + 4 個麵包屑

## Phase 1 — 導航與功能整併（使用體驗核心）

- **總覽中心 6 → 3**：駕駛艙（主入口徽章）+ 應付看板 + 成本結構；
  綜合儀表板 / 總覽 v2 / 現金流決策從選單移除、由 OverviewTabs tab 列互達
- **財務總覽 v2 拆散下架**：館組聚合視圖移植至 /property-pl（單館/館組切換）、
  路由 redirect 至駕駛艙
- **沙盤推演二合一**：planner 為唯一導航入口（去 2.0 後綴）、simulator 改名
  「下月精算」由 planner 頁首進入；Cmd+K 與駕駛艙連結同步
- **收入分析三頁收攏**：新 RevenueTabs 串 reports/compare/forecast、導航剩一項
- 手機版「報表 & 設定」選單補上總覽中心群組（原本手機到不了駕駛艙）

## Phase 2 — API 品質與安全

- 修 mass assignment：payment-schedule PUT 整包 req.body 直傳 → 欄位白名單
- 修身分覆蓋：notifications POST 的 spread 順序可讓 body.userId 冒充他人
- 新共用 `routes/request-params.ts`（parseId/optionalInt/intWithDefault/optionalDateStr/handleZod）
  → debts / payment-records / payment-schedule 統一採用
- 認證慣例明文化（index.ts 閘門三條規則：沒加 requireAuth ≠ 公開）
- bills 分期投影抽 `services/bills.service.ts`（16 個新單元測試）：
  修 day_of_month 一律夾 28 的月底失真 + `?days=abc` NaN 進 SQL

## Phase 3 — 巨檔拆分（機械式、腳本驗證 parity）

- `routes/family-kids.ts` 16,363 行 → `family-kids/` 26 子檔 + helpers + index
  （207/207 端點、註冊順序完全一致、全檔 <800 行）
- `pages/family.tsx` 9,524 → 1,187 行；111 卡片 → `components/family/cards-01~14`
  + `family-shared.ts`
- `pages/family-kid.tsx` 4,927 → 37 行；48 元件 → `components/family/kid/kid-01~07`
- 驗證：tsc strict、family-kids 整合測試 411/411 連兩輪、生產 build

## Phase 4 — 架構收尾

- 移除 `DatabaseStorage` God shim（442 → 120 行）：15 檔 203 處 `storage.X()`
  腳本轉為直接 import 領域模組；sessionStore 抽至 `server/session.ts`；
  測試 mock 同步改指領域模組
- 前端 code splitting：60 頁全 lazy + Suspense、127 chunks、
  主 bundle 1.5MB → 648KB（gzip 199KB）
- `routes/household.ts` 1,968 行 → household/ 3 子檔 + helpers（37/37 端點）
- household-budget.tsx 7 張卡抽至 `components/household/budget-cards.tsx`
- 路由順序耦合解除：budget/categories 的 :id 對兄弟字面路徑（by-month/unified）
  明確 fallthrough、垃圾輸入照舊 400

## 驗證

- 全套 2,370 測試通過（vitest 單元+整合；family-kids 偶發失敗為既有跨檔
  狀態污染、清表重跑即過、拆分前已存在）
- tsc strict 全程零錯誤、vite+esbuild 生產 build 全程通過
- pre-push hook 全檢通過 ×4 次推送

## 已知限制 / 後續

- `KidDashboard` 單一元件 1,025 行、`HouseholdBudget` 主元件 ~1,190 行：
  內聚元件的內部拆分屬手工重構、not 機械拆分範圍
- family-kids 測試跨檔狀態污染（run 間偶發 1-3 失敗）：
  根因是其他測試檔寫 kids 資料；建議後續在 tests/setup 加全域 truncate
- 授權仍為「登入 vs 未登入」單層；多用戶隔離屬產品決策
- 分析型端點 207 個未精簡（5/23 稽核建議合併 stats endpoint、未在本次範圍）

## 相關文件

- 前置稽核：[2026-05-24 系統架構盤點](2026-05-24-system-architecture-audit.md)、
  [2026-05-23 功能盤點](2026-05-23-functional-audit.md)
- Migration 治理：`docs/runbooks/db-migration.md`
