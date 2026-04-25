/**
 * QuickAddDrawer - 快速記帳抽屜
 * 從底部滑出，讓使用者 3 步內完成記帳：
 * 1. 輸入項目名稱和金額（必填）
 * 2. 選擇專案和到期日（選填）
 * 3. 可附加拍照上傳單據
 */
import { useState, useRef, useCallback } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { localDateISO, formatNT, friendlyApiError } from "@/lib/utils"
import { Camera, CheckCircle2, Loader2, ImagePlus, X } from "lucide-react"

interface QuickAddDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 專案列表項目 */
interface ProjectItem {
  id: number
  projectName: string
}

// 最近使用的項目（localStorage 持久化，包含名稱 + 金額）
const RECENT_ITEMS_KEY = "quick-add:recent-items"
const RECENT_NAMES_KEY_OLD = "quick-add:recent-names" // 舊格式（v5.1）
const MAX_RECENT_ITEMS = 6

interface RecentItem {
  name: string
  amount: string
  endDate?: string // 截止日（選填）— 月固定項目可記住
  projectId?: string // 專案 ID（選填）— 重複記同一筆專案項目時免重選
}

function loadRecentItems(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_ITEMS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_RECENT_ITEMS)
    }
    // 從舊格式遷移
    const oldRaw = localStorage.getItem(RECENT_NAMES_KEY_OLD)
    if (oldRaw) {
      const old = JSON.parse(oldRaw)
      if (Array.isArray(old)) {
        return old.slice(0, MAX_RECENT_ITEMS).map((name: string) => ({ name, amount: "" }))
      }
    }
  } catch {
    // ignore
  }
  return []
}

function saveRecentItem(
  name: string,
  amount: string,
  endDate?: string,
  projectId?: string
): RecentItem[] {
  if (!name.trim()) return loadRecentItems()
  try {
    const current = loadRecentItems()
    const filtered = current.filter((item) => item.name !== name)
    const newItem: RecentItem = { name, amount }
    if (endDate) newItem.endDate = endDate
    if (projectId) newItem.projectId = projectId
    const updated = [newItem, ...filtered].slice(0, MAX_RECENT_ITEMS)
    localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(updated))
    return updated
  } catch {
    return loadRecentItems()
  }
}

