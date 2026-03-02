#!/bin/bash
# ============================================================
# 生產環境 → 本地同步腳本
# 用途：開發前同步生產端資料庫和上傳檔案到本地
# 使用：bash scripts/sync-from-production.sh
# ============================================================

set -euo pipefail

# ============ 設定區（請填入你的生產環境資訊） ============

# SSH 連線（填入你的生產伺服器資訊）
PROD_SSH_USER="${PROD_SSH_USER:-root}"
PROD_SSH_HOST="${PROD_SSH_HOST:-your-server-ip}"
PROD_SSH_PORT="${PROD_SSH_PORT:-22}"
PROD_SSH_KEY="${PROD_SSH_KEY:-}"  # 留空使用預設 key

# 生產端資料庫（Coolify 容器內的 PostgreSQL）
PROD_DB_CONTAINER="${PROD_DB_CONTAINER:-woyu-postgres}"  # Docker 容器名
PROD_DB_NAME="${PROD_DB_NAME:-woyu_money}"
PROD_DB_USER="${PROD_DB_USER:-woyu}"

# 生產端上傳目錄（Coolify 部署路徑）
PROD_UPLOADS_PATH="${PROD_UPLOADS_PATH:-/data/coolify/applications/woyu-money/uploads}"

# 本地設定
LOCAL_DB_URL="${DATABASE_URL:-postgresql://woyu:woyu123@localhost:5439/woyu_money}"
LOCAL_UPLOADS_PATH="./uploads"
BACKUP_DIR="./database_backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# ============ 顏色輸出 ============
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============ 前置檢查 ============
check_prerequisites() {
  log_info "檢查前置條件..."

  # 檢查 SSH 連線
  if [ "$PROD_SSH_HOST" = "your-server-ip" ]; then
    log_error "請設定 PROD_SSH_HOST 環境變數或修改腳本中的伺服器 IP"
    log_info "範例: PROD_SSH_HOST=203.0.113.10 bash scripts/sync-from-production.sh"
    exit 1
  fi

  # 檢查本地 Docker postgres 容器
  if ! docker ps --format '{{.Names}}' | grep -q "woyu-postgres"; then
    log_error "本地 woyu-postgres 容器未運行"
    log_info "啟動指令: docker start woyu-postgres"
    exit 1
  fi

  # 檢查本地 DB 連線
  if ! psql "$LOCAL_DB_URL" -c "SELECT 1" &>/dev/null; then
    log_error "無法連線本地資料庫: $LOCAL_DB_URL"
    exit 1
  fi

  log_ok "前置條件檢查通過"
}

# ============ SSH 連線建構 ============
build_ssh_cmd() {
  local ssh_cmd="ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"
  ssh_cmd+=" -p $PROD_SSH_PORT"
  if [ -n "$PROD_SSH_KEY" ]; then
    ssh_cmd+=" -i $PROD_SSH_KEY"
  fi
  ssh_cmd+=" $PROD_SSH_USER@$PROD_SSH_HOST"
  echo "$ssh_cmd"
}

# ============ 步驟 1：從生產端匯出資料庫 ============
export_production_db() {
  log_info "步驟 1/4：從生產端匯出資料庫..."

  local ssh_cmd
  ssh_cmd=$(build_ssh_cmd)
  local dump_file="$BACKUP_DIR/prod_dump_${TIMESTAMP}.sql"

  mkdir -p "$BACKUP_DIR"

  # 透過 SSH 在生產伺服器上用 docker exec 匯出
  $ssh_cmd "docker exec $PROD_DB_CONTAINER pg_dump -U $PROD_DB_USER -d $PROD_DB_NAME --no-owner --no-privileges --clean --if-exists" > "$dump_file"

  if [ -s "$dump_file" ]; then
    local size
    size=$(du -h "$dump_file" | cut -f1)
    log_ok "資料庫匯出成功: $dump_file ($size)"
  else
    log_error "匯出檔案為空，請檢查連線設定"
    rm -f "$dump_file"
    exit 1
  fi

  echo "$dump_file"
}

