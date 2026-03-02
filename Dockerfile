# ====== 階段 1：建置 ======
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# ====== 階段 2：正式環境 ======
FROM node:20-alpine

WORKDIR /app

# 安裝全部依賴（drizzle-kit 遷移需要 devDependencies）
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

# 從 builder 複製建置產物
COPY --from=builder /app/dist ./dist

# 複製 drizzle 設定和 schema（資料庫遷移用）
COPY drizzle.config.ts ./
COPY shared ./shared
COPY migrations ./migrations

# 建立上傳目錄
RUN mkdir -p uploads/inbox

# 非 root 使用者
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5001

CMD ["node", "dist/index.js"]
