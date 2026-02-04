# 浯島財務管理系統

## Overview

浯島財務管理系統是一個全功能的財務管理應用程式，設計用於管理民宿營運、家庭理財和兒童財務教育的整合平台。系統採用現代化的全棧架構，支援多種財務管理功能，包括付款管理、預算規劃、營收追蹤和教育遊戲。

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **UI Components**: Radix UI with Tailwind CSS
- **State Management**: TanStack React Query for server state
- **Routing**: React Router for client-side navigation
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **API Design**: RESTful API with clear endpoint structure
- **Authentication**: Passport.js with local strategy and session management
- **File Upload**: Multer for handling file uploads (contracts, receipts)

### Database Layer
- **Database**: PostgreSQL (via Neon serverless)
- **ORM**: Drizzle ORM with TypeScript schema definitions
- **Connection**: Neon serverless connection with WebSocket support
- **Migrations**: Drizzle Kit for schema management

## Key Components

### 1. Payment Management System (專案管理)
- **Core Features**: Payment item tracking, installment management, project-based organization
- **Database Tables**: `payment_items`, `payment_records`, `payment_projects`, `debt_categories`
- **Key Functionality**: Batch import, Excel data processing, payment scheduling

### 2. Household Finance Management (家庭理財)
- **Core Features**: Budget planning, expense tracking, financial reporting
- **Database Tables**: `household_budgets`, `household_expenses`, `family_members`
- **Unified Interface**: Single-page application with tabbed interface for all household finance functions

### 3. Kids Education Platform (兒童財務教育)
- **Core Features**: Allowance management, savings tracking, educational games
- **Database Tables**: `child_accounts`, `allowance_management`, `kids_wishlist`, `achievements`
- **Gamification**: Achievement system and progress tracking

### 4. Rental Management
- **Core Features**: Contract management, price tier tracking, document storage
- **Database Tables**: `rental_contracts`, `rental_price_tiers`, `contract_documents`
- **Document Support**: File upload and attachment system

### 5. Business Intelligence
- **Core Features**: Revenue tracking, performance analytics, dashboard reporting
- **Database Tables**: `daily_pms_records`, `project_budgets`
- **Data Import**: Excel file processing for historical data

## Data Flow

### 1. Payment Processing Flow
```
User Input → Validation → Database Storage → Audit Logging → Notification Generation
```

### 2. Budget Management Flow
```
Budget Creation → Category Assignment → Expense Tracking → Progress Monitoring → Report Generation
```

### 3. File Upload Flow
```
File Upload → Storage (local/uploads) → Database Reference → Access Control → Download
```

### 4. Authentication Flow
```
Login Request → Credential Validation → Session Creation → Permission Check → Access Grant
```

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Type-safe database operations
- **express**: Web application framework
- **passport**: Authentication middleware
- **multer**: File upload handling
- **xlsx**: Excel file processing

