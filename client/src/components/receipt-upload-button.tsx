/**
 * 收據上傳按鈕（可複用元件）
 *
 * 支援：
 * - 從相機拍照（手機）
 * - 從相簿選圖
 * - 預覽 + 移除
 * - 大小限制 10MB
 * - 成功後回傳 URL（透過 onChange callback）
 *
 * 用法：
 * ```tsx
 * const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
 * <ReceiptUploadButton onChange={setReceiptUrl} />
 * ```
 *
 * 提交付款時把 receiptUrl 加到 body 中（receiptImageUrl 欄位）。
 */

import { useState, useRef } from "react"
import { Camera, X, Upload, Image as ImageIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface ReceiptUploadButtonProps {
  /** 上傳成功後的 URL；上傳前 / 移除後為 null */
  value?: string | null
  /** URL 變化通知 */
  onChange: (url: string | null) => void
  /** 額外 className */
  className?: string
  /** 大小限制（MB），預設 10 */
  maxSizeMB?: number
  /** 是否顯示為小型按鈕（用於緊湊 UI） */
  compact?: boolean
}

const MAX_DEFAULT_MB = 10

export function ReceiptUploadButton({
  value,
  onChange,
  className,
  maxSizeMB = MAX_DEFAULT_MB,
  compact = false,
}: ReceiptUploadButtonProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // 點擊上傳按鈕 → 開啟相機/相簿選擇
  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 大小檢查
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({
        title: "檔案過大",
        description: `請選小於 ${maxSizeMB}MB 的檔案`,
        variant: "destructive",
      })
      return
    }

    // 預覽
    const reader = new FileReader()
    reader.onloadend = () => setPreviewUrl(reader.result as string)
    reader.readAsDataURL(file)

    // 上傳
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.message ?? `上傳失敗 (${res.status})`)
      }
      const data = (await res.json()) as { url: string }
      onChange(data.url)
      toast({ title: "已上傳" })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "上傳失敗"
      toast({ title: "上傳失敗", description: msg, variant: "destructive" })
      setPreviewUrl(null)
      onChange(null)
    } finally {
      setUploading(false)
      // 清空 input value，讓使用者可再次選同一張
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleRemove = () => {
    setPreviewUrl(null)
    onChange(null)
  }

  // 已有值（預覽 or 已上傳的 URL）
  const displayUrl = previewUrl ?? value

  if (displayUrl) {
    return (
      <div className={cn("relative inline-block", className)}>
        <img
          src={displayUrl}
          alt="收據預覽"
          className={cn("rounded-lg border object-cover", compact ? "w-12 h-12" : "w-20 h-20")}
        />
        {uploading ? (
          <div className="absolute inset-0 bg-white/70 rounded-lg flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        ) : (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow"
            title="移除"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        onClick={handleClick}
        disabled={uploading}
        className={cn(className)}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Camera className="h-4 w-4 mr-1" />
        )}
        {uploading ? "上傳中..." : compact ? "拍照" : "📷 拍照/選圖"}
      </Button>
    </>
  )
}

/** 簡化版：只回傳檔案、不上傳（給需要在 submit 時統一處理的場景） */
interface ReceiptFilePickerProps {
  value?: File | null
  onChange: (file: File | null) => void
  className?: string
  maxSizeMB?: number
}

export function ReceiptFilePicker({
  value,
  onChange,
  className,
  maxSizeMB = MAX_DEFAULT_MB,
}: ReceiptFilePickerProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleClick = () => fileInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({
        title: "檔案過大",
        description: `請選小於 ${maxSizeMB}MB 的檔案`,
        variant: "destructive",
      })
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => setPreviewUrl(reader.result as string)
    reader.readAsDataURL(file)
    onChange(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleRemove = () => {
    setPreviewUrl(null)
    onChange(null)
  }

  if (previewUrl || value) {
    return (
      <div className={cn("relative inline-block", className)}>
        <img
          src={previewUrl ?? "#"}
          alt="收據預覽"
          className="w-20 h-20 rounded-lg border object-cover"
        />
        <button
          type="button"
          onClick={handleRemove}
          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow"
          title="移除"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button type="button" variant="outline" onClick={handleClick} className={className}>
        <Camera className="h-4 w-4 mr-1" />
        📷 拍照/選圖
      </Button>
    </>
  )
}
