import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Camera, 
  Upload, 
  FileText, 
  Receipt, 
  CreditCard, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Trash2,
  Archive,
  Eye,
  Image as ImageIcon,
  Sparkles,
  Clock,
  ArrowRight,
  Search,
  ChevronDown,
  Check,
  Building2,
  Calendar,
  DollarSign,
  StickyNote,
  User
} from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import type { DocumentInbox } from "@shared/schema";

interface InboxStats {
  bill: { pending: number; processing: number; recognized: number; failed: number; total: number };
  payment: { pending: number; processing: number; recognized: number; failed: number; total: number };
  invoice: { pending: number; processing: number; recognized: number; failed: number; total: number };
  totalPending: number;
}

const DOCUMENT_TYPES = [
  { value: 'bill', label: '帳單', icon: FileText, color: 'bg-blue-100 text-blue-700', description: '需要付款的帳單' },
  { value: 'payment', label: '付款憑證', icon: CreditCard, color: 'bg-green-100 text-green-700', description: '已付款的收據' },
  { value: 'invoice', label: '發票', icon: Receipt, color: 'bg-purple-100 text-purple-700', description: '統一發票、電子發票' },
];

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待處理', color: 'bg-gray-200 text-gray-800 border border-gray-300', icon: Clock },
  processing: { label: '辨識中', color: 'bg-amber-200 text-amber-900 border border-amber-300', icon: Loader2 },
  recognized: { label: '已辨識', color: 'bg-emerald-500 text-white border border-emerald-600', icon: CheckCircle2 },
  failed: { label: '辨識失敗', color: 'bg-red-500 text-white border border-red-600', icon: AlertCircle },
  archived: { label: '已歸檔', color: 'bg-blue-500 text-white border border-blue-600', icon: Archive },
};

