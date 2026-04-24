/**
 * 財務助理快速入口卡（首頁置頂）
 * 把 5 大決策工具直接擺在首頁，使用者一進來就能用
 */

import { Link } from "wouter"
import { Wallet, AlertTriangle, Calendar, TrendingUp, Receipt } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface QuickItem {
  title: string
  href: string
  icon: LucideIcon
  description: string
  bgColor: string
  iconColor: string
}

const QUICK_ITEMS: QuickItem[] = [
  {
    title: "現金分配",
    href: "/cash-allocation",
    icon: Wallet,
    description: "錢只有這麼多 → 該付哪幾筆",
    bgColor: "bg-amber-50 hover:bg-amber-100",
    iconColor: "text-amber-700",
  },
  {
    title: "勞健保監控",
    href: "/labor-insurance-watch",
    icon: AlertTriangle,
    description: "三層提醒 + 年度損失",
    bgColor: "bg-red-50 hover:bg-red-100",
    iconColor: "text-red-700",
  },
  {
    title: "租金矩陣",
    href: "/rental-matrix",
    icon: Calendar,
    description: "12 月 × 合約一目了然",
    bgColor: "bg-blue-50 hover:bg-blue-100",
    iconColor: "text-blue-700",
  },
  {
    title: "現金流預估",
    href: "/cashflow-decision-center",
    icon: TrendingUp,
    description: "未來 6 月 + 缺口警示",
    bgColor: "bg-green-50 hover:bg-green-100",
    iconColor: "text-green-700",
  },
  {
    title: "收據對應",
    href: "/receipt-match-helper",
    icon: Receipt,
    description: "拍收據自動匹配",
    bgColor: "bg-purple-50 hover:bg-purple-100",
    iconColor: "text-purple-700",
  },
]

export function FinancialAssistantQuickCard() {
  return (
    <Card className="border-amber-200">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900 flex items-center gap-1.5">
            💡 財務助理
          </h2>
          <span className="text-xs text-gray-500">點進去解決最痛的問題</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          {QUICK_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`rounded-lg p-3 cursor-pointer transition-all active:scale-95 ${item.bgColor}`}
                  data-testid={`quick-${item.href.slice(1)}`}
                >
                  <div className={`flex items-center justify-center mb-1.5 ${item.iconColor}`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="text-center text-xs sm:text-sm font-medium text-gray-900">
                    {item.title}
                  </div>
                  <div className="text-center text-[10px] sm:text-xs text-gray-600 mt-1 line-clamp-2 leading-tight">
                    {item.description}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
