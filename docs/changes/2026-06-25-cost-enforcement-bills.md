# 成本收斂 → 三大矩陣 → 成本中樞 → 強制執行 + 帳單時間 — 2026-06

> 範圍：財務收斂帳務優化大批次（opt3 + opt4）
> 狀態：已全部上線生產
> 部署 commit 範圍：`050056c` → `f3a8b9e`（SSH 手動部署，埠 52099）

## 背景

使用者反映「功能一堆但實際用到非常有限」，需要：更方便快速地完整記帳、用緊密的預算/成本/收入做預估預判、把所有成本通盤攤在年度視圖、並處理被強制執行（勞健保/稅）的款項分流與對帳。分多次對話逐步推進。

## 影響範圍

- 新增資料表：`expense_ledger`、`enforcement_cases`/`enforcement_seizures`/`enforcement_installments`/`enforcement_installment_payments`
- payment_items 加欄位：`bill_issued_date`/`legal_due_date`/`final_due_date`/`penalty_note`/`enforcement_case_id`
- recurring_expense_templates 加欄位：`bill_day`/`legal_due_day`/`final_due_day`/`penalty_note`
- migration 0025 ~ 0028
- 新頁：`/fixed-expense-matrix`、`/labor-insurance-matrix`、`/enforcement`、`/bills`；升級 `/cost-overview`、`/document-inbox`、`/recurring-expenses`
- 新 shared 純函式：`fixed-expense-matrix`、`labor-insurance-matrix`、`cost-structure-annual`

## 解決方案（依交付順序）

### opt3 — 財務收斂四階段（`050056c`）
1. **開銷流水帳**（`expense_ledger`，migration 0025）：先記錄後分帳，整合進記帳窗口（document-inbox 頂層 Tab）。
2. **固定開銷月度矩陣** `/fixed-expense-matrix`：週期模板 × 12 月，預算 vs 實際、差異上色；後續加「點格記付款（含收據）」+ 頁內新增模板。
3. **保守導航重整**：記帳窗口正名、進階工具收合。
4. **專案系統請款嫁接**：`/integrations` 一鍵樣板 + runbook。

### 三大成本矩陣到齊（`f961109`）
- 固定開銷矩陣可操作化（`POST /api/fixed-expense-matrix/pay`）。
- **勞健保矩陣** `/labor-insurance-matrix`：勞保(含就業+職災)/健保/勞退 × 12 月，建在 `monthly_hr_costs`，整月一鍵標已繳。

### 成本結構中樞（`bbda991` + `a055539`）
- `/cost-overview` 升級「成本結構中樞」：年度為主可切月度。
- 流水帳併入成本結構（第 6 桶 ledger）；新 `GET /api/dashboard/cost-structure/annual`（五桶 × 12 月 預算 vs 實際）。
- 成本組成占比可切 每月/每季/每年（預設本月）。

### opt4 — 強制執行 + 帳單時間（`a7d4a23` + `929d23c`）
- **強制執行管理** `/enforcement`：公文/圈存/分期三表，對帳等式（強執總額 ≈ 圈存 + 分期、未歸類差異）；公文多檔 OCR 自動帶入（`recognizeEnforcementDocument`）；被強執應付款分流（`enforcement_case_id` → 從一般應付款排除）。
- **帳單到期看板** `/bills`：通盤近期應繳（法定付款日優先 + 強執分期投影），逾期/即將到期。
- **最終必繳日 + 罰款機制**（migration 0028）：帳單日/法定繳費日/最終必繳日 + 罰款說明；帳單看板罰款風險分級（過最終必繳=penalty）。
- 圈存/分期實付支援截圖上傳；固定開銷模板對話框可設帳單三日期 + 罰款說明，自動帶入產出項目。

### recurring-expenses 介面優化（`b121ade` + `f3a8b9e`）
- 月份選擇放寬至過去 36 月～未來 12 月、修 `toISOString` UTC 偏移。
- 雙段釐清：① 本月待辦（填實際金額、永遠顯示含空狀態）② 固定開銷模板設定；「立即產出」降級為「補產本月」（僅未產出時顯示）、「編輯」改主要按鈕；修「全部立即產出」後待填列表不刷新。

## 驗證

- 各功能整合/單元測試：expense-ledger 6、fixed-expense-matrix 單元6+整合5、labor-insurance-matrix 7、cost-structure-annual 7、enforcement 5、bills 2，全過。
- 每次部署：首頁 200 + 新端點回 401（route 正常）+ migration 套用確認 + 容器 healthy。

## 已知限制 / 後續優化

- 臨時上傳單據（document-inbox 歸檔）的 `bill_issued_date` 尚未自動帶入上傳日（目前僅週期模板 billDay 產出）。
- 強執分期尚未計入成本中樞現金流（目前只進帳單看板）。
- 圈存/分期已存截圖的「檢視」UI（上傳已可、列表尚未顯示縮圖連結）。

## 相關文件

- `CHANGELOG.md` [1.1.0]
- `docs/runbooks/integration-project-claims.md`（專案請款嫁接）
- migration 0025~0028
