import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ImportRecord {
  itemName: string;
  amount: number;
  date: string;
  projectName: string;
  categoryName: string;
  vendor?: string;
  notes?: string;
  priority?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentDate?: string;
  paymentNotes?: string;
  isValid: boolean;
  errors: string[];
}

interface BatchImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BatchImportWizard({ isOpen, onClose }: BatchImportWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ImportRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    details: any[];
  } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 下載範本檔案
  const downloadTemplate = () => {
    const templateData = [
      ['項目名稱', '金額', '日期', '專案名稱', '分類名稱', '廠商', '備註', '優先級', '付款方式', '付款狀態', '付款日期', '付款備註'],
      ['辦公用品採購', '1500', '2025-06-21', '辦公室管理', '辦公用品', '文具店', '購買文具用品', '2', '現金', '已付款', '2025-06-21', '已完成付款'],
      ['設備維修費', '3000', '2025-06-22', '設備維護', '維修費用', '維修公司', '冷氣維修', '1', '銀行轉帳', '未付款', '', '等待付款'],
      ['軟體授權費', '5000', '2025-06-25', 'IT專案', '軟體授權', '軟體供應商', '年度授權', '1', '信用卡', '未付款', '', '']
    ];

    const csvContent = templateData.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', '批量導入範本.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "範本下載成功",
      description: "請填寫範本後重新上傳進行批量導入",
    });
  };

  // 處理檔案上傳
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await apiRequest('POST', '/api/payment/batch-import/parse', formData);
      console.log('批量導入 - 前端收到結果:', result);
      setImportData(result.records || []);
      setCurrentStep(2);
      
      toast({
        title: "檔案解析成功",
        description: `解析到 ${result.records?.length || 0} 筆記錄`,
      });
    } catch (error: any) {
      console.error('批量導入 - 前端錯誤:', error);
      toast({
        title: "檔案解析失敗",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 執行批量導入
  const executeImport = useMutation({
    mutationFn: async () => {
      const validRecords = importData.filter((record: ImportRecord) => record.isValid);
      const result = await apiRequest('POST', '/api/payment/batch-import/execute', {
        records: validRecords
      });
      console.log('批量導入 - 執行結果:', result);
      return result;
    },
    onSuccess: (results) => {
      setImportResults(results);
      setCurrentStep(3);
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items'] });
      toast({
        title: "批量導入完成",
        description: `成功導入 ${results.success} 筆，失敗 ${results.failed} 筆`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "批量導入失敗",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // 重置精靈
  const resetWizard = () => {
    setCurrentStep(1);
    setSelectedFile(null);
    setImportData([]);
    setImportResults(null);
    setImportProgress(0);
  };

  // 關閉對話框
  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const validRecords = importData.filter((r: ImportRecord) => r.isValid).length;
  const invalidRecords = importData.filter((r: ImportRecord) => !r.isValid).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量導入付款項目</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 步驟指示器 */}
          <div className="flex items-center space-x-4">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              currentStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}>
              1
            </div>
            <div className="flex-1 h-1 bg-gray-200">
              <div className={`h-full bg-blue-500 transition-all ${
                currentStep >= 2 ? 'w-full' : 'w-0'
              }`}></div>
            </div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              currentStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}>
              2
            </div>
            <div className="flex-1 h-1 bg-gray-200">
              <div className={`h-full bg-blue-500 transition-all ${
                currentStep >= 3 ? 'w-full' : 'w-0'
              }`}></div>
            </div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              currentStep >= 3 ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}>
              3
            </div>
          </div>

          {/* 步驟 1: 檔案上傳 */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    下載範本檔案
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    請先下載範本檔案，填入您的付款項目資料後再上傳。
                  </p>
                  <Button onClick={downloadTemplate} variant="outline">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    下載 CSV 範本
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    上傳檔案
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                      disabled={isProcessing}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-lg font-medium">
                        {selectedFile ? selectedFile.name : '選擇檔案或拖放到此處'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        支援 CSV, Excel (.xlsx, .xls) 格式
                      </p>
                    </label>
                  </div>
                  {isProcessing && (
                    <div className="mt-4">
                      <Progress value={50} className="w-full" />
                      <p className="text-sm text-center mt-2">正在解析檔案...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 步驟 2: 數據預覽 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">數據預覽</h3>
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    有效: {validRecords}
                  </Badge>
                  <Badge variant="destructive">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    錯誤: {invalidRecords}
                  </Badge>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">狀態</th>
                      <th className="px-3 py-2 text-left">項目名稱</th>
                      <th className="px-3 py-2 text-left">金額</th>
                      <th className="px-3 py-2 text-left">專案</th>
                      <th className="px-3 py-2 text-left">分類</th>
                      <th className="px-3 py-2 text-left">付款狀態</th>
                      <th className="px-3 py-2 text-left">錯誤</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importData.map((record, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-3 py-2">
                          {record.isValid ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                        </td>
                        <td className="px-3 py-2">{record.itemName}</td>
                        <td className="px-3 py-2">{record.amount}</td>
                        <td className="px-3 py-2">{record.projectName}</td>
                        <td className="px-3 py-2">{record.categoryName}</td>
                        <td className="px-3 py-2">{record.paymentStatus}</td>
                        <td className="px-3 py-2 text-red-500 text-xs">
                          {record.errors.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setCurrentStep(1)} variant="outline">
                  返回
                </Button>
                <Button 
                  onClick={() => executeImport.mutate()}
                  disabled={validRecords === 0 || executeImport.isPending}
                >
                  {executeImport.isPending ? '導入中...' : `導入 ${validRecords} 筆記錄`}
                </Button>
              </div>
            </div>
          )}

          {/* 步驟 3: 導入結果 */}
          {currentStep === 3 && importResults && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">導入結果</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold text-green-600">{importResults.success}</p>
                        <p className="text-sm text-muted-foreground">成功導入</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <div>
                        <p className="text-2xl font-bold text-red-600">{importResults.failed}</p>
                        <p className="text-sm text-muted-foreground">導入失敗</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {importResults.failed > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>失敗記錄詳情</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {importResults.details.filter(d => !d.success).map((detail, index) => (
                        <div key={index} className="p-2 bg-red-50 rounded text-sm">
                          <p className="font-medium">{detail.record.itemName}</p>
                          <p className="text-red-600">{detail.error}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <Button onClick={resetWizard} variant="outline">
                  重新導入
                </Button>
                <Button onClick={handleClose}>
                  完成
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}