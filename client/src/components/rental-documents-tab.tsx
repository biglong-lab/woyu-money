import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Trash2, Eye, FileText, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ==========================================
// 合約文件 Tab
// ==========================================
interface RentalDocumentsTabProps {
  readonly contracts: any[];
  readonly projects: any[];
  readonly selectedContract: any | null;
  readonly onSelectContract: (contract: any | null) => void;
  readonly documents: any[];
  readonly onDocumentDownload: (document: any) => void;
  readonly onDocumentDelete: (documentId: number) => void;
  readonly isDocumentDialogOpen: boolean;
  readonly onDocumentDialogOpenChange: (open: boolean) => void;
  readonly onUploadDocument: (file: File, version: string, description: string) => void;
  readonly isUploading: boolean;
}

export function RentalDocumentsTab({
  contracts,
  projects,
  selectedContract,
  onSelectContract,
  documents,
  onDocumentDownload,
  onDocumentDelete,
  isDocumentDialogOpen,
  onDocumentDialogOpenChange,
  onUploadDocument,
  isUploading,
}: RentalDocumentsTabProps) {
  const [viewingDocument, setViewingDocument] = useState<any>(null);
  const [isDocumentViewOpen, setIsDocumentViewOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-row items-center justify-between">
            <CardTitle>合約文件管理</CardTitle>
            <Button
              onClick={() => onDocumentDialogOpenChange(true)}
              disabled={!selectedContract}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              上傳文件
            </Button>
          </div>

          {/* 合約選擇器 */}
          <div className="flex items-center gap-4 mt-4">
            <label className="text-sm font-medium">選擇租約:</label>
            <Select
              value={selectedContract?.id?.toString() || ""}
              onValueChange={(value) => {
                const contract = contracts?.find((c: any) => c.id.toString() === value);
                onSelectContract(contract || null);
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="請選擇要管理文件的租約" />
              </SelectTrigger>
              <SelectContent>
                {contracts?.map((contract: any) => {
                  const project = projects?.find((p: any) => p.id === contract.projectId);
                  return (
                    <SelectItem key={contract.id} value={contract.id.toString()}>
                      <div className="flex flex-col">
                        <span className="font-medium">{contract.contractName}</span>
                        <span className="text-xs text-gray-500">專案：{project?.projectName || "未知專案"}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedContract ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">請選擇租約</p>
              <p>從租約列表中選擇一個租約來管理文件</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 選中的合約資訊 */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-blue-900">{selectedContract.contractName}</h3>
                    <p className="text-sm text-blue-700">
                      專案：{projects?.find((p: any) => p.id === selectedContract.projectId)?.projectName || "未知專案"}
                    </p>
                  </div>
                  <div className="text-right text-sm text-blue-600">
                    <p>合約ID: {selectedContract.id}</p>
                  </div>
                </div>
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>此租約尚無上傳文件</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>文件名稱</TableHead>
                      <TableHead>文件類型</TableHead>
                      <TableHead>上傳日期</TableHead>
                      <TableHead>版本</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc: any) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.fileName}</TableCell>
                        <TableCell>{doc.documentType}</TableCell>
                        <TableCell>{new Date(doc.uploadDate).toLocaleDateString('zh-TW')}</TableCell>
                        <TableCell>{doc.version}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setViewingDocument(doc);
                                setIsDocumentViewOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onDocumentDownload(doc)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onDocumentDelete(doc.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 文件上傳對話框 */}
      <DocumentUploadDialog
        isOpen={isDocumentDialogOpen}
        onOpenChange={onDocumentDialogOpenChange}
        onUpload={onUploadDocument}
        isUploading={isUploading}
      />

      {/* 文件查看對話框 */}
      <DocumentViewDialog
        isOpen={isDocumentViewOpen}
        onOpenChange={setIsDocumentViewOpen}
        document={viewingDocument}
        onDownload={onDocumentDownload}
        onDelete={(docId) => {
          setIsDocumentViewOpen(false);
          onDocumentDelete(docId);
        }}
      />
    </>
  );
}

// ==========================================
// 文件上傳對話框
// ==========================================
interface DocumentUploadDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onUpload: (file: File, version: string, description: string) => void;
  readonly isUploading: boolean;
}

function DocumentUploadDialog({
  isOpen,
  onOpenChange,
  onUpload,
  isUploading,
}: DocumentUploadDialogProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadVersion, setUploadVersion] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const { toast } = useToast();

  const handleClose = () => {
    onOpenChange(false);
    setUploadFile(null);
    setUploadVersion("");
    setUploadDescription("");
  };

  const handleUpload = () => {
    if (!uploadFile) {
      toast({
        title: "請選擇文件",
        description: "請先選擇要上傳的文件",
        variant: "destructive",
      });
      return;
    }
    onUpload(uploadFile, uploadVersion, uploadDescription);
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">上傳合約文件</DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            支援 PDF、Word 文件和圖片格式 (最大 20MB)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="file-upload">選擇文件</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 20 * 1024 * 1024) {
                    toast({
                      title: "文件過大",
                      description: "文件大小不能超過 20MB",
                      variant: "destructive",
                    });
                    return;
                  }
                  setUploadFile(file);
                }
              }}
            />
            {uploadFile && (
              <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                已選擇：{uploadFile.name}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="version-label">版本標籤</Label>
            <Input
              id="version-label"
              value={uploadVersion}
              onChange={(e) => setUploadVersion(e.target.value)}
              placeholder="例如：v1.0、修訂版、最終版"
            />
          </div>

          <div>
            <Label htmlFor="description">備註說明</Label>
            <Textarea
              id="description"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="文件說明或備註..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || isUploading}
            >
              {isUploading ? "上傳中..." : "上傳"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 文件查看對話框
// ==========================================
interface DocumentViewDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly document: any | null;
  readonly onDownload: (document: any) => void;
  readonly onDelete: (documentId: number) => void;
}

function DocumentViewDialog({
  isOpen,
  onOpenChange,
  document: doc,
  onDownload,
  onDelete,
}: DocumentViewDialogProps) {
  if (!doc) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>文件詳細資訊</DialogTitle>
          <DialogDescription>
            查看合約文件的詳細資訊和版本記錄
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 文件基本資訊 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                文件資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">文件名稱</Label>
                  <p className="text-base font-medium">{doc.fileName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">文件類型</Label>
                  <Badge variant="outline">{doc.documentType}</Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">版本</Label>
                  <p className="text-base">{doc.version || 'v1.0'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">上傳日期</Label>
                  <p className="text-base">{new Date(doc.uploadDate).toLocaleDateString('zh-TW')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">文件大小</Label>
                  <p className="text-base">{doc.fileSize || '未知'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">上傳者</Label>
                  <p className="text-base">{doc.uploadedBy || '系統'}</p>
                </div>
              </div>

              {doc.description && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">文件描述</Label>
                  <p className="text-base mt-1 p-3 bg-gray-50 rounded-lg">{doc.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 文件操作 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                文件操作
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => onDownload(doc)}
                >
                  <Download className="w-4 h-4" />
                  下載文件
                </Button>

                {doc.fileName?.toLowerCase().endsWith('.pdf') && (
                  <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={() => {
                      window.open(`/api/rental/documents/${doc.id}/preview`, '_blank');
                    }}
                  >
                    <Eye className="w-4 h-4" />
                    在線預覽
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="flex items-center gap-2 text-red-600 hover:text-red-700"
                  onClick={() => onDelete(doc.id)}
                >
                  <Trash2 className="w-4 h-4" />
                  刪除文件
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 版本歷史記錄 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                版本歷史
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <p className="font-medium text-blue-900">當前版本 {doc.version || 'v1.0'}</p>
                    <p className="text-sm text-blue-700">
                      上傳於 {new Date(doc.uploadDate).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">最新</Badge>
                </div>

                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">版本歷史功能將在後續版本中提供</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
