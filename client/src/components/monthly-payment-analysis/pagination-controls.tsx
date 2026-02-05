import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly totalItems: number;
  readonly itemsPerPage: number;
  readonly onPageChange: (page: number) => void;
  // 自訂樣式（用於逾期區塊的紅色主題）
  readonly variant?: "default" | "danger";
}

// 通用分頁控制元件
export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  variant = "default",
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const isDanger = variant === "danger";
  const bgClass = isDanger ? "bg-red-50" : "bg-gray-50";
  const borderClass = isDanger ? "border-red-200" : "border-gray-200";
  const textClass = isDanger ? "text-red-700" : "text-gray-600";
  const buttonClass = isDanger
    ? "border-red-300 hover:bg-red-50"
    : "";
  const activeButtonClass = isDanger
    ? "bg-red-600 hover:bg-red-700 text-white"
    : "";

  // 計算顯示的頁碼範圍
  const getPageNumbers = (): number[] => {
    const pageCount = Math.min(5, totalPages);
    return Array.from({ length: pageCount }, (_, i) => {
      if (totalPages <= 5) {
        return i + 1;
      } else if (currentPage <= 3) {
        return i + 1;
      } else if (currentPage >= totalPages - 2) {
        return totalPages - 4 + i;
      } else {
        return currentPage - 2 + i;
      }
    });
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={`px-6 py-4 ${bgClass} border-t ${borderClass}`}>
      <div className="flex items-center justify-between">
        <div className={`text-sm ${textClass}`}>
          顯示第 {startItem} - {endItem} 項，共 {totalItems} 項
        </div>
        <div className="flex items-center gap-2">
          {/* 上一頁 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className={`h-8 w-8 p-0 ${buttonClass}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* 頁碼按鈕 */}
          <div className="flex items-center gap-1">
            {getPageNumbers().map((pageNum) => (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className={`h-8 w-8 p-0 ${
                  currentPage === pageNum ? activeButtonClass : buttonClass
                }`}
              >
                {pageNum}
              </Button>
            ))}
          </div>

          {/* 下一頁 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onPageChange(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
            className={`h-8 w-8 p-0 ${buttonClass}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
