import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUpIcon, TrendingDownIcon, WalletIcon, DatabaseIcon } from "lucide-react";

export default function StatsCards() {
  const { data: monthlyStats } = useQuery({
    queryKey: ["/api/stats/monthly"],
  });

  const { data: debtStats } = useQuery<any>({
    queryKey: ["/api/stats/debts"],
  });

  const { data: migrationStatus } = useQuery({
    queryKey: ["/api/migration/status"],
  });

  const statsData = [
    {
      title: "本月應付",
      value: `NT$ ${debtStats?.thisMonthDue?.toLocaleString() || "0"}`,
      icon: TrendingDownIcon,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      change: `${debtStats?.thisMonthDue ? "待支付" : "無"}`,
      changeText: "本月到期",
      changeColor: "text-orange-600",
    },
    {
      title: "本月已付",
      value: `NT$ ${debtStats?.thisMonthPaid?.toLocaleString() || "0"}`,
      icon: TrendingUpIcon,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      change: `${debtStats?.thisMonthPaid ? "已完成" : "無"}`,
      changeText: "本月付款",
      changeColor: "text-green-600",
    },
    {
      title: "本月未付",
      value: `NT$ ${debtStats?.thisMonthUnpaid?.toLocaleString() || "0"}`,
      icon: TrendingDownIcon,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      change: `${debtStats?.thisMonthUnpaid ? "需處理" : "已完成"}`,
      changeText: "待付款項",
      changeColor: debtStats?.thisMonthUnpaid ? "text-red-600" : "text-green-600",
    },
    {
      title: "歷史未付",
      value: `NT$ ${debtStats?.priorUnpaid?.toLocaleString() || "0"}`,
      icon: WalletIcon,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      change: `${debtStats?.priorUnpaid ? "待處理" : "已清償"}`,
      changeText: "本月之前",
      changeColor: debtStats?.priorUnpaid ? "text-purple-600" : "text-green-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsData.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="border border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`${stat.iconColor} w-6 h-6`} />
                </div>
              </div>
              <div className="flex items-center mt-4 text-sm">
                <span className={`${stat.changeColor} font-medium`}>{stat.change}</span>
                <span className="text-slate-500 ml-2">{stat.changeText}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
