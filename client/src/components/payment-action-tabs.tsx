/**
 * 付款行動子分頁列 — 「現在該付什麼」三頁互達：
 * 帳單到期看板（該付清單）/ 現金分配助理（先付哪幾筆）/ 強制執行管理（強執分流）
 */
import LinkTabs from "./link-tabs"

const TABS = [
  { href: "/bills", label: "帳單到期看板" },
  { href: "/cash-allocation", label: "現金分配助理" },
  { href: "/enforcement", label: "強制執行管理" },
]

export default function PaymentActionTabs() {
  return <LinkTabs tabs={TABS} accent="orange" />
}
