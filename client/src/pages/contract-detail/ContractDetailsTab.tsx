/** 合約詳情 Tab 內容 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { ContractData } from "./types";

interface ContractDetailsTabProps {
  contract: ContractData;
}

/** 合約基本資訊與付款資訊 */
export function ContractDetailsTab({ contract }: ContractDetailsTabProps) {
  const hasPaymentInfo = !!(contract.payeeName || contract.bankCode);

  return (
    <Card>
      <CardHeader>
        <CardTitle>合約基本資訊</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoField label="合約名稱" value={contract.contractName} />
          <InfoField label="關聯專案" value={contract.projectName} />
          <InfoField
            label="開始日期"
            value={new Date(contract.startDate).toLocaleDateString("zh-TW")}
          />
          <InfoField
            label="結束日期"
            value={new Date(contract.endDate).toLocaleDateString("zh-TW")}
          />
          <InfoField
            label="基礎月租金"
            value={`${parseInt(contract.baseAmount || "0").toLocaleString()} 元`}
          />
          <InfoField label="租約年數" value={`${contract.totalYears} 年`} />
        </div>

        {/* 付款資訊區塊 */}
        {hasPaymentInfo && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium mb-3">付款資訊</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contract.payeeName && (
                <InfoField label="收款人" value={contract.payeeName} />
              )}
              {contract.payeeUnit && (
                <InfoField label="收款單位" value={contract.payeeUnit} />
              )}
              {contract.bankCode && (
                <InfoField label="銀行代碼" value={contract.bankCode} />
              )}
              {contract.accountNumber && (
                <InfoField label="銀行帳號" value={contract.accountNumber} />
              )}
              {contract.contractPaymentDay && (
                <InfoField
                  label="每月付款日"
                  value={`${contract.contractPaymentDay} 號`}
                />
              )}
            </div>
          </div>
        )}

        {/* 備註區塊 */}
        {contract.notes && (
          <div className="border-t pt-4">
            <Label className="text-sm font-medium text-gray-600">備註</Label>
            <p className="text-lg mt-1">{contract.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** 資訊欄位元件，避免重複 Label + value 結構 */
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-sm font-medium text-gray-600">{label}</Label>
      <p className="text-lg">{value}</p>
    </div>
  );
}
