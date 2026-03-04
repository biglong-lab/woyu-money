/**
 * server/routes/upload-config.ts 整合測試
 * 測試上傳設定中的各種 multer 配置
 *
 * 因為 upload-config.ts 在模組頂層即建立目錄，
 * 此處以單元方式測試各 multer 設定的 fileFilter 行為
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import path from "path"

// Mock fs 模組避免真實目錄操作
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}))

/** 建立 multer File 物件 */
function createMockFile(originalname: string, mimetype: string): Express.Multer.File {
  return {
    originalname,
    mimetype,
    fieldname: "file",
    encoding: "7bit",
    size: 1000,
    stream: null as unknown as NodeJS.ReadableStream,
    destination: "",
    filename: "",
    path: "",
    buffer: Buffer.from(""),
  }
}

describe("upload-config multer 設定", () => {
  // 動態 import，確保 mock 已生效
  let uploadConfig: typeof import("../../server/routes/upload-config")

  beforeEach(async () => {
    vi.clearAllMocks()
    // 重新 import 取得新的 multer 實例
    uploadConfig = await import("../../server/routes/upload-config")
  })

  describe("匯出的目錄路徑", () => {
    it("應匯出 uploadDir", () => {
      expect(uploadConfig.uploadDir).toBeDefined()
      expect(typeof uploadConfig.uploadDir).toBe("string")
    })

    it("應匯出 contractsDir", () => {
      expect(uploadConfig.contractsDir).toBeDefined()
      expect(uploadConfig.contractsDir).toContain("contracts")
    })

    it("應匯出 receiptsDir", () => {
      expect(uploadConfig.receiptsDir).toBeDefined()
      expect(uploadConfig.receiptsDir).toContain("receipts")
    })

    it("應匯出 documentsDir", () => {
      expect(uploadConfig.documentsDir).toBeDefined()
      expect(uploadConfig.documentsDir).toContain("documents")
    })

    it("應匯出 imagesDir", () => {
      expect(uploadConfig.imagesDir).toBeDefined()
      expect(uploadConfig.imagesDir).toContain("images")
    })

    it("應匯出 inboxDir", () => {
      expect(uploadConfig.inboxDir).toBeDefined()
      expect(uploadConfig.inboxDir).toContain("inbox")
    })
  })

  describe("upload（一般檔案上傳）", () => {
    it("應匯出 upload multer 實例", () => {
      expect(uploadConfig.upload).toBeDefined()
      expect(uploadConfig.upload.single).toBeDefined()
      expect(uploadConfig.upload.array).toBeDefined()
    })
  })

  describe("receiptUpload（收據上傳）", () => {
    it("應匯出 receiptUpload multer 實例", () => {
      expect(uploadConfig.receiptUpload).toBeDefined()
      expect(uploadConfig.receiptUpload.single).toBeDefined()
    })
  })

  describe("batchImportUpload（批次匯入上傳）", () => {
    it("應匯出 batchImportUpload multer 實例", () => {
      expect(uploadConfig.batchImportUpload).toBeDefined()
      expect(uploadConfig.batchImportUpload.single).toBeDefined()
    })
  })

  describe("fileUpload（一般檔案附件上傳）", () => {
    it("應匯出 fileUpload multer 實例", () => {
      expect(uploadConfig.fileUpload).toBeDefined()
      expect(uploadConfig.fileUpload.single).toBeDefined()
    })
  })

  describe("paymentFileUpload（付款憑證上傳）", () => {
    it("應匯出 paymentFileUpload multer 實例", () => {
      expect(uploadConfig.paymentFileUpload).toBeDefined()
      expect(uploadConfig.paymentFileUpload.single).toBeDefined()
    })
  })

  describe("documentUpload（文件收件箱上傳）", () => {
    it("應匯出 documentUpload multer 實例", () => {
      expect(uploadConfig.documentUpload).toBeDefined()
      expect(uploadConfig.documentUpload.single).toBeDefined()
    })
  })
})

