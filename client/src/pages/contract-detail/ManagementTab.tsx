/** 合約管理 Tab 內容 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Upload, DollarSign } from "lucide-react";
import type { ContractData } from "./types";
import { useGeneratePayments, useBatchDocumentUpload } from "./hooks";

interface ManagementTabProps {
  contract: ContractData;
}

/** 合約管理操作區域 */
export function ManagementTab({ contract }: ManagementTabProps) {
  const { generateMutation } = useGeneratePayments(contract.id);
  const { batchUploadMutation } = useBatchDocumentUpload(contract.id);

  /** 開啟檔案選擇器進行批次上傳 */
  const handleBatchUpload = () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
    fileInput.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        batchUploadMutation.mutate(files);
      }
    };
    fileInput.click();
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 生成付款項目 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Play className="h-5 w-5 mr-2" />
              生成付款項目
            </CardTitle>
            <p className="text-sm text-gray-600">
              根據租約條件自動生成月付款項目
            </p>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              {generateMutation.isPending ? "生成中..." : "生成付款項目"}
            </Button>
          </CardContent>
        </Card>

        {/* 合約文件管理 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              合約文件管理
            </CardTitle>
            <p className="text-sm text-gray-600">
              上傳和管理租約相關文件
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button
                className="w-full"
                variant="outline"
                onClick={handleBatchUpload}
                disabled={batchUploadMutation.isPending}
              >
                <Upload className="h-4 w-4 mr-2" />
                {batchUploadMutation.isPending ? "上傳中..." : "上傳文件"}
              </Button>
              <div className="text-xs text-gray-500">
                支援: PDF, DOC, DOCX, JPG, PNG
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 付款資訊設定 */}
        <PaymentInfoCard contract={contract} />
      </div>

      {/* 操作歷史記錄 */}
      <OperationHistory contract={contract} />
    </>
  );
}

/** 付款資訊卡片 */
function PaymentInfoCard({ contract }: { contract: ContractData }) {
  const payeeInfo = contract.payeeName
    ? [
        `收款人：${contract.payeeName}`,
        `收款單位：${contract.payeeUnit || "未設定"}`,
        `銀行代碼：${contract.bankCode || "未設定"}`,
        `帳戶號碼：${contract.accountNumber || "未設定"}`,
        `付款日：每月${contract.contractPaymentDay || "未設定"}日`,
      ].join("\n")
    : "尚未設定付款資訊";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <DollarSign className="h-5 w-5 mr-2" />
          付款資訊設定
        </CardTitle>
        <p className="text-sm text-gray-600">
          設定銀行帳戶和付款相關資訊
        </p>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full"
          variant="outline"
          onClick={() => {
            // TODO: 改為使用 Dialog 元件顯示付款資訊
            alert(`付款資訊：\n\n${payeeInfo}`);
          }}
        >
          <DollarSign className="h-4 w-4 mr-2" />
          查看付款資訊
        </Button>
      </CardContent>
    </Card>
  );
}

/** 操作歷史記錄 */
function OperationHistory({ contract }: { contract: ContractData }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>操作歷史</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
            <span>合約建立</span>
            <span className="text-gray-500">
              {new Date(contract.createdAt).toLocaleDateString("zh-TW")}
            </span>
          </div>
          {contract.updatedAt && (
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span>最後更新</span>
              <span className="text-gray-500">
                {new Date(contract.updatedAt).toLocaleDateString("zh-TW")}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
