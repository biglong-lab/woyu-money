import { Router } from "express"
import { storage } from "../storage"
import { requireAuth } from "../auth"
import { hashPassword } from "./helpers"
import { DEFAULT_PERMISSIONS } from "@shared/schema"
import fs from "fs"
import path from "path"
import { paymentFileUpload } from "./upload-config"
import { asyncHandler, AppError } from "../middleware/error-handler"

const router = Router()

// 取得所有用戶
router.get(
  "/api/admin/users",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const users = await storage.getAllUsers()
    const safeUsers = users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      authProvider: user.authProvider,
      lastLogin: user.lastLogin,
      menuPermissions: user.menuPermissions,
      createdAt: user.createdAt,
    }))

    res.json(safeUsers)
  })
)

// 建立新用戶
router.post(
  "/api/admin/users",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const { username, password, email, fullName, role } = req.body

    if (!username || !password) {
      throw new AppError(400, "用戶名和密碼為必填項")
    }

    const existingUser = await storage.getUserByUsername(username)
    if (existingUser) {
      throw new AppError(400, "用戶名已存在")
    }

    const hashedPassword = await hashPassword(password)
    const defaultPermissions =
      DEFAULT_PERMISSIONS[role as keyof typeof DEFAULT_PERMISSIONS] || DEFAULT_PERMISSIONS.user2

    const newUser = await storage.createUser({
      username,
      password: hashedPassword,
      email,
      fullName,
      role: role || "user2",
      menuPermissions: defaultPermissions,
      authProvider: "local",
      isActive: true,
    })

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
      isActive: newUser.isActive,
      menuPermissions: newUser.menuPermissions,
      createdAt: newUser.createdAt,
    })
  })
)

// 更新用戶角色
router.put(
  "/api/admin/users/:id/role",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const userId = parseInt(req.params.id)
    const { role } = req.body

    if (!["admin", "user1", "user2"].includes(role)) {
      throw new AppError(400, "無效的角色")
    }

    const updatedUser = await storage.updateUserRole(userId, role)
    const defaultPermissions = DEFAULT_PERMISSIONS[role as keyof typeof DEFAULT_PERMISSIONS]
    await storage.updateUserPermissions(userId, defaultPermissions)

    res.json({
      id: updatedUser.id,
      role: updatedUser.role,
      menuPermissions: defaultPermissions,
    })
  })
)

// 更新用戶權限
router.put(
  "/api/admin/users/:id/permissions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const userId = parseInt(req.params.id)
    const { permissions } = req.body

    const updatedUser = await storage.updateUserPermissions(userId, permissions)

    res.json({
      id: updatedUser.id,
      menuPermissions: updatedUser.menuPermissions,
    })
  })
)

// 重置用戶密碼
router.put(
  "/api/admin/users/:id/password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const userId = parseInt(req.params.id)
    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 8) {
      throw new AppError(400, "密碼至少需要8個字符")
    }

    const hashedPassword = await hashPassword(newPassword)
    await storage.updateUserPassword(userId, hashedPassword)

    res.json({ message: "密碼更新成功" })
  })
)

// 切換用戶狀態
router.put(
  "/api/admin/users/:id/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const userId = parseInt(req.params.id)
    const { isActive } = req.body

    const updatedUser = await storage.updateUser(userId, { isActive: isActive as boolean })

    res.json({
      id: updatedUser.id,
      isActive: updatedUser.isActive,
    })
  })
)

// 切換用戶狀態 (toggle-status 端點)
router.put(
  "/api/admin/users/:id/toggle-status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const userId = parseInt(req.params.id)
    const user = await storage.toggleUserStatus(userId)

    res.json({
      message: `用戶狀態已${user.isActive ? "啟用" : "停用"}`,
      user: {
        id: user.id,
        username: user.username,
        isActive: user.isActive,
      },
    })
  })
)

// 刪除用戶
router.delete(
  "/api/admin/users/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const userId = parseInt(req.params.id)

    if (userId === currentUser.id) {
      throw new AppError(400, "不能刪除自己的帳戶")
    }

    await storage.deleteUser(userId)

    res.json({ message: "用戶刪除成功" })
  })
)

