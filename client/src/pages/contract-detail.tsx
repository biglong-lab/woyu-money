import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, DollarSign, Building2, FileText, Download, Upload, Eye, Trash2, Edit, Users, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ContractData {
  id: number;
  projectId: number;
  contractName: string;
  startDate: string;
  endDate: string;
  totalYears: number;
  baseAmount: string;
  payeeName?: string;
  payeeUnit?: string;
  bankCode?: string;
  accountNumber?: string;
  contractPaymentDay?: number;
  isActive: boolean;
  notes?: string;
  projectName: string;
  createdAt: string;
  updatedAt?: string;
}

export default function ContractDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");

  // Fetch contract details
  const { data: contract, isLoading: contractLoading, error: contractError } = useQuery<ContractData>({
    queryKey: [`/api/rental/contracts/${id}`],
    enabled: !!id,
  });

  // Fetch price tiers
  const { data: priceTiers, isLoading: tiersLoading } = useQuery({
    queryKey: [`/api/rental/contracts/${id}/price-tiers`],
    enabled: !!id,
  });

  // Fetch contract documents
  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: [`/api/rental/contracts/${id}/documents`],
    enabled: !!id,
  });

  // Fetch related payment items
  const { data: paymentItems, isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/payment/items"],
    select: (data: any) => {
      if (!contract) return [];
      const items = data?.items || [];
      if (!Array.isArray(items)) return [];
      return items.filter((item: any) => 
        item.itemName?.includes(contract.contractName) || 
        item.projectId === contract.projectId
      );
    },
    enabled: !!contract,
  });

  // File upload mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async (data: { file: File; description: string }) => {
      const formData = new FormData();
      formData.append("document", data.file);
      formData.append("description", data.description);
      formData.append("versionLabel", "新版本");
      
      const response = await fetch(`/api/rental/contracts/${id}/documents`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rental/contracts/${id}/documents`] });
      setIsUploadDialogOpen(false);
      setUploadFile(null);
      setUploadDescription("");
      toast({
        title: "文件上傳成功",
        description: "合約文件已成功上傳",
      });
    },
    onError: (error: any) => {
      toast({
        title: "上傳失敗",
        description: error.message || "文件上傳失敗",
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest(`/api/rental/contracts/${id}/documents/${documentId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rental/contracts/${id}/documents`] });
      toast({
        title: "文件刪除成功",
        description: "合約文件已成功刪除",
      });
    },
    onError: (error: any) => {
      toast({
        title: "刪除失敗",
        description: error.message || "文件刪除失敗",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = () => {
    if (!uploadFile) {
      toast({
        title: "請選擇文件",
        description: "請先選擇要上傳的文件",
        variant: "destructive",
      });
      return;
    }

    uploadDocumentMutation.mutate({
      file: uploadFile,
      description: uploadDescription,
    });
  };

  const handleDownloadDocument = (documentId: number, fileName: string) => {
    window.open(`/api/rental/contracts/${id}/documents/${documentId}/download`, "_blank");
  };

  if (contractLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (contractError || !contract) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">合約不存在</h1>
          <p className="text-gray-600 mb-4">找不到指定的合約資訊</p>
          <Link href="/rental-management">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回租金管理
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate contract statistics
  const totalPaymentItems = Array.isArray(paymentItems) ? paymentItems.length : 0;
  const paidItems = Array.isArray(paymentItems) ? paymentItems.filter((item: any) => item.status === 'paid').length : 0;
  const pendingItems = Array.isArray(paymentItems) ? paymentItems.filter((item: any) => item.status === 'pending').length : 0;
  const totalAmount = Array.isArray(paymentItems) ? paymentItems.reduce((sum: number, item: any) => sum + parseFloat(item.totalAmount || '0'), 0) : 0;
  const paidAmount = Array.isArray(paymentItems) ? paymentItems.reduce((sum: number, item: any) => sum + parseFloat(item.paidAmount || '0'), 0) : 0;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/rental-management">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回租金管理
            </Button>
          </Link>
          <div className="ml-4">
            <h1 className="text-2xl font-bold">{contract.contractName}</h1>
            <p className="text-gray-600">{contract.projectName}</p>
          </div>
        </div>
        <Badge variant={contract.isActive ? "default" : "secondary"}>
          {contract.isActive ? "生效中" : "已停用"}
        </Badge>
      </div>

      {/* Contract Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">基礎月租金</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{parseInt(contract.baseAmount || '0').toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">租約年數</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contract.totalYears}年</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">付款項目數</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPaymentItems}</div>
            <p className="text-xs text-muted-foreground">
              已付: {paidItems} | 待付: {pendingItems}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">累計金額</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              已付: {paidAmount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">合約詳情</TabsTrigger>
          <TabsTrigger value="pricing">價格階段</TabsTrigger>
          <TabsTrigger value="documents">合約文件</TabsTrigger>
          <TabsTrigger value="payments">付款記錄</TabsTrigger>
          <TabsTrigger value="management">合約管理</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>合約基本資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">合約名稱</Label>
                  <p className="text-lg">{contract.contractName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">關聯專案</Label>
                  <p className="text-lg">{contract.projectName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">開始日期</Label>
                  <p className="text-lg">{new Date(contract.startDate).toLocaleDateString('zh-TW')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">結束日期</Label>
                  <p className="text-lg">{new Date(contract.endDate).toLocaleDateString('zh-TW')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">基礎月租金</Label>
                  <p className="text-lg">{parseInt(contract.baseAmount || '0').toLocaleString()} 元</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">租約年數</Label>
                  <p className="text-lg">{contract.totalYears} 年</p>
                </div>
              </div>

              {/* Payment Information */}
              {(contract.payeeName || contract.bankCode) && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium mb-3">付款資訊</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contract.payeeName && (
                      <div>
                        <Label className="text-sm font-medium text-gray-600">收款人</Label>
                        <p className="text-lg">{contract.payeeName}</p>
                      </div>
                    )}
                    {contract.payeeUnit && (
                      <div>
                        <Label className="text-sm font-medium text-gray-600">收款單位</Label>
                        <p className="text-lg">{contract.payeeUnit}</p>
                      </div>
                    )}
                    {contract.bankCode && (
                      <div>
                        <Label className="text-sm font-medium text-gray-600">銀行代碼</Label>
                        <p className="text-lg">{contract.bankCode}</p>
                      </div>
                    )}
                    {contract.accountNumber && (
                      <div>
                        <Label className="text-sm font-medium text-gray-600">銀行帳號</Label>
                        <p className="text-lg">{contract.accountNumber}</p>
                      </div>
                    )}
                    {contract.contractPaymentDay && (
                      <div>
                        <Label className="text-sm font-medium text-gray-600">每月付款日</Label>
                        <p className="text-lg">{contract.contractPaymentDay} 號</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {contract.notes && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium text-gray-600">備註</Label>
                  <p className="text-lg mt-1">{contract.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle>價格階段設定</CardTitle>
            </CardHeader>
            <CardContent>
              {tiersLoading ? (
                <div className="text-center py-4">載入中...</div>
              ) : Array.isArray(priceTiers) && priceTiers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>年份範圍</TableHead>
                      <TableHead>開始年</TableHead>
                      <TableHead>結束年</TableHead>
                      <TableHead>月租金</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceTiers.map((tier: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>第 {tier.yearStart} - {tier.yearEnd} 年</TableCell>
                        <TableCell>{tier.yearStart}</TableCell>
                        <TableCell>{tier.yearEnd}</TableCell>
                        <TableCell className="font-medium">
                          {parseInt(tier.monthlyAmount).toLocaleString()} 元
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>未設定價格階段，使用基礎月租金</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>合約文件</CardTitle>
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
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
                      <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                        取消
                      </Button>
                      <Button 
                        onClick={handleFileUpload}
                        disabled={uploadDocumentMutation.isPending}
                      >
                        {uploadDocumentMutation.isPending ? "上傳中..." : "上傳"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="text-center py-4">載入中...</div>
              ) : Array.isArray(documents) && documents.length > 0 ? (
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
                    {documents.map((doc: any) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.originalName}</TableCell>
                        <TableCell>{doc.notes || "-"}</TableCell>
                        <TableCell>{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</TableCell>
                        <TableCell>{new Date(doc.uploadedAt).toLocaleDateString('zh-TW')}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadDocument(doc.id, doc.originalName)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteDocumentMutation.mutate(doc.id)}
                              disabled={deleteDocumentMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>尚未上傳任何文件</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>相關付款記錄</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="text-center py-4">載入中...</div>
              ) : Array.isArray(paymentItems) && paymentItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>項目名稱</TableHead>
                      <TableHead>總金額</TableHead>
                      <TableHead>已付金額</TableHead>
                      <TableHead>預計日期</TableHead>
                      <TableHead>狀態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentItems.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell>{parseInt(item.totalAmount || '0').toLocaleString()}</TableCell>
                        <TableCell>{parseInt(item.paidAmount || '0').toLocaleString()}</TableCell>
                        <TableCell>
                          {item.startDate ? new Date(item.startDate).toLocaleDateString('zh-TW') : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              item.status === 'paid' ? 'default' : 
                              item.status === 'partial' ? 'secondary' : 'outline'
                            }
                          >
                            {item.status === 'paid' ? '已付清' : 
                             item.status === 'partial' ? '部分付款' : '待付款'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>尚無相關付款記錄</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="management">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 生成付款項目 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Play className="h-5 w-5 mr-2" />
                  生成付款項目
                </CardTitle>
                <p className="text-sm text-gray-600">
                  根據租約條件自動生成月付款項目
                </p>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full"
                  onClick={() => {
                    // Generate payment items logic
                    const generatePayments = async () => {
                      try {
                        const response = await fetch(`/api/rental/contracts/${contract.id}/generate-payments`, {
                          method: 'POST',
                        });
                        if (response.ok) {
                          // Refresh payment records
                          window.location.reload();
                        }
                      } catch (error) {
                        console.error('Failed to generate payments:', error);
                      }
                    };
                    generatePayments();
                  }}
                >
                  <Play className="h-4 w-4 mr-2" />
                  生成付款項目
                </Button>
              </CardContent>
            </Card>

            {/* 合約文件管理 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Upload className="h-5 w-5 mr-2" />
                  合約文件管理
                </CardTitle>
                <p className="text-sm text-gray-600">
                  上傳和管理租約相關文件
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button 
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      const fileInput = document.createElement('input');
                      fileInput.type = 'file';
                      fileInput.multiple = true;
                      fileInput.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
                      fileInput.onchange = async (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (!files || files.length === 0) return;

                        for (let i = 0; i < files.length; i++) {
                          const file = files[i];
                          const formData = new FormData();
                          formData.append('file', file);
                          formData.append('description', `合約文件 - ${file.name}`);

                          try {
                            const response = await fetch(`/api/rental/contracts/${contract.id}/documents`, {
                              method: 'POST',
                              body: formData,
                            });
                            if (response.ok) {
                              // Refresh documents
                              window.location.reload();
                            }
                          } catch (error) {
                            console.error('Failed to upload document:', error);
                          }
                        }
                      };
                      fileInput.click();
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    上傳文件
                  </Button>
                  <div className="text-xs text-gray-500">
                    支援: PDF, DOC, DOCX, JPG, PNG
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 付款資訊設定 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  付款資訊設定
                </CardTitle>
                <p className="text-sm text-gray-600">
                  設定銀行帳戶和付款相關資訊
                </p>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    // Open payment info dialog
                    const payeeInfo = contract.payeeName ? 
                      `收款人：${contract.payeeName}\n` +
                      `收款單位：${contract.payeeUnit || '未設定'}\n` +
                      `銀行代碼：${contract.bankCode || '未設定'}\n` +
                      `帳戶號碼：${contract.accountNumber || '未設定'}\n` +
                      `付款日：每月${contract.contractPaymentDay || '未設定'}日`
                      : '尚未設定付款資訊';
                    
                    alert(`付款資訊：\n\n${payeeInfo}`);
                  }}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  查看付款資訊
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 操作歷史記錄 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>操作歷史</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span>合約建立</span>
                  <span className="text-gray-500">
                    {new Date(contract.createdAt).toLocaleDateString('zh-TW')}
                  </span>
                </div>
                {contract.updatedAt && (
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span>最後更新</span>
                    <span className="text-gray-500">
                      {new Date(contract.updatedAt).toLocaleDateString('zh-TW')}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}