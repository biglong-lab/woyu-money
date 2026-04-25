import { Router, Request, Response, NextFunction } from "express"
import { requireAuth } from "../auth"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { localDateTPE } from "@shared/date-utils"
import { getAuditUserInfo } from "@shared/user-display"
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage"
import { recognizeDocument } from "../document-ai"
import { documentUpload, inboxDir } from "./upload-config"
import * as docInboxStorage from "../storage/document-inbox"
import multer from "multer"
import fs from "fs"
import path from "path"

const router = Router()

/** multer 錯誤處理中間件 */
function handleMulterError(err: Error, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: "檔案大小超過限制（最大 20MB）",
      LIMIT_FILE_COUNT: "上傳檔案數量超過限制（最多 10 個）",
      LIMIT_FIELD_KEY: "欄位名稱過長",
      LIMIT_FIELD_VALUE: "欄位值過長",
      LIMIT_FIELD_COUNT: "表單欄位過多",
      LIMIT_UNEXPECTED_FILE: "未預期的檔案欄位",
      MISSING_FIELD_NAME: "缺少欄位名稱",
      LIMIT_PART_COUNT: "表單部分過多",
    }
    const message = messages[err.code] || `上傳錯誤: ${err.message}`
    return res.status(400).json({ success: false, message })
  }
  if (err && err.message === "不支援的檔案格式") {
    return res.status(400).json({
      success: false,
      message: "不支援的檔案格式，請上傳 JPEG、PNG、GIF、WebP、HEIC 或 PDF",
    })
  }
  next(err)
}

// --- 輔助函式 ---

/** 格式化日期為 yyyy/MM/dd HH:mm */
function formatDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** 取得使用者顯示名稱（優先 LINE 顯示名稱 → fullName → username） */
async function resolveDisplayName(userId: number | undefined | null): Promise<string> {
  if (!userId) return "未知用戶"
  const user = await docInboxStorage.getUserDisplayName(userId)
  if (!user) return "未知用戶"
  return getAuditUserInfo(user)
}

/** 組合單據追蹤備註 */
function buildTrackingNotes(
  doc: {
    createdAt: Date | null
    uploadedByUsername: string | null
    editedAt: Date | null
    editedByUsername: string | null
    notes: string | null
  },
  archivedByUsername: string,
  notes?: string | null
): string {
  const uploadTime = doc.createdAt ? formatDate(new Date(doc.createdAt)) : "未知時間"
  const editInfo =
    doc.editedAt && doc.editedByUsername
      ? `\n編輯帳號：${doc.editedByUsername}（${formatDate(new Date(doc.editedAt))}）`
      : ""
  const archiveTime = formatDate(new Date())
  return `---單據追蹤---\n上傳時間：${uploadTime}\n上傳帳號：${doc.uploadedByUsername || "未知用戶"}${editInfo}\n歸檔帳號：${archivedByUsername}（${archiveTime}）\n---原始備註---\n${notes || doc.notes || "無"}`
}

// --- 路由 ---

// 提供 Object Storage 檔案存取端點
router.get(
  "/objects/*",
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService()
      await objectStorageService.downloadObject(req.path, res)
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        throw new AppError(404, "File not found")
      }
      throw error
    }
  })
)

