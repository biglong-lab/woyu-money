import express from "express"
import { storage } from "./storage"

export function setupLineAuth(app: express.Express) {
  // LINE登入授權URL
  app.get("/api/auth/line", async (req, res) => {
    try {
      const config = await storage.getLineConfig()

      if (!config || !config.isEnabled || !config.channelId || !config.channelSecret) {
        return res.status(400).json({ message: "LINE登入尚未設定或已停用" })
      }

      const state = Math.random().toString(36).substring(7)
      req.session.lineState = state

      const authUrl =
        `https://access.line.me/oauth2/v2.1/authorize?` +
        `response_type=code&` +
        `client_id=${config.channelId}&` +
        `redirect_uri=${encodeURIComponent(config.callbackUrl || "")}&` +
        `state=${state}&` +
        `scope=profile%20openid%20email`

      res.redirect(authUrl)
    } catch (error) {
      console.error("LINE auth setup error:", error)
      res.status(500).json({ message: "LINE登入設定錯誤" })
    }
  })

  // Note: LINE callback handling is in routes.ts to avoid conflicts
}
