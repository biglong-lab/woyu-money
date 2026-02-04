import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Info, XCircle, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
}

interface LoadingStateProps {
  isLoading: boolean;
  text?: string;
  progress?: number;
}

interface ActionFeedbackProps {
  action: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
}

interface StatisticCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeText?: string;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  trend?: 'up' | 'down' | 'stable';
}

// Toast 通知組件
export function EnhancedToast({ notifications, onRemove }: { 
  notifications: ToastNotification[], 
  onRemove: (id: string) => void 
}) {
  useEffect(() => {
    notifications.forEach(notification => {
      const timer = setTimeout(() => {
        onRemove(notification.id);
      }, notification.duration || 5000);

      return () => clearTimeout(timer);
    });
  }, [notifications, onRemove]);

  const getIcon = (type: ToastNotification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'info': return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getBackgroundColor = (type: ToastNotification['type']) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      case 'info': return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Card className={`${getBackgroundColor(notification.type)} shadow-lg`}>
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  {getIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{notification.title}</p>
                    {notification.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemove(notification.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// 載入狀態組件
export function EnhancedLoadingState({ isLoading, text = "載入中...", progress }: LoadingStateProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!isLoading) return;
    
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 500);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-12 space-y-4"
    >
      <div className="relative">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      </div>
      
      <div className="text-center space-y-2">
        <p className="text-sm font-medium">
          {text}
          <span className="inline-block w-8 text-left">{dots}</span>
        </p>
        
        {progress !== undefined && (
          <div className="w-48 space-y-1">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{progress}% 完成</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// 操作反饋組件
export function ActionFeedback({ action, status, message }: ActionFeedbackProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'loading':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        };
      case 'success':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50'
        };
      case 'error':
        return {
          icon: <XCircle className="h-4 w-4" />,
          color: 'text-red-600',
          bgColor: 'bg-red-50'
        };
      default:
        return {
          icon: null,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/50'
        };
    }
  };

  const config = getStatusConfig();

  if (status === 'idle') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg ${config.bgColor} ${config.color}`}
    >
      {config.icon}
      <span className="text-sm font-medium">{action}</span>
      {message && <span className="text-xs">- {message}</span>}
    </motion.div>
  );
}

// 統計卡片組件
export function EnhancedStatisticCard({ 
  title, 
  value, 
  change, 
  changeText, 
  icon, 
  color = 'blue',
  trend = 'stable'
}: StatisticCardProps) {
  const getColorClasses = () => {
    switch (color) {
      case 'green':
        return {
          bg: 'bg-green-50',
          icon: 'text-green-600',
          accent: 'border-green-200'
        };
      case 'red':
        return {
          bg: 'bg-red-50',
          icon: 'text-red-600',
          accent: 'border-red-200'
        };
      case 'yellow':
        return {
          bg: 'bg-yellow-50',
          icon: 'text-yellow-600',
          accent: 'border-yellow-200'
        };
      case 'purple':
        return {
          bg: 'bg-purple-50',
          icon: 'text-purple-600',
          accent: 'border-purple-200'
        };
      default:
        return {
          bg: 'bg-blue-50',
          icon: 'text-blue-600',
          accent: 'border-blue-200'
        };
    }
  };

  const colorClasses = getColorClasses();

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trend === 'down') return <TrendingUp className="h-3 w-3 text-red-500 rotate-180" />;
    return null;
  };

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      return new Intl.NumberFormat('zh-TW').format(val);
    }
    return val;
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`${colorClasses.bg} ${colorClasses.accent} border-2 transition-all duration-200 hover:shadow-md`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <div className="flex items-baseline space-x-2">
                <p className="text-2xl font-bold">{formatValue(value)}</p>
                {change !== undefined && (
                  <div className="flex items-center space-x-1">
                    {getTrendIcon()}
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        trend === 'up' ? 'text-green-600 border-green-200' :
                        trend === 'down' ? 'text-red-600 border-red-200' :
                        'text-muted-foreground'
                      }`}
                    >
                      {change > 0 ? '+' : ''}{change}%
                    </Badge>
                  </div>
                )}
              </div>
              {changeText && (
                <p className="text-xs text-muted-foreground">{changeText}</p>
              )}
            </div>
            
            <div className={`p-3 rounded-lg ${colorClasses.bg} ${colorClasses.icon}`}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// 空狀態組件
export function EmptyState({ 
  icon, 
  title, 
  description, 
  action 
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 text-center space-y-4"
    >
      <div className="p-4 rounded-full bg-muted/50 text-muted-foreground">
        {icon}
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      </div>
      
      {action && (
        <div className="pt-4">
          {action}
        </div>
      )}
    </motion.div>
  );
}

// 成功動畫組件
export function SuccessAnimation({ show, onComplete }: { show: boolean; onComplete?: () => void }) {
  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50 bg-background/80"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl"
      >
        <div className="flex flex-col items-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
            className="p-4 bg-green-100 rounded-full"
          >
            <CheckCircle className="h-12 w-12 text-green-600" />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-center"
          >
            <h3 className="text-xl font-semibold text-green-600">操作成功！</h3>
            <p className="text-sm text-muted-foreground mt-1">已成功完成操作</p>
          </motion.div>
          
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="flex space-x-1"
          >
            {[...Array(3)].map((_, i) => (
              <Sparkles key={i} className="h-4 w-4 text-yellow-500" />
            ))}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// 進度追蹤組件
export function ProgressTracker({ 
  steps, 
  currentStep, 
  completed = false 
}: {
  steps: string[];
  currentStep: number;
  completed?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">進度</span>
        <span className="font-medium">
          {completed ? '已完成' : `${currentStep}/${steps.length}`}
        </span>
      </div>
      
      <Progress 
        value={completed ? 100 : (currentStep / steps.length) * 100} 
        className="h-2"
      />
      
      <div className="space-y-2">
        {steps.map((step, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`flex items-center space-x-3 text-sm ${
              index < currentStep || completed
                ? 'text-green-600'
                : index === currentStep
                ? 'text-primary font-medium'
                : 'text-muted-foreground'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${
              index < currentStep || completed
                ? 'bg-green-600'
                : index === currentStep
                ? 'bg-primary'
                : 'bg-muted-foreground/30'
            }`} />
            <span>{step}</span>
            {(index < currentStep || completed) && (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}