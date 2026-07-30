/**
 * 共用日期工具（前端後端都可用）
 *
 * 解決：`new Date().toISOString().split("T")[0]` 是 UTC 日期，
 * 在 TPE (UTC+8) 時區會在 00:00-08:00 期間誤認為前一天。
 *
 * 例如 TPE 2026-04-15 早上 6:00 = UTC 2026-04-14 22:00：
 * - `new Date().toISOString()` → "2026-04-14T22:00:00.000Z"
 * - 取前 10 字元 → "2026-04-14" ❌（正確應為 "2026-04-15"）
 *
 * ---
 *
 * ## 🔴 專案的日期慣例（2026-07-30 釐清，動日期相關程式前務必先讀）
 *
 * 生產與 CI 的 PostgreSQL 都設 `PGTZ=Asia/Taipei`，所以 **`CURRENT_DATE` = 台北日期**。
 * 所有寫入都必須跟它同源，否則在台北 00:00-08:00 會差一天。
 *
 * | 欄位型別 | 正確寫法 | 為什麼 |
 * |---|---|---|
 * | `date` 欄位（`checkin_date`、`spend_date`）| `localDateTPE()` | 直接產生台北日期字串 |
 * | `timestamp` 欄位（`completed_at`、`approved_at`…）| ``sql`now()` `` 或 `.defaultNow()` | 交給 DB 算，用 session 時區 |
 *
 * ### ❌ 不要用 `new Date()` 寫 timestamp 欄位
 *
 * drizzle 會把 JS `Date` 序列化成 **UTC 牆鐘**存進 `timestamp without time zone`，
 * 而 `.defaultNow()` 與 raw `sql` 存的是 **session（台北）牆鐘** —— 兩者差 8 小時。
 * 實測（PGTZ=Asia/Taipei，當下 UTC 16:30 / 台北 00:30）：
 *
 * ```
 * drizzle .values({ ts: new Date() })      → 2026-07-29 16:30:59   DATE()=07-29  ❌
 * sql`... VALUES (${new Date()})`          → 2026-07-30 00:30:59   DATE()=07-30  ✅
 * DEFAULT now()                            → 2026-07-30 00:37:50   DATE()=07-30  ✅
 * ```
 *
 * 曾造成的實際 bug：台北 00:00-08:00 approve 的任務不出現在「今日任務列表」
 * 「今日排行榜」「今日重點」「家庭 streak」「活動 heatmap」。
 *
 * ### 現況（2026-07-30 階段 A + B 完成後）
 *
 * - `server/` 內 timestamp 欄位的寫入已統一為 ``sql`now()` ``（171 處）
 * - 例外：8 處位於帶 `as Partial<...>` 型別斷言的中間物件，型別上無法塞 `SQL`，
 *   仍用 `new Date()`（`document-inbox.ts`、`forecast-snapshots.ts`、
 *   `payment-items.ts`、`statistics.ts`）。這些欄位目前沒有被拿去跟
 *   `CURRENT_DATE` 比對，不影響正確性；日後若要用於日期比對需先處理。
 * - ⚠️ **歷史資料中仍有以 `new Date()` 寫入的列（偏移 8 小時），尚未回填。**
 *   若要轉 `timestamptz`，必須先接受這批歷史列會被誤讀 —— 同一欄位混了兩種
 *   慣例、逐列無法分辨。
 *
 * ### 單元測試
 *
 * mock `drizzle-orm` 的測試需在 factory 補 `sql`，否則會報
 * `No "sql" export is defined on the "drizzle-orm" mock`。
 * 斷言請驗 `{ type: "sql", text: "now()" }` 而非 `toBeInstanceOf(Date)`——
 * 這樣才能擋住日後被改回 `new Date()`。
 */

const DEFAULT_TZ = "Asia/Taipei"

/**
 * 取得 TPE 時區的 YYYY-MM-DD 日期字串
 *
 * @param offsetDays 0 = 今天、-1 = 昨天、+1 = 明天
 * @param timeZone IANA 時區，預設 Asia/Taipei
 */
export function localDateTPE(offsetDays = 0, timeZone: string = DEFAULT_TZ): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  // en-CA locale 給 YYYY-MM-DD 格式
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return formatter.format(d)
}

/**
 * 取得 TPE 時區的 YYYY-MM 月份字串
 */
export function localMonthTPE(offsetMonths = 0, timeZone: string = DEFAULT_TZ): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMonths)
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  })
  return formatter.format(d) // "2026-04"
}
