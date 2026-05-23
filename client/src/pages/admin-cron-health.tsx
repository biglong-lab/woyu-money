/**
 * /admin/cron-health — Cron Tick Health 觀測頁（階段 5.1）
 *
 * 用 GET /api/admin/cron-tick-logs 顯示：
 *  - 最近 50 筆 tick log（時間倒序）
 *  - 過去 24h 各 task 通過率（auto-refresh 30s）
 *  - 全域 summary（total / ok / fail）
 */
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { Activity, Clock, CheckCircle2, XCircle } from "lucide-react"

interface TickEntry {
  id: number
  taskName: string
  ok: boolean
  message: string
  durationMs?: number
  createdAt: string
}

interface TickResponse {
  summary: {
    totalEntries: number
    okCount: number
    failCount: number
    oldestAt: string | null
    latestAt: string | null
  }
  ticks: TickEntry[]
}

function recentSince(ticks: TickEntry[], ms: number): TickEntry[] {
  const cutoff = Date.now() - ms
  return ticks.filter((t) => new Date(t.createdAt).getTime() >= cutoff)
}

function groupByTask(ticks: TickEntry[]): {
  name: string
  total: number
  ok: number
  fail: number
  passRate: number
  avgMs: number | null
  lastAt: string
  lastOk: boolean
}[] {
  const m = new Map<
    string,
    { ok: number; fail: number; total: number; durs: number[]; lastAt: string; lastOk: boolean }
  >()
  for (const t of ticks) {
    const entry = m.get(t.taskName) ?? {
      ok: 0,
      fail: 0,
      total: 0,
      durs: [],
      lastAt: t.createdAt,
      lastOk: t.ok,
    }
    entry.total++
    if (t.ok) entry.ok++
    else entry.fail++
    if (typeof t.durationMs === "number") entry.durs.push(t.durationMs)
    if (new Date(t.createdAt).getTime() > new Date(entry.lastAt).getTime()) {
      entry.lastAt = t.createdAt
      entry.lastOk = t.ok
    }
    m.set(t.taskName, entry)
  }
  return Array.from(m.entries())
    .map(([name, e]) => ({
      name,
      total: e.total,
      ok: e.ok,
      fail: e.fail,
      passRate: e.total > 0 ? Math.round((e.ok / e.total) * 100) : 0,
      avgMs:
        e.durs.length > 0 ? Math.round(e.durs.reduce((s, v) => s + v, 0) / e.durs.length) : null,
      lastAt: e.lastAt,
      lastOk: e.lastOk,
    }))
    .sort((a, b) => b.total - a.total)
}

export default function AdminCronHealthPage() {
  useDocumentTitle("Cron 觀測")

  const { data, isLoading, refetch } = useQuery<TickResponse>({
    queryKey: ["/api/admin/cron-tick-logs"],
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  })

  const ticks = data?.ticks ?? []
  const recent24h = recentSince(ticks, 24 * 60 * 60 * 1000)
  const taskStats = groupByTask(recent24h)
  const summary = data?.summary

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" />
            Cron 觀測
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            in-memory ring buffer · 每 30 秒自動刷新 · 重啟即失
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50"
          data-testid="button-refresh"
        >
          🔄 立即刷新
        </button>
      </div>

      {/* Summary 卡 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">整體統計</CardTitle>
          <CardDescription>
            buffer 容量上限 100、目前 {summary?.totalEntries ?? 0} 筆
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded-lg p-3 border">
              <div className="text-xs text-gray-500">總筆數</div>
              <div className="text-2xl font-bold">{summary?.totalEntries ?? 0}</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
              <div className="text-xs text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                成功
              </div>
              <div className="text-2xl font-bold text-emerald-700">{summary?.okCount ?? 0}</div>
            </div>
            <div className="bg-rose-50 rounded-lg p-3 border border-rose-200">
              <div className="text-xs text-rose-700 flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                失敗
              </div>
              <div className="text-2xl font-bold text-rose-700">{summary?.failCount ?? 0}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="text-xs text-blue-700 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                最近一筆
              </div>
              <div className="text-xs font-medium text-blue-700 mt-1">
                {summary?.latestAt ? new Date(summary.latestAt).toLocaleString("zh-TW") : "—"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 24h 各 task 通過率 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">過去 24h 各任務通過率</CardTitle>
          <CardDescription>
            {recent24h.length} 筆 · {taskStats.length} 個任務
          </CardDescription>
        </CardHeader>
        <CardContent>
          {taskStats.length === 0 && (
            <div className="text-sm text-gray-500 py-4 text-center">過去 24 小時無紀錄</div>
          )}
          {taskStats.length > 0 && (
            <div className="space-y-2">
              {taskStats.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between bg-white border rounded-lg p-2"
                  data-testid={`task-stat-${s.name}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          s.lastOk ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }
                      >
                        {s.lastOk ? "OK" : "FAIL"}
                      </Badge>
                      <span className="font-medium text-sm truncate">{s.name}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      最後跑：{new Date(s.lastAt).toLocaleString("zh-TW")}
                      {s.avgMs !== null && <span className="ml-2">avg {s.avgMs}ms</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold">
                        <span
                          className={s.passRate === 100 ? "text-emerald-600" : "text-amber-600"}
                        >
                          {s.passRate}%
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {s.ok}/{s.total}
                      </div>
                    </div>
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={
                          s.passRate === 100
                            ? "h-full bg-emerald-500"
                            : s.passRate >= 80
                              ? "h-full bg-amber-500"
                              : "h-full bg-rose-500"
                        }
                        style={{ width: `${s.passRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 最近 50 筆 tick log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">最近 50 筆紀錄</CardTitle>
          <CardDescription>時間倒序 · 點選可看完整訊息</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="text-sm text-gray-500">載入中...</div>}
          {!isLoading && ticks.length === 0 && (
            <div className="text-sm text-gray-500 py-4 text-center">無紀錄</div>
          )}
          {!isLoading && ticks.length > 0 && (
            <div className="space-y-1">
              {ticks.map((t) => (
                <div
                  key={t.id}
                  className={`rounded border p-2 text-xs ${
                    t.ok ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50"
                  }`}
                  data-testid={`tick-${t.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="shrink-0">{t.ok ? "✅" : "❌"}</span>
                      <span className="font-medium truncate">{t.taskName}</span>
                      {typeof t.durationMs === "number" && (
                        <span className="text-gray-500 shrink-0">{t.durationMs}ms</span>
                      )}
                    </div>
                    <span className="text-gray-400 shrink-0">
                      {new Date(t.createdAt).toLocaleString("zh-TW", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="text-gray-600 mt-1 pl-6 break-all">{t.message}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
