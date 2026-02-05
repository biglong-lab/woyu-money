// 單據預覽 Dialog
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Sparkles, Loader2, AlertCircle, RefreshCw, Trash2, Archive, ArrowRight,
  CheckCircle2, StickyNote, Clock, User
} from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import type { DocumentInbox } from "@shared/schema";
import { getStatusConfig, getTypeConfig } from "@/components/document-inbox-types";

export interface DocumentInboxPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentInbox | null;
  onDelete: (id: number) => void;
  onReRecognize: (id: number) => void;
  reRecognizePending: boolean;
  onArchive: () => void;
  onUpdateNotes: (id: number, notes: string) => void;
  updateNotesPending: boolean;
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

export default function DocumentInboxPreviewDialog({
  open,
  onOpenChange,
  document: selectedDoc,
  onDelete,
  onReRecognize,
  reRecognizePending,
  onArchive,
  onUpdateNotes,
  updateNotesPending,
}: DocumentInboxPreviewDialogProps) {
  const [editingNotes, setEditingNotes] = useState('');

  // 當 document 變更時同步 notes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && selectedDoc) {
      setEditingNotes(selectedDoc.notes || '');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {selectedDoc && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TypeBadge type={selectedDoc.documentType} />
                <StatusBadge status={selectedDoc.status} />
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 圖片 */}
              <div className="space-y-4">
                <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={selectedDoc.imagePath}
                    alt="單據圖片"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-document.svg';
                    }}
                  />
                </div>
                <div className="text-sm text-gray-500">
                  {selectedDoc.originalFilename}
                </div>
              </div>

              {/* AI 辨識結果 */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  AI 辨識結果
                </h3>

                {selectedDoc.status === 'recognized' ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-gray-500">廠商/來源</Label>
                      <p className="font-medium">{selectedDoc.recognizedVendor || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">金額</Label>
                      <p className="text-xl font-bold text-primary">
                        {selectedDoc.recognizedAmount
                          ? `$${parseFloat(selectedDoc.recognizedAmount).toLocaleString()}`
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-500">日期</Label>
                      <p className="font-medium">{selectedDoc.recognizedDate || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">說明</Label>
                      <p className="font-medium">{selectedDoc.recognizedDescription || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-gray-500">分類</Label>
                      <p className="font-medium">{selectedDoc.recognizedCategory || '-'}</p>
                    </div>
                    {selectedDoc.recognizedInvoiceNumber && (
                      <div>
                        <Label className="text-gray-500">發票號碼</Label>
                        <p className="font-medium">{selectedDoc.recognizedInvoiceNumber}</p>
                      </div>
                    )}
                    {selectedDoc.aiConfidence && (
                      <div>
                        <Label className="text-gray-500">辨識信心度</Label>
                        <p className="font-medium">{Math.round(parseFloat(selectedDoc.aiConfidence) * 100)}%</p>
                      </div>
                    )}
                  </div>
                ) : selectedDoc.status === 'processing' ? (
                  <div className="flex flex-col items-center py-8">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="text-gray-500">AI 正在分析中，請稍候...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8">
                    <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                    <p className="text-gray-500">辨識失敗，請重試或手動輸入</p>
                    <Button
                      className="mt-4"
                      onClick={() => onReRecognize(selectedDoc.id)}
                      disabled={reRecognizePending}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${reRecognizePending ? 'animate-spin' : ''}`} />
                      重新辨識
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* 追蹤資訊 */}
            <div className="space-y-2 border-t pt-4">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                追蹤資訊
              </Label>
              <div className="text-sm text-gray-600 bg-gray-50 rounded p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>上傳時間：{format(new Date(selectedDoc.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  <span>上傳帳號：{selectedDoc.uploadedByUsername || '未知用戶'}</span>
                </div>
                {selectedDoc.editedAt && selectedDoc.editedByUsername && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <User className="h-3 w-3" />
                    <span>編輯帳號：{selectedDoc.editedByUsername}（{format(new Date(selectedDoc.editedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}）</span>
                  </div>
                )}
              </div>
            </div>

            {/* 可編輯備註 */}
            <div className="space-y-2 border-t pt-4">
              <Label className="flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-blue-500" />
                備註
              </Label>
              <Textarea
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="輸入備註（例如：轉帳給誰、用途說明...）"
                rows={2}
                className="text-sm"
                data-testid="input-preview-notes"
              />
              {editingNotes !== (selectedDoc.notes || '') && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingNotes(selectedDoc.notes || '')}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onUpdateNotes(selectedDoc.id, editingNotes)}
                    disabled={updateNotesPending}
                    data-testid="btn-save-notes"
                  >
                    {updateNotesPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    )}
                    儲存備註
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => onDelete(selectedDoc.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                刪除
              </Button>

              {selectedDoc.status === 'recognized' && (
                <Button
                  onClick={onArchive}
                  className="flex items-center gap-2"
                >
                  <Archive className="h-4 w-4" />
                  歸檔整理
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
