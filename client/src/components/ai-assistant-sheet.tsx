/**
 * AiAssistantSheet - AI 助手側邊抽屜
 * 全站可用的 AI 對話入口，側邊滑入 Sheet 風格
 */
import { useRef, useEffect } from "react"
import { Bot, Trash2, Zap } from "lucide-react"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AiMessageBubble } from "./ai-message-bubble"
import { AiChatInput } from "./ai-chat-input"
import { useAiChat } from "@/hooks/use-ai-chat"

// ─────────────────────────────────────────────
// 快捷問題
// ─────────────────────────────────────────────

const QUICK_QUESTIONS = [
  "月薪 32,000 要繳多少保費？",
  "本月收入多少？",
  "幫我新增一位員工",
  "顯示所有員工清單",
]

// ─────────────────────────────────────────────
// 歡迎頁面
// ─────────────────────────────────────────────

function WelcomeScreen({ onQuickQuestion }: { onQuickQuestion: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-10 text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
        <Bot className="w-8 h-8 text-white" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900">AI 財務助手</h3>
        <p className="text-sm text-gray-500 mt-1">
          詢問薪資計算、查詢收入、新增員工…
        </p>
      </div>

      <div className="w-full space-y-2">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">快速提問</p>
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onQuickQuestion(q)}
            className="w-full text-left px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
          >
            <Zap className="w-3.5 h-3.5 inline mr-2 text-yellow-500" />
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────

interface AiAssistantSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AiAssistantSheet({ open, onOpenChange }: AiAssistantSheetProps) {
  const { messages, isStreaming, sendMessage, stopStreaming, clearMessages } = useAiChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  // 自動捲到最新訊息
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [messages])

  const handleSend = (text: string, imageBase64?: string, imageMimeType?: string) => {
    sendMessage(text, imageBase64, imageMimeType)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[500px] p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b bg-gradient-to-r from-purple-50 to-blue-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                <Bot className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold text-gray-900 leading-tight">
                  AI 財務助手
                </SheetTitle>
                <div className="flex items-center gap-1.5">
                  {isStreaming ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs text-green-600">回覆中…</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      <span className="text-xs text-gray-400">待機</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-red-500"
                onClick={clearMessages}
                title="清除對話"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* 對話區域 */}
        <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
          <div className="px-4 py-3">
            {messages.length === 0 ? (
              <WelcomeScreen onQuickQuestion={(q) => sendMessage(q)} />
            ) : (
              messages.map((msg) => (
                <AiMessageBubble key={msg.id} message={msg} />
              ))
            )}
          </div>
        </ScrollArea>

        {/* 輸入框 */}
        <AiChatInput
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={stopStreaming}
        />
      </SheetContent>
    </Sheet>
  )
}
