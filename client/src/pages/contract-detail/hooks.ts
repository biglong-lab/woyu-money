/** 合約詳情頁面自訂 hooks */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ContractData, PriceTier, ContractDocument, PaymentItem } from "./types";

/** 取得合約詳情資料的 hook */
export function useContractData(id: string | undefined) {
  const { data: contract, isLoading, error } = useQuery<ContractData>({
    queryKey: [`/api/rental/contracts/${id}`],
    enabled: !!id,
  });

  return { contract, isLoading, error };
}

/** 取得價格階段的 hook */
export function usePriceTiers(id: string | undefined) {
  const { data: priceTiers, isLoading } = useQuery<PriceTier[]>({
    queryKey: [`/api/rental/contracts/${id}/price-tiers`],
    enabled: !!id,
  });

  return { priceTiers, isLoading };
}

/** 取得合約文件的 hook */
export function useContractDocuments(id: string | undefined) {
  const { data: documents, isLoading } = useQuery<ContractDocument[]>({
    queryKey: [`/api/rental/contracts/${id}/documents`],
    enabled: !!id,
  });

  return { documents, isLoading };
}

/** 取得相關付款項目的 hook */
export function useRelatedPaymentItems(contract: ContractData | undefined) {
  const { data: paymentItems, isLoading } = useQuery<PaymentItem[]>({
    queryKey: ["/api/payment/items"],
    select: (data: unknown) => {
      if (!contract) return [];
      const response = data as { items?: PaymentItem[] };
      const items = response?.items || [];
      if (!Array.isArray(items)) return [];
      return items.filter(
        (item) =>
          item.itemName?.includes(contract.contractName) ||
          item.projectId === contract.projectId
      );
    },
    enabled: !!contract,
  });

  return { paymentItems, isLoading };
}

/** 文件上傳相關 state 與 mutation */
export function useDocumentUpload(contractId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");

  const uploadMutation = useMutation({
    mutationFn: async (data: { file: File; description: string }) => {
      const formData = new FormData();
      formData.append("document", data.file);
      formData.append("description", data.description);
      formData.append("versionLabel", "新版本");

      const response = await fetch(
        `/api/rental/contracts/${contractId}/documents`,
        { method: "POST", body: formData }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/rental/contracts/${contractId}/documents`],
      });
      setIsUploadDialogOpen(false);
      setUploadFile(null);
      setUploadDescription("");
      toast({ title: "文件上傳成功", description: "合約文件已成功上傳" });
    },
    onError: (error: Error) => {
      toast({
        title: "上傳失敗",
        description: error.message || "文件上傳失敗",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = () => {
    if (!uploadFile) {
      toast({
        title: "請選擇文件",
        description: "請先選擇要上傳的文件",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate({ file: uploadFile, description: uploadDescription });
  };

  return {
    isUploadDialogOpen,
    setIsUploadDialogOpen,
    uploadFile,
    setUploadFile,
    uploadDescription,
    setUploadDescription,
    uploadMutation,
    handleFileUpload,
  };
}

/** 文件刪除 mutation */
export function useDocumentDelete(contractId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest(
        `/api/rental/contracts/${contractId}/documents/${documentId}`,
        "DELETE"
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/rental/contracts/${contractId}/documents`],
      });
      toast({ title: "文件刪除成功", description: "合約文件已成功刪除" });
    },
    onError: (error: Error) => {
      toast({
        title: "刪除失敗",
        description: error.message || "文件刪除失敗",
        variant: "destructive",
      });
    },
  });

  return { deleteMutation };
}

/** 生成付款項目 mutation */
export function useGeneratePayments(contractId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/rental/contracts/${contractId}/generate-payments`,
        { method: "POST" }
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment/items"] });
      toast({ title: "生成成功", description: "付款項目已自動生成" });
    },
    onError: (error: Error) => {
      toast({
        title: "生成失敗",
        description: error.message || "付款項目生成失敗",
        variant: "destructive",
      });
    },
  });

  return { generateMutation };
}

/** 批次上傳文件 mutation */
export function useBatchDocumentUpload(contractId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const batchUploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const results: Response[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("document", file);
        formData.append("description", `合約文件 - ${file.name}`);
        formData.append("versionLabel", "新版本");

        const response = await fetch(
          `/api/rental/contracts/${contractId}/documents`,
          { method: "POST", body: formData }
        );
        if (!response.ok) {
          throw new Error(`上傳 ${file.name} 失敗`);
        }
        results.push(response);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/rental/contracts/${contractId}/documents`],
      });
      toast({ title: "批次上傳成功", description: "所有文件已成功上傳" });
    },
    onError: (error: Error) => {
      toast({
        title: "批次上傳失敗",
        description: error.message || "部分文件上傳失敗",
        variant: "destructive",
      });
    },
  });

  return { batchUploadMutation };
}
