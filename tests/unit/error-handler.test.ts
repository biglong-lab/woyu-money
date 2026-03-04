/**
 * server/middleware/error-handler.ts 單元測試
 * 測試 AppError 類別、錯誤快捷方法、asyncHandler 和全域錯誤處理
 */
import { describe, it, expect, vi } from "vitest"
import {
  AppError,
  errors,
  asyncHandler,
  globalErrorHandler,
} from "../../server/middleware/error-handler"

// 建立 mock Express request/response/next
function createMockReq() {
  return {} as import("express").Request
}

function createMockRes() {
  const res = {
    _status: 200,
    _json: null as unknown,
    status(code: number) {
      res._status = code
      return res
    },
    json(data: unknown) {
      res._json = data
      return res
    },
  }
  return res as unknown as import("express").Response & {
    _status: number
    _json: unknown
  }
}

const createNext = () => vi.fn() as unknown as import("express").NextFunction

// ========== AppError ==========
describe("AppError", () => {
  it("應正確建立含狀態碼和訊息的錯誤", () => {
    const error = new AppError(404, "找不到資源")
    expect(error.statusCode).toBe(404)
    expect(error.message).toBe("找不到資源")
    expect(error.isOperational).toBe(true)
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AppError)
  })

  it("預設 isOperational 為 true", () => {
    const error = new AppError(400, "錯誤請求")
    expect(error.isOperational).toBe(true)
  })

  it("可設定 isOperational 為 false（非預期錯誤）", () => {
    const error = new AppError(500, "系統錯誤", false)
    expect(error.isOperational).toBe(false)
  })

  it("應保持正確的原型鏈", () => {
    const error = new AppError(400, "test")
    expect(error instanceof AppError).toBe(true)
    expect(error instanceof Error).toBe(true)
  })
})

// ========== errors 快捷方法 ==========
describe("errors 快捷方法", () => {
  it("notFound 應建立 404 錯誤", () => {
    const error = errors.notFound("使用者")
    expect(error.statusCode).toBe(404)
    expect(error.message).toBe("使用者不存在")
  })

  it("badRequest 應建立 400 錯誤", () => {
    const error = errors.badRequest("缺少必要欄位")
    expect(error.statusCode).toBe(400)
    expect(error.message).toBe("缺少必要欄位")
  })

  it("unauthorized 應建立 401 錯誤", () => {
    const error = errors.unauthorized()
    expect(error.statusCode).toBe(401)
    expect(error.message).toBe("需要登入才能訪問此資源")
  })

  it("forbidden 應建立 403 錯誤", () => {
    const error = errors.forbidden()
    expect(error.statusCode).toBe(403)
    expect(error.message).toBe("沒有權限執行此操作")
  })

  it("conflict 應建立 409 錯誤", () => {
    const error = errors.conflict("資源已存在")
    expect(error.statusCode).toBe(409)
    expect(error.message).toBe("資源已存在")
  })

  it("internal 應建立 500 錯誤，且 isOperational 為 false", () => {
    const error = errors.internal()
    expect(error.statusCode).toBe(500)
    expect(error.message).toBe("伺服器內部錯誤")
    expect(error.isOperational).toBe(false)
  })

  it("internal 可接受自訂訊息", () => {
    const error = errors.internal("資料庫連線失敗")
    expect(error.message).toBe("資料庫連線失敗")
  })
})

// ========== asyncHandler ==========
describe("asyncHandler", () => {
  it("成功的非同步處理器應正常執行", async () => {
    const handler = asyncHandler(async (_req, res) => {
      res.json({ success: true })
    })

    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    await handler(req, res as unknown as import("express").Response, next)

    expect(res._json).toEqual({ success: true })
    expect(next).not.toHaveBeenCalled()
  })

  it("失敗的非同步處理器應將錯誤傳遞給 next", async () => {
    const testError = new Error("測試錯誤")
    const handler = asyncHandler(async () => {
      throw testError
    })

    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    await handler(req, res as unknown as import("express").Response, next)

    expect(next).toHaveBeenCalledWith(testError)
  })

  it("應正確包裝 AppError", async () => {
    const appError = new AppError(404, "找不到")
    const handler = asyncHandler(async () => {
      throw appError
    })

    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    await handler(req, res as unknown as import("express").Response, next)

    expect(next).toHaveBeenCalledWith(appError)
  })
})

// ========== globalErrorHandler ==========
describe("globalErrorHandler", () => {
  it("AppError 應回傳對應的狀態碼和訊息", () => {
    const error = new AppError(404, "資源不存在")
    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    globalErrorHandler(error, req, res as unknown as import("express").Response, next)

    expect(res._status).toBe(404)
    expect(res._json).toEqual({
      success: false,
      message: "資源不存在",
    })
  })

  it("一般 Error 應回傳 500", () => {
    const error = new Error("unexpected")
    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    // 抑制 console.error 輸出
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    globalErrorHandler(error, req, res as unknown as import("express").Response, next)

    expect(res._status).toBe(500)
    expect(res._json).toEqual({
      success: false,
      message: "伺服器內部錯誤",
    })

    consoleSpy.mockRestore()
  })

  it("AppError 400 應正確回傳", () => {
    const error = errors.badRequest("無效參數")
    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    globalErrorHandler(error, req, res as unknown as import("express").Response, next)

    expect(res._status).toBe(400)
    expect(res._json).toEqual({
      success: false,
      message: "無效參數",
    })
  })

  it("AppError 401 應正確回傳", () => {
    const error = errors.unauthorized()
    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    globalErrorHandler(error, req, res as unknown as import("express").Response, next)

    expect(res._status).toBe(401)
  })
})
