/**
 * 付款報表子分頁列 — 付款報表（圖表）/ 付款分析（整合明細）/ 專案統計 整合成一區。
 * 各頁仍是獨立頁面（不刪除）；模式同 overview/revenue/payment-type tabs。
 */
import LinkTabs from "./link-tabs"

const TABS = [
  { href: "/payment/reports", label: "付款報表", aliases: ["/payment-reports"] },
  { href: "/payment-analysis", label: "付款分析" },
  { href: "/payment-project-stats", label: "專案統計" },
]

export default function PaymentReportTabs() {
  return <LinkTabs tabs={TABS} accent="green" />
}
