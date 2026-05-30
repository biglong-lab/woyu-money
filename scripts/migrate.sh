#!/usr/bin/env bash
# DB migration 套用器 — 2026-05-31 audit P1
# 取代「scp + docker exec psql -f」人工流程
#
# 用法：
#   ./scripts/migrate.sh                    # 預設套生產
#   ./scripts/migrate.sh local              # 套本地
#   ./scripts/migrate.sh prod --dry-run     # 只列出待套用
#   ./scripts/migrate.sh prod --backfill    # 把所有現有 *.sql 標記為已套（首次啟用用）
#
# 依賴表：_schema_migrations（filename, applied_at）— 自動建

set -euo pipefail

MODE="${1:-prod}"
shift || true
EXTRA="${1:-}"

MIG_DIR="$(cd "$(dirname "$0")/.." && pwd)/migrations"

# DB 連線設定（依模式）
run_sql() {
  local sql="$1"
  case "$MODE" in
    prod)
      ssh root@172.233.89.147 "docker exec -i woyu-money-db psql -U woyu -d woyu_money" <<< "$sql"
      ;;
    local)
      docker exec -i woyu-postgres psql -U woyu -d woyu_money <<< "$sql"
      ;;
  esac
}

run_sql_file() {
  local file="$1"
  case "$MODE" in
    prod)
      scp -q "$file" root@172.233.89.147:/tmp/_mig.sql
      ssh root@172.233.89.147 "docker exec -i woyu-money-db psql -U woyu -d woyu_money < /tmp/_mig.sql"
      ssh root@172.233.89.147 "rm /tmp/_mig.sql"
      ;;
    local)
      docker exec -i woyu-postgres psql -U woyu -d woyu_money < "$file"
      ;;
  esac
}

# 1. 確保 tracking 表存在
echo "📋 確認 _schema_migrations 表..."
run_sql "CREATE TABLE IF NOT EXISTS _schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT NOW());" > /dev/null

# 2. 列出本地所有 SQL（不含 .draft）
MIGRATIONS=$(ls "$MIG_DIR"/*.sql 2>/dev/null | sort | xargs -n1 basename || true)
[ -z "$MIGRATIONS" ] && { echo "❌ 找不到 migrations"; exit 1; }

# 3. 查 DB 已套用清單
APPLIED=$(run_sql "SELECT filename FROM _schema_migrations ORDER BY filename;" 2>/dev/null | grep -E "^\s+[0-9]" | tr -d ' ' || echo "")

# Backfill 模式：把所有現有 SQL 標記已套（首次啟用用、避免重套舊 SQL）
if [ "$EXTRA" = "--backfill" ]; then
  echo "⚠️  Backfill 模式：把現有 *.sql 全標為已套用"
  for f in $MIGRATIONS; do
    run_sql "INSERT INTO _schema_migrations (filename) VALUES ('$f') ON CONFLICT DO NOTHING;" > /dev/null
    echo "  ✓ $f"
  done
  echo "✅ Backfill 完成、未來新 SQL 才會被套"
  exit 0
fi

# 4. 找出待套用
PENDING=()
for f in $MIGRATIONS; do
  if ! echo "$APPLIED" | grep -qx "$f"; then
    PENDING+=("$f")
  fi
done

if [ ${#PENDING[@]} -eq 0 ]; then
  echo "✅ 所有 migrations 已套用（共 $(echo "$APPLIED" | grep -c .) 筆）"
  exit 0
fi

echo "📦 待套用 ${#PENDING[@]} 個 migrations:"
for f in "${PENDING[@]}"; do echo "  - $f"; done

if [ "$EXTRA" = "--dry-run" ]; then
  echo "(dry-run、未實際執行)"
  exit 0
fi

# 5. 逐個套用 + tracking
for f in "${PENDING[@]}"; do
  echo "▶ 套用 $f..."
  run_sql_file "$MIG_DIR/$f"
  run_sql "INSERT INTO _schema_migrations (filename) VALUES ('$f');" > /dev/null
  echo "  ✓ 完成"
done

echo "✅ 所有 pending migrations 套用完成（$MODE）"
