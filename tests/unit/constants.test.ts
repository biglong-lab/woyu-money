/**
 * 常數與設定值測試
 * 確保系統常數正確且一致
 */
import { describe, it, expect } from "vitest"
import {
  PaymentStatus,
  ScheduleStatus,
  PaymentType,
  UserRole,
  FileUploadConfig,
  SecurityConfig,
  DatabaseConfig,
  SessionConfig,
  Priority,
} from "@shared/constants"

describe("PaymentStatus", () => {
  it("應包含所有必要的付款狀態", () => {
    expect(PaymentStatus.PENDING).toBe("pending")
    expect(PaymentStatus.PAID).toBe("paid")
    expect(PaymentStatus.PARTIAL).toBe("partial")
    expect(PaymentStatus.OVERDUE).toBe("overdue")
    expect(PaymentStatus.CANCELLED).toBe("cancelled")
  })
})

describe("ScheduleStatus", () => {
  it("應包含所有排程狀態", () => {
    expect(ScheduleStatus.SCHEDULED).toBe("scheduled")
    expect(ScheduleStatus.COMPLETED).toBe("completed")
    expect(ScheduleStatus.OVERDUE).toBe("overdue")
    expect(ScheduleStatus.RESCHEDULED).toBe("rescheduled")
  })
})

describe("PaymentType", () => {
  it("應包含所有付款類型", () => {
    expect(PaymentType.SINGLE).toBe("single")
    expect(PaymentType.RECURRING).toBe("recurring")
    expect(PaymentType.INSTALLMENT).toBe("installment")
    expect(PaymentType.MONTHLY).toBe("monthly")
  })
})

describe("UserRole", () => {
  it("應包含所有使用者角色", () => {
    expect(UserRole.ADMIN).toBe("admin")
    expect(UserRole.USER1).toBe("user1")
    expect(UserRole.USER2).toBe("user2")
    expect(UserRole.CHILD).toBe("child")
  })
})

describe("FileUploadConfig", () => {
  it("檔案大小限制應為 10MB", () => {
    expect(FileUploadConfig.MAX_FILE_SIZE).toBe(10 * 1024 * 1024)
  })

  it("應允許常見圖片格式", () => {
    expect(FileUploadConfig.ALLOWED_IMAGE_TYPES).toContain("image/jpeg")
    expect(FileUploadConfig.ALLOWED_IMAGE_TYPES).toContain("image/png")
  })

  it("應允許 PDF 文件", () => {
    expect(FileUploadConfig.ALLOWED_DOCUMENT_TYPES).toContain("application/pdf")
  })
})

describe("SecurityConfig", () => {
  it("最大登入嘗試次數應為 5", () => {
    expect(SecurityConfig.MAX_LOGIN_ATTEMPTS).toBe(5)
  })

  it("帳號鎖定時間應為 30 分鐘", () => {
    expect(SecurityConfig.ACCOUNT_LOCK_DURATION).toBe(30 * 60 * 1000)
  })

  it("最小密碼長度應為 8", () => {
    expect(SecurityConfig.PASSWORD_MIN_LENGTH).toBe(8)
  })
})

describe("DatabaseConfig", () => {
  it("最大連線數應合理", () => {
    expect(DatabaseConfig.MAX_CONNECTIONS).toBeGreaterThan(0)
    expect(DatabaseConfig.MAX_CONNECTIONS).toBeLessThanOrEqual(50)
  })

  it("連線超時應大於 0", () => {
    expect(DatabaseConfig.CONNECTION_TIMEOUT).toBeGreaterThan(0)
  })
})

describe("SessionConfig", () => {
  it("Cookie 有效期應為 7 天", () => {
    expect(SessionConfig.COOKIE_MAX_AGE).toBe(7 * 24 * 60 * 60 * 1000)
  })
})

describe("Priority", () => {
  it("優先級順序應正確", () => {
    expect(Priority.LOWEST).toBeLessThan(Priority.LOW)
    expect(Priority.LOW).toBeLessThan(Priority.MEDIUM)
    expect(Priority.MEDIUM).toBeLessThan(Priority.HIGH)
    expect(Priority.HIGH).toBeLessThan(Priority.HIGHEST)
  })
})
