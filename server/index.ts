import express, { type NextFunction } from "express"
import { registerRoutes } from "./routes"
import { setupVite, serveStatic, log } from "./vite"
import { notificationScheduler } from "./notification-scheduler"
import { recurringExpenseScheduler } from "./recurring-expense-scheduler"
import { securityHeaders, validateInput, rateLimits } from "./security"
import { globalErrorHandler } from "./middleware/error-handler"

const app = express()

// 信任 1 層 proxy（Cloudflare / nginx），讓 req.ip 拿到真實 client IP
// 否則 rate limit 會把所有從 CF 進來的請求視為同一個 IP、瞬間爆 quota
app.set("trust proxy", 1)

// 安全中間件（必須在路由之前掛載）
app.use(securityHeaders)
app.use(express.json({ limit: "10kb" }))
app.use(express.urlencoded({ extended: false, limit: "10kb" }))
app.use(validateInput)

// 認證相關速率限制
app.use("/api/login", rateLimits.auth)
app.use("/api/register", rateLimits.auth)
app.use("/api/upload", rateLimits.upload)
app.use("/api", rateLimits.general)

app.use((req, res, next) => {
  const start = Date.now()
  const path = req.path
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined

  const originalResJson = res.json
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson
    return originalResJson.apply(res, [bodyJson, ...args])
  }

  res.on("finish", () => {
    const duration = Date.now() - start
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…"
      }

      log(logLine)
    }
  })

  next()
})
;(async () => {
  const server = await registerRoutes(app)

  // 全域錯誤處理中間件（統一錯誤回應格式）
  app.use(globalErrorHandler)

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server)
  } else {
    serveStatic(app)
  }

  const port = parseInt(process.env.PORT || "5001", 10)
  // Add process error handlers to prevent crashes
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error)
    // Log but don't exit in production
  })

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason)
    // Log but don't exit in production
  })

  server.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`)

      // 啟動通知排程器
      try {
        notificationScheduler.start()
      } catch (error) {
        console.error("通知排程器啟動失敗:", error)
        // Continue running even if notification scheduler fails
      }

      // 啟動週期性支出排程器（每月 1 號自動產出 unpaid 待確認）
      try {
        recurringExpenseScheduler.start()
      } catch (error) {
        console.error("週期性支出排程器啟動失敗:", error)
      }
    }
  )
})()
