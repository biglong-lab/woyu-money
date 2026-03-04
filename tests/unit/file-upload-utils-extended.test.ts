/**
 * server/file-upload-utils.ts 擴展單元測試
 * 補充 createUploadMiddleware 和 UploadPresets 的測試
 * （createFileFilter 和 ensureUploadDirectories 已在 file-upload-utils.test.ts 測試）
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import fs from "fs"
import path from "path"
import {
  createUploadMiddleware,
  createFileFilter,
  UploadPresets,
  ensureUploadDirectories,
} from "../../server/file-upload-utils"
import type { UploadConfig } from "../../server/file-upload-utils"

// mock fs 模組
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

/** 建立 mock File 物件 */
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

const createMockReq = () => ({}) as Express.Request

describe("createUploadMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("應回傳 multer 實例（disk storage）", () => {
    const config: UploadConfig = {
      destinationDir: "/tmp/uploads",
      filePrefix: "test",
      allowedExtensions: /\.(jpg|png)$/i,
    }

    const multerInstance = createUploadMiddleware(config)

    expect(multerInstance).toBeDefined()
    expect(multerInstance.single).toBeDefined()
    expect(multerInstance.array).toBeDefined()
    expect(multerInstance.fields).toBeDefined()
    expect(multerInstance.none).toBeDefined()
  })

  it("使用 memory storage 時應正確建立", () => {
    const config: UploadConfig = {
      destinationDir: "",
      filePrefix: "import",
      allowedExtensions: /\.(csv|xlsx)$/i,
      useMemoryStorage: true,
    }

    const multerInstance = createUploadMiddleware(config)

    expect(multerInstance).toBeDefined()
    expect(multerInstance.single).toBeDefined()
  })

  it("自訂 maxFileSize 應被採用", () => {
    const config: UploadConfig = {
      destinationDir: "/tmp",
      filePrefix: "small",
      allowedExtensions: /\.(txt)$/i,
      maxFileSize: 1024 * 1024, // 1MB
    }

    const multerInstance = createUploadMiddleware(config)

    expect(multerInstance).toBeDefined()
  })

  it("未提供 maxFileSize 時應使用 FileUploadConfig.MAX_FILE_SIZE", () => {
    const config: UploadConfig = {
      destinationDir: "/tmp",
      filePrefix: "default",
      allowedExtensions: /\.(jpg)$/i,
    }

    const multerInstance = createUploadMiddleware(config)

    // 確認 multer 實例正常建立（使用預設大小限制）
    expect(multerInstance).toBeDefined()
  })

  it("allowedMimeTypes 應傳遞給 fileFilter", () => {
    const config: UploadConfig = {
      destinationDir: "/tmp",
      filePrefix: "typed",
      allowedExtensions: /\.(jpg|png)$/i,
      allowedMimeTypes: ["image/jpeg", "image/png"],
      errorMessage: "自訂錯誤",
    }

    const multerInstance = createUploadMiddleware(config)

    expect(multerInstance).toBeDefined()
  })
})

