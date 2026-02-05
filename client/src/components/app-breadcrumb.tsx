/**
 * AppBreadcrumb - 自動麵包屑導航
 * 根據當前路由自動生成麵包屑
 */
import { Link, useLocation } from "wouter";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getBreadcrumbs } from "@/config/navigation";

interface AppBreadcrumbProps {
  // 是否在首頁隱藏（預設隱藏）
  hideOnHome?: boolean;
  // 額外的 className
  className?: string;
}

export function AppBreadcrumb({
  hideOnHome = true,
  className,
}: AppBreadcrumbProps) {
  const [location] = useLocation();
  const breadcrumbs = getBreadcrumbs(location);

  // 首頁時隱藏麵包屑
  if (hideOnHome && location === "/") {
    return null;
  }

  // 只有一層時隱藏
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className={className}>
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <BreadcrumbItem key={index}>
                {isLast ? (
                  <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                ) : (
                  <>
                    {crumb.href ? (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.title}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <span className="text-muted-foreground">{crumb.title}</span>
                    )}
                    <BreadcrumbSeparator />
                  </>
                )}
              </BreadcrumbItem>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </nav>
  );
}

export default AppBreadcrumb;
