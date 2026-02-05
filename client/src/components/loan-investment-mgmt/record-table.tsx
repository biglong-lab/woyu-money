import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit2, Trash2, Receipt } from "lucide-react";
import { getStatusBadge, getRiskBadge, getRecordTypeBadge } from "./badge-helpers";
import type { LoanInvestmentRecord } from "./types";

/**
 * 借貸投資管理 -- 桌面版記錄表格
 * 顯示完整的欄位資訊，僅在 md 以上螢幕顯示
 */

interface RecordTableProps {
  /** 已篩選的記錄列表 */
  records: LoanInvestmentRecord[];
  /** 編輯記錄回呼 */
  onEdit: (record: LoanInvestmentRecord) => void;
  /** 刪除記錄回呼 */
  onDelete: (id: number) => void;
  /** 檢視還款記錄回呼 */
  onViewPayments: (record: LoanInvestmentRecord) => void;
}

export default function RecordTable({ records, onEdit, onDelete, onViewPayments }: RecordTableProps) {
  return (
    <div className="hidden md:block rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>項目名稱</TableHead>
            <TableHead>類型</TableHead>
            <TableHead>當事人</TableHead>
            <TableHead>本金</TableHead>
            <TableHead>年利率</TableHead>
            <TableHead>狀態</TableHead>
            <TableHead>風險等級</TableHead>
            <TableHead>開始日期</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                暫無記錄
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">{record.itemName}</TableCell>
                <TableCell>{getRecordTypeBadge(record.recordType)}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{record.partyName}</div>
                    {record.partyRelationship && (
                      <div className="text-sm text-muted-foreground">
                        {record.partyRelationship}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>${parseFloat(record.principalAmount).toLocaleString()}</TableCell>
                <TableCell>{record.annualInterestRate}%</TableCell>
                <TableCell>{getStatusBadge(record.status)}</TableCell>
                <TableCell>{getRiskBadge(record.riskLevel)}</TableCell>
                <TableCell>
                  {new Date(record.startDate).toLocaleDateString("zh-TW")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => onViewPayments(record)}>
                      <Receipt className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onEdit(record)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onDelete(record.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