// 系統狀態監控
router.get(
  "/api/admin/system-status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    try {
      const stats = await storage.getSystemStats()

      const healthCheck = {
        database: true,
        server: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
      }

      res.json({
        health: healthCheck,
        statistics: stats,
      })
    } catch (error: unknown) {
      if (error instanceof AppError) throw error
      res.status(500).json({
        message: "獲取系統狀態失敗",
        health: {
          database: false,
          server: true,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
        },
      })
    }
  })
)

// 資料備份
router.post(
  "/api/admin/backup",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const backupData = await storage.createBackup()

    res.json({
      message: "備份建立成功",
      timestamp,
      recordCount: backupData.recordCount,
      fileSize: backupData.fileSize,
    })
  })
)

// 清理系統快取
router.post(
  "/api/admin/clear-cache",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const cacheCleared = await storage.clearSystemCache()

    res.json({
      message: "快取清理完成",
      clearedItems: cacheCleared,
    })
  })
)

// 資料驗證
router.post(
  "/api/admin/validate-data",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const validation = await storage.validateDataIntegrity()

    res.json({
      message: "資料驗證完成",
      results: validation,
    })
  })
)

// LINE 配置管理
router.get(
  "/api/line-config",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const config = await storage.getLineConfig()
    res.json(config || null)
  })
)

router.post(
  "/api/line-config",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const configData = req.body

    if (!configData.callbackUrl || configData.callbackUrl.trim() === "") {
      const protocol = req.protocol
      const host = req.get("host")
      configData.callbackUrl = `${protocol}://${host}/api/line/callback`
    }

    const config = await storage.createLineConfig(configData)
    res.status(201).json(config)
  })
)

router.put(
  "/api/line-config/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const configData = req.body

    if (!configData.callbackUrl || configData.callbackUrl.trim() === "") {
      const protocol = req.protocol
      const host = req.get("host")
      configData.callbackUrl = `${protocol}://${host}/api/line/callback`
    }

    const configId = parseInt(req.params.id)
    const config = await storage.updateLineConfig(configId, configData)
    res.json(config)
  })
)

router.get(
  "/api/line-config/generate-callback",
  requireAuth,
  asyncHandler(async (req, res) => {
    const protocol = req.protocol
    const host = req.get("host")
    const callbackUrl = `${protocol}://${host}/api/line/callback`
    res.json({ callbackUrl })
  })
)

router.post(
  "/api/line-config/test",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = req.user!
    if (currentUser.role !== "admin") {
      throw new AppError(403, "需要管理員權限")
    }

    const testResult = await storage.testLineConnection(req.body)
    res.json(testResult)
  })
)

// LINE 登入回調處理
router.get(
  "/api/line/callback",
  asyncHandler(async (req, res) => {
    try {
      const lineConfig = await storage.getLineConfig()
      if (!lineConfig || !lineConfig.isEnabled) {
        return res.redirect("/auth?error=line_not_enabled")
      }

      const { code, error } = req.query

      if (error) {
        return res.redirect("/auth?error=line_auth_failed")
      }

      if (!code) {
        return res.redirect("/auth?error=missing_code")
      }

      const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: lineConfig.callbackUrl || "",
          client_id: lineConfig.channelId || "",
          client_secret: lineConfig.channelSecret || "",
        }),
      })

      const tokenData = await tokenResponse.json()

      if (!tokenResponse.ok) {
        return res.redirect("/auth?error=token_exchange_failed")
      }

      const profileResponse = await fetch("https://api.line.me/v2/profile", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      })

      const profileData = await profileResponse.json()

      if (!profileResponse.ok) {
        return res.redirect("/auth?error=profile_fetch_failed")
      }

      let user = await storage.getUserByLineUserId(profileData.userId)

      if (!user) {
        user = await storage.createUser({
          username: `line_${profileData.userId}`,
          email: profileData.email || null,
          fullName: profileData.displayName,
          role: "user",
          password: await hashPassword(Math.random().toString(36)),
          lineUserId: profileData.userId,
          lineDisplayName: profileData.displayName,
          linePictureUrl: profileData.pictureUrl,
          authProvider: "line",
        })
      } else {
        await storage.updateUser(user.id, {
          lineDisplayName: profileData.displayName,
          linePictureUrl: profileData.pictureUrl,
          lastLogin: new Date(),
        })
      }

      req.session.userId = user.id
      req.session.isAuthenticated = true

      res.redirect("/?line_login_success=true")
    } catch (error: unknown) {
      if (error instanceof AppError) throw error
      res.redirect("/auth?error=callback_failed")
    }
  })
)

