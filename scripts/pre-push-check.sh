#!/bin/bash
# ============================================================
# Pre-push 安全檢查腳本
# 用途：推送前自動執行型別檢查、console.log 掃描、測試
# 使用：由 .husky/pre-push 自動呼叫
# ============================================================

set -euo pipefail

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[pre-push]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[pre-push]${NC} ✅ $1"; }
log_warn()  { echo -e "${YELLOW}[pre-push]${NC} ⚠️  $1"; }
log_error() { echo -e "${RED}[pre-push]${NC} ❌ $1"; }

ERRORS=0

echo ""
echo "=========================================="
echo "  Pre-push 安全檢查"
echo "=========================================="
echo ""

# ============ 檢查 1：TypeScript 型別 ============
log_info "檢查 1/4：TypeScript 型別檢查..."
if npx tsc --noEmit 2>/dev/null; then
  log_ok "TypeScript 型別檢查通過"
else
  log_error "TypeScript 型別檢查失敗"
  ERRORS=$((ERRORS + 1))
fi

# ============ 檢查 2：console.log 殘留 ============
log_info "檢查 2/4：掃描 console.log 殘留..."

# 掃描 server/ 和 client/src/（排除測試、node_modules）
CONSOLE_LOGS=$(grep -rn "console\.log" \
  --include="*.ts" --include="*.tsx" \
  server/ client/src/ \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude="*.test.*" \
  --exclude="*.spec.*" \
  2>/dev/null || true)

if [ -n "$CONSOLE_LOGS" ]; then
  COUNT=$(echo "$CONSOLE_LOGS" | wc -l | tr -d ' ')
  log_error "發現 ${COUNT} 處 console.log 殘留："
  echo "$CONSOLE_LOGS" | head -10
  if [ "$COUNT" -gt 10 ]; then
    echo "  ... 還有 $((COUNT - 10)) 處"
  fi
  ERRORS=$((ERRORS + 1))
else
  log_ok "無 console.log 殘留"
fi

# ============ 檢查 3：測試 ============
log_info "檢查 3/4：執行測試..."
if npm test 2>/dev/null; then
  log_ok "所有測試通過"
else
  log_error "測試失敗"
  ERRORS=$((ERRORS + 1))
fi

# ============ 檢查 4：推送摘要 ============
log_info "檢查 4/4：推送摘要..."

# 取得即將推送的 commit
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
if [ -n "$REMOTE" ]; then
  COMMITS=$(git log --oneline "${REMOTE}..HEAD" 2>/dev/null || echo "")
  if [ -n "$COMMITS" ]; then
    COMMIT_COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')
    echo ""
    echo -e "${BLUE}即將推送 ${COMMIT_COUNT} 個 commit：${NC}"
    echo "$COMMITS"
  fi
fi

# 顯示版本號
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
echo ""
echo -e "${BLUE}目前版本: v${VERSION}${NC}"

# ============ 結果 ============
echo ""
echo "=========================================="
if [ "$ERRORS" -gt 0 ]; then
  log_error "發現 ${ERRORS} 個問題，推送已阻擋"
  echo ""
  echo "  請修復以上問題後再推送"
  echo "  如需跳過檢查（不建議）: git push --no-verify"
  echo "=========================================="
  exit 1
else
  log_ok "所有檢查通過，允許推送"
  echo "=========================================="
  exit 0
fi
