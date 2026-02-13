// 專案付款管理 - Mutations 與事件處理 Hook
// 負責：表單、mutations、圖片上傳、批量操作、事件處理

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  type PaymentItem,
  type PaymentFormValues,
  type EditItemFormValues,
  paymentSchema,
  editItemSchema,
} from "@/components/payment-project-types";

/** 批量狀態更新回應型別 */
interface BatchStatusResponse {
  ok?: boolean;
  success?: boolean;
}

/** 圖片上傳回應型別 */
interface UploadResponse {
  url: string;
}

/** PaymentItem 擴充型別（包含資料庫中的 notes 欄位） */
interface PaymentItemWithNotes extends PaymentItem {
  notes?: string | null;
}

/** 使所有付款相關查詢失效 */
function invalidatePaymentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
  queryClient.invalidateQueries({ queryKey: ["/api/payment/items?limit=500&itemType=general"] });
  queryClient.invalidateQueries({ queryKey: ["/api/payment/project"] });
}

interface UsePaymentProjectMutationsParams {
  /** 付款項目列表（用於快速付款跳轉） */
  paymentItems: PaymentItem[];
}

export function usePaymentProjectMutations(params: UsePaymentProjectMutationsParams) {
  const { paymentItems } = params;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  // 對話框狀態
  const [selectedItem, setSelectedItem] = useState<PaymentItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentItem | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentItem, setPaymentItem] = useState<PaymentItem | null>(null);
  const [isProjectCategoryDialogOpen, setIsProjectCategoryDialogOpen] = useState(false);

  // 刪除相關狀態
  const [deleteItem, setDeleteItem] = useState<PaymentItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // 圖片上傳狀態
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // 批量操作狀態
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);

  // === 表單 ===

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: "",
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: "bank_transfer",
      note: "",
      receiptImage: null,
    },
  });

  const editForm = useForm<EditItemFormValues>({
    resolver: zodResolver(editItemSchema),
    defaultValues: {
      itemName: "",
      totalAmount: "",
      startDate: "",
      endDate: "",
      priority: "2",
      notes: "",
      paymentType: "single",
    },
  });

  // === 批量操作 ===

  const toggleItemSelection = useCallback((itemId: number) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback((items: PaymentItem[]) => {
    if (isAllSelected) {
      setSelectedItems(new Set());
      setIsAllSelected(false);
    } else {
      const allItemIds = items.map((item: PaymentItem) => item.id);
      setSelectedItems(new Set(allItemIds));
      setIsAllSelected(true);
    }
  }, [isAllSelected]);

  const handleBatchStatusUpdate = useCallback(async (status: string) => {
    if (selectedItems.size === 0) {
      toast({
        title: "請選擇項目",
        description: "請先選擇要更新的付款項目",
        variant: "destructive",
      });
      return;
    }

    try {
      const itemIds = Array.from(selectedItems);
      const response = await apiRequest("PATCH", "/api/payment/items/batch-status", {
        itemIds,
        status,
        userInfo: "批量更新"
      }) as BatchStatusResponse;

      if (response.ok !== false) {
        invalidatePaymentQueries(queryClient);
        setSelectedItems(new Set());
        setIsAllSelected(false);

        toast({
          title: "批量更新成功",
          description: `已更新 ${itemIds.length} 個項目的狀態為 ${status}`,
        });
      }
    } catch {
      toast({
        title: "批量更新失敗",
        description: "請稍後再試",
        variant: "destructive",
      });
    }
  }, [selectedItems, queryClient, toast]);

  // === Mutations ===

  const paymentMutation = useMutation({
    mutationFn: async (data: PaymentFormValues) => {
      if (!paymentItem) throw new Error("沒有選擇付款項目");
      return apiRequest("POST", `/api/payment/items/${paymentItem.id}/payments`, data);
    },
    onSuccess: () => {
      toast({ title: "付款記錄已新增" });
      invalidatePaymentQueries(queryClient);
      setIsPaymentDialogOpen(false);
      setPaymentItem(null);
      paymentForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "付款失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editItemMutation = useMutation({
    mutationFn: async (data: EditItemFormValues) => {
      if (!editingItem) throw new Error("沒有選擇編輯項目");
      return apiRequest("PATCH", `/api/payment/items/${editingItem.id}`, {
        ...data,
        priority: parseInt(data.priority),
        totalAmount: parseFloat(data.totalAmount),
        userInfo: "項目修改"
      });
    },
    onSuccess: () => {
      toast({ title: "項目修改成功" });
      invalidatePaymentQueries(queryClient);
      setIsEditDialogOpen(false);
      setEditingItem(null);
      editForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "修改失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return apiRequest("DELETE", `/api/payment/items/${itemId}`, {
        userInfo: "專案付款管理-軟刪除"
      });
    },
    onSuccess: () => {
      toast({
        title: "刪除成功",
        description: "付款項目已移至回收站",
      });
      invalidatePaymentQueries(queryClient);
      setDeleteItem(null);
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "刪除失敗",
        description: error.message || "刪除付款項目時發生錯誤",
        variant: "destructive",
      });
    },
  });

  // === 事件處理器 ===

  const handlePayment = async (data: PaymentFormValues) => {
    try {
      let receiptImageUrl = null;

      if (selectedImage) {
        const formData = new FormData();
        formData.append('file', selectedImage);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json() as UploadResponse;
          receiptImageUrl = uploadResult.url;
        } else {
          throw new Error('圖片上傳失敗');
        }
      }

      paymentMutation.mutate({
        ...data,
        receiptImage: receiptImageUrl,
      });

      setSelectedImage(null);
      setImagePreview(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "未知錯誤";
      toast({
        title: "付款失敗",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleEditItem = (data: EditItemFormValues) => {
    editItemMutation.mutate(data);
  };

  const handleDeleteClick = (item: PaymentItem) => {
    setDeleteItem(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deleteItem) return;
    deleteMutation.mutate(deleteItem.id);
  };

  const openEditDialog = (item: PaymentItem) => {
    setEditingItem(item);
    const itemWithNotes = item as PaymentItemWithNotes;
    editForm.reset({
      itemName: item.itemName,
      totalAmount: item.totalAmount,
      startDate: item.startDate,
      endDate: item.endDate || "",
      priority: item.priority?.toString() || "2",
      notes: itemWithNotes.notes || "",
      paymentType: item.paymentType,
    });
    setIsEditDialogOpen(true);
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "圖片太大",
          description: "請選擇小於10MB的圖片",
          variant: "destructive",
        });
        return;
      }

      setSelectedImage(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handlePaymentClick = (item: PaymentItem) => {
    setPaymentItem(item);
    setIsPaymentDialogOpen(true);
    setSelectedImage(null);
    setImagePreview(null);
    paymentForm.reset({
      amount: "",
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "",
      note: "",
    });
  };

  // 處理從財務總覽頁面的快速付款跳轉
  useEffect(() => {
    if (!searchString || !paymentItems || paymentItems.length === 0) return;

    const urlParams = new URLSearchParams(searchString);
    const payItemId = urlParams.get('pay');
    const amount = urlParams.get('amount');

    if (payItemId) {
      const targetItem = paymentItems.find((item: PaymentItem) => item.id === parseInt(payItemId));

      if (targetItem) {
        setPaymentItem(targetItem);
        setIsPaymentDialogOpen(true);
        setSelectedImage(null);
        setImagePreview(null);
        paymentForm.reset({
          amount: amount || "",
          paymentDate: new Date().toISOString().split("T")[0],
          paymentMethod: "",
          note: "",
        });
        setLocation('/payment-project', { replace: true });
      }
    }
  }, [searchString, paymentItems, paymentForm, setLocation]);

  return {
    // 對話框狀態
    selectedItem,
    setSelectedItem,
    isEditDialogOpen,
    setIsEditDialogOpen,
    editingItem,
    isPaymentDialogOpen,
    setIsPaymentDialogOpen,
    paymentItem,
    setPaymentItem,
    isProjectCategoryDialogOpen,
    setIsProjectCategoryDialogOpen,
    deleteItem,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,

    // 圖片狀態
    selectedImage,
    imagePreview,

    // 批量操作
    selectedItems,
    setSelectedItems,
    isAllSelected,
    setIsAllSelected,
    toggleItemSelection,
    toggleSelectAll,
    handleBatchStatusUpdate,

    // 表單
    paymentForm,
    editForm,

    // Mutations
    paymentMutation,
    editItemMutation,
    deleteMutation,

    // 事件處理器
    handlePayment,
    handleEditItem,
    handleDeleteClick,
    handleDeleteConfirm,
    openEditDialog,
    handleImageSelect,
    removeImage,
    handlePaymentClick,
  };
}
