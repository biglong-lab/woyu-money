import { createRoot } from "react-dom/client"
import App from "./App"
import "./index.css"

// 全域錯誤處理
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason)
  event.preventDefault()
})

window.addEventListener("error", (event) => {
  console.error("Global error:", event.error)
})

createRoot(document.getElementById("root")!).render(<App />)

// 註冊 Service Worker（PWA 離線支援、僅 production）
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // 新版本就緒時自動啟用（避免使用者卡舊版）
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing
          if (!nw) return
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              nw.postMessage({ type: "SKIP_WAITING" })
            }
          })
        })
      })
      .catch((err) => console.error("[sw] register failed:", err))

    // SW 更新後 reload 一次取新 bundle
    let refreshing = false
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  })
}
