/**
 * ExpenseSearchCard — 進階搜尋 / 篩選 / 排序
 *
 * 功能：
 *  - 文字搜尋（debounce 400ms）
 *  - 分類多選 chips
 *  - 金額範圍 min/max
 *  - 日期範圍 start/end
 *  - 排序（日期 / 金額 升降）
 *  - 結果列表（emoji + 分類 + 金額 + 備註 + 日期）
 *  - 顯示總筆數 + 總金額
 *
 * 預設摺疊、點擊展開（節省版面）
 */
import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Search, X, ChevronDown, ChevronUp, Filter } from "lucide-react"
import { getCategoryDecor } from "@/lib/category-emoji"

interface HouseholdCategory {
  id: number
  categoryName: string
  color: string
}

interface SearchExpense {
  id: number
  categoryId: number | null
  categoryName: string
  amount: string
  date: string
  paymentMethod: string | null
  description: string | null
}

interface SearchResponse {
  count: number
  totalAmount: number
  filters: Record<string, unknown>
  expenses: SearchExpense[]
}

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc"

export function ExpenseSearchCard() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [sort, setSort] = useState<SortKey>("date_desc")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400)
    return () => clearTimeout(t)
  }, [search])

  const hasAnyFilter = useMemo(
    () =>
      Boolean(
        debouncedSearch ||
        selectedCategoryIds.length > 0 ||
        minAmount ||
        maxAmount ||
        startDate ||
        endDate
      ),
    [debouncedSearch, selectedCategoryIds, minAmount, maxAmount, startDate, endDate]
  )

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (selectedCategoryIds.length > 0) params.set("categoryIds", selectedCategoryIds.join(","))
    if (minAmount && !isNaN(parseFloat(minAmount))) params.set("minAmount", minAmount)
    if (maxAmount && !isNaN(parseFloat(maxAmount))) params.set("maxAmount", maxAmount)
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)
    params.set("sort", sort)
    params.set("limit", "200")
    return params.toString()
  }, [debouncedSearch, selectedCategoryIds, minAmount, maxAmount, startDate, endDate, sort])

  const { data, isLoading } = useQuery<SearchResponse>({
    queryKey: [`/api/household/expenses/search?${queryString}`],
    enabled: open,
    staleTime: 30 * 1000,
  })

  const { data: categories = [] } = useQuery<HouseholdCategory[]>({
    queryKey: ["/api/categories/household"],
    staleTime: 10 * 60 * 1000,
    enabled: open,
  })

  function toggleCategory(id: number): void {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }
  function reset(): void {
    setSearch("")
    setSelectedCategoryIds([])
    setMinAmount("")
    setMaxAmount("")
    setStartDate("")
    setEndDate("")
    setSort("date_desc")
  }

  return (
    <Card className="border-2 border-gray-300 bg-gradient-to-br from-gray-50 to-slate-50">
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between text-left"
          data-testid="button-toggle-search"
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="w-4 h-4" />
            進階搜尋 / 篩選
            {hasAnyFilter && (
              <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
                有套用
              </span>
            )}
          </CardTitle>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {/* 文字搜尋 */}
          <div>
            <Label htmlFor="search-input" className="text-xs">
              🔍 文字搜尋（備註）
            </Label>
            <div className="relative">
              <Input
                id="search-input"
                placeholder="例如：咖啡 / 加油 / 星巴克"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-expense-search"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  aria-label="清除搜尋"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 分類多選 */}
          {categories.length > 0 && (
            <div>
              <Label className="text-xs">🏷️ 分類（多選）</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {categories.map((c) => {
                  const decor = getCategoryDecor(c.categoryName)
                  const selected = selectedCategoryIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-all active:scale-95",
                        selected
                          ? "font-semibold ring-2 ring-amber-200"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      )}
                      style={{
                        borderColor: selected ? decor.color : undefined,
                        backgroundColor: selected ? `${decor.color}22` : undefined,
                        color: selected ? decor.color : "#374151",
                      }}
                      data-testid={`filter-category-${c.id}`}
                    >
                      <span className="text-sm">{decor.emoji}</span>
                      {c.categoryName}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 金額 + 日期範圍 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="min-amount" className="text-xs">
                💵 最低金額
              </Label>
              <Input
                id="min-amount"
                type="number"
                step="1"
                placeholder="0"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="max-amount" className="text-xs">
                💵 最高金額
              </Label>
              <Input
                id="max-amount"
                type="number"
                step="1"
                placeholder="不限"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="start-date" className="text-xs">
                📅 開始日
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end-date" className="text-xs">
                📅 結束日
              </Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* 排序 + 重設 */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label htmlFor="sort-select" className="text-xs">
                ↕️ 排序
              </Label>
              <Select value={sort} onValueChange={(v: string) => setSort(v as SortKey)}>
                <SelectTrigger id="sort-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">📅 日期：新 → 舊</SelectItem>
                  <SelectItem value="date_asc">📅 日期：舊 → 新</SelectItem>
                  <SelectItem value="amount_desc">💰 金額：高 → 低</SelectItem>
                  <SelectItem value="amount_asc">💰 金額：低 → 高</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="self-end gap-1"
              data-testid="button-reset-filters"
            >
              <Filter className="w-3 h-3" />
              重設
            </Button>
          </div>

          {/* 結果統計 */}
          {data && (
            <div className="bg-white rounded-lg p-2 border flex items-center justify-between text-xs">
              <span>
                共 <strong className="text-base text-gray-900">{data.count}</strong> 筆
              </span>
              <span>
                總計{" "}
                <strong className="text-base text-amber-700">
                  NT$ {data.totalAmount.toLocaleString()}
                </strong>
              </span>
            </div>
          )}

          {/* 結果列表 */}
          {isLoading && <div className="text-sm text-gray-500 py-4 text-center">搜尋中…</div>}
          {!isLoading && data && data.expenses.length === 0 && (
            <div className="text-sm text-gray-500 py-4 text-center">沒有符合的紀錄</div>
          )}
          {!isLoading && data && data.expenses.length > 0 && (
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {data.expenses.map((e) => {
                const decor = getCategoryDecor(e.categoryName)
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 bg-white rounded-lg border p-2"
                    data-testid={`search-result-${e.id}`}
                  >
                    <div
                      className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-base"
                      style={{ backgroundColor: `${decor.color}22`, color: decor.color }}
                    >
                      {decor.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-700 truncate">
                          {e.categoryName}
                        </span>
                        <span className="text-[9px] text-gray-400 shrink-0">
                          {e.date.slice(0, 10)}
                        </span>
                      </div>
                      {e.description && (
                        <div className="text-[10px] text-gray-500 truncate">{e.description}</div>
                      )}
                    </div>
                    <div className="text-sm font-bold text-amber-700 shrink-0">
                      NT$ {Math.round(parseFloat(e.amount)).toLocaleString()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
