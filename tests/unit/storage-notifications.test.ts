/**
 * server/storage/notifications.ts 單元測試
 * 覆蓋通知 CRUD、狀態更新、批量操作、設定管理、付款提醒生成
 * 使用 drizzle ORM 鏈式呼叫 mock
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// === 使用 vi.hoisted 建立 mock ===
const { mockDb, state } = vi.hoisted(() => {
  const state = {
    selectResult: [] as unknown[],
    insertResult: [] as unknown[],
    updateResult: [] as unknown[],
    deleteResult: undefined as unknown,
    executeResult: { rows: [] } as unknown,
  }

  /** 建立可鏈式呼叫的 Proxy mock */
  function createChainMock(resultKey: keyof typeof state) {
    const chain: Record<string, (...args: unknown[]) => unknown> = {}
    const self: unknown = new Proxy(chain, {
      get(target, prop: string) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => resolve(state[resultKey])
        }
        if (!target[prop]) {
          target[prop] = vi.fn(() => self)
        }
        return target[prop]
      },
    })
    return self
  }

  const mockDb = {
    select: vi.fn(() => createChainMock("selectResult")),
    insert: vi.fn(() => createChainMock("insertResult")),
    update: vi.fn(() => createChainMock("updateResult")),
    delete: vi.fn(() => createChainMock("deleteResult")),
    execute: vi.fn(() => Promise.resolve(state.executeResult)),
  }

  return { mockDb, state }
})

vi.mock("../../server/db", () => ({
  db: mockDb,
}))

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>()
  return {
    ...actual,
    eq: vi.fn((_col: unknown, _val: unknown) => ({ type: "eq" })),
    and: vi.fn((..._conditions: unknown[]) => ({ type: "and" })),
    desc: vi.fn((_col: unknown) => ({ type: "desc" })),
  }
})

import {
  createNotification,
  getUserNotifications,
  getNewNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationSettings,
  updateNotificationSettings,
  generatePaymentReminders,
  getUsersWithLineNotificationEnabled,
  getUsersWithEmailNotificationEnabled,
  getUserCriticalNotifications,
  getUserUnreadNotifications,
} from "../../server/storage/notifications"

// === 測試用 mock 資料 ===

const mockNotification = {
  id: 1,
  userId: 1,
  type: "payment_reminder",
  title: "付款提醒",
  message: "項目需要付款",
  priority: "medium",
  isRead: false,
  actionUrl: null,
  metadata: {},
  createdAt: new Date("2026-03-01"),
  readAt: null,
  expiresAt: null,
}

