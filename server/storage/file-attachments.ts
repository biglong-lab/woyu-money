import { db } from "../db"
import {
  fileAttachments,
  type FileAttachment,
  type InsertFileAttachment,
} from "@shared/schema"
import { eq, and, desc } from "drizzle-orm"

// 建立檔案附件
export async function createFileAttachment(
  attachment: InsertFileAttachment
): Promise<FileAttachment> {
  try {
    const [created] = await db
      .insert(fileAttachments)
      .values(attachment)
      .returning()
    return created
  } catch (error) {
    console.error("建立檔案附件失敗:", error)
    throw error
  }
}

// 根據 ID 取得單一檔案附件
export async function getFileAttachment(
  id: number
): Promise<FileAttachment | undefined> {
  try {
    const [attachment] = await db
      .select()
      .from(fileAttachments)
      .where(eq(fileAttachments.id, id))
    return attachment
  } catch (error) {
    console.error("取得檔案附件失敗:", error)
    throw error
  }
}

// 根據實體類型與實體 ID 取得檔案附件列表
export async function getFileAttachments(
  entityType: string,
  entityId: number
): Promise<FileAttachment[]> {
  try {
    return await db
      .select()
      .from(fileAttachments)
      .where(
        and(
          eq(fileAttachments.entityType, entityType),
          eq(fileAttachments.entityId, entityId)
        )
      )
      .orderBy(desc(fileAttachments.createdAt))
  } catch (error) {
    console.error("取得檔案附件列表失敗:", error)
    throw error
  }
}

// 更新檔案附件
export async function updateFileAttachment(
  id: number,
  updates: Partial<InsertFileAttachment>
): Promise<FileAttachment> {
  try {
    const [updated] = await db
      .update(fileAttachments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(fileAttachments.id, id))
      .returning()
    return updated
  } catch (error) {
    console.error("更新檔案附件失敗:", error)
    throw error
  }
}

// 刪除檔案附件
export async function deleteFileAttachment(id: number): Promise<void> {
  try {
    await db.delete(fileAttachments).where(eq(fileAttachments.id, id))
  } catch (error) {
    console.error("刪除檔案附件失敗:", error)
    throw error
  }
}