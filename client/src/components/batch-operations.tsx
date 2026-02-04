import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Upload, Download, Trash2, Edit, CheckCircle, 
  AlertTriangle, FileSpreadsheet, Users 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BatchOperationsProps {
  selectedItems: string[];
  onSelectionChange: (items: string[]) => void;
  onBatchUpdate: (action: string, data: any) => Promise<void>;
  onBulkImport: (file: File) => Promise<void>;
  onExport: (format: string) => void;
  totalItems: number;
}

interface ImportProgress {
  total: number;
  processed: number;
  errors: string[];
  warnings: string[];
}

export function BatchOperations({ 
  selectedItems, 
  onSelectionChange, 
  onBatchUpdate, 
  onBulkImport,
  onExport,
  totalItems 
}: BatchOperationsProps) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBatchUpdateOpen, setIsBatchUpdateOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [batchAction, setBatchAction] = useState('');
  const [batchData, setBatchData] = useState<any>({});
  const { toast } = useToast();

  // 檔案匯入處理
  const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "檔案格式錯誤",
        description: "請選擇 Excel (.xlsx, .xls) 或 CSV 檔案",
        variant: "destructive"
      });
      return;
    }

    try {
      setImportProgress({ total: 0, processed: 0, errors: [], warnings: [] });
      await onBulkImport(file);
      
      toast({
        title: "匯入成功",
        description: "檔案已成功匯入系統"
      });
      setIsImportOpen(false);
    } catch (error) {
      toast({
        title: "匯入失敗",
        description: error instanceof Error ? error.message : "匯入過程中發生錯誤",
        variant: "destructive"
      });
    } finally {
      setImportProgress(null);
    }
  }, [onBulkImport, toast]);

  // 批量更新處理
  const handleBatchUpdate = useCallback(async () => {
    if (!batchAction || selectedItems.length === 0) return;

    try {
      await onBatchUpdate(batchAction, batchData);
      
      toast({
        title: "批量更新成功",
        description: `已更新 ${selectedItems.length} 個項目`
      });
      
      setIsBatchUpdateOpen(false);
      setBatchAction('');
      setBatchData({});
      onSelectionChange([]);
    } catch (error) {
      toast({
        title: "批量更新失敗",
        description: error instanceof Error ? error.message : "更新過程中發生錯誤",
        variant: "destructive"
      });
    }
  }, [batchAction, batchData, selectedItems, onBatchUpdate, toast, onSelectionChange]);

  // 批量操作選項
  const batchActions = [
    { value: 'updateStatus', label: '更新狀態', icon: CheckCircle },
    { value: 'updatePriority', label: '更新優先級', icon: AlertTriangle },
    { value: 'updateCategory', label: '更新分類', icon: Edit },
    { value: 'archive', label: '歸檔項目', icon: Trash2 },
    { value: 'delete', label: '刪除項目', icon: Trash2, dangerous: true }
  ];

  // 渲染批量更新表單
  const renderBatchUpdateForm = () => {
    switch (batchAction) {
      case 'updateStatus':
        return (
          <div className="space-y-4">
            <div>
              <Label>新狀態</Label>
              <Select 
                value={batchData.status || ''} 
                onValueChange={(value) => setBatchData({ ...batchData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待付款</SelectItem>
                  <SelectItem value="paid">已付款</SelectItem>
                  <SelectItem value="overdue">逾期</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      
      case 'updatePriority':
        return (
          <div className="space-y-4">
            <div>
              <Label>優先級</Label>
              <Select 
                value={batchData.priority?.toString() || ''} 
                onValueChange={(value) => setBatchData({ ...batchData, priority: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇優先級" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">低優先級</SelectItem>
                  <SelectItem value="2">中優先級</SelectItem>
                  <SelectItem value="3">高優先級</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      
      case 'updateCategory':
        return (
          <div className="space-y-4">
            <div>
              <Label>新分類</Label>
              <Select 
                value={batchData.categoryId?.toString() || ''} 
                onValueChange={(value) => setBatchData({ ...batchData, categoryId: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇分類" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">租金</SelectItem>
                  <SelectItem value="2">水電費</SelectItem>
                  <SelectItem value="3">維護費</SelectItem>
                  <SelectItem value="4">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="space-y-4">
            <div>
              <Label>備註</Label>
              <Textarea
                value={batchData.notes || ''}
                onChange={(e) => setBatchData({ ...batchData, notes: e.target.value })}
                placeholder="輸入操作備註..."
                rows={3}
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* 選擇統計 */}
      {selectedItems.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedItems.length === totalItems}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      // 選擇全部的邏輯需要從父組件傳入
                    } else {
                      onSelectionChange([]);
                    }
                  }}
                />
                <span className="text-sm font-medium">
                  已選擇 {selectedItems.length} / {totalItems} 個項目
                </span>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectionChange([])}
                >
                  清除選擇
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 批量操作工具列 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            批量操作
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 檔案匯入 */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  匯入檔案
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>批量匯入付款項目</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>選擇檔案</Label>
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileImport}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      支援 Excel (.xlsx, .xls) 和 CSV 格式
                    </p>
                  </div>
                  
                  {importProgress && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>匯入進度</span>
                        <span>{importProgress.processed} / {importProgress.total}</span>
                      </div>
                      <Progress 
                        value={importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0} 
                      />
                      
                      {importProgress.errors.length > 0 && (
                        <div className="text-sm text-red-600">
                          <p className="font-medium">錯誤：</p>
                          <ul className="list-disc list-inside">
                            {importProgress.errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* 資料匯出 */}
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => onExport('excel')}
            >
              <Download className="h-4 w-4" />
              匯出 Excel
            </Button>

            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={() => onExport('csv')}
            >
              <FileSpreadsheet className="h-4 w-4" />
              匯出 CSV
            </Button>

            {/* 批量更新 */}
            <Dialog open={isBatchUpdateOpen} onOpenChange={setIsBatchUpdateOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2"
                  disabled={selectedItems.length === 0}
                >
                  <Edit className="h-4 w-4" />
                  批量編輯
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>批量編輯項目</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                    <Badge variant="secondary">{selectedItems.length}</Badge>
                    <span className="text-sm">個項目將被更新</span>
                  </div>
                  
                  <div>
                    <Label>操作類型</Label>
                    <Select value={batchAction} onValueChange={setBatchAction}>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇操作類型" />
                      </SelectTrigger>
                      <SelectContent>
                        {batchActions.map((action) => (
                          <SelectItem 
                            key={action.value} 
                            value={action.value}
                            className={action.dangerous ? 'text-red-600' : ''}
                          >
                            <div className="flex items-center gap-2">
                              <action.icon className="h-4 w-4" />
                              {action.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {batchAction && renderBatchUpdateForm()}
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsBatchUpdateOpen(false)}>
                      取消
                    </Button>
                    <Button 
                      onClick={handleBatchUpdate}
                      disabled={!batchAction}
                      variant={batchActions.find(a => a.value === batchAction)?.dangerous ? 'destructive' : 'default'}
                    >
                      確認執行
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}