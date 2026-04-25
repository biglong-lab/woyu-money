import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Receipt,
  Calendar,
  Building2,
  Target,
  DollarSign,
  Filter,
  Search,
  Eye,
  FileText,
  Download,
  Image,
  X,
} from "lucide-react"
import { PaymentItemDetails } from "@/components/payment-item-details"
import { useCopyAmount } from "@/hooks/use-copy-amount"
import { formatNT } from "@/lib/utils"
import { useDocumentTitle } from "@/hooks/use-document-title"
import type { PaymentItem } from "@shared/schema"

// 專案篩選選項
interface ProjectOption {
  id: number
  projectName: string
}

// 分類篩選選項
interface CategoryOption {
  id: number
  categoryName: string
}

// 合併後的分類（含來源標記）
interface MergedCategory extends CategoryOption {
  categoryType: string
  source: string
}

// 付款項目基本資訊（用於詳情顯示）
interface PaymentItemBasic {
  id: number
  itemName: string
  totalAmount: string
  projectName?: string
  categoryName?: string
  itemType: string
  notes?: string | null
}

interface PaymentRecordWithDetails {
  id: number
  itemId: number
  amount: string
  paymentDate: string
  paymentMethod: string
  notes: string
  receiptImageUrl: string
  itemName: string
  itemType: string
  projectName: string
  categoryName: string
  totalAmount: string
}

// 付款方式中文對照表
const getPaymentMethodText = (method: string) => {
  const methodMap: { [key: string]: string } = {
    bank_transfer: "銀行轉帳",
    cash: "現金",
    credit_card: "信用卡",
    digital_payment: "數位支付",
    check: "支票",
    other: "其他",
  }
  return methodMap[method] || method || "未知方式"
}

