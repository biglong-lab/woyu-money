#!/bin/bash
# ============================================================
# Commit 訊息格式驗證
# 用途：確保 commit 訊息符合 Conventional Commits 規範
# 格式：type: description
# 使用：由 .husky/commit-msg 自動呼叫
# ============================================================

COMMIT_MSG_FILE="$1"
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 允許的 commit type（支援可選的 scope，如 chore(auto): ...）
PATTERN='^(feat|fix|refactor|style|docs|test|chore|perf|ci|WIP)(\([a-zA-Z0-9_-]+\))?: .+'

# 允許 merge commit
if echo "$COMMIT_MSG" | grep -qE '^Merge '; then
  exit 0
fi

# 允許 revert commit
if echo "$COMMIT_MSG" | grep -qE '^Revert '; then
  exit 0
fi

# 驗證格式
if ! echo "$COMMIT_MSG" | grep -qE "$PATTERN"; then
  echo ""
  echo -e "${RED}❌ Commit 訊息格式不正確${NC}"
  echo ""
  echo -e "你的訊息: ${YELLOW}${COMMIT_MSG}${NC}"
  echo ""
  echo -e "${GREEN}正確格式: type: 描述${NC}"
  echo ""
  echo "允許的 type："
  echo "  feat:     新功能"
  echo "  fix:      修復 bug"
  echo "  refactor: 重構（不改變功能）"
  echo "  style:    樣式調整"
  echo "  docs:     文件更新"
  echo "  test:     測試相關"
  echo "  chore:    雜項（依賴更新、設定等）"
  echo "  perf:     效能優化"
  echo "  ci:       CI/CD 相關"
  echo "  WIP:      進行中的工作"
  echo ""
  echo "範例："
  echo "  feat: 新增會員登入功能"
  echo "  fix: 修復密碼重設問題"
  echo "  refactor: 重構使用者模組"
  echo "  chore: 更新依賴套件"
  echo ""
  exit 1
fi

# 檢查描述長度（第一行不超過 100 字元）
FIRST_LINE=$(echo "$COMMIT_MSG" | head -1)
if [ ${#FIRST_LINE} -gt 100 ]; then
  echo ""
  echo -e "${RED}❌ Commit 訊息第一行超過 100 字元（目前 ${#FIRST_LINE} 字元）${NC}"
  echo -e "請縮短描述，詳細說明放在第二行之後"
  echo ""
  exit 1
fi

exit 0
