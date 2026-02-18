/**
 * AiMessageBubble - AI 對話訊息泡泡元件
 * 支援：文字（Markdown）、圖片預覽、工具調用結果卡片
 */
import { useState } from "react"
import { Bot, User, ChevronDown, ChevronRight, Wrench, AlertCircle, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ChatMessage, ToolCallResult } from "@/hooks/use-ai-chat"

// ─────────────────────────────────────────────
// 工具名稱對應中文
// ─────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  get_employees: "查詢員工清單",
  calculate_salary: "計算薪資保費",
  get_revenue_stats: "查詢收入統計",
  get_monthly_trend: "查詢月度趨勢",
  get_payment_records: "查詢付款記錄",
  get_projects: "查詢專案清單",
  create_employee: "新增員工",
  create_daily_revenue: "新增收款記錄",
}

// ─────────────────────────────────────────────
// 工具結果卡片
// ─────────────────────────────────────────────

function ToolResultCard({ tc }: { tc: ToolCallResult }) {
  const [expanded, setExpanded] = useState(false)
  const label = TOOL_LABELS[tc.toolName] ?? tc.toolName
  const isDone = tc.result !== undefined || tc.error !== undefined
  const isError = tc.error !== undefined

  return (
    <div className={`mt-1.5 rounded-lg border text-xs overflow-hidden ${
      isError ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50/60"
    }`}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        onClick={() => isDone && setExpanded(!expanded)}
      >
        <Wrench className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <span className="font-medium text-blue-700 flex-1">{label}</span>
        {!isDone && (
          <span className="text-blue-400 animate-pulse">執行中…</span>
        )}
        {isDone && !isError && (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        )}
        {isError && (
          <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        )}
        {isDone && (
          expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
            : <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
        )}
      </button>
      {expanded && isDone && (
        <div className="px-3 pb-2.5 pt-0 border-t border-blue-100">
          {isError ? (
            <p className="text-red-600">{tc.error}</p>
          ) : (
            <pre className="text-gray-700 overflow-auto max-h-48 whitespace-pre-wrap">
              {JSON.stringify(tc.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 簡易 Markdown 渲染（支援粗體/程式碼/換行）
// ─────────────────────────────────────────────

function MarkdownText({ text }: { text: string }) {
  // 把 **粗體** 和 `程式碼` 轉換為 HTML
  const lines = text.split("\n")
  return (
    <div className="text-sm leading-relaxed space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />

        // 表格列
        if (line.startsWith("|")) {
          return (
            <div key={i} className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
              {line}
            </div>
          )
        }

        // 標題
        if (line.startsWith("## ")) {
          return <p key={i} className="font-semibold text-gray-900 mt-1">{line.slice(3)}</p>
        }
        if (line.startsWith("# ")) {
          return <p key={i} className="font-bold text-gray-900 mt-1">{line.slice(2)}</p>
        }

        // 一般文字（處理粗體和程式碼）
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
        return (
          <p key={i}>
            {parts.map((part, j) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={j}>{part.slice(2, -2)}</strong>
              }
              if (part.startsWith("`") && part.endsWith("`")) {
                return <code key={j} className="bg-gray-100 px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>
              }
              return <span key={j}>{part}</span>
            })}
          </p>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────

interface AiMessageBubbleProps {
  message: ChatMessage
}

export function AiMessageBubble({ message }: AiMessageBubbleProps) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end gap-2 mb-3">
        <div className="max-w-[85%]">
          {message.imageUrl && (
            <div className="mb-1.5 flex justify-end">
              <img
                src={message.imageUrl}
                alt="uploaded"
                className="max-w-[200px] max-h-[150px] rounded-lg object-cover"
              />
            </div>
          )}
          {message.content && (
            <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
              {message.content}
            </div>
          )}
        </div>
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
          <User className="w-4 h-4 text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 mb-3">
      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-1">
        <Bot className="w-4 h-4 text-purple-600" />
      </div>
      <div className="max-w-[90%] flex-1">
        {/* 工具調用卡片 */}
        {(message.toolCalls ?? []).length > 0 && (
          <div className="mb-2 space-y-1">
            {message.toolCalls!.map((tc, i) => (
              <ToolResultCard key={`${tc.toolName}-${i}`} tc={tc} />
            ))}
          </div>
        )}

        {/* AI 回應文字 */}
        {(message.content || message.isStreaming) && (
          <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
            {message.content ? (
              <MarkdownText text={message.content} />
            ) : null}
            {message.isStreaming && (
              <span className="inline-flex gap-0.5 ml-1">
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            )}
          </div>
        )}

        {/* 時間戳 */}
        <p className="text-[10px] text-gray-400 mt-1 ml-1">
          {message.timestamp.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  )
}
