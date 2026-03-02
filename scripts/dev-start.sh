#!/bin/bash
# ============================================================
# 每日開發啟動腳本
# 用途：開發前的標準化流程，確保本地環境與生產一致
# 使用：bash scripts/dev-start.sh
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo ""
echo "=========================================="
echo "  Money 開發啟動流程"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# ============ 步驟 1：Git 更新 ============
log_info "步驟 1/5：拉取最新程式碼..."
git pull origin main 2>/dev/null || log_warn "git pull 失敗，可能有未 commit 的變更"
log_ok "程式碼已是最新"

# ============ 步驟 2：檢查本地 Docker ============
log_info "步驟 2/5：檢查本地服務..."
if docker ps --format '{{.Names}}' | grep -q "woyu-postgres"; then
  log_ok "本地 PostgreSQL 容器運行中"
else
  log_warn "啟動本地 PostgreSQL 容器..."
  docker start woyu-postgres 2>/dev/null || {
    log_warn "容器不存在，建立新容器..."
    docker run -d --name woyu-postgres \
      -e POSTGRES_USER=woyu \
      -e POSTGRES_PASSWORD=woyu123 \
      -e POSTGRES_DB=woyu_money \
      -p 5439:5432 \
      --restart unless-stopped \
      postgres:16-alpine
    sleep 3
  }
  log_ok "PostgreSQL 已啟動"
fi

# ============ 步驟 3：同步生產資料（可選） ============
log_info "步驟 3/5：檢查是否需要同步生產資料..."

LAST_SYNC_FILE=".last-prod-sync"
SYNC_INTERVAL=86400  # 24 小時

should_sync=false
if [ ! -f "$LAST_SYNC_FILE" ]; then
  should_sync=true
  log_warn "從未同步過生產資料"
else
  last_sync=$(cat "$LAST_SYNC_FILE")
  now=$(date +%s)
  diff=$((now - last_sync))
  if [ "$diff" -gt "$SYNC_INTERVAL" ]; then
    should_sync=true
    hours=$((diff / 3600))
    log_warn "距離上次同步已超過 ${hours} 小時"
  else
    remaining=$(( (SYNC_INTERVAL - diff) / 3600 ))
    log_ok "生產資料已同步（${remaining} 小時後建議再次同步）"
  fi
fi

if [ "$should_sync" = true ]; then
  echo ""
  read -rp "是否現在同步生產資料？(y/N) " answer
  if [[ "$answer" =~ ^[Yy]$ ]]; then
    bash scripts/sync-from-production.sh
    date +%s > "$LAST_SYNC_FILE"
    log_ok "生產資料同步完成"
  else
    log_info "跳過同步，使用本地現有資料"
  fi
fi

# ============ 步驟 4：安裝依賴 ============
log_info "步驟 4/5：檢查依賴..."
if [ package-lock.json -nt node_modules/.package-lock.json ] 2>/dev/null; then
  log_warn "依賴有更新，執行 npm install..."
  npm install --legacy-peer-deps
else
  log_ok "依賴已是最新"
fi

# ============ 步驟 5：顯示版本與進度 ============
log_info "步驟 5/5：讀取版本與進度..."

# 顯示版本號
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "無")
echo ""
echo -e "${GREEN}📦 目前版本: v${VERSION}  |  最新 Tag: ${LAST_TAG}${NC}"

# 顯示最近 CHANGELOG
if [ -f "CHANGELOG.md" ]; then
  echo ""
  echo "--- 最近更新紀錄 ---"
  # 顯示第一個版本區塊（到下一個 ## 或檔案結束）
  sed -n '/^## \[/,/^## \[/{/^## \[/!{/^## \[/!p}}' CHANGELOG.md | head -15
  echo "---"
fi

# 顯示專案進度
if [ -f "PROGRESS.md" ]; then
  echo ""
  echo "--- PROGRESS.md ---"
  head -30 PROGRESS.md
  echo "---"
else
  log_warn "PROGRESS.md 不存在"
fi

echo ""
echo "=========================================="
log_ok "開發環境準備完成！"
echo ""
echo "  啟動伺服器: source .env && export DATABASE_URL SESSION_SECRET NODE_ENV PORT && npx tsx server/index.ts"
echo "  同步資料庫: bash scripts/sync-from-production.sh"
echo "  同步DB:     bash scripts/sync-from-production.sh db-only"
echo "  同步檔案:   bash scripts/sync-from-production.sh files-only"
echo ""
echo "=========================================="
