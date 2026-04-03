#!/bin/sh
set -e

# 確保上傳目錄存在且可寫入
UPLOAD_DIRS="uploads uploads/inbox uploads/receipts uploads/contracts uploads/documents uploads/images"
for dir in $UPLOAD_DIRS; do
  if [ ! -d "$dir" ]; then
    echo "[entrypoint] 建立目錄: $dir"
    mkdir -p "$dir" 2>/dev/null || echo "[entrypoint] 警告: 無法建立 $dir（可能權限不足）"
  fi
done

# 驗證 uploads/inbox 可寫入
TEST_FILE="uploads/inbox/.write-test-$$"
if touch "$TEST_FILE" 2>/dev/null; then
  rm -f "$TEST_FILE"
  echo "[entrypoint] uploads/inbox 目錄可寫入 ✓"
else
  echo "[entrypoint] 錯誤: uploads/inbox 不可寫入！請檢查 Docker volume 權限"
  echo "[entrypoint] 目錄權限: $(ls -la uploads/ 2>/dev/null || echo '無法讀取')"
fi

exec "$@"
