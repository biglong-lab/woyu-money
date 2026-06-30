# 歷史欠款整理模組（/debts）— 2026-06-30

> 範圍：過去帳務欠款的獨立登打 → 全貌 → 分期還款 → 歸帳
> 狀態：已上線生產
> 部署 commit 範圍：`d79defb`（模組）→ `2536241`（導航修正）（SSH 手動部署，埠 52099）

## 背景

使用者反映：過去的欠款散落各處，原本想用現有介面（payment_items / 記帳窗口）登錄，但「一直無法順利完成、無法知道所有項目狀況、無法做處理分配」，每次都拖到很急迫才處理，資金掌握困難。

原話需求：
- 「我需要有一個獨立的頁面，可以做紀錄，先紀錄進來，知道所有金額，再來做歸帳與還款計劃規劃分配」
- 「類似現在的記帳窗口，記帳窗口現在是正在進行產生的帳務為主；我需要一個過去帳務的整理入口，可以分類、登打項目、金額、備注內容、上傳圖片單據」
- 「付款可以分期付款紀錄，我要清楚列表付款列表，再來歸帳」

決策（經詢問確認）：
- 歸帳採**獨立標記**（不串現有 payment_items 記帳系統）——最單純、最不會出錯。
- 預設分類採營運常見組合。

## 影響範圍

- 新資料表：`legacy_debts`、`legacy_debt_categories`、`legacy_debt_payments`（migration 0029）
  - ⚠️ 用 `legacy_debt_*` 前綴，避開既有**核心表 `debt_categories`**（科目主表、被 payment_items/budget_items 等引用）撞名
- 新頁：`/debts`；新 API 群：`/api/debts/*`
- 導航：`mainNavItems` 加「歷史欠款整理」（記帳窗口旁、常駐不收合）
- 無既有資料異動、無既有端點變更（完全獨立、加法）

## 解決方案

獨立模組，照信用卡請款紀錄（`/card-claims`）的「獨立記錄工具」範本打造：

- **登打**：金額、分類、債權人（欠誰）、發生日、到期日、備註、單據圖片上傳（走既有 `POST /api/upload`）。
- **全貌**：頂部摘要卡（欠款總額 / 已還 / **未還（紅字高亮）** / 筆數）+ 分類拆解條（可點擊篩選）。
- **分期還款**：每筆欠款獨立的還款 dialog，列出每期還款（可附收據）；已還/未還**衍生計算**（SUM(payments)），非存欄位；提供「一鍵填入未還金額」。
- **歸帳**：status 生命週期 `open / reconciled / cancelled`；標 reconciled 時自動寫 `reconciled_at` + 可填歸帳科目。獨立標記，不動既有記帳系統。
- **篩選**：狀態 × 還款進度（未還/部分/已還清）× 分類；逾期（有到期日且未還清且過期）標紅。
- **RWD**：桌機表格、手機卡片。

## 實作步驟（commit 時序）

1. `b2569b7` → squash 為 `d79defb`：模組全套
   - migration `0029_historical_debts.sql`（CREATE TABLE IF NOT EXISTS、只加不刪）
   - `shared/schema/debt.ts`（legacyDebt* 三表 + zod insert schemas）
   - `server/storage/debts.ts`（CRUD + 分類 + 分期還款 + 全貌彙總；paid/remaining 記憶體彙總避 N+1）
   - `server/routes/debts.ts`（靜態 categories/summary/payments 路由排在動態 `:id` 之前）
   - `client/src/pages/debts.tsx` + `client/src/components/debts/`（shared / debt-form / payments-dialog / categories-dialog）
   - 註冊：App.tsx 路由、routes/index.ts、schema/index.ts、navigation.ts、breadcrumb
2. `2536241`：導航修正——項目原放「🧰 工具箱」（**預設收合**看不到），改放 `mainNavItems` 常駐區、緊接記帳窗口、加「整理」標籤。

## 驗證

- 本地全流程 curl 煙霧測試：新增 → 分期還款 → 列表已還/未還計算 → 全貌彙總 → 進度篩選 → 歸帳自動記時間 → cascade 刪除，全通過。
- `tsc --noEmit` 0 error、`eslint` 0 error、無 console.log。
- 生產 migration 套用成功（3 表 + 8 預設分類）；site last-modified 更新；`/api/debts` 回 401（路由已掛、非 404）；新 bundle hash 含「歷史欠款整理」。

## 已知限制 / 後續優化

- 歸帳為獨立標記，尚未串接 payment_items（依使用者選擇）；未來若要併入正式分錄可再嫁接。
- 還款只記金額/日期/方式/備註/收據，未做「分期期數/利息」結構化欄位——待實際使用回饋再加。
- 全貌彙總在記憶體計算，資料量極大時可改 SQL 聚合（目前規模無虞）。

## 相關文件

- 記憶：`legacy-debts-module.md`
- 範本參考：`card-claims-module.md`、`docs/runbooks/deploy.md`、`docs/runbooks/db-migration.md`
