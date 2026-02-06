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
      exclude: ["**/*.d.ts", "**/*.test.ts"],
    },

    // 超時設定
    testTimeout: 10000,
  },

  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./shared"),
      "@": path.resolve(__dirname, "./client/src"),
    },
  },
})
