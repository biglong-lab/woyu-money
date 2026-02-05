// 系統設定頁面共用型別

export type Category = {
  id: number;
  categoryName: string;
  parentId?: number;
  description?: string;
  isDeleted: boolean;
  usageCount?: number;
};

export type Project = {
  id: number;
  projectName: string;
  projectType: string;
  description?: string;
  isActive: boolean;
  itemCount?: number;
};

export type LineConfig = {
  id: number;
  channelId: string;
  channelSecret: string;
  callbackUrl: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SystemUser = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
};

// 專案類型文字對照
export const getProjectTypeText = (type: string): string => {
  switch (type) {
    case "general": return "一般專案";
    case "business": return "商業專案";
    case "personal": return "個人專案";
    case "investment": return "投資專案";
    default: return type;
  }
};
