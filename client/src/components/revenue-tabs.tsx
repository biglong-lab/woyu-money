/**
 * 收入分析子分頁列 — 把分散的收入面頁面（分析/比對/預測）在 UI 上整合成一區。
 * 各頁仍是獨立頁面（不刪除），此元件提供一致的 tab 切換；自動依當前路徑高亮。
 * 模式同 overview-tabs（財務總覽中心）。
 */
import { Link, useLocation } from "wouter"

const TABS: { href: string; label: string }[] = [
  { href: "/revenue/reports", label: "收入分析" },
  { href: "/revenue/compare", label: "PMS vs PM 比對" },
  { href: "/revenue-forecast", label: "收入預測" },
]

export default function RevenueTabs() {
  const [loc] = useLocation()
  return (
    <div className="-mx-4 sm:mx-0 mb-2 overflow-x-auto">
      <div className="flex gap-1 px-4 sm:px-0 min-w-max border-b">
        {TABS.map((t) => {
          const active = loc === t.href
          return (
            <Link key={t.href} href={t.href}>
              <div
                className={`px-3.5 py-2 text-sm whitespace-nowrap cursor-pointer border-b-2 -mb-px transition ${
                  active
                    ? "border-emerald-600 text-emerald-700 font-semibold"
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
