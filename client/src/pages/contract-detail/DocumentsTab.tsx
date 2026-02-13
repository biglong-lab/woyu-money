/** 合約文件 Tab 內容 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, Trash2, FileText } from "lucide-react";
import type { ContractDocument } from "./types";
import type { UseMutationResult } from "@tanstack/react-query";

interface DocumentsTabProps {
  contractId: string;
  documents: ContractDocument[] | undefined;
  isLoading: boolean;
  /** 上傳對話框狀態 */
  isUploadDialogOpen: boolean;
  setIsUploadDialogOpen: (open: boolean) => void;
  uploadFile: File | null;
  setUploadFile: (file: File | null) => void;
  uploadDescription: string;
  setUploadDescription: (desc: string) => void;
  handleFileUpload: () => void;
  uploadPending: boolean;
  deleteMutation: UseMutationResult<unknown, Error, number, unknown>;
}

/** 合約文件管理區域 */
export function DocumentsTab({
  contractId,
  documents,
  isLoading,
  isUploadDialogOpen,
  setIsUploadDialogOpen,
  uploadFile,
  setUploadFile,
  uploadDescription,
  setUploadDescription,
  handleFileUpload,
  uploadPending,
  deleteMutation,
}: DocumentsTabProps) {
  const handleDownload = (documentId: number) => {
    window.open(
      `/api/rental/contracts/${contractId}/documents/${documentId}/download`,
      "_blank"
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>合約文件</CardTitle>
        <UploadDialog
          isOpen={isUploadDialogOpen}
          setIsOpen={setIsUploadDialogOpen}
          setUploadFile={setUploadFile}
          uploadDescription={uploadDescription}
          setUploadDescription={setUploadDescription}
          handleFileUpload={handleFileUpload}
          isPending={uploadPending}
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">載入中...</div>
        ) : Array.isArray(documents) && documents.length > 0 ? (
          <DocumentsTable
            documents={documents}
            onDownload={handleDownload}
            onDelete={(docId) => deleteMutation.mutate(docId)}
            deleteDisabled={deleteMutation.isPending}
          />
        ) : (
          <EmptyDocumentsState />
        )}
      </CardContent>
    </Card>
  );
}

/** 上傳文件對話框 */
function UploadDialog({
  isOpen,
  setIsOpen,
  setUploadFile,
  uploadDescription,
  setUploadDescription,
  handleFileUpload,
  isPending,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setUploadFile: (file: File | null) => void;
  uploadDescription: string;
  setUploadDescription: (desc: string) => void;
  handleFileUpload: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          上傳文件
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>上傳合約文件</DialogTitle>
          <DialogDescription>
            支援 PDF、Word 文件和圖片格式
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="file">選擇文件</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
          </div>
          <div>
            <Label htmlFor="description">文件描述</Label>
            <Input
              id="description"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="例：租約正本、修訂版本..."
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              取消
            </Button>
            <Button onClick={handleFileUpload} disabled={isPending}>
              {isPending ? "上傳中..." : "上傳"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 文件列表表格 */
function DocumentsTable({
  documents,
  onDownload,
  onDelete,
  deleteDisabled,
}: {
  documents: ContractDocument[];
  onDownload: (docId: number) => void;
  onDelete: (docId: number) => void;
  deleteDisabled: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>文件名稱</TableHead>
          <TableHead>描述</TableHead>
          <TableHead>檔案大小</TableHead>
          <TableHead>上傳日期</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell className="font-medium">{doc.originalName}</TableCell>
            <TableCell>{doc.notes || "-"}</TableCell>
            <TableCell>
              {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
            </TableCell>
            <TableCell>
              {new Date(doc.uploadedAt).toLocaleDateString("zh-TW")}
            </TableCell>
            <TableCell>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDownload(doc.id)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(doc.id)}
                  disabled={deleteDisabled}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** 無文件時的空狀態 */
function EmptyDocumentsState() {
  return (
    <div className="text-center py-8 text-gray-500">
      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
      <p>尚未上傳任何文件</p>
    </div>
  );
}
