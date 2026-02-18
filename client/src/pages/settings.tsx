// 系統設定頁面 - 主框架
import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import SettingsCategoriesTab from "@/components/settings-categories-tab";
import SettingsProjectsTab from "@/components/settings-projects-tab";
import SettingsLineConfigTab from "@/components/settings-line-config-tab";
import SettingsAdminTab from "@/components/settings-admin-tab";
import { SettingsAiTab } from "@/components/settings-ai-tab";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("categories");

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-8 h-8" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">系統設定</h1>
          <p className="text-muted-foreground">
            管理分類、專案和系統配置
          </p>
        </div>
      </div>

      {/* 主要內容 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="categories">分類管理</TabsTrigger>
          <TabsTrigger value="projects">專案管理</TabsTrigger>
          <TabsTrigger value="line-config">LINE設定</TabsTrigger>
          <TabsTrigger value="admin">系統管理</TabsTrigger>
          <TabsTrigger value="ai">AI 助手</TabsTrigger>
        </TabsList>

        {/* 分類管理 */}
        <TabsContent value="categories" className="space-y-6">
          <SettingsCategoriesTab />
        </TabsContent>

        {/* 專案管理 */}
        <TabsContent value="projects" className="space-y-6">
          <SettingsProjectsTab />
        </TabsContent>

        {/* LINE 設定 */}
        <TabsContent value="line-config" className="space-y-6">
          <SettingsLineConfigTab />
        </TabsContent>

        {/* 系統管理 */}
        <TabsContent value="admin" className="space-y-6">
          <SettingsAdminTab />
        </TabsContent>

        {/* AI 助手 */}
        <TabsContent value="ai" className="space-y-6">
          <SettingsAiTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
