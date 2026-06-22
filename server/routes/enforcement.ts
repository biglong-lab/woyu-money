/**
 * 強制執行管理 API
 * - 公文 /api/enforcement/cases
 * - 圈存 /api/enforcement/seizures
 * - 分期 /api/enforcement/installments(/:id/payments)
 * - 對帳 /api/enforcement/reconcile
 * - 公文 OCR 掃描（多檔） /api/enforcement/scan
 */
import { Router } from "express"
import fs from "fs"
import path from "path"
import { ZodError } from "zod"
import { asyncHandler, AppError } from "../middleware/error-handler"
import { receiptUpload } from "./upload-config"
import * as store from "../storage/enforcement"
import { recognizeEnforcementDocument } from "../document-ai"
import {
  insertEnforcementCaseSchema,
  insertEnforcementSeizureSchema,
  insertEnforcementInstallmentSchema,
  insertEnforcementInstallmentPaymentSchema,
} from "@shared/schema"

const router = Router()

function parseId(raw: string): number {
  const id = parseInt(raw, 10)
  if (isNaN(id)) throw new AppError(400, "無效的 ID")
  return id
}
function handleZod(e: unknown): never {
  if (e instanceof ZodError)
    throw new AppError(400, "資料驗證失敗：" + e.errors.map((x) => x.message).join("、"))
  throw e
}

// ── 對帳（放最前避免被 :id 吃掉）──
router.get(
  "/api/enforcement/reconcile",
  asyncHandler(async (_req, res) => res.json(await store.getReconcileSummary()))
)

// ── 公文 OCR 掃描（多檔、逐張掃、合併欄位）──
router.post(
  "/api/enforcement/scan",
  receiptUpload.array("files", 20),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? []
    if (files.length === 0) throw new AppError(400, "請上傳至少一個檔案")

    const attachments: Array<{ url: string }> = []
    const perFile: Array<Record<string, unknown>> = []
    const merged: Record<string, unknown> = {}
    let maxAmount = 0

    for (const f of files) {
      const url = `/uploads/receipts/${f.filename}`
      attachments.push({ url })
      try {
        const b64 = fs.readFileSync(path.join(f.destination, f.filename)).toString("base64")
        const r = await recognizeEnforcementDocument(b64, f.mimetype)
        perFile.push({ url, ...r.data, confidence: r.confidence })
        // 合併：每欄取第一個非空；金額取最大（總額通常出現一次）
        for (const k of ["caseNumber", "agency", "contactPhone", "subject", "issuedDate"]) {
          const v = (r.data as Record<string, unknown>)[k]
          if (v && !merged[k]) merged[k] = v
        }
        if (typeof r.data.totalAmount === "number" && r.data.totalAmount > maxAmount) {
          maxAmount = r.data.totalAmount
        }
      } catch (err) {
        perFile.push({ url, error: err instanceof Error ? err.message : "辨識失敗" })
      }
    }
    if (maxAmount > 0) merged.totalAmount = maxAmount

    res.json({ data: merged, attachments, perFile })
  })
)

// ── Cases ──
router.get(
  "/api/enforcement/cases",
  asyncHandler(async (_req, res) => res.json(await store.listCases()))
)
router.get(
  "/api/enforcement/cases/:id",
  asyncHandler(async (req, res) => {
    const r = await store.getCase(parseId(req.params.id))
    if (!r) throw new AppError(404, "找不到該公文")
    res.json(r)
  })
)
router.post(
  "/api/enforcement/cases",
  asyncHandler(async (req, res) => {
    try {
      res.status(201).json(await store.createCase(insertEnforcementCaseSchema.parse(req.body)))
    } catch (e) {
      handleZod(e)
    }
  })
)
router.put(
  "/api/enforcement/cases/:id",
  asyncHandler(async (req, res) => {
    try {
      const r = await store.updateCase(
        parseId(req.params.id),
        insertEnforcementCaseSchema.partial().parse(req.body)
      )
      if (!r) throw new AppError(404, "找不到該公文")
      res.json(r)
    } catch (e) {
      handleZod(e)
    }
  })
)
router.delete(
  "/api/enforcement/cases/:id",
  asyncHandler(async (req, res) => {
    await store.deleteCase(parseId(req.params.id))
    res.json({ success: true })
  })
)

// ── Seizures ──
router.get(
  "/api/enforcement/seizures",
  asyncHandler(async (_req, res) => res.json(await store.listSeizures()))
)
router.post(
  "/api/enforcement/seizures",
  asyncHandler(async (req, res) => {
    try {
      res
        .status(201)
        .json(await store.createSeizure(insertEnforcementSeizureSchema.parse(req.body)))
    } catch (e) {
      handleZod(e)
    }
  })
)
router.put(
  "/api/enforcement/seizures/:id",
  asyncHandler(async (req, res) => {
    try {
      const r = await store.updateSeizure(
        parseId(req.params.id),
        insertEnforcementSeizureSchema.partial().parse(req.body)
      )
      if (!r) throw new AppError(404, "找不到該圈存")
      res.json(r)
    } catch (e) {
      handleZod(e)
    }
  })
)
router.delete(
  "/api/enforcement/seizures/:id",
  asyncHandler(async (req, res) => {
    await store.deleteSeizure(parseId(req.params.id))
    res.json({ success: true })
  })
)

// ── Installments ──
router.get(
  "/api/enforcement/installments",
  asyncHandler(async (_req, res) => res.json(await store.listInstallments()))
)
router.post(
  "/api/enforcement/installments",
  asyncHandler(async (req, res) => {
    try {
      res
        .status(201)
        .json(await store.createInstallment(insertEnforcementInstallmentSchema.parse(req.body)))
    } catch (e) {
      handleZod(e)
    }
  })
)
router.put(
  "/api/enforcement/installments/:id",
  asyncHandler(async (req, res) => {
    try {
      const r = await store.updateInstallment(
        parseId(req.params.id),
        insertEnforcementInstallmentSchema.partial().parse(req.body)
      )
      if (!r) throw new AppError(404, "找不到該分期")
      res.json(r)
    } catch (e) {
      handleZod(e)
    }
  })
)
router.delete(
  "/api/enforcement/installments/:id",
  asyncHandler(async (req, res) => {
    await store.deleteInstallment(parseId(req.params.id))
    res.json({ success: true })
  })
)

// ── Installment payments ──
router.get(
  "/api/enforcement/installments/:id/payments",
  asyncHandler(async (req, res) =>
    res.json(await store.listInstallmentPayments(parseId(req.params.id)))
  )
)
router.post(
  "/api/enforcement/installments/:id/payments",
  asyncHandler(async (req, res) => {
    try {
      const data = insertEnforcementInstallmentPaymentSchema.parse({
        ...req.body,
        installmentId: parseId(req.params.id),
      })
      res.status(201).json(await store.createInstallmentPayment(data))
    } catch (e) {
      handleZod(e)
    }
  })
)
router.delete(
  "/api/enforcement/installment-payments/:id",
  asyncHandler(async (req, res) => {
    await store.deleteInstallmentPayment(parseId(req.params.id))
    res.json({ success: true })
  })
)

export default router
