import js from "@eslint/js"
import tseslint from "typescript-eslint"
import reactHooks from "eslint-plugin-react-hooks"
import eslintConfigPrettier from "eslint-config-prettier"

export default tseslint.config(
  // 基礎規則
  js.configs.recommended,

  // TypeScript 規則
  ...tseslint.configs.recommended,

  // React Hooks 規則
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // 專案自訂規則
  {
    rules: {
      // 漸進消除 any（既有 500+ 處，先 warn 再逐步修復）
      "@typescript-eslint/no-explicit-any": "warn",

      // 禁止未使用變數（允許 _ 開頭）
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // 禁止 var
      "no-var": "error",

      // 禁止 console.log（允許 warn/error）
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // 偏好 const
      "prefer-const": "error",

      // 允許空函式（event handler 常見）
      "@typescript-eslint/no-empty-function": "off",

      // 允許 require（部分 config 檔案需要）
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Prettier 關閉衝突規則（必須放最後）
  eslintConfigPrettier,

  // 忽略檔案
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "*.config.js",
      "*.config.ts",
      "drizzle/**",
      "database_backup/**",
      "uploads/**",
    ],
  }
)
