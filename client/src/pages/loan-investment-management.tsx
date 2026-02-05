import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertTriangle, DollarSign, TrendingUp, Users, Calendar, Plus, Edit2, Trash2, FileText, AlertCircle, Receipt } from "lucide-react";
import LoanPaymentHistory from "@/components/loan-payment-history";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Form validation schemas
const loanInvestmentSchema = z.object({
  itemName: z.string().min(1, "項目名稱為必填"),
  recordType: z.enum(["loan", "investment"]),
  partyName: z.string().min(1, "當事人姓名為必填"),
  partyPhone: z.string().optional(),
  partyRelationship: z.string().optional(),
  principalAmount: z.string().min(1, "本金金額為必填"),
  annualInterestRate: z.string().min(0, "年利率不能為負數"),
  startDate: z.string().min(1, "開始日期為必填"),
  endDate: z.string().optional(),
  status: z.enum(["active", "completed", "overdue"]).default("active"),
  paymentMethod: z.enum(["monthly", "quarterly", "annually", "maturity"]).default("monthly"),
  installmentCount: z.number().optional(),
  collateralInfo: z.string().optional(),
  notes: z.string().optional(),
  partyNotes: z.string().optional(),
  riskLevel: z.enum(["low", "medium", "high"]).default("medium"),
  contractDate: z.string().optional(),
  maturityDate: z.string().optional(),
  guarantorInfo: z.string().optional(),
  legalDocuments: z.string().optional(),
  documentNotes: z.string().optional()
});

type LoanInvestmentFormData = z.infer<typeof loanInvestmentSchema>;

type LoanInvestmentRecord = {
  id: number;
  itemName: string;
  recordType: string;
  partyName: string;
  partyPhone?: string;
  partyRelationship?: string;
  principalAmount: string;
  annualInterestRate: string;
  startDate: string;
  endDate?: string;
  status: string;
  paymentMethod: string;
  installmentCount?: number;
  collateralInfo?: string;
  notes?: string;
  partyNotes?: string;
  riskLevel: string;
  contractDate?: string;
  maturityDate?: string;
  guarantorInfo?: string;
  legalDocuments?: string;
  documentNotes?: string;
  createdAt: string;
  updatedAt: string;
};

