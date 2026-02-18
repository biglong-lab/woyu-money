/**
 * AiChatInput - AI 對話輸入框元件
 * 支援：文字輸入、圖片上傳預覽、Enter 送出、Shift+Enter 換行
 */
import { useRef, useState, useCallback } from "react"
import { Camera, Send, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface AiChatInputProps {
  onSend: (text: string, imageBase64?: string, imageMimeType?: string) => void
  isStreaming: boolean
  onStop: () => void
  disabled?: boolean
}

export function AiChatInput({ onSend, isStreaming, onStop, disabled }: AiChatInputProps) {
  const [text, setText] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /** 處理圖片選擇 */
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const mimeType = file.type || "image/jpeg"
    setImageMimeType(mimeType)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setImagePreview(dataUrl)
      // 去掉 data:xxx;base64, 前綴，只留 base64 字串
      const base64 = dataUrl.split(",")[1]
      setImageBase64(base64)
    }
    reader.readAsDataURL(file)

    // 清除 input 值讓同一張圖可重複上傳
    e.target.value = ""
  }, [])

  /** 移除圖片 */
  const removeImage = useCallback(() => {
    setImagePreview(null)
    setImageBase64(null)
  }, [])

  /** 送出訊息 */
  const handleSend = useCallback(() => {
    if (isStreaming) { onStop(); return }
    if (!text.trim() && !imageBase64) return

    onSend(text.trim(), imageBase64 ?? undefined, imageMimeType)
    setText("")
    setImagePreview(null)
    setImageBase64(null)
    textareaRef.current?.focus()
  }, [isStreaming, onStop, text, imageBase64, imageMimeType, onSend])

  /** Enter 送出，Shift+Enter 換行 */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className="border-t bg-white p-3 space-y-2">
      {/* 圖片預覽 */}
      {imagePreview && (
        <div className="relative inline-block">
          <img
            src={imagePreview}
            alt="preview"
            className="h-20 w-auto rounded-lg object-cover border border-gray-200"
          />
          <button
            onClick={removeImage}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center hover:bg-gray-900"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 輸入列 */}
      <div className="flex items-end gap-2">
        {/* 圖片上傳按鈕 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-9 w-9 text-gray-400 hover:text-gray-600"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isStreaming}
          title="上傳圖片（帳單/單據）"
        >
          <Camera className="w-4.5 h-4.5" />
        </Button>

        {/* 文字輸入 */}
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "AI 回覆中…" : "輸入訊息（Enter 送出，Shift+Enter 換行）"}
          className="flex-1 min-h-[40px] max-h-[120px] resize-none text-sm py-2 px-3"
          disabled={disabled}
          rows={1}
        />

        {/* 送出/停止按鈕 */}
        <Button
          type="button"
          size="icon"
          className={`flex-shrink-0 h-9 w-9 ${
            isStreaming
              ? "bg-red-500 hover:bg-red-600"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
          onClick={handleSend}
          disabled={disabled || (!isStreaming && !text.trim() && !imageBase64)}
          title={isStreaming ? "停止" : "送出"}
        >
          {isStreaming ? (
            <Square className="w-3.5 h-3.5 text-white fill-white" />
          ) : (
            <Send className="w-4 h-4 text-white" />
          )}
        </Button>
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        Enter 送出 · Shift+Enter 換行 · 可上傳圖片辨識帳單
      </p>
    </div>
  )
}
