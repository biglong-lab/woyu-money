import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LoanCalculatorEnhanced } from "@/components/loan-calculator-enhanced";
import { LoanDocumentUpload } from "@/components/loan-document-upload";
import { TableSkeleton, StatsSkeleton } from "@/components/table-skeleton";
import { LoanAnalyticsCharts } from "@/components/responsive-chart";
import { SmartAlertsPanel } from "@/components/smart-alerts";
import LoanPaymentHistory from "@/components/loan-payment-history";
import { LoanDocumentExport } from "@/components/loan-document-export";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  DollarSign,
  Calendar,
  TrendingUp,
  FileText,
  CreditCard,
  Calculator,
  Paperclip,
  Receipt,
  Download,
  BarChart3,
} from "lucide-react";


// Enhanced schema for the new loan/investment structure
const loanInvestmentSchema = z.object({
  itemName: z.string().min(1, "項目名稱不能為空"),
  recordType: z.enum(["loan", "investment"], {
    required_error: "請選擇類型",
  }),
  
  // 基本資料：借方/資方資料
  partyName: z.string().min(1, "姓名不能為空"),
  partyPhone: z.string().optional(),
  partyRelationship: z.string().optional(),
  partyNotes: z.string().optional(),
  
  // 金額和利息
  principalAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  annualInterestRate: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  
  // 時間安排
  startDate: z.string(),
  endDate: z.string().optional(),
  
  // 借貸特有欄位
  interestPaymentMethod: z.enum(["yearly", "monthly", "agreed_date"]).optional(),
  monthlyPaymentAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  agreedPaymentDay: z.union([z.string(), z.number()]).transform((val) => parseInt(val.toString())).optional(),
  annualPaymentDate: z.string().optional(),
  
  // 投資特有欄位
  fixedReturnRate: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  otherReturnPlan: z.string().optional(),
  hasAgreedReturn: z.boolean().optional(),
  returnMethod: z.enum(["lump_sum", "installment"]).optional(),
  installmentCount: z.union([z.string(), z.number()]).transform((val) => parseInt(val.toString())).optional(),
  installmentAmount: z.union([z.string(), z.number()]).transform((val) => val.toString()).optional(),
  
  // 合約和文件
  contractFileUrl: z.string().optional(),
  documentNotes: z.string().optional(),
  
  // 備註
  notes: z.string().optional(),
  
  // 狀態管理
  status: z.enum(["active", "completed", "overdue"]).optional(),
});

interface LoanInvestmentRecord {
  id: number;
  itemName: string;
  recordType: "loan" | "investment";
  partyName: string;
  partyPhone?: string;
  partyRelationship?: string;
  partyNotes?: string;
  principalAmount: string;
  annualInterestRate: string;
  startDate: string;
  endDate?: string;
  interestPaymentMethod?: string;
  monthlyPaymentAmount?: string;
  agreedPaymentDay?: number;
  annualPaymentDate?: string;
  fixedReturnRate?: string;
  otherReturnPlan?: string;
  hasAgreedReturn?: boolean;
  returnMethod?: string;
  installmentCount?: number;
  installmentAmount?: string;
  status: string;
  totalPaidAmount: string;
  isHighRisk: boolean;
  contractFileUrl?: string;
  documentNotes?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface LoanStats {
  totalLoanAmount: string;
  activeLoanAmount: string;
  totalInvestmentAmount: string;
  activeInvestmentAmount: string;
  monthlyInterestTotal: string;
  dueSoonAmount: string;
  thisMonthDue: string;
  nextMonthDue: string;
  quarterDue: string;
  highRiskCount: number;
}

export default function LoanInvestmentEnhanced() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LoanInvestmentRecord | null>(null);
  const [quickPaymentDialogOpen, setQuickPaymentDialogOpen] = useState(false);
  const [quickPaymentForm, setQuickPaymentForm] = useState({
    amount: "",
    paymentType: "interest" as "interest" | "principal" | "mixed",
    paymentMethod: "cash" as "cash" | "bank_transfer" | "check" | "other",
    notes: "",
    paymentDate: new Date().toISOString().split('T')[0]
  });

  // Form setup
  const form = useForm<z.infer<typeof loanInvestmentSchema>>({
    resolver: zodResolver(loanInvestmentSchema),
    defaultValues: {
      recordType: "loan",
      hasAgreedReturn: false,
    },
  });

