/** 價格階段 Tab 內容 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "lucide-react";
import type { PriceTier } from "./types";

interface PricingTabProps {
  priceTiers: PriceTier[] | undefined;
  isLoading: boolean;
}

/** 顯示合約的價格階段設定 */
export function PricingTab({ priceTiers, isLoading }: PricingTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>價格階段設定</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">載入中...</div>
        ) : Array.isArray(priceTiers) && priceTiers.length > 0 ? (
          <PriceTiersTable priceTiers={priceTiers} />
        ) : (
          <EmptyPricingState />
        )}
      </CardContent>
    </Card>
  );
}

/** 價格階段表格 */
function PriceTiersTable({ priceTiers }: { priceTiers: PriceTier[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>年份範圍</TableHead>
          <TableHead>開始年</TableHead>
          <TableHead>結束年</TableHead>
          <TableHead>月租金</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {priceTiers.map((tier, index) => (
          <TableRow key={index}>
            <TableCell>
              第 {tier.yearStart} - {tier.yearEnd} 年
            </TableCell>
            <TableCell>{tier.yearStart}</TableCell>
            <TableCell>{tier.yearEnd}</TableCell>
            <TableCell className="font-medium">
              {parseInt(tier.monthlyAmount).toLocaleString()} 元
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** 無價格階段時的空狀態 */
function EmptyPricingState() {
  return (
    <div className="text-center py-8 text-gray-500">
      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
      <p>未設定價格階段，使用基礎月租金</p>
    </div>
  );
}
