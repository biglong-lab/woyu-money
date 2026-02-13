import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2, Edit, Trash2, Eye, Settings, RefreshCw } from "lucide-react";
import type { PaymentProject, RentalPriceTier } from "@shared/schema";

/** 租約列表項目（對應 API GET /api/rental/contracts 回傳） */
interface RentalContractListItem {
  id: number;
  projectId: number;
  contractName: string;
  startDate: string;
  endDate: string;
  totalYears: number;
  baseAmount: string;
  isActive: boolean | null;
  notes: string | null;
  projectName: string | null;
  createdAt: Date | null;
  currentMonthlyAmount?: number;
  currentTier?: RentalPriceTier;
}

interface RentalContractListProps {
  readonly contracts: RentalContractListItem[];
  readonly projects: PaymentProject[];
  readonly onViewDetails: (contract: RentalContractListItem) => void;
  readonly onEdit: (contract: RentalContractListItem) => void;
  readonly onDelete: (contractId: number) => void;
  readonly onSmartAdjust: (contract: RentalContractListItem) => void;
  readonly onGeneratePayments: (contractId: number) => void;
  readonly isGenerating: boolean;
}

// 租約列表元件 - 租約管理 Tab 內容
export function RentalContractList({
  contracts,
  projects,
  onViewDetails,
  onEdit,
  onDelete,
  onSmartAdjust,
  onGeneratePayments,
  isGenerating,
}: RentalContractListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>租約列表</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {contracts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">無租約資料</p>
              <p>請新增第一個租約合約</p>
            </div>
          ) : (
            contracts.map((contract) => {
              const project = projects.find((p) => p.id === contract.projectId);
              const progress = contract.totalYears > 0 ?
                ((new Date().getFullYear() - new Date(contract.startDate).getFullYear()) / contract.totalYears) * 100 : 0;

              return (
                <div key={contract.id} className="border rounded-lg p-3 md:p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <h3 className="font-medium text-base md:text-lg truncate">{contract.contractName}</h3>
                        <Badge variant={contract.isActive ? "default" : "secondary"} className="self-start">
                          {contract.isActive ? "進行中" : "已結束"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 text-xs md:text-sm text-gray-600 mb-3">
                        <div className="break-words">
                          <span className="font-medium">專案：</span>
                          <span className="text-gray-900">{project?.projectName || "無"}</span>
                        </div>
                        <div className="break-words sm:col-span-2 lg:col-span-1">
                          <span className="font-medium">期間：</span>
                          <span className="text-gray-900">
                            {new Date(contract.startDate).toLocaleDateString('zh-TW')} - {new Date(contract.endDate).toLocaleDateString('zh-TW')}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">總年數：</span>
                          <span className="text-gray-900">{contract.totalYears}年</span>
                        </div>
                      </div>

                      {/* 進度條 */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs md:text-sm mb-1">
                          <span className="text-gray-600">合約進度</span>
                          <span className="font-medium text-gray-900">{Math.min(Math.round(progress), 100)}%</span>
                        </div>
                        <Progress value={Math.min(progress, 100)} className="h-2" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 text-xs md:text-sm text-gray-600">
                        <div>
                          <span className="font-medium">基礎金額：</span>
                          NT${parseFloat(contract.baseAmount).toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">當前階段：</span>
                          {contract.currentTier ? `第${contract.currentTier.yearStart}-${contract.currentTier.yearEnd}年` : "未設定"}
                        </div>
                      </div>

                      {contract.notes && (
                        <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded mt-2">
                          <strong>備註：</strong>{contract.notes}
                        </div>
                      )}
                    </div>

                    {/* 當月租金顯示 */}
                    <div className="flex flex-col sm:items-end sm:text-right mt-3 sm:mt-0 sm:ml-4">
                      <div className="text-lg md:text-2xl font-bold text-blue-600 mb-1">
                        NT${
                          contract.currentMonthlyAmount?.toLocaleString() || 
                          parseFloat(contract.baseAmount).toLocaleString()
                        }
                      </div>
                      <div className="text-xs md:text-sm text-gray-500 mb-2">當月租金</div>
                    </div>
                  </div>

                  {/* 操作按鈕區 */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewDetails(contract)}
                      className="flex items-center gap-1 text-xs"
                    >
                      <Eye className="w-3 h-3" />
                      <span className="hidden sm:inline">查看</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSmartAdjust(contract)}
                      className="flex items-center gap-1 text-xs"
                    >
                      <Settings className="w-3 h-3" />
                      <span className="hidden sm:inline">調整</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(contract)}
                      className="flex items-center gap-1 text-xs"
                    >
                      <Edit className="w-3 h-3" />
                      <span className="hidden sm:inline">編輯</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGeneratePayments(contract.id)}
                      disabled={isGenerating}
                      className="flex items-center gap-1 text-xs"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span className="hidden sm:inline">生成</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(contract.id)}
                      className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 ml-auto"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span className="hidden sm:inline">刪除</span>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