export default function LoanInvestmentManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LoanInvestmentRecord | null>(null);
  const [selectedTab, setSelectedTab] = useState("all");
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [selectedRecordForPayments, setSelectedRecordForPayments] = useState<LoanInvestmentRecord | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch loan investment records
  const { data: records = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/loan-investment/records"],
  });

  // Fetch statistics
  const { data: stats = {} } = useQuery<any>({
    queryKey: ["/api/loan-investment/stats"],
  });

  const form = useForm<LoanInvestmentFormData>({
    resolver: zodResolver(loanInvestmentSchema),
    defaultValues: {
      recordType: "loan",
      status: "active",
      paymentMethod: "monthly",
      riskLevel: "medium"
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: LoanInvestmentFormData) => {
      return await apiRequest("POST", "/api/loan-investment/records", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "成功",
        description: "借貸投資記錄已建立",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "建立記錄時發生錯誤",
        variant: "destructive",
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<LoanInvestmentFormData> }) => {
      return await apiRequest("PUT", `/api/loan-investment/records/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      setIsDialogOpen(false);
      setEditingRecord(null);
      form.reset();
      toast({
        title: "成功",
        description: "借貸投資記錄已更新",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "更新記錄時發生錯誤",
        variant: "destructive",
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/loan-investment/records/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      toast({
        title: "成功",
        description: "借貸投資記錄已刪除",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "刪除記錄時發生錯誤",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: LoanInvestmentFormData) => {
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (record: LoanInvestmentRecord) => {
    setEditingRecord(record);
    form.reset({
      itemName: record.itemName,
      recordType: record.recordType as "loan" | "investment",
      partyName: record.partyName,
      partyPhone: record.partyPhone || "",
      partyRelationship: record.partyRelationship || "",
      principalAmount: record.principalAmount,
      annualInterestRate: record.annualInterestRate,
      startDate: record.startDate,
      endDate: record.endDate || "",
      status: record.status as "active" | "completed" | "overdue",
      paymentMethod: record.paymentMethod as "monthly" | "quarterly" | "annually" | "maturity",
      installmentCount: record.installmentCount,
      collateralInfo: record.collateralInfo || "",
      notes: record.notes || "",
      partyNotes: record.partyNotes || "",
      riskLevel: record.riskLevel as "low" | "medium" | "high",
      contractDate: record.contractDate || "",
      maturityDate: record.maturityDate || "",
      guarantorInfo: record.guarantorInfo || "",
      legalDocuments: record.legalDocuments || "",
      documentNotes: record.documentNotes || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("確定要刪除這筆記錄嗎？此操作無法復原。")) {
      deleteMutation.mutate(id);
    }
  };

  const openNewDialog = () => {
    setEditingRecord(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      completed: "secondary", 
      overdue: "destructive"
    } as const;
    
    const labels = {
      active: "進行中",
      completed: "已完成",
      overdue: "逾期"
    };
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || "default"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const getRiskBadge = (riskLevel: string) => {
    const variants = {
      low: "secondary",
      medium: "default",
      high: "destructive"
    } as const;
    
    const labels = {
      low: "低風險",
      medium: "中風險", 
      high: "高風險"
    };
    
    return (
      <Badge variant={variants[riskLevel as keyof typeof variants] || "default"}>
        {labels[riskLevel as keyof typeof labels] || riskLevel}
      </Badge>
    );
  };

  const getRecordTypeBadge = (recordType: string) => {
    return (
      <Badge variant={recordType === "loan" ? "default" : "secondary"}>
        {recordType === "loan" ? "借出" : "投資"}
      </Badge>
    );
  };

  const filteredRecords = records.filter((record: LoanInvestmentRecord) => {
    if (selectedTab === "all") return true;
    if (selectedTab === "loans") return record.recordType === "loan";
    if (selectedTab === "investments") return record.recordType === "investment";
    if (selectedTab === "high-risk") return record.riskLevel === "high";
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">借貸投資管理</h1>
          <p className="text-muted-foreground">管理個人借貸與投資記錄，追蹤資金流向與收益</p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="w-4 h-4 mr-2" />
          新增記錄
        </Button>
      </div>

      {/* Enhanced Analytics Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              投資組合概況
            </CardTitle>
            <CardDescription>資金配置與收益分析</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  ${stats.totalPrincipal?.toLocaleString() || "0"}
                </div>
                <div className="text-sm text-muted-foreground">總投入本金</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  ${stats.expectedReturn?.toLocaleString() || "0"}
                </div>
                <div className="text-sm text-muted-foreground">預期年收益</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {((stats.expectedReturn || 0) / Math.max(stats.totalPrincipal || 1, 1) * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">平均收益率</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.totalParties || 0}
                </div>
                <div className="text-sm text-muted-foreground">合作對象</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Assessment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              風險評估
            </CardTitle>
            <CardDescription>投資組合風險分析</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">低風險</span>
                <Badge variant="secondary">{stats.lowRiskCount || 0} 項</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">中風險</span>
                <Badge variant="default">{stats.mediumRiskCount || 0} 項</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">高風險</span>
                <Badge variant="destructive">{stats.highRiskCount || 0} 項</Badge>
              </div>
              
              {stats.highRiskCount > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">風險提醒</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">
                    您有 {stats.highRiskCount} 項高風險投資需要關注
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>借貸投資記錄</CardTitle>
          <CardDescription>查看和管理所有借貸與投資項目</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">全部記錄</TabsTrigger>
              <TabsTrigger value="loans">借出項目</TabsTrigger>
              <TabsTrigger value="investments">投資項目</TabsTrigger>
              <TabsTrigger value="high-risk">高風險項目</TabsTrigger>
            </TabsList>
            
            <TabsContent value={selectedTab} className="mt-6">
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>項目名稱</TableHead>
                      <TableHead>類型</TableHead>
                      <TableHead>當事人</TableHead>
                      <TableHead>本金</TableHead>
                      <TableHead>年利率</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>風險等級</TableHead>
                      <TableHead>開始日期</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          暫無記錄
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record: LoanInvestmentRecord) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.itemName}</TableCell>
                          <TableCell>{getRecordTypeBadge(record.recordType)}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{record.partyName}</div>
                              {record.partyRelationship && (
                                <div className="text-sm text-muted-foreground">
                                  {record.partyRelationship}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>${parseFloat(record.principalAmount).toLocaleString()}</TableCell>
                          <TableCell>{record.annualInterestRate}%</TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell>{getRiskBadge(record.riskLevel)}</TableCell>
                          <TableCell>
                            {new Date(record.startDate).toLocaleDateString('zh-TW')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(record)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(record.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    暫無記錄
                  </div>
                ) : (
                  filteredRecords.map((record: LoanInvestmentRecord) => (
                    <Card key={record.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{record.itemName}</h3>
                            <div className="flex gap-2 mt-1">
                              {getRecordTypeBadge(record.recordType)}
                              {getStatusBadge(record.status)}
                              {getRiskBadge(record.riskLevel)}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRecordForPayments(record);
                                setPaymentHistoryOpen(true);
                              }}
                            >
                              <Receipt className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(record)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(record.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">當事人：</span>
                            <div className="font-medium">{record.partyName}</div>
                            {record.partyRelationship && (
                              <div className="text-xs text-muted-foreground">
                                {record.partyRelationship}
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-muted-foreground">本金：</span>
                            <div className="font-medium text-lg">
                              ${parseFloat(record.principalAmount).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">年利率：</span>
                            <div className="font-medium">{record.annualInterestRate}%</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">開始日期：</span>
                            <div className="font-medium">
                              {new Date(record.startDate).toLocaleDateString('zh-TW')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? "編輯借貸投資記錄" : "新增借貸投資記錄"}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">基本資訊</h3>
                  
                  <FormField
                    control={form.control}
                    name="itemName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>項目名稱 *</FormLabel>
                        <FormControl>
                          <Input placeholder="請輸入項目名稱" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="recordType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>記錄類型 *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="選擇記錄類型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="loan">借出</SelectItem>
                            <SelectItem value="investment">投資</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="principalAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>本金金額 *</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="annualInterestRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>年利率 (%)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Party Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">當事人資訊</h3>
                  
                  <FormField
                    control={form.control}
                    name="partyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>當事人姓名 *</FormLabel>
                        <FormControl>
                          <Input placeholder="請輸入當事人姓名" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="partyPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>聯絡電話</FormLabel>
                        <FormControl>
                          <Input placeholder="請輸入聯絡電話" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="partyRelationship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>關係</FormLabel>
                        <FormControl>
                          <Input placeholder="例：朋友、同事、親戚" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="partyNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>當事人備註</FormLabel>
                        <FormControl>
                          <Textarea placeholder="當事人相關備註資訊" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Contract Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">合約詳情</h3>
                  
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>開始日期 *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>結束日期</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>付款方式</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="選擇付款方式" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="monthly">月付</SelectItem>
                            <SelectItem value="quarterly">季付</SelectItem>
                            <SelectItem value="annually">年付</SelectItem>
                            <SelectItem value="maturity">到期一次付清</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="installmentCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>分期期數</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Risk and Status */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">狀態與風險</h3>
                  
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>狀態</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="選擇狀態" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">進行中</SelectItem>
                            <SelectItem value="completed">已完成</SelectItem>
                            <SelectItem value="overdue">逾期</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="riskLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>風險等級</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="選擇風險等級" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">低風險</SelectItem>
                            <SelectItem value="medium">中風險</SelectItem>
                            <SelectItem value="high">高風險</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="collateralInfo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>擔保品資訊</FormLabel>
                        <FormControl>
                          <Textarea placeholder="擔保品詳細資訊" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="guarantorInfo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>保證人資訊</FormLabel>
                        <FormControl>
                          <Textarea placeholder="保證人相關資訊" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">其他資訊</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contractDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>合約簽署日期</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="maturityDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>到期日期</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="legalDocuments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>法律文件</FormLabel>
                      <FormControl>
                        <Textarea placeholder="相關法律文件資訊" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="documentNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>文件備註</FormLabel>
                      <FormControl>
                        <Textarea placeholder="文件相關備註" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>備註</FormLabel>
                      <FormControl>
                        <Textarea placeholder="其他備註資訊" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  取消
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                  )}
                  {editingRecord ? "更新" : "建立"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={paymentHistoryOpen} onOpenChange={setPaymentHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>還款記錄管理</DialogTitle>
          </DialogHeader>
          {selectedRecordForPayments && (
            <LoanPaymentHistory
              recordId={selectedRecordForPayments.id}
              recordTitle={selectedRecordForPayments.itemName}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}