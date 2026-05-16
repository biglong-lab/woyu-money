/// <reference lib="webworker" />
/**
 * Service Worker — 自訂版（vite-plugin-pwa injectManifest 模式）
 *
 * 功能：
 * 1. Workbox 預快取（assets）+ runtime 快取（API/images/fonts）
 * 2. Web Push 接收（推播通知 + 點擊跳轉）
 * 3. 更新流程（skipWaiting 由前端控制）
 */
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching"
import { registerRoute, NavigationRoute } from "workbox-routing"
import { CacheFirst, NetworkFirst } from "workbox-strategies"
import { CacheableResponsePlugin } from "workbox-cacheable-response"
import { ExpirationPlugin } from "workbox-expiration"

declare let self: ServiceWorkerGlobalScope

// ─────────────────────────────────────────────
// 1. 預快取（由 vite-plugin-pwa 注入 __WB_MANIFEST）
// ─────────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ─────────────────────────────────────────────
// 2. Runtime 快取策略
// ─────────────────────────────────────────────

// Google Fonts — CacheFirst
registerRoute(
  ({ url }) => url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
)

// 上傳的圖片 — CacheFirst
registerRoute(
  ({ url }) => /\/(uploads|objects)\//.test(url.pathname),
  new CacheFirst({
    cacheName: "uploaded-images",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
)

// API GET — NetworkFirst（連線優先、超時走快取）
registerRoute(
  ({ url, request }) => request.method === "GET" && url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 6,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  })
)

// SPA 導航 fallback（排除 webhook 端點）
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: "navigation-cache",
      networkTimeoutSeconds: 3,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 }),
      ],
    }),
    {
      denylist: [/^\/api\/income\/webhook/, /^\/api\/expense\/webhook/, /^\/api\//],
    }
  )
)

// ─────────────────────────────────────────────
// 3. Web Push — 接收推播 + 點擊跳轉
// ─────────────────────────────────────────────

interface PushPayload {
  title?: string
  body?: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
  data?: Record<string, unknown>
  actions?: Array<{ action: string; title: string }>
}

self.addEventListener("push", (event) => {
  if (!event.data) return

  let payload: PushPayload
  try {
    payload = event.data.json()
  } catch {
    // 純文字 fallback
    payload = { title: "浯島財務", body: event.data.text() }
  }

  const title = payload.title || "浯島財務通知"
  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon || "/icon.svg",
    badge: payload.badge || "/icon.svg",
    tag: payload.tag,
    data: {
      url: payload.url || "/",
      ...payload.data,
    },
    requireInteraction: false,
    silent: false,
  }
  // actions 支援不一致、有支援的瀏覽器才設
  if (payload.actions && payload.actions.length > 0) {
    ;(options as NotificationOptions & { actions?: typeof payload.actions }).actions =
      payload.actions
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const url = (event.notification.data?.url as string | undefined) || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 找已開啟的 window 並 navigate 過去
      for (const client of clientList) {
        if ("focus" in client && "navigate" in client) {
          return (client as WindowClient).navigate(url).then((c) => c?.focus())
        }
      }
      // 沒開啟就新開
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})

// ─────────────────────────────────────────────
// 4. Share Target — 接收外部分享進來的圖片
//    iOS / Android 從相簿「分享到浯島財務」→ 進到 /document-inbox?shared=1
// ─────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // 只攔截我們的 share_target action
  if (url.pathname !== "/share-target" || event.request.method !== "POST") return

  event.respondWith(
    (async () => {
      try {
        const formData = await event.request.formData()
        const files = formData.getAll("files") as File[]

        if (files.length > 0) {
          // 把檔案存到 cache、讓 SPA fetch 出來
          const cache = await caches.open("share-target-staging")
          for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const blob = new Blob([file], { type: file.type })
            await cache.put(`/share-staged/${i}-${file.name}`, new Response(blob))
          }
        }

        // 把使用者 redirect 到 inbox 頁、由前端讀 staging cache 處理
        return Response.redirect("/document-inbox?shared=1", 303)
      } catch (err) {
        console.error("[sw] share-target failed:", err)
        return Response.redirect("/document-inbox", 303)
      }
    })()
  )
})

// ─────────────────────────────────────────────
// 5. 更新流程（由前端控制 skipWaiting）
// ─────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

export {}
