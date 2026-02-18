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
  app.use("/api", (req, res, next) => {
    // 公開端點白名單（不需要認證）
    const publicPaths = [
      "/api/login",
      "/api/register",
      "/api/logout",
      "/api/user",
      "/api/line/login",
      "/api/line/callback",
    ]
    // Webhook 接收端點：以 /api/income/webhook/ 開頭的 POST 請求不需 session 認證
    // （改用 secret/token 驗證，在路由層處理）
    const isWebhookReceiver =
      req.method === "POST" && req.path.startsWith("/income/webhook/")

    const isPublic = publicPaths.some((p) => req.path === p) || isWebhookReceiver
    if (isPublic) return next()
    return requireAuth(req, res, next)
  })

  // 註冊所有領域路由
  app.use(authRoutes)
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
  app.use(budgetRoutes)
  app.use(documentInboxRoutes)
  app.use(invoiceRoutes)
  app.use(hrCostRoutes)
  app.use(reportRoutes)
  app.use(incomeRoutes)
  app.use(pmBridgeRoutes)
  app.use(dailyRevenueRoutes)

  const httpServer = createServer(app)
  return httpServer
}
