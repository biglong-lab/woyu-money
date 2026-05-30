# Secret + 備份強化 — 2026-05-31

> 範圍：docker-compose、.gitignore、.env.example、備份/還原腳本
> 狀態：本機改完、生產切換需排定
> Audit：P0 安全（A1 + A2 + A3）

## 背景

系統盤點（2026-05-30 ~ 31）發現 P0 安全風險：

1. **`database_backup/database_export.json` 進 git** — 含 12 個 user scrypt 雜湊 + LINE userId / displayName / 頭像 + 房客姓名/電話/地址/銀行帳號（5 筆合約） + 1474 筆交易紀錄。GitHub repo `biglong-lab/woyu-money` 為 **PUBLIC**、暴露時間 ~4 個月（commit 在 2026-02-04）。
2. **docker-compose.yml 硬寫 `woyu123` DB 密碼 + SESSION_SECRET 有弱預設值**。
3. **備份腳本只匯出 14 張表**（schema 共 67 張）、還原不完整。

## 影響範圍

- `.gitignore` — 新增 database_backup/*.json 等規則
- `docker-compose.yml` — DB 密碼 + SESSION_SECRET 改 `${VAR:?required}` 注入
- `.env.example` — 重寫、加 POSTGRES_PASSWORD 說明
- `scripts/backup-full.sh`（新）— 完整 pg_dump
- `scripts/restore-full.sh`（新）— 演練還原

## 已完成（commit 本次）

- [x] git rm --cached database_backup/database_export.json
- [x] .gitignore 補規則
- [x] docker-compose.yml 改成必填環境變數（缺即拒啟動）
- [x] .env.example 重寫
- [x] 備份/還原腳本

## 待人工執行（不可自動化）

### 1. 生產環境變數設定（必做、不然新版啟動失敗）

ssh 到生產：

```bash
cd /www/wwwroot/woyu-money
cat >> .env << EOF
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -hex 32)
EOF
chmod 600 .env
```

⚠️ `POSTGRES_PASSWORD` 必須跟現有 DB 已設密碼一致（否則 DB 連不上）。
作法：先 SSH 進去看 `docker exec woyu-money-db env | grep POSTGRES_PASSWORD`、用同個值。
**未來**換密碼需走「ALTER USER」流程、不是直接改 .env。

### 2. Git 歷史清除（強烈建議、不可逆）

```bash
# 1. 完整本地備份（雙保險）
git clone https://github.com/biglong-lab/woyu-money.git /tmp/woyu-backup-before-rewrite

# 2. filter-repo 刪除檔案
pip install git-filter-repo
git filter-repo --invert-paths --path database_backup/database_export.json --force

# 3. 確認 history 已清
git log --all --full-history -- database_backup/database_export.json
# （應該無 output）

# 4. force push
git push --force origin main

# 5. 通知 GitHub 強制清 cache
gh api -X POST /repos/biglong-lab/woyu-money/keys/garbage-collect 2>/dev/null || true
```

### 3. 個資外洩後續

⚠️ 4 個月窗口、無法保證沒被 clone / cache。建議：

- **必做**：rotate admin 密碼、清 active sessions（重啟 container 就會清 session）
- **必做**：所有 user 強制改密碼（下次登入 prompt）— 需另寫 SQL：
  ```sql
  UPDATE users SET password_reset_required = TRUE;
  ```
  （此欄位現在沒有、要加 ADD COLUMN + 改 login flow）
- **建議**：個資法 §12 通知 5 位房客（姓名/電話/地址/銀行帳號外洩）
- **無解**：LINE userId 是 LINE 平台 ID、無法 rotate

## 還原演練（A3 驗證）

每月一次：

```bash
./scripts/backup-full.sh prod /tmp/prod-monthly.dump   # 抓生產備份
./scripts/restore-full.sh /tmp/prod-monthly.dump       # 還原到本地
# 啟動本地 server 確認資料正確
```

## 相關文件

- [Audit roadmap](2026-05-24-system-architecture-audit.md)