export default function DocumentInboxPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedType, setSelectedType] = useState<'bill' | 'payment' | 'invoice'>('bill');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedDoc, setSelectedDoc] = useState<DocumentInbox | null>(null);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadNotes, setUploadNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState('');

  // Build query URL with proper filter params
  const getQueryUrl = () => {
    const params = new URLSearchParams();
    if (filterType !== 'all') params.set('documentType', filterType);
    if (filterStatus !== 'all') params.set('status', filterStatus);
    const queryString = params.toString();
    return `/api/document-inbox${queryString ? `?${queryString}` : ''}`;
  };

  // Fetch inbox items - use proper queryKey with URL for default queryFn
  const queryUrl = getQueryUrl();
  const { data: documents = [], isLoading, refetch } = useQuery<DocumentInbox[]>({
    queryKey: [queryUrl],
    refetchInterval: 5000,
  });

  // Fetch stats
  const { data: stats } = useQuery<InboxStats>({
    queryKey: ['/api/document-inbox/stats'],
    refetchInterval: 10000,
  });

  // Fetch projects for archive dialog
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['/api/payment/projects'],
  });

  // Fetch ALL payment items for linking payment records (no pagination limit)
  // When includeAll=true, API returns array directly; otherwise returns { items: [], pagination: {} }
  const { data: paymentItemsData = [] } = useQuery<any[]>({
    queryKey: ['/api/payment/items', { includeAll: 'true' }],
    queryFn: async () => {
      const response = await fetch('/api/payment/items?includeAll=true', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch payment items');
      return response.json();
    },
  });
  const paymentItems = Array.isArray(paymentItemsData) ? paymentItemsData : [];

  // Helper to invalidate all document inbox queries
  const invalidateDocumentInboxQueries = () => {
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/document-inbox');
      }
    });
  };

  // Upload mutation - use apiRequest which handles FormData and credentials
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest('POST', '/api/document-inbox/upload', formData);
    },
    onSuccess: () => {
      invalidateDocumentInboxQueries();
    },
    onError: (error: any) => {
      toast({ title: "上傳失敗", description: error.message, variant: "destructive" });
    },
  });

  // Re-recognize mutation
  const reRecognizeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('POST', `/api/document-inbox/${id}/re-recognize`);
    },
    onSuccess: () => {
      invalidateDocumentInboxQueries();
      toast({ title: "重新辨識中", description: "請稍候..." });
    },
    onError: (error: any) => {
      toast({ title: "辨識失敗", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/document-inbox/${id}`);
    },
    onSuccess: () => {
      invalidateDocumentInboxQueries();
      toast({ title: "已刪除" });
      setSelectedDoc(null);
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async ({ id, type, data }: { id: number; type: string; data: any }) => {
      return apiRequest('POST', `/api/document-inbox/${id}/archive-to-${type}`, data);
    },
    onSuccess: (_, variables) => {
      invalidateDocumentInboxQueries();
      queryClient.invalidateQueries({ queryKey: ['/api/payment/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoice-records'] });
      
      const typeLabels: Record<string, string> = {
        'payment-item': '付款項目',
        'payment-record': '付款記錄',
        'invoice': '發票記錄',
      };
      toast({ title: "歸檔成功", description: `已轉為${typeLabels[variables.type]}` });
      setShowArchiveDialog(false);
      setSelectedDoc(null);
    },
    onError: (error: any) => {
      toast({ title: "歸檔失敗", description: error.message, variant: "destructive" });
    },
  });

  // Update notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }): Promise<DocumentInbox> => {
      return apiRequest('PATCH', `/api/document-inbox/${id}/notes`, { notes }) as Promise<DocumentInbox>;
    },
    onSuccess: (updatedDoc: DocumentInbox) => {
      invalidateDocumentInboxQueries();
      setSelectedDoc(updatedDoc);
      toast({ title: "備註已更新" });
    },
    onError: (error: any) => {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    },
  });

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    // 一次上傳所有檔案
    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append('file', file);
    }
    formData.append('documentType', selectedType);
    if (uploadNotes.trim()) {
      formData.append('notes', uploadNotes.trim());
    }
    
    try {
      await uploadMutation.mutateAsync(formData);
      toast({ 
        title: "上傳成功", 
        description: files.length > 1 
          ? `已上傳 ${files.length} 張圖片，正在進行 AI 辨識...` 
          : "正在進行 AI 辨識..." 
      });
    } catch (error) {
      // Error handled in mutation
    }
    
    setIsUploading(false);
    setUploadNotes(''); // Clear notes after upload
    
    // Reset file inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, [selectedType, uploadMutation, uploadNotes, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const getStatusBadge = (status: string | null) => {
    const config = STATUS_LABELS[status || 'pending'] || STATUS_LABELS.pending;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const config = DOCUMENT_TYPES.find(t => t.value === type) || DOCUMENT_TYPES[0];
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">單據收件箱</h1>
          <p className="text-gray-500">快速拍照或上傳單據，AI 自動辨識分類</p>
        </div>
        {stats && stats.totalPending > 0 && (
          <Badge variant="outline" className="text-lg px-4 py-2 bg-amber-50 border-amber-300">
            <Clock className="h-4 w-4 mr-2" />
            {stats.totalPending} 項待整理
          </Badge>
        )}
      </div>

      {/* Upload Section */}
      <Card className="border-2 border-dashed border-gray-300 hover:border-primary transition-colors">
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-4">
            {/* Document Type Selection */}
            <div className="flex gap-2 flex-wrap justify-center">
              {DOCUMENT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <Button
                    key={type.value}
                    variant={selectedType === type.value ? "default" : "outline"}
                    onClick={() => setSelectedType(type.value as any)}
                    className="flex items-center gap-2"
                    data-testid={`select-type-${type.value}`}
                  >
                    <Icon className="h-4 w-4" />
                    {type.label}
                  </Button>
                );
              })}
            </div>

            <p className="text-sm text-gray-500">
              {DOCUMENT_TYPES.find(t => t.value === selectedType)?.description}
            </p>

            {/* Notes Input */}
            <div className="w-full max-w-md">
              <Textarea
                placeholder="輸入備註（選填）- 例如：轉帳給誰、用途說明..."
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                className="text-sm"
                rows={2}
                data-testid="input-upload-notes"
              />
            </div>

            {/* Upload Area */}
            <div
              className="w-full max-w-md p-8 rounded-lg bg-gray-50 text-center cursor-pointer hover:bg-gray-100 transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              data-testid="upload-dropzone"
            >
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-12 w-12 text-primary animate-spin mb-2" />
                  <p>上傳中...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 font-medium">拖曳檔案到這裡，或點擊選擇</p>
                  <p className="text-sm text-gray-400 mt-1">支援 JPEG, PNG, GIF, WebP（可一次選擇多張）</p>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2"
                data-testid="btn-camera"
              >
                <Camera className="h-5 w-5" />
                拍照上傳
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2"
                data-testid="btn-upload"
              >
                <Upload className="h-5 w-5" />
                選擇檔案
              </Button>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {DOCUMENT_TYPES.map((type) => {
            const stat = stats[type.value as keyof InboxStats];
            if (typeof stat !== 'object') return null;
            const Icon = type.icon;
            return (
              <Card 
                key={type.value}
                className={`cursor-pointer hover:shadow-md transition-shadow ${filterType === type.value ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setFilterType(filterType === type.value ? 'all' : type.value)}
                data-testid={`stat-card-${type.value}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${type.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="font-medium">{type.label}</span>
                    </div>
                    <span className="text-2xl font-bold">{stat.total}</span>
                  </div>
                  <div className="mt-2 flex gap-2 text-xs text-gray-500">
                    {stat.processing > 0 && <span>辨識中 {stat.processing}</span>}
                    {stat.recognized > 0 && <span>待整理 {stat.recognized}</span>}
                    {stat.failed > 0 && <span className="text-red-500">失敗 {stat.failed}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filter Tabs */}
      <Tabs value={filterStatus} onValueChange={setFilterStatus}>
        <TabsList>
          <TabsTrigger value="all" data-testid="filter-all">全部</TabsTrigger>
          <TabsTrigger value="processing" data-testid="filter-processing">辨識中</TabsTrigger>
          <TabsTrigger value="recognized" data-testid="filter-recognized">待整理</TabsTrigger>
          <TabsTrigger value="failed" data-testid="filter-failed">失敗</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Document List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>沒有待處理的單據</p>
            <p className="text-sm mt-1">上傳單據開始使用 AI 辨識功能</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <Card 
              key={doc.id} 
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedDoc(doc);
                setEditingNotes(doc.notes || '');
                setShowPreviewDialog(true);
              }}
              data-testid={`doc-card-${doc.id}`}
            >
              {/* Image Preview */}
              <div className="aspect-[4/3] bg-gray-100 relative">
                <img
                  src={doc.imagePath}
                  alt={doc.originalFilename || '單據圖片'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-document.svg';
                  }}
                />
                <div className="absolute top-2 left-2 flex gap-1">
                  {getTypeBadge(doc.documentType)}
                </div>
                <div className="absolute top-2 right-2">
                  {getStatusBadge(doc.status)}
                </div>
                {doc.aiRecognized && doc.aiConfidence && (
                  <div className="absolute bottom-2 right-2">
                    <Badge variant="secondary" className="flex items-center gap-1 bg-amber-500 text-white border border-amber-600 shadow-sm">
                      <Sparkles className="h-3 w-3 text-white" />
                      {Math.round(parseFloat(doc.aiConfidence) * 100)}% 信心度
                    </Badge>
                  </div>
                )}
              </div>

              {/* Content */}
              <CardContent className="p-4 space-y-2">
                {doc.status === 'recognized' && (
                  <>
                    <div className="font-medium truncate">
                      {doc.recognizedVendor || doc.recognizedDescription || '待確認'}
                    </div>
                    {doc.recognizedAmount && (
                      <div className="text-lg font-bold text-primary">
                        ${parseFloat(doc.recognizedAmount).toLocaleString()}
                      </div>
                    )}
                    {doc.recognizedDate && (
                      <div className="text-sm text-gray-500">
                        {doc.recognizedDate}
                      </div>
                    )}
                    {doc.recognizedCategory && (
                      <Badge variant="outline" className="text-xs">
                        {doc.recognizedCategory}
                      </Badge>
                    )}
                    {doc.notes && (
                      <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded truncate">
                        <StickyNote className="h-3 w-3 inline mr-1" />
                        {doc.notes}
                      </div>
                    )}
                  </>
                )}

                {doc.status === 'processing' && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>AI 正在辨識中...</span>
                  </div>
                )}

                {doc.status === 'failed' && (
                  <div className="flex items-center justify-between">
                    <span className="text-red-500 text-sm">辨識失敗</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        reRecognizeMutation.mutate(doc.id);
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      重試
                    </Button>
                  </div>
                )}

                <div className="text-xs text-gray-400 space-y-0.5">
                  <div>{format(new Date(doc.createdAt), 'MM/dd HH:mm', { locale: zhTW })}</div>
                  {doc.uploadedByUsername && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{doc.uploadedByUsername}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getTypeBadge(selectedDoc.documentType)}
                  {getStatusBadge(selectedDoc.status)}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Image */}
                <div className="space-y-4">
                  <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={selectedDoc.imagePath}
                      alt="單據圖片"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-document.svg';
                      }}
                    />
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedDoc.originalFilename}
                  </div>
                </div>

                {/* Recognition Results */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    AI 辨識結果
                  </h3>

                  {selectedDoc.status === 'recognized' ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-gray-500">廠商/來源</Label>
                        <p className="font-medium">{selectedDoc.recognizedVendor || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">金額</Label>
                        <p className="text-xl font-bold text-primary">
                          {selectedDoc.recognizedAmount 
                            ? `$${parseFloat(selectedDoc.recognizedAmount).toLocaleString()}` 
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-gray-500">日期</Label>
                        <p className="font-medium">{selectedDoc.recognizedDate || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">說明</Label>
                        <p className="font-medium">{selectedDoc.recognizedDescription || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">分類</Label>
                        <p className="font-medium">{selectedDoc.recognizedCategory || '-'}</p>
                      </div>
                      {selectedDoc.recognizedInvoiceNumber && (
                        <div>
                          <Label className="text-gray-500">發票號碼</Label>
                          <p className="font-medium">{selectedDoc.recognizedInvoiceNumber}</p>
                        </div>
                      )}
                      {selectedDoc.aiConfidence && (
                        <div>
                          <Label className="text-gray-500">辨識信心度</Label>
                          <p className="font-medium">{Math.round(parseFloat(selectedDoc.aiConfidence) * 100)}%</p>
                        </div>
                      )}
                    </div>
                  ) : selectedDoc.status === 'processing' ? (
                    <div className="flex flex-col items-center py-8">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                      <p className="text-gray-500">AI 正在分析中，請稍候...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-8">
                      <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                      <p className="text-gray-500">辨識失敗，請重試或手動輸入</p>
                      <Button
                        className="mt-4"
                        onClick={() => reRecognizeMutation.mutate(selectedDoc.id)}
                        disabled={reRecognizeMutation.isPending}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${reRecognizeMutation.isPending ? 'animate-spin' : ''}`} />
                        重新辨識
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tracking Info Section */}
              <div className="space-y-2 border-t pt-4">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  追蹤資訊
                </Label>
                <div className="text-sm text-gray-600 bg-gray-50 rounded p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>上傳時間：{format(new Date(selectedDoc.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    <span>上傳帳號：{selectedDoc.uploadedByUsername || '未知用戶'}</span>
                  </div>
                  {selectedDoc.editedAt && selectedDoc.editedByUsername && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <User className="h-3 w-3" />
                      <span>編輯帳號：{selectedDoc.editedByUsername}（{format(new Date(selectedDoc.editedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}）</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Editable Notes Section */}
              <div className="space-y-2 border-t pt-4">
                <Label className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-blue-500" />
                  備註
                </Label>
                <Textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="輸入備註（例如：轉帳給誰、用途說明...）"
                  rows={2}
                  className="text-sm"
                  data-testid="input-preview-notes"
                />
                {editingNotes !== (selectedDoc.notes || '') && (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingNotes(selectedDoc.notes || '')}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => updateNotesMutation.mutate({ id: selectedDoc.id, notes: editingNotes })}
                      disabled={updateNotesMutation.isPending}
                      data-testid="btn-save-notes"
                    >
                      {updateNotesMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      )}
                      儲存備註
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => deleteMutation.mutate(selectedDoc.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  刪除
                </Button>

                {selectedDoc.status === 'recognized' && (
                  <Button
                    onClick={() => {
                      setShowPreviewDialog(false);
                      setShowArchiveDialog(true);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Archive className="h-4 w-4" />
                    歸檔整理
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Archive Dialog */}
      <ArchiveDialog
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        document={selectedDoc}
        projects={projects}
        paymentItems={paymentItems}
        onArchive={(type, data) => {
          if (selectedDoc) {
            archiveMutation.mutate({ id: selectedDoc.id, type, data });
          }
        }}
        isPending={archiveMutation.isPending}
      />
    </div>
  );
}

// Archive Dialog Component
function ArchiveDialog({
  open,
  onOpenChange,
  document,
  projects,
  paymentItems,
  onArchive,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentInbox | null;
  projects: any[];
  paymentItems: any[];
  onArchive: (type: string, data: any) => void;
  isPending: boolean;
}) {
  const [archiveType, setArchiveType] = useState<string>('');
  const [formData, setFormData] = useState<any>({});
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [itemSearch, setItemSearch] = useState('');
  const [itemPickerOpen, setItemPickerOpen] = useState(false);

  // Filter payment items based on project and search
  const filteredPaymentItems = useMemo(() => {
    let items = paymentItems.filter(i => i.status !== 'paid');
    
    // Filter by project
    if (selectedProjectFilter !== 'all') {
      items = items.filter(i => i.projectId?.toString() === selectedProjectFilter);
    }
    
    // Filter by search
    if (itemSearch.trim()) {
      const searchLower = itemSearch.toLowerCase();
      items = items.filter(i => 
        i.itemName?.toLowerCase().includes(searchLower) ||
        i.vendor?.toLowerCase().includes(searchLower)
      );
    }
    
    return items;
  }, [paymentItems, selectedProjectFilter, itemSearch]);

  // Get selected item details
  const selectedItem = useMemo(() => {
    if (!formData.paymentItemId) return null;
    return paymentItems.find(i => i.id === formData.paymentItemId);
  }, [paymentItems, formData.paymentItemId]);

  // Get project name by ID
  const getProjectName = (projectId: number | null) => {
    if (!projectId) return '無專案';
    const project = projects.find(p => p.id === projectId);
    return project?.projectName || '未知專案';
  };

  // Reset form when document changes or dialog opens
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

      // Auto-select archive type based on document type
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
          {/* Archive Type Selection */}
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

          {/* Payment Item Form */}
          {archiveType === 'payment-item' && (
            <div className="space-y-3">
              <div>
                <Label>項目名稱</Label>
                <Input
                  value={formData.itemName}
                  onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                  data-testid="input-item-name"
                />
              </div>
              <div>
                <Label>金額</Label>
                <Input
                  type="number"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                  data-testid="input-total-amount"
                />
              </div>
              <div>
                <Label>到期日</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
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

          {/* Payment Record Form - Enhanced with project filter and searchable items */}
          {archiveType === 'payment-record' && (
            <div className="space-y-3">
              {/* Step 1: Filter by Project */}
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

              {/* Step 2: Search and Select Payment Item */}
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
                                      amount: remaining.toString()
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

              {/* Selected Item Summary */}
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
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
              <div>
                <Label>付款日期</Label>
                <Input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                />
              </div>
              <div>
                <Label>付款方式</Label>
                <Select 
                  value={formData.paymentMethod} 
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

          {/* Invoice Form */}
          {archiveType === 'invoice' && (
            <div className="space-y-3">
              <div>
                <Label>發票號碼</Label>
                <Input
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                />
              </div>
              <div>
                <Label>發票日期</Label>
                <Input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                />
              </div>
              <div>
                <Label>廠商名稱</Label>
                <Input
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                />
              </div>
              <div>
                <Label>金額</Label>
                <Input
                  type="number"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                />
              </div>
              <div>
                <Label>分類</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
              <div>
                <Label>說明</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Original Upload Notes Display */}
          {document.notes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <Label className="text-blue-700 text-xs font-medium">上傳時備註</Label>
              <p className="text-sm text-blue-900 mt-1">{document.notes}</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>歸檔備註</Label>
            <Textarea
              value={formData.notes}
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
