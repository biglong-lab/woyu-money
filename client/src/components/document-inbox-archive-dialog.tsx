// 單據歸檔 Dialog
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText, CreditCard, Receipt, Loader2, Archive,
  Search, ChevronDown, Check, Building2, Calendar, DollarSign
} from "lucide-react";
import { format } from "date-fns";
import type { DocumentInbox, PaymentProject, PaymentItem as BasePaymentItem } from "@shared/schema";

// 擴展 PaymentItem 型別以包含 JOIN 查詢返回的額外欄位
interface ExtendedPaymentItem extends BasePaymentItem {
  vendor?: string | null;
  dueDate?: string | null;
}

export interface DocumentInboxArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentInbox | null;
  projects: PaymentProject[];
  paymentItems: ExtendedPaymentItem[];
  onArchive: (type: string, data: Record<string, unknown>) => void;
  isPending: boolean;
}

export default function DocumentInboxArchiveDialog({
  open,
  onOpenChange,
  document,
  projects,
  paymentItems,
  onArchive,
  isPending,
}: DocumentInboxArchiveDialogProps) {
  const [archiveType, setArchiveType] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, string | number>>({});
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [itemSearch, setItemSearch] = useState('');
  const [itemPickerOpen, setItemPickerOpen] = useState(false);

  // 篩選付款項目
  const filteredPaymentItems = useMemo(() => {
    let items = paymentItems.filter(i => i.status !== 'paid');

    if (selectedProjectFilter !== 'all') {
      items = items.filter(i => i.projectId?.toString() === selectedProjectFilter);
    }

    if (itemSearch.trim()) {
      const searchLower = itemSearch.toLowerCase();
      items = items.filter(i =>
        i.itemName?.toLowerCase().includes(searchLower) ||
        i.vendor?.toLowerCase().includes(searchLower)
      );
    }

    return items;
  }, [paymentItems, selectedProjectFilter, itemSearch]);

  // 已選擇的付款項目
  const selectedItem = useMemo(() => {
    if (!formData.paymentItemId) return null;
    return paymentItems.find(i => i.id === formData.paymentItemId);
  }, [paymentItems, formData.paymentItemId]);

  // 取得專案名稱
  const getProjectName = (projectId: number | null) => {
    if (!projectId) return '無專案';
    const project = projects.find(p => p.id === projectId);
    return project?.projectName || '未知專案';
  };

  // 重置表單
  useEffect(() => {
    if (document && open) {
      const recognizedAmount = document.recognizedAmount ? String(document.recognizedAmount) : '';
      const recognizedDate = document.recognizedDate ? String(document.recognizedDate) : '';

      setFormData({
        itemName: document.recognizedDescription || document.recognizedVendor || '',
        totalAmount: recognizedAmount,
        dueDate: recognizedDate,
        projectId: '',
        categoryId: '',
        paymentItemId: '',
        amount: recognizedAmount,
        paymentDate: recognizedDate || new Date().toISOString().split('T')[0],
        paymentMethod: 'bank_transfer',
        invoiceNumber: document.recognizedInvoiceNumber || '',
        invoiceDate: recognizedDate || new Date().toISOString().split('T')[0],
        vendorName: document.recognizedVendor || '',
        category: document.recognizedCategory || '',
        description: document.recognizedDescription || '',
        notes: document.notes || '',
      });
      setSelectedProjectFilter('all');
      setItemSearch('');

      // 依文件類型自動選擇歸檔類型
      if (document.documentType === 'bill') {
        setArchiveType('payment-item');
      } else if (document.documentType === 'payment') {
        setArchiveType('payment-record');
      } else if (document.documentType === 'invoice') {
        setArchiveType('invoice');
      }
    }
  }, [document, open]);

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>歸檔整理</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 歸檔類型選擇 */}
          <div className="space-y-2">
            <Label>歸檔類型</Label>
            <Select value={archiveType} onValueChange={setArchiveType}>
              <SelectTrigger data-testid="select-archive-type">
                <SelectValue placeholder="選擇歸檔類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payment-item">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    轉為應付款項目
                  </span>
                </SelectItem>
                <SelectItem value="payment-record">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    轉為付款記錄
                  </span>
                </SelectItem>
                <SelectItem value="invoice">
                  <span className="flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    轉為發票記錄
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 付款項目表單 */}
          {archiveType === 'payment-item' && (
            <div className="space-y-3">
              <div>
                <Label>項目名稱</Label>
                <Input
                  value={String(formData.itemName || '')}
                  onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                  data-testid="input-item-name"
                />
              </div>
              <div>
                <Label>金額</Label>
                <Input
                  type="number"
                  value={String(formData.totalAmount || '')}
                  onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                  data-testid="input-total-amount"
                />
              </div>
              <div>
                <Label>到期日</Label>
                <Input
                  type="date"
                  value={String(formData.dueDate || '')}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  data-testid="input-due-date"
                />
              </div>
              <div>
                <Label>所屬專案</Label>
                <Select
                  value={formData.projectId?.toString()}
                  onValueChange={(v) => setFormData({ ...formData, projectId: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇專案（可選）" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.projectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* 付款記錄表單 */}
          {archiveType === 'payment-record' && (
            <div className="space-y-3">
              {/* 專案篩選 */}
              <div>
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  先選擇專案篩選
                </Label>
                <Select
                  value={selectedProjectFilter}
                  onValueChange={(v) => {
                    setSelectedProjectFilter(v);
                    setFormData({ ...formData, paymentItemId: '' });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇專案篩選" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部專案</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.projectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 搜尋並選擇付款項目 */}
              <div>
                <Label className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  搜尋並選擇付款項目 *
                </Label>
                <Popover open={itemPickerOpen} onOpenChange={setItemPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-auto min-h-10 py-2"
                      data-testid="select-payment-item"
                    >
                      {selectedItem ? (
                        <div className="flex flex-col items-start text-left">
                          <span className="font-medium">{selectedItem.itemName}</span>
                          <span className="text-xs text-muted-foreground">
                            {getProjectName(selectedItem.projectId)} |
                            待付: ${parseFloat(selectedItem.totalAmount || '0').toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">輸入關鍵字搜尋付款項目...</span>
                      )}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="輸入項目名稱或廠商搜尋..."
                        value={itemSearch}
                        onValueChange={setItemSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="py-6 text-center text-sm">
                            <p>找不到符合的付款項目</p>
                            <p className="text-muted-foreground mt-1">
                              {selectedProjectFilter !== 'all' && '試試看選擇「全部專案」'}
                            </p>
                          </div>
                        </CommandEmpty>
                        <CommandGroup heading={`符合項目 (${filteredPaymentItems.length})`}>
                          <ScrollArea className="h-[300px]">
                            {filteredPaymentItems.map((item) => {
                              const remaining = parseFloat(item.totalAmount || '0') - parseFloat(item.paidAmount || '0');
                              const isOverdue = item.dueDate && new Date(item.dueDate) < new Date();

                              return (
                                <CommandItem
                                  key={item.id}
                                  value={`${item.itemName} ${item.vendor || ''}`}
                                  onSelect={() => {
                                    setFormData({
                                      ...formData,
                                      paymentItemId: item.id,
                                      amount: remaining.toString(),
                                    });
                                    setItemPickerOpen(false);
                                  }}
                                  className="flex flex-col items-start py-3 cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    {formData.paymentItemId === item.id && (
                                      <Check className="h-4 w-4 text-primary" />
                                    )}
                                    <span className="font-medium flex-1">{item.itemName}</span>
                                    {isOverdue && (
                                      <Badge variant="destructive" className="text-xs">逾期</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 ml-6">
                                    <span className="flex items-center gap-1">
                                      <Building2 className="h-3 w-3" />
                                      {getProjectName(item.projectId)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <DollarSign className="h-3 w-3" />
                                      待付 ${remaining.toLocaleString()}
                                    </span>
                                    {item.dueDate && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(item.dueDate), 'MM/dd')}
                                      </span>
                                    )}
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </ScrollArea>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* 已選項目摘要 */}
              {selectedItem && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">專案</span>
                    <span className="font-medium">{getProjectName(selectedItem.projectId)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">應付總額</span>
                    <span className="font-medium">${parseFloat(selectedItem.totalAmount || '0').toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">已付金額</span>
                    <span className="font-medium">${parseFloat(selectedItem.paidAmount || '0').toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">剩餘待付</span>
                    <span className="font-medium text-primary">
                      ${(parseFloat(selectedItem.totalAmount || '0') - parseFloat(selectedItem.paidAmount || '0')).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <Label>本次付款金額</Label>
                <Input
                  type="number"
                  value={String(formData.amount || '')}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
              <div>
                <Label>付款日期</Label>
                <Input
                  type="date"
                  value={String(formData.paymentDate || '')}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                />
              </div>
              <div>
                <Label>付款方式</Label>
                <Select
                  value={String(formData.paymentMethod || '')}
                  onValueChange={(v) => setFormData({ ...formData, paymentMethod: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">現金</SelectItem>
                    <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                    <SelectItem value="credit_card">信用卡</SelectItem>
                    <SelectItem value="check">支票</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* 發票表單 */}
          {archiveType === 'invoice' && (
            <div className="space-y-3">
              <div>
                <Label>發票號碼</Label>
                <Input
                  value={String(formData.invoiceNumber || '')}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                />
              </div>
              <div>
                <Label>發票日期</Label>
                <Input
                  type="date"
                  value={String(formData.invoiceDate || '')}
                  onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                />
              </div>
              <div>
                <Label>廠商名稱</Label>
                <Input
                  value={String(formData.vendorName || '')}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                />
              </div>
              <div>
                <Label>金額</Label>
                <Input
                  type="number"
                  value={String(formData.totalAmount || '')}
                  onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                />
              </div>
              <div>
                <Label>分類</Label>
                <Input
                  value={String(formData.category || '')}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
              <div>
                <Label>說明</Label>
                <Textarea
                  value={String(formData.description || '')}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* 原始備註顯示 */}
          {document.notes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <Label className="text-blue-700 text-xs font-medium">上傳時備註</Label>
              <p className="text-sm text-blue-900 mt-1">{document.notes}</p>
            </div>
          )}

          {/* 歸檔備註 */}
          <div>
            <Label>歸檔備註</Label>
            <Textarea
              value={String(formData.notes || '')}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="可補充歸檔說明..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() => onArchive(archiveType, formData)}
            disabled={isPending || !archiveType || (archiveType === 'payment-record' && !formData.paymentItemId)}
            data-testid="btn-confirm-archive"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                處理中...
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" />
                確認歸檔
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