# ============ 步驟 2：匯入到本地資料庫 ============
import_to_local_db() {
  local dump_file="$1"
  log_info "步驟 2/4：匯入資料到本地資料庫..."

  # 備份目前本地資料（以防萬一）
  local local_backup="$BACKUP_DIR/local_backup_${TIMESTAMP}.sql"
  pg_dump "$LOCAL_DB_URL" --no-owner --no-privileges > "$local_backup" 2>/dev/null || true
  log_info "本地資料已備份到: $local_backup"

  # 匯入生產資料
  psql "$LOCAL_DB_URL" < "$dump_file" 2>&1 | tail -5

  log_ok "資料庫匯入完成"
}

# ============ 步驟 3：同步上傳檔案 ============
sync_uploads() {
  log_info "步驟 3/4：同步上傳檔案..."

  local ssh_cmd
  ssh_cmd=$(build_ssh_cmd)

  # 確認遠端目錄存在
  if ! $ssh_cmd "test -d $PROD_UPLOADS_PATH" 2>/dev/null; then
    log_warn "生產端上傳目錄不存在: $PROD_UPLOADS_PATH，跳過檔案同步"
    return 0
  fi

  mkdir -p "$LOCAL_UPLOADS_PATH"

  # rsync 同步（只下載不刪除本地額外檔案）
  rsync -avz --progress \
    -e "ssh -p $PROD_SSH_PORT ${PROD_SSH_KEY:+-i $PROD_SSH_KEY}" \
    "$PROD_SSH_USER@$PROD_SSH_HOST:$PROD_UPLOADS_PATH/" \
    "$LOCAL_UPLOADS_PATH/"

  log_ok "上傳檔案同步完成"
}

# ============ 步驟 4：執行 schema 遷移 ============
apply_schema_migrations() {
  log_info "步驟 4/4：確認本地 schema 是最新的..."

  # 使用 drizzle-kit push 確保本地新增的欄位/表格不被覆蓋
  npx drizzle-kit push 2>&1 | tail -3

  log_ok "Schema 同步完成"
}

# ============ 清理舊備份 ============
cleanup_old_backups() {
  log_info "清理 7 天前的舊備份..."
  find "$BACKUP_DIR" -name "prod_dump_*.sql" -mtime +7 -delete 2>/dev/null || true
  find "$BACKUP_DIR" -name "local_backup_*.sql" -mtime +7 -delete 2>/dev/null || true
  log_ok "清理完成"
}

# ============ 主流程 ============
main() {
  echo ""
  echo "=========================================="
  echo "  生產環境 → 本地 同步工具"
  echo "  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "=========================================="
  echo ""

  check_prerequisites

  # 步驟 1：匯出
  local dump_file
  dump_file=$(export_production_db)

  # 步驟 2：匯入
  import_to_local_db "$dump_file"

  # 步驟 3：同步檔案
  sync_uploads

  # 步驟 4：Schema 遷移
  apply_schema_migrations

  # 清理
  cleanup_old_backups

  echo ""
  echo "=========================================="
  log_ok "同步完成！本地資料已與生產端一致"
  echo "=========================================="
  echo ""
  log_info "接下來可以開始開發了"
  echo ""
}

# ============ 選項處理 ============
case "${1:-all}" in
  db-only)
    check_prerequisites
    dump_file=$(export_production_db)
    import_to_local_db "$dump_file"
    apply_schema_migrations
    ;;
  files-only)
    check_prerequisites
    sync_uploads
    ;;
  all)
    main
    ;;
  *)
    echo "使用方式: $0 [all|db-only|files-only]"
    echo "  all        - 完整同步（資料庫 + 檔案）"
    echo "  db-only    - 只同步資料庫"
    echo "  files-only - 只同步上傳檔案"
    exit 1
    ;;
esac
