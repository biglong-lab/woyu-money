#!/bin/sh
set -e

# 上傳目錄列表
UPLOAD_DIRS="uploads uploads/inbox uploads/receipts uploads/contracts uploads/documents uploads/images"

# 1. 確保所有目錄存在
for dir in $UPLOAD_DIRS; do
  if [ ! -d "$dir" ]; then
    echo "[entrypoint] 建立目錄: $dir"
    mkdir -p "$dir" 2>/dev/null || echo "[entrypoint] 警告: 無法建立 $dir（可能權限不足）"
  fi
done

# 2. 驗證每個子目錄可寫入；若不可寫，嘗試 chmod a+w 自我修復
#    （適用於 docker named volume 第一次掛載 root:root 的情況）
WRITE_OK=1
for dir in uploads/inbox uploads/receipts uploads/contracts uploads/documents uploads/images; do
  TEST_FILE="$dir/.write-test-$$"
  if touch "$TEST_FILE" 2>/dev/null; then
    rm -f "$TEST_FILE"
  else
    echo "[entrypoint] 警告: $dir 不可寫入，嘗試 chmod a+w 自救…"
    chmod a+w "$dir" 2>/dev/null || echo "[entrypoint] chmod 失敗（appuser 無權限）"
    if touch "$TEST_FILE" 2>/dev/null; then
      rm -f "$TEST_FILE"
      echo "[entrypoint] $dir 已自救成功 ✓"
    else
      echo "[entrypoint] 錯誤: $dir 仍不可寫，需手動修權限："
      echo "    docker exec -u root woyu-money chown -R appuser:appgroup /app/uploads"
      WRITE_OK=0
    fi
  fi
done

if [ "$WRITE_OK" = "1" ]; then
  echo "[entrypoint] 所有上傳目錄可寫入 ✓"
fi

exec "$@"
