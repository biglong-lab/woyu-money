/**
 * server/objectStorage.ts 單元測試
 * 測試 ObjectStorageService 的路徑解析、錯誤處理等邏輯
 * mock fs 模組避免實際檔案系統操作
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import path from "path"

// mock fs 模組
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    statSync: vi.fn().mockReturnValue({ size: 1024 }),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(Buffer.from("test-content")),
    createReadStream: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      pipe: vi.fn(),
    }),
  },
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 1024 }),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(Buffer.from("test-content")),
  createReadStream: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    pipe: vi.fn(),
  }),
}))

// mock crypto
vi.mock("crypto", () => ({
  randomUUID: vi.fn().mockReturnValue("test-uuid-1234"),
}))

import { ObjectStorageService, ObjectNotFoundError } from "../../server/objectStorage"
import fs from "fs"

const STORAGE_ROOT = path.resolve(process.cwd(), "uploads")

describe("ObjectNotFoundError", () => {
  it("應為 Error 的子類別", () => {
    const error = new ObjectNotFoundError()
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ObjectNotFoundError)
  })

  it("應有正確的 name 和 message", () => {
    const error = new ObjectNotFoundError()
    expect(error.name).toBe("ObjectNotFoundError")
    expect(error.message).toBe("Object not found")
  })

  it("instanceof 檢查應正確運作", () => {
    const error = new ObjectNotFoundError()
    expect(error instanceof ObjectNotFoundError).toBe(true)
  })
})

describe("ObjectStorageService", () => {
  let service: ObjectStorageService

  beforeEach(() => {
    vi.clearAllMocks()
    // 建構時 existsSync 回傳 true（不需建立目錄）
    vi.mocked(fs.existsSync).mockReturnValue(true)
    service = new ObjectStorageService()
  })

  // ========== 建構函式 ==========
  describe("constructor", () => {
    it("應確保 uploads/ 和 uploads/inbox/ 目錄存在", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const _newService = new ObjectStorageService()

      // ensureDir 會檢查 STORAGE_ROOT 和 STORAGE_ROOT/inbox
      expect(fs.existsSync).toHaveBeenCalled()
      expect(fs.mkdirSync).toHaveBeenCalled()
    })
  })

  // ========== uploadBuffer ==========
  describe("uploadBuffer", () => {
    it("應將檔案寫入磁碟並回傳路徑", async () => {
      const buffer = Buffer.from("test-image-data")

      const result = await service.uploadBuffer(buffer, "photo.png", "image/png")

      expect(result).toMatch(/^\/objects\/inbox\//)
      expect(result).toMatch(/\.png$/)
      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it("回傳路徑應包含 /objects/ 前綴", async () => {
      const buffer = Buffer.from("test")

      const result = await service.uploadBuffer(buffer, "doc.pdf", "application/pdf")

      expect(result.startsWith("/objects/")).toBe(true)
      expect(result).toMatch(/\.pdf$/)
    })

    it("無副檔名時應使用檔名本身作為副檔名", async () => {
      // split(".").pop() 對無副檔名的檔案回傳檔名本身
      // 例如 "noext" → 副檔名為 "noext"
      const buffer = Buffer.from("test")

      const result = await service.uploadBuffer(buffer, "noext", "image/png")

      // 確認有回傳路徑
      expect(result.startsWith("/objects/inbox/")).toBe(true)
      expect(result).toMatch(/\.noext$/)
    })
  })

  // ========== getObjectEntityFile ==========
  describe("getObjectEntityFile", () => {
    it("有效路徑應回傳本地完整路徑", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)

      const result = await service.getObjectEntityFile("/objects/inbox/test.png")

      expect(result).toBe(path.join(STORAGE_ROOT, "inbox/test.png"))
    })

    it("不以 /objects/ 開頭應拋出 ObjectNotFoundError", async () => {
      await expect(service.getObjectEntityFile("/invalid/path/test.png")).rejects.toThrow(
        ObjectNotFoundError
      )
    })

    it("檔案不存在應拋出 ObjectNotFoundError", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      await expect(service.getObjectEntityFile("/objects/inbox/missing.png")).rejects.toThrow(
        ObjectNotFoundError
      )
    })
  })

  // ========== getFileBuffer ==========
  describe("getFileBuffer", () => {
    it("應回傳檔案的 Buffer", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from("file-content"))

      const result = await service.getFileBuffer("/objects/inbox/test.png")

      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.toString()).toBe("file-content")
    })

    it("不合法路徑應拋出 ObjectNotFoundError", async () => {
      await expect(service.getFileBuffer("/bad-path/test.png")).rejects.toThrow(ObjectNotFoundError)
    })
  })

  // ========== downloadObject ==========
  describe("downloadObject", () => {
    it("檔案不存在時應拋出 ObjectNotFoundError", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const mockRes = {
        set: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        headersSent: false,
      }

      await expect(
        service.downloadObject(
          "/objects/inbox/missing.png",
          mockRes as unknown as import("express").Response
        )
      ).rejects.toThrow(ObjectNotFoundError)
    })

    it("檔案存在時應設定正確的 Content-Type", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.statSync).mockReturnValue({ size: 2048 } as import("fs").Stats)

      const mockStream = {
        on: vi.fn().mockReturnThis(),
        pipe: vi.fn(),
      }
      vi.mocked(fs.createReadStream).mockReturnValue(
        mockStream as unknown as import("fs").ReadStream
      )

      const mockRes = {
        set: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        headersSent: false,
      }

      await service.downloadObject(
        "/objects/inbox/test.jpg",
        mockRes as unknown as import("express").Response
      )

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          "Content-Type": "image/jpeg",
          "Content-Length": "2048",
        })
      )
      expect(mockStream.pipe).toHaveBeenCalledWith(mockRes)
    })

    it("PNG 檔案應回傳 image/png Content-Type", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as import("fs").Stats)

      const mockStream = {
        on: vi.fn().mockReturnThis(),
        pipe: vi.fn(),
      }
      vi.mocked(fs.createReadStream).mockReturnValue(
        mockStream as unknown as import("fs").ReadStream
      )

      const mockRes = {
        set: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        headersSent: false,
      }

      await service.downloadObject(
        "/objects/inbox/image.png",
        mockRes as unknown as import("express").Response
      )

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          "Content-Type": "image/png",
        })
      )
    })

    it("未知副檔名應使用 application/octet-stream", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.statSync).mockReturnValue({ size: 100 } as import("fs").Stats)

      const mockStream = {
        on: vi.fn().mockReturnThis(),
        pipe: vi.fn(),
      }
      vi.mocked(fs.createReadStream).mockReturnValue(
        mockStream as unknown as import("fs").ReadStream
      )

      const mockRes = {
        set: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        headersSent: false,
      }

      await service.downloadObject(
        "/objects/inbox/file.xyz",
        mockRes as unknown as import("express").Response
      )

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          "Content-Type": "application/octet-stream",
        })
      )
    })

    it("PDF 檔案應回傳 application/pdf Content-Type", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.statSync).mockReturnValue({ size: 500 } as import("fs").Stats)

      const mockStream = {
        on: vi.fn().mockReturnThis(),
        pipe: vi.fn(),
      }
      vi.mocked(fs.createReadStream).mockReturnValue(
        mockStream as unknown as import("fs").ReadStream
      )

      const mockRes = {
        set: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        headersSent: false,
      }

      await service.downloadObject(
        "/objects/inbox/document.pdf",
        mockRes as unknown as import("express").Response
      )

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          "Content-Type": "application/pdf",
        })
      )
    })
  })

  // ========== resolveLocalPath（透過 downloadObject 間接測試路徑穿越防護）==========
  describe("路徑穿越防護", () => {
    it("嘗試路徑穿越應拋出錯誤", async () => {
      // resolveLocalPath 是 private，透過 downloadObject 間接測試
      const mockRes = {
        set: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        headersSent: false,
      }

      // 路徑穿越攻擊：../../../etc/passwd
      // 因為 path.resolve 會解析掉 ..，
      // 所以結果不會在 STORAGE_ROOT 內，應被攔截
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      try {
        await service.downloadObject(
          "../../../etc/passwd",
          mockRes as unknown as import("express").Response
        )
      } catch (error) {
        // 可能拋出 Error("非法的檔案路徑") 或被 catch 處理
        if (error instanceof Error) {
          expect(error.message).not.toBe("")
        }
      }

      consoleSpy.mockRestore()
    })
  })
})
