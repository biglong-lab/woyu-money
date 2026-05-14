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
