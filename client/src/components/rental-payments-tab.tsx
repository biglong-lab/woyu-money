import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Calendar, Eye, TrendingUp, CheckCircle, Clock, Search, SortAsc, SortDesc, X
} from "lucide-react";
import { AnnualStatsReport } from "@/components/rental-annual-stats";
import type { PaymentItem } from "@shared/schema";

// 租金付款項目型別（對應 API 回傳的 RentalPaymentItem）
interface RentalPaymentItem {
  readonly id: number;
  readonly itemName: string;
  readonly totalAmount: string;
  readonly paidAmount: string | null;
  readonly status: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly notes: string | null;
  readonly projectId: number | null;
  readonly projectName: string | null;
  readonly categoryName: string | null;
  readonly createdAt: Date | null;
}

interface RentalPaymentsTabProps {
  readonly rentalPayments: RentalPaymentItem[];
  readonly monthlyPaymentYear: number;
  readonly onMonthlyPaymentYearChange: (year: number) => void;
  readonly onExportPayments: (format: 'excel' | 'csv') => void;
  readonly onViewPaymentDetail: (payment: RentalPaymentItem) => void;
}

// 租金付款項目 Tab 元件
export function RentalPaymentsTab({
  rentalPayments,
  monthlyPaymentYear,
  onMonthlyPaymentYearChange,
  onExportPayments,
  onViewPaymentDetail,
}: RentalPaymentsTabProps) {
  // 過濾和搜尋狀態
  const [paymentSearchTerm, setPaymentSearchTerm] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [paymentProjectFilter, setPaymentProjectFilter] = useState<string>("all");
  const [paymentSortBy, setPaymentSortBy] = useState<string>("date");
  const [paymentSortOrder, setPaymentSortOrder] = useState<string>("desc");

  // 分頁狀態
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // 過濾和排序邏輯
  const filteredAndSortedPayments = useMemo(() => {
    if (!rentalPayments || !Array.isArray(rentalPayments)) return [];

    const filtered = rentalPayments.filter((payment: RentalPaymentItem) => {
      const matchesSearch = !paymentSearchTerm ||
        payment.itemName?.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
        payment.notes?.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
        payment.projectName?.toLowerCase().includes(paymentSearchTerm.toLowerCase());

      const amount = payment.totalAmount ? parseFloat(payment.totalAmount) : 0;
      const paidAmount = payment.paidAmount ? parseFloat(payment.paidAmount) : 0;
      const isPaid = payment.status === 'paid' || paidAmount >= amount;
      const matchesStatus = paymentStatusFilter === "all" ||
        (paymentStatusFilter === "paid" && isPaid) ||
        (paymentStatusFilter === "pending" && !isPaid);

      const matchesProject = paymentProjectFilter === "all" ||
        payment.projectName === paymentProjectFilter;

      return matchesSearch && matchesStatus && matchesProject;
    });

    const sorted = [...filtered];
    sorted.sort((a: RentalPaymentItem, b: RentalPaymentItem) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (paymentSortBy) {
        case "amount":
          aValue = parseFloat(a.totalAmount || "0");
          bValue = parseFloat(b.totalAmount || "0");
          break;
        case "name":
          aValue = a.itemName || "";
          bValue = b.itemName || "";
          break;
        case "project":
          aValue = a.projectName || "";
          bValue = b.projectName || "";
          break;
        case "date":
        default:
          aValue = new Date(a.startDate || a.createdAt || 0);
          bValue = new Date(b.startDate || b.createdAt || 0);
          break;
      }

      if (paymentSortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    });

    return sorted;
  }, [rentalPayments, paymentSearchTerm, paymentStatusFilter, paymentProjectFilter, paymentSortBy, paymentSortOrder]);

  // 唯一專案列表
  const uniqueProjects = useMemo(() => {
    if (!rentalPayments || !Array.isArray(rentalPayments)) return [];
    const projectNames = rentalPayments
      .map((payment: RentalPaymentItem) => payment.projectName)
      .filter((name): name is string => Boolean(name));
    return projectNames.filter((name: string, index: number) => projectNames.indexOf(name) === index);
  }, [rentalPayments]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg md:text-xl">租金付款項目</CardTitle>
        <div className="flex flex-col gap-3 mt-4">
          {/* 搜尋框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="搜尋租約名稱、備註或專案..."
              value={paymentSearchTerm}
              onChange={(e) => setPaymentSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {paymentSearchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPaymentSearchTerm("")}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* 過濾選項 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger className="w-full text-xs sm:text-sm">
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="paid">已付款</SelectItem>
                <SelectItem value="pending">待付款</SelectItem>
              </SelectContent>
            </Select>

            <Select value={paymentProjectFilter} onValueChange={setPaymentProjectFilter}>
              <SelectTrigger className="w-full text-xs sm:text-sm">
                <SelectValue placeholder="專案" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部專案</SelectItem>
                {uniqueProjects.map((project: string) => (
                  <SelectItem key={project} value={project}>
                    {project}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={paymentSortBy} onValueChange={setPaymentSortBy}>
              <SelectTrigger className="w-full text-xs sm:text-sm">
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">日期</SelectItem>
                <SelectItem value="amount">金額</SelectItem>
                <SelectItem value="name">名稱</SelectItem>
                <SelectItem value="project">專案</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaymentSortOrder(paymentSortOrder === "asc" ? "desc" : "asc")}
              className="px-3"
            >
              {paymentSortOrder === "asc" ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </Button>

            {(paymentSearchTerm || paymentStatusFilter !== "all" || paymentProjectFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPaymentSearchTerm("");
                  setPaymentStatusFilter("all");
                  setPaymentProjectFilter("all");
                  setPaymentSortBy("date");
                  setPaymentSortOrder("desc");
                }}
                className="px-3"
              >
                <X className="w-4 h-4 mr-1" />
                重置
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 付款統計摘要卡片 */}
          <PaymentSummaryCards payments={filteredAndSortedPayments} />

          {/* 年度統計報表 */}
          <AnnualStatsReport
            rentalPayments={rentalPayments as unknown as PaymentItem[]}
            monthlyPaymentYear={monthlyPaymentYear}
            onMonthlyPaymentYearChange={onMonthlyPaymentYearChange}
            onExportPayments={onExportPayments}
          />

          {/* 分頁控制 - 頂部 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-sm text-gray-600">
            <span>
              顯示第 {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedPayments.length)} 筆，
              共 {filteredAndSortedPayments.length} 筆結果
              {rentalPayments.length !== filteredAndSortedPayments.length &&
                ` (總計 ${rentalPayments.length} 筆)`
              }
            </span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">每頁顯示：</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  setItemsPerPage(parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-gray-500">筆</span>
            </div>
          </div>

          {/* 付款表格 */}
          {filteredAndSortedPayments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">無付款項目</p>
              <p>請先建立租約合約</p>
            </div>
          ) : (
            <PaymentTable
              payments={filteredAndSortedPayments}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              onViewDetail={onViewPaymentDetail}
            />
          )}

          {/* 分頁導覽 */}
          {filteredAndSortedPayments.length > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalItems={filteredAndSortedPayments.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// 付款統計摘要卡片
// ==========================================
function PaymentSummaryCards({ payments }: { readonly payments: RentalPaymentItem[] }) {
  const totalItems = payments.length;
  const completedItems = payments.filter((p: RentalPaymentItem) => {
    const total = p.totalAmount ? parseFloat(p.totalAmount) : 0;
    const paid = p.paidAmount ? parseFloat(p.paidAmount) : 0;
    return p.status === 'paid' || paid >= total;
  }).length;
  const partialItems = payments.filter((p: RentalPaymentItem) => {
    const total = p.totalAmount ? parseFloat(p.totalAmount) : 0;
    const paid = p.paidAmount ? parseFloat(p.paidAmount) : 0;
    return paid > 0 && paid < total;
  }).length;
  const pendingItems = totalItems - completedItems - partialItems;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
      <Card className="p-2 md:p-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-gray-400" />
          <div>
            <p className="text-lg md:text-2xl font-bold">{totalItems}</p>
            <p className="text-xs md:text-sm text-gray-600">總計項目</p>
          </div>
        </div>
      </Card>
      <Card className="p-2 md:p-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-500" />
          <div>
            <p className="text-lg md:text-2xl font-bold text-green-600">{completedItems}</p>
            <p className="text-xs md:text-sm text-gray-600">已完成</p>
          </div>
        </div>
      </Card>
      <Card className="p-2 md:p-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-blue-500" />
          <div>
            <p className="text-lg md:text-2xl font-bold text-blue-600">{partialItems}</p>
            <p className="text-xs md:text-sm text-gray-600">部分付款</p>
          </div>
        </div>
      </Card>
      <Card className="p-2 md:p-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-orange-400" />
          <div>
            <p className="text-lg md:text-2xl font-bold text-orange-600">{pendingItems}</p>
            <p className="text-xs md:text-sm text-gray-600">待付款</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// 付款表格
function PaymentTable({
  payments,
  currentPage,
  itemsPerPage,
  onViewDetail,
}: {
  readonly payments: RentalPaymentItem[];
  readonly currentPage: number;
  readonly itemsPerPage: number;
  readonly onViewDetail: (payment: RentalPaymentItem) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>租約名稱</TableHead>
          <TableHead>付款期間</TableHead>
          <TableHead>應付金額</TableHead>
          <TableHead>已付金額</TableHead>
          <TableHead>狀態</TableHead>
          <TableHead>到期日</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments
          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
          .map((payment: RentalPaymentItem) => {
          const amount = payment.totalAmount ? parseFloat(payment.totalAmount) : 0;
          const paidAmount = payment.paidAmount ? parseFloat(payment.paidAmount) : 0;
          const isPaid = payment.status === 'paid' || paidAmount >= amount;
          const isPartiallyPaid = paidAmount > 0 && paidAmount < amount;
          const dueDate = payment.startDate || payment.createdAt;
          const paymentProgress = amount > 0 ? (paidAmount / amount) * 100 : 0;

          return (
            <TableRow key={payment.id} className={isPaid ? "bg-green-50/50" : isPartiallyPaid ? "bg-blue-50/50" : ""}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isPaid ? 'bg-green-500' : isPartiallyPaid ? 'bg-blue-500' : 'bg-orange-400'}`} />
                  {payment.itemName || '未命名租約'}
                </div>
              </TableCell>
              <TableCell>{payment.notes || '租金付款'}</TableCell>
              <TableCell className="font-medium">
                <div className="space-y-1">
                  <div>NT${amount.toLocaleString()}</div>
                  {isPartiallyPaid && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${paymentProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-green-600 font-medium">
                <div className="flex items-center gap-2">
                  NT${paidAmount.toLocaleString()}
                  {isPartiallyPaid && (
                    <span className="text-xs text-gray-500">
                      ({Math.round(paymentProgress)}%)
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {isPaid ? (
                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    已完成
                  </Badge>
                ) : isPartiallyPaid ? (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    部分付款
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                    <Clock className="w-3 h-3 mr-1" />
                    待付款
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {dueDate ? new Date(dueDate).toLocaleDateString('zh-TW') : '待確認'}
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetail(payment)}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// 分頁控制
function PaginationControls({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
}: {
  readonly currentPage: number;
  readonly totalItems: number;
  readonly itemsPerPage: number;
  readonly onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t">
      <div className="text-sm text-gray-500">
        第 {currentPage} / {totalPages} 頁
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
        >
          首頁
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          上一頁
        </Button>

        <div className="flex items-center gap-1">
          {(() => {
            const pages = [];
            let startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(totalPages, startPage + 4);

            if (endPage - startPage < 4) {
              startPage = Math.max(1, endPage - 4);
            }

            for (let i = startPage; i <= endPage; i++) {
              pages.push(
                <Button
                  key={i}
                  variant={currentPage === i ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(i)}
                  className="w-8 h-8 p-0"
                >
                  {i}
                </Button>
              );
            }
            return pages;
          })()}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
        >
          下一頁
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
        >
          末頁
        </Button>
      </div>
    </div>
  );
}
