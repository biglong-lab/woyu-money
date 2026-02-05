// 單據文件列表
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Image as ImageIcon, Sparkles, RefreshCw, StickyNote, User
} from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import type { DocumentInbox } from "@shared/schema";
import { getStatusConfig, getTypeConfig } from "@/components/document-inbox-types";

export interface DocumentInboxDocumentListProps {
  documents: DocumentInbox[];
  isLoading: boolean;
  onSelectDocument: (doc: DocumentInbox) => void;
  onReRecognize: (id: number) => void;
}

// 產生狀態 Badge
function StatusBadge({ status }: { status: string | null }) {
  const config = getStatusConfig(status);
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}

// 產生文件類型 Badge
function TypeBadge({ type }: { type: string }) {
  const config = getTypeConfig(type);
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
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
    );
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
    );
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
              alt={doc.originalFilename || '單據圖片'}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-document.svg';
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
                <Badge variant="secondary" className="flex items-center gap-1 bg-amber-500 text-white border border-amber-600 shadow-sm">
                  <Sparkles className="h-3 w-3 text-white" />
                  {Math.round(parseFloat(doc.aiConfidence) * 100)}% 信心度
                </Badge>
              </div>
            )}
          </div>

          {/* 內容 */}
          <CardContent className="p-4 space-y-2">
            {doc.status === 'recognized' && (
              <>
                <div className="font-medium truncate">
                  {doc.recognizedVendor || doc.recognizedDescription || '待確認'}
                </div>
                {doc.recognizedAmount && (
                  <div className="text-lg font-bold text-primary">
                    ${parseFloat(doc.recognizedAmount).toLocaleString()}
                  </div>
                )}
                {doc.recognizedDate && (
                  <div className="text-sm text-gray-500">
                    {doc.recognizedDate}
                  </div>
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

            {doc.status === 'processing' && (
              <div className="flex items-center gap-2 text-amber-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI 正在辨識中...</span>
              </div>
            )}

            {doc.status === 'failed' && (
              <div className="flex items-center justify-between">
                <span className="text-red-500 text-sm">辨識失敗</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReRecognize(doc.id);
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  重試
                </Button>
              </div>
            )}

            <div className="text-xs text-gray-400 space-y-0.5">
              <div>{format(new Date(doc.createdAt), 'MM/dd HH:mm', { locale: zhTW })}</div>
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
  );
}
