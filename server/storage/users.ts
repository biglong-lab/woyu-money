import { db } from "../db"
import {
  users,
  paymentItems,
  loanInvestmentRecords,
  type User,
  type InsertUser,
} from "@shared/schema"
import { eq, desc, count } from "drizzle-orm"

// 使用者認證方法

export async function getUserById(id: number): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id))
  return user
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.username, username))
  return user
}

export async function getUserByLineUserId(lineUserId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.lineUserId, lineUserId))
  return user
}

export async function getUserByLineId(lineId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.lineUserId, lineId))
  return user
}

export async function createUser(user: InsertUser): Promise<User> {
  const [newUser] = await db
    .insert(users)
    .values({
      ...user,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
  return newUser
}

export async function updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
  const [updatedUser] = await db
    .update(users)
    .set({
      ...user,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning()
  return updatedUser
}

export async function updateUserLoginAttempts(
  id: number,
  attempts: number,
  lockedUntil?: Date
): Promise<void> {
  await db
    .update(users)
    .set({
      failedLoginAttempts: attempts,
      lockedUntil: lockedUntil,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
}

// 進階使用者管理方法

export async function getAllUsers(): Promise<User[]> {
  return (await db.select().from(users).orderBy(desc(users.createdAt))) as User[]
}

export async function updateUserRole(id: number, role: string): Promise<User> {
  const [updatedUser] = await db
    .update(users)
    .set({
      role: role,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning()
  return updatedUser
}

export async function updateUserPermissions(id: number, permissions: unknown): Promise<User> {
  const [updatedUser] = await db
    .update(users)
    .set({
      menuPermissions: permissions,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning()
  return updatedUser
}

export async function updateUserPassword(id: number, hashedPassword: string): Promise<void> {
  await db
    .update(users)
    .set({
      password: hashedPassword,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
}

export async function toggleUserStatus(id: number, isActive: boolean): Promise<User> {
  const [updatedUser] = await db
    .update(users)
    .set({
      isActive: isActive,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning()
  return updatedUser
}

export async function deleteUser(id: number): Promise<void> {
  await db.delete(users).where(eq(users.id, id))
}

/** 使用者系統統計 */
interface UserSystemStats {
  totalUsers: number
  activeUsers: number
  totalPaymentItems: number
  totalLoanRecords: number
  lastUpdated: string
}

export async function getSystemStats(): Promise<UserSystemStats> {
  const userCount = await db.select({ count: count() }).from(users)
  const activeUserCount = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.isActive, true))
  const paymentItemCount = await db.select({ count: count() }).from(paymentItems)
  const loanRecordCount = await db.select({ count: count() }).from(loanInvestmentRecords)

  return {
    totalUsers: userCount[0]?.count || 0,
    activeUsers: activeUserCount[0]?.count || 0,
    totalPaymentItems: paymentItemCount[0]?.count || 0,
    totalLoanRecords: loanRecordCount[0]?.count || 0,
    lastUpdated: new Date().toISOString(),
  }
}