export function QuickAddDrawer({ open, onOpenChange }: QuickAddDrawerProps) {
  const { toast } = useToast()
  const isOnline = useOnlineStatus()
  const cameraRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [itemName, setItemName] = useState("")
  const [totalAmount, setTotalAmount] = useState("")
  const [projectId, setProjectId] = useState<string>("")
  const [endDate, setEndDate] = useState("")
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [recentItems, setRecentItems] = useState<RecentItem[]>(loadRecentItems)

  // 查詢專案列表
  const { data: projectsData } = useQuery<ProjectItem[]>({
    queryKey: ["/api/payment/projects"],
    enabled: open,
  })
  const projects: ProjectItem[] = Array.isArray(projectsData) ? projectsData : []

  // 建立付款項目
  const createMutation = useMutation({
    mutationFn: async () => {
      const today = localDateISO()
      const payload: Record<string, unknown> = {
        itemName,
        totalAmount,
        startDate: today,
        paymentType: "single",
        itemType: "project",
      }
      if (projectId) payload.projectId = parseInt(projectId)
      if (endDate) payload.endDate = endDate

      const result = await apiRequest<{ id: number }>("POST", "/api/payment/items", payload)

      // 如果有附加照片，上傳到單據收件箱
      if (attachedFile) {
        const formData = new FormData()
        formData.append("file", attachedFile)
        formData.append("documentType", "bill")
        formData.append("notes", `快速記帳: ${itemName}`)
        await apiRequest("POST", "/api/document-inbox/upload", formData)
      }

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/project/stats"] })
      queryClient.invalidateQueries({ queryKey: ["/api/payment/projects/stats"] })
      if (attachedFile) {
        queryClient.invalidateQueries({ queryKey: ["/api/document-inbox"] })
      }
      // 儲存到最近使用清單（含金額 + 截止日 + 專案，如果有提供）
      const updated = saveRecentItem(
        itemName.trim(),
        totalAmount,
        endDate || undefined,
        projectId || undefined
      )
      setRecentItems(updated)
      setIsDone(true)
    },
    onError: (error: Error) => {
      toast({
        title: "記帳失敗",
        description: friendlyApiError(error),
        variant: "destructive",
      })
    },
  })

  const handlePhotoCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }, [])

  const removePhoto = useCallback(() => {
    setAttachedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (cameraRef.current) cameraRef.current.value = ""
  }, [previewUrl])

  const handleSubmit = () => {
    if (!itemName.trim() || !totalAmount) return
    createMutation.mutate()
  }

  // Enter 鍵直接提交（必填都填了才允許）
  const handleEnterSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return
    if (!itemName.trim() || !totalAmount || createMutation.isPending) return
    e.preventDefault()
    handleSubmit()
  }

  const handleClose = () => {
    setItemName("")
    setTotalAmount("")
    setProjectId("")
    setEndDate("")
    removePhoto()
    setIsDone(false)
    onOpenChange(false)
  }

  // 「再記一筆」：清空表單但不關閉 drawer
  const handleAddAnother = () => {
    setItemName("")
    setTotalAmount("")
    setProjectId("")
    setEndDate("")
    removePhoto()
    setIsDone(false)
    // 等下個 tick 表單渲染完再聚焦
    setTimeout(() => nameInputRef.current?.focus(), 50)
  }

  const canSubmit = itemName.trim().length > 0 && parseFloat(totalAmount) > 0

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[85vh]">
        {isDone ? (
          /* 完成畫面 */
          <div className="flex flex-col items-center py-8 px-6 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">記帳完成</h3>
              <p className="text-sm text-gray-500 mt-1">
                已建立「{itemName}」{formatNT(totalAmount)}
              </p>
            </div>
            <div className="flex gap-2 w-full max-w-xs">
              <Button
                variant="outline"
                onClick={handleAddAnother}
                className="flex-1"
                data-testid="qa-add-another"
              >
                ➕ 再記一筆
              </Button>
              <Button onClick={handleClose} className="flex-1" data-testid="qa-done">
                完成
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-center">快速記帳</DrawerTitle>
            </DrawerHeader>

            <div className="px-4 pb-2 space-y-4 overflow-y-auto">
              {/* 項目名稱 — 最重要的欄位 */}
              <div>
                <Label htmlFor="qa-name" className="text-sm font-medium">
                  項目名稱 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="qa-name"
                  ref={nameInputRef}
                  placeholder="例：水電費、保險、貨款..."
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  onKeyDown={handleEnterSubmit}
                  className="mt-1 h-12 text-base"
                  autoFocus
                />
                {/* 最近使用 chips（點擊同時填入名稱、金額、截止日、專案） */}
                {recentItems.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="text-xs text-gray-500 self-center">最近：</span>
                    {recentItems.map((item) => {
                      const tooltipParts: string[] = []
                      if (item.amount) {
                        tooltipParts.push(`金額 ${formatNT(parseFloat(item.amount))}`)
                      }
                      if (item.endDate) tooltipParts.push(`截止 ${item.endDate}`)
                      if (item.projectId) {
                        const proj = projects.find((p) => p.id === parseInt(item.projectId!))
                        if (proj) tooltipParts.push(`專案 ${proj.projectName}`)
                      }
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => {
                            setItemName(item.name)
                            if (item.amount) setTotalAmount(item.amount)
                            if (item.endDate) setEndDate(item.endDate)
                            if (item.projectId) setProjectId(item.projectId)
                          }}
                          className="text-xs px-2 py-1 rounded-full bg-gray-100 hover:bg-blue-100 hover:text-blue-700 transition-colors active:scale-95"
                          title={tooltipParts.join(" · ") || "點擊套用"}
                          data-testid={`recent-name-${item.name}`}
                        >
                          {item.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 金額 — 第二重要 */}
              <div>
                <Label htmlFor="qa-amount" className="text-sm font-medium">
                  金額 <span className="text-red-500">*</span>
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                    $
                  </span>
                  <Input
                    id="qa-amount"
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={handleEnterSubmit}
                    className="pl-8 h-12 text-base"
                  />
                </div>
                {/* 即時格式預覽（千分位 + NT$）— 確認輸入正確 */}
                {totalAmount && parseFloat(totalAmount) > 0 && (
                  <div className="mt-1 text-xs text-blue-700 font-medium">
                    = {formatNT(totalAmount)}
                  </div>
                )}
              </div>

              {/* 專案 + 到期日 — 同一行 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">
                    專案 <span className="text-gray-400 font-normal">（選填）</span>
                  </Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger className="mt-1 h-11">
                      <SelectValue placeholder="不指定" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不指定</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.projectName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="qa-date" className="text-sm font-medium">
                    到期日 <span className="text-gray-400 font-normal">（選填）</span>
                  </Label>
                  <Input
                    id="qa-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 h-11"
                  />
                  {/* 快速日期：今天 / 月底 / 下月 5 號 */}
                  <div className="mt-1 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEndDate(localDateISO())}
                      className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
                    >
                      今天
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        const eom = new Date(d.getFullYear(), d.getMonth() + 1, 0)
                        const yyyy = eom.getFullYear()
                        const mm = String(eom.getMonth() + 1).padStart(2, "0")
                        const dd = String(eom.getDate()).padStart(2, "0")
                        setEndDate(`${yyyy}-${mm}-${dd}`)
                      }}
                      className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
                    >
                      月底
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date()
                        const next5 = new Date(d.getFullYear(), d.getMonth() + 1, 5)
                        const yyyy = next5.getFullYear()
                        const mm = String(next5.getMonth() + 1).padStart(2, "0")
                        const dd = String(next5.getDate()).padStart(2, "0")
                        setEndDate(`${yyyy}-${mm}-${dd}`)
                      }}
                      className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
                    >
                      下月 5 號
                    </button>
                  </div>
                </div>
              </div>

              {/* 拍照附加單據 */}
              <div>
                {attachedFile && previewUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={previewUrl}
                      alt="附加單據"
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      onClick={removePhoto}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-11 gap-2 border-dashed"
                    onClick={() => cameraRef.current?.click()}
                  >
                    <ImagePlus className="w-4 h-4" />
                    附加單據照片（選填）
                  </Button>
                )}
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoCapture}
                />
              </div>
            </div>

            <DrawerFooter className="pt-2">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || createMutation.isPending || !isOnline}
                className="w-full h-12 text-base font-medium"
                title={!isOnline ? "離線中無法提交，請等網路恢復" : undefined}
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : null}
                {!isOnline ? "離線中" : "建立付款項目"}
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}

/**
 * QuickCameraUpload - 快速拍照上傳（直接開相機）
 * 不需要選擇文件類型，直接拍照上傳到單據收件箱
 */
export function useQuickCameraUpload() {
  const { toast } = useToast()
  const cameraRef = useRef<HTMLInputElement | null>(null)

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("documentType", "bill")
      formData.append("notes", "")
      return apiRequest("POST", "/api/document-inbox/upload", formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-inbox"] })
      queryClient.invalidateQueries({ queryKey: ["/api/document-inbox/stats"] })
      toast({
        title: "上傳成功",
        description: "單據已上傳，AI 正在辨識中...",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "上傳失敗",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const openCamera = useCallback(() => {
    // 動態建立 input 避免 DOM 殘留
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.capture = "environment"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) uploadMutation.mutate(file)
    }
    input.click()
    cameraRef.current = input
  }, [uploadMutation])

  return {
    openCamera,
    isUploading: uploadMutation.isPending,
  }
}

export default QuickAddDrawer
