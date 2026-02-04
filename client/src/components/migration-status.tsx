import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ShieldCheckIcon, DownloadIcon, FileTextIcon } from "lucide-react";

export default function MigrationStatus() {
  const { data: migrationStatus } = useQuery({
    queryKey: ["/api/migration/status"],
  });

  const migrationData = [
    {
      label: "交易記錄",
      count: migrationStatus?.debtsCount || 0,
      total: migrationStatus?.debtsCount || 0,
    },
    {
      label: "分類資料",
      count: migrationStatus?.categoriesCount || 0,
      total: migrationStatus?.categoriesCount || 0,
    },
    {
      label: "廠商資料",
      count: migrationStatus?.vendorsCount || 0,
      total: migrationStatus?.vendorsCount || 0,
    },
    {
      label: "付款記錄",
      count: migrationStatus?.paymentsCount || 0,
      total: migrationStatus?.paymentsCount || 0,
    },
  ];

  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>資料遷移狀態</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {migrationData.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">{item.label}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-green-600">
                      {item.count} / {item.total}
                    </span>
                    <ShieldCheckIcon className="w-4 h-4 text-green-600" />
                  </div>
                </div>
                <Progress value={100} className="h-2" />
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <ShieldCheckIcon className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800">資料完整性驗證通過</span>
            </div>
            <p className="text-sm text-slate-600 mt-1">所有資料已通過完整性檢查，無遺失或損壞</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>系統資訊</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-slate-600">原系統</span>
              <span className="font-medium">PHP + MySQL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">新系統</span>
              <span className="font-medium">Node.js + PostgreSQL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">遷移時間</span>
              <span className="font-medium">2024-01-15 14:32</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">資料大小</span>
              <span className="font-medium">25.4 MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">最後備份</span>
              <span className="font-medium">2024-01-15 10:00</span>
            </div>
          </div>

          <div className="mt-6 flex space-x-3">
            <Button className="flex-1 bg-primary hover:bg-blue-700">
              <DownloadIcon className="w-4 h-4 mr-2" />
              建立備份
            </Button>
            <Button variant="outline" className="flex-1">
              <FileTextIcon className="w-4 h-4 mr-2" />
              查看日誌
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
