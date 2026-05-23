/**
 * ExportCsvDropdown — CSV 匯出 dropdown
 *
 * 3 個選項：本月支出 / 本月收入 / 本月全部
 * 直接觸發瀏覽器下載（用 a tag click）
 */
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { Download } from "lucide-react"

interface Props {
  selectedMonth: string // YYYY-MM
}

function download(type: "expenses" | "incomes" | "all", month: string): void {
  const url = `/api/household/export?type=${type}&month=${month}`
  const link = document.createElement("a")
  link.href = url
  link.download = `household-${type}-${month}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function ExportCsvDropdown({ selectedMonth }: Props) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  function handle(type: "expenses" | "incomes" | "all", label: string): void {
    setOpen(false)
    try {
      download(type, selectedMonth)
      toast({
        title: "📤 CSV 已下載",
        description: `${selectedMonth} ${label}`,
      })
    } catch (e) {
      toast({
        title: "匯出失敗",
        description: (e as Error).message,
        variant: "destructive",
      })
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          data-testid="button-export-csv"
        >
          <Download className="w-4 h-4" />
          匯出
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>📤 匯出 {selectedMonth}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handle("expenses", "支出")} data-testid="export-expenses">
          💸 本月支出
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("incomes", "收入")} data-testid="export-incomes">
          💰 本月收入
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("all", "全部")} data-testid="export-all">
          📊 本月全部（含收入支出）
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