// 檔案附件路由
router.post(
  "/api/file-attachments/upload",
  paymentFileUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, "No file uploaded")
    }

    const { entityType, entityId, description } = req.body

    if (!entityType || !entityId) {
      throw new AppError(400, "Missing entityType or entityId")
    }

    const fileType = req.file.mimetype.startsWith("image/") ? "image" : "document"
    const filePath = req.file.path.replace(process.cwd(), "")
    const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8")

    const fileData = {
      fileName: req.file.filename,
      originalName: originalName,
      filePath: filePath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      fileType: fileType,
      entityType: entityType,
      entityId: parseInt(entityId),
      description: description || null,
      uploadedBy: "system",
    }

    const attachment = await storage.createFileAttachment(fileData)
    res.status(201).json(attachment)
  })
)

router.get(
  "/api/file-attachments/:entityType/:entityId",
  asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.params
    const parsedEntityId = parseInt(entityId)

    if (isNaN(parsedEntityId)) {
      throw new AppError(400, "Invalid entity ID")
    }

    const attachments = await storage.getFileAttachments(entityType, parsedEntityId)
    res.json(attachments)
  })
)

router.delete(
  "/api/file-attachments/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const attachment = await storage.getFileAttachment(id)

    if (!attachment) {
      throw new AppError(404, "File attachment not found")
    }

    const fullPath = path.join(process.cwd(), attachment.filePath)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }

    await storage.deleteFileAttachment(id)
    res.json({ message: "File attachment deleted successfully" })
  })
)

router.get(
  "/api/file-attachments/download/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const attachment = await storage.getFileAttachment(id)

    if (!attachment) {
      throw new AppError(404, "File attachment not found")
    }

    const fullPath = path.join(process.cwd(), attachment.filePath)
    if (!fs.existsSync(fullPath)) {
      throw new AppError(404, "File not found on disk")
    }

    const encodedFilename = encodeURIComponent(attachment.originalName || attachment.fileName)
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodedFilename}`)
    res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream")
    res.sendFile(path.resolve(fullPath))
  })
)

// 付款檔案上傳
router.post(
  "/api/payment/:paymentId/files",
  paymentFileUpload.array("files", 5),
  asyncHandler(async (req, res) => {
    const paymentId = parseInt(req.params.paymentId)
    const files = req.files as Express.Multer.File[]

    if (!files || files.length === 0) {
      throw new AppError(400, "No files uploaded")
    }

    const attachments = []
    for (const file of files) {
      const fileData = {
        fileName: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileType: file.mimetype.startsWith("image/") ? "image" : "document",
        entityType: "loan_payment",
        entityId: paymentId,
        uploadedBy: "system",
        description: req.body.notes || null,
      }

      const attachment = await storage.createFileAttachment(fileData)
      attachments.push(attachment)
    }

    res.status(201).json(attachments)
  })
)

router.get(
  "/api/payment/:paymentId/files",
  asyncHandler(async (req, res) => {
    const paymentId = parseInt(req.params.paymentId)
    const files = await storage.getFileAttachments("loan_payment", paymentId)
    res.json(files)
  })
)

router.delete(
  "/api/files/:fileId",
  asyncHandler(async (req, res) => {
    const fileId = parseInt(req.params.fileId)
    const file = await storage.getFileAttachment(fileId)

    if (!file) {
      throw new AppError(404, "File not found")
    }

    if (fs.existsSync(file.filePath)) {
      fs.unlinkSync(file.filePath)
    }

    await storage.deleteFileAttachment(fileId)
    res.json({ message: "File deleted successfully" })
  })
)

router.put(
  "/api/files/:fileId",
  asyncHandler(async (req, res) => {
    const fileId = parseInt(req.params.fileId)
    const { description } = req.body

    const updatedFile = await storage.updateFileAttachment(fileId, { description })
    res.json(updatedFile)
  })
)

export default router
