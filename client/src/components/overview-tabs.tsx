/**
 * 財務總覽子分頁列 — 把分散的總覽/儀表板頁面在 UI 上整合成一個「總覽中心」。
 * 各頁仍是獨立頁面(不刪除), 此元件提供一致的 tab 切換, 讓使用者感覺像同一區。
 * 自動依當前路徑高亮, 不需各頁傳參數。
 */
import { Link, useLocation } from "wouter"

// 駕駛艙為主入口排首位；後三個 tab 已從主導航移除（2026-07-03 導航收斂）、僅由此 tab 列互達
const TABS: { href: string; label: string }[] = [
  { href: "/financial-cockpit", label: "財務駕駛艙" },
  { href: "/payables-dashboard", label: "應付看板" },
  { href: "/cost-overview", label: "成本結構" },
  { href: "/financial-dashboard", label: "綜合儀表板" },
  { href: "/financial-overview-v2", label: "財務總覽" },
  { href: "/cashflow-decision-center", label: "現金流" },
]

export default function OverviewTabs() {
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
                    ? "border-blue-600 text-blue-700 font-semibold"
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