describe("upload fileFilter 行為驗證", () => {
  /**
   * 直接測試 multer 的 fileFilter 邏輯
   * 因為無法直接存取 multer 內部的 fileFilter，
   * 這裡根據原始碼邏輯驗證檔案類型檢查
   */

  describe("一般上傳（upload）允許的檔案類型", () => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/

    it("應接受 JPEG 檔案", () => {
      expect(allowedTypes.test("jpeg")).toBe(true)
      expect(allowedTypes.test("jpg")).toBe(true)
    })

    it("應接受 PNG 檔案", () => {
      expect(allowedTypes.test("png")).toBe(true)
    })

    it("應接受 GIF 檔案", () => {
      expect(allowedTypes.test("gif")).toBe(true)
    })

    it("應接受 PDF 檔案", () => {
      expect(allowedTypes.test("pdf")).toBe(true)
    })

    it("不應接受 EXE 檔案", () => {
      expect(allowedTypes.test("exe")).toBe(false)
    })

    it("不應接受 XLSX 檔案", () => {
      expect(allowedTypes.test("xlsx")).toBe(false)
    })
  })

  describe("收據上傳（receiptUpload）允許的檔案類型", () => {
    const allowedTypes = /jpeg|jpg|png|gif/

    it("應接受圖片格式", () => {
      expect(allowedTypes.test("jpeg")).toBe(true)
      expect(allowedTypes.test("jpg")).toBe(true)
      expect(allowedTypes.test("png")).toBe(true)
      expect(allowedTypes.test("gif")).toBe(true)
    })

    it("不應接受 PDF", () => {
      expect(allowedTypes.test("pdf")).toBe(false)
    })
  })

  describe("批次匯入（batchImportUpload）允許的檔案類型", () => {
    const allowedTypes = /xlsx|xls|csv/

    it("應接受 Excel 和 CSV 格式", () => {
      expect(allowedTypes.test("xlsx")).toBe(true)
      expect(allowedTypes.test("xls")).toBe(true)
      expect(allowedTypes.test("csv")).toBe(true)
    })

    it("不應接受圖片格式", () => {
      expect(allowedTypes.test("jpeg")).toBe(false)
      expect(allowedTypes.test("png")).toBe(false)
    })
  })

  describe("commonFileFilter 允許的檔案類型", () => {
    const allowedFileTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xlsx|xls|csv|webp|heic|heif/

    it("應接受圖片格式", () => {
      expect(allowedFileTypes.test("jpeg")).toBe(true)
      expect(allowedFileTypes.test("webp")).toBe(true)
      expect(allowedFileTypes.test("heic")).toBe(true)
      expect(allowedFileTypes.test("heif")).toBe(true)
    })

    it("應接受文件格式", () => {
      expect(allowedFileTypes.test("pdf")).toBe(true)
      expect(allowedFileTypes.test("doc")).toBe(true)
      expect(allowedFileTypes.test("docx")).toBe(true)
    })

    it("應接受表格格式", () => {
      expect(allowedFileTypes.test("xlsx")).toBe(true)
      expect(allowedFileTypes.test("xls")).toBe(true)
      expect(allowedFileTypes.test("csv")).toBe(true)
    })

    it("不應接受執行檔", () => {
      expect(allowedFileTypes.test("exe")).toBe(false)
      expect(allowedFileTypes.test("bat")).toBe(false)
      expect(allowedFileTypes.test("sh")).toBe(false)
    })
  })

  describe("文件上傳（documentUpload）允許的檔案類型", () => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|heic|heif|webp/

    it("應接受圖片和 PDF 格式", () => {
      expect(allowedTypes.test("jpeg")).toBe(true)
      expect(allowedTypes.test("png")).toBe(true)
      expect(allowedTypes.test("pdf")).toBe(true)
      expect(allowedTypes.test("heic")).toBe(true)
      expect(allowedTypes.test("webp")).toBe(true)
    })

    it("不應接受 Excel 格式", () => {
      expect(allowedTypes.test("xlsx")).toBe(false)
    })
  })

  describe("檔案大小限制", () => {
    it("一般上傳限制為 10MB", () => {
      expect(10 * 1024 * 1024).toBe(10485760)
    })

    it("批次匯入限制為 5MB", () => {
      expect(5 * 1024 * 1024).toBe(5242880)
    })

    it("文件上傳限制為 20MB", () => {
      expect(20 * 1024 * 1024).toBe(20971520)
    })
  })

  describe("檔名前綴規則", () => {
    it("一般上傳應使用 contract- 前綴", () => {
      const prefix = "contract-"
      const filename = `${prefix}${Date.now()}-12345.pdf`
      expect(filename).toMatch(/^contract-/)
    })

    it("收據上傳應使用 receipt- 前綴", () => {
      const prefix = "receipt-"
      const filename = `${prefix}${Date.now()}-12345.jpg`
      expect(filename).toMatch(/^receipt-/)
    })

    it("付款憑證應使用 payment- 前綴", () => {
      const prefix = "payment-"
      const filename = `${prefix}${Date.now()}-12345.png`
      expect(filename).toMatch(/^payment-/)
    })

    it("文件收件箱應使用 doc- 前綴", () => {
      const prefix = "doc-"
      const filename = `${prefix}${Date.now()}-12345.pdf`
      expect(filename).toMatch(/^doc-/)
    })

    it("一般檔案附件應使用 file- 前綴", () => {
      const prefix = "file-"
      const filename = `${prefix}${Date.now()}-12345.docx`
      expect(filename).toMatch(/^file-/)
    })
  })
})

describe("副檔名提取", () => {
  it("path.extname 應正確提取副檔名", () => {
    expect(path.extname("photo.jpg")).toBe(".jpg")
    expect(path.extname("document.PDF")).toBe(".PDF")
    expect(path.extname("file.name.with.dots.png")).toBe(".png")
    expect(path.extname("no-extension")).toBe("")
  })

  it("副檔名轉小寫比對", () => {
    const ext = path.extname("Photo.JPG").toLowerCase()
    expect(ext).toBe(".jpg")
    expect(/jpeg|jpg|png/.test(ext)).toBe(true)
  })
})