  // Queries
  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ["/api/loan-investment/records"],
  });

  const { data: stats = {} as LoanStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/loan-investment/stats"],
  });

  // 確保 stats 的類型安全
  const safeStats = stats as LoanStats;
  const safeRecords = records as LoanInvestmentRecord[];

  // Mutations
  const addRecordMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/loan-investment/records", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      setAddDialogOpen(false);
      form.reset();
      toast({
        title: "成功",
        description: "借貸投資紀錄已新增",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "新增失敗",
        variant: "destructive",
      });
    },
  });

  const updateRecordMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/loan-investment/records/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      setEditDialogOpen(false);
      toast({
        title: "成功",
        description: "借貸投資紀錄已更新",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "更新失敗",
        variant: "destructive",
      });
    },
  });

  const deleteRecordMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/loan-investment/records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      setDeleteDialogOpen(false);
      setSelectedRecord(null);
      toast({
        title: "成功",
        description: "借貸投資紀錄已刪除",
      });
    },
    onError: (error: any) => {
      toast({
        title: "錯誤",
        description: error.message || "刪除失敗",
        variant: "destructive",
      });
    },
  });

  // Quick payment mutation
  const quickPaymentMutation = useMutation({
    mutationFn: async ({ recordId, paymentData }: { recordId: number; paymentData: any }) => {
      return apiRequest("POST", `/api/loan-investment/records/${recordId}/payments`, paymentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-investment/stats"] });
      setQuickPaymentDialogOpen(false);
      setSelectedRecord(null);
      setQuickPaymentForm({
        amount: "",
        paymentType: "interest",
        paymentMethod: "cash",
        notes: "",
        paymentDate: new Date().toISOString().split('T')[0]
      });
      toast({
        title: "還款記錄新增成功",
        description: "還款已成功記錄",
      });
    },
    onError: (error: any) => {
      toast({
        title: "新增還款記錄失敗",
        description: error.message || "新增失敗",
        variant: "destructive",
      });
    },
  });

  // Enhanced calculation functions
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const calculateMonthlyInterest = (principal: string, rate: string) => {
    const p = parseFloat(principal);
    const r = parseFloat(rate);
    return (p * r) / 100 / 12;
  };

  const isHighRisk = (rate: string) => {
    return parseFloat(rate) >= 15;
  };

  // 根據借款金額和每月還款推算年利率
  const calculateAnnualRateFromMonthlyPayment = (principal: number, monthlyPayment: number, termYears: number = 1) => {
    if (principal <= 0 || monthlyPayment <= 0) return 0;
    
    // 簡化計算：假設為利息型還款，非本金攤還
    const totalInterestPerYear = monthlyPayment * 12;
    const annualRate = (totalInterestPerYear / principal) * 100;
    return Math.round(annualRate * 100) / 100; // 保留2位小數
  };

  // 根據借款金額、年利率計算每月利息
  const calculateMonthlyInterestFromRate = (principal: number, annualRate: number) => {
    if (principal <= 0 || annualRate <= 0) return 0;
    return (principal * annualRate / 100) / 12;
  };

  // 本利攤還計算（等額本息）
  const calculateEqualInstallment = (principal: number, annualRate: number, termYears: number) => {
    if (principal <= 0 || annualRate <= 0 || termYears <= 0) return 0;
    
    const monthlyRate = annualRate / 100 / 12;
    const totalMonths = termYears * 12;
    
    if (monthlyRate === 0) return principal / totalMonths;
    
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / 
                          (Math.pow(1 + monthlyRate, totalMonths) - 1);
    
    return Math.round(monthlyPayment);
  };

  // 風險評估
  const getRiskLevel = (rate: number) => {
    if (rate >= 25) return { level: "極高風險", color: "bg-red-600", textColor: "text-red-600" };
    if (rate >= 20) return { level: "高風險", color: "bg-red-500", textColor: "text-red-500" };
    if (rate >= 15) return { level: "中高風險", color: "bg-orange-500", textColor: "text-orange-500" };
    if (rate >= 10) return { level: "中等風險", color: "bg-yellow-500", textColor: "text-yellow-600" };
    if (rate >= 5) return { level: "低風險", color: "bg-green-500", textColor: "text-green-600" };
    return { level: "極低風險", color: "bg-blue-500", textColor: "text-blue-600" };
  };

  // 生成攤提計算表
  const generateAmortizationSchedule = (record: LoanInvestmentRecord) => {
    if (!record.monthlyPaymentAmount || !record.principalAmount || !record.annualInterestRate) {
      return [];
    }

    const principal = parseFloat(record.principalAmount);
    const monthlyPayment = parseFloat(record.monthlyPaymentAmount);
    const annualRate = parseFloat(record.annualInterestRate) / 100;
    const monthlyRate = annualRate / 12;

    let remainingBalance = principal;
    const schedule = [];
    let period = 1;

    while (remainingBalance > 0 && period <= 360) { // 最多30年
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = Math.min(monthlyPayment - interestPayment, remainingBalance);
      
      if (principalPayment <= 0) break;

      remainingBalance -= principalPayment;

      schedule.push({
        period,
        principal: principalPayment,
        interest: interestPayment,
        monthlyPayment: principalPayment + interestPayment,
        remainingBalance: Math.max(0, remainingBalance)
      });

      period++;
      if (remainingBalance < 0.01) break; // 基本還清時停止
    }

    return schedule.slice(0, 24); // 只顯示前24期
  };

  // Event handlers
  const onSubmit = (data: any) => {
    // Check if high risk and set flag
    const enhancedData = {
      ...data,
      isHighRisk: isHighRisk(data.annualInterestRate),
    };
    addRecordMutation.mutate(enhancedData);
  };

  const onEditSubmit = (data: any) => {
    if (!selectedRecord) return;
    
    console.log("Edit form data:", data);
    console.log("Selected record ID:", selectedRecord.id);
    
    // 轉換數字欄位並清理空值
    const enhancedData = {
      ...data,
      // 轉換數字字串為數字
      agreedPaymentDay: data.agreedPaymentDay ? parseInt(data.agreedPaymentDay) : null,
      installmentCount: data.installmentCount ? parseInt(data.installmentCount) : null,
      isHighRisk: isHighRisk(data.annualInterestRate),
      // 清理空字串為null
      endDate: data.endDate || null,
      partyPhone: data.partyPhone || null,
      partyRelationship: data.partyRelationship || null,
      partyNotes: data.partyNotes || null,
    };
    
    console.log("Enhanced data for update:", enhancedData);
    updateRecordMutation.mutate({ id: selectedRecord.id, data: enhancedData });
  };

  const openEditDialog = (record: LoanInvestmentRecord) => {
    setSelectedRecord(record);
    
    // 轉換數據以匹配表單schema和資料庫欄位
    const formData = {
      itemName: record.itemName || "",
      recordType: record.recordType || "loan",
      principalAmount: record.principalAmount || "",
      partyName: record.partyName || "",
      partyPhone: record.partyPhone || "",
      partyRelationship: record.partyRelationship || "",
      partyNotes: record.partyNotes || "",
      annualInterestRate: record.annualInterestRate || "",
      monthlyPaymentAmount: record.monthlyPaymentAmount || "",
      agreedPaymentDay: record.agreedPaymentDay?.toString() || "",
      interestPaymentMethod: record.interestPaymentMethod || "monthly",
      startDate: record.startDate || "",
      endDate: record.endDate || "",
      status: record.status || "active",
      notes: record.notes || "",
      
      // 投資相關字段
      fixedReturnRate: record.fixedReturnRate || "",
      otherReturnPlan: record.otherReturnPlan || "",
      hasAgreedReturn: record.hasAgreedReturn || false,
      returnMethod: record.returnMethod || "",
      installmentCount: record.installmentCount?.toString() || "",
      installmentAmount: record.installmentAmount || "",
      annualPaymentDate: record.annualPaymentDate || "",
    };
    
    form.reset(formData);
    setEditDialogOpen(true);
  };

  const openDetailDialog = (record: LoanInvestmentRecord) => {
    setSelectedRecord(record);
    setDetailDialogOpen(true);
  };

  const openDeleteDialog = (record: LoanInvestmentRecord) => {
    setSelectedRecord(record);
    setDeleteDialogOpen(true);
  };

  const openQuickPaymentDialog = (record: LoanInvestmentRecord) => {
    setSelectedRecord(record);
    // Calculate suggested payment amount based on type
    const monthlyInterest = calculateMonthlyInterest(record.principalAmount, record.annualInterestRate);
    setQuickPaymentForm(prev => ({
      ...prev,
      amount: monthlyInterest.toString()
    }));
    setQuickPaymentDialogOpen(true);
  };

  const handleQuickPayment = () => {
    if (!selectedRecord || !quickPaymentForm.amount) return;
    
    const paymentData = {
      amount: quickPaymentForm.amount,
      paymentType: quickPaymentForm.paymentType,
      paymentMethod: quickPaymentForm.paymentMethod,
      paymentDate: quickPaymentForm.paymentDate,
      notes: quickPaymentForm.notes,
      paymentStatus: "completed",
      isVerified: true,
      recordedBy: "系統用戶"
    };

    quickPaymentMutation.mutate({ 
      recordId: selectedRecord.id, 
      paymentData 
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* 統計數據與風險分析區 - 兩列布局 */}
      {!statsLoading && !recordsLoading && safeRecords.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 左側：風險分析圓餅圖 */}
          <div>
            <LoanAnalyticsCharts records={safeRecords} />
          </div>
          
          {/* 右側：統計卡片直列排列 */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">總金額</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(safeStats.totalLoanAmount || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  借貸: {formatCurrency(safeStats.activeLoanAmount || 0)} | 
                  投資: {formatCurrency(safeStats.activeInvestmentAmount || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">平均利率</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {safeRecords.length > 0 
                    ? (safeRecords.reduce((sum, r) => sum + parseFloat(r.annualInterestRate || "0"), 0) / safeRecords.length).toFixed(1)
                    : "0.0"
                  }%
                </div>
                <p className="text-xs text-muted-foreground">
                  活躍項目平均年利率
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">高風險項目</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{safeStats.highRiskCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  利息15%以上需優先處理
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">活躍項目</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {safeRecords.filter((r: LoanInvestmentRecord) => r.status === "active").length}
                </div>
                <p className="text-xs text-muted-foreground">
                  進行中的借貸投資項目
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 備用統計區（當沒有數據時顯示） */}
      {(statsLoading || recordsLoading || safeRecords.length === 0) && (
        <>
          {statsLoading ? (
            <StatsSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">總金額</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">無數據</div>
                  <p className="text-xs text-muted-foreground">
                    尚未建立借貸投資記錄
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* 主要內容區 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>借貸投資管理</CardTitle>
              <CardDescription>
                紀錄借貸金額，管理大筆的借貸、投資資金，進行完整的資金追蹤
              </CardDescription>
            </div>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新增紀錄
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recordsLoading ? (
            <TableSkeleton rows={5} columns={8} showHeader={false} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>項目名稱</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>對方</TableHead>
                  <TableHead>本金</TableHead>
                  <TableHead>年息</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>進度</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeRecords.map((record: LoanInvestmentRecord) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {record.itemName}
                        {record.isHighRisk && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            高風險
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.recordType === "loan" ? "destructive" : "default"}>
                        {record.recordType === "loan" ? "借貸" : "投資"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.partyName}</div>
                        <div className="text-sm text-muted-foreground">
                          {record.partyRelationship || "未設定"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(record.principalAmount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={getRiskLevel(parseFloat(record.annualInterestRate)).textColor + " font-medium"}>
                          {record.annualInterestRate}%
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getRiskLevel(parseFloat(record.annualInterestRate)).color} text-white border-0`}
                        >
                          {getRiskLevel(parseFloat(record.annualInterestRate)).level}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.status === "active" ? "default" : "secondary"}>
                        {record.status === "active" ? "進行中" : "已完成"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="w-20">
                        <Progress 
                          value={Math.min((parseFloat(record.totalPaidAmount) / parseFloat(record.principalAmount)) * 100, 100)} 
                          className="h-2"
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                          {((parseFloat(record.totalPaidAmount) / parseFloat(record.principalAmount)) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openDetailDialog(record)}
                          title="查看詳細資訊"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openQuickPaymentDialog(record)}
                          title="快速還款"
                          className="text-green-600 hover:text-green-700"
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openDetailDialog(record)}
                          title="還款紀錄"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Receipt className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openEditDialog(record)}
                          title="編輯"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openDeleteDialog(record)}
                          title="刪除"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Record Details Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" aria-describedby="detail-record-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedRecord?.itemName} - 詳細資訊
            </DialogTitle>
            <DialogDescription id="detail-record-description">
              完整的借貸/投資資訊，包含攤提計算和付款紀錄
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-6">
              {/* 基本資訊區塊 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">基本資訊</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">類型:</span>
                      <Badge variant={selectedRecord.recordType === "loan" ? "destructive" : "default"}>
                        {selectedRecord.recordType === "loan" ? "借貸" : "投資"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">本金:</span>
                      <span className="font-medium">{formatCurrency(selectedRecord.principalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">年息:</span>
                      <div className="flex items-center gap-2">
                        <span className={getRiskLevel(parseFloat(selectedRecord.annualInterestRate)).textColor + " font-medium"}>
                          {selectedRecord.annualInterestRate}%
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getRiskLevel(parseFloat(selectedRecord.annualInterestRate)).color} text-white border-0`}
                        >
                          {getRiskLevel(parseFloat(selectedRecord.annualInterestRate)).level}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">狀態:</span>
                      <Badge variant={selectedRecord.status === "active" ? "default" : "secondary"}>
                        {selectedRecord.status === "active" ? "進行中" : "已完成"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">對方資訊</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">姓名:</span>
                      <span className="font-medium">{selectedRecord.partyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">關係:</span>
                      <span>{selectedRecord.partyRelationship || "未設定"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">電話:</span>
                      <span>{selectedRecord.partyPhone || "未設定"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">還款進度</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>已付金額:</span>
                        <span className="font-medium">{formatCurrency(selectedRecord.totalPaidAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>剩餘金額:</span>
                        <span className="font-medium text-red-600">
                          {formatCurrency(parseFloat(selectedRecord.principalAmount) - parseFloat(selectedRecord.totalPaidAmount))}
                        </span>
                      </div>
                      <Progress 
                        value={Math.min((parseFloat(selectedRecord.totalPaidAmount) / parseFloat(selectedRecord.principalAmount)) * 100, 100)} 
                        className="h-3"
                      />
                      <div className="text-center text-sm text-muted-foreground">
                        {((parseFloat(selectedRecord.totalPaidAmount) / parseFloat(selectedRecord.principalAmount)) * 100).toFixed(1)}% 完成
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 攤提計算區塊 */}
              {selectedRecord.recordType === "loan" && selectedRecord.monthlyPaymentAmount && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      攤提計算表
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <div className="text-sm text-muted-foreground">每月還款</div>
                        <div className="text-lg font-bold text-blue-600">
                          {formatCurrency(selectedRecord.monthlyPaymentAmount)}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                        <div className="text-sm text-muted-foreground">月利息</div>
                        <div className="text-lg font-bold text-green-600">
                          {formatCurrency(calculateMonthlyInterestFromRate(
                            parseFloat(selectedRecord.principalAmount),
                            parseFloat(selectedRecord.annualInterestRate)
                          ))}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                        <div className="text-sm text-muted-foreground">月本金</div>
                        <div className="text-lg font-bold text-orange-600">
                          {formatCurrency(
                            parseFloat(selectedRecord.monthlyPaymentAmount) - 
                            calculateMonthlyInterestFromRate(
                              parseFloat(selectedRecord.principalAmount),
                              parseFloat(selectedRecord.annualInterestRate)
                            )
                          )}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                        <div className="text-sm text-muted-foreground">預估期數</div>
                        <div className="text-lg font-bold text-purple-600">
                          {Math.ceil(
                            parseFloat(selectedRecord.principalAmount) / 
                            (parseFloat(selectedRecord.monthlyPaymentAmount) - 
                             calculateMonthlyInterestFromRate(
                               parseFloat(selectedRecord.principalAmount),
                               parseFloat(selectedRecord.annualInterestRate)
                             ))
                          )}期
                        </div>
                      </div>
                    </div>

                    {/* 攤提明細表 */}
                    <div className="max-h-64 overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead className="w-16">期數</TableHead>
                            <TableHead>應還本金</TableHead>
                            <TableHead>應還利息</TableHead>
                            <TableHead>月付金額</TableHead>
                            <TableHead>剩餘本金</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {generateAmortizationSchedule(selectedRecord).map((payment, index) => (
                            <TableRow key={index} className={index % 2 === 0 ? "bg-muted/50" : ""}>
                              <TableCell className="font-medium">{payment.period}</TableCell>
                              <TableCell>{formatCurrency(payment.principal)}</TableCell>
                              <TableCell>{formatCurrency(payment.interest)}</TableCell>
                              <TableCell className="font-medium">{formatCurrency(payment.monthlyPayment)}</TableCell>
                              <TableCell>{formatCurrency(payment.remainingBalance)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 還款紀錄管理 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    還款紀錄管理
                  </CardTitle>
                  <CardDescription>
                    記錄和追蹤所有還款詳情，包括金額、日期、付款方式和相關文件
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LoanPaymentHistory 
                    recordId={selectedRecord.id} 
                    recordTitle={selectedRecord.itemName}
                  />
                </CardContent>
              </Card>

              {/* 文件附件 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5" />
                    相關文件
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                      <Paperclip className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">拖曳文件到此處或點擊上傳</p>
                      <Button variant="outline" size="sm">
                        選擇文件
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      支援格式：PDF、DOC、DOCX、JPG、PNG（最大 10MB）
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Record Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="add-record-description">
          <DialogHeader>
            <DialogTitle>新增借貸/投資紀錄</DialogTitle>
            <DialogDescription id="add-record-description">
              建立新的借貸或投資資金管理紀錄
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">基本資訊</TabsTrigger>
                  <TabsTrigger value="party">對方資料</TabsTrigger>
                  <TabsTrigger value="terms">條件設定</TabsTrigger>
                  <TabsTrigger value="documents">文件備註</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="itemName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>項目名稱 *</FormLabel>
                          <FormControl>
                            <Input placeholder="例：房屋貸款、股票投資..." {...field} />
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
                          <FormLabel>類型 *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="選擇類型" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="loan">借貸</SelectItem>
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
                          <FormLabel>年息 (%) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                const rate = parseFloat(e.target.value);
                                if (rate >= 15) {
                                  toast({
                                    title: "高風險提醒",
                                    description: "年息15%以上，建議優先處理",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                  </div>

                  {/* Smart Calculator Widget */}
                  <div className="mt-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                    <h4 className="text-sm font-semibold mb-3 text-blue-800 dark:text-blue-200">
                      智能計算工具
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-blue-700 dark:text-blue-300">
                          借款金額
                        </label>
                        <Input
                          type="number"
                          placeholder="輸入金額"
                          value={form.watch("principalAmount") || ""}
                          onChange={(e) => form.setValue("principalAmount", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-blue-700 dark:text-blue-300">
                          每月還款
                        </label>
                        <Input
                          type="number"
                          placeholder="輸入金額"
                          value={form.watch("monthlyPaymentAmount") || ""}
                          onChange={(e) => {
                            form.setValue("monthlyPaymentAmount", e.target.value);
                            // 自動計算年利率
                            const principal = parseFloat(form.watch("principalAmount") || "0");
                            const monthly = parseFloat(e.target.value || "0");
                            if (principal > 0 && monthly > 0) {
                              const calculatedRate = calculateAnnualRateFromMonthlyPayment(principal, monthly);
                              form.setValue("annualInterestRate", calculatedRate.toString());
                            }
                          }}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-blue-700 dark:text-blue-300">
                          年利率 (%)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="輸入利率"
                          value={form.watch("annualInterestRate") || ""}
                          onChange={(e) => {
                            form.setValue("annualInterestRate", e.target.value);
                            // 自動計算每月利息
                            const principal = parseFloat(form.watch("principalAmount") || "0");
                            const rate = parseFloat(e.target.value || "0");
                            if (principal > 0 && rate > 0) {
                              const monthlyInterest = calculateMonthlyInterestFromRate(principal, rate);
                              form.setValue("monthlyPaymentAmount", monthlyInterest.toString());
                            }
                          }}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    
                    {/* 風險提醒和計算結果顯示 */}
                    <div className="mt-3 space-y-2">
                      {form.watch("annualInterestRate") && parseFloat(form.watch("annualInterestRate") || "0") > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-blue-600 dark:text-blue-400">風險等級:</span>
                          <Badge 
                            className={`text-xs ${getRiskLevel(parseFloat(form.watch("annualInterestRate") || "0")).color} text-white`}
                          >
                            {getRiskLevel(parseFloat(form.watch("annualInterestRate") || "0")).level}
                          </Badge>
                        </div>
                      )}
                      
                      {form.watch("principalAmount") && form.watch("annualInterestRate") && (
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          月利息參考: {formatCurrency(
                            calculateMonthlyInterestFromRate(
                              parseFloat(form.watch("principalAmount") || "0"),
                              parseFloat(form.watch("annualInterestRate") || "0")
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="party" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="partyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>對方姓名 *</FormLabel>
                          <FormControl>
                            <Input placeholder="輸入姓名" {...field} />
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
                          <FormLabel>電話</FormLabel>
                          <FormControl>
                            <Input placeholder="輸入電話號碼" {...field} />
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
                            <Input placeholder="例：朋友、親戚、同事..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="partyNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>對方備註</FormLabel>
                        <FormControl>
                          <Textarea placeholder="關於對方的其他資訊..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="terms" className="space-y-4">
                  {form.watch("recordType") === "loan" && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">借貸條件設定</h3>
                      
                      <FormField
                        control={form.control}
                        name="interestPaymentMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>利息給付方式</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="選擇給付方式" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="yearly">一年付款一次</SelectItem>
                                <SelectItem value="monthly">每月給付</SelectItem>
                                <SelectItem value="agreed_date">約定給付日期</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {form.watch("interestPaymentMethod") === "monthly" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="monthlyPaymentAmount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>每月給付金額</FormLabel>
                                <FormControl>
                                  <Input type="number" placeholder="0" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="agreedPaymentDay"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>約定給付日期 (每月幾號)</FormLabel>
                                <FormControl>
                                  <Input type="number" min="1" max="31" placeholder="例：15" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      {form.watch("interestPaymentMethod") === "yearly" && (
                        <FormField
                          control={form.control}
                          name="annualPaymentDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>年度付款日期</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  )}

                  {form.watch("recordType") === "investment" && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">投資條件設定</h3>
                      
                      <FormField
                        control={form.control}
                        name="fixedReturnRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>固定回饋 (%)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="0.00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="otherReturnPlan"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>其他方案描述</FormLabel>
                            <FormControl>
                              <Textarea placeholder="描述其他回饋方案..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="hasAgreedReturn"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>約定返還</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      {form.watch("hasAgreedReturn") && (
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="returnMethod"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>返還方式</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="選擇返還方式" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="lump_sum">一次還款</SelectItem>
                                    <SelectItem value="installment">分期給付</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {form.watch("returnMethod") === "installment" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="installmentCount"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>分期數</FormLabel>
                                    <FormControl>
                                      <Input type="number" placeholder="例：12" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="installmentAmount"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>每期金額</FormLabel>
                                    <FormControl>
                                      <Input type="number" placeholder="0" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="documents" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="contractFileUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>合約文件URL</FormLabel>
                        <FormControl>
                          <Input placeholder="合約文件連結..." {...field} />
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
                        <FormLabel>文件相關備註</FormLabel>
                        <FormControl>
                          <Textarea placeholder="關於合約或文件的備註..." {...field} />
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
                        <FormLabel>資金狀況備註</FormLabel>
                        <FormControl>
                          <Textarea placeholder="此資金狀況紀錄..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={addRecordMutation.isPending}>
                  {addRecordMutation.isPending ? "處理中..." : "新增紀錄"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>借貸/投資紀錄詳情</DialogTitle>
            <DialogDescription>
              查看完整的借貸投資紀錄資訊
            </DialogDescription>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="space-y-6">
              {/* 基本資訊和風險提醒 */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold">{selectedRecord.itemName}</h3>
                  <div className="flex gap-2 mt-2">
                    <Badge variant={selectedRecord.recordType === "loan" ? "destructive" : "default"}>
                      {selectedRecord.recordType === "loan" ? "借貸" : "投資"}
                    </Badge>
                    <Badge variant={selectedRecord.status === "active" ? "default" : "secondary"}>
                      {selectedRecord.status === "active" ? "進行中" : "已完成"}
                    </Badge>
                    {selectedRecord.isHighRisk && (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        高風險 - 建議優先處理
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* 金額資訊 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">金額資訊</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">本金</p>
                    <p className="text-2xl font-bold">{formatCurrency(selectedRecord.principalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">年利率</p>
                    <p className={`text-2xl font-bold ${selectedRecord.isHighRisk ? 'text-red-600' : ''}`}>
                      {selectedRecord.annualInterestRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">已付金額</p>
                    <p className="text-xl font-semibold">{formatCurrency(selectedRecord.totalPaidAmount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">餘額</p>
                    <p className="text-xl font-semibold">
                      {formatCurrency(parseFloat(selectedRecord.principalAmount) - parseFloat(selectedRecord.totalPaidAmount || '0'))}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 對方資訊 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">對方資訊</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">姓名</p>
                      <p className="font-medium">{selectedRecord.partyName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">電話</p>
                      <p className="font-medium">{selectedRecord.partyPhone || '未提供'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">關係</p>
                      <p className="font-medium">{selectedRecord.partyRelationship || '未設定'}</p>
                    </div>
                  </div>
                  {selectedRecord.partyNotes && (
                    <div>
                      <p className="text-sm text-muted-foreground">備註</p>
                      <p className="text-sm">{selectedRecord.partyNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 條件設定 */}
              {selectedRecord.recordType === "loan" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">借貸條件</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedRecord.interestPaymentMethod && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">利息給付方式</p>
                          <p className="font-medium">
                            {selectedRecord.interestPaymentMethod === "yearly" ? "一年付款一次" :
                             selectedRecord.interestPaymentMethod === "monthly" ? "每月給付" : "約定給付日期"}
                          </p>
                        </div>
                        {selectedRecord.monthlyPaymentAmount && (
                          <div>
                            <p className="text-sm text-muted-foreground">每月給付金額</p>
                            <p className="font-medium">{formatCurrency(selectedRecord.monthlyPaymentAmount)}</p>
                          </div>
                        )}
                        {selectedRecord.agreedPaymentDay && (
                          <div>
                            <p className="text-sm text-muted-foreground">約定給付日</p>
                            <p className="font-medium">每月 {selectedRecord.agreedPaymentDay} 日</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {selectedRecord.recordType === "investment" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">投資條件</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      {selectedRecord.fixedReturnRate && (
                        <div>
                          <p className="text-sm text-muted-foreground">固定回饋</p>
                          <p className="font-medium">{selectedRecord.fixedReturnRate}%</p>
                        </div>
                      )}
                      {selectedRecord.hasAgreedReturn && (
                        <div>
                          <p className="text-sm text-muted-foreground">約定返還</p>
                          <p className="font-medium">
                            {selectedRecord.returnMethod === "lump_sum" ? "一次還款" : "分期給付"}
                          </p>
                        </div>
                      )}
                    </div>
                    {selectedRecord.otherReturnPlan && (
                      <div>
                        <p className="text-sm text-muted-foreground">其他方案</p>
                        <p className="text-sm">{selectedRecord.otherReturnPlan}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 還款進度 */}
              {selectedRecord.totalPaidAmount && parseFloat(selectedRecord.totalPaidAmount) > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">還款進度</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress 
                      value={Math.min((parseFloat(selectedRecord.totalPaidAmount) / parseFloat(selectedRecord.principalAmount)) * 100, 100)} 
                      className="h-4"
                    />
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      {((parseFloat(selectedRecord.totalPaidAmount) / parseFloat(selectedRecord.principalAmount)) * 100).toFixed(1)}% 已完成
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* 文件和備註 */}
              {(selectedRecord.contractFileUrl || selectedRecord.documentNotes || selectedRecord.notes) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">文件與備註</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedRecord.contractFileUrl && (
                      <div>
                        <p className="text-sm text-muted-foreground">合約文件</p>
                        <a 
                          href={selectedRecord.contractFileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          <FileText className="h-4 w-4 inline mr-1" />
                          查看合約文件
                        </a>
                      </div>
                    )}
                    {selectedRecord.documentNotes && (
                      <div>
                        <p className="text-sm text-muted-foreground">文件備註</p>
                        <p className="text-sm">{selectedRecord.documentNotes}</p>
                      </div>
                    )}
                    {selectedRecord.notes && (
                      <div>
                        <p className="text-sm text-muted-foreground">資金狀況備註</p>
                        <p className="text-sm">{selectedRecord.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              關閉
            </Button>
            {selectedRecord && (
              <LoanDocumentExport 
                recordId={selectedRecord.id}
                recordTitle={selectedRecord.itemName}
                recordData={selectedRecord}
              />
            )}
            {selectedRecord && selectedRecord.status === "active" && (
              <>
                <Button onClick={() => {
                  setDetailDialogOpen(false);
                  setPaymentDialogOpen(true);
                }}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  記錄付款
                </Button>
                <Button variant="outline" onClick={() => {
                  setDetailDialogOpen(false);
                  openEditDialog(selectedRecord);
                }}>
                  <Edit className="h-4 w-4 mr-2" />
                  編輯紀錄
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog - reuse the same form structure as Add Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯借貸/投資紀錄</DialogTitle>
            <DialogDescription>
              修改現有的借貸或投資資金管理紀錄
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
              {/* Same form structure as Add Dialog */}
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={updateRecordMutation.isPending}>
                  {updateRecordMutation.isPending ? "處理中..." : "更新紀錄"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Record Detail Dialog with Document Management */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="record-detail-description">
          <DialogHeader>
            <DialogTitle>借貸投資紀錄詳情</DialogTitle>
            <DialogDescription id="record-detail-description">
              查看詳細資訊與管理相關文件
            </DialogDescription>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">基本資訊</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">項目名稱:</span> {selectedRecord.itemName}</div>
                    <div>
                      <span className="font-medium">類型:</span> 
                      <Badge variant={selectedRecord.recordType === "loan" ? "destructive" : "default"} className="ml-2">
                        {selectedRecord.recordType === "loan" ? "借貸" : "投資"}
                      </Badge>
                    </div>
                    <div><span className="font-medium">本金:</span> {formatCurrency(selectedRecord.principalAmount)}</div>
                    <div>
                      <span className="font-medium">年息:</span> 
                      <span className={selectedRecord.isHighRisk ? "text-red-600 font-bold ml-1" : "ml-1"}>
                        {selectedRecord.annualInterestRate}%
                      </span>
                      {selectedRecord.isHighRisk && (
                        <Badge variant="destructive" className="ml-2 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          高風險
                        </Badge>
                      )}
                    </div>
                    <div><span className="font-medium">狀態:</span> 
                      <Badge variant={selectedRecord.status === "active" ? "default" : "secondary"} className="ml-2">
                        {selectedRecord.status === "active" ? "進行中" : "已完成"}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">對方資訊</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">姓名:</span> {selectedRecord.partyName}</div>
                    <div><span className="font-medium">電話:</span> {selectedRecord.partyPhone || "未設定"}</div>
                    <div><span className="font-medium">關係:</span> {selectedRecord.partyRelationship || "未設定"}</div>
                    {selectedRecord.partyNotes && (
                      <div><span className="font-medium">備註:</span> {selectedRecord.partyNotes}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Progress */}
              <div>
                <h3 className="font-semibold mb-2">付款進度</h3>
                <div className="space-y-2">
                  <Progress 
                    value={Math.min((parseFloat(selectedRecord.totalPaidAmount) / parseFloat(selectedRecord.principalAmount)) * 100, 100)} 
                    className="h-3"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>已付: {formatCurrency(selectedRecord.totalPaidAmount)}</span>
                    <span>{((parseFloat(selectedRecord.totalPaidAmount) / parseFloat(selectedRecord.principalAmount)) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Date Information */}
              <div>
                <h3 className="font-semibold mb-2">日期資訊</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">開始日期:</span> {selectedRecord.startDate}</div>
                  <div><span className="font-medium">結束日期:</span> {selectedRecord.endDate || "未設定"}</div>
                </div>
              </div>

              {/* Document Management */}
              {selectedRecord.id && (
                <div>
                  <LoanDocumentUpload recordId={selectedRecord.id} />
                </div>
              )}

              {/* Notes */}
              {selectedRecord.notes && (
                <div>
                  <h3 className="font-semibold mb-2">備註</h3>
                  <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded">{selectedRecord.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-record-description">
          <DialogHeader>
            <DialogTitle>編輯借貸/投資紀錄</DialogTitle>
            <DialogDescription id="edit-record-description">
              修改現有的借貸或投資資金管理紀錄
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="itemName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>項目名稱 *</FormLabel>
                        <FormControl>
                          <Input placeholder="例：房屋貸款、股票投資..." {...field} />
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
                        <FormLabel>紀錄類型 *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="選擇類型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="loan">借貸 (我方借入)</SelectItem>
                            <SelectItem value="investment">投資 (我方投出)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="principalAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>本金 *</FormLabel>
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
                        <FormLabel>年利率 (%) *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="partyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>對方姓名</FormLabel>
                        <FormControl>
                          <Input placeholder="輸入姓名..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="monthlyPaymentAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>每月付款金額</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>開始日期</FormLabel>
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
                        <FormLabel>預計結束日期</FormLabel>
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
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>備註</FormLabel>
                      <FormControl>
                        <Textarea placeholder="輸入備註..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={updateRecordMutation.isPending}>
                  {updateRecordMutation.isPending ? "更新中..." : "更新紀錄"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent aria-describedby="delete-confirmation-description">
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription id="delete-confirmation-description">
              您確定要刪除這筆借貸投資紀錄嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="py-4">
              <p className="font-medium">{selectedRecord.itemName}</p>
              <p className="text-sm text-muted-foreground">
                {selectedRecord.recordType === "loan" ? "借貸" : "投資"} - {formatCurrency(selectedRecord.principalAmount)}
              </p>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedRecord && deleteRecordMutation.mutate(selectedRecord.id)}
              disabled={deleteRecordMutation.isPending}
            >
              {deleteRecordMutation.isPending ? "刪除中..." : "確定刪除"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Payment Dialog */}
      <Dialog open={quickPaymentDialogOpen} onOpenChange={setQuickPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>快速還款記錄</DialogTitle>
            <DialogDescription>
              為 {selectedRecord?.itemName} 記錄還款
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="paymentAmount">還款金額 *</Label>
              <Input
                id="paymentAmount"
                type="number"
                value={quickPaymentForm.amount}
                onChange={(e) => setQuickPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="paymentType">還款類型</Label>
              <Select 
                value={quickPaymentForm.paymentType} 
                onValueChange={(value: "interest" | "principal" | "mixed") => 
                  setQuickPaymentForm(prev => ({ ...prev, paymentType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interest">利息</SelectItem>
                  <SelectItem value="principal">本金</SelectItem>
                  <SelectItem value="mixed">本金+利息</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="paymentMethod">付款方式</Label>
              <Select 
                value={quickPaymentForm.paymentMethod} 
                onValueChange={(value: "cash" | "bank_transfer" | "check" | "other") => 
                  setQuickPaymentForm(prev => ({ ...prev, paymentMethod: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">現金</SelectItem>
                  <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                  <SelectItem value="check">支票</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="paymentDate">還款日期</Label>
              <Input
                id="paymentDate"
                type="date"
                value={quickPaymentForm.paymentDate}
                onChange={(e) => setQuickPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="paymentNotes">備註</Label>
              <Textarea
                id="paymentNotes"
                value={quickPaymentForm.notes}
                onChange={(e) => setQuickPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="還款相關備註..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setQuickPaymentDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleQuickPayment} 
              disabled={quickPaymentMutation.isPending || !quickPaymentForm.amount}
            >
              {quickPaymentMutation.isPending ? "記錄中..." : "記錄還款"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}