// 上傳並辨識單據（支援多檔上傳，最多 10 個）
router.post(
  "/api/document-inbox/upload",
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    // 先驗證上傳目錄可寫入
    if (!fs.existsSync(inboxDir)) {
      try {
        fs.mkdirSync(inboxDir, { recursive: true })
      } catch (dirErr) {
        console.error("[upload] 無法建立上傳目錄:", inboxDir, dirErr)
        return res.status(500).json({
          success: false,
          message: "伺服器上傳目錄不可用，請聯繫管理員",
        })
      }
    }
    next()
  },
  documentUpload.array("file", 10),
  handleMulterError,
  asyncHandler(async (req, res) => {
    const files = req.files as Express.Multer.File[]

    if (!files || files.length === 0) {
      throw new AppError(400, "請選擇要上傳的檔案")
    }

    const userId = req.session.userId || req.user?.id
    const documentType = (req.body.documentType as "bill" | "payment" | "invoice") || "bill"
    const uploadNotes = req.body.notes || null

    // 用統一 helper：優先 LINE 顯示名稱 → fullName → username
    let uploadedByUsername = "未知用戶"
    if (req.user) {
      uploadedByUsername = getAuditUserInfo(req.user)
    } else if (userId) {
      uploadedByUsername = await resolveDisplayName(userId)
    }

    const results = []
    const errors: string[] = []
    const objectStorageService = new ObjectStorageService()

    for (const file of files) {
      try {
        if (!fs.existsSync(file.path)) {
          console.error("[upload] multer 暫存檔案不存在:", file.path)
          errors.push(`${file.originalname}: 暫存檔案寫入失敗`)
          continue
        }

        const imageBuffer = fs.readFileSync(file.path)
        const mimeType = file.mimetype || "image/jpeg"

        let imagePath: string
        try {
          imagePath = await objectStorageService.uploadBuffer(
            imageBuffer,
            file.originalname,
            mimeType
          )
        } catch {
          // 如果 objectStorage 失敗，退回使用 multer 暫存路徑
          imagePath = `/uploads/inbox/${file.filename}`
        }

        // 清理 multer 暫存檔（已搬到 objectStorage）
        if (imagePath.startsWith("/objects/")) {
          try {
            fs.unlinkSync(file.path)
          } catch (unlinkError: unknown) {
            console.error("[upload] 無法刪除暫存檔案:", unlinkError)
          }
        }

        const newDoc = await docInboxStorage.createDocumentInboxItem({
          userId,
          documentType,
          status: "processing",
          imagePath,
          originalFilename: file.originalname,
          notes: uploadNotes,
          uploadedByUsername,
        })

        results.push(newDoc)

        const imageBase64 = imageBuffer.toString("base64")

        // 背景 AI 辨識（不阻塞回應）
        void (async () => {
          try {
            const result = await recognizeDocument(imageBase64, mimeType, documentType)

            if (result.success) {
              await docInboxStorage.updateDocumentAiResult(newDoc.id, {
                success: true,
                confidence: result.confidence,
                extractedData: result.extractedData,
                rawResponse: result.rawResponse,
              })
            } else {
              await docInboxStorage.updateDocumentAiResult(newDoc.id, {
                success: false,
              })
            }
          } catch (aiError: unknown) {
            console.error("[upload] AI 辨識錯誤:", aiError)
            try {
              const errorNotes =
                (uploadNotes ? uploadNotes + "\n" : "") +
                `AI辨識錯誤: ${aiError instanceof Error ? aiError.message : "未知錯誤"}`

              await docInboxStorage.updateDocumentAiResult(newDoc.id, {
                success: false,
                notes: errorNotes,
              })
            } catch (fallbackError: unknown) {
              console.error("[upload] 更新文件狀態失敗:", fallbackError)
            }
          }
        })()
      } catch (fileError: unknown) {
        console.error("[upload] 處理檔案失敗:", file.originalname, fileError)
        errors.push(
          `${file.originalname}: ${fileError instanceof Error ? fileError.message : "處理失敗"}`
        )
      }
    }

    if (results.length === 0) {
      throw new AppError(500, `所有檔案上傳失敗: ${errors.join("; ")}`)
    }

    res.status(201).json({
      message:
        errors.length > 0
          ? `已上傳 ${results.length} 個檔案（${errors.length} 個失敗），正在辨識中...`
          : `已上傳 ${results.length} 個檔案，正在辨識中...`,
      documents: results,
      errors: errors.length > 0 ? errors : undefined,
    })
  })
)

// 取得待整理項目列表
router.get(
  "/api/document-inbox",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { status, documentType } = req.query
    const docs = await docInboxStorage.getDocumentInboxItems({
      status: status as string | undefined,
      documentType: documentType as string | undefined,
    })
    res.json(docs)
  })
)

// 取得待整理項目統計
router.get(
  "/api/document-inbox/stats",
  requireAuth,
  asyncHandler(async (req, res) => {
    const summary = await docInboxStorage.getDocumentInboxStats()
    res.json(summary)
  })
)

// 取得單一待整理項目
router.get(
  "/api/document-inbox/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      throw new AppError(400, "無效的 ID 參數")
    }

    const doc = await docInboxStorage.getDocumentInboxItem(id)
    if (!doc) {
      throw new AppError(404, "找不到該項目")
    }

    res.json(doc)
  })
)

// 更新待整理項目
router.put(
  "/api/document-inbox/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      throw new AppError(400, "無效的 ID 參數")
    }

    // 白名單：只允許更新特定欄位
    const {
      documentType,
      status,
      notes,
      userConfirmed,
      confirmedVendor,
      confirmedAmount,
      confirmedDate,
      confirmedDescription,
      confirmedCategory,
      tags,
      recognizedVendor,
      recognizedAmount,
      recognizedDate,
      recognizedDescription,
      recognizedCategory,
      recognizedInvoiceNumber,
    } = req.body

    const updates = {
      ...(documentType !== undefined && { documentType }),
      ...(status !== undefined && { status }),
      ...(notes !== undefined && { notes }),
      ...(userConfirmed !== undefined && { userConfirmed }),
      ...(confirmedVendor !== undefined && { confirmedVendor }),
      ...(confirmedAmount !== undefined && { confirmedAmount }),
      ...(confirmedDate !== undefined && { confirmedDate }),
      ...(confirmedDescription !== undefined && { confirmedDescription }),
      ...(confirmedCategory !== undefined && { confirmedCategory }),
      ...(tags !== undefined && { tags }),
      ...(recognizedVendor !== undefined && { recognizedVendor }),
      ...(recognizedAmount !== undefined && { recognizedAmount }),
      ...(recognizedDate !== undefined && { recognizedDate }),
      ...(recognizedDescription !== undefined && { recognizedDescription }),
      ...(recognizedCategory !== undefined && { recognizedCategory }),
      ...(recognizedInvoiceNumber !== undefined && { recognizedInvoiceNumber }),
    }

    const updated = await docInboxStorage.updateDocumentInboxItem(id, updates)
    res.json(updated)
  })
)

