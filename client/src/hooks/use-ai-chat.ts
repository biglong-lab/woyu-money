/**
 * useAiChat Hook
 * 管理 AI 助手的對話狀態和 SSE 串流接收
 */
import { useState, useCallback, useRef } from "react"

// ─────────────────────────────────────────────
// 型別定義
// ─────────────────────────────────────────────

export interface ToolCallResult {
  toolName: string
  args?: Record<string, unknown>
  result?: unknown
  error?: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  imageUrl?: string        // 用戶上傳的圖片預覽
  toolCalls?: ToolCallResult[]
  isStreaming?: boolean
  timestamp: Date
}

interface StreamEvent {
  type: "delta" | "tool_start" | "tool_result" | "tool_error" | "done" | "error"
  content?: string
  toolName?: string
  args?: Record<string, unknown>
  result?: unknown
  error?: string
  message?: string
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  /** 產生唯一 ID */
  const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  /** 中止當前串流 */
  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
    // 把最後一則 streaming 訊息標為完成
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    )
  }, [])

  /** 清除所有對話 */
  const clearMessages = useCallback(() => {
    stopStreaming()
    setMessages([])
  }, [stopStreaming])

  /**
   * 送出訊息並接收串流回應
   * @param text 用戶輸入的文字
   * @param imageBase64 可選的圖片 Base64
   * @param imageMimeType 圖片類型
   */
  const sendMessage = useCallback(
    async (text: string, imageBase64?: string, imageMimeType?: string) => {
      if (isStreaming) return
      if (!text.trim() && !imageBase64) return

      // 加入用戶訊息
      const userMsg: ChatMessage = {
        id: genId(),
        role: "user",
        content: text.trim(),
        imageUrl: imageBase64
          ? `data:${imageMimeType ?? "image/jpeg"};base64,${imageBase64}`
          : undefined,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])

      // 建立 AI 回應佔位訊息
      const assistantId = genId()
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolCalls: [],
        isStreaming: true,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      setIsStreaming(true)

      // 建立歷史訊息（不含當前用戶訊息，給後端的 messages 陣列）
      // 後端會在 system prompt 後加上所有歷史訊息
      const historyMessages = messages
        .filter((m) => !m.isStreaming)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      // 加上當前用戶訊息
      historyMessages.push({ role: "user", content: text.trim() })

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch("/api/ai/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: historyMessages,
            imageBase64: imageBase64 ?? null,
            imageMimeType: imageMimeType ?? null,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({ message: "AI 請求失敗" }))
          throw new Error(err.message ?? "AI 請求失敗")
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error("無法取得串流")
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const raw = line.slice(6).trim()
            if (!raw) continue

            let event: StreamEvent
            try { event = JSON.parse(raw) } catch { continue }

            switch (event.type) {
              case "delta":
                if (event.content) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + event.content! }
                        : m
                    )
                  )
                }
                break

              case "tool_start":
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m
                    const tc: ToolCallResult = { toolName: event.toolName!, args: event.args }
                    return { ...m, toolCalls: [...(m.toolCalls ?? []), tc] }
                  })
                )
                break

              case "tool_result":
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m
                    const toolCalls = (m.toolCalls ?? []).map((tc) =>
                      tc.toolName === event.toolName && tc.result === undefined
                        ? { ...tc, result: event.result }
                        : tc
                    )
                    return { ...m, toolCalls }
                  })
                )
                break

              case "tool_error":
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m
                    const toolCalls = (m.toolCalls ?? []).map((tc) =>
                      tc.toolName === event.toolName && tc.result === undefined
                        ? { ...tc, error: event.error }
                        : tc
                    )
                    return { ...m, toolCalls }
                  })
                )
                break

              case "done":
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, isStreaming: false } : m
                  )
                )
                setIsStreaming(false)
                break

              case "error":
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content || `❌ ${event.message}`, isStreaming: false }
                      : m
                  )
                )
                setIsStreaming(false)
                break
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        const errMsg = err instanceof Error ? err.message : "未知錯誤"
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `❌ ${errMsg}`, isStreaming: false }
              : m
          )
        )
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [isStreaming, messages]
  )

  return { messages, isStreaming, sendMessage, stopStreaming, clearMessages }
}
