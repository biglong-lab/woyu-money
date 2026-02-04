# 浯島財務管理系統 - 備份與部署指南

## 專案概述
浯島財務管理系統是一個全功能的財務管理應用程式，包含：
- 付款管理與追蹤
- 家庭理財規劃
- 兒童財務教育
- AI 文件辨識（Gemini AI）
- 雲端檔案儲存

## 技術架構

### 前端
- React + TypeScript
- Vite 建構工具
- Tailwind CSS + Radix UI
- TanStack React Query

### 後端
- Node.js + Express
- TypeScript
- Passport.js 認證（帳密 + LINE 登入）

### 資料庫
- PostgreSQL（Neon Serverless）
- Drizzle ORM

### 檔案儲存
- Replit Object Storage（雲端）

## 本地開發設定

### 1. 安裝依賴
```bash
npm install
```

### 2. 環境變數設定
建立 `.env` 檔案：
```env
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=your_session_secret

# LINE 登入（選配）
LINE_CHANNEL_ID=your_line_channel_id
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CALLBACK_URL=https://your-domain.com/api/auth/line/callback

# AI 文件辨識（選配）
GEMINI_API_KEY=your_gemini_api_key

# Object Storage（雲端儲存，Replit 專用）
DEFAULT_OBJECT_STORAGE_BUCKET_ID=your_bucket_id
```

### 3. 資料庫遷移
```bash
npm run db:push
```

### 4. 啟動開發伺服器
```bash
npm run dev
```

## 檔案結構
```
├── server/           # 後端程式碼
│   ├── routes.ts     # API 路由
│   ├── storage.ts    # 資料庫操作
│   ├── auth.ts       # 認證邏輯
│   ├── document-ai.ts # AI 文件辨識
│   └── objectStorage.ts # 雲端儲存
├── client/src/       # 前端程式碼
│   ├── pages/        # 頁面元件
│   ├── components/   # 共用元件
│   ├── hooks/        # React Hooks
│   └── lib/          # 工具函數
├── shared/           # 前後端共用
│   └── schema.ts     # 資料庫結構定義
└── migrations/       # 資料庫遷移檔案
```

## 重要功能模組

### 1. 單據收件箱 (Document Inbox)
- 路徑: `/document-inbox`
- 功能: 上傳單據圖片，AI 自動辨識金額、廠商、日期
- 支援: 帳單、付款憑證、發票三種類型
- 歸檔流程: 待整理 → 歸檔至付款項目/記錄

### 2. 一般付款管理
- 路徑: `/general-payment-management`
- 功能: 付款項目管理、狀態追蹤、篩選搜尋

### 3. 現金流預測
- 路徑: `/financial-overview`
- 功能: 財務健康儀表板、到期看板、現金流圖表

## 雲端部署注意事項

### Replit 部署
1. 使用 Autoscale 部署模式
2. Object Storage 自動設定
3. 環境變數在 Secrets 中配置

### 自架部署
1. 需自行配置 PostgreSQL
2. 檔案儲存需改用 S3/GCS 等服務
3. 修改 `server/objectStorage.ts` 適配不同儲存後端

## 資料庫表格清單
主要表格：
- users: 使用者帳號
- payment_items: 付款項目
- payment_records: 付款記錄
- payment_projects: 付款專案
- document_inbox: 單據收件箱
- budget_plans/budget_items: 預算規劃
- household_expenses: 家庭支出
- 等共 60+ 個表格

## 備份內容
- woyu_backup_*.tar.gz: 完整程式碼備份
- 資料庫需另外匯出（使用 pg_dump）

## 聯絡與支援
如有問題請參考 replit.md 或專案文件。
