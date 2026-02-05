/**
 * QuickActionFAB - 浮動快速操作按鈕
 * 在所有頁面右下角顯示，展開後提供：
 * - 掃描單據
 * - 快速付款
 * - 新增項目
 */
import { useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  Plus,
  X,
  Camera,
  DollarSign,
  FileText,
} from "lucide-react";

interface QuickActionFABProps {
  onQuickPayment: () => void;
}

export function QuickActionFAB({ onQuickPayment }: QuickActionFABProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen((prev) => !prev);

  const actions = [
    {
      label: "掃描單據",
      icon: Camera,
      href: "/document-inbox",
      color: "bg-purple-500 hover:bg-purple-600",
    },
    {
      label: "快速付款",
      icon: DollarSign,
      onClick: () => {
        setIsOpen(false);
        onQuickPayment();
      },
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      label: "新增項目",
      icon: FileText,
      href: "/general-payment-management",
      color: "bg-blue-500 hover:bg-blue-600",
    },
  ];

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-40 flex flex-col items-end gap-3">
      {/* 展開的操作按鈕 */}
      {isOpen && (
        <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {actions.map((action) => {
            const Icon = action.icon;
            const content = (
              <div
                key={action.label}
                className="flex items-center gap-2"
                onClick={action.onClick}
              >
                <span className="bg-white text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg shadow-md border border-gray-200 whitespace-nowrap">
                  {action.label}
                </span>
                <button
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200",
                    action.color
                  )}
                >
                  <Icon className="w-5 h-5" />
                </button>
              </div>
            );

            if (action.href) {
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  onClick={() => setIsOpen(false)}
                >
                  {content}
                </Link>
              );
            }

            return (
              <div key={action.label} className="cursor-pointer">
                {content}
              </div>
            );
          })}
        </div>
      )}

      {/* 主按鈕 */}
      <button
        onClick={toggle}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300",
          isOpen
            ? "bg-gray-700 hover:bg-gray-800 rotate-45"
            : "bg-blue-600 hover:bg-blue-700"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </button>
    </div>
  );
}

export default QuickActionFAB;
