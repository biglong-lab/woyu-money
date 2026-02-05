import { Router } from "express"
import { db } from "../db"
import { requireAuth } from "../auth"
import { documentInbox, users, paymentItems, paymentRecords, invoiceRecords } from "@shared/schema"
import { eq, desc, and, sql } from "drizzle-orm"
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage"
import { recognizeDocument } from "../document-ai"
import { documentUpload, inboxDir } from "./upload-config"
import fs from "fs"
import path from "path"

const router = Router()

// 提供 Object Storage 檔案存取端點
router.get("/objects/*", requireAuth, async (req, res) => {
  try {
    const objectStorageService = new ObjectStorageService()
    await objectStorageService.downloadObject(req.path, res)
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "File not found" })
    }
    console.error("Error serving object:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
})

// 上傳並辨識單據
router.post("/api/document-inbox/upload", requireAuth, documentUpload.array("file", 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[]

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "請選擇要上傳的檔案" })
    }

    const userId = (req.session as any)?.userId || (req.user as any)?.id
    const documentType = (req.body.documentType as "bill" | "payment" | "invoice") || "bill"
    const uploadNotes = req.body.notes || null

    let uploadedByUsername = "未知用戶"
    if (req.user && (req.user as any).username) {
      const passportUser = req.user as any
      uploadedByUsername = passportUser.fullName || passportUser.username || "未知用戶"
    } else if (userId) {
      const [user] = await db
        .select({ username: users.username, fullName: users.fullName })
        .from(users)
        .where(eq(users.id, userId))
      if (user) {
        uploadedByUsername = user.fullName || user.username || "未知用戶"
      }
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
        imagePath = await objectStorageService.uploadBuffer(imageBuffer, file.originalname, mimeType)
      } catch {
        imagePath = `/uploads/inbox/${file.filename}`
      }

      if (imagePath.startsWith("/objects/")) {
        try {
          fs.unlinkSync(file.path)
        } catch {}
      }

      const [newDoc] = await db
        .insert(documentInbox)
        .values({
          userId,
          documentType,
          status: "processing",
          imagePath,
          originalFilename: file.originalname,
          notes: uploadNotes,
          uploadedByUsername,
        })
        .returning()

      results.push(newDoc)

      const imageBase64 = imageBuffer.toString("base64")

      // 背景 AI 辨識
      ;(async () => {
        try {
          const result = await recognizeDocument(imageBase64, mimeType, documentType)

          if (result.success) {
            const recognizedDate =
              result.extractedData.date && result.extractedData.date.trim() !== ""
                ? result.extractedData.date
                : null

            await db
              .update(documentInbox)
              .set({
                status: "recognized",
                aiRecognized: true,
                aiConfidence: result.confidence.toString(),
                aiExtractedData: result.extractedData,
                aiRawResponse: result.rawResponse,
                recognizedVendor: result.extractedData.vendor || null,
                recognizedAmount: result.extractedData.amount?.toString() || null,
                recognizedDate: recognizedDate,
                recognizedDescription: result.extractedData.description || null,
                recognizedCategory: result.extractedData.category || null,
                recognizedInvoiceNumber: result.extractedData.invoiceNumber || null,
                updatedAt: new Date(),
              })
              .where(eq(documentInbox.id, newDoc.id))
          } else {
            await db
              .update(documentInbox)
              .set({ status: "failed", aiRecognized: false, updatedAt: new Date() })
              .where(eq(documentInbox.id, newDoc.id))
          }
        } catch (aiError: any) {
          console.error("AI recognition error:", aiError)
          try {
            await db
              .update(documentInbox)
              .set({
                status: "failed",
                aiRecognized: false,
                notes:
                  (uploadNotes ? uploadNotes + "\n" : "") +
                  `AI辨識錯誤: ${aiError.message || "未知錯誤"}`,
                updatedAt: new Date(),
              })
              .where(eq(documentInbox.id, newDoc.id))
          } catch {}
        }
      })()
    }

    res.status(201).json({
      message: `已上傳 ${files.length} 個檔案，正在辨識中...`,
      documents: results,
    })
  } catch (error: any) {
    console.error("Error batch uploading:", error)
    res.status(500).json({ message: error.message || "批次上傳失敗" })
  }
})

// 取得待整理項目列表
router.get("/api/document-inbox", async (req, res) => {
  try {
    const { status, documentType } = req.query

    const conditions = []
    if (status && status !== "all") {
      conditions.push(eq(documentInbox.status, status as string))
    } else {
      conditions.push(sql`${documentInbox.status} != 'archived'`)
    }

    if (documentType && documentType !== "all") {
      conditions.push(eq(documentInbox.documentType, documentType as string))
    }

    const docs = await db
      .select()
      .from(documentInbox)
      .where(and(...conditions))
      .orderBy(desc(documentInbox.createdAt))

    res.json(docs)
  } catch (error: any) {
    console.error("Error fetching inbox:", error)
    res.status(500).json({ message: "獲取待整理項目失敗" })
  }
})

