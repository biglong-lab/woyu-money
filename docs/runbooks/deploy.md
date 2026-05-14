# 部署 SOP

> 部署方式：**SSH + Docker 手動部署**（無 webhook、無 Coolify）
> push main 後不會自動觸發任何動作，**必須手動 SSH 跑指令**

---

## 連線資訊

| 項目 | 值 |
|------|-----|
| Host | `172.233.89.147` |
| User | `root` |
| 同台還跑 | `cm.homi.cc`、`pm.homi.cc`（共用 ed25519 fingerprint） |
| 專案路徑 | `/www/wwwroot/woyu-money`（寶塔面板）|
| Nginx 設定 | 反向代理到 container:5001 |
| 對外網址 | `https://money.homi.cc/` |

> ⚠️ `/www/wwwroot/money.homi.cc/` 是寶塔預設空目錄，**不是專案路徑**。

---

## 一鍵部署

```bash
ssh root@172.233.89.147 'cd /www/wwwroot/woyu-money && \
  git fetch origin && \
  git reset --hard origin/main && \
  docker compose up -d --build --force-recreate app'
```

執行時間：**3~5 分鐘**（npm run build 最久，約 2~3 分鐘）

---

## 分步說明

### 1. SSH 進伺服器並切到專案目錄

```bash
ssh root@172.233.89.147
cd /www/wwwroot/woyu-money
```

### 2. 同步程式碼

```bash
git fetch origin
git reset --hard origin/main
```

> 為何用 `reset --hard` 而非 `pull`：生產偶有 `chore(auto): 自動存檔 Dockerfile` 等 commit 擋 pull，`reset --hard` 最乾淨。

### 3. 重建並重啟容器

```bash
docker compose up -d --build --force-recreate app
```

兩個旗標都必要：
- `--build`：強制重跑 Dockerfile（含 npm run build），否則只會用既有 image
- `--force-recreate`：即使 image 沒變也重建 container

---

## 部署後驗證（必做）

```bash
# 1. 確認容器在跑 + 啟動時間
ssh root@172.233.89.147 'docker inspect woyu-money --format "{{.State.Status}} since {{.State.StartedAt}}"'

# 2. 確認 HTTP 200 + last-modified 是部署當下時間
curl -sI https://money.homi.cc/ | grep -iE "http|last-modified"

# 3. 確認新功能在生產端正常運作（人工驗證）
# 4. 確認舊資料完整保留（付款紀錄、收據圖片等）
```

---

## 異常回滾

```bash
# 本地：revert 最後一個 commit
git revert HEAD
git push origin main

# 伺服器：重新部署
ssh root@172.233.89.147 'cd /www/wwwroot/woyu-money && \
  git fetch origin && git reset --hard origin/main && \
  docker compose up -d --build --force-recreate app'
```

或直接在伺服器 reset 到舊 commit：

```bash
ssh root@172.233.89.147 'cd /www/wwwroot/woyu-money && \
  git reset --hard <old-commit-sha> && \
  docker compose up -d --build --force-recreate app'
```

---

## 踩過的坑

### 1. 「Coolify 自動部署」誤記
MEMORY 原本寫「Coolify 自動部署」，實際**沒有 Coolify 也沒 webhook**。push main 後不會觸發任何動作。

### 2. 寶塔面板路徑混淆
`/www/wwwroot/money.homi.cc/` 是寶塔自動建的網域目錄（只有 index.html / 404.html），**不是專案目錄**。實際專案在 `/www/wwwroot/woyu-money/`，由 nginx proxy 到 container:5001。

確認方式：
```bash
ssh root@172.233.89.147 'docker inspect woyu-money --format "{{index .Config.Labels \"com.docker.compose.project.working_dir\"}}"'
```

### 3. `--force-recreate` 必要
只跑 `docker compose up -d` **不會重建 image**，必須加 `--build --force-recreate app`。

### 4. pre-push hook
本地 `git push` 會觸發 husky pre-push 跑 1836 個測試（約 45 秒），測試掛了會擋推送。要先確認本地測試全綠：

```bash
DATABASE_URL=postgresql://woyu:woyu123@localhost:5439/woyu_money \
  SESSION_SECRET=test NODE_ENV=test PORT=5001 \
  npx vitest run
```

### 5. CI integration test 失敗不影響部署
GitHub Actions 上的 integration test 因 CI DB 沒 admin 帳號會 401，但這**不影響部署**（部署不靠 CI，靠 SSH 手動）。

---

## 相關文件

- [DB Schema 同步](db-migration.md)
- [Git 分叉處理](git-divergence.md)
- 部署實例：`docs/changes/2026-05-14-document-inbox-upload-fix.md`