// 重新辨識單據
router.post(
  "/api/document-inbox/:id/re-recognize",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      throw new AppError(400, "無效的 ID 參數")
    }

    const doc = await docInboxStorage.getDocumentInboxItem(id)
    if (!doc) {
      throw new AppError(404, "找不到該項目")
    }

    await docInboxStorage.setDocumentProcessing(id)

    let imageBuffer: Buffer
    let mimeType: string

    try {
      const objectStorageService = new ObjectStorageService()
      if (doc.imagePath.startsWith("/objects/")) {
        imageBuffer = await objectStorageService.getFileBuffer(doc.imagePath)
      } else {
        const imgPath = path.join(process.cwd(), doc.imagePath.replace(/^\//, ""))
        if (!fs.existsSync(imgPath)) {
          throw new Error("File not found")
        }
        imageBuffer = fs.readFileSync(imgPath)
      }
      const ext = path.extname(doc.imagePath).toLowerCase()
      mimeType = ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : "image/jpeg"
    } catch {
      await docInboxStorage.setDocumentFailed(id)
      throw new AppError(404, "找不到圖片檔案")
    }

    const imageBase64 = imageBuffer.toString("base64")
    const result = await recognizeDocument(
      imageBase64,
      mimeType,
      doc.documentType as "bill" | "payment" | "invoice"
    )

    if (result.success) {
      await docInboxStorage.updateDocumentAiResult(id, {
        success: true,
        confidence: result.confidence,
        extractedData: result.extractedData,
        rawResponse: result.rawResponse,
      })

      const updatedDoc = await docInboxStorage.getDocumentInboxItem(id)
      res.json({ message: "重新辨識完成", document: updatedDoc })
    } else {
      await docInboxStorage.setDocumentFailed(id)
      throw new AppError(400, result.error || "辨識失敗")
    }
  })
)

// 帳單歸檔為付款項目
router.post(
  "/api/document-inbox/:id/archive-to-payment-item",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      throw new AppError(400, "無效的 ID 參數")
    }

    const doc = await docInboxStorage.getDocumentInboxItem(id)
    if (!doc) {
      throw new AppError(404, "找不到該項目")
    }

    const userId = req.session.userId
    const { projectId, categoryId, itemName, totalAmount, dueDate, notes } = req.body

    const archivedByUsername = await resolveDisplayName(userId)
    const trackingNotes = buildTrackingNotes(doc, archivedByUsername, notes)

    const docDate = dueDate || doc.confirmedDate || doc.recognizedDate
    const startDateValue = docDate ? docDate : localDateTPE()

    const newItem = await docInboxStorage.archiveToPaymentItem(
      id,
      {
        projectId: projectId || null,
        categoryId: categoryId || null,
        itemName: itemName || doc.confirmedDescription || doc.recognizedDescription || "待確認項目",
        totalAmount: totalAmount || doc.confirmedAmount || doc.recognizedAmount || "0",
        startDate: startDateValue,
        endDate: dueDate || doc.confirmedDate || doc.recognizedDate || null,
        notes: trackingNotes,
        source: "ai_scan",
        sourceDocumentId: doc.id,
        documentUploadedAt: doc.createdAt,
        documentUploadedByUserId: doc.userId,
        documentUploadedByUsername: doc.uploadedByUsername,
        archivedByUserId: userId,
        archivedByUsername,
      },
      {
        archivedToType: "payment_item",
        archivedToId: 0, // 由 storage 層用實際 id 替代
        archivedByUserId: userId,
        archivedByUsername,
      }
    )

    res.json({ message: "已成功轉為付款項目", paymentItem: newItem })
  })
)

