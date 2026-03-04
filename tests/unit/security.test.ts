/**
 * server/security.ts 單元測試
 * 測試安全相關工具函式：輸入清理、錯誤類別、中間件
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  SecurityError,
  sanitizeInput,
  checkPermission,
  securityHeaders,
  validateInput,
  requestLogger,
} from "../../server/security"

// 建立 mock Express request/response/next
function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: "GET",
    path: "/test",
    ip: "127.0.0.1",
    secure: false,
    body: undefined as unknown,
    query: {} as Record<string, unknown>,
    user: undefined as unknown,
    ...overrides,
  } as unknown as import("express").Request
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    removedHeaders: [] as string[],
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
    setHeader(name: string, value: string) {
      res.headers[name] = value
    },
    removeHeader(name: string) {
      res.removedHeaders.push(name)
    },
    on: vi.fn(),
  }
  return res as unknown as import("express").Response & {
    _status: number
    _json: unknown
    headers: Record<string, string>
    removedHeaders: string[]
  }
}

const createNext = () => vi.fn() as unknown as import("express").NextFunction

// ========== SecurityError ==========
describe("SecurityError", () => {
  it("應正確建立錯誤物件並帶有預設狀態碼 403", () => {
    const error = new SecurityError("權限不足")
    expect(error.message).toBe("權限不足")
    expect(error.statusCode).toBe(403)
    expect(error.name).toBe("SecurityError")
    expect(error).toBeInstanceOf(Error)
  })

  it("應支援自訂狀態碼", () => {
    const error = new SecurityError("未登入", 401)
    expect(error.statusCode).toBe(401)
    expect(error.message).toBe("未登入")
  })
})

// ========== sanitizeInput ==========
describe("sanitizeInput", () => {
  it("應移除 <script> 標籤", () => {
    const input = 'hello<script>alert("xss")</script>world'
    const result = sanitizeInput(input)
    expect(result).toBe("helloworld")
  })

  it("應移除 javascript: 協定", () => {
    const input = "javascript:alert(1)"
    const result = sanitizeInput(input)
    expect(result).not.toContain("javascript:")
  })

  it("應移除 on* 事件處理器", () => {
    const input = "onerror= alert(1)"
    const result = sanitizeInput(input)
    expect(result).not.toMatch(/on\w+\s*=/)
  })

  it("應修剪字串前後空白", () => {
    const result = sanitizeInput("  hello  ")
    expect(result).toBe("hello")
  })

  it("應遞迴清理陣列元素", () => {
    const input = ["<script>bad</script>", "safe text"]
    const result = sanitizeInput(input) as string[]
    expect(result[0]).toBe("")
    expect(result[1]).toBe("safe text")
  })

  it("應遞迴清理物件屬性值", () => {
    const input = {
      name: "<script>evil</script>",
      bio: "safe",
    }
    const result = sanitizeInput(input) as Record<string, string>
    expect(result.name).toBe("")
    expect(result.bio).toBe("safe")
  })

  it("非字串/陣列/物件型別應直接回傳", () => {
    expect(sanitizeInput(42)).toBe(42)
    expect(sanitizeInput(null)).toBeNull()
    expect(sanitizeInput(undefined)).toBeUndefined()
    expect(sanitizeInput(true)).toBe(true)
  })

  it("應處理巢狀物件", () => {
    const input = {
      level1: {
        level2: "<script>nested</script>ok",
      },
    }
    const result = sanitizeInput(input) as Record<string, Record<string, string>>
    expect(result.level1.level2).toBe("ok")
  })

  it("應處理空字串", () => {
    expect(sanitizeInput("")).toBe("")
  })

  it("應處理空陣列", () => {
    const result = sanitizeInput([])
    expect(result).toEqual([])
  })

  it("應處理空物件", () => {
    const result = sanitizeInput({})
    expect(result).toEqual({})
  })
})

// ========== checkPermission ==========
describe("checkPermission", () => {
  it("未登入使用者應回傳 401", async () => {
    const middleware = checkPermission("payments.view")
    const req = createMockReq({ user: undefined })
    const res = createMockRes()
    const next = createNext()

    await middleware(req, res as unknown as import("express").Response, next)

    expect(res._status).toBe(401)
    expect(res._json).toEqual(expect.objectContaining({ error: "PermissionDenied" }))
    expect(next).not.toHaveBeenCalled()
  })

  it("管理員角色應直接放行", async () => {
    const middleware = checkPermission("any.permission")
    const req = createMockReq({ user: { id: 1, role: "admin", menuPermissions: {} } })
    const res = createMockRes()
    const next = createNext()

    await middleware(req, res as unknown as import("express").Response, next)

    expect(next).toHaveBeenCalled()
  })

  it("擁有對應權限的使用者應放行", async () => {
    const middleware = checkPermission("payments.view")
    const req = createMockReq({
      user: { id: 2, role: "user1", menuPermissions: { "payments.view": true } },
    })
    const res = createMockRes()
    const next = createNext()

    await middleware(req, res as unknown as import("express").Response, next)

    expect(next).toHaveBeenCalled()
  })

  it("缺少權限的使用者應回傳 403", async () => {
    const middleware = checkPermission("admin.settings")
    const req = createMockReq({
      user: { id: 3, role: "user1", menuPermissions: { "payments.view": true } },
    })
    const res = createMockRes()
    const next = createNext()

    await middleware(req, res as unknown as import("express").Response, next)

    expect(res._status).toBe(403)
    expect(res._json).toEqual(expect.objectContaining({ error: "PermissionDenied" }))
  })

  it("menuPermissions 為 null 時應回傳 403", async () => {
    const middleware = checkPermission("any.permission")
    const req = createMockReq({
      user: { id: 4, role: "user1", menuPermissions: null },
    })
    const res = createMockRes()
    const next = createNext()

    await middleware(req, res as unknown as import("express").Response, next)

    expect(res._status).toBe(403)
  })
})

// ========== securityHeaders ==========
describe("securityHeaders", () => {
  it("應設定 X-Frame-Options 為 DENY", () => {
    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    securityHeaders(req, res as unknown as import("express").Response, next)

    expect(res.headers["X-Frame-Options"]).toBe("DENY")
  })

  it("應設定 X-Content-Type-Options 為 nosniff", () => {
    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    securityHeaders(req, res as unknown as import("express").Response, next)

    expect(res.headers["X-Content-Type-Options"]).toBe("nosniff")
  })

  it("應設定 X-XSS-Protection", () => {
    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    securityHeaders(req, res as unknown as import("express").Response, next)

    expect(res.headers["X-XSS-Protection"]).toBe("1; mode=block")
  })

  it("應移除 X-Powered-By 標頭", () => {
    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    securityHeaders(req, res as unknown as import("express").Response, next)

    expect(res.removedHeaders).toContain("X-Powered-By")
  })

  it("HTTPS 請求應設定 HSTS 標頭", () => {
    const req = createMockReq({ secure: true })
    const res = createMockRes()
    const next = createNext()

    securityHeaders(req, res as unknown as import("express").Response, next)

    expect(res.headers["Strict-Transport-Security"]).toContain("max-age=31536000")
  })

  it("HTTP 請求不應設定 HSTS 標頭", () => {
    const req = createMockReq({ secure: false })
    const res = createMockRes()
    const next = createNext()

    securityHeaders(req, res as unknown as import("express").Response, next)

    expect(res.headers["Strict-Transport-Security"]).toBeUndefined()
  })

  it("應呼叫 next() 繼續處理", () => {
    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    securityHeaders(req, res as unknown as import("express").Response, next)

    expect(next).toHaveBeenCalled()
  })
})

// ========== validateInput ==========
describe("validateInput", () => {
  it("應清理 req.body 中的惡意內容", () => {
    const req = createMockReq({
      body: { name: '<script>alert("xss")</script>safe' },
      query: {},
    })
    const res = createMockRes()
    const next = createNext()

    validateInput(req, res as unknown as import("express").Response, next)

    expect((req.body as Record<string, string>).name).toBe("safe")
    expect(next).toHaveBeenCalled()
  })

  it("應清理 req.query 中的惡意內容", () => {
    const req = createMockReq({
      body: undefined,
      query: { search: "<script>bad</script>good" },
    })
    const res = createMockRes()
    const next = createNext()

    validateInput(req, res as unknown as import("express").Response, next)

    expect(next).toHaveBeenCalled()
  })

  it("body 為空時應正常呼叫 next", () => {
    const req = createMockReq({ body: undefined, query: {} })
    const res = createMockRes()
    const next = createNext()

    validateInput(req, res as unknown as import("express").Response, next)

    expect(next).toHaveBeenCalled()
  })
})

// ========== requestLogger ==========
describe("requestLogger", () => {
  it("應呼叫 next() 繼續處理", () => {
    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    requestLogger(req, res as unknown as import("express").Response, next)

    expect(next).toHaveBeenCalled()
  })

  it("應監聽 response finish 事件", () => {
    const req = createMockReq()
    const res = createMockRes()
    const next = createNext()

    requestLogger(req, res as unknown as import("express").Response, next)

    expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function))
  })
})
