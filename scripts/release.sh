#!/bin/bash
# ============================================================
# Release 腳本 - 語義化版本管理
# 用途：遞增版本號、產生 CHANGELOG、建立 git tag
# 使用：bash scripts/release.sh [major|minor|patch]
# ============================================================

set -euo pipefail

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 參數檢查
BUMP_TYPE="${1:-}"
if [[ ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
  echo ""
  echo "用法: bash scripts/release.sh [major|minor|patch]"
  echo ""
  echo "  major: 重大版本（不相容變更）    1.0.0 → 2.0.0"
  echo "  minor: 功能版本（新增功能）      1.0.0 → 1.1.0"
  echo "  patch: 修復版本（bug 修復）      1.0.0 → 1.0.1"
  echo ""
  exit 1
fi

echo ""
echo "=========================================="
echo "  Release 流程 (${BUMP_TYPE})"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# ============ 步驟 1：驗證分支 ============
log_info "步驟 1/7：驗證分支..."
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  log_error "必須在 main 分支上執行 release（目前在 ${CURRENT_BRANCH}）"
  exit 1
fi
log_ok "在 main 分支上"

# ============ 步驟 2：驗證工作目錄 ============
log_info "步驟 2/7：檢查工作目錄..."
if [ -n "$(git status --porcelain)" ]; then
  log_error "工作目錄不乾淨，請先 commit 或 stash 所有變更"
  git status --short
  exit 1
fi
log_ok "工作目錄乾淨"

# ============ 步驟 3：讀取當前版本 ============
log_info "步驟 3/7：讀取版本號..."
CURRENT_VERSION=$(node -p "require('./package.json').version")
log_info "目前版本: v${CURRENT_VERSION}"

# 計算新版本
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
case "$BUMP_TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac
NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
log_ok "新版本: v${NEW_VERSION}"

# 確認是否已有此 tag
if git rev-parse "v${NEW_VERSION}" >/dev/null 2>&1; then
  log_error "Tag v${NEW_VERSION} 已存在"
  exit 1
fi

# ============ 步驟 4：執行測試 ============
log_info "步驟 4/7：執行測試..."
if npm test 2>/dev/null; then
  log_ok "測試全部通過"
else
  log_error "測試失敗，請修復後再 release"
  exit 1
fi

# ============ 步驟 5：更新版本號 ============
log_info "步驟 5/7：更新 package.json 版本號..."
# 使用 node 安全地更新 package.json（保留格式）
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '${NEW_VERSION}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
log_ok "package.json 版本更新為 ${NEW_VERSION}"

# ============ 步驟 6：產生 CHANGELOG ============
log_info "步驟 6/7：產生 CHANGELOG..."
bash scripts/generate-changelog.sh "$NEW_VERSION"
log_ok "CHANGELOG.md 已更新"

# ============ 步驟 7：Commit + Tag ============
log_info "步驟 7/7：建立 release commit 和 tag..."
git add package.json CHANGELOG.md
git commit -m "chore: release v${NEW_VERSION}"
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
log_ok "已建立 commit 和 tag v${NEW_VERSION}"

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Release v${NEW_VERSION} 完成！${NC}"
echo ""
echo "  版本變更: v${CURRENT_VERSION} → v${NEW_VERSION}"
echo ""
echo "  下一步："
echo "    git push origin main        # 推送程式碼"
echo "    git push origin v${NEW_VERSION}   # 推送 tag"
echo ""
echo "  或一次推送全部："
echo "    git push origin main --tags"
echo "=========================================="