export default function PaymentRecords() {
  useDocumentTitle("付款紀錄")
  const [location] = useLocation()
  const copyAmount = useCopyAmount()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProject, setSelectedProject] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedMethod, setSelectedMethod] = useState<string>("all")
  const [selectedItem, setSelectedItem] = useState<PaymentItem | PaymentItemBasic | null>(null)
  const [dateRange, setDateRange] = useState<string>("all")
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [downloadOptions, setDownloadOptions] = useState({
    includeReceipts: false,
    format: "excel" as "excel" | "csv",
    dateFrom: "",
    dateTo: "",
    projectFilter: "all",
    categoryFilter: "all",
  })

  // Handle URL parameters for filtering
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const filter = urlParams.get("filter")

    if (filter === "current-month-paid") {
      setDateRange("current-month")
    }
  }, [location])

  // 查詢付款記錄
  const {
    data: paymentRecords = [],
    isLoading,
    refetch: refetchRecords,
  } = useQuery<PaymentRecordWithDetails[]>({
    queryKey: ["/api/payment/records"],
    refetchOnWindowFocus: false,
    staleTime: 0, // 移除緩存，立即更新
    refetchInterval: false,
    refetchOnMount: true, // 允許重新掛載時更新
  })

  // 查詢專案列表
  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ["/api/payment/projects"],
  })

  // 查詢所有分類列表（固定分類和專案分類）
  const { data: projectCategories = [] } = useQuery<CategoryOption[]>({
    queryKey: ["/api/categories/project"],
  })

  const { data: fixedCategories = [] } = useQuery<CategoryOption[]>({
    queryKey: ["/api/fixed-categories"],
  })

  // 合併所有分類
  const allCategories: MergedCategory[] = [
    ...fixedCategories.map((cat) => ({ ...cat, categoryType: "fixed", source: "家用分類" })),
    ...projectCategories.map((cat) => ({
      ...cat,
      categoryType: "project",
      source: "專案分類",
    })),
  ]

  // 查詢付款項目（用於詳情顯示）
  const { data: paymentItemsResponse } = useQuery<{ items: PaymentItem[] }>({
    queryKey: ["/api/payment/items"],
  })

  const paymentItems: PaymentItem[] = paymentItemsResponse?.items || []

  // 過濾記錄
  const filteredRecords = paymentRecords
    .filter((record: PaymentRecordWithDetails) => {
      const matchesSearch =
        !searchTerm ||
        record.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.projectName?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesProject =
        selectedProject === "all" ||
        record.projectName ===
          projects.find((p) => p.id.toString() === selectedProject)?.projectName

      const matchesCategory =
        selectedCategory === "all" ||
        record.categoryName ===
          allCategories.find((c) => c.id.toString() === selectedCategory)?.categoryName

      const matchesMethod = selectedMethod === "all" || record.paymentMethod === selectedMethod

      // 日期範圍過濾
      let matchesDate = true
      const recordDate = new Date(record.paymentDate)

      // 年份篩選
      if (selectedYear && recordDate.getFullYear() !== selectedYear) {
        matchesDate = false
      }

      // 月份篩選
      if (selectedMonth !== null && recordDate.getMonth() !== selectedMonth) {
        matchesDate = false
      }

      // 自訂日期範圍篩選
      if (startDate && recordDate < new Date(startDate)) {
        matchesDate = false
      }
      if (endDate && recordDate > new Date(endDate)) {
        matchesDate = false
      }

      // 預設時間範圍篩選
      if (dateRange !== "all" && !startDate && !endDate) {
        const today = new Date()

        switch (dateRange) {
          case "today":
            matchesDate = recordDate.toDateString() === today.toDateString()
            break
          case "week": {
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
            matchesDate = recordDate >= weekAgo
            break
          }
          case "month": {
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
            matchesDate = recordDate >= monthAgo
            break
          }
          case "quarter": {
            const quarterAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
            matchesDate = recordDate >= quarterAgo
            break
          }
          case "current-month": {
            const currentMonth = today.getMonth()
            const currentYear = today.getFullYear()
            matchesDate =
              recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear
            break
          }
        }
      }

      return matchesSearch && matchesProject && matchesCategory && matchesMethod && matchesDate
    })
    .sort((a, b) => {
      const today = new Date()
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

      const aDate = new Date(a.paymentDate)
      const bDate = new Date(b.paymentDate)

      const aIsRecent = aDate >= thirtyDaysAgo
      const bIsRecent = bDate >= thirtyDaysAgo

      // 優先顯示近30天的記錄
      if (aIsRecent && !bIsRecent) return -1
      if (!aIsRecent && bIsRecent) return 1

      // 相同優先級內按日期倒序排列
      return bDate.getTime() - aDate.getTime()
    })

  // 統計數據
  const totalAmount = filteredRecords.reduce((sum, record) => sum + parseFloat(record.amount), 0)
  const totalRecords = filteredRecords.length

  // 付款方式統計
  const methodCounts = filteredRecords.reduce(
    (acc, record) => {
      const method = record.paymentMethod || "未知"
      acc[method] = (acc[method] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // 處理查看項目詳情
  const handleViewItemDetails = (record: PaymentRecordWithDetails) => {
    const foundItem = paymentItems.find((pi) => pi.id === record.itemId)
    if (foundItem) {
      setSelectedItem(foundItem)
    } else {
      // 如果找不到詳細項目，創建一個基本的項目對象用於顯示
      const basicItem: PaymentItemBasic = {
        id: record.itemId,
        itemName: record.itemName,
        totalAmount: record.totalAmount,
        projectName: record.projectName,
        categoryName: record.categoryName,
        itemType: record.itemType,
        notes: record.notes,
      }
      setSelectedItem(basicItem)
    }
  }

  // 處理檔案下載
  const handleDownload = async () => {
    try {
      const params = new URLSearchParams()

      // 設定篩選參數
      if (downloadOptions.dateFrom) params.append("dateFrom", downloadOptions.dateFrom)
      if (downloadOptions.dateTo) params.append("dateTo", downloadOptions.dateTo)
      if (downloadOptions.projectFilter !== "all")
        params.append("projectId", downloadOptions.projectFilter)
      if (downloadOptions.categoryFilter !== "all")
        params.append("categoryId", downloadOptions.categoryFilter)
      if (downloadOptions.includeReceipts) params.append("includeReceipts", "true")
      params.append("format", downloadOptions.format)

      const response = await fetch(`/api/payment/records/export?${params.toString()}`)

      if (!response.ok) {
        throw new Error("匯出失敗")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url

      const filename = `付款記錄_${downloadOptions.dateFrom || "全部"}_${downloadOptions.dateTo || "至今"}.${downloadOptions.format === "excel" ? "xlsx" : "csv"}`
      a.download = filename

      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setShowDownloadDialog(false)
    } catch (error) {
      console.error("下載失敗:", error)
      alert("檔案下載失敗，請稍後再試")
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">付款記錄</h1>
        <p className="text-sm sm:text-base text-gray-600">
          完整的付款歷史記錄，支援多維度篩選和詳細查看
        </p>
      </div>

      {/* 響應式統計卡片 */}
      <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">總付款金額</CardTitle>
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold text-green-600">
              {formatNT(totalAmount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">付款記錄數</CardTitle>
            <Receipt className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold">{totalRecords}</div>
          </CardContent>
        </Card>

        <Card className="hidden sm:block">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">主要付款方式</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {Object.entries(methodCounts)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 2)
                .map(([method, count]) => (
                  <div key={method} className="flex justify-between">
                    <span className="text-gray-600">{method}</span>
                    <span className="font-medium">{count as number}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="hidden sm:block">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均付款金額</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalRecords > 0 ? formatNT(totalAmount / totalRecords) : formatNT(0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 篩選控制 */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-base sm:text-lg">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
              篩選與搜尋
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchRecords()}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <Download className="w-4 h-4" />
              刷新記錄
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            {/* 響應式篩選網格 */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="搜尋項目名稱或備註..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setSearchTerm("")
                  }}
                  className="pl-10 pr-9"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                    title="清除搜尋（Esc）"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇專案" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有專案</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇分類" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有分類</SelectItem>
                  {allCategories.map((category) => (
                    <SelectItem
                      key={`${category.categoryType}-${category.id}`}
                      value={category.id.toString()}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{category.categoryName}</span>
                        <span className="text-xs text-gray-500 ml-2">{category.source}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="付款方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有方式</SelectItem>
                  <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                  <SelectItem value="cash">現金</SelectItem>
                  <SelectItem value="credit_card">信用卡</SelectItem>
                  <SelectItem value="digital_payment">數位支付</SelectItem>
                  <SelectItem value="check">支票</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue placeholder="時間範圍" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有時間</SelectItem>
                  <SelectItem value="today">今日</SelectItem>
                  <SelectItem value="week">近7天</SelectItem>
                  <SelectItem value="month">近30天</SelectItem>
                  <SelectItem value="current-month">本月</SelectItem>
                  <SelectItem value="quarter">近90天</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("")
                  setSelectedProject("all")
                  setSelectedCategory("all")
                  setSelectedMethod("all")
                  setDateRange("all")
                  setSelectedYear(new Date().getFullYear())
                  setSelectedMonth(null)
                  setStartDate("")
                  setEndDate("")
                }}
              >
                清除篩選
              </Button>
            </div>

            {/* 響應式第二行篩選 */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 items-end">
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium">年份</label>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - 5 + i
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}年
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium">月份</label>
                <Select
                  value={selectedMonth?.toString() || "all"}
                  onValueChange={(value) =>
                    setSelectedMonth(value === "all" ? null : parseInt(value))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇月份" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部月份</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {i + 1}月
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium">開始日期</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium">結束日期</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>

              <Button
                variant="default"
                onClick={() => setShowDownloadDialog(true)}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                匯出記錄
              </Button>

              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 col-span-2 sm:col-span-3 lg:col-span-2">
                <p className="text-xs text-blue-700">
                  <span className="font-medium">💡 提示：</span>
                  <span className="hidden sm:inline">
                    可同時使用年月篩選和自訂日期範圍進行精確查詢
                  </span>
                  <span className="sm:hidden">使用篩選精確查詢</span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 付款記錄列表 */}
      <Card>
        <CardHeader>
          <CardTitle>付款記錄列表</CardTitle>
          <CardDescription>
            顯示 {filteredRecords.length} 筆付款記錄，總金額 {formatNT(totalAmount)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredRecords.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-gray-500">
                <Receipt className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-gray-300" />
                <p className="text-base sm:text-lg font-medium mb-1 sm:mb-2">
                  無符合條件的付款記錄
                </p>
                <p className="text-sm">請調整篩選條件或搜尋關鍵字</p>
              </div>
            ) : (
              filteredRecords.map((record: PaymentRecordWithDetails) => (
                <div
                  key={record.id}
                  className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                >
                  {/* 響應式記錄卡片 */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-medium text-base sm:text-lg truncate">
                          {record.itemName}
                        </h3>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {getPaymentMethodText(record.paymentMethod)}
                        </Badge>
                        {record.receiptImageUrl && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Badge
                                variant="outline"
                                className="text-xs cursor-pointer hover:bg-gray-100"
                              >
                                <Image className="w-3 h-3 mr-1" />
                                查看收據
                              </Badge>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>付款收據圖片</DialogTitle>
                              </DialogHeader>
                              <div className="flex justify-center">
                                <img
                                  src={record.receiptImageUrl}
                                  alt="付款收據"
                                  className="max-w-full max-h-96 object-contain rounded-lg border"
                                  onError={(e) => {
                                    e.currentTarget.src =
                                      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWcluePh+eEoeazleaaguWFpTwvdGV4dD48L3N2Zz4="
                                  }}
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-2">
                        <div className="flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{record.projectName || "無專案"}</span>
                        </div>
                        <div className="flex items-center gap-1 truncate">
                          <Target className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{record.categoryName || "無分類"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span>{new Date(record.paymentDate).toLocaleDateString("zh-TW")}</span>
                        </div>
                        <div className="flex items-center gap-1 hidden sm:flex">
                          <FileText className="w-3 h-3 flex-shrink-0" />
                          <span>
                            {record.itemType === "project"
                              ? "專案項目"
                              : record.itemType === "home"
                                ? "家用項目"
                                : "一般項目"}
                          </span>
                        </div>
                      </div>

                      {record.notes && (
                        <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded mt-2">
                          <strong>備註：</strong>
                          {record.notes}
                        </div>
                      )}
                    </div>

                    {/* 金額和操作按鈕 */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:ml-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyAmount(parseFloat(record.amount), record.itemName)
                        }}
                        className="text-xl sm:text-2xl font-bold text-green-600 hover:underline cursor-pointer"
                        title="點擊複製金額"
                        data-testid={`copy-record-amount-${record.id}`}
                      >
                        +{formatNT(parseInt(record.amount))}
                      </button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewItemDetails(record)}
                        className="flex items-center gap-1 touch-target"
                      >
                        <Eye className="w-3 h-3" />
                        <span className="hidden sm:inline">查看項目</span>
                        <span className="sm:hidden">查看</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 項目詳情對話框 */}
      <PaymentItemDetails
        item={selectedItem as Parameters<typeof PaymentItemDetails>[0]["item"]}
        open={!!selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      />

      {/* Download Dialog */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>匯出付款記錄</DialogTitle>
            <DialogDescription>設定匯出選項，產生付款記錄檔案</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">匯出格式</label>
              <Select
                value={downloadOptions.format}
                onValueChange={(value) =>
                  setDownloadOptions((prev) => ({ ...prev, format: value as "excel" | "csv" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">開始日期</label>
                <Input
                  type="date"
                  value={downloadOptions.dateFrom}
                  onChange={(e) =>
                    setDownloadOptions((prev) => ({ ...prev, dateFrom: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">結束日期</label>
                <Input
                  type="date"
                  value={downloadOptions.dateTo}
                  onChange={(e) =>
                    setDownloadOptions((prev) => ({ ...prev, dateTo: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">專案篩選</label>
              <Select
                value={downloadOptions.projectFilter}
                onValueChange={(value) =>
                  setDownloadOptions((prev) => ({ ...prev, projectFilter: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有專案</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">分類篩選</label>
              <Select
                value={downloadOptions.categoryFilter}
                onValueChange={(value) =>
                  setDownloadOptions((prev) => ({ ...prev, categoryFilter: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有分類</SelectItem>
                  {allCategories.map((category) => (
                    <SelectItem
                      key={`${category.categoryType}-${category.id}`}
                      value={category.id.toString()}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{category.categoryName}</span>
                        <span className="text-xs text-gray-500 ml-2">{category.source}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeReceipts"
                checked={downloadOptions.includeReceipts}
                onChange={(e) =>
                  setDownloadOptions((prev) => ({ ...prev, includeReceipts: e.target.checked }))
                }
                className="rounded border-gray-300"
              />
              <label htmlFor="includeReceipts" className="text-sm font-medium">
                包含收據圖片連結
              </label>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700">
                <span className="font-medium">⚠️ 注意：</span>
                匯出檔案將包含所有符合篩選條件的付款記錄，請確認篩選設定正確
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDownloadDialog(false)}>
              取消
            </Button>
            <Button onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              匯出檔案
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
