import { Request, Response, NextFunction, RequestHandler } from "express"

// 統一錯誤類別
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message)
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

// 常用錯誤快捷方法
export const errors = {
  notFound: (resource: string) =>
    new AppError(404, `${resource}不存在`),
  badRequest: (message: string) =>
    new AppError(400, message),
  unauthorized: () =>
    new AppError(401, "需要登入才能訪問此資源"),
  forbidden: () =>
    new AppError(403, "沒有權限執行此操作"),
  conflict: (message: string) =>
    new AppError(409, message),
  internal: (message = "伺服器內部錯誤") =>
    new AppError(500, message, false),
} as const

// 非同步路由處理器包裝 — 消除重複的 try/catch
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// 全域錯誤處理中間件
export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    })
    return
  }

  // 非預期錯誤
  console.error("未預期錯誤:", err)
  res.status(500).json({
    success: false,
    message: "伺服器內部錯誤",
  })
}
