import { createContext, ReactNode, useContext } from "react"
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query"
import { User, InsertUser, LoginData } from "@shared/schema"
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient"
import { useToast } from "@/hooks/use-toast"

type AuthContextType = {
  user: User | null
  isLoading: boolean
  error: Error | null
  loginMutation: UseMutationResult<User, Error, LoginData>
  logoutMutation: UseMutationResult<void, Error, void>
  registerMutation: UseMutationResult<User, Error, InsertUser>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  })

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
          credentials: "include",
        })

        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(errorText || `HTTP ${res.status}`)
        }

        const userData = await res.json()
        return userData
      } catch (error) {
        console.error("登入API錯誤:", error)
        throw error
      }
    },
    onSuccess: async (user: User) => {
      // 立即設定用戶數據到快取
      queryClient.setQueryData(["/api/user"], user)
      // 重新獲取用戶數據以確保狀態同步
      await queryClient.refetchQueries({ queryKey: ["/api/user"] })
      toast({
        title: "登入成功",
        description: `歡迎回來，${user.fullName || user.username}！`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "登入失敗",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials) as User
      return res
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user)
      toast({
        title: "註冊成功",
        description: `歡迎，${user.fullName || user.username}！`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "註冊失敗",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout")
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null)
      toast({
        title: "登出成功",
        description: "您已安全登出系統",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "登出失敗",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
