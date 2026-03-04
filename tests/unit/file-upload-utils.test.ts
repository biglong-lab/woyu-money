/**
 * server/file-upload-utils.ts 單元測試
 * 測試檔案上傳設定中的 createFileFilter 和 ensureUploadDirectories
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import fs from "fs"
import { createFileFilter, ensureUploadDirectories } from "../../server/file-upload-utils"

// mock fs 模組
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

describe("ensureUploadDirectories", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("目錄不存在時應建立目錄", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    ensureUploadDirectories(["/tmp/uploads", "/tmp/uploads/images"])

    expect(fs.mkdirSync).toHaveBeenCalledTimes(2)
    expect(fs.mkdirSync).toHaveBeenCalledWith("/tmp/uploads", { recursive: true })
    expect(fs.mkdirSync).toHaveBeenCalledWith("/tmp/uploads/images", { recursive: true })
  })

  it("目錄已存在時不應重複建立", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)

    ensureUploadDirectories(["/tmp/uploads"])

    expect(fs.mkdirSync).not.toHaveBeenCalled()
  })

  it("空陣列不應有任何操作", () => {
    ensureUploadDirectories([])

    expect(fs.existsSync).not.toHaveBeenCalled()
    expect(fs.mkdirSync).not.toHaveBeenCalled()
  })

  it("混合存在/不存在目錄應正確處理", () => {
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true) // 第一個目錄存在
      .mockReturnValueOnce(false) // 第二個不存在

    ensureUploadDirectories(["/existing", "/new-dir"])

    expect(fs.mkdirSync).toHaveBeenCalledTimes(1)
    expect(fs.mkdirSync).toHaveBeenCalledWith("/new-dir", { recursive: true })
  })
})

describe("createFileFilter", () => {
  // 建立 mock multer 回呼
  const createMockFile = (originalname: string, mimetype: string): Express.Multer.File => ({
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
  })

  const createMockReq = () => ({}) as Express.Request

  describe("僅副檔名驗證", () => {
    const filter = createFileFilter(/\.(jpg|png|gif)$/i)

    it("允許的副檔名應通過", () => {
      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("photo.jpg", "image/jpeg"), cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it("不允許的副檔名應拒絕", () => {
      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("doc.exe", "application/octet-stream"), cb)
      expect(cb).toHaveBeenCalledWith(expect.any(Error))
    })

    it("大寫副檔名也應通過（不分大小寫）", () => {
      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("image.PNG", "image/png"), cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })
  })

  describe("副檔名 + MIME 類型驗證", () => {
    const filter = createFileFilter(/\.(jpg|png)$/i, ["image/jpeg", "image/png"])

    it("副檔名和 MIME 都正確應通過", () => {
      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("photo.jpg", "image/jpeg"), cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it("副檔名正確但 MIME 不符應拒絕", () => {
      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("photo.jpg", "text/plain"), cb)
      expect(cb).toHaveBeenCalledWith(expect.any(Error))
    })

    it("副檔名不正確應拒絕（即使 MIME 正確）", () => {
      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("malicious.exe", "image/jpeg"), cb)
      expect(cb).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  describe("萬用 MIME 類型 (type/*)", () => {
    const filter = createFileFilter(/\.(jpg|png|gif|webp)$/i, ["image/*"])

    it("image/jpeg 應符合 image/* 萬用類型", () => {
      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("photo.jpg", "image/jpeg"), cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it("image/webp 應符合 image/* 萬用類型", () => {
      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("photo.webp", "image/webp"), cb)
      expect(cb).toHaveBeenCalledWith(null, true)
    })

    it("application/pdf 不應符合 image/* 萬用類型", () => {
      const cb = vi.fn()
      // 副檔名故意設為 .jpg 以確保是 MIME 驗證擋住
      filter!(createMockReq(), createMockFile("fake.jpg", "application/pdf"), cb)
      expect(cb).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  describe("自訂錯誤訊息", () => {
    it("應使用自訂錯誤訊息", () => {
      const filter = createFileFilter(/\.(csv)$/i, undefined, "只允許 CSV 檔案")
      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("data.xlsx", "application/vnd.ms-excel"), cb)
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ message: "只允許 CSV 檔案" }))
    })

    it("未提供自訂訊息時應使用預設訊息", () => {
      const filter = createFileFilter(/\.(csv)$/i)
      const cb = vi.fn()
      filter!(createMockReq(), createMockFile("data.xlsx", "application/vnd.ms-excel"), cb)
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ message: "Invalid file type" }))
    })
  })
})