### UI Dependencies
- **@radix-ui/**: Component library for accessible UI elements
- **tailwindcss**: Utility-first CSS framework
- **@tanstack/react-query**: Server state management
- **react-hook-form**: Form handling and validation

### Development Dependencies
- **typescript**: Type safety and development experience
- **vite**: Fast development server and build tool
- **tsx**: TypeScript execution for Node.js

## Deployment Strategy

### Development Environment
- **Server**: Express development server with hot reload
- **Client**: Vite development server with HMR
- **Database**: Neon serverless PostgreSQL
- **File Storage**: Local filesystem (uploads directory)

### Production Considerations
- **Build Process**: Vite build for client, esbuild for server
- **Database**: Neon serverless with connection pooling
- **File Storage**: Recommendations for cloud storage migration
- **Performance**: Indexed queries, connection optimization, caching strategies

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string
- **SESSION_SECRET**: Session encryption key
- **NODE_ENV**: Environment flag for production optimizations

### 6. Document Inbox (單據收件箱)
- **Core Features**: Quick document capture with AI recognition, auto-categorization, archive to payment system
- **Database Tables**: `document_inbox`, `invoice_records`
- **AI Integration**: Gemini AI via Replit AI Integrations for document recognition
- **Document Types**: Bills (帳單) → Payment Items, Payment Receipts (付款憑證) → Payment Records, Invoices (發票) → Invoice Records
- **Workflow**: Upload → AI Recognition → Pending Inbox → Review → Archive
- **File Storage**: Replit Object Storage (cloud-based) for persistent file storage in production
- **Image Path Format**: `/objects/inbox/<uuid>.<ext>` served via `/objects/*` endpoint

## Changelog

Changelog:
- November 28, 2025. 付款項目來源追蹤功能：(1)新增 payment_items 資料表欄位追蹤項目來源(source: 'manual'手動新增/'ai_scan'AI掃描歸檔)，(2)新增完整歸檔追蹤欄位(sourceDocumentId來源單據ID、documentUploadedAt/documentUploadedByUserId/documentUploadedByUsername單據上傳資訊、archivedByUserId/archivedByUsername/archivedAt歸檔者資訊)，(3)歸檔API自動填入所有追蹤欄位並保存完整備註記錄，(4)一般付款管理頁面顯示來源標籤(🤖AI掃描/手動新增)，(5)項目詳情對話框新增「項目來源」區塊顯示完整追蹤資訊（上傳者/歸檔者/時間）
- November 28, 2025. 單據收件箱圖片儲存遷移至雲端：(1)從本地檔案系統遷移到 Replit Object Storage 雲端儲存，解決生產環境(autoscale部署)檔案消失問題，(2)新增 server/objectStorage.ts 和 server/objectAcl.ts 處理雲端儲存操作，(3)圖片路徑格式從 /uploads/inbox/ 改為 /objects/inbox/，(4)新增 GET /objects/* 端點提供雲端檔案存取，(5)上傳後自動清理本地暫存檔案，(6)刪除功能支援雲端與本地檔案，(7)修正生產環境圖片無法顯示的問題
- November 28, 2025. 單據收件箱操作追蹤功能完成：(1)新增資料庫欄位追蹤上傳者/編輯者/歸檔者資訊(uploadedByUsername, editedByUserId, editedByUsername, editedAt, archivedByUserId, archivedByUsername)，(2)上傳時自動記錄上傳帳號與時間，(3)編輯備註時自動記錄編輯帳號與時間，(4)歸檔時將完整追蹤資訊寫入備註（上傳時間/上傳帳號/編輯帳號/歸檔帳號），(5)文件卡片顯示上傳者資訊，(6)預覽對話框新增「追蹤資訊」區塊顯示完整操作歷史，(7)支援多檔上傳功能，可一次選擇多張圖片
- November 28, 2025. 單據收件箱前端頁面完成：(1)建立完整Document Inbox頁面(/document-inbox)支援三種單據類型(帳單/付款憑證/發票)，(2)拖放式上傳區域與相機拍照功能，(3)統計卡片顯示各類型待處理數量，(4)篩選標籤(全部/辨識中/待整理/失敗)，(5)文件卡片預覽含AI辨識結果(廠商/金額/日期/信心度)，(6)詳情對話框顯示完整AI辨識資訊，(7)歸檔對話框支援轉為付款項目/付款記錄/發票記錄三種類型，(8)整合導航列新增「單據收件箱」入口含AI標籤，(9)使用共享DocumentInbox類型確保前後端一致性，(10)正確使用apiRequest處理所有API呼叫含認證
- November 27, 2025. 現金流已付款追蹤增強：(1)新增GET /api/payment/records/cashflow API從payment_records取得實際付款記錄含到期日資訊，(2)返回paymentMonth/dueMonth/isCurrentMonthItem欄位區分本月項目與延遲項目，(3)更新CashflowForecast元件處理paymentRecords，按付款月份分配到正確月份，(4)新增PaidDetailPopover元件分兩區顯示：「本月項目」(灰色)和「他月項目(延遲付款)」(橙色)，(5)每區顯示項目明細含名稱/專案/日期/金額及小計，(6)測試驗證11月$503,303=$58,890本月+$444,413延遲
- November 27, 2025. 預算計算與現金流預測付款類型優化：(1)新增calculateItemTotal()輔助函數根據付款類型計算項目總額，(2)月付款項=月付金額×月數、分期付款=計劃總金額、一次性=計劃金額，(3)所有預算計劃API返回calculatedTotal取代靜態totalBudget欄位，(4)現金流預測根據付款類型分配：月付顯示「(月付X/Y)」格式、分期顯示「(第X期/Y期)」格式、一次性顯示「(一次性)」格式，(5)修正預算卡片使用項目計算總額（例如：$50,000×12月=$600,000而非$100,000），(6)優化BudgetItem介面新增paymentType、monthlyAmount、monthCount、installmentCount、installmentAmount欄位
- November 27, 2025. 現金流預測預算整合功能完成：(1)整合預算計劃資料到現金流預測四分類(預算/已排程/預估到期/月付固定)，(2)實現智能按比例分攤邏輯根據日期範圍自動計算月份數並平均分配金額，(3)多月項目顯示「(X期分攤)」標籤清楚標示分攤期數，(4)新增四類勾選篩選功能可自由組合疊加顯示，(5)新增滑鼠懸停詳細條列彈出視窗顯示項目明細(名稱/金額/日期/專案)，(6)優化BudgetItem介面移除不存在的欄位依賴，(7)API增強GET /api/budget/plans?includeItems=true返回計劃含項目詳情
- November 27, 2025. 完整軟刪除/恢復系統與審計日誌功能：(1)後端新增軟刪除機制，刪除項目時設定deletedAt時間戳記而非實際刪除，(2)新增回收站頁面(/recycle-bin)可查看、恢復或永久刪除已刪除項目，(3)實現完整審計日誌記錄系統，追蹤所有CRUD操作包含操作者、時間、變更內容，(4)一般付款管理項目詳情對話框新增「操作歷史記錄」可展開區塊查看項目變更記錄，(5)回收站頁面項目可查看完整操作歷史記錄，(6)前端刪除確認對話框改為顯示「移至回收站」提示，(7)收據圖片顯示功能正常含錯誤回退機制，(8)新增防禦性Array.isArray()檢查確保審計日誌UI穩健性
- November 27, 2025. 一般付款管理篩選功能優化完成：(1)修正專案篩選邏輯，從名稱比對改為 projectId 直接比對，解決類型不匹配問題，(2)修正分類篩選邏輯使用 categoryId/fixedCategoryId 直接比對，(3)修正預設值，移除年月限制預設顯示所有項目，(4)新增快速篩選按鈕(待付款/已逾期/本月/所有未付)保留專案分類篩選，(5)新增一鍵重置篩選功能清除所有篩選條件，(6)增強空結果提示顯示篩選建議和快速操作按鈕，(7)新增即時項目計數顯示(顯示 X / Y 筆)
- November 27, 2025. 財務總覽系統全面優化完成：(1)新增統一搜尋篩選元件(unified-search-filter.tsx)支援全域搜尋、Ctrl+K快捷鍵、多選篩選器(專案/分類/狀態/優先級)、5種到期日範圍篩選(全部/7天/30天/90天/逾期)，(2)新增應付款到期看板(due-date-dashboard.tsx)自動分類逾期/緊急/即將到期項目，視覺化倒數提醒，快速付款按鈕整合，(3)新增現金流預測元件(cashflow-forecast.tsx)提供3-6個月財務預測圖表，三類支出分析(已排程/預估到期/月付固定)，(4)新增財務健康儀表板(financial-health-dashboard.tsx)顯示0-100健康評分、狀態分佈圓餅圖、關鍵指標(完成率/逾期率/付款進度)，(5)新增財務總覽整合頁面(/financial-overview)四分頁展示所有儀表板，(6)所有數值計算使用安全解析函數(safeParseFloat)防護NaN/null/undefined值避免圖表崩潰
- October 10, 2025. 付款排程系統全面優化完成：將付款排程頁面從簡單排程工具轉型為完整預算規劃與執行追蹤系統。核心改進：(1)建立整合API `/api/payment/items/integrated` 提供三維金額追蹤（應付總額/實際已付/計劃排程），(2)實現持久化項目顯示機制，排程≠付款，項目持續顯示直到實際付款完成，(3)添加跨月追蹤功能，逾期未執行項目自動在未來月份顯示提醒，(4)新增預算概覽面板，顯示月度預算、已排程金額、已執行付款、可用額度及計劃執行率，(5)實現快速付款流程，從排程詳情直接跳轉付款表單並自動帶入金額，(6)優化狀態視覺化，使用顏色編碼清楚標示項目狀態（紅=逾期未付、黃=計劃待付、綠=已完成），(7)客戶端月份過濾確保所有預算指標準確限定在選定月份範圍內
- July 05, 2025. 現金流詳細項目功能完成：新增/api/payment/cashflow/details API，提供具體付款項目和實體狀況資訊，包含項目名稱、金額、付款日期、付款方式、專案歸屬、分類資訊等完整詳情，滿足用戶查看具體現金流項目需求
- July 05, 2025. 第三階段性能優化完成：實施智能緩存策略，改善載入體驗指示器，優化防抖搜尋延遲，增強虛擬滾動載入提示，提升整體操作流暢度和即時性
- July 05, 2025. 第二階段搜尋篩選優化：實作完整鍵盤快捷鍵支援(Ctrl+K搜尋、Alt+數字篩選)，智能篩選組合功能，用戶提示系統優化
- July 05, 2025. 現金流統計功能修正：修正後端API欄位名稱不匹配問題（從amountPaid改為amount），優化數字顯示格式為完整格式而非緊湊格式，雙重統計邏輯完整實現
- July 04, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.