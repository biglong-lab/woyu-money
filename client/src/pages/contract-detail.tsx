/** 合約詳情頁面 - 主入口元件 */

import { useParams } from "wouter"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft } from "lucide-react"
import { Link } from "wouter"
import {
  ContractOverviewCards,
  ContractDetailsTab,
  PricingTab,
  DocumentsTab,
  PaymentsTab,
  ManagementTab,
  calculateContractStatistics,
} from "./contract-detail/index"
import {
  useContractData,
  usePriceTiers,
  useContractDocuments,
  useRelatedPaymentItems,
  useDocumentUpload,
  useDocumentDelete,
} from "./contract-detail/hooks"

/** 合約詳情頁面主元件 */
export default function ContractDetail() {
  const { id } = useParams()

  // 資料查詢
  const { contract, isLoading: contractLoading, error: contractError } = useContractData(id)
  const { priceTiers, isLoading: tiersLoading } = usePriceTiers(id)
  const { documents, isLoading: documentsLoading } = useContractDocuments(id)
  const { paymentItems, isLoading: paymentsLoading } = useRelatedPaymentItems(contract)

  // 文件操作
  const upload = useDocumentUpload(id)
  const { deleteMutation } = useDocumentDelete(id)

  // 載入狀態
  if (contractLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  // 錯誤狀態
  if (contractError || !contract) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">合約不存在</h1>
          <p className="text-gray-600 mb-4">找不到指定的合約資訊</p>
          <Link href="/rental-management">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回租金管理
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const statistics = calculateContractStatistics(paymentItems)

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 頁首 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/rental-management">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回租金管理
            </Button>
          </Link>
          <div className="ml-4">
            <h1 className="text-2xl font-bold">{contract.contractName}</h1>
            <p className="text-gray-600">{contract.projectName}</p>
          </div>
        </div>
        <Badge variant={contract.isActive ? "default" : "secondary"}>
          {contract.isActive ? "生效中" : "已停用"}
        </Badge>
      </div>

      {/* 概覽卡片 */}
      <ContractOverviewCards contract={contract} statistics={statistics} />

      {/* 主要內容 Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">合約詳情</TabsTrigger>
          <TabsTrigger value="pricing">價格階段</TabsTrigger>
          <TabsTrigger value="documents">合約文件</TabsTrigger>
          <TabsTrigger value="payments">付款記錄</TabsTrigger>
          <TabsTrigger value="management">合約管理</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <ContractDetailsTab contract={contract} />
        </TabsContent>

        <TabsContent value="pricing">
          <PricingTab priceTiers={priceTiers} isLoading={tiersLoading} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab
            contractId={id || ""}
            documents={documents}
            isLoading={documentsLoading}
            isUploadDialogOpen={upload.isUploadDialogOpen}
            setIsUploadDialogOpen={upload.setIsUploadDialogOpen}
            uploadFile={upload.uploadFile}
            setUploadFile={upload.setUploadFile}
            uploadDescription={upload.uploadDescription}
            setUploadDescription={upload.setUploadDescription}
            handleFileUpload={upload.handleFileUpload}
            uploadPending={upload.uploadMutation.isPending}
            deleteMutation={deleteMutation}
          />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab paymentItems={paymentItems} isLoading={paymentsLoading} />
        </TabsContent>

        <TabsContent value="management">
          <ManagementTab contract={contract} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
