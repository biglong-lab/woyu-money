import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import path from "path"

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt", // 有新版時跳「重新整理」提示（不要自動更新）
      strategies: "injectManifest", // 改用 injectManifest 模式以自訂 SW（含 push handler）
      // root 是 client/，srcDir 用相對路徑（指向 client/src/sw）
      srcDir: "src/sw",
      filename: "sw.ts",
      // 直接讀現有的 manifest.json（已維護好）
      manifest: false,
      includeAssets: ["icon.svg", "manifest.json", "placeholder-document.svg"],
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      workbox: {
        // 預先快取的靜態檔（build artifacts）
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],

        // Runtime 快取策略
        runtimeCaching: [
          // 字型（Google Fonts 或自架）— CacheFirst（內容不變）
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 年
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 圖片（上傳的單據）— CacheFirst
          {
            urlPattern: /\/(uploads|objects)\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "uploaded-images-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 天
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // API GET — NetworkFirst（連線時新鮮、離線時用快取）
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET" && url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 6,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 1 天
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // SPA 導航 fallback — 走 index.html
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "navigation-cache",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
        ],

        // 跳過 webhook 端點快取（避免快取造成重複送）
        navigateFallbackDenylist: [/^\/api\/income\/webhook/, /^\/api\/expense\/webhook/],

        // 不超過 5MB 的檔才預快取（避免大檔卡住 install）
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false, // dev 不啟用 SW（避免快取卡開發）
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
})
