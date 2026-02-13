import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Trash2, RefreshCw, History, RotateCcw, AlertTriangle, Calendar, DollarSign, FolderOpen, Clock, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import type { PaymentItem } from "@shared/schema";

interface AuditLog {
  id: number;
  tableName: string;
  recordId: number;
  action: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  changedFields: string[];
  userInfo: string;
  changeReason: string;
  createdAt: string;
}

interface PaymentItemWithProject extends PaymentItem {
  projectName?: string;
  categoryName?: string;
  fixedCategoryName?: string;
}

export default function RecycleBin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<PaymentItemWithProject | null>(null);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isPermanentDeleteDialogOpen, setIsPermanentDeleteDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  const { data: deletedItems = [], isLoading } = useQuery<PaymentItemWithProject[]>({
    queryKey: ["/api/payment/items/deleted"],
  });

  const { data: auditLogs = [], isLoading: isLoadingLogs } = useQuery<AuditLog[]>({
    queryKey: [`/api/payment/items/${selectedItem?.id}/audit-logs`],
    enabled: !!selectedItem && isHistoryDialogOpen,
  });

  const restoreMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return apiRequest("POST", `/api/payment/items/${itemId}/restore`, {
        reason: "從回收站恢復",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items/deleted"] });
      toast({
        title: "恢復成功",
        description: "項目已成功恢復到一般付款管理。",
      });
      setIsRestoreDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "恢復失敗",
        description: error.message || "無法恢復項目，請稍後再試。",
        variant: "destructive",
      });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return apiRequest("DELETE", `/api/payment/items/${itemId}/permanent`, {
        reason: "永久刪除",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items/deleted"] });
      toast({
        title: "永久刪除成功",
        description: "項目已被永久刪除，無法恢復。",
      });
      setIsPermanentDeleteDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "刪除失敗",
        description: error.message || "無法永久刪除項目，請稍後再試。",
        variant: "destructive",
      });
    },
  });

  const handleRestore = (item: PaymentItemWithProject) => {
    setSelectedItem(item);
    setIsRestoreDialogOpen(true);
  };

  const handlePermanentDelete = (item: PaymentItemWithProject) => {
    setSelectedItem(item);
    setIsPermanentDeleteDialogOpen(true);
  };

  const handleViewHistory = (item: PaymentItemWithProject) => {
    setSelectedItem(item);
    setIsHistoryDialogOpen(true);
  };

  const formatCurrency = (amount: string | number | null | undefined) => {
    if (amount === null || amount === undefined) return "NT$ 0";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "NT$ 0";
    return `NT$ ${num.toLocaleString()}`;
  };

  const getActionBadge = (action: string) => {
    const actionMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      CREATE: { label: "建立", variant: "default" },
      UPDATE: { label: "更新", variant: "secondary" },
      DELETE: { label: "刪除", variant: "destructive" },
      RESTORE: { label: "恢復", variant: "default" },
      PERMANENT_DELETE: { label: "永久刪除", variant: "destructive" },
    };
    const config = actionMap[action] || { label: action, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const toggleExpand = (id: number) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">載入回收站資料中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-6 h-6" />
            回收站
          </CardTitle>
          <CardDescription>
            已刪除的付款項目會保留在這裡，您可以選擇恢復或永久刪除。
            項目刪除後將保留 30 天。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deletedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <Trash2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">回收站是空的</h3>
              <p className="text-muted-foreground max-w-md">
                目前沒有已刪除的項目。刪除的付款項目會顯示在這裡，您可以隨時恢復。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  共 {deletedItems.length} 個已刪除項目
                </p>
              </div>
              
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>項目名稱</TableHead>
                      <TableHead>專案</TableHead>
                      <TableHead>分類</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead>刪除時間</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedItems.map((item: PaymentItemWithProject) => (
                      <Fragment key={item.id}>
                        <TableRow className="hover:bg-muted/50" data-testid={`row-deleted-item-${item.id}`}>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleExpand(item.id)}
                            >
                              {expandedItem === item.id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <FolderOpen className="w-3 h-3" />
                              {item.projectName || "無專案"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.categoryName || item.fixedCategoryName || "無分類"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span className="text-sm">
                                {item.deletedAt ? 
                                  formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true, locale: zhTW }) : 
                                  "未知"
                                }
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewHistory(item)}
                                className="gap-1"
                                data-testid={`button-history-${item.id}`}
                              >
                                <History className="w-4 h-4" />
                                歷史
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleRestore(item)}
                                className="gap-1"
                                data-testid={`button-restore-${item.id}`}
                              >
                                <RotateCcw className="w-4 h-4" />
                                恢復
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handlePermanentDelete(item)}
                                className="gap-1"
                                data-testid={`button-permanent-delete-${item.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                                永久刪除
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedItem === item.id && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/30 p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">已付金額</span>
                                  <p className="font-medium">{formatCurrency(item.paidAmount)}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">待付金額</span>
                                  <p className="font-medium text-red-600">
                                    {formatCurrency(parseFloat(item.totalAmount) - parseFloat(item.paidAmount || "0"))}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">建立時間</span>
                                  <p className="font-medium">
                                    {item.createdAt ? format(new Date(item.createdAt), "yyyy/MM/dd") : "未知"}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">狀態</span>
                                  <p>
                                    <Badge variant={item.status === "paid" ? "default" : item.status === "partial" ? "secondary" : "outline"}>
                                      {item.status === "paid" ? "已付款" : item.status === "partial" ? "部分付款" : "待付款"}
                                    </Badge>
                                  </p>
                                </div>
                                {item.notes && (
                                  <div className="col-span-full">
                                    <span className="text-muted-foreground">備註</span>
                                    <p className="font-medium">{item.notes}</p>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-green-500" />
              確認恢復
            </DialogTitle>
            <DialogDescription>
              恢復此項目後將可在一般付款管理中查看。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="font-medium mb-2">{selectedItem?.itemName}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {formatCurrency(selectedItem?.totalAmount)}
                </span>
                <span className="flex items-center gap-1">
                  <FolderOpen className="w-4 h-4" />
                  {selectedItem?.projectName || "無專案"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsRestoreDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => selectedItem && restoreMutation.mutate(selectedItem.id)}
              disabled={restoreMutation.isPending}
              data-testid="button-confirm-restore"
            >
              {restoreMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  恢復中...
                </>
              ) : (
                "確認恢復"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={isPermanentDeleteDialogOpen} onOpenChange={setIsPermanentDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              永久刪除確認
            </DialogTitle>
            <DialogDescription>
              此操作無法復原，請謹慎操作。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="font-medium mb-2">{selectedItem?.itemName}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {formatCurrency(selectedItem?.totalAmount)}
                </span>
              </div>
              <p className="text-red-600 text-sm mt-3">
                ⚠️ 永久刪除後，此項目及其所有付款記錄將無法恢復。
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsPermanentDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedItem && permanentDeleteMutation.mutate(selectedItem.id)}
              disabled={permanentDeleteMutation.isPending}
              data-testid="button-confirm-permanent-delete"
            >
              {permanentDeleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  刪除中...
                </>
              ) : (
                "永久刪除"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Audit History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              操作歷史記錄
            </DialogTitle>
            <DialogDescription>
              「{selectedItem?.itemName}」的所有操作記錄
            </DialogDescription>
          </DialogHeader>
          <Separator className="my-4" />
          {isLoadingLogs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !Array.isArray(auditLogs) || auditLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暫無操作記錄</p>
            </div>
          ) : (
            <div className="space-y-4">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getActionBadge(log.action)}
                      <span className="text-sm text-muted-foreground">
                        由 {log.userInfo}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(log.createdAt), "yyyy/MM/dd HH:mm:ss")}
                    </span>
                  </div>
                  {log.changeReason && (
                    <p className="text-sm mb-2">
                      <span className="text-muted-foreground">原因：</span>
                      {log.changeReason}
                    </p>
                  )}
                  {log.changedFields && log.changedFields.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span>變更欄位：</span>
                      <span className="font-mono">{log.changedFields.join(", ")}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
