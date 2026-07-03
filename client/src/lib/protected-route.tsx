import { useAuth } from "@/hooks/use-auth"
import { Loader2 } from "lucide-react"
import { Redirect, Route } from "wouter"

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string
  // ComponentType 同時相容一般元件與 React.lazy 元件（Phase 4.2 code splitting）
  component: React.ComponentType
}) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    )
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    )
  }

  return (
    <Route path={path}>
      <Component />
    </Route>
  )
}