// 取得待整理項目統計
router.get("/api/document-inbox/stats", async (req, res) => {
  try {
    const stats = await db
      .select({
        documentType: documentInbox.documentType,
        status: documentInbox.status,
        count: sql<number>`count(*)::int`,
      })
      .from(documentInbox)
      .where(sql`${documentInbox.status} != 'archived'`)
      .groupBy(documentInbox.documentType, documentInbox.status)

    const summary = {
      bill: { pending: 0, processing: 0, recognized: 0, failed: 0, total: 0 },
      payment: { pending: 0, processing: 0, recognized: 0, failed: 0, total: 0 },
      invoice: { pending: 0, processing: 0, recognized: 0, failed: 0, total: 0 },
      totalPending: 0,
    }

    for (const stat of stats) {
      const type = stat.documentType as keyof typeof summary
      if (type in summary && typeof summary[type] === "object") {
        const statusKey = stat.status as keyof typeof summary.bill
        if (statusKey in summary[type]) {
          ;(summary[type] as any)[statusKey] = stat.count
          ;(summary[type] as any).total += stat.count
        }
      }
    }

    summary.totalPending = summary.bill.total + summary.payment.total + summary.invoice.total

    res.json(summary)
  } catch (error: any) {
    console.error("Error fetching inbox stats:", error)
    res.status(500).json({ message: "獲取統計失敗" })
  }
})

// 取得單一待整理項目
router.get("/api/document-inbox/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const [doc] = await db.select().from(documentInbox).where(eq(documentInbox.id, id))

    if (!doc) {
      return res.status(404).json({ message: "找不到該項目" })
    }

    res.json(doc)
  } catch (error: any) {
    console.error("Error fetching document:", error)
    res.status(500).json({ message: "獲取項目失敗" })
  }
})

// 更新待整理項目
router.put("/api/document-inbox/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const updates = req.body

    const [updated] = await db
      .update(documentInbox)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documentInbox.id, id))
      .returning()

    res.json(updated)
  } catch (error: any) {
    console.error("Error updating document:", error)
    res.status(500).json({ message: "更新失敗" })
  }
})

// 重新辨識單據
router.post("/api/document-inbox/:id/re-recognize", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const [doc] = await db.select().from(documentInbox).where(eq(documentInbox.id, id))

    if (!doc) {
      return res.status(404).json({ message: "找不到該項目" })
    }

    await db
      .update(documentInbox)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(documentInbox.id, id))

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
      await db
        .update(documentInbox)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(documentInbox.id, id))
      return res.status(404).json({ message: "找不到圖片檔案" })
    }

    const imageBase64 = imageBuffer.toString("base64")
    const result = await recognizeDocument(imageBase64, mimeType, doc.documentType as any)

    if (result.success) {
      const recognizedDate =
        result.extractedData.date && result.extractedData.date.trim() !== ""
          ? result.extractedData.date
          : null

      const [updated] = await db
        .update(documentInbox)
        .set({
          status: "recognized",
          aiRecognized: true,
          aiConfidence: result.confidence.toString(),
          aiExtractedData: result.extractedData,
          aiRawResponse: result.rawResponse,
          recognizedVendor: result.extractedData.vendor || null,
          recognizedAmount: result.extractedData.amount?.toString() || null,
          recognizedDate: recognizedDate,
          recognizedDescription: result.extractedData.description || null,
          recognizedCategory: result.extractedData.category || null,
          recognizedInvoiceNumber: result.extractedData.invoiceNumber || null,
          updatedAt: new Date(),
        })
        .where(eq(documentInbox.id, id))
        .returning()

      res.json({ message: "重新辨識完成", document: updated })
    } else {
      await db
        .update(documentInbox)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(documentInbox.id, id))

      res.status(400).json({ message: result.error || "辨識失敗" })
    }
  } catch (error: any) {
    console.error("Error re-recognizing:", error)
    res.status(500).json({ message: "重新辨識失敗" })
  }
})

