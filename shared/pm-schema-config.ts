/**
 * PM 旅館系統資料庫 schema 設定（單一真實來源）
 *
 * 背景：
 * - 2026-06-14 起 PM 多租戶化，正式資料搬到 t_wodao schema、
 *   public.revenues 已無新資料（曾害同步 20 天新增 0 筆）。
 * - 所有直連 PM DB 的 Pool 都必須帶此 search_path，
 *   原本硬編在 4 個檔案（pm-bridge storage/routes、pms-bridge、forecast-snapshots）。
 *
 * PM 若再遷 schema：只改這裡一處。
 */
export const PM_SCHEMA = "t_wodao"

/** pg Pool 的 options 參數（`-c search_path=...`） */
export const PM_SEARCH_PATH_OPTIONS = `-c search_path=${PM_SCHEMA},public`
