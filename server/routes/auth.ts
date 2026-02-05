import { Router } from "express"
import { storage } from "../storage"
import { requireAuth } from "../auth"
import { hashPassword, comparePasswords } from "./helpers"
import { receiptUpload } from "./upload-config"

const router = Router()

// 一般檔案上傳端點（收據）
router.post("/api/upload", receiptUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" })
    }
    const fileUrl = `/uploads/receipts/${req.file.filename}`
    res.json({ url: fileUrl })
  } catch (error: any) {
    console.error("Error uploading file:", error)
    res.status(500).json({ message: "Failed to upload file" })
  }
})

// 更新個人資料
router.put("/api/user/profile", requireAuth, async (req, res) => {
  try {
    const { fullName, email } = req.body
    const userId = req.user!.id

    const updatedUser = await storage.updateUser(userId, {
      fullName,
      email,
    })

    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      role: updatedUser.role,
      lineUserId: updatedUser.lineUserId,
      lineDisplayName: updatedUser.lineDisplayName,
      authProvider: updatedUser.authProvider,
    })
  } catch (error) {
    console.error("Profile update error:", error)
    res.status(500).json({ message: "個人資料更新失敗" })
  }
})

// 更新密碼
router.put("/api/user/password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = req.user!

    if (user.password) {
      const isCurrentPasswordValid = await comparePasswords(currentPassword, user.password)
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "當前密碼不正確" })
      }
    }

    const hashedNewPassword = await hashPassword(newPassword)

    await storage.updateUser(user.id, {
      password: hashedNewPassword,
    })

    res.json({ message: "密碼更新成功" })
  } catch (error) {
    console.error("Password update error:", error)
    res.status(500).json({ message: "密碼更新失敗" })
  }
})

export default router
