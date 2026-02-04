import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar, DollarSign, Building2, Edit, Trash2, Play, Pause, Download, Upload, FileText, Eye } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

// 租約表單驗證
const rentalContractSchema = z.object({
  projectId: z.number().min(1, "請選擇專案"),
  contractName: z.string().min(1, "請輸入租約名稱"),
  startDate: z.string().min(1, "請選擇開始日期"),
  endDate: z.string().min(1, "請選擇結束日期"),
  totalYears: z.number().min(1, "租約年數至少1年"),
  baseAmount: z.number().min(0, "基礎金額不能為負數"),
  notes: z.string().optional(),
  priceTiers: z.array(z.object({
    yearStart: z.number().min(1),
    yearEnd: z.number().min(1),
    monthlyAmount: z.number().min(0),
  })).min(1, "請至少添加一個價格階段"),
});

type RentalContractForm = z.infer<typeof rentalContractSchema>;

export default function RentalManagement() {
  const [activeTab, setActiveTab] = useState("contracts");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(null);
  const [priceTiers, setPriceTiers] = useState<any[]>([{ yearStart: 1, yearEnd: 3, monthlyAmount: 0 }]);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [isPaymentInfoDialogOpen, setIsPaymentInfoDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 查詢資料
  const { data: projects } = useQuery({
    queryKey: ["/api/payment/projects"],
  });

  const { data: rentalContracts } = useQuery({
    queryKey: ["/api/rental/contracts"],
  });

  const { data: rentalStats } = useQuery({
    queryKey: ["/api/rental/stats"],
  });

  const { data: rentalPaymentItems } = useQuery({
    queryKey: ["/api/rental/payment-items"],
  });

  // 表單處理
  const form = useForm<RentalContractForm>({
    resolver: zodResolver(rentalContractSchema),
    defaultValues: {
      projectId: 0,
      contractName: "",
      startDate: "",
      endDate: "",
      totalYears: 10,
      baseAmount: 200000,
      notes: "",
      priceTiers: [],
    },
  });

  // 建立租約
  const createContractMutation = useMutation({
    mutationFn: async (data: RentalContractForm) => {
      return apiRequest("/api/rental/contracts", "POST", data);
    },
    onSuccess: () => {
      toast({ title: "租約建立成功" });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/contracts"] });
      setIsDialogOpen(false);
      form.reset();
      setPriceTiers([{ yearStart: 1, yearEnd: 3, monthlyAmount: 0 }]);
    },
    onError: (error: any) => {
      toast({ 
        title: "建立失敗", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // 生成付款項目
  const generatePaymentsMutation = useMutation({
    mutationFn: async (contractId: number) => {
      return apiRequest(`/api/rental/contracts/${contractId}/generate-payments`, "POST");
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "付款項目生成成功", 
        description: `已生成 ${data.generatedCount} 個付款項目` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "生成失敗", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // 合約文件查詢
  const { data: contractDocuments } = useQuery({
    queryKey: [`/api/rental/contracts/${selectedContract?.id}/documents`],
    enabled: !!selectedContract?.id,
  });

  // 上傳合約文件
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ file, versionLabel, description }: { 
      file: File; 
      versionLabel: string; 
      description?: string;
    }) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('versionLabel', versionLabel);
      if (description) formData.append('description', description);
      
      return fetch(`/api/rental/contracts/${selectedContract.id}/documents`, {
        method: 'POST',
        body: formData,
      }).then(res => res.json());
    },
    onSuccess: () => {
      toast({ title: "文件上傳成功" });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/rental/contracts/${selectedContract?.id}/documents`] 
      });
      setUploadFile(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "上傳失敗", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // 刪除合約文件
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest(`/api/rental/contracts/${selectedContract.id}/documents/${documentId}`, "DELETE");
    },
    onSuccess: () => {
      toast({ title: "文件刪除成功" });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/rental/contracts/${selectedContract?.id}/documents`] 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "刪除失敗", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // 更新付款資訊
  const updatePaymentInfoMutation = useMutation({
    mutationFn: async (paymentInfo: {
      payeeName: string;
      payeeUnit: string;
      bankCode: string;
      accountNumber: string;
      contractPaymentDay: number;
    }) => {
      return apiRequest(`/api/rental/contracts/${selectedContract.id}/payment-info`, "PUT", paymentInfo);
    },
    onSuccess: () => {
      toast({ title: "付款資訊更新成功" });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/contracts"] });
      setIsPaymentInfoDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "更新失敗", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // 更新租約
  const updateContractMutation = useMutation({
    mutationFn: async (data: { id: number; contractData: RentalContractForm }) => {
      return apiRequest(`/api/rental/contracts/${data.id}`, "PUT", data.contractData);
    },
    onSuccess: () => {
      toast({ title: "租約更新成功" });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/contracts"] });
      setIsDialogOpen(false);
      setEditingContract(null);
      form.reset();
      setPriceTiers([{ yearStart: 1, yearEnd: 3, monthlyAmount: 0 }]);
    },
    onError: (error: any) => {
      toast({ 
        title: "更新失敗", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // 刪除租約
  const deleteContractMutation = useMutation({
    mutationFn: async (contractId: number) => {
      return apiRequest(`/api/rental/contracts/${contractId}`, "DELETE");
    },
    onSuccess: () => {
      toast({ title: "租約刪除成功" });
      queryClient.invalidateQueries({ queryKey: ["/api/rental/contracts"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "刪除失敗", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // 編輯租約
  const handleEditContract = async (contract: any) => {
    setEditingContract(contract);
    
    // 獲取價格階段資料
    try {
      const priceTiersData = await apiRequest(`/api/rental/contracts/${contract.id}/price-tiers`, "GET");
      setPriceTiers(priceTiersData.length > 0 ? priceTiersData : [{ yearStart: 1, yearEnd: 3, monthlyAmount: contract.baseAmount }]);
    } catch (error) {
      setPriceTiers([{ yearStart: 1, yearEnd: 3, monthlyAmount: parseFloat(contract.baseAmount) }]);
    }
    
    form.reset({
      projectId: contract.projectId,
      contractName: contract.contractName,
      startDate: contract.startDate,
      endDate: contract.endDate,
      totalYears: contract.totalYears,
      baseAmount: parseFloat(contract.baseAmount),
      notes: contract.notes || "",
      priceTiers: [],
    });
    setIsDialogOpen(true);
  };

  // 添加價格階段
  const addPriceTier = () => {
    const lastTier = priceTiers[priceTiers.length - 1];
    const newTier = {
      yearStart: lastTier.yearEnd + 1,
      yearEnd: lastTier.yearEnd + 3,
      monthlyAmount: 0,
    };
    setPriceTiers([...priceTiers, newTier]);
  };

  // 更新價格階段
  const updatePriceTier = (index: number, field: string, value: any) => {
    const newTiers = [...priceTiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setPriceTiers(newTiers);
  };

  // 移除價格階段
  const removePriceTier = (index: number) => {
    if (priceTiers.length > 1) {
      setPriceTiers(priceTiers.filter((_, i) => i !== index));
    }
  };

  // 提交表單
  const onSubmit = (data: RentalContractForm) => {
    const formData = {
      ...data,
      baseAmount: data.baseAmount.toString(),
      priceTiers: priceTiers.filter(tier => tier.monthlyAmount > 0).map(tier => ({
        ...tier,
        monthlyAmount: tier.monthlyAmount.toString(),
      })),
    };
    
    if (editingContract) {
      updateContractMutation.mutate({ id: editingContract.id, contractData: formData });
    } else {
      createContractMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">租金管理系統</h1>
          <p className="text-gray-600 mt-2">管理租約、價格階段和自動化付款項目</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // Execute migration via API
              fetch("/api/rental/migrate", { method: "POST" })
                .then(res => res.json())
                .then(data => {
                  if (data.success) {
                    window.location.reload();
                  }
                });
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            導入現有租金
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingContract(null);
              form.reset();
              setPriceTiers([{ yearStart: 1, yearEnd: 3, monthlyAmount: 0 }]);
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新增租約
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingContract ? "編輯租約" : "建立新租約"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="projectId">專案</Label>
                  <Select
                    value={form.watch("projectId")?.toString() || ""}
                    onValueChange={(value) => form.setValue("projectId", parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇專案" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map((project: any) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.projectName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="contractName">租約名稱</Label>
                  <Input
                    {...form.register("contractName")}
                    placeholder="例：浯島文旅租約"
                  />
                </div>
                <div>
                  <Label htmlFor="startDate">開始日期</Label>
                  <Input
                    type="date"
                    {...form.register("startDate")}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">結束日期</Label>
                  <Input
                    type="date"
                    {...form.register("endDate")}
                  />
                </div>
                <div>
                  <Label htmlFor="totalYears">租約年數</Label>
                  <Input
                    type="number"
                    {...form.register("totalYears", { valueAsNumber: true })}
                    min="1"
                    max="50"
                  />
                </div>
                <div>
                  <Label htmlFor="baseAmount">基礎月租金</Label>
                  <Input
                    type="number"
                    {...form.register("baseAmount", { valueAsNumber: true })}
                    min="0"
                    step="100"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="notes">備註</Label>
                <Textarea
                  {...form.register("notes")}
                  placeholder="租約相關備註"
                  rows={3}
                />
              </div>

              {/* 價格階段設定 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-lg font-medium">價格階段設定</Label>
                  <Button type="button" variant="outline" onClick={addPriceTier}>
                    <Plus className="h-4 w-4 mr-2" />
                    添加階段
                  </Button>
                </div>
                <div className="space-y-3">
                  {priceTiers.map((tier, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1 grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">起始年</Label>
                          <Input
                            type="number"
                            value={tier.yearStart}
                            onChange={(e) => updatePriceTier(index, "yearStart", parseInt(e.target.value))}
                            min="1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">結束年</Label>
                          <Input
                            type="number"
                            value={tier.yearEnd}
                            onChange={(e) => updatePriceTier(index, "yearEnd", parseInt(e.target.value))}
                            min="1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">月租金額</Label>
                          <Input
                            type="number"
                            value={tier.monthlyAmount}
                            onChange={(e) => updatePriceTier(index, "monthlyAmount", parseFloat(e.target.value))}
                            min="0"
                            step="100"
                          />
                        </div>
                      </div>
                      {priceTiers.length > 1 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removePriceTier(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={createContractMutation.isPending}>
                  {createContractMutation.isPending ? "建立中..." : "建立租約"}
                </Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="contracts">租約管理</TabsTrigger>
          <TabsTrigger value="payments">付款項目</TabsTrigger>
          <TabsTrigger value="stats">統計報表</TabsTrigger>
        </TabsList>

        <TabsContent value="contracts" className="space-y-6">
          {/* 租約列表 */}
          <Card>
            <CardHeader>
              <CardTitle>租約管理</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>租約名稱</TableHead>
                    <TableHead>專案</TableHead>
                    <TableHead>租期</TableHead>
                    <TableHead>基礎月租</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rentalContracts?.map((contract: any) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.contractName}</TableCell>
                      <TableCell>{contract.projectName}</TableCell>
                      <TableCell>
                        {new Date(contract.startDate).toLocaleDateString('zh-TW')} - 
                        {new Date(contract.endDate).toLocaleDateString('zh-TW')}
                      </TableCell>
                      <TableCell>{parseInt(contract.baseAmount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={contract.isActive ? "default" : "secondary"}>
                          {contract.isActive ? "生效中" : "已停用"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Link href={`/contract/${contract.id}`}>
                            <Button
                              size="sm"
                              variant="default"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              查看詳情
                            </Button>
                          </Link>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleEditContract(contract)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              if (confirm("確定要刪除此租約嗎？")) {
                                deleteContractMutation.mutate(contract.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>租金付款項目</CardTitle>
            </CardHeader>
            <CardContent>
              {rentalPaymentItems && rentalPaymentItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>項目名稱</TableHead>
                      <TableHead>專案</TableHead>
                      <TableHead>總金額</TableHead>
                      <TableHead>已付金額</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>到期日</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentalPaymentItems.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell>{item.projectName}</TableCell>
                        <TableCell>{parseInt(item.totalAmount).toLocaleString()}</TableCell>
                        <TableCell>{parseInt(item.paidAmount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={item.status === "paid" ? "default" : "secondary"}>
                            {item.status === "paid" ? "已付款" : 
                             item.status === "partial" ? "部分付款" : "未付款"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.startDate ? new Date(item.startDate).toLocaleDateString('zh-TW') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  尚無租金付款項目，請先生成租約付款項目
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">總租約數</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {rentalContracts?.length || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">月租總額</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {rentalStats?.totalMonthlyRent || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">生效租約</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {rentalContracts?.filter((c: any) => c.isActive)?.length || 0}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 合約文件上傳對話框 */}
      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>合約文件管理 - {selectedContract?.contractName}</DialogTitle>
            <DialogDescription>
              上傳和管理租約相關文件，支援版本控制和文件下載
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* 文件上傳區 */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <Label htmlFor="document-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      點擊上傳文件或拖拽文件至此
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      支援 PDF、Word、圖片格式，最大 20MB
                    </span>
                  </Label>
                  <Input
                    id="document-upload"
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setUploadFile(file);
                    }}
                  />
                </div>
              </div>
              
              {uploadFile && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="text-sm font-medium">{uploadFile.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadFile(null)}
                    >
                      ✕
                    </Button>
                  </div>
                  
                  <div className="mt-3 space-y-3">
                    <div>
                      <Label className="text-xs">版本標籤</Label>
                      <Input
                        placeholder="例如：原始版本、修訂版 1.0"
                        defaultValue="原始版本"
                        id="version-label"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">文件描述</Label>
                      <Textarea
                        placeholder="文件相關說明（選填）"
                        rows={2}
                        id="document-description"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        const versionLabel = (document.getElementById('version-label') as HTMLInputElement)?.value || "原始版本";
                        const description = (document.getElementById('document-description') as HTMLTextAreaElement)?.value;
                        uploadDocumentMutation.mutate({
                          file: uploadFile,
                          versionLabel,
                          description
                        });
                      }}
                      disabled={uploadDocumentMutation.isPending}
                      className="w-full"
                    >
                      {uploadDocumentMutation.isPending ? "上傳中..." : "上傳文件"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 已上傳文件列表 */}
            <div>
              <h4 className="font-medium mb-3">已上傳文件</h4>
              {contractDocuments && contractDocuments.length > 0 ? (
                <div className="space-y-2">
                  {contractDocuments.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-600 mr-3" />
                        <div>
                          <div className="font-medium">{doc.originalName}</div>
                          <div className="text-sm text-gray-500">
                            {doc.version} • {new Date(doc.uploadedAt).toLocaleDateString('zh-TW')} • 
                            {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                          </div>
                          {doc.notes && (
                            <div className="text-xs text-gray-400 mt-1">{doc.notes}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            window.open(`/api/rental/contracts/${selectedContract.id}/documents/${doc.id}/download`, '_blank');
                          }}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          下載
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm('確定要刪除此文件嗎？此操作無法復原。')) {
                              deleteDocumentMutation.mutate(doc.id);
                            }
                          }}
                          disabled={deleteDocumentMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          刪除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">尚未上傳任何文件</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 付款資訊設定對話框 */}
      <Dialog open={isPaymentInfoDialogOpen} onOpenChange={setIsPaymentInfoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>付款資訊設定 - {selectedContract?.contractName}</DialogTitle>
            <DialogDescription>
              設定收款人資訊和合約付款日期
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            updatePaymentInfoMutation.mutate({
              payeeName: formData.get('payeeName') as string,
              payeeUnit: formData.get('payeeUnit') as string,
              bankCode: formData.get('bankCode') as string,
              accountNumber: formData.get('accountNumber') as string,
              contractPaymentDay: parseInt(formData.get('contractPaymentDay') as string),
            });
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payeeName">收款人姓名</Label>
                <Input
                  id="payeeName"
                  name="payeeName"
                  placeholder="收款人姓名"
                  defaultValue={selectedContract?.payeeName || ""}
                />
              </div>
              <div>
                <Label htmlFor="payeeUnit">收款人單位</Label>
                <Input
                  id="payeeUnit"
                  name="payeeUnit"
                  placeholder="收款人單位"
                  defaultValue={selectedContract?.payeeUnit || ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bankCode">銀行代號</Label>
                <Input
                  id="bankCode"
                  name="bankCode"
                  placeholder="例如：822"
                  defaultValue={selectedContract?.bankCode || ""}
                />
              </div>
              <div>
                <Label htmlFor="accountNumber">銀行帳號</Label>
                <Input
                  id="accountNumber"
                  name="accountNumber"
                  placeholder="銀行帳號"
                  defaultValue={selectedContract?.accountNumber || ""}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="contractPaymentDay">合約付款日（每月第幾日）</Label>
              <Input
                id="contractPaymentDay"
                name="contractPaymentDay"
                type="number"
                min="1"
                max="28"
                placeholder="1-28日"
                defaultValue={selectedContract?.contractPaymentDay?.toString() || "1"}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsPaymentInfoDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={updatePaymentInfoMutation.isPending}>
                {updatePaymentInfoMutation.isPending ? "更新中..." : "更新付款資訊"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}