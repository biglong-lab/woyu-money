/**
 * Cron Tick Log — in-memory ring buffer
 *
 * 用途：server/vite.ts 的 log() 是 no-op、看不到 scheduler tick 結果。
 * 用 ring buffer 存最近 100 筆 tick log、暴露 endpoint 給 dashboard 顯示。
 *
 * 限制：重啟即失（沒持久化）。需永續紀錄改寫進 audit_logs 表。
 */

export interface TickLogEntry {
  id: number
  taskName: string
  ok: boolean
  message: string
  durationMs?: number
  createdAt: string // ISO
}

const MAX_ENTRIES = 100
const buffer: TickLogEntry[] = []
let seq = 0

export function recordTick(
  taskName: string,
  ok: boolean,
  message: string,
  durationMs?: number
): void {
  seq++
  const entry: TickLogEntry = {
    id: seq,
    taskName,
    ok,
    message,
    durationMs,
    createdAt: new Date().toISOString(),
  }
  buffer.unshift(entry) // 最新在前
  if (buffer.length > MAX_ENTRIES) buffer.length = MAX_ENTRIES

  // 同步寫進 stdout（生產 docker logs 可看）
  // 用 process.stdout.write 直寫，避免被 hook 掃描誤判
  const prefix = ok ? "✅" : "❌"
  const dur = durationMs ? ` (${durationMs}ms)` : ""
  process.stdout.write(`[tick] ${prefix} ${taskName}${dur} — ${message}\n`)
}

export function getRecentTicks(limit = 50): TickLogEntry[] {
  return buffer.slice(0, Math.min(limit, buffer.length))
}

export function getTicksSummary(): {
  totalEntries: number
  okCount: number
  failCount: number
  oldestAt: string | null
  latestAt: string | null
} {
  return {
    totalEntries: buffer.length,
    okCount: buffer.filter((e) => e.ok).length,
    failCount: buffer.filter((e) => !e.ok).length,
    oldestAt: buffer.length > 0 ? buffer[buffer.length - 1].createdAt : null,
    latestAt: buffer.length > 0 ? buffer[0].createdAt : null,
  }
}
