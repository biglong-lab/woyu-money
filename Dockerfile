# ====== 階段 1：建置 ======
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# ====== 階段 2：正式環境 ======
FROM node:20-alpine

# 時區設定：alpine 預設 UTC、安裝 tzdata 改 Asia/Taipei
# 避免 new Date() 取 UTC 導致 PM snapshot 日期歪斜（台灣凌晨 0-8 點操作會用前一天日期）
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Taipei /etc/localtime && \
    echo "Asia/Taipei" > /etc/timezone
ENV TZ=Asia/Taipei

WORKDIR /app

# 安裝全部依賴（drizzle-kit 遷移需要 devDependencies）
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps && npm cache clean --force

# 從 builder 複製建置產物
COPY --from=builder /app/dist ./dist

# 複製 drizzle 設定和 schema（資料庫遷移用）
COPY drizzle.config.ts ./
COPY shared ./shared
COPY migrations ./migrations

# 複製對外公開的整合規範文件（給對接方讀）
COPY docs/integration-api.md ./docs/integration-api.md
COPY docs/openapi.yaml ./docs/openapi.yaml

# 建立上傳目錄（含所有子目錄）
RUN mkdir -p uploads/inbox uploads/receipts uploads/contracts uploads/documents uploads/images

# 非 root 使用者
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app

# 複製啟動腳本
COPY --chown=appuser:appgroup docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER appuser

EXPOSE 5001

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
