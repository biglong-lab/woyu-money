import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DollarSign, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Edit, 
  Trash2, 
  MoreVertical,
  Building2,
  Tag,
  TrendingUp
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PaymentItem {
  id: number;
  itemName: string;
  totalAmount: string;
  paidAmount: string;
  status: string;
  paymentType: string;
  startDate: string;
  endDate?: string;
  priority: number;
  categoryName?: string;
  projectName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ResponsivePaymentCardProps {
  item: PaymentItem;
  onEdit: (item: PaymentItem) => void;
  onDelete: (id: number) => void;
  onView: (item: PaymentItem) => void;
  onToggleStatus?: (id: number, newStatus: string) => void;
  viewMode: 'grid' | 'list' | 'compact';
  showDeleted?: boolean;
}

export function ResponsivePaymentCard({ 
  item, 
  onEdit, 
  onDelete, 
  onView, 
  onToggleStatus,
  viewMode = 'grid',
  showDeleted = false 
}: ResponsivePaymentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const totalAmount = parseFloat(item.totalAmount || "0");
  const paidAmount = parseFloat(item.paidAmount || "0");
  const remainingAmount = totalAmount - paidAmount;
  const progressPercentage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
  
  const isDeleted = (item as any).isDeleted;
  const isOverdue = item.status === 'overdue';
  const isCompleted = item.status === 'completed';
  const isPending = item.status === 'pending';

  // 狀態顏色和圖標
  const getStatusConfig = () => {
    if (isDeleted) return { 
      color: 'bg-gray-100 text-gray-600 border-gray-200', 
      icon: Trash2, 
      label: '已刪除' 
    };
    if (isCompleted) return { 
      color: 'bg-green-100 text-green-700 border-green-200', 
      icon: CheckCircle2, 
      label: '已完成' 
    };
    if (isOverdue) return { 
      color: 'bg-red-100 text-red-700 border-red-200', 
      icon: AlertCircle, 
      label: '逾期' 
    };
    if (isPending) return { 
      color: 'bg-yellow-100 text-yellow-700 border-yellow-200', 
      icon: Clock, 
      label: '待處理' 
    };
    return { 
      color: 'bg-blue-100 text-blue-700 border-blue-200', 
      icon: TrendingUp, 
      label: '進行中' 
    };
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  // 優先級顏色
  const getPriorityColor = () => {
    if (item.priority >= 5) return 'bg-red-500';
    if (item.priority >= 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // 格式化金額
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // 緊湊模式
  if (viewMode === 'compact') {
    return (
      <Card className={`transition-all duration-200 hover:shadow-md ${isDeleted ? 'opacity-60' : ''}`}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className={statusConfig.color}>
                  <StatusIcon className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              
              <div className="min-w-0 flex-1">
                <h4 className="font-medium truncate text-sm">{item.itemName}</h4>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <span>{formatAmount(totalAmount)}</span>
                  {progressPercentage > 0 && (
                    <span className="text-green-600">
                      {progressPercentage.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(item)}
                className="h-8 w-8 p-0"
              >
                <Eye className="h-3 w-3" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(item)}>
                    <Edit className="h-4 w-4 mr-2" />
                    編輯
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => onDelete(item.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    刪除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 列表模式
  if (viewMode === 'list') {
    return (
      <Card className={`transition-all duration-200 hover:shadow-md ${isDeleted ? 'opacity-60' : ''}`}>
        <Collapsible>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 min-w-0 flex-1">
                  <div className={`w-2 h-12 rounded-full ${getPriorityColor()}`} />
                  
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={statusConfig.color}>
                      <StatusIcon className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold truncate">{item.itemName}</h3>
                      <Badge variant="outline" className="text-xs">
                        {statusConfig.label}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <DollarSign className="h-3 w-3" />
                        <span>{formatAmount(totalAmount)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(item.startDate)}</span>
                      </div>
                      {item.projectName && (
                        <div className="flex items-center space-x-1">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate max-w-24">{item.projectName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {progressPercentage > 0 && (
                    <div className="text-right min-w-16">
                      <div className="text-sm font-medium">
                        {progressPercentage.toFixed(0)}%
                      </div>
                      <Progress value={progressPercentage} className="w-16 h-1" />
                    </div>
                  )}
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(item)}>
                        <Eye className="h-4 w-4 mr-2" />
                        查看詳情
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(item)}>
                        <Edit className="h-4 w-4 mr-2" />
                        編輯
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => onDelete(item.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        刪除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">已付金額：</span>
                  <span className="font-medium text-green-600">
                    {formatAmount(paidAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">剩餘金額：</span>
                  <span className="font-medium text-red-600">
                    {formatAmount(remainingAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">分類：</span>
                  <span className="font-medium">{item.categoryName || '未分類'}</span>
                </div>
              </div>
              
              {item.notes && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <span className="text-xs text-muted-foreground">備註：</span>
                  <p className="text-sm mt-1">{item.notes}</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  // 網格模式（預設）
  return (
    <Card className={`transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${isDeleted ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className={statusConfig.color}>
                <StatusIcon className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg leading-tight">{item.itemName}</CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {statusConfig.label}
                </Badge>
                <div className={`w-2 h-2 rounded-full ${getPriorityColor()}`} />
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(item)}>
                <Eye className="h-4 w-4 mr-2" />
                查看詳情
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Edit className="h-4 w-4 mr-2" />
                編輯
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(item.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                刪除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 金額資訊 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">總金額</span>
            <span className="font-bold text-lg">{formatAmount(totalAmount)}</span>
          </div>
          
          {paidAmount > 0 && (
            <>
              <Progress value={progressPercentage} className="h-2" />
              <div className="flex justify-between text-xs">
                <span className="text-green-600">
                  已付: {formatAmount(paidAmount)} ({progressPercentage.toFixed(0)}%)
                </span>
                <span className="text-red-600">
                  剩餘: {formatAmount(remainingAmount)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* 詳細資訊 */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>開始日期</span>
            </div>
            <span>{formatDate(item.startDate)}</span>
          </div>
          
          {item.projectName && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1 text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span>專案</span>
              </div>
              <span className="truncate max-w-32">{item.projectName}</span>
            </div>
          )}
          
          {item.categoryName && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1 text-muted-foreground">
                <Tag className="h-3 w-3" />
                <span>分類</span>
              </div>
              <span className="truncate max-w-32">{item.categoryName}</span>
            </div>
          )}
        </div>

        {/* 備註 */}
        {item.notes && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">備註</p>
            <p className="text-sm">{item.notes}</p>
          </div>
        )}

        {/* 操作按鈕 */}
        <div className="flex space-x-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(item)}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-1" />
            查看
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(item)}
            className="flex-1"
          >
            <Edit className="h-4 w-4 mr-1" />
            編輯
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}