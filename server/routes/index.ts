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

export async function registerRoutes(app: Express): Promise<Server> {
  // 設定認證系統
  setupAuth(app)
  setupLineAuth(app)

  // 設定通知路由
  setupNotificationRoutes(app)

  // 靜態檔案服務
  app.use("/uploads", express.static(uploadDir))

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

  const httpServer = createServer(app)
  return httpServer
}
