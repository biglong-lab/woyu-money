// 快速記帳的分類欄位（收入分類 chips / 支出常用分類 chips + 完整分類下拉）
// 從原 household-budget.tsx 快速記帳 Dialog 內機械搬移
import type { UseFormReturn } from "react-hook-form"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { getCategoryDecor } from "@/lib/category-emoji"
import {
  INCOME_CATEGORIES,
  type EntryType,
  type IncomeCategory,
  type HouseholdCategory,
  type QuickAddFormData,
  type TopCategory,
} from "./types"

interface QuickAddCategoryFieldProps {
  entryType: EntryType
  incomeCategory: IncomeCategory
  setIncomeCategory: (category: IncomeCategory) => void
  quickAddForm: UseFormReturn<QuickAddFormData>
  topCategories: TopCategory[]
  householdCategories: HouseholdCategory[]
}

/** 分類選擇區塊：收入模式顯示 6 類 chips、支出模式顯示常用 chips + 完整下拉 */
export function QuickAddCategoryField({
  entryType,
  incomeCategory,
  setIncomeCategory,
  quickAddForm,
  topCategories,
  householdCategories,
}: QuickAddCategoryFieldProps) {
  return entryType === "income" ? (
    <div>
      <Label>
        收入分類 <span className="text-red-500">*</span>
      </Label>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {INCOME_CATEGORIES.map((cat) => {
          const selected = incomeCategory === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setIncomeCategory(cat)}
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-all active:scale-95",
                selected
                  ? "bg-emerald-100 text-emerald-800 border-emerald-400 font-semibold ring-2 ring-emerald-200"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              )}
              data-testid={`income-category-${cat}`}
            >
              {cat === "薪資" && "💼"}
              {cat === "獎金" && "🎁"}
              {cat === "投資" && "📈"}
              {cat === "副業" && "🛠️"}
              {cat === "退款" && "↩️"}
              {cat === "其他" && "📦"}
              {cat}
            </button>
          )
        })}
      </div>
    </div>
  ) : (
    <div>
      <Label htmlFor="categoryId">
        分類 <span className="text-red-500">*</span>
      </Label>
      {topCategories.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] text-gray-500 mb-1">📌 常用</div>
          <div className="flex flex-wrap gap-1.5">
            {topCategories.map((tc) => {
              const isSelected = quickAddForm.watch("categoryId") === String(tc.categoryId)
              const decor = getCategoryDecor(tc.categoryName)
              return (
                <button
                  key={tc.categoryId}
                  type="button"
                  onClick={() =>
                    quickAddForm.setValue("categoryId", String(tc.categoryId), {
                      shouldValidate: true,
                    })
                  }
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-all",
                    "active:scale-95",
                    isSelected
                      ? "border-amber-400 font-semibold ring-2 ring-amber-200"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  style={{
                    backgroundColor: isSelected ? `${decor.color}22` : "white",
                    color: isSelected ? decor.color : "#374151",
                  }}
                  data-testid={`category-chip-${tc.categoryId}`}
                >
                  <span className="text-sm">{decor.emoji}</span>
                  {tc.categoryName}
                  <span className="text-gray-400">×{tc.uses}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <Select
        value={quickAddForm.watch("categoryId")}
        onValueChange={(value: string) => quickAddForm.setValue("categoryId", value)}
      >
        <SelectTrigger>
          <SelectValue placeholder="或從完整分類選擇" />
        </SelectTrigger>
        <SelectContent>
          {householdCategories.map((category: HouseholdCategory) => (
            <SelectItem key={category.id} value={category.id.toString()}>
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                {category.categoryName}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
