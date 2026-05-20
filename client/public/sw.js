/**
 * 浯島財務 Service Worker
 *
 * 策略：
 *   - 靜態資源（JS/CSS/icon/manifest）：cache-first（離線可用）
 *   - HTML / index：network-first、失敗回 cache（offline fallback）
 *   - API /api/*：network-only（不快取財務資料、永遠新鮮）
 *   - 圖片 /uploads/*：cache-first（單據縮圖離線可看）
 *
 * Cache 版本變更時要 bump CACHE_VERSION 強制重抓
 */
const CACHE_VERSION = "v2026-05-20-pwa-1"
const STATIC_CACHE = `static-${CACHE_VERSION}`
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icon.svg",
]

self.addEventListener("install", (event) => {
  // 立即啟用新 SW（不等舊 tab 關閉）
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // 清舊版 cache
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      ),
      // 立即控制所有 tab
      self.clients.claim(),
    ])
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 只處理同源請求
  if (url.origin !== self.location.origin) return

  // 只 cache GET
  if (request.method !== "GET") return

  // API：network-only（不快取財務 / 任務 / 餘額等）
  if (url.pathname.startsWith("/api/")) return

  // HTML（SPA fallback）：network-first、失敗回 cache index
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // 同時更新 cache
          const copy = res.clone()
          caches.open(RUNTIME_CACHE).then((c) => c.put("/", copy)).catch(() => {})
          return res
        })
        .catch(() =>
          caches.match("/").then((cached) => cached ?? new Response("離線中", { status: 503 }))
        )
    )
    return
  }

  // 靜態 / uploads：cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // 背景更新（stale-while-revalidate）
        fetch(request)
          .then((res) => {
            if (res.ok) {
              caches.open(RUNTIME_CACHE).then((c) => c.put(request, res.clone())).catch(() => {})
            }
          })
          .catch(() => {})
        return cached
      }
      return fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => caches.match("/"))
    })
  )
})

// 接收 client 的 SKIP_WAITING 訊息（手動更新時用）
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
