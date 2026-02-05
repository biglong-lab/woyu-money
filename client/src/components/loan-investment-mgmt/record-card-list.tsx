import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Receipt } from "lucide-react";
import { getStatusBadge, getRiskBadge, getRecordTypeBadge } from "./badge-helpers";
import type { LoanInvestmentRecord } from "./types";

/**
 * 借貸投資管理 -- 手機版記錄卡片列表
 * 以卡片形式呈現記錄，僅在 md 以下螢幕顯示
 */

interface RecordCardListProps {
  /** 已篩選的記錄列表 */
  records: LoanInvestmentRecord[];
  /** 編輯記錄回呼 */
  onEdit: (record: LoanInvestmentRecord) => void;
  /** 刪除記錄回呼 */
  onDelete: (id: number) => void;
  /** 檢視還款記錄回呼 */
  onViewPayments: (record: LoanInvestmentRecord) => void;
}

export default function RecordCardList({ records, onEdit, onDelete, onViewPayments }: RecordCardListProps) {
  if (records.length === 0) {
    return (
      <div className="md:hidden text-center py-8 text-muted-foreground">
        暫無記錄
      </div>
    );
  }

  return (
    <div className="md:hidden space-y-4">
      {records.map((record) => (
        <Card key={record.id} className="p-4">
          <div className="space-y-3">
            {/* 標題列 */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{record.itemName}</h3>
                <div className="flex gap-2 mt-1">
                  {getRecordTypeBadge(record.recordType)}
                  {getStatusBadge(record.status)}
                  {getRiskBadge(record.riskLevel)}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewPayments(record)}
                >
                  <Receipt className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(record)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(record.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 詳細資訊 */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">當事人：</span>
                <div className="font-medium">{record.partyName}</div>
                {record.partyRelationship && (
                  <div className="text-xs text-muted-foreground">
                    {record.partyRelationship}
                  </div>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">本金：</span>
                <div className="font-medium text-lg">
                  ${parseFloat(record.principalAmount).toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">年利率：</span>
                <div className="font-medium">{record.annualInterestRate}%</div>
              </div>
              <div>
                <span className="text-muted-foreground">開始日期：</span>
                <div className="font-medium">
                  {new Date(record.startDate).toLocaleDateString("zh-TW")}
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
