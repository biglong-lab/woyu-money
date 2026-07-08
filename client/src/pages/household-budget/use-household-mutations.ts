// 家用記帳頁面 mutations（收入 / 支出 / AI 辨識 / 刪除 / 預算設定）
// 從原 household-budget.tsx 機械搬移、API 呼叫與成功/失敗行為完全不變
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { UseFormReturn } from "react-hook-form"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import type {
  QuickAddFormData,
  BudgetFormData,
  AddExpensePayload,
  SetBudgetPayload,
  HouseholdCategory,
  IncomeCategory,
  EntryType,
  LastEntry,
  RecognizeReceiptResponse,
} from "./types"

interface UseHouseholdMutationsParams {
  selectedMonth: string
  entryType: EntryType
  incomeCategory: IncomeCategory
  continueMode: boolean
  quickAddReceiptUrl: string | null
  householdCategories: HouseholdCategory[]
  quickAddForm: UseFormReturn<QuickAddFormData>
  setQuickAddReceiptUrl: (url: string | null) => void
  setShowQuickAdd: (open: boolean) => void
  setShowBudgetSetup: (open: boolean) => void
  setLastEntry: (entry: LastEntry | null) => void
}

/**
 * 家用記帳頁面的所有 useMutation 與送出處理集中處
 */
