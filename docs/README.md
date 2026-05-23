# 浯島財務管理系統 — 文件目錄

> 文件機制依 [全域 CLAUDE.md 規範](~/.claude/rules/documentation.md) 組織。

---

## 目錄結構

```
docs/
├── README.md                ← 本檔（總覽 + 索引）
├── architecture/            ← 系統架構（穩定，少改）
├── domains/                 ← 業務領域（持續更新）
│   ├── category-merge.md
│   └── income-webhook-api.md
├── decisions/               ← ADR（寫完不改）
├── runbooks/                ← 維運手冊（命令式）
│   ├── deploy.md            ← SSH + Docker 部署 SOP
│   ├── db-migration.md      ← DB schema 同步
│   └── git-divergence.md    ← 分叉處理
├── changes/                 ← 大型變動紀錄（寫完不改）
│   └── 2026-05-14-document-inbox-upload-fix.md
└── archive/                 ← 過時 / 已完成（只進不出）
```

主 CHANGELOG 在專案根目錄：`/CHANGELOG.md`

---

## 快速導航

### 新人 onboarding
1. 看根目錄 `CLAUDE.md`（如果有的話）了解專案紅線
2. 看根目錄 `README.md` 了解技術棧與本機啟動
3. 看 [部署 SOP](runbooks/deploy.md) 了解上線流程
4. 看 `domains/` 任一檔了解業務邏輯範例

### 上線一個變動
1. 跑 [DB Schema 同步](runbooks/db-migration.md)（若有 schema 變動）
2. 跑 [部署 SOP](runbooks/deploy.md)
3. 在 `changes/` 加 `YYYY-MM-DD-topic.md` 紀錄這次變動
4. 更新 `/CHANGELOG.md`

### 處理 Git 分叉
看 [Git 分叉處理](runbooks/git-divergence.md)

### 寫 ADR
影響 ≥ 3 模組 / ≥ 3 表 / 改變主要工作流 → 在 `decisions/` 加 `NNNN-topic.md`

---

## 紀錄節奏

| 觸發點 | 動作 |
|--------|------|
| 大型 feature 啟動 | `changes/{date}-{topic}.md` 開新檔（規劃階段） |
| Feature 中途有重要決策 | 加進該變動檔 |
| Feature 完成 | 補「實作回顧」+ 更新 `/CHANGELOG.md` |
| 重要決策（≥ 3 模組） | `decisions/{N}-{topic}.md` 寫 ADR |
| Schema 變動 | `runbooks/db-migration.md` 加紀錄 |
| 部署 | `/CHANGELOG.md` 加版本 commit |

---

## 檔案行數規範

| 類型 | 上限 |
|------|------|
| `architecture/*` | 500 行/檔 |
| `domains/{topic}.md` | 800 行/檔 |
| `decisions/{N}-*.md` | 200 行/檔 |
| `runbooks/{op}.md` | 300 行/檔 |
| `changes/{date}-*.md` | 500 行/檔 |

超過 → 拆子檔。

---

## 完整索引（自動維護建議：跑 `npx tsx scripts/doc-index-check.ts`）

### Root
- [Integration API 規範](integration-api.md) — 通用 API 整合嫁接框架 v2.0
- [Income Webhook API 規範](income-webhook-api.md) — PM/PMS 收入 webhook 對接
- [Category 合併指南](category-merge.md)
- [OpenAPI Spec](openapi.yaml) — 自動生成的 API 規範

### Architecture
- [Forecasting Engine](architecture/forecasting-engine.md) — 收入預估引擎

### Runbooks
- [部署 SOP](runbooks/deploy.md)
- [DB Migration](runbooks/db-migration.md)
- [Git 分叉處理](runbooks/git-divergence.md)
- [Schema 使用率報告](runbooks/schema-usage.md) — 64 表狀態（5.2）
- [Endpoint 使用率報告](runbooks/family-kids-endpoint-usage.md) — 207 個 endpoint（5.3）
- [Doc 索引狀態](runbooks/doc-index-status.md) — 本檔的自我檢查報告（5.4）

### Domains
- [Category 合併](category-merge.md)
- [Income Webhook API](income-webhook-api.md)

### Changes
- [2026-05-14 Navigation Focus Optimization](changes/2026-05-14-navigation-focus-optimization.md)
- [2026-05-14 Document Inbox Upload Fix](changes/2026-05-14-document-inbox-upload-fix.md)
- [2026-05-16 Integration API Spec](changes/2026-05-16-integration-api-spec.md)
- [2026-05-17 Financial Coverage Overhaul](changes/2026-05-17-financial-coverage-overhaul.md)
- [2026-05-18 Forecasting Engine](changes/2026-05-18-forecasting-engine.md)
- [2026-05-19 UX Detail Optimization Loop](changes/2026-05-19-ux-detail-optimization-loop.md)
- [2026-05-23 Functional Audit + 5 階段優化](changes/2026-05-23-functional-audit.md) — 完整 5 階段優化路線執行紀錄
- [2026-05-23 家用記帳超級好用化](changes/2026-05-23-household-budget-overhaul.md) — 13 個強化迭代（tab bar / 大鍵盤 / 智能分類 / 語音 / 範本 / 搜尋 / 手勢 / 首頁快照 / 收入 / 結餘 / CSV / streak / 每日提醒）
- [2026-05-24 數據完備性與計算精準度盤點](changes/2026-05-24-data-accuracy-audit.md) — 全面 audit、15+ 風險點分 P0/P1/P2、含修復路徑建議
