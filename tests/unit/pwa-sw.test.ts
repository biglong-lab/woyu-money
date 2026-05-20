/**
 * PWA Service Worker 內容驗證
 * 確保 sw.js / manifest.json 有正確結構、不依賴實際 Worker runtime
 */
import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

const PUBLIC_DIR = resolve(__dirname, "../../client/public")

describe("PWA Service Worker", () => {
  it("sw.js 存在於 public/", () => {
    expect(existsSync(resolve(PUBLIC_DIR, "sw.js"))).toBe(true)
  })

  it("sw.js 含 install / activate / fetch 三個必要 listener", () => {
    const src = readFileSync(resolve(PUBLIC_DIR, "sw.js"), "utf-8")
    expect(src).toContain('addEventListener("install"')
    expect(src).toContain('addEventListener("activate"')
    expect(src).toContain('addEventListener("fetch"')
  })

  it("sw.js API 請求採 network-only（不快取財務資料）", () => {
    const src = readFileSync(resolve(PUBLIC_DIR, "sw.js"), "utf-8")
    // 必須有 /api/ 早返判斷
    expect(src).toMatch(/pathname\.startsWith\(["']\/api\//)
  })

  it("sw.js 含 SKIP_WAITING 機制（手動更新）", () => {
    const src = readFileSync(resolve(PUBLIC_DIR, "sw.js"), "utf-8")
    expect(src).toContain("SKIP_WAITING")
    expect(src).toContain("skipWaiting()")
  })

  it("sw.js 含 cache 版本號（變更時要 bump）", () => {
    const src = readFileSync(resolve(PUBLIC_DIR, "sw.js"), "utf-8")
    expect(src).toMatch(/CACHE_VERSION\s*=\s*["']v\d/)
  })
})

describe("PWA Manifest", () => {
  const manifest = JSON.parse(readFileSync(resolve(PUBLIC_DIR, "manifest.json"), "utf-8"))

  it("含 PWA 必要欄位", () => {
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.start_url).toBe("/")
    expect(manifest.display).toBe("standalone")
    expect(manifest.theme_color).toBeTruthy()
    expect(manifest.icons).toBeInstanceOf(Array)
    expect(manifest.icons.length).toBeGreaterThan(0)
  })

  it("含家庭記帳 shortcut（家長手機快速進入）", () => {
    expect(Array.isArray(manifest.shortcuts)).toBe(true)
    const family = manifest.shortcuts.find((s: { url: string }) => s.url === "/family")
    expect(family).toBeTruthy()
    expect(family.name).toContain("家庭")
  })
})
