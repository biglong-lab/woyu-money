// 單據收件箱頁面 - 主框架
import { useState, useCallback, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { Clock } from "lucide-react"
import type { DocumentInbox, PaymentProject, PaymentItem } from "@shared/schema"

import { DOCUMENT_TYPES, type InboxStats } from "@/components/document-inbox-types"
import DocumentInboxUploadSection from "@/components/document-inbox-upload-section"
import DocumentInboxDocumentList from "@/components/document-inbox-document-list"
import DocumentInboxPreviewDialog from "@/components/document-inbox-preview-dialog"
import DocumentInboxArchiveDialog from "@/components/document-inbox-archive-dialog"

// 歸檔資料型別定義
interface ArchiveToPaymentItemData {
  projectId?: number
  categoryId?: number
  name: string
  amount: number
  dueDate?: string
  notes?: string
}

interface ArchiveToPaymentRecordData {
  paymentItemId: number
  amount: number
  paymentDate: string
  notes?: string
}

interface ArchiveToInvoiceData {
  invoiceNumber: string
  amount: number
  invoiceDate: string
  vendorName?: string
  notes?: string
}

type ArchiveData = ArchiveToPaymentItemData | ArchiveToPaymentRecordData | ArchiveToInvoiceData

export default function DocumentInboxPage() {
  useDocumentTitle("單據收件箱")
  const { toast } = useToast()

  const [selectedType, setSelectedType] = useState<"bill" | "payment" | "invoice">("bill")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedDoc, setSelectedDoc] = useState<DocumentInbox | null>(null)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // 建構查詢 URL
  const getQueryUrl = () => {
    const params = new URLSearchParams()
    if (filterType !== "all") params.set("documentType", filterType)
    if (filterStatus !== "all") params.set("status", filterStatus)
    const queryString = params.toString()
    return `/api/document-inbox${queryString ? `?${queryString}` : ""}`
  }

  const queryUrl = getQueryUrl()
  const { data: documents = [], isLoading } = useQuery<DocumentInbox[]>({
    queryKey: [queryUrl],
    refetchInterval: 5000,
  })

  const { data: stats } = useQuery<InboxStats>({
    queryKey: ["/api/document-inbox/stats"],
    refetchInterval: 10000,
  })

  const { data: projects = [] } = useQuery<PaymentProject[]>({
    queryKey: ["/api/payment/projects"],
  })

  const { data: paymentItemsData = [] } = useQuery<PaymentItem[]>({
    queryKey: ["/api/payment/items", { includeAll: "true" }],
    queryFn: async () => {
      const response = await fetch("/api/payment/items?includeAll=true", { credentials: "include" })
      if (!response.ok) throw new Error("Failed to fetch payment items")
      return response.json()
    },
  })
  const paymentItems = Array.isArray(paymentItemsData) ? paymentItemsData : []

  // 統一 invalidate
  const invalidateDocumentInboxQueries = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0]
        return typeof key === "string" && key.startsWith("/api/document-inbox")
      },
    })
  }

  // 上傳
  const handleUpload = useCallback(
    async (files: FileList, notes: string) => {
      if (files.length > 20) {
        toast({
          title: "選擇檔案過多",
          description: `一次最多上傳 20 個檔案，您選擇了 ${files.length} 個，請分批上傳`,
          variant: "destructive",
        })
        return
      }
      setIsUploading(true)
      const fileArr = Array.from(files)

      // 每張獨立上傳（小請求、可並行、單張失敗不影響其他）
      // 解決：多張合併成單一大 multipart 請求在生產代理層偶發失敗（伺服器已處理但前端顯示錯誤）
      const buildForm = (file: File) => {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("documentType", selectedType)
        if (notes) fd.append("notes", notes)
        return fd
      }

      const settled = await Promise.allSettled(
        fileArr.map((file) => apiRequest("POST", "/api/document-inbox/upload", buildForm(file)))
      )
      const ok = settled.filter((s) => s.status === "fulfilled").length
      const fail = fileArr.length - ok

      invalidateDocumentInboxQueries()

      if (fail === 0) {
        toast({
          title: "上傳成功",
          description:
            fileArr.length > 1 ? `已上傳 ${ok} 張圖片，正在進行 AI 辨識...` : "正在進行 AI 辨識...",
        })
      } else if (ok > 0) {
        toast({
          title: `部分上傳成功（${ok}/${fileArr.length}）`,
          description: `${ok} 張成功辨識中、${fail} 張失敗，可重試失敗的`,
        })
      } else {
        const firstErr = settled.find((s) => s.status === "rejected") as
          | PromiseRejectedResult
          | undefined
        toast({
          title: "上傳失敗",
          description: firstErr?.reason?.message ?? "請稍後再試",
          variant: "destructive",
        })
      }
      setIsUploading(false)
    },
    [selectedType, toast]
  )

  // Share Target：處理從外部分享進來的圖片（PWA 安裝後可用）
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("shared") !== "1") return
    if (!("caches" in window)) return

    void (async () => {
      try {
        const cache = await caches.open("share-target-staging")
        const keys = await cache.keys()
        if (keys.length === 0) return

        const files: File[] = []
        for (const req of keys) {
          const res = await cache.match(req)
          if (res) {
            const blob = await res.blob()
            const filename = req.url.split("/").pop() || "shared-image"
            const cleanName = filename.replace(/^\d+-/, "") // 去掉前綴 index
            files.push(new File([blob], cleanName, { type: blob.type }))
          }
          await cache.delete(req) // 清理已處理的
        }

        if (files.length > 0) {
          // 轉成 FileList-like 給 handleUpload
          const dt = new DataTransfer()
          files.forEach((f) => dt.items.add(f))
          await handleUpload(dt.files, "從相簿分享進來")
        }

        // 清掉 URL 上的 ?shared=1
        const url = new URL(window.location.href)
        url.searchParams.delete("shared")
        window.history.replaceState({}, "", url.toString())
      } catch (err) {
        console.error("[share-target] processing failed:", err)
      }
    })()
  }, [handleUpload])

  // 重新辨識
  const reRecognizeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/document-inbox/${id}/re-recognize`)
    },
    onSuccess: () => {
      invalidateDocumentInboxQueries()
      toast({ title: "重新辨識中", description: "請稍候..." })
    },
    onError: (error: Error) => {
      toast({ title: "辨識失敗", description: error.message, variant: "destructive" })
    },
  })

  // 刪除
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/document-inbox/${id}`)
    },
    onSuccess: () => {
      invalidateDocumentInboxQueries()
      toast({ title: "已刪除" })
      setSelectedDoc(null)
      setShowPreviewDialog(false)
    },
  })

  // 歸檔
  interface ArchiveResponse {
    message?: string
    paymentItem?: { id: number; itemName?: string; totalAmount?: string }
    paymentRecord?: { id: number; amountPaid?: string }
    createdNewItem?: boolean
    markedAsPaid?: boolean
  }
  const archiveMutation = useMutation({
    mutationFn: async ({ id, type, data }: { id: number; type: string; data: ArchiveData }) => {
      return apiRequest<ArchiveResponse>(
        "POST",
        `/api/document-inbox/${id}/archive-to-${type}`,
        data
      )
    },
    onSuccess: (resp, variables) => {
      invalidateDocumentInboxQueries()
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/records"] })
      queryClient.invalidateQueries({ queryKey: ["/api/invoice-records"] })

      // 智慧 Toast：依後端回傳判斷實際做了什麼
      let title = "✅ 歸檔成功"
      let description: string
      if (resp?.createdNewItem || resp?.markedAsPaid) {
        // 建新並標記已付 / 帳單同步已付
        title = "✅ 已建立並標記已付"
        const itemName = resp.paymentItem?.itemName || "新項目"
        const amount = resp.paymentItem?.totalAmount
          ? `$${Number(resp.paymentItem.totalAmount).toLocaleString()}`
          : ""
        description = `「${itemName}」${amount} — 已自動建項目 + 付款紀錄`
      } else {
        const typeLabels: Record<string, string> = {
          "payment-item": "付款項目",
          "payment-record": "付款記錄",
          invoice: "發票記錄",
        }
        description = `已轉為${typeLabels[variables.type]}`
      }
      toast({ title, description })
      setShowArchiveDialog(false)
      setSelectedDoc(null)
    },
    onError: (error: Error) => {
      toast({ title: "歸檔失敗", description: error.message, variant: "destructive" })
    },
  })

  // 更新備註
  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }): Promise<DocumentInbox> => {
      return apiRequest("PATCH", `/api/document-inbox/${id}/notes`, {
        notes,
      }) as Promise<DocumentInbox>
    },
    onSuccess: (updatedDoc: DocumentInbox) => {
      invalidateDocumentInboxQueries()
      setSelectedDoc(updatedDoc)
      toast({ title: "備註已更新" })
    },
    onError: (error: Error) => {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" })
    },
  })

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">
            單據收件箱
          </h1>
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
            const stat = stats[type.value as keyof InboxStats]
            if (typeof stat !== "object") return null
            const Icon = type.icon
            return (
              <Card
                key={type.value}
                className={`cursor-pointer hover:shadow-md transition-shadow ${filterType === type.value ? "ring-2 ring-primary" : ""}`}
                onClick={() => setFilterType(filterType === type.value ? "all" : type.value)}
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
            )
          })}
        </div>
      )}

      {/* 篩選 Tabs */}
      <Tabs value={filterStatus} onValueChange={setFilterStatus}>
        <TabsList>
          <TabsTrigger value="all" data-testid="filter-all">
            全部
          </TabsTrigger>
          <TabsTrigger value="processing" data-testid="filter-processing">
            辨識中
          </TabsTrigger>
          <TabsTrigger value="recognized" data-testid="filter-recognized">
            待整理
          </TabsTrigger>
          <TabsTrigger value="failed" data-testid="filter-failed">
            失敗
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 文件列表 */}
      <DocumentInboxDocumentList
        documents={documents}
        isLoading={isLoading}
        onSelectDocument={(doc) => {
          setSelectedDoc(doc)
          setShowPreviewDialog(true)
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
          setShowPreviewDialog(false)
          setShowArchiveDialog(true)
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
            archiveMutation.mutate({
              id: selectedDoc.id,
              type,
              data: data as unknown as ArchiveData,
            })
          }
        }}
        isPending={archiveMutation.isPending}
      />
    </div>
  )
}
