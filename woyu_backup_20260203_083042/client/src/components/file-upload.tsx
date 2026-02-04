import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Upload, 
  File, 
  Image, 
  Download, 
  Trash2, 
  FileText,
  FileImage,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import type { FileAttachment } from "@shared/schema";

interface FileUploadProps {
  entityType: string;
  entityId: number;
  allowedTypes?: string[];
  maxFileSize?: number;
  title?: string;
}

export function FileUpload({ 
  entityType, 
  entityId, 
  allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  title = "文件管理"
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing attachments
  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['/api/file-attachments', entityType, entityId],
    queryFn: async () => {
      const response = await fetch(`/api/file-attachments/${entityType}/${entityId}`);
      if (!response.ok) throw new Error('Failed to fetch attachments');
      return response.json() as Promise<FileAttachment[]>;
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/file-attachments/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/file-attachments', entityType, entityId] });
      setSelectedFile(null);
      setDescription("");
      setUploadDialogOpen(false);
      toast({
        title: "上傳成功",
        description: "文件已成功上傳",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "上傳失敗",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUploading(false);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/file-attachments/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete file');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/file-attachments', entityType, entityId] });
      toast({
        title: "刪除成功",
        description: "文件已成功刪除",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "刪除失敗",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "不支援的文件類型",
        description: "請選擇圖片文件（JPEG、PNG、GIF）或文檔文件（PDF、DOC、DOCX、TXT）",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    if (file.size > maxFileSize) {
      toast({
        title: "文件過大",
        description: `文件大小不能超過 ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId.toString());
    formData.append('description', description);

    uploadMutation.mutate(formData);
  };

  const handleDownload = async (attachment: FileAttachment) => {
    try {
      const response = await fetch(`/api/file-attachments/download/${attachment.id}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "下載失敗",
        description: "無法下載文件，請稍後重試",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <FileImage className="h-5 w-5 text-blue-500" />;
    } else if (mimeType === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-500" />;
    } else {
      return <File className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImageFile = (mimeType: string) => mimeType.startsWith('image/');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {title}
          </span>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Upload className="h-4 w-4 mr-2" />
                上傳文件
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>上傳新文件</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file-upload">選擇文件</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept={allowedTypes.join(',')}
                    className="mt-1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    支援格式: 圖片 (JPEG, PNG, GIF), 文檔 (PDF, DOC, DOCX, TXT)
                    <br />
                    最大文件大小: {(maxFileSize / 1024 / 1024).toFixed(1)}MB
                  </p>
                </div>

                {selectedFile && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {getFileIcon(selectedFile.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="description">說明 (可選)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="為這個文件添加說明..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || isUploading}
                    className="flex-1"
                  >
                    {isUploading ? "上傳中..." : "確認上傳"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null);
                      setDescription("");
                      setUploadDialogOpen(false);
                    }}
                  >
                    取消
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>尚未上傳任何文件</p>
            <p className="text-sm">點擊上方按鈕開始上傳</p>
          </div>
        ) : (
          <div className="space-y-3">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                {getFileIcon(attachment.mimeType)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{attachment.originalName}</p>
                  {attachment.description && (
                    <p className="text-sm text-gray-600 truncate">{attachment.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                    <span>{formatFileSize(attachment.fileSize)}</span>
                    <span>{attachment.fileType === 'image' ? '圖片' : '文檔'}</span>
                    <span>{attachment.createdAt ? new Date(attachment.createdAt).toLocaleDateString('zh-TW') : ''}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(attachment)}
                    title="下載文件"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(attachment.id)}
                    disabled={deleteMutation.isPending}
                    title="刪除文件"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Specialized component for loan investment records
export function LoanDocumentUpload({ recordId }: { recordId: number }) {
  return (
    <FileUpload
      entityType="loan_investment"
      entityId={recordId}
      title="借貸投資文件"
      allowedTypes={[
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ]}
    />
  );
}

// Specialized component for payment records
export function PaymentReceiptUpload({ recordId }: { recordId: number }) {
  return (
    <FileUpload
      entityType="payment_record"
      entityId={recordId}
      title="付款憑證"
      allowedTypes={['image/jpeg', 'image/png', 'image/gif', 'application/pdf']}
    />
  );
}