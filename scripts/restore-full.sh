#!/usr/bin/env bash
# 從 pg_dump 還原到本地 DB（演練用、絕不對 prod）
# 2026-05-31 audit P0
#
# 用法：
#   ./scripts/restore-full.sh /tmp/woyu-backup-prod-XXXXX.dump
#
# 流程：
#   1. 確認本地 woyu-postgres container 運行中
#   2. drop + create database（清空本地）
#   3. pg_restore --clean --if-exists --no-owner

set -euo pipefail

DUMP_FILE="${1:?用法：$0 <dump-file-path>}"
[ -f "$DUMP_FILE" ] || { echo "❌ 找不到 $DUMP_FILE"; exit 1; }

echo "⚠️  將清空本地 woyu_money DB 並還原自 $DUMP_FILE"
read -p "確認？(yes/no) " confirm
[ "$confirm" = "yes" ] || { echo "取消"; exit 0; }

echo "📦 還原中..."
docker exec -i woyu-postgres psql -U woyu -d postgres -c "DROP DATABASE IF EXISTS woyu_money;"
docker exec -i woyu-postgres psql -U woyu -d postgres -c "CREATE DATABASE woyu_money;"
docker exec -i woyu-postgres pg_restore -U woyu -d woyu_money \
  --clean --if-exists --no-owner --no-acl < "$DUMP_FILE"

echo "✅ 還原完成、驗證表數..."
docker exec woyu-postgres psql -U woyu -d woyu_money \
  -c "SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema='public';"
