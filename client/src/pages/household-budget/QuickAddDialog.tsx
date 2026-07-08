// 快速記帳 Dialog（支出/收入切換、金額鍵盤、語音、收據上傳 + AI 辨識、+1 再記、sticky footer）
// 從原 household-budget.tsx 機械搬移、表單送出與按鈕行為完全不變
import { useState, useEffect } from "react"
import type { UseFormReturn } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Mic, MicOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCategoryDecor } from "@/lib/category-emoji"
import { AmountKeypad } from "@/components/amount-keypad"
import { ReceiptUploadButton } from "@/components/receipt-upload-button"
import { useIsMobile } from "@/hooks/use-mobile"
import { useVoiceInput } from "@/hooks/use-voice-input"
import { QuickAddCategoryField } from "./QuickAddCategoryField"
import type {
  CategorySuggestionsResponse,
  EntryType,
  HouseholdCategory,
  IncomeCategory,
  LastEntry,
  QuickAddFormData,
  TopCategory,
} from "./types"

interface QuickAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entryType: EntryType
  setEntryType: (type: EntryType) => void
  incomeCategory: IncomeCategory
  setIncomeCategory: (category: IncomeCategory) => void
  quickAddForm: UseFormReturn<QuickAddFormData>
  voice: ReturnType<typeof useVoiceInput>
  categorySuggestions: CategorySuggestionsResponse | undefined
  topCategories: TopCategory[]
  householdCategories: HouseholdCategory[]
  quickAddReceiptUrl: string | null
  setQuickAddReceiptUrl: (url: string | null) => void
  isRecognizing: boolean
  onRecognize: (imageUrl: string) => void
  lastEntry: LastEntry | null
  setContinueMode: (on: boolean) => void
  onQuickAdd: (data: QuickAddFormData) => void
  isSubmitting: boolean
}

