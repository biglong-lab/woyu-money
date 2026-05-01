import type { Express } from "express"
import { createServer, type Server } from "http"
import express from "express"
import { setupAuth, requireAuth } from "../auth"
import { setupNotificationRoutes } from "../notification-routes"
import { setupLineAuth } from "../line-auth"
import { uploadDir } from "./upload-config"

// 匯入所有領域路由模組
import authRoutes from "./auth"
import categoryRoutes from "./categories"
import categoriesUnifiedRoutes from "./categories-unified"
import householdRoutes from "./household"
import paymentItemRoutes from "./payment-items"
import paymentRecordRoutes from "./payment-records"
import analyticsRoutes from "./analytics"
import loanRoutes from "./loans"
import rentalRoutes from "./rental"
import adminRoutes from "./admin"
import notificationRoutes from "./notifications"
import paymentScheduleRoutes from "./payment-schedule"
import budgetRoutes from "./budget"
import documentInboxRoutes from "./document-inbox"
import invoiceRoutes from "./invoice"
import hrCostRoutes from "./hr-costs"
import reportRoutes from "./reports"
import incomeRoutes from "./income"
import pmBridgeRoutes from "./pm-bridge"
import pmsBridgeRoutes from "./pms-bridge"
import dailyRevenueRoutes from "./daily-revenues"
import aiAssistantRoutes from "./ai-assistant"
import paymentAllocationRoutes from "./payment-allocation"
import lateFeeRoutes from "./late-fee"
import rentalMatrixRoutes from "./rental-matrix"
import rentalBatchRoutes from "./rental-batch"
import cashflowForecastRoutes from "./cashflow-forecast"
import receiptMatchRoutes from "./receipt-match"
import propertyGroupRoutes from "./property-groups"
import budgetAutoGenerateRoutes from "./budget-auto-generate"
import propertyPlRoutes from "./property-pl"
import varianceReportRoutes from "./variance-report"
import dataQualityRoutes from "./data-quality"

export async function registerRoutes(app: Express): Promise<Server> {
  // 設定認證系統
  setupAuth(app)
  setupLineAuth(app)

  // 設定通知路由
  setupNotificationRoutes(app)

  // 靜態檔案服務（需認證才能存取上傳的檔案）
  app.use("/uploads", requireAuth, express.static(uploadDir))
  // 相容舊的 /objects 路徑（從 Replit Object Storage 遷移）
  app.use("/objects", requireAuth, express.static(uploadDir))

  // 全域 API 認證保護（排除公開端點）
  // 注意：middleware 掛在 "/api"，req.path 已不含 /api 前綴
  // 例如請求 /api/line/callback，這裡的 req.path 是 /line/callback
  app.use("/api", (req, res, next) => {
    // 公開端點白名單（不需要認證）— 路徑不含 /api 前綴
    // - /login /register /logout /user：setupAuth() 註冊，理論上在此 middleware 之前已處理，
    //   保留為雙保險
    // - /auth/line：LINE OAuth 起點（line-auth.ts），同樣早於此 middleware 註冊
    // - /line/callback：LINE OAuth 回呼（admin.ts），晚於此 middleware 註冊，必須在白名單
    const publicPaths = ["/login", "/register", "/logout", "/user", "/auth/line", "/line/callback"]
    // Webhook 接收端點：以 /income/webhook/ 開頭的 POST 請求不需 session 認證
    // （改用 secret/token 驗證，在路由層處理）
    const isWebhookReceiver = req.method === "POST" && req.path.startsWith("/income/webhook/")

    const isPublic = publicPaths.some((p) => req.path === p) || isWebhookReceiver
    if (isPublic) return next()
    return requireAuth(req, res, next)
  })

  // 註冊所有領域路由
  app.use(authRoutes)
  // 統一 categories API 必須在 categoryRoutes 之前註冊
  // 避免 /api/categories/:id 吃掉 /api/categories/unified 等子路徑
  app.use(categoriesUnifiedRoutes)
  app.use(categoryRoutes)
  app.use(householdRoutes)
  app.use(paymentItemRoutes)
  app.use(paymentRecordRoutes)
  app.use(analyticsRoutes)
  app.use(loanRoutes)
  app.use(rentalRoutes)
  app.use(adminRoutes)
  app.use(notificationRoutes)
  app.use(paymentScheduleRoutes)
  // 注意：budgetAutoGenerateRoutes 必須在 budgetRoutes 之前註冊
  // 因為 budgetRoutes 有 /api/budget/plans/:id 會吃掉 /api/budget/plans/by-month
  // （即使 :id 已加 \d+ regex 雙保險，順序仍維持正確以防 regex 改動）
  app.use(budgetAutoGenerateRoutes)
  app.use(budgetRoutes)
  app.use(documentInboxRoutes)
  app.use(invoiceRoutes)
  app.use(hrCostRoutes)
  app.use(reportRoutes)
  app.use(incomeRoutes)
  app.use(pmBridgeRoutes)
  app.use(pmsBridgeRoutes)
  app.use(dailyRevenueRoutes)
  app.use(aiAssistantRoutes)
  app.use(paymentAllocationRoutes)
  app.use(lateFeeRoutes)
  app.use(rentalMatrixRoutes)
  app.use(rentalBatchRoutes)
  app.use(cashflowForecastRoutes)
  app.use(receiptMatchRoutes)
  app.use(propertyGroupRoutes)
  app.use(propertyPlRoutes)
  app.use(varianceReportRoutes)
  app.use(dataQualityRoutes)

  const httpServer = createServer(app)
  return httpServer
}
