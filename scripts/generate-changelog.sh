#!/bin/bash
# ============================================================
# CHANGELOG 自動產生腳本
# 用途：從 git log 自動產生格式化的 CHANGELOG.md
# 使用：bash scripts/generate-changelog.sh [version]
# ============================================================

set -euo pipefail

VERSION="${1:-}"
DATE=$(date '+%Y-%m-%d')
CHANGELOG_FILE="CHANGELOG.md"

# 取得上一個 tag（如果有的話）
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -n "$LAST_TAG" ]; then
  RANGE="${LAST_TAG}..HEAD"
  SINCE_DESC="自 ${LAST_TAG} 以來"
else
  RANGE=""
  SINCE_DESC="所有歷史"
fi

# 收集各類型的 commit
collect_commits() {
  local type_prefix="$1"
  if [ -n "$RANGE" ]; then
    git log "$RANGE" --pretty=format:"- %s (%h)" --no-merges | grep -E "^- ${type_prefix}: " | sed "s/^- ${type_prefix}: /- /" || true
  else
    git log --pretty=format:"- %s (%h)" --no-merges | grep -E "^- ${type_prefix}: " | sed "s/^- ${type_prefix}: /- /" || true
  fi
}

# 產生新版本的 changelog 區塊
generate_block() {
  local block=""
  local has_content=false

  # 版本標題
  if [ -n "$VERSION" ]; then
    block="## [${VERSION}] - ${DATE}\n\n"
  else
    block="## [未發布] - ${DATE}\n\n"
  fi

  # 新功能
  local feats
  feats=$(collect_commits "feat")
  if [ -n "$feats" ]; then
    block+="### 新功能\n${feats}\n\n"
    has_content=true
  fi

  # 修復
  local fixes
  fixes=$(collect_commits "fix")
  if [ -n "$fixes" ]; then
    block+="### 修復\n${fixes}\n\n"
    has_content=true
  fi

  # 重構
  local refactors
  refactors=$(collect_commits "refactor")
  if [ -n "$refactors" ]; then
    block+="### 重構\n${refactors}\n\n"
    has_content=true
  fi

  # 效能
  local perfs
  perfs=$(collect_commits "perf")
  if [ -n "$perfs" ]; then
    block+="### 效能\n${perfs}\n\n"
    has_content=true
  fi

  # 樣式
  local styles
  styles=$(collect_commits "style")
  if [ -n "$styles" ]; then
    block+="### 樣式\n${styles}\n\n"
    has_content=true
  fi

  # 測試
  local tests
  tests=$(collect_commits "test")
  if [ -n "$tests" ]; then
    block+="### 測試\n${tests}\n\n"
    has_content=true
  fi

  # 文件
  local docs
  docs=$(collect_commits "docs")
  if [ -n "$docs" ]; then
    block+="### 文件\n${docs}\n\n"
    has_content=true
  fi

  # CI/CD
  local cis
  cis=$(collect_commits "ci")
  if [ -n "$cis" ]; then
    block+="### CI/CD\n${cis}\n\n"
    has_content=true
  fi

  # 雜項
  local chores
  chores=$(collect_commits "chore")
  if [ -n "$chores" ]; then
    block+="### 雜項\n${chores}\n\n"
    has_content=true
  fi

  if [ "$has_content" = false ]; then
    block+="- 無分類變更\n\n"
  fi

  echo -e "$block"
}

# 產生 CHANGELOG
HEADER="# 更新紀錄 (CHANGELOG)\n\n所有重要的變更都會記錄在此檔案中。\n\n格式基於 [Keep a Changelog](https://keepachangelog.com/)，版本編號遵循 [語義化版本](https://semver.org/)。\n\n---\n\n"
NEW_BLOCK=$(generate_block)

if [ -f "$CHANGELOG_FILE" ]; then
  # 已有 CHANGELOG：在 --- 分隔線後插入新區塊
  # 移除舊的 header，保留版本紀錄
  EXISTING=$(sed '1,/^---$/d' "$CHANGELOG_FILE")
  echo -e "${HEADER}${NEW_BLOCK}---\n${EXISTING}" > "$CHANGELOG_FILE"
else
  # 全新 CHANGELOG
  echo -e "${HEADER}${NEW_BLOCK}" > "$CHANGELOG_FILE"
fi

echo "✅ CHANGELOG.md 已更新（${SINCE_DESC}）"
