import { Router } from "express"
import { requireAuth } from "../auth"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage"
import { recognizeDocument } from "../document-ai"
import { documentUpload, inboxDir } from "./upload-config"
import * as docInboxStorage from "../storage/document-inbox"
import fs from "fs"
import path from "path"

const router = Router()

// --- 輔助函式 ---

/** 格式化日期為 yyyy/MM/dd HH:mm */
function formatDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** 取得使用者顯示名稱（優先 fullName，其次 username） */
async function resolveDisplayName(userId: number | undefined | null): Promise<string> {
  if (!userId) return "未知用戶"
  const user = await docInboxStorage.getUserDisplayName(userId)
  if (!user) return "未知用戶"
  return user.fullName || user.username || "未知用戶"
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

// 上傳並辨識單據
router.post(
  "/api/document-inbox/upload",
  requireAuth,
  documentUpload.array("file", 10),
  asyncHandler(async (req, res) => {
    const files = req.files as Express.Multer.File[]

    if (!files || files.length === 0) {
      throw new AppError(400, "請選擇要上傳的檔案")
    }

    const userId = req.session.userId || req.user?.id
    const documentType = (req.body.documentType as "bill" | "payment" | "invoice") || "bill"
    const uploadNotes = req.body.notes || null

    let uploadedByUsername = "未知用戶"
    if (req.user && req.user.username) {
      uploadedByUsername = req.user.fullName || req.user.username || "未知用戶"
    } else if (userId) {
      uploadedByUsername = await resolveDisplayName(userId)
    }

    const results = []
    const objectStorageService = new ObjectStorageService()

    for (const file of files) {
      if (!fs.existsSync(file.path)) {
        console.error("ERROR: File not saved by multer:", file.path)
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
        imagePath = `/uploads/inbox/${file.filename}`
      }

      if (imagePath.startsWith("/objects/")) {
        try {
          fs.unlinkSync(file.path)
        } catch (unlinkError: unknown) {
          console.error("無法刪除暫存檔案:", unlinkError)
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

      // 背景 AI 辨識
      ;(async () => {
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
          console.error("AI recognition error:", aiError)
          try {
            const errorNotes =
              (uploadNotes ? uploadNotes + "\n" : "") +
              `AI辨識錯誤: ${aiError instanceof Error ? aiError.message : "未知錯誤"}`

            await docInboxStorage.updateDocumentAiResult(newDoc.id, {
              success: false,
              notes: errorNotes,
            })
          } catch (fallbackError: unknown) {
            console.error("更新文件狀態失敗:", fallbackError)
          }
        }
      })()
    }

    res.status(201).json({
      message: `已上傳 ${files.length} 個檔案，正在辨識中...`,
      documents: results,
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
    const startDateValue = docDate ? docDate : new Date().toISOString().split("T")[0]

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
        paymentDate:
          paymentDate ||
          doc.confirmedDate ||
          doc.recognizedDate ||
          new Date().toISOString().split("T")[0],
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

    const invDate =
      invoiceDate ||
      doc.confirmedDate ||
      doc.recognizedDate ||
      new Date().toISOString().split("T")[0]
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
