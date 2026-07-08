// 快速記帳表單邏輯（表單 / deeplink / 手勢複製 / 智能分類建議 / 語音輸入）
// 從原 household-budget.tsx 機械搬移、effect 註冊順序與原檔一致
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { localDateISO } from "@/lib/utils"
import { useVoiceInput } from "@/hooks/use-voice-input"
import type { QuickAddFormData, CategorySuggestionsResponse } from "./types"

interface UseQuickAddFormParams {
  showQuickAdd: boolean
  setShowQuickAdd: (open: boolean) => void
}

/**
 * 快速記帳表單相關邏輯集中處
 * 回傳：表單實例、語音輸入狀態、智能分類建議
 */
export function useQuickAddForm({ showQuickAdd, setShowQuickAdd }: UseQuickAddFormParams) {
  const { toast } = useToast()

  // 快速記帳表單
  const quickAddForm = useForm<QuickAddFormData>({
    defaultValues: {
      amount: "",
      categoryId: "",
      description: "",
      paymentMethod: "cash",
      date: localDateISO(),
    },
  })

  // ?quickAdd=1 → 自動開快速記帳（FAB 從其他頁來的 deeplink）
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("quickAdd") === "1") {
      setShowQuickAdd(true)
      // 清掉 query 避免再次觸發
      const url = new URL(window.location.href)
      url.searchParams.delete("quickAdd")
      window.history.replaceState({}, "", url.toString())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 監聽手勢「複製為新一筆」event（從 SwipeableExpenseRow 觸發）
  useEffect(() => {
    function onDuplicateRequest(e: Event): void {
      const detail = (
        e as CustomEvent<{
          amount: string
          categoryId: number | null
          description: string
          paymentMethod: string | null
        }>
      ).detail
      if (!detail) return
      if (detail.amount) {
        quickAddForm.setValue("amount", detail.amount, { shouldValidate: true })
      }
      if (detail.categoryId) {
        quickAddForm.setValue("categoryId", String(detail.categoryId), { shouldValidate: true })
      }
      if (detail.description) quickAddForm.setValue("description", detail.description)
      if (detail.paymentMethod) quickAddForm.setValue("paymentMethod", detail.paymentMethod)
      setShowQuickAdd(true)
    }
    window.addEventListener("household:duplicate-expense", onDuplicateRequest)
    return () => window.removeEventListener("household:duplicate-expense", onDuplicateRequest)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 智能分類建議：依備註輸入推測分類（debounce 400ms）
  const watchedDescription = quickAddForm.watch("description") || ""
  const [debouncedDesc, setDebouncedDesc] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebouncedDesc(watchedDescription.trim()), 400)
    return () => clearTimeout(t)
  }, [watchedDescription])

  // 語音輸入
  const voice = useVoiceInput()
  // 語音解析完成 → 自動填表單
  useEffect(() => {
    if (!voice.parsed) return
    const { amount, description } = voice.parsed
    if (amount) quickAddForm.setValue("amount", amount, { shouldValidate: true })
    if (description) quickAddForm.setValue("description", description)
    // 解析完不重複觸發
    voice.reset()
    toast({
      title: "🎤 語音辨識完成",
      description: `${amount ? `NT$ ${amount}` : ""} ${description ?? ""}`.trim() || "已填入",
    })
  }, [voice.parsed]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: categorySuggestions } = useQuery<CategorySuggestionsResponse>({
    queryKey: [
      `/api/household/suggest-category?description=${encodeURIComponent(debouncedDesc)}&limit=3`,
    ],
    enabled: showQuickAdd && debouncedDesc.length >= 2,
    staleTime: 30 * 1000,
  })

  return { quickAddForm, voice, categorySuggestions }
}
