/**
 * 統一付款管理 - 付款概況卡片
 */
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  DollarSign,
} from "lucide-react";
import type { PaymentStats } from "./types";

interface SummaryCardsProps {
  /** 付款統計資料 */
  stats: PaymentStats;
}

/** 概況卡片設定 */
const CARD_CONFIG = [
  {
    key: "overdue" as const,
    label: "逾期未付",
    field: "overdueAmount" as const,
    icon: AlertCircle,
    borderColor: "border-red-100",
    bgColor: "bg-red-50/30",
    iconColor: "text-red-600",
    textColor: "text-red-700",
  },
  {
    key: "current" as const,
    label: "本月到期",
    field: "currentMonthAmount" as const,
    icon: Calendar,
    borderColor: "border-orange-100",
    bgColor: "bg-orange-50/30",
    iconColor: "text-orange-600",
    textColor: "text-orange-700",
  },
  {
    key: "future" as const,
    label: "未來到期",
    field: "futureAmount" as const,
    icon: CheckCircle,
    borderColor: "border-blue-100",
    bgColor: "bg-blue-50/30",
    iconColor: "text-blue-600",
    textColor: "text-blue-700",
  },
  {
    key: "total" as const,
    label: "總金額",
    field: "totalAmount" as const,
    icon: DollarSign,
    borderColor: "border-green-100",
    bgColor: "bg-green-50/30",
    iconColor: "text-green-600",
    textColor: "text-green-700",
  },
];

/** 付款概況四張卡片 */
export function SummaryCards({ stats }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {CARD_CONFIG.map((card) => (
        <Card
          key={card.key}
          className={`border ${card.borderColor} shadow-sm ${card.bgColor}`}
        >
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                <p className="text-sm font-medium text-gray-700 tracking-wide">
                  {card.label}
                </p>
              </div>
              <p
                className={`text-2xl font-bold ${card.textColor} leading-none`}
              >
                NT$ {stats[card.field].toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
