// 單據上傳區塊
import { useRef, useCallback, useState } from "react";
import { Camera, Upload, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_TYPES } from "@/components/document-inbox-types";

export interface DocumentInboxUploadSectionProps {
  selectedType: 'bill' | 'payment' | 'invoice';
  onSelectedTypeChange: (type: 'bill' | 'payment' | 'invoice') => void;
  onUpload: (files: FileList, notes: string) => Promise<void>;
  isUploading: boolean;
}

export default function DocumentInboxUploadSection({
  selectedType,
  onSelectedTypeChange,
  onUpload,
  isUploading,
}: DocumentInboxUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploadNotes, setUploadNotes] = useState('');

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    await onUpload(files, uploadNotes.trim());
    setUploadNotes('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, [onUpload, uploadNotes]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <Card className="border-2 border-dashed border-gray-300 hover:border-primary transition-colors">
      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-4">
          {/* 文件類型選擇 */}
          <div className="flex gap-2 flex-wrap justify-center">
            {DOCUMENT_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <Button
                  key={type.value}
                  variant={selectedType === type.value ? "default" : "outline"}
                  onClick={() => onSelectedTypeChange(type.value as "bill" | "payment" | "invoice")}
                  className="flex items-center gap-2"
                  data-testid={`select-type-${type.value}`}
                >
                  <Icon className="h-4 w-4" />
                  {type.label}
                </Button>
              );
            })}
          </div>

          <p className="text-sm text-gray-500">
            {DOCUMENT_TYPES.find(t => t.value === selectedType)?.description}
          </p>

          {/* 備註輸入 */}
          <div className="w-full max-w-md">
            <Textarea
              placeholder="輸入備註（選填）- 例如：轉帳給誰、用途說明..."
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              className="text-sm"
              rows={2}
              data-testid="input-upload-notes"
            />
          </div>

          {/* 拖放上傳區 */}
          <div
            className="w-full max-w-md p-8 rounded-lg bg-gray-50 text-center cursor-pointer hover:bg-gray-100 transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-dropzone"
          >
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-2" />
                <p>上傳中...</p>
              </div>
            ) : (
              <>
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 font-medium">拖曳檔案到這裡，或點擊選擇</p>
                <p className="text-sm text-gray-400 mt-1">支援 JPEG, PNG, GIF, WebP（可一次選擇多張）</p>
              </>
            )}
          </div>

          {/* 操作按鈕 */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2"
              data-testid="btn-camera"
            >
              <Camera className="h-5 w-5" />
              拍照上傳
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2"
              data-testid="btn-upload"
            >
              <Upload className="h-5 w-5" />
              選擇檔案
            </Button>
          </div>

          {/* 隱藏的 file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
