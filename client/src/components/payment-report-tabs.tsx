/**
 * 付款報表子分頁列 — 付款報表（圖表）與付款分析（整合明細）在 UI 上整合成一區。
 * 各頁仍是獨立頁面（不刪除）；模式同 overview/revenue/payment-type tabs。
 */
import { Link, useLocation } from "wouter"

const TABS: { href: string; label: string }[] = [
  { href: "/payment/reports", label: "付款報表" },
  { href: "/payment-analysis", label: "付款分析" },
]

export default function PaymentReportTabs() {
  const [loc] = useLocation()
  return (
    <div className="-mx-4 sm:mx-0 mb-2 overflow-x-auto">
      <div className="flex gap-1 px-4 sm:px-0 min-w-max border-b">
        {TABS.map((t) => {
          const active =
            loc === t.href || (t.href === "/payment/reports" && loc === "/payment-reports")
          return (
            <Link key={t.href} href={t.href}>
              <div
                className={`px-3.5 py-2 text-sm whitespace-nowrap cursor-pointer border-b-2 -mb-px transition ${
                  active
                    ? "border-green-600 text-green-700 font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {t.label}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
