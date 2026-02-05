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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoanDocumentUpload } from "@/components/loan-document-upload";
import LoanPaymentHistory from "@/components/loan-payment-history";
import { LoanDocumentExport } from "@/components/loan-document-export";
import {
  Edit,
  AlertTriangle,
  FileText,
  CreditCard,
  Calculator,
  Paperclip,
  Receipt,
} from "lucide-react";
import type { LoanInvestmentRecord } from "./loan-enhanced-types";
import {
  formatCurrency,
  getRiskLevel,
  calculateMonthlyInterestFromRate,
  generateAmortizationSchedule,
} from "./loan-enhanced-types";

// ==========================================
// 借貸投資管理 - 詳情 Dialog（完整版，含攤提/還款/文件）
// ==========================================

export interface LoanEnhancedDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: LoanInvestmentRecord | null;
  onEdit: (record: LoanInvestmentRecord) => void;
  onRecordPayment: () => void;
}

export function LoanEnhancedDetailDialog({
  open,
  onOpenChange,
  record,
  onEdit,
  onRecordPayment,
}: LoanEnhancedDetailDialogProps) {
  if (!record) return null;

  const riskLevel = getRiskLevel(parseFloat(record.annualInterestRate));
  const paidPercent = Math.min(
    (parseFloat(record.totalPaidAmount) / parseFloat(record.principalAmount)) * 100,
    100
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl max-h-[90vh] overflow-y-auto"
        aria-describedby="detail-record-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {record.itemName} - 詳細資訊
          </DialogTitle>
          <DialogDescription id="detail-record-description">
            完整的借貸/投資資訊，包含攤提計算和付款紀錄
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本資訊區塊 */}
          <BasicInfoCards record={record} riskLevel={riskLevel} paidPercent={paidPercent} />

          {/* 攤提計算區塊 */}
          {record.recordType === "loan" && record.monthlyPaymentAmount && (
            <AmortizationSection record={record} />
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
                recordId={record.id}
                recordTitle={record.itemName}
              />
            </CardContent>
          </Card>

          {/* 文件管理 */}
          {record.id && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  相關文件
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LoanDocumentUpload recordId={record.id} />
              </CardContent>
            </Card>
          )}

          {/* 條件詳情 */}
          <TermsDetailSection record={record} />

          {/* 文件與備註 */}
          <NotesSection record={record} />
        </div>

        {/* 底部操作按鈕 */}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
          <LoanDocumentExport
            recordId={record.id}
            recordTitle={record.itemName}
            recordData={record}
          />
          {record.status === "active" && (
            <>
              <Button onClick={onRecordPayment}>
                <CreditCard className="h-4 w-4 mr-2" />
                記錄付款
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(record);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                編輯紀錄
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 內部子元件：基本資訊卡片
// ==========================================

function BasicInfoCards({
  record,
  riskLevel,
  paidPercent,
}: {
  record: LoanInvestmentRecord;
  riskLevel: ReturnType<typeof getRiskLevel>;
  paidPercent: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">基本資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">類型:</span>
            <Badge variant={record.recordType === "loan" ? "destructive" : "default"}>
              {record.recordType === "loan" ? "借貸" : "投資"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">本金:</span>
            <span className="font-medium">{formatCurrency(record.principalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">年息:</span>
            <div className="flex items-center gap-2">
              <span className={riskLevel.textColor + " font-medium"}>
                {record.annualInterestRate}%
              </span>
              <Badge
                variant="outline"
                className={`text-xs ${riskLevel.color} text-white border-0`}
              >
                {riskLevel.level}
              </Badge>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">狀態:</span>
            <Badge variant={record.status === "active" ? "default" : "secondary"}>
              {record.status === "active" ? "進行中" : "已完成"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">開始日期:</span>
            <span>{record.startDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">結束日期:</span>
            <span>{record.endDate || "未設定"}</span>
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
            <span className="font-medium">{record.partyName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">關係:</span>
            <span>{record.partyRelationship || "未設定"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">電話:</span>
            <span>{record.partyPhone || "未設定"}</span>
          </div>
          {record.partyNotes && (
            <div>
              <span className="text-sm text-muted-foreground">備註:</span>
              <p className="text-sm mt-1">{record.partyNotes}</p>
            </div>
          )}
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
              <span className="font-medium">{formatCurrency(record.totalPaidAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>剩餘金額:</span>
              <span className="font-medium text-red-600">
                {formatCurrency(
                  parseFloat(record.principalAmount) - parseFloat(record.totalPaidAmount)
                )}
              </span>
            </div>
            <Progress value={paidPercent} className="h-3" />
            <div className="text-center text-sm text-muted-foreground">
              {paidPercent.toFixed(1)}% 完成
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================================
// 內部子元件：攤提計算表
// ==========================================

function AmortizationSection({ record }: { record: LoanInvestmentRecord }) {
  const schedule = generateAmortizationSchedule(record);
  const principal = parseFloat(record.principalAmount);
  const annualRate = parseFloat(record.annualInterestRate);
  const monthlyInterest = calculateMonthlyInterestFromRate(principal, annualRate);
  const monthlyPayment = parseFloat(record.monthlyPaymentAmount || "0");
  const monthlyPrincipal = monthlyPayment - monthlyInterest;
  const estimatedPeriods =
    monthlyPrincipal > 0 ? Math.ceil(principal / monthlyPrincipal) : 0;

  return (
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
              {formatCurrency(record.monthlyPaymentAmount || "0")}
            </div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <div className="text-sm text-muted-foreground">月利息</div>
            <div className="text-lg font-bold text-green-600">
              {formatCurrency(monthlyInterest)}
            </div>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
            <div className="text-sm text-muted-foreground">月本金</div>
            <div className="text-lg font-bold text-orange-600">
              {formatCurrency(monthlyPrincipal)}
            </div>
          </div>
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
            <div className="text-sm text-muted-foreground">預估期數</div>
            <div className="text-lg font-bold text-purple-600">
              {estimatedPeriods}期
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
              {schedule.map((payment, index) => (
                <TableRow key={index} className={index % 2 === 0 ? "bg-muted/50" : ""}>
                  <TableCell className="font-medium">{payment.period}</TableCell>
                  <TableCell>{formatCurrency(payment.principal)}</TableCell>
                  <TableCell>{formatCurrency(payment.interest)}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(payment.monthlyPayment)}
                  </TableCell>
                  <TableCell>{formatCurrency(payment.remainingBalance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// 內部子元件：條件詳情區塊
// ==========================================

function TermsDetailSection({ record }: { record: LoanInvestmentRecord }) {
  if (record.recordType === "loan") {
    if (!record.interestPaymentMethod) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">借貸條件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">利息給付方式</p>
              <p className="font-medium">
                {record.interestPaymentMethod === "yearly"
                  ? "一年付款一次"
                  : record.interestPaymentMethod === "monthly"
                    ? "每月給付"
                    : "約定給付日期"}
              </p>
            </div>
            {record.monthlyPaymentAmount && (
              <div>
                <p className="text-sm text-muted-foreground">每月給付金額</p>
                <p className="font-medium">{formatCurrency(record.monthlyPaymentAmount)}</p>
              </div>
            )}
            {record.agreedPaymentDay && (
              <div>
                <p className="text-sm text-muted-foreground">約定給付日</p>
                <p className="font-medium">每月 {record.agreedPaymentDay} 日</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (record.recordType === "investment") {
    const hasContent =
      record.fixedReturnRate || record.hasAgreedReturn || record.otherReturnPlan;
    if (!hasContent) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">投資條件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            {record.fixedReturnRate && (
              <div>
                <p className="text-sm text-muted-foreground">固定回饋</p>
                <p className="font-medium">{record.fixedReturnRate}%</p>
              </div>
            )}
            {record.hasAgreedReturn && (
              <div>
                <p className="text-sm text-muted-foreground">約定返還</p>
                <p className="font-medium">
                  {record.returnMethod === "lump_sum" ? "一次還款" : "分期給付"}
                </p>
              </div>
            )}
          </div>
          {record.otherReturnPlan && (
            <div>
              <p className="text-sm text-muted-foreground">其他方案</p>
              <p className="text-sm">{record.otherReturnPlan}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}

// ==========================================
// 內部子元件：文件與備註
// ==========================================

function NotesSection({ record }: { record: LoanInvestmentRecord }) {
  const hasContent = record.contractFileUrl || record.documentNotes || record.notes;
  if (!hasContent) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">文件與備註</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {record.contractFileUrl && (
          <div>
            <p className="text-sm text-muted-foreground">合約文件</p>
            <a
              href={record.contractFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              <FileText className="h-4 w-4 inline mr-1" />
              查看合約文件
            </a>
          </div>
        )}
        {record.documentNotes && (
          <div>
            <p className="text-sm text-muted-foreground">文件備註</p>
            <p className="text-sm">{record.documentNotes}</p>
          </div>
        )}
        {record.notes && (
          <div>
            <p className="text-sm text-muted-foreground">資金狀況備註</p>
            <p className="text-sm bg-gray-50 p-3 rounded">{record.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