// 付款憑證歸檔為付款記錄
router.post(
  "/api/document-inbox/:id/archive-to-payment-record",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      throw new AppError(400, "無效的 ID 參數")
    }

    const doc = await docInboxStorage.getDocumentInboxItem(id)
    if (!doc) {
      throw new AppError(404, "找不到該項目")
    }

    const userId = req.session.userId
    const { paymentItemId, amount, paymentDate, paymentMethod, notes } = req.body

    if (!paymentItemId) {
      throw new AppError(400, "請選擇要關聯的付款項目")
    }

    const archivedByUsername = await resolveDisplayName(userId)
    const trackingNotes = buildTrackingNotes(doc, archivedByUsername, notes)

    const newRecord = await docInboxStorage.archiveToPaymentRecord(
      id,
      {
        itemId: paymentItemId,
        amountPaid: amount || doc.confirmedAmount || doc.recognizedAmount || "0",
        paymentDate: paymentDate || doc.confirmedDate || doc.recognizedDate || localDateTPE(),
        paymentMethod: paymentMethod || "cash",
        receiptImageUrl: doc.imagePath,
        notes: trackingNotes,
      },
      {
        archivedToType: "payment_record",
        archivedToId: 0, // 由 storage 層用實際 id 替代
        archivedByUserId: userId,
        archivedByUsername,
      }
    )

    res.json({ message: "已成功轉為付款記錄", paymentRecord: newRecord })
  })
)

// 發票歸檔為發票記錄
router.post(
  "/api/document-inbox/:id/archive-to-invoice",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      throw new AppError(400, "無效的 ID 參數")
    }

    const doc = await docInboxStorage.getDocumentInboxItem(id)
    if (!doc) {
      throw new AppError(404, "找不到該項目")
    }

    const userId = req.session.userId
    const {
      invoiceNumber,
      invoiceDate,
      vendorName,
      vendorTaxId,
      totalAmount,
      taxAmount,
      subtotal,
      category,
      description,
      invoiceType,
      paymentItemId,
      paymentRecordId,
      notes,
    } = req.body

    const archivedByUsername = await resolveDisplayName(userId)
    const trackingNotes = buildTrackingNotes(doc, archivedByUsername, notes)

    /** AI 萃取資料的型別定義 */
    interface AiExtractedData {
      invoiceNumber?: string
      taxId?: string
      taxAmount?: number | string
      subtotal?: number | string
    }
    const extractedData = (doc.aiExtractedData as AiExtractedData | null) || ({} as AiExtractedData)

    const invDate = invoiceDate || doc.confirmedDate || doc.recognizedDate || localDateTPE()
    const parsedDate = new Date(invDate)

    const newInvoice = await docInboxStorage.archiveToInvoiceRecord(
      id,
      {
        userId,
        invoiceNumber: invoiceNumber || doc.recognizedInvoiceNumber || extractedData.invoiceNumber,
        invoiceDate: invDate,
        vendorName: vendorName || doc.confirmedVendor || doc.recognizedVendor,
        vendorTaxId: vendorTaxId || extractedData.taxId,
        totalAmount: totalAmount || doc.confirmedAmount || doc.recognizedAmount || "0",
        taxAmount: taxAmount || extractedData.taxAmount?.toString(),
        subtotal: subtotal || extractedData.subtotal?.toString(),
        category: category || doc.confirmedCategory || doc.recognizedCategory,
        description: description || doc.confirmedDescription || doc.recognizedDescription,
        invoiceType: invoiceType || "expense",
        paymentItemId: paymentItemId || null,
        paymentRecordId: paymentRecordId || null,
        documentInboxId: id,
        imagePath: doc.imagePath,
        taxYear: parsedDate.getFullYear(),
        taxMonth: parsedDate.getMonth() + 1,
        notes: trackingNotes,
      },
      {
        archivedToType: "invoice_record",
        archivedToId: 0, // 由 storage 層用實際 id 替代
        archivedByUserId: userId,
        archivedByUsername,
      }
    )

    res.json({ message: "已成功轉為發票記錄", invoiceRecord: newInvoice })
  })
)

// 更新待整理項目備註
router.patch(
  "/api/document-inbox/:id/notes",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      throw new AppError(400, "無效的 ID 參數")
    }

    const { notes } = req.body
    const userId = req.session.userId

    const editedByUsername = await resolveDisplayName(userId)

    const updated = await docInboxStorage.updateDocumentNotes(id, notes, userId, editedByUsername)

    if (!updated) {
      throw new AppError(404, "找不到該項目")
    }

    res.json(updated)
  })
)

// 刪除待整理項目
router.delete(
  "/api/document-inbox/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      throw new AppError(400, "無效的 ID 參數")
    }

    const doc = await docInboxStorage.getDocumentInboxItem(id)
    if (!doc) {
      throw new AppError(404, "找不到該項目")
    }

    if (!doc.imagePath.startsWith("/objects/")) {
      const imgPath = path.join(process.cwd(), doc.imagePath.replace(/^\//, ""))
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath)
      }
    }

    await docInboxStorage.deleteDocumentInboxItem(id)

    res.json({ message: "已刪除" })
  })
)

export default router
