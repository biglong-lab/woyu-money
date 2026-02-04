import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Info } from "lucide-react";

interface ImportResult {
  success: boolean;
  totalRecords: number;
  imported: number;
  errors: string[];
  summary: string;
}

interface DataImportDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function DataImportDialog({ trigger, onSuccess }: DataImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('excelFile', file);

      const response = await fetch('/api/data/import-excel', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '導入失敗');
      }

      return response.json();
    },
    onSuccess: (result: ImportResult) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/pms/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pms/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data/import-status"] });
      
      if (result.success) {
        toast({
          title: "數據導入成功",
          description: result.summary,
        });
        onSuccess?.();
      } else {
        toast({
          title: "數據導入部分成功",
          description: `${result.summary}，請檢查錯誤詳情`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "導入失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          file.type === "application/vnd.ms-excel" ||
          file.name.endsWith('.xlsx') ||
          file.name.endsWith('.xls')) {
        setSelectedFile(file);
        setImportResult(null);
      } else {
        toast({
          title: "文件格式錯誤",
          description: "請選擇 Excel 文件 (.xlsx 或 .xls)",
          variant: "destructive",
        });
      }
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedFile(null);
    setImportResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            導入歷史數據
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            導入 Excel 業績數據
          </DialogTitle>
          <DialogDescription>
            上傳浯島文旅或浯島輕旅的歷史業績數據，系統將自動解析並用於預測分析
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 文件選擇區域 */}
          <div className="space-y-2">
            <Label htmlFor="excel-file">選擇 Excel 文件</Label>
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              disabled={importMutation.isPending}
            />
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </div>

          {/* 導入說明 */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              系統會自動識別 Excel 中的日期、業績數據等欄位。支援的欄位包括：
              <ul className="mt-2 ml-4 list-disc text-sm">
                <li>日期欄位（日期、Date、時間等）</li>
                <li>業績欄位（營收、業績、收入、Revenue、Amount等）</li>
                <li>專案欄位（專案、項目、文旅、輕旅等）</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* 進度條 */}
          {importMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">正在處理數據...</span>
              </div>
              <Progress value={undefined} className="w-full" />
            </div>
          )}

          {/* 導入結果 */}
          {importResult && (
            <div className="space-y-4">
              <Alert className={importResult.success ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
                {importResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">{importResult.summary}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>總記錄數: {importResult.totalRecords}</div>
                      <div>成功導入: {importResult.imported}</div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">錯誤詳情：</h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {importResult.errors.map((error, index) => (
                      <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 操作按鈕 */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              {importResult ? "關閉" : "取消"}
            </Button>
            {!importResult && (
              <Button
                onClick={handleImport}
                disabled={!selectedFile || importMutation.isPending}
                className="gap-2"
              >
                {importMutation.isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    處理中...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    開始導入
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}