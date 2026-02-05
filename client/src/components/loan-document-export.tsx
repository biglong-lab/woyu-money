import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, BarChart3, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface LoanDocumentExportProps {
  recordId: number;
  recordTitle: string;
  recordData: any;
}

export function LoanDocumentExport({ recordId, recordTitle, recordData }: LoanDocumentExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Fetch payment history for the record
  const { data: payments = [] } = useQuery<any[]>({
    queryKey: [`/api/loan-investment/records/${recordId}/payments`],
  });

  // Fetch payment statistics
  const { data: paymentStats = {} as any } = useQuery<any>({
    queryKey: [`/api/loan-investment/records/${recordId}/payment-stats`],
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const generateDocumentHTML = () => {
    const currentDate = new Date().toLocaleDateString('zh-TW');
    const progressPercentage = paymentStats.totalPayments && recordData.principalAmount 
      ? ((parseFloat(paymentStats.totalPayments) / parseFloat(recordData.principalAmount)) * 100).toFixed(1)
      : "0";

    return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${recordTitle} - 借貸投資管理報告</title>
    <style>
        body { 
            font-family: 'Microsoft JhengHei', sans-serif; 
            margin: 40px; 
            line-height: 1.6; 
            color: #333;
        }
        .header { 
            text-align: center; 
            border-bottom: 3px solid #2563eb; 
            padding-bottom: 20px; 
            margin-bottom: 30px;
        }
        .section { 
            margin: 30px 0; 
            page-break-inside: avoid;
        }
        .section-title { 
            background: #f8fafc; 
            padding: 12px 16px; 
            border-left: 4px solid #2563eb; 
            font-size: 18px; 
            font-weight: bold; 
            margin-bottom: 15px;
        }
        .info-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 15px; 
            margin: 20px 0;
        }
        .info-item { 
            padding: 12px; 
            background: #fafafa; 
            border-radius: 6px; 
            border: 1px solid #e5e7eb;
        }
        .info-label { 
            font-weight: bold; 
            color: #374151; 
            margin-bottom: 4px;
        }
        .info-value { 
            color: #1f2937; 
        }
        .payment-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0;
        }
        .payment-table th, .payment-table td { 
            border: 1px solid #d1d5db; 
            padding: 12px; 
            text-align: left;
        }
        .payment-table th { 
            background: #f3f4f6; 
            font-weight: bold;
        }
        .payment-table tr:nth-child(even) { 
            background: #f9fafb;
        }
        .status-badge { 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 12px; 
            font-weight: bold;
        }
        .status-completed { 
            background: #dcfce7; 
            color: #166534;
        }
        .status-pending { 
            background: #fef3c7; 
            color: #92400e;
        }
        .progress-bar { 
            width: 100%; 
            height: 20px; 
            background: #e5e7eb; 
            border-radius: 10px; 
            overflow: hidden; 
            margin: 10px 0;
        }
        .progress-fill { 
            height: 100%; 
            background: linear-gradient(90deg, #10b981, #059669); 
            transition: width 0.3s ease;
        }
        .summary-box { 
            background: #eff6ff; 
            border: 1px solid #bfdbfe; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0;
        }
        .footer { 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #d1d5db; 
            text-align: center; 
            color: #6b7280; 
            font-size: 14px;
        }
        .risk-high { color: #dc2626; font-weight: bold; }
        .risk-medium { color: #d97706; font-weight: bold; }
        .risk-low { color: #059669; font-weight: bold; }
        
        @media print {
            body { margin: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${recordTitle}</h1>
        <h2>借貸投資管理報告</h2>
        <p>報告生成日期：${currentDate}</p>
    </div>

    <div class="section">
        <div class="section-title">基本資訊</div>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">記錄類型</div>
                <div class="info-value">${recordData.recordType === 'loan' ? '借貸 (我方借入)' : '投資 (我方投出)'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">對方姓名</div>
                <div class="info-value">${recordData.partyName || '未設定'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">關係</div>
                <div class="info-value">${recordData.partyRelationship || '未設定'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">聯絡電話</div>
                <div class="info-value">${recordData.partyPhone || '未提供'}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">財務詳情</div>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">本金金額</div>
                <div class="info-value">${formatCurrency(recordData.principalAmount)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">年利率</div>
                <div class="info-value ${parseFloat(recordData.annualInterestRate) > 10 ? 'risk-high' : parseFloat(recordData.annualInterestRate) > 5 ? 'risk-medium' : 'risk-low'}">${recordData.annualInterestRate}%</div>
            </div>
            <div class="info-item">
                <div class="info-label">開始日期</div>
                <div class="info-value">${recordData.startDate ? format(new Date(recordData.startDate), 'yyyy/MM/dd') : '未設定'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">預計結束日期</div>
                <div class="info-value">${recordData.endDate ? format(new Date(recordData.endDate), 'yyyy/MM/dd') : '未設定'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">每月付款金額</div>
                <div class="info-value">${recordData.monthlyPaymentAmount ? formatCurrency(recordData.monthlyPaymentAmount) : '未設定'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">目前狀態</div>
                <div class="info-value">
                    <span class="status-badge ${recordData.status === 'active' ? 'status-pending' : 'status-completed'}">
                        ${recordData.status === 'active' ? '進行中' : '已完成'}
                    </span>
                </div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">還款進度</div>
        <div class="summary-box">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span><strong>總還款進度：${progressPercentage}%</strong></span>
                <span><strong>已付金額：${formatCurrency(paymentStats.totalPayments || 0)}</strong></span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progressPercentage}%"></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                <span>剩餘金額：${formatCurrency(parseFloat(recordData.principalAmount) - parseFloat(paymentStats.totalPayments || 0))}</span>
                <span>還款筆數：${paymentStats.paymentCount || 0} 筆</span>
            </div>
        </div>
    </div>

    ${payments.length > 0 ? `
    <div class="section">
        <div class="section-title">還款記錄明細</div>
        <table class="payment-table">
            <thead>
                <tr>
                    <th>日期</th>
                    <th>金額</th>
                    <th>類型</th>
                    <th>付款方式</th>
                    <th>狀態</th>
                    <th>備註</th>
                </tr>
            </thead>
            <tbody>
                ${payments.map((payment: any) => `
                    <tr>
                        <td>${format(new Date(payment.paymentDate), 'yyyy/MM/dd')}</td>
                        <td>${formatCurrency(payment.amount)}</td>
                        <td>${payment.paymentType === 'interest' ? '利息' : payment.paymentType === 'principal' ? '本金' : '本金+利息'}</td>
                        <td>${payment.paymentMethod === 'cash' ? '現金' : payment.paymentMethod === 'bank_transfer' ? '銀行轉帳' : payment.paymentMethod === 'check' ? '支票' : '其他'}</td>
                        <td>
                            <span class="status-badge ${payment.paymentStatus === 'completed' ? 'status-completed' : 'status-pending'}">
                                ${payment.paymentStatus === 'completed' ? '已完成' : '待處理'}
                            </span>
                        </td>
                        <td>${payment.notes || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${recordData.notes || recordData.documentNotes ? `
    <div class="section">
        <div class="section-title">備註資訊</div>
        ${recordData.notes ? `
            <div class="info-item">
                <div class="info-label">資金狀況備註</div>
                <div class="info-value">${recordData.notes}</div>
            </div>
        ` : ''}
        ${recordData.documentNotes ? `
            <div class="info-item">
                <div class="info-label">文件相關備註</div>
                <div class="info-value">${recordData.documentNotes}</div>
            </div>
        ` : ''}
    </div>
    ` : ''}

    <div class="footer">
        <p>此報告由借貸投資管理系統自動生成 | 生成時間：${new Date().toLocaleString('zh-TW')}</p>
        <p>※ 本報告僅供參考，實際交易請以正式合約文件為準</p>
    </div>
</body>
</html>
    `;
  };

  const handleExportHTML = () => {
    setIsExporting(true);
    try {
      const htmlContent = generateDocumentHTML();
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${recordTitle}_借貸投資報告_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } finally {
      setIsExporting(false);
      setExportDialogOpen(false);
    }
  };

  const handlePrintPreview = () => {
    const htmlContent = generateDocumentHTML();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  return (
    <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-blue-600 hover:text-blue-700">
          <Download className="h-4 w-4 mr-2" />
          文件輸出
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>文件輸出選項</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                包含內容
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">基本資訊</Badge>
                <span className="text-sm text-muted-foreground">借貸人、金額、利率等</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">還款記錄</Badge>
                <span className="text-sm text-muted-foreground">{payments.length} 筆還款明細</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">進度追蹤</Badge>
                <span className="text-sm text-muted-foreground">視覺化還款進度</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">統計分析</Badge>
                <span className="text-sm text-muted-foreground">總計金額、完成度等</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Button 
              onClick={handlePrintPreview} 
              className="w-full"
              variant="outline"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              預覽報告
            </Button>
            
            <Button 
              onClick={handleExportHTML} 
              disabled={isExporting}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "導出中..." : "下載 HTML 報告"}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            報告包含所有款項記錄、還款資訊和進度圖表，
            適合列印或數位保存使用
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}