/**
 * 家庭記帳家長主頁 — 全家儀表板四格（累計給予/存錢罐/待審核/未完成）
 *
 * 2026-07 巨檔拆分：從 pages/family.tsx 原樣搬出、邏輯完全不變。
 */
import { Card, CardContent } from "@/components/ui/card"
import { FamilyDashboard, formatMoney } from "@/components/family/family-shared"

interface DashboardStatsProps {
  dashboard: FamilyDashboard
}

/** 全家儀表板統計四格 */
export function DashboardStats({ dashboard }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Card>
        <CardContent className="py-3 px-3">
          <div className="text-xs text-gray-500">累計給予</div>
          <div className="text-lg sm:text-xl font-bold text-indigo-700">
            {formatMoney(dashboard.totalReceived)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 px-3">
          <div className="text-xs text-gray-500">存錢罐合計</div>
          <div className="text-lg sm:text-xl font-bold text-green-700">
            {formatMoney(dashboard.totalSaved)}
          </div>
        </CardContent>
      </Card>
      <Card className={dashboard.toApproveCount > 0 ? "border-amber-300 bg-amber-50" : ""}>
        <CardContent className="py-3 px-3">
          <div className="text-xs text-gray-500">待審核</div>
          <div
            className={`text-lg sm:text-xl font-bold ${
              dashboard.toApproveCount > 0 ? "text-amber-700" : "text-gray-400"
            }`}
          >
            {dashboard.toApproveCount}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 px-3">
          <div className="text-xs text-gray-500">未完成任務</div>
          <div className="text-lg sm:text-xl font-bold text-blue-700">
            {dashboard.pendingTaskCount}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
