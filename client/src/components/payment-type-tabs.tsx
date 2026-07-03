/**
 * 付款項目管理子分頁列 — 月付 / 分期 / 一般 三種付款方式在 UI 上整合成一區。
 * 各頁仍是獨立頁面（不刪除），此元件提供一致的 tab 切換；自動依當前路徑高亮。
 * 模式同 overview-tabs / revenue-tabs。
 */
import { Link, useLocation } from "wouter"

const TABS: { href: string; label: string }[] = [
  { href: "/monthly-payment-management", label: "月付" },
  { href: "/installment-payment-management", label: "分期" },
  { href: "/general-payment-management", label: "一般付款" },
]

export default function PaymentTypeTabs() {
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