// 帳單歸檔為付款項目
router.post("/api/document-inbox/:id/archive-to-payment-item", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const [doc] = await db.select().from(documentInbox).where(eq(documentInbox.id, id))

    if (!doc) {
      return res.status(404).json({ message: "找不到該項目" })
    }

    const userId = (req.session as any)?.userId
    const { projectId, categoryId, itemName, totalAmount, dueDate, notes } = req.body

    let archivedByUsername = "未知用戶"
    if (userId) {
      const [user] = await db
        .select({ username: users.username, fullName: users.fullName })
        .from(users)
        .where(eq(users.id, userId))
      if (user) {
        archivedByUsername = user.fullName || user.username || "未知用戶"
      }
    }

    const formatDate = (d: Date) =>
      `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`

    const uploadTime = doc.createdAt ? formatDate(new Date(doc.createdAt)) : "未知時間"
    const editInfo =
      doc.editedAt && doc.editedByUsername
        ? `\n編輯帳號：${doc.editedByUsername}（${formatDate(new Date(doc.editedAt))}）`
        : ""
    const archiveTime = formatDate(new Date())

    const trackingNotes = `---單據追蹤---\n上傳時間：${uploadTime}\n上傳帳號：${doc.uploadedByUsername || "未知用戶"}${editInfo}\n歸檔帳號：${archivedByUsername}（${archiveTime}）\n---原始備註---\n${notes || doc.notes || "無"}`

    const docDate = dueDate || doc.confirmedDate || doc.recognizedDate
    const startDateValue = docDate ? docDate : new Date().toISOString().split("T")[0]

    const now = new Date()
    const [newItem] = await db
      .insert(paymentItems)
      .values({
        projectId: projectId || null,
        categoryId: categoryId || null,
        itemName:
          itemName || doc.confirmedDescription || doc.recognizedDescription || "待確認項目",
        totalAmount: totalAmount || doc.confirmedAmount || doc.recognizedAmount || "0",
        paidAmount: "0",
        status: "unpaid",
        startDate: startDateValue,
        endDate: dueDate || doc.confirmedDate || doc.recognizedDate || null,
        notes: trackingNotes,
        createdAt: now,
        updatedAt: now,
        source: "ai_scan",
        sourceDocumentId: doc.id,
        documentUploadedAt: doc.createdAt,
        documentUploadedByUserId: (doc as any).uploadedByUserId,
        documentUploadedByUsername: doc.uploadedByUsername,
        archivedByUserId: userId,
        archivedByUsername,
        archivedAt: now,
      } as any)
      .returning()

    await db
      .update(documentInbox)
      .set({
        status: "archived",
        archivedToType: "payment_item",
        archivedToId: newItem.id,
        archivedAt: new Date(),
        archivedByUserId: userId,
        archivedByUsername,
        updatedAt: new Date(),
      })
      .where(eq(documentInbox.id, id))

    res.json({ message: "已成功轉為付款項目", paymentItem: newItem })
  } catch (error: any) {
    console.error("Error archiving to payment item:", error)
    res.status(500).json({ message: "歸檔失敗" })
  }
})

// 付款憑證歸檔為付款記錄
router.post("/api/document-inbox/:id/archive-to-payment-record", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const [doc] = await db.select().from(documentInbox).where(eq(documentInbox.id, id))

    if (!doc) {
      return res.status(404).json({ message: "找不到該項目" })
    }

    const userId = (req.session as any)?.userId
    const { paymentItemId, amount, paymentDate, paymentMethod, notes } = req.body

    if (!paymentItemId) {
      return res.status(400).json({ message: "請選擇要關聯的付款項目" })
    }

    let archivedByUsername = "未知用戶"
    if (userId) {
      const [user] = await db
        .select({ username: users.username, fullName: users.fullName })
        .from(users)
        .where(eq(users.id, userId))
      if (user) {
        archivedByUsername = user.fullName || user.username || "未知用戶"
      }
    }

    const formatDate = (d: Date) =>
      `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`

    const uploadTime = doc.createdAt ? formatDate(new Date(doc.createdAt)) : "未知時間"
    const editInfo =
      doc.editedAt && doc.editedByUsername
        ? `\n編輯帳號：${doc.editedByUsername}（${formatDate(new Date(doc.editedAt))}）`
        : ""
    const archiveTime = formatDate(new Date())

    const trackingNotes = `---單據追蹤---\n上傳時間：${uploadTime}\n上傳帳號：${doc.uploadedByUsername || "未知用戶"}${editInfo}\n歸檔帳號：${archivedByUsername}（${archiveTime}）\n---原始備註---\n${notes || doc.notes || "無"}`

    const [newRecord] = await db
      .insert(paymentRecords)
      .values({
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
      })
      .returning()

    // 更新付款項目已付金額
    const [item] = await db.select().from(paymentItems).where(eq(paymentItems.id, paymentItemId))
    if (item) {
      const newPaidAmount =
        parseFloat(item.paidAmount || "0") + parseFloat(newRecord.amountPaid || "0")
      const newStatus =
        newPaidAmount >= parseFloat(item.totalAmount || "0") ? "paid" : "partial"

      await db
        .update(paymentItems)
        .set({ paidAmount: newPaidAmount.toFixed(2), status: newStatus, updatedAt: new Date() })
        .where(eq(paymentItems.id, paymentItemId))
    }

    await db
      .update(documentInbox)
      .set({
        status: "archived",
        archivedToType: "payment_record",
        archivedToId: newRecord.id,
        archivedAt: new Date(),
        archivedByUserId: userId,
        archivedByUsername,
        updatedAt: new Date(),
      })
      .where(eq(documentInbox.id, id))

    res.json({ message: "已成功轉為付款記錄", paymentRecord: newRecord })
  } catch (error: any) {
    console.error("Error archiving to payment record:", error)
    res.status(500).json({ message: "歸檔失敗" })
  }
})