const mockSettings = {
  id: 1,
  userId: 1,
  emailEnabled: true,
  lineEnabled: false,
  browserEnabled: true,
  paymentDueReminder: true,
  paymentOverdueAlert: true,
  systemUpdates: false,
  weeklyReport: true,
  dailyDigestTime: "09:00",
  weeklyReportDay: "monday",
  advanceWarningDays: 3,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

function resetState() {
  vi.clearAllMocks()
  state.selectResult = []
  state.insertResult = []
  state.updateResult = []
  state.deleteResult = undefined
  state.executeResult = { rows: [] }
  // 消除 console.error 輸出
  vi.spyOn(console, "error").mockImplementation(() => {})
}

describe("storage/notifications.ts - 通知 CRUD", () => {
  beforeEach(resetState)

  // ========== createNotification ==========
  describe("createNotification", () => {
    it("成功建立通知", async () => {
      state.insertResult = [mockNotification]

      const result = await createNotification({
        userId: 1,
        type: "payment_reminder",
        title: "付款提醒",
        message: "項目需要付款",
        priority: "medium",
      })

      expect(result).toEqual(mockNotification)
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it("DB 錯誤時拋出異常", async () => {
      mockDb.insert.mockImplementationOnce(() => {
        throw new Error("Insert failed")
      })

      await expect(
        createNotification({
          userId: 1,
          type: "test",
          title: "測試",
          message: "測試訊息",
        })
      ).rejects.toThrow("Insert failed")
    })
  })

  // ========== getUserNotifications ==========
  describe("getUserNotifications", () => {
    it("回傳使用者的通知清單", async () => {
      state.selectResult = [mockNotification]

      const result = await getUserNotifications(1)

      expect(result).toEqual([mockNotification])
    })

    it("使用自訂 limit", async () => {
      state.selectResult = [mockNotification]

      const result = await getUserNotifications(1, 10)

      expect(result).toEqual([mockNotification])
    })

    it("無通知時回傳空陣列", async () => {
      state.selectResult = []

      const result = await getUserNotifications(999)

      expect(result).toEqual([])
    })

    it("DB 錯誤時拋出異常", async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error("Query failed")
      })

      await expect(getUserNotifications(1)).rejects.toThrow("Query failed")
    })
  })

  // ========== getNewNotifications ==========
  describe("getNewNotifications", () => {
    it("有 lastCheck 時篩選新通知", async () => {
      state.selectResult = [mockNotification]

      const result = await getNewNotifications(1, "2026-02-28T00:00:00Z")

      expect(result).toEqual([mockNotification])
    })

    it("無 lastCheck 時回傳最近通知", async () => {
      state.selectResult = [mockNotification]

      const result = await getNewNotifications(1)

      expect(result).toEqual([mockNotification])
    })

    it("無新通知時回傳空陣列", async () => {
      state.selectResult = []

      const result = await getNewNotifications(1, "2026-03-01T00:00:00Z")

      expect(result).toEqual([])
    })

    it("DB 錯誤時拋出異常", async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error("Query failed")
      })

      await expect(getNewNotifications(1)).rejects.toThrow("Query failed")
    })
  })

  // ========== markNotificationAsRead ==========
  describe("markNotificationAsRead", () => {
    it("成功標記為已讀", async () => {
      state.updateResult = []

      await expect(markNotificationAsRead(1, "1")).resolves.toBeUndefined()
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("DB 錯誤時拋出異常", async () => {
      mockDb.update.mockImplementationOnce(() => {
        throw new Error("Update failed")
      })

      await expect(markNotificationAsRead(1, "1")).rejects.toThrow("Update failed")
    })
  })

  // ========== markAllNotificationsAsRead ==========
  describe("markAllNotificationsAsRead", () => {
    it("成功標記全部為已讀", async () => {
      state.updateResult = []

      await expect(markAllNotificationsAsRead(1)).resolves.toBeUndefined()
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("DB 錯誤時拋出異常", async () => {
      mockDb.update.mockImplementationOnce(() => {
        throw new Error("Update failed")
      })

      await expect(markAllNotificationsAsRead(1)).rejects.toThrow("Update failed")
    })
  })

  // ========== deleteNotification ==========
  describe("deleteNotification", () => {
    it("成功刪除通知", async () => {
      state.deleteResult = undefined

      await expect(deleteNotification(1, "1")).resolves.toBeUndefined()
      expect(mockDb.delete).toHaveBeenCalled()
    })

    it("DB 錯誤時拋出異常", async () => {
      mockDb.delete.mockImplementationOnce(() => {
        throw new Error("Delete failed")
      })

      await expect(deleteNotification(1, "1")).rejects.toThrow("Delete failed")
    })
  })
})

describe("storage/notifications.ts - 通知設定管理", () => {
  beforeEach(resetState)

  // ========== getNotificationSettings ==========
  describe("getNotificationSettings", () => {
    it("找到設定時回傳設定物件", async () => {
      state.selectResult = [mockSettings]

      const result = await getNotificationSettings(1)

      expect(result).toEqual(mockSettings)
    })

    it("找不到設定時回傳 null", async () => {
      state.selectResult = []

      const result = await getNotificationSettings(999)

      expect(result).toBeNull()
    })

    it("DB 錯誤時拋出異常", async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error("Query failed")
      })

      await expect(getNotificationSettings(1)).rejects.toThrow("Query failed")
    })
  })

  // ========== updateNotificationSettings ==========
  describe("updateNotificationSettings", () => {
    it("更新已存在的設定", async () => {
      const updated = { ...mockSettings, emailEnabled: false }
      state.updateResult = [updated]

      const result = await updateNotificationSettings(1, {
        emailEnabled: false,
      })

      expect(result.emailEnabled).toBe(false)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("設定不存在時建立新設定", async () => {
      // update 回傳 [undefined] 表示沒有更新到任何行
      state.updateResult = [undefined]
      state.insertResult = [mockSettings]

      const result = await updateNotificationSettings(1, {
        emailEnabled: true,
      })

      expect(result).toBeDefined()
    })

    it("DB 錯誤時拋出異常", async () => {
      mockDb.update.mockImplementationOnce(() => {
        throw new Error("Update failed")
      })

      await expect(updateNotificationSettings(1, { emailEnabled: true })).rejects.toThrow(
        "Update failed"
      )
    })
  })
})

describe("storage/notifications.ts - 付款提醒生成", () => {
  beforeEach(resetState)

  // ========== generatePaymentReminders ==========
  describe("generatePaymentReminders", () => {
    it("無付款項目時回傳 0", async () => {
      state.selectResult = []

      const result = await generatePaymentReminders()

      expect(result).toBe(0)
    })

    it("有付款項目時建立通知並回傳數量", async () => {
      const paymentItems = [
        { id: 1, itemName: "房租", totalAmount: "10000" },
        { id: 2, itemName: "水電", totalAmount: "3000" },
      ]
      state.selectResult = paymentItems
      state.insertResult = [mockNotification]

      const result = await generatePaymentReminders()

      expect(result).toBe(2)
    })

    it("DB 錯誤時拋出異常", async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error("Query failed")
      })

      await expect(generatePaymentReminders()).rejects.toThrow("Query failed")
    })
  })
})

