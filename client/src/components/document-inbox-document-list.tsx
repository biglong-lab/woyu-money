// 單據文件列表
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  StickyNote,
  User,
  AlertTriangle,
} from "lucide-react"
import { format } from "date-fns"
import { formatNT } from "@/lib/utils"
import { zhTW } from "date-fns/locale"
import type { DocumentInbox } from "@shared/schema"
import { getStatusConfig, getTypeConfig } from "@/components/document-inbox-types"

/**
 * AI 辨識進度指示器
 * - 顯示已等候時間（秒）
 * - 超過 30s 變色提醒
 * - 超過 60s 顯示重試按鈕
 */
function ProcessingIndicator({
  createdAt,
  onRetry,
}: {
  createdAt: Date | string | null
  onRetry: (e: React.MouseEvent) => void
}) {
  const [elapsedSec, setElapsedSec] = useState(0)

  useEffect(() => {
    if (!createdAt) return
    const startMs = new Date(createdAt).getTime()
    const tick = () => setElapsedSec(Math.floor((Date.now() - startMs) / 1000))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [createdAt])

  const isStuck = elapsedSec > 60
  const isSlow = elapsedSec > 30
  const colorClass = isStuck
    ? "text-red-600 bg-red-50 border-red-200"
    : isSlow
      ? "text-orange-600 bg-orange-50 border-orange-200"
      : "text-amber-600 bg-amber-50 border-amber-200"

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border ${colorClass}`}>
      {isStuck ? (
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{isStuck ? "辨識超時，建議重試" : "AI 辨識中..."}</div>
        <div className="text-xs opacity-80">
          已等候 {elapsedSec} 秒{isSlow && !isStuck && "（正常範圍）"}
        </div>
      </div>
      {isStuck && (
        <Button size="sm" onClick={onRetry} className="h-9 px-3 flex-shrink-0">
          <RefreshCw className="h-4 w-4 mr-1" />
          重試
        </Button>
      )}
    </div>
  )
}

export interface DocumentInboxDocumentListProps {
  documents: DocumentInbox[]
  isLoading: boolean
  onSelectDocument: (doc: DocumentInbox) => void
  onReRecognize: (id: number) => void
}

// 產生狀態 Badge
function StatusBadge({ status }: { status: string | null }) {
  const config = getStatusConfig(status)
  const Icon = config.icon
  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  )
}

// 產生文件類型 Badge
function TypeBadge({ type }: { type: string }) {
  const config = getTypeConfig(type)
  const Icon = config.icon
  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

export default function DocumentInboxDocumentList({
  documents,
  isLoading,
  onSelectDocument,
  onReRecognize,
}: DocumentInboxDocumentListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>沒有待處理的單據</p>
          <p className="text-sm mt-1">上傳單據開始使用 AI 辨識功能</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {documents.map((doc) => (
        <Card
          key={doc.id}
          className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => onSelectDocument(doc)}
          data-testid={`doc-card-${doc.id}`}
        >
          {/* 圖片預覽 */}
          <div className="aspect-[4/3] bg-gray-100 relative">
            <img
              src={doc.imagePath}
              alt={doc.originalFilename || "單據圖片"}
              className="w-full h-full object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = "/placeholder-document.svg"
              }}
            />
            <div className="absolute top-2 left-2 flex gap-1">
              <TypeBadge type={doc.documentType} />
            </div>
            <div className="absolute top-2 right-2">
              <StatusBadge status={doc.status} />
            </div>
            {doc.aiRecognized && doc.aiConfidence && (
              <div className="absolute bottom-2 right-2">
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 bg-amber-500 text-white border border-amber-600 shadow-sm"
                >
                  <Sparkles className="h-3 w-3 text-white" />
                  {Math.round(parseFloat(doc.aiConfidence) * 100)}% 信心度
                </Badge>
              </div>
            )}
          </div>

          {/* 內容 */}
          <CardContent className="p-4 space-y-2">
            {doc.status === "recognized" && (
              <>
                <div className="font-medium truncate">
                  {doc.recognizedVendor || doc.recognizedDescription || "待確認"}
                </div>
                {doc.recognizedAmount && (
                  <div className="text-lg font-bold text-primary">
                    {formatNT(parseFloat(doc.recognizedAmount))}
                  </div>
                )}
                {doc.recognizedDate && (
                  <div className="text-sm text-gray-500">{doc.recognizedDate}</div>
                )}
                {doc.recognizedCategory && (
                  <Badge variant="outline" className="text-xs">
                    {doc.recognizedCategory}
                  </Badge>
                )}
                {doc.notes && (
                  <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded truncate">
                    <StickyNote className="h-3 w-3 inline mr-1" />
                    {doc.notes}
                  </div>
                )}
              </>
            )}

            {doc.status === "processing" && (
              <ProcessingIndicator
                createdAt={doc.createdAt}
                onRetry={(e) => {
                  e.stopPropagation()
                  onReRecognize(doc.id)
                }}
              />
            )}

            {doc.status === "failed" && (
              <div className="flex items-center justify-between gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 text-sm">
                  <span>⚠️</span>
                  <span className="font-medium">辨識失敗</span>
                </div>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onReRecognize(doc.id)
                  }}
                  className="h-9 px-3"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  重試辨識
                </Button>
              </div>
            )}

            <div className="text-xs text-gray-400 space-y-0.5">
              <div>{format(new Date(doc.createdAt), "MM/dd HH:mm", { locale: zhTW })}</div>
              {doc.uploadedByUsername && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{doc.uploadedByUsername}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
