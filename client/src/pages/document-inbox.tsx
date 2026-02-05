// 單據收件箱頁面 - 主框架
import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Clock } from "lucide-react";
import type { DocumentInbox } from "@shared/schema";

import { DOCUMENT_TYPES, type InboxStats } from "@/components/document-inbox-types";
import DocumentInboxUploadSection from "@/components/document-inbox-upload-section";
import DocumentInboxDocumentList from "@/components/document-inbox-document-list";
import DocumentInboxPreviewDialog from "@/components/document-inbox-preview-dialog";
import DocumentInboxArchiveDialog from "@/components/document-inbox-archive-dialog";

export default function DocumentInboxPage() {
  const { toast } = useToast();

  const [selectedType, setSelectedType] = useState<'bill' | 'payment' | 'invoice'>('bill');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedDoc, setSelectedDoc] = useState<DocumentInbox | null>(null);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 建構查詢 URL
  const getQueryUrl = () => {
    const params = new URLSearchParams();
    if (filterType !== 'all') params.set('documentType', filterType);
    if (filterStatus !== 'all') params.set('status', filterStatus);
    const queryString = params.toString();
    return `/api/document-inbox${queryString ? `?${queryString}` : ''}`;
  };

  const queryUrl = getQueryUrl();
  const { data: documents = [], isLoading } = useQuery<DocumentInbox[]>({
    queryKey: [queryUrl],
    refetchInterval: 5000,
  });

  const { data: stats } = useQuery<InboxStats>({
    queryKey: ['/api/document-inbox/stats'],
    refetchInterval: 10000,
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['/api/payment/projects'],
  });

  const { data: paymentItemsData = [] } = useQuery<any[]>({
    queryKey: ['/api/payment/items', { includeAll: 'true' }],
    queryFn: async () => {
      const response = await fetch('/api/payment/items?includeAll=true', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch payment items');
      return response.json();
    },
  });
  const paymentItems = Array.isArray(paymentItemsData) ? paymentItemsData : [];

  // 統一 invalidate
  const invalidateDocumentInboxQueries = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/document-inbox');
      },
    });
  };

  // 上傳
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

  const handleUpload = useCallback(async (files: FileList, notes: string) => {
    setIsUploading(true);
    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append('file', file);
    }
    formData.append('documentType', selectedType);
    if (notes) {
      formData.append('notes', notes);
    }

    try {
      await uploadMutation.mutateAsync(formData);
      toast({
        title: "上傳成功",
        description: files.length > 1
          ? `已上傳 ${files.length} 張圖片，正在進行 AI 辨識...`
          : "正在進行 AI 辨識...",
      });
    } catch {
      // mutation onError 已處理
    }
    setIsUploading(false);
  }, [selectedType, uploadMutation, toast]);

  // 重新辨識
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

  // 刪除
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/document-inbox/${id}`);
    },
    onSuccess: () => {
      invalidateDocumentInboxQueries();
      toast({ title: "已刪除" });
      setSelectedDoc(null);
      setShowPreviewDialog(false);
    },
  });

  // 歸檔
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

  // 更新備註
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 頁面標題 */}
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

      {/* 上傳區塊 */}
      <DocumentInboxUploadSection
        selectedType={selectedType}
        onSelectedTypeChange={setSelectedType}
        onUpload={handleUpload}
        isUploading={isUploading}
      />

      {/* 統計卡片 */}
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

      {/* 篩選 Tabs */}
      <Tabs value={filterStatus} onValueChange={setFilterStatus}>
        <TabsList>
          <TabsTrigger value="all" data-testid="filter-all">全部</TabsTrigger>
          <TabsTrigger value="processing" data-testid="filter-processing">辨識中</TabsTrigger>
          <TabsTrigger value="recognized" data-testid="filter-recognized">待整理</TabsTrigger>
          <TabsTrigger value="failed" data-testid="filter-failed">失敗</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 文件列表 */}
      <DocumentInboxDocumentList
        documents={documents}
        isLoading={isLoading}
        onSelectDocument={(doc) => {
          setSelectedDoc(doc);
          setShowPreviewDialog(true);
        }}
        onReRecognize={(id) => reRecognizeMutation.mutate(id)}
      />

      {/* 預覽 Dialog */}
      <DocumentInboxPreviewDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        document={selectedDoc}
        onDelete={(id) => deleteMutation.mutate(id)}
        onReRecognize={(id) => reRecognizeMutation.mutate(id)}
        reRecognizePending={reRecognizeMutation.isPending}
        onArchive={() => {
          setShowPreviewDialog(false);
          setShowArchiveDialog(true);
        }}
        onUpdateNotes={(id, notes) => updateNotesMutation.mutate({ id, notes })}
        updateNotesPending={updateNotesMutation.isPending}
      />

      {/* 歸檔 Dialog */}
      <DocumentInboxArchiveDialog
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