describe("storage/notifications.ts - 通知使用者查詢", () => {
  beforeEach(resetState)

  // ========== getUsersWithLineNotificationEnabled ==========
  describe("getUsersWithLineNotificationEnabled", () => {
    it("回傳啟用 LINE 通知的使用者清單", async () => {
      state.executeResult = {
        rows: [
          {
            id: 1,
            username: "user1",
            line_user_id: "U123",
            email: "user1@test.com",
          },
        ],
      }

      const result = await getUsersWithLineNotificationEnabled()

      expect(result).toHaveLength(1)
      expect(result[0].lineUserId).toBe("U123")
      expect(result[0].username).toBe("user1")
    })

    it("多個使用者時全部回傳", async () => {
      state.executeResult = {
        rows: [
          { id: 1, username: "user1", line_user_id: "U123", email: "a@b.com" },
          { id: 2, username: "user2", line_user_id: "U456", email: "c@d.com" },
        ],
      }

      const result = await getUsersWithLineNotificationEnabled()

      expect(result).toHaveLength(2)
    })

    it("無使用者時回傳空陣列", async () => {
      state.executeResult = { rows: [] }

      const result = await getUsersWithLineNotificationEnabled()

      expect(result).toEqual([])
    })

    it("DB 錯誤時回傳空陣列（容錯）", async () => {
      mockDb.execute.mockRejectedValueOnce(new Error("Query failed"))

      const result = await getUsersWithLineNotificationEnabled()

      expect(result).toEqual([])
    })
  })

  // ========== getUsersWithEmailNotificationEnabled ==========
  describe("getUsersWithEmailNotificationEnabled", () => {
    it("回傳啟用 Email 通知的使用者清單", async () => {
      state.executeResult = {
        rows: [
          {
            id: 1,
            username: "user1",
            email: "user1@test.com",
          },
        ],
      }

      const result = await getUsersWithEmailNotificationEnabled()

      expect(result).toHaveLength(1)
      expect(result[0].email).toBe("user1@test.com")
      expect(result[0].username).toBe("user1")
    })

    it("無使用者時回傳空陣列", async () => {
      state.executeResult = { rows: [] }

      const result = await getUsersWithEmailNotificationEnabled()

      expect(result).toEqual([])
    })

    it("DB 錯誤時回傳空陣列（容錯）", async () => {
      mockDb.execute.mockRejectedValueOnce(new Error("Query failed"))

      const result = await getUsersWithEmailNotificationEnabled()

      expect(result).toEqual([])
    })
  })

  // ========== getUserCriticalNotifications ==========
  describe("getUserCriticalNotifications", () => {
    it("回傳未讀的重要通知", async () => {
      const criticalNotification = {
        ...mockNotification,
        priority: "critical",
      }
      state.selectResult = [criticalNotification]

      const result = await getUserCriticalNotifications(1)

      expect(result).toEqual([criticalNotification])
    })

    it("無重要通知時回傳空陣列", async () => {
      state.selectResult = []

      const result = await getUserCriticalNotifications(1)

      expect(result).toEqual([])
    })

    it("DB 錯誤時回傳空陣列（容錯）", async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error("Query failed")
      })

      const result = await getUserCriticalNotifications(1)

      expect(result).toEqual([])
    })
  })

  // ========== getUserUnreadNotifications ==========
  describe("getUserUnreadNotifications", () => {
    it("回傳未讀通知", async () => {
      state.selectResult = [mockNotification]

      const result = await getUserUnreadNotifications(1)

      expect(result).toEqual([mockNotification])
    })

    it("無未讀通知時回傳空陣列", async () => {
      state.selectResult = []

      const result = await getUserUnreadNotifications(999)

      expect(result).toEqual([])
    })

    it("DB 錯誤時回傳空陣列（容錯）", async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error("Query failed")
      })

      const result = await getUserUnreadNotifications(1)

      expect(result).toEqual([])
    })
  })
})
