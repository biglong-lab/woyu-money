import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    // 測試環境
    environment: "node",

    // 全域設定
    globals: true,

    // 設定檔
    setupFiles: ["./tests/setup.ts"],

    // 測試檔案位置
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],

    // 排除
    exclude: ["node_modules", "dist"],

    // 覆蓋率設定
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["server/**/*.ts", "shared/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        // 外部系統橋接（需要外部 DB 連線，非核心業務邏輯）
        "server/routes/pm-bridge.ts",
        "server/routes/pms-bridge.ts",
        "server/storage/pm-bridge.ts",
        "server/storage/pms-bridge.ts",
        // Vite 開發伺服器設定（非業務邏輯）
        "server/vite.ts",
      ],
    },

    // 超時設定
    testTimeout: 15000,

    // 整合測試共用資料庫，需要序列化執行避免競爭
    fileParallelism: false,
  },

  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./shared"),
      "@": path.resolve(__dirname, "./client/src"),
    },
  },
})
