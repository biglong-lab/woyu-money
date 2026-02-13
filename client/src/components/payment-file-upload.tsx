import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, FileImage, File, Download, Eye } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PaymentFileUploadProps {
  paymentId: number;
  onUploadComplete?: () => void;
}

interface FileAttachment {
  id: number;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
  entityType: string;
  entityId: number;
  uploadedBy: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export function PaymentFileUpload({ paymentId, onUploadComplete }: PaymentFileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadNotes, setUploadNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 獲取現有檔案
  const { data: attachments = [], isLoading } = useQuery<FileAttachment[]>({
    queryKey: [`/api/payment/${paymentId}/files`],
  });

  // 上傳檔案
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/payment/${paymentId}/files`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const text = (await response.text()) || response.statusText;
        throw new Error(`${response.status}: ${text}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "檔案上傳成功",
        description: "匯款截圖已成功上傳",
      });
      setSelectedFiles([]);
      setUploadNotes("");
      setUploadProgress({});
      queryClient.invalidateQueries({ queryKey: [`/api/payment/${paymentId}/files`] });
      onUploadComplete?.();
    },
    onError: (error: Error) => {
      toast({
        title: "上傳失敗",
        description: error.message || "檔案上傳時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // 刪除檔案
  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: number) => {
      return apiRequest("DELETE", `/api/files/${attachmentId}`);
    },
    onSuccess: () => {
      toast({
        title: "檔案已刪除",
        description: "檔案已成功從系統中移除",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/payment/${paymentId}/files`] });
    },
    onError: (error: Error) => {
      toast({
        title: "刪除失敗",
        description: error.message || "刪除檔案時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast({
          title: "檔案過大",
          description: `${file.name} 超過 10MB 限制`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "請選擇檔案",
        description: "請先選擇要上傳的匯款截圖",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file, index) => {
      formData.append(`files`, file);
    });
    
    if (uploadNotes) {
      formData.append('notes', uploadNotes);
    }

    uploadMutation.mutate(formData);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <FileImage className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  const openFile = (filePath: string, fileName: string) => {
    // 使用檔案路徑創建下載URL
    const fileUrl = `/uploads/${fileName}`;
    window.open(fileUrl, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* 檔案上傳區域 */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">上傳匯款截圖</Label>
              <div className="mt-2">
                <Input
                  id="file-upload"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 border-dashed"
                >
                  <div className="text-center">
                    <Upload className="h-6 w-6 mx-auto mb-2" />
                    <div className="text-sm">點擊選擇檔案或拖放到此處</div>
                    <div className="text-xs text-muted-foreground">
                      支援圖片、PDF 格式，最大 10MB
                    </div>
                  </div>
                </Button>
              </div>
            </div>

            {/* 選中的檔案列表 */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <Label>待上傳檔案</Label>
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded">
                    {getFileIcon(file.type)}
                    <div className="flex-1">
                      <div className="text-sm font-medium">{file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* 上傳備註 */}
            <div>
              <Label htmlFor="upload-notes">檔案備註</Label>
              <Input
                id="upload-notes"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="例：轉帳截圖、收據掃描..."
              />
            </div>

            {/* 上傳按鈕 */}
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploadMutation.isPending}
              className="w-full"
            >
              {uploadMutation.isPending ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  上傳中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  上傳檔案
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 已上傳檔案列表 */}
      {attachments.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <Label className="text-base font-medium">已上傳檔案</Label>
            <div className="mt-3 space-y-3">
              {attachments.map((attachment: FileAttachment) => (
                <div key={attachment.id} className="flex items-center gap-3 p-3 border rounded">
                  {getFileIcon(attachment.mimeType)}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{attachment.originalName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.fileSize)} • 
                      上傳於 {new Date(attachment.createdAt).toLocaleDateString('zh-TW')}
                    </div>
                    {attachment.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        備註：{attachment.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {attachment.mimeType.startsWith('image/') ? '圖片' : '文件'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openFile(attachment.filePath, attachment.fileName)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(attachment.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="text-center text-sm text-muted-foreground">
          載入檔案列表中...
        </div>
      )}
    </div>
  );
}