import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Trash2, FileText, Image, Plus } from "lucide-react";

interface LoanDocumentUploadProps {
  recordId: number;
}

interface FileAttachment {
  id: number;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  mimeType: string;
  createdAt: string;
}

export function LoanDocumentUpload({ recordId }: LoanDocumentUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  // Fetch existing documents for this record
  const { data: documents = [], isLoading } = useQuery<FileAttachment[]>({
    queryKey: [`/api/file-attachments/loan-investment/${recordId}`],
    enabled: !!recordId && recordId > 0,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "loan-investment");
      formData.append("entityId", recordId.toString());
      
      const response = await fetch("/api/file-attachments/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "文件上傳失敗");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/file-attachments/loan-investment/${recordId}`] });
      setIsUploading(false);
      toast({
        title: "成功",
        description: "文件已成功上傳",
      });
    },
    onError: (error: Error) => {
      setIsUploading(false);
      toast({
        title: "錯誤",
        description: error.message || "文件上傳失敗",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const response = await fetch(`/api/file-attachments/${documentId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "文件刪除失敗");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/file-attachments/loan-investment/${recordId}`] });
      toast({
        title: "成功",
        description: "文件已刪除",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "錯誤",
        description: error.message || "文件刪除失敗",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "image/jpeg", "image/png", "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "不支援的文件類型",
        description: "請選擇圖片文件（JPEG、PNG、GIF）或文檔文件（PDF、DOC、DOCX、TXT）",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "文件過大",
        description: "文件大小不能超過 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    uploadMutation.mutate(file);
  };

  const handleDownload = async (document: FileAttachment) => {
    try {
      const response = await fetch(`/api/file-attachments/download/${document.id}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = url;
        a.download = document.originalName;
        window.document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        window.document.body.removeChild(a);
      }
    } catch (error) {
      toast({
        title: "錯誤",
        description: "文件下載失敗",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType && mimeType.startsWith("image/")) {
      return <Image className="h-5 w-5 text-blue-500" />;
    }
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>文件管理</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          文件管理
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
          <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2">上傳文件</p>
          <p className="text-sm text-gray-500 mb-4">
            支援圖片（JPEG、PNG、GIF）和文檔（PDF、DOC、DOCX、TXT）
          </p>
          <Input
            type="file"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.txt"
            disabled={isUploading}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload">
            <Button
              type="button"
              disabled={isUploading}
              className="cursor-pointer"
              asChild
            >
              <span>
                <Plus className="h-4 w-4 mr-2" />
                {isUploading ? "上傳中..." : "選擇文件"}
              </span>
            </Button>
          </label>
        </div>

        {/* Documents List */}
        {documents.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">已上傳文件</h4>
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {getFileIcon(doc.mimeType)}
                  <div>
                    <p className="font-medium">{doc.originalName}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString("zh-TW")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteMutation.mutate(doc.id)}
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