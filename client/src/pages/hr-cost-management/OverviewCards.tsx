/**
 * 人事費管理 - 概覽統計卡片
 */
import { Card } from "@/components/ui/card";
import { Users, DollarSign, Calculator } from "lucide-react";
import { formatCurrency } from "./types";
import type { MonthTotal } from "./types";

interface OverviewCardsProps {
  /** 在職員工人數 */
  activeCount: number;
  /** 月度費用彙總 */
  monthTotal: MonthTotal;
}

/** 概覽統計卡片區域 */
export function OverviewCards({ activeCount, monthTotal }: OverviewCardsProps) {
  const cards = [
    {
      label: "在職人數",
      value: String(activeCount),
      icon: Users,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
      prefix: "",
    },
    {
      label: "本月薪資",
      value: formatCurrency(monthTotal.salary),
      icon: DollarSign,
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
      prefix: "$",
    },
    {
      label: "雇主負擔",
      value: formatCurrency(monthTotal.employerCost),
      icon: Calculator,
      bgColor: "bg-orange-100",
      iconColor: "text-orange-600",
      prefix: "$",
    },
    {
      label: "公司總成本",
      value: formatCurrency(monthTotal.totalCost),
      icon: DollarSign,
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600",
      prefix: "$",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="p-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center`}
            >
              <card.icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-lg font-bold">
                {card.prefix}{card.value}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
