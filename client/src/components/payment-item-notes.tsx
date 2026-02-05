import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MessageSquare, Plus, Upload, FileText, Calendar, User, Edit2, Trash2, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const noteSchema = z.object({
  noteText: z.string().min(1, "請輸入備註內容"),
  attachmentUrl: z.string().optional(),
  attachmentName: z.string().optional(),
  attachmentSize: z.number().optional(),
  attachmentType: z.string().optional(),
});

type NoteFormData = z.infer<typeof noteSchema>;

interface PaymentItemNote {
  id: number;
  itemId: number;
  userId?: number;
  userInfo?: string;
  noteText: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentType?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaymentItemNotesProps {
  itemId: number;
  itemName: string;
}

export default function PaymentItemNotes({ itemId, itemName }: PaymentItemNotesProps) {
  const { toast } = useToast();
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<PaymentItemNote | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const form = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      noteText: "",
      attachmentUrl: "",
      attachmentName: "",
      attachmentSize: 0,
      attachmentType: "",
    },
  });

  const { data: notes = [], isLoading } = useQuery<PaymentItemNote[]>({
    queryKey: ["/api/payment-items", itemId, "notes"],
    queryFn: async () => {
      return await apiRequest("GET", `/api/payment-items/${itemId}/notes`);
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: NoteFormData) => {
      return await apiRequest("POST", `/api/payment-items/${itemId}/notes`, data);
    },
    onSuccess: (newNote) => {
      // 強制移除快取並重新獲取
      queryClient.removeQueries({ queryKey: ["/api/payment-items", itemId, "notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-items", itemId, "notes"] });
      form.reset();
      setIsAddingNote(false);
      toast({
        title: "備註新增成功",
        description: "備註記錄已成功新增",
      });
    },
    onError: (error: any) => {
      console.error("Create note error:", error);
      toast({
        title: "新增失敗",
        description: error.message || "新增備註時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<NoteFormData> }) => {
      return await apiRequest("PUT", `/api/payment-item-notes/${id}`, data);
    },
    onSuccess: () => {
      // 強制移除快取並重新獲取
      queryClient.removeQueries({ queryKey: ["/api/payment-items", itemId, "notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-items", itemId, "notes"] });
      setEditingNote(null);
      form.reset();
      toast({
        title: "備註更新成功",
        description: "備註記錄已成功更新",
      });
    },
    onError: (error: any) => {
      console.error("Update note error:", error);
      toast({
        title: "更新失敗",
        description: error.message || "更新備註時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/payment-item-notes/${id}`);
    },
    onSuccess: () => {
      // 強制移除快取並重新獲取
      queryClient.removeQueries({ queryKey: ["/api/payment-items", itemId, "notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-items", itemId, "notes"] });
      toast({
        title: "備註刪除成功",
        description: "備註記錄已成功刪除",
      });
    },
    onError: (error: any) => {
      console.error("Delete note error:", error);
      toast({
        title: "刪除失敗",
        description: error.message || "刪除備註時發生錯誤",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('images', file);

      const response = await fetch("/api/upload/images", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      
      if (data.imagePaths && data.imagePaths.length > 0) {
        form.setValue('attachmentUrl', data.imagePaths[0]);
        form.setValue('attachmentName', file.name);
        form.setValue('attachmentSize', file.size);
        form.setValue('attachmentType', file.type);
        
        toast({
          title: "檔案上傳成功",
          description: `檔案 ${file.name} 已成功上傳`,
        });
      }
    } catch (error: any) {
      toast({
        title: "檔案上傳失敗",
        description: error.message || "檔案上傳時發生錯誤",
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const onSubmit = (data: NoteFormData) => {
    if (editingNote) {
      updateNoteMutation.mutate({ id: editingNote.id, data });
    } else {
      createNoteMutation.mutate(data);
    }
  };

  const startEdit = (note: PaymentItemNote) => {
    setEditingNote(note);
    form.reset({
      noteText: note.noteText,
      attachmentUrl: note.attachmentUrl || "",
      attachmentName: note.attachmentName || "",
      attachmentSize: note.attachmentSize || 0,
      attachmentType: note.attachmentType || "",
    });
    setIsAddingNote(true);
  };

  const cancelEdit = () => {
    setEditingNote(null);
    form.reset();
    setIsAddingNote(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImageFile = (url: string, type?: string): boolean => {
    if (type) {
      return type.startsWith('image/');
    }
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageModalOpen(true);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            備註記錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            備註記錄
            <Badge variant="secondary" className="ml-2">
              {notes.length} 筆
            </Badge>
          </div>
          <Button
            onClick={() => setIsAddingNote(true)}
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            新增備註
          </Button>
        </CardTitle>
        <CardDescription>
          {itemName} - 項目備註記錄管理
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 新增/編輯備註表單 */}
        {isAddingNote && (
          <Card className="border-2 border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">
                {editingNote ? "編輯備註" : "新增備註"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="noteText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>備註內容 *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="請輸入備註內容..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="attachmentUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>檔案附件</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Input
                              type="file"
                              accept="image/*,.pdf,.doc,.docx,.txt"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleFileUpload(file);
                                }
                              }}
                              disabled={uploadingFile}
                            />
                            {field.value && (
                              <div className="flex items-center gap-2 text-sm text-green-600">
                                <FileText className="h-4 w-4" />
                                <span>{form.getValues('attachmentName')}</span>
                                <span className="text-gray-500">
                                  ({formatFileSize(form.getValues('attachmentSize') || 0)})
                                </span>
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="submit"
                      disabled={createNoteMutation.isPending || updateNoteMutation.isPending || uploadingFile}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {editingNote ? "更新備註" : "新增備註"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelEdit}
                    >
                      取消
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* 備註列表 */}
        <div className="space-y-3">
          {notes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>尚無備註記錄</p>
              <p className="text-sm">點擊「新增備註」開始記錄</p>
            </div>
          ) : (
            notes.map((note: PaymentItemNote) => (
              <Card key={note.id} className="relative">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <User className="h-4 w-4" />
                      <span>{note.userInfo || '系統用戶'}</span>
                      <Calendar className="h-4 w-4 ml-2" />
                      <span>{formatDate(note.createdAt)}</span>
                      {note.createdAt !== note.updatedAt && (
                        <Badge variant="outline" className="text-xs">
                          已編輯
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(note)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>確認刪除備註</AlertDialogTitle>
                            <AlertDialogDescription>
                              此操作無法復原，確定要刪除這條備註記錄嗎？
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              刪除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  
                  <div className="whitespace-pre-wrap text-gray-800 mb-3">
                    {note.noteText}
                  </div>

                  {note.attachmentUrl && (
                    <div className="border-t pt-3">
                      <div className="flex items-center gap-2 text-sm">
                        {isImageFile(note.attachmentUrl, note.attachmentType) ? (
                          <>
                            <ImageIcon className="h-4 w-4 text-blue-600" />
                            <button
                              onClick={() => openImageModal(note.attachmentUrl!)}
                              className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                            >
                              {note.attachmentName || '圖片附件'}
                            </button>
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 text-blue-600" />
                            <a
                              href={note.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              {note.attachmentName || '附件檔案'}
                            </a>
                          </>
                        )}
                        {note.attachmentSize && (
                          <span className="text-gray-500">
                            ({formatFileSize(note.attachmentSize)})
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>

      {/* Image Modal */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-4">
          <DialogTitle className="sr-only">圖片預覽</DialogTitle>
          {selectedImage && (
            <div className="flex justify-center items-center">
              <img
                src={selectedImage}
                alt="附件圖片"
                className="max-w-full max-h-[80vh] object-contain"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}