/** 快速記帳 Dialog（含觸發按鈕） */
export function QuickAddDialog({
  open,
  onOpenChange,
  entryType,
  setEntryType,
  incomeCategory,
  setIncomeCategory,
  quickAddForm,
  voice,
  categorySuggestions,
  topCategories,
  householdCategories,
  quickAddReceiptUrl,
  setQuickAddReceiptUrl,
  isRecognizing,
  onRecognize,
  lastEntry,
  setContinueMode,
  onQuickAdd,
  isSubmitting,
}: QuickAddDialogProps) {
  const isMobile = useIsMobile()
  // 大鍵盤切換：手機預設開、桌面預設關
  const [useKeypad, setUseKeypad] = useState<boolean>(false)
  useEffect(() => {
    if (isMobile) setUseKeypad(true)
  }, [isMobile])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          快速記帳
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="sticky top-0 z-10 bg-white border-b p-4 m-0">
          <DialogTitle>快速記帳</DialogTitle>
          <DialogDescription>
            {entryType === "expense" ? "快速記錄今天的支出" : "記錄收入（薪資 / 獎金 / 投資 / 副業）"}
          </DialogDescription>
          {/* 支出 / 收入 切換 tab */}
          <div className="flex bg-gray-100 rounded-lg p-1 mt-2">
            <button
              type="button"
              onClick={() => setEntryType("expense")}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded transition-all active:scale-95",
                entryType === "expense"
                  ? "bg-rose-500 text-white shadow"
                  : "text-gray-600 hover:bg-gray-200"
              )}
              data-testid="tab-entry-expense"
            >
              💸 支出
            </button>
            <button
              type="button"
              onClick={() => setEntryType("income")}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded transition-all active:scale-95",
                entryType === "income"
                  ? "bg-emerald-500 text-white shadow"
                  : "text-gray-600 hover:bg-gray-200"
              )}
              data-testid="tab-entry-income"
            >
              💰 收入
            </button>
          </div>
        </DialogHeader>
        <form onSubmit={quickAddForm.handleSubmit(onQuickAdd)} className="space-y-4 p-4 pb-2">
          <div>
            <div className="flex items-center justify-between mb-1 gap-2">
              <Label htmlFor="amount">
                金額 <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                {voice.isSupported && (
                  <button
                    type="button"
                    onClick={() => (voice.isListening ? voice.stop() : voice.start())}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border transition-all active:scale-95",
                      voice.isListening
                        ? "bg-rose-500 text-white border-rose-600 animate-pulse shadow"
                        : "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
                    )}
                    data-testid="button-voice-input"
                    title={
                      voice.isListening ? "點擊結束錄音" : "語音記帳、例如「150 元 早餐 全家」"
                    }
                  >
                    {voice.isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    {voice.isListening ? "聆聽中…" : "語音"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setUseKeypad((v) => !v)}
                  className="text-[10px] text-gray-500 underline"
                >
                  {useKeypad ? "切換鍵盤輸入" : "切換大鍵盤"}
                </button>
              </div>
            </div>
            {/* 語音即時轉錄 */}
            {voice.isListening && (
              <div className="mb-2 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-800">
                🎤 正在聆聽：{voice.transcript || "（請說話、例如「150 元 早餐 全家」）"}
              </div>
            )}
            {voice.error && (
              <div className="mb-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {voice.error}
              </div>
            )}
            {!useKeypad && (
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="輸入金額"
                onFocus={(e) => e.target.select()}
                autoFocus
                inputMode="decimal"
                {...quickAddForm.register("amount", { required: true })}
              />
            )}
            {useKeypad && (
              <AmountKeypad
                value={quickAddForm.watch("amount") || ""}
                onChange={(v) => quickAddForm.setValue("amount", v, { shouldValidate: true })}
                onConfirm={() => quickAddForm.handleSubmit(onQuickAdd)()}
              />
            )}
          </div>
          <QuickAddCategoryField
            entryType={entryType}
            incomeCategory={incomeCategory}
            setIncomeCategory={setIncomeCategory}
            quickAddForm={quickAddForm}
            topCategories={topCategories}
            householdCategories={householdCategories}
          />
          <div>
            <Label htmlFor="description">
              備註 <span className="text-xs text-gray-400 font-normal">（選填）</span>
            </Label>
            <Textarea
              id="description"
              placeholder="例如：早餐、加油"
              rows={2}
              {...quickAddForm.register("description")}
            />
            {/* 智能分類建議 */}
            {categorySuggestions &&
              categorySuggestions.suggestions.length > 0 &&
              (() => {
                const currentCatId = quickAddForm.watch("categoryId")
                const filtered = categorySuggestions.suggestions.filter(
                  (s) => String(s.categoryId) !== currentCatId
                )
                if (filtered.length === 0) return null
                return (
                  <div className="mt-2 p-2 rounded-lg bg-violet-50 border border-violet-200">
                    <div className="text-[10px] text-violet-700 mb-1.5">
                      💡 依過去記錄、建議分類：
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {filtered.map((s) => {
                        const decor = getCategoryDecor(s.categoryName)
                        return (
                          <button
                            key={s.categoryId}
                            type="button"
                            onClick={() =>
                              quickAddForm.setValue("categoryId", String(s.categoryId), {
                                shouldValidate: true,
                              })
                            }
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border",
                              "bg-white hover:shadow-sm active:scale-95 transition-all"
                            )}
                            style={{
                              borderColor: decor.color,
                              color: decor.color,
                            }}
                            data-testid={`suggest-category-${s.categoryId}`}
                          >
                            <span className="text-sm">{decor.emoji}</span>
                            {s.categoryName}
                            <span className="text-gray-400">({s.occurrences})</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
          </div>
          <div>
            <Label htmlFor="paymentMethod">
              付款方式 <span className="text-red-500">*</span>
            </Label>
            <Select
              onValueChange={(value: string) => quickAddForm.setValue("paymentMethod", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="選擇付款方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">現金</SelectItem>
                <SelectItem value="card">信用卡</SelectItem>
                <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                <SelectItem value="mobile_payment">行動支付</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="date">
              日期 <span className="text-red-500">*</span>
            </Label>
            <Input id="date" type="date" {...quickAddForm.register("date", { required: true })} />
          </div>
          {entryType === "expense" && (
            <div>
              <Label>
                收據照片{" "}
                <span className="text-xs text-gray-400 font-normal">（選填、拍照即可附存證）</span>
              </Label>
              <ReceiptUploadButton value={quickAddReceiptUrl} onChange={setQuickAddReceiptUrl} />
              {quickAddReceiptUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1 text-purple-700 border-purple-300 hover:bg-purple-50"
                  disabled={isRecognizing}
                  onClick={() => onRecognize(quickAddReceiptUrl)}
                >
                  {isRecognizing ? "🤖 辨識中…" : "✨ AI 自動填金額/品項/日期"}
                </Button>
              )}
            </div>
          )}
          {/* 上一筆「+1 再記」快速按鈕 */}
          {lastEntry && (
            <button
              type="button"
              onClick={() => {
                quickAddForm.setValue("amount", lastEntry.amount)
                quickAddForm.setValue("description", lastEntry.description || "")
                quickAddForm.setValue("categoryId", lastEntry.categoryId)
              }}
              className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 text-xs text-amber-700 hover:bg-amber-100 active:scale-[0.99] transition-all"
              data-testid="button-plus-one-again"
            >
              📋 +1 同上：NT$ {Math.round(parseFloat(lastEntry.amount || "0")).toLocaleString()}
              {lastEntry.description && (
                <span className="text-gray-500"> · {lastEntry.description.slice(0, 20)}</span>
              )}
            </button>
          )}
        </form>

        {/* Sticky footer — 雙明確按鈕、不用 toggle */}
        <div className="sticky bottom-0 z-10 bg-white border-t p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10px] text-gray-400 px-1">
            <a
              href="/categories"
              className="underline hover:text-amber-600"
              data-testid="link-manage-categories"
            >
              ⚙️ 找不到分類？管理 →
            </a>
            <span>ESC 或點外部關閉</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setContinueMode(false)
                onOpenChange(false)
              }}
              data-testid="button-cancel-quickadd"
            >
              取消
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setContinueMode(true)
                quickAddForm.handleSubmit(onQuickAdd)()
              }}
              disabled={isSubmitting}
              className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300"
              data-testid="button-submit-continue"
            >
              記、繼續
            </Button>
            <Button
              type="button"
              onClick={() => {
                setContinueMode(false)
                quickAddForm.handleSubmit(onQuickAdd)()
              }}
              disabled={isSubmitting}
              data-testid="button-submit-quickadd"
            >
              記錄
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
