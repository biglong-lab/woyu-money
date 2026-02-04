# 資料庫備份說明

## 備份內容
此資料夾包含資料庫的 CSV 匯出檔案，可用於資料遷移。

## 主要資料表
- users.csv - 使用者帳號 (12筆)
- payment_projects.csv - 付款專案 (10筆)
- payment_items.csv - 付款項目 (1474筆)
- payment_records.csv - 付款記錄 (338筆)
- fixed_categories.csv - 固定分類 (10筆)
- debt_categories.csv - 支出分類 (55筆)
- document_inbox.csv - 單據收件箱 (27筆)

## 匯入步驟

### 1. 建立資料庫結構
```bash
npm run db:push
```

### 2. 使用 psql 匯入 CSV
```bash
# 連線到資料庫
psql $DATABASE_URL

# 匯入各表
\copy users FROM 'users.csv' WITH (FORMAT CSV, HEADER true);
\copy payment_projects FROM 'payment_projects.csv' WITH (FORMAT CSV, HEADER true);
# ... 依此類推
```

### 3. 或使用 Node.js 腳本
可以撰寫腳本讀取 CSV 並用 Drizzle ORM 插入資料。

## 注意事項
- 匯入順序很重要，需先匯入被參照的表（如 users, payment_projects）
- 密碼已加密儲存，無法解密
- 某些欄位可能需要調整以符合新環境
