#!/usr/bin/env bash
# 完整 pg_dump 備份生產 DB（67 張表全包）
# 2026-05-31 audit P0：取代舊 export-data.ts（只 14 張表）
#
# 用法：
#   ./scripts/backup-full.sh              # 預設 prod、輸出到 /tmp/woyu-backup-{date}.dump
#   ./scripts/backup-full.sh local        # 備份本地 DB（用 woyu-postgres container）
#   ./scripts/backup-full.sh prod /custom/path.dump
#
# 環境：
#   prod 模式需 SSH 到 172.233.89.147、用 container woyu-money-db
#   local 模式用本地 docker container woyu-postgres
#
# 還原：
#   pg_restore -d woyu_money -U woyu -h ... --clean --if-exists --no-owner backup.dump

set -euo pipefail

MODE="${1:-prod}"
DATE_TAG=$(date +%Y%m%d-%H%M%S)
DEFAULT_OUT="/tmp/woyu-backup-${MODE}-${DATE_TAG}.dump"
OUT_PATH="${2:-$DEFAULT_OUT}"

case "$MODE" in
  prod)
    echo "📦 備份生產 DB（SSH → 172.233.89.147）..."
    ssh root@172.233.89.147 \
      "docker exec woyu-money-db pg_dump -U woyu -d woyu_money --format=custom --no-owner --no-acl" \
      > "$OUT_PATH"
    ;;
  local)
    echo "📦 備份本地 DB（container woyu-postgres）..."
    docker exec woyu-postgres pg_dump -U woyu -d woyu_money \
      --format=custom --no-owner --no-acl > "$OUT_PATH"
    ;;
  *)
    echo "❌ 未知模式: $MODE（支援 prod / local）" >&2
    exit 1
    ;;
esac

SIZE=$(du -h "$OUT_PATH" | cut -f1)
echo "✅ 完成：$OUT_PATH ($SIZE)"

# 驗證：列出備份內含的表
TABLES=$(pg_restore -l "$OUT_PATH" 2>/dev/null | grep -c "TABLE DATA" || echo "?")
echo "📊 表數: $TABLES"
