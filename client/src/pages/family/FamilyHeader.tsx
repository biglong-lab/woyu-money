/**
 * 家庭記帳家長主頁 — 標題列 + 動作按鈕（一鍵派/自訂/新增小孩/安裝 chip）
 *
 * 2026-07 巨檔拆分：從 pages/family.tsx 原樣搬出、邏輯完全不變。
 */
import { Button } from "@/components/ui/button"
import { Users, Plus, Zap } from "lucide-react"
import { FamilyInstallChip } from "@/components/family/cards-01-comment-dialog"

interface FamilyHeaderProps {
  /** 小孩數量（0 時停用派任務按鈕）*/
  kidsCount: number
  onBatchTask: () => void
  onAddTask: () => void
  onAddKid: () => void
}

/** 頁面標題 + 主要動作按鈕 */
export function FamilyHeader({ kidsCount, onBatchTask, onAddTask, onAddKid }: FamilyHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-indigo-600" />
          家庭記帳
        </h1>
        <p className="text-sm text-gray-500 mt-1">派任務、入帳、三罐分配、養成小朋友財務習慣</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={onBatchTask}
          className="bg-indigo-600 hover:bg-indigo-700"
          disabled={kidsCount === 0}
        >
          <Zap className="h-4 w-4 mr-1" />
          一鍵派
        </Button>
        <Button
          size="sm"
          onClick={onAddTask}
          className="bg-amber-600 hover:bg-amber-700"
          disabled={kidsCount === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          自訂
        </Button>
        <Button size="sm" variant="outline" onClick={onAddKid}>
          <Plus className="h-4 w-4 mr-1" />
          新增小孩
        </Button>
        <FamilyInstallChip />
      </div>
    </div>
  )
}