export function useHouseholdMutations({
  selectedMonth,
  entryType,
  incomeCategory,
  continueMode,
  quickAddReceiptUrl,
  householdCategories,
  quickAddForm,
  setQuickAddReceiptUrl,
  setShowQuickAdd,
  setShowBudgetSetup,
  setLastEntry,
}: UseHouseholdMutationsParams) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // 快速記帳：統一失效所有家用相關查詢
  const invalidateHousehold = () => {
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/household/"),
    })
  }

  // 收入 mutation
  const addIncomeMutation = useMutation({
    mutationFn: async (data: {
      amount: string
      category: string
      description: string
      date: string
      paymentMethod: string
    }) => {
      return await apiRequest("POST", "/api/household/incomes", {
        amount: parseFloat(data.amount),
        category: data.category,
        description: data.description || null,
        date: data.date,
        paymentMethod: data.paymentMethod || "bank_transfer",
      })
    },
    onSuccess: () => {
      toast({ title: "💰 收入已記錄", description: `${incomeCategory} 入帳` })
      invalidateHousehold()
      if (continueMode) {
        quickAddForm.setValue("amount", "")
        quickAddForm.setValue("description", "")
      } else {
        setShowQuickAdd(false)
        quickAddForm.reset()
      }
    },
    onError: (e: Error) => {
      toast({ title: "記錄失敗", description: e.message, variant: "destructive" })
    },
  })

  // 支出 mutation
  const addExpenseMutation = useMutation({
    mutationFn: async (data: QuickAddFormData) => {
      const formattedData: AddExpensePayload = {
        ...data,
        amount: parseFloat(data.amount),
        categoryId: parseInt(data.categoryId),
        receiptImages: quickAddReceiptUrl ? [quickAddReceiptUrl] : undefined,
      }
      return await apiRequest("POST", "/api/household/expenses", formattedData)
    },
    onSuccess: (_data, vars) => {
      toast({
        title: "✅ 記帳成功",
        description: quickAddReceiptUrl ? "已記錄、附收據" : "支出已記錄",
      })
      invalidateHousehold()
      // 保存上一筆給「+1 再記」用
      setLastEntry({
        amount: vars.amount,
        description: vars.description,
        categoryId: vars.categoryId,
      })
      if (continueMode) {
        // 連續模式：只清金額、保留分類 / 付款方式 / 日期
        quickAddForm.setValue("amount", "")
        quickAddForm.setValue("description", "")
        setQuickAddReceiptUrl(null)
      } else {
        setShowQuickAdd(false)
        quickAddForm.reset()
        setQuickAddReceiptUrl(null)
      }
    },
    onError: (e: Error) => {
      toast({
        title: "記帳失敗",
        description: e.message || "請重試",
        variant: "destructive",
      })
    },
  })

  // AI 辨識收據自動填表
  const recognizeMutation = useMutation<RecognizeReceiptResponse, Error, string>({
    mutationFn: (imageUrl: string) =>
      apiRequest("POST", "/api/household/recognize-receipt", {
        imageUrl,
      }) as Promise<RecognizeReceiptResponse>,
    onSuccess: (data) => {
      if (!data.success) {
        toast({ title: "辨識失敗", description: data.error || "請手動填", variant: "destructive" })
        return
      }
      const e = data.extracted
      const filled: string[] = []
      if (e.amount != null && e.amount > 0) {
        quickAddForm.setValue("amount", String(e.amount))
        filled.push(`金額 $${e.amount}`)
      }
      if (e.date) {
        // 嘗試解析 YYYY-MM-DD 格式
        const m = e.date.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
        if (m) {
          const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
          quickAddForm.setValue("date", iso)
          filled.push(`日期 ${iso}`)
        }
      }
      if (e.vendor || e.description) {
        const desc = [e.vendor, e.description].filter(Boolean).join(" - ")
        quickAddForm.setValue("description", desc)
        filled.push("備註")
      }
      // category 模糊匹配 householdCategories 名稱
      if (e.category && householdCategories.length > 0) {
        const matched = householdCategories.find(
          (c) => c.categoryName.includes(e.category!) || e.category!.includes(c.categoryName)
        )
        if (matched) {
          quickAddForm.setValue("categoryId", String(matched.id))
          filled.push(`分類 ${matched.categoryName}`)
        }
      }
      toast({
        title: `✨ 辨識完成（信心 ${Math.round(data.confidence * 100)}%）`,
        description: filled.length > 0 ? `已自動填：${filled.join("、")}` : "未取得可用資料",
      })
    },
    onError: (err) => {
      toast({ title: "辨識請求失敗", description: err.message, variant: "destructive" })
    },
  })

  // 刪除支出
  const deleteExpenseMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/household-expenses/${id}`),
    onSuccess: () => {
      toast({ title: "✅ 已刪除支出" })
      invalidateHousehold()
    },
    onError: (e: Error) =>
      toast({ title: "刪除失敗", description: e.message, variant: "destructive" }),
  })

  // 設定預算（用 selectedMonth、不是固定本月）
  const setBudgetMutation = useMutation({
    mutationFn: async (data: BudgetFormData) => {
      const budgetData: SetBudgetPayload = {
        budgetAmount: parseFloat(data.monthlyBudget),
        month: selectedMonth,
        reason: data.reason?.trim() || undefined,
      }
      return await apiRequest("POST", "/api/household/budget", budgetData)
    },
    onSuccess: () => {
      toast({
        title: "預算設定成功",
        description: `${selectedMonth} 預算已更新`,
      })
      invalidateHousehold()
      setShowBudgetSetup(false)
    },
    onError: (e: Error) => {
      toast({
        title: "設定失敗",
        description: e.message || "請重試",
        variant: "destructive",
      })
    },
  })

  // 快速記帳送出（支出 / 收入 共用入口）
  const onQuickAdd = (data: QuickAddFormData) => {
    if (!data.amount) {
      toast({
        title: "請輸入金額",
        variant: "destructive",
      })
      return
    }
    if (entryType === "income") {
      addIncomeMutation.mutate({
        amount: data.amount,
        category: incomeCategory,
        description: data.description,
        date: data.date,
        paymentMethod: data.paymentMethod,
      })
      return
    }
    // 支出：分類必填
    if (!data.categoryId) {
      toast({
        title: "請選擇分類",
        variant: "destructive",
      })
      return
    }
    addExpenseMutation.mutate(data)
  }

  // 預算設定送出
  const onSetBudget = (data: BudgetFormData) => {
    setBudgetMutation.mutate(data)
  }

  return {
    addIncomeMutation,
    addExpenseMutation,
    recognizeMutation,
    deleteExpenseMutation,
    setBudgetMutation,
    onQuickAdd,
    onSetBudget,
  }
}
