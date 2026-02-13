/** 合約概覽統計卡片 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Calendar, Building2 } from "lucide-react";
import type { ContractData, ContractStatistics } from "./types";

interface ContractOverviewCardsProps {
  contract: ContractData;
  statistics: ContractStatistics;
}

/** 顯示合約的四張統計卡片 */
export function ContractOverviewCards({
  contract,
  statistics,
}: ContractOverviewCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">基礎月租金</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {parseInt(contract.baseAmount || "0").toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">租約年數</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{contract.totalYears}年</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">付款項目數</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {statistics.totalPaymentItems}
          </div>
          <p className="text-xs text-muted-foreground">
            已付: {statistics.paidItems} | 待付: {statistics.pendingItems}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">累計金額</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {statistics.totalAmount.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            已付: {statistics.paidAmount.toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