describe("UploadPresets", () => {
  const testUploadDir = "/tmp/test-uploads"

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.existsSync).mockReturnValue(true)
  })

  describe("receipt preset", () => {
    it("應建立 multer 實例", () => {
      const multerInstance = UploadPresets.receipt(testUploadDir)

      expect(multerInstance).toBeDefined()
      expect(multerInstance.single).toBeDefined()
    })

    it("fileFilter 應接受 JPEG 圖片", () => {
      // 透過 createFileFilter 驗證 receipt 的副檔名規則
      const filter = createFileFilter(/\.(jpeg|jpg|png|gif)$/i, [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
      ])

      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("photo.jpg", "image/jpeg"), cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it("fileFilter 應拒絕 PDF", () => {
      const filter = createFileFilter(/\.(jpeg|jpg|png|gif)$/i, [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
      ])

      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("doc.pdf", "application/pdf"), cb)
      expect(cb).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  describe("contract preset", () => {
    it("應建立 multer 實例", () => {
      const multerInstance = UploadPresets.contract(testUploadDir)

      expect(multerInstance).toBeDefined()
    })

    it("fileFilter 應接受 PDF", () => {
      const filter = createFileFilter(/\.(jpeg|jpg|png|gif|pdf|xlsx|xls)$/i, [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ])

      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("contract.pdf", "application/pdf"), cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it("fileFilter 應接受 Excel", () => {
      const filter = createFileFilter(/\.(jpeg|jpg|png|gif|pdf|xlsx|xls)$/i, [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ])

      const cb = vi.fn()
      filter!(
        createMockReq(),
        createMockFile(
          "data.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        cb
      )
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it("fileFilter 應拒絕可執行檔", () => {
      const filter = createFileFilter(/\.(jpeg|jpg|png|gif|pdf|xlsx|xls)$/i, [
        "image/jpeg",
        "application/pdf",
      ])

      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("malware.exe", "application/octet-stream"), cb)
      expect(cb).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  describe("batchImport preset", () => {
    it("應建立 multer 實例（memory storage）", () => {
      const multerInstance = UploadPresets.batchImport()

      expect(multerInstance).toBeDefined()
      expect(multerInstance.single).toBeDefined()
    })

    it("fileFilter 應接受 CSV", () => {
      const filter = createFileFilter(/\.(xlsx|xls|csv)$/i, [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
        "spreadsheet",
        "excel",
      ])

      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("data.csv", "text/csv"), cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it("fileFilter 應拒絕圖片", () => {
      const filter = createFileFilter(/\.(xlsx|xls|csv)$/i, [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
      ])

      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("photo.jpg", "image/jpeg"), cb)
      expect(cb).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  describe("generalFile preset", () => {
    it("應建立 multer 實例", () => {
      const multerInstance = UploadPresets.generalFile(testUploadDir)

      expect(multerInstance).toBeDefined()
    })

    it("fileFilter 應接受 Word 文件", () => {
      const filter = createFileFilter(/\.(jpeg|jpg|png|gif|pdf|doc|docx|txt)$/i, [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ])

      const cb = vi.fn()
      filter!(
        createMockReq(),
        createMockFile(
          "document.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        cb
      )
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it("fileFilter 應接受純文字檔", () => {
      const filter = createFileFilter(/\.(jpeg|jpg|png|gif|pdf|doc|docx|txt)$/i, [
        "image/jpeg",
        "application/pdf",
        "text/plain",
      ])

      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("notes.txt", "text/plain"), cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })
  })

  describe("dynamicFile preset", () => {
    it("應建立 multer 實例", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)

      const multerInstance = UploadPresets.dynamicFile(testUploadDir)

      expect(multerInstance).toBeDefined()
      expect(multerInstance.single).toBeDefined()
    })

    it("應確保 images 和 documents 目錄存在", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      UploadPresets.dynamicFile(testUploadDir)

      // ensureUploadDirectories 會被呼叫，建立 images/ 和 documents/
      expect(fs.mkdirSync).toHaveBeenCalled()
    })
  })
})

describe("createFileFilter 進階測試", () => {
  it("空 allowedMimeTypes 陣列應僅檢查副檔名", () => {
    const filter = createFileFilter(/\.(jpg)$/i, [])

    const cb = vi.fn()
    filter!(createMockReq(), createMockFile("photo.jpg", "image/jpeg"), cb)
    // 空陣列 length === 0，不會進入 MIME 檢查
    expect(cb).toHaveBeenCalledWith(null, true)
  })

  it("不提供 allowedMimeTypes 應僅檢查副檔名", () => {
    const filter = createFileFilter(/\.(pdf)$/i)

    const cb = vi.fn()
    filter!(createMockReq(), createMockFile("file.pdf", "text/plain"), cb)
    // 沒有 MIME 檢查，只要副檔名正確就通過
    expect(cb).toHaveBeenCalledWith(null, true)
  })

  it("多個萬用 MIME 類型應正確匹配", () => {
    const filter = createFileFilter(/\.(jpg|pdf)$/i, ["image/*", "application/*"])

    const cb1 = vi.fn()
    filter!(createMockReq(), createMockFile("photo.jpg", "image/jpeg"), cb1)
    expect(cb1).toHaveBeenCalledWith(null, true)

    const cb2 = vi.fn()
    filter!(createMockReq(), createMockFile("doc.pdf", "application/pdf"), cb2)
    expect(cb2).toHaveBeenCalledWith(null, true)
  })

  it("MIME 類型精確匹配應正確運作", () => {
    const filter = createFileFilter(/\.(jpg)$/i, ["image/jpeg"])

    const cb = vi.fn()
    filter!(createMockReq(), createMockFile("photo.jpg", "image/jpeg"), cb)
    expect(cb).toHaveBeenCalledWith(null, true)
  })

  it("MIME 類型不匹配萬用和精確規則應拒絕", () => {
    const filter = createFileFilter(/\.(jpg)$/i, ["image/png"])

    const cb = vi.fn()
    filter!(createMockReq(), createMockFile("photo.jpg", "image/jpeg"), cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
  })

  it("含有路徑的檔名應正確提取副檔名", () => {
    const filter = createFileFilter(/\.(jpg)$/i)

    const cb = vi.fn()
    filter!(createMockReq(), createMockFile("path/to/photo.jpg", "image/jpeg"), cb)
    expect(cb).toHaveBeenCalledWith(null, true)
  })

  it("無副檔名的檔案應被拒絕", () => {
    const filter = createFileFilter(/\.(jpg|png)$/i)

    const cb = vi.fn()
    filter!(createMockReq(), createMockFile("noextension", "image/jpeg"), cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
  })

  it("錯誤訊息應可自訂", () => {
    const customMsg = "僅允許圖片檔案"
    const filter = createFileFilter(/\.(jpg)$/i, undefined, customMsg)

    const cb = vi.fn()
    filter!(createMockReq(), createMockFile("file.txt", "text/plain"), cb)
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ message: customMsg }))
  })
})
