import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, BellRing, Mail, MessageSquare, Calendar, 
  AlertTriangle, CheckCircle, X, Settings 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  type: 'payment_due' | 'payment_overdue' | 'system' | 'reminder';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  metadata?: any;
}

interface NotificationSettings {
  email: {
    enabled: boolean;
    paymentDue: boolean;
    paymentOverdue: boolean;
    systemUpdates: boolean;
    weeklyReport: boolean;
  };
  line: {
    enabled: boolean;
    paymentDue: boolean;
    paymentOverdue: boolean;
    emergencyAlerts: boolean;
  };
  browser: {
    enabled: boolean;
    paymentReminders: boolean;
    systemAlerts: boolean;
  };
  schedule: {
    dailyDigest: string;
    weeklyReport: string;
    advanceWarning: number; // days
  };
}

export function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    email: {
      enabled: true,
      paymentDue: true,
      paymentOverdue: true,
      systemUpdates: false,
      weeklyReport: true
    },
    line: {
      enabled: false,
      paymentDue: false,
      paymentOverdue: true,
      emergencyAlerts: true
    },
    browser: {
      enabled: true,
      paymentReminders: true,
      systemAlerts: true
    },
    schedule: {
      dailyDigest: '09:00',
      weeklyReport: 'monday',
      advanceWarning: 3
    }
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { toast } = useToast();

  // 載入通知
  useEffect(() => {
    loadNotifications();
    loadSettings();
    
    // 設定定時檢查
    const interval = setInterval(checkForNewNotifications, 60000); // 每分鐘檢查
    
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?limit=50');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('載入通知失敗:', error);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/notification-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('載入設定失敗:', error);
    }
  }, []);

  const checkForNewNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/check');
      if (response.ok) {
        const newNotifications = await response.json();
        if (newNotifications.length > 0) {
          setNotifications(prev => [...newNotifications, ...prev]);
          
          // 顯示瀏覽器通知
          if (settings.browser.enabled && 'Notification' in window) {
            newNotifications.forEach((notification: Notification) => {
              if (notification.priority === 'high' || notification.priority === 'critical') {
                new Notification(notification.title, {
                  body: notification.message,
                  icon: '/favicon.ico'
                });
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('檢查新通知失敗:', error);
    }
  }, [settings.browser.enabled]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('標記為已讀失敗:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('標記全部為已讀失敗:', error);
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('刪除通知失敗:', error);
    }
  }, []);

  const saveSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/notification-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        toast({
          title: "設定已儲存",
          description: "通知設定已成功更新"
        });
      }
    } catch (error) {
      toast({
        title: "儲存失敗",
        description: "無法儲存通知設定",
        variant: "destructive"
      });
    }
  }, [settings, toast]);

  const requestBrowserPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setSettings(prev => ({
          ...prev,
          browser: { ...prev.browser, enabled: true }
        }));
      }
    }
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityIcon = (type: string) => {
    switch (type) {
      case 'payment_due': return Calendar;
      case 'payment_overdue': return AlertTriangle;
      case 'system': return Bell;
      default: return CheckCircle;
    }
  };

  return (
    <div className="space-y-4">
      {/* 通知標題列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="h-6 w-6" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </div>
          <h3 className="text-lg font-semibold">通知中心</h3>
        </div>
        
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              全部標記為已讀
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            設定
          </Button>
        </div>
      </div>

      {/* 通知列表 */}
      <div className="space-y-2">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">目前沒有通知</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => {
            const IconComponent = getPriorityIcon(notification.type);
            return (
              <Card 
                key={notification.id} 
                className={`transition-all hover:shadow-md ${
                  !notification.read ? 'border-blue-200 bg-blue-50/30' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${getPriorityColor(notification.priority)}`}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className={`font-medium ${!notification.read ? 'font-semibold' : ''}`}>
                            {notification.title}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {notification.priority === 'critical' ? '緊急' :
                               notification.priority === 'high' ? '重要' :
                               notification.priority === 'medium' ? '普通' : '一般'}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {new Date(notification.createdAt).toLocaleString('zh-TW')}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-1">
                          {!notification.read && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* 通知設定對話框 */}
      {isSettingsOpen && (
        <Card className="fixed inset-4 z-50 bg-white shadow-2xl rounded-lg overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>通知設定</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            <Tabs defaultValue="channels">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="channels">通知管道</TabsTrigger>
                <TabsTrigger value="types">通知類型</TabsTrigger>
                <TabsTrigger value="schedule">時程設定</TabsTrigger>
              </TabsList>
              
              <TabsContent value="channels" className="space-y-4">
                {/* Email 設定 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email 通知
                    </Label>
                    <Switch
                      checked={settings.email.enabled}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({
                          ...prev,
                          email: { ...prev.email, enabled: checked }
                        }))
                      }
                    />
                  </div>
                  
                  {settings.email.enabled && (
                    <div className="ml-6 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">付款到期提醒</Label>
                        <Switch
                          checked={settings.email.paymentDue}
                          onCheckedChange={(checked) => 
                            setSettings(prev => ({
                              ...prev,
                              email: { ...prev.email, paymentDue: checked }
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">逾期付款警告</Label>
                        <Switch
                          checked={settings.email.paymentOverdue}
                          onCheckedChange={(checked) => 
                            setSettings(prev => ({
                              ...prev,
                              email: { ...prev.email, paymentOverdue: checked }
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">週報</Label>
                        <Switch
                          checked={settings.email.weeklyReport}
                          onCheckedChange={(checked) => 
                            setSettings(prev => ({
                              ...prev,
                              email: { ...prev.email, weeklyReport: checked }
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* LINE 設定 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      LINE 通知
                    </Label>
                    <Switch
                      checked={settings.line.enabled}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({
                          ...prev,
                          line: { ...prev.line, enabled: checked }
                        }))
                      }
                    />
                  </div>
                  
                  {settings.line.enabled && (
                    <div className="ml-6 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">逾期付款警告</Label>
                        <Switch
                          checked={settings.line.paymentOverdue}
                          onCheckedChange={(checked) => 
                            setSettings(prev => ({
                              ...prev,
                              line: { ...prev.line, paymentOverdue: checked }
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">緊急警報</Label>
                        <Switch
                          checked={settings.line.emergencyAlerts}
                          onCheckedChange={(checked) => 
                            setSettings(prev => ({
                              ...prev,
                              line: { ...prev.line, emergencyAlerts: checked }
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 瀏覽器通知 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <BellRing className="h-4 w-4" />
                      瀏覽器通知
                    </Label>
                    <div className="flex gap-2">
                      {!settings.browser.enabled && (
                        <Button size="sm" variant="outline" onClick={requestBrowserPermission}>
                          啟用
                        </Button>
                      )}
                      <Switch
                        checked={settings.browser.enabled}
                        onCheckedChange={(checked) => 
                          setSettings(prev => ({
                            ...prev,
                            browser: { ...prev.browser, enabled: checked }
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="schedule" className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label>每日摘要時間</Label>
                    <Input
                      type="time"
                      value={settings.schedule.dailyDigest}
                      onChange={(e) => 
                        setSettings(prev => ({
                          ...prev,
                          schedule: { ...prev.schedule, dailyDigest: e.target.value }
                        }))
                      }
                    />
                  </div>
                  
                  <div>
                    <Label>週報發送日</Label>
                    <Select
                      value={settings.schedule.weeklyReport}
                      onValueChange={(value) => 
                        setSettings(prev => ({
                          ...prev,
                          schedule: { ...prev.schedule, weeklyReport: value }
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monday">星期一</SelectItem>
                        <SelectItem value="tuesday">星期二</SelectItem>
                        <SelectItem value="wednesday">星期三</SelectItem>
                        <SelectItem value="thursday">星期四</SelectItem>
                        <SelectItem value="friday">星期五</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>提前提醒天數</Label>
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={settings.schedule.advanceWarning}
                      onChange={(e) => 
                        setSettings(prev => ({
                          ...prev,
                          schedule: { ...prev.schedule, advanceWarning: parseInt(e.target.value) }
                        }))
                      }
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                取消
              </Button>
              <Button onClick={saveSettings}>
                儲存設定
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}