// 發票歸檔為發票記錄
router.post("/api/document-inbox/:id/archive-to-invoice", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const [doc] = await db.select().from(documentInbox).where(eq(documentInbox.id, id))

    if (!doc) {
      return res.status(404).json({ message: "找不到該項目" })
    }

    const userId = (req.session as any)?.userId
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

    let archivedByUsername = "未知用戶"
    if (userId) {
      const [user] = await db
        .select({ username: users.username, fullName: users.fullName })
        .from(users)
        .where(eq(users.id, userId))
      if (user) {
        archivedByUsername = user.fullName || user.username || "未知用戶"
      }
    }

    const formatDate = (d: Date) =>
      `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`

    const uploadTime = doc.createdAt ? formatDate(new Date(doc.createdAt)) : "未知時間"
    const editInfo =
      doc.editedAt && doc.editedByUsername
        ? `\n編輯帳號：${doc.editedByUsername}（${formatDate(new Date(doc.editedAt))}）`
        : ""
    const archiveTime = formatDate(new Date())

    const trackingNotes = `---單據追蹤---\n上傳時間：${uploadTime}\n上傳帳號：${doc.uploadedByUsername || "未知用戶"}${editInfo}\n歸檔帳號：${archivedByUsername}（${archiveTime}）\n---原始備註---\n${notes || doc.notes || "無"}`

    const extractedData = (doc.aiExtractedData as any) || {}

    const invDate =
      invoiceDate ||
      doc.confirmedDate ||
      doc.recognizedDate ||
      new Date().toISOString().split("T")[0]
    const parsedDate = new Date(invDate)

    const [newInvoice] = await db
      .insert(invoiceRecords)
      .values({
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
      })
      .returning()

    await db
      .update(documentInbox)
      .set({
        status: "archived",
        archivedToType: "invoice_record",
        archivedToId: newInvoice.id,
        archivedAt: new Date(),
        archivedByUserId: userId,
        archivedByUsername,
        updatedAt: new Date(),
      })
      .where(eq(documentInbox.id, id))

    res.json({ message: "已成功轉為發票記錄", invoiceRecord: newInvoice })
  } catch (error: any) {
    console.error("Error archiving to invoice:", error)
    res.status(500).json({ message: "歸檔失敗" })
  }
})

// 更新待整理項目備註
router.patch("/api/document-inbox/:id/notes", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { notes } = req.body
    const userId = (req.session as any)?.userId

    let editedByUsername = "未知用戶"
    if (userId) {
      const [user] = await db
        .select({ username: users.username, fullName: users.fullName })
        .from(users)
        .where(eq(users.id, userId))
      if (user) {
        editedByUsername = user.fullName || user.username || "未知用戶"
      }
    }

    const [updated] = await db
      .update(documentInbox)
      .set({
        notes: notes || null,
        editedByUserId: userId,
        editedByUsername,
        editedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documentInbox.id, id))
      .returning()

    if (!updated) {
      return res.status(404).json({ message: "找不到該項目" })
    }

    res.json(updated)
  } catch (error: any) {
    console.error("Error updating document notes:", error)
    res.status(500).json({ message: "更新備註失敗" })
  }
})

// 刪除待整理項目
router.delete("/api/document-inbox/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const [doc] = await db.select().from(documentInbox).where(eq(documentInbox.id, id))

    if (!doc) {
      return res.status(404).json({ message: "找不到該項目" })
    }

    if (doc.imagePath.startsWith("/objects/")) {
      // Object Storage 檔案不需要刪除
    } else {
      const imgPath = path.join(process.cwd(), doc.imagePath.replace(/^\//, ""))
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath)
      }
    }

    await db.delete(documentInbox).where(eq(documentInbox.id, id))

    res.json({ message: "已刪除" })
  } catch (error: any) {
    console.error("Error deleting document:", error)
    res.status(500).json({ message: "刪除失敗" })
  }
})

export default router
