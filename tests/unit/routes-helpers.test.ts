/**
 * server/routes/helpers.ts 單元測試
 * 測試密碼雜湊與比對函式
 */
import { describe, it, expect } from "vitest"
import { hashPassword, comparePasswords } from "../../server/routes/helpers"

describe("hashPassword", () => {
  it("應回傳包含雜湊值和鹽的字串", async () => {
    const result = await hashPassword("myPassword123")
    expect(result).toContain(".")
    const parts = result.split(".")
    expect(parts).toHaveLength(2)
    // 雜湊值為 64 bytes = 128 hex chars
    expect(parts[0]).toHaveLength(128)
    // 鹽值為 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32)
  })

  it("相同密碼應產生不同的雜湊（隨機鹽值）", async () => {
    const hash1 = await hashPassword("samePassword")
    const hash2 = await hashPassword("samePassword")
    expect(hash1).not.toBe(hash2)
  })

  it("空字串密碼也應正常產生雜湊", async () => {
    const result = await hashPassword("")
    expect(result).toContain(".")
    expect(result.split(".")).toHaveLength(2)
  })
})

describe("comparePasswords", () => {
  it("正確密碼應比對成功", async () => {
    const password = "correctPassword123"
    const hashed = await hashPassword(password)
    const result = await comparePasswords(password, hashed)
    expect(result).toBe(true)
  })

  it("錯誤密碼應比對失敗", async () => {
    const hashed = await hashPassword("rightPassword")
    const result = await comparePasswords("wrongPassword", hashed)
    expect(result).toBe(false)
  })

  it("應處理特殊字元密碼", async () => {
    const password = "p@$$w0rd!#%^&*()"
    const hashed = await hashPassword(password)
    const result = await comparePasswords(password, hashed)
    expect(result).toBe(true)
  })

  it("應處理中文密碼", async () => {
    const password = "密碼測試123"
    const hashed = await hashPassword(password)
    const result = await comparePasswords(password, hashed)
    expect(result).toBe(true)
  })

  it("應處理超長密碼", async () => {
    const password = "a".repeat(1000)
    const hashed = await hashPassword(password)
    const result = await comparePasswords(password, hashed)
    expect(result).toBe(true)
  })

  it("相似但不同的密碼應比對失敗", async () => {
    const hashed = await hashPassword("password123")
    const result = await comparePasswords("password124", hashed)
    expect(result).toBe(false)
  })
})
