/**
 * 統一付款管理 - 最近付款記錄
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  Target,
  Calendar,
  Receipt,
  Clock,
  Image,
} from "lucide-react";
import { Link } from "wouter";
import { getPaymentMethodText } from "./types";
import type {
  PaymentRecord,
  PaymentItem,
  PaymentProject,
  DebtCategory,
} from "./types";

/** 最多顯示的記錄數量 */
const MAX_VISIBLE_RECORDS = 5;

interface RecentPaymentRecordsProps {
  /** 所有付款記錄 */
  paymentRecords: PaymentRecord[];
  /** 所有付款項目 */
  items: PaymentItem[];
  /** 所有專案 */
  projects: PaymentProject[];
  /** 所有分類 */
  categories: DebtCategory[];
}

/** 收據圖片對話框 */
function ReceiptImageDialog({ imageUrl }: { imageUrl: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Badge
          variant="outline"
          className="text-xs cursor-pointer hover:bg-gray-100"
        >
          <Image className="w-3 h-3 mr-1" />
          收據
        </Badge>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>付款收據圖片</DialogTitle>
          <DialogDescription>查看付款收據的詳細圖片</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          <img
            src={`/uploads/${imageUrl}`}
            alt="付款收據"
            className="max-w-full max-h-96 object-contain rounded-lg border"
            onError={(e) => {
              e.currentTarget.src =
                "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWcluePh+eEoeazleaoquWFpTwvdGV4dD48L3N2Zz4=";
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 單筆付款記錄卡片 */
function RecordCard({
  record,
  item,
  project,
  category,
}: {
  record: PaymentRecord;
  item: PaymentItem | undefined;
  project: PaymentProject | undefined;
  category: DebtCategory | undefined;
}) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium">{item?.itemName || "未知項目"}</h4>
          <Badge variant="secondary" className="text-xs">
            {getPaymentMethodText(record.paymentMethod || "")}
          </Badge>
          {record.receiptImageUrl && (
            <ReceiptImageDialog imageUrl={record.receiptImageUrl} />
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          {project && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {project.projectName}
            </span>
          )}
          {category && (
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              {category.categoryName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(record.paymentDate).toLocaleDateString()}
          </span>
        </div>
        {record.notes && (
          <p className="text-sm text-gray-500 mt-1">{record.notes}</p>
        )}
      </div>

      <div className="text-right">
        <p className="font-bold text-green-600">
          +${parseInt(record.amountPaid).toLocaleString()}
        </p>
        <p className="text-xs text-gray-500">
          {new Date(record.createdAt || "").toLocaleString()}
        </p>
        {record.receiptImageUrl && (
          <Badge variant="outline" className="text-xs mt-1">
            有收據
          </Badge>
        )}
      </div>
    </div>
  );
}

/** 最近付款記錄區域 */
export function RecentPaymentRecords({
  paymentRecords,
  items,
  projects,
  categories,
}: RecentPaymentRecordsProps) {
  const sortedRecords = [...paymentRecords]
    .sort(
      (a, b) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    )
    .slice(0, MAX_VISIBLE_RECORDS);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          最近付款記錄
        </CardTitle>
        <CardDescription>顯示最近的付款記錄，查看付款歷史</CardDescription>
      </CardHeader>
      <CardContent>
        {paymentRecords.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>尚無付款記錄</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedRecords.map((record) => {
              const item = items.find((i) => i.id === record.itemId);
              const project = projects.find((p) => p.id === item?.projectId);
              const category = categories.find(
                (c) => c.id === item?.categoryId
              );

              return (
                <RecordCard
                  key={record.id}
                  record={record}
                  item={item}
                  project={project}
                  category={category}
                />
              );
            })}

            {paymentRecords.length > MAX_VISIBLE_RECORDS && (
              <div className="text-center pt-4">
                <Link href="/payment-records">
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 mx-auto"
                  >
                    <Clock className="w-4 h-4" />
                    查看所有付款記錄 ({paymentRecords.length} 筆)